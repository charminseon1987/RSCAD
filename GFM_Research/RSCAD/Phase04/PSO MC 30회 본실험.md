## 0. Phase 목표

> PSO 이중 수렴 기준으로 N_final 결정 + 최적 파라미터 확정

```
목표: MC 30회 실행 → N_final 결정 → ζ ≥ 0.64 달성 파라미터 확정
성공 기준:
  - [ ] ζ_min ≥ 0.64 (4개 SCR 모두)
  - [ ] 이중 수렴 조건1·2 동시 만족
  - [ ] Shapiro-Wilk p > 0.10 (정규성 확인)
  - [ ] N_final 결정 (추정 390회)
  - [ ] SCR*(X/R) boundaries 유효값 도출
```

---

## 1. 이전 Phase에서 넘어온 것

|항목|값|출처|
|---|---|---|
|ζ_min|< 0.64 (전 구간)|Phase 3 PSO 1차|
|엔진|sympy+numpy|Phase 2|
|A_k(9,6) 오차|0.0001%|Phase 2|
|PSO 파라미터 수|14개|[1] Chen|
|이중 수렴 기준|조건1·2 설계 완료|Phase 3|

---

## 2. Phase 4a — 임계값 결정 예비실험

python

```python
# 조건1·2 임계값 결정
# 30회 예비 실행으로 적정값 탐색

THRESHOLD_1 = 0.001   # 상대 개선 0.1%
THRESHOLD_2 = 0.005   # 누적 감소 0.5%
WINDOW      = 30      # 연속 30회
```

---

## 3. Phase 4b — N_final 결정 본실험

python

```python
from scipy import stats
import numpy as np

# MC 30회 실행
N_iters = []
for trial in range(30):
    result = run_pso_dual_convergence()
    N_iters.append(result['n_iter'])

# 정규성 검정
stat, p = stats.shapiro(N_iters)
print(f"Shapiro-Wilk p={p:.4f}")

if p > 0.10:
    N_final = int(np.mean(N_iters))
    print(f"정규분포 → N_final = {N_final}")
else:
    N_final = int(np.median(N_iters))
    print(f"비정규 → N_final = {N_final} (중앙값)")

# 현재 추정: N_final ≈ 390
```

---

## 4. PSO 설계 (Phase 3에서 이어받음)

### 목적함수

Fmulti=14∑k=14[αF1+βF2+γF3]SCRkF_{multi} = \frac{1}{4} \sum_{k=1}^{4} \left[ \alpha F_1 + \beta F_2 + \gamma F_3 \right]_{SCR_k}Fmulti​=41​k=1∑4​[αF1​+βF2​+γF3​]SCRk​​

|항목|수식|가중치|의미|
|---|---|---|---|
|F1|∑max⁡(0,Re(λ))\sum \max(0, \text{Re}(\lambda)) ∑max(0,Re(λ))|α=0.3|불안정 패널티|
|F2|∑(ζ−0.707)2\sum(\zeta - 0.707)^2 ∑(ζ−0.707)2|β=0.6|ζ 추종|
|F3|∑max⁡(0,0.64−ζ)\sum \max(0, 0.64-\zeta) ∑max(0,0.64−ζ)|γ=0.1|최소 ζ 보장|

### 최적화 파라미터 (14개)

|그룹|파라미터|하한|상한|
|---|---|---|---|
|VSG|J, Dp, wc, Lv|0.01, 1, 10, 0.001|10, 100, 200, 0.5|
|전압|Kpv, Kiv|0.01, 1|5, 500|
|전류|Kpc, Kic|0.1, 1|30, 200|
|DC|Kp1, Ki1, Kp2, Ki2, Kp3, Ki3|TBD|TBD|

---

## 5. 이중 수렴 기준 구현

python

```python
class DualConvergencePSO:
    def check_convergence(self, history, window=30):
        if len(history) < window:
            return False

        recent = history[-window:]

        # 조건 1: 상대 개선 < 0.1% 연속 30회
        rel_improve = abs(recent[-1] - recent[-2]) / (abs(recent[-2]) + 1e-12)
        cond1 = rel_improve < 0.001

        # 조건 2: 누적 감소 < 0.5% 동일 30회
        cum_reduce = abs(recent[0] - recent[-1]) / (abs(recent[0]) + 1e-12)
        cond2 = cum_reduce < 0.005

        return cond1 and cond2   # 두 조건 모두 만족
```

---

## 6. 핵심 수치 스냅샷 (업데이트 예정)

|항목|Phase 3|Phase 4 (목표)|달성|
|---|---|---|---|
|ζ_min|< 0.64|**≥ 0.64**|⏳|
|N_final|미결정|**~390회**|⏳|
|SCR* (X/R=1.0)|null|**1.0~2.0**|⏳|
|Shapiro-Wilk p|—|**> 0.10**|⏳|
|F_multi 수렴값|—|**< 0.1**|⏳|

---

## 7. 실험 결과 목록 (예정)

|날짜|실험명|상태|
|---|---|---|
|—|PSO 4a 예비실험|⏳|
|—|PSO 4b MC 30회 본실험|⏳|
|—|N_final 결정|⏳|
|—|최적 파라미터 sym.py 적용|⏳|
|—|88포인트 2D 스윕 재실행|⏳|

---

## 8. 미해결 → Phase 5로 이월 예정

```
[ ] DSP 코드 구현 (TMS320F28379D)
[ ] Anti-Windup Back-calculation
[ ] Phase 5: RTDS 연결 준비
```

---

## 🔗 연결 노트

### 이론

- [[Pso 이중수렴기준]] — 전체 PSO 설계
- [[이중수렴기준 설계]] — 조건1·2 상세
- [[참여인자 지배모드]] — 목적함수 지배 모드
- [[고유값_안정도판단]] — ζ ≥ 0.64 기준

### 선행 Phase

- [[Phase03_진행중]] — PSO 1차 구현
- [[Phase02_완료]] — sympy+numpy 엔진

### 참고문헌

- [[Chen_2024_Electronics]] — [1] 14개 파라미터, MC 방법론
- Clerc & Kennedy 2002 — w=0.729 수렴 조건

---

## 🤖 Claude 프롬프트 (Phase 4 착수용)

```
[GFM_마스터_컨텍스트_프롬프트.md]
[Phase03_진행중.md]
[이 Phase 4 노트 전체]
[이중수렴기준 설계.md]

→ "Phase 3 PSO 결과에서 ζ ≥ 0.64를 달성했다면
   MC 30회 본실험으로 N_final을 결정하는 코드를 작성해줘.
   
   Shapiro-Wilk 정규성 검정 포함
   IQR 기반 이상값 제거
   N_final = 정규분포면 평균, 비정규면 중앙값
   결과를 results/MC_30회_결과.md로 저장"
```