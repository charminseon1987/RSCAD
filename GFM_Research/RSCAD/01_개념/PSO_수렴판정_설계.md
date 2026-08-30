---
type: concept
date: 2026-08-28
phase: 4
status: draft
supersedes: ["이중수렴기준 설계", "Pso 이중수렴기준 (수렴조건 부분)"]
tags: [concept, PSO, convergence, MC, N-final, phase4]
---

# PSO 수렴판정 설계

> **저장 위치:** `01_개념/`

## 한 줄 정의

> PSO 를 언제 멈출 것인가. 이중 수렴 조건으로 **1회 실행**을 종료하고, MC 30회 통계로 **N_final** 을 확정한다.

목적함수가 무엇인지는 → [[PSO_목적함수_설계]]

---

## 이중 수렴 조건

한 번의 PSO 실행을 끝내는 조건. 두 개를 **모두** 만족해야 한다.

$$\text{조건 1 (상대 개선):}\quad \frac{|F^{(t)} - F^{(t-1)}|}{|F^{(t-1)}|} < 0.1\% \quad \text{연속 } S \text{회}$$

$$\text{조건 2 (누적 감소):}\quad \frac{|F^{(t-W)} - F^{(t)}|}{|F^{(t-W)}|} < 0.5\% \quad \text{동일 구간}$$

**왜 두 개인가**
- 조건 1 만 쓰면 평탄한 구간에서 조기 종료한다 (개선폭이 작아도 계속 내려갈 수 있음).
- 조건 2 만 쓰면 진동하는 궤적에서 종료되지 않는다.

> [!warning] `W` 와 `S` 가 정의돼 있지 않다
> 구 노트는 "연속 30회"라고만 적었다. 조건 2 의 윈도 길이 `W` 와 조건 1 의
> 연속 횟수 `S` 가 같은 값인지 다른 값인지 불명확하다.
> ▸ 확정 필요: `S = 30`, `W = ?`
> ※ `W` 는 `S` 보다 길어야 의미가 있다. 같으면 조건 2 가 조건 1 의 누적판이 되어
>   독립적인 판정이 아니다.

---

## 2단계 MC 구조

```
Phase 4a — 임계값 결정 (예비)
  조건1·2 임계값 (0.1%, 0.5%) 타당성 검증
  W·S 확정
  N_particle 결정

Phase 4b — N_final 결정 (본실험)
  MC 30회 실행
  정규성 검정 → 평균±SD 또는 IQR
  N_final = 수렴 반복 횟수의 중앙값
  현재 추정: N_final ≈ 390
```

```python
from scipy import stats
import numpy as np

results  = [pso_run(seed=s) for s in SEEDS]     # SEEDS 고정·기록 필수
F_finals = [r['F_multi'] for r in results]
N_finals = [r['n_iter']  for r in results]

stat, p = stats.shapiro(F_finals)
if p > 0.10:
    summary = (np.mean(F_finals), np.std(F_finals, ddof=1))   # 정규
else:
    q1, q3 = np.percentile(F_finals, [25, 75])                # 비정규 → IQR
    summary = (np.median(F_finals), q3 - q1)

N_final = int(np.median(N_finals))
```

> [!danger] 난수 시드 고정·기록 필수 (`P4-A5`)
> MC 30회의 시드를 기록하지 않으면 재현이 불가능하다. 심사에서 요구된다.
> `SEEDS = list(range(30))` 처럼 명시하고 결과 파일에 저장할 것.

---

## 평가 비용

MC 30회 × N_final ≈ 390 반복 × N_particle 30 = **약 35만 회 목적함수 평가**.

각 평가는 격자점마다 `fsolve` + 22×22 고유값 분해를 수행한다.

| 격자 | 격자점 수 | 1회 F 평가 |
|---|---|---|
| SCR 4 × X/R 1 (구 설계) | 4 | 기준 |
| SCR 5 × X/R 3 | 15 | 3.75배 |
| SCR 11 × X/R 8 (88점) | 88 | 22배 |

※ **PSO 격자와 검증 격자를 분리해야 한다.** 88포인트 전체를 목적함수 안에서 돌리면 계산이 성립하지 않는다. PSO 는 대표점 소수(예: SCR 3.0/1.5/0.8 × X/R 0.5/1.0/3.0 = 9점)로 최적화하고, 88포인트는 최적해 검증에만 쓴다.
→ [[88포인트_2D_스윕_설계]]

▸ `persist=False` 로 디스크 쓰기를 차단하면 병목이 파일시스템에서 CPU 로 이동한다. → [[Simulation_코드구조]]

---

## PSO 하이퍼파라미터

```python
w  = 0.729   # 관성 가중치      ┐
c1 = 2.05    # 개인 최적        ├ Clerc-Kennedy 수렴 조건
c2 = 2.05    # 전역 최적        ┘
n_particles = 30
```

※ Clerc-Kennedy 조건은 `w = 0.7298`, `c1 = c2 = 1.49618` 로 인용되는 경우가 많다. `c = 2.05` 는 수축계수 χ 적용 **전** 값이다. 어느 형태를 쓰는지 코드와 노트를 일치시킬 것.

---

## 현재 상태

| Phase | 상태 | 내용 |
|---|---|---|
| 1 | ⚠️ 시뮬만 | 랜덤 수렴 곡선 |
| 2 | ⚠️ 시뮬만 | 고정 최적값 반환 |
| 3 | ⛔ **차단** | 목적함수 재설계 선행 필요 |
| 4 | — | 검증 |

> [!danger] `/api/pso` 의 가짜 데이터는 제거됨
> `app.py` v2 는 `random.uniform()` 으로 수렴 곡선을 생성해 반환했다.
> 대시보드가 이를 실제 결과처럼 표시하므로 v3 에서 501 로 교체했다.
> → [[실험_pso_미구현]]

---

## 착수 전 게이트

- [ ] `P3-A7` 모드 식별을 참여계수 기반으로 전환
- [ ] `P3-A6` ζ_threshold 또는 t_s_target 의 UNIFI 조항 특정
- [ ] `P4-A1` TABLE II — `model.PARAM_NAMES` 기준 재작성
- [ ] `P2-A10` δ>90° 가드 (없으면 무효 격자점이 "안정"으로 평가됨)
- [ ] `W` · `S` · `P_INFEASIBLE` 확정

---

## 🔗 연결 노트

| 방향 | 노트 | 이유 |
|---|---|---|
| ← | [[PSO_목적함수_설계]] | 무엇을 최소화하는가 |
| ← | [[과감쇠_동기화모드]] | 지표 전환 근거 |
| → | [[88포인트_2D_스윕_설계]] | 검증 격자 분리 |
| → | [[PSO MC 30회 본실험]] | Phase 4b 실행 |
| → | [[Phase04_PSO설계]] | 상위 계획 |
| → | [[Phase03_진행중]] | 선행 게이트 |

## 참고문헌

- ▸ [[Chen_2024_Electronics]] — MC 분석 방법론
- ▸ Clerc & Kennedy 2002 — 수축계수 수렴 조건

> [!question] 허브 갱신 필요
> [[Phase_지식_연결맵]] 과 [[GFM_연구_전체지도.md]] 에 연결할 것.
