# 최신 GFM 논문 — 2025~2026 우선 검색

작성: 2026-10-14 · `paper-searcher` · 2차 검색
이전 검색 결과: `corpus_gap_candidates.md` (같은 날). **그 문서에 올린 논문은 전부 제외했다.**

**검색 경로**: Elicit 은 이 계정 플랜에서 `api_access_denied` 라 쓰지 못했다.
**OpenAlex** 읽기 전용 질의(`from_publication_date` 필터, 의미검색 + `title_and_abstract.search`
키워드 필터)와 **alphaXiv**(의미검색 1회 + 본문 조회 1건)를 썼다.
`tools/paper_agent.py` 는 볼트를 쓰고 PDF 를 받으므로 쓰지 않았다. PDF 는 한 건도 내려받지 않았다.

**읽은 범위**: 아래 표에서 「본문」이라고 표시한 **1편(arXiv 2608.25250)만 본문을 읽었다.**
나머지는 **초록 + 서지정보만** 확인했다. 제목·게재지만 본 항목은 그렇게 따로 적었다.
본문을 안 본 항목에 "이 논문은 X 를 한다"고 단정하지 않았다.

**중복 제외 기준**: 현재 말뭉치 `papers/` 12편 + `literature/` 노트 12편(`Chen_2024_Electronics`,
`Dong_2026_GFM_SVR`, `Ganguly_2025_preprint`, `qu2025industrial`, `zhan2024industrial`,
`Zhao_2023_Aalborg`, `pawar2021gfcpv`, `salem2025gfmreview` 등) + `corpus_gap_candidates.md`
의 후보 12편. 검색 중 재등장한 것은 아래에 「이미 보유」로 따로 묶었다.

---

## 사용 검색식 (18개)

OpenAlex 의미검색 (`from_publication_date:2025-01-01`):

1. `grid-forming inverter small-signal stability state-space eigenvalue participation factor analysis`
2. `grid-forming converter small-signal model eigenvalue participation factor weak grid 2025`
3. `grid-forming inverter low X/R ratio resistive grid stability boundary short circuit ratio`
4. `effect of grid impedance angle R/X ratio on grid-forming converter small signal stability region distribution network`
5. `grid-forming droop control low voltage resistive distribution feeder high R/X ratio stability limit eigenvalue`
6. `virtual synchronous generator stability under resistive inductive line impedance ratio variation microgrid power coupling`
7. `grid-forming converter synchronization stability resistive grid impedance ratio critical short circuit ratio boundary map`
8. `grid-forming inverter robustness region grid strength variation parameter design margin SCR sweep damping ratio`
9. `grid-forming inverter stability analysis under high R/X low X/R ratio weak distribution grid eigenvalue small signal 2026`
10. `two-stage PV battery energy storage shared DC link grid-forming inverter control DC link voltage`
11. `photovoltaic energy storage grid-forming converter common DC bus two-stage topology small-signal stability`
12. `particle swarm optimization tuning grid-forming converter control parameters small-signal stability damping ratio eigenvalue constraint`
13. `metaheuristic optimization virtual synchronous generator inertia damping parameter tuning multi-objective 2025`
14. `PSO optimized grid-forming inverter droop gain virtual inertia robust tuning across short circuit ratio range`
15. `controller hardware-in-the-loop CHIL grid-forming inverter RTDS loop delay compensation validation`
16. `real-time simulation grid-forming converter hardware in the loop interface delay compensation cross-validation EMT model`
17. `grid-forming inverter grid code requirements specification IEEE 2800 standard compliance testing transmission system operator`
18. `grid-forming converter review 2026 state of the art challenges roadmap deployment`

OpenAlex **키워드 필터**(`from_publication_date:2024-01-01`) — **축 2 의 결정적 수확은 여기서 나왔다**:

- `title_and_abstract.search:"X/R" AND grid-forming` → 54편
- `title_and_abstract.search:"R/X" AND grid-forming` → 41편
- `title_and_abstract.search:"impedance angle" AND grid-forming` → 11편

alphaXiv 의미검색 1회 (키워드: grid-forming / small-signal stability / SCR / X/R ratio /
stability boundary / PSO / CHIL / RTDS / PV / energy storage / virtual synchronous machine,
`published_after 2025-01-01`, `prioritize recency`).

---

## 축 1 — GFM 소신호 안정도 (상태공간·고유값·참여계수)

| # | 제목 | 1저자 | 연도 | 게재지 | DOI | 공개 PDF | 왜 이 축인가 | 관련도 |
|---|---|---|---|---|---|---|---|---|
| 1-1 | Small-Signal Stability Assessment of Grid-Forming Converters Under Varying Grid Conditions | H. Jaffal (RWTH Aachen) | 2025 | IEEE PES ISGT Europe 2025, pp. 1–5 | `10.1109/isgteurope64741.2025.11305321` | **없음 — 도서관 경유** | 초록 기준: GFM 상태공간(외부루프+내부 전압/전류루프+필터+계통)을 선형화해 고유값·**참여계수** 해석, EMT 로 교차검증. 내부 전압루프 비례이득을 줄이면 불안정해진다고 보고 | 상 |
| 1-2 | Comprehensive Design, Modeling and Analysis of Grid-Forming Type IV Wind Turbine Generators Using State-Space Methods | H. E. Udawatte (Monash) | 2025 | IEEE Access, 13, 91089–91112 | `10.1109/access.2025.3572885` | **gold OA** (DOI 경유) | 초록 기준: component connection method 로 통합 상태공간 구성 → 고유값·참여계수·민감도 + 축소차수 모델. MSC 가 DC링크 전압을, GSC 가 VSG 를 맡는 **2단 분담** 구조 | 상 |
| 1-3 | Small Signal Stability Analysis of GFM and GFL Inverters Hybrid System with Three Typical Grid Topology Structures | X. Niu | 2025 | Sustainability, 17(11), 5137 | `10.3390/su17115137` | **gold OA** | 초록 기준: full-order 상태공간에서 고유값·**감쇠비·참여계수·민감도 지표**를 뽑아 GFL/GFM 혼합계를 계통 토폴로지 3종으로 비교 | 중상 |

---

## 축 2 — SCR–X/R 강건성 경계, 특히 낮은 X/R ★ 신규성에 직접 영향

| # | 제목 | 1저자 | 연도 | 게재지 | DOI | 공개 PDF | 왜 이 축인가 | 관련도 |
|---|---|---|---|---|---|---|---|---|
| 2-1 | Impact of Grid Strength on the Transient Dynamics of Droop- and VSM-Based Grid-Forming Converters | Q. Salem (+ R. Aljarrah) | 2026 | Int. Trans. Electrical Energy Systems, 2026(1) | `10.1155/etep/6807672` | **gold OA** (Wiley) | 초록 원문: *"X/R is changed from 0.1 to 10 to simulate resistive, balanced, inductive, and highly inductive networks"* — SCR 과 X/R 로 **파라미터화한 통합 계통모델**. **X/R 1.0~1.5 가 이 범위 안에 완전히 들어간다** | **상(최상)** |
| 2-2 | Analysis and Mitigation of Power Coupling in Grid Forming Converter Under Different X/R Ratios | I. Hong (한국 저자군, S. Jung·Y. Yoo 공저) | 2026 | IEEE CPEEE 2026, pp. 180–184 | `10.1109/cpeee69412.2026.11521625` | **없음 — 도서관 경유** | 초록 원문: *"distribution systems typically exhibit a lower X/R ratio ... introduce interference between the active power control loop and the voltage control loop"* — **낮은 X/R 을 명시적으로 겨냥**하고, P·Q 출력을 **계통 임피던스 각의 함수**로 전개해 전력결합계수를 유도 | **상** |
| 2-3 | A Tight Grid-Forming Control Framework for Grid-Connected Inverters Under Large Grid Frequency Drops With Wide Range of SCR and X/R | X. Niu | 2025 | IEEE Trans. Power Electron., 41(5), 8242–8255 | `10.1109/tpel.2025.3643503` | **없음 — 도서관 경유** | 제목·초록이 **"wide range of SCR and X/R"** 을 전면에 건다. 다만 초록상 기여는 전압 상태관측기 기반 제어기이고 고유값 경계 작도는 언급이 없다 | 상 |

### 축 2 보조 — 같은 벡터의 2025~2026 논문이 더 있다 (전부 초록만)

| 제목 | 1저자 | 연도 | 게재지 | DOI | PDF | 비고 |
|---|---|---|---|---|---|---|
| Fast Active Power Recovery for Grid-Forming Converter During Postfault Under Different R/X Ratios of Grid Impedance | C. Wu (+ F. Blaabjerg) | 2025 | IEEE TIE, 72(10), 10130–10140 | `10.1109/tie.2025.3549109` | 유료 (AAU VBN 레코드는 비공개) | 인용 8. *"power angle would shift a lot during grid faults with a large R/X ratio"* |
| Optimized Power Decoupling Control for Grid-Forming Converter Under Different R/X Ratios of Grid Impedance | D. Zhu | 2025 | IEEE TCAS-II, 72(12), 2052–2056 | `10.1109/tcsii.2025.3599886` | 유료 | 인용 5 |
| Dynamic Response of Droop-Controlled Grid-Forming Inverters Under Varying Grid Impedances for Enhanced Stability in Microgrids | M. W. Ullah (AAU, Guerrero 그룹) | 2025 | Applied Sciences, 15(23), 12562 | `10.3390/app152312562` | **gold OA** | 초록 기준 **유도성·저항성·비선형 임피던스**를 약/강 계통에서 비교. 단 MATLAB/Simulink **시간영역**이고 고유값 해석이 아니다 |
| Analysis and Enhancement of Static and Dynamic Power Transfer Limits of Grid-Forming Energy Storage Converter Under Ultra-Weak Grids | J. Wang (+ Blaabjerg) | 2026 | IEEE Trans. Power Electron., 41(8), 13607–13619 | `10.1109/tpel.2026.3665555` | **green OA** (AAU VBN 저자원고) | *"SPTL exhibits asymmetry ... primarily attributed to grid resistance"* — **계통 저항**이 GFM-ESS 전력전달 한계를 비대칭으로 만든다 |
| A Current-Limiting Strategy for Grid-Forming Converters under Varying Line Reactance-to-Resistance Ratios | Y. Guo | 2026 | IPEC-Nagasaki 2026 | `10.23919/ipec-nagasaki2026-ec64663.2026.11597286` | 유료 | 제목·서지만 확인 |
| Analysis of Active Power Transfer Limit of Grid-Forming Converters Considering Resistive-Inductive Grid | W. Wang | 2026 | Lecture Notes in Electrical Engineering | `10.1007/978-981-92-0497-7_10` | 유료 | 제목·서지만 확인 |

---

## 축 3 — PV+ESS 2단(공유 DC 링크) GFM

| # | 제목 | 1저자 | 연도 | 게재지 | DOI | 공개 PDF | 왜 이 축인가 | 관련도 |
|---|---|---|---|---|---|---|---|---|
| 3-1 | Adaptive Control of Inertia and Damping in Grid-Forming Photovoltaic-Storage System | Z. Zhao (Hohai) | 2025 | Sustainability, 17(21), 9540 | `10.3390/su17219540` | **gold OA** | 초록 원문: *"photovoltaic power is boosted through a DC-DC converter, and the energy storage is connected to the common DC bus through a bidirectional DC-DC converter"* — **구성이 이 연구와 정확히 같다**. J·D 협조 적응제어(tanh) | **상** |
| 3-2 | Optimal Operation of Grid-Forming-Controlled PV and Energy Storage Converters in Low-Voltage Distribution Networks | X. Zhou | 2026 | Energies, 19(15), 3647 | `10.3390/en19153647` | **gold OA** | 초록 기준: **LVDN 의 GFM PV+ESS** 수학모델 + 혼돈 PSO 계층 다목적 최적화 + **HIL 실험**. 축 3·4·5 를 한꺼번에 건드린다. 단 목적함수가 전압편차·발전량·손실이라 **제어이득 튜닝이 아니라 운영 최적화**다 | 상 |
| 3-3 | A Study on the Device Topology and Control Strategy of a Hybrid Three-Port Photovoltaic Energy Storage Grid-Connected Converter | S. Chen | 2025 | Electronics, 14(10), 1966 | `10.3390/electronics14101966` | **gold OA** | **제목·서지만 확인했다.** 3포트(PV·ESS·계통) 구성이라 공유 DC 링크 축에 걸릴 가능성이 높으나 GFM 여부는 확인하지 못했다 | 중 (`미검증`) |

---

## 축 4 — 메타휴리스틱(PSO 등) 기반 GFM 제어 파라미터 최적화

| # | 제목 | 1저자 | 연도 | 게재지 | DOI | 공개 PDF | 왜 이 축인가 | 관련도 |
|---|---|---|---|---|---|---|---|---|
| 4-1 | Certified Stability-Region Identification for Inner-Loop Tuning of Grid-Forming Inverters | A. Selim (+ Gab-Su Seo, NREL · Junbo Zhao, UConn) | 2026 | SSRN preprint | `10.2139/ssrn.7416918` | **green OA** (SSRN) | 초록 원문: *"Tests across several short-circuit ratio (SCR) values show that the verified region changes nonmonotonically with grid strength"* + *"The hardware-in-the-loop record confirms real-time execution"*. 전압루프 PI 이득의 **연결된 안정영역을 인증**하고 그 안에서 Bayesian 최적화. **축 1·2·4·5 를 한 편에 묶는다** | **상(최상)** |
| 4-2 | A Newton–Raphson-Based Optimizer for PI and Feedforward Gain Tuning of Grid-Forming Converter Control in Low-Inertia Wind Energy Systems | M. Gafar | 2026 | Sustainability, 18(2), 912 | `10.3390/su18020912` | **gold OA** | 초록 기준: GFM PI·피드포워드 이득을 NRBO 로 튜닝하고 **DE·PSO·PPO·EDO 와 직접 비교해 NRBO 가 더 낫다**고 보고 | 상 |
| 4-3 | Hybrid PSO–Reinforcement Learning-Based Adaptive Virtual Inertia Control for Frequency Stability in Multi-Microgrid PV Systems | A. B. Akinwola | 2025 | Electronics, 14(17), 3349 | `10.3390/electronics14173349` | **gold OA** | 제목·서지만 확인. PSO+RL 로 가상관성을 적응 조정. 인용 9. **주파수 안정도**가 목적이고 소신호 고유값 제약은 확인하지 못했다 | 중 (`미검증`) |

---

## 축 5 — CHIL/RTDS 검증, 루프 지연 보상·교차검증

| # | 제목 | 1저자 | 연도 | 게재지 | DOI | 공개 PDF | 왜 이 축인가 | 관련도 |
|---|---|---|---|---|---|---|---|---|
| 5-1 | Power Hardware-in-the-Loop for Electrical Systems: From Research Experience to Guidelines for Industrial Testing | G. De Carne (KIT) · **S. D'Arco 공저** | 2026 | IEEE Open J. Power Electron., 7, 822–842 | `10.1109/ojpel.2026.3666762` | **gold OA** + KIT green 사본 | 초록 기준: PHIL 시스템을 **어떻게 설계·검증·운용할지** 실무 가이드라인. A7(`chil_if_spec.md`)·A9(`xval_protocol.md`) 의 근거 후보. 인용 5 | 상 |
| 5-2 | Power Hardware-in-the-loop Interfacing via H∞ Model Matching | J. Eid (McGill) | 2025 | arXiv 2511.08370 | `10.48550/arxiv.2511.08370` | **arXiv 공개** | 초록 기준: PHIL 인터페이스를 **투명도(transparency)를 명시적 주파수영역 목적**으로 둔 H∞ 모델매칭으로 설계. ITM 대비 실험 검증. **인터페이스 지연·정확도** 축의 최신판 | 중상 |
| 5-3 | Innovative Testbed Configurations and Interfacing Techniques for Real-Time Digital Simulation of Cyber-Physical Energy and Power Systems | A. H. Dabashi (Brunel) | 2026 | Electronics, 15(16), 3705 | `10.3390/electronics15163705` | **gold OA** | 초록 기준: HYPERSIM/OPAL-RT·Typhoon HIL 인터페이싱 방식 비교 + **통신 지연 영향** 포착. GFM 전용은 아니다 | 중 |

---

## 축 6 — 2025~2026 에 판을 바꾼 것 (표준·사양·서베이)

| # | 제목 | 1저자 | 연도 | 게재지 | DOI | 공개 PDF | 왜 중요한가 | 관련도 |
|---|---|---|---|---|---|---|---|---|
| 6-1 | **UNIFI Specifications for Grid-Forming Inverter-Based Resources: Version 3** | B. Kroposki (UNIFI Consortium / NREL) | 2026-03 | DOE/OSTI 기술보고서 (UNIFI-2026-2-1) | `10.2172/3016250` | **OSTI 즉시 공개** | GFM IBR 의 **벤더 중립 요건**을 계통레벨·인버터레벨로 정의하는 사실상 기준문서. 아래 6-2 가 이것을 `[15]` 로 인용한다 | **상(최상)** |
| 6-2 | Dynamic droop specifications for Grid-Forming Inverter-Based Resources | J. T. Bui, D. Groß (UW-Madison) · D. Ramasubramanian (EPRI) | 2026-08 | arXiv 2608.25250 (eess.SY) | `10.48550/arxiv.2608.25250` | **arXiv 공개** | **본문을 읽었다.** 정상주파수 이하 IBR 소신호 응답을 **동적 드룹계수** `m_P(j2πf_p)`·`m_Q(j2πf_p)` 로 완전히 규정하고 이득·위상 경계를 GFM 최소요건으로 제시. OEM 모델 2종 스캔, Kaua'i 18–20 Hz 진동 사례. 임피던스 모델과 **상보적**임을 §II-D 에서 논증 | **상(최상)** |
| 6-3 | Functional specifications and testing requirements for grid-forming offshore wind power plants | S. Ghimire (DTU/Siemens Gamesa) | 2025 | Wind Energy Science, 10(1), 1–15 | `10.5194/wes-10-1-2025` | **Copernicus OA** | 여러 TSO 그리드코드·백서의 GFM 기능사양과 **시험요건**을 OEM 관점에서 종합. 인용 8 | 상 |

### 축 6 보조

| 제목 | 1저자 | 연도 | 식별자 | PDF | 비고 |
|---|---|---|---|---|---|
| Global Survey of Technologies and Industrial Applications of Grid Forming Energy Storage Systems | H. Wu (+ Xiongfei Wang) | 2026 | arXiv 2607.15680 | **arXiv 공개** | **CIGRE WG B4.101** 글로벌 설문. TSO·OEM·연구기관 간 인식 격차를 정리 |
| Quantifying Grid-Forming Requirements for System Strength: How Much and Where? | A. Gupta, B. Chaudhuri, M. O'Malley (Imperial) | 2026 | arXiv 2610.08948 | **arXiv 공개** | Jacobian Voltage Stiffness Metric 으로 GFM 소요량·위치를 정량화, 소신호 진동안정도로 검증 |
| Grid-Forming Inverters in Photovoltaic Power Systems: A Comprehensive Review of Modeling, Control, and Stability Perspectives | Y. Hakam | 2026 | Energies, 19(5), 1244 · `10.3390/en19051244` | **gold OA** | **PV 한정 GFM 리뷰.** 소신호 안정도·과도·전류제한을 축으로 droop/VSG/synchronverter/matching/VOC/MPC/FLC/ANN 비교 |

---

## 사용자 가설에 반하는 결과 (별도 제시 — 요청대로)

### ① 축 2 — "낮은 X/R(1.0~1.5) 영역은 Luo 범위 밖이라 비어 있다" 는 **더 이상 그대로 유지할 수 없다**

`NEXT.md` §0 은 Luo 의 R/X 0~30%(X/R ≥ 3.3) **밖**이 남은 차별점이라고 적었다.
이번 검색은 그 바깥을 다룬 2025~2026 논문을 **세 갈래로** 찾았다.

| 반증 | 무엇이 걸리는가 | 근거 수준 |
|---|---|---|
| **Salem & Aljarrah 2026** (ITEES, gold OA) | **X/R 을 0.1 에서 10 까지** 바꾸며 SCR(약·중약·강)과 조합한다. X/R 1.0·1.5 가 범위 한가운데다. 초록 원문: *"X/R is changed from 0.1 to 10 to simulate resistive, balanced, inductive, and highly inductive networks"* | **초록 확인** |
| **Hong et al. 2026** (CPEEE) | *"distribution systems typically exhibit a lower X/R ratio"* 를 전제로 VSG-GFM 의 P–Q 결합을 **계통 임피던스 각의 함수**로 해석 전개하고 전력결합계수를 유도 | 초록 확인 |
| **Niu (Xitong) et al. 2025** (IEEE TPEL) | 제목이 **"Wide Range of SCR and X/R"** 이다 | 초록 확인 |
| Wu 2025 TIE · Zhu 2025 TCAS-II · Guo 2026 IPEC · Wang 2026 LNEE | "different R/X ratios" 를 **제목에 건** GFM 논문이 2024 이후만 최소 4편 더 있다 | 제목·초록 |

**그래도 남는 차별점 (※ 내 판단 — 전부 본문 미확인이므로 정독 전에는 주장할 수 없다)**

- Salem & Aljarrah 는 **MATLAB/Simulink 시간영역 과도응답**(2 Hz 주파수 스텝, 60° 위상점프)을
  최대 주파수편차·정정시간으로 비교한다. **고유값·참여계수 기반 소신호 경계가 아니다.**
- Hong 2026 은 전력결합(P–Q 간섭)과 가상임피던스 보상이 주제고, 안정도 경계 작도가 아니다.
- Niu 2025 TPEL 은 초록상 기여가 **전압 상태관측기 제어기**이고 경계 작도가 아니다.
- 네 갈래 중 **PSO 공동최적화 + CHIL 검증을 같이 붙인 것은 없다.**

→ 주장을 한 단계 더 좁혀야 한다. "낮은 X/R 을 아무도 안 봤다" 는 **쓸 수 없다.**
쓸 수 있는 것은 **"낮은 X/R 영역에서 고유값 기반 소신호 경계를, PSO 로 조정한 이득과 함께,
CHIL 로 교차검증한 것"** 정도다. 그리고 그 각 조각조차 아래 ② 가 잠식한다.

### ② 축 4 — "PSO 로 조정한 이득의 SCR 강건성 경계" 도 2026 에 선행연구가 생겼다

**Selim, Seo, Zhao 2026** (`10.2139/ssrn.7416918`, NREL + UConn) 이 초록 기준으로
이 연구의 조합을 거의 그대로 겹친다.

- 전압루프 PI 이득의 **연결된 안정영역을 식별·인증**(CTARC) 한다 → "강건성 경계" 그 자체
- *"Tests across several short-circuit ratio (SCR) values"* → **SCR 스윕**
- 그 영역 안에서 **Bayesian 최적화**로 이득을 고른다 → 메타휴리스틱 자리를 차지
- *"The hardware-in-the-loop record confirms real-time execution"* → **HIL 검증**

차이로 남는 것은 (※ 내 판단) **X/R 축이 초록에 없다**는 것, 최적화기가 PSO 가 아니라
GP+Bayesian 이라는 것, 그리고 2단 PV+ESS 구성이 아니라는 것뿐이다.

덧붙여 **Gafar et al. 2026** 은 GFM 이득 튜닝에서 **NRBO 가 PSO·DE 보다 낫다**고 보고한다.
"PSO 를 썼다" 는 기여가 되지 않을뿐더러, PSO 를 고른 이유를 따로 변호해야 하는 상황이다.

### ③ 축 5 — 요청한 조합은 **2025~2026 에도 못 찾았다** (이전 검색과 같은 결론)

- 찾은 세 편(De Carne·Eid·Dabashi)은 **전부 PHIL** 이고 **CHIL 이 아니다.** 그리고 GFM 전용도 아니다.
- "루프 지연 보상 + 모델↔CHIL 교차검증 절차"를 **한 편에 담은 2025~2026 GFM 논문은 없었다.**
  이것은 공백이 열려 있다는 **긍정 신호**다 — 사용자 가설을 **지지**하는 쪽이다.
- 다만 ②의 Selim 2026 이 HIL 실시간 실행 기록을 포함한다. 그 본문이 교차검증 절차를
  어디까지 쓰는지는 확인하지 못했다.

### ④ 축 3 — "PV+ESS 공유 DC 링크 2단 GFM 구성" 은 비어 있지 않다

**Zhao et al. 2025** (Sustainability 17(21) 9540) 의 구성이 이 연구와 **문장 단위로 같다** —
PV 는 DC-DC 승압, ESS 는 양방향 DC-DC 로 **공통 DC 버스**, 그 위에 VSG. 거기에 J·D 적응제어까지 얹는다.
`NEXT.md` §3 의 eval 질의 ⑥ 이 "`two-stage` 11회가 전부 전류제한 문맥, 반증 검색 안 했다"로
남아 있었는데, **이 문서가 그 공백을 좁힌다.** 다만 Zhao 는 초록 기준 **소신호 고유값 해석이 없고**
부하투입·전압외란 시간영역 검증이다.

---

## (b) 즉시 받을 수 있는 공개 PDF — 직접 링크

**curl HEAD 로 200 + `application/pdf` 를 확인한 것** (내려받지는 않았다):

| 축 | 논문 | 직접 링크 |
|---|---|---|
| 6 | **UNIFI Specifications v3** (Kroposki, 2026) | `https://www.osti.gov/servlets/purl/3016250` |
| 6 | **Bui/Groß/Ramasubramanian 2026** 동적 드룹 사양 | `https://arxiv.org/pdf/2608.25250` |
| 6 | Ghimire 2025, Wind Energy Science | `https://wes.copernicus.org/articles/10/1/2025/wes-10-1-2025.pdf` |
| 6 | Wu 2026, CIGRE B4.101 GFM-ESS 서베이 | `https://arxiv.org/pdf/2607.15680` |
| 6 | Gupta 2026, GFM 소요량·위치 (JVSM) | `https://arxiv.org/pdf/2610.08948` |
| 5 | **De Carne 2026 PHIL 가이드라인** (KIT green 사본) | `https://publikationen.bibliothek.kit.edu/1000190878/175551939` |
| 5 | Eid 2025, PHIL H∞ 모델매칭 | `https://arxiv.org/pdf/2511.08370` |
| 2 | Wang 2026 TPEL, 초약계통 GFM-ESS 전력전달 한계 (AAU 저자원고) | `https://vbn.aau.dk/ws/files/824126857/Accepted_Author_Manuscript.pdf` |

**gold OA 지만 curl 이 403(봇차단) — 브라우저로는 열린다**:

| 축 | 논문 | 링크 |
|---|---|---|
| **2** | **Salem & Aljarrah 2026** (X/R 0.1~10) ★ | `https://onlinelibrary.wiley.com/doi/pdfdirect/10.1155/etep/6807672` |
| 2 | Ullah 2025, Applied Sciences | `https://www.mdpi.com/2076-3417/15/23/12562/pdf` |
| 3 | **Zhao 2025, 공유 DC 버스 PV-ESS VSG** ★ | `https://www.mdpi.com/2071-1050/17/21/9540/pdf` |
| 3 | Zhou 2026, LVDN GFM PV+ESS (혼돈 PSO + HIL) | `https://www.mdpi.com/1996-1073/19/15/3647/pdf` |
| 3 | Chen 2025, 3포트 PV-ESS 컨버터 | `https://www.mdpi.com/2079-9292/14/10/1966/pdf` |
| 4 | Gafar 2026, NRBO vs PSO | `https://www.mdpi.com/2071-1050/18/2/912/pdf` |
| 4 | Akinwola 2025, PSO–RL 가상관성 | `https://www.mdpi.com/2079-9292/14/17/3349/pdf` |
| 5 | Dabashi 2026, 실시간 시뮬레이터 인터페이싱 | `https://www.mdpi.com/2079-9292/15/16/3705/pdf` |
| 6 | Hakam 2026, PV-GFM 종합 리뷰 | `https://www.mdpi.com/1996-1073/19/5/1244/pdf` |
| 1 | Niu 2025, Sustainability | `https://www.mdpi.com/2071-1050/17/11/5137/pdf` |
| 1 | Udawatte 2025, IEEE Access (gold) | DOI `10.1109/access.2025.3572885` 경유 |
| 4 | **Selim/Seo/Zhao 2026** (SSRN, OpenAlex 는 OA 로 표기) ★ | `https://doi.org/10.2139/ssrn.7416918` — SSRN 다운로드 가능 여부 `미검증` |

## 유료 — 도서관 경유

| 축 | 서지 | DOI |
|---|---|---|
| 1 | H. Jaffal et al., IEEE PES ISGT Europe 2025, pp. 1–5 (RWTH 리포지터리 레코드 `RWTH-2026-00904` 있으나 OA 아님) | `10.1109/isgteurope64741.2025.11305321` |
| 2 | X. Niu et al., IEEE TPEL 41(5) 8242–8255, 2025 | `10.1109/tpel.2025.3643503` |
| 2 | I. Hong et al., IEEE CPEEE 2026, pp. 180–184 | `10.1109/cpeee69412.2026.11521625` |
| 2 | C. Wu et al., IEEE TIE 72(10) 10130–10140, 2025 | `10.1109/tie.2025.3549109` |
| 2 | D. Zhu et al., IEEE TCAS-II 72(12) 2052–2056, 2025 | `10.1109/tcsii.2025.3599886` |
| 2 | Y. Guo et al., IPEC-Nagasaki 2026 | `10.23919/ipec-nagasaki2026-ec64663.2026.11597286` |
| 2 | W. Wang et al., LNEE, 2026 | `10.1007/978-981-92-0497-7_10` |

---

## 이전 검색에서 못 받은 4편 — **새 공개 경로**

| 논문 | 이전 경로 | **이번에 찾은 새 경로** |
|---|---|---|
| **Pournazarian 2022** (IEEE TSG, 인용 76) | Aalto (Cloudflare) | **IEEE Xplore 직접 OA PDF**: `https://ieeexplore.ieee.org/ielx7/5165411/9927219/09805816.pdf` (curl 은 418 봇차단 — 브라우저로 시도) |
| **Pournazarian 2021** (IEEE Access) | Aalto (Cloudflare) | **IEEE Xplore**: `https://ieeexplore.ieee.org/ielx7/6287639/6514899/09530650.pdf` · **DOAJ**: `https://doaj.org/article/b4acaef2fdea4e32b9bcc4c75a2f7759` |
| **Luo 2024** (MedPower) | Soton eprints (Cloudflare) | **새 경로 없다.** OpenAlex 의 OA 위치는 여전히 Soton 한 곳뿐이다 |
| **NREL PESGM 2025** | Preprints.org (Access Denied) | **새 경로 없다.** 다만 `literature/Ganguly_2025_preprint.md` 가 이미 있다 → **이미 보유**로 본다 |

---

## 이미 보유 — 검색에 재등장했으나 제외한 것

| 논문 | 어디에 있나 |
|---|---|
| Dong 2026, 임계 SCR 온라인 예측 (`10.3389/fenrg.2025.1738311`) | `literature/Dong_2026_GFM_SVR.md` |
| Ganguly/Wang/Kroposki 2025 NREL 프리프린트 (`10.20944/preprints202504.1145.v1`) | `literature/Ganguly_2025_preprint.md` |
| Salem 2025 GFM 리뷰 (`10.1109/ojies.2025.3566213`, 인용 35) | `papers/Salem_2025_GFM_Review.pdf` |
| Luo 2024 (`10.1049/icp.2024.4667`) | `corpus_gap_candidates.md` 후보 1-1 |
| Ganguly/Wang 2025 PESGM (`10.1109/pesgm52009.2025.11225025`) | 같은 문서 후보 1-2 |
| Pournazarian 2022·2021 | 같은 문서 후보 3-1·3-3 |

---

## 미검증 항목

- **2-3 Niu 2025 TPEL 의 권·호·페이지**: OpenAlex 는 `41(5), 8242–8255 · publication_year 2025`
  인데 TPEL vol. 41 은 통상 2026년호다. IEEE 공식 표기 확인 필요 → `미검증`.
- **2-2 Hong 2026 의 행사 정식명·개최지**: OpenAlex `primary_location.source` 가 `None` 이다.
  DOI 접두 `cpeee69412` 로 보아 IEEE CPEEE 2026 으로 보이나 확정 못 함 → `미검증`.
- **4-1 Selim 2026 의 최종 게재지**: SSRN 프리프린트뿐이다. 저널 투고본인지 확인 못 함 → `미검증`.
  SSRN 실제 다운로드 가능 여부도 확인하지 않았다(PDF 를 받지 않았으므로) → `미검증`.
- **3-3 Chen 2025 · 4-3 Akinwola 2025**: **초록을 읽지 않았다.** 제목·서지만 보고 넣었다.
  GFM 여부(3-3) 와 소신호 제약 유무(4-3) 를 확인하지 않았다 → `미검증`.
- **5-1 De Carne 2026 의 OA 실태**: IEEE OJPEL 은 gold OA 저널이나 `best_oa_location.pdf_url`
  이 비어 있다. KIT green 사본(200 확인)으로 대체했다. IEEE 측 직접 PDF URL → `미검증`.
- **1-1 Jaffal 2025 의 RWTH 사본**: 레코드는 존재하나 OpenAlex 가 `is_oa: false` 로 본다.
  실제 전문 공개 여부 → `미검증`.

---

## 다음 단계

1. **축 2 의 Salem & Aljarrah 2026 을 먼저 받아 정독한다** (`paper-reader`).
   X/R 0.1~10 범위에서 **무엇을 측정했는지**(시간영역 지표인지 고유값인지)가
   `NEXT.md` §0 의 차별점 문장을 다시 쓸지 말지를 결정한다.
2. **Selim/Seo/Zhao 2026** 을 받아 축 4 의 차별점을 재확인한다.
   "SCR 스윕 + 안정영역 인증 + 최적화 + HIL" 이 이미 한 편에 있다면,
   이 연구의 기여는 **X/R 축과 2단 PV+ESS 구성**으로 더 좁아진다.
3. `records/pawar2021gfcpv.json` 의 `G03`(SCR–X/R)·`G04`(PSO) 는 이미
   `partially_addressed` 다. **이번 결과는 그 판정을 더 강하게 만든다** —
   본문 확인 후 `already_addressed` 로 올려야 할지 재검토가 필요하다.
   `G05`(2단 PV+ESS) 는 축 3 의 Zhao 2025 로 **반증 검색을 시작할 수 있다**
   — 다만 이 문서만으로 레코드를 고치지 않았다. 본문을 받은 뒤에 고친다.
4. 말뭉치에 넣을 우선순위: **Salem&Aljarrah 2026 → Zhao 2025 → UNIFI v3 →
   Bui 2026 → De Carne 2026**. 이 다섯이 `NEXT.md` §3 의 eval 질의 ③⑥⑧ 의
   gold 를 채울 가능성이 가장 높고, 전부 **즉시 수령 가능**하다.
