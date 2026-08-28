"""
schedule_agent.py — 연구일정 경보 엔진

설계 원칙
  1. 순수 함수. 파일 I/O 는 load_schedule() 한 곳에만 있다.
  2. evaluate() 는 부작용이 없다. 같은 입력 → 같은 출력.
  3. 출력은 경보 0개 또는 1개. 행동도 1개. (output_policy)
  4. state 를 스스로 올리지 않는다. 내릴 수만 있다. (R4·R6 강등)
  5. current_month 를 파일에서 읽지 않는다. month_1_start + 오늘로 계산한다.
     파일에 저장하면 반드시 낡고, R1·R2 경보 타이밍이 어긋난다.

사용
    python schedule_agent.py                    # 경보 1건
    python schedule_agent.py --all              # 전체 경보
    python schedule_agent.py --audit            # 무결성만 (R6·R7)
    python schedule_agent.py --month 5.5        # 시점 시뮬레이션
    python schedule_agent.py -f path/to/schedule.yaml
"""

from __future__ import annotations

import argparse
import sys
from dataclasses import dataclass, field
from datetime import date
from enum import IntEnum
from pathlib import Path
from typing import Any

import yaml

VALID_STATES = ("not_started", "in_progress", "draft", "verified")

# schedule.yaml 의 rules 순서와 일치.
# R2 를 최우선에 두는 이유: 마감 압박은 범위를 줄여 흡수할 수 있지만
# 장비 예약 실패는 어떤 방법으로도 회복되지 않는다.
# R6 을 그 다음에 두는 이유: 증거 없는 verified 는 하류 전체를 조용히
# 무효화한다. 2026-08-28 에 P3-A1 이 pf.py 없이 verified 였고 그 위에
# P4 설계가 진행 중이었다.
RULE_PRIORITY = {"R2": 1, "R6": 2, "R3": 3, "R1": 4, "R7": 5, "R4": 6, "R5": 7}


class Severity(IntEnum):
    LOW = 1
    MEDIUM = 2
    HIGH = 3
    CRITICAL = 4

    @property
    def label(self) -> str:
        return {1: "낮음", 2: "중간", 3: "높음", 4: "긴급"}[int(self)]


@dataclass
class Alert:
    rule: str
    severity: Severity
    target: str
    condition: str
    action: str
    slack: str = ""


@dataclass
class Artifact:
    id: str
    name: str
    state: str
    phase_id: str = ""
    evidence: str | None = None
    blocking: bool = False
    do_now: bool = False
    gate_for: list = field(default_factory=list)
    result: Any = None
    superseded_result: Any = None
    deprecation_log: str | None = None
    integrity_incident: str | None = None
    raw: dict = field(default_factory=dict)

    # ── R4: 증거 경로조차 없는 verified 는 draft ──
    @property
    def state_r4(self) -> str:
        if self.state == "verified" and not self.evidence:
            return "draft"
        return self.state

    # ── R6: 경로는 있으나 파일이 없는 verified 도 draft ──
    def state_r6(self, code_root: Path) -> str:
        if self.state_r4 != "verified":
            return self.state_r4
        return "verified" if self.evidence_exists(code_root) else "draft"

    def evidence_exists(self, code_root: Path) -> bool | None:
        """None = 판정 불가 (evidence 없음)."""
        if not self.evidence:
            return None
        return bool(resolve_evidence(self.evidence, code_root))


@dataclass
class Phase:
    id: str
    name: str
    start_month: float
    end_month: float
    depends_on: list
    artifacts: list[Artifact]


@dataclass
class Schedule:
    meta: dict
    phases: list[Phase]
    gates: list[dict]
    current_month: float
    deadline_month: float
    code_root: Path

    @property
    def months_left(self) -> float:
        return self.deadline_month - self.current_month

    def artifact(self, aid: str) -> Artifact | None:
        for p in self.phases:
            for a in p.artifacts:
                if a.id == aid:
                    return a
        return None

    def all_artifacts(self):
        for p in self.phases:
            yield from p.artifacts


# ---------------------------------------------------------------------------
# 로드
# ---------------------------------------------------------------------------

def resolve_current_month(meta: dict, today: date | None = None) -> float:
    """current_month 는 저장하지 않고 매번 계산한다.

    파일에 박아두면 낡는다. 실제로 2026-08-20 에 4 로 적힌 값이
    2026-08-28 까지 그대로 남아 있었고, R1·R2 가 그 값을 입력으로 쓴다.
    """
    today = today or date.today()
    raw = str(meta.get("month_1_start", "")).strip()
    if not raw:
        raise ValueError("meta.month_1_start 가 없습니다 (예: 2026-05)")
    y, m = (int(x) for x in raw.split("-")[:2])
    return (today.year - y) * 12 + (today.month - m) + 1


def resolve_evidence(pattern: str, code_root: Path) -> list[Path]:
    """evidence 문자열 → 실재하는 경로 목록.

    - 'code_root/...' 접두어를 실제 경로로 치환
    - '::' 뒤 심볼 지정자는 파일 경로에서 제거 (op.py :: fd_jacobian)
    - 글롭(*) 지원
    """
    s = pattern.split("::")[0].strip()
    for prefix in ("code_root/", "vault_root/"):
        if s.startswith(prefix):
            s = s[len(prefix):]
            break
    if "*" in s:
        return list(code_root.glob(s))
    p = code_root / s
    return [p] if p.exists() else []


def load_schedule(path: str | Path, today: date | None = None,
                  month_override: float | None = None) -> Schedule:
    data = yaml.safe_load(Path(path).read_text(encoding="utf-8"))
    meta = data.get("meta", {})

    cur = month_override if month_override is not None \
        else resolve_current_month(meta, today)

    code_root = Path(str(meta.get("code_root", "."))).expanduser()

    phases = []
    for p in data.get("phases", []):
        win = p.get("window", [0, 0])
        arts = []
        for a in p.get("artifacts", []):
            st = a.get("state", "not_started")
            if st not in VALID_STATES:
                raise ValueError(f"{a.get('id')}: 알 수 없는 state '{st}'")
            arts.append(Artifact(
                id=a["id"], name=a.get("name", ""), state=st, phase_id=p["id"],
                evidence=a.get("evidence"),
                blocking=bool(a.get("blocking")), do_now=bool(a.get("do_now")),
                gate_for=a.get("gate_for") or [],
                result=a.get("result"),
                superseded_result=a.get("superseded_result"),
                deprecation_log=a.get("deprecation_log"),
                integrity_incident=a.get("integrity_incident"),
                raw=a,
            ))
        phases.append(Phase(id=p["id"], name=p.get("name", ""),
                            start_month=float(win[0]), end_month=float(win[1]),
                            depends_on=p.get("depends_on") or [], artifacts=arts))

    return Schedule(meta=meta, phases=phases, gates=data.get("gates", []),
                    current_month=float(cur),
                    deadline_month=float(meta.get("deadline_month", 12)),
                    code_root=code_root)


# ---------------------------------------------------------------------------
# 규칙 — 전부 순수 함수
# ---------------------------------------------------------------------------

def rule_R1_deadline(s: Schedule) -> Alert | None:
    """마감 역산. phase 는 겹치므로 소요를 더하면 안 된다 (달력 스팬)."""
    rem = [p for p in s.phases if p.end_month > s.current_month]
    if not rem:
        return None
    end = max(p.end_month for p in rem)
    if end > s.deadline_month:
        return Alert("R1", Severity.CRITICAL, "전체 일정",
                     f"마지막 phase 종료 {end:.0f}월차 > 마감 {s.deadline_month:.0f}월차",
                     "병렬화 가능한 phase 를 지정하거나 범위를 축소할 것",
                     f"{end - s.deadline_month:.1f}개월 초과")
    return None


def rule_R2_equipment(s: Schedule) -> Alert | None:
    """장비 경보.

    (a) P0 의 do_now·blocking 항목이 not_started → 즉시 경보
    (b) P0-A3 미결정 상태로 deadline_month 진입 → 최고 등급

    (a) 가 필요한 이유: Tier 결정 마감이 7월차라도 접근 자격 확인은 지금
    할 수 있다. 마감만 보면 그때까지 3개월간 조용해지고, 결정 시점에
    선행 확인이 안 돼 있으면 그 달을 통째로 잃는다.
    """
    p0 = next((p for p in s.phases if p.id == "P0"), None)
    if p0 and s.current_month >= p0.start_month:
        todo = [x for x in p0.artifacts
                if x.do_now and x.blocking and x.state == "not_started"]
        if todo:
            x = todo[0]
            return Alert("R2", Severity.HIGH, x.id,
                         f"지금 실행 가능한 선행 항목이 not_started ({len(todo)}건)",
                         f"{x.name}",
                         f"Tier 결정 마감까지 "
                         f"{float(s.artifact('P0-A3').raw.get('deadline_month', 7)) - s.current_month:.1f}개월")

    a = s.artifact("P0-A3")
    if a is None or a.state == "verified":
        return None
    dl = float(a.raw.get("deadline_month", 7))
    if s.current_month >= dl:
        return Alert("R2", Severity.CRITICAL, "P0-A3",
                     f"Tier 미결정 상태로 {s.current_month:.1f}월차 진입 (마감 {dl:.0f})",
                     "Tier 2(소프트웨어 검증만)로 확정하고 P6·P7 을 재설계할 것",
                     f"{s.current_month - dl:.1f}개월 초과")
    if s.current_month >= dl - 1:
        return Alert("R2", Severity.HIGH, "P0-A3",
                     f"Tier 결정 마감({dl:.0f}월차)까지 {dl - s.current_month:.1f}개월",
                     "P0-A1(랙 접근 자격 확인)을 오늘 실행할 것",
                     f"{dl - s.current_month:.1f}개월 남음")
    return None


def rule_R3_gate(s: Schedule) -> Alert | None:
    """하류 phase 진입 시점에 상류 blocking 항목이 verified 인가."""
    for g in s.gates:
        tgt = next((p for p in s.phases if p.id == g.get("target")), None)
        if tgt is None or s.current_month < tgt.start_month:
            continue
        for req in g.get("requires", []):
            a = s.artifact(req)
            if a is None:
                return Alert("R3", Severity.HIGH, g["id"],
                             f"{req} 가 schedule 에 정의돼 있지 않음",
                             f"{req} artifact 를 추가하거나 gate 에서 제거할 것")
            if a.state_r6(s.code_root) != "verified":
                return Alert("R3", Severity.CRITICAL, a.id,
                             f"{tgt.id} 착수 시점인데 {a.id} 가 "
                             f"{a.state_r6(s.code_root)} ({g['id']} 요구사항)",
                             str(g.get("on_fail", f"{a.id} 를 먼저 완료할 것")).strip())
    return None


def rule_R4_no_evidence(s: Schedule) -> Alert | None:
    """verified 인데 evidence 필드가 아예 없음."""
    bad = [a for a in s.all_artifacts()
           if a.state == "verified" and not a.evidence]
    if not bad:
        return None
    a = bad[0]
    return Alert("R4", Severity.MEDIUM, a.id,
                 f"verified 인데 evidence 가 null ({len(bad)}건)",
                 f"{a.id} 를 draft 로 강등하거나 evidence 경로를 기입할 것")


def rule_R5_stagnation(s: Schedule) -> Alert | None:
    """정체 감지. last_changed 가 없으면 판정 불가 — 조용히 넘기지 않는다."""
    tracked = [a for a in s.all_artifacts() if a.raw.get("last_changed")]
    if not tracked and any(a.state == "in_progress" for a in s.all_artifacts()):
        return Alert("R5", Severity.LOW, "schedule.yaml",
                     "last_changed 필드가 없어 정체 감지를 할 수 없음",
                     "in_progress 항목에 last_changed: YYYY-MM-DD 를 기입할 것")
    return None


def rule_R6_evidence_missing(s: Schedule) -> Alert | None:
    """★ verified 인데 evidence 파일이 실재하지 않음.

    2026-08-28: P3-A1 이 pf.py 없이 verified 였고, 그 위에 P4 목적함수
    설계가 진행 중이었다. 이 규칙이 없으면 같은 일이 반복된다.
    """
    bad = []
    for a in s.all_artifacts():
        if a.state != "verified" or not a.evidence:
            continue
        if not a.evidence_exists(s.code_root):
            bad.append(a)
    if not bad:
        return None
    a = bad[0]
    others = f" (총 {len(bad)}건)" if len(bad) > 1 else ""
    return Alert("R6", Severity.CRITICAL, a.id,
                 f"verified 인데 evidence 파일 없음: {a.evidence}{others}",
                 f"{a.id} 를 draft 로 강등하고 하류 작업을 중단할 것",
                 f"code_root={s.code_root}")


def rule_R7_value_swap(s: Schedule) -> Alert | None:
    """★ 값 교체 기록 불완전.

    result 를 바꿀 때 superseded_result 와 deprecation_log 가 짝을 이뤄야
    한다. 하나만 있으면 폐기 경위가 추적되지 않는다.
    """
    for a in s.all_artifacts():
        has_sup = a.superseded_result is not None
        has_log = a.deprecation_log is not None
        if has_sup and not has_log:
            return Alert("R7", Severity.MEDIUM, a.id,
                         "superseded_result 는 있으나 deprecation_log 가 없음",
                         f"01_개념/폐기값_이력.md 에 항목을 추가하고 "
                         f"{a.id}.deprecation_log 로 가리킬 것")
        if has_log and not has_sup and a.integrity_incident is None:
            return Alert("R7", Severity.LOW, a.id,
                         "deprecation_log 는 있으나 superseded_result 가 없음",
                         f"{a.id} 에 구 값을 superseded_result 로 남길 것")
    return None


RULES = (rule_R2_equipment, rule_R6_evidence_missing, rule_R3_gate,
         rule_R1_deadline, rule_R7_value_swap, rule_R4_no_evidence,
         rule_R5_stagnation)


def evaluate(s: Schedule) -> list[Alert]:
    alerts = [a for a in (r(s) for r in RULES) if a is not None]
    alerts.sort(key=lambda a: (-int(a.severity), RULE_PRIORITY.get(a.rule, 99)))
    return alerts


# ---------------------------------------------------------------------------
# 출력 — 경보 1건, 행동 1개. 요약·격려 금지.
# ---------------------------------------------------------------------------

def render(alerts: list[Alert], show_all: bool = False) -> str:
    if not alerts:
        return "경보 없음."
    sel = alerts if show_all else alerts[:1]
    out = []
    for a in sel:
        head = f"[{a.rule}] {a.severity.label} — {a.target}"
        body = [head, f"  조건: {a.condition}"]
        if a.slack:
            body.append(f"  여유: {a.slack}")
        body.append(f"  → {a.action}")
        out.append("\n".join(body))
    if not show_all and len(alerts) > 1:
        out.append(f"\n(그 외 {len(alerts) - 1}건. --all 로 확인)")
    return "\n\n".join(out)


def render_audit(s: Schedule) -> str:
    """무결성 감사 — verified 항목의 evidence 실재 여부 전수."""
    rows, miss = [], 0
    for a in s.all_artifacts():
        if a.state != "verified":
            continue
        ok = a.evidence_exists(s.code_root)
        mark = "OK " if ok else ("?? " if ok is None else "MISS")
        if ok is not True:
            miss += 1
        rows.append(f"  {mark}  {a.id:<8} {a.evidence or '(evidence null)'}")
    if not rows:
        return "verified 항목 없음."
    head = f"code_root = {s.code_root}\nverified {len(rows)}건 중 문제 {miss}건\n"
    return head + "\n".join(rows)


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="연구일정 경보 엔진")
    ap.add_argument("-f", "--file", default="schedule.yaml")
    ap.add_argument("--all", action="store_true", help="전체 경보 출력")
    ap.add_argument("--audit", action="store_true", help="evidence 실재 감사만")
    ap.add_argument("--month", type=float, default=None,
                    help="current_month 강제 지정 (시뮬레이션)")
    args = ap.parse_args(argv)

    try:
        s = load_schedule(args.file, month_override=args.month)
    except Exception as e:                                   # noqa: BLE001
        print(f"로드 실패: {e}", file=sys.stderr)
        return 2

    if args.audit:
        print(render_audit(s))
        return 0

    print(f"{s.current_month:.1f}월차 / 마감 {s.deadline_month:.0f}월차\n")
    alerts = evaluate(s)
    print(render(alerts, show_all=args.all))
    return 1 if alerts else 0


if __name__ == "__main__":
    sys.exit(main())
