# GMF Labs 웹 — 정보구조(IA) 설계

> 작성 2026-09-29 · 상태: 설계 확정, 구현 대기
> 범위: `web/src/**` 화면 구성 · `Server/app.py` 신규 API 명세 · 에이전트 로스터 · 볼트 지식화
> 이 문서는 **설계만** 담는다. 코드 변경은 §10 이행 순서에 따라 별도로 진행한다.

---

## 0. 배경 — 왜 재설계하는가

혼자 운영하는 GFM 소신호 안정도 연구(IEEE Access 목표)에서, 여러 층에 흩어진 에이전트와
Obsidian 볼트에 쌓인 지식을 한 화면에서 쓰기 위한 것이다. 실측으로 확인된 문제:

- **에이전트가 7개 층에 흩어져 중복 포함 31개.** `.claude/agents/*.md`(14) · `agent/*.py`(진짜 4,
  결정론적 도구 5) · `agent/prompt/A*.md`(11, 1층과 의도적 이중 유지) · `_company/_agents/`(10, SNS
  역할 섞임) · `connect-ai/`(4, `.gitignore` 제외) · `paper_agent.py`(1) · `agent/paper/`(1층 바이트 동일 사본).
- **볼트 90개 노트가 거의 안 보인다.** `/api/notes`는 4개 glob만 훑어 `01_개념`(22) ·
  `02_방법론`(5) · `00_MOC`(7) · `05_템플릿`(4)이 **목록조차 안 나온다**. 본문 검색도 없다.
- **6개 라우트가 연구 워크플로와 대응하지 않는다.** `Lab.tsx`(670줄)에 분석·검증·기록이 뒤섞이고,
  `Paper.tsx`에 문헌탐색과 집필이 섞였다. 에이전트 UI는 `Dashboard` 명령창 하나뿐.
- **이미 있는 자산이 화면에 없다.** `components/charts/` recharts 5개가 **어디서도 import 안 됨**
  (대응 API는 전부 살아있음). `participation_factors.json` · `sync_reduction.json`은 run마다 있는데 API가 없다.
- **가짜가 섞여 있다.** `Lab.aiAnswer()`는 정규식 규칙기반인데 "AI 연구도우미"로 표시. Landing ·
  Dashboard의 에이전트 8인은 하드코딩 + 항상 ONLINE. `POST /config/{feature}`는 대응 라우트가 없어 100% 실패.

목표: **연구 워크플로 = 화면 = 에이전트 담당**을 1:1로 맞추고, 볼트를 Obsidian처럼 탐색 가능하게 만든다.

### 설계 전제 (확정된 결정)

| 항목 | 결정 |
|---|---|
| 에이전트 목록 | 동적 목록 + 실행 버튼 |
| 로스터 개수 | **12에 억지로 맞추지 않음** — 파트별 그룹으로 전수 노출 |
| Landing · RscadFX | **둘 다 유지.** 발표 그룹에 **Landing → RscadFX 순서**. RscadFX는 **심사 발표용 단독 풀스크린 시연** 가능해야 함 |
| 네비게이션 | 2단 (그룹 + 하위 탭) |
| Archify | 독립 탭으로 분리 |
| 볼트 | `GFM_Research/` 자료를 nav에 추가. Obsidian처럼 md 열람 — 지식 그래프 + 노드 클릭 시 md 표시 |

---

## 1. 화면 목록 (10개) · 2단 네비게이션

```
1단:  메인  |  연구 ▾  |  실험 ▾  |  Archify  |  발표 ▾
2단:         논문-리서치        GFM 실험실              Landing
             지식화 ★          검증                    RscadFX
             내논문            실험기록
```

★ 지식화 = 볼트 브라우저. 화면 내부에 **좌측 볼트 트리 nav**를 상주시켜 `GFM_Research/` 폴더 구조를
그대로 탐색하게 한다(§4). 이것이 "볼트 자료를 nav에 추가"의 구현 형태다.

| # | 화면 | 라우트 | 원천 | 처리 | 근거 |
|---|---|---|---|---|---|
| 1 | 메인 | `/` | Dashboard + Landing 파이프라인 레일 | 통합 | 명령창(`/api/command`)이 있는 화면이 진입점이어야 함 |
| 2 | 논문-리서치 | `/research/papers` | Paper.tsx 문헌 절반 | 분리 | 탐색(문헌 9 · PDF 7 · RAG)과 집필은 소비자가 다름 |
| 3 | **지식화** | `/research/knowledge` | **신규** | 신설 | 볼트 90개 노트 · 631개 링크가 어떤 화면에도 없음 — 최대 사각지대 |
| 4 | 내논문 | `/research/my-paper` | Paper.tsx 집필 절반 | 분리·개명 | IEEE Access 섹션 진행 · 체크리스트 · export |
| 5 | GFM 실험실 | `/lab/gfm` | Simulation.tsx | 개명 | P2~P6 실행 폼 + **에이전트 로스터 전체** |
| 6 | 검증 | `/lab/verification` | Lab.tsx 분석 절반 + **미사용 charts 5개** | 분리 | σ · 고유값 · 선형화는 "맞는지 확인"이라는 별개 관심사 |
| 7 | 실험기록 | `/lab/log` | Lab.tsx 기록 절반 + Dashboard 결과 그리드 | 분리·통합 | 두 화면에 중복된 결과 그리드를 한 곳으로 |
| 8 | Archify | `/archify` | **신규** (§3) | 신설 | 독립 탭 |
| 9 | Landing | `/present/landing` | Landing.tsx 유지 | 이동 | 발표 1번. 하드코딩 8에이전트만 `<AgentRoster>` 실데이터로 교체 |
| 10 | RscadFX | `/present/rscad-fx` | RscadFX.tsx 유지 | 이동 | 발표 2번. **풀스크린 시연 모드**(§2) |

**Lab.tsx 분리 근거**: 한 파일에 KPI 판정 + 가짜 AI + 실행 기록이 섞여 670줄이 됐다. 요구된
"검증"과 "실험기록"이 Lab 안에 뒤섞여 있던 두 관심사와 정확히 대응한다.

**고아 페이지**: `Plaza.tsx` · `Store.tsx` · `Download.tsx`는 라우팅되지 않고, 쓰는 CSS 클래스
(`.sheet` / `.pack` / `.roster`)가 `styles.css`에 없어 스타일이 깨진 죽은 코드 → **파일 삭제**.
단 `/api/plaza`(Firebase RTDB)는 살아 있으니 **데이터만** 메인 활동 배지로 재활용한다.
`web/` 루트의 구버전 동명 파일도 같이 정리한다.

---

## 2. 풀스크린 발표 모드 — `/present/*` 레이아웃 분기

**막고 있는 것**: `App.tsx`의 `<nav className="fixed ... glass-nav">` + `<main className="pt-14">`.
RscadFX는 이미 `min-h-screen bg-[#0a0a1a]` + hero `h-screen` 구조라 페이지 자체는 풀스크린 형태다.
남은 문제는 앱 껍데기뿐이다.

| 요소 | 설계 |
|---|---|
| 라우트 분기 | `pathname.startsWith('/present/')` → nav 미렌더 + `pt-14` 제거 |
| 복귀 | 좌상단 hover 시에만 나타나는 반투명 복귀 버튼 + `Esc` → `/` |
| 진짜 전체화면 | 발표 시작 버튼에서 `document.documentElement.requestFullscreen()` (브라우저 크롬까지 제거) |
| 발표 순서 | Landing → RscadFX. 두 페이지 하단에 "다음 →" 링크 |
| 재사용 | `glass-nav` · `glass-nav-pill` 클래스 그대로. 그룹 드롭다운만 추가 |

`App.tsx`의 `isLanding`은 계산만 하고 쓰이지 않는 **죽은 변수** — 이 분기 로직으로 대체한다.

---

## 3. Archify 탭 — 4블록

| 블록 | 내용 | 데이터 |
|---|---|---|
| ① 유형 참조 카드 5개 | 5개 유형 — "적합한 대상" + "프롬프트에 담을 내용" | 정적 |
| ② 산출물 갤러리 | 현재 2건 — `rscad-runtime` architecture(런타임 구조) · `gmf-web-ia` architecture(이 문서의 IA, `docs/diagrams/`) | `GET /api/diagrams` |
| ③ 프롬프트 빌더 | 유형 선택 → 해당 유형 필드 입력 → **"프롬프트 복사"** | 정적 + 클립보드 |
| ④ 뷰어 | 갤러리 클릭 → 대응 `-{type}.html` 새 탭 (이미 렌더된 820KB HTML 재사용, 뷰어 개발 불필요) | 정적 |

| 유형 | 적합한 대상 | 프롬프트에 담을 내용 |
|---|---|---|
| 아키텍처(Architecture) | 컴포넌트, 서비스, 저장소, 경계 | 범위, 핵심 컴포넌트, 주 경로 |
| 워크플로(Workflow) | CI/CD, 승인 절차, 도구 호출, 런북 | 참여자, 순서, 분기, 예외 |
| 시퀀스(Sequence) | API 호출, 캐시 폴백, 인증, 비동기 추적 | 호출자, 피호출자, 반환, 타이밍 |
| 데이터 흐름(Data Flow) | 파이프라인, 계보, 개인정보, 소비자 | 소스, 변환, 저장소, 경계 |
| 생명주기(Lifecycle) | 상태, 재시도, 대기, 종료 결과 | 상태, 이벤트, 재시도와 취소 경로 |

**정직한 실행 표시**: Archify는 Claude Code 스킬이므로 Flask가 다이어그램을 생성할 수 없다.
버튼 라벨은 "생성"이 아니라 **"프롬프트 만들기"** — ① 프롬프트 복사 ② Claude Code에서 `archify` 호출
③ `docs/`에 저장되면 갤러리 새로고침.

**저장 관례**: 신규 산출물은 `docs/diagrams/<name>.<type>.json` + `docs/diagrams/<name>-<type>.html`로
유도하되 **기존 `docs/rscad-runtime.*`은 옮기지 않는다**(이득 < 리스크). API는 `docs/**/*.json`을
재귀 glob 후 `schema_version` + `diagram_type` 키를 가진 self-describing 파일만 필터 — 폴더 관례를
지키든 안 지키든 갤러리가 깨지지 않는다. `.omm/`은 `.gitignore` 대상이라 스캔에서 제외한다.

---

## 4. 지식화 화면 — Obsidian 방식 볼트 브라우저

### 4-1. 볼트 실측 (2026-09-29)

| 항목 | 값 |
|---|---|
| md 총계 | **213** — 그중 `_company/` **123은 제외**(SNS · 회사 시뮬레이션, 연구와 무관) → **대상 90** |
| 폴더 분포 | `01_개념` 22 · `00_Knowledge` 16(literature 9 · claims 5 · 기타) · `00_MOC` 7 · `Phase02` 7 · `Phase01` 6 · `02_방법론` 5 · `05_템플릿` 4 · `06_문헌` 4 · `40_템플릿` 4 · `Phase03` 3 · `Phase04` 3 · `ToDoList` 3 · `00_Raw` 3 · `03_실험` **0** |
| 위키링크 | **631 인스턴스**, 고유 대상 **86**, 링크 보유 노트 **74 / 90** |
| frontmatter | **80 / 90** (89%) — Dataview 필드 보유 |
| 공백 포함 파일명 | **22개** |
| basename 중복 | **5건** — `Chen_2024_Electronics` · `Dong_2026_GFM_SVR` · `Ganguly_2025_preprint` · `Zhao_2023_Aalborg` (전부 `00_Knowledge/literature` ↔ `RSCAD/06_문헌` 미러) + `README` |

**최대 허브 노드** (피인용 수): `88포인트_2D_스윕_설계` 35 · `고유값_안정도판단` 34 · `DC-AC_커플링` 34 ·
`야코비안 행렬` 29 · `Phase02_완료` 29 · `과감쇠_동기화모드` 23 · `소신호_선형화` 22 · `블록삼각_함정` 20 ·
`PSO_목적함수_설계` 19 · `Phase03_진행중` 17

### 4-2. 결정적 제약 — 링크 정규화 없이는 그래프가 절반 끊긴다

고유 링크 대상 86개 중 **파일명과 정확히 일치하는 것은 55개뿐**. 나머지 31개의 정체:

| 원인 | 예 | 처리 |
|---|---|---|
| **공백 ↔ 언더스코어 표기 차이** (같은 노트인데 표기만 다름) | `[[DC-AC 커플링]]` ↔ `DC-AC_커플링.md` · `[[88포인트 2D 스윕 설계]]` ↔ `88포인트_2D_스윕_설계.md` · `[[21차_야코비안_유도가이드]]` ↔ `21차 야코비안 유도가이드.md` | **정규화 필수** — 공백/언더스코어 통일 + 대소문자 무시 후 매칭. 이것만으로 대부분 복구 |
| 템플릿 자리표시자 | `{{cite_key}}.pdf` · `claim-...` · `$n` · `...` | 그래프에서 **제외**(노드 아님) |
| 진짜 미작성 노트 | `claim-scr3-weak-grid-threshold` · `claim-virtual-impedance-lf-tradeoff` · `Dong 2026` 등 | Obsidian 관례대로 **점선 회색 노드**. 이 목록 자체가 "아직 안 쓴 노트"라 유용 |

`[[노트|표시이름]]`과 `[[노트#섹션]]` 문법도 파싱에서 분리해야 한다.
basename 중복 5건은 **폴더 우선순위**(`00_Knowledge/literature` > `RSCAD/06_문헌`)로 해소하고
UI에 모호성 배지를 단다.

### 4-3. 화면 구성 — 3분할

기존 `grid grid-cols-12` 3분할 패턴(Dashboard · Lab · Simulation이 이미 쓰는 관례)을 그대로 따른다.

| 영역 | 내용 |
|---|---|
| **좌 (3칸) — 볼트 트리** | `GFM_Research/` 폴더 트리 상주 nav. 폴더별 노트 수 배지, 검색창, `_company` 제외 고정. 클릭 → 뷰어에 노트 로드 |
| **중앙 (6칸) — 뷰 전환** | 탭 3개: **그래프** / **노트** / **표**. 그래프는 force 레이아웃, 노트는 md 렌더, 표는 frontmatter 기반 Dataview 유사 목록(`cite_key` · `doi` · `status` · `extraction_depth` 정렬·필터) |
| **우 (3칸) — 백링크·메타** | 현재 노트의 frontmatter 표, 백링크 목록, 아웃링크 목록(미해석은 회색), 원본 파일 경로 |

**그래프 스펙**

- 노드 90 + 점선 노드(미작성). 90 노드 / 약 300 고유 엣지는 SVG로 충분 — 성능 문제 없음
- 노드 **크기** = 백링크 수, **색** = 폴더(개념 / 방법론 / MOC / Phase / 문헌 / 주장 / 템플릿)
- 허브 노드 라벨만 상시 표시, 나머지는 hover 시 — 90개 라벨을 다 그리면 읽을 수 없다
- 폴더 필터 토글, 1-hop / 2-hop 이웃만 보기
- **노드 클릭 → 중앙 탭이 "노트"로 전환되며 해당 md 렌더** (요구사항의 핵심 동작)

**노트 뷰어 스펙**

- frontmatter를 본문 위 **표**로 렌더(80/90이 보유) — 본문에 `---` 원문이 노출되지 않게
- 프로젝트 고유 표기 **▸(실험·논문 사실) / ※(해석·판단)** 을 시각적으로 구분 렌더.
  `obsidian-note-template` 스킬이 강제하는 관례이므로 화면도 이를 지켜야 노트를 신뢰할 수 있다
- `[[링크]]` 클릭 → 앱 내 라우팅으로 해당 노트 이동(페이지 리로드 없음). 미해석 링크는 비활성 + 툴팁
- 코드블록 · 표 지원. 수식은 1단계에서 원문 유지, KaTeX 도입은 2단계에서 판단

### 4-4. 신규 의존성

현재 `web/package.json`에 마크다운 · 그래프 라이브러리가 **전무**하다(확인됨).

| 필요 | 선택 | 근거 |
|---|---|---|
| md 렌더 | `react-markdown` + `remark-gfm` | 표준. 표·체크박스 지원. 위키링크는 렌더 전 전처리 또는 커스텀 remark 플러그인으로 앵커 변환 |
| 그래프 물리 | **`d3-force` 만** (전체 d3 아님) | 렌더는 자체 SVG — `Lab.tsx`의 `ComboChart`가 이미 손으로 SVG를 그리는 같은 패턴 |
| frontmatter 파싱 | **서버에서 `pyyaml`** | `Server/requirements.txt`에 **이미 있음**. 클라이언트에 `gray-matter`를 넣지 않는다 |
| 링크 파싱·해석 | **서버에서** | 631개 링크를 클라이언트가 매번 재파싱하면 낭비. 정규화 · 중복해소 · dangling 판정을 서버가 한 번에 수행 |

### 4-5. 신규 API

| 엔드포인트 | 반환 |
|---|---|
| `GET /api/vault/tree` | `_company` 제외 전체 트리 — 폴더 · 파일 · 제목 · mtime · 노트 수 |
| `GET /api/vault/note?path=` | 본문 md + **파싱된 frontmatter** + 아웃링크(해석 결과 포함) + 백링크 |
| `GET /api/vault/graph` | `{nodes:[{id,path,folder,title,backlink_count,exists}], edges:[{from,to,resolved}]}` — 정규화 · 중복해소 · dangling 판정 **서버 완료분** |
| `GET /api/vault/search?q=` | 본문 전문 검색 (현재 전혀 없음) |

기존 `/api/notes`는 4개 glob만 훑는 레거시 — `/api/vault/*`로 대체하고, Dashboard · Paper 호환용으로
당분간 유지하다 단계적 폐기한다. `/api/note`의 경로이탈 방어(`resolve().relative_to(vault)`)는
**그대로 재사용**한다(이미 올바르게 구현돼 있음).

---

## 5. 에이전트 로스터 — 파트별 그룹

노출 **19개** + 품질 스킬 5개(에이전트가 아니므로 별도 카드 그룹).

| 그룹 | 개수 | 구성 | 실행 방식 | 상태 |
|---|---|---|---|---|
| 연구소 코어 | 4 | 연구소장🧭 · 시뮬엔지니어💻 · 문헌추적자📚 · RAG관리자🔎 | `flask_subprocess` — **진짜 실행** | active (로컬) |
| 논문 파이프라인 | 4 | paper-searcher · paper-reader · lit-reviewer · `paper_agent.py` | 앞 3개 `claude_code_task`, 끝 1개 `cli` | active |
| RTDS/CHIL | 11 | A0허브 · A1볼트 · A2옴 · A3넷 · A4루프 · A5스코프 · A6델피노 · A7브릿지 · A8게이트 · A9시그마 · A10아카이브 | `claude_code_task` | A0 · A8 · A9 · A10 active / **A1~A7 deferred** |
| 품질 스킬(참고) | 5 | citation-management · ieee-access-format-check · obsidian-note-template · scientific-writing · terminology-consistency | Skill | — |

**제외**: `_company/_agents/`(10) — SNS 운영 역할이 섞여 연구 워크플로와 무관.
`connect-ai/_company/agents/`(4) — `.gitignore` 제외 계층이라 이 저장소 기준 미존재로 취급.
노출하면 클릭이 전부 실패로 귀결돼 혼란만 늘린다.

**A1~A7 `deferred`**: RTDS 접근권 Tier가 **2026-11 결정 예정**이고 `RSCAD/03_실험/P6-rtds/{runs,specs}`가
비어 있다(실행 이력 0). 레지스트리에 미리 등록하고 화면에서는 "대기 중 — 2026-11 Tier 결정 후 활성"
접힌 섹션으로 노출. Tier 확정 시 코드 변경 없이 `status`만 바꿔 승격한다.

`deferred`(외부 결정 대기, 코드는 정상) ≠ `blocked`(지금 실행하면 실패). `blocked`는 정적 값이 아니라
**preflight 결과로 덮어쓰는 파생 상태** — Render 배포본에서 `flask_subprocess` 4개는 `chromadb`
미설치로 자동 `blocked`, 로컬에서는 `active`.

### 레지스트리 출처 — 하이브리드

`agent/registry.yaml`을 진실 소스로 두고, 기동 시 파일 존재 · frontmatter 유효성만 스캔 검증(경고 로그).

- 순수 런타임 스캔은 판단성 필드(그룹 분류 · `depends_on` · `status_reason` · 한글 요약)를 만들어낼 수 없고, `agent/paper/`의 stale 사본까지 긁어 중복 등록된다.
- 빌드타임 정적 생성은 빌드 스텝 없는 `gunicorn` 구조에 맞지 않는다.
- 검증 스텝만 두면 "md는 rename됐는데 registry가 안 따라옴" 같은 drift를 기동 로그로 드러낼 수 있다.

**스키마**: `id` · `name.{ko,en}` · `emoji` · `summary`(≤40자) · `group` · `layer_origin` ·
`def_path[]`(1↔3층 이중 유지 시 두 경로 모두) · `exec.{mode,executable,reason}` · `runtime_deps[]` ·
`outputs[]`(glob) · `depends_on[]` · `status` · `status_reason`

---

## 6. 화면 ↔ 에이전트 담당

| 화면 | 주담당 | 공백 |
|---|---|---|
| 메인 | 연구소장🧭 (유일한 명령창 백엔드) | — |
| 논문-리서치 | 문헌추적자📚 + paper-searcher / paper-reader / lit-reviewer + `paper_agent.py` (5) | — |
| 지식화 | RAG관리자🔎 (검색만) | **부분 공백** — 개념 · MOC 노트 정리 담당 없음 |
| 내논문 | 없음 | **공백 명시** — 집필 에이전트는 connect-ai(제외 계층)에만 존재. 사람이 집필하고 품질 스킬 5개가 보조 |
| GFM 실험실 | 시뮬엔지니어💻 + A0~A7 (로스터 노출 위치) | — |
| 검증 | A9시그마 (σ 3원 교차검증) + A8게이트(참조) | — |
| 실험기록 | A10아카이브 ("판단 안 함, 기록만" = `save_note`와 일치) | — |
| Archify | 없음 | **공백 명시** — Claude Code에서 직접 호출 |
| Landing · RscadFX | 없음 (발표 자산) | — |

공백을 억지로 채우지 않고 화면에 그대로 표시한다 — A10아카이브를 지식화에 겸직시키면 그 에이전트의
정의("기술적 판단을 하지 않는다")와 충돌한다.

---

## 7. 화면 ↔ API

| 화면 | 기존 API로 가능 | 새로 필요 |
|---|---|---|
| 메인 | `/api/command` `/api/health` `/api/schedule_status` `/api/latest` `/api/runs` `/api/plaza` | `GET /api/agents` · `GET /api/agents/preflight` |
| 논문-리서치 | `/api/notes` `/api/note` `/api/rag` | `/api/vault/search` · PDF 서빙 라우트(`papers/*.pdf` 7건) |
| **지식화** | `/api/rag` | **`/api/vault/tree` · `/api/vault/note` · `/api/vault/graph` · `/api/vault/search`** (§4-5) |
| 내논문 | `/api/export_paper` `/api/notes` | `GET/POST /api/paper/sections` (섹션 상태 영속화) |
| GFM 실험실 | `/api/compute` `/api/run_xval` `/api/modes` `/api/reload` `/api/pso`(501 유지) | `POST /api/agents/<id>/run` |
| 검증 | `/api/eigenvalue_locus` `/api/operating_points` `/api/sweep2d` `/api/trajectory` `/api/linearization_validity` `/api/grid2d` — **전부 살아있고 전부 미사용** | `/api/results/<run>/participation_factors` · `.../sync_reduction` |
| 실험기록 | `/api/runs` `/api/result` `/api/save_note` `/results/<path>` | `/api/results/<run>/results_md` (현재 존재 여부 boolean만) |
| Archify | — | `GET /api/diagrams` |

**`POST /api/agents/<id>/run`을 신설하고 `/api/command`는 유지한다.** `/api/command`는 "자연어 →
키워드로 자동 선택"이라는 오케스트레이터 시맨틱(텔레그램 · 비서 흐름)이고, 화면의 "특정 에이전트 클릭"은
`agent_id`가 확정된 다른 시맨틱이다. 내부에서 `orchestrator.dispatch(cmd, agent_id=id)`를 재사용하므로
코드 중복은 없다. `exec_mode` 분기:

| mode | 동작 |
|---|---|
| `flask_subprocess` | 실행 |
| `claude_code_task` | 202 + **Claude Code에 붙여넣을 프롬프트 텍스트 반환** |
| `cli` | subprocess 실행 |
| `manual` | 400 + 실행 불가 사유 |

**`preflight`는 `/api/health` 확장이 아니라 신규 엔드포인트.** `/api/health`는 시뮬레이션 도메인
스키마가 이미 대시보드 소비자에 묶여 있어 확장하면 오염된다. 응답에 `ollama.reachable` ·
`modules.{requests,chromadb,sentence_transformers}` · `affected_agent_ids[]`를 담아, 로컬에서는
실행 버튼 활성 / Render에서는 회색 + 툴팁("배포본 `requirements.txt`에 `chromadb` 없음")으로 처리한다.

---

## 8. 추가 제안 6개

모두 **데이터는 이미 있고 API만 없는** 것들이다. 신규 최상위 화면은 필요 없다.

| 제안 | 근거 | 배치 |
|---|---|---|
| ① 참여인자 뷰 | `participation_factors.json`이 run마다 존재, API만 없음 | 검증 하위 섹션 |
| ② 동기화 축소 지표 | `sync_reduction.json` 동일 | 검증 하위 섹션 |
| ③ 일정·게이트 보드 | `/api/schedule_status`가 살아있는데 어느 화면도 안 씀 | 메인 상단 위젯 |
| ④ 문헌-주장 커버리지 | literature 9 vs papers 7 vs claims 5, `mine/` 0건 — 어느 논문이 claim으로 안 뽑혔는지 안 보임 | 논문-리서치 요약 카드 |
| ⑤ 용어 일관성 패널 | `terminology-consistency` 스킬은 있는데 결과 표시 UI 없음 | 내논문 사이드 |
| ⑥ **미작성 노트 목록** | §4-2의 진짜 dangling 링크 = "써야 하는데 안 쓴 노트" | 지식화 (그래프 부산물, 추가 비용 0) |

부수: schedule 파일이 **5개 공존**하고 API는 `GFM_Research/schedule.yaml` 하나만 읽는다 —
나머지 4개가 죽은 정보인지 알 수 없어 canonical 지정이 필요하다(메인 경고 배지).

---

## 9. 정리 권고

| 대상 | 권고 | 근거 |
|---|---|---|
| `agent/paper/*` | 삭제 (1층 3개와 **바이트 동일** + 구버전 `CLAUDE.md`) | 동일 사본은 정보 가치 0, 구버전은 "어느 게 최신인지" 혼란 유발 |
| 1층 ↔ 3층 A0~A10 이중 유지 | **유지**, 레지스트리 `def_path`에 두 경로 모두 기록 | `agent/prompt/README.md`에 "양쪽 함께 고친다"가 명문화됨 |
| `Plaza/Store/Download.tsx` (+ `web/` 루트 구버전) | 삭제, `/api/plaza` 데이터만 재활용 | 라우팅 안 됨 + CSS 미존재로 깨진 죽은 코드 |
| `Landing`의 `POST /config/{feature}` | 제거 | 대응 Flask 라우트가 없어 100% 실패 → localStorage 폴백 |
| `Lab.aiAnswer()` 정규식 "AI 도우미" | `/api/rag` 실연동 또는 "규칙기반"으로 정직하게 개명 | 가짜 AI 표기 |
| `06_문헌`(4) ↔ `00_Knowledge/literature`(9) 미러 | canonical을 `literature`로 지정, 그래프에서 중복 노드 병합 | basename 중복 5건의 원인 |

---

## 10. 이행 순서 (4단계)

| 단계 | 내용 | 완료 시 쓸 수 있는 상태 |
|---|---|---|
| **1. 골격** | 2단 nav + `/present/*` 레이아웃 분기 + 10화면 라우트 배치, 고아 3페이지 삭제, 기존 로직 이동만(새 기능 0) | 화면 틀이 URL · nav 레벨에서 완성. **RscadFX 풀스크린 발표 즉시 가능** |
| **2. 볼트 지식화** | `/api/vault/{tree,note,graph,search}` + 링크 정규화(§4-2) + `react-markdown` · `remark-gfm` · `d3-force` 도입 + 지식화 3분할 화면 | 볼트 90개 노트 · 631개 링크가 **처음으로** 보임. 그래프 클릭 → md 열람. 미작성 노트 목록 확보 |
| **3. 로스터** | `agent/registry.yaml` + `/api/agents` + `/preflight` + 공용 `<AgentRoster>` → Landing · Dashboard 하드코딩 8인 교체, GFM 실험실에 그룹별 노출, `POST /api/agents/<id>/run` | 에이전트 목록이 실데이터로, 실행 가능 여부가 정직하게 표시 |
| **4. 검증·문서** | 미사용 charts 5개 연결(props 전부 옵셔널 = 드롭인), participation / sync API, Archify 탭 + `/api/diagrams`, §8 우선순위 | 실행 → 검증 → 기록 완성, 문서 자산까지 IA 편입 |

지식화를 2단계로 올린 이유: 볼트 90개 노트가 현재 완전히 보이지 않는 상태가 가장 큰 사각지대다.

---

## 11. 착수 전 남은 결정

1. **canonical schedule 파일** — 5개 중 어느 것이 진짜인지. `GFM_Research/schedule.yaml`만 API가 읽지만 `schedule.v1.yaml`이 더 최신 스키마다.
2. **`agent/paper/` 삭제 시점** — 바로 지울지, 별도 승인으로 분리할지.
3. **`claude_code_task` 실행 UX** — 클립보드 자동 복사 vs 텍스트 표시 후 수동 복사.
4. **preflight 캐시** — 요청마다 Ollama 핑(지연) vs 30초 TTL 캐시.
5. **2단 nav 그룹 라벨** — "연구 / 실험 / 발표" vs "리서치 / 랩 / 데모".
6. **지식화 1단 탭 승격 여부** — 볼트 비중이 커지면 `연구▾` 하위가 아니라 독립 탭이 나을 수 있다.
7. **수식 렌더** — 볼트 노트에 σ · λ · ζ 수식이 많다. 1단계는 원문 유지, KaTeX는 2단계에서 판단.

---

## 검증 기준 (구현 시)

| # | 확인 |
|---|---|
| 1 | "기존 API로 가능" 항목 전부가 `Server/app.py`에 실재 — `grep -c "@app.route"` = **25** |
| 2 | "새로 필요" 목록에 이미 있는 라우트가 섞이지 않았는지 역방향 확인 |
| 3 | 로스터 19개 = `.claude/agents/*.md` **14** + `AGENT_MAP` **3** + orchestrator 자신 1 + `paper_agent.py` 1 |
| 4 | 볼트 수치 — md 90(`_company` 제외) · 링크 631 · 고유 대상 86 · 정확 일치 55 · frontmatter 80 · 공백 파일명 22 · basename 중복 5 |
| 5 | 차트 5개 미사용 + props 옵셔널 (3개는 `computeResults?`, 2개는 props 없음 → 드롭인) |
| 6 | 1단계 후 `npm run dev` → `/present/rscad-fx`에서 nav가 사라지고 `Esc`로 복귀 — 발표 요구사항의 유일한 실동작 확인점 |
| 7 | 2단계 후 `/api/vault/graph`의 `edges[].resolved=true` 개수가 **55보다 유의하게 커야** 한다. 55에 머물면 §4-2 정규화가 빠진 것 |
