---
cite_key: dong2026gfmsvr
ref_num: 2
title: "Small-signal stability assessment method based on online prediction of the critical short-circuit ratio for grid-forming converters"
authors: [Wei Dong, Ying Cheng, Ying Yang, Feng Zhang, Bowen Wang, Guanzhong Wang]
corresponding: Guanzhong Wang (eewgz@sdu.edu.cn)
year: 2026
venue: Frontiers in Energy Research, vol.13, art.1738311
doi: 10.3389/fenrg.2025.1738311
pdf_status: have
paper_type: method
target_system: 일반
control_scheme: [GFM, VSG]
model_order: 12
analysis_method: [eigenvalue, impedance-based]
tuning_method: PSO
scr_range: "미명시 (CSCR 예측 대상)"
xr_range: 미명시
validation_level: sim-only
hardware: [MATLAB]
extraction_depth: full
section: "§I 서론, §II 관련연구, §V 4중 차별화"
tags: [paper, GFM, small-signal, CSCR, PSO, SVR, Dong2026, comparison]
status: noted
---

# 📌 Brief Summary

▸ GFM 컨버터의 임계 단락비(CSCR)를 온라인으로 예측하는 PSO-SVR 하이브리드 모델 제안.  
▸ 12차 소신호 상태공간 모델 기반, 소프트웨어 검증 R²=0.9854.  
※ **본 연구의 핵심 비교 대상 [2]** — 4중 차별화 기준점.

---

## 📖 Core Content

▸ **전체 인용:**  
W. Dong, Y. Cheng, Y. Yang, F. Zhang, B. Wang, G. Wang, "Small-signal stability assessment method based on online prediction of the critical short-circuit ratio for grid-forming converters," *Front. Energy Res.*, vol.13, art.1738311, Feb. 2026.

▸ **핵심 기여:**
- GFM 소신호 상태공간 모델 수립 (12차)
- PSO로 SVR 하이퍼파라미터(C, ε, γ) 3개 최적화
- 온라인 CSCR 예측 모델 제안
- σ(최소 고유값 실수부) > 0 → 안정 판정 기준 사용

▸ **방법:**
- 상태변수: VSG 제어 + AC 전압 외루프-전류 내루프 = **12차 (이상적 DC 버스 가정)**
- PSO: SVR 하이퍼파라미터 C, ε, γ 3개 최적화 (GFM 제어이득 직접 최적화 아님)
- 모델: PSO-SVR 하이브리드

▸ **검증:**
- 소프트웨어(MATLAB) 시뮬레이션만
- R² = **0.9854** (예측 정확도)
- 하드웨어/CHIL 검증 없음

▸ **주요 수치:**

| 항목 | 값 |
|---|---|
| 모델 차수 | **12차** (이상적 DC 버스) |
| PSO 최적화 대상 | SVR 하이퍼파라미터 3개 (C, ε, γ) |
| 검증 방법 | 소프트웨어 (R²=0.9854) |
| SCR 경계 | 단일 CSCR 수치 (1D) |
| DC-AC 커플링 | ❌ 미반영 |

▸ **저자가 밝힌 한계:**
- 이상적 DC 버스 가정 → DC 동특성 미반영
- 소프트웨어 검증만 → 실계통 적용성 미확인
- 단일 CSCR (1D) → X/R 영향 미분석

---

## 🔗 Knowledge Connections

* **Related Topics:** GFM-SmallSignal, CSCR, PSO-SVR, Online-Stability
* **Projects/Contexts:** PV-GFM-Thesis
* **Claims:**
  [[claim-dclink-dynamics-matter-during-faults]]
  [[claim-rms-inadequate-at-high-ibr]]

---

## ✍️ My Take

**인용 우선순위: ⭐⭐⭐ 높음 (핵심 비교 대상)**

※ **4중 차별화 (표 6-3) 기준점:**

| 차별화 축 | Dong 2026 | 본 연구 |
|---|---|---|
| 모델 차수 | **12차** (이상적 DC) | **21차** (DC-AC 커플링) |
| PSO 역할 | SVR 하이퍼파라미터 **3개** | GFM 제어이득 **14개** 직접 |
| 검증 방법 | 소프트웨어 R²=0.9854 | **RTDS CHIL ≥95%** |
| SCR 경계 | 단일 CSCR **(1D)** | SCR*(X/R) **2D 곡면** |

※ **인용 자리:**
- §I 서론: "기존 연구의 한계" 대표 사례
- §II 관련연구: 비교 테이블의 핵심 행
- §V 결과: 4중 차별화 수치 비교

※ **공격 포인트 (본 연구가 더 나은 점):**
1. DC-AC 커플링 A_k(9,6) 누락 → [7]Zhao 이론으로 공격
2. PSO가 GFM 제어이득 직접 최적화 아님 → 차별화 핵심
3. CHIL 없음 → [9]IEEE Std. 2004-2025로 공격
4. 1D CSCR → [3]Ganguly로 공격

※ **주의:** "PSO를 썼다"는 같은데 역할이 완전히 다름  
→ 논문에서 반드시 명확히 구분해서 서술할 것

---

## 🔗 연결 노트

- [[DC-AC 커플링]] — 12차 이상적 DC의 한계 근거
- [[야코비안 행렬]] — 21차 vs 12차 구조 비교
- [[PSO 이중수렴기준]] — PSO 역할 차이
- [[88포인트 2D 스윕 설계]] — 1D vs 2D 비교
- [[Salem 2025 GFM Review]] — 연관 리뷰
- [[Zhao 2023 Aalborg]] — DC 커플링 공격 근거
- [[Ganguly 2025 preprint]] — 1D 한계 공격 근거
- [[Phase02 완료]] — A_k(9,6) 차별화 검증
