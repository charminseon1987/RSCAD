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


# ─────────────────────────────────────────── 규칙
def r4_no_evidence(doc: dict) -> list[str]:
    return [a["id"] for _, a in all_artifacts(doc) if a.get("state") == "verified" and not a.get("evidence")]


def r2_booking(doc: dict) -> dict | None:
    r = doc["resources"]["rtds_rack"]
    cm = doc["meta"]["current_month"]
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
    remaining = [p for p in doc["phases"] if not phase_done(p)]
    span = (max(p["window"][1] for p in remaining) - min(min(p["window"][0] for p in remaining), cm) + 1) if remaining else 0
    left = dm - cm
    hit = weeks_to_p7 < need or left < span
    return {"weeks_to_p7": round(weeks_to_p7, 1), "need_weeks": need, "months_left": left, "remaining_span": span} if hit else None


def r3_gate(doc: dict) -> list[str] | None:
    if doc["meta"]["current_month"] < 8:
        return None
    missing = [aid for aid in ("P4-A1", "P6-A4") if (find(doc, aid) or {}).get("state") != "verified"]
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
    gates = [("P4 착수", ["P3-A5"]), ("P6 착수", ["P5-A4"]), ("P7 착수", ["P4-A1", "P6-A4"]), ("P8 착수", ["P7-A3", "P7-A5"])]
    cm, dm = doc["meta"]["current_month"], doc["meta"]["deadline_month"]
    for name, req in gates:
        missing = [r for r in req if (find(doc, r) or {}).get("state") != "verified"]
        if missing:
            days = int((dm - cm) * 30.4)
            return f"{name} ← {', '.join(missing)} 미완 · 마감까지 약 {days}일"
    return "모든 게이트 통과"


# ─────────────────────────────────────────── 메인
def evaluate(yaml_path: Path, mirror_path: Path | None, fix_r4: bool) -> dict:
    doc = load(yaml_path)
    out: dict = {"current_month": doc["meta"]["current_month"], "alerts": [], "next_gate": next_gate(doc)}

    # priority 1 — R2
    r2 = r2_booking(doc)
    if r2 and not r2.get("pre"):
        out["alerts"].append({"id": "R2", "severity": "critical", "phase": "P6/P7",
                              "cond": f"booked_slots 비어 있음, 트리거 {r2['trigger_month']}월차 지남 ({r2['months_late']}개월)",
                              "action": "랙 예약 요청. 필요 시간은 P7-A0 파일럿 결과로 산정"})
    elif r2:
        out["pre_alert"] = f"R2 예고: {r2['months_until_trigger']}개월 뒤({r2['trigger_month']}월차) 랙 예약 경보 발동. 접근 자격·창구 확인 먼저"

    # priority 2 — R1
    r1 = r1_deadline(doc)
    if r1:
        out["alerts"].append({"id": "R1", "severity": "critical", "phase": "전체",
                              "cond": f"남은 {r1['months_left']}개월 < 미완 phase 스팬 {r1['remaining_span']}개월 (P7까지 {r1['weeks_to_p7']}주, 필요 {r1['need_weeks']}주)",
                              "action": "범위 축소 결정 — 88포인트를 축소 격자로 낮출지 지금 판단"})

    # priority 3 — R3
    r3 = r3_gate(doc)
    if r3:
        out["alerts"].append({"id": "R3", "severity": "high", "phase": "P7",
                              "cond": f"P7 착수조건 미충족: {', '.join(r3)}", "action": f"{r3[0]} 즉시 착수"})

    # priority 4 — R4
    r4 = r4_no_evidence(doc)
    if r4:
        out["alerts"].append({"id": "R4", "severity": "medium", "phase": "-",
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
        out["alerts"].append({"id": "R5", "severity": "low", "phase": "-",
                              "cond": f"{days}일간 schedule.yaml 변경 없음", "action": "점검 요청 1건"})

    if mirror_path and mirror_path.exists():
        out["mirror"] = mirror_drift(doc, mirror_path)
    return out


def render(res: dict) -> str:
    """output_policy: 경보 1건 = [등급] Phase / 조건 / 여유 / 단일 행동. 없으면 다음 게이트 한 줄."""
    lines = []
    if res["alerts"]:
        a = res["alerts"][0]  # priority 순 첫 항목만 — max_actions_per_response: 1
        lines.append(f"[{a['severity'].upper()}] {a['phase']} / {a['cond']} / {res['current_month']}월차 / 지금 할 것: {a['action']}")
        if len(res["alerts"]) > 1:
            lines.append(f"  (대기 경보 {len(res['alerts']) - 1}건: {', '.join(x['id'] for x in res['alerts'][1:])})")
    else:
        lines.append(res["next_gate"])
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
