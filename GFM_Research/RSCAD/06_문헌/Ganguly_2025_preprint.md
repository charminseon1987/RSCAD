---
type: literature
cite_key: ganguly2025preprint
ref_num: 3
year: 2025
venue: Preprints.org (NREL)
doi: 10.20944/preprints202504.1145.v1
paper_type: experimental
model_order: 미명시
scr_range: "0.5~2.0"
validation_level: PHIL
tuning_method: 미명시
dc_ac_coupling: 미명시
extraction_depth: full
tags: [literature, Ganguly2025, X/R, 2D-boundary, SCR-star, NREL, reference]
---

# 📚 Ganguly, Wang, Kroposki 2025 — NREL Preprint

> **역할: SCR×X/R 2D 경계 연구 동기 [3]**

---

## 📌 Brief Summary

▸ X/R 비율이 GFM 인버터 안정도에 SCR 못지않게 중요함을 하드웨어 실험으로 관찰. 1D SCR 분석의 불완전성 증명.

---

## 📖 Core Content

▸ **핵심 기여:**
- X/R=0.5 조건: 인버터 1번 트립 관찰
- X/R=1.0 조건: 인버터 2번 트립 관찰
- "SCR 단변수 분석만으로 안정 경계 완전히 서술 불가" 결론

▸ **방법:**
- PHIL (Power Hardware-In-the-Loop) 실험
- 저자: Ganguly(NREL), Wang(Manchester), Kroposki(NREL)

▸ **주요 관찰:**

| X/R 조건 | 결과 |
|---|---|
| 0.5 | 인버터 1 트립 |
| 1.0 | 인버터 2 트립 |
| 2.0+ | 미명시 |

▸ **저자 한계:**
- 정성적 관찰 (정량적 SCR* 경계 미도출)
- 1D 분석만 제시 → 2D 경계 함수 없음
- CHIL 아닌 PHIL (DSP 실제 연결)

---

## 🔗 본 연구 연결

| 항목 | Ganguly 2025 | 본 연구 |
|---|---|---|
| X/R 영향 관찰 | ✅ 정성적 | **✅ 정량적 88포인트** |
| SCR* 경계 | 없음 (1D) | **SCR*(X/R) 2D 곡면** |
| 검증 방법 | PHIL | **RTDS CHIL** |
| 포인트 수 | ~4개 | **88개** |

▸ "최초 CHIL 기반 SCR×X/R 2D 경계 정량화" 주장의 핵심 근거  
▸ Ganguly 관찰 → 본 연구 정량화로 확장

---

## ✍️ My Take

※ 차별점: 정성적 관찰 → 88포인트 정량 경계 도출  
※ 인용 자리: §I 서론 "연구 동기", §V 결과 비교  
※ Phase 2 X/R=5.0 경향 반전은 모델 한계 (Ganguly 결과와 불일치)  
※ 저널 게재 여부 모니터링 필요 (현재 preprint)

---

## 🔗 연결 노트

- [[88포인트_2D_스윕_설계]] — 이 논문이 2D 동기
- [[고유값_안정도판단]] — SCR* 정량화 목표
- [[실험 sweep2d j0.5 dp20]] — Phase 1 비교
- [[EXP_2026-08-21_Phase2_엔진전환_비교]] — X/R 경향 불일치 관찰
- [[Phase03_진행중]] — PSO 후 SCR* 비교 예정
