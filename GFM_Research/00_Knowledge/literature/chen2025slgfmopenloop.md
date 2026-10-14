---
type: literature
cite_key: chen2025slgfmopenloop
ref_num: ""
title: Open-Loop Unstable Behavior in A Class of Single-Loop Grid-Forming Control
authors: [Meng Chen, Ioannis Lestas, Yufei Xi, Lin Cheng]
corresponding: ""
year: 2025
venue: 미검증 — 학회명·세션·수록 페이지가 본문·머리말·꼬리말 어디에도 없다
doi: 10.17863/cam.126549
pdf: [[chen2025slgfmopenloop.pdf]]
pdf_status: have
paper_type: analysis
target_system: 일반
control_scheme: [SL-GFM (단일루프 — 내부 전압·전류 루프 없음), AP 루프: 스윙방정식 기반 가상관성 + p-ω 드룹, RAP 루프: droop-I (q-V 드룹 + 적분)]
model_order: 미명시
analysis_method: [상세 소신호 전달함수 모델링(LCL 동특성 포함), Routh 안정판별, 개루프 극점 위치, Nyquist 선도, 시간영역 시뮬레이션]
tuning_method: 미명시
scr_range: 미명시 — SCR 을 언급하지 않는다. Lg=0.2 p.u. 가 있으나 '계통측 필터 인덕터 + 선로' 합산값이라 계통 단독 SCR 로 환산할 수 없다
xr_range: Xg/Rg = 17, 6 두 값만. 저 X/R(1.0~1.5) 구간은 다루지 않는다
validation_level: sim-only
hardware: [없음]
extraction_depth: full
dc_ac_coupling: 미포함 — Fig. 1 에 vdc 가 그려져 있으나 DC단 동특성은 모델에 없다(식 (7)-(12) 에 DC 상태변수 없음)
pso_params: ""
section: ""
tags: [literature, single-loop grid-forming control, reactive power control, LCL resonance, Routh criterion, open-loop unstable]
status: read
---
# Open-Loop Unstable Behavior in A Class of Single-Loop Grid-Forming Control

## 조건·파라미터
| 항목 | 기호 | 값 | 단위 |
|---|---|---|---|
| 공칭 주파수 | fn | 50 | Hz |
| 필터 커패시터 | Cf | 0.048 | p.u. |
| 인버터측 인덕터 | Lf | 0.1 | p.u. |
| 계통측 인덕터 + 선로 | Lg | 0.2 | p.u. |
| 관성 상수 | H | 0.5 | s |
| 유효전력 제어 댐핑 | Dp | 50 | - |
| q-V 드룹 계수 | Dq | 10 | - |
| 유효전력 설정점 | Pst | 0.5 | p.u. |
| 무효전력 설정점 | Qst | 0 | p.u. |
| 전압 설정점 | Vst | 1 | p.u. |
| 선로 X/R (사례 1) | Xg/Rg | 17 | - |
| 선로 X/R (사례 2) | Xg/Rg | 6 | - |
| RAP 루프 적분이득(사례별 값) | kq | 1.5 / 4 / 11 | - |

## Claims
### C01 `problem` — auto_checked
▸ SL-GFM 구조에서는 출력 필터 때문에 RAP(무효전력) 루프에 순수 드룹만 적용하면 정상상태 오차가 생기고, 이를 없애려고 드룹에 적분을 더한 droop-I 제어가 널리 채택돼 왔다.
▸ 근거: p.1 Sec. I Introduction, 1열 하단~2열 상단 ([7] 인용) (literature)
※ 우리 2단 PV+ESS 는 전압-전류 이중루프로 필터 커패시터 전압을 내부 루프가 직접 제어한다 — 여기서 말하는 '필터 때문에 생기는 드룹 정상상태 오차' 자체가 우리 구조에서는 다르게 나타나므로 droop-I 채택 동기부터 우리와 일치하지 않는다.

### C02 `problem` — auto_checked
▸ 기존 SL-GFM 안정도 연구는 전력 루프와 LCL 공진이 대역폭이 분리돼 있다는 이유로 둘을 분리 취급해 LCL 동특성을 생략해 왔고, RAP 루프 자체의 안정도 문제는 AP 루프에 비해 거의 다뤄지지 않았다.
▸ 근거: p.1 Sec. I Introduction, 2열 ([8], [9] 인용) (literature)

### C03 `method` — auto_checked
▸ 저자들은 LCL 필터와 선로 동특성을 정적 이득으로 축약하지 않고 전부 유지한 상세 소신호 모델을 계통 dq 기준틀에서 세우고(전달행렬 A, B), 이를 스윙방정식 AP 루프와 droop-I RAP 루프에 결합해 Fig. 2 의 블록선도로 정리한다.
▸ 조건: 기준틀=계통 dq — GFM 기준틀과는 각도차 δ 로 연결(식 (29)(30)), 모델 범위=LCL·선로 6상태 + 제어 3상태, DC단·제어지연·내부루프 없음
▸ 근거: p.2 Sec. III-A, 식 (7)-(19), Fig. 1; p.3 Sec. III-A, 식 (26)-(34) 및 Fig. 2 (상세 LCL 포함 소신호 블록선도); p.3 Sec. III-B, 식 (35)-(37) — Gpδ(s), GqE(s), GVE(s) 는 정적 이득이 아니라 LCL 동특성을 그대로 담는다 (analytical)
▸ same_as → [[chen2026lcl_slgfm#C03]]
※ LCL·계통 블록을 전달행렬로 묶어 전력·전압 출력을 Erf·δ 로 환원하는 방식은 우리 22차 상태공간의 LCL·계통 부분을 교차검증할 때 쓸 수 있다. 다만 DC단과 내부 전압·전류 루프가 없어 모델 구조 자체를 옮겨올 수는 없다.

### C04 `assumption` — auto_checked
▸ 핵심 결론은 두 가정 위에 서 있다 — (i) 유도성 리액턴스가 저항보다 지배적이면 AP 루프와 RAP 루프를 분리해 볼 수 있다, (ii) 계통이 이상적으로 유도성이다(식 (7)-(12) 에 Rg 가 없고, 저항은 Routh 배열의 미소 섭동 ε>0 로만 되돌아온다).
▸ 조건: 루프 분리=X >> R 일 때만 성립, 저항 취급=Rg 를 상태방정식에서 빼고 Routh 배열의 0 계수를 대체하는 ε 로만 반영
▸ 근거: p.3 Sec. III-B 첫 문단(AP/RAP 분리 가정) 및 Fig. 3; p.4 Sec. III-B, 식 (54) 아래 Routh 배열 — ε>0 도입 문단(수학적으로는 배열 정의, 물리적으로는 기생저항 반영) (analytical)
※ 우리 연구축은 X/R 1.0~1.5 의 저항성 계통이다. 이 논문 핵심 정리의 전제(X >> R)와 정반대 구간이므로 결론을 그대로 가져다 쓸 수 없다.

### C05 `result` — auto_checked
▸ 전압크기 V 되먹임이 없으면 전력 루프의 개루프 극점은 LCL 공진 주파수 ω1, ω2 와 동기 주파수 ωg 에 정확히 놓여 허수축 상에서 한계안정이고, 실제 기생저항이 이들을 좌반평면으로 밀어 최소위상이 되므로 0 dB 이득·-180도 위상 교차 기준을 신뢰할 수 있다.
▸ 수치: LCL 공진 주파수=ωn·sqrt((Lf+Lg)/(Lf·Cf·Lg))rad/s, 동기 공진 주파수=ωn·ωgrad/s, dq 기준틀 공진 극점=ωLCL-ωLg, ωLCL+ωLgrad/s
▸ 근거: p.4 Sec. III-B, 식 (40)-(48) 및 그 아래 문단 (analytical)

### C06 `result` — auto_checked
▸ RAP 루프에 전압크기 되먹임 ΔV 가 들어가면 개루프 전달함수 Gq(s) 에서 LCL 공진에 해당하는 det(B) 극점이 되먹임 상호작용으로 상쇄되고, 대신 s·det(B) + kq·Dq·NVE(s) = 0 라는 새 특성방정식이 개루프 극점을 결정한다 — s^4 항이 없는 5차식 s^5 + a3·s^3 + a2·s^2 + a1·s + a0 = 0 이다.
▸ 수치: a3=ω1^2 + ω2^2, a2=vd0·kq·Dq·ωLC^2/V0, a1=ω1^2·ω2^2 - 2·vq0·kq·Dq·ωLC^2·ωLg/V0, a0=vd0·kq·Dq·ωLC^2·ω1·ω2/V0, s^4 항 계수=0
▸ 근거: p.4 Sec. III-B, 식 (52)-(58) (analytical)
▸ depends_on → [[#C03]]

### C07 `result` — auto_checked
▸ Routh 판별을 적용하면 ε→0+ 에서 첫 열의 s^3 행 항 a3-a2/ε 이 음의 무한대로 발산하고 다음 s^2 행 항은 a2>0 로 돌아와 부호가 두 번 바뀌므로, 이상적 유도성 계통에서 droop-I RAP 루프는 계통·제어 파라미터와 무관하게 항상 최소 2개의 우반평면 개루프 극점을 가지며 이 불안정은 제어 이득 조정으로 제거할 수 없다.
▸ 수치: RHP 개루프 극점 개수(하한)=2개, lim(ε→0+) a3-a2/ε=-∞ (<0), lim(ε→0+) a2-(a1·ε^2-a0·ε)/(a3·ε-a2)=a2 (>0)
▸ 조건: 계통=이상적 유도성 (Rg = 0, ε→0+), 원인=RAP 루프 안쪽의 전압크기 ΔV 되먹임 — 구조적, 파라미터 의존성=없음 — a1, a0 의 부호와 무관하게 성립
▸ 근거: p.4 Sec. III-B, Routh 배열 및 식 (59); p.5 Sec. III-B 상단, 식 (60) 및 '구조적 개루프 불안정 / 파라미터 조정으로 완화 불가' 문단 (analytical)
▸ depends_on → [[#C06]]
▸ depends_on → [[#C04]]
▸ extends → [[chen2026lcl_slgfm#C10]]
※ 내 PSO 이득조정 신규성과 정면으로 부딪히는 대목이다 — 구조적 개루프 불안정은 이득 최적화로 없앨 수 없다. 다만 전제가 (i) 단일루프 + droop-I, (ii) 이상적 유도성 계통이라, 이중루프·저 X/R 인 우리 구조로 자동 확장되지 않는다. 같은 저자군이 저널판에서 '내부 전압-전류 제어가 있으면 추가 자유도로 비최소위상 거동을 일반적으로 제거할 수 있다'고 명시했으므로(chen2026lcl_slgfm#C14), 현재 근거로는 이 기구가 우리 2단 이중루프 구조로 옮겨지지 않는다고 보는 것이 맞다. 그래도 우리 22차 모델의 Q 채널 개루프 극점을 한 번 직접 확인해 두는 편이 안전하다.

### C08 `result` — auto_checked
▸ 저항이 있는 실제 계통에서는 ε 가 유한한 양수여서 항상 불안정하지는 않지만 a3-a2/ε 이 음이 되면 개루프 불안정 극점이 나타나고, RAP 적분이득 kq 가 커질수록 이 항이 작아져 불안정이 촉발된다 — RAP 루프 대역폭을 넓히는 것이 LCL 공진 불안정을 부르는 결합 경로다.
▸ 수치: 개루프 불안정 촉발 조건=a3-a2/ε < 0  ⇔  ω1^2+ω2^2 < vd0·kq·Dq·ωLC^2/(V0·ε), ε 와 Rg(X/R) 의 정량 대응=미제시
▸ 조건: 계통=유한 저항 (ε 유한 양수), 촉발 변수=kq 증가 — a2 가 kq·Dq 에 비례
▸ 근거: p.5 Sec. III-B, 'In practical systems, where the grid is not ideally inductive...' 문단 (analytical)
▸ depends_on → [[#C07]]
▸ same_as → [[chen2026lcl_slgfm#C06]]
※ 'RAP 루프를 빠르게 하면 고주파 공진이 깨진다'는 이 경로는 우리 PSO 적합도에 이득 상한 제약으로 넣을 수 있는 형태다. 다만 임계값이 ε 로만 표현돼 X/R 로 환산된 설계식이 없다 — 그 빈 자리가 우리 SCR-X/R 경계 작업과 맞닿는다.

### C09 `result` — auto_checked
▸ 사례 1(Xg/Rg = 17)에서 kq = 1.5 일 때는 개루프 극점이 모두 좌반평면이고 Nyquist 가 (-1,0)을 감싸지 않아 안정하지만, t = 5 s 에 kq 를 4 로 올리면 공진 주파수 근처에 우반평면 극점쌍이 생기고 시뮬레이션에서 출력 p, q 가 공진 주파수로 발산 진동한다.
▸ 수치: 개루프 극점 (kq=1.5, 안정)=-0.9±j5786.5, -0.6±j5158.4, -12±j314.3, -9.81/s, 개루프 극점 (kq=4, 불안정)=2.7±j5786.2, 3.5±j5158.7, -12.8±j314.4, -26.11/s, RHP 극점쌍 실수부=2.7, 3.51/s, 불안정 진동 각주파수=약 5158~5786 (약 821~921 Hz)rad/s, 임계 kq 구간 (X/R=17)=1.5 < kq_crit ≤ 4
▸ 조건: Xg/Rg=17, kq=1.5 → 4 (t = 5 s)
▸ 근거: p.5 Sec. IV-A, Table II 및 Fig. 4(a)(b) Nyquist; p.5 Fig. 5 — kq 증가 후 p, q 발산(확대창 24.99~25.01 s) (simulation)
▸ supports → [[#C08]]

### C10 `result` — auto_checked
▸ 사례 2(Xg/Rg = 6)에서는 kq = 4 에서도 개루프 극점이 모두 좌반평면이고 kq 를 11 로 올려야 우반평면 극점이 나타난다 — 선로 저항이 커질수록(X/R 이 낮을수록) ε 가 커져 같은 불안정을 일으키는 데 더 큰 kq 가 필요하다.
▸ 수치: 개루프 극점 (kq=4, 안정)=-2.95±j5786.2, -2.2±j5158.7, -34.1±j314.91, -26.261/s, 개루프 극점 (kq=11, 불안정)=7.8±j5785.2, 9.9±j5159.9, -34.3±j316.2, -71.61/s, 임계 kq 구간 (X/R=6)=4 < kq_crit ≤ 11, 같은 kq=4 에서의 뒤바뀜=X/R=17 이면 불안정, X/R=6 이면 안정
▸ 조건: Xg/Rg=6, kq=4 → 11 (t = 5 s)
▸ 근거: p.6 Sec. IV-B, Fig. 6(a)(b) Nyquist, Fig. 7 시간영역 (극점값은 p.5 Table II); p.6 Sec. IV-B 본문 — 증가한 Rg 가 더 큰 ε 를 만들어 Routh 첫 열 부호변화를 막는다는 설명 (simulation)
▸ supports → [[#C08]]
▸ same_as → [[chen2026lcl_slgfm#C09]]
※ 우리 서사('X/R 이 낮을수록 어렵다')에 대한 반대 방향 근거다 — 이 고주파 공진 기구에 한해서는 저항이 많을수록 안정 여유가 커진다. 저 X/R(1.0~1.5)에서 어려워지는 것은 저주파 동기화·전력결합 쪽이므로, 두 기구를 분리해 쓰지 않으면 내 주장과 충돌한다. 단 이 논문은 X/R 을 6 아래로 내려보지 않았다.

### C11 `limitation` — auto_checked
▸ 불안정한 두 사례 모두 Nyquist 선도가 (-1,0)을 감싸지 않는다 — 전통적 0 dB 이득·-180도 위상 교차 기준으로는 여유가 있어 보이는데도 개루프 우반평면 극점 때문에 폐루프가 불안정해지므로, 그 기준만으로 SL-GFM droop-I 의 안정 여유를 판정하면 안 된다.
▸ 수치: 불안정 사례의 (-1,0) 감김 수=0회
▸ 근거: p.5 Sec. IV-A, Fig. 4(b) 및 본문 — Nyquist 가 (-1,0)을 감싸지 않는데도 폐루프 불안정; p.6 Sec. IV-B, Fig. 6(b) 및 Sec. V Conclusion (simulation)
▸ depends_on → [[#C07]]
▸ same_as → [[chen2026lcl_slgfm#C11]]
※ 이득여유·위상여유를 PSO 적합도 항으로 쓰는 설계는 개루프 RHP 극점이 있으면 무효가 된다. 우리가 여유 지표를 적합도에 넣는다면 개루프 극점 위치를 먼저 확인하는 절차를 붙여야 한다는 뜻이다.

### C12 `limitation` — auto_checked
▸ LCL 동특성을 생략한 축약 모델은 이 불안정 기구를 담지 못하므로 그런 단순화 모델로 얻은 SL-GFM droop-I 안정도 결론의 타당성이 의심된다고 저자들은 주장한다.
▸ 근거: p.1 Abstract — 'This instability challenges the validity of simplified models neglecting LCL dynamics'; p.1 Sec. I Introduction 2열 ([9] 인용 문단) (analytical)
▸ depends_on → [[#C07]]
▸ same_as → [[chen2026lcl_slgfm#C04]]
※ 우리 22차 상태공간이 LCL 상태를 실제로 포함하는지, 평균화로 날렸는지가 이 지적의 사정권이다. 포함돼 있다면 이 비판은 우리에게 해당하지 않고 오히려 상세 모델을 쓴 근거로 인용할 수 있다. 포함돼 있지 않다면 신규성 주장 전에 고주파 모드 점검이 필요하다.

### C13 `future_work` — auto_checked
▸ 저자들은 droop-I RAP 제어를 쓰는 SL-GFM 에는 공진 댐핑 구현이 필수이며 공진 불안정을 명시적으로 다루지 않는 한 널리 쓰이는 droop-I 를 권하지 않는다고 결론짓고, 가능한 댐핑 방안은 선행 연구 [15] 로 넘긴다 — 이 논문 자체는 댐핑 설계를 제시하지 않는다.
▸ 근거: p.5 Sec. III-B 끝 — 'A viable damping strategy addressing this issue has been proposed in [15]'; p.6 Sec. V Conclusion; p.6 References [15] — M. Chen, Y. Xi, F. Blaabjerg, L. Cheng, I. Lestas, 'LCL resonance analysis and damping in single-loop grid-forming wind turbines,' arXiv:2504.06981, 2025 (assertion)
▸ depends_on → [[#C07]]
▸ extends → [[chen2026lcl_slgfm#C17]]

### C14 `comparison` — auto_checked
▸ 저자들은 이 논문의 기여를 선행 연구 [15] 와 명시적으로 구분한다 — [15] 는 특정 파라미터 값에 의존하는 근궤적 정량 해석으로 개루프 불안정을 관찰했고, 이 논문은 Routh 판별에 기반한 정성적·해석적 접근으로 그 근본 원인(전압크기 되먹임이 만드는 내부 루프)을 규명한다.
▸ 조건: 선행 연구 [15]=arXiv:2504.06981 (2025) — 본문에서 'Our previous work' 로 지칭. 볼트의 chen2026lcl_slgfm (IEEE TIE early access) 과 같은 논문, 시간 순서=이 학회 논문이 [15] 를 선행으로 인용한다 — 즉 이 논문이 뒤다
▸ 근거: p.1 Sec. I Introduction 2열 — 'Our previous work identified ... [15]' 및 '... analyzed through root-locus methods, which are dependent on specific parameter values' 와 이어지는 기여 문단; p.6 References [15] (literature)
▸ extends → [[chen2026lcl_slgfm#C10]]
※ 두 편을 같이 인용할 때 순서를 뒤집으면 안 된다. '현상 발견·댐핑 설계·실험(저널판) → 파라미터 무관 해석 증명(이 학회판)' 순서로 써야 한다.

## Gaps
- **G01** [high/phd] 저 X/R 구간(1.0~1.5)이 비어 있다. 이 논문이 시험한 X/R 은 17 과 6 뿐이고, 저항이 커지면 ε 가 커져 안정해진다는 설명은 정성적이다 — ε 와 X/R 의 대응식도, 임계 kq 를 X/R 의 함수로 그린 경계도 없다. 배전급 저 X/R 에서 이 기구가 실질적으로 사라지는지 남는지는 미해결. ← C04, C08, C10 · 반증검색: `partially_addressed`
- **G02** [high/phd] 단일루프(SL-GFM)에 한정된 결과다. 이 논문 자체는 전압-전류 이중루프/다중루프 GFM 에서도 RAP 루프 내부의 전압크기 되먹임이 같은 구조적 개루프 불안정을 만드는지 다루지 않는다 — 2단 PV+ESS 이중루프로의 이전 가능성을 이 논문만으로는 판단할 수 없다. ← C03, C07 · 반증검색: `already_addressed`
- **G03** [medium/phd] DC단이 모델에 없다. DC-link 전압 제어, PV 어레이·ESS 변환단 동특성, DC-AC 커플링이 이 개루프 불안정 기구와 어떻게 상호작용하는지 이 논문은 다루지 않는다. ← C03, C04 · 반증검색: `partially_addressed`
- **G04** [medium/phd] 이 학회판의 검증은 시간영역 시뮬레이션뿐이고 시뮬레이터조차 명시되지 않았다. 약 820~920 Hz 대역의 불안정은 디지털 제어지연·샘플링과 얽히므로 CHIL 급 검증이 따로 필요하다. ← C09, C10 · 반증검색: `already_addressed`
- **G05** [high/phd] Routh 배열의 섭동 ε 가 물리 파라미터(Rg, X/R, 기생저항)와 어떻게 대응하는지 정의되지 않아, 해석 결과를 설계 기준(임계 kq 또는 허용 RAP 대역폭)으로 환산할 수 없다. ε(Rg) 를 정식화하면 X/R 평면 위의 안정 경계를 해석식으로 그릴 수 있다. ← C04, C08 · 반증검색: `not_searched`
  ※ 반증 검색 전 — 논문에 '공백'으로 쓰지 말 것

