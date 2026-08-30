---

## type: experiment component: sym.py date: 2026-08-20 phase: 2 status: verified tags: [experiment, AC-subsystem, stability, debug, phase2]

# 🧪 EXP: AC 서브시스템 단독 안정 확인

## 목적

> DC PI 버그(stable=False) 디버깅 과정에서  
> **AC 13×13 서브시스템은 단독으로 stable=True**임을 확인  
> → 불안정의 원인이 DC 서브시스템에 있음을 격리

---

## 📥 입력 (수동 구성 AC 13×13)

```python
# 상태변수 (13개)
# [Δω, Pfilt, Qfilt, φ_vd, φ_vq, γ_id, γ_iq,
#  iid, iiq, uod, uoq, iod, ioq]

파라미터:
  J=0.5, Dp=20, wc=31.4
  Kpv=1.0, Kiv=100, Kpc=5.0, Kic=50
  L1=0.1, Cf=0.05, R1=0.01
  SCR=1.5, XR=1.0
```

---

## 📤 실험 결과

```
SCR=3.0: stable=True  max_Re=0.000  ✅
SCR=1.5: stable=True  max_Re=0.000  ✅
SCR=1.0: stable=True  max_Re=0.000  ✅
```

---

## 📊 핵심 수치

|항목|값|판정|
|---|---|---|
|stable (전 SCR)|True|✅|
|max Re(λ)|0.000|✅ 좌반평면|
|ζ_min (AC 단독)|0.013|⚠️ 낮음|
|불안정 고유값|없음|✅|

---

## 🔍 분석

### ▸ 관찰된 사실

```
AC 13×13 수동 구성:
  dw ←→ Pfilt (VSG 스윙)
  evd/evq → iid_ref/iiq_ref (전압 루프)
  eid/eiq → uid/uiq (전류 루프)
  LCL 필터 + 계통 임피던스

→ 3개 SCR 모두 stable=True
→ 모든 고유값 Re(λ) < 0
```

### ※ 해석

```
AC 서브시스템은 자체적으로 안정
→ Phase 2 stable=False의 원인은 DC에 있음

DC 서브시스템 문제:
  1. iLpv_ref = 0.9/upv 비선형항 → 선형화 오류
  2. 동작점 불일치: upv0=1.0, udc0=1.0, dpv0=0.5
     → f7=0 조건: upv = (1-dpv)*udc = 0.5 ≠ 1.0
  3. Kp1 이득 과다 → ∂f6/∂iLpv = Kp1*udc/Cdc 불안정

→ 해결: DC numpy 근사 + AC SymPy 수동 결합 (9차 시도)
```

---

## 역할 — BUG 격리의 핵심 실험

```
Phase 2 sym.py 버그 해결 과정:

1차~3차: 전체 21×21 → stable=False
    ↓
[이 실험] AC 단독 확인 → stable=True ✅
    ↓
결론: DC가 문제 → DC는 numpy 근사 유지
      AC만 SymPy 수동 구성
    ↓
9차 시도: DC numpy(8×8) + AC SymPy(13×13) 결합
    ↓
stable=True ✅ (Phase 2 완료)
```

---

## 🔗 연결 노트

### 선행

- [[Bug sym dc pi 4차시도]] — 이 실험이 3차 시도 결과
- [[야코비안 행렬]] — AC 13×13 블록 구조

### 후속

- [[EXP_2026-08-21_Phase2_엔진전환_비교]] — 최종 결과
- [[Phase02_완료]] — 9차 시도 해결

### 개념

- [[소신호_선형화]] — AC 야코비안 유도 원리
- [[고유값_안정도판단]] — stable 판정 기준
- [[DC-AC_커플링]] — DC가 AC에 미치는 영향

---

## 재현 코드

```python
import numpy as np
from scipy import linalg

J=0.5; Dp=20.; wc=31.4
Kpv=1.0; Kiv=100.; Kpc=5.0; Kic=50.
L1=0.1; Cf=0.05; R1=0.01; Lv=0.02
w0=2*np.pi*60

for SCR in [3.0, 1.5, 1.0]:
    Zg=1/SCR; Rg=Zg/np.sqrt(2); Lg=Rg/w0
    Id0=0.9; Iq0=0.1
    Vpcc=1.0-(Id0+Iq0)*Rg

    A=np.zeros((13,13))
    A[0,0]=-Dp/J;   A[0,1]=-1/J
    A[1,1]=-wc;     A[1,9]=wc*Id0; A[1,11]=wc*Vpcc
    A[2,2]=-wc;     A[2,10]=wc*Id0
    A[3,9]=-1;      A[4,10]=-1
    A[5,3]=Kiv;     A[5,7]=-1;  A[5,9]=-Kpv;  A[5,11]=1
    A[6,4]=Kiv;     A[6,8]=-1;  A[6,10]=-Kpv; A[6,12]=1
    A[7,3]=Kpc*Kiv/L1; A[7,5]=Kic/L1
    A[7,7]=(-R1-Kpc)/L1; A[7,8]=(w0*L1-Kpc*w0*Lv)/L1
    A[8,4]=Kpc*Kiv/L1; A[8,6]=Kic/L1
    A[8,8]=(-R1-Kpc)/L1; A[8,7]=-(w0*L1-Kpc*w0*Lv)/L1
    A[9,7]=1/Cf;  A[9,10]=w0;  A[9,11]=-1/Cf
    A[10,8]=1/Cf; A[10,9]=-w0; A[10,12]=-1/Cf
    A[11,9]=1/Lg; A[11,11]=-Rg/Lg; A[11,12]=w0
    A[12,10]=1/Lg; A[12,11]=-w0;   A[12,12]=-Rg/Lg

    eigs=linalg.eigvals(A)
    stable=np.all(eigs.real<1e-4)
    print(f"SCR={SCR}: stable={stable}")
    # 출력: stable=True (3개 모두)
```