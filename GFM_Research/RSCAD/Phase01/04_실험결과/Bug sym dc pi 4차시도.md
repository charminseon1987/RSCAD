---

## type: bug component: sym.py date: 2026-08-20 phase: 2 attempt: 4차 status: in_progress severity: critical tags: [bug, sympy, jacobian, DC, PI, stable]

# 🔧 BUG: SymPy DC PI 적분기 구조 오류

## 증상

```
예상값: stable=True,  zeta_min > 0
실제값: stable=False, zeta_min < 0
오차:   전 SCR 구간 불안정
```

---

## 시도 기록

|차수|날짜|수정 내용|stable|zeta_min|A_k(9,6)|
|---|---|---|---|---|---|
|1차|2026-08-19|dpv=0.5 고정|False|-0.68|0.0 ❌|
|2차|2026-08-19|pu 단위 통일 (Vpv0=1.0)|False|-0.05|0.0 ❌|
|3차|2026-08-19|AC 서브시스템 단독 확인|**True** ✅|0.013|—|
|**4차**|**2026-08-20**|**dpv_sym = 0.5 + Kp1×xPI1 연결**|**False**|**-0.38**|**0.003183 ✅**|

### 4차 시도 상세 결과

```
SCR=3.0: stable=False  zeta_min=-0.5707  f_dom=0.5832Hz  A_k(9,6)=0.001592 ✅
SCR=2.0: stable=False  zeta_min=-0.4707  f_dom=0.6275Hz  A_k(9,6)=0.002387 ✅
SCR=1.5: stable=False  zeta_min=-0.3764  f_dom=0.6588Hz  A_k(9,6)=0.003183 ✅
SCR=1.0: stable=False  zeta_min=-0.2005  f_dom=0.6950Hz  A_k(9,6)=0.004775 ✅
```

### 4차에서 개선된 것 ✅

```
A_k(9,6) 이론값과 완전 일치 → 수동 보강 성공
f_dom SCR 의존성 물리적으로 타당
  → SCR 낮을수록 f_dom 높아짐 (약계통 = 빠른 진동)
  → 3.0→0.58Hz, 2.0→0.63Hz, 1.5→0.66Hz, 1.0→0.70Hz
```

### 4차에서 남은 문제 ❌

```
여전히 stable=False
→ zeta_min 음수 = 불안정 모드 존재
→ 불안정 고유값이 어느 서브시스템에서 오는지 불명확

단서:
- AC 단독(13×13 수동) → stable=True ✅
- DC 포함 전체(21×21) → stable=False ❌
→ DC 서브시스템 또는 DC-AC 결합에서 불안정 발생
```

---

## 원인 분석

### ▸ 확인된 사실

```
1. A_k(9,6) = 0 문제
   f9 = (1-Pfilt-Dp*dw)/J 에서 udc에 직접 의존하지 않음
   → SymPy 자동 유도로는 커플링 원소가 0으로 나옴
   → 수동 보강: A_num[8,5] += idc0/(J*w0) 으로 해결 ✅

2. dpv 고정 문제 (1차 원인)
   dpv = 0.5 고정 시 xPI1이 야코비안에 연결 안됨
   → PI 적분기가 상태변수로서 의미 없어짐
   → dpv_sym = 0.5 + Kp1*xPI1 으로 수정 (4차)

3. 불안정 잔존 원인 (미해결)
   dpv 연결 후에도 stable=False
   → iLpv_ref = 0.9/upv 비선형항이 문제일 가능성
   → 동작점 upv=1.0pu에서 ∂(0.9/upv)/∂upv = -0.9 → 음수 피드백
   → 하지만 이게 불안정을 만드는지는 미확인
```

### ※ 가설 (5차 시도 방향)

```
가설 A: iLpv_ref 비선형항 선형화 오류
  수정: f1 = (0.9/upv0 - 0.9/upv0² * Δupv) - iLpv
        → 동작점 upv0=1.0에서 선형화: f1 ≈ 0.9 - 0.9*upv - iLpv

가설 B: f3 = Vdc0 - udc의 적분기 구조
  f3 자체가 Vdc0-udc인데 xPI3과의 연결이 f6,f7에서
  dpv를 통해 이루어지므로 구조는 맞음
  → 수치적 불안정 가능성

가설 C: DC-AC 결합 후 수치 불안정
  A_num[8,5] 수동 보강 이외에
  f10 = wc*(Pmeas-Pfilt) 에서
  Pmeas = uod*iod + uoq*ioq → 동작점 대입 후
  ∂Pmeas/∂uod = iod0 = 0.9 → 큰 값
  → 이 경로가 불안정 기여 가능성
```

---

## 수정 방향 (5차)

```python
# 5차 시도: f1 선형화 명시

# 현재 (4차)
iLpv_ref = sp.Rational(9, 10) / upv   # 비선형
f1 = iLpv_ref - iLpv

# 수정 (5차 시도)
# 동작점 upv0=1.0pu에서 테일러 1차 전개
# 0.9/upv ≈ 0.9 - 0.9*(upv-1) = 1.8 - 0.9*upv (upv0=1일 때)
upv0 = sp.Float(1.0)
iLpv_ref_lin = sp.Float(0.9)/upv0 - sp.Float(0.9)/upv0**2 * (upv - upv0)
f1 = iLpv_ref_lin - iLpv
# → 선형 모델에서는 이 형태가 야코비안에 올바른 값 줌
```

---

## 검증 기준 (RESOLVED 조건)

다음을 **모두** 만족해야 RESOLVED:

- [ ] SCR=3.0: stable=True
- [ ] SCR=2.0: stable=True
- [ ] SCR=1.5: stable=True
- [ ] SCR=1.0: stable=True
- [ ] zeta_min > 0 (4개 SCR 모두)
- [ ] A_k(9,6) 이론값 오차 < 1% ✅ (이미 달성)
- [ ] f_dom 1~10 Hz 범위

---

## 🔗 연관 지식

|노트|연결 이유|
|---|---|
|[[DC-AC_커플링]]|A_k(9,6) 이론값 근거|
|[[21차 야코비안 유도가이드]]|DC PI 방정식 구조|
|[[소신호_선형화]]|비선형→선형 근사 원리|
|[[Chen_2024_Electronics]]|21차 모델 원출처|
|[[실험_jacobian_SCR1.5_XR1.0]]|증상 비교|

---

## 🤖 Claude 지식 프롬프트 (5차 시도용)

```
[GFM_연구_전체지도.md 전체]
[이 버그 노트 전체]
[21차_야코비안_유도가이드.md 전체]

→ "SymPy 21차 야코비안에서 stable=False 문제를 해결해줘.

현재 상황:
- AC 서브시스템 단독: stable=True ✅
- 전체 21×21: stable=False ❌
- A_k(9,6): 이론값 일치 ✅
- 4차 시도까지 dpv_sym = 0.5 + Kp1*xPI1 적용

가설: f1의 iLpv_ref = 0.9/upv 비선형항을
      동작점 upv0=1.0에서 1차 선형화하면 해결될까?
      
기대 결과: stable=True, zeta_min > 0"
```

---

## 파일 경로

```
sym.py:                ~/dev/RSCAD/Simulation/sym.py
results/:              ~/dev/RSCAD/results/
  A_num_SCR1.0.npy
  A_num_SCR1.5.npy
  A_num_SCR2.0.npy
  A_num_SCR3.0.npy
  eigenvalue_results.json
```