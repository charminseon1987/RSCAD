# xval.py 에 양자화 붙이기

`quantize.py` 를 `Simulation/` 에 넣고, `xval.py` 를 **세 곳** 고친다.
기존 코드의 변수명에 의존하는 부분은 ③ 한 줄뿐이다.

---

## ① 맨 위 import 옆

```python
import quantize as Q
```

## ② 인수 추가 — `parser.add_argument(...)` 들 사이

```python
parser.add_argument('--quantize', type=int, default=0,
                    help='계측 ADC 비트수. 0 이면 양자화 없음 (기본)')
parser.add_argument('--headroom', type=float, default=1.5,
                    help='풀스케일 = 정격 × headroom. 작으면 포화, 크면 분해능 낭비')
```

## ③ 비선형 적분에 쓰는 우변 함수를 감싼다

`xval.py` 안에서 비선형 궤적을 적분할 때 쓰는 함수를 찾는다.
`solve_ivp(...)` 나 `integrate(...)` 에 넘기는 그 함수다. 보통 이런 모양이다.

```python
rhs = lambda t, x: M.f_num(x, u, ...)          # ← 이런 줄
```

그 **바로 아래**에 넣는다.

```python
# ADC 양자화. 제어기가 읽는 값만 계단이 된다 — 적분기 8개와 VSG 상태 4개는 DSP 내부다.
if args.quantize:
    qz = Q.Quantizer.from_op(op, M, bits=args.quantize, headroom=args.headroom)
    _raw = rhs
    rhs = lambda t, x: _raw(t, _qz_state(x))
```

`rhs` 의 인수 모양이 `(t, x)` 가 아니면 그에 맞춘다. 핵심은 **x 를 양자화해서 넘기는 것**뿐이다.

간단히 쓰려면 헬퍼를 하나 두면 된다.

```python
_qz_state = qz if args.quantize else (lambda x: x)
```

## ④ 끝에 보고 출력 — 결과 저장 직전

```python
if args.quantize:
    print(f'\n  ── 계측 양자화 ──')
    print(qz.report())
    out['quantize'] = {'bits': args.quantize, 'headroom': args.headroom,
                       'clips': int(qz.clips.sum())}
```

`out` 은 JSON 으로 저장하는 딕셔너리 이름이다. 다르면 그 이름을 쓴다.

---

## 실험 순서

```bash
python Simulation/xval.py --input Pref --tol 0.005 --fresh
python Simulation/xval.py --input Pref --tol 0.005 --quantize 16 --fresh
python Simulation/xval.py --input Pref --tol 0.005 --quantize 12 --fresh
python Simulation/xval.py --input Pref --tol 0.005 --quantize 10 --fresh
```

`--fresh` 를 빼면 기존 결과에 섞인다. 조건이 다르므로 반드시 나눠 저장한다.
파일명도 `linearization_validity_Pref.json` 으로 같으니, 실행마다 폴더를 옮기거나
`--quantize` 를 파일명에 넣도록 `xval.py` 의 저장 경로를 손본다.

## 무엇을 보는가

| 지표 | 양자화 없음 | 양자화 있음 | 뜻 |
|---|---|---|---|
| 회귀 지수 n | 2 에 근접 | 작은 섭동에서 2 에서 벗어남 | 벗어나기 시작하는 지점이 **측정 하한** |
| R² | 0.998 이상 | 작은 섭동에서 하락 | 양자화 잡음이 곡선을 흐린다 |
| 유효 범위 | SCR 따라 단조 감소 | 하한 근처에서 요동 | 요동 구간은 믿을 수 없다 |
| 포화 횟수 | — | 0 이어야 정상 | 0 이 아니면 headroom 을 올린다 |

▸ **회귀 지수가 2 에서 벗어나기 시작하는 섭동 크기가 곧 그 ADC 의 측정 하한이다.**
※ 이 값이 허용치(`P5-A7`)의 하한이 된다. 허용치를 그보다 작게 잡으면 측정으로 확인할 수 없다.

## 주의

▸ 양자화는 비선형이다. 선형 예측 궤적에는 넣지 않는다. **비선형 쪽에만** 넣어야
  "실제 시스템이 계단을 보는 상황"이 된다.
▸ 디더는 기본으로 꺼져 있다. 켜면 실행마다 결과가 달라져 재현이 깨진다.
▸ 포화가 생기면 그 조건의 결과는 버린다. 포화는 소신호 영역을 벗어난 현상이다.
