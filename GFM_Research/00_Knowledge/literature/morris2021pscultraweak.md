---
type: literature
cite_key: morris2021pscultraweak
ref_num: ""
title: "Power-Synchronization Control for Ultra-Weak AC Networks: Comprehensive Stability and Dynamic Performance Assessment"
authors: [Jennifer F. Morris, Khaled H. Ahmed, Agustí Egea-Àlvarez]
corresponding: Jennifer F. Morris (jennifer.f.morris@strath.ac.uk)
year: 2021
venue: IEEE Open Journal of the Industrial Electronics Society, vol. 2, pp. 441-450, 2021
doi: 10.1109/OJIES.2021.3103278
pdf: [[morris2021pscultraweak.pdf]]
pdf_status: have
paper_type: analysis
target_system: 일반
control_scheme: [PSC (power-synchronization control), PSL (유효전력 오차 적분 동기화, PLL 없음), AVL (PCC 전압크기 적분제어), 고역통과 전류필터(HPF) 능동댐핑]
model_order: 미명시
analysis_method: [소신호 고유값 해석, 극점지도(근궤적), 폐루프 보드선도, 시간영역 계단응답]
tuning_method: 수동
scr_range: SCR = 1 이 기본 시험계통. 강건성 절(V-C, Fig. 16)에서 SCR = 1, 2, 3 비교 — 전부 소신호 해석이다. CHIL 실험은 SCR = 1 하나뿐. SCR < 1 은 다루지 않았다.
xr_range: X/R = 10 단일 고정값 (Appendix A). 해석에서도 CHIL 에서도 X/R·임피던스 각도를 변수로 바꾸지 않았다.
validation_level: CHIL
hardware: [RTDS, TI C2000 Real-Time controller (세부 모델명 미명시), RSCAD, MATLAB/Simulink external mode 인터페이스]
extraction_depth: full
dc_ac_coupling: 아니다 — Fig.1 에 2레벨 VSC 의 DC 커패시터가 그려져 있을 뿐, 소신호 모델(Fig.2) 과 부록 B 의 상태공간에 DC 측 상태변수가 하나도 없다. DC 전압은 사실상 고정 전원으로 취급된다.
pso_params: ""
section: ""
tags: [literature, power-synchronization control, PSC, VSC, ultra-weak grid, SCR=1, small-signal stability, stable tuning region, CHIL, RTDS, high-pass current filter, VSC-HVDC]
status: read
---
# Power-Synchronization Control for Ultra-Weak AC Networks: Comprehensive Stability and Dynamic Performance Assessment

## 조건·파라미터
| 항목 | 기호 | 값 | 단위 |
|---|---|---|---|
| AC 계통 정격전압(RMS 선간) | Ug | 195 | kV |
| AC 계통 정격용량 |  | 350 | MW |
| 계통 주파수 |  | 50 | Hz |
| 단락비 | SCR | 1 |  |
| 계통 X/R 비 | X/R | 10 | - |
| 계통 인덕턴스 | Ln | 344 | mH |
| 계통 저항 | Rn | 10.86 | Ω |
| 결합 인덕턴스 | Lc | 69.2 | mH |
| 결합 저항 | Rc | 1.09 | Ω |
| PSL 적분이득 기본값 | kp | 2.5e-7 | rad/Ws |
| AVL 적분이득 기본값 | ku | 50 |  |
| HPF 이득 기본값 | kv | 60 | V/A |
| HPF 차단주파수 | αv | 40 | rad/s |

## Claims
### C01 `problem` — auto_checked
▸ 기존 PSC 평가는 제어기 동작점 하나에서만 수행되어 PSL·AVL·HPF 이득이 서로 맞물려 만드는 결합 효과와 그것이 최대 전력전송에 미치는 영향이 평가되지 않았다.
▸ 근거: p.2 인쇄 p.442 / Sec. I (Introduction), 좌·우단 (literature)
※ 내가 PSO 로 다파라미터 동시 조정을 하려는 동기와 같은 문제의식이다. 다만 저자들의 해법은 최적화가 아니라 전수 격자 스윕이다 (C02).

### C02 `method` — auto_checked
▸ 제어이득 kp·ku·kv 중 둘을 동시에 격자 스윕하면서 각 조합마다 소신호 모델을 새로 선형화하고, 고유값이 안정인지로 이분법 탐색하여 그 조정점의 유효전력 전송한계 P_lim 을 구하는 절차를 제안한다.
▸ 수치: PSL 이득 탐색범위=0.5e-7 – 15e-7rad/Ws, AVL 이득 탐색범위=0.1 – 1000, HPF 이득 탐색범위=0 – 500V/A
▸ 조건: 탐색범위=Table 2, 모드=인버팅·정류 양방향, 이분법 종료조건=|Pn - Pn-1| < 0.001
▸ 근거: p.4 인쇄 p.444 / Sec. IV, Fig. 4 (흐름도), Table 2 (Operating Point Ranges); p.4 인쇄 p.444 / Table 1 (Default Controller Tuning Parameters) (analytical)
※ 내 88포인트 SCR–X/R 스윕과 구조가 비슷하지만 축이 반대다. 저자는 제어이득 격자를 돌고 계통조건을 고정했고, 나는 계통조건 격자를 돌려 왔다. 두 축을 한 공간에서 합친 결과는 이 논문에 없다 (G04).

### C03 `assumption` — auto_checked
▸ 시험 AC 계통은 SCR = 1, X/R = 10 의 단일 조건으로 고정되어 있으며, 이 X/R 값은 논문 전체에서 한 번도 바뀌지 않는다.
▸ 수치: 단락비=1, 계통 X/R 비=10, 계통 인덕턴스=344mH, 계통 저항=10.86Ω
▸ 조건: SCR=1, X/R=10, 전압=195 kV, 용량=350 MW
▸ 근거: p.9 인쇄 p.449 / Appendix A (AC Grid Parameters); p.2 인쇄 p.442 / Sec. II (Study System), 우단 (analytical)
※ 결정적이다. X/R = 10 은 송전급(HVDC) 유도성 계통이다. 내 연구가 겨냥하는 X/R 1.0~1.5 의 배전·PV 연계 저항성 계통과 한 자릿수 차이로 다른 영역이다. 이 논문은 저 X/R 영역을 건드리지 않았다. 볼트 대조: X/R 을 실제로 낮춰 본 것은 해석 쪽뿐이다 — [[chen2026lcl_slgfm#C09]] 가 Xg/Rg 10→2 근궤적을, [[chen2025slgfmopenloop#C10]] 가 Xg/Rg 17 과 6 두 점을 본다. 둘 다 CHIL 이 아니다.

### C04 `assumption` — auto_checked
▸ DC 측 동역학은 모델에 없다 — 회로도에 2레벨 VSC 의 DC 커패시터만 그려져 있을 뿐, 소신호 모델과 부록 상태공간 어디에도 DC-link 전압이나 DC 전원(PV·ESS) 상태변수가 없다.
▸ 조건: DC 전원=모델링하지 않음, DC-link 전압=상태변수 아님
▸ 근거: p.3 인쇄 p.443 / Fig. 1 (Grid-connected VSC test system) 우측 DC 단, Fig. 2 (Connected small-signal model); p.9 인쇄 p.449 / Appendix B (State Space Small-Signal Model), Eq. (10)-(13) (analytical)
※ 내 22차 2단 PV+ESS 모델의 핵심인 DC-AC 커플링이 여기엔 아예 없다. 따라서 이 논문의 안정영역은 'DC 가 완전히 뻣뻣하다' 는 가정 아래의 결과이고, 내 2단 구조에 그대로 옮길 수 없다 (G02). 볼트 대조: [[chen2026lcl_slgfm#C12]] 는 DC-link 전압이 무효전력 루프와 결합해 불안정이 DC·AP 루프로 번지는 경로를 보였고, [[pawar2021gfcpv#C03]] 은 2단 PV 에서 DC-DC 가 DC-link 를 쥐는 구조를 다룬다 — Morris 모델에는 그 경로가 통째로 없다.

### C05 `method` — auto_checked
▸ 소신호 모델은 계통·RL 필터 4상태(ic_dq, in_dq), PSL·AVL 적분기 2상태, HPF d·q 2상태로 구성되고 측정 저역통과필터 상태가 추가되지만, 전체 모델 차수는 논문 어디에도 명시되어 있지 않다.
▸ 조건: 계통·RL 상태=ic_d, ic_q, in_d, in_q (Eq. 1-4), 외부루프 상태=ΔeP, ΔeU (Eq. 10-11), 전압제어·HPF 상태=d·q 각 1개, 극 -αv (Eq. 12-13), LPF 상태 개수=미명시, LCL-AC 계통 상태공간 출처=참고문헌 [7] (Zhang 학위논문)
▸ 근거: p.3 인쇄 p.443 / Sec. III-A, Eq. (1)-(9); p.9 인쇄 p.449 / Appendix B, Eq. (10)-(13) (analytical)
※ 내 22차와 직접 비교하려면 차수를 알아야 하는데 이 논문은 그것을 밝히지 않는다. 명시적으로 센 상태만 8개이고, 내 모델 대비 DC 측·전류루프·필터 커패시터가 전부 빠져 있다.

### C06 `result` — auto_checked
▸ PSL 과 AVL 대역폭을 둘 다 낮출수록 PSC-VSC 의 최대 유효전력 전송한계가 증가한다.
▸ 수치: 인버팅 모드 도달 가능 전력한계=-1.0p.u., 정류 모드 도달 가능 전력한계=0.95p.u.
▸ 조건: SCR=1, X/R=10, 모드=인버팅·정류 모두 같은 정성적 경향
▸ 근거: p.5 인쇄 p.445 / Sec. IV-A, Fig. 5 (Maximum active power transfer with varying AVL and PSL bandwidths); p.5 인쇄 p.445 / Sec. IV-A, Fig. 6 (analytical)
※ '느린 동기화가 안정적' 이라는 경향 자체는 내 VSG 관성 J·댐핑 Dp 스윕 결과와 방향이 같다. 다만 여기 전력한계는 X/R=10 고정 결과다.

### C07 `result` — auto_checked
▸ HPF 이득 kv 는 대략 10–200 V/A 의 좁은 띠 안에 있어야 안정 전력한계가 최대가 된다 — kv 가 그보다 크면 고역통과필터가 계통주파수 공진은 감쇠시키지만 필터 차단주파수 부근에 더 낮은 주파수의 공진을 새로 만들어 그쪽이 지배적이 된다.
▸ 수치: 안정 HPF 이득 권장범위=10 – 200V/A, HPF 차단주파수=40rad/s, 감쇠 대상 공진주파수=50Hz
▸ 조건: SCR=1, X/R=10, 보드선도 스윕범위=0 < kv < 150 V/A, 나머지 이득은 Table 1 기본값
▸ 근거: p.5 인쇄 p.445 / Sec. V-A-2, Fig. 6, Fig. 7; p.6 인쇄 p.446 / Fig. 8 (폐루프 전력응답 보드선도, kv 가변); p.9 인쇄 p.449 / Sec. VII (Conclusion) (analytical)
▸ depends_on → [[#C03]]
※ 댐핑 이득에 상한과 하한이 동시에 존재하고 그 사이가 좁다는 구조는 내 PSO 탐색범위 설정과 직결된다. 다만 저항성 계통(X/R 1~1.5)에서는 계통 자체 저항이 댐핑을 주므로 이 띠의 위치·폭이 달라질 것이다 — 이 논문은 그걸 확인하지 않았다. 볼트 대조: [[zhao2024lowfreqres#C09]] 는 droop 이득 상한이 대략 계통 저항의 2배로 제한된다고 보고, [[zhao2024lowfreqres#C10]] 는 가상저항과 droop 이득을 짝지어 설계한다 — 저항이 커지면(X/R 이 낮아지면) 이 띠가 어디로 가는지 묻게 만드는 근거다. Morris 는 그 방향을 보지 않았다.

### C08 `result` — auto_checked
▸ PSL·AVL 모두 중간 대역폭 구간에서 최대 전송전력이 오히려 떨어지는 골짜기가 생긴다 — AVL 의 경우 지배 극쌍이 대역폭 증가에 따라 우반면으로 갔다가 되돌아오기 때문이다.
▸ 수치: PSL 전송전력 저하 구간=약 5 – 60Hz, AVL 전송전력 저하 구간=약 5 – 35Hz, 극점지도 AVL 이득 스윕범위=0.1 – 1000
▸ 조건: SCR=1, X/R=10
▸ 근거: p.5 인쇄 p.445 / Sec. IV-A, Fig. 6, Fig. 7; p.6 인쇄 p.446 / Sec. V-A-3, Fig. 9 (Pole map, AVL 이득 가변) (analytical)
※ 안정영역이 단일 연결 볼록집합이 아니라는 증거다. 내 PSO 가 국소최적에 빠질 위험의 근거로 쓸 수 있다 — 느린 쪽과 빠른 쪽에 각각 안정 섬이 있고 가운데가 불안정하다.

### C09 `definition` — auto_checked
▸ 저자들이 말하는 '안정 조정영역(stable tuning region)' 은 세 축이 모두 제어이득인 3차원 체적이다 — kp(PSL 적분이득), ku(AVL 적분이득), kv(HPF 이득). 계통 파라미터는 축이 아니라 체적을 다시 계산할 때의 케이스 라벨로만 들어간다.
▸ 수치: x축=0 – 1000, y축=0 – 400 이상V/A, z축=0 – 1.5e-6rad/Ws
▸ 조건: 영역 정의=-1.0 p.u. < P < 0.85 p.u. 전 구간에서 안정한 제어이득 조합 전부, 0.85 p.u. 선택 근거=-1.0 p.u. 전송 시와 같은 과전압(약 1.15 p.u.)에 대응
▸ 근거: p.6 인쇄 p.446 / Sec. V-B, Fig. 10 (PSC parameters for stable operation at -1.0 < P < 0.85 p.u. in SCR = 1 AC grid); p.7 인쇄 p.447 / Fig. 15 (두 전력수준의 체적 중첩) (analytical)
※ 내 SCR–X/R 평면 강건성 경계와는 다른 종류의 그림이다. 저쪽은 제어파라미터 공간, 내 쪽은 계통파라미터 평면이다. 둘이 겹치지 않으므로 내 그림이 중복이 되지는 않는다.

### C10 `result` — auto_checked
▸ Fig. 10 안정영역의 경계 위치를 RTDS CHIL 실험 두 점에서 검증했다 — 영역 안에서 밖으로 이득을 밀면 PCC 전압과 변환기 전류가 실제로 발산한다.
▸ 수치: 점(a) 안정측=kp = 3.5e-7, kv = 64, ku = 1000, 점(a) 불안정측=kp = 4.5e-7, kv = 64, ku = 1000, 점(b) 안정측=kp = 0.5e-7, kv = 300, ku = 1, 점(b) 불안정측=kp = 0.5e-7, kv = 320, ku = 1
▸ 조건: SCR=1, X/R=10, 검증점 개수=2, 검증 대상=Fig. 10 경계(안정/불안정 전환)만. 영역 내부 전역이 아니다
▸ 근거: p.7 인쇄 p.447 / Table 3 (Controller Parameters At Stability Boundary); p.7 인쇄 p.447 / Fig. 13 (CHiL experimental results within (blue) and outside (red) the stable tuning region); p.6 인쇄 p.446 / Sec. V-B 본문 (experiment_hil)
▸ supports → [[#C09]]
▸ depends_on → [[#C03]]
※ CHIL 로 '경계 양쪽 두 점' 만 찍어 검증하는 방식이다. 경계 전체나 계통조건 변화에 대한 CHIL 검증은 아니다. 내 CHIL 계획이 이보다 조밀한 검증을 한다면 거기에 차별점이 있다.

### C11 `limitation` — auto_checked
▸ CHIL 실험은 SCR = 1, X/R = 10 이라는 단 하나의 계통조건에서만 수행되었다 — CHIL 에서 SCR 도 X/R 도 변수로 바꾸지 않았고, 특히 X/R(또는 임피던스 각도)은 논문 전체에서 단 한 번도 바뀌지 않는다.
▸ 조건: CHIL 계통조건=SCR = 1, X/R = 10 단일, CHIL 에서 변화시킨 것=제어이득 kp 또는 kv 하나씩, X/R 스윕=없음(해석·실험 모두), SCR 스윕=소신호 해석에서만 1, 2, 3
▸ 근거: p.9 인쇄 p.449 / Appendix A — 계통 파라미터가 단일 조합으로만 주어진다; p.7 인쇄 p.447 / Table 3 — CHIL 검증점 네 줄 모두 제어이득만 다르고 계통조건 열이 없다; p.8 인쇄 p.448 / Sec. V-C, Fig. 16 — SCR 1/2/3 비교는 '원래의 안정영역을 다른 SCR 에서 다시 계산한' 소신호 결과이고 CHIL 이 아니다; p.9 인쇄 p.449 / Sec. VII (Conclusion) — 'The boundary of this stable operating space is validated with CHiL RTDS experiments' 외에 계통조건 변화 실험 언급 없음 (?)
▸ depends_on → [[#C03]]
▸ depends_on → [[#C10]]
▸ depends_on → [[#C12]]
※ 내 공백 주장의 생사가 걸린 항목이다. 결론: 이 논문은 내 'X/R 1.0~1.5 로 내린 CHIL 검증이 없다' 는 주장을 무너뜨리지 않는다. 오히려 그 반대 방향의 증거다 — PSC CHIL 의 대표 사례조차 X/R = 10 송전급 한 점에 머물러 있다. 다만 주장을 쓸 때 'SCR 을 CHIL 로 낮춘 사례가 없다' 로는 쓸 수 없다. 이 논문이 SCR = 1 CHIL 을 이미 했기 때문이다. 주장의 칼날은 SCR 이 아니라 X/R 에 두어야 한다. 볼트 대조: [[singh2025gfmdll#C17]] 도 SCR 두 점만 보고 X/R 은 본문에 한 번도 쓰지 않는다. [[zhao2024lowfreqres#C25]] 역시 SCR 이산 3점에 그친다 — 저 X/R 검증 부재가 이 논문만의 사정이 아님을 보강한다.

### C12 `result` — auto_checked
▸ SCR = 1, 2, 3 각각에 대해 안정영역을 다시 계산하면 세 체적은 상당 부분 겹치지만 어느 것도 다른 것을 완전히 포함하지 않으며, SCR 이 커질수록 안정한 PSL 대역폭 범위는 넓어지는 대신 전체 안정 체적은 줄어든다.
▸ 수치: 비교한 SCR 값=1, 2, 3, 높은 SCR 에서 불안정화를 일으키는 HPF 이득=≳ 150V/A
▸ 조건: 검증한 SCR=1, 2, 3, X/R=세 경우 모두 10 으로 추정 — 논문은 SCR 만 바꾼다고 적었고 X/R 변경 언급이 없다, 방법=소신호 고유값 해석 (CHIL 아님), 전력범위=-1.0 p.u. < P < 0.85 p.u.
▸ 근거: p.8 인쇄 p.448 / Sec. V-C (Robustness), Fig. 16 (SCR = 1 yellow, SCR = 2 cyan, SCR = 3 blue); p.9 인쇄 p.449 / Sec. VII (Conclusion) (analytical)
▸ extends → [[#C09]]
※ SCR 하한은 1 이고 그마저 소신호 해석이다. 'SCR 을 1 까지 내린 PSC 소신호 해석' 은 이미 존재하므로 내 공백 주장에서 SCR 단독은 빼야 한다. 또한 'SCR 이 높을수록 GFM 이 어렵다' 는 설명(PCC 전압이 뻣뻣해져 두 전압원이 작은 임피던스로 붙는 꼴)은 내 결과 해석에도 쓸 수 있다.

### C13 `result` — auto_checked
▸ 동특성 요구(오버슈트·정정시간)를 안정 조건에 더하면 안정영역이 눈에 띄게 줄어들고, 줄어드는 쪽은 주로 PSL 이득의 상한이다 — 빠른 PSL 이 큰 오버슈트를 만들기 때문이다.
▸ 수치: moderate 오버슈트 한계=20%, moderate 정정시간 한계=0.75s, good 오버슈트 한계=10%, good 정정시간 한계=0.5s
▸ 조건: 'moderate' 기준=OS < 20%, 2% 정정시간 < 0.75 s, 'good' 기준=OS < 10%, 2% 정정시간 < 0.50 s, 입력=유효전력 지령 단위 계단, 전력수준=-1.0 p.u. 및 0.85 p.u.
▸ 근거: p.8 인쇄 p.448 / Sec. V-D, Fig. 17 (안정(백색)/moderate(연청)/good(진청) 3중 체적); p.7 인쇄 p.447 / Fig. 14 (kp 변화에 따른 0.02 p.u. 계단응답, 비최소위상 거동 확대도 포함) (analytical)
▸ extends → [[#C09]]
※ 안정도만이 아니라 정정시간·오버슈트를 목적함수에 넣는 내 PSO 목적함수 설계와 같은 문제다. 저자는 가중합 대신 '영역을 깎는' 제약 방식을 썼다 — 비교 대상으로 쓸 수 있다. 저자의 2% 정정시간 기준값(0.50/0.75 s)은 내 정정시간 기준 조사노트와 대조할 수치다.

### C14 `result` — auto_checked
▸ Fig. 17 의 good / moderate / poor 세 조정점에서 계단응답을 CHIL 로 실측해 세 등급의 차이를 확인했다.
▸ 수치: good 등급 조정=kp = 1e-7, kv = 50, ku = 50, moderate 등급 조정=kp = 2.5e-7, kv = 50, ku = 50, poor 등급 조정=kp = 5e-7, kv = 50, ku = 50
▸ 조건: SCR=1, X/R=10, 고정이득=kv = 50, ku = 50, 변화시킨 것=kp 만
▸ 근거: p.9 인쇄 p.449 / Table 4 (Controller Parameters At Fig. 17 Marked Points); p.9 인쇄 p.449 / Fig. 18 (CHiL experimental results for dynamic performance validation: (a) 변환기 유효전력, (b) PCC 전압) (experiment_hil)
▸ supports → [[#C13]]
※ CHIL 검증점이 통틀어 6개(경계 4 + 동특성 3 중 일부 중복)에 불과하다. 조밀한 CHIL 검증은 여전히 열려 있다.

### C15 `result` — auto_checked
▸ 변환기를 과정격(전압 1.2 p.u., 피상전력 1.35 p.u.) 허용하면 정류모드 0.95 p.u. 까지 안정 전송이 가능한 조정영역이 존재하지만, 그 전력수준에서는 'moderate' 조차 만족하는 제어점이 하나도 없다.
▸ 수치: 정류모드 최대 전송전력=0.95p.u., 변환기 전압 과정격 한계=1.2p.u., 피상전력 과정격 한계=1.35p.u., 0.95 p.u. 에서 동특성 기준 만족 제어점 수=0
▸ 조건: 과정격 한계=변환기 전압 1.2 p.u., 피상전력 1.35 p.u., SCR=1, X/R=10
▸ 근거: p.7 인쇄 p.447 / Sec. V-B, Fig. 15 (두 전력수준 안정체적 비교); p.9 인쇄 p.449 / Sec. V-D 끝 (analytical)
※ 초약계통 정류모드의 한계가 결국 무효전력 요구에 걸린다는 지적은 X/R 이 낮아지면 완화될 수 있는 부분이다 — 저항성 계통에서는 유효전력이 각이 아니라 크기에 더 실린다. 이 논문은 그 방향을 보지 않았다.

### C16 `comparison` — auto_checked
▸ AVL 을 느리게 할수록 안정도가 좋아진다는 이 논문의 결과는 AVL 대역폭 증가가 시스템 댐핑을 늘린다고 보고한 선행연구 [23] 과 상반되며, 저자는 HPF 튜닝이 다른 루프의 영향을 '덮어쓸' 만큼 지배적이기 때문으로 설명한다.
▸ 조건: 상반되는 선행연구=[23] K. M. Alawasa and Y. A.-R. I. Mohamed, IEEE Trans. Power Syst., vol. 30, no. 2, pp. 952-961, 2015, 저자 설명=HPF 튜닝의 지배성 — 근거 데이터는 제시하지 않고 'likely due to' 로 서술
▸ 근거: p.5 인쇄 p.445 / Sec. IV-A (assertion)
▸ depends_on → [[#C07]]
※ 문헌 간 상충이 아직 정리되지 않은 지점이다. 내 리뷰에서 'AVL/전압루프 대역폭의 안정도 효과는 능동댐핑 설정에 따라 부호가 바뀐다' 는 식으로 양쪽을 나란히 쓸 근거가 된다.

### C17 `limitation` — auto_checked
▸ 계통 임피던스가 변하면 안정영역 자체가 이동하므로, 계통 파라미터 추정이 부정확하면 잘못 조정된 PSC 가 불안정해질 수 있다 — 약계통에서는 작은 임피던스 오차가 큰 전압각 차이를 낳아 영향이 특히 크다.
▸ 조건: 방향성=SCR 과대추정(임피던스 과소추정)에는 비교적 강건, SCR 과소추정에는 취약
▸ 근거: p.8 인쇄 p.448 / Sec. V-C; p.9 인쇄 p.449 / Sec. VII (Conclusion) (analytical)
▸ depends_on → [[#C12]]
※ 고정 이득 PSC 의 구조적 약점을 저자 스스로 인정한 문장이다. 적응형·온라인 재조정 또는 넓은 SCR-X/R 구간에서 공통으로 안정한 이득을 찾는 내 PSO 접근의 동기로 직접 인용할 수 있다.

### C18 `limitation` — auto_checked
▸ 고장 조건과 전류제한은 범위 밖이다 — 고장 시 백업 PLL 과 전류제어기를 쓴다고만 언급하고 모델·그림에서 제외했다.
▸ 근거: p.3 인쇄 p.443 / Sec. II (Study System) 끝 (analytical)
※ 내 연구도 소신호 범위이므로 같은 한계를 공유한다. 과도·전류제한 영역은 양쪽 모두 열려 있다.

### C19 `method` — auto_checked
▸ CHIL 구성은 RTDS 안에 2레벨 변환기와 AC 계통을 두고, 외부 TI C2000 실시간 제어기에 PSC 제어기와 SPWM 을 둔 형태다 — RTDS 가 Uf,abc·Ic,abc 를 아날로그로 내보내 제어기 ADC 가 받고, 제어기는 발사펄스를 RTDS 로 되돌린다.
▸ 조건: RTDS 측=2레벨 변환기 + AC 계통, 하드웨어 측=TI C2000 Real-Time controller — ADC, 제어기, SPWM, 인터페이스 신호=RTDS→제어기: Uf,abc, Ic,abc (아날로그) / 제어기→RTDS: 발사펄스, 프로그래밍=RSCAD + Simulink/C++, MATLAB/Simulink external mode 인터페이스, 인터페이스 지연 보상=미명시, 시뮬레이션 시간스텝=미명시, 제어기 세부 모델명=미명시
▸ 근거: p.6 인쇄 p.446 / Sec. V-B 본문, Fig. 11 (RTDS and control hardware-in-the-loop test setup, 실물 사진); p.7 인쇄 p.447 / Fig. 12 (Schematic of the CHiL setup and signal routing between the microcontroller and RTDS) (experiment_hil)
※ 내 A7(CHIL 인터페이스) 설계의 선행 사례다. 경계를 '발사펄스 + 아날로그 측정' 에 둔 전형적 CHIL 이고, 지연 처리를 논문에 적지 않았다는 점은 내 chil_if_spec 이 지연 예산을 명시하면 그 자체로 차별점이 된다는 뜻이기도 하다. 볼트 대조: [[singh2025gfmdll#C14]] 도 DLL↔RTDS 루프의 인터페이스 지연을 측정·보상하지 않는다 — RTDS 계열 CHIL 논문에서 지연 예산을 적지 않는 것이 일반적임을 보여 준다.

## Gaps
- **G01** [high/phd] PSC 의 CHIL 검증이 X/R = 10 송전급 계통 한 점에서만 이뤄졌다. X/R 을 배전·PV 연계 수준(1.0~1.5)으로 낮췄을 때 안정 조정영역이 어디로 이동하는지, 그 경계가 CHIL 에서 재현되는지는 이 논문에 없다. (관련: [[singh2025gfmdll#C17]], [[chen2026lcl_slgfm#C09]]) ← C03, C10, C11 · 반증검색: `not_searched`
  ※ 반증 검색 전 — 논문에 '공백'으로 쓰지 말 것
- **G02** [high/phd] DC 측이 모델에 없다. DC-link 전압 동역학과 PV·ESS 전단 변환기를 포함한 2단 구조에서 DC-AC 커플링이 안정 조정영역을 얼마나 좁히는지는 이 논문의 결과로 말할 수 없다. (관련: [[chen2026lcl_slgfm#C12]], [[pawar2021gfcpv#C03]]) ← C04, C05 · 반증검색: `not_searched`
  ※ 반증 검색 전 — 논문에 '공백'으로 쓰지 말 것
- **G03** [medium/phd] 안정영역 탐색이 제어이득 전수 격자 스윕이고 영역 안에서 동작점을 고르는 체계적 선정법이 없다 — 저자도 '영역을 제시' 할 뿐 최적점 선정은 사용자에게 남긴다. 동특성·강건성을 함께 거는 다목적 최적화(PSO 등) 적용은 열려 있다. ← C02, C13 · 반증검색: `not_searched`
  ※ 반증 검색 전 — 논문에 '공백'으로 쓰지 말 것
- **G04** [medium/phd] 안정영역의 축이 제어이득 셋뿐이고 계통 파라미터(SCR, X/R)는 체적을 다시 그릴 때의 케이스 라벨로만 들어간다. 제어축과 계통축을 한 공간에 놓고 강건 경계를 직접 그린 결과가 없다. ← C09, C12 · 반증검색: `not_searched`
  ※ 반증 검색 전 — 논문에 '공백'으로 쓰지 말 것
- **G05** [low/phd] AVL 대역폭의 안정도 효과가 이 논문과 선행연구 [23] 사이에서 부호가 반대인데, 저자의 'HPF 가 덮어쓴다' 는 설명은 가설로만 제시되고 검증되지 않았다. ← C16 · 반증검색: `not_searched`
  ※ 반증 검색 전 — 논문에 '공백'으로 쓰지 말 것

