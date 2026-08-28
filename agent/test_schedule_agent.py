"""test_schedule_agent.py — 규칙 엔진 회귀 테스트

  python test_schedule_agent.py
"""
import sys, tempfile
from datetime import date
from pathlib import Path

import yaml

from schedule_agent import (Schedule, Phase, Artifact, load_schedule, evaluate,
                            render, resolve_current_month, resolve_evidence,
                            rule_R1_deadline, rule_R2_equipment, rule_R3_gate,
                            rule_R4_no_evidence, rule_R6_evidence_missing,
                            rule_R7_value_swap)

PASS = FAIL = 0
def check(name, cond):
    global PASS, FAIL
    if cond:
        PASS += 1
    else:
        FAIL += 1
        print(f"  FAIL: {name}")

def sched(phases, current_month=4.0, deadline=12.0, gates=(), code_root="/tmp"):
    return Schedule(meta={}, phases=list(phases), gates=list(gates),
                    current_month=current_month, deadline_month=deadline,
                    code_root=Path(code_root))

def ph(pid, s, e, arts, deps=()):
    return Phase(pid, pid, s, e, list(deps), list(arts))

def art(aid, state="not_started", **kw):
    kw.setdefault("raw", {})
    return Artifact(id=aid, name=aid, state=state, **kw)

# ── current_month 계산 ──────────────────────────────────────
check("month 계산 2026-05 → 2026-08 = 4",
      resolve_current_month({"month_1_start": "2026-05"}, date(2026, 8, 28)) == 4)
check("month 계산 연도 넘김",
      resolve_current_month({"month_1_start": "2026-05"}, date(2027, 2, 1)) == 10)
try:
    resolve_current_month({}, date(2026, 8, 1)); check("month_1_start 누락 시 예외", False)
except ValueError:
    check("month_1_start 누락 시 예외", True)

# ── evidence 경로 해석 ──────────────────────────────────────
with tempfile.TemporaryDirectory() as td:
    root = Path(td)
    (root / "Simulation").mkdir()
    (root / "Simulation" / "model.py").write_text("x")
    check("code_root 접두어 제거",
          resolve_evidence("code_root/Simulation/model.py", root))
    check("'::' 심볼 지정자 제거",
          resolve_evidence("code_root/Simulation/model.py :: jac", root))
    check("없는 파일은 빈 목록",
          not resolve_evidence("code_root/Simulation/pf.py", root))
    (root / "results").mkdir(); (root / "results" / "a_XR1.npy").write_text("x")
    check("글롭 매칭", resolve_evidence("code_root/results/*_XR*.npy", root))

    # ── R6: verified 인데 파일 없음 (2026-08-28 P3-A1 재현) ──
    s = sched([ph("P3", 3, 4, [
        art("P3-A1", "verified", evidence="code_root/Simulation/pf.py"),
        art("P2-A1", "verified", evidence="code_root/Simulation/model.py"),
    ])], code_root=root)
    a = rule_R6_evidence_missing(s)
    check("R6 누락 검출", a is not None and a.target == "P3-A1")
    check("R6 실재 항목은 통과", "model.py" not in (a.condition if a else ""))
    check("R6 강등", s.artifact("P3-A1").state_r6(root) == "draft")
    check("R6 정상 항목 유지", s.artifact("P2-A1").state_r6(root) == "verified")

    # R3 가 R6 강등을 반영하는가
    s2 = sched([ph("P3", 3, 4, [art("P3-A1", "verified",
                                    evidence="code_root/Simulation/pf.py")]),
                ph("P4", 4, 6, [])],
               current_month=4.0,
               gates=[{"id": "G-P4", "target": "P4", "requires": ["P3-A1"],
                       "on_fail": "PSO 전량 재실행"}],
               code_root=root)
    g = rule_R3_gate(s2)
    check("R3 이 R6 강등을 반영", g is not None and g.target == "P3-A1")

# ── R4: evidence 필드 자체가 없음 ───────────────────────────
check("R4 evidence null 검출",
      rule_R4_no_evidence(sched([ph("P3", 3, 4, [art("P3-A4", "verified")])])) is not None)
check("R4 오탐 없음",
      rule_R4_no_evidence(sched([ph("P3", 3, 4, [art("P3-A4", "draft")])])) is None)

# ── R1: 겹치는 phase 를 합산하면 안 된다 ────────────────────
ov = sched([ph("P4", 4, 6, []), ph("P5", 5, 6, []), ph("P8", 11, 12, [])])
check("R1 오탐 없음 (병렬 phase 이중계산 금지)", rule_R1_deadline(ov) is None)
check("R1 실제 초과 감지",
      rule_R1_deadline(sched([ph("P8", 11, 14, [])])) is not None)

# ── R2: Tier 결정 마감 ──────────────────────────────────────
p0 = lambda st: ph("P0", 4, 5, [Artifact("P0-A3", "Tier", st,
                                         raw={"deadline_month": 5})])
check("R2 마감 1개월 전 경보", rule_R2_equipment(sched([p0("not_started")], 4.0)) is not None)
check("R2 마감 초과 = CRITICAL",
      rule_R2_equipment(sched([p0("not_started")], 5.5)).severity == 4)
check("R2 결정 완료 시 침묵", rule_R2_equipment(sched([p0("verified")], 6.0)) is None)
check("R2 이른 시점 침묵", rule_R2_equipment(sched([p0("not_started")], 2.0)) is None)

# ── R2 (a): do_now 선행 항목 ────────────────────────────────
def p0_full(a3_state, a1_state):
    return ph("P0", 4, 7, [
        Artifact("P0-A1", "랙 접근 자격 확인", a1_state, do_now=True,
                 blocking=True, raw={}),
        Artifact("P0-A3", "Tier", a3_state, raw={"deadline_month": 7}),
    ])
r = rule_R2_equipment(sched([p0_full("not_started", "not_started")], 4.0))
check("R2(a) do_now 미착수 즉시 경보", r is not None and r.target == "P0-A1")
check("R2(a) 마감 전이어도 발화", r.severity == 3)
check("R2(a) 완료 시 침묵",
      rule_R2_equipment(sched([p0_full("not_started", "verified")], 4.0)) is None)
check("R2(b) 마감 초과가 우선",
      rule_R2_equipment(sched([p0_full("not_started", "verified")], 7.5)).severity == 4)
check("R2 P0 시작 전 침묵",
      rule_R2_equipment(sched([p0_full("not_started", "not_started")], 2.0)) is None)

# ── R7: 값 교체 기록 불완전 ─────────────────────────────────
check("R7 superseded 만 있고 log 없음",
      rule_R7_value_swap(sched([ph("P2", 2, 3, [
          art("P2-A4", "draft", result="26.24", superseded_result="59")])])) is not None)
check("R7 짝이 맞으면 침묵",
      rule_R7_value_swap(sched([ph("P2", 2, 3, [
          art("P2-A4", "draft", result="26.24", superseded_result="59",
              deprecation_log="01_개념/폐기값_이력.md#4")])])) is None)

# ── 우선순위: R2 > R6 ───────────────────────────────────────
with tempfile.TemporaryDirectory() as td:
    root = Path(td)
    s = sched([p0("not_started"),
               ph("P3", 3, 4, [art("P3-A1", "verified",
                                   evidence="code_root/Simulation/pf.py")])],
              current_month=5.5, code_root=root)
    al = evaluate(s)
    check("R2 가 R6 보다 먼저", al and al[0].rule == "R2")
    check("R6 도 함께 검출", any(x.rule == "R6" for x in al))
    check("기본 출력은 1건", render(al).count("[R") == 1)
    check("--all 은 전체", render(al, show_all=True).count("[R") == len(al))

# ── 통합: 실제 YAML 로드 ────────────────────────────────────
doc = {
    "meta": {"month_1_start": "2026-05", "deadline_month": 12, "code_root": "/tmp"},
    "phases": [{"id": "P2", "name": "야코비안", "window": [2, 3],
                "artifacts": [{"id": "P2-A1", "name": "모델", "state": "draft"}]}],
    "gates": [],
}
with tempfile.NamedTemporaryFile("w", suffix=".yaml", delete=False,
                                 encoding="utf-8") as f:
    yaml.safe_dump(doc, f, allow_unicode=True); tmp = f.name
s = load_schedule(tmp, today=date(2026, 8, 28))
check("YAML 로드 + month 계산", s.current_month == 4)
check("current_month 는 파일에서 읽지 않는다", "current_month" not in s.meta)
check("month_override 동작", load_schedule(tmp, month_override=9.0).current_month == 9.0)

doc["phases"][0]["artifacts"][0]["state"] = "완료"
with open(tmp, "w", encoding="utf-8") as f:
    yaml.safe_dump(doc, f, allow_unicode=True)
try:
    load_schedule(tmp); check("잘못된 state 는 예외", False)
except ValueError:
    check("잘못된 state 는 예외", True)

print(f"\n{PASS} passed, {FAIL} failed")
sys.exit(1 if FAIL else 0)
