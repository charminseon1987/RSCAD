---
cite_key: kenyon2020ibrstability
ref_num: null
title: "Stability and control of power systems with high penetrations of inverter-based resources: An accessible review of current knowledge and open questions"
authors: [R. W. Kenyon, M. Bossart, M. Marković, K. Doubleday, R. Matsuda-Dunn, S. Mitova, S. A. Julien, E. T. Hale, B.-M. Hodge]
corresponding: Bri-Mathias Hodge
year: 2020
venue: Solar Energy, vol.210, pp.149-168
doi: 10.1016/j.solener.2020.05.053
pdf: "[[kenyon2020ibrstability.pdf]]"
pdf_status: have
paper_type: review
target_system: 일반
control_scheme: [grid-following, grid-supporting, grid-forming, droop, VSM, VOC]
model_order: N/A(리뷰)
analysis_method: [eigenvalue, participation-factor, impedance-based, RMS-simulation, EMT-simulation]
tuning_method: N/A(리뷰)
scr_range: 미명시
xr_range: 미명시
validation_level: none
hardware: []
extraction_depth: full
section: Introduction, Methodology
tags: [paper, IBR, review, grid-forming, small-signal, EMT, NREL]
status: read
---

# 📌 Brief Summary

IBR(인버터 기반 자원)이 동기기 중심으로 설계된 계통의 사이클~초 단위 동특성을 어떻게 바꾸는지를
비전문가도 읽을 수 있게 정리한 교육적 리뷰. NREL·CU Boulder 공동 저작.
전력전자 기초부터 안정도 분류, EMT/RMS 시뮬레이션 선택까지 다룬다.
서론의 IBR 침투 문제 제기와, **방법론에서 EMT 해석을 택한 근거**로 인용할 자리가 있다.

# 📖 Core Content

▸ 전체 인용: R. W. Kenyon et al., "Stability and control of power systems with high
  penetrations of inverter-based resources: An accessible review of current knowledge
  and open questions," *Solar Energy*, vol. 210, pp. 149–168, 2020.

▸ 핵심 기여: 종합 리뷰가 아니라 **교육 목적의 개괄**임을 저자가 명시. IBR과 동기기(SMC)의
  물리적 차이 → 안정도 3영역(회전자각/주파수/전압)에 미치는 영향 → 시뮬레이션 방법론 변화
  순서로 서술하고, 각 영역의 미해결 질문을 마지막에 정리.

▸ 방법: 문헌 개괄 + 개념 설명. 자체 모델링이나 실험 없음.

▸ 검증: 없음 (리뷰). 인용된 결과는 모두 타 문헌.

▸ 주요 수치:
  - IBR 응답시간 0.5–5 ms vs 동기기 조속기 응답 0.5 s 이상 (Yazdani & Iravani, 2010 인용)
  - IBR 과전류: 정격의 2배를 약 1 ms 동안 (Keller et al., 2011 인용) /
    지속 가능 수준은 정격의 110–120%
  - 동기기 단기 과전류: 정격의 4–7배 (Winternheimer et al., 2015 인용)
  - IBR 과전류 제한값 통상 1.2–1.5 p.u. (§3.2.2)
  - droop 기울기 통상 4–5% (§3.1.2)
  - ERCOT 2018: 연간 에너지 침투율 19%, 순시 전력 침투율 최고 55%
  - EirGrid 순시 침투율 상한 65% (안정도 우려, Milano et al., 2018 인용)
  - PLL 동특성 포함 시 IBR 침투 약 50%까지 안정, PLL 우회 시 약 80%
    (Lin et al., 2017 인용) — **GFM 필요성 논거로 유용**
  - RMS 시뮬레이션 시간스텝 통상 1/4 사이클(약 4 ms), EMT는 5–50 μs
  - IBR 침투율 30% 초과 시 정상상태 전압 변화가 침투율의 2차 함수로 증가
    (Eftekharnejad et al., 2013 인용)
  - 배전 피더 hosting capacity 통상 약 15% (Ding et al., 2016 인용)
  - SCR 정의: SCR = S_SCMVA / P_RMW (식 3). **강/약계통 경계값은 이 논문에 없음**
  - X/R: 배전망은 X/R이 낮아 Q–V 결합이 약하다는 정성적 서술만. 수치 없음

▸ 저자가 밝힌 한계:
  - 종합 리뷰가 아니며 계통 보호 등 일부 단시간 현상을 의도적으로 제외했다고 명시
  - 실증 규모에서 검증되지 않은 기술은 "미해결 질문"으로 분류

# 🔗 Knowledge Connections

* Related Topics: Section I — Introduction, IBR-Penetration, Small-Signal-Stability,
  EMT-vs-RMS, DC-Link-Dynamics
* Projects/Contexts: PV-GFM-Thesis
* Claims:
  [[claim-pll-limits-gfl-penetration]],
  [[claim-rms-inadequate-at-high-ibr]],
  [[claim-dclink-dynamics-matter-during-faults]],
  [[claim-gfm-tuning-is-operating-point-dependent]]

# ✍️ My Take

※ 차별점 — **이 논문이 미해결로 남긴 것이 곧 내 기여다.** 결론의 Control 항목에서
  GFL 지원 기능의 적절한 튜닝은 계통 운전상태에 따라 달라지므로 새롭고 적응적인 튜닝
  절차가 필요하다고 명시한다. 다중 운전점 PSO 튜닝이 정확히 이 지점을 겨눈다.
  또한 §5.3.3에서 대부분의 RMS 시뮬레이션이 DC단 동특성을 무시해 오차를 낳는다고 지적하는데,
  2단 PV+ESS 구조는 DC단이 해석의 중심이므로 EMT/CHIL 채택 근거로 직접 쓸 수 있다.

※ 인용 자리:
  - 서론: IBR 침투에 따른 관성·계통강도 저하, 순시 침투율과 연간 침투율의 괴리
  - 서론/연구동기: PLL 기반 GFL의 침투율 한계(50% vs 80%) → GFM 전환 필요성
  - 연구방법: EMT를 택한 근거(RMS 시간스텝 4 ms vs EMT 5–50 μs, 고침투 시 RMS 가정 붕괴)
  - 연구방법: DC단 동특성을 모델에 포함해야 하는 근거

※ 전략적 배치 이유: (입력 필요)

※ 그대로 못 쓰는 이유:
  - 리뷰이며 저자 스스로 교육 목적임을 밝힘. 1차 데이터·모델식 없음 → 개별 수치는 원논문 인용
  - 2020년 논문이라 이후 GFM 제어(dVOC 확장, FRT, 전류제한) 발전이 반영되지 않음.
    최신 상태는 [[salem2025gfmreview]]로 보완할 것
  - Elsevier 저작권. NREL 공동저작이므로 accepted manuscript가 OSTI/NREL에 있을 가능성 있음

※ 미확인 항목 — 추적할 원논문:
  - **Markovic et al. (2018)** — GFL·GFM 양쪽의 상태공간 모델 구축, 제어기 설정이 안정도 마진에
    크게 영향. 내 소신호 모델의 직접 선행연구. 최우선
  - **Pogaku et al. (2007)** — 인버터 기반 마이크로그리드의 모델링·해석·시험.
    소신호 상태공간 모델의 표준 참조. 차수 설정 근거로 필요
  - **Qoria et al. (2018), MIGRATE D3.2** — GFM 운전 IBR의 상세 상태공간 모델.
    표준 안정도 해석 도구가 100% IBR 계통에서 불충분하다는 결론
  - **Lin et al. (2017)** — PLL 동특성 유무에 따른 안정 침투율 비교(50% vs 80%)
  - **Shah et al. (2018)** — PCC에서 IBR 임피던스와 계통 임피던스 비교, 임피던스 기반 안정도 지표
  - **Eto et al. (2020), NREL Research Roadmap on Grid-Forming Inverters** — 서론 정책·기술 로드맵
  - **Matevosyan et al. (2019)** — GFM이 고침투의 열쇠인가, IEEE Power Energy Mag. 서론용
