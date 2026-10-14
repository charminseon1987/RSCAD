# 말뭉치 공백 보충 후보

작성: 2026-10-14 · `paper-searcher` · 근거 판정은 `NEXT.md` §2

**검색 경로**: Elicit 은 이 계정 플랜에서 API 접근이 거부되어(`api_access_denied`) 쓰지 못했다.
대신 **OpenAlex**(무료, 읽기 전용 질의 — `tools/paper_agent.py` 는 볼트를 쓰고 PDF 를 받으므로
쓰지 않았다)와 **alphaXiv** 를 썼다. arXiv REST API 는 이 환경에서 타임아웃이 났고,
arXiv ID 는 OpenAlex 의 `best_oa_location` 과 alphaXiv 본문 조회로 교차 확인했다.

**중복 확인**: 현재 말뭉치 8편(`papers/`) — `DArco_2014_VSM_Droop`,
`henriquezauba2022arxiv`, `kenyon2020ibrstability`, `Liu 2025 datadriven cpes`,
`PV_GFM_Control_Playbook`, `Report_24-06`, `Salem_2025_GFM_Review`,
`Taul_2020_CurrentLimiting_GFM`. **아래 후보 중 중복은 없다.**

**읽은 범위**: 아래 표시한 2편(Luo et al., Singh et al.)만 **공개 PDF 본문을 받아 용어 검색**했다.
나머지는 **초록 + 서지정보만** 확인했다. 본문을 안 본 항목에 "이 논문은 X 를 한다"고 단정하지 않았다.

---

## 주제 1. SCR–X/R 동시 변화 안정도 경계 — **반증 검색 결과: 공백이 열려 있지 않다**

### 사용 검색식 (7개, 전부 OpenAlex `from_publication_date:2014-01-01`)

1. `grid-forming converter small-signal stability short-circuit ratio X/R ratio stability region`
2. `stability boundary grid impedance ratio X/R SCR sweep virtual synchronous generator droop control`
3. `impact of grid strength and resistive-inductive grid impedance angle on grid-forming inverter stability`
4. `robustness region grid-forming inverter eigenvalue analysis varying grid impedance magnitude and angle`
5. `grid-forming converter stability region two-dimensional SCR and X/R plane small-signal eigenvalue`
6. `virtual synchronous machine small-signal stability grid impedance angle resistive inductive weak grid eigenvalue loci`
7. `effect of X/R ratio on droop controlled inverter stability microgrid low voltage resistive line`

+ alphaXiv 의미검색 1회 (키워드: grid-forming / small-signal stability / short-circuit ratio /
SCR / X/R ratio / stability boundary / virtual synchronous machine / robustness)

고유 결과 73편 중 제목·초록에 X/R·R/X·impedance angle·resistive 가 걸린 것 4편을 직접 읽고 분류했다.
추가로 Luo et al. 의 참고문헌 목록을 스노볼링했다.

### 분류: **부분적으로 다룸** (`partially_addressed`)

| # | 제목 | 1저자 | 게재지 | 연도 | 인용 | DOI | PDF | 핵심 한 줄 | 관련도 |
|---|---|---|---|---|---|---|---|---|---|
| 1-1 | Stability boundary analysis of grid-forming and grid-following inverters | X. Luo | IET Conf. Proc. 2024(29), 245–250 (MedPower 2024) | 2024/25 | 2 | `10.1049/icp.2024.4667` | **공개** (Soton eprints) | **본문 확인**: m_P vs SCR 소신호 안정도 경계를 **R/X 0~30% 에 대해 반복 작도**(Fig. 9). SCR–R/X 동시 변화 경계가 이미 있다 | 상 |
| 1-2 | Experimental Evaluation of Impact of SCR and X/R Ratio on Stability of GFM and GFL Inverters | J. Wang (NREL) | IEEE PESGM 2025, pp. 1–5 | 2025 | 4 | `10.1109/pesgm52009.2025.11225025` | **본문 유료** · 프리프린트 공개 `10.20944/preprints202504.1145.v1` | 초록만: 상용 인버터 2대를 SCR·X/R **동시** 변화로 하드웨어 시험. X/R 이 SCR 보다 전압안정도에 더 크게 작용 | 상 |
| 1-3 | Evaluating Small-Signal Synchronization Stability of Grid-Forming Converter: A Geometrical Approach | J. Yu | IEEE Trans. Ind. Electron., 69(9), 9087–9098 | 2022 (early access 2021) | 43 | `10.1109/TIE.2021.3113000` | **유료 — 도서관 경유** | 초록만. Luo et al. 이 "축약 상태공간으로 **R/X 별 안정도 경계**를 도출했다"고 기술한 선행연구 | 중상 |

### 사용자 가설에 반하는 결과 (별도 제시 — 이것이 이 주제의 핵심)

> `NEXT.md` §2 는 "③ SCR·X/R 동시 변화 안정도 경계 = **없음**, 이것이 이 연구의 신규성 그 자체"로
> 판정했다. **그 판정은 유지될 수 없다.**

- **1-1 Luo et al. Fig. 9** 가 정확히 그것이다. 본문 인용(원문 확인):
  > "The 𝑚𝑃 vs. SCR stability curve is reproduced for different R/X ratios, as shown in Fig. 9.
  > When the R/X ratio increases, the stable region expands in both cases."

  GFL·GFM 둘 다에 대해 작도했고, "SBT(stability boundary tracking) 알고리즘"으로 최대 3개
  파라미터의 경계를 2D 곡선·3D 곡면으로 낸다고 밝힌다.
- **1-2 NREL** 은 같은 판정을 하드웨어에서 뒤집는다. 초록 원문:
  > "X/R affects the voltage stability more than SCR; reducing X/R has a negative impact on the
  > GFM inverter's stability, but it has a positive impact on the GFL's stability"

  즉 X/R 이 **SCR 보다 더 지배적**이라는 결과다. "SCR 단독 스윕으로 충분하다"는 쪽이 아니라
  "X/R 을 빼면 틀린다"는 쪽이고, 동시에 **이미 측정된 영역**이라는 뜻이기도 하다.

### 그래도 남아 있는 차별점 (※ 내 판단 — 검증 필요)

- Luo et al. 의 R/X 는 **0~30% 구간뿐**이다 (X/R ≥ 3.3). 본문은 "R/X 10% 까지는 영향이 미미하고
  순 유도성 가정이 유효하다"고 쓴다. 이 저장소의 런은 **X/R 1.0·1.5** (R/X 100%·67%) —
  Luo 가 다룬 범위 **밖**이다. 저압·배전 영역의 강건성 경계는 여전히 비어 있을 수 있다.
- Luo et al. 은 3-bus 테스트벤치 학회논문이고 PSO 공동최적화·CHIL 검증이 없다.
- 1-2 는 소신호 고유값 모델이 아니라 상용기 **전압안정도 실험**이다.

→ 신규성 주장을 "SCR–X/R 경계를 아무도 안 했다"에서
**"낮은 X/R(1.0~1.5) 영역에서, PSO 로 조정한 이득과 함께 본 강건성 경계"**로 좁히는 것이
정확하다. 세 편 모두 말뭉치에 넣어야 한다 — 가장 직접적인 경쟁 선행연구다.

### 레코드 갱신

`records/pawar2021gfcpv.json` 의 `G03` → `counter_search.status: partially_addressed`,
`G04` → `partially_addressed`. 질의·찾은 것·날짜 기입. `ce_tool.py validate` 통과(exit 0).
`G01`·`G02`·`G05` 는 검색하지 않았으므로 `not_searched` 로 **그대로 뒀다**.

---

## 주제 2. CHIL / RTDS 검증 절차 — 3편 (단, 완전한 적합은 1편)

### 사용 검색식 (5개)

1. `controller hardware-in-the-loop CHIL grid-forming inverter RTDS real-time simulation validation`
2. `hardware-in-the-loop testing grid-forming control OPAL-RT loop delay compensation power hardware in the loop`
3. `CHIL controller hardware in the loop grid-forming inverter RTDS GTNET interface delay compensation cross validation EMT model`
4. `CHIL testbed grid-forming converter control validation benchmarking procedure interface algorithm time delay real-time simulator accuracy`
5. `grid forming inverter RTDS real time simulation CHIL DSP controller code validation weak grid SCR test`

| # | 제목 | 1저자 | 게재지 | 연도 | 인용 | DOI | PDF | 핵심 한 줄 | 관련도 |
|---|---|---|---|---|---|---|---|---|---|
| 2-1 | Developing grid-forming converter controller DLL for real-time HIL simulations | U. Singh (TU Delft) | e+i Elektrotechnik u. Informationstechnik, 142(1), 51–70 | 2025 | 1 | `10.1007/s00502-024-01302-0` | **공개** (Springer, hybrid OA) | **본문 확인**: RTDS/RSCAD 상에서 GFM 제어기를 블랙박스 DLL 로 올린 **cHIL** 테스트벤치. 키워드에 "Control-Hardware-in-the-Loop (cHIL)" 명시 | 상 |
| 2-2 | Overview of Interface Algorithms, Interface Signals, Communication and Delay in Real-Time Co-Simulation of Distributed Power Systems | E. Buraimoh | IEEE Access, 11, 103925–103955 | 2023 | 31 | `10.1109/ACCESS.2023.3317250` | **공개** (gold OA) | 초록만: **루프 지연·인터페이스 알고리즘**을 정면으로 다루는 서베이. A7 `chil_if_spec.md` 의 근거용 | 상 |
| 2-3 | Verification of power hardware-in-the-loop environment for testing grid-forming inverter | H. Kikusato (AIST) | Energy Reports, 9, 303–311 | 2023 | 12 | `10.1016/j.egyr.2022.12.126` | **공개** (Energy Reports = full OA) | 초록만: GFM 인버터 시험용 HIL **환경 자체의 검증 절차**. **CHIL 이 아니라 PHIL** | 중상 |

### 사용자 가설에 반하는 / 주의할 결과

- **2-1 은 본문에 `delay`·`GTNET`·`cross-validation`·`time step` 이 0회다.** 용어 검색으로 확인했다.
  "루프 지연 보상"과 "모델↔CHIL 교차검증 절차"를 기대하면 **이 논문은 그것을 주지 않는다.**
  CHIL 구조와 DLL 빌드 절차만 준다.
- 요청의 세 요소(플랫폼 / 지연 보상 / 교차검증)를 **한 편에 다 담은 논문을 찾지 못했다.**
  2-1(플랫폼) + 2-2(지연) 두 편을 합쳐야 공백이 메워진다.
- 전류제한 스킴의 DSP 구현·샘플링 지연을 CHIL 로 검증한 논문(`G04` 의 원래 문장)은 **못 찾았다.**
  이 부분은 여전히 열려 있다.

### 유료 — 도서관 경유

- S. Gupta, A. Shukla, M. A. Abusara, "Integrated Co-Simulation and Hardware-in-the-Loop Testing
  for Microgrid," *IEEE Trans. Ind. Electron.*, vol. 72, no. 9, pp. 9082–9094, 2025,
  doi: `10.1109/TIE.2025.3532740` — FPGA 제어기 + RTDS CHIL. 초록만 확인. 접근 불가 → 도서관 경유.

---

## 주제 3. PSO / 메타휴리스틱으로 GFM 제어 이득 조정 — 3편

### 사용 검색식 (6개)

1. `particle swarm optimization tuning of virtual inertia and damping control gains for grid-forming converter small-signal stability`
2. `particle swarm optimization parameter tuning virtual synchronous generator inertia damping small-signal stability`
3. `metaheuristic optimization of grid-forming converter control gains eigenvalue-based objective function damping ratio`
4. `PSO particle swarm optimization grid-forming inverter control parameter design stability constrained optimization eigenvalue damping`
5. `optimal design of droop and virtual impedance parameters grid-forming inverter using genetic algorithm small signal model constraint`
6. `multi-objective optimization grid-forming converter control parameters damping ratio eigenvalue constraint PSO weak grid robustness`

| # | 제목 | 1저자 | 게재지 | 연도 | 인용 | DOI | PDF | 핵심 한 줄 | 관련도 |
|---|---|---|---|---|---|---|---|---|---|
| 3-1 | Simultaneous Optimization of Virtual Synchronous Generators Parameters and Virtual Impedances in Islanded Microgrids | B. Pournazarian (Aalto) | IEEE Trans. Smart Grid, 13(6), 4202–4217 | 2022 | 76 | `10.1109/TSG.2022.3186165` | **공개** (hybrid OA · Aalto 리포지터리 사본 있음) | 초록만: **PSO** 로 VSG 파라미터+가상임피던스 동시 최적화. 소신호 모델을 먼저 세우고 **J·D 의 허용구간을 소신호 안정도로 산정** 후 그 안에서 최적화 | 상 |
| 3-2 | Small-Signal Stability Analysis and Parameters Optimization of Virtual Synchronous Generator for Low-Inertia Power System | A. Altawallbeh | IEEE Access, 13, 107227–107243 | 2025 | 17 | `10.1109/ACCESS.2025.3581678` | gold OA 로 등록되어 있으나 OpenAlex 에 PDF 링크 없음 → DOI 경유 | 초록만: **LCL 필터 + 이중루프 PI** 포함 VSG 소신호 모델 + 고유값 해석 후 **하이브리드 PSO·다목적 비용함수**로 이득 최적화 | 상 |
| 3-3 | Simultaneous Optimization of Virtual Synchronous Generators (VSG) Parameters in Islanded Microgrids Supplying Induction Motors | B. Pournazarian | IEEE Access, 9, 124972–124985 | 2021 | 32 | `10.1109/ACCESS.2021.3111015` | **공개** (gold OA · Aalto 사본 있음) | 초록만: **PSO** 로 가상임피던스·J_v·D·전류 상태피드백 계수 최적화. 소신호 안정도로 허용구간 작도 | 상 |

**3-2 가 이 연구에 가장 가깝다** — LCL 필터를 소신호 모델에 포함한 상태에서 PSO 를 돌린다.
주제 4 와도 겹친다.

### 사용자 가설에 반하는 결과

- **"PSO 로 GFM 이득을 조정한 선행연구가 없다"는 전제는 성립하지 않는다.** 3-1 은 IEEE TSG,
  인용 76회다. PSO + 소신호 안정도 제약 + 가상관성/댐핑은 **이미 확립된 조합**이다.
- 다만 3-1·3-3 은 **독립운전(islanded) 마이크로그리드**이고 SCR·X/R 강건성 경계가 목적함수에
  들어가지 않는다 (초록 기준). 차별점은 "PSO 를 썼다"가 아니라
  **"무엇을 목적함수·제약으로 뒀는가"** 에 있다 (※ 내 판단).

---

## 주제 4. LCL 공진 감쇠와 전류제어 이득 상호작용 — 3편 (전부 arXiv 즉시 수령 가능)

### 사용 검색식 (5개)

1. `LCL filter resonance active damping interaction with current controller bandwidth instability grid-connected inverter`
2. `LCL filter resonance interaction grid-forming inverter inner current loop gain small-signal instability`
3. `grid-forming inverter LCL filter resonance current controller gain bandwidth small signal instability analysis`
4. `inner current loop bandwidth and LCL resonance frequency coupling instability virtual synchronous generator active damping`
5. `LCL filter resonance grid-forming converter open-loop unstable reactive power droop integral control active damping small-signal model`

| # | 제목 | 1저자 | 게재지 | 연도 | 인용 | DOI / arXiv | PDF | 핵심 한 줄 | 관련도 |
|---|---|---|---|---|---|---|---|---|---|
| 4-1 | LCL Resonance Analysis and Damping in Single-Loop Grid-Forming Wind Turbines | M. Chen (AAU/Cambridge) | IEEE Trans. Ind. Electron. (early access) | 2026 | 0 | `10.1109/TIE.2026.3692859` / **arXiv 2504.06981** | **arXiv 공개** | 초록+도입부 확인: 단일루프 GFM 의 droop-I 무효전력 제어가 **개루프 불안정 극**을 만든다 — 고주파 안정여유·강건성이 줄어드는 새 기구. 능동댐핑 설계 제안, 실험 검증 | 상 |
| 4-2 | Low-Frequency Resonances in Grid-Forming Converters: Causes and Damping Control | F. Zhao (Aalborg/KTH, X. Wang 그룹) | IEEE Trans. Power Electron., 39(11), 14430–14447 | 2024 | 62 | `10.1109/TPEL.2024.3424296` / **arXiv 2402.14543** | **arXiv 공개** | 초록+도입부 확인: GFM-VSC 의 SR·SSR 원인을 **공진↔제어루프 대응관계**로 정리하고 안정화 제어를 비판적으로 리뷰. 외부/내부 루프 시간척도 분리 논의 | 상 |
| 4-3 | Open-Loop Unstable Behavior in a Class of Single-Loop Grid-Forming Control | M. Chen | 학회논문 (Cambridge Apollo 리포지터리) | 2025 | 0 | `10.17863/cam.126549` | **공개** (Cambridge) | 초록만: **LCL 동특성을 포함한 상세 소신호 모델** + Routh 판정으로 droop-I 무효전력 루프가 본질적으로 개루프 불안정임을 해석적으로 보임. 4-1 의 학회 선행판 | 중상 |

**4-1 과 4-3 은 같은 저자군의 학회→저널 쌍이다.** 말뭉치에 넣을 때 둘 중 하나(4-1 권장, 저널판·실험 포함)면
충분할 수 있다. 세 번째 자리에는 아래를 대안으로 둔다.

### 대안 / 고전 기준점

- **고인용 기준점**이 필요하면:
  X. Wang, F. Blaabjerg, "Damping Methods for Resonances Caused by LCL-Filter-Based
  Current-Controlled Grid-Tied Power Inverters: An Overview," *IEEE Trans. Ind. Electron.*,
  2017, doi: `10.1109/TIE.2017.2714143` — 인용 397. 다만 **GFL 기준**이고 GFM 이 아니다.
- "On the Coupling of Power-Related and Inner Inverter Control Loops of Grid-Forming Converter
  Systems," *IEEE Access*, 2021, doi: `10.1109/ACCESS.2021.3053060` — 인용 31, gold OA.
  외부 전력루프↔내부 전류루프 결합. LCL 공진 자체는 초점이 아니다.

### 사용자 가설에 반하는 결과

- 4-1·4-3 은 **단일루프(SL) GFM** 에 한정된 기구를 말한다. 이 저장소가 쓰는 2단
  (전압–전류 이중루프) 구조에 그대로 옮겨지지 않는다 (※ 내 판단, 본문 미정독).
- 4-2 는 **저주파**(SR/SSR) 공진이 주제다. "LCL 공진(고주파)과 전류제어 대역폭" 을 찾는다면
  4-1 이 맞고 4-2 는 인접 주제다.

---

## 즉시 수령 가능한 공개 PDF 목록

| 주제 | 식별자 | 링크 |
|---|---|---|
| 4 | **arXiv 2504.06981** | `https://arxiv.org/pdf/2504.06981` |
| 4 | **arXiv 2402.14543** | `https://arxiv.org/pdf/2402.14543` |
| 4 | Cambridge Apollo | `https://www.repository.cam.ac.uk/bitstreams/3f14b91c-f441-4914-8aa3-cc7b4fde440d/download` |
| 1 | Soton eprints | `https://eprints.soton.ac.uk/495949/1/MedPower2024_full_paper_2576.pdf` |
| 1 | Preprints.org (NREL 프리프린트) | `https://www.preprints.org/frontend/manuscript/0afc8c374be191cb9b0eb69df5e5081a/download_pub` |
| 2 | Springer (hybrid OA) | `https://link.springer.com/content/pdf/10.1007/s00502-024-01302-0.pdf` |
| 2 | IEEE Access (gold OA) | doi `10.1109/ACCESS.2023.3317250` |
| 2 | Energy Reports (full OA) | doi `10.1016/j.egyr.2022.12.126` |
| 3 | Aalto 리포지터리 | `https://research.aalto.fi/files/84991044/Simultaneous_Optimization_of_Virtual_Synchronous_Generators_Parameters_and_Virtual_Impedances_in_Islanded_Microgrids.pdf` |
| 3 | Aalto 리포지터리 | `https://research.aalto.fi/files/67552329/ELEC_Pournazarian_etal_Simultaneous_Optimization_of_Virtual_Synchronous_Generators_IEEE_Access_2021.pdf` |

## 유료 — 도서관 경유

| 주제 | 서지 | DOI |
|---|---|---|
| 1 | J. Wang et al., IEEE PESGM 2025 (프리프린트판은 공개) | `10.1109/pesgm52009.2025.11225025` |
| 1 | J. Yu et al., IEEE TIE 69(9) 9087–9098, 2022 | `10.1109/TIE.2021.3113000` |
| 2 | S. Gupta et al., IEEE TIE 72(9) 9082–9094, 2025 | `10.1109/TIE.2025.3532740` |
| 3 | A. Altawallbeh et al., IEEE Access 13, 2025 (gold 등록이나 PDF 링크 미확인) | `10.1109/ACCESS.2025.3581678` |

## 미검증 항목

- **1-1 의 연도**: OpenAlex 는 `publication_year 2025`, 권차는 `IET Conf. Proc. 2024(29)`,
  행사는 MedPower 2024 다. 인용 시 확정 필요 → `미검증`.
- **1-3 의 연도**: TIE 69(9) = 2022년 9월호이나 DOI 는 `TIE.2021.*` (early access 2021).
  IEEE 공식 표기 확인 필요 → `미검증`.
- **4-1 의 권·호·페이지**: early access 상태로 `pp. 1-13` → `미검증`.
- **4-3 의 게재 학회명**: Apollo 리포지터리에만 걸려 학회 이름을 확정하지 못했다 → `미검증`.
- **3-2 의 OA 실태**: `oa_status: gold` 인데 PDF 링크가 없다. 실제 공개 여부 → `미검증`.

## 다음 단계

`NEXT.md` §4 의 1번에 그대로 연결된다. PDF 를 `papers/` 에 넣은 뒤:

```bash
python Scripts/01_chunk.py && python Scripts/02_index.py
```

말뭉치가 8 → 16~18편이 되면 §4 의 2번(질의 10 → 25건)이 가능해지고, `Recall@5` 포화
(`NEXT.md` §3) 도 풀린다. 주제 1·4 후보는 영문 본문에 `X/R`·`LCL`·`active damping` 이
실제로 들어 있으므로, §2 에서 0회였던 변별 용어가 채워진다.
