---
type: literature
cite_key: zhao2023aalborg
ref_num: 7
year: 2023
venue: Aalborg University PhD Thesis
doi: 10.54337/aau679677176
paper_type: method
model_order: 14
scr_range: "미명시"
validation_level: sim-only
tuning_method: 수동
dc_ac_coupling: true
extraction_depth: full
tags: [literature, Zhao2023, DC-AC-coupling, PhD, reference]
---

# 📚 Zhao 2023 — Aalborg PhD

> **역할: DC-AC 커플링 이론 근거 [7]**

---

## 📌 Brief Summary

▸ DC-AC 결합 GFM 인버터 소신호 모델링 PhD 논문. DC-AC 커플링 원소 누락 시 불안정 모드 포착 실패를 이론적으로 증명.

---

## 📖 Core Content

▸ **핵심 기여:**
- DC-AC 커플링 항 $A_k(9,6) = i_{dc0}/(J \cdot \omega_0)$ 유도
- 커플링 누락 시 SCR=0.8 불안정 모드 포착 실패 증명
- 단상·삼상 GFM 인버터 통합 소신호 프레임워크

▸ **핵심 수식:**

$$A_k(9,6) = \frac{\partial(\dot{\Delta\omega})}{\partial u_{dc}} = \frac{i_{dc0,k}}{J \cdot \omega_0}$$

▸ **검증:**
- 소프트웨어 시뮬레이션
- 커플링 있음 vs. 없음 비교 실험

▸ **저자 한계:**
- 단일 DC 소스 (PV+ESS 2단 미포함)
- SCR×X/R 2D 분석 없음

---

## 🔗 본 연구 연결

| 항목 | Zhao 2023 | 본 연구 |
|---|---|---|
| DC-AC 커플링 | ✅ 이론 제시 | **✅ 실험 검증** |
| A_k(9,6) 오차 | — | **0.0001% ✅** |
| 시스템 | 단일 DC | **PV+ESS 2단** |
| 검증 | 소프트웨어 | **RTDS CHIL** |

▸ Phase 2 실험에서 A_k(9,6) 이론값 오차 0.0001% 달성 → Zhao 이론 검증 완료

---

## ✍️ My Take

※ 차별점: Zhao 이론을 PV+ESS 2단 시스템에 적용·검증  
※ 인용 자리: §III DC-AC 커플링 원소 유도, "9개 추가 상태변수" 주장  
※ Dong(2026) 비판의 근거: "이상적 DC 가정 → 커플링 누락"

---

## 🔗 연결 노트

- [[DC-AC_커플링]] — 이 논문이 이론 출처
- [[야코비안 행렬]] — A_k(9,6) 원소
- [[EXP_2026-08-21_Phase2_엔진전환_비교]] — 0.0001% 검증
- [[Phase02_완료]] — 검증 완료
