---
type: literature
cite_key: zhao2024lowfreqres
ref_num: ""
title: "Low-frequency Resonances in Grid-Forming Converters: Causes and Damping Control"
authors: [Fangzhou Zhao, Tianhua Zhu, Zejie Li, Xiongfei Wang]
corresponding: 미명시
year: 2024
venue: IEEE Transactions on Power Electronics
doi: 10.1109/TPEL.2024.3424296
pdf: [[zhao2024lowfreqres.pdf]]
pdf_status: have
paper_type: review
target_system: 일반
control_scheme: [PSC (power synchronization control), droop, VSM/VSG, open-loop VVC, closed-loop VVC + VCC, virtual resistance (VR), virtual impedance (VI), virtual admittance (VA), power reference feedforward (PRF), power decoupling control (PDC), hybrid synchronization control (HSC), active susceptance (AS), GFM-VCC]
model_order: N/A
analysis_method: [외부루프 plant 전달함수 행렬의 켤레극점 해석 (식 (1)(2)), 폐루프 PSC 2차 전달함수 감쇠비 (식 (4)(5)), 임피던스/어드미턴스 성형 해석, Bode 선도 (Fig. 9), 실험 스텝응답 파형, Nyquist·감쇠토크 해석은 인용문헌([13],[19],[54])의 결과를 인용만 함]
tuning_method: 수동
scr_range: 실험 SCR = 1.5, 10, 20 (그 밖은 '약계통~강계통' 정성 서술). SCR 스윕 곡선은 없다
xr_range: 미명시 — 전송망=높은 X/R, 배전망·마이크로그리드=낮은 X/R 의 정성 대비만 있고 수치 범위·스윕이 없다
validation_level: 실기
hardware: [3 kW 실험실 VSC 프로토타입 (모델명 미명시)]
extraction_depth: full
dc_ac_coupling: 미명시 — DC 링크를 600 V 고정값으로만 제시하고 DC단 동역학은 모델·해석에 등장하지 않는다
pso_params: ""
section: ""
tags: [literature, grid-forming, synchronous resonance, sub-synchronous resonance, control interactions, power synchronization control, virtual resistance, virtual admittance, active damping]
status: read
---
# Low-frequency Resonances in Grid-Forming Converters: Causes and Damping Control

## 조건·파라미터
| 항목 | 기호 | 값 | 단위 |
|---|---|---|---|
| 정격 선간전압(RMS) |  | 190.5 | V |
| 정격 용량 |  | 3 | kW |
| 정격 각주파수 |  | 314 | rad/s |
| 기저 임피던스 |  | 12.1 | Ω |
| 필터 인덕턴스 |  | 3 | mH |
| 필터 커패시턴스 |  | 10 | μF |
| DC 링크 전압 |  | 600 | V |
| 스위칭 주파수 |  | 10 | kHz |

## Claims
### C01 `definition` — auto_checked
▸ SR(동기공진)은 GFM-VSC 의 출력전력·전압크기에서 기본주파수에 거의 일치하는(실제로는 약간 낮은) 주파수로 나타나는 공진이며, 외부루프(특히 PSC)의 plant 에서 기원한다.
▸ 수치: SR 주파수=≈ f1 (f1 보다 약간 낮음)Hz
▸ 조건: 관측량=출력 전력 / 전압 크기, 기본주파수=실험 설비 기준 50 Hz
▸ 근거: p.1 Sec. I, 2단 1문단; p.3 Sec. II-B, Fig. 3 (literature)
※ ※ 우리 runner.py 의 대역 정의(sync <5 Hz / control 5~100 Hz / lcl ≥100 Hz)에 이 SR 을 얹으면, 60 Hz 기저인 우리 모델에서 SR 은 'control' 대역(5~100 Hz)의 위쪽 끝에 떨어진다. 그런데 이 논문은 SR 을 제어루프 모드가 아니라 '선로 R,L 이 만드는 외부루프 plant 극점'으로 규정한다(C05). 즉 우리 'control' 라벨은 SR 을 담으면 물리적으로 틀린 이름이 된다 — 주파수 기반 분류가 모드 귀속을 보증하지 않는다는 runner.py 주석의 경고를 이 논문이 뒷받침한다.

### C02 `definition` — auto_checked
▸ SSR(차동기공진)은 출력전력에서 기본주파수보다 낮은, 통상 0~0.5 f1 범위에 나타나는 공진이며, GFM-VSC 에서는 동기기의 축비틀림 상호작용과 원인이 다르다.
▸ 수치: SSR 주파수 범위=0 ~ 0.5×f1
▸ 조건: 관측량=출력 전력, 구분=동기기 torsional interaction 과 원인이 다름
▸ 근거: p.1 Sec. I, 2단 1~2문단; p.3 Sec. II-B (literature)
▸ depends_on → [[#C04]]
※ ※ 60 Hz 기저로 환산하면 SSR = 0~30 Hz 다. 우리 runner.py 는 5 Hz 에서 sync/control 을 가르므로 같은 SSR 현상이 2 Hz 면 'sync', 9 Hz 면 'control' 로 쪼개진다. 즉 우리 대역 경계 5 Hz 는 이 논문의 현상 분류와 1:1 대응하지 않는다. 더 중요한 것: 우리가 관측한 지배모드 37~43 Hz 는 0.62~0.72 f1 로, 이 논문의 SSR(≤0.5 f1)에도 SR(≈f1)에도 들어가지 않는 중간 영역이다. 이 '분류 미싱 밴드' 자체가 우리 모델 고유의 설명 부담이다 — 2단 PV+ESS 의 DC-AC 혼합 모드라면 이 논문 범주 밖이라는 뜻이고, 그것을 참여계수로 증명해야 한다.

### C03 `definition` — auto_checked
▸ 고주파 공진(HFR, LCL 계열)은 전류·전압에는 나타나지만 전력 측정단의 LPF 와 느린 외부루프 때문에 출력전력에는 거의 나타나지 않으며, 이 논문은 HFR 을 다루지 않는다고 명시적으로 범위에서 제외한다.
▸ 조건: 제외 범위=HFR (LCL 필터 공진 포함), 참조=HFR 은 [49],[9],[50] 로 넘김
▸ 근거: p.3 Sec. II-B 1문단, Fig. 3 (literature)
※ ※ 우리 모델의 'lcl' 대역(178 Hz 관측, ≈3 f1)은 이 논문이 명시적으로 제외한 HFR 영역이다. 따라서 이 논문의 어떤 결론(VR·VA·VI·PDC 의 감쇠 효과, SR/SSR 트레이드오프)도 우리 178 Hz 모드의 근거로 전용할 수 없다. 반대로 이 논문의 감쇠 기법들은 HPF/LPF(5~10 Hz 대) 로 고주파를 일부러 건드리지 않게 설계되어 있어, 저주파 감쇠를 올려도 LCL 대역 ζ 를 개선한다고 기대할 근거가 없다. 우리 논문에서 저주파(sync/control)와 LCL 대역을 한 문장으로 묶어 설명하면 이 지점에서 반박당한다.

### C04 `result` — auto_checked
▸ 주파수 결합 효과 때문에 전력축 공진주파수와 전류축 공진주파수가 다르게 관측된다 — 전력의 SR 은 출력전류에서 거의 0 Hz(DC 오프셋)로, 전력의 SSR(f_p)은 출력전류에서 f1-f_p 와 f1+f_p 두 성분으로 나타난다.
▸ 수치: SR 실험 전력 진동주파수=≈50Hz, SR 실험 a상 전류 진동주파수=≈0Hz, SSR 실험 전력 진동주파수=≈10Hz, SSR 실험 전류 진동주파수=40 및 60Hz, SCR=10
▸ 조건: SR 실험=open-loop VVC + PSC, active resistance 비활성, SSR 실험=closed-loop VVC + PSC, SCR = 10
▸ 근거: p.3 Sec. II-B, Fig. 4 · Fig. 5; p.3 Sec. II-B 마지막 문단 (experiment_hw)
※ ※ 이 claim 이 우리 대역 비교의 전제다. 우리 22차 모델은 dq 동기좌표계에서 선형화되므로 고유값 허수부는 이 논문의 '전력축' 주파수에 대응한다(전류축이 아니다). 즉 우리 37~43 Hz·178 Hz 를 이 논문의 abc 전류 파형 주파수와 직접 비교하면 f1 만큼 틀린다 — abc 축으로 보면 37~43 Hz dq 모드는 17~23 Hz 와 97~103 Hz 두 성분으로, 178 Hz dq 모드는 118 Hz 와 238 Hz 로 나타난다. RTDS CHIL 에서 파형으로 모드를 식별할 때 이 환산을 넣지 않으면 모드를 오인한다.

### C05 `result` — auto_checked
▸ open-loop VVC 구조에서 SR 의 원인은 외부루프 plant 자체이며, plant 전달함수 행렬은 허수부가 정확히 기본각주파수 ω1 인 켤레극점 쌍을 가지고 그 실수부(감쇠)는 VSC-계통 사이의 R/L 로 정해진다 — 따라서 X/R 이 높은 전송계통에서는 감쇠가 부족해 SR 위험이 크고, X/R 이 낮은 배전망·마이크로그리드에서는 SR 이 자연 감쇠된다.
▸ 수치: plant 켤레극점 자연주파수=ω1 (기본각주파수와 정확히 일치)rad/s, 극점 실수부=R/L 로 결정 (수식 기호는 PDF 이미지라 판독 불가)
▸ 조건: 제어구조=open-loop VVC (PSC 에 LPF·가상관성 미적용), 감쇠원=필터 ESR, 케이블·선로·변압기 기생저항의 합
▸ 근거: p.4 Sec. III-A-1, 식 (1)(2), Fig. 6; p.4 Sec. III-A-1 3문단; p.5 Table I (open-loop VVC / SR 행) (analytical)
▸ supports → [[#C01]]
※ ※ 우리 연구가 겨냥하는 X/R 1.0~1.5 는 이 논문 기준으로 'SR 이 자연 감쇠되는' 쪽이다. 그러면 저 X/R 영역에서 우리가 찾는 강건성 경계의 주역은 SR 이 아니라 SSR·제어상호작용이어야 한다. 반대로 X/R 이 낮으면 같은 SCR 에서 X 가 작아지므로(C07) SSR 위험은 커진다 — 즉 SCR-X/R 평면에서 SR 위험과 SSR 위험이 서로 반대 방향으로 기울어진다는 가설을 이 논문이 지지한다. 이것은 우리 88포인트 스윕에서 '어느 코너가 최악인가'를 모드별로 따로 봐야 한다는 뜻이다.

### C06 `comparison` — auto_checked
▸ closed-loop VVC 구조에서 내부 VCC 의 P 이득은 가상저항처럼 작용해 SR 을 감쇠시키는 반면, VVC 의 P 이득은 음의 저항처럼 작용해 SR 감쇠를 악화시킨다 — VCC 를 쓰면 SR 위험이 낮고, VCC 없이 VVC 만 쓰면 VVC 가 SR 의 기여 요인이 된다.
▸ 수치: VCC P 이득 통상값=≈1 p.u. 또는 그 이상p.u., 비교 기준: 권장 가상저항 값=0.2p.u.
▸ 조건: 제어구조=closed-loop VVC (± VCC), VCC 대역폭=수백 Hz ~ kHz
▸ 근거: p.4 Sec. III-A-2; p.9 Sec. V-A-1; p.5 Table I (closed-loop VVC / SR 행) (literature)
▸ contradicts → [[#C14]]
※ ※ 우리 22차 모델은 Kpv/Kiv(VVC)와 Kpc/Kic(VCC)를 모두 가진 closed-loop VVC + VCC 구조(이 논문 Fig. 1(b))다. 따라서 이 논문의 Table III 열이 그대로 우리에게 적용된다: VCC(Kpc=5.0 고정)가 SR 을 눌러 주므로 우리 모델에서 60 Hz 근방 SR 모드가 지배모드로 안 나오는 것이 설명된다. PSO 가 Kpv 를 올릴 때 SR 감쇠가 깎이는 방향이라는 것도 여기서 나온다 — 정량 이득값은 이 논문이 우리 파라미터로 주지 않으므로 부호 제약으로만 쓸 수 있다.

### C07 `result` — auto_checked
▸ open-loop VVC 에서 SR 을 피하려고 PSC 에 LPF(또는 등가인 VSM 관성)를 넣으면 2차 폐루프가 되고, droop 이득을 키우거나 LPF 차단주파수를 낮출수록 그 켤레극점의 감쇠비가 떨어져 강계통(작은 리액턴스)에서 SSR 이 발생한다.
▸ 수치: LPF 차단주파수=31.4rad/s, LPF 차단주파수(Hz)=5Hz, SCR=20, 전력 진동주파수=≈9Hz, Fig. 7 의 또 다른 조건값=0.05p.u.
▸ 조건: 제어구조=open-loop VVC + droop PSC + LPF, 계통=강계통 (SCR=20), 근사=전력각이 작을 때 plant 를 상수로 근사 (식 (3))
▸ 근거: p.4 Sec. III-B-1, 식 (3)(4)(5), Fig. 7; p.4 Sec. III-B-1 마지막 문단, Fig. 7; p.6 Sec. IV-A-2 1문단 (experiment_hw)
※ ※ PSO 제약으로 바로 쓸 수 있는 claim 이다. 우리 PSO 탐색변수 J, Dp, wc 가 모두 여기에 걸린다 — wc(=62.8 rad/s, 10 Hz)를 낮추면 SR 은 좋아지고 SSR 은 나빠진다. 그리고 감쇠비가 리액턴스 X 에 의존하므로, X/R=1.0~1.5 처럼 X 가 작은 조건은 같은 SCR 에서도 SSR 쪽으로 더 불리하다. 즉 우리 스윕에서 'SCR 이 높고 X/R 이 낮은 코너'가 SSR 최악코너라는 예측이 선다 — 88포인트 결과로 확인/반증할 대상.

### C08 `method` — auto_checked
▸ SR 과 SSR 은 LPF 차단주파수 선정에서 서로 반대 방향을 요구하므로 계통 임피던스가 넓게 변하면 트레이드오프가 생기고, lead-lag 보상기로 양쪽을 절충할 수 있으나 그 계수는 계통 임피던스에 의존하므로 최악조건 — SR 은 저항이 가장 낮은 계통, SSR 은 리액턴스가 가장 낮은 계통 — 을 기준으로 설계해야 한다.
▸ 조건: 제어구조=open-loop VVC + PSC, 설계 기준=SR 최악 = 최저 저항, SSR 최악 = 최저 리액턴스
▸ 근거: p.6 Sec. IV-A-2; p.6 Sec. IV-A-2 1문단; p.6 Table II (literature)
※ ※ 이 한 문장이 우리 PSO 적합도 함수의 설계 근거가 된다. 최저 저항 코너와 최저 리액턴스 코너는 SCR-X/R 평면에서 서로 다른 지점이므로, 단일 코너에서 최적화한 이득은 다른 모드에서 실패한다. 즉 우리 비용함수는 '대역별 ζ 의 최소값들을 전 코너에 대해 동시에' 묶어야 한다 — 현재 runner.py 가 band_zeta_min 을 대역별로 분리해 둔 설계와 맞는다. 다만 이 논문은 다목적 최적화를 수행하지는 않고 최악조건 수동설계까지만 간다(→ G02).

### C09 `result` — auto_checked
▸ PSC 의 droop 이득은 SR 관련 폐루프 극점에 음의 감쇠를 주므로 안정을 위해 p.u. droop 이득의 상한이 대략 계통 저항값의 2배로 제한되며, 계통 임피던스가 커지면 PSC 대역폭이 떨어지므로 강계통 기준으로 고른 낮은 이득은 약계통에서 과도하게 느린 유효전력 응답을 낳는다.
▸ 수치: droop 이득 상한=≈ 2 × 계통 저항(p.u.)p.u., 스케일링 계수=1.5 (peak-value) / 1 (p.u.), 강계통 권장 droop 이득=< 0.05p.u.
▸ 조건: 제어구조=open-loop VVC + PSC, 스케일링=peak-value 스케일링이면 계수 1.5, p.u. 정규화면 1, 설계 기준=최악조건 = 저항이 가장 낮은 계통(대개 강계통)
▸ 근거: p.5 Sec. IV-A-1, 식 (6); p.5 Sec. IV-A-1 마지막 문단; p.7 Sec. IV-B (analytical)
▸ supports → [[#C08]]
※ ※ 'droop 이득 ≲ 2R(p.u.)' 는 PSO 탐색공간의 상한식으로 그대로 쓸 수 있는 형태다(우리 Dp 와 기호가 달라 환산 필요). 특히 X/R=1.0~1.5 에서는 같은 SCR 에서 R 이 상대적으로 크므로 상한이 완화되는 방향 — 저 X/R 이 droop 설계 자유도를 넓힌다는 가설이 선다. 한편 이 논문은 '낮은 droop 이득이 STATCOM 에는 맞아도 PV 인버터·풍력처럼 지령 추종이 빨라야 하는 용도에는 부족할 수 있다'고 명시한다 — PV+ESS 를 다루는 우리 쪽에서는 안정도-응답속도 트레이드오프를 비용함수에 넣어야 한다는 직접 근거다.

### C10 `method` — auto_checked
▸ SR 감쇠를 위해 기본주파수에서 가상저항(VR)을 모사하면 plant 의 감쇠비가 개선되며, [24] 의 해석적 설계식 (7) 은 droop 이득과 VR 을 묶어 서로 다른 SCR·운전점에서 이득여유 2 이상을 보장한다 — 다만 그 해석은 VR 의 HPF 영향과 무효전력·전압 제어의 영향을 고려하지 않는다.
▸ 수치: HPF 차단주파수=5 ~ 10Hz, 권장 가상저항=0.2p.u., 보장 이득여유=> 2
▸ 조건: 구현=dq 프레임 VR = 비례이득 + HPF (정상상태점·P-Q 정적결합 회피용), 대안=정지좌표 구현 시 HPF 대신 기본주파수 노치필터 필요
▸ 근거: p.6 Sec. IV-B, Fig. 8 · Fig. 9, 식 (7); p.6 Sec. IV-B; p.7 Sec. IV-B 1문단 (analytical)
※ ※ 우리 PSO 의 직접 경쟁자다. '여러 SCR 에 걸쳐 GM>2 를 보장하는 닫힌형 설계식'이 이미 있다면, PSO 의 신규성은 'SCR 전역 보장'이 아니라 (a) X/R 축까지 포함한 2차원 경계, (b) VR 설계식이 무시한 HPF·AVC/RPC·DC단 상호작용을 포함한 22차 모델, (c) 단일 지표(GM)가 아니라 대역별 ζ 다목적 — 이 세 가지에서 나와야 한다. 비교실험으로 식 (7) 기반 설계를 베이스라인으로 잡는 것이 안전하다.

### C11 `result` — auto_checked
▸ droop 이득과 VR 이 설계식 (7) 처럼 짝지어지지 않으면(예: droop 0.03 p.u. 에 VR 0.2 p.u.) 강계통 연계에서 VR 의 HPF 가 만드는 또 다른 켤레극점 때문에 10 Hz 미만의 심한 SSR 이 나타난다.
▸ 수치: droop 이득 (불일치 사례)=0.03p.u., 가상저항=0.2p.u., 정합 사례 이득=droop = Rv = 0.2p.u., SCR=20, SSR 주파수=< 10Hz
▸ 조건: 계통=SCR = 20 (강계통), 제어=PSC + VR + AVC + RPC ([26] 구성), 완화책=HPF 차단주파수를 낮추거나 VR 값을 줄임
▸ 근거: p.7 Sec. IV-B 2문단, 식 (8), Fig. 10; p.7 Sec. IV-B 2문단 (experiment_hw)
▸ extends → [[#C10]]
※ ※ '감쇠용으로 넣은 필터가 새 공진모드를 만든다'는 사례. 우리 22차 모델에도 전력 LPF(wc)와 가상 인덕턴스 Lv 가 있으므로 같은 종류의 추가 극점이 생길 수 있고, 그것이 우리 37~43 Hz 모드의 후보 설명 중 하나다 — 참여계수로 확인해야 한다. 또 PSO 가 이득들을 독립적으로 흔들면 이런 '짝 안 맞는 조합'을 밟게 되므로, 비용함수에 대역별 ζ 를 전부 넣지 않으면 한 모드를 좋게 하면서 다른 모드를 불안정하게 만든다.

### C12 `result` — auto_checked
▸ 전력지령 피드포워드(PRF)는 PSC 폐루프 극점을 바꾸지 않고 영점을 성형해 극점을 거의 상쇄시킴으로써 오버슈트와 정정시간을 줄이고 강계통 SSR 을 완화하지만, 상쇄 효과는 설계식 (7) 로 파라미터를 고를 때 더 뚜렷해 낮은 droop 이득에서는 성능이 떨어진다.
▸ 수치: SCR=20, 비교 droop 이득=0.03 (저) / 0.2 (식 (7) 정합)p.u., 오버슈트·정정시간 개선량=수치 미제시 (파형이 이미지라 판독 불가)
▸ 조건: 계통=SCR = 20, 제어=PSC + VR + PRF (q축은 VR, d축은 P 이득 폐루프), 미고려=RPC/AVC 와 PSC 의 상호작용은 [23] 에서 고려되지 않음
▸ 근거: p.7 Sec. IV-C, Fig. 11 · Fig. 12; p.7 Sec. IV-C 마지막 문단 (experiment_hw)
※ ※ 고유값 기반 비용함수의 맹점을 보여 준다 — PRF 는 극점을 바꾸지 않으므로 ζ 는 그대로인데 과도응답은 좋아진다. 우리 PSO 가 ζ_min 만 보면 PRF 같은 영점 성형 설계를 평가할 수 없다. 정정시간·오버슈트를 비용함수에 넣든지, PRF 류는 PSO 범위 밖이라고 명시하든지 둘 중 하나를 논문에 적어야 한다.

### C13 `method` — auto_checked
▸ 외부루프 plant 는 MIMO 이므로 비대각 성분이 만드는 P-Q 동적결합을 상쇄하는 전력 디커플링 제어(PDC)를 쓰면 대각 plant 가 거의 상수가 되어 SR 모드가 상쇄되고 안정여유가 크게 개선되지만, 디커플링 제어기가 계통 저항·인덕턴스 추정에 강하게 의존해 값이 작은 강계통에서 추정이 어렵다는 한계가 있다.
▸ 조건: 결합 분류=정적 결합(0 Hz 근방, SR 해결 불가) vs 동적 결합(전차수, SR 포함), 완화책=[26] 은 필터 인덕턴스와 VR 을 디커플링 제어기에 포함시켜 계통 임피던스 추정오차 허용폭을 넓힘, 구조 전제=[26] 은 open-loop VVC 여서 필터 임피던스를 활용 가능, [27][51] 은 closed-loop VVC
▸ 근거: p.7 Sec. IV-D 1~3문단; p.8 Sec. IV-D, 식 (9)(10), Fig. 13 · Fig. 14; p.8 Sec. IV-D 4문단 (literature)
※ ※ closed-loop VVC 는 POC 에서 기본주파수 임피던스를 0 으로 성형해 필터 임피던스를 감쇠에 못 쓰고, open-loop VVC 는 쓸 수 있다는 지적이 우리 구조 선택에 직접 걸린다 — 우리 모델은 closed-loop VVC 이므로 이 '추가 감쇠'를 못 받는 쪽이다. 또 계통 임피던스 추정 의존성은 SCR-X/R 을 모르는 실계통에서 PDC 류를 배제할 근거가 되고, 역으로 '임피던스 추정 없이 강건한 이득'을 찾는 PSO 의 동기가 된다.

### C14 `comparison` — auto_checked
▸ closed-loop VVC 구조에서 내부루프 이득들의 SSR 감쇠 기여는 부호가 서로 다르다 — VVC 의 P 이득은 SSR 을 감쇠시키고, VVC 의 I 이득은 SSR 감쇠를 악화시키며, VCC 의 P 이득도 SSR 감쇠를 악화시키고, VCC 의 I 이득은 통상 작아 해석에서 제외된다.
▸ 수치: VVC P 이득 → SSR=+ (감쇠 개선), VVC I 이득 → SSR=- (감쇠 악화), VCC P 이득 → SSR=- (감쇠 악화), VCC I 이득 → SSR=통상 작아 미고려
▸ 조건: 계통=강계통 연계, SSR 모드 기원=VVC 의 I 제어기가 PSC 폐루프에 새 켤레극점 쌍을 추가
▸ 근거: p.9 Sec. V-A-2 (a)~(d) 목록; p.5 Sec. III-B-2; p.9 Table III (내부루프 행) (literature)
※ ※ 우리 PSO 탐색변수 Kpv 가 바로 이 표의 'VVC P 이득'이다. 이 논문에 따르면 Kpv ↑ 는 SSR 을 개선하고 SR 을 악화시키며(C06), 고정해 둔 Kpc=5.0 은 SR 에 유리하고 SSR 에 불리하다. 즉 우리 모델에서 Kpv 와 Kpc 를 동시에 흔들면 두 대역 ζ 가 반대로 움직여야 한다 — 이것은 PSO 결과의 타당성 점검(sanity check)으로 쓸 수 있는 예측이다. 부호가 반대로 나오면 모델이나 대역 귀속이 잘못된 것이다. 다만 이 논문은 50 Hz·단단 VSC 기준이므로 2단 PV+ESS 에서 DC단 모드가 끼어들면 부호가 유지된다는 보장은 없다.

### C15 `result` — auto_checked
▸ 강계통(SCR=20)에서 VVC 의 P 이득을 낮추면 시스템이 SSR 로 불안정해지는 것이 실험으로 관측되었다.
▸ 수치: SCR=20, VVC P 이득 변화=감소 (전후 수치는 그림에 미표기·판독 불가), 결과=SSR 발산 (불안정)
▸ 조건: 계통=SCR = 20, 제어구조=closed-loop VVC + VCC
▸ 근거: p.9 Sec. V-A-2 마지막 문단, Fig. 15 (experiment_hw)
▸ supports → [[#C14]]
※ ※ C14 의 부호 주장을 실험으로 받친 유일한 지점이다. 나머지 (b)(c)(d) 는 인용문헌 근거뿐이다 — 우리가 인용할 때 '실험으로 확인된 것은 VVC P 이득 한 가지'라고 구분해 써야 한다.

### C16 `assumption` — auto_checked
▸ GFM-VSC 의 캐스케이드 구조는 외부루프(동기화·전력·전압)와 더 빠른 내부루프(VVC·VCC)의 시간척도 분리를 전제하지만, 내부루프 대역폭이 외부루프 대역폭을 덮기 때문에 내부루프가 외부루프 동역학에 영향을 주고 새 진동모드를 만들어 SSR 을 유발할 수 있다 — 즉 시간척도 분리는 소신호 안정도 해석에서 성립하지 않는다.
▸ 수치: VCC 대역폭=수백 Hz ~ kHzHz, 대역폭 설계 순서=BW(VVC) < BW(VCC)
▸ 조건: 대역폭 순서=PSC < VVC < VCC (VCC 대역폭 수백 Hz~kHz), 구조=dual-loop vector control
▸ 근거: p.1 Sec. I 1단 2문단; p.4 Sec. III-B-2; p.9 Sec. V-A 1문단 · V-A-2 마지막 문단 (literature)
▸ supports → [[#C14]]
※ ※ 요청하신 2번 항목의 핵심. 두 가지가 나온다. (1) PSO 탐색공간 제약: BW(PSC) < BW(VVC) < BW(VCC) 순서를 부등식 제약으로 걸 수 있다 — 우리 변수로는 wc(전력 LPF) 와 Kpv(VVC), 고정된 Kpc(VCC) 사이의 순서다. (2) 모델 축약 금지 근거: 내부루프를 대수적으로 축약한 저차 모델은 SSR 모드를 통째로 놓친다. 즉 우리 22차 전차수 모델을 유지해야 하는 이유를 이 논문으로 인용할 수 있다. 다만 이 주장은 이 논문이 직접 유도한 것이 아니라 인용문헌 종합이라는 점을 밝혀야 한다.

### C17 `comparison` — auto_checked
▸ 전류 피드백 가상임피던스(VI)와 전압 피드백 가상어드미턴스(VA)는 모두 VSC-계통 결합 임피던스를 키워 강계통 SSR 을 완화하지만 삽입 위치가 다르다 — VI 는 POC 와 계통 사이에, VA 는 가상 EMF 점과 POC 사이에 R,L 을 모사하며, VA 는 미분제어기를 쓰지 않고 VVC 의 PI 를 LPF 로 바꾸는 것만으로 구현된다.
▸ 조건: VI 주의=미분제어기는 고주파 잡음을 증폭해 실무에서 거의 쓰지 않고 LPF 를 직렬로 둠, VI LPF 차단주파수=dq 프레임 구현 시 특정 범위 권고 (PDF 에서 수치가 이미지로 소실)
▸ 근거: p.10 Sec. V-B-1 · V-B-2, Fig. 16 · Fig. 17; p.10 Sec. V-B-2 3문단; p.9 Table III (임피던스 성형 행) (literature)
※ ※ 우리 모델의 Lv(가상 인덕턴스, 1e-3 H) 가 어느 쪽에 해당하는지 정의를 맞춰야 한다 — model.py 에서 Lv 는 VCC 의 교차결합항 w0*(L1+Lv) 에 들어가므로 VSC-POC 사이를 모사하는 VA 계열에 가깝다. 이 구분을 레코드 수준에서 확정해 두지 않으면 논문에서 '가상임피던스'라고 뭉뚱그려 쓰다가 심사에서 위치를 지적당한다.

### C18 `result` — auto_checked
▸ VA 제어(Rv=0.1 p.u., Lv=0.3 p.u.)는 SCR=20 에서 기존 VVC 의 SSR 을 억제했지만, SCR=1.5 의 약계통에서 0.5 p.u. 유효전력을 주입하면 POC 전압이 0.9 p.u. 아래로 떨어져 계통연계 규정을 위반했고, 최악의 경우 초약계통에서 정상상태 운전점을 잃을 수 있다.
▸ 수치: 가상저항=0.1p.u., 가상인덕턴스=0.3p.u., 강계통 SCR=20, 약계통 SCR=1.5, 주입 유효전력=0.5p.u., POC 전압=< 0.9p.u.
▸ 조건: 강계통 조건=SCR = 20, 약계통 조건=SCR = 1.5, P = 0.5 p.u., 해결책=VA 의 전압 기준을 조정하는 추가 AC 모선 전압크기 제어(PI 또는 P) 필요
▸ 근거: p.10 Sec. V-B-2, Fig. 18; p.10 Sec. V-B-2 마지막 문단, Fig. 19; p.11 Sec. V-B-2 이어지는 문단 (experiment_hw)
※ ※ 안정도 이득이 정상상태 전압 규정을 깨뜨리는 사례다. 우리 PSO 가 Lv/Kpv 를 키워 ζ 를 얻더라도, SCR=1.5 같은 약계통에서 POC 전압 0.9 p.u. 제약을 동시에 검사하지 않으면 실계통에서 못 쓰는 해를 낸다. 즉 PSO 제약조건에 '전 운전점에서 |V_poc| ≥ 0.9 p.u.' 를 넣을 근거이고, 우리 op.py 의 동작점 수렴 판정과 함께 걸어야 한다.

### C19 `comparison` — auto_checked
▸ 전통적 GFL 은 강계통에서 안정 강건성이 높고 약계통에서 불안정해지는 반면 closed-loop VVC 기반 GFM 은 그 반대 — 약계통에서 더 강건하고 강계통에서 취약하다 — 이 쌍대성이 GFM·GFL 통합 제어의 동기다.
▸ 조건: GFM 전제=closed-loop VVC 구조
▸ 근거: p.11 Sec. V-C 1문단 (literature)
※ ※ 우리 연구의 기본 가정 점검용. 'GFM 은 약계통에서 문제'라는 통념과 반대 방향이다 — closed-loop VVC 구조(우리 구조)는 SCR 이 높을수록 위험하다. 우리 88포인트 스윕에서 SCR 을 낮추는 방향만 '어려운 쪽'으로 취급했다면 그 전제를 다시 봐야 한다. 실제로 runner.py 주석의 'X/R=3.0 에서 SCR 2.0→1.5 사이 모드 교차'는 약계통 쪽 현상이므로, 강계통 쪽(SCR 10~20) 스윕을 추가하지 않으면 이 논문이 지적한 위험 영역을 통째로 비워 둔 셈이 된다.

### C20 `result` — auto_checked
▸ GFM·GFL 통합 제어(하이브리드 동기화 제어 + 하이브리드 내부루프)는 SCR=1.5 와 SCR=20 양쪽에서 만족스러운 전력 스텝응답을 보였으며, GFL 유래 q-to-d 루프가 강계통 SSR 모드를 감쇠시키고 GFM 유래 d-to-q 루프가 약계통 안정도를 높여 서로를 보완한다.
▸ 수치: 검증 SCR=1.5 및 20, ud-FF 의 SR 감쇠 부호=강계통 + / 초약계통 -, 정량 응답지표=미제시 (파형 이미지, 수치 판독 불가)
▸ 조건: 구조=PSC + ud 전압 피드포워드(동일 dq 각 사용) + 하이브리드 VVC, 주의=ud-FF 는 강계통 SR 에 양의 감쇠를 주지만 초약계통에서는 음의 감쇠를 줄 수 있어 적당한 P 이득 권장, 한계=고장 중 전류제한기가 동작하면 하이브리드 내부루프가 무력해질 수 있음
▸ 근거: p.11 Sec. V-C-1, Fig. 20 · Fig. 21; p.11 Sec. V-C-1; p.9 Table III (통합 제어 행) (experiment_hw)
▸ supports → [[#C19]]
※ ※ 'SCR 1.5~20 전역 강건'이 이미 실험으로 제시되어 있다. 우리 신규성을 'SCR 강건성' 으로 주장하면 바로 이 그림에 부딪힌다 — 반드시 X/R 축·2단 PV+ESS DC단·PSO 다목적 쪽으로 신규성을 옮겨야 한다(C23 과 함께 읽을 것).

### C21 `result` — auto_checked
▸ 능동 서셉턴스(AS) 루프는 전력 외란이 만드는 q축 전압 변화에 d축 전류지령이 직접 반대로 반응하게 해 전력 외란을 감쇠시키며, 그 효과는 강계통에서 더 뚜렷하고 SCR=20 에서 통합제어기와 동등한 응답을 보였다.
▸ 수치: SCR=20, 비교 대상=[28] 통합제어기(Fig. 21)와 동등, AS P 이득=기호만 제시, 수치 미제시
▸ 조건: 계통=SCR = 20, 구조=PSC 유지(PLL 없음) + PRF + q-to-d 루프 + AS(uq→id)
▸ 근거: p.12 Sec. V-C-2, 식 (12), Fig. 23 · Fig. 24; p.12 Sec. V-C-2 (experiment_hw)
※ ※ 외란 감쇠를 전류지령 경로에서 직접 만드는 구조. 우리 모델에는 이 경로가 없으므로, 우리가 비교군을 만들 때 '구조 추가 없이 이득만 조정'이라는 PSO 의 제약이 어떤 성능 상한을 뜻하는지 밝히는 근거가 된다.

### C22 `method` — auto_checked
▸ GFM-VCC 는 변환기를 가상 동기조상기(SC)와 가상 전류원(CS)의 병렬로 성형해, 약계통에서는 가상 SC 가 PLL 용 전압을 유지하고 강계통에서는 VA 가 EMF 점과 POC 사이 결합 임피던스를 제공함으로써 넓은 SCR 범위에서 SSR 을 완화한다.
▸ 조건: 구조=VA + PRF 하이브리드, 스윙방정식은 전용 파라미터의 PLL 로 모사, 주의=고장 중 전류제한기 동작 시 하이브리드 내부루프가 무력해질 수 있음, 증거=응답 파형은 Fig. 21·24 와 유사하다며 재게재하지 않음
▸ 근거: p.12 Sec. V-C-3, Fig. 25 · Fig. 26; p.9 Table III (GFM-VCC 행) (literature)
※ ※ 이 논문에서 이 방법만은 실험 파형을 싣지 않고 '유사하다'고만 적는다. 인용할 때 '원 논문 [29] 의 결과'로 돌려야지 이 리뷰의 실험 결과로 쓰면 안 된다.

### C23 `result` — auto_checked
▸ 저자들의 결론은 적절한 능동 안정화 기법을 쓰면 높은 SCR 조건에서 저주파 공진을 효과적으로 감쇠할 수 있고, 초약계통부터 강계통까지 소신호 외란에 대해 강건·안정한 계통 연계가 보장된다는 것이다.
▸ 조건: 범위=소신호 외란에 한정, 대상=저주파 공진(SR·SSR), HFR 제외, 근거 폭=3 kW 실험 설비 · SCR 1.5/10/20 의 이산 지점
▸ 근거: p.13 Sec. VII Conclusion (assertion)
▸ depends_on → [[#C20]]
▸ depends_on → [[#C18]]
※ ※ 요청 5번 — 내 신규성 주장과 정면으로 충돌하는 대목이다. '초약계통~강계통 전역 강건'이 이미 선언되어 있으므로, 'SCR 전역 강건성 확보'를 신규성으로 내세우면 리뷰어가 이 문장을 들고 온다. 다만 이 선언은 (a) X/R 을 변수로 다루지 않고, (b) 이산 SCR 3점(1.5/10/20)만 실험했으며, (c) evidence_strength 가 assertion 인 결론 문장이라는 세 가지 빈틈이 있다. 우리 쪽 방어선은 'SCR 단일축이 아니라 SCR-X/R 2차원 경계, 특히 저 X/R 1.0~1.5', '단단 VSC 가 아닌 2단 PV+ESS 의 DC단 포함 22차', '수동 최악조건 설계가 아닌 PSO 다목적', 'CHIL 검증' 이다.

### C24 `result` — auto_checked
▸ open-loop VVC 에 관성(LPF/VSM)을 쓰지 않으면 SCR 변화 전 구간에서 SSR 문제가 없으므로, SSR 은 강계통에 연계된 GFM-VSC 의 보편적 문제가 아니다.
▸ 수치: 적용 SCR 범위=varying SCR (구체 범위 미명시)
▸ 조건: 제어구조=open-loop VVC, 관성·LPF 미적용, 대비=대부분의 SSR 보고는 강계통 조건에서 나옴
▸ 근거: p.5 Sec. III-B-2 마지막 문단; p.5 Table I (assertion)
▸ contradicts → [[#C07]]
※ ※ 공진 위험이 '계통 조건'보다 '제어구조 선택'에서 온다는 반례. 우리 논문이 'GFM 은 강계통에서 SSR 위험'이라고 일반화해 쓰면 이 문장에 반박당한다. 조건절(closed-loop VVC + I 제어기, 또는 LPF/관성 사용)을 반드시 붙여야 한다. 우리 모델은 둘 다 해당(VVC I 이득 Kiv + 전력 LPF wc)이므로 SSR 위험군이 맞다.

### C25 `limitation` — auto_checked
▸ 이 논문의 검증 범위는 50 Hz·3 kW 단단(single-stage) VSC 실험실 프로토타입과 이산 SCR 지점(1.5, 10, 20)에 한정되며, DC 링크는 600 V 고정 전압원으로 두어 DC단 동역학이 없고, X/R 은 '전송망=높음 / 배전망=낮음'의 정성 대비로만 등장하며 X/R 스윕이나 SCR-X/R 2차원 경계는 제시되지 않는다.
▸ 수치: 실험 SCR 지점 수=3, 설비 용량=3kW, DC 링크=600 V 고정V, X/R 수치 조건=제시 없음
▸ 조건: 확인 방법=Appendix Table IV 파라미터 목록 + 본문 전반에서 X/R 수치·DC단 상태변수 부재 확인, 읽은 판본=arXiv preprint 15쪽 — 게재본(18쪽)에서 추가되었을 가능성은 확인 못 함
▸ 근거: p.13 Sec. VIII Appendix, Table IV; p.4 Sec. III-A-1 (X/R 정성 서술만); p.3 Sec. II-B (HFR 범위 제외 선언) (assertion)
▸ depends_on → [[#C23]]
※ ※ 우리 연구가 들어갈 자리를 정확히 가리킨다 — X/R 정량축, 2단 PV+ESS 의 DC단 상태(C_pv, L_pv, C_dc, L_ess), 연속 SCR 스윕, CHIL. 다만 '없다'는 주장은 내가 읽은 preprint 기준이므로 게재본 확인 전에는 공백 근거로 쓰기 전에 한 번 더 확인해야 한다.

## Gaps
- **G01** [high/phd] X/R 축의 정량화 공백 — SR 은 저항(낮은 X/R 유리), SSR 은 리액턴스(낮은 X/R 불리)에 반대로 의존한다는 메커니즘까지는 제시하지만, X/R 수치 조건도 X/R 스윕도 SCR-X/R 2차원 안정 경계도 없다. 특히 X/R 1.0~1.5 구간에서 두 공진 위험이 교차하는 지점은 미제시다. ← C05, C07, C08, C25 · 반증검색: `not_searched`
  ※ 반증 검색 전 — 논문에 '공백'으로 쓰지 말 것
- **G02** [high/phd] 이득 조정이 수동·최악조건 해석설계(식 (6)(7))에 머문다 — SR 과 SSR 이 droop 이득·LPF 차단주파수·VVC/VCC 이득에 대해 반대 부호로 작용한다는 표까지 정리했으면서, 이 상충을 동시에 다루는 다목적 수치최적화(PSO 등)는 수행하지 않는다. ← C08, C09, C14, C10 · 반증검색: `not_searched`
  ※ 반증 검색 전 — 논문에 '공백'으로 쓰지 말 것
- **G03** [high/phd] DC단·2단 구성 부재 — DC 링크를 600 V 고정 전압원으로 두어 PV MPPT·DC링크·ESS 컨버터 동역학이 저주파 공진에 어떻게 끼어드는지 다루지 않는다. 2단 PV+ESS 에서 C14 의 감쇠 부호표가 유지되는지도 미확인이다. ← C25, C14 · 반증검색: `not_searched`
  ※ 반증 검색 전 — 논문에 '공백'으로 쓰지 말 것
- **G04** [medium/phd] 검증 수준 — 3 kW 실험실 프로토타입의 스텝응답 파형이 전부이고, 실시간 시뮬레이터(RTDS) CHIL 이나 계통 규모 검증은 없다. 또 정량 지표(ζ, 정정시간, 오버슈트)를 표로 제시하지 않아 재현·비교가 어렵다. ← C15, C18, C20, C25 · 반증검색: `not_searched`
  ※ 반증 검색 전 — 논문에 '공백'으로 쓰지 말 것
- **G05** [medium/phd] 모드 귀속 방법의 공백 — 공진과 제어루프의 대응을 전달함수 극점과 인용문헌으로 세우고 참여계수(participation factor) 기반 귀속은 제시하지 않는다. 따라서 주파수만으로 모드를 대역에 배정할 때 생기는 모호함(SR≈f1 이 '제어루프 대역'에 떨어지는 문제, SSR 이 0~0.5 f1 에 걸쳐 두 대역으로 쪼개지는 문제)은 해소되지 않는다. ← C01, C02, C04, C16 · 반증검색: `not_searched`
  ※ 반증 검색 전 — 논문에 '공백'으로 쓰지 말 것

