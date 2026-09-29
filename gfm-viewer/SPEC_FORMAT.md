# gfm-live-flow 모델 spec 형식 (`gfm-live-flow/spec@1`)

뷰어(`gfm-live-flow.html`)는 JSON 파일 하나로 모델을 받아 브라우저에서 RK4(20 µs)로 적분한다.
JSON은 **손으로 쓰지 않고** `export_spec.py`가 `model.py`의 sympy 식에서 생성한다 → Python 해석과 화면이 같은 식을 쓴다.

## 필드

| 필드 | 형식 | 설명 |
|---|---|---|
| `format` | `"gfm-live-flow/spec@1"` | 고정 |
| `name` | 문자열 | 화면에 표시될 모델 이름 |
| `states` | `[{name, label, unit}]` | 상태벡터 **순서 그대로**. `w`(ω, pu)와 `dl`(δ, rad)는 필수 |
| `inputs` | `{이름: 기본값}` | 뷰어 컨트롤과 연결: `Pref`, `Qref`, `Vg`, `SCR`, `XR` (추가 입력은 기본값 고정) |
| `params` | `{이름: 값}` | 모든 파라미터 (pu, 정격값 정규화 기준) |
| `sliders` | `{파라미터: {label, unit, min, max}}` | 화면에서 조절할 파라미터 (예: H, D, PSO 대상 게인) |
| `rhs` | `[JS 식]` | dx/dt, states와 같은 순서. `sympy.jscode` 출력 |
| `signals` | `{슬롯: JS 식}` | 블록도 선에 표시할 신호 (아래 슬롯 표). 없는 슬롯은 "—" |
| `x0` | `[숫자]` | 기본 입력에서의 운전점 (초기값) |
| `check` | `{x, inputs, f, tol}` | 검증 벡터: Python에서 계산한 f(x). 뷰어가 불러올 때 자체 대조 → ✓/✗ 표시 |

## 신호 슬롯 (블록도 배선과 1:1)

| 단 | 슬롯 |
|---|---|
| ① 전력 동기화 | `eP` (P_ref−P_f), `dw` (ω−1), `w`, `pe`, `Pf`, `eQ`, `dV`, `Vref`, `qe`, `Qf` |
| ② 전압 루프 | `evd`,`evq` (오차), `pvd`,`pvq` (PI 출력), `iod`,`ioq` (피드포워드), `cvd`,`cvq` (ωC 결합), `ildr`,`ilqr` (출력) |
| ③ 전류 루프 | `ecd`,`ecq`, `pcd`,`pcq`, `vod`,`voq` (피드포워드), `ccd`,`ccq` (ωL 결합), `vid`,`viq` |
| 측정 | `ild`,`ilq`,`vod`,`voq`,`iod`,`ioq` |
| DC 단 (선택) | `vdc`, `vpv`, `ipv`, `ibat` |

## 22차 연구 모델을 옮길 때 확인할 것
1. **상태 이름**: ω는 `w`, δ는 `dl`로 (다르면 export 단계에서 `sp.Symbol` 이름만 바꿔 매핑)
2. **단위**: 모든 식이 pu·초 기준인지. `wb`(기준 각주파수)는 params에 포함
3. **VSG 형태**: 뷰어의 ① 블록 라벨은 `1/(2Hs+D)`. 모델이 J·D(SI) 형태면 라벨과 슬라이더 이름만 다르고 동작은 같음
4. **DC 단**: `vdc` 신호를 넣으면 VSI 블록 아래에 실시간 표시
5. **검증**: 불러온 뒤 "검증 ✓"가 떠야 한다. ✗면 jscode 변환(예: `Heaviside`, `Piecewise`, `sign` 같은 불연속 함수)을 먼저 의심
6. **전류 제한기 등 불연속 요소**: `sp.Piecewise`는 jscode가 삼항 연산자로 변환하지만, 선형화 모델(model.py)과 비선형 시간영역은 결과가 다를 수 있음 → 화면은 **비선형 시간영역**이라는 점을 논문에서 구분
