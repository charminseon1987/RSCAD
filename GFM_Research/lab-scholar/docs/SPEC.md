# lab-scholar SPEC

## 1. 아키텍처

```
Claude Code (Cursor) ──MCP──┐
                            ▼
                 backend (FastAPI :8000)
                  ├─ /api/*   REST  ← web (Next.js :3000)
                  └─ /mcp     MCP (Streamable HTTP)
                            │
             ┌──────────────┼───────────────┐
      PostgreSQL+pgvector   Obsidian 볼트 내보내기   외부 무료 API
          (:5432)          (VAULT_PATH/06_문헌)   OpenAlex·S2·arXiv·Crossref·Unpaywall
```

- 백엔드는 **LLM을 직접 호출하지 않는다** (Stage 1~4). 답변·요약·비교표 채우기는 Claude Code가 수행하고 MCP 도구로 저장한다.
- 단일 사용자(본인) 전제. 인증은 Stage 6에서 로컬 토큰 수준으로만.

## 2. 폴더 구조 (목표)

```
lab-scholar/
├─ CLAUDE.md
├─ docker-compose.yml          # db, backend, web
├─ .env.example
├─ backend/
│  ├─ pyproject.toml
│  ├─ app/
│  │  ├─ main.py               # FastAPI + /mcp 마운트
│  │  ├─ config.py
│  │  ├─ db.py  models.py  schemas.py
│  │  ├─ engine/               # reference/paper_agent.py 이식
│  │  │  ├─ sources.py         # openalex, s2, arxiv, unpaywall
│  │  │  ├─ snowball.py
│  │  │  ├─ scoring.py
│  │  │  └─ citation.py        # reference/doi2ieee.py 이식
│  │  ├─ services/             # library, answers, compare, vault_export
│  │  ├─ api/                  # REST 라우터
│  │  └─ mcp_server.py         # MCP 도구 정의 (services 재사용)
│  ├─ alembic/
│  └─ tests/
├─ web/                        # Next.js
├─ docs/  (SPEC.md, CHANGELOG.md, design/)
├─ reference/
└─ _archive/
```

## 3. DB 스키마 (초안 — Stage 1에서 확정)

| 테이블 | 주요 컬럼 |
|---|---|
| `papers` | id, doi(unique, null 허용), openalex_id, title, authors(jsonb), venue, year, volume, issue, pages, cited_by, abstract, oa_pdf_url, topics(jsonb), refs(jsonb, openalex id 목록), source(openalex/s2/arxiv/manual), score, created_at |
| `folders` | id, name, parent_id, sort |
| `library_items` | id, paper_id, folder_id, status(inbox/read/cited), note_path, saved_at |
| `searches` | id, query, params(jsonb), created_at |
| `search_results` | search_id, paper_id, rank, score, found_via(seed/cited_by/reference) |
| `answers` | id, question, search_id(null 허용), created_at, created_by(claude_code/web) |
| `answer_sentences` | id, answer_id, idx, kind(fact/interp), text, cited_paper_ids(int[]), evidence(jsonb: paper_id→근거문장) |
| `answer_gaps` | id, answer_id, text, cited_paper_ids(int[]) |
| `compare_tables` | id, name, preset(gfm/zeb/custom), columns(jsonb), created_at |
| `compare_rows` | table_id, paper_id, cells(jsonb: col_key→값), updated_by, updated_at |
| `chunks` (Stage 5) | id, paper_id, page, text, embedding vector |

초기 폴더 시드: `박사 · GFM 안정도`, `석사 · ZEB PV/BIPV`, `수집 인박스`

비교표 프리셋 열:
- gfm: 시스템 구성 / 계통 조건(SCR·X/R) / 제어 구조 / 안정도 해석 / 최적화 / 검증 / 한계
- zeb: 대상 건물 / 데이터·해상도 / 용량 산정 / 자립률 지표 / 경제성 / 계통 영향 / 한계

## 4. MCP 도구 (Claude Code가 쓰는 것)

| 도구 | 입력 | 동작 |
|---|---|---|
| `search_papers` | query, from_year=2018, sources=[openalex,s2,arxiv], top=30 | 검색 → 중복 제거 → 점수화 → DB 저장, 결과 목록 반환 |
| `snowball` | paper_id, direction=both, per_seed=10 | 인용/피인용 확장 후 저장 |
| `get_paper` | paper_id 또는 doi | 서지·초록·topics·라이브러리 상태 |
| `save_to_library` | paper_ids, folder, status=inbox | 저장 (폴더 없으면 생성하지 말고 에러 + 목록 반환) |
| `list_library` | folder?, status? | 목록 |
| `set_status` | paper_id, status | inbox/read/cited |
| `save_answer` | question, sentences[{kind,text,cited_paper_ids,evidence}], gaps[] | **fact인데 cited_paper_ids 비면 거부**, 존재하지 않는 paper_id면 거부 |
| `get_compare_table` | table_id 또는 name | 열·행·셀 |
| `update_compare_cells` | table_id, updates[{paper_id,col,value}] | 셀 갱신, updated_by=claude_code |
| `cite_ieee` | paper_ids 또는 dois | IEEE 문자열 + 미검증 필드 목록 |
| `export_to_vault` | paper_ids | Obsidian 노트 생성 (`VAULT_PATH/06_문헌/_inbox/`) — 기존 파일 덮어쓰기 금지 |

도구 설명(description)은 한국어로, "언제 쓰는지"를 명확히 쓴다. 반환은 JSON 직렬화 가능한 dict.

## 5. REST API (웹이 쓰는 것)
- `GET /api/search?q=&from_year=&filters=` · `GET /api/papers/{id}`
- `GET/POST /api/folders` · `GET /api/library?folder=&status=` · `POST /api/library` · `PATCH /api/library/{id}`
- `GET /api/answers` · `GET /api/answers/{id}`
- `GET /api/compare/{id}` · `PATCH /api/compare/{id}/cells` · `POST /api/compare/{id}/columns` · `DELETE /api/compare/{id}/columns/{key}`
- `GET /api/cite/{paper_id}` · `GET /api/compare/{id}/export.csv`
- REST와 MCP는 **같은 services 함수**를 호출한다 (로직 중복 금지).

## 6. 단계 (Stage) — 순서대로, 하나씩

### Stage 0. 프로젝트 골격
- docker-compose(db: pgvector/pgvector 이미지, backend, web 자리), `.env.example`, backend pyproject, Alembic 초기화, `/health`
- 완료 기준: `docker compose up db backend` 후 `curl localhost:8000/health` → ok, pytest 1개 통과

### Stage 1. 검색 엔진 이식 + MCP 최소 도구
- `reference/paper_agent.py` → `engine/` 모듈 분리 이식 (동작 동일 유지)
- DB 모델·마이그레이션, 폴더 시드
- MCP: `search_papers`, `get_paper`, `save_to_library`, `list_library`, `cite_ieee`
- 완료 기준:
  - 모킹 테스트 통과 (검색 결과 정규화·중복 제거·점수)
  - `claude mcp add --transport http scholar http://localhost:8000/mcp` 후 Claude Code에서 "grid-forming inverter weak grid 논문 5편 찾아서 박사 폴더에 저장" 요청이 실제로 동작
  - 저장된 논문의 DOI가 실제 존재 (live 테스트 3건)

### Stage 2. 웹 — 라이브러리 + 검색 결과 카드
- Next.js 초기화, 시안의 토큰(CSS 변수)·레이아웃·다크모드 이식
- 화면: 왼쪽 레일, 검색창+필터+출처 카드 목록(답변 영역은 빈 상태 안내), 라이브러리(폴더·상태 필터·목록), 논문 상세 드로어, IEEE 인용 복사
- 완료 기준: Stage 1에서 Claude Code로 저장한 논문이 웹 라이브러리에 보임, 웹에서 상태 변경 시 MCP `list_library`에 반영

### Stage 3. 출처 기반 답변 저장·표시
- MCP `save_answer`(검증 규칙 포함), REST answers
- 웹 검색·답변 화면: ▸/※ 문장, 인용 번호 hover ↔ 출처 카드 강조 + 근거 문장 표시, 연구 공백 박스 — 시안과 동일한 상호작용
- 완료 기준: Claude Code에서 질문 → 검색 → 답변 생성 → `save_answer` → 웹에서 표시. 출처 없는 fact 저장 시도가 거부되는 테스트 통과

### Stage 4. 비교표 양방향 편집
- 프리셋(gfm/zeb), 셀 편집·열 추가/삭제, 빈 칸 강조, CSV 내보내기
- MCP `get_compare_table`, `update_compare_cells`
- 완료 기준: Claude Code가 채운 셀이 웹에 보이고, 웹에서 고친 셀을 Claude Code가 읽어 연구 공백을 정리할 수 있음

### Stage 5. 본문 검색 (pgvector)
- 오픈액세스 PDF 본문 추출 → 페이지 단위 청크 → 임베딩 (로컬 모델 우선, 예: sentence-transformers 다국어 소형 모델; 선택은 사용자에게 제안 후 결정)
- MCP `search_fulltext`(query, paper_ids?) → 근거 문장 + 페이지
- 완료 기준: 저장 논문 10편 기준, 질문에 대해 페이지 번호가 달린 근거 문장 반환

### Stage 6. 볼트 연동·마무리
- `export_to_vault`, `snowball`, `set_status` 도구
- Obsidian 노트 템플릿은 사용자 볼트 규칙 준수: `06_문헌/`, `▸`/`※` 표기, `status` frontmatter
- 로컬 토큰 인증, README

## 7. Claude Code 쪽 연계 (Stage 1 완료 후)
- 사용자의 기존 `paper-agent` 폴더의 스킬·서브에이전트(`paper-searcher` 등)가 `reference/paper_agent.py` 직접 실행 대신 **scholar MCP 도구**를 쓰도록 지침 수정안을 제안한다 (사용자 승인 후 적용).
