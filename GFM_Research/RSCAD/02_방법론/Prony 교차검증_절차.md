---

## type: methodology date: 2026-08-21 phase: 3 status: pending tags: [methodology, Prony, Matrix-Pencil, validation, f-dom, cross-validation]

# 📐 Prony / Matrix Pencil 교차검증 절차

## 한 줄 정의

> RTDS CHIL 실측 파형에서 지배 주파수 f_dom과 감쇠비 ζ를 추출하여 소신호 모델 예측값과 비교하는 3단계 검증 절차

---

## 왜 필요한가?

```
소신호 모델 (A_k 야코비안):
  → f_dom, ζ_min 이론값 계산
  ↓ 이게 실제와 얼마나 맞나?

RTDS CHIL 실측:
  → 과도응답 파형 측정
  → Prony/Matrix Pencil로 f_dom, ζ 추출
  ↓ 비교

오차 < 5% → 모델 검증 완료 ✅
오차 > 5% → 모델 수정 필요
```

---

## Prony 분석이란?

시간 도메인 신호를 지수 감쇠 정현파 합으로 분해:

$$y(t) = \sum_{i=1}^{N} A_i \cdot e^{\sigma_i t} \cos(\omega_i t + \phi_i)$$

|추출값|의미|
|---|---|
|$\omega_i$|진동 주파수 → f_dom = ω/(2π)|
|$\sigma_i$|감쇠율 → ζ = -σ/\|λ\||
|$A_i$|모드 크기 → 참여인자와 연결|

---

## Matrix Pencil 방법 (권장)

```python
# Almunif(2020) [참고문헌] 기반
# SNR ≥ 25dB 조건에서 Prony보다 수치 안정성 우수

import numpy as np

def matrix_pencil(y, dt, L=None):
    """
    y:  측정 신호 (1D array)
    dt: 샘플링 간격
    L:  연필 파라미터 (기본값 len(y)//2)
    """
    N = len(y)
    if L is None:
        L = N // 2

    # Hankel 행렬 구성
    Y1 = np.array([y[i:i+L] for i in range(N-L)])
    Y2 = np.array([y[i+1:i+L+1] for i in range(N-L)])

    # SVD 기반 차수 결정
    U, S, Vh = np.linalg.svd(Y1)
    # 유효 차수: S[k]/S[0] > 1e-3 인 k
    n_modes = np.sum(S/S[0] > 1e-3)

    # 일반화 고유값 문제
    Y1_r = U[:, :n_modes] @ np.diag(S[:n_modes]) @ Vh[:n_modes, :]
    Y2_r = Y2

    # 극점 추출
    Z = np.linalg.lstsq(Y1_r, Y2_r, rcond=None)[0]
    poles = np.linalg.eigvals(Z)

    # f, ζ 계산
    modes = []
    for p in poles:
        if p.imag > 0:
            lam = np.log(p) / dt
            f   = abs(lam.imag) / (2 * np.pi)
            zeta = -lam.real / abs(lam)
            modes.append({'f_hz': f, 'zeta': zeta})

    return sorted(modes, key=lambda m: m['zeta'])
```

---

## 3단계 검증 절차

### Layer 1 — 소프트웨어 자체 검증

```
sym.py 야코비안 → 고유값 분석
  ↓
f_dom, ζ_min 이론값 산출
  ↓
기준: |f_model - f_sim| / f_sim < 5%
```

### Layer 2 — PSCAD 교차검증 (Δu_pv > 5% 조건)

```
PSCAD EMT 시뮬레이션
  → 소신호 섭동 인가 (ΔP = 0.05 pu)
  → 과도 파형 기록 (Δω, ΔP)
  ↓
Matrix Pencil 적용
  ↓
f_dom, ζ 추출 → 소신호 모델과 비교
기준: SNR ≥ 25dB, 오차 < 5%
```

### Layer 3 — RTDS CHIL 실측 (Phase 7)

```
RTDS 실시간 시뮬레이션
  → PMU 1kHz 데이터 수집
  → 88포인트 각 조건 파형 기록
  ↓
Matrix Pencil 적용
  ↓
SCR*(X/R) 실측값 → 소신호 모델 검증
기준: 오차 < 5%, SNR ≥ 25dB
```

---

## f_dom 실측 → ζ_threshold 재계산

```
Phase 3 완료 후:
  f_dom 실측값 (PSCAD Layer 2)
  → ζ_threshold = 4 / (2π × f_dom × 1.0)

현재 (numpy 근사):
  f_dom = 0.32~0.36 Hz → ζ_th = 1.78~1.99 (비정상)

Phase 3 목표:
  f_dom ≈ 1~3 Hz (VSG 스윙 모드 실측)
  → ζ_th = 4/(2π×1.0×1.0) = 0.64 ✅
```

---

## SNR 기준

```python
# 신호 대 잡음비 검사
SNR = 10 * np.log10(signal_power / noise_power)

if SNR >= 25:  # dB
    print("Matrix Pencil 적용 가능 ✅")
else:
    print("신호 전처리 필요 (저역통과 필터)")
```

---

## Phase별 현황

|Phase|검증 방법|상태|
|---|---|---|
|1~2|— (소프트웨어만)|❌ 미검증|
|3|Layer 1 (자체)|⏳|
|4~5|Layer 2 (PSCAD)|⏳|
|**6~7**|**Layer 3 (RTDS CHIL)**|⏳ 최종|

---

## 🔗 연결 노트

- [[고유값_안정도판단]] — f_dom, ζ 이론값
- [[동작점 평형점]] — 섭동 기준점
- [[참여인자 지배모드]] — 지배 모드 식별
- [[88포인트_2D_스윕_설계]] — Layer 3 검증 대상
- [[Phase03_진행중]] — Layer 1 예정
- [[Phase04 예정]] — Layer 2 예정

## 참고문헌

- ▸ Almunif 2020 — Matrix Pencil, SNR ≥ 25dB 기준
- ▸ [9] IEEE Std. 2004-2025 — CHIL 검증 표준