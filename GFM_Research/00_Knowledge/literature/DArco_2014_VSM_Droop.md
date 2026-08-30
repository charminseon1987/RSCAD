---
type: literature
cite_key: darco2014vsm
ref_num: 미정
year: 2014
venue: IEEE Transactions on Smart Grid, Vol.5, No.1, pp.394-395
doi: 10.1109/TSG.2013.2288000
paper_type: method
model_order: 미명시
scr_range: 미명시
validation_level: sim-only
tuning_method: 수동
dc_ac_coupling: false
extraction_depth: full
tags: [literature, DArco2014, VSM, droop, equivalence, GFM, swing-equation]
---

# 📚 D'Arco & Suul 2014 — VSM-Droop 등가성

> **저자:** Salvatore D'Arco, Jon Are Suul (SINTEF Energy Research, Norway)  
> **저널:** IEEE Transactions on Smart Grid, Vol.5, No.1, Jan. 2014  
> **역할:** VSM과 주파수 드룹 제어의 이론적 등가성 증명 — 본 연구 VSG 모델 근거

---

## 📌 Brief Summary

▸ VSM(Virtual Synchronous Machine)과 주파수 드룹 제어가 특정 조건에서 수학적으로 동등함을 증명. VSM 스윙 방정식과 드룹 제어의 파라미터 대응 관계 도출.

---

## 📖 Core Content

### ▸ VSM 스윙 방정식 (핵심 수식)

$$T_a \cdot s \cdot \omega_{VSM} = p_0 - p_{el} - k_d(\omega_{VSM} - \omega_g)$$

| 기호 | 의미 | 본 연구 대응 |
|---|---|---|
| $T_a = 2H$ | 기계적 시상수 (관성) | **J** |
| $p_0$ | 유효전력 기준값 | P_ref |
| $p_{el}$ | 인버터 출력전력 | P_meas |
| $k_d$ | 댐핑 계수 | **Dp** |
| $\omega_{VSM}$ | VSM 각속도 | **Δω + ω₀** |

### ▸ 드룹 제어 방정식

$$\omega^* = \omega_g - m_p(p_m - p_0), \quad v^* = v_g - m_q(q_m - q_0)$$

### ▸ 등가 조건 (식 6)

$$T_a = T_f \cdot \frac{1}{m_p}, \qquad k_d = \frac{1}{m_p}$$

```
→ 드룹 이득 m_p = 1/k_d
→ 필터 시상수 T_f = T_a · m_p = T_a/k_d
→ VSM 댐핑 k_d ↔ 드룹 이득 m_p 역비례 관계
```

### ▸ 핵심 주장

```
▸ VSM과 주파수 드룹은 동일한 동적 거동 (Fig.3에서 파형 완전 일치)
▸ 저역통과 필터가 가상 관성 역할 수행
▸ 필터 없는 드룹 = 관성 없는 VSM → 본질적 불안정
▸ 복잡한 전압·전류 루프 추가해도 전체 거동은 스윙 방정식이 지배
```

### ▸ 검증

```
▸ 수치 시뮬레이션 (Ta=1.8s, kd=5.7103)
▸ 4가지 조건 비교: VSM/드룹 × 이상적/종속 전압원
▸ 결과: 모든 조건에서 파형 완전 일치
```

### ▸ 저자 한계

```
▸ 단일 인버터 마이크로그리드 (다중 인버터 미분석)
▸ 소신호 모델 없음 (스윙 방정식 수준)
▸ SCR·X/R 영향 미분석
▸ DC-AC 커플링 미반영
```

---

## 🔗 본 연구 연결

| 항목 | D'Arco 2014 | 본 연구 |
|---|---|---|
| VSM 모델 | 스윙 방정식 (2차) | **21차 완전 소신호** |
| 파라미터 | Ta, kd | **J, Dp** (직접 대응) |
| DC-AC 커플링 | ❌ | **✅ A_k(9,6)** |
| 검증 | 소프트웨어 | **RTDS CHIL** |
| 계통 조건 | 단일 | **SCR×X/R 2D** |

```
▸ 본 연구 f9 방정식의 이론적 근거:
  dΔω/dt = (P_ref - P_filt - Dp·Δω) / J
  ← D'Arco 식(1): Ta·s·ωVSM = p0 - pel - kd(ωVSM - ωg)
  Ta=J, kd=Dp, pel=Pfilt 대응

▸ 임계 댐핑 조건:
  critical_Dp = 2√(J·wc) = 7.92
  → Dp=20 > 7.92 → 과감쇠
  ← D'Arco: "필터 없으면 본질적 불안정" → 적정 Dp 필요
```

---

## ✍️ My Take

```
인용 우선순위: ⭐⭐⭐ 높음

※ 본 연구 f9 방정식의 직접 이론 근거
※ J(=Ta), Dp(=kd) 파라미터 물리적 의미 설명 시 인용
※ "VSM과 드룹이 동등" → 본 연구 VSG 제어 선택의 이론적 배경
※ 인용 자리: §II 소신호 모델 VSG 스윙 방정식 유도 부분
※ 단점: 소신호가 아닌 스윙 방정식 수준 → 21차 확장 필요성 부각에 활용
```

---

## 📋 인용 가능 문장 후보

```
▸ "The damping gain kd in the VSM is inversely linked to the droop gain mp"
  → Dp와 드룹 이득의 역비례 관계 설명 시

▸ "A power-frequency droop without low-pass filtering will correspond
   to a VSM with zero inertia, which would be inherently unstable"
  → 적정 Dp 설정 필요성 근거 시
```

> ⚠️ 저작권: 인용 시 15단어 이내

---

## 🔗 연결 노트

- [[소신호_선형화]] — 스윙 방정식 → 21차 확장
- [[야코비안 행렬]] — f9 방정식 유도 근거
- [[고유값_안정도판단]] — 임계 댐핑 Dp=7.92
- [[Phase02_완료]] — f9 구현 완료

## 참고문헌

- ▸ [1] Beck & Hesse 2007 — VSM 최초 제안
- ▸ [5] Rocabert et al. 2012 — 드룹 제어 마이크로그리드
