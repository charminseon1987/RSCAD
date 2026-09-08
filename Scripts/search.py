"""
search.py — 논문 검색

색인된 청크에서 질문에 맞는 대목을 찾아 본문과 함께 보여준다.
평가셋의 gold 를 매길 때, 그리고 논문 쓰다 근거를 찾을 때 쓴다.

실행:
    python Scripts/search.py "약계통에서 가상 동기기의 동기화 안정도"
    python Scripts/search.py "PSO 파라미터 최적화" -n 8 --full
    python Scripts/search.py "LCL 공진 감쇠" --per-doc 1     # 문서당 1개만
    python Scripts/search.py "동기화계수" --rerank            # 재순위화
    python Scripts/search.py                                  # 대화형

첫 실행은 모델 로딩에 1~2분 걸린다. 대화형 모드로 여러 질문을 던지면
모델을 한 번만 올리므로 훨씬 빠르다.

조연호 · 연세대 스마트그리드 연구실
"""

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEF_RAG = ROOT / 'GFM_Research' / '00_Knowledge' / 'rag'

# 유사도 해석 기준. 한국어 질문 대 영어 본문은 절대값이 낮게 나오므로
# 점수보다 순위와 본문 내용으로 판단하는 편이 낫다.
BANDS = [(0.70, '높음'), (0.55, '보통'), (0.45, '약함')]


def band(s):
    for th, label in BANDS:
        if s >= th:
            return label
    return '무관?'


def main():
    ap = argparse.ArgumentParser(description='논문 검색')
    ap.add_argument('query', nargs='*', help='검색할 질문 (생략 시 대화형)')
    ap.add_argument('-n', type=int, default=5, help='보여줄 결과 수')
    ap.add_argument('--per-doc', type=int, default=0,
                    help='문서당 최대 결과 수 (0 = 제한 없음). '
                         '한 논문이 상위를 독점할 때 다양성을 확보한다')
    ap.add_argument('--chars', type=int, default=300, help='본문 표시 길이')
    ap.add_argument('--full', action='store_true', help='본문 전체 표시')
    ap.add_argument('--rerank', action='store_true', help='재순위화 적용')
    ap.add_argument('--strategy', default='section')
    ap.add_argument('--model', default='BAAI/bge-m3')
    ap.add_argument('--reranker', default='BAAI/bge-reranker-v2-m3')
    ap.add_argument('--data-dir', default=None)
    ap.add_argument('--fetch', type=int, default=40, help='1차 검색 개수')
    args = ap.parse_args()

    rag = Path(args.data_dir).expanduser() if args.data_dir else DEF_RAG
    if not rag.is_absolute():
        rag = (Path.cwd() / rag).resolve()
    idx = rag / 'index'
    if not idx.exists():
        raise SystemExit(f'{idx} 없음 — 02_index.py 를 먼저 실행하세요')

    import chromadb
    from sentence_transformers import SentenceTransformer

    cli = chromadb.PersistentClient(path=str(idx))
    try:
        col = cli.get_collection(args.strategy)
    except Exception:
        have = [getattr(c, 'name', c) for c in cli.list_collections()]
        raise SystemExit(f"컬렉션 '{args.strategy}' 없음. 있는 것: {have}")

    print(f'  색인 {col.count()}개 · 모델 로딩 중…', flush=True)
    emb = SentenceTransformer(args.model)
    rr = None
    if args.rerank:
        from FlagEmbedding import FlagReranker
        rr = FlagReranker(args.reranker, use_fp16=True)

    def run(q):
        v = emb.encode([q], normalize_embeddings=True)[0].tolist()
        r = col.query(query_embeddings=[v], n_results=args.fetch)
        ids, docs, metas = r['ids'][0], r['documents'][0], r['metadatas'][0]
        sims = [1 - d for d in r['distances'][0]]

        if rr:
            # 질문과 본문을 함께 보고 다시 점수를 매긴다.
            s = rr.compute_score([[q, d] for d in docs], normalize=True)
            order = sorted(range(len(docs)), key=lambda i: -s[i])
            ids = [ids[i] for i in order]
            docs = [docs[i] for i in order]
            metas = [metas[i] for i in order]
            sims = [s[i] for i in order]

        # 문서당 상한. 청크가 많은 논문이 상위를 독점하는 것을 막는다.
        picked, count = [], {}
        for cid, d, mt, s in zip(ids, docs, metas, sims):
            doc = cid.split('::')[0]
            if args.per_doc and count.get(doc, 0) >= args.per_doc:
                continue
            count[doc] = count.get(doc, 0) + 1
            picked.append((cid, d, mt, s, doc))
            if len(picked) >= args.n:
                break

        print(f'\n  질문  {q}')
        print('  ' + '─' * 74)
        for cid, d, mt, s, doc in picked:
            title = (mt or {}).get('title') or ''
            print(f'\n  [{s:.3f} {band(s):>4}]  {cid}')
            if title:
                print(f'     {title}')
            body = d if args.full else d[:args.chars].replace('\n', ' ')
            for i in range(0, len(body), 88):
                print(f'     {body[i:i+88]}')
            if not args.full and len(d) > args.chars:
                print('     …')

        uniq = list(dict.fromkeys(p[4] for p in picked))
        print(f'\n  문서  {" · ".join(uniq)}')
        print(f'  gold  {list(uniq[:2])}'.replace("'", '"'))

    if args.query:
        run(' '.join(args.query))
        return

    print('  질문을 입력하세요. 빈 줄이면 종료.')
    while True:
        try:
            q = input('\n> ').strip()
        except (EOFError, KeyboardInterrupt):
            break
        if not q:
            break
        run(q)


if __name__ == '__main__':
    main()