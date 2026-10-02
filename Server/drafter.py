"""
Server/drafter.py — 에이전트가 초안을 쓴다 (내가 가진 것만 읽고)

  무엇을 읽는가
    ① 연구일지 — 실험에서 나온 수치. RSCAD/03_실험/일지/*.md
    ② 선행논문 노트 — 00_Knowledge/literature/*.md (▸ 가 논문이 말한 것)
    ③ 담아 둔 발췌 — paper_clips.json (쪽까지 붙어 있는 인용 후보)
    넷째는 없다. 색인 전체를 들이밀지 않는다 — 모델이 고르게 두면 엉뚱한 논문을
    인용하기 시작한다. 사람이 고른 것만 재료로 쓴다.

  날조를 막는 방법은 프롬프트가 아니라 **재료를 좁히는 것**이다
    - 절마다 그 절에 해당하는 발췌만 넣는다. 재료가 없으면 그 절은 **비워 두고
      비었다고 적는다.** 모델에게 '모르면 비우라' 고 부탁하지 않는다 — 부탁은
      안 듣는다. 애초에 쓸 거리를 주지 않는다.
    - 쓰고 난 뒤 본문에 나온 [@key] 를 재료에 있던 key 와 대조한다. 재료에 없던
      key 가 나오면 그 자리를 ⚠ 로 바꾸고 무엇이 틀렸는지 문서에 남긴다.
    - 수치는 연구일지 표를 **그대로 옮긴다**. 모델이 다시 쓰게 하지 않는다.

  느리다는 사실을 숨기지 않는다
    로컬 qwen3 는 이 기기에서 절당 1~4분이다. 다섯 절이면 10~20분. 그래서
    뒤에서 돌리고 어느 절을 쓰고 있는지 화면에 계속 띄운다.
"""

from __future__ import annotations

import datetime
import json
import pathlib
import re
import threading

from flask import Blueprint, jsonify, request

import llm
from scholar import ROOT, VAULT

bp = Blueprint('drafter', __name__, url_prefix='/api/docs/draft')

JOURNAL_DIR = VAULT / 'RSCAD' / '03_실험' / '일지'
LIT_DIR = VAULT / '00_Knowledge' / 'literature'
CLIPS = ROOT / 'Server' / 'paper_clips.json'

# notebook.py 와 같은 절 구분을 쓴다 — 두 곳에서 따로 정하지 않는다
try:
    from notebook import PAPER_SECTIONS
except Exception:                                            # noqa: BLE001
    PAPER_SECTIONS = [{'id': 'I', 'title': 'Introduction'}, {'id': 'II', 'title': 'System Model'},
                      {'id': 'III', 'title': 'Methodology'}, {'id': 'IV', 'title': 'Results'},
                      {'id': 'V', 'title': 'Conclusion'}]

CITE = re.compile(r'\[@([A-Za-z][A-Za-z0-9_:.#$%&+?<>~/-]*)\]')
MARKER = re.compile(r'^\s*▸\s*(.+)$', re.M)


def _now() -> str:
    return datetime.datetime.now().isoformat(timespec='seconds')


# ═══════════════════════════════════════════════
# 재료 모으기
# ═══════════════════════════════════════════════
def journals() -> list:
    if not JOURNAL_DIR.is_dir():
        return []
    out = []
    for p in sorted(JOURNAL_DIR.glob('*.md'), reverse=True):
        out.append({'kind': 'journal', 'path': f'RSCAD/03_실험/일지/{p.name}',
                    'title': p.stem, 'bytes': p.stat().st_size})
    return out


def literature() -> list:
    if not LIT_DIR.is_dir():
        return []
    out = []
    for p in sorted(LIT_DIR.glob('*.md')):
        txt = p.read_text(encoding='utf-8', errors='replace')
        m = re.search(r'^#\s+(.+)$', txt, re.M)
        out.append({'kind': 'literature', 'path': f'00_Knowledge/literature/{p.name}',
                    'title': (m.group(1).strip() if m else p.stem)[:120],
                    'cite_key': p.stem, 'claims': len(MARKER.findall(txt))})
    return out


def clips() -> list:
    if not CLIPS.exists():
        return []
    try:
        return json.loads(CLIPS.read_text(encoding='utf-8'))
    except (OSError, ValueError):
        return []


@bp.route('/sources')
def api_sources():
    """고를 수 있는 재료. 화면이 여기서 체크한다."""
    j, lit, cl = journals(), literature(), clips()
    return jsonify({'status': 'ok', 'journals': j, 'literature': lit,
                    'clips': len(cl), 'sections': PAPER_SECTIONS,
                    'note': ('고른 것만 읽습니다. 색인 전체를 넣지 않는 이유는 '
                             '모델이 읽지도 않은 논문을 인용하기 시작하기 때문입니다.')})


def _read(rel: str) -> str:
    fp = VAULT / rel
    try:
        return fp.read_text(encoding='utf-8', errors='replace')
    except OSError:
        return ''


def _tables_of(md: str) -> list:
    """일지에서 표 블록만 통째로 떼어 온다. 수치는 모델을 거치지 않는다."""
    out, buf = [], []
    for ln in md.splitlines():
        if ln.strip().startswith('|'):
            buf.append(ln.rstrip())
        elif buf:
            out.append('\n'.join(buf))
            buf = []
    if buf:
        out.append('\n'.join(buf))
    return out


def _evidence(lit_paths: list, cl: list, sec_id: str) -> tuple:
    """그 절에 쓸 재료와, 그 안에서 허용되는 cite_key 집합."""
    lines, keys = [], set()
    for rel in lit_paths:
        md = _read(rel)
        key = pathlib.Path(rel).stem
        claims = MARKER.findall(md)[:6]
        if not claims:
            continue
        keys.add(key)
        lines.append(f'[@{key}]')
        lines += [f'  ▸ {c.strip()[:240]}' for c in claims]
    for c in cl:
        if c.get('section') and c.get('section') != sec_id:
            continue
        k = c.get('cite_key') or ''
        if k:
            keys.add(k)
        page = f" p.{c.get('page')}" if c.get('page') else ''
        lines.append(f'[@{k}]{page}\n  ▸ {(c.get("text") or "")[:300]}')
    return '\n'.join(lines), keys


SYS = (
    '학술 논문의 한 절을 한국어로 씁니다. 아래 "재료" 에 적힌 것만 근거로 씁니다.\n'
    '규칙:\n'
    '- 재료에 없는 수치·주장·출처를 쓰지 않습니다.\n'
    '- 근거를 댈 때는 재료에 적힌 [@key] 를 그대로 씁니다. 다른 key 를 만들지 않습니다.\n'
    '- 재료가 모자라면 짧게 쓰고 멈춥니다. 채우려고 지어내지 않습니다.\n'
    '- 제목을 쓰지 않습니다. 본문 문단만 씁니다.'
)
PREFILL = '본 절에서는'


def _section_text(sec: dict, material: str, keys: set, engine: str, timeout: int,
                  written: list = None) -> dict:
    if not material.strip():
        return {'text': '', 'why': '재료가 없습니다 — 이 절에 해당하는 발췌나 노트를 고르세요'}

    # 앞 절에서 이미 쓴 것을 보여 준다. 안 보여 주면 같은 재료를 받은 절들이
    # 거의 같은 글을 쓴다 — 실제로 II 와 III 이 똑같이 나온 적이 있다.
    prev = ''
    if written:
        prev = ('\n\n이미 쓴 절 (되풀이하지 마세요. 같은 내용을 다시 쓰지 말고 '
                '이 절의 관점에서 쓰세요):\n'
                + '\n'.join(f'- {t}' for t in written)[:1200])

    r = llm.complete(
        system=SYS,
        messages=[{'role': 'user',
                   'content': f'절: {sec["id"]}. {sec["title"]}\n\n재료:\n{material[:4000]}'
                              f'{prev}\n\n이 절의 본문을 2~4문단으로 쓰세요.'}],
        engine=engine, prefill=PREFILL, max_tokens=900, timeout=timeout)
    if not r['ok']:
        return {'text': '', 'why': r.get('error') or '모델이 답하지 않았습니다'}

    text = (r.get('text') or '').strip()
    # 재료에 없던 인용은 그대로 두지 않는다 — 그대로 두면 진짜 인용처럼 읽힌다
    bad = sorted({k for k in CITE.findall(text) if k not in keys})
    for k in bad:
        text = text.replace(f'[@{k}]', f'[⚠ 확인 안 된 인용: {k}]')

    # 길이에 걸려 잘린 것을 숨기지 않는다. 숨기면 문장 중간에서 끝난 글을
    # 완성된 글로 읽게 된다 — 실제로 '…보이며 [@DA' 로 끝난 적이 있다.
    if r.get('truncated'):
        text += '\n\n<!-- ⚠ 길이에 걸려 문장 중간에서 끊겼습니다. 이어서 쓰셔야 합니다. -->'
    return {'text': text, 'bad_cites': bad, 'truncated': bool(r.get('truncated')),
            'model': r.get('model'), 'engine': r.get('engine')}


# ═══════════════════════════════════════════════
# 뒤에서 돌리기 — 절 하나에 1~4분이라 기다리게 둘 수 없다
# ═══════════════════════════════════════════════
_lock = threading.Lock()
_job: dict = {'running': False, 'done': 0, 'total': 0, 'section': '',
              'started': '', 'error': '', 'doc_id': '', 'notes': []}


def _run(title: str, secs: list, j_paths: list, lit_paths: list, cl: list,
         engine: str, timeout: int) -> None:
    import docs_store as S
    try:
        md = [f'# {title}', '']
        used_sources = ([{'kind': 'journal', 'path': p} for p in j_paths]
                        + [{'kind': 'literature', 'path': p} for p in lit_paths])

        # ① 일지의 표는 모델을 거치지 않고 그대로 옮긴다
        tables = []
        for rel in j_paths:
            tables += _tables_of(_read(rel))
        if tables:
            md += ['## 실험 결과 (일지에서 그대로 옮김)', '',
                   '<!-- 연구일지의 표를 그대로 옮긴 값이다. 모델이 다시 쓰지 않았다. -->', '']
            for t in tables:
                md += [t, '']

        # ② 절마다 쓴다. 앞 절에서 쓴 것을 넘겨 같은 글이 반복되지 않게 한다.
        written: list = []
        for sec in secs:
            with _lock:
                _job['section'] = f'{sec["id"]}. {sec["title"]}'
            material, keys = _evidence(lit_paths, cl, sec['id'])
            r = _section_text(sec, material, keys, engine, timeout, written)
            md += [f'## {sec["id"]}. {sec["title"]}', '']
            if r.get('text'):
                md += [r['text'], '']
                written.append(f'{sec["id"]}. {sec["title"]}: {r["text"][:300]}')
                if r.get('bad_cites'):
                    _job['notes'].append(
                        f'{sec["id"]} 절 — 재료에 없던 인용 {len(r["bad_cites"])}건을 '
                        f'⚠ 로 바꿔 두었습니다: {", ".join(r["bad_cites"])}')
                if r.get('truncated'):
                    _job['notes'].append(
                        f'{sec["id"]} 절이 길이에 걸려 문장 중간에서 끊겼습니다 — 이어 쓰셔야 합니다')
            else:
                md += [f'<!-- 비어 있음: {r.get("why")} -->', '']
                _job['notes'].append(f'{sec["id"]} 절은 비워 두었습니다 — {r.get("why")}')
            with _lock:
                _job['done'] += 1

        md += ['## 읽은 것', '']
        for s in used_sources:
            md.append(f'- `{s["path"]}`')
        md += ['', f'<!-- {_now()} · 에이전트 초안. 문장은 제안이고 확정은 사람이 한다. -->']

        row = {
            'title': title, 'folder': '', 'markdown': '\n'.join(md),
            'by': 'agent', 'model': llm.local_model() if engine != 'claude' else '',
            'sources': used_sources,
        }
        doc = S.from_markdown(row['markdown'])
        rec = {'id': S._new_id(), 'title': title, 'folder': '', 'trashed': False,
               'created': _now(), 'updated': _now(), 'version': 1, 'doc': doc,
               'words': S.word_count(doc), 'comments': [],
               'origin': {'by': 'agent', 'model': row['model'], 'sources': used_sources,
                          'notes': list(_job['notes'])}}
        S.save(rec)
        S.push_version(rec, '에이전트 초안', 'agent')
        with _lock:
            _job['doc_id'] = rec['id']
    except Exception as e:                                   # noqa: BLE001
        with _lock:
            _job['error'] = f'{type(e).__name__}: {e}'[:300]
    finally:
        with _lock:
            _job['running'] = False
            _job['section'] = ''


@bp.route('', methods=['POST'])
@bp.route('/', methods=['POST'])
def api_draft():
    """초안 쓰기를 시작한다. 바로 돌아오고, 진행은 /status 로 본다."""
    d = request.json or {}
    with _lock:
        if _job['running']:
            return jsonify({'status': 'error', 'error': '이미 쓰고 있습니다',
                            'job': dict(_job)}), 409

    title = (d.get('title') or '').strip() or '논문 초안'
    want = [s for s in PAPER_SECTIONS
            if s['id'] in set(d.get('sections') or [s['id'] for s in PAPER_SECTIONS])
            and s['id'] != '?']
    j_paths = [p for p in (d.get('journals') or []) if (VAULT / p).is_file()]
    lit_paths = [p for p in (d.get('literature') or []) if (VAULT / p).is_file()]
    cl = clips()

    if not j_paths and not lit_paths and not cl:
        return jsonify({'status': 'error',
                        'error': ('읽을 재료가 없습니다 — 연구일지나 선행논문 노트를 '
                                  '고르거나 발췌를 담으세요')}), 400

    engine = d.get('engine') or llm.DEFAULT_ENGINE
    st = llm.status(probe_claude=(engine == 'claude'))
    if engine == 'claude' and not st['claude']['ok']:
        return jsonify({'status': 'error', 'error': st['claude']['msg']}), 400
    if engine == 'local' and not st['local']['ok']:
        return jsonify({'status': 'error', 'error': st['local']['msg']}), 400

    with _lock:
        _job.update({'running': True, 'done': 0, 'total': len(want), 'section': '',
                     'started': _now(), 'error': '', 'doc_id': '', 'notes': []})
    # 절 하나가 900토큰이고 이 기기의 로컬 모델은 초당 3토큰 안팎이다. 생성만으로
    # 300초가 넘어 예전 기본값(300초)에서는 모든 절이 비었다. 뒤에서 도는 일이라
    # 기다리는 사람이 없으니 넉넉히 준다.
    timeout = int(d.get('timeout') or (900 if engine == 'local' else 180))
    threading.Thread(target=_run, daemon=True,
                     args=(title, want, j_paths, lit_paths, cl, engine, timeout)).start()
    per = 8 if engine == 'local' else 1
    return jsonify({'status': 'ok', 'job': dict(_job), 'engine': engine, 'timeout': timeout,
                    'note': f'{len(want)}개 절을 씁니다 — 이 기기에서 절당 5~{per}분, '
                            f'모두 {len(want) * per}분쯤 걸립니다. 화면을 떠나도 계속 씁니다.'})


@bp.route('/status')
def api_status():
    with _lock:
        return jsonify({'status': 'ok', 'job': dict(_job)})
