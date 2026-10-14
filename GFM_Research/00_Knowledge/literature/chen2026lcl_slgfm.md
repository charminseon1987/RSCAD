---
type: literature
cite_key: chen2026lcl_slgfm
ref_num: ""
title: LCL Resonance Analysis and Damping in Single-Loop Grid-Forming Wind Turbines
authors: [Meng Chen, Yufei Xi, Frede Blaabjerg, Lin Cheng, Ioannis Lestas]
corresponding: Yufei Xi
year: 2026
venue: IEEE Transactions on Industrial Electronics (early access) — vol./no./pp. 미검증
doi: 10.1109/TIE.2026.3692859
pdf: [[chen2026lcl_slgfm.pdf]]
pdf_status: have
paper_type: analysis
target_system: WTG
control_scheme: [SL-GFM (단일루프), droop-I (q-V 적분형 무효전력 제어), swing-equation 기반 유효전력 제어, 능동댐핑 (커패시터 전압 피드백)]
model_order: 미명시
analysis_method: [고유값·근궤적, 파라미터 감도해석, 개루프 주파수응답(Bode/Nyquist), 축소 하드웨어 실험 + FFT]
tuning_method: 수동
scr_range: Lg 를 0.2 → 0.5 p.u. 로 스윕. 논문이 SCR 로 환산해 밝힌 값은 Lg=0.5 p.u. = SCR 2 한 점뿐이다 (p.9 Step 1). SCR 평면 스윕은 없다.
xr_range: Table I 은 Xg/Rg = 6 고정. Fig.10 에서만 Xg/Rg 를 10 → 2 로 낮춰 근궤적을 그린다. 상세 TF 유도와 AD 설계는 Rg = 0 (최악조건) 가정이다. X/R < 2 구간은 다루지 않는다.
validation_level: 실기
hardware: [dSPACE DS1007, 3 kW/200 V 축소 AC/DC + DC/AC 변환기, 그리드 시뮬레이터, 오실로스코프]
extraction_depth: full
dc_ac_coupling: true
pso_params: ""
section: ""
tags: [literature, SL-GFM, droop-I, LCL-resonance, active-damping, nonminimum-phase, PMSG-WT, capacitor-voltage-feedback, weak-grid]
status: read
---
# LCL Resonance Analysis and Damping in Single-Loop Grid-Forming Wind Turbines

## 조건·파라미터
| 항목 | 기호 | 값 | 단위 |
|---|---|---|---|
| 정격 DC 전압 | Vdcn | 1200 (1 p.u.) | V |
| 스위칭 주파수 | fsw | 5 | kHz |
| 샘플링 주파수 | fs | 10 | kHz |
| 필터 커패시턴스 | Cf | 1.6 mF (0.048 p.u.) | mF |
| 인버터측 필터 인덕턴스 | Lf | 32 µH (0.1 p.u.) | µH |
| 계통측 필터 + 선로 인덕턴스 | Lg | 60 µH (0.2 p.u.) | µH |
| 선로 X/R 비 | Xg/Rg | 6 | - |
| DC-link 커패시턴스 | Cdc | 0.3 F (27 p.u.) | F |
| 관성정수 | H | 0.5 | s |
| 유효전력 제어 감쇠 | Dp | 50 | - |
| q-V 드룹 계수 | Dq | 10 | - |
| q-V 적분이득 | kq | 4 | - |
| DC 전압 PI 이득 | kpdc / kidc | 3.8 / 63.8 | - |
| LCL 공진주파수(Table I 기준) | fres | 871 | Hz |
| 설계된 AD 이득 | kd | 3.3e-6 | - |
| 설계된 AD 시정수 | Td | 8e-5 | s |
| 실험 축소 정격 | - | 3 kW / 200 V | - |

## Claims
### C01 `problem` — auto_checked
▸ GFL·GFM 공진 연구는 고주파 공진 근방에서 시스템이 개루프 안정(최소위상)이라고 가정해 왔고, 그 위에서 고전적 루프셰이핑과 이득·위상 교차조건으로 안정여유를 판정하고 능동댐핑을 설계해 왔다.
▸ 근거: p.1 Sec. I (마지막 문단) (literature)

### C02 `problem` — auto_checked
▸ 단일루프(SL) GFM 에서 통상 드룹 제어는 필터 파라미터·운전 전류·가상임피던스에 드룹 특성이 흔들려, 무효전력과 전압 크기를 함께 되먹여 적분기로 전압 기준을 만드는 droop-I 제어가 널리 쓰이지만, 기존 고주파 공진 연구는 통상 드룹 제어만 다뤄 왔다.
▸ 근거: p.1 Sec. I (RAP 제어 문단); p.2 Sec. I (첫 문단) (literature)

### C03 `assumption` — auto_checked
▸ 상세 소신호 모델은 DC 전압 PI (1), 스윙방정식 기반 AP 제어, droop-I RAP 제어 (3), 각도식 (7), 지연 근사 (11), LCL·선로 상태방정식 (12)-(17) 을 결합해 세우며, 선로 저항 Rg 만 남기고 LCL 가지의 기생저항은 감쇠가 최소가 되는 최악조건으로 보아 무시한다.
▸ 조건: delay=τd ≈ 1.5 Ts (fs = 10 kHz), 이후 보상된 것으로 보고 무시, parasitic_resistance=LCL 가지 저항 무시 (최악조건), measurement=이상적 측정(센서 잡음 무시)
▸ 근거: p.3 Sec. II-B, Eq.(11); p.4 Sec. II-B, Eq.(12)-(17) 및 그 아래 본문 (analytical)
※ 본 저장소 22차 상태공간과 직접 비교할 모델. 다만 이 논문은 차수를 밝히지 않으므로 차수 비교표에 수치를 넣으려면 직접 재구성해 세어야 한다.

### C04 `result` — auto_checked
▸ 단순화(저주파 전력루프) 모델의 계단응답은 상세 시간영역 시뮬레이션과 잘 맞지만, 그 모델이 지배적이라고 본 저주파 모드와 달리 실제 지배적 안정도 특징은 허수축에 가까이 놓인 두 개의 LCL 공진모드이며 이는 계단응답에도 드러나지 않는다.
▸ 수치: Vdcst 계단=0.05p.u., Pst 계단=0.3p.u., Qst 계단=0.1p.u.
▸ 근거: p.3 Sec. II-A, Fig. 4 설명; p.4 Fig. 4, Fig. 5 (τd ∈ [0, 1.5Ts] 고유값) (simulation)
▸ depends_on → [[#C03]]
※ 축소차수 모델이 시간영역에서 멀쩡해 보여도 구속조건이 되는 모드를 놓칠 수 있다는 직접 사례. 22차 모델을 저차로 줄일 때 반드시 인용할 반례다.

### C05 `definition` — auto_checked
▸ LCL 공진 각주파수는 ωres = sqrt((Lf+Lg)/(Lf·Lg·Cf)) 로 정의되며, Table I 파라미터에서 871 Hz, Lg 를 0.5 p.u. 로 키우면 774 Hz 가 된다.
▸ 수치: fres (Lg = 0.2 p.u.)=871Hz, fres (Lg = 0.5 p.u.)=774Hz, LCL 설계 목표 공진주파수=1kHz
▸ 근거: p.6 Sec. II-C, Eq.(24); p.10 Sec. V (Lg = 0.5 p.u. 사례) (analytical)

### C06 `result` — auto_checked
▸ 무효전력 적분이득 kq 를 4 에서 11 로 키워 RAP 루프 대역폭을 6 Hz 에서 17 Hz 로 올리면 공진모드가 우반평면으로 이동해 전체 시스템이 불안정해지며, 임계점은 kq = 5.1 이다 — 즉 LCL 공진이 무효전력 루프의 대역폭 상한을 정한다.
▸ 수치: kq 스윕=4 → 11-, RAP 모드 실수부=-39 → -1061/s, RAP 루프 대역폭=6 → 17Hz, 임계 kq=5.1-
▸ 조건: Lg=0.2 p.u., Rg=0 (최악조건)
▸ 근거: p.4 Sec. II-B 마지막 문단; p.5 Fig. 7 (kq 4→11 근궤적) (analytical)
▸ depends_on → [[#C03]]
※ PSO 로 이득을 조정할 때 '빠를수록 좋다' 가 아니라 고주파 공진이 상한을 건다는 제약식의 근거. 다만 여기서 상한이 걸리는 이득은 전류제어 이득이 아니라 무효전력 적분이득이다.

### C07 `result` — auto_checked
▸ Lg 를 0.2 에서 0.5 p.u. 로 키우면(계통이 약해지면) 유효전력 루프의 감쇠비는 오히려 좋아지지만 공진모드는 우반평면으로 넘어가, LCL 공진이 SL-GFM 의 약계통 안정 운전을 근본적으로 제약한다.
▸ 수치: Lg 스윕=0.2 → 0.5p.u., 대응 SCR (논문 명시는 0.5 p.u. 한 점)=2-
▸ 조건: Lg=0.2 → 0.5 p.u., SCR=Lg = 0.5 p.u. 가 SCR 2 에 해당 (p.9 Step 1)
▸ 근거: p.5 Sec. II-B, Fig. 8; p.9 Sec. III-B, Step 1 (analytical)
▸ depends_on → [[#C03]]
※ 'GFM 은 약계통에 강하다' 는 통념이 저주파 전력루프에서만 성립하고 고주파 공진에서는 뒤집힌다는 근거. 본 저장소의 SCR 경계 주장에서 저주파/고주파를 분리해 서술해야 한다.

### C08 `result` — auto_checked
▸ Lf 를 0.1 에서 0.2 p.u. 로 키우면 공진모드가 좌반평면 안쪽으로 밀려 안정화되므로, SL-GFM 에서는 Lf 와 Lg 가 서로 반대 방향으로 작용한다 — 둘이 공진주파수에는 대칭으로 들어가지만 NVE(s) 의 1/(Lf·Cf·V0) 항 때문에 내부 되먹임 가지의 영향이 달라지기 때문이다.
▸ 수치: Lf 스윕=0.1 → 0.2p.u.
▸ 근거: p.5 Sec. II-B, Fig. 9; p.6 Sec. II-C (Eq.(22)-(24) 해설 문단) (analytical)
▸ depends_on → [[#C03]]
※ 필터 설계 자유도를 안정도 제약으로 쓸 수 있다는 단서. 단 이 비대칭은 droop-I 의 내부 되먹임 가지에서 나오므로 이중루프 구조에 그대로 옮기려면 재유도가 필요하다.

### C09 `result` — auto_checked
▸ Xg/Rg 를 10 에서 2 로 낮춰 계통을 저항성으로 만들면 공진모드의 감쇠는 오히려 좋아지고 저주파 전력모드는 안정을 유지하므로, 저자들은 Rg = 0 을 고주파 공진 연구의 최악조건으로 채택한다.
▸ 수치: X/R 스윕 범위=10 → 2-, Table I 고정값=6-
▸ 조건: Xg/Rg=10 → 2, 기본값=Table I 은 Xg/Rg = 6 고정
▸ 근거: p.5 Sec. II-B, Fig. 10; p.3 Table I (Xg/Rg = 6) (analytical)
※ ※ 본 저장소의 '낮은 X/R(1.0~1.5) 가 어려운 영역' 이라는 신규성 주장과 방향이 어긋나는 대목이다. 이 논문은 X/R 이 낮을수록(저항성일수록) 공진 감쇠가 좋아지고 저주파 전력모드도 안정하다고 본다. 반박하려면 (i) 대상이 LCL 고주파 공진모드이지 동기화·전력루프 모드가 아니라는 점, (ii) 스윕이 X/R=2 에서 멈춰 1.0~1.5 를 보지 않았다는 점, (iii) 단일루프·무전류제어 구조라는 점을 들어야 한다. 숨기지 말고 논문에 counterpoint 로 인용할 것.

### C10 `result` — auto_checked
▸ droop-I 를 쓰는 SL-GFM 의 무효전력 개루프 전달함수 Gq(s) 는 파라미터 변화에 따라 공진주파수 근처에 우반평면 극점이 생겨 최소위상에서 비최소위상으로 전이하며, 이는 GFL 이나 통상 드룹 제어 SL-GFM 에서는 관찰되지 않은 새 불안정 기구다.
▸ 수치: 개루프 극점 (kq=4, Lg=0.2 p.u.) — 최소위상=-2.9 ± j5786.2 / -2.2 ± j5158.71/s, 개루프 극점 (kq=11, Lg=0.2 p.u.) — 비최소위상=7.8 ± j5785.2 / 9.9 ± j5159.91/s, 개루프 극점 (kq=4, Lg=0.5 p.u.) — 비최소위상=3.2 ± j5176 / 4.3 ± j4548.81/s
▸ 조건: Rg=0 가정, 전이 사례=kq = 11 (Lg = 0.2 p.u.) 또는 Lg = 0.5 p.u. (kq = 4)
▸ 근거: p.5 Sec. II-C 도입부; p.6 Eq.(19)-(25), Table II (analytical)
▸ contradicts → [[#C01]]
※ 본 저장소 모델에도 적용 가능한 점검 항목: 소신호 전달함수를 뽑을 때 개루프 극점의 부호를 확인하지 않으면 안정여유 해석이 통째로 틀릴 수 있다.

### C11 `result` — auto_checked
▸ Table II 의 세 경우 모두 개루프 보드선도상 0 dB 이득·-180도 위상 교차조건을 만족하지만 그중 둘은 실제로 불안정하므로, 개루프 불안정 극점을 고려하지 않은 보드선도만으로 공진 안정도를 판정하는 것은 부적절하다.
▸ 수치: 교차조건을 만족하지만 불안정한 사례=3 중 2건, 불안정 사례의 개루프 RHP 극점 실수부=3.2 ~ 9.91/s
▸ 근거: p.6 Sec. II-C, Fig. 11 (개루프 보드선도 비교) (analytical)
▸ contradicts → [[#C01]]
▸ supports → [[#C10]]
※ 이득여유·위상여유를 강건성 지표로 쓰는 설계(PSO 목적함수 포함)에 직접 경고가 된다. 여유값이 커도 안정을 보장하지 않는 경우가 실험으로 제시된다(C21: 33.8 dB 인데 발산).

### C12 `result` — auto_checked
▸ DC-link 전압은 Eq.(18) 로 무효전력 루프의 ΔErf 와 결합하므로, 고주파에서 불안정해진 RAP 루프는 DC 루프와 AP 루프, 나아가 풍력터빈 측 변수까지 불안정하게 만든다 — 불안정의 출처는 DC 측 동특성이 아니라 RAP 제어 루프다.
▸ 수치: 결합 전달함수=Δvdc/ΔErf = -(id0/vdc0)s / [(Cdc/ωn)s² + (kpdc - Erf0·id0/vdc0²)s + kidc]
▸ 근거: p.5 Sec. II-B 끝, Eq.(18); p.6 Sec. II-C (DC 측 관련 문단) (analytical)
▸ depends_on → [[#C03]]
※ 2단 PV+ESS 구조에서 DC-link 를 전단 DC-DC 가 잡는 경우와 구조가 같다(여기선 MSC 가 잡는다). DC-AC 커플링을 모델에 넣어야 하는 근거로 쓸 수 있다.

### C13 `assumption` — auto_checked
▸ 저자들은 불안정이 RAP 제어 루프에서 비롯되므로 DC 입력원이 달라져도 이 해석과 그에 기반한 AD 설계가 그대로 유효하다고 주장한다.
▸ 근거: p.6 Sec. II-C (Fig. 11 설명 뒤 문단) (assertion)
▸ depends_on → [[#C12]]
※ PV+ESS 로의 이식 가능성을 저자가 열어 두지만 근거 없는 주장이다. 내 연구에서 PV MPPT·ESS SOC 동특성을 넣어 검증하면 그 자체가 기여가 된다.

### C14 `limitation` — auto_checked
▸ 저자들은 내부(전압-전류) 제어를 포함한 구조에서는 추가 제어 자유도로 비최소위상 거동을 일반적으로 제거할 수 있다고 기술한다 — 즉 이 논문이 찾은 불안정 기구는 내부 제어가 없는 단일루프 구조에 특유한 것이다.
▸ 근거: p.6 Sec. II-C 끝, Fig. 12(b) 설명; p.7 Fig. 12 (내부 제어 유무별 RAP 루프 등가 구조) (assertion)
▸ extends → [[#C10]]
※ ※ 이식 가능 여부의 핵심. 본 저장소는 전압-전류 이중루프 2단 구조이므로 이 논문의 비최소위상 기구(C10)와 그에 맞춘 AD 설계(C17)는 그대로 옮겨오지 않는다. 옮겨오는 것은 기구가 아니라 방법론이다: (a) 상세모델로 고주파 공진모드를 반드시 확인할 것(C04), (b) 개루프 극점 부호를 확인하지 않은 이득여유는 신뢰하지 말 것(C11), (c) 최악조건(최대 Lg·최대 대역폭) 기반 AD 설계 절차(C17). 이중루프에서는 저자 주장대로 비최소위상이 사라질 수 있으므로, 이 논문을 '내 구조에도 같은 위험이 있다' 는 근거로 인용하면 틀린다.

### C15 `comparison` — auto_checked
▸ RAP 모드를 모두 약 -40 으로 맞춰 6가지 무효전력 제어 구조를 비교하면 공진 안정도 순위는 드룹 > 고정전압 > RAP 제어 > droop-I > 전압제어 > 순수드룹(불안정)이며, droop-I 는 통상 드룹보다 공진 불안정 위험이 크고 순수 드룹(필터 없는 드룹)은 공진 완화 없이는 쓸 수 없다.
▸ 조건: 공정 비교 조건=모든 RAP 모드를 약 -40 으로 정렬
▸ 근거: p.7 Sec. II-D, Fig. 13-15; p.8 Sec. II-D 요약 (순위식), Fig. 16 (analytical)
▸ extends → [[#C10]]
※ 무효전력/전압 제어 구조 선택이 고주파 안정도에 서열을 만든다는 근거. 단 이 서열은 SL 구조 안에서의 서열이다.

### C16 `method` — auto_checked
▸ 가상저항 위치 6곳 × 피드백 변수 4종 = 24가지 능동댐핑 구성 중, 추가 센서 없이 쓸 수 있는 변수(계통전류·커패시터 전압)로 12가지, 분자 차수가 분모보다 높아지는 구현을 배제해 3가지(vabc 로 Rv2·Rv4·Rv5)로 좁히고, 정상상태 AP-RAP 결합 Kqp 를 악화시키는 Rv5 를 제외해 커패시터 전압 피드백 기반 Rv4(Gad = kd·s)를 택한다.
▸ 수치: 전체 AD 구성 수=24가지, 센서 조건 통과=12가지, 복잡도 조건 통과=3가지, 최종 선정=Rv4 (Gad = kd·s)-
▸ 근거: p.8 Sec. III-A (1)(2)(3), Fig. 17, Eq.(26) (analytical)
※ GFL 에서 표준인 계통전류 피드백 AD 가 SL-GFM 에서는 최선이 아니라는 선정 논리. 선정 기준(센서 수·구현 복잡도·정상상태 결합)은 구조와 무관하게 재사용할 수 있다.

### C17 `method` — auto_checked
▸ 능동댐핑기 Gad(s) = kd·s/(Td·s+1) 을 5단계로 설계한다 — (1) 최악조건 지정(RAP 모드를 가장 먼 -110, 17 Hz 에, Lg 는 최대 0.5 p.u. = SCR 2), (2) 안정여유 규정(공진모드 실수부 < -10), (3) Td = 0 으로 두고 Gad = kd·s 를 쓴 소신호 근궤적으로 kd = 3.3e-6 선정, (4) 순수 미분을 피하려 Td = 8e-5 (절점 2 kHz = 설계 공진주파수의 2배), (5) kq·Lg 조합을 바꿔 가며 시뮬레이션/실험으로 검증.
▸ 수치: 최악조건 RAP 모드=약 -110 (17 Hz)1/s, 최악조건 Lg=0.5p.u., 요구 안정여유=실수부 < -101/s, 설계 이득=3.3e-6-, 설계 시정수=8e-5s, 최종 Gad(s)=3.3e-6·s / (8e-5·s + 1)-
▸ 조건: worst_case=RAP 모드 -110 (17 Hz), Lg = 0.5 p.u. (SCR 2), Rg = 0, margin_spec=공진모드 실수부 < -10
▸ 근거: p.8 Sec. III-B, Eq.(27); p.9 Sec. III-B Step 1-5, Eq.(28)-(30), Fig. 18-19 (analytical)
▸ depends_on → [[#C16]]
▸ depends_on → [[#C07]]
▸ depends_on → [[#C06]]
※ 최악조건(최대 Lg = 최소 SCR, 최대 대역폭) 한 점에서 설계하고 그 안쪽 전부를 강건하다고 주장하는 방식이다. 본 저장소의 SCR-X/R 격자 스윕은 이 '한 점 최악조건' 을 '경계면' 으로 바꾸는 것이므로 대비 기준선으로 쓰기 좋다. 또 Gad 는 고역통과라 저주파 동특성에 영향이 거의 없다고 저자가 밝힌다(p.9).

### C18 `future_work` — auto_checked
▸ 저자들은 선로 임피던스가 연속적으로 변하지 않는다는 점을 들어, 임피던스 추정과 결합해 Lg → kd 룩업테이블로 kd 를 온라인 갱신할 수 있고, 상위 감독제어가 Dq 를 바꾸면 AD 파라미터를 다시 유도하면 된다고 제안한다.
▸ 근거: p.9 Sec. III-B, Step 3 후반 (assertion)
▸ extends → [[#C17]]
※ SCR 추정 기반 적응 이득 스케줄링은 내 연구의 PSO 기반 오프라인 최적화와 경쟁/보완 관계다. 저자가 제안만 하고 안 했으므로 공백 후보(G04).

### C19 `comparison` — auto_checked
▸ GFL 과 SL-GFM(droop-I)의 LCL 공진 특성을 Table III 로 대비하면 — 임계 루프가 전류제어 대 무효전력제어, 개루프가 최소위상 대 비최소위상 가능, 해석도구가 보드선도 포함 대 근궤적·나이퀴스트, AD 피드백 변수가 선로전류 대 커패시터 전압으로 갈리며, 가상저항을 Cf 와 병렬에 두는 것만 양쪽이 같다.
▸ 근거: p.9 Sec. IV (Power Stage / Control 항목); p.10 Table III, Sec. IV (Selected AD 항목) (literature)
▸ extends → [[#C10]]
※ ※ RAG 질의 '⑤ LCL 필터 공진 감쇠와 전류 제어 이득의 관계' 와 닿는 유일한 대목이다. 다만 이 논문의 대상(SL-GFM)에는 전류 제어 루프 자체가 없고(p.1), '공진 감쇠 ↔ 전류제어' 관계는 GFL 쪽 대비 항목으로만 서술된다. 이 논문에서 공진과 결합하는 이득은 무효전력 적분이득 kq(C06)와 AD 이득 kd(C17)다.

### C20 `result` — auto_checked
▸ 3 kW/200 V 축소 하드웨어 실험(Table I 조건, fres 871 Hz)에서 kq 를 4에서 14 로 올리자 이득여유가 26.1 dB 로 양수였음에도 820 Hz 고주파 진동이 vdc·p·q 세 루프 모두에서 발산했고, 제안 AD 를 투입하자 개루프가 최소위상으로 돌아가며(이득여유 24.7 dB) 0.5 s 안에 진동이 사라졌다.
▸ 수치: kq (초기 → 변경)=4 → 14-, 초기 이득여유 (kq=4, 안정)=21.3dB, 불안정 시 이득여유 (kq=14)=26.1dB, 공진 진동 주파수=820Hz, 제안 AD 적용 후 이득여유=24.7dB, 제안 AD 정정시간=< 0.5s
▸ 조건: Lg=0.2 p.u., fres=871 Hz, 축소 정격=3 kW / 200 V
▸ 근거: p.10 Sec. V (Table I 사례), Fig. 20 실험셋업; p.11 Table IV, Fig. 21-22 (experiment_hw)
▸ supports → [[#C17]]
▸ supports → [[#C11]]
▸ supports → [[#C06]]
※ '이득여유 26.1 dB 인데 발산' 은 강건성 지표 선택에 대한 실험 근거로 강력하다. 내 PSO 목적함수가 여유값 기반이면 이 사례를 반례로 들어 고유값 기반 지표를 정당화할 수 있다.

### C21 `result` — auto_checked
▸ Lg 를 0.5 p.u.(fres 774 Hz)로 키운 두 번째 실험에서는 kq 를 2에서 5 로만 올려도 이득여유 33.8 dB 임에도 720 Hz 공진이 발산했고, 제안 AD 는 이득여유 44 dB 로 0.5 s 안에 억제한 반면 드룹용 전류피드백 AD 는 안정화는 시켰으나 이득여유 10.1 dB 로 1 s 넘게 걸렸다.
▸ 수치: kq (초기 → 변경)=2 → 5-, 초기 이득여유 (kq=2, 안정)=5.32dB, 불안정 시 이득여유 (kq=5)=33.8dB, 공진 진동 주파수=720Hz, 제안 AD 이득여유 / 정정시간=44 dB / < 0.5 s, 전류피드백 AD 이득여유 / 정정시간=10.1 dB / > 1 s
▸ 조건: Lg=0.5 p.u. (SCR 2), fres=774 Hz
▸ 근거: p.10 Sec. V 마지막 문단; p.11 Table IV, Fig. 23 (p.12 Fig. 24); p.12 Fig. 23-24 (experiment_hw)
▸ supports → [[#C07]]
▸ supports → [[#C17]]
▸ supports → [[#C11]]
※ SCR 2 에 해당하는 유일한 실험점. 본 저장소의 SCR 스윕 결과를 실험과 맞댈 때 비교 가능한 단일 지점이다 — 다만 X/R 은 이 실험에서 변화시키지 않았다.

### C22 `result` — auto_checked
▸ 통상 드룹 제어용으로 설계된 전류피드백 능동댐핑 2e-5·s/(3.5e-3·s+1) 은 교차조건상 충분한 여유를 갖고도 Table I 조건에서 비최소위상을 제거하지 못해 820 Hz 공진을 억제하지 못했고(이득여유 20.7 dB), 제안 AD 투입 전후 정상상태 유효·무효전력은 변하지 않아 AD 가 정상상태 전력조정 특성을 건드리지 않음이 확인됐다.
▸ 수치: 비교 대상 전류피드백 AD=2e-5·s / (3.5e-3·s + 1)-, 실패 시 이득여유=20.7dB, 잔존 공진 주파수=820Hz
▸ 근거: p.10 Sec. V (비교 AD 문단), Fig. 22(a) 정상상태 서술; p.11 Table IV (Current-based AD [4] 행) (experiment_hw)
▸ supports → [[#C16]]
▸ supports → [[#C10]]

### C23 `limitation` — auto_checked
▸ 기계측 변환기(MSC)는 지령 DC 전류를 그대로 내는 제어 전류원으로 단순화되고, 실험 셋업의 DC 측은 AC/DC 변환기가 대신하므로 실제 PMSG 풍력터빈의 동특성은 해석에도 실험에도 포함되지 않는다.
▸ 조건: MSC 가정=iwdcref = iwdc, GSC 가정=무손실
▸ 근거: p.2 Sec. II-A, Eq.(1)-(2) 설명; p.10 Fig. 20 실험 셋업 (AC/DC Converter + DC/AC Converter + Grid Simulator) (assertion)
▸ depends_on → [[#C13]]
※ DC 측이 이상적 전류원이라 PV 의 I-V 비선형성·MPPT, ESS 의 SOC/전류제한은 전혀 없다. 내 2단 PV+ESS 모델이 메울 수 있는 자리다.

## Gaps
- **G01** [high/phd] 비최소위상 전이 기구가 전압-전류 이중루프 GFM 에서도 남는지 정량적으로 확인되지 않았다. 저자는 내부 제어의 추가 자유도로 '일반적으로 제거 가능' 하다고 한 문장으로만 기술하고 유도·수치 예시·실험을 제시하지 않는다. ← C14, C10, C19 · 반증검색: `not_searched`
  ※ 반증 검색 전 — 논문에 '공백'으로 쓰지 말 것
- **G02** [high/phd] X/R 스윕이 10→2 에서 멈춰 저 X/R(1.0~1.5) 영역이 비어 있고, SCR 은 Lg=0.5 p.u.=SCR 2 라는 한 점으로만 환산된다. SCR 과 X/R 을 함께 변화시킨 2차원 안정도 경계는 작도되지 않았으며, '저주파 전력모드는 안정 유지' 라는 서술에도 정량 경계가 없다. ← C09, C07, C21 · 반증검색: `not_searched`
  ※ 반증 검색 전 — 논문에 '공백'으로 쓰지 말 것
- **G03** [high/phd] DC 입력원이 달라도 해석과 AD 설계가 유효하다는 일반화 주장이 검증되지 않았다. PV 의 I-V 비선형성·MPPT 나 ESS 의 SOC·전류제한 같은 2단 PV+ESS 의 DC 측 동특성은 모델에도 실험에도 들어가 있지 않다. ← C13, C23, C12 · 반증검색: `not_searched`
  ※ 반증 검색 전 — 논문에 '공백'으로 쓰지 말 것
- **G04** [medium/phd] AD 이득 kd 는 최악조건 한 점에서 근궤적으로 손수 고른 값이고, kq·Dq·kd 를 동시에 다루는 최적화나 임피던스 추정 기반 온라인 갱신은 제안 수준에 머문다 — 다목적 최적화(PSO 등)로 공진 여유와 전력루프 응답을 함께 맞춘 결과가 없다. ← C17, C18, C06 · 반증검색: `not_searched`
  ※ 반증 검색 전 — 논문에 '공백'으로 쓰지 말 것

