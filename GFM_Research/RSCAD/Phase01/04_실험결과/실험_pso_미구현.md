---

## type: experiment api: /api/pso date: 2026-08-19 phase: 1 status: simulation_only tags: [pso, optimization, TODO]

# ⚠️ 실험: /api/pso — 시뮬레이션만 (미구현)

## 현재 상태

```
/api/pso 현재 구현 수준:
  ✅ 엔드포인트 존재
  ✅ 수렴 곡선 출력 (랜덤값 시뮬)
  ✅ 최적 파라미터 반환 (고정값)
  ❌ 실제 PSO 알고리즘 미구현
  ❌ 실제 야코비안 기반 목적함수 미연결
```

## Phase 4에서 구현할 내용

### 이중 수렴 기준 PSO

```python
# pyswarms 기반 실제 구현 예정
from scipy.optimize import differential_evolution
import pyswarms as ps

def F_multi(params, SCR_list=[3.0,2.0,1.5,1.0]):
    """다중 운전점 목적함수"""
    F_total = 0
    for scr in SCR_list:
        A, _ = build_jacobian(scr, **params)
        eigs = linalg.eigvals(A)
        # F1: 안정도 마진
        F1 = sum(max(0, e.real) for e in eigs)
        # F2: ζ=0.707 추종
        osc = [e for e in eigs if abs(e.imag)>0.5]
        F2 = sum((-e.real/abs(e)-0.707)**2 for e in osc if abs(e)>0)
        # F3: ζ_min 보장
        F3 = sum(max(0, 0.64-(-e.real/abs(e))) for e in osc if abs(e)>0)
        F_total += 0.3*F1 + 0.6*F2 + 0.1*F3
    return F_total / len(SCR_list)

# 이중 수렴 기준
# 조건1: 상대 개선 < 0.1% 30회 연속
# 조건2: 누적 감소 < 0.5% 동일 30회
```

### 14개 최적화 파라미터 범위

|파라미터|하한|상한|단위|
|---|---|---|---|
|J|0.01|10.0|kg·m²|
|Dp|1.0|100.0|N·m·s|
|wc|10.0|200.0|rad/s|
|Lv|0.001|0.5|pu|
|Kpv|0.01|5.0|A/V|
|Kiv|1.0|500.0|A/Vs|
|Kpc|0.1|30.0|V/A|
|Kic|1.0|200.0|V/As|
|(DC 6개)|...|...|...|

## 예상 결과 (Phase 4 완료 후)

```
기대 최적 파라미터 (PSO 후):
  J  ≈ 0.5~1.0   (현재 0.5)
  Dp ≈ 20~40    (현재 20)
  Kpv ≈ 1~2     (현재 1.0)

기대 성능 개선:
  ζ_min: 0.256 → 0.64 이상
  SCR*: 1.22 → 0.8 이하 (더 강건)
  Wilcoxon p < 0.05 검증
```

## Claude 프롬프트 (Phase 4 착수 시)

```
[이 노트]
[GFM_연구_전체지도.md]
[실험_jacobian_SCR1.5_XR1.0.md]

→ "pyswarms GlobalBestPSO로 이중 수렴 기준 PSO를
   Flask /api/pso 엔드포인트에 구현하는 코드 작성해줘.
   SCR={3.0,2.0,1.5,1.0} 다중 운전점 목적함수 포함."
```

## 연결 노트

- [[Pso 이중수렴기준]] — 방법론 설명
- [[이중수렴기준 설계]] — 조건1·2 상세
