---
type: concept
date: 2026-08-28
phase: 4
status: draft
supersedes: "Pso 이중수렴기준 (목적함수 부분)"
tags: [concept, PSO, 목적함수, 모드분류, phase4]
---

# PSO 목적함수 설계

> **저장 위치:** `01_개념/`

## 한 줄 정의

> 모드를 **참여계수로 분류한 뒤** 성격에 맞는 지표를 각각 적용한다. 실수극에 ζ 를, 진동극에 정착시간을 적용하지 않는다.

---

## v1 목적함수가 왜 폐기되는가

> [!danger] 구 `F_multi` 는 강건성을 악화시킨다
> ```python
> F2 = sum((z - 0.707)**2 for z in zetas)    # ζ=0.707 추종
> F3 = sum(max(0, 0.64 - z) for z in zetas)  # ζ_min ≥ 0.64
> ```
> ▸ 동기화 모드는 **실수극**이므로 ζ = 1 이다. → [[과감쇠_동기화모드]]
> ▸ F2 는 여기에 `(1−0.707)² = 0.0858` 을 상시 부과한다.
> ▸ PSO 는 이 값을 줄이려 **동기화 모드를 진동 영역으로 밀어낸다.**
> ※ 즉 약계통 강건성을 개선하는 게 아니라 적극적으로 악화시키는 방향이다.

추가 결함 3건:

▸ **모드 구분 없음.** `zetas` 를 통째로 순회한다. ζ_min 이 SCR 구간마다 다른 물리 모드를 가리키므로, 구간마다 다른 대상을 최적화하게 된다. → [[모드교차_최소감쇠비_함정]]
▸ **X/R 축 부재.** `SCR_list` 만 순회한다. 논문 주제가 2D SCR–X/R 경계인데 목적함수는 1D 다.
▸ **동작점 부재 처리 없음.** δ→90° 로 해가 없는 조건에서 `get_eigenvalues` 가 무엇을 반환하는지 정의돼 있지 않다. → [[정적부하가능성_경계]]

---

## v2 설계

### 평가 격자

```python
GRID = [(scr, xr) for xr in XR_LIST for scr in SCR_LIST]   # 2D
```

각 격자점 k 에서 `runner.run(ctrl, [scr], xr, persist=False, quiet=True)` 호출.

### 격자점별 비용

```python
def cost_point(meta, r):
    # 1) 동작점 부재 — 소신호 이전의 문제
    if not r['converged']:
        return P_INFEASIBLE          # 상수 페널티. 제외하면 PSO 가 회피 학습함

    # 2) 불안정 페널티 (실수부 기준, 모드 무관)
    F1 = max(0.0, r['max_real'] + SIGMA_MARGIN)

    # 3) 동기화 모드 — 실수극. 정착시간으로 평가
    t_s = 5.0 / abs(r['sigma_sync'])          # 참여계수로 식별한 지배극
    F2 = max(0.0, (t_s - T_S_TARGET) / T_S_TARGET)

    # 4) 진동 모드 — 대역별 감쇠비. 실수극에는 적용하지 않는다
    F3 = sum(max(0.0, ZETA_TARGET - z)
             for z in (r['band_zeta']['control'], r['band_zeta']['lcl'])
             if z is not None)

    return ALPHA*F1 + BETA*F2 + GAMMA*F3
```

```python
F = sum(cost_point(...) for k in GRID) / len(GRID)
```

### 지표 대응표

| 모드 | 성격 | 지표 | 근거 |
|---|---|---|---|
| 동기화 (δ·Δω) | 실수극 (Dp=20 과감쇠) | `t_s = 5/\|σ\|` | ζ 정의상 1 → 무의미 |
| DC-AC 혼합 (37~43 Hz) | 진동 | `ζ_control` | X/R=3.0 에서 0.0794 |
| LCL 공진 (178 Hz) | 진동 | `ζ_lcl` | 전 조건 0.206~0.207 |
| 동작점 부재 | — | `P_INFEASIBLE` | 정적 한계, 소신호 이전 |

▸ 동기화 모드 실측: SCR 3.0 → 0.8 에서 `t_s` 1.17 s → 4.94 s (4.2배). → [[EXP_2026-08-28_XR3조건_스윕]]

> [!warning] 모드 귀속은 참여계수로
> `sigma_sync` 는 주파수 대역이 아니라 δ+Δω 참여도 최대 기준으로 골라야 한다.
> 주파수 <5Hz 대역이 잡는 것은 전력 필터 모드(Qf 0.445, Pf 0.401)다.
> → [[참여인자 지배모드]] · `P3-A7`

### Dp 트레이드오프

※ Dp=20 이 과감쇠를 만든다. PSO 가 Dp 를 낮추면 동기화 모드가 진동 영역으로 진입해 ζ 가 다시 의미를 갖지만 `t_s` 는 나빠질 수 있다. **이 트레이드오프가 PSO 의 실제 탐색 공간이다.**

목적함수는 두 영역을 모두 다뤄야 한다. 동기화 모드가 진동극이 되면 `F2` 를 `t_s` 대신 ζ 로 전환하는 분기가 필요하다.

```python
if 동기화_모드가_복소극:
    F2 = max(0.0, ZETA_SYNC_TARGET - zeta_sync)
else:
    F2 = max(0.0, (t_s - T_S_TARGET) / T_S_TARGET)
```

---

## 미확정 상수

| 상수 | 값 | 상태 |
|---|---|---|
| `T_S_TARGET` | ? | ⛔ UNIFI Cat 3 조항 특정 필요 |
| `ZETA_TARGET` | 0.64 | ⛔ 출처 미확인 (`P3-A6`) |
| `SIGMA_MARGIN` | ? | 미정 |
| `P_INFEASIBLE` | ? | 격자 크기 대비 스케일 결정 필요 |
| `ALPHA, BETA, GAMMA` | 구 0.3/0.6/0.1 | 재설정 + 민감도 분석 (`P4-A4`) |

> [!danger] `ZETA_TARGET = 0.64` 의 출처가 여전히 불명
> 전력계통 진동모드 기준은 통상 0.03~0.10 이다. 0.64 는 과도응답 오버슈트
> 사양에서 유도된 값으로 보이나 유도식이 기록돼 있지 않다.
> ※ 정착시간 기준으로 전환하면 이 문제가 함께 해소된다.

---

## ⛔ TABLE II 파라미터 목록 불일치

구 노트의 14개 목록이 **구현된 모델과 다르다.**

| 구 노트 | 실제 `model.PARAM_NAMES` |
|---|---|
| VSG: J, Dp, wc, **Lv** | J, Dp, wc, **nq** |
| 전압루프: Kpv, Kiv | Kpv, Kiv ✓ |
| 전류루프: **Kpc, Kic** | 없음 (모델에서 고정 파라미터) |
| DC 6개 TBD | **8개**: Kp_vpv, Ki_vpv, Kp_ipv, Ki_ipv, Kp_vdc, Ki_vdc, Kp_iess, Ki_iess |

▸ 실제 구성: DC 8 + VSG 4 + AC 전압 2 = **14개**
※ 합계는 우연히 같지만 구성이 다르다. `P4-A1`(TABLE II) 작성 시 `model.PARAM_NAMES` 를 기준으로 할 것.

기본값 (`runner.parse_args`):

```
Kp_vpv 0.1   Ki_vpv 10.0   Kp_ipv 1e-3   Ki_ipv 0.1
Kp_vdc 0.5   Ki_vdc 20.0   Kp_iess 1e-3  Ki_iess 0.1
J 0.5        Dp 20.0       wc 62.83      nq 1e-3
Kpv 0.05     Kiv 10.0
```

---

## PSO 호출 규약

```python
import runner
_, meta, _ = runner.run(ctrl, [scr], xr, persist=False, quiet=True)
```

▸ `persist=False` 필수. 디스크 쓰기가 0 이 되어 병렬 경합이 사라진다.
▸ `runner.run` 은 `verify_ctrl_applied` 로 파라미터 반영을 검증한다. 이게 없으면 PSO 가 같은 값만 반복 평가하며 수렴한 것처럼 보인다.
→ [[Simulation_코드구조]]

---

## 🔗 연결 노트

| 방향 | 노트 | 이유 |
|---|---|---|
| ← | [[과감쇠_동기화모드]] | ζ 가 지표로 부적합한 근거 |
| ← | [[모드교차_최소감쇠비_함정]] | 단일 스칼라 지표의 함정 |
| ← | [[정적부하가능성_경계]] | 동작점 부재 처리 |
| ← | [[참여인자 지배모드]] | 모드 귀속 방법 |
| ← | [[고유값_안정도판단]] | ζ·실수부 정의 |
| → | [[PSO_수렴판정_설계]] | 종료 조건 |
| → | [[88포인트_2D_스윕_설계]] | 최적화 후 재검증 |
| → | [[Phase04_PSO설계]] | 상위 계획 |

## 참고문헌

- ▸ [[Chen_2024_Electronics]] — 파라미터 목록 원출처 (구성 재확인 필요)
- ⛔ UNIFI Category 3 — 조항 번호 미특정

> [!question] 허브 갱신 필요
> [[Phase_지식_연결맵]] 과 [[GFM_연구_전체지도.md]] 에 연결할 것.
