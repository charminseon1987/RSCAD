---

## type: concept date: 2026-08-21 phase: 3 status: pending tags: [concept, PSO, convergence, dual-criterion, optimization]

# 💡 PSO 이중수렴기준

## 한 줄 정의

> 두 가지 수렴 조건을 동시에 만족해야 PSO를 종료 — 조기 종료 및 과적합 방지

## 이중 수렴 기준

$$ \text{조건 1 (상대 개선):} \quad \frac{|F^{(t)} - F^{(t-1)}|}{|F^{(t-1)}|} < 0.1% \quad \text{연속 30회} $$

$$ \text{조건 2 (누적 감소):} \quad \frac{|F^{(t-W)} - F^{(t)}|}{|F^{(t-W)}|} < 0.5% \quad \text{동일 30회} $$

> 두 조건 **모두** 만족 시 수렴 → 종료

## 목적함수 F_multi

```python
def F_multi(params, SCR_list=[3.0, 2.0, 1.5, 1.0]):
    F_total = 0
    for scr in SCR_list:
        eigs = get_eigenvalues(scr, params)
        # F1: 불안정 모드 패널티
        F1 = sum(max(0, e.real) for e in eigs)
        # F2: ζ=0.707 추종
        F2 = sum((z - 0.707)**2 for z in zetas)
        # F3: ζ_min ≥ 0.64 보장
        F3 = sum(max(0, 0.64 - z) for z in zetas)
        F_total += 0.3*F1 + 0.6*F2 + 0.1*F3
    return F_total / len(SCR_list)

# 가중치: α=0.3, β=0.6, γ=0.1
```

## 최적화 파라미터 14개

|그룹|파라미터|범위|단위|
|---|---|---|---|
|VSG|J, Dp, wc, Lv|0.01~10, 1~100, 10~200, 0.001~0.5|kg·m², N·m·s, rad/s, pu|
|전압루프|Kpv, Kiv|0.01~5, 1~500|A/V, A/Vs|
|전류루프|Kpc, Kic|0.1~30, 1~200|V/A, V/As|
|DC (6개)|Kp1, Ki1, ...|TBD|—|

## PSO 하이퍼파라미터

```python
# Clerc-Kennedy 수렴 조건
w  = 0.729   # 관성 가중치
c1 = 2.05    # 개인 최적 가중치
c2 = 2.05    # 전역 최적 가중치
n_particles = 30
```

## Phase 현황

|Phase|상태|내용|
|---|---|---|
|1|⚠️ 시뮬만|랜덤값 수렴 곡선|
|2|⚠️ 시뮬만|고정 최적값 반환|
|**3**|⏳ **구현 예정**|pyswarms 실제 PSO|
|4+|—|검증|

## 🔗 연결 노트

- [[고유값_안정도판단]] — 목적함수의 ζ 기준
- [[88포인트_2D_스윕_설계]] — PSO 후 재실행
- [[이중수렴기준 설계]] — 조건1·2 상세 설계
- [[Phase03_진행중]] — 구현 예정
- [[실험_pso_미구현]] — 현재 시뮬 상태

## 참고문헌

- ▸ [1] Chen 2024 — 14개 파라미터 목록
- ▸ Clerc & Kennedy 2002 — w=0.729 수렴 조건