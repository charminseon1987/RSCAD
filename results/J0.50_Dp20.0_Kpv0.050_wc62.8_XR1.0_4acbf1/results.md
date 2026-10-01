---
type: result
run: J0.50_Dp20.0_Kpv0.050_wc62.8_XR1.0_4acbf1
model_version: v3-22state
n_states: 22
date: 2026-10-01 10:15
XR: 1.0
all_stable: True
zeta_min: 0.203
zeta_min_band: lcl
band_crossovers: 0
tags: [result, phase2, jacobian, 22state, mode-band]
---

# 실험 결과: J0.50_Dp20.0_Kpv0.050_wc62.8_XR1.0_4acbf1

## 제어 파라미터 (PSO 대상 14)

| 기호 | 값 | 기호 | 값 |
|---|---|---|---|
| Kp_vpv | 0.14 | Kp_vdc | 0.54 |
| Ki_vpv | 10.0 | Ki_vdc | 36.0 |
| Kp_ipv | 0.001 | Kp_iess | 0.001 |
| Ki_ipv | 0.1 | Ki_iess | 0.1 |
| J | 0.5 | nq | 0.001 |
| Dp | 20.0 | Kpv | 0.05 |
| wc | 62.83 | Kiv | 10.0 |

## 모드 대역 정의

| 대역 | 주파수 | 물리 모드 |
|---|---|---|
| `sync` | < 5 Hz | 동기화 모드 (δ, Δω) |
| `control` | 5 ~ 100 Hz | 제어루프 · DC-AC 혼합 모드 |
| `lcl` | ≥ 100 Hz | LCL 공진 |

※ 주파수 기반 분류는 참여계수 분석의 **대용**이다. 논문에는 `pf.py` 의
참여계수로 모드 귀속을 확정한 근거를 써야 한다.

## 고유값 분석 (X/R = 1.0)

| SCR | stable | ζ_min | 대역 | f_dom (Hz) | ζ_sync | ζ_control | ζ_lcl | δ (°) |
|---|---|---|---|---|---|---|---|---|
| 3.00 | ✅ | 0.203 | `lcl` | 181.1953 | 0.3717 | 0.4277 | 0.203 | 22.415 |
| 2.00 | ✅ | 0.2032 | `lcl` | 181.1661 | 0.3717 | 0.4398 | 0.2032 | 32.58 |
| 2.00 | ✅ | 0.2032 | `lcl` | 181.1661 | 0.3717 | 0.4398 | 0.2032 | 32.58 |
| 1.50 | ✅ | 0.2034 | `lcl` | 181.144 | 0.3717 | 0.4565 | 0.2034 | 42.423 |

> [!success] 모드 교차 없음
> ζ_min 이 전 SCR 에서 동일 대역 모드를 가리킴.


> [!warning] 검산 오차 초과
> SCR [3.0] 에서 상대오차가 1e-06 를 넘음.
> 야코비안 정확도 재확인 필요 (성분 위치는 eigenvalue_results.json 의 fd_worst_entry).

## 판정

- 안정도: ✅ 전 SCR 안정
- ζ 기준 (0.64): ❌ 미달 (ζ_min=0.203) → PSO 필요
- 대역별 최소 ζ: sync=0.3717, control=0.4277, lcl=0.203
- 최대 δ: 42.423° (한계 90°)
- 야코비안 검산: 전역 1.20e-09 / 성분별 1.19e-06

## 파일

```
J0.50_Dp20.0_Kpv0.050_wc62.8_XR1.0_4acbf1/
├── A_num_SCR*.npy           22×22 야코비안
├── x0_SCR*.npy              동작점 22×1
├── eigenvalue_results.json  modes 배열에 전 진동모드 ζ·f·대역 수록
├── meta.json
└── results.md
```

## 🔗 연결 노트

- [[Phase02_완료]]
- [[DC-AC_커플링]]
- [[동작점_SCR의존성]]
- [[고유값_안정도판단]]
- [[88포인트_2D_스윕_설계]]
