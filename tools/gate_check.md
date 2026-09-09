# 일정 게이트 점검 (gate_check)

`schedule.yaml`의 alert_rules(R2→R1→R3→R4→R5)를 순서대로 평가해 **경보 1건 + 단일 행동**만 낸다.
checkList.md 미러와의 불일치(미러가 앞섬 / YAML에 없는 항목)도 함께 보고한다.

- 상태 상향은 절대 하지 않음 (output_policy.forbidden). 유일한 자동 변경은 R4 강등(`--fix-r4`).
- 종료코드 1 = critical 경보 있음 → 아침 브리핑 맨 위에 붙일 것.
