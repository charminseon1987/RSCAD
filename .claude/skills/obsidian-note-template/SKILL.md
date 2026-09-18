---
name: obsidian-note-template
description: GFM 소신호 안정도 연구 Obsidian 노트 생성. 문헌(literature)·주장(claim) 두 유형을 ▸/※ 표기 규칙과 정규 섹션 구조로 생성한다. cite_key 자동 부여, extraction_depth 기반 리젝 규칙, frontmatter 완전 출력, Dataview 호환 보장.
allowed-tools: Read Write Edit Bash Glob Grep
metadata:
  version: "2.0"
  skill-author: 조연호 (연세대)
---

# Obsidian Note Template — GFM 연구 문헌/주장 노트

## Overview

GFM_Research/00_Knowledge/ 볼트에 문헌(literature) 노트와 주장(claim) 노트를 일관된 형식으로 생성한다. 이 스킬의 핵심은 **사실(▸)과 판단(※)의 분리** — 인용 시 오류를 방지하고, Dataview 자동 집계로 연구 갭을 정량화하는 것이다.

## When to Use This Skill

- 새 논문을 읽고 문헌 노트를 만들 때
- 연구 주장(claim)을 정리하고 근거-반박 구조로 기록할 때
- 기존 노트가 템플릿에 맞는지 검사할 때
- `citation-management` 스킬과 연계하여 노트를 대량 생성할 때

---

## Notation Rules (절대 규칙)

| 기호 | 의미 | 원칙 |
|---|---|---|
| `▸` | 원문에 명시된 사실. 원문 대조 가능해야 함 | 논문에 없으면 절대 ▸로 쓰지 않는다 |
| `※` | 노트 작성자의 판단·해석·내 연구와의 관계 | 논문 근거 없음을 명시적으로 표시 |

**혼용 금지:** ▸ 줄에 개인 의견이 섞이면 안 되고, ※ 줄에 직접 인용이 들어가면 안 된다.

**값 부재 구분:**
- `미명시` = 원문에 해당 정보가 없음 (확인 완료)
- `미확인` = 내가 원문을 아직 못 봄 (확인 미완료)

---

## Literature Note Template

파일 위치: `GFM_Research/00_Knowledge/literature/{Author}_{Year}_{Venue}.md`
파일명과 cite_key를 일치시킨다. PDF도 같은 cite_key로 저장.

### YAML Frontmatter (전체 키 필수 — 값이 없어도 키는 남긴다)

```yaml
---
cite_key: author2024venue              # 제1저자성(소문자) + 연도 + 주제어/학회약어
ref_num: null                          # 논문에 실제 인용 시 부여. 임의 매기지 않음
title: ""
authors: []
corresponding: ""
year: 2024
venue: ""
doi: ""
pdf: "[[author2024venue.pdf]]"         # 없으면 ""
pdf_status: none                       # have | oa-available | request | none
paper_type: method                     # review | method | analysis | experimental
target_system: PV+ESS                  # WTG | PV | ESS | PV+ESS | 일반
control_scheme: []
model_order: 미명시                     # 정수 | 미명시 | N/A(리뷰)
analysis_method: [미명시]
tuning_method: 수동                     # 수동 | 적응형 | PSO | GA | Lyapunov기반
scr_range: 미명시
xr_range: 미명시
validation_level: sim-only             # none | sim-only | CHIL | PHIL | 실기
hardware: []
extraction_depth: full                 # full | abstract | metadata
section: ""                            # 내 논문의 어느 섹션에서 인용할지
tags: [paper]
status: to-read                        # to-read | read | noted | cited
---
```

### Section Structure

```markdown
# 📌 Brief Summary
(2~3문장. 무엇을 하는 논문이고 내 논문에서 어떤 자리에 쓰는지)

---

# 📖 Core Content
▸ 전체 인용: {풀 인용 정보}
▸ 핵심 기여:
  - {bullet points}
▸ 방법:
  - {상태변수, 제어 구조, 검증 방법 등}
▸ 검증: {sim-only / CHIL / field / 없음}
▸ 주요 수치:                    (조건과 단위 포함. 없으면 "미명시")
  - {값} → [[cite_key.pdf#page=N]]   (페이지 앵커 권장)
▸ 저자가 밝힌 한계:
  - {bullet points}

---

# 🔗 Knowledge Connections
* Related Topics: {관련 주제}
* Projects/Contexts: {관련 프로젝트}
* Claims: [[claim-...]]

---

# ✍️ My Take
※ 차별점: {내 논문이 이것과 다른 지점}
※ 인용 자리: {서론 / 관련연구 / 방법 / 검증}
※ 전략적 배치 이유: {왜 여기에 인용하는지}
※ 그대로 못 쓰는 이유: {이 논문의 방법을 직접 쓸 수 없는 이유}
※ 미확인 항목:
  - {원문에서 추가 확인이 필요한 사항}
```

---

## Claim Note Template

파일 위치: `GFM_Research/00_Knowledge/claims/claim-{kebab-case-keyword}.md`

### YAML Frontmatter

```yaml
---
type: claim
claim_id: claim-{kebab-case}
date: YYYY-MM-DD
status: supported                      # supported | contested | open
tags: [claim]
---
```

### Section Structure

```markdown
# 🔵 Claim: {한 줄 주장}

> {핵심 주장을 한 문장으로 명확하게}

---

## 📌 주장 내용
{상세 설명 — 2~3문장}

---

## ▸ 지지 근거 (Supporting Evidence)
| 출처 | 근거 | evidence_type |
|---|---|---|
| [[cite_key]] | ▸ {원문 내용} | direct / cited / inferred |

---

## ▸ 반박 근거 (Contradicting Evidence)
| 출처 | 근거 | evidence_type |
|---|---|---|
| — | — | — |

---

## ✍️ 내 연구에서의 역할
※ 인용 자리: §{섹션}
※ 내 결과와의 관계: {설명}
※ 이 주장으로 정당화되는 것:
  - {bullet points}

---

## 🔗 연결 노트
- [[{관련 노트}]]
```

**evidence_type 정의:**
- `direct` = 내가 원문에서 직접 확인
- `cited` = 해당 논문이 다른 논문을 인용하며 제시 (간접)
- `inferred` = 원문에 명시적으로 쓰여 있지 않지만 내용에서 추론

---

## Rejection Rules (검증 시 리젝 기준)

노트 생성 후 다음을 자동으로 검사한다. 위반 시 리젝하고 수정을 요구한다.

| # | 규칙 | 심각도 |
|---|---|---|
| R1 | `extraction_depth != full`인데 수치 필드(model_order, scr_range 등)에 숫자 존재 | **REJECT** |
| R2 | `paper_type: review`인데 `model_order`에 정수 존재 | **REJECT** |
| R3 | ▸ 항목인데 원문 대조 불가능한 내용 → `※ 미확인 항목`으로 이동 | **REJECT** |
| R4 | frontmatter 키 하나라도 누락 | **REJECT** |
| R5 | 주요 수치에 조건·단위 없음 → 해당 항목 삭제 | **REJECT** |
| R6 | 리뷰 논문이 인용한 결과를 본 논문 결과로 기재 (출처 표기 `[N] 인용` 누락) | **REJECT** |
| R7 | ▸/※ 혼용 — ▸ 줄에 개인 의견 포함 또는 ※ 줄에 직접 인용 포함 | **WARN** |
| R8 | cite_key가 기존 literature/ 폴더에 이미 존재 (중복) | **WARN** |

---

## cite_key Convention

```
제1저자성(소문자) + 연도 + 주제어/학회약어
```

예시:
- `chen2024electronics` — Chen et al. 2024, Electronics
- `salem2025gfmreview` — Salem et al. 2025, GFM Review
- `dong2026gfmsvr` — Dong et al. 2026, GFM SVR
- `kenyon2020ibrstability` — Kenyon et al. 2020, IBR Stability

`ref_num`은 실제 논문에 인용할 때만 부여. 노트 생성 시점에 임의로 매기지 않는다.

---

## Vault Structure Reference

```
GFM_Research/                          ← Obsidian 볼트 루트 (.obsidian 위치)
├── .obsidian/
├── 00_Knowledge/
│   ├── papers/                        ← 원본 PDF. 파일명 = cite_key
│   ├── literature/                    ← 남의 논문 1:1 노트
│   ├── claims/                        ← 주장 1:1 노트
│   ├── mine/                          ← 내 결과. literature와 같은 스키마
│   └── 00_MOC.md                      ← Dataview 대시보드
└── RSCAD/                             ← 시뮬레이션 작업 폴더
```

Dataview 쿼리 경로는 볼트 루트(`GFM_Research/`) 기준: `"00_Knowledge/literature"`

---

## PDF Page Anchor

수치를 적을 때 근거 페이지를 같이 박아두면 나중에 원문 대조가 클릭 한 번:

```markdown
▸ 주요 수치:
  - 강/약계통 경계 SCR 3 → [[salem2025gfmreview.pdf#page=17]]
  - 영국 GFM 사양 초안 1.5 p.u. → [[salem2025gfmreview.pdf#page=19]]
```

`![[...]]`는 노트 안에 뷰어를 임베드 (무거움), `[[...]]`는 링크만. 수치 검증용은 링크로 충분.

---

## Example Invocations

```
사용자: Chen 2024 Electronics 논문 노트 만들어줘
→ GFM_Research/00_Knowledge/literature/Chen_2024_Electronics.md 생성
  (frontmatter 전체 키 + 4개 섹션 + 리젝 규칙 자동 검증)

사용자: "GFM 튜닝은 운전점에 의존한다" claim 노트 만들어줘
→ GFM_Research/00_Knowledge/claims/claim-gfm-tuning-is-operating-point-dependent.md 생성

사용자: 기존 노트 전체 검사해줘
→ literature/, claims/ 전체 스캔 → R1~R8 위반 보고

사용자: 이 PDF 읽고 문헌 노트 만들어줘 (abstract만 읽음)
→ extraction_depth: abstract 설정, 수치 필드 전부 "미확인"으로 채움
```
