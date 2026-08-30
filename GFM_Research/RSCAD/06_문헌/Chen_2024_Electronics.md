---
type: literature
cite_key: chen2024electronics
ref_num: 1
year: 2024
venue: Electronics (MDPI)
doi: 10.3390/electronics13071343
paper_type: method
model_order: 21
scr_range: "0.8~5.0"
validation_level: sim-only
tuning_method: PSO
dc_ac_coupling: false
pso_params: 14
extraction_depth: full
tags: [literature, Chen2024, PSO, 21-state, GFM, reference]
---

# 📚 Chen et al. 2024 — Electronics

> **역할: 본 연구 방법론 베이스 [1]**

---

## 📌 Brief Summary

▸ 21차 소신호 모델 기반 GFM 인버터 PSO 최적화 연구. 14개 제어 파라미터를 단일 운전점에서 최적화.

---

## 📖 Core Content

▸ **핵심 기여:**
- 21차 상태변수 소신호 모델 구축 (DC + AC 통합)
- PSO로 14개 GFM 제어 파라미터 최적화
- 감쇠비 ζ = 0.707 목표 설정

▸ **방법:**
- 상태변수: DC 8개 + AC 13개 = 21개
- PSO: w=0.729, c1=c2=2.05 (Clerc-Kennedy)
- 운전점: 단일 SCR (이 점이 본 연구와 차이)

▸ **파라미터 (Table I):**

| 파라미터 | 값 | 단위 |
|---|---|---|
| J | 0.5 | kg·m² |
| Dp | 20.0 | N·m·s |
| Kpv | 1.0 | A/V |
| Kiv | 100 | A/Vs |
| Kpc | 5.0 | V/A |
| Kic | 50 | V/As |
| L1 | 0.002 | H |
| Cf | 0.0001 | F |

▸ **검증:** 소프트웨어 시뮬레이션만 (CHIL 없음)

▸ **저자 한계:**
- 단일 운전점 최적화 → 다른 SCR에서 과적합 가능
- 이상적 DC 버스 가정 → DC-AC 커플링 미반영

---

## 🔗 본 연구 연결

| 항목 | Chen 2024 | 본 연구 |
|---|---|---|
| 모델 차수 | 21차 | 21차 (동일) |
| PSO 파라미터 수 | 14개 | 14개 (동일) |
| 운전점 | 단일 SCR | **다중 {3.0,2.0,1.5,1.0}** |
| DC-AC 커플링 | ❌ | **✅ A_k(9,6)** |
| 검증 | 소프트웨어 | **RTDS CHIL** |

※ Chen 구조를 기반으로 다중 운전점·커플링·CHIL을 추가한 것이 본 연구의 핵심 확장

---

## ✍️ My Take

※ 차별점: 단일 운전점 → 다중 운전점, DC-AC 커플링 추가  
※ 인용 자리: §II 방법론, §III 소신호 모델, PSO 설계  
※ 파라미터 초기값 출처로 직접 인용

---

## 🔗 연결 노트

- [[야코비안 행렬]] — 21차 구조 원출처
- [[다중동작점_갱신절차]] — 단일→다중 확장
- [[PSO 이중수렴기준]] — 14개 파라미터 목록
- [[참여인자 지배모드]] — P_ki > 0.15 기준
- [[Phase02_완료]] — 파라미터 초기값 사용
