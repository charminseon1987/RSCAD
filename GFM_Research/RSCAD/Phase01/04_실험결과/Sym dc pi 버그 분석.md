---

## type: debug component: sym.py date: 2026-08-19 phase: 2 status: in_progress tags: [sympy, jacobian, DC, PI, bug]

# 🔧 버그: SymPy DC PI 적분기 구조 오류

## 증상

```
SCR=1.5 결과:
  stable:   False  ❌ (True여야 함)
  zeta_min: -0.05  ❌ (음수 = 불안정 모드)
  A_k(9,6): 0.0    ❌ (0.003183이어야 함)
```

## 원인 분석

### 원인 1: A_k(9,6) = 0

```python
# f9 = (1 - Pfilt - Dp*dw) / J
# ∂f9/∂udc = 0  ← udc가 f9에 직접 없음

# DC-AC 커플링은 동작점 선형화에서 나타남:
# P_meas = u_od*i_od → 동작점에서 i_dc0에 의존
# → 야코비안에서 자동으로 안 나옴 → 수동 설정 필요

# 수정:
A_num[8, 5] = idc0 / (J * w0)
# = 0.6 / (0.5 × 376.99) = 0.003183 ✅
```

### 원인 2: DC PI 구조 오류 → stable=False

```python
# 현재 (잘못됨): 듀티비 고정
f7 = (upv - 0.5*udc) / Lpv   # dpv=0.5 고정
# → xPI1이 A 행렬에 연결 안됨 → 불안정

# 수정 필요:
# dpv = 0.5 + Kp1*xPI1   (PI 피드백 연결)
f7_correct = (upv - (0.5 + Kp1_sym*xPI1)*udc) / Lpv
# → xPI1이 f7에 나타남 → ∂f7/∂xPI1 ≠ 0
# → PI 적분기가 야코비안에 올바르게 연결됨
```

### 원인 3: AC 서브시스템은 단독 안정 확인

```python
# 검증 완료:
A_AC_test (13×13 수동 구성)
→ stable=True ✅
→ AC 서브시스템 자체는 문제없음
→ DC 서브시스템 PI 구조가 문제
```

## 수정 방향

```python
# sym.py 수정 포인트:

# 1. 듀티비 심볼릭 선언
Kp1, Ki1 = sp.symbols('Kp1 Ki1', positive=True)
dpv_sym = sp.Rational(1,2) + Kp1*xPI1

# 2. f7 수정
f7 = (upv - dpv_sym*udc) / Lpv

# 3. f4 수정 (MPPT 전류 기준값)
iLpv_ref = sp.Rational(9,10) / upv  # P_mpp/Vpv
f1 = iLpv_ref - iLpv  # xPI1 오차 적분

# 4. 수치 대입 시 파라미터 추가
subs_params = {Kp1: 0.1, Ki1: 10.0}
```

## 테스트 결과 기록

|시도|수정 내용|stable|zeta_min|비고|
|---|---|---|---|---|
|1차|dpv=0.5 고정|False|-0.68|원인 확인|
|2차|pu 단위 통일|False|-0.05|개선됐으나 미해결|
|3차|AC 단독 확인|True|0.013|AC는 정상|
|4차|dpv_sym 연결|⏳|⏳|다음 시도|

## 다음 실행 코드

```python
# ~/dev/RSCAD/simulation/sym.py 수정 후
python simulation/sym.py

# 기대 결과:
# SCR=1.5: stable=True, zeta_min>0, A_k(9,6)=0.003183
```

## Claude 프롬프트

```
[이 노트 전체]
[21차_야코비안_유도가이드.md]

→ "SymPy f(x)에서 PI 적분기 방정식 f1~f3을
   듀티비 dpv = 0.5 + Kp1*xPI1에 올바르게 연결하는
   코드를 작성해줘. stable=True가 나와야 함."
```

## 연결 노트

- [[21차 야코비안 유도가이드]]
- [[DC-AC_커플링]]
- [[실험_jacobian_SCR1.5_XR1.0]]