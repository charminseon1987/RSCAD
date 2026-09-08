"""
03_eval.py — 검색 품질 측정

평가셋(data/eval.jsonl)으로 Recall@k, MRR, nDCG@k 를 잰다.
--rerank 를 주면 리랭커를 붙인 뒤 같은 지표를 다시 재서 개선 폭을 보여준다.

이 스크립트가 이 프로젝트의 핵심이다. 청킹 전략이나 모델을 바꿨을 때
"좋아진 것 같다"가 아니라 숫자로 답할 수 있어야 튜닝했다고 말할 수 있다.

실행:
    python scripts/03_eval.py --strategy section
    python scripts/03_eval.py --strategy fixed --rerank
    python scripts/03_eval.py --strategy section --k 10
"""

import argparse
import json
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
DEF_DATA = ROOT / 'data'      # --data-dir 로 덮어쓸 수 있다


# ══════════════════════════════════════════════
# 지표
# ══════════════════════════════════════════════
def recall_at_k(ranked, gold, k):
    """정답 문서 중 상위 k 안에 들어온 비율."""
    if not gold:
        return np.nan
    return len(set(ranked[:k]) & set(gold)) / len(gold)


def mrr(ranked, gold):
    """첫 정답의 역순위. 1.0 이면 1등으로 맞혔다는 뜻."""
    for i, d in enumerate(ranked, 1):
        if d in gold:
            return 1.0 / i
    return 0.0


def ndcg_at_k(ranked, gold, k):
    """순위까지 반영한 품질. 정답이 위에 있을수록 높다."""
    if not gold:
        return np.nan
    dcg = sum(1 / np.log2(i + 1) for i, d in enumerate(ranked[:k], 1) if d in gold)
    ideal = sum(1 / np.log2(i + 1) for i in range(1, min(len(gold), k) + 1))
    return dcg / ideal if ideal else 0.0


def dedup_docs(ids):
    """청크 id(doc::i) 를 문서 단위로 접는다. 순서는 유지한다."""
    seen, out = set(), []
    for cid in ids:
        d = cid.split('::')[0]
        if d not in seen:
            seen.add(d)
            out.append(d)
    return out


# ══════════════════════════════════════════════
def main():
    ap = argparse.ArgumentParser(description='검색 품질 평가')
    ap.add_argument('--strategy', required=True)
    ap.add_argument('--model', default='BAAI/bge-m3')
    ap.add_argument('--reranker', default='BAAI/bge-reranker-v2-m3')
    ap.add_argument('--rerank', action='store_true')
    ap.add_argument('--k', type=int, default=5, help='지표 산출 상위 k')
    ap.add_argument('--fetch', type=int, default=30, help='1차 검색 개수')
    ap.add_argument('--data-dir', default=None)
    args = ap.parse_args()

    data_dir = Path(args.data_dir).expanduser() if args.data_dir else DEF_DATA
    if not data_dir.is_absolute():
        data_dir = (Path.cwd() / data_dir).resolve()
    INDEX_DIR = data_dir / 'index'
    EVAL = data_dir / 'eval.jsonl'

    if not EVAL.exists():
        raise SystemExit(f'{EVAL} 없음')
    qs = [json.loads(l) for l in EVAL.read_text(encoding='utf-8').splitlines() if l.strip()]
    scored = [q for q in qs if q.get('gold')]

    if not scored:
        print('  ⚠ gold 가 비어 있어 점수를 낼 수 없다.')
        print('     data/eval.jsonl 의 각 질문에 정답 문서 id 를 채워야 한다.')
        print('     아래는 검색 결과만 출력한다. 이것을 보고 gold 를 매기면 된다.\n')

    import chromadb
    from sentence_transformers import SentenceTransformer

    cli = chromadb.PersistentClient(path=str(INDEX_DIR))
    try:
        col = cli.get_collection(args.strategy)
    except Exception:
        raise SystemExit(f"컬렉션 '{args.strategy}' 없음 — 02_index.py 를 먼저 실행하세요")

    emb = SentenceTransformer(args.model)
    rr = None
    if args.rerank:
        from FlagEmbedding import FlagReranker
        rr = FlagReranker(args.reranker, use_fp16=True)

    rows = []
    for q in qs:
        v = emb.encode([q['q']], normalize_embeddings=True)[0].tolist()
        res = col.query(query_embeddings=[v], n_results=args.fetch)
        ids, docs = res['ids'][0], res['documents'][0]

        base = dedup_docs(ids)
        after = base
        if rr:
            # 리랭커는 질문과 본문을 함께 보고 다시 점수를 매긴다.
            # 1차 검색이 놓친 것은 못 살리므로 fetch 를 넉넉히 준다.
            s = rr.compute_score([[q['q'], d] for d in docs], normalize=True)
            order = np.argsort(s)[::-1]
            after = dedup_docs([ids[i] for i in order])

        rows.append({'q': q['q'], 'gold': q.get('gold', []),
                     'base': base, 'after': after})

    # ── 점수 없는 경우: 검색 결과만 보여준다 ──
    if not scored:
        for r in rows[:5]:
            print(f"  Q  {r['q']}")
            print(f"     {' · '.join(r['after'][:5])}\n")
        return

    def agg(key):
        R = [recall_at_k(r[key], r['gold'], args.k) for r in rows if r['gold']]
        M = [mrr(r[key], r['gold']) for r in rows if r['gold']]
        N = [ndcg_at_k(r[key], r['gold'], args.k) for r in rows if r['gold']]
        return np.nanmean(R), np.nanmean(M), np.nanmean(N)

    print(f'  전략 {args.strategy} · 모델 {args.model} · 평가 {len(scored)}문항\n')
    print(f"  {'':<10}{'Recall@'+str(args.k):>12}{'MRR':>10}{'nDCG@'+str(args.k):>12}")
    print('  ' + '─' * 44)
    b = agg('base')
    print(f"  {'검색만':<10}{b[0]:>12.4f}{b[1]:>10.4f}{b[2]:>12.4f}")
    if rr:
        a = agg('after')
        print(f"  {'+리랭커':<10}{a[0]:>12.4f}{a[1]:>10.4f}{a[2]:>12.4f}")
        d = [(a[i] - b[i]) / b[i] * 100 if b[i] else np.nan for i in range(3)]
        print(f"  {'개선':<10}{d[0]:>11.1f}%{d[1]:>9.1f}%{d[2]:>11.1f}%")

    # ── 못 맞힌 질문 = 다음 개선의 실마리 ──
    miss = [r for r in rows if r['gold'] and not (set(r['after'][:args.k]) & set(r['gold']))]
    if miss:
        print(f"\n  상위 {args.k} 안에 정답이 없는 질문 {len(miss)}개")
        for r in miss:
            print(f"    Q      {r['q']}")
            print(f"    정답   {', '.join(r['gold'])}")
            print(f"    검색   {', '.join(r['after'][:args.k])}")
        print('\n  ※ 이 목록이 다음 개선의 출발점이다. 청킹이 문제인지,')
        print('     임베딩이 문제인지, 질문이 모호한지를 하나씩 가른다.')

    out = data_dir / f'eval_{args.strategy}{"_rerank" if rr else ""}.json'
    out.write_text(json.dumps(
        {'strategy': args.strategy, 'model': args.model, 'k': args.k,
         'rerank': bool(rr), 'n': len(scored),
         'base': dict(zip(['recall', 'mrr', 'ndcg'], map(float, b))),
         'after': dict(zip(['recall', 'mrr', 'ndcg'], map(float, agg('after')))) if rr else None,
         'rows': rows}, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f'\n  💾 {out}')


if __name__ == '__main__':
    main()