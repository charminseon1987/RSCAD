"""
Server/ask.py — 내 논문에게 묻기 (근거 Q&A)

  NotebookLM 의 '소스 기반 답변'을 이 저장소 안에서 한다. 바깥 서비스에
  보내지 않는다 — 색인도 모델도 이 기기에 있다.

  흐름
    질문 → 색인(Chroma)에서 대목 검색 → 그 대목만 붙여 Ollama 에 답을 시킨다
         → 문장마다 [n] 인용 → [n] 은 cite_key + 쪽 번호 → ④ 리더가 그 쪽을 연다

  원칙(app.py·scholar.py 와 같다): 값을 날조하지 않는다.
    - 모델에게는 붙여 준 대목 **밖의 지식을 쓰지 말라**고 못박는다.
    - 대목이 질문과 멀면(유사도 하한 미달) 아예 답하지 않고 '근거 없음'을 돌려준다.
    - 답에 인용 표시가 하나도 없으면 grounded=false 로 표시해 화면이 경고한다.
    - 이 답은 AI 생성물이다. 노트에는 ※ 로만 들어가고 ▸(원문 근거)로 올리지 않는다.

  검색만 쓰는 길(/ask/search)은 Ollama 없이도 동작한다. 모델을 못 띄우는
  상황에서도 "어느 논문 몇 쪽을 보라"까지는 답할 수 있어야 하기 때문이다.
"""

from __future__ import annotations

import os
import re
import threading

import requests
from flask import Blueprint, jsonify, request

from scholar import VAULT, find_item, load_inbox, safe_vault_path

bp = Blueprint('scholar_ask', __name__, url_prefix='/api/scholar/ask')

RAG_DIR = VAULT / '00_Knowledge' / 'rag'
INDEX_DIR = RAG_DIR / 'index'

EMBED_MODEL = os.environ.get('GFM_EMBED_MODEL', 'BAAI/bge-m3')
STRATEGY = os.environ.get('GFM_RAG_STRATEGY', 'section')

OLLAMA_CHAT = 'http://localhost:11434/api/chat'
OLLAMA_TAGS = 'http://localhost:11434/api/tags'
# agent/core.py 와 같은 기본값·같은 환경변수를 쓴다 — 모델을 두 곳에서 정하지 않는다
LLM_MODEL = os.environ.get('GFM_AGENT_MODEL', 'qwen3:4b')

# 유사도 하한. 이보다 아래면 '찾지 못했다'고 말한다 — 엉뚱한 대목으로 답을
# 지어내는 것보다 낫다.
#
# 추측이 아니라 이 색인에서 재서 정했다 (2026-10-01, bge-m3 / section):
#     주제 안  GFM 과전류 제한 0.6773 · VSM-droop 등가 0.6847 · LCL 공진 0.4992
#     주제 밖  대동법 0.3613 · 김치찌개 0.3670 · 웹 프론트엔드 언어 0.4311
# 0.45 가 둘을 가른다. Scripts/search.py 의 BANDS 가 '약함'으로 보는 선과 같다.
# 표본이 6개뿐이라 경계가 넉넉하지 않다 — 그래서 화면에 유사도를 그대로 띄워
# 사람이 직접 판단할 수 있게 둔다.
MIN_SIM = float(os.environ.get('GFM_ASK_MIN_SIM', '0.45'))

# 한 대목에서 모델에 넣을 최대 글자. 로컬 CPU 모델은 프롬프트가 길수록 느려진다.
PASSAGE_CHARS = int(os.environ.get('GFM_ASK_PASSAGE_CHARS', '700'))

ANSWER_NOTE_HEAD = '## 💬 근거 Q&A (AI 생성 — 인용 금지)'

# 이 섹션의 끝. 질문은 섹션 안에 ### 로 쌓이므로, 그보다 얕은 제목만 경계로 본다.
# scholar.put_section 은 여기 쓸 수 없다 — 그쪽 SEC_RE 는 # ~ ###### 를 모두
# 경계로 보아 먼저 쌓인 질문부터 '다음 섹션'으로 떼어 낸다. 그걸 다시 앞에 붙이면
# 같은 질문이 두 번 들어간다 (실제로 그렇게 났다).
NEXT_TOP = re.compile(r'^#{1,2} ', re.M)


def append_in_section(text: str, head: str, block: str) -> str:
    """head 섹션 **끝에** block 을 덧붙인다.

    질문이 하나씩 쌓여야 하므로 통째 교체가 아니다. 섹션 밖(앞뒤 다른 섹션)은
    글자 하나도 건드리지 않는다.
    """
    i = text.find(head)
    if i < 0:
        return text.rstrip() + f'\n\n{head}\n\n{block.rstrip()}\n'
    j = i + len(head)
    m = NEXT_TOP.search(text, j)
    end = m.start() if m else len(text)
    inside = text[j:end].rstrip()
    tail = text[end:]
    return text[:j] + inside + '\n\n' + block.rstrip() + '\n\n' + tail


# ═══════════════════════════════════════════════
# 색인 — 무겁다. 처음 물어볼 때 한 번만 올린다
#   모듈을 읽을 때 올리면 Flask 가 뜨는 데 몇 분이 걸리고, Q&A 를 쓰지 않는
#   사람도 2 GB 를 물게 된다.
# ═══════════════════════════════════════════════
#   색인(chromadb)과 임베딩 모델(sentence-transformers)은 무게가 다르다.
#   색인 열기는 1초, 모델 올리기는 1~2분에 2 GB다. 상태 표시가 모델까지
#   올리면 ④를 열 때마다 화면이 멈춘다 — 그래서 따로 올린다.
_lock = threading.Lock()
_emb_lock = threading.Lock()
_state: dict = {'col': None, 'error': ''}
_emb: dict = {'model': None, 'error': '', 'loading': False}


def _index():
    """색인만 연다. 가볍다 — 상태 표시에서 불러도 된다."""
    if _state['col'] is not None or _state['error']:
        return _state
    with _lock:
        if _state['col'] is not None or _state['error']:
            return _state
        if not INDEX_DIR.exists():
            _state['error'] = (f'색인이 없습니다 ({INDEX_DIR.relative_to(VAULT.parent)}) — '
                               'Scripts/01_chunk.py → 02_index.py 를 먼저 돌리세요')
            return _state
        try:
            import chromadb
            cli = chromadb.PersistentClient(path=str(INDEX_DIR))
            _state['col'] = cli.get_collection(STRATEGY)
        except Exception as e:                               # noqa: BLE001
            _state['error'] = f'{type(e).__name__}: {e}'[:300]
    return _state


def _embedder():
    """임베딩 모델을 올린다. 느리다 — 실제로 검색할 때만 부른다."""
    if _emb['model'] is not None or _emb['error']:
        return _emb
    with _emb_lock:
        if _emb['model'] is not None or _emb['error']:
            return _emb
        _emb['loading'] = True
        try:
            from sentence_transformers import SentenceTransformer
            _emb['model'] = SentenceTransformer(EMBED_MODEL)
        except Exception as e:                               # noqa: BLE001
            _emb['error'] = f'{type(e).__name__}: {e}'[:300]
        finally:
            _emb['loading'] = False
    return _emb


def _docs_in_index(col) -> list:
    """색인에 들어 있는 문서와 청크 수. 무엇을 근거로 답하는지 밝히기 위함이다."""
    try:
        got = col.get(include=['metadatas'])
    except Exception:                                        # noqa: BLE001
        return []
    tally: dict = {}
    for m in got.get('metadatas') or []:
        d = (m or {}).get('doc') or '?'
        t = tally.setdefault(d, {'doc': d, 'chunks': 0, 'pages': 0})
        t['chunks'] += 1
        t['pages'] = max(t['pages'], int((m or {}).get('page') or 0))
    return sorted(tally.values(), key=lambda x: -x['chunks'])


def ollama_up() -> dict:
    try:
        r = requests.get(OLLAMA_TAGS, timeout=3)
        if r.status_code != 200:
            return {'ok': False, 'msg': f'Ollama 응답 {r.status_code}'}
        names = [m['name'] for m in r.json().get('models', [])]
        base = LLM_MODEL.split(':')[0]
        have = LLM_MODEL in names or any(n.split(':')[0] == base for n in names)
        return {'ok': have, 'models': names, 'model': LLM_MODEL,
                'msg': '' if have else f'{LLM_MODEL} 가 없습니다 — `ollama pull {LLM_MODEL}`'}
    except requests.RequestException:
        return {'ok': False, 'models': [], 'model': LLM_MODEL,
                'msg': 'Ollama 가 꺼져 있습니다 — 터미널에서 `ollama serve`'}


@bp.route('/status')
def api_status():
    """색인·모델 상태. 무엇으로 답하는지 먼저 보여 준다."""
    st = _index()
    col = st['col']
    out = {'status': 'ok', 'index_dir': str(INDEX_DIR.relative_to(VAULT.parent)),
           'strategy': STRATEGY, 'embed_model': EMBED_MODEL,
           'error': st['error'], 'chunks': 0, 'docs': [],
           'ollama': ollama_up(), 'min_sim': MIN_SIM,
           # 모델은 여기서 올리지 않는다. 첫 질문이 느린 이유를 화면이 미리 말해 준다
           'embed_ready': _emb['model'] is not None,
           'embed_error': _emb['error']}
    if col is not None:
        out['chunks'] = col.count()
        out['docs'] = _docs_in_index(col)
    return jsonify(out)


# ═══════════════════════════════════════════════
# 검색 — Ollama 없이도 쓸 수 있는 길
# ═══════════════════════════════════════════════
def retrieve(q: str, n: int, docs: list = None) -> tuple:
    """질문에 가까운 대목을 찾는다. (대목 목록, 오류) 를 돌려준다."""
    st = _index()
    if st['error']:
        return [], st['error']
    e = _embedder()
    if e['error']:
        return [], f"임베딩 모델을 올리지 못했습니다 — {e['error']}"
    col = st['col']
    v = e['model'].encode([q], normalize_embeddings=True)[0].tolist()
    # 걸러낼 것을 감안해 넉넉히 받는다
    kw = {'query_embeddings': [v], 'n_results': max(n * 4, 20)}
    if docs:
        kw['where'] = {'doc': {'$in': list(docs)}} if len(docs) > 1 else {'doc': docs[0]}
    try:
        r = col.query(**kw)
    except Exception as e:                                   # noqa: BLE001
        return [], f'{type(e).__name__}: {e}'[:200]

    out = []
    for cid, text, meta, dist in zip(r['ids'][0], r['documents'][0],
                                     r['metadatas'][0], r['distances'][0]):
        sim = round(1 - dist, 4)
        page = int((meta or {}).get('page') or 0)
        out.append({'id': cid, 'doc': (meta or {}).get('doc') or '',
                    'title': (meta or {}).get('title') or '',
                    'page': page or None,          # 0 은 '모름'이다
                    'sim': sim, 'text': text})
    out.sort(key=lambda x: -x['sim'])
    return out[:n], ''


@bp.route('/search', methods=['POST'])
def api_search():
    """검색만 — 모델 없이 '어느 논문 몇 쪽을 보라'까지는 답한다."""
    d = request.json or {}
    q = (d.get('q') or '').strip()
    if len(q) < 2:
        return jsonify({'status': 'error', 'error': '두 글자 이상 입력하세요'}), 400
    hits, err = retrieve(q, int(d.get('n') or 6), d.get('docs'))
    if err:
        return jsonify({'status': 'error', 'error': err}), 503
    weak = [h for h in hits if h['sim'] < MIN_SIM]
    return jsonify({'status': 'ok', 'q': q, 'hits': hits,
                    'enough': any(h['sim'] >= MIN_SIM for h in hits),
                    'note': (f'유사도 {MIN_SIM} 미만 {len(weak)}건 — 질문과 먼 대목일 수 있습니다'
                             if weak else '')})


# ═══════════════════════════════════════════════
# 답변 — 붙여 준 대목만 쓰게 한다
# ═══════════════════════════════════════════════
SYSTEM = """당신은 연구 노트 보조입니다. 아래 '발췌' 안에 있는 내용만으로 답합니다.

규칙:
1. 발췌에 없는 내용은 절대 쓰지 않습니다. 배경지식으로 보충하지 않습니다.
2. 모든 문장 끝에 근거 번호를 [1] 처럼 답니다. 여러 개면 [1][3].
3. 발췌만으로 답할 수 없으면 "발췌에서 확인되지 않습니다" 라고만 씁니다.
   추측해서 채우지 않습니다.
4. 수치·단위·조건은 발췌에 적힌 그대로 옮깁니다. 반올림하거나 바꾸지 않습니다.
5. 한국어로, 군더더기 없이 2~4문장으로 씁니다.
6. 생각 과정·영어 설명·머리말을 쓰지 않습니다. 첫 글자부터 바로 답입니다."""

# 답을 미리 시작시켜 둔다. qwen3 는 생각하는 모델이라 가만두면 "Okay, let's tackle
# this question..." 으로 시작해 영어로 몇 분을 혼자 따진다. 이 기기에서 쟀을 때
# 900토큰을 다 쓰고도 끝내 답을 못 냈다. Ollama 0.35 의 think=False 도, qwen3 의
# /no_think 스위치도 듣지 않았다 — thinking 필드조차 오지 않는다.
# 어시스턴트 턴을 이 말로 시작해 두면 그 서두를 건너뛴다 (13~18초, 답은 정확).
PREFILL = '발췌에 따르면'

# 그래도 서두가 새어 나오면 거기서 끊는다. 단, 이것만으로는 안 된다 —
# 프리필 없이 stop 만 두면 첫 단어가 바로 걸려 빈 답이 나온다.
STOP = ['Okay,', 'Let me', 'Wait,', 'First,', 'The user', 'Hmm']


def build_prompt(q: str, hits: list) -> str:
    blocks = []
    for i, h in enumerate(hits, 1):
        where = f"{h['doc']}" + (f" p.{h['page']}" if h['page'] else '')
        sec = f" · {h['title']}" if h['title'] else ''
        blocks.append(f'[{i}] ({where}{sec})\n{h["text"][:PASSAGE_CHARS]}')
    return f'발췌:\n\n' + '\n\n'.join(blocks) + f'\n\n질문: {q}'


CITE_RE = re.compile(r'\[(\d{1,2})\]')
THINK_RE = re.compile(r'<think>.*?</think>\s*', re.S)


def ask_llm(q: str, hits: list, timeout: int = 300) -> dict:
    # think=False — qwen3 계열은 기본으로 긴 <think> 를 쓴다. 이 기기에서 초당
    # 3토큰쯤 나오므로 그 과정만으로 몇 분이 간다. 답에 쓰이지 않는 글자다.
    # num_predict — 끝없이 쓰는 것을 막는다. 3~6문장이면 충분하다.
    body = {'model': LLM_MODEL, 'stream': False, 'think': False,
            'messages': [{'role': 'system', 'content': SYSTEM},
                         {'role': 'user', 'content': build_prompt(q, hits)},
                         {'role': 'assistant', 'content': PREFILL}],
            'options': {'temperature': 0.1, 'num_predict': 600, 'stop': STOP}}
    try:
        r = requests.post(OLLAMA_CHAT, json=body, timeout=timeout)
    except requests.Timeout:
        return {'ok': False, 'error': f'{timeout}초 안에 답이 오지 않았습니다 — '
                                      f'{LLM_MODEL} 는 이 기기에서 초당 3토큰쯤입니다. '
                                      '질문을 짧게 하거나 ‘검색만’ 을 쓰세요'}
    except requests.RequestException as e:
        return {'ok': False, 'error': f'Ollama 호출 실패 ({type(e).__name__}) — '
                                      '`ollama serve` 가 떠 있는지 확인하세요'}
    if r.status_code != 200:
        return {'ok': False, 'error': f'Ollama 응답 {r.status_code}: {r.text[:200]}'}
    j = r.json()
    # 프리필은 모델이 '이미 쓴' 말이라 응답에 포함되지 않는다 — 앞에 되붙인다
    text = (PREFILL + ((j.get('message') or {}).get('content') or '')).strip()
    # <think> 태그를 쓰는 빌드도 있다 — 있으면 떼어낸다
    text = THINK_RE.sub('', text).strip()
    used = sorted({int(n) for n in CITE_RE.findall(text) if 1 <= int(n) <= len(hits)})
    # 길이 제한에 걸려 문장 가운데서 끊긴 답은 끊겼다고 말한다. 잘린 문장이
    # 완결된 주장처럼 읽히면 안 된다.
    cut = j.get('done_reason') == 'length'
    return {'ok': True, 'answer': text, 'used': used,
            'grounded': bool(used),          # 인용이 하나도 없으면 근거 없는 답이다
            'truncated': cut}


@bp.route('', methods=['POST'])
@bp.route('/', methods=['POST'])
def api_ask():
    """질문 → 대목 검색 → 그 대목만으로 답. 근거가 약하면 답하지 않는다."""
    d = request.json or {}
    q = (d.get('q') or '').strip()
    if len(q) < 2:
        return jsonify({'status': 'error', 'error': '두 글자 이상 입력하세요'}), 400

    hits, err = retrieve(q, int(d.get('n') or 4), d.get('docs'))
    if err:
        return jsonify({'status': 'error', 'error': err}), 503

    strong = [h for h in hits if h['sim'] >= MIN_SIM]
    if not strong:
        best = hits[0]['sim'] if hits else 0
        return jsonify({'status': 'ok', 'q': q, 'hits': hits, 'answer': '',
                        'grounded': False, 'enough': False,
                        'error': f'색인에서 질문에 가까운 대목을 찾지 못했습니다 '
                                 f'(최고 유사도 {best} < {MIN_SIM}). '
                                 f'답을 지어내지 않습니다 — 질문을 바꾸거나 논문을 더 색인하세요'})

    res = ask_llm(q, strong, timeout=int(d.get('timeout') or 300))
    if not res['ok']:
        # 모델이 없어도 검색 결과는 돌려준다 — 어느 쪽을 볼지는 알 수 있다
        return jsonify({'status': 'ok', 'q': q, 'hits': strong, 'answer': '',
                        'grounded': False, 'enough': True, 'error': res['error']})
    notes = []
    if not res['grounded']:
        notes.append('답에 근거 번호가 없습니다 — 발췌 밖의 말일 수 있으니 그대로 쓰지 마세요')
    if res['truncated']:
        notes.append('길이 제한에 걸려 마지막 문장이 끊겼습니다 — 끊긴 문장은 그대로 쓰지 마세요')
    return jsonify({'status': 'ok', 'q': q, 'hits': strong, 'answer': res['answer'],
                    'used': res['used'], 'grounded': res['grounded'], 'enough': True,
                    'truncated': res['truncated'], 'model': LLM_MODEL,
                    'note': ' · '.join(notes)})


# ═══════════════════════════════════════════════
# 노트에 남기기 — ※ 로만
# ═══════════════════════════════════════════════
@bp.route('/to-note', methods=['POST'])
def api_to_note():
    """답과 근거를 노트에 ※ 로 적는다. ▸(원문 근거)로 올리지 않는다."""
    d = request.json or {}
    items = load_inbox()
    it = find_item(items, d.get('key'))
    if not it:
        return jsonify({'status': 'error', 'error': '수집함에 없습니다'}), 404
    if not it.get('note_path'):
        return jsonify({'status': 'error', 'error': '먼저 ⑤에서 노트를 저장하세요'}), 400
    q = (d.get('q') or '').strip()
    answer = (d.get('answer') or '').strip()
    if not q or not answer:
        return jsonify({'status': 'error', 'error': '질문과 답이 모두 필요합니다'}), 400

    lines = [f'### {q}', '',
             '※ 아래는 내 논문 색인에서 뽑은 대목으로 **AI 가 쓴 답**입니다. '
             '원문을 직접 확인하기 전에는 인용 근거(▸)로 쓰지 않습니다.', '']
    lines += [f'※ {ln}' if ln.strip() else '' for ln in answer.splitlines()]
    hits = d.get('hits') or []
    if hits:
        lines += ['', '근거로 쓰인 대목:']
        for i, h in enumerate(hits, 1):
            where = h.get('doc') or '?'
            pg = f" p.{h['page']}" if h.get('page') else ''
            anchor = f' → [[{where}.pdf#page={h["page"]}]]' if h.get('page') else ''
            lines.append(f'- [{i}] {where}{pg} (유사도 {h.get("sim")}){anchor}')

    try:
        fp = safe_vault_path(it['note_path'])
    except ValueError:
        return jsonify({'status': 'error', 'error': '볼트 밖 경로'}), 403
    if not fp.is_file():
        return jsonify({'status': 'error', 'error': f'노트가 없습니다: {it["note_path"]}'}), 404

    before = fp.read_text(encoding='utf-8')
    # 기존 Q&A 섹션 끝에 덧붙인다 — 질문마다 쌓여야 하므로 통째 교체가 아니다
    after = append_in_section(before, ANSWER_NOTE_HEAD, '\n'.join(lines))
    if after != before:
        fp.write_text(after, encoding='utf-8')
    return jsonify({'status': 'ok', 'path': it['note_path'],
                    'changed': after != before, 'section': ANSWER_NOTE_HEAD})
