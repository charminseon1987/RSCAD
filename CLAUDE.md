# RSCAD — 프로젝트 공통 지침

GFM(그리드포밍) 인버터 소신호 안정도 연구 저장소. 모델·시뮬레이션·웹 대시보드·논문 작업이
한곳에 있다.

> 이 파일은 예전 `.claude/agents/CLAUDE.md` 에 있던 공통 규약을 옮긴 것이다. 그 위치는
> 에이전트 정의를 두는 디렉터리라 평소 작업에서 로드되지 않았다 — 공들여 쓴 지침이
> 적용되지 않고 있었다.

## 연구 컨텍스트

- **석사**: 공공건축물 ZEB 등급 달성을 위한 PV/BIPV 최적용량 산정 및 경제성 평가
  - 관점은 건축이 아니라 **전력계통** (프로슈머, 계통 상호작용, 시간정합, 역전력)
  - 설계 데이터 기반 시간단위 시뮬레이션
- **박사 연계**: PSO 기반 2단 PV+ESS 그리드포밍 인버터 소신호 안정도,
  SCR–X/R 강건성 경계, RTDS CHIL 검증
- 목표 저널: IEEE Trans. Smart Grid / Power Systems / Sustainable Energy /
  Power Electronics, IEEE Access, Applied Energy, Energy and Buildings, 대한전기학회 논문지

## 정확성 규칙 (가장 중요)

이 저장소의 코드가 지키는 원칙과 같다 — `Server/app.py` 머리말의 "값을 날조하지 않는다".

- 논문에 없는 수치·주장을 만들지 않는다. 초록만 읽었으면 그렇게 밝힌다.
- 서지정보(저널·연도·볼륨·페이지·DOI)를 확인 못 했으면 비우지 말고 `미검증` 으로 둔다.
- 인용 문장은 원문 페이지를 확인한 경우에만 따옴표로 쓴다.
- 상충하는 결과는 숨기지 않고 나란히 제시한다.
- 사용자 가설에 **반하는 근거도 반드시 함께** 찾는다.
- 계산 결과를 보여줄 때 근사식으로 지어낸 값을 섞지 않는다. 저장본을 보여주거나
  실제로 계산한다 — 둘 중 하나다.

## 논문 지식 파이프라인

노트를 손으로 쓰지 않는다. 구조화된 레코드에서 렌더한다.

```
논문 → paper-reader → GFM_Research/00_Knowledge/records/<cite_key>.json
                       ↓ tools/ce_tool.py validate   (스키마 + 무결성)
                       ↓ tools/ce_tool.py obsidian   (노트 렌더)
                      GFM_Research/00_Knowledge/literature/<cite_key>.md
         lit-reviewer → tools/ce_tool.py gaps        (공백 집계)
      paper-searcher → 반증 검색으로 counter_search 갱신
```

- 스키마: `tools/claim_evidence.schema.json` (claim-evidence/v1.1)
- 노트 형식의 권위는 **`tools/ce_tool.py` 의 `to_md()` 한 곳**이다.
  `.claude/skills/obsidian-note-template` 과 같은 규격(frontmatter 전체 키 · ▸/※)을 낸다.
- 본문 마커: **▸ = 논문이 말한 것 / ※ = 내 판단.** 이모지를 구조 마커로 쓰지 않는다
  (변환 경로에서 깨진다).
- `counter_search.status` 가 `not_searched` 인 공백은 **논문에 "공백"으로 쓸 수 없다.**
  찾지 못한 것과 찾지 않은 것은 다르다.
- `verification.status` 가 `unverified`·`disputed` 인 주장은 인용 근거로 쓰지 않는다.
  `auto_checked` 는 사람이 확인하지 않은 상태다.

인용 형식은 IEEE:
`[1] A. Author, "Title," *Journal*, vol. x, no. y, pp. a–b, 2024, doi: ...`
문장 초안은 제안일 뿐이고 최종 문장은 사용자가 확정한다.

## 서브에이전트

### 논문
| 에이전트 | 담당 |
|---|---|
| `paper-searcher` | 검색·스노볼링·선별·반증 검색 |
| `paper-reader` | 단일 논문 정독 → 레코드 → 노트 |
| `lit-reviewer` | 레코드 종합 → 비교표·연구 공백 |

범용 학술 작업(심사 대응·초록·형식 변환·인용 검사)은 `academic-research-skills`
플러그인에 맡긴다. 위 셋은 **이 볼트에 쓰는 일**만 한다.

### RTDS/CHIL 실험 계층 (P6)
경계가 겹치지 않는 11개. 어느 담당인지 모르면 `a0-hub` 에 먼저 묻는다.

| ID | 서브에이전트 | 담당 | 유일 산출물 |
|---|---|---|---|
| A0 | `a0-hub` | 라우팅·선행조건·중재 | 없음 (읽기 전용) |
| A1 | `a1-volt` | GFM 인버터 모델 | `inv_spec.yaml` |
| A2 | `a2-ohm` | 계통·LCL 모델 | `grid_spec.yaml` |
| A3 | `a3-net` | Draft 회로 통합 | `draft_design.md` |
| A4 | `a4-loop` | 88포인트 스윕 스크립트 | `sweep_script_design.md` |
| A5 | `a5-scope` | Runtime 구성 | `runtime_layout.yaml` |
| A6 | `a6-delfino` | DSP 펌웨어 | `dsp_fw_spec.md` |
| A7 | `a7-bridge` | CHIL 인터페이스 | `chil_if_spec.md` |
| A8 | `a8-gate` | HW 검토 게이트 | `hw_review.md` (읽기 전용) |
| A9 | `a9-sigma` | 교차검증 절차 | `xval_protocol.md` |
| A10 | `a10-archive` | 실험 기록·아카이브 | 볼트 노트 |

- 산출물 위치: `GFM_Research/RSCAD/03_실험/P6-rtds/specs/`
- 모든 산출물은 마지막 줄에 `HANDOFF: A10 (기록)` 을 달고 끝낸다 → `a10-archive` 로 넘긴다.
- `a0-hub` 와 `a8-gate` 는 쓰기 도구가 없다 — 구조적으로 설계를 수정할 수 없다.
- RTDS 접근 불가가 확정되면 A3·A4·A5·A7·A8 은 `deferred`,
  A1·A2·A9·A10 만 SIL/EMT 경로로 운용한다.

## 실행 메모

- `python Server/app.py` — Flask 백엔드 (포트 5000). 이 프로젝트의 기준 포트다.
- `cd web && npm run dev` — Vite 개발 서버 (5173), `/api` 등을 5000 으로 프록시한다.
- `Simulation/*.py` 와 `Server/app.py` 는 콘솔을 UTF-8 로 맞춰 둔다
  (`Simulation/console_utf8.py`) — Windows cp949 에서 이모지 print 가 죽는 것을 막는다.
- 에이전트가 Ollama 를 쓸 때 기본 모델은 `agent/core.py` 의 `DEFAULT_MODEL` 한 곳에서
  정한다. 환경변수 `GFM_AGENT_MODEL` 로 덮는다.
