"""색인 상태와 검색 동작을 직접 확인한다.

사용:
    python Scripts/Check_index.py
    python Scripts/Check_index.py GFM_Research/00_Knowledge/rag
    python Scripts/Check_index.py --data-dir GFM_Research/00_Knowledge/rag

--data-dir 를 받는 이유 — 01·02·03 이 전부 --data-dir 를 쓴다. 예전에는 경로를
sys.argv[1] 로만 받아서, 같은 습관으로 --data-dir 를 붙이면 문자열 '--data-dir' 이
그대로 경로가 됐다. chromadb 는 없는 경로에 **빈 DB 를 새로 만들기 때문에** 에러 없이
'컬렉션: []' 가 찍혔고, 멀쩡한 색인이 날아간 줄 알았다. 실제로 저장소 루트에
./--data-dir/index/chroma.sqlite3 (컬렉션 0 · 임베딩 0) 가 만들어져 있었다.
"""
import console_utf8  # noqa: F401 — stdout/stderr 을 UTF-8 로
import argparse
import sys
from pathlib import Path

_ap = argparse.ArgumentParser(description='색인 상태 확인')
_ap.add_argument('data_dir', nargs='?', default='GFM_Research/00_Knowledge/rag',
                 help='rag 폴더 (index/ 의 부모)')
_ap.add_argument('--data-dir', dest='data_dir_opt', default=None,
                 help='위치 인자 대신 쓸 수 있다')
_args = _ap.parse_args()

RAG = Path(_args.data_dir_opt or _args.data_dir)
IDX = RAG / 'index'

# 없는 경로를 그대로 열면 chromadb 가 빈 DB 를 만들어 버린다. 그러면 '색인이 비었다' 와
# '경로를 잘못 줬다' 가 화면에서 똑같아 보인다 — 여기서 갈라 둔다.
if not IDX.is_dir():
    print(f'⚠ 색인 폴더가 없다: {IDX.resolve()}')
    print('  경로를 잘못 줬을 가능성이 높다. 빈 DB 를 만들지 않고 멈춘다.')
    sys.exit(2)

import chromadb
cli = chromadb.PersistentClient(path=str(IDX))

cols = cli.list_collections()
print(f'색인   {IDX.resolve()}')
print('컬렉션:', [getattr(c, 'name', c) for c in cols])
if not cols:
    print('⚠ 비어 있다. 02_index.py 를 다시 실행할 것.')
    sys.exit(1)

for c in cols:
    name = getattr(c, 'name', c)
    col = cli.get_collection(name)
    print(f'  {name}: {col.count()}개')

name = 'section' if any(getattr(c,'name',c)=='section' for c in cols) else getattr(cols[0],'name',cols[0])
col = cli.get_collection(name)

print(f'\n검색 시험 — 컬렉션 {name}')
from sentence_transformers import SentenceTransformer
m = SentenceTransformer('BAAI/bge-m3')
q = '약계통에서 가상 동기기 제어의 동기화 안정도 한계'
v = m.encode([q], normalize_embeddings=True)[0].tolist()
r = col.query(query_embeddings=[v], n_results=10)

seen = []
for cid, dist in zip(r['ids'][0], r['distances'][0]):
    doc = cid.split('::')[0]
    if doc not in seen:
        seen.append(doc)
        print(f'  {1-dist:.3f}  {doc}')
print('\n상위 문서:', ' · '.join(seen[:5]))