---
cite_key: salem2025gfmreview
ref_num:
title: "Grid Forming Converters for Low Inertia Systems-Capabilities and Limitations: A Critical Review"
authors:
  - Q. Salem
  - B. Bany Fawaz
  - R. Aljarrah
  - M. Karimi
corresponding: Mazaher Karimi
year: 2025
venue: IEEE Open J. Ind. Electron. Soc., vol.6, pp.775-801
doi: 10.1109/OJIES.2025.3566213
pdf: "[[salem2025gfmreview]]"
pdf_status: oa-available
paper_type: review
target_system: 일반
control_scheme:
  - droop
  - VSG
  - VSM
  - synchronverter
  - VOC
  - dVOC
  - matching
model_order: N/A(리뷰)
analysis_method:
  - eigenvalue
  - phase-portrait
  - Lyapunov-direct
  - matrix-perturbation
  - geometrical-2D
  - impedance-based
tuning_method: N/A(리뷰)
scr_range: SCR<1 ~ SCR=50 (인용 문헌 전체 범위)
xr_range: 미명시
validation_level: none
hardware: []
extraction_depth: full
section: Introduction, Related Work
tags:
  - paper
  - GFM
  - review
  - small-signal
  - transient-stability
  - FRT
status: read
---

# 📌 Brief Summary

GFM 컨버터가 GFL을 어느 수준까지 대체할 수 있는지를 문제의식으로 삼아, 제어방식 분류부터
소신호·과도·사고후 안정도, 계통강도별 성능, FRT까지 표로 정리한 비판적 리뷰.
CC BY 4.0 오픈액세스.
서론의 GFM 필요성 논거와 **관련연구 분류체계**의 뼈대로 쓸 자리가 있다.

# 📖 Core Content

▸ 전체 인용: Q. Salem, B. Bany Fawaz, R. Aljarrah, and M. Karimi, "Grid Forming
  Converters for Low Inertia Systems-Capabilities and Limitations: A Critical Review,"
  *IEEE Open J. Ind. Electron. Soc.*, vol. 6, pp. 775–801, 2025.

▸ 핵심 기여: GFM 제어를 **droop 계열**과 **SM 모방 계열**(VSG/synchronverter/VOC)로 이분하고,
  각 방식의 구조·개선안·한계를 Table 2~6에 정리. 이어 안정도를 소신호(Table 7),
  과도(Table 8), 사고후 회복(Table 9)으로 나눠 선행연구 매트릭스를 제공.
  마지막에 기존 리뷰들과의 차이를 Table 10으로 비교.

▸ 방법: 문헌 개괄 + 비교표. 자체 모델링·시뮬레이션·실험 없음.

▸ 검증: 없음 (리뷰). 인용된 결과는 모두 타 문헌.

▸ 주요 수치:
  - **강/약계통 경계: SCR 3** (SCR>3 강계통, SCR<3 약계통) — [152],[153] 인용
  - 과전류 공급 능력: 동기기 5–7 p.u. vs 인버터 최대 2 p.u. — [169] 인용
  - 영국 GFM 사양 초안 — [171] 인용
    · 전압원 동작 주파수 대역 5 Hz–1 kHz (사고 전·중·후)
    · 단락전류 기여 1.5 p.u.
    · 전압 dip 시 크기·주파수·위상을 사고 전 값으로 유지, 기준 0.85 p.u.
    · 무효전력 주입 5 ms 이내
    · 불평형 전류 2%까지 흡수
  - 안정도 마진 확보에 필요한 GFM 용량비 약 17.8% 또는 21.4% — [162] 인용
    (전 컨버터를 GFM으로 운전할 필요 없음)
  - 적응형 하이브리드 GFL/GFM 동작 범위 SCR 1~50 — [165] 인용
  - 초강계통 SCR 30 초과에서의 전력 결합 완화 — [158] 인용
  - dVOC 기반 GFM의 SCR<1 초약계통 운전 — [105] 인용

▸ 저자가 밝힌 한계:
  - GFM 실계통 적용 사례가 연구상 여전히 제한적
  - 비의도적 단독운전(unintentional islanding) 연구가 희소
  - GFM의 최적 설치 위치·대수 문제 미해결

# 🔗 Knowledge Connections

* Related Topics: Section I — Introduction, GFM-Control-Taxonomy,
  Small-Signal-Stability, Grid-Strength-SCR, FRT
* Projects/Contexts: PV-GFM-Thesis

# ✍️ My Take

※ 차별점 — Table 7(소신호 안정도)은 해석 **기법** 나열에 그치고 파라미터 최적화 축이 없다.
  SCR도 인용된 연구마다 단일 값으로만 등장하며 X/R을 함께 스윕한 사례가 보이지 않는다.
  다만 리뷰 한 편으로 "없다"를 주장하면 안 된다 — [115], [114] 원문을 확인한 뒤 서술할 것.

※ 인용 자리:
  - 서론: 저관성·계통강도 저하, GFL의 한계(PLL 진동, 계통강도 저하, 블랙스타트 불가, 감쇠 저하)
  - 관련연구: GFM 제어 분류체계(droop vs SM 모방)의 뼈대
  - 검증조건: SCR 3 경계, FRT 요구치(0.85 p.u., 5 ms, 1.5 p.u.)

※ 전략적 배치 이유: (입력 필요)

※ 그대로 못 쓰는 이유:
  - 리뷰이므로 1차 데이터·모델식이 없음. 개별 결과는 반드시 원논문을 인용할 것
  - 이 노트의 수치 대부분이 `[번호] 인용` 표기가 붙어 있다 = 이 논문의 결과가 아니다

※ 미확인 항목 — 추적할 원논문:
  - **[115] Yu et al. (2022), IEEE TIE** — 선로 임피던스 변동을 2D 평면에 사상해 소신호 동기화
    안정 경계를 기하학적으로 식별. **SCR–X/R 2D 강건성 경계와 가장 직접적인 선행연구. 최우선**
  - **[114] Ji et al. (2024), Energies** — GFL·GFM 혼재 인버터의 소신호 안정도.
    전차수 상태공간 + 고유치. 모델 차수 근거
  - **[94] Welmilla et al. (2024)** — Lyapunov 에너지 함수로 VSM의 관성·감쇠 계수 선정.
    PSO 튜닝 대비 baseline
  - **[90] Guo & Wu (2025), JMPCE** — DC 전압 동특성을 개선한 GFM PV용 matching SM 제어.
    2단 PV 구조에서 DC단을 다룬 드문 연구
  - **[162] Xin et al. (2025), IEEE TPWRS** — 필요한 GFM 용량비 산정. 서론 논거
  - **[122] Pan et al. (2020), JESTPE** — 4종 GFM 제어의 설계지향 과도 안정도 비교
  - **[171] Rosso et al. (2021), IEEE TIA** — 영국 GFM 사양 초안의 정량 요구조건 출처

## 🔗 연결 노트
- [[zhan2024industrial]]
