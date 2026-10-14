---
type: literature
cite_key: singh2025gfmdll
ref_num: ""
title: Developing grid-forming converter controller DLL for real-time HIL simulations
authors: [Utkarsh Singh, Ravi Singh, Marjan Popov, Aleksandra Lekić]
corresponding: Aleksandra Lekić (a.lekic@tudelft.nl)
year: 2025
venue: "e+i Elektrotechnik und Informationstechnik (Elektrotech. Inftech.) 142(1):51-70"
doi: 10.1007/s00502-024-01302-0
pdf: [[singh2025gfmdll.pdf]]
pdf_status: have
paper_type: method
target_system: WTG
control_scheme: [VSM (RSC 측 전력동기화 + 무효전력/단자전압 제어), vector control + PLL (GSC, DC 버스 전압 유지), virtual resistance 전류제한, crowbar 보호]
model_order: 미명시
analysis_method: [실시간 시간영역 파형 비교 (RSCAD 내장 제어기 vs 블랙박스 DLL)]
tuning_method: 수동
scr_range: SCR 9 와 20 두 점만. 연속 스윕 없음
xr_range: 미명시 (X/R 이라는 용어가 본문에 한 번도 없다)
validation_level: CHIL
hardware: [RTDS NovaCor + RSCAD, IntervalZero RTX64 RTOS 호스트 PC (Microsoft Visual Studio 빌드), Intel I210 Copper-only Ethernet NIC (드라이버를 RTNALIGB.rtdll 로 교체), NovaCor ETHERNET UDP 포트 + SFP 동선 트랜시버]
extraction_depth: full
dc_ac_coupling: 부분 — DC-link 전압을 GSC 벡터제어가 유지하고 검증 지표로 보고하나(Fig. 33), DC-AC 커플링 자체를 모델링·해석하지는 않는다
pso_params: ""
section: 3. 연구방법 — RTDS CHIL 테스트벤치 구성
tags: [literature, RTDS, real-time simulation, DLL, black box control, cHIL, grid-forming, Type-3 wind turbine, VSM, MIGRATE benchmark, IntervalZero RTX64, UDP]
status: cited
---
# Developing grid-forming converter controller DLL for real-time HIL simulations

## 조건·파라미터
| 항목 | 기호 | 값 | 단위 |
|---|---|---|---|
| Rated generator power |  | 2.2 | MVA |
| Rated turbine power |  | 2.0 | MW |
| PU gen speed at rated turbine speed | WR | 1.2 | pu |
| Rated wind speed | WSR | 12 | m/s |
| Cut-in wind speed | WSCI | 6 | m/s |
| VSM damping constant | D | 150 |  |
| VSM inertia constant | Tj | 10 | s |
| Reactive power reference | Qref | 0 |  |
| DLL 인터페이스 신호 수 |  | 19 입력 / 6 출력 |  |
| UDP_SKT 컴포넌트 신호 한도 |  | 100 |  |

## Claims
### C01 `problem` — auto_checked
▸ 소프트웨어 전용 제어기 모델은 구현·단순화 정도에 따라 제어기 하드웨어에 실제로 들어간 제어 코드와 다를 수 있고, 그 차이가 계통접속 적합성(grid-code compliance) 시험과 상호작용 해석 결과를 갈라놓는다.
▸ 근거: p.1 Sec. 1 Introduction (인쇄 p.51) (assertion)
※ P6 에서 '시뮬레이션 모델과 DSP 펌웨어가 같은 제어기인가'를 따로 증명해야 하는 이유. 다만 이 논문은 문제 제기만 하고 그 차이를 정량화하지는 않는다.

### C02 `problem` — auto_checked
▸ 제어기 하드웨어 복제본(replica)을 쓰는 통상적 CHIL 은 여러 벤더 장비를 한 테스트베드에 모을 때 하드웨어 조달과 지식재산(IP) 문제로 실용적 한계가 있다.
▸ 근거: p.2 Sec. 1 (인쇄 p.52) (assertion)

### C03 `method` — auto_checked
▸ 하드웨어 복제본 대신 실제 제어기 소스코드를 담은 블랙박스 DLL 을 쓰면 벤더 IP 를 보호하면서 PSCAD·PowerFactory·RSCAD·Hypersim·Simulink 등 여러 모델링 환경에 plug-and-play 로 붙일 수 있다 — 단 DLL 이 실시간으로 돌아야 한다는 조건이 붙는다.
▸ 조건: requirement=DLL 이 실시간으로 실행될 것, obstacle=DLL 은 비결정적 Windows OS 기반이라 실시간 시뮬레이션과 본래 비호환
▸ 근거: p.2 Sec. 1 (인쇄 p.52) (assertion)
▸ contradicts → [[#C02]]

### C04 `method` — auto_checked
▸ 제어기 DLL 빌드 절차는 Simulink Embedded Coder 의 시스템 타겟 파일 ert_shrlib.tlc 로 .c/.h 소스 패키지를 생성하고, Visual Studio 의 RTX64 RTDLL 템플릿으로 .lib/.rtdll 을 빌드한 뒤, RTX64 Application(RTSS) 템플릿으로 래퍼를 빌드해 .rtss 실행파일을 만드는 3단계다.
▸ 조건: 원인=RSCAD 모델에는 소스코드 생성 기능이 없어 Simulink 를 경유한다, RTOS=IntervalZero RTX64 SDK + Runtime 이 Windows 와 공존하는 실시간 서브시스템(RTSS)을 추가한다
▸ 근거: p.3 Sec. 2.1, Fig. 1-2 (인쇄 p.53); p.4 Sec. 2.2, Table 1 (생성 코드 파일 7종), Fig. 4 (인쇄 p.54); p.5 Sec. 2.2 1)-7) 단계, Fig. 5-7, 10 (인쇄 p.55); p.7 Sec. 2.2 4)-7) 단계(링커 설정), Fig. 11-12 (인쇄 p.57) (assertion)
※ A6(DSP 펌웨어)·A7(CHIL 인터페이스)에 그대로 쓸 수 있는 유일한 공개 절차. 단 우리 경로는 Simulink→C→RTX64 PC 가 아니라 Simulink/C→Delfino 플래시이므로, 공통인 것은 'Embedded Coder 로 .c/.h 를 뽑아 제어기를 모델 밖으로 꺼낸다'는 앞단뿐이다.

### C05 `method` — auto_checked
▸ RTDS 측 인터페이스는 NovaCor 섀시 뒷면 우하단 ETHERNET UDP 포트(SFP 동선 트랜시버 필요)와 RSCAD 의 _rtds_Ethernet_UDP_SKT 컴포넌트이며, 송신·수신 각각 100개까지 신호를 실을 수 있다. 이 사례에서는 19개 입력과 6개 출력을 주고받았고, 신호 이름은 RSCAD·Simulink 양쪽에서 원래 쓰던 내부 제어 신호 이름을 그대로 썼다.
▸ 수치: DLL 입력 신호=19, DLL 출력 신호=6, UDP_SKT 신호 한도=100
▸ 근거: p.4 Sec. 2.1 (19 입력 / 6 출력) (인쇄 p.54); p.8 Sec. 2.3, Fig. 13 (NovaCor UDP PORT 32), Fig. 14-15 (UDPSKT 컴포넌트·설정) (인쇄 p.58) (assertion)
※ A7 chil_if_spec.md 의 신호 예산 상한(방향당 100) 과 포트 물리 요건(SFP 동선)의 1차 출처. 우리 Delfino 경로는 GTAO/GTAI 아날로그 또는 GTNET 를 쓸 텐데, 이 논문에는 GTNET 가 한 번도 나오지 않는다.

### C06 `method` — auto_checked
▸ 호스트 PC 쪽 실시간 요건은 RTX64 RT-TCP 스택 소켓 사용, IntervalZero 호환 NIC(여기서는 Intel I210 Copper-only), 기본 드라이버를 RTNALIGB.rtdll 로 교체, BIOS 에서 CPU 가상화와 하이퍼스레딩 비활성화, 그리고 IntervalZero 제어판에서 Windows 에 최소 3코어를 남기는 코어 분배다.
▸ 수치: Windows 에 남길 최소 코어 수=3
▸ 조건: connection=NovaCor UDP 포트 ↔ PC NIC 직결(스위치 없이), ip_port=래퍼 코드와 RSCAD UDP_SKT 컴포넌트의 IP·포트 번호가 일치해야 함
▸ 근거: p.9 Sec. 2.3 끝, Fig. 16 (인쇄 p.59) (assertion)
※ A7 의 호스트 환경 체크리스트. 다만 '코어 3개' 는 측정값이 아니라 경험칙이고, 이 설정으로 지연이 얼마가 되는지는 논문이 말하지 않는다(C14 참조).

### C07 `method` — auto_checked
▸ 래퍼(.rtss) 코드는 RTDS 예제 케이스 UDP_SKT_Loopback 의 udpSKT_echo.c 를 출발점으로 삼아, 루프백 부분을 제어기 라이브러리의 step 함수 호출로 바꾸고 초기화·종료 함수를 메인 루프 밖에 두는 식으로 만들었다.
▸ 근거: p.7 Sec. 2.2 8)-10) 단계 (인쇄 p.57); p.8 Sec. 2.2 9)-10) 단계 연속 (인쇄 p.58); p.9 Sec. 2.3 (래퍼 역할: 수신→입력 매핑→step→출력 매핑→송신) (인쇄 p.59) (assertion)
▸ depends_on → [[#C05]]
※ A7 구현 착수점. RTDS 기본 예제가 출발점이라는 사실 자체가 재현 비용을 낮춘다.

### C08 `method` — auto_checked
▸ 블랙박스로 만든 제어 대상은 MIGRATE 벤치마크의 Type-3 DFIG 풍력기에 적용한 VSM(가상동기기) 그리드포밍 제어로, 회전자측 변환기(RSC)가 가상 스윙방정식으로 전력동기화와 내부전압 크기를 잡고 계통측 변환기(GSC)는 PLL 기반 벡터제어로 DC 버스 전압을 유지한다.
▸ 수치: damping constant=150, inertia constant=10s, reactive power reference=0
▸ 조건: GFM_위치=RSC 만 GFM, GSC 는 GFL 유지, 구성요소=VSM 제어 + Q/단자전압 제어 + 중간 전압 제어기 + 내부 전류 제어기(+ crowbar)
▸ 근거: p.12 Sec. 3.1.2, Fig. 21-22 (인쇄 p.62); p.13 Sec. 3.1.2 RSC control (인쇄 p.63); p.14 Sec. 3.1.2 VSM Control and Q Control, Fig. 24-25 (D=150, Tj=10, Qref=0) (인쇄 p.64); p.16 Sec. 3.1.3 GSC control (인쇄 p.66) (assertion)
※ 대상이 DFIG Type-3 풍력이다 — PV+ESS 2단 인버터와 토폴로지·제어구조가 다르다. 그래서 제어 내용은 가져올 것이 없고, 가져올 것은 DLL/CHIL 배선 절차뿐이다.

### C09 `method` — auto_checked
▸ 중간 전압 제어기의 PI 이득은 Ziegler-Nichols 계단응답법으로 초기값을 잡은 뒤 여러 번 반복하며 제어기 거동을 보고 수동으로 다듬었다.
▸ 근거: p.15 Sec. 3.1.2 Intermediate Voltage Controller, Fig. 26-27 (SISO-TOOL) (인쇄 p.65) (assertion)
※ 박사 연구의 PSO 기반 이득 조정과 정면으로 대비되는 기준선 — 이 논문은 최적화 기반 조정을 전혀 쓰지 않는다(본문에 PSO/particle swarm 0회). '수동 조정 대비 PSO' 비교의 인용 근거로 쓸 수 있다.

### C10 `result` — auto_checked
▸ SCR 9(동기기 정지, HVDC 링크 분리) 조건에서 풍속을 9 m/s 에서 12 m/s 로 계단 변화시켰을 때, 블랙박스 DLL 제어기의 응답은 RSCAD 내장 제어기 응답을 따라갔고 유효전력 오차는 약 6%, DC-link 전압 오차는 0.32% 였다.
▸ 수치: SCR=9, 풍속 계단=9→12m/s, 유효전력 오차=~6%, DC-link 전압 오차=0.32%
▸ 조건: SCR=9, disturbance=풍속 9→12 m/s 계단, SG=정지, HVDC=분리, 비교대상=같은 연구진이 RSCAD 안에 구현한 동일 구조 제어기
▸ 근거: p.16 Sec. 4.2 (시험 1 정의) (인쇄 p.66); p.17 Sec. 4.2 본문(오차값) + Fig. 33 (DC-link 전압) (인쇄 p.67); p.18 Fig. 34 (유효전력) (인쇄 p.68) (experiment_hil)
▸ extends → [[pawar2021gfcpv#C14]]
※ DLL 공동시뮬레이션 경로가 6% 수준의 유효전력 차이를 남긴다는 뜻이다. 소신호 감쇠비·고유값 비교에 쓰기에는 큰 오차이고, 원인도 미규명(C12)이다.

### C11 `result` — auto_checked
▸ SCR 20 조건에서 부하를 70 MW 에서 370 MW 로 계단 증가시켰을 때 블랙박스 DLL 과 RSCAD 내장 제어기의 즉시 유효전력 지원 파형은 거의 완전히 겹쳤다.
▸ 수치: SCR=20, 부하 계단=70→370MW
▸ 조건: SCR=20, disturbance=부하 70→370 MW 계단
▸ 근거: p.17 Sec. 4.2 (인쇄 p.67); p.18 Fig. 35 (인쇄 p.68) (experiment_hil)
▸ supports → [[#C10]]

### C12 `limitation` — auto_checked
▸ 저자들은 DLL 과 내장 제어기 사이의 잔차 원인을 '원본은 RSCAD/RTDS, 블랙박스는 MATLAB/Simulink 로 개발되었고, 다중 병렬 CPU(코어) 시뮬레이션 시의 리액턴스 교차결합 같은 실시간 모델 내부 요소는 쉽게 확인할 수 없다'고 설명하며, 확인은 향후 과제로 남겼다.
▸ 조건: 원인_후보=RSCAD vs Simulink 모델링 차이, 다중 코어 병렬 시뮬레이션의 교차결합 리액턴스
▸ 근거: p.17 Sec. 4.2 끝 (인쇄 p.67); p.2 Sec. 1 (같은 실시간 시뮬레이터 안에서도 모델 종류에 따라 편차가 난다는 선행연구 인용 [4,5]) (인쇄 p.52) (assertion)
▸ depends_on → [[#C10]]
※ 우리 CHIL 에서도 모델↔CHIL 편차가 나올 때 '원인 미상' 으로 끝내지 않으려면 교차검증 절차를 우리가 설계해야 한다(G04).

### C13 `limitation` — auto_checked
▸ 저자들이 스스로 꼽은 한계는 두 가지다 — 유료 제3자 소프트웨어(IntervalZero) 라이선스에 종속된다는 점, 그리고 블랙박스 제어기와 계통 모델 사이 통신이 '상대적으로 느린 프로토콜'인 UDP 라는 점이며 더 빠른 프로토콜 검토는 향후 과제로 남겼다.
▸ 근거: p.17 Sec. 5 Conclusion (인쇄 p.67); p.18 Sec. 5 Conclusion 이어짐 (인쇄 p.68) (assertion)

### C14 `limitation` — auto_checked
▸ 이 논문은 DLL↔RTDS 루프의 인터페이스 지연을 측정하지도 모델링하지도 보상하지도 않는다 — 전체 20쪽 전수검색에서 delay·jitter·time-step·sampling 이 각각 0회이고, latency 는 9쪽의 '코어를 최소 3개 Windows 에 남기라'는 정성적 경험칙 두 번뿐이며 왕복 지연의 수치나 보상 알고리즘은 제시되지 않는다.
▸ 조건: 검색범위=본문 1-5장 전체(물리 1-18쪽), 참고문헌·약력 제외하지 않은 20쪽 전수
▸ 근거: p.9 Sec. 2.3 끝 — 본문에서 지연을 언급하는 유일한 대목 (인쇄 p.59); p.17 Sec. 5 — UDP 가 '상대적으로 느리다'는 정성 서술에 그침 (인쇄 p.67) (assertion)
▸ depends_on → [[#C06]]
※ RAG 질의 ⑧('실시간 시뮬레이터와 실물 제어기를 연동한 CHIL 검증 절차')의 gold 로 쓰되 범위를 좁혀야 한다 — 이 논문이 주는 것은 '연결 절차'이고, 루프 지연 보상은 주지 않는다. A7 chil_if_spec.md 의 지연 예산·보상 항목은 다른 출처가 필요하다.

### C15 `limitation` — auto_checked
▸ 검증은 같은 연구진의 RSCAD 내장 제어기를 기준으로 한 2개 시나리오 시간영역 파형 비교뿐이고, 소신호(고유값) 모델과의 교차검증 절차·합격 기준·오차 허용 한계는 정의되지 않는다 — 본문에 eigenvalue·cross-validation 이 0회이고 small-signal 은 참고문헌 제목에서 1회 나올 뿐이다.
▸ 조건: 검증_시나리오_수=2, 기준_모델=동일 연구진의 RSCAD 내장 구현 (독립 기준 아님)
▸ 근거: p.16 Sec. 4.2 (시험 2개의 정의가 검증 전부) (인쇄 p.66); p.17 Sec. 4.2 결과 서술 — 오차 기준 없이 '따라간다'·'겹친다' (인쇄 p.67); p.19 참고문헌 [12] 제목에만 'small-signal' 등장 (인쇄 p.69) (assertion)
▸ supports → [[#C12]]
※ A9(xval_protocol.md)가 이 논문에서 가져올 것이 없다는 뜻이다. 반대로 '모델↔CHIL 교차검증 절차' 자체가 우리 기여로 남을 여지가 있다.

### C16 `definition` — auto_checked
▸ 이 테스트벤치에서 루프 안에 들어간 것은 임베디드 제어기 하드웨어가 아니라 RTX64 로 실시간화한 범용 Windows PC 위의 DLL 이며, 논문 자신도 2.3절 제목과 4.2절에서 이 구성을 'software-in-the-loop (SIL)' 이라 부른다. 초록·키워드·결론은 같은 구성을 cHIL(Control-Hardware-in-the-Loop)이라 부른다.
▸ 조건: 루프내_실체=RTX64 RTSS 상의 .rtdll + .rtss (범용 PC), DSP_FPGA=없음 — 본문에 DSP 0회
▸ 근거: p.1 Abstract · Keywords ('Control-Hardware-in-the-Loop (cHIL)') (인쇄 p.51); p.3 Sec. 2 로드맵 — 'developing the software-in-the-loop (SIL) setup' (인쇄 p.53); p.8 Sec. 2.3 제목 'Developing the software-in-the-loop (SIL) setup' (인쇄 p.58); p.16 Sec. 4.2 — 'interconnected in SIL manner' (인쇄 p.66); p.17 Sec. 5 — 'tested in a control hardware-in-the-loop setup' (인쇄 p.67) (assertion)
※ 우리 Delfino DSP CHIL 과의 차이가 여기서 갈린다. 같은 것: 실시간 시뮬레이터(RTDS) 밖에 제어기를 두고 외부 링크로 I/O 를 주고받는 구조, 신호 매핑·IP 보호 논리. 다른 것: 우리 쪽은 실제 임베디드 타깃이라 고정소수점 연산·ADC 샘플링·PWM 양자화·인터럽트 지터가 추가로 들어가는데, PC 기반 DLL 에는 이 요소가 아예 없다. 따라서 이 논문은 '배선 절차의 선례'이지 'DSP CHIL 의 선례'가 아니다.

### C17 `limitation` — auto_checked
▸ 계통 강도 조건은 SCR 9 와 20 두 점뿐이며 논문은 SCR 9 를 'low SCR value' 라고 부른다. X/R 비는 본문에 한 번도 등장하지 않고 변화시키지도 않는다.
▸ 수치: 검증 SCR=9, 20
▸ 조건: SCR_점=9, 20 (연속 스윕 없음), X/R=미보고·미변화
▸ 근거: p.16 Sec. 4.2 — 'at low SCR value of 9', 'at SCR = 20' (인쇄 p.66); p.10 Sec. 3 — 약계통·저 SCR 과 PLL 비선형성 논의는 서론 수준에 그침 (인쇄 p.60) (assertion)
▸ depends_on → [[#C10]]
▸ depends_on → [[#C11]]
※ 이 저장소의 관용(SCR 1.5~3 이 약계통, X/R 1.0~1.5 가 저 X/R)과 어긋난다 — SCR 9 는 우리 기준으로 강계통이다. 이 논문을 '약계통 CHIL 검증 선례'로 인용하면 안 된다. 반대로 SCR-X/R 강건성 경계를 CHIL 로 스윕한다는 우리 기여는 이 논문에 의해 선취되지 않는다.

### C18 `comparison` — auto_checked
▸ 저자들은 이 방법의 기여를 '실시간 시뮬레이터 플랫폼에 독립적인 방식으로 실제 변환기 제어 소프트웨어를 DLL 형태로 HIL 테스트베드에서 시험하는 새로운 길'이라고 규정하며, 제어 알고리즘 자체의 신규성이나 안정도 해석은 기여로 내세우지 않는다.
▸ 근거: p.18 Sec. 5 Conclusion (인쇄 p.68); p.1 Abstract — 'The DLL contains a previously developed grid-forming controller' (인쇄 p.51) (assertion)
▸ supports → [[#C16]]
※ 신규성 충돌 판정의 근거. 'GFM 제어기를 RTDS 에 외부 제어기로 올려 실시간 검증했다'는 서술 수준의 신규성은 이 논문이 이미 가져갔다(2025년, Type-3 WT, DLL). 우리가 주장할 수 있는 것은 그 윗단이 아니라 ① PV+ESS 2단 토폴로지, ② 22차 소신호 모델과의 교차검증, ③ SCR-X/R 2차원 강건성 경계, ④ PSO 이득 조정, ⑤ 실제 DSP 타깃 — 다섯 가지 한정자다. 'RTDS CHIL 검증' 을 단독 신규성으로 쓰면 이 논문에 걸린다.

## Gaps
- **G01** [high/phd] DLL↔RTDS UDP 루프의 왕복 지연·지터를 정량화하고 보상하는 절차가 없다 — 지연은 '코어 3개' 경험칙으로만 다뤄지고, 지연이 GFM 폐루프 안정도(특히 약계통)에 미치는 영향은 평가되지 않는다. ← C06, C13, C14 · 반증검색: `not_searched`
  ※ 반증 검색 전 — 논문에 '공백'으로 쓰지 말 것
- **G02** [high/phd] 블랙박스 경로가 남긴 유효전력 6% 오차의 원인이 규명되지 않았고, 'DLL 구현이 원본과 같다'고 판정할 허용 오차 기준도 정의되지 않았다. ← C10, C12, C15 · 반증검색: `not_searched`
  ※ 반증 검색 전 — 논문에 '공백'으로 쓰지 말 것
- **G03** [high/phd] 오프라인 소신호(고유값) 모델과 실시간 HIL 결과를 잇는 교차검증 프로토콜이 없다 — 검증이 2개 시나리오의 파형 겹침 확인에 머문다. ← C15, C12 · 반증검색: `not_searched`
  ※ 반증 검색 전 — 논문에 '공백'으로 쓰지 말 것
- **G04** [high/phd] 약계통(SCR 3 이하)과 저 X/R(1.0~1.5) 조건에서의 HIL 검증이 없다 — SCR 2점, X/R 미변화. ← C17, C10, C11 · 반증검색: `not_searched`
  ※ 반증 검색 전 — 논문에 '공백'으로 쓰지 말 것
- **G05** [medium/phd] 실제 임베디드 타깃(DSP/FPGA)이 아니라 PC 기반 RTOS DLL 이라, 고정소수점 연산·ADC 샘플링·PWM 양자화·인터럽트 지터가 제어 성능에 주는 영향은 이 경로로 검증되지 않는다. ← C16, C14 · 반증검색: `not_searched`
  ※ 반증 검색 전 — 논문에 '공백'으로 쓰지 말 것
- **G06** [medium/phd] 제어기 이득 조정이 Ziegler-Nichols + 수동 반복에 머물러, 조정 방법이 HIL 상 응답에 주는 영향(수동 vs 최적화 기반)은 비교되지 않았다. ← C09 · 반증검색: `not_searched`
  ※ 반증 검색 전 — 논문에 '공백'으로 쓰지 말 것

## 내 논문 인용
- phd_proposal / 3. 연구방법 — RTDS CHIL 테스트벤치 구성 (method_basis): 실시간 시뮬레이터 외부에 제어기를 두는 구성은 Singh 등[x]이 RTDS NovaCor 의 UDP 포트와 RSCAD _rtds_Ethernet_UDP_SKT 컴포넌트를 통해 제어기 DLL 을 연결한 절차를 따른다.
- phd_proposal / 2. 선행연구 — GFM 제어기의 실시간 검증 (gap_motivation): Singh 등[x]은 GFM 제어기를 블랙박스 DLL 로 만들어 RTDS 와 실시간 공동시뮬레이션하는 절차를 제시했으나, 루프 내 실체는 임베디드 제어기가 아닌 RTOS 기반 PC 이고, 검증은 SCR 9·20 두 조건의 파형 비교에 그쳐 인터페이스 지연 보상과 소신호 모델과의 교차검증은 다루지 않는다.
