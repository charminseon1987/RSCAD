---
type: claim
claim_id: claim-gfm-tuning-is-operating-point-dependent
date: 2026-08-25
status: supported
tags: [claim, GFM, PSO, operating-point, tuning]
---

# 🔵 Claim: GFM 제어 파라미터 최적 튜닝은 계통 운전상태(SCR, X/R)에 의존한다

> GFL/GFM 지원 기능의 적절한 튜닝은 계통 운전상태에 따라 달라지므로  
> 새롭고 적응적인 튜닝 절차가 필요하다

---

## 📌 주장 내용

단일 운전점(고정 SCR)에서 최적화된 GFM 파라미터가 다른 SCR·X/R 조건에서는  
감쇠비 저하 또는 불안정을 초래할 수 있다.  
따라서 **다중 운전점을 동시에 고려하는 PSO 최적화**가 필요하다.

---

## ▸ 지지 근거 (Supporting Evidence)

| 출처                                                           | 근거                                                                  | evidence_type |
| ------------------------------------------------------------ | ------------------------------------------------------------------- | ------------- |
| [[kenyon2020ibrstability]]                                   | "GFL 지원 기능의 적절한 튜닝은 계통 운전상태에 따라 달라지므로 새롭고 적응적인 튜닝 절차가 필요하다"고 결론에 명시 | direct        |
| [[RSCAD/06_문헌/Chen_2024_Electronics\|Chen_2024_Electronics]] | 단일 운전점 PSO → 다른 SCR에서 과적합 가능성 (저자 한계)                               | direct        |
| [[EXP_2026-08-21_Phase2_엔진전환_비교]]                            | SCR=1.5 최적화 파라미터가 SCR=1.0에서 ζ 저하 관찰                                 | inferred      |

## ▸ 반박 근거 (Contradicting Evidence)

| 출처 | 근거 | evidence_type |
|---|---|---|
| [[Dong 2026]] | 단일 CSCR 수치로 충분하다는 암묵적 가정 | inferred |

---

## ✍️ 내 연구에서의 역할

※ **인용 자리:** §I 서론 연구 동기 — "기존 단일 운전점 튜닝의 한계"  
※ **내 결과와의 관계:** 다중 운전점 PSO(SCR×4) = 이 주장의 직접적 해결책  
※ **이 주장으로 정당화되는 것:**
- F_multi = (1/4)·Σ F(SCR_k) 목적함수 설계
- 4중 차별화 축 "PSO 역할" — SVR 3개 vs GFM 14개 직접 최적화

---

## 🔗 연결 노트

- [[PSO 이중수렴기준]] — 다중 운전점 목적함수
- [[다중동작점_갱신절차]] — 운전점 갱신 방법
- [[kenyon2020ibrstability]] — 지지 근거 원출처
- [[Phase03_진행중]] — 이 주장의 검증 예정
