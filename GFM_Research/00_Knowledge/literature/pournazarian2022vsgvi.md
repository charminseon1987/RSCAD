---
type: literature
cite_key: pournazarian2022vsgvi
ref_num: ""
title: Simultaneous Optimization of Virtual Synchronous Generators Parameters and Virtual Impedances in Islanded Microgrids
authors: [Bahram Pournazarian, Reza Sangrody, Matti Lehtonen, Gevork B. Gharehpetian, Edris Pouresmaeil]
corresponding: 미검증 — 논문 본문에 교신저자 표기가 보이지 않는다 (Aalto 리포지터리 사본 기준)
year: 2022
venue: IEEE Transactions on Smart Grid, vol. 13, no. 6, pp. 4202-4217, Nov. 2022
doi: 10.1109/TSG.2022.3186165
pdf: [[pournazarian2022vsgvi.pdf]]
pdf_status: have
paper_type: method
target_system: 일반
control_scheme: [VSG (스윙방정식형 가상관성 J·가상댐핑 D, Eq.4), 가상임피던스 Rv·Lv (무효전력 드룹 전압기준에 삽입, Eq.3), PLL (주파수 되먹임 Kf 경유로 VSG 에 결합), 전압·전류 캐스케이드 PI, 무효전력 드룹 nq]
model_order: 16p + 2q + 2r (p = VSG 수, q = 선로 수, r = 부하 수). Eq.(33). 2버스 MG = 38 (본문에 명시), 3버스 MG = 56 (Eq.(49) 운전점 벡터 길이로 역산)
analysis_method: [소신호 고유값 해석 (Lyapunov 제1방법), 지배고유값 감쇠비 ζ 평가, 참여인자 해석 (Table III), 비선형 시간영역 ODE 시뮬레이션 (ode23s)]
tuning_method: PSO
scr_range: 미명시 — 고립 마이크로그리드만 다루며 상위 계통 연계가 아예 없다. 'SCR'·'short-circuit ratio'·'weak grid'·'grid strength' 라는 표현이 본문에 한 번도 등장하지 않는다 (전수 검색 확인).
xr_range: "미명시 — X/R 을 변수로 스윕하지 않았다. 선로 임피던스는 시나리오별 고정값이다 (2버스: Rline 0.15 Ω / Lline 0.4 mH → X/R ≈ 1.0 @60 Hz. 3버스: Rline1 0.23 Ω / Xline1 0.1 Ω → X/R ≈ 0.43, Rline2 0.35 Ω / Xline2 0.58 Ω → X/R ≈ 1.66). 이 값들은 Table I·V 에서 읽은 것이고 저자가 X/R 로 환산해 논의한 바는 없다."
validation_level: sim-only
hardware: []
extraction_depth: full
dc_ac_coupling: 아니다 — Fig.1 에 DG 측 DC 커패시터 Cdc 가 기호로만 그려져 있을 뿐, Sec. II 의 어느 식에도 DC 측 동특성이 없고 Eq.(23)-(25) 의 VSG 상태벡터 16개에 DC 전압·DC 전류 상태가 없다. PV·부스트·MPPT·ESS 언급도 전무하다. DC 측은 사실상 이상 정전압원이다.
pso_params: 12
section: ""
tags: [literature, microgrid, particle swarm optimization, small-signal stability, virtual synchronous generator, virtual impedances, islanded microgrid, reactive power sharing, damping ratio, dominant eigenvalue, simultaneous optimization]
status: read
---
# Simultaneous Optimization of Virtual Synchronous Generators Parameters and Virtual Impedances in Islanded Microgrids

## 조건·파라미터
| 항목 | 기호 | 값 | 단위 |
|---|---|---|---|
| PSO 반복수 | MaxIt | 100 |  |
| PSO 입자수(군집 크기) | nPop | 10 |  |
| PSO 개인·전역 학습계수 | c1, c2 | 1.4962 |  |
| PSO 관성가중치 | w | 0.7298 |  |
| 운전점 개수 | m | 4171 |  |
| 가상관성 탐색범위 (2버스) | J | 0.1-11 |  |
| 가상댐핑 탐색범위 (2버스) | D | 17.4-200 |  |
| 가상인덕턴스 탐색범위 (2버스) | Lv | 0-0.01 | H |
| 가상저항 탐색범위 (2버스) | Rv | 0-0.01 | Ω |
| 가상관성 탐색범위 (3버스) | J | 0-10 |  |
| 가상댐핑 탐색범위 (3버스) | D | 0.01-300 |  |
| 지배고유값 판정 실수부 구간 |  | -300 < Re < 0 |  |
| 전압 제약 | voq | 0.95-1.05 | p.u. |
| 불안정해 페널티 |  | ~10000 |  |
| 무효전력 드룹 계수 (2버스) | n | 0.001 | V/VAR |
| 정격 각주파수 (2버스 / 3버스) | ωn | 377 / 314 | rad/s |

## Claims
### C01 `problem` — auto_checked
▸ 기존 변환기 기반 마이크로그리드의 소신호 모델은 VSG·가상임피던스·PLL 을 한 모델에 동시에 담은 적이 없어, 이 요소들이 합쳐졌을 때의 안정도 저해를 평가할 수 없었다.
▸ 근거: p.4 인쇄 p.4204 / Sec. I 말미 'these research gaps are spotlighted' 첫 항목 (literature)
※ 저자가 선언한 공백이고 저자 스스로의 문헌조사에 근거한다 — 독립 검증된 공백이 아니다. 내 모델은 여기에 DC 측까지 더하므로 이 공백 서술을 그대로 재사용할 수는 없고 'DC 측까지' 로 좁혀야 한다.

### C02 `problem` — auto_checked
▸ 선행연구는 VSG 파라미터의 허용범위를 뽑을 때 가상임피던스를 고려하지 않았고 그 역도 마찬가지였으며, 가상임피던스와 VSG 파라미터를 동시에 최적화하는 일반화된 방법은 문헌에서 찾을 수 없었다.
▸ 근거: p.4 인쇄 p.4204 / Sec. I, research gaps 2·3번째 항목 (literature)
▸ supports → [[morris2021pscultraweak#C01]]
※ **결정적.** 2022년에 이미 'VSG 파라미터 + 가상임피던스 동시 최적화' 가 기여로 선언되고 IEEE TSG 에 실렸다. 내가 'GFM 이득을 PSO 로 공동최적화' 를 최초 기여로 쓸 수 없다는 직접 근거다.

### C03 `method` — auto_checked
▸ VSG 당 16개, 선로당 2개, 부하당 2개 상태변수로 고립 마이크로그리드 전체의 선형화 상태행렬을 조립하여 임의 개수의 VSG·선로·부하를 가진 계통으로 확장되는 일반화 소신호 모델을 제시한다 (총 차수 16p+2q+2r).
▸ 수치: VSG 1기당 상태변수 수=16, 2버스 MG 총 상태변수 수=38, 3버스 MG 총 상태변수 수=56
▸ 근거: p.7 인쇄 p.4207 / Sec. III-B, Eq.(23)-(25), Fig. 6; p.8 인쇄 p.4208 / Sec. III-B, Eq.(33) 및 '2 bus MG ... there are 38 state variables' (analytical)
※ 내 모델과 차수 비교 기준으로 쓸 수 있다. VSG 1기 16차는 PLL·전압·전류·전력필터를 담은 값이고 DC 측이 없다 (C04).

### C04 `assumption` — auto_checked
▸ DC 측 동특성이 모델에 없다 — Fig.1 에 DC 커패시터 Cdc 가 기호로 그려져 있을 뿐 상태방정식과 VSG 상태벡터에 DC 전압·전류 상태가 하나도 없어 DC 측은 이상 정전압원으로 취급된다.
▸ 조건: DC측 상태변수=없음, PV/부스트/MPPT=언급 없음, ESS=언급 없음
▸ 근거: p.4 인쇄 p.4204 / Fig. 1 회로도 — 'Cdc' 기호만 표기, Sec. II-A~II-D 어느 식에도 DC 변수 없음; p.7 인쇄 p.4207 / Eq.(23) VSG 상태벡터 16개 전수 — δPLL, P, Q, φd, φq, γd, γq, ild, ilq, ϕPLL, vodf, ω*, vod, voq, iod, ioq. DC 항 없음 (analytical)
※ **내 차별점이 살아 있는 지점.** 내 14개 파라미터 중 DC 측 8개(DC 전압제어·부스트단)는 이 논문의 최적화 변수에 아예 들어갈 수 없다. 2단 PV+ESS 구성의 DC-AC 커플링을 공동최적화에 포함하는 것은 이 논문이 하지 않은 일이다.

### C05 `method` — auto_checked
▸ PSO 입자를 y = [J1, D1, Rv1, Lv1, ..., Jp, Dp, Rv,p, Lv,p] 로 정의하여 VSG 1기당 가상관성 J, 가상댐핑 D, 가상저항 Rv, 가상인덕턴스 Lv 네 개씩 총 4p 개 변수를 동시에 탐색한다.
▸ 수치: VSG 1기당 최적화 변수 수=4, 시나리오 1·2 (2버스, VSG 2기) 변수 수=8, 시나리오 3 (3버스, VSG 3기) 변수 수=12
▸ 근거: p.6 인쇄 p.4206 / Sec. III-A Step 2, Eq.(19) 및 Fig. 5 흐름도 Step 1 (analytical)
※ **겹침 판정의 핵심.** 내 14개와 대조하면 — 겹침: VSG 4개 중 J·D 2개(내 쪽 관성·댐핑에 대응). 이쪽에만 있음: Rv·Lv 가상임피던스 2개. 내 쪽에만 있음: DC 측 8개, AC 전압제어 2개, 그리고 내 VSG 4개 중 나머지 2개. 즉 14개 중 실질 겹침은 2개뿐이고, 역으로 가상임피던스는 내가 안 다루고 있다.

### C06 `method` — auto_checked
▸ 목적함수는 단위법 무효전력 불일치 합과 (1 − 최소감쇠비) 의 **곱** 으로 정의되어 가중계수가 전혀 없다 — Objective Function = ΔQ(p.u.)·(1 − ζmin), 제약은 0 < ζmin < 1 및 0.95 p.u. < voq,1..p < 1.05 p.u. 이다.
▸ 조건: 형태=두 단위법 항의 곱 (가중합 아님, 분수형 아님), 가중계수=없음, Pareto front=산출하지 않음 — 단일 스칼라 목적함수
▸ 근거: p.6 인쇄 p.4206 / Sec. III-A, Eq.(18) 및 바로 뒤 서술; p.6 인쇄 p.4206 / Eq.(17) — ΔQ(p.u.) = Σ|nq,t·Qt − nq,t+1·Qt+1|, t=1..p-1 (analytical)
▸ depends_on → [[#C07]]
※ **내 질문 1의 답.** 가중합이 아니다 — 곱(product scalarization)이다. 그리고 Pareto front 도 아니다. 내 v2 목적함수는 ALPHA·F1 + BETA·F2 + GAMMA·F3 로 **명시적 가중합**이므로 구조가 다르다. 다만 '가중치 없음' 은 이 논문이 내 설계보다 앞선 점이라서, 차별점으로 내세우려면 '가중치를 안 쓴다' 가 아니라 '모드를 참여인자로 분류해 지표를 달리 적용한다' 쪽이어야 한다 — 이 논문은 ζmin 하나만 본다.

### C07 `method` — auto_checked
▸ 운전점마다 지배고유값 중 최소감쇠비 ζi_min 을 구한 뒤 전체 m 개 운전점에 걸쳐 **최솟값** 을 취해 ζmin = min{ζ1_min, ..., ζm_min} 으로 집계한다 — 즉 최악 운전점 기준이다.
▸ 조건: 집계방식=min (최악점). 평균·합이 아니다, 지배고유값 판정=실수부 -300 < Re < 0
▸ 근거: p.6 인쇄 p.4206 / Sec. III-A, Eq.(15)·Eq.(16); p.7 인쇄 p.4207 / Sec. III-A Step 6 — 전 운전점의 ζi_min 을 저장한 뒤 그중 최솟값을 선택 (analytical)
▸ depends_on → [[#C08]]
※ **내 질문 3의 절반이 여기서 깨진다.** '최악 운전점 기준 min 집계' 는 이 논문이 이미 하고 있다. 더 아픈 것은 내 v2 설계(`PSO_목적함수_설계.md`)가 실제로는 `F = sum(cost_point)/len(GRID)` 즉 **평균** 집계라는 점이다 — 내가 차별점이라고 믿는 'min' 을 이 논문이 쓰고 내 구현은 평균을 쓴다. 차별점은 집계 연산이 아니라 **무엇을 훑는가**(C08) 에서 찾아야 한다.

### C08 `assumption` — auto_checked
▸ 최적화가 훑는 m = 4171 개 '운전점' 은 고정 토폴로지에서 부하 투입 사건을 포함한 단일 ODE 시간궤적(0<t<4 s, Δt=1 ms)의 시간표본이며, 계통 파라미터를 바꿔 만든 조건 격자가 아니다.
▸ 수치: 운전점 개수=4171, 적분 구간=0-4s, 적분 스텝=0.001s
▸ 근거: p.8 인쇄 p.4208 / Sec. IV 도입부, Eq.(43) MATLAB 코드 및 'After solving the system equations by MATLAB, 4171 operating points are generated (m = 4171). To draw m a simple command in MATLAB is required (m = length(X))'; p.6 인쇄 p.4206 / Sec. III-A Step 3 — 'the MG load-flow at time interval = [0 t] is run' (analytical)
※ **내 질문 3의 답이자 내 차별점이 남는 자리.** 이 논문의 다중 운전점은 '한 계통에서 시간에 따라 변하는 동작점' 이다. 계통 강도(SCR)나 임피던스 각도(X/R)를 바꾼 조건 격자가 아니다. 내 SCR×X/R 2차원 격자는 **계통 파라미터 불확실성에 대한 강건성** 을 묻는 것이므로 질문 자체가 다르다. 다만 'm 개 운전점 전수 평가' 라는 계산 구조는 동일하다 — 신규성 문장을 '다중 운전점' 이 아니라 '계통 강도-임피던스 각도 격자' 로 써야 한다.

### C09 `method` — auto_checked
▸ PSO 는 입자수 10, 반복수 100, 개인·전역 학습계수 c1 = c2 = 1.4962, 관성가중치 w = 0.7298 의 표준 설정으로 돌리며, 수렴판정은 목적함수 값 또는 반복횟수 도달로 서술된다.
▸ 수치: 입자수=10, 반복수=100, 학습계수=1.4962, 관성가중치=0.7298, 적합도 평가 총 횟수(추정)=1000
▸ 근거: p.9 인쇄 p.4209 / Table I 하단 (MaxIt, nPop, c1·c2, w 행); p.6 인쇄 p.4206 / Eq.(20)-(21) 표준 PSO 속도·위치 갱신식, Eq.(22) 경계 클리핑; p.7 인쇄 p.4207 / Sec. III-A Step 9 — 'the convergence criterion which can be the value of objective function or the number of iterations (it)' (analytical)
※ **내 질문 4의 답.** 변형이 아니라 교과서 표준 PSO(관성가중치형, 감쇠 없음)다. w=0.7298, c=1.4962 는 Clerc 수축계수 표준값이다. 입자 10 x 반복 100 = 평가 1000회는 내 설정과 비교 가능한 기준점이고, 변수 12개에 입자 10개는 상당히 작은 군집이다 — 내가 더 큰 군집을 쓴다면 그 자체로는 기여가 아니지만 공정 비교의 근거는 된다.

### C10 `method` — auto_checked
▸ 어느 운전점에서든 양의 실수부 고유값이 나오면 flag=1 을 세우고 목적함수에 10000 자리수의 큰 값을 부여해 PSO 가 그 해를 자동으로 버리게 하는 방식으로 불안정해를 배제한다.
▸ 근거: p.7 인쇄 p.4207 / Sec. III-A Step 5 및 Step 7 (analytical)
※ 내 `P_INFEASIBLE` 상수 처리와 같은 설계다 (`PSO_목적함수_설계.md` 의 '동작점 부재 — 상수 페널티'). 내 설계노트가 미확정으로 남겨 둔 'P_INFEASIBLE 스케일' 에 대해 선례 수치(1e4)를 인용할 수 있다. 다만 이 논문도 스케일 근거는 제시하지 않았다.

### C11 `definition` — auto_checked
▸ 지배고유값에 엄밀한 정의가 없음을 인정하면서 실수부가 -300 < Re < 0 구간에 있는 고유값을 지배고유값으로 간주하고, 그중 최소감쇠비를 가진 것을 계통 안정도 수준의 대표값으로 삼는다.
▸ 수치: 지배고유값 실수부 구간=-300 < Re < 0
▸ 근거: p.6 인쇄 p.4206 / Sec. III-A, Eq.(14)-(15) 직후 서술, 참조 [22],[23] 인용 (assertion)
※ 내 접근과 갈리는 지점이다. 이쪽은 **실수부 구간**으로 지배모드를 자르고, 나는 **참여인자**로 모드를 귀속시킨다 (`참여인자 지배모드`). 내 설계노트가 경고한 '모드교차로 ζmin 이 구간마다 다른 물리 모드를 가리키는 함정' 을 이 논문은 다루지 않는다 — 실질적 차별점 후보다.

### C12 `comparison` — auto_checked
▸ 제안 목적함수가 가중계수 배정 문제를 안고 있는 다목적(가중합) 목적함수와, 분모 근처에서 불안정해지는 분수형 목적함수를 모두 능가한다고 주장한다.
▸ 근거: p.4 인쇄 p.4204 / Sec. I, contributions 2번째 항목; p.15 인쇄 p.4215 / Sec. V (Conclusion) — 'removes the dual problem of adjusting the weighting coefficients' (assertion)
▸ contradicts → [[#C06]]
※ 이 주장은 근거가 없으므로 내 논문에서 '가중합의 한계는 이미 해결됐다' 는 식으로 인용되면 안 된다. 거꾸로 **나에게 유리한 틈** 이다 — 곱 스칼라화와 가중합을 같은 계통에서 정량 비교한 연구가 없다면 그건 내가 채울 수 있는 자리다.

### C13 `result` — auto_checked
▸ 2버스 MG 시나리오 1 에서 제안 'VSG+VI' 제어의 지배고유값 최소감쇠비는 28.7% 로, 통상 droop 제어 26% 와 'droop+VI' 18.6% 보다 높다.
▸ 수치: 최소감쇠비 (VSG+VI, 제안)=28.7%, 최소감쇠비 (droop)=26%, 최소감쇠비 (droop+VI)=18.6%, droop+VI 지배고유값=-2.43 ± j15.01, VSG+VI 지배고유값 (해당 극 이동 후)=-0.42, droop 지배고유값=-1.45 ± j5.39
▸ 근거: p.10 인쇄 p.4210 / Sec. IV-A-4, Fig. 12 (고유값 지도) 및 Fig. 13 (감쇠비 막대그래프) (simulation)
※ 개선폭이 26% → 28.7%, 즉 2.7 포인트다. 최적화를 돌려 얻은 이득이 이 정도라는 점은 내 결과의 상대적 크기를 주장할 때 비교 기준이 된다. 다만 고립 MG 이고 SCR 변동이 없는 조건이다.

### C14 `result` — auto_checked
▸ 2버스 MG 시나리오 1 에서 제안 제어의 주파수 변화율(RoCoF)은 0.351 Hz/s 로 droop 및 droop+VI 의 0.61 Hz/s 보다 낮고, q축 전압강하도 1.02 V 로 droop 1.16 V·droop+VI 1.98 V 보다 작다.
▸ 수치: RoCoF (VSG+VI, 제안)=0.351Hz/s, RoCoF (droop / droop+VI)=0.61Hz/s, 최대 q축 전압강하 (VSG+VI / droop / droop+VI)=1.02 / 1.16 / 1.98V, 부하 외란=440 W + 48 VAR
▸ 근거: p.9 인쇄 p.4209 / Sec. IV-A-2, Fig. 10 (주파수 비교); p.9 PDF 물리 p.9-10 / Sec. IV-A-3, Fig. 11 (dq 전압 성분) (simulation)
※ RoCoF 개선은 가상관성의 당연한 결과이고 최적화 고유의 성과로 보기 어렵다 — 비교군 droop 은 관성이 아예 없다. 비교 설계의 약점으로 지적할 수 있다.

### C15 `result` — auto_checked
▸ 2버스 MG 시나리오 1 에서 제안 제어는 무효전력 분담을 크게 개선해 두 변환기의 정상상태 무효전력이 droop 제어의 53.6 / 148 VAR 에서 96.30 / 108.93 VAR 로 균등화된다 (유효전력은 세 방식 모두 637.4 W 로 동일).
▸ 수치: Q1 / Q2 (droop)=53.6 / 148VAR, Q1 / Q2 (VSG+VI, 제안)=96.30 / 108.93VAR, Q1 / Q2 (droop+VI)=90.27 / 108.21VAR, P1 = P2 (세 방식 공통)=637.4W
▸ 근거: p.11 인쇄 p.4211 / Sec. IV-A-7, Fig. 15 (유효·무효전력) (simulation)
※ 무효전력 불일치 94.4 VAR → 12.63 VAR. 다만 droop+VI 도 17.94 VAR 로 비슷하게 좋다 — 즉 **무효전력 개선의 대부분은 가상임피던스 몫**이고 VSG 파라미터 최적화의 기여는 작다. 내가 가상임피던스를 안 다루는 이유를 역으로 설명할 재료다.

### C16 `result` — auto_checked
▸ 3버스 MG 시나리오 3 에서 제안 제어는 최약 지배고유값을 -4.83±8.17j 에서 -7.25±11.69j 로 옮겨 감쇠비를 50.87% 에서 52.70% 로 올렸다.
▸ 수치: 최약 지배고유값 (VSG 제어)=-4.83 ± 8.17j, 최약 지배고유값 (VSG+VI, 제안)=-7.25 ± 11.69j, 감쇠비 개선폭=1.83%p
▸ 근거: p.13 인쇄 p.4213 / Sec. IV-C-1, Fig. 22(b) (지배고유값 확대); p.14 인쇄 p.4214 / Fig. 24 (감쇠비 막대그래프) (simulation)
※ 개선폭 1.83%p 는 작다. 비교군이 J=1·D=200 의 'VSG 제어' 이고 이미 ζ=50.87% 로 충분히 감쇠된 상태였다 — 최적화의 여지가 적은 출발점을 골랐다는 비판이 가능하다.

### C17 `result` — auto_checked
▸ 3버스 MG 시나리오 3 에서 제안 제어는 d축 전류 불일치를 2.46 A 에서 0.36 A 로, VSG1 유효전력 최대치를 4665 W 에서 4230 W 로, 최대 무효전력 불일치를 1203 VAR 에서 207.25 VAR 로 줄이고 유효전력 정착시간을 5 s 에서 4 s 로 단축했다.
▸ 수치: d축 전류 불일치 (VSG → VSG+VI)=2.46 → 0.36A, VSG1 유효전력 최대치 (VSG → VSG+VI)=4665 → 4230W, 최대 무효전력 불일치 (VSG → VSG+VI)=1203 → 207.25VAR, 최대 주입 무효전력 (VSG → VSG+VI)=1059.92 → 548.75VAR, 유효전력 정착시간 P1 (VSG → VSG+VI)=5 → 4s
▸ 근거: p.14 인쇄 p.4214 / Sec. IV-C, Fig. 25(a)(b) (dq 전류), Fig. 26(a)(b) (유효·무효전력) (simulation)
※ 정착시간을 **지표로 보고하기는 하지만 목적함수에 넣지는 않았다** — Eq.(18) 에는 ΔQ 와 ζmin 뿐이다. 내 v2 가 동기화 모드에 t_s 를 직접 넣는 것은 이 논문과 다른 설계이고, 차별점으로 쓸 수 있다.

### C18 `limitation` — auto_checked
▸ 탐색된 최적해가 상자제약 경계에 붙어 있다 — 2버스에서 D = 199.75 (Dmax = 200), 3버스에서 D = 300 (Dmax = 300) 이고 3버스 J = 0.01639 는 Jmin = 0 에 거의 닿아 있어, 해를 결정한 것이 최적화가 아니라 사용자가 정한 범위일 수 있다.
▸ 수치: 2버스 최적 J, D=5.8599, 199.75, 3버스 최적 J1=J2=J3=0.01639, 3버스 최적 D1=D2=D3=300, 3버스 최적 Lv1, Lv2, Lv3=0.00603, 0.00587, 0.01444H, 3버스 최적 Rv1, Rv2, Rv3=0.00060, 0.00055, 0.00064Ω
▸ 근거: p.9 인쇄 p.4209 / Table I (Jmin·Jmax·Dmin·Dmax) 와 Table II (최적해) 대조; p.13 인쇄 p.4213 / Table V (Jmin 0, Jmax 10, Dmin 0.01, Dmax 300) 와 Table VI (J=0.01639, D=300) 대조 (analytical)
※ **인용 가치가 높은 비판점.** 3버스에서 '가상관성 최적값이 거의 0, 가상댐핑은 상한' 이라는 해는 사실상 '관성을 쓰지 말고 댐핑을 최대로' 다 — VSG 논문의 결론으로서 자기모순적이다. 내 쪽에서 탐색범위를 플랜트에서 유도한 작업(커밋 '범위를 플랜트에서 유도하니 기준 이득 둘이 범위 밖이었다')이 이 문제를 정면으로 다룬다는 점을 기여로 쓸 수 있다.

### C19 `limitation` — auto_checked
▸ 상위 계통 연계를 다루지 않는다 — 두 시험계통 모두 고립 마이크로그리드이고 단락비·계통강도·약계통이라는 개념이 논문에 등장하지 않으며, 선로 임피던스는 시나리오별 고정값이다.
▸ 조건: 운전모드=고립(islanded) 전용, SCR=미명시 (개념 자체가 없음), X/R=스윕하지 않음, 시나리오별 고정
▸ 근거: p.2 인쇄 p.4202 / Abstract 및 Sec. I — 'islanded MGs typically supply special loads such as distant rural costumers and cruise ships' 로 대상이 고립계통임을 명시; p.7 인쇄 p.4207 / Fig. 6 — 전형 MG 회로도에 VSG·선로·부하만 있고 계통 등가전원이 없다; p.13 인쇄 p.4213 / Fig. 21 (3버스 시험계통) 과 Table V — 선로 임피던스 고정값, 계통 연계점 없음 (analytical)
※ **내 기여가 살아남는 가장 큰 자리.** 내 연구는 SCR 1.5-3.0 x X/R 격자에서의 강건성 경계를 묻는다. 이 논문은 그 축이 아예 없다. 신규성 문장을 '공동최적화' 가 아니라 '계통강도-임피던스각도 강건성 경계를 목적함수에 내재화' 로 옮기면 충돌하지 않는다.

### C20 `limitation` — auto_checked
▸ 검증이 MATLAB 수치해석 시뮬레이션에 한정된다 — 스위칭 레벨 EMT 모델, 실시간 시뮬레이터, HIL, 실기 시험이 전혀 없다.
▸ 조건: 검증수준=MATLAB ODE 시뮬레이션만, EMT 상세모델 교차검증=없음, HIL/실기=없음
▸ 근거: p.8 인쇄 p.4208 / Sec. IV 도입부 — 'The dynamic equations of the MG system are solved by ode23s command in MATLAB' 외의 검증 수단 서술 없음; p.15 인쇄 p.4215 / Sec. V (Conclusion) — 실험·HIL 언급 없이 시뮬레이션 결과로만 결론 (analytical)
※ 내 RTDS CHIL 경로가 그대로 차별점이다. 피인용 76 의 TSG 논문이 시뮬레이션만으로 끝났다는 사실은 'CHIL 검증' 을 기여로 세우는 근거가 된다.

### C21 `limitation` — auto_checked
▸ Eq.(19) 는 VSG 별로 독립적인 J·D 를 선언하지만 보고된 최적해에서는 J 와 D 가 모든 VSG 에서 동일하게 나와 (2버스: J·D 한 쌍만 표기, 3버스: J1=J2=J3, D1=D2=D3) 실제 탐색 차원이 4p 였는지 2+2p 였는지 확정할 수 없다.
▸ 근거: p.9 인쇄 p.4209 / Table II — 'J, D' 행에 변환기 2기용으로 단일 쌍 '5.8599, 199.75' 만 기재; p.13 인쇄 p.4213 / Table VI — J1,J2,J3 = 0.01639 동일, D1,D2,D3 = 300 동일. 반면 Lv·Rv 는 3기가 서로 다르다; p.6 인쇄 p.4206 / Eq.(19) — 입자벡터에 Jp, Dp 를 VSG 별로 선언 (analytical)
※ 변수 개수 비교를 할 때 조심해야 한다. 내 14개와 '12개' 를 나란히 놓으면 공정하지 않을 수 있다 — 이 논문의 실질 탐색 차원은 8개(3버스: J·D 공유 + Rv·Lv 3쌍)일 가능성이 있다. 보고서에 이 불확실성을 같이 적는다.

### C22 `result` — auto_checked
▸ 2버스 MG 시나리오 2 에서 최적 파라미터(J=5.8599, D=199.75, Lv 0.00316/0.00165 H, Rv 0.00658/0.00226 Ω)는 비최적 'VSG+VI'(J=2, D=100, Lv=Rv=0.02) 의 정상상태 전압강하 5.96 V 를 0.99 V 로 줄였으나, 가상임피던스가 없는 비최적 VSG(J=2, D=50, Lv=Rv=0) 의 0.07 V 보다는 크다.
▸ 수치: 정상상태 q축 전압강하 (case1 최적 / case2 비최적 VSG+VI / case3 비최적 VSG)=0.99 / 5.96 / 0.07V
▸ 근거: p.11 인쇄 p.4211 / Sec. IV-B-1, Table IV (세 case 파라미터) 및 Fig. 16 (버스 1 dq 전압) (simulation)
※ 가상임피던스를 넣으면 무효전력 분담은 좋아지지만 전압강하는 커지는 트레이드오프가 수치로 드러난 자리다 (0.07 V → 0.99 V). Eq.(18) 의 0.95-1.05 p.u. 제약이 이 트레이드오프를 제약으로만 처리하고 목적에는 넣지 않았음을 보여 준다.

### C23 `result` — auto_checked
▸ 참여인자 해석으로 2버스 MG 의 저주파 지배모드(-6.65±22.21j, ζ=28.69%)가 두 변환기의 유효·무효전력 상태 P1·Q1·P2·Q2 에 지배적으로 참여하고, 고주파 모드(-1917±10897j 등)는 vod·voq·vodf 전압 상태가 주도함을 보였다.
▸ 수치: 최약 지배모드=-6.65 ± 22.21j, 최저주파 모드=-1.17 ± 1.28j, 최고주파 모드=-1917.05 ± 10897.21j
▸ 근거: p.10 인쇄 p.4210 / Sec. IV-A-5, Table III (Eigenvalues participation analysis) (simulation)
※ 참여인자를 **결과 설명용으로만** 썼고 최적화 안에서 모드를 귀속시키는 데는 쓰지 않았다 (최적화는 C11 의 실수부 구간으로 자른다). 내 설계가 참여인자로 모드를 식별해 지표를 분기시키는 것은 이 논문보다 한 걸음 더 간 것이다 — 차별점으로 쓸 수 있다.

### C24 `method` — auto_checked
▸ 가상임피던스는 무효전력 드룹 전압기준식에 v*oq = VoqN − nq·Q − (Rv·ioq + Xv·iod), v*od = 0 형태로 삽입되고, VSG 는 PLL 주파수 편차를 Kf/J 로 되먹이는 스윙방정식 dω*/dt = −(D/J)(ω*−ωn) + (P0−P)/(Jωn) − (ωPLL−ωn)(Kf/J) 로 구성된다.
▸ 근거: p.4 인쇄 p.4204 / Sec. II-B, Eq.(3); p.5 인쇄 p.4205 / Sec. II-C, Eq.(4) 및 Fig. 3 (PLL 블록도, 참조 [24]) (analytical)
※ 이 VSG 는 PLL 을 **쓴다** — Kf 경로로 PLL 주파수가 스윙방정식에 들어간다. 순수 GFM(PLL 없는 자기동기화)이 아니라 PLL 보조형이다. 내 GFM 구조와 다르므로 '같은 문제를 푼 선행연구' 로 인용할 때 이 차이를 명시해야 한다.

## Gaps
- **G01** [high/phd] VSG 파라미터와 가상임피던스 공동최적화가 고립 마이크로그리드 한 가지 조건에서만 수행됐고, 상위 계통에 연계된 GFM 이 겪는 계통강도(SCR)·임피던스 각도(X/R) 변동에 대한 강건성은 다루지 않았다. 계통 파라미터를 축으로 한 최악점 최적화는 이 논문에 없다. (관련: [[morris2021pscultraweak#C03]], [[zhao2024lowfreqres#C24]]) ← C19, C08, C07 · 반증검색: `not_searched`
  ※ 반증 검색 전 — 논문에 '공백'으로 쓰지 말 것
- **G02** [high/phd] 최적화 변수가 AC 측 네 개(J, D, Rv, Lv)로 한정되고 DC 측이 모델에 아예 없어, 2단(부스트+인버터) PV 또는 PV+ESS 구성에서 DC 전압제어 이득과 AC 측 이득 사이의 커플링을 함께 조정하는 문제는 열려 있다. (관련: [[pawar2021gfcpv#C08]]) ← C04, C05 · 반증검색: `not_searched`
  ※ 반증 검색 전 — 논문에 '공백'으로 쓰지 말 것
- **G03** [medium/phd] 제안 곱형 목적함수가 가중합·분수형 목적함수를 능가한다는 주장에 비교 실험이 없다. 같은 계통·같은 PSO 설정에서 곱 스칼라화와 가중합을 돌려 정량 비교하거나 Pareto front 를 내서 ΔQ-ζmin 트레이드오프를 드러낸 연구가 필요하다. ← C12, C06 · 반증검색: `not_searched`
  ※ 반증 검색 전 — 논문에 '공백'으로 쓰지 말 것
- **G04** [medium/phd] 최적해가 상자제약 경계(D = Dmax, J ≈ Jmin)에 붙어 있는데도 탐색범위 자체의 타당성·민감도 분석이 없다. 범위를 플랜트 파라미터에서 유도하고 경계 접촉 여부를 점검하는 절차가 비어 있다. ← C18 · 반증검색: `not_searched`
  ※ 반증 검색 전 — 논문에 '공백'으로 쓰지 말 것
- **G05** [high/phd] 최적화 안에서 지배모드를 실수부 구간(-300 < Re < 0)이라는 임의 기준으로 자르고, 참여인자는 사후 설명에만 썼다. 조건이 변할 때 ζmin 이 서로 다른 물리 모드를 가리키는 모드교차 문제를 참여인자 기반 귀속으로 처리한 최적화는 이 논문에 없다. (관련: [[morris2021pscultraweak#C02]]) ← C11, C23, C07 · 반증검색: `not_searched`
  ※ 반증 검색 전 — 논문에 '공백'으로 쓰지 말 것
- **G06** [high/phd] 검증이 MATLAB 수치 ODE 시뮬레이션 한 층에 머물러, PSO 가 뽑은 이득을 스위칭 레벨 EMT 또는 실시간 CHIL 에서 재현한 적이 없다. 최적해가 실시간 지연·이산화 아래에서도 유지되는지는 미확인이다. (관련: [[morris2021pscultraweak#C11]]) ← C20 · 반증검색: `not_searched`
  ※ 반증 검색 전 — 논문에 '공백'으로 쓰지 말 것
- **G07** [medium/phd] 정착시간·과도 과도상승은 결과로 보고하면서 목적함수에는 넣지 않았다 (Eq.18 은 ΔQ 와 ζmin 뿐). 과도응답 사양을 목적함수에 직접 내재화한 공동최적화는 이 논문 범위 밖이다. ← C17, C06 · 반증검색: `not_searched`
  ※ 반증 검색 전 — 논문에 '공백'으로 쓰지 말 것

