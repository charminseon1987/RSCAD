"""
Server/indexer.py — 보관한 PDF 를 색인에 넣는다 (화면에서)

  여기까지 길이 없어서 앱 전체가 막혀 있었다. 수집함에 담은 논문과 색인된
  논문이 겹치지 않으면 소스를 다 골라도 '색인된 것 0' 이라 대화도 산출물도
  잠긴다. 재색인은 터미널에서 19분짜리 명령이었고, 그 방법이 화면 어디에도
  없었다.

  그래서 두 가지를 바꾼다.
    ① 증분   이미 색인된 논문은 건드리지 않고 새 PDF 만 넣는다. 한 편에 1~3분.
    ② 진행률 배경에서 돌리고 /status 로 어디까지 갔는지 보여 준다.

  청킹은 Scripts/01_chunk.py 를 그대로 가져다 쓴다 — 쪽 번호를 되찾는 부분
  (norm_map·locate·page_of)이 이미 실물 PDF 로 검증돼 있다. 여기서 다시 짜면
  두 경로가 갈라져 노트의 #page 앵커가 어긋난다.

  원칙(app.py·scholar.py·ask.py 와 같다): 값을 날조하지 않는다.
    - 글자가 추출되지 않는 스캔본은 **건너뛰었다고 말한다**. 조용히 빠지면
      왜 답이 안 나오는지 알 길이 없다 (PV_GFM_Control_Playbook.pdf 가 그렇다).
    - 쪽을 못 찾은 청크는 page=0(모름)으로 둔다. 아무 쪽이나 적지 않는다.
"""

from __future__ import annotations

import json
import sys
import threading
import traceback

from flask import Blueprint, jsonify, request

import ask
from scholar import ROOT, VAULT, load_settings, safe_vault_path

bp = Blueprint('indexer', __name__, url_prefix='/api/index')

CHUNKS_PATH = ask.RAG_DIR / 'chunks' / f'{ask.STRATEGY}.jsonl'
# 넣을 수 없다고 판명된 원문. 여기 남겨 두지 않으면 대기 목록에 영원히 남아
# '색인에 넣으세요' 를 계속 권하게 된다 — 눌러도 똑같이 실패한다.
SKIP_PATH = ROOT / 'Server' / 'index_skipped.json'

# 01_chunk.py 의 기본값과 같게 둔다 — 같은 전략으로 잘라야 섞이지 않는다
MAX_CHUNK = 1600
MIN_CHUNK = 200
SIZE = 900
OVERLAP = 150

_lock = threading.Lock()
_job: dict = {
    'running': False, 'done': 0, 'total': 0, 'doc': '',
    'added': [], 'skipped': [], 'error': '', 'at': '',
}


def _chunker():
    """Scripts/01_chunk.py 를 모듈로 불러온다. 파일명이 숫자로 시작해 import 가 안 된다."""
    import importlib.util
    path = ROOT / 'Scripts' / '01_chunk.py'
    spec = importlib.util.spec_from_file_location('chunk01', path)
    mod = importlib.util.module_from_spec(spec)
    sys.modules['chunk01'] = mod
    spec.loader.exec_module(mod)
    return mod


def indexed_docs() -> set:
    st = ask._index()
    if st['error'] or st['col'] is None:
        return set()
    return {d['doc'] for d in ask._docs_in_index(st['col'])}


def pdf_dir():
    return safe_vault_path(load_settings()['pdf_dir'])


def load_skipped() -> dict:
    if SKIP_PATH.exists():
        try:
            return json.loads(SKIP_PATH.read_text(encoding='utf-8')).get('skipped', {})
        except Exception:                                    # noqa: BLE001
            return {}
    return {}


def remember_skip(doc: str, why: str) -> None:
    rows = load_skipped()
    rows[doc] = why
    SKIP_PATH.write_text(json.dumps({'skipped': rows}, ensure_ascii=False, indent=2),
                         encoding='utf-8')


def pending(include_skipped: bool = False) -> list:
    """색인에 넣을 수 있는 PDF 들. 이름(stem)이 색인의 doc 이 된다.

    못 넣는다고 판명된 것(스캔본 등)은 기본으로 뺀다 — 대기 목록에 남겨 두면
    눌러도 실패하는 일을 계속 권하게 된다. 다만 사라지지는 않고 'OCR 필요' 로
    따로 보여 준다.
    """
    d = pdf_dir()
    if not d.exists():
        return []
    have = indexed_docs()
    skip = set() if include_skipped else set(load_skipped())
    return [p for p in sorted(d.glob('*.pdf'))
            if p.stem not in have and p.stem not in skip]


@bp.route('/status')
def api_status():
    """지금 색인 상태와 남은 것. 화면이 이걸 폴링한다."""
    todo = [p.stem for p in pending()]
    skipped = load_skipped()
    return jsonify({'status': 'ok', 'job': _job, 'pending': todo,
                    # 넣을 수 없다고 판명된 것 — 숨기지 않고 이유와 함께 따로 둔다
                    'unusable': [{'doc': k, 'why': v} for k, v in sorted(skipped.items())],
                    'indexed': sorted(indexed_docs()),
                    'pdf_dir': load_settings()['pdf_dir']})


def _chunk_one(mod, path):
    """PDF 한 편 → 청크 목록. 01_chunk.py 의 section 전략과 같은 순서로 자른다."""
    text, bounds = mod.read_pdf(path)
    if not text.strip():
        return [], '글자가 추출되지 않습니다 (스캔본) — OCR 이 필요합니다'
    norm, idx = mod.norm_map(text)
    cursor = 0

    secs = mod.split_section(text)
    if not secs:
        parts = mod.split_fixed(text, SIZE, OVERLAP)
    else:
        parts = []
        for sec in secs:
            if len(sec['text']) <= MAX_CHUNK:
                parts.append(sec)
            else:
                for sub in mod.split_fixed(sec['text'], SIZE, OVERLAP):
                    parts.append({'title': sec['title'], 'text': sub['text']})

    rows = []
    for i, c in enumerate([x for x in parts if len(x['text']) >= MIN_CHUNK]):
        off, cursor = mod.locate(norm, idx, c['text'], cursor)
        rows.append({'id': f'{path.stem}::{i}', 'doc': path.stem,
                     'title': c['title'], 'page': mod.page_of(bounds, off),
                     'text': c['text'], 'n_char': len(c['text'])})
    if not rows:
        return [], '쓸 만한 길이의 대목이 없습니다'
    return rows, ''


def _run(targets):
    """배경 작업. 한 편씩 넣고 그때그때 진행률을 올린다."""
    try:
        mod = _chunker()
        emb = ask._embedder()
        if emb['error']:
            _job['error'] = f"임베딩 모델을 올리지 못했습니다 — {emb['error']}"
            return
        st = ask._index()
        if st['error']:
            _job['error'] = st['error']
            return
        col = st['col']

        for p in targets:
            _job['doc'] = p.stem
            rows, why = _chunk_one(mod, p)
            if why:
                _job['skipped'].append({'doc': p.stem, 'why': why})
                remember_skip(p.stem, why)       # 다음부터 권하지 않는다
                _job['done'] += 1
                continue
            vecs = emb['model'].encode([r['text'] for r in rows],
                                       batch_size=8, normalize_embeddings=True)
            col.add(ids=[r['id'] for r in rows],
                    embeddings=[v.tolist() for v in vecs],
                    documents=[r['text'] for r in rows],
                    # Chroma 는 None 을 받지 않는다. 0 이 '쪽 모름'이다 (ask.py 와 같은 약속)
                    metadatas=[{'doc': r['doc'], 'title': r['title'] or '',
                                'page': r.get('page') or 0} for r in rows])
            # 청크 원본도 함께 남긴다 — 나중에 전략을 바꿔 다시 돌릴 때 쓴다
            CHUNKS_PATH.parent.mkdir(parents=True, exist_ok=True)
            with CHUNKS_PATH.open('a', encoding='utf-8') as f:
                for r in rows:
                    f.write(json.dumps(r, ensure_ascii=False) + '\n')
            _job['added'].append({'doc': p.stem, 'chunks': len(rows)})
            _job['done'] += 1
    except Exception as e:                                   # noqa: BLE001
        _job['error'] = f'{type(e).__name__}: {e}'[:300]
        traceback.print_exc()
    finally:
        _job['running'] = False
        _job['doc'] = ''


def start(docs: list = None) -> dict:
    """색인 작업을 띄운다. 이미 돌고 있으면 그 사실만 돌려준다."""
    with _lock:
        if _job['running']:
            return {'started': False, 'msg': '이미 색인 중입니다'}
        todo = pending(include_skipped=bool(docs))
        if docs:
            want = set(docs)
            todo = [p for p in todo if p.stem in want]
        if not todo:
            return {'started': False, 'msg': '색인에 넣을 새 PDF 가 없습니다'}
        _job.update({'running': True, 'done': 0, 'total': len(todo), 'doc': '',
                     'added': [], 'skipped': [], 'error': '',
                     'at': __import__('datetime').datetime.now().isoformat(timespec='seconds')})
        threading.Thread(target=_run, args=(todo,), daemon=True).start()
        return {'started': True, 'total': len(todo),
                'docs': [p.stem for p in todo]}


@bp.route('/rebuild', methods=['POST'])
def api_rebuild():
    """색인에 없는 PDF 를 넣는다. 이미 있는 것은 건드리지 않는다.

    한 편에 1~3분이다. 배경에서 돌리고 /status 로 진행률을 본다.
    """
    d = request.json or {}
    res = start(d.get('docs'))
    code = 200 if res.get('started') else 409
    return jsonify({'status': 'ok' if res.get('started') else 'busy', **res,
                    'job': _job}), code
