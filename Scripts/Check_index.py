"""색인 상태와 검색 동작을 직접 확인한다."""
import sys
from pathlib import Path

RAG = Path(sys.argv[1] if len(sys.argv) > 1 else 'GFM_Research/00_Knowledge/rag')
IDX = RAG / 'index'

import chromadb
cli = chromadb.PersistentClient(path=str(IDX))

cols = cli.list_collections()
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