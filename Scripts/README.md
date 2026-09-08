# 논문 검색 RAG — 실험 골격

GFM 논문 PDF 를 검색하는 RAG 파이프라인. **청킹 전략과 리랭커의 효과를
평가셋으로 측정**하는 것이 목적이다. 튜토리얼과 다른 점은 3단계 평가셋이다.

## 순서

```bash
pip install -r requirements.txt

python scripts/01_chunk.py    --strategy section   # 섹션 단위
python scripts/01_chunk.py    --strategy fixed     # 고정 길이
python scripts/02_index.py    --strategy section
python scripts/02_index.py    --strategy fixed
python scripts/03_eval.py     --strategy section
python scripts/03_eval.py     --strategy fixed --rerank
```

## 폴더

```
data/
├── pdf/            논문 원본 (직접 넣는다)
├── chunks/         01 출력
├── index/          02 출력 (Chroma)
└── eval.jsonl      평가셋 — 직접 작성
```

## 평가셋이 핵심이다

`data/eval.jsonl` 한 줄이 질문 하나다.

```json
{"q": "GFM 인버터에서 DC링크와 AC측 결합을 상태공간에 포함한 논문", "gold": ["Chen2024", "Wu2023"]}
```

- `q` — 실제로 던질 질문. 논문 쓰다 막혔을 때 검색창에 칠 문장 그대로
- `gold` — 그 질문에 답이 되는 문서 id (파일명 stem)

20문항이면 충분하다. **직접 읽어서 정답을 매겨야 한다.** 이 작업이 귀찮아서
대부분 건너뛰고, 그래서 "튜닝했다"고 말할 근거가 없어진다.

## 지표

| 지표 | 의미 |
|---|---|
| Recall@k | 정답 문서가 상위 k 에 들어왔는가 |
| MRR | 정답이 몇 번째로 나왔는가 |
| nDCG@k | 순위까지 반영한 품질 |

전략을 바꿔가며 이 셋을 비교하는 것이 실험이다.
