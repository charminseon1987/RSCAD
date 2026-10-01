"""
02_index.py — 청크를 임베딩해 벡터DB 에 색인

임베딩 모델은 bge-m3 를 기본으로 쓴다. 다국어이고 장문에 강해서 영어 논문과
한국어 메모를 한 색인에 섞을 수 있다. 한국어 위주라면 nlpai-lab/KURE-v1 이
검색 성능이 더 낫다는 보고가 있으므로 --model 로 바꿔 비교해 볼 것.

실행:
    python scripts/02_index.py --strategy section
    python scripts/02_index.py --strategy fixed --model nlpai-lab/KURE-v1
"""

import argparse, json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEF_DATA = ROOT / 'data'      # --data-dir 로 덮어쓸 수 있다


def main():
    ap = argparse.ArgumentParser(description='임베딩 · 색인')
    ap.add_argument('--strategy', required=True)
    ap.add_argument('--model', default='BAAI/bge-m3')
    ap.add_argument('--batch', type=int, default=8)
    ap.add_argument('--data-dir', default=None)
    args = ap.parse_args()

    data_dir = Path(args.data_dir).expanduser() if args.data_dir else DEF_DATA
    if not data_dir.is_absolute():
        data_dir = (Path.cwd() / data_dir).resolve()
    INDEX_DIR = data_dir / 'index'
    src = data_dir / 'chunks' / f'{args.strategy}.jsonl'
    if not src.exists():
        raise SystemExit(f'{src} 없음 — 01_chunk.py 를 먼저 실행하세요')

    rows = [json.loads(l) for l in src.read_text(encoding='utf-8').splitlines()]
    print(f'  청크 {len(rows)}개 · 모델 {args.model}')

    from sentence_transformers import SentenceTransformer
    import chromadb

    m = SentenceTransformer(args.model)
    # 정규화하면 코사인 유사도를 내적으로 계산할 수 있다.
    vecs = m.encode([r['text'] for r in rows], batch_size=args.batch,
                    normalize_embeddings=True, show_progress_bar=True)

    INDEX_DIR.mkdir(parents=True, exist_ok=True)
    cli = chromadb.PersistentClient(path=str(INDEX_DIR))
    name = f'{args.strategy}'
    try:
        cli.delete_collection(name)      # 재색인 시 잔여 제거
    except Exception:
        pass
    col = cli.create_collection(name, metadata={'hnsw:space': 'cosine',
                                                'model': args.model})
    col.add(ids=[r['id'] for r in rows],
            embeddings=[v.tolist() for v in vecs],
            documents=[r['text'] for r in rows],
            # page 는 인용이 '몇 쪽'을 가리키게 하는 값이다. Chroma 메타데이터는
            # None 을 받지 않으므로 모르면 0 으로 두고, 읽는 쪽이 0 을 '모름'으로 본다.
            metadatas=[{'doc': r['doc'], 'title': r['title'] or '',
                        'page': r.get('page') or 0} for r in rows])

    print(f'  💾 {INDEX_DIR} / {name}  ({col.count()}개)')


if __name__ == '__main__':
    main()