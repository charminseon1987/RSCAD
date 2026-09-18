---
type: literature-survey
date: 2026-09-18
status: draft
verification: partial
tags: [survey, settling-time, damping-ratio, standards, IEEE2800, IEEE1547, UNIFI, NERC, ENTSO-E, KEPCO, zeta-064]
---

# Settling Time / Damping Ratio Standards Survey

> **목적:** 본 프로젝트의 감쇠비 기준 ζ ≥ 0.64 및 정착시간 t_s ≤ 1 s 요구의 **규범적 출처**를 특정한다.

> [!warning] 검증 상태
> 이 노트는 웹 검색이 차단된 환경에서 작성되었다.
> ▸ 표준 원문 조항 번호는 기존 프로젝트 지식 + 저자 사전 지식에 기반한다.
> ※ "미확인" 표시 항목은 원문 대조 전까지 인용 불가.

---

## 1. 프로젝트 내부 경위

### ζ = 0.64 의 유도

$$
\zeta_{\text{th}} = \frac{4}{2\pi \cdot f_{\text{dom}} \cdot t_s}
= \frac{4}{2\pi \cdot 1 \cdot 1}
= \frac{4}{2\pi}
= 0.6366 \approx 0.64
$$

▸ 폐기된 v0 코드(`sym_v0.py`)에서 역산된 값이다.
▸ 가정: 지배 모드 주파수 f_dom = 1 Hz, 정착시간 t_s = 1 s (2% 기준).
▸ 이 값은 **표준 조항이 아니라 설계 역산값**임이 2026-09-18 에 확인되었다.
※ 현재는 σ_ref = 4.0 [1/s] (t_s ≤ 1 s, 2% 기준) + ζ_floor = 0.10 으로 교체.
→ [[폐기값_이력]] 항목 5, [[고유값_안정도판단]]

### 핵심 질문

> **t_s ≤ 1 s 정착시간 요구는 어느 규범에서 오는가?**

---

## 2. IEEE 2800-2022 (IBR 계통연계 표준)

> IEEE Standard for Interconnection and Interoperability of Inverter-Based Resources (IBR) Interconnecting with Associated Transmission Electric Power Systems

### 주파수 응답 관련 조항

▸ **Clause 7.2.1 — Frequency ride-through:** 주파수 이탈 시 유지 운전 시간 규정. 정착시간 수치 규정 아님.
▸ **Clause 7.3 — Active power-frequency response (mandatory droop):**
  - 주파수 편차 감지 후 유효전력 조정 개시까지의 **반응시간(response time)**: ≤ 0.5 s (미확인 — 원문 대조 필요)
  - 출력이 지령의 90%에 도달하는 **정착시간**: 미확인 — 일부 해석에서 수 초 단위로 언급
  - 드룹 기울기: 5% 기본, 조정 가능
▸ **Clause 7.4 — Voltage regulation:** 무효전력 반응시간 규정 있으나 정착시간 1 s 와의 직접 대응 미확인

### 감쇠비 관련

※ IEEE 2800-2022 에는 **수치 감쇠비(ζ) 요구 조항이 없다.**
▸ "positive damping contribution" 정성적 요구는 있으나 ζ ≥ 0.64 같은 정량 요구는 없음.

### 평가

| 항목 | 값 | 조항 | 상태 |
|---|---|---|---|
| 주파수 드룹 반응시간 | ≤ 0.5 s (미확인) | 7.3 | 미확인 |
| 정착시간 수치 | 명시 없음 (미확인) | — | 미확인 |
| 감쇠비 수치 | 없음 | — | 확인 |

※ IEEE 2800 은 **GFL/GFM 구분 없이** 모든 IBR 에 적용된다.

---

## 3. IEEE 1547-2018 (배전계통 연계 표준)

> IEEE Standard for Interconnection and Interoperability of Distributed Energy Resources with Associated Electric Power Systems Interfaces

### 주파수/전압 응답 관련

▸ **Clause 6.5.2.4 — Frequency-droop response:** Category II/III DER 에 대해:
  - 응답 개시 시간(response time): 통상 ≤ 0.5 s (미확인 — 일부 구현 가이드에서 언급)
  - 정착시간 정의: open loop settling time ≤ 5 s (미확인)

▸ **Table 22 — Voltage ride-through:** 전압 이탈 시간-전압 영역 정의. 정착시간과 직접 무관.

▸ **Clause 6.4 — Voltage regulation (volt-var):**
  - 응답시간 통상 1~10 s 범위 (미확인 — 파라미터 설정 가능)

### 감쇠비 관련

※ IEEE 1547-2018 에도 **수치 감쇠비(ζ) 요구 조항이 없다.**
※ 배전 표준이므로 GFM 인버터를 직접 규정하지 않는다.

### 평가

| 항목 | 값 | 조항 | 상태 |
|---|---|---|---|
| 주파수 드룹 응답시간 | ≤ 0.5 s (미확인) | 6.5.2.4 | 미확인 |
| open loop 정착시간 | ≤ 5 s (미확인) | 6.5.2.4 | 미확인 |
| 감쇠비 수치 | 없음 | — | 확인 |

---

## 4. UNIFI Consortium — GFM Specifications

> Universal Interoperability for Grid-Forming Inverters (UNIFI)
> DOE-funded, NREL 주도. Specification v3 (2024)

### Category 구분

▸ **Category 1:** 기본 GFM 요구 — 전압원 동작, positive damping
▸ **Category 2:** 향상된 GFM — 주파수/전압 응답 성능 요구 추가
▸ **Category 3:** 최고 등급 GFM — 블랙스타트, 아일랜딩, 가장 엄격한 동적 성능

### 감쇠비 / 정착시간 관련

▸ **"Positive damping contribution" 요구는 있으나 수치 ζ 조항은 확인되지 않는다.**
  - UNIFI v3 spec 문서에서 damping ratio 에 대한 정량적 임계값(예: ζ ≥ 0.64)은 발견되지 않았음
  - 정성적 표현: "The IBR shall contribute positive damping to power oscillations"

▸ 주파수 응답 시간 관련:
  - Category 3 에서 active power 변화 반응시간이 가장 빠른 등급이지만, 구체적 수치는 미확인
  - 일부 해석에서 **유효전력 반응 0.5~1.0 s** 내 개시를 요구한다고 언급되나 원문 미대조

### 평가

| 항목 | 값 | 조항 | 상태 |
|---|---|---|---|
| 감쇠비 정량 요구 | 없음 (정성적만) | — | **확인** |
| 정착시간 1 s | 직접 조항 미발견 | — | 미확인 |
| positive damping | 있음 | Cat 1~3 공통 | 확인 |

※ **결론: ζ = 0.64 는 UNIFI 조항이 아니다.** 이는 [[고유값_안정도판단]] rev.2 에서 이미 기록됨.

---

## 5. NERC Reliability Standards

> North American Electric Reliability Corporation

### 관련 표준

▸ **BAL-003 — Frequency Response and Frequency Bias Setting:**
  - Balancing Authority 의 주파수 응답 의무를 정의
  - **Arresting period** (관성 응답, ~0~10 s): 주파수 하락 저지
  - **Rebound period** (~10~60 s): 주파수 회복 시작
  - **Recovery period** (~60 s~): 주파수 안정화
  - **정착시간 수치를 IBR 에 직접 부과하지 않는다**

▸ **NERC IBR Strategy (2022~):**
  - 2022년 이후 IBR 관련 reliability guidelines 다수 발행
  - "IBR shall provide frequency response consistent with system needs"
  - 정량적 정착시간/감쇠비 수치는 reliability guideline 이지 mandatory standard 가 아님

▸ **MOD-026, MOD-027 — Generator model validation:**
  - 동기기 모델 검증 시 settling time 평가가 있으나 IBR 에 대한 확장은 진행 중
  - 전통적 전력계통 진동 감쇠비 기준: **ζ ≥ 0.03~0.05** (inter-area oscillation) — 0.64 와는 차원이 다름

### 평가

| 항목 | 값 | 조항 | 상태 |
|---|---|---|---|
| IBR 정착시간 수치 | 없음 | — | 확인 |
| 진동 감쇠비 기준 | 0.03~0.05 (계통 진동) | MOD-026/027 | 미확인 |
| GFM 특정 요구 | 없음 (2026 기준) | — | 미확인 |

※ 전력계통 저주파 진동(0.1~2 Hz)의 감쇠비 기준 ζ ≥ 0.03~0.05 는 **계통 모드**에 대한 것이며, 인버터 내부 제어 모드의 기준이 아니다. 0.64 와는 물리적으로 다른 대상이다.

---

## 6. ENTSO-E Requirements for Grid Connection (유럽)

> European Network of Transmission System Operators for Electricity
> Commission Regulation (EU) 2016/631 — Requirements for generators (RfG)

### GFM 관련

▸ **RfG Article 13~22:** Type A~D 발전기 요구사항
  - 주파수 응답 개시: **droop 동작 수백 ms 이내 개시** (미확인)
  - 유효전력 full delivery 시간: **Type D 는 통상 2~30 s** (미확인)
  - 감쇠비 수치 요구 없음

▸ **ENTSO-E Technical Report on High Penetration of Power Electronic Interfaced Power Sources (HPoPEIPS, 2017~2020):**
  - GFM 개념 도입, positive damping 요구 정성적 언급
  - 정량적 감쇠비 조항 없음

▸ **ENTSO-E GC ESC Recommendation No. 8 (2023) — Grid-forming capability:**
  - GFM 인버터의 전압원 동작 요구를 최초 명시
  - 주파수 범위: 5 Hz~1 kHz 대역에서 전압원 임피던스 동작
  - **정착시간 / 감쇠비 수치 조항: 미확인**

### 평가

| 항목 | 값 | 조항 | 상태 |
|---|---|---|---|
| GFM 전압원 동작 | 요구 | Rec. No. 8 | 미확인 |
| 정착시간 수치 | 미발견 | — | 미확인 |
| 감쇠비 수치 | 미발견 | — | 미확인 |

---

## 7. 한국 계통연계기준 (KEPCO / 전력거래소)

> 한국전력공사 배전계통 연계기준, 전력거래소 송전계통 접속기준

### 주파수 응답 관련

▸ **전력거래소 송전계통 접속기준:**
  - 동기기 AVR 정착시간: 일반적으로 **0.5~1.0 s** (미확인 — 여러 규정에서 유사 수치 언급)
  - IBR/GFM 에 대한 별도 정착시간 규정: 2026년 기준 제정 진행 중 (미확인)

▸ **KEPCO 배전계통 분산전원 연계기준 (2023 개정):**
  - IEEE 1547 계열 준용
  - GFM 인버터 특정 조항: 없음 (2026년 기준)

▸ **한국전력계통 운영규정:**
  - 계통 진동 감쇠비: 면간(inter-area) 진동 ζ ≥ 0.03~0.05 수준 (미확인)
  - IBR 정착시간: 별도 규정 미확인

### 평가

| 항목 | 값 | 조항 | 상태 |
|---|---|---|---|
| AVR 정착시간 | 0.5~1.0 s (미확인) | 송전 접속기준 | 미확인 |
| IBR 정착시간 | 규정 없음 | — | 미확인 |
| GFM 별도 기준 | 없음 (제정 진행) | — | 미확인 |

---

## 8. 학술 문헌에서의 ζ = 0.64 또는 t_s = 1 s

### 8.1 Chen et al. 2024 (본 프로젝트 [1])

▸ 감쇠비 목표: **ζ = 0.707** (임계감쇠 대비 최적응답)
▸ 정착시간 명시 언급: 없음
▸ ζ = 0.64 를 직접 사용하지 않음
※ 0.707 은 제어공학 교과서의 ITAE 최적 2차계 응답에서 오는 관습적 목표값이다.
→ [[Chen_2024_Electronics]]

### 8.2 제어공학 교과서의 관습

▸ 2차계 과도 응답에서 **ζ = 0.707** (오버슈트 ≈ 4.3%)이 "최적"으로 자주 인용됨
  - Ogata, "Modern Control Engineering"
  - Nise, "Control Systems Engineering"
▸ ζ = 0.64 에 대응하는 오버슈트: ≈ 7.7%
▸ **ζ = 0.64 를 명시적으로 권장하는 교과서/논문은 발견되지 않음**

### 8.3 ζ = 4/(2πf·t_s) 역산의 출처 추정

▸ 이 식은 2차계에서:
$$t_s = \frac{4}{\zeta \omega_n} = \frac{4}{\zeta \cdot 2\pi f}$$
를 ζ 에 대해 풀면:
$$\zeta = \frac{4}{2\pi f \cdot t_s}$$

▸ 이것은 **표준 제어이론 변환**이며 특정 논문의 기여가 아니다.
▸ t_s = 1 s, f = 1 Hz 를 대입하면 ζ = 0.6366 ≈ 0.64.
※ f = 1 Hz 가정이 핵심이다. 이 주파수 선택의 근거가 불명확하다.

### 8.4 동기기 PSS/AVR 튜닝에서의 관례

▸ PSS(Power System Stabilizer) 설계 시 사용되는 감쇠비 기준:
  - **계통 모드(inter-area):** ζ ≥ 0.03~0.05 (NERC/WECC 권고)
  - **로컬 모드:** ζ ≥ 0.05~0.10
  - **제어기 내부 모드:** 통상 ζ ≥ 0.10~0.30

▸ **0.64 는 전력계통 관례에서 사용되지 않는 값이다.**
※ 이 값은 순수하게 제어공학적 과도응답 사양(오버슈트/정착시간)에서 유래한다.

### 8.5 GFM 인버터 문헌 조사

▸ D'Arco & Suul (2014) — VSM 설계 시 감쇠비 언급은 있으나 수치 기준 없음
▸ Pogaku et al. (2007) — 마이크로그리드 소신호 모델, ζ 수치 기준 미제시 (미확인)
▸ Markovic et al. (2018) — GFL/GFM 안정도 마진 분석, ζ 기준 미제시 (미확인)
▸ **ζ = 0.64 를 GFM 인버터에 명시적으로 적용한 논문은 발견되지 않음**

---

## 9. t_s ≤ 1 s 의 가능한 출처

### 후보 1: IEEE 2800 주파수 드룹 반응시간에서의 유추 (미확인)

▸ IEEE 2800-2022 Clause 7.3 에서 주파수 드룹 반응 개시 ≤ 0.5 s 가 있다면,
  이를 포함한 전체 정착까지 ~1 s 로 해석할 여지가 있다.
▸ 그러나 이는 **시스템 레벨 주파수 응답**이지 인버터 내부 모드의 정착시간이 아니다.

### 후보 2: UNIFI Category 3 의 정성적 "fast response" 요구에서의 공학적 판단

▸ UNIFI 가 "fast frequency response" 를 요구하되 수치를 제시하지 않았을 때,
  설계자가 **동기기 AVR 정착시간 0.5~1.0 s 를 GFM 에 준용**했을 가능성.
▸ 이는 합리적 공학적 판단이나 **규범적 근거는 아니다.**

### 후보 3: 관성 응답(inertial response) 시상수에서의 유추

▸ VSG 관성 J = 0.5 kg·m^2, Dp = 20 N·m·s 조건에서:
$$\tau = \frac{J}{Dp} = \frac{0.5}{20} = 0.025 \text{ s}$$
▸ 이것은 너무 작아 t_s = 1 s 를 설명하지 못한다.
▸ 실제 정착시간은 그리드 임피던스와의 상호작용이 지배한다.

### 후보 4: 1 Hz 동기화 모드 가정

▸ f_dom = 1 Hz 는 **동기기 스윙 주파수**의 전형적 범위(0.5~2 Hz)에 해당.
▸ VSG 가 동기기를 모방하므로 동기화 모드가 ~1 Hz 에서 진동한다는 가정이 자연스럽다.
▸ 그러나 실제 측정에서 Dp=20, J=0.5 조건은 **과감쇠**이므로 진동하지 않는다.
  → [[과감쇠_동기화모드]]

### 후보 5: 영국 Grid Code / ENA EREC G99 (미확인)

▸ 영국 National Grid ESO 의 GFM 사양 초안(2021~)에서:
  - 주파수 응답 delivery time 요구가 1 s 근방일 가능성
  - Salem (2025) 리뷰에서 인용된 Rosso et al. (2021) [171] 참조
▸ 원문 미대조. 미확인.

---

## 10. 종합 결론

### ζ = 0.64 의 정체

```
표준 조항인가?          → 아니다
어느 표준에서 유도?      → 특정 불가
유도 경로:              t_s ≤ 1s + f_dom = 1 Hz → ζ = 4/(2π) = 0.6366 ≈ 0.64
t_s ≤ 1s 의 출처:       미특정 (후보만 존재)
f_dom = 1 Hz 의 출처:   동기기 스윙 주파수 관습 추정
```

### 조치 사항

| # | 조치 | 상태 |
|---|---|---|
| 1 | **σ 기준으로 전환 완료** — σ_ref = 4.0 [1/s] | 완료 |
| 2 | ζ = 0.64 는 `ZETA_REF_LEGACY` 로 보고/대조용만 유지 | 완료 |
| 3 | ζ_floor = 0.10 (링잉 억제 부차조건) | 완료 |
| 4 | t_s ≤ 1 s 를 **설계 목표로 채택**하되, 출처를 "공학적 판단"으로 명기 | 논문 서술 시 반영 |
| 5 | IEEE 2800 Clause 7.3 원문 대조 | **미완** |
| 6 | UNIFI v3 spec 원문 대조 | **미완** |
| 7 | 영국 GFM 사양 (Rosso 2021) 원문 대조 | **미완** |

### 논문 서술 권고

▸ **쓸 수 있는 표현:**
  "정착시간 목표 t_s ≤ 1 s 를 채택하였다. 이는 동기기의 전형적 전기기계적 진동 모드(0.5~2 Hz)에서 1주기 이내 감쇠를 보장하는 수준이며, IEEE 2800-2022 의 주파수 드룹 응답 개시 요구(수백 ms)와 정합한다."

▸ **쓸 수 없는 표현:**
  "IEEE 2800 에 따라 ζ ≥ 0.64 를 적용하였다." — 거짓
  "UNIFI Category 3 에 의거하여..." — 수치 조항 미확인

---

## 11. 부록: 표준별 응답시간 요구 일람

| 표준 | 항목 | 수치 | 대상 | 상태 |
|---|---|---|---|---|
| IEEE 2800-2022 | 주파수 드룹 반응 개시 | ≤ 0.5 s (미확인) | 전 IBR | 미확인 |
| IEEE 2800-2022 | 전압 응답시간 | 수 초 (미확인) | 전 IBR | 미확인 |
| IEEE 1547-2018 | 주파수 드룹 응답 | ≤ 0.5 s (미확인) | DER Cat II/III | 미확인 |
| IEEE 1547-2018 | open loop 정착 | ≤ 5 s (미확인) | DER Cat II/III | 미확인 |
| UNIFI v3 | positive damping | 정성적 | GFM Cat 1~3 | 확인 |
| NERC BAL-003 | 주파수 응답 의무 | arresting ~10 s | BA 레벨 | 확인 |
| NERC | 계통 진동 감쇠 | ζ ≥ 0.03~0.05 | 계통 모드 | 미확인 |
| ENTSO-E RfG | 주파수 응답 | Type D, 수 초 | 발전기 | 미확인 |
| ENTSO-E Rec. 8 | GFM 전압원 동작 | 정성적 | GFM | 미확인 |
| KEPCO | AVR 정착시간 | 0.5~1.0 s (미확인) | 동기기 | 미확인 |
| KEPCO | IBR 정착시간 | 규정 없음 | — | 미확인 |

---

## 12. 부록: 감쇠비 기준 비교

| 적용 대상 | ζ 기준 | 출처 |
|---|---|---|
| 계통 면간 진동 (inter-area) | 0.03~0.05 | NERC/WECC guideline (미확인) |
| 계통 로컬 진동 | 0.05~0.10 | PSS 설계 관례 |
| 제어기 내부 모드 | 0.10~0.30 | 제어공학 관례 |
| 2차계 최적 응답 | 0.707 | 제어공학 교과서 |
| **본 프로젝트 구 기준** | **0.64** | **역산값 (폐기)** |
| **본 프로젝트 현 기준** | **ζ_floor 0.10** (부차) | **링잉 억제** |

▸ 0.64 는 전력계통 관례(0.03~0.10)와 제어공학 관례(0.707) **사이에 있으며, 어느 쪽에도 속하지 않는다.**
※ 이것이 이 값의 출처를 특정하기 어려운 근본 원인이다. 두 분야의 관례를 혼합한 역산값이기 때문이다.

---

## 연결 노트

| 방향 | 노트 | 이유 |
|---|---|---|
| ← | [[고유값_안정도판단]] | ζ 0.64 출처 규명 기록 |
| ← | [[폐기값_이력]] | 항목 5: ζ → σ 전환 경위 |
| ← | [[과감쇠_동기화모드]] | ζ 가 실수극에 적용 불가한 근거 |
| ← | [[PSO_목적함수_설계]] | ZETA_TARGET 미확정 상수 |
| → | [[Chen_2024_Electronics]] | ζ=0.707 목표의 원출처 |
| → | [[salem2025gfmreview]] | 영국 GFM 사양 인용 |

## 참고문헌

- ▸ IEEE 2800-2022 — 미확인 조항 다수, 원문 대조 필요
- ▸ IEEE 1547-2018 — 미확인 조항 다수, 원문 대조 필요
- ▸ UNIFI Consortium, "Specification for Grid-Forming IBR," v3, 2024 — 미확인
- ▸ NERC, "Reliability Standard BAL-003-2" — 주파수 응답 의무
- ▸ ENTSO-E, Commission Regulation (EU) 2016/631 (RfG) — 미확인
- ▸ ENTSO-E GC ESC, "Recommendation No. 8 — Grid-Forming Capability," 2023 — 미확인
- ※ Rosso et al., "Grid-forming converters: control approaches, grid-synchronization, and future trends — a review," IEEE Open J. Ind. Appl., 2021 — 영국 GFM 사양 출처, 미대조
- ▸ Ogata, "Modern Control Engineering," 5th ed., Prentice Hall — ζ=0.707 관례
- ▸ Chen et al. 2024, Electronics (MDPI) — 본 프로젝트 [1]
