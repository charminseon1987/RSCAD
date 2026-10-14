"""
02_index.py — 청크를 임베딩해 벡터DB 에 색인

임베딩 모델은 bge-m3 를 기본으로 쓴다. 다국어이고 장문에 강해서 영어 논문과
한국어 메모를 한 색인에 섞을 수 있다.

KURE 로 바꿔 보려면 — 2026-10-14 에 HF 모델카드로 확인한 것 (※ 벤치마크는 안 돌렸다)

  · KURE-v1 은 **그대로 바꿔 끼울 수 있다.** bge-m3 를 한국어 데이터로
    파인튜닝한 것이고(base_model: BAAI/bge-m3), SentenceTransformer · 1024차원 ·
    8192 토큰으로 지금 코드와 같다. --model 한 줄로 끝난다.
  · KURE-v2 는 **바꿔 끼울 수 없다.** ColBERT late-interaction 다 — 토큰마다
    128차원 벡터를 내고 MaxSim 으로 점수를 낸다(154M, base: skt/A.X-Encoder-base).
    PyLate + PLAID 색인이 필요하고, 단일 벡터를 Chroma 에 넣는 이 파이프라인
    전체를 다시 써야 한다. 모델 이름만 갈아 넣으면 돌지 않는다.
  · 교차언어는 **두 카드 모두 근거를 주지 않는다.** KURE 의 평가는
    MTEB(kor) 한국어 과제이고 ko→ko 다. 이 볼트는 말뭉치가 영어 100% ·
    질의가 한국어 100% 라 ko→en 이다. "한국어 특화니까 더 맞다"는 추론이
    그대로 적용되지 않는다 — bge-m3 는 교차언어를 명시적 목표로 학습됐다.

실행:
    python scripts/02_index.py --strategy section
    python scripts/02_index.py --strategy fixed --model nlpai-lab/KURE-v1
"""

import console_utf8  # noqa: F401 — stdout/stderr 을 UTF-8 로
import argparse, json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEF_DATA = ROOT / 'data'      # --data-dir 로 덮어쓸 수 있다


def main():
    ap = argparse.ArgumentParser(description='임베딩 · 색인')
    ap.add_argument('--strategy', required=True)
    ap.add_argument('--model', default='BAAI/bge-m3')
    ap.add_argument('--batch', type=int, default=8,
                    help='모델에 한 번에 넣는 문장 수')
    ap.add_argument('--chunk-rows', type=int, default=64,
                    help='이 수만큼 임베딩해 바로 색인에 넣는다. 줄이면 메모리를 덜 쓴다')
    ap.add_argument('--fresh', action='store_true',
                    help='남아 있는 임시 색인을 이어받지 않고 처음부터 다시 만든다')
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

    INDEX_DIR.mkdir(parents=True, exist_ok=True)
    cli = chromadb.PersistentClient(path=str(INDEX_DIR))
    name = args.strategy

    # 색인 대상 컬렉션에 **직접** 쌓는다. 이름을 맞바꾸지 않는다.
    #
    # 한때 임시 컬렉션(`section__building`)에 다 쌓고 delete_collection(name) +
    # modify(name=name) 로 교체했다. 교체 직후 두 번은 정상으로 읽혔고, 그 다음
    # 클라이언트를 열었을 때 컬렉션이 통째로 사라졌다 — chroma 1.5.9 에서 보류된
    # 삭제가 새로 이름 붙은 컬렉션에 적용된다. sqlite 의 collections 행이 없어지고
    # embeddings 1163행이 함께 날아갔다(2026-10-14). **이 방식을 쓰지 마라.**
    #
    # 대신 이어받기로 안전성을 확보한다. 중간에 죽으면 색인이 부분 상태로 남지만
    # (Check_index.py 가 수 불일치로 보여 준다) 다시 실행하면 빠진 것만 채운다.
    try:
        col = cli.get_collection(name)
    except Exception:
        col = None

    done_ids = set()
    if col is not None:
        same = (col.metadata or {}).get('model') == args.model
        if same and not args.fresh:
            done_ids = set(col.get(include=[])['ids'])
            print(f'  이어받음  색인에 이미 {len(done_ids)}개 있다 '
                  f'(처음부터 다시 하려면 --fresh)')
        else:
            why = '모델이 다르다' if not same else '--fresh'
            print(f'  기존 색인을 버린다 ({why})')
            cli.delete_collection(name)
            col = None
    if col is None:
        col = cli.create_collection(name, metadata={'hnsw:space': 'cosine',
                                                    'model': args.model})

    want_ids = {r['id'] for r in rows}
    n_total = len(rows)

    # 청크 파일에서 사라진 id 는 걷어낸다. 논문을 빼거나 청킹 설정을 바꾸면
    # 남아 있던 벡터가 검색 결과에 유령으로 섞인다.
    stale = sorted(done_ids - want_ids)
    if stale:
        col.delete(ids=stale)
        done_ids -= set(stale)
        print(f'  없어진 청크 {len(stale)}개 제거')

    todo = [r for r in rows if r['id'] not in done_ids]
    if not todo:
        print('  새로 넣을 청크가 없다.')

    # 조각마다 임베딩하고 바로 넣는다. 전부 모아 두면 벡터와 토큰화 버퍼가
    # 같이 쌓여 피크 메모리가 청크 수에 비례한다. 여기서는 모델 + 한 조각이다.
    step = max(args.batch, args.chunk_rows)
    for i in range(0, len(todo), step):
        part = todo[i:i + step]
        vecs = m.encode([r['text'] for r in part], batch_size=args.batch,
                        normalize_embeddings=True, show_progress_bar=False)
        col.add(ids=[r['id'] for r in part],
                embeddings=[v.tolist() for v in vecs],
                documents=[r['text'] for r in part],
                # page 는 인용이 '몇 쪽'을 가리키게 하는 값이다. Chroma 메타데이터는
                # None 을 받지 않으므로 모르면 0 으로 두고, 읽는 쪽이 0 을 '모름'으로 본다.
                # section 은 절 제목, paper_title 은 논문 제목이다. 하나로 묶으면
                # 절 제목이 논문 제목인 양 인용에 실린다 (예전 'title' 필드가 그랬다).
                metadatas=[{'doc': r['doc'],
                            'section': r.get('section') or '',
                            'paper_title': r.get('paper_title') or '',
                            'page': r.get('page') or 0} for r in part])
        del vecs
        print(f'    {len(done_ids) + min(i + step, len(todo)):5d}/{n_total}', flush=True)

    n = col.count()
    print(f'  💾 {INDEX_DIR} / {name}  ({n}개)')
    if n != n_total:
        raise SystemExit(f'  ⚠ 색인 {n}개 ≠ 청크 {n_total}개 — 색인이 부분 상태다. '
                         f'다시 실행하면 빠진 것만 채운다.')


if __name__ == '__main__':
    main()