---
type: claim
claim_id: claim-dclink-dynamics-matter-during-faults
date: 2026-08-25
status: supported
tags: [claim, DC-link, EMT, CHIL, PV-ESS]
---

# 🔵 Claim: DC-link 동특성을 무시한 소신호 모델은 고침투 계통에서 오차를 낳는다

> 대부분의 RMS 시뮬레이션이 DC-link 동특성을 무시해  
> 오차를 낳는다 — EMT 또는 CHIL 검증이 필요하다

---

## 📌 주장 내용

DC 버스 전압 변동이 인버터 출력전력·각속도에 미치는 영향(DC-AC 커플링)을  
모델에서 제외하면, 약계통(SCR ≤ 2)에서 불안정 모드를 포착하지 못한다.  
특히 PV+ESS 2단 구조에서는 DC단이 해석의 중심이므로  
**반드시 DC-AC 커플링 A_k(9,6)을 포함한 21차 모델 + CHIL 검증**이 필요하다.

---

## ▸ 지지 근거 (Supporting Evidence)

| 출처                                                   | 근거                                                | evidence_type |
| ---------------------------------------------------- | ------------------------------------------------- | ------------- |
| [[kenyon2020ibrstability]]                           | "§5.3.3 대부분의 RMS 시뮬레이션이 DC-link 동특성을 무시해 오차를 낳는다" | direct        |
| [[RSCAD/06_문헌/Zhao_2023_Aalborg\|Zhao_2023_Aalborg]] | DC-AC 커플링 누락 시 SCR=0.8 불안정 모드 포착 실패 증명            | direct        |
| [[EXP_2026-08-21_Phase2_엔진전환_비교]]                    | A_k(9,6) 포함 후 이론값 오차 0.0001% ✅                    | direct        |

## ▸ 반박 근거 (Contradicting Evidence)

| 출처            | 근거                                    | evidence_type |
| ------------- | ------------------------------------- | ------------- |
| [[Dong 2026]] | 이상적 DC 버스 가정(12차) → 단순화로 충분하다는 암묵적 가정 | inferred      |

---

## ✍️ 내 연구에서의 역할

※ **인용 자리:**
- §II 소신호 모델 — "DC-AC 커플링 A_k(9,6) 포함 근거"
- §III 검증 방법 — "EMT/CHIL을 택한 근거"

※ **내 결과와의 관계:**
- 21차 모델의 9개 추가 상태변수 정당화
- A_k(9,6) = idc0/(J·ω₀) 이론값 검증 (오차 0.0001%)

※ **이 주장으로 정당화되는 것:**
- Dong(2026) 12차(이상적 DC) 대비 본 연구 21차의 필요성
- 4중 차별화 축 "모델 차수" — 12차 vs **21차(DC-AC 커플링)**

---

## 🔗 연결 노트

- [[DC-AC_커플링]] — A_k(9,6) 이론
- [[야코비안 행렬]] — 21차 블록 구조
- [[RSCAD/06_문헌/Zhao_2023_Aalborg|Zhao_2023_Aalborg]] — 핵심 지지 근거
- [[kenyon2020ibrstability]] — 지지 근거
- [[Phase02_완료]] — A_k(9,6) 검증 완료
