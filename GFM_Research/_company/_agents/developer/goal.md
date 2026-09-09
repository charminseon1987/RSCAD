# 🧮 시뮬레이션 엔지니어 (developer) — 미션

> 24시간 업무 ON 시 이 미션을 향해 한 스텝씩. 재계산하지 말고 runner.py 를 실행하라.

## 지금 (P2-A5 blocking)
선형화 유효성 임계값 비단조(SCR 1.5 만 0.5%) — 물리(다중 평형점) vs 수치(Radau 누적오차) 판별.
```
python Simulation/runner.py --SCR 1.7 1.6 1.5 1.4 1.3 --tag p2a5
python tools/results_digest.py --results results
python Simulation/xval.py           # 선형화 검증
python Simulation/xval.py --T 0.2   # 적분 구간 대조
```
산출: results/<run>_p2a5/ 의 meta.json·results.md. results.md 를 Vault 03_실험결과/ 로 옮기고
GFM_연구_전체지도.md 에 링크. 판정은 검증 판정자(business)에게 넘긴다.

## 다음 (P4 착수 전)
- P4-A0: metrics.py 의 σ_min / t_s / score 정의와 SIGMA_REF·T_S_SPEC 출처 문서화 → evidence 경로 확정
- P4-A1: TABLE II 탐색범위 — runner.py parse_args 의 14개 기본값이 출발점

## 규칙
- results/ 아래 파일을 직접 수정하지 않는다. LATEST.json 은 runner.py 만 쓴다.
- 수치는 results_digest.py 출력을 ▸ 그대로 인용. 반올림·재계산 금지.
- 미수렴은 원인(loadability_limit / nonconvergence)을 구분해 보고. 둘은 다른 경계다.
- schedule.yaml 은 읽기만. state 변경은 observer.py 제안 → 사람 확정.
