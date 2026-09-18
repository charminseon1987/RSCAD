---
name: terminology-consistency
description: GFM 소신호 안정도 연구의 용어·기호·단위 일관성을 검사한다. SCR/X/R/σ=−Re(λ) 등 도메인 기호, 상태변수명, 영한 혼용 규칙을 원고·코드·노트 전반에 걸쳐 통일.
allowed-tools: Read Write Edit Bash Glob Grep
metadata:
  version: "1.0"
  skill-author: 조연호 (연세대)
---

# Terminology & Symbol Consistency Check

## Overview

학술 원고와 코드에서 같은 물리량을 다른 기호로 쓰거나, 같은 기호에 다른 의미를 부여하면 리뷰어 지적과 재현 실패의 원인이 된다. 이 스킬은 GFM 소신호 안정도 연구에 특화된 용어·기호 사전(canonical dictionary)을 정의하고, 원고·코드·Obsidian 노트 전반에 걸쳐 위반을 검출한다.

## When to Use This Skill

- 원고 초고 작성 후 기호 통일 점검
- 코드(model.py, runner.py 등)와 원고의 기호 대응 확인
- 공저자 원고 합병 후 용어 충돌 탐지
- Obsidian 노트에서 비표준 표기 검색

---

## Canonical Dictionary

### 1. System Parameters (계통)

| 정규 기호 | LaTeX | Python 변수 | 의미 | 단위 | 금지 변형 |
|---|---|---|---|---|---|
| SCR | `\text{SCR}` | `SCR` | Short-Circuit Ratio | - | scr, S.C.R., S_CR |
| X/R | `X/R` | `XR` | 계통 임피던스 X/R 비 | - | X_R, x_r, XtoR |
| Z_g | `Z_g` | `Zg` | 계통 등가 임피던스 | Ω | Z_grid, Zgrid |
| R_g | `R_g` | `Rg` | 계통 등가 저항 | Ω | R_grid |
| L_g | `L_g` | `Lg` | 계통 등가 인덕턴스 | H | L_grid |
| V_g | `V_g` | `Vg` | 계통 전압 (상전압 피크) | V | V_grid, Vs |

### 2. Stability Metrics (안정도 지표)

| 정규 기호 | LaTeX | Python 변수 | 의미 | 단위 | 금지 변형 |
|---|---|---|---|---|---|
| σ | `\sigma` | `sigma` | 감쇠율 = −Re(λ) | 1/s | damping_rate, alpha |
| σ_min | `\sigma_{\min}` | `sigma_min` | 최소 감쇠율 (임계 모드) | 1/s | sigma_worst |
| ζ | `\zeta` | `zeta` | 감쇠비 = σ/\|λ\| | - | damping_ratio, xi |
| ζ_min | `\zeta_{\min}` | `zeta_min` | 최소 감쇠비 | - | |
| t_s | `t_s` | `t_s_max` | 정착시간 (2% 기준) = 4/σ | s | settling_time |
| λ | `\lambda` | `ev` (배열) | 고유값 | - | eigenvalue, eig |
| A | `\mathbf{A}` | `A` / `A_num` | 상태행렬 (야코비안) | - | J (야코비안과 관성 혼동) |

**주의:** `J`는 가상 관성(Virtual Inertia)에만 사용. 야코비안 행렬은 반드시 `A` 또는 `A_k`로 표기.

### 3. State Variables (22차)

| 정규 기호 | LaTeX | Python | 물리량 | 블록 |
|---|---|---|---|---|
| v_pv | `v_{\text{pv}}` | `v_pv` | PV 어레이 전압 | DC |
| i_{L,pv} | `i_{L,\text{pv}}` | `i_Lpv` | 부스트 인덕터 전류 | DC |
| v_dc | `v_{\text{dc}}` | `v_dc` | DC 링크 전압 | DC |
| i_{L,ess} | `i_{L,\text{ess}}` | `i_Less` | ESS 인덕터 전류 | DC |
| δ | `\delta` | `delta` | 전력각 (동기화) | AC |
| Δω | `\Delta\omega` | `dw` | 주파수 편차 | AC |
| P_f | `P_f` | `Pf` | 유효전력 (필터 후) | AC |
| Q_f | `Q_f` | `Qf` | 무효전력 (필터 후) | AC |
| i_{L,d}, i_{L,q} | `i_{L,d}`, `i_{L,q}` | `i_ld`, `i_lq` | 인버터 측 전류 | AC |
| v_{o,d}, v_{o,q} | `v_{o,d}`, `v_{o,q}` | `v_od`, `v_oq` | 커패시터 전압 | AC |
| i_{o,d}, i_{o,q} | `i_{o,d}`, `i_{o,q}` | `i_od`, `i_oq` | 계통 측 전류 | AC |

### 4. Control Parameters (PSO 대상 14개)

| 정규 기호 | LaTeX | Python | 범위 |
|---|---|---|---|
| J | `J` | `J` | 가상 관성 [kg·m²] |
| D_p | `D_p` | `Dp` | 댐핑 계수 [N·m·s] |
| ω_c | `\omega_c` | `wc` | 전력 필터 차단주파수 [rad/s] |
| n_q | `n_q` | `nq` | Q 드룹 계수 |
| K_{pv} | `K_{pv}` | `Kpv` | AC 전압 루프 P 이득 |
| K_{iv} | `K_{iv}` | `Kiv` | AC 전압 루프 I 이득 |

### 5. Terminology (영한 대조)

| 영문 (정규) | 한글 (정규) | 금지 변형 |
|---|---|---|
| Grid-Forming (GFM) | 계통형성형 | 그리드포밍, Grid Forming |
| Grid-Following (GFL) | 계통추종형 | 그리드팔로잉 |
| Short-Circuit Ratio | 단락비 | 단락용량비 |
| Small-Signal Stability | 소신호 안정도 | 소신호 안정성 (안정도가 표준) |
| Damping Ratio | 감쇠비 | 댐핑비, 감쇄비 |
| Damping Rate | 감쇠율 | 감쇠속도 |
| Settling Time | 정착시간 | 안정시간, 세틀링 타임 |
| Eigenvalue | 고유값 | 고유치, 아이겐밸류 |
| Participation Factor | 참여계수 | 참여인자 (계수가 IEEE 표준) |
| Virtual Synchronous Generator | 가상동기발전기 (VSG) | 가상 동기 발전기 |
| Operating Point | 동작점 | 운전점 (코드·노트 내부에서만 허용) |
| Jacobian Matrix | 야코비안 행렬 | 자코비안 |
| CHIL | Controller-in-the-Loop | C-HIL, CHILS |
| RTDS | Real-Time Digital Simulator | - |

---

## Check Rules

### Rule 1: Symbol Collision
같은 문서에서 하나의 기호가 두 가지 의미로 사용되면 ERROR.
- 예: `J`가 야코비안과 가상 관성 모두에 사용 → ERROR

### Rule 2: Code-Paper Mismatch
코드 변수명과 원고 기호가 canonical dictionary에서 대응하지 않으면 WARN.
- 예: 원고에서 `ξ`를 감쇠비로 쓰는데 코드에서 `zeta` → WARN

### Rule 3: Unit Consistency
같은 물리량이 문서 내에서 다른 단위로 표기되면 ERROR.
- 예: 한 곳에서 `f = 60 Hz`, 다른 곳에서 `ω₀ = 377 rad/s` → OK (명시적 변환)
- 예: `ω_c = 10 Hz`이면서 `ω_c = 62.8 rad/s` → OK if both stated
- 예: `ω_c = 10` (단위 누락) → WARN

### Rule 4: Banned Terms
금지 변형 목록에 있는 표기가 발견되면 WARN + 정규 형태 제안.

### Rule 5: Subscript Consistency
같은 물리량의 하첨자가 문서 내에서 달라지면 WARN.
- 예: `V_grid`와 `V_g` 혼용 → WARN (V_g로 통일)

### Rule 6: σ = −Re(λ) Identity
σ(감쇠율)의 정의가 명시되어야 한다. 원고에서 σ를 쓰면서 `σ ≡ −Re(λ)` 정의가 없으면 WARN.

---

## Output Format

```
Terminology Consistency Report
================================
Scope: Simulation/*.py + manuscript.tex + GFM_Research/**/*.md
Date: 2026-09-18

ERRORS:
  [R1] manuscript.tex:142 — "J" used as Jacobian matrix
       → Use "A" or "A_k" for Jacobian (J = virtual inertia)

WARNINGS:
  [R4] manuscript.tex:89 — "damping ratio" written as "댐핑비"
       → 정규: "감쇠비"
  [R2] manuscript.tex:201 — symbol "α" for damping rate
       → code uses "sigma", paper should use "σ"
  [R5] notes/Phase02.md:34 — "V_grid" mixed with "V_g"
       → standardize to "V_g"

INFO:
  22 state variables: code↔paper naming consistent
  14 control params: code↔paper naming consistent

Summary: 1 ERROR, 3 WARNINGS, 2 INFO
```

## Scan Targets

검사 대상 파일:

```
Simulation/model.py          ← 상태변수·파라미터 정의 원본
Simulation/runner.py         ← 지표 명칭
Simulation/metrics.py        ← σ/ζ 정의
GFM_Research/**/*.md         ← Obsidian 노트
manuscript*.tex              ← LaTeX 원고 (있을 경우)
```

## Example Invocations

```
사용자: 용어 일관성 검사해줘
→ 전체 파일 스캔 → ERROR/WARN/INFO 보고

사용자: model.py와 원고의 기호 대조해줘
→ model.py STATE_NAMES ↔ 원고 \delta, v_{dc} 등 매칭

사용자: "감쇠비" vs "댐핑비" 어느 게 맞아?
→ 정규 사전 참조하여 "감쇠비"가 표준, 근거 제시
```
