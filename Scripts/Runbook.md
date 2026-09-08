# RAG 실행 명령 모음

작업 위치는 항상 `~/Dev/RSCAD` 다. `Scripts` 폴더 안에서 실행하면 경로가 어긋난다.

```bash
cd ~/Dev/RSCAD
```

경로가 길어 반복되므로 변수로 잡아두면 편하다.

```bash
PDF=GFM_Research/00_Knowledge/papers
RAG=GFM_Research/00_Knowledge/rag
```

---

## 0. 준비 (한 번만)

```bash
pip install pymupdf sentence-transformers chromadb FlagEmbedding
python -c "import torch; print('GPU:', torch.cuda.is_available())"
```

`.gitignore` 에 추가한다. 색인이 수백 MB 가 된다.

```
GFM_Research/00_Knowledge/rag/chunks/
GFM_Research/00_Knowledge/rag/index/
```

---

## 1. 청킹

```bash
python Scripts/01_chunk.py --strategy section --pdf-dir $PDF --data-dir $RAG
python Scripts/01_chunk.py --strategy fixed   --pdf-dir $PDF --data-dir $RAG
```

기대 출력.

```
  문서      7편
  청크      827개  (문서당 118.1)
  길이      중앙값 817자  최소 266  최대 1384
```

▸ 중앙값이 800~1200자면 정상이다.
▸ 수천 자가 나오면 하위 분할이 안 된 구버전이다. `01_chunk.py` 를 교체할 것.

### 청크 길이 조정

```bash
python Scripts/01_chunk.py --strategy section --pdf-dir $PDF --data-dir $RAG \
  --size 1200 --max-chunk 2000
```

| 옵션 | 기본 | 뜻 |
|---|---|---|
| `--size` | 900 | 목표 청크 길이 |
| `--overlap` | 150 | 인접 청크 겹침 |
| `--max-chunk` | 1600 | 이 길이 넘는 절은 재분할 |
| `--min-chunk` | 200 | 이보다 짧은 조각은 폐기 |
| `--recursive` | — | 하위 폴더까지 훑기 |

### 절 인식 실패 문서 찾기

```bash
python -c "
import json, collections
p = 'GFM_Research/00_Knowledge/rag/chunks/section.jsonl'
rows = [json.loads(l) for l in open(p, encoding='utf-8')]
c = collections.Counter(r['doc'] for r in rows)
notitle = collections.Counter(r['doc'] for r in rows if not r['title'])
print('문서별 청크 수:')
for d, n in c.most_common():
    mark = '  ← 절 인식 실패' if notitle[d] == n else ''
    print(f'  {d:<40} {n:>4}{mark}')
"
```

---

## 2. 임베딩 · 색인

```bash
python Scripts/02_index.py --strategy section --data-dir $RAG
```

▸ 첫 실행에서 `bge-m3` 2GB 를 내려받는다.
▸ CPU 만으로 827청크는 **20~40분**. 진행 막대가 `Batches: n/104` 형태로 뜬다.
▸ 색인은 저장되므로 다음부터는 걸리지 않는다.

기대 출력.

```
  청크 827개 · 모델 BAAI/bge-m3
  💾 ...\rag\index / section  (827개)
```

※ 마지막 숫자가 청크 수와 같아야 한다.

### 한국어 특화 모델로 비교

```bash
python Scripts/02_index.py --strategy section --data-dir $RAG --model nlpai-lab/KURE-v1
```

### 메모리가 부족하면

```bash
python Scripts/02_index.py --strategy section --data-dir $RAG --batch 4
```

---

## 3. 검색 품질 평가

### 3-1. 평가셋 채우기 전 — 검색만 보기

```bash
python Scripts/03_eval.py --strategy section --data-dir $RAG
```

`gold` 가 비어 있으면 점수 대신 질문과 검색 결과를 보여준다. 이것을 보고 정답을 매긴다.

```
  Q  약계통에서 가상 동기기 제어의 동기화 안정도 한계
     Taul_2020_CurrentLimiting_GFM · DArco_2014_VSM_Droop · ...
```

### 3-2. 평가셋 작성

`GFM_Research/00_Knowledge/rag/eval.jsonl` 을 열어 `gold` 를 채운다.

```json
{"q": "약계통에서 가상 동기기 제어의 동기화 안정도 한계", "gold": ["Taul_2020_CurrentLimiting_GFM"]}
```

▸ `gold` 는 파일명에서 `.pdf` 를 뗀 것이다.
▸ 정답이 여러 편이면 `["A", "B"]` 로 적는다.
▸ 20문항이면 충분하다. **직접 읽고 매겨야 한다.**

### 3-3. 점수 측정

```bash
python Scripts/03_eval.py --strategy section --data-dir $RAG
python Scripts/03_eval.py --strategy section --data-dir $RAG --rerank
python Scripts/03_eval.py --strategy fixed   --data-dir $RAG --rerank
```

기대 출력.

```
              Recall@5       MRR     nDCG@5
  ──────────────────────────────────────
  검색만          0.6500    0.5417     0.5893
  +리랭커         0.8000    0.7250     0.7614
  개선             23.1%     33.9%      29.2%
```

이어서 상위 5 안에 정답이 없는 질문 목록이 나온다. **다음 개선의 출발점이다.**

| 옵션 | 기본 | 뜻 |
|---|---|---|
| `--k` | 5 | 지표 산출 상위 k |
| `--fetch` | 30 | 1차 검색 개수 (리랭커 입력) |
| `--rerank` | — | 리랭커 적용 |
| `--model` | bge-m3 | 색인과 같은 모델을 써야 한다 |

---

## 실험 순서

한 번에 하나만 바꾼다.

```bash
# A — 청킹 전략 비교
python Scripts/03_eval.py --strategy section --data-dir $RAG
python Scripts/03_eval.py --strategy fixed   --data-dir $RAG

# B — 청크 길이
python Scripts/01_chunk.py --strategy section --pdf-dir $PDF --data-dir $RAG --size 600
python Scripts/02_index.py --strategy section --data-dir $RAG
python Scripts/03_eval.py  --strategy section --data-dir $RAG

# D — 리랭커
python Scripts/03_eval.py --strategy section --data-dir $RAG --rerank
```

※ B 는 청킹부터 다시 해야 한다. 색인은 청크에 종속된다.

---

## 자주 나오는 오류

| 증상 | 원인 | 해결 |
|---|---|---|
| `can't open file '...\Scripts\Scripts\01_chunk.py'` | `Scripts` 안에서 실행 | `cd ~/Dev/RSCAD` |
| `...\data\pdf 에 PDF 가 없습니다` | `--pdf-dir` 누락 | 옵션 지정 |
| `unrecognized arguments` | 구버전 스크립트 | 파일 교체 |
| `컬렉션 'section' 없음` | 색인 안 함 | `02_index.py` 먼저 |
| 중앙값이 수천 자 | 하위 분할 없는 구버전 | `01_chunk.py` 교체 |

---

## 산출물

```
GFM_Research/00_Knowledge/rag/
├── chunks/section.jsonl        청크        (gitignore)
├── chunks/fixed.jsonl
├── index/                      벡터DB      (gitignore)
├── eval.jsonl                  평가셋      ★ 버전관리
└── eval_section_rerank.json    측정 결과
```

평가셋은 손으로 만든 자산이다. 반드시 커밋한다.