---
name: paper-intake
description: 논문 한 편을 "인용할 수 있는 상태"까지 한 번에 올린다. PDF 확보 → paper-reader 정독 → Claim-Evidence 레코드 → ce_tool 검증 → Obsidian 노트 → RAG 말뭉치 색인. "이 논문 넣어줘", "논문 들여와", "정독해서 정리해줘", DOI·arXiv ID·PDF 를 주면서 쌓아 달라고 할 때 사용한다. 검색만 필요하면 paper-searcher, 이미 레코드가 있는 것들의 종합은 lit-reviewer.
allowed-tools: Read Write Edit Bash Glob Grep Task
metadata:
  version: "1.0"
  writes-to: GFM_Research/00_Knowledge/{papers,records,literature}/ · rag/
---

# 논문 들여오기 — 찾은 논문에서 인용 가능한 노트까지

## 왜 이 스킬이 있나

CLAUDE.md 에 파이프라인이 그려져 있고 담당 에이전트도 다 있는데, **둘을 잇는 입구가
없었다.** 그래서 매번 사람이 손으로 이어붙여야 했고, 결국 안 돌아갔다.

2026-10-14 에 세어 보니 `papers/` 는 12편인데 `records/` 는 **1건**이었다.
`literature/` 의 노트 12개 중 11개는 레코드 없이 손으로 쓰인 것이었다 — "노트를 손으로
쓰지 않는다. 구조화된 레코드에서 렌더한다" 는 규칙과 정반대 상태다. 게다가 노트가 있는
논문과 말뭉치에 있는 논문이 **거의 겹치지 않았다.** 검색되는 논문은 인용할 수 없고,
인용하는 논문은 검색되지 않았다.

이 스킬의 목적은 하나다 — **그 두 집합을 같게 유지하는 것.**

## 입력

PDF 경로 · DOI · arXiv ID 중 하나. 여러 편이면 한 편씩 순서대로 돈다
(한 편이 실패해도 나머지는 진행하고, 실패한 편을 마지막에 모아 보고한다).

## 절차

### 1. PDF 를 `papers/` 에 둔다

- 이미 `GFM_Research/00_Knowledge/papers/<이름>.pdf` 가 있으면 그걸 쓴다.
- arXiv ID 면 `https://arxiv.org/pdf/<id>` 로 받는다.
- DOI 면 공개 경로(출판사 OA · 기관 리포지터리)를 찾아 받는다.
- **받은 파일이 PDF 인지 확인한다** — `head -c 4` 가 `%PDF` 여야 한다.
  Cloudflare·봇 차단은 HTML 을 200 으로 돌려준다. 이걸 PDF 라고 저장하면
  뒤 단계가 전부 조용히 망가진다. 실제로 Soton·Aalto·preprints.org 4건이 그랬다.
- 못 받으면 **거기서 멈추고 사람에게 링크를 넘긴다.** 초록만으로 레코드를 만들 수는
  있지만(2번의 `extraction_depth`), 그건 사람이 정하는 것이지 자동으로 내릴 판단이 아니다.

파일명은 `<제1저자>_<연도>_<주제어>.pdf` 로 통일한다 (예: `Chen_2026_LCL_Resonance_SingleLoop_GFM`).
이 이름이 그대로 `doc` 이름이 되고 eval 의 `gold` 가 된다.

### 2. paper-reader 로 정독 → 레코드

`paper-reader` 서브에이전트에 PDF 경로를 넘긴다. 그 에이전트의 규약을 여기서 다시
쓰지 않는다 — 권위는 `.claude/agents/paper-reader.md` 한 곳이다.

넘길 때 **이 저장소의 연구 축**을 함께 준다. 그래야 `context` 와 `my_relevance` 가
쓸모 있게 채워진다.

> 이 저장소는 PV+ESS 2단 GFM 인버터의 소신호 안정도를 본다. 22차 상태공간,
> SCR–X/R 강건성 경계(특히 낮은 X/R 1.0~1.5), PSO 기반 이득 조정, RTDS CHIL 검증.
> 이 논문이 그중 무엇에 닿는지, 그리고 **내 신규성 주장과 충돌하는 대목이 있는지**를
> 반드시 짚어라.

마지막 항목이 중요하다. NEXT.md §0 이 그렇게 뒤집혔다 — "아무도 안 했다" 던 주제를
이미 한 논문이 있었다. 충돌하는 대목은 숨기지 말고 `claims` 에 그대로 적는다.

### 3. 검증 — 통과해야 다음으로 간다

```bash
python tools/ce_tool.py validate "GFM_Research/00_Knowledge/records/<cite_key>.json"
```

- `exit 0` 이 아니면 **노트를 만들지 않는다.** 레코드를 고쳐 다시 돌린다.
- `△` 경고는 막지 않지만 그대로 사람에게 보고한다. 특히:
  - `result 인데 정량값 없음` — 그림에서 수치를 못 읽었다는 뜻
  - `반증 검색 전` — 그 공백은 **논문에 "공백"으로 쓸 수 없다**

### 4. 노트 렌더

```bash
python tools/ce_tool.py obsidian "GFM_Research/00_Knowledge/records/<cite_key>.json"
```

**직접 쓰지 않는다.** `to_md()` 가 형식의 권위다. 노트를 손보고 싶으면 레코드를
고쳐서 다시 렌더한다 — 노트를 직접 고치면 다음 렌더에서 사라진다.

### 5. 말뭉치에 넣는다 — 검색도 되게

```bash
python Scripts/01_chunk.py --strategy section \
    --pdf-dir GFM_Research/00_Knowledge/papers \
    --data-dir GFM_Research/00_Knowledge/rag
python Scripts/02_index.py --strategy section \
    --data-dir GFM_Research/00_Knowledge/rag --chunk-rows 32 --batch 4
```

- 참고문헌은 `01_chunk.py` 가 알아서 버린다(`is_reference`). 1163 → 1018청크 때
  `Recall@1` 이 +0.143 올랐다.
- **재색인은 이 기계에서 메모리에 걸린다.** 먼저 `ollama ps` 를 보고 적재된 모델이
  있으면 `ollama stop <모델>` 한다 — qwen3:8b 가 6.7GB 를 쥐고 있던 적이 있다.
  중간에 죽어도 `02_index.py` 는 이어받는다(처음부터 하려면 `--fresh`).
- 화면에서 넣는 경로(`/api/index`, `Server/indexer.py`)도 같은 청킹·같은 필터를 쓴다.
  둘이 어긋나면 말뭉치가 둘로 갈라진다.

### 6. 들여온 결과를 확인한다

```bash
python Scripts/Check_index.py GFM_Research/00_Knowledge/rag
python tools/ce_tool.py gaps "GFM_Research/00_Knowledge/records/*.json"
```

`gaps` 는 이번 논문이 기존 공백을 메웠는지 다시 집계한다. 메웠으면 NEXT.md 의
해당 항목을 갱신할 거리가 생긴 것이다 — 고치지는 말고 **보고**한다.

## 끝내고 보고할 것

한 편마다 다음을 적는다. 모르면 모른다고 적는다.

| 항목 | 내용 |
|---|---|
| cite_key | |
| PDF | 받았다 / 못 받았다(링크) / 이미 있었다 |
| extraction_depth | `full` / `abstract` / `metadata` — **`full` 이 아니면 그 이유** |
| claims | 개수, 그중 `type: result` 몇 개 |
| validate | `exit 0` 여부 + `△` 경고 원문 |
| 노트 | 경로 |
| 말뭉치 | 청크 수, 색인 총계 |
| **신규성 충돌** | 내 주장과 부딪히는 대목이 있었나 — 있으면 원문 인용과 쪽 |

## 하지 않는 것

- **노트를 손으로 쓰지 않는다.** 레코드 → `to_md()` 만이 경로다.
- **`verification.status` 를 올려 적지 않는다.** `auto_checked` 는 사람이 확인하지
  않은 상태다. `human_verified` 는 사람만 올린다.
- **초록만 읽고 `extraction_depth: full` 로 적지 않는다.**
- **못 받은 PDF 를 "없는 논문"으로 처리하지 않는다.** 찾지 못한 것과 없는 것은 다르다.
- 서지정보를 확인 못 했으면 비우지 말고 `미검증` 으로 둔다.

## 연결

- `.claude/agents/paper-searcher.md` — 무엇을 들여올지 찾는다 (이 스킬의 앞단)
- `.claude/agents/paper-reader.md` — 2번 단계의 권위
- `.claude/agents/lit-reviewer.md` — 레코드가 쌓인 뒤 종합·비교표 (이 스킬의 뒷단)
- `tools/ce_tool.py` — 검증·렌더·공백 집계
- `NEXT.md` §5 — 이 경로에서 밟은 함정들 (봇 차단·메모리·색인)
