"""
research.py — 검색 에이전트

질문을 받아 논문 색인에서 근거를 찾는다. 한 번 검색하고 끝내지 않고,
결과가 부족하면 질의를 바꿔 다시 시도한다.

사람이 하던 판단을 대신한다.
    한국어로 검색 → 점수 0.52, 결과가 뭉쳐 있음
    → 영어로 바꿔보자 → 0.70, 순위가 벌어짐
    → 한 논문만 나오네 → 문서당 상한을 걸어 훑어보자

실행:
    python agent/research.py --dry
    python agent/research.py "약계통에서 GFM 의 동기화 안정도 한계를 다룬 근거를 찾아라"
    python agent/research.py --model qwen3:14b "..."

조연호 · 연세대 스마트그리드 연구실
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from core import Agent, Ollama, Registry, check_ollama  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
RAG = ROOT / 'GFM_Research' / '00_Knowledge' / 'rag'
INDEX = RAG / 'index'

# 참고문헌 절은 제목만 나열돼 키워드가 걸리지만 내용이 없다.
NOISE = ('REFERENCE', 'ACKNOWLEDG', 'BIBLIOGRAPHY')

# 유사도 해석. 한국어 질의 대 영어 본문은 절대값이 낮게 나온다.
BANDS = [(0.70, 'high'), (0.55, 'mid'), (0.45, 'low')]

reg = Registry()
_state = {'emb': None, 'col': None}


def _band(s):
    for th, label in BANDS:
        if s >= th:
            return label
    return 'none'


def _col():
    """색인만 연다. 임베딩 모델은 올리지 않는다.

    목록 조회처럼 벡터가 필요 없는 작업까지 모델을 로드하면, 모델 쪽에
    문제가 있을 때 멀쩡한 기능까지 함께 죽는다.
    """
    if _state['col'] is None:
        import chromadb
        if not INDEX.exists():
            raise RuntimeError(f'색인 폴더 없음: {INDEX}. 02_index.py 를 먼저 실행하라.')
        cli = chromadb.PersistentClient(path=str(INDEX))
        names = [getattr(c, 'name', c) for c in cli.list_collections()]
        if 'section' not in names:
            raise RuntimeError(f"컬렉션 'section' 없음. 있는 것: {names}")
        _state['col'] = cli.get_collection('section')
    return _state['col']


def _emb():
    """임베딩 모델. 검색할 때만 필요하다."""
    if _state['emb'] is None:
        try:
            from sentence_transformers import SentenceTransformer
        except Exception as e:                          # noqa: BLE001
            raise RuntimeError(
                f'임베딩 모델을 불러올 수 없다 ({type(e).__name__}: {e}). '
                '벡터 검색은 쓸 수 없으니 list_papers 로 목록만 확인하라.') from e
        _state['emb'] = SentenceTransformer('BAAI/bge-m3')
    return _state['emb']


# ══════════════════════════════════════════════
@reg.tool(
    'search',
    '논문 색인에서 질의와 가까운 대목을 찾는다.\n'
    '  본문이 영어이므로 영어 질의가 점수와 순위 모두 크게 낫다.\n'
    '  per_doc=1 을 주면 문서당 하나씩만 뽑아 어느 논문들이 관련되는지 훑는다.\n'
    '  점수 band: high(0.70+) mid(0.55+) low(0.45+) none.\n'
    '  band 가 낮고 점수가 서로 붙어 있으면 질의가 부적절하다는 뜻이다.',
    {'query': {'type': 'string', 'description': '검색 질의. 영어 권장'},
     'n': {'type': 'integer', 'description': '결과 수. 기본 5'},
     'per_doc': {'type': 'integer',
                 'description': '문서당 최대 결과 수. 0 이면 제한 없음'},
     'chars': {'type': 'integer', 'description': '본문 표시 길이. 기본 320'}},
    ['query'])
def search(query, n=5, per_doc=0, chars=320):
    query = (query or '').strip()
    if len(query) < 3:
        return {'error': '질의가 너무 짧다'}
    try:
        col, emb = _col(), _emb()
    except Exception as e:                              # noqa: BLE001
        return {'error': str(e)}

    n = max(1, min(int(n), 12))
    fetch = min(max(40, n * 40 if per_doc else 40), col.count())
    v = emb.encode([query], normalize_embeddings=True)[0].tolist()
    r = col.query(query_embeddings=[v], n_results=fetch)

    hits, count, dropped = [], {}, 0
    for cid, doc, mt, dist in zip(r['ids'][0], r['documents'][0],
                                  r['metadatas'][0], r['distances'][0]):
        title = ((mt or {}).get('title') or '')
        if any(k in title.upper() for k in NOISE):
            dropped += 1
            continue
        name = cid.split('::')[0]
        if per_doc and count.get(name, 0) >= per_doc:
            continue
        count[name] = count.get(name, 0) + 1
        s = 1 - dist
        hits.append({'doc': name, 'chunk': cid, 'section': title,
                     'score': round(s, 3), 'band': _band(s),
                     'text': doc[:chars].replace('\n', ' ')})
        if len(hits) >= n:
            break

    scores = [h['score'] for h in hits]
    spread = round(max(scores) - min(scores), 3) if len(scores) > 1 else 0.0
    return {
        'query': query, 'n': len(hits),
        'docs': list(dict.fromkeys(h['doc'] for h in hits)),
        'top_score': max(scores) if scores else None,
        'spread': spread,          # 작으면 순위에 변별력이 없다
        'refs_dropped': dropped,
        'hits': hits,
    }


@reg.tool(
    'read_chunk',
    '검색 결과의 특정 조각 전문을 읽는다. 앞부분만으로 판단이 어려울 때 쓴다.',
    {'chunk': {'type': 'string', 'description': 'search 가 돌려준 chunk 값'}},
    ['chunk'])
def read_chunk(chunk):
    try:
        col = _col()
    except Exception as e:                              # noqa: BLE001
        return {'error': str(e)}
    r = col.get(ids=[chunk])
    if not r['ids']:
        return {'error': f'{chunk} 없음'}
    mt = (r['metadatas'][0] or {})
    return {'chunk': chunk, 'doc': chunk.split('::')[0],
            'section': mt.get('title', ''), 'text': r['documents'][0]}


@reg.tool(
    'list_papers',
    '색인된 논문 목록과 각 논문의 조각 수를 돌려준다. '
    '어떤 자료가 있는지 모를 때 먼저 확인한다.',
    {}, [])
def list_papers():
    try:
        col = _col()
    except Exception as e:                              # noqa: BLE001
        return {'error': str(e)}
    # include 인수는 chromadb 버전에 따라 빈 리스트를 거부한다.
    # ids 는 항상 반환되므로 인수 없이 부르고, 실패하면 메타데이터로 대체한다.
    from collections import Counter
    try:
        got = col.get()
        ids = got.get('ids') or []
    except Exception as e:                              # noqa: BLE001
        return {'error': f'색인 조회 실패: {type(e).__name__}: {e}'}
    if not ids:
        return {'error': '색인이 비어 있다. 02_index.py 를 실행하라.'}
    c = Counter(i.split('::')[0] for i in ids)
    return {'n_papers': len(c), 'n_chunks': sum(c.values()),
            'papers': [{'doc': d, 'chunks': n} for d, n in c.most_common()]}


# ══════════════════════════════════════════════
SYSTEM = """너는 논문 검색을 수행하는 조수다. 사용자의 질문에 답하는 근거를
색인된 논문에서 찾아 제시한다.

용어 대응 (반드시 이대로 옮긴다)
  약계통        weak grid            강계통      strong grid
  단락비        short circuit ratio  전력각      power angle, delta
  동기화 안정도 synchronization stability        감쇠  damping
  가상 동기기   virtual synchronous generator, VSG
  그리드포밍    grid-forming, GFM    인버터      inverter, converter
  소신호        small-signal         고유값      eigenvalue
  참여계수      participation factor 전류 제한   current limiting
  ※ '약계통' 은 weak grid 다. 약학(pharmacology) 이 아니다.

검색 요령
  1. 자료가 무엇인지 모르면 list_papers 로 먼저 본다.
  2. 질의는 영어로 만든다. 본문이 영어라 점수와 순위가 크게 나아진다.
     사용자가 한국어로 물어도 검색어는 위 대응표대로 영어로 바꿔 넣는다.
  3. 결과를 보고 판단한다.
     · band 가 low 나 none 뿐이면 질의가 부적절하다. 다른 표현으로 다시.
     · spread 가 0.05 미만이면 순위에 변별력이 없다. 질의를 더 구체적으로.
     · 문제 상황을 찾을 때는 limit, instability, loss, degradation 같은
       단어를 넣는다. 그것이 없으면 개론 설명만 올라온다.
  4. 한 논문만 나오면 per_doc=1 로 다시 검색해 다른 논문도 훑는다.
  5. 판단이 어려우면 read_chunk 로 전문을 읽는다.

도구가 실패하면
  오류 메시지를 읽고 다른 도구나 다른 인수로 우회하라. 한 번 실패했다고
  바로 포기하지 마라. 원인을 추측해 지어내지 말고, 오류 문구를 그대로 전하라.

종료
  3~5회 검색 안에 결론을 낸다. 같은 질의를 반복하지 않는다.
  결론은 한국어로 쓰되, 근거가 된 논문명과 절 제목을 함께 밝힌다.
  찾지 못했으면 못 찾았다고 말한다. 없는 근거를 지어내지 않는다.
"""


def main():
    ap = argparse.ArgumentParser(description='검색 에이전트')
    ap.add_argument('goal', nargs='*')
    ap.add_argument('--model', default='qwen3:8b')
    ap.add_argument('--steps', type=int, default=10)
    ap.add_argument('--timeout', type=int, default=900,
                    help='LLM 응답 대기 초. CPU 추론이면 넉넉히')
    ap.add_argument('--think', action='store_true',
                    help='추론 과정 생성을 켠다. 느려지지만 판단이 나아질 수 있다')
    ap.add_argument('--dry', action='store_true')
    args = ap.parse_args()

    if args.dry:
        print(f'  도구 {len(reg.names())}개\n')
        for n in reg.names():
            t = reg.get(n)
            print(f'  {n}')
            for line in t.desc.splitlines():
                print(f'    {line}')
            for k, v in t.params.items():
                req = '*' if k in t.required else ' '
                print(f'      {req}{k:<10} {v.get("description", v.get("type"))}')
            print()
        return

    if not args.goal:
        ap.error('질문을 입력하세요')

    ok, msg = check_ollama(args.model)
    print(f'  {msg}')
    if not ok:
        sys.exit(1)

    print('  색인·임베딩 모델 로딩은 첫 검색에서 1~2분 걸립니다.')
    Agent(llm=Ollama(args.model, timeout=args.timeout, think=args.think), reg=reg, system=SYSTEM,
          max_steps=args.steps, auto_approve=True,   # 검색은 부작용이 없다
          log_dir=ROOT / 'agent' / 'logs').run(' '.join(args.goal))


if __name__ == '__main__':
    main()