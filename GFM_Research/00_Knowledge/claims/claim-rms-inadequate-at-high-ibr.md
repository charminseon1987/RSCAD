---
type: claim
claim_id: claim-rms-inadequate-at-high-ibr
date: 2026-08-25
status: supported
tags: [claim, RMS, EMT, CHIL, simulation, IBR]
---

# 🔵 Claim: RMS 시뮬레이션은 고침투 IBR 계통에서 불충분하며 EMT/CHIL이 필요하다

> RMS 시간스텝(~4 ms)은 인버터 스위칭(5~50 μs)을 포착 못 하며  
> 고침투에서 가정이 붕괴 → EMT 또는 CHIL 검증 필수

---

## 📌 주장 내용

RMS 시뮬레이션은 시간스텝이 약 4 ms(1/4 사이클)로 인버터의 5~50 μs  
스위칭 동특성을 포착하지 못한다. IBR 침투율이 높아질수록 RMS의  
"느린 동특성" 가정이 무너지며, 특히 DC-link 동특성·전류제한 비선형성  
구간에서 오차가 급증한다.

---

## ▸ 지지 근거 (Supporting Evidence)

| 출처 | 근거 | evidence_type |
|---|---|---|
| [[Kenyon 2020 IBR Stability]] | "RMS 시간스텝 통상 4 ms, EMT는 5~50 μs" 명시 | direct |
| [[Kenyon 2020 IBR Stability]] | "§5.3.3 대부분의 RMS 시뮬레이션이 DC-link 동특성을 무시해 오차를 낳는다" | direct |

## ▸ 반박 근거 (Contradicting Evidence)

| 출처 | 근거 | evidence_type |
|---|---|---|
| [[Dong 2026]] | R²=0.9854로 소프트웨어만으로 충분하다는 암묵적 주장 | inferred |

---

## ✍️ 내 연구에서의 역할

※ **인용 자리:** §III 검증 방법론 — RTDS CHIL을 선택한 근거  
※ **내 결과와의 관계:** Phase 7 CHIL 88포인트 검증의 정당화  
※ **이 주장으로 정당화되는 것:**
- 소프트웨어 R²=0.9854(Dong 2026)와 대비되는 "실DSP 정밀도 ≥95%"
- 4중 차별화 축 "검증 방법" — 순수 소프트웨어 vs **RTDS CHIL**

※ **claim-dclink-dynamics-matter-during-faults와 겹침**  
→ 두 claim이 같은 근거를 공유  
→ 논문 작성 시 하나로 통합 가능

---

## 🔗 연결 노트

- [[claim-dclink-dynamics-matter-during-faults]] — 연관 claim
- [[kenyon2020ibrstability]] — 지지 근거
- [[Prony 교차검증_절차]] — EMT/CHIL 검증 방법론
- [[88포인트_2D_스윕_설계]] — Phase 7 CHIL 대상
- [[Phase04 예정]] — CHIL 검증 계획
