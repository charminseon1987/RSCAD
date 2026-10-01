---
type: literature
cite_key: pawar2021gfcpv
ref_num: ""
title: Grid-Forming Control for Solar PV Systems with Power Reserves
authors: [Bandopant Pawar, Efstratios I. Batzelis, Saikat Chakrabarti, Bikash C. Pal]
corresponding: ""
year: 2021
venue: IEEE Transactions on Sustainable Energy
doi: 10.1109/TSTE.2021.3074066
pdf: ""
pdf_status: none
paper_type: ""
target_system: ""
control_scheme: []
model_order: 미명시
analysis_method: [미명시]
tuning_method: ""
scr_range: 미명시
xr_range: 미명시
validation_level: ""
hardware: []
extraction_depth: ""
dc_ac_coupling: 미명시
pso_params: ""
section: 2. 선행연구 — PV GFM 예비력 운전
tags: [literature, grid-forming, PV, power reserve, deloading, current limitation, WSCC 9-bus]
status: cited
---
# Grid-Forming Control for Solar PV Systems with Power Reserves

## 조건·파라미터
| 항목 | 기호 | 값 | 단위 |
|---|---|---|---|
| PV plant capacity |  | 105 | MWp |
| power setpoint | p* | 75 | MW |
| power reserve | P_res | 30 | MW |
| unit inverter rating |  | 25 | kVA |
| switching frequency | f_sw | 10 | kHz |
| AC voltage (filter cap) |  | 400 | V |
| DC-link nominal voltage |  | 750 | V |
| GFC droop | d_ω | 1 | % |
| power LPF cutoff | ω_c | 2π·10 | rad/s |
| SM governor droop |  | 2 | % |
| transient current limit | k | 1.414 | pu |
| reactive current limit | k1 | 1.2 | pu |
| current ctrl gains | Kpi/Kii | 14.85 / 1632 |  |
| Δω PI gains | Kp/Ki | 1.5 / 3 |  |
| DC-DC PI gains | Kp/Ki | 0.1 / 2 |  |

## Claims
### C01 `problem` — auto_checked
▸ 기존 PV 예비력 운전 기법은 모델 기반 실시간 MPP 추정에 의존해 정확도·수렴성 문제가 있다.
▸ 근거: p.4 Sec. II-B-2 (literature)

### C02 `method` — auto_checked
▸ PV를 MPP 오른쪽(고전압 측)에서 감발 운전해 MPP 추정 없이 상·하향 예비력을 확보한다.
▸ 조건: illumination=uniform, topology=two-stage (DC-DC + VSC)
▸ 근거: p.4 Sec. II-B-1, Fig. 3(a) (analytical)
▸ contradicts → [[#C01]]
※ 박사 PV+ESS GFM: ESS가 있으면 감발 대신 ESS로 헤드룸 확보 가능 → 비교 기준선

### C03 `method` — auto_checked
▸ GF 모드에서는 인버터가 p-f 드룹으로 출력을 정하고 DC-DC 컨버터가 DC-link 전압을 제어한다.
▸ 수치: droop law=ω = ω0 + dω(p* − p_LPF) + Δω
▸ 근거: p.3 Sec. II-B, Eq.(1), Fig. 2(b) (analytical)

### C04 `method` — auto_checked
▸ Vdc가 Vdc,min 아래로 떨어지면 LGF 모드로 전환해 DC-DC는 P&O MPPT, 인버터는 Δω(PI)로 DC-link를 제어하며, Δω가 0으로 복귀하면 GF로 돌아간다.
▸ 조건: trigger=Vdc < Vdc,min, return=Δω → 0
▸ 근거: p.4 Sec. II-C, Fig. 4 (analytical)
▸ depends_on → [[#C02]]
※ 모드 전환 경계의 안정도는 해석적으로 다루지 않음 → G03

### C05 `method` — auto_checked
▸ 무효전류 우선 비대칭 포화 + rate limiter + 조건부 적분 anti-windup으로 고장 검출·제어 전환 없이 전류 오버슈트를 억제한다.
▸ 수치: transient limit=1.414pu, reactive limit=1.2pu
▸ 근거: p.5 Sec. II-D, Fig. 5 (analytical)

### C06 `result` — auto_checked
▸ SM+GFC 계통에서 부하 증가 시 PV GFC가 SM보다 빠르게 응답해 All SM 대비 주파수 nadir가 높다.
▸ 수치: load step=47.2MW
▸ 조건: case=SM GFC, disturbance=load increase, droop_gfc=1%, droop_sm=2%
▸ 근거: p.7 Sec. V-A-1, Fig. 11 (simulation)

### C07 `result` — auto_checked
▸ 3상 고장 시 SM은 고장 전 대비 3-6배 무효전류를 주입하나 인버터는 1.414 pu로 제한되며, 제안 스킴으로 전류가 대체로 한계 내에 유지된다.
▸ 수치: SM reactive current=3-6×, inverter current limit=1.414pu
▸ 조건: case=SM GFC, disturbance=3-phase fault
▸ 근거: p.7 Sec. V-A-3, Fig. 13-14 (simulation)
▸ supports → [[#C05]]

### C08 `result` — auto_checked
▸ All GFC(100% 인버터) 계통은 기계적 관성 없이 운전 가능하며, 드룹 0.17%에서 저주파 진동 없이 매끄러운 주파수 응답을 보인다.
▸ 수치: droop=0.17%
▸ 조건: case=All GFC, droop_gfc=0.17%, other_sources=ideal DC sources (bus 1, 2)
▸ 근거: p.8 Sec. V-B-1, Fig. 17; p.9 Sec. V-B (simulation)
※ 박사 SCR 스윕 연구의 강계통 극한 비교 사례

### C09 `result` — auto_checked
▸ All GFC 3상 고장 시 최저 전압은 약 0.6 pu로 SM GFC와 비슷하며, 고장 후 진동은 약 1초 내 감쇠한다.
▸ 수치: min voltage=~0.6pu, oscillation damping time=~1s
▸ 조건: case=All GFC, disturbance=3-phase fault + line trip
▸ 근거: p.9 Sec. V-B-2, Fig. 18 (simulation)

### C10 `comparison` — auto_checked
▸ GFC+GFL 계통에서 GFL 드룹을 2% 미만으로 낮추면 불안정해지고 PLL 유발 진동이 나타나, GFL 비중 확대에는 상한이 있다.
▸ 수치: min stable GFL droop=2%
▸ 조건: case=GFC GFL, droop_gfl=2%
▸ 근거: p.9 Sec. V-D; p.10 Sec. V-E-2, Fig. 22 (simulation)
※ GFC:GFL 비율 공백(G02)의 직접 근거

### C11 `result` — auto_checked
▸ 모달 해석상 SM을 GFC로 부분 대체해도 소신호 안정도는 크게 변하지 않고, 전부 GFC일 때만 저주파 진동 모드가 사라진다.
▸ 근거: p.10 Sec. V-E-1 (analytical)
※ 박사 21/22차 소신호 모델과 직접 비교할 대상 — 이 논문의 상태변수 차수 확인 필요

### C12 `comparison` — auto_checked
▸ 제안 전류 제한은 가상 임피던스(초기 오버슈트+진동)와 MIGRATE I_ref 포화(초기 과전류) 대비 오버슈트와 진동을 모두 억제한다.
▸ 근거: p.11 Sec. V-F (simulation)
▸ supports → [[#C05]]

### C13 `limitation` — auto_checked
▸ PV GFC는 구름 이동에 따른 일사 급변(최대 150-200 W/m²/s) 시 그 자체가 새로운 외란원이 된다.
▸ 수치: irradiance ramp=150-200W/m²/s
▸ 근거: p.2 Sec. I; p.11 Sec. VI (simulation)
※ ESS 결합 GFM의 동기 — 일사 외란을 ESS가 흡수

### C14 `assumption` — auto_checked
▸ 균일 일사(부분 음영 없음)를 가정하며, 하드웨어/HIL 검증 없이 평균값 모델 시뮬레이션만 수행했다.
▸ 조건: illumination=uniform, model=average-value, aggregated
▸ 근거: p.11 Sec. VI; p.6 Sec. IV (assertion)

## Gaps
- **G01** [medium/phd] 부분 음영(다중 피크 P-V) 조건에서 MPP 오른쪽 감발 + P&O 기반 GF/LGF 전환이 안정적으로 동작하는지 미검증 ← C02, C04, C14 · 반증검색: `not_searched`
  ※ 반증 검색 전 — 논문에 '공백'으로 쓰지 말 것
- **G02** [high/phd] 인버터 우세 계통에서 안정성을 보장하는 최소 GFC:GFL 비율 산정 방법론 부재 ← C10 · 반증검색: `not_searched`
  ※ 반증 검색 전 — 논문에 '공백'으로 쓰지 말 것
- **G03** [high/phd] GF↔LGF 모드 전환 경계(Vdc,min 임계)에서의 안정도·강건성을 해석적으로 다루지 않음(시뮬레이션만) — SCR·X/R 변화에 따른 강건성 경계 미정량 ← C04, C11 · 반증검색: `not_searched`
  ※ 반증 검색 전 — 논문에 '공백'으로 쓰지 말 것
- **G04** [medium/phd] HIL/하드웨어 실증 부재 — 전류 제한 스킴의 실제 DSP 구현·샘플링 지연 영향 미검증 ← C05, C14 · 반증검색: `not_searched`
  ※ 반증 검색 전 — 논문에 '공백'으로 쓰지 말 것
- **G05** [high/both] 감발 대신 ESS로 예비력을 확보할 때의 경제성·동특성 비교(PV 단독 감발 vs PV+ESS) 부재 ← C02, C13 · 반증검색: `not_searched`
  ※ 반증 검색 전 — 논문에 '공백'으로 쓰지 말 것

## 내 논문 인용
- phd_proposal / 2. 선행연구 — PV GFM 예비력 운전 (gap_motivation): Pawar 등[x]은 MPP 추정 없이 감발 운전과 GF/LGF 모드 전환으로 PV GFM을 구현했으나, 균일 일사와 평균값 모델 시뮬레이션에 한정되어 모드 전환 경계의 강건성은 정량화되지 않았다.
- phd_proposal / 3. 연구방법 — 비교 기준선 (comparison): 전류 제한 성능 비교에는 [x]의 가변 포화 + rate limiter 방식을 기준선으로 사용한다.

## 🔗 연결 노트
- [[zhan2024industrial]]
