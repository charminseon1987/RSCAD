---
name: research-journal
description: 실험 런에서 연구일지를 쓴다. results/<run>/meta.json 의 값을 그대로 인용하고, 직전 런과 비교하고, schedule.yaml 산출물에 연결하고, 막힌 것과 다음 할 일을 남긴다. "일지 써줘", "오늘 일지", "이 런 기록해줘", 실험을 돌린 뒤 기록이 필요할 때 사용한다. 추측값을 쓰지 않는다.
allowed-tools: Read Write Edit Bash Glob Grep
metadata:
  version: "1.0"
  writes-to: GFM_Research/RSCAD/03_실험/일지/
---

# 연구일지 — 실험에서 기록까지

## Overview

`POST /api/doc/journal` 이 만드는 뼈대는 `## 돌린 것` 표까지만 채우고 `▸`·`※` 는 빈
칸으로 남긴다. 이 스킬은 그 빈 칸을 **런의 실제 값에서** 채운다.

목표는 "오늘 뭐 했지"의 회고가 아니라 **나중에 논문 문장으로 쓸 수 있는 기록**이다.
그래서 기획서와 같은 규율을 따른다 — 사실과 판단을 가르고, 상태를 표시하고, 모르는
것을 모른다고 적고, 다음 할 일에 순서를 준다.

## 가장 중요한 규칙

**본 적 없는 값을 쓰지 않는다.** 이 저장소 전체가 지키는 단 하나의 원칙이다
(`Server/app.py` 머리말: "값을 날조하지 않는다").

- 수치는 `results/<run>/meta.json` 에서 **읽은 것만** 쓴다. 반올림하지 않는다.
- 파일을 못 열었으면 그 칸은 `[확인 필요 — 경로]` 로 둔다. 비우거나 지어내지 않는다.
- 직전 런과 비교할 때 비교 대상 런 이름을 반드시 적는다. "개선됐다"만 쓰지 않는다.
- 추세·원인은 전부 `※` 다. `▸` 에는 측정값과 그 값이 나온 조건만 들어간다.

## 입력

| 필요한 것 | 어디서 |
|---|---|
| 런 이름 | 사용자가 주거나, `results/LATEST.json` 의 `run_name` |
| 런 값 | `results/<run_name>/meta.json` |
| 직전 런 | `results/` 에서 `timestamp` 기준 바로 앞 런 |
| 진행 상태 | `schedule.yaml` 의 `phases[].artifacts[]` |

런 이름을 못 받았으면 `LATEST.json` 을 쓰고, 그 사실을 일지에 적는다.

## 절차

1. **읽는다** — `meta.json` 을 연다. 아래 필드를 본다. 없는 필드는 없는 대로 둔다.
   - 모델: `model_version`, `n_states`, `n_dc_states`
   - 조건: `XR`, `SCR_list`, `ctrl_params`, `fixed_params`, `inputs`,
     `bands`(sync/control/lcl 대역 경계), `thresholds`
   - **σ 판정 (주지표)**: `sigma_min_all`, `sigma_ref`, `score_min_all`,
     `t_s_spec`, `metric_pass`
   - ζ 판정 (보조): `zeta_min_all`, `zeta_target`, `zeta_pass`, `zeta_min_valid`,
     `zeta_min_band`, `band_zeta_min`, `band_crossovers`
   - 안정·수렴: `all_converged`, `all_stable`
   - 수치 건전성: `max_fd_error`, `max_fd_entry_error`, `fd_exceed_SCR`
   - 경계: `delta_max_deg`, `delta_near_limit_SCR`, `loadability_limit_SCR`,
     `nonconvergence_SCR`

   `all_stable` 과 `metric_pass` 는 다른 질문에 답한다 — 전자는 "불안정 극이 없나",
   후자는 "σ 가 목표를 넘나" 다. **둘을 섞어 쓰지 않는다.** 실제로
   `all_stable: true` 이면서 `metric_pass: false` 인 런이 있다
   (`sigma_min_all 2.16` < `sigma_ref 4.0`). 그 경우 "안정하지만 목표 미달" 이다.
   `zeta_min_valid` 가 `false` 면 ζ 값 자체를 인용하지 않는다.
2. **비교한다** — 직전 런의 같은 필드를 읽어 **바뀐 것만** 추린다. 바뀐 게 없으면
   "직전 런과 판정 동일" 한 줄로 끝낸다. 표를 억지로 채우지 않는다.
3. **연결한다** — 이 런이 `schedule.yaml` 의 어느 산출물에 해당하는지 찾는다
   (예: 커플링 효과 정량화 → `P2-A4`). 못 찾으면 연결하지 않는다.
4. **쓴다** — 아래 규격대로. 섹션을 빼지 않는다. 쓸 게 없으면 "없음" 이라고 적는다.

## 출력 규격

경로: `GFM_Research/RSCAD/03_실험/일지/<YYYY-MM-DD>_<제목>.md`
같은 이름이 있으면 덮지 않고 사용자에게 알린다.

```markdown
# <YYYY-MM-DD> <제목>

## 돌린 것

<!-- results/ 의 meta.json 에서 그대로 옮긴 값이다. 손으로 고치지 않는다. -->
| run | 날짜 | X/R | SCR | 전부 안정 | ζ_min | 상태수 |
|---|---|---|---|---|---|---|
| `<run_name>` | <timestamp> | <XR> | <SCR_list> | <예/아니오> | <zeta_min> | <n_states> |

조건: <ctrl_params 중 이번에 바꾼 것만>. 모델 <model_version> (<n_states>차).

판정: 안정 <all_stable> · σ_min <sigma_min_all> / 목표 <sigma_ref> → <metric_pass>

## 본 것

▸ <측정값과 그 값이 나온 조건. 한 줄에 하나.>
▸ <직전 런 `<이름>` 대비: <필드> <이전> → <이번>>
▸ 수치 건전성: `max_fd_error` <값> — <임계 넘었는지>

## 내 해석

※ <왜 그렇게 나왔다고 보는지. 추측이면 추측이라고 쓴다.>
※ <이 결과가 어느 주장을 지지하거나 흔드는지>

## 막힌 것

<!-- 없으면 "없음". 있으면 무엇이 왜 막혔고 누가 풀 수 있는지. -->
- <막힌 것> — <원인> — <필요한 것>

## 다음

<!-- 순서가 있는 것만 번호를 매긴다. 순서가 없으면 - 로 쓴다. -->
1. <바로 다음에 할 것>
2. <그다음>

## 논문 어디에

※ <I~V 중 어느 절> — <어느 산출물(schedule.yaml ID)에 해당하는지>
```

## 섹션별 규칙

### 돌린 것
표는 `run_table()` 이 만드는 형식 그대로 쓴다 (`Server/doc.py:182`). 값이 없으면
`—` 다. 조건 줄에는 **이번에 바꾼 파라미터만** 적는다 — 전부 나열하면 무엇을
건드렸는지가 묻힌다.

### 본 것 (▸)
- 측정값과 조건만. 해석을 섞지 않는다.
- 단위와 조건을 반드시 붙인다. `σ_sync −1.012` 가 아니라
  `σ_sync −1.012 (SCR 0.8, X/R 1.0)`.
- **σ 를 우선 쓴다.** 임계 모드가 실수극이라 ζ 는 진동 모드에만 정의된다
  (`P3-A2` 에서 확인). ζ 를 쓸 때는 어느 모드의 ζ 인지 밝힌다.
- 직전 런 비교는 `<이전> → <이번>` 꼴로. 변화율은 계산해서 쓰되 반올림을 밝힌다.

### 내 해석 (※)
- 여기만 추측이 허용된다. 대신 추측이라고 쓴다.
- 원인을 모르면 "원인 불명" 이라고 적는다. 그럴듯한 설명을 만들지 않는다.
- 선행연구와 어긋나면 어긋난 채로 적는다. 숨기지 않는다.

### 막힌 것
`schedule.yaml` 의 게이트(`G-P4`·`G-P6`·`G-P7`·`G-P8`)에 걸리는 것이면 게이트 ID 를
적는다. 막힌 게 없으면 "없음" 한 줄.

### 다음
실행 가능한 것만. "더 봐야 한다" 는 할 일이 아니다. 무엇을 어떻게 볼지 적는다.

### 논문 어디에
절(I~V)과 `schedule.yaml` 산출물 ID 를 함께 적는다. 이 줄이 나중에 `합치기` 에서
목적지가 된다.

## 하지 말 것

- 표의 빈칸을 추정값으로 메우기
- `▸` 에 "~로 보인다", "~때문일 것이다" 쓰기 (그건 `※`)
- 직전 런 이름 없이 "개선됐다" 쓰기
- 이모지를 구조 마커로 쓰기 — `▸`/`※` 만 쓴다. 변환 경로에서 이모지가 깨지는 것을
  확인했다 (`tools/ce_tool.py` 주석 참조)
- 같은 날 같은 제목 파일을 덮어쓰기

## 호출 예

> 최근 런으로 일지 써줘

> `J2.0_Dp...` 런 기록하고 직전 런이랑 비교해줘

> 오늘 일지 — 커플링 제거 실험 결과로

## 참고

- 뼈대 생성: `POST /api/doc/journal` (`Server/doc.py:210`)
- 런 목록: `GET /api/doc/runs` (`Server/doc.py:199`)
- 표 생성: `run_table()` (`Server/doc.py:182`)
- 일지를 논문 절로: 쓰기 화면의 `합치기` 탭 → `POST /api/notebook/merge`
- 문헌·주장 노트는 이 스킬이 아니라 `obsidian-note-template` 이 맡는다
