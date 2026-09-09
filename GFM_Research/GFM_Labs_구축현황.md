---
type: setup-record
project: GFM Labs
date: 2026-09-09
status: active
tags: [GFM-Labs, 형상관리, 에이전트, 일정]
---

# GFM Labs 구축 현황 — 2026-09-09 정리

> 위치 제안: `RSCAD/GFM_Research/00_MOC/GFM_Labs_구축현황.md`
> 표기: ▸ 확정된 사실·설정값 / ※ 판단·제안

---

## 1. 무엇을 만드는가

▸ **GFM Labs** = Grid-Forming 인버터 안정도 연구를 수행하는 AI 1인 연구소.
▸ Jay(wonseokjung)의 connect-ai / EZER AI를 *쓰는* 것이 아니라, 그 오픈소스(MIT)를 포크해 **직접 구축**한다. EZER 웹은 비공개라 자체 제작 대상.
▸ 사람은 방향·판단, 에이전트는 문헌·수식 검증·시뮬레이션 실행·기록·초안.
▸ 원칙: `▸`(실험·논문) / `※`(해석) 구분, 없는 값은 "미명시", 로컬 LLM만 사용, Vault 노트 덮어쓰기 금지.

## 2. 이름 규칙

| 이름 | 의미 |
|---|---|
| **GFM** | Grid-Forming — 연구 주제 약어. `GFM_Research`, `model.py` 등 코드 전체 |
| **GFM Labs** | 연구소(회사) 이름. 구 "GMF Labs"는 오타 → 2026-09-09 통일 |
| `gfm-labs-agent` | 익스텐션 포크 저장소 (구 `gmf-labs-agent`에서 rename) |
| `gfm-labs` | Firebase 프로젝트 ID (신규 생성). 구 `gmf-labs` 프로젝트는 삭제 대상 |

## 3. 형상관리 — 두 저장소

**기준: 연구 상태(데이터)는 RSCAD, 에이전트 제품(코드)은 gfm-labs-agent.** 제품 저장소에는 GFM 고유 내용이 없어야 한다.

```
~/Dev/RSCAD                      github.com/charminseon1987/RSCAD          (연구)
├─ GFM_Research/                 ← Obsidian Vault = 에이전트 두뇌 폴더
│  ├─ schedule.v1.yaml           ← 일정 진실원 초안 (확정 후 schedule.yaml 로 교체)
│  ├─ checkList*.md              ← 읽기용 미러
│  ├─ 00_MOC / 01_개념 / 02_방법론 / 03_실험결과 / 04_문헌 / 05_템플릿
│  └─ _company/_agents/{secretary,developer,business}/goal.md, skills/
├─ Simulation/  model.py op.py runner.py metrics.py xval.py pf.py
├─ agent/       observer.py schedule_agent.py + gate_check.py results_digest.py observe_map.example.yaml
├─ results/     runner.py 산출 (LATEST.json 포인터) — evidence 폴더, 추적 유지
└─ connect-ai/  ← .gitignore 로 제외 (아래 포크의 로컬 클론)

~/Dev/RSCAD/connect-ai           github.com/charminseon1987/gfm-labs-agent (제품, private)
├─ src/  extension.ts agents.ts plaza.ts …     ← Jay 익스텐션 포크
├─ gfm-labs/
│  ├─ rag/        ingest.py query.py server.py  (Vault → ChromaDB → :5100)
│  ├─ web/        Vite+React  /store /plaza /download  (Phase 8 이후)
│  └─ GFM_Labs_설계.md
├─ .vscode/launch.json  (PLAZA_DB_URL)
└─ git remote: origin=charminseon1987/gfm-labs-agent, upstream=wonseokjung/connect-ai
```

▸ RSCAD `.gitignore`: `connect-ai/`, `__pycache__/`, `*.pyc`, `.env`, `agent/chroma/`, `*.bak.*`
▸ 이미 추적되던 `connect-ai/*`, `*/__pycache__/*` 는 `git rm -r --cached` 로 해제 (2026-09-09)
▸ gfm-labs-agent `.gitattributes`: `* text=auto eol=lf` (Mac/Windows 혼용 대비)
※ upstream 갱신: `git fetch upstream && git merge upstream/main`

## 4. 인프라 설정값

| 항목 | 값 |
|---|---|
| Firebase RTDB (광장) | `https://gfm-labs-default-rtdb.firebaseio.com` |
| RTDB 규칙 | `{ "rules": { "plaza": { ".read": true, ".write": true } } }` — 게시 필요. 운영 전 익명 Auth |
| 익스텐션 설정 | `connectAiLab.plazaDbUrl` = 위 URL. 명령 "Connect AI: 🏛️ 에이전트 광장 입장/퇴장" |
| 데스크톱 앱 (v0.5.12) | 설정 → 고급 → "대학 DB URL" = 위 URL. 운영자 설정 3개는 비움 |
| 로컬 LLM | LM Studio `http://127.0.0.1:1234` (Developer 탭 Start Server) 또는 Ollama `:11434` |
| 임베딩 | `ollama pull nomic-embed-text` (RAG용) |
| Bridge | `http://127.0.0.1:4825` — 익스텐션·데스크톱 앱 동시 실행 시 충돌, 하나만 |
| 작업 폴더 / 두뇌 폴더 | `C:\Users\hyese\Dev\RSCAD\GFM_Research` |
| 익스텐션 설치 | `npm run compile` → `npx @vscode/vsce package --no-dependencies` → Install from VSIX |

▸ 검증 완료: 익스텐션 광장 입장 → RTDB `plaza/rooms/lobby/presence/ca-…` 생성 확인 (구 DB 기준, 새 DB로 재확인 필요)

## 5. 연구 일정 — 확정값

| 항목 | 값 |
|---|---|
| `month_1_start` | 2026-05 (확정) → 2026-09 = **5월차** |
| `deadline_month` | 12 |
| `tier` | **2** — 소프트웨어 검증 (EMT + SIL). RTDS CHIL 불필요, P6 일정 제외 |
| `model_version` | v3-22state (`runner.py`) |
| `pace` | accuracy_first — R1(마감 역산)은 medium 참고 경보 |

▸ gate_check 현재 출력: `다음 게이트: P4 착수 ← P3-A6, P4-A0 미완 · 마감까지 약 212일`

### 코드가 확정한 사실 (2026-09-09 대조)
- ▸ P4-A0 안정도 지표는 `metrics.py`에 **이미 구현** (σ_min ≥ 4.0 [t_s ≤ 1s], ζ_min ≥ 0.10 부차, `score = min(σ/4, ζ/0.1)`)
- ▸ ζ = 0.64 는 표준 조항이 아니라 v0의 `4/(2π·1Hz)` 환산값 → **P3-A6 재정의**: "t_s ≤ 1s 출처 확정 + σ 대체 정당화"
- ▸ `runner.py` v3: 모드 대역 분류·교차 검출·미수렴 원인 구분·`results.md` 자동 생성 — 에이전트가 재계산하지 않음
- ▸ `xval.py`: 격자 임계값 + 멱함수 피팅 임계값. P2-A5 비단조 판별은 **피팅값 단조성**으로
- ▸ `observer.py`: evidence 실재 검증·정체 관측·승격 제안(draft까지). `issue/next_action/action` 필드가 있으면 승격 보류

### 사람이 할 것 (state 상향은 사람만)
- [ ] draft 6건 evidence 경로 기입: P2-A2, P2-A3, P2-A4, P3-A2, P3-A3, P3-A4
- [ ] P0-A3 Tier 결정 근거 노트 → evidence
- [ ] P4-A0 evidence 확인 후 verified
- [ ] `schedule.v1.yaml` → `schedule.yaml` 교체
- [ ] `pf.py` 와 `metrics.participation()` 정의 일치 확인 (P3-A1 evidence)

## 6. 에이전트 팀 (connect-ai id 유지, 역할 재정의)

| id | 새 이름 | 첫 임무 |
|---|---|---|
| ceo | 연구소장 | 명령 분해·배분, decisions.md |
| secretary | 실험 노트 관리자 | 아침 브리핑 = `gate_check` → `observer` 순. results.md Vault 이동. 미러↔YAML 동기(`schedule_sync` 스킬) |
| developer | 시뮬레이션·CHIL 엔지니어 | **P2-A5**: `runner.py --SCR 1.7 1.6 1.5 1.4 1.3 --tag p2a5` → `xval.py` → `results_digest --xval` |
| business | 검증 판정자 | metrics.py 기준표로 판정. binding(σ/ζ) 명시, loadability_limit 분리 |
| researcher | 문헌 추적자 | 논문 지식화 v2, [1]~[15] 연결맵 |
| writer | 논문 작가 | ▸/※ 유지한 섹션 초안 |
| designer | 그림 담당 | 고유값 복소평면, 2D 히트맵 |
| instagram, editor | 비활성 | — |

▸ goal.md 위치: `GFM_Research/_company/_agents/<id>/goal.md`
▸ output_policy 금지: 진척률 %, 전체 일정 재나열, 격려 문구, 사용자 확인 없는 state 상향

## 7. 도구

| 도구 | 위치 | 역할 |
|---|---|---|
| `gate_check.py` | `RSCAD/agent/` | schedule.yaml 경보 R0~R5 판정(YAML severity), 게이트, 미러 대조, month 계산 경고. `--fix-r4` 만 자동 변경 |
| `results_digest.py` | `RSCAD/agent/` | runner 결과 요약(`LATEST.json`), `--xval` 선형화 유효성·단조성, `--compare A B` |
| `observer.py` | `RSCAD/agent/` (기존) | evidence 관측 → 승격 제안 |
| `rag/` | `gfm-labs-agent/gfm-labs/` | Vault 색인·검색 서버 `:5100` (`/query`, `/ask`) |
| `schedule_sync.md` | secretary skills | checkList → schedule.yaml 초안 변환 규칙 |

실행 예:
```bash
cd ~/Dev/RSCAD
python agent/gate_check.py --yaml GFM_Research/schedule.v1.yaml --mirror GFM_Research/checkList.md
python agent/results_digest.py --results results
python agent/results_digest.py --results results --xval
```

## 8. 우선순위 (결정)

1. ✅ schedule.yaml v1 초안 + gate_check + 에이전트 미션 — 완료, 사람 확정 대기
2. ⏳ **포크 `src/agents.ts` 페르소나 교체** + `readAgentSharedContext` → RAG `:5100` 연결
3. ⏳ 첫 자율 사이클: P2-A5 스윕 → EXP/BUG 노트 자동 생성
4. ⏸ 웹(`/store`, `/plaza`) — Phase 8 이후
5. ⏸ RTDB 익명 Auth, 멀티룸 — 운영 전

## 9. 하지 않는 것

- 클라우드 LLM (연구 데이터 외부 유출 없음)
- 에이전트의 Vault 노트 덮어쓰기 — 새 노트 생성 또는 append
- 에이전트의 `current_month`·state 상향 — 사람만
- 유튜브·인스타·PayPal 기능 — 포크에서 비활성

## 🔗 연결

- [[GFM_연구_전체지도]]
- [[GFM_Labs_설계]] (`gfm-labs-agent/gfm-labs/GFM_Labs_설계.md`)
- [[실험결과_업데이트_절차]]
- `schedule.v1.yaml`, `checkList_v0.1.md`
