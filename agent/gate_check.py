#!/usr/bin/env python3
"""
gate_check.py — schedule.yaml 경보 판정기 (LLM 없음, 결정론적)

schedule.yaml 의 alert_rules 를 priority 순서로 평가하고 output_policy 대로 한 줄만 낸다.
checkList.md 미러와의 불일치도 같이 검출한다 (YAML 이 진실원이지만, 미러가 앞서 있으면
사용자에게 YAML 갱신을 요청 — 사용자 확인 없는 state 상향은 금지 규칙이므로 도구가 직접 올리지 않는다).

사용:
  python gate_check.py --yaml GFM_Research/schedule.yaml
  python gate_check.py --yaml ... --mirror GFM_Research/checkList.md
  python gate_check.py --yaml ... --fix-r4        # verified+evidence null → draft 강등 (규칙 R4, 허용된 유일한 자동 변경)
  python gate_check.py --yaml ... --json          # 아침 브리핑/텔레그램용 구조화 출력

connect-ai 연결:
  _agents/secretary/tools/gate_check.py 로 복사 → 아침 브리핑 첫 줄에 이 도구 stdout 을 붙인다.
"""
from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from datetime import date, datetime
from pathlib import Path

import yaml

WEEKS_PER_MONTH = 4.33
STATES = ("not_started", "in_progress", "draft", "verified")


# ─────────────────────────────────────────── 로딩
def load(p: Path) -> dict:
    return yaml.safe_load(p.read_text(encoding="utf-8"))


def all_artifacts(doc: dict):
    for ph in doc.get("phases", []):
        for a in ph.get("artifacts", []):
            yield ph["id"], a
    for a in doc.get("continuous", []):
        yield "C", a


def find(doc: dict, aid: str) -> dict | None:
    for _, a in all_artifacts(doc):
        if a["id"] == aid:
            return a
    return None


def phase(doc: dict, pid: str) -> dict | None:
    return next((p for p in doc["phases"] if p["id"] == pid), None)


def phase_done(ph: dict) -> bool:
    return all(a.get("state") == "verified" for a in ph.get("artifacts", []))


def tier(doc: dict):
    return doc["meta"].get("tier")


def phase_applies(doc: dict, ph: dict) -> bool:
    """applies_to_tier 가 있으면 현재 tier 에 해당할 때만 일정에 포함."""
    t = tier(doc)
    lst = ph.get("applies_to_tier")
    return True if not lst or t is None else t in lst


def p7_gate(doc: dict) -> list[str]:
    g = doc.get("gates", {}).get("P7", ["P4-A1", "P6-A4"])
    if isinstance(g, dict):
        return g.get(f"tier{tier(doc)}", g.get("tier1"))
    return g


def month_check(doc: dict) -> str | None:
    """month_1_start 로 계산한 월차와 current_month 가 다르면 경고 (자동 수정 안 함, 규칙 4)."""
    m1 = doc["meta"].get("month_1_start")
    if not m1:
        return None
    y, m = map(int, str(m1).split("-")[:2])
    today = date.today()
    calc = (today.year - y) * 12 + (today.month - m) + 1
    cm = doc["meta"]["current_month"]
    return None if calc == cm else f"current_month={cm} 인데 {m1} 기준 오늘은 {calc}월차 — 사용자가 갱신할 것"


# ─────────────────────────────────────────── 규칙
def r0_tier(doc: dict) -> dict | None:
    cm, dl, t = doc["meta"]["current_month"], doc["meta"].get("tier_deadline_month"), tier(doc)
    if dl is not None and t is None and cm >= dl:
        return {"month": cm, "deadline": dl}
    return None


def r4_no_evidence(doc: dict) -> list[str]:
    return [a["id"] for _, a in all_artifacts(doc) if a.get("state") == "verified" and not a.get("evidence")]


def r2_booking(doc: dict) -> dict | None:
    r = doc["resources"]["rtds_rack"]
    cm = doc["meta"]["current_month"]
    req = r.get("required_by_tier")
    if req and tier(doc) is not None and tier(doc) not in req:
        return None  # 이 tier 에서는 랙 불필요
    trigger_month = r["required_from_month"] - r["booking_lead_time_weeks"] / 4
    if not r.get("booked_slots") and cm >= trigger_month:
        return {"months_late": round(cm - trigger_month, 1), "trigger_month": trigger_month}
    if not r.get("booked_slots"):
        return {"months_until_trigger": round(trigger_month - cm, 1), "trigger_month": trigger_month, "pre": True}
    return None


def r1_deadline(doc: dict) -> dict | None:
    cm, dm = doc["meta"]["current_month"], doc["meta"]["deadline_month"]
    p7 = phase(doc, "P7")
    weeks_to_p7 = (p7["window"][0] - cm) * WEEKS_PER_MONTH
    need = p7.get("min_duration_weeks", 8) + 4
    remaining = [p for p in doc["phases"] if not phase_done(p) and phase_applies(doc, p)]
    span = (max(p["window"][1] for p in remaining) - cm + 1) if remaining else 0  # 지금부터 마지막 미완 phase 끝까지
    left = dm - cm
    hit = weeks_to_p7 < need or left < span
    return {"weeks_to_p7": round(weeks_to_p7, 1), "need_weeks": need, "months_left": left, "remaining_span": span} if hit else None


def r3_gate(doc: dict) -> list[str] | None:
    if doc["meta"]["current_month"] < 8:
        return None
    missing = [aid for aid in p7_gate(doc) if (find(doc, aid) or {}).get("state") != "verified"]
    return missing or None


def r5_stale(path: Path) -> int | None:
    """마지막 변경 후 일수 — git 이면 마지막 커밋, 아니면 mtime."""
    try:
        out = subprocess.run(["git", "log", "-1", "--format=%cI", "--", path.name],
                             cwd=path.parent, capture_output=True, text=True, timeout=5).stdout.strip()
        last = datetime.fromisoformat(out).date() if out else None
    except Exception:  # noqa: BLE001
        last = None
    if last is None:
        last = datetime.fromtimestamp(path.stat().st_mtime).date()
    return (date.today() - last).days


# ─────────────────────────────────────────── 미러 대조
CHECK_RE = re.compile(r"^\s*-\s*\[([ xX])\]\s*`?([PC]\d+-A\d+|C\d+)`?", re.M)


def mirror_drift(doc: dict, mirror: Path) -> dict:
    txt = mirror.read_text(encoding="utf-8")
    boxes = {m.group(2): m.group(1).lower() == "x" for m in CHECK_RE.finditer(txt)}
    yaml_ids = {a["id"] for _, a in all_artifacts(doc)}
    ahead, behind, unknown = [], [], []
    for aid, checked in boxes.items():
        a = find(doc, aid)
        if a is None:
            unknown.append(aid)
            continue
        ver = a.get("state") == "verified"
        if checked and not ver:
            ahead.append(f"{aid}(yaml={a.get('state')})")
        if ver and not checked:
            behind.append(aid)
    only_yaml = sorted(yaml_ids - set(boxes))
    return {"mirror_ahead": ahead, "mirror_behind": behind, "not_in_yaml": unknown, "not_in_mirror": only_yaml}


# ─────────────────────────────────────────── 다음 게이트
def next_gate(doc: dict) -> str:
    g = doc.get("gates") or {"P4": ["P3-A5"], "P6": ["P5-A4"], "P7": ["P4-A1", "P6-A4"], "P8": ["P7-A3", "P7-A5"]}
    gates = []
    for pid in ("P4", "P6", "P7", "P8"):
        ph = phase(doc, pid)
        if ph and not phase_applies(doc, ph):
            continue
        req = p7_gate(doc) if pid == "P7" else g.get(pid, [])
        gates.append((f"{pid} 착수", req))
    cm, dm = doc["meta"]["current_month"], doc["meta"]["deadline_month"]
    for name, req in gates:
        missing = [r for r in req if (find(doc, r) or {}).get("state") != "verified"]
        if missing:
            days = int((dm - cm) * 30.4)
            return f"{name} ← {', '.join(missing)} 미완 · 마감까지 약 {days}일"
    return "모든 게이트 통과"


# ─────────────────────────────────────────── 메인
def _sev(doc: dict, rule_id: str, default: str) -> str:
    """alert_rules 의 severity 를 YAML 에서 읽는다 — pace 정책은 YAML 이 결정."""
    for r in doc.get("alert_rules", []):
        if r.get("id") == rule_id and r.get("severity"):
            return r["severity"]
    return default


def evaluate(yaml_path: Path, mirror_path: Path | None, fix_r4: bool) -> dict:
    doc = load(yaml_path)
    out: dict = {"current_month": doc["meta"]["current_month"], "tier": tier(doc), "alerts": [], "next_gate": next_gate(doc)}
    mw = month_check(doc)
    if mw:
        out["month_warning"] = mw

    # priority 0 — R0
    r0 = r0_tier(doc)
    if r0:
        out["alerts"].append({"id": "R0", "severity": _sev(doc, "R0", "critical"), "phase": "P0",
                              "cond": f"Tier 미결정, 마감 {r0['deadline']}월차 지남 (현재 {r0['month']}월차)",
                              "action": "Tier 2 자동 확정 후보 — 사용자 확인 요청 (도구는 값을 쓰지 않음)"})

    # priority 1 — R2
    r2 = r2_booking(doc)
    if r2 and not r2.get("pre"):
        out["alerts"].append({"id": "R2", "severity": _sev(doc, "R2", "critical"), "phase": "P6/P7",
                              "cond": f"booked_slots 비어 있음, 트리거 {r2['trigger_month']}월차 지남 ({r2['months_late']}개월)",
                              "action": "랙 예약 요청. 필요 시간은 P7-A0 파일럿 결과로 산정"})
    elif r2:
        out["pre_alert"] = f"R2 예고: {r2['months_until_trigger']}개월 뒤({r2['trigger_month']}월차) 랙 예약 경보 발동. 접근 자격·창구 확인 먼저"

    # priority 2 — R1
    r1 = r1_deadline(doc)
    if r1:
        out["alerts"].append({"id": "R1", "severity": _sev(doc, "R1", "critical"), "phase": "전체",
                              "cond": f"남은 {r1['months_left']}개월 < 미완 phase 스팬 {r1['remaining_span']}개월 (P7까지 {r1['weeks_to_p7']}주, 필요 {r1['need_weeks']}주)",
                              "action": "범위 축소 결정 — 88포인트를 축소 격자로 낮출지 지금 판단"})

    # priority 3 — R3
    r3 = r3_gate(doc)
    if r3:
        out["alerts"].append({"id": "R3", "severity": _sev(doc, "R3", "high"), "phase": "P7",
                              "cond": f"P7 착수조건 미충족: {', '.join(r3)}", "action": f"{r3[0]} 즉시 착수"})

    # priority 4 — R4
    r4 = r4_no_evidence(doc)
    if r4:
        out["alerts"].append({"id": "R4", "severity": _sev(doc, "R4", "medium"), "phase": "-",
                              "cond": f"증거 없는 verified: {', '.join(r4)}", "action": "draft 로 강등 (--fix-r4)"})
        if fix_r4:
            for aid in r4:
                find(doc, aid)["state"] = "draft"
            doc["meta"]["updated"] = date.today().isoformat()
            yaml_path.write_text(yaml.safe_dump(doc, allow_unicode=True, sort_keys=False), encoding="utf-8")
            out["fixed_r4"] = r4

    # priority 5 — R5
    days = r5_stale(yaml_path)
    if days is not None and days >= 14:
        out["alerts"].append({"id": "R5", "severity": _sev(doc, "R5", "low"), "phase": "-",
                              "cond": f"{days}일간 schedule.yaml 변경 없음", "action": "점검 요청 1건"})

    order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
    out["alerts"].sort(key=lambda a: order.get(a["severity"], 9))  # 같은 등급 내에선 priority 순 유지
    if mirror_path and mirror_path.exists():
        out["mirror"] = mirror_drift(doc, mirror_path)
    return out


def render(res: dict) -> str:
    """output_policy: 경보 1건 = [등급] Phase / 조건 / 여유 / 단일 행동. 없으면 다음 게이트 한 줄."""
    lines = []
    top = res["alerts"][0] if res["alerts"] else None
    if top and top["severity"] in ("critical", "high"):
        # on_alert: 단일 행동만
        lines.append(f"[{top['severity'].upper()}] {top['phase']} / {top['cond']} / {res['current_month']}월차 / 지금 할 것: {top['action']}")
        if len(res["alerts"]) > 1:
            lines.append(f"  (대기 경보 {len(res['alerts']) - 1}건: {', '.join(x['id'] for x in res['alerts'][1:])})")
    else:
        # on_clear: 다음 게이트가 곧 '지금 할 것'. medium/low 는 참고로만
        lines.append(f"다음 게이트: {res['next_gate']}")
        for a in res["alerts"]:
            lines.append(f"  참고 [{a['severity']}] {a['id']}: {a['cond']}")
    if res.get("month_warning"):
        lines.append("  ⚠ " + res["month_warning"])
    if res.get("pre_alert"):
        lines.append("  " + res["pre_alert"])
    m = res.get("mirror")
    if m and any(m.values()):
        if m["mirror_ahead"]:
            lines.append(f"  미러가 YAML보다 앞섬(사용자 확인 후 YAML 갱신 필요): {', '.join(m['mirror_ahead'])}")
        if m["mirror_behind"]:
            lines.append(f"  YAML verified인데 미러 미체크: {', '.join(m['mirror_behind'])}")
        if m["not_in_yaml"]:
            lines.append(f"  YAML에 없는 미러 항목: {', '.join(m['not_in_yaml'])}")
    if res.get("fixed_r4"):
        lines.append(f"  R4 적용: {', '.join(res['fixed_r4'])} → draft")
    return "\n".join(lines)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--yaml", required=True)
    ap.add_argument("--mirror", help="checkList.md 경로 (기본: yaml 옆 checkList.md)")
    ap.add_argument("--fix-r4", action="store_true")
    ap.add_argument("--json", action="store_true")
    a = ap.parse_args()
    yp = Path(a.yaml).expanduser().resolve()
    mp = Path(a.mirror).expanduser().resolve() if a.mirror else yp.with_name("checkList.md")
    res = evaluate(yp, mp if mp.exists() else None, a.fix_r4)
    print(json.dumps(res, ensure_ascii=False, indent=2) if a.json else render(res))
    sys.exit(1 if any(x["severity"] == "critical" for x in res["alerts"]) else 0)
