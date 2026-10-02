"""
Server/doc.py — 논문 쓰기: 문서 저장소 · 댓글 · AI 보조

  스콜라의 '쓰는 쪽'이다. 화면은 WYSIWYG 이지만 **저장본은 마크다운**이다.
  그래야 같은 파일을 Obsidian 이 열고 Pandoc 이 돌리고, [@citekey]·[[링크]]·
  ▸/※ 가 그대로 산다. 편집기는 보여 주는 방식일 뿐 파일 형식이 아니다.

  셋을 맡는다.
    ① 문서   볼트 .md 읽기·쓰기. 밖에서 고친 것을 모르고 덮지 않는다(base 대조).
    ② 댓글   문장 범위에 묶인 메모. 본문이 바뀌면 따라가거나, 못 따라가면
             '길 잃음'으로 표시한다 — 엉뚱한 자리에 붙은 댓글보다 낫다.
    ③ 보조   고른 문장을 다듬거나, 그 문장의 근거를 내 색인에서 찾아 준다.

  원칙(app.py·scholar.py·ask.py·notebook.py 와 같다): 값을 날조하지 않는다.
    - 보조는 **제안**이다. 본문에 자동으로 넣지 않는다. 넣는 것은 사람이 누른다.
    - 문장을 고쳐 줄 때 내용을 더하지 않는다. 없는 수치·출처를 지어내지 않는다.
    - 근거 찾기는 ask.retrieve 를 그대로 쓴다 — 하한 미달이면 '없다'고 말한다.
"""

from __future__ import annotations

import datetime
import hashlib
import json
import re
import uuid

from flask import Blueprint, jsonify, request

import ask
import llm
from scholar import ROOT, VAULT, safe_vault_path

bp = Blueprint('doc', __name__, url_prefix='/api/doc')

COMMENTS_PATH = ROOT / 'Server' / 'doc_comments.json'

# 글을 두는 곳. 볼트 안이면 어디든 열 수 있지만, 목록은 여기부터 보여 준다.
WRITE_DIRS = ['00_Knowledge/mine', '00_Knowledge/claims', 'RSCAD/03_실험/일지']


def _now() -> str:
    return datetime.datetime.now().isoformat(timespec='seconds')


def _hash(text: str) -> str:
    """내용 지문. 밖에서 고친 것을 모르고 덮지 않기 위해 쓴다."""
    return hashlib.sha256(text.encode('utf-8')).hexdigest()[:16]


# ═══════════════════════════════════════════════
# ① 문서
# ═══════════════════════════════════════════════
@bp.route('/list')
def api_list():
    """쓸 수 있는 글 목록. 문헌 노트(남의 논문)는 섞지 않는다 — 고쳐 쓰는 글이 아니다."""
    out = []
    for folder in WRITE_DIRS:
        d = VAULT / folder
        if not d.exists():
            continue
        for f in sorted(d.glob('*.md')):
            try:
                stat = f.stat()
            except OSError:
                continue
            out.append({'path': f.relative_to(VAULT).as_posix(), 'name': f.stem,
                        'bytes': stat.st_size,
                        'modified': datetime.datetime.fromtimestamp(
                            stat.st_mtime).isoformat(timespec='seconds')})
    return jsonify({'status': 'ok', 'docs': out, 'dirs': WRITE_DIRS})


@bp.route('')
@bp.route('/')
def api_read():
    rel = request.args.get('path') or ''
    try:
        fp = safe_vault_path(rel)
    except ValueError:
        return jsonify({'status': 'error', 'error': '볼트 밖 경로'}), 403
    if not fp.is_file():
        return jsonify({'status': 'error', 'error': f'없는 글입니다: {rel}'}), 404
    text = fp.read_text(encoding='utf-8')
    return jsonify({'status': 'ok', 'path': rel, 'text': text, 'base': _hash(text),
                    'modified': datetime.datetime.fromtimestamp(
                        fp.stat().st_mtime).isoformat(timespec='seconds')})


@bp.route('', methods=['POST'])
@bp.route('/', methods=['POST'])
def api_write():
    """저장. base 를 주면 그 사이에 파일이 바뀌었는지 보고, 바뀌었으면 거절한다.

    같은 파일을 Obsidian 이 동시에 열고 있을 수 있다. 모르고 덮으면 거기서 쓴
    글이 사라진다 — 그건 되돌릴 수 없다.
    """
    d = request.json or {}
    rel = d.get('path') or ''
    text = d.get('text')
    if text is None:
        return jsonify({'status': 'error', 'error': 'text 가 필요합니다'}), 400
    try:
        fp = safe_vault_path(rel)
    except ValueError:
        return jsonify({'status': 'error', 'error': '볼트 밖 경로'}), 403
    if fp.suffix.lower() != '.md':
        return jsonify({'status': 'error', 'error': '.md 만 저장합니다'}), 400

    # 마크다운 파일은 끝 개행으로 끝나는 것이 관례다. 편집기 직렬화기는 그걸
    # 떼고 내보내서, 한 번 열었다 저장하면 파일 끝이 바뀌어 버린다 (실제로
    # 초안.md 가 그렇게 됐다). 내용이 아니라 모양만 달라지는 변경은 만들지 않는다.
    if text and not text.endswith('\n'):
        text += '\n'

    if fp.exists():
        cur = fp.read_text(encoding='utf-8')
        base = d.get('base')
        if base and base != _hash(cur):
            return jsonify({'status': 'error', 'conflict': True,
                            'error': '이 글이 밖에서 바뀌었습니다 (Obsidian 등). '
                                     '덮으면 거기서 쓴 글이 사라집니다 — 새로고침해 확인하세요',
                            'current': cur, 'base': _hash(cur)}), 409
        if cur == text:
            return jsonify({'status': 'ok', 'path': rel, 'base': _hash(cur),
                            'saved': False, 'msg': '바뀐 것이 없습니다'})
    else:
        fp.parent.mkdir(parents=True, exist_ok=True)
    fp.write_text(text, encoding='utf-8')
    return jsonify({'status': 'ok', 'path': rel, 'base': _hash(text), 'saved': True,
                    'at': _now()})


@bp.route('/new', methods=['POST'])
def api_new():
    d = request.json or {}
    name = re.sub(r'[\\/:*?"<>|]', '', (d.get('name') or '').strip())
    if not name:
        return jsonify({'status': 'error', 'error': '이름이 필요합니다'}), 400
    folder = d.get('dir') if d.get('dir') in WRITE_DIRS else WRITE_DIRS[0]
    rel = f'{folder}/{name}.md'
    try:
        fp = safe_vault_path(rel)
    except ValueError:
        return jsonify({'status': 'error', 'error': '볼트 밖 경로'}), 403
    if fp.exists():
        return jsonify({'status': 'error', 'error': f'이미 있습니다: {rel}'}), 409
    fp.parent.mkdir(parents=True, exist_ok=True)
    body = f'# {name}\n\n'
    fp.write_text(body, encoding='utf-8')
    return jsonify({'status': 'ok', 'path': rel, 'text': body, 'base': _hash(body)})


# ═══════════════════════════════════════════════
# 연구일지 — 수치는 자동, 해석은 내가
#   그날 돌린 실험을 고르면 조건·결과가 표로 박힌다. 사람이 숫자를 옮겨 적으면
#   언젠가 틀린다 — 틀린 줄도 모르고 그 숫자가 논문으로 간다.
#   그 위에 ▸(관측) / ※(내 해석)으로 쓴다. 이 글이 나중에 논문 문단이 된다.
# ═══════════════════════════════════════════════
JOURNAL_DIR = 'RSCAD/03_실험/일지'
RESULTS_ROOT = ROOT / 'results'


def _runs() -> list:
    """results/ 의 실험 기록. app.py 의 /api/runs 와 같은 자리를 읽는다."""
    out = []
    if not RESULTS_ROOT.exists():
        return out
    for d in sorted(RESULTS_ROOT.iterdir()):
        mp = d / 'meta.json'
        if not d.is_dir() or not mp.exists():
            continue
        try:
            m = json.loads(mp.read_text(encoding='utf-8'))
        except Exception:                                    # noqa: BLE001
            continue
        m['run_name'] = m.get('run_name') or d.name
        out.append(m)
    return out


def run_table(names: list) -> str:
    """고른 실험을 마크다운 표로. 없는 값은 비워 둔다 — 지어내지 않는다."""
    want = [r for r in _runs() if r.get('run_name') in set(names)]
    if not want:
        return ''
    rows = ['| run | 날짜 | X/R | SCR | 전부 안정 | ζ_min | 상태수 |',
            '|---|---|---|---|---|---|---|']
    for r in want:
        scr = ', '.join(str(x) for x in (r.get('SCR_list') or [])) or '—'
        stable = {True: '예', False: '아니오'}.get(r.get('all_stable'), '—')
        z = r.get('zeta_min')
        rows.append(f"| `{r['run_name']}` | {r.get('timestamp') or '—'} | "
                    f"{r.get('XR', '—')} | {scr} | {stable} | "
                    f"{z if z is not None else '—'} | {r.get('n_states', '—')} |")
    return '\n'.join(rows)


@bp.route('/runs')
def api_runs():
    """일지에 박을 수 있는 실험 목록. 화면이 여기서 고른다."""
    out = [{k: r.get(k) for k in
            ('run_name', 'timestamp', 'XR', 'SCR_list', 'all_stable', 'zeta_min',
             'n_states', 'model_version')}
           for r in _runs()]
    out.sort(key=lambda r: r.get('timestamp') or '', reverse=True)
    return jsonify({'status': 'ok', 'runs': out, 'dir': 'results'})


@bp.route('/journal', methods=['POST'])
def api_journal_new():
    """오늘자 연구일지를 만든다. 고른 실험이 있으면 표로 박아 둔다."""
    d = request.json or {}
    title = re.sub(r'[\\/:*?"<>|]', '', (d.get('title') or '').strip()) or '연구일지'
    day = (d.get('date') or datetime.date.today().isoformat())[:10]
    rel = f'{JOURNAL_DIR}/{day}_{title}.md'
    try:
        fp = safe_vault_path(rel)
    except ValueError:
        return jsonify({'status': 'error', 'error': '볼트 밖 경로'}), 403
    if fp.exists():
        return jsonify({'status': 'error', 'error': f'이미 있습니다: {rel}'}), 409

    table = run_table(d.get('runs') or [])
    body = [f'# {day} {title}', '']
    if table:
        body += ['## 돌린 것', '',
                 '<!-- results/ 의 meta.json 에서 그대로 옮긴 값이다. 손으로 고치지 않는다. -->',
                 table, '']
    elif d.get('runs'):
        body += ['## 돌린 것', '',
                 '※ 고른 실험을 results/ 에서 찾지 못했습니다 — 이름을 확인하세요.', '']
    body += ['## 본 것', '', '▸ ', '',
             '## 내 해석', '', '※ ', '',
             '## 논문 어디에', '',
             '※ 이 일지를 논문 어느 절로 보낼지 (I~V). ‘합치기’ 에서 고릅니다.', '']
    text = '\n'.join(body) + '\n'
    fp.parent.mkdir(parents=True, exist_ok=True)
    fp.write_text(text, encoding='utf-8')
    return jsonify({'status': 'ok', 'path': rel, 'text': text, 'base': _hash(text)})


# ═══════════════════════════════════════════════
# 합치기 — 일지 문단을 논문 절로
#   파일을 쓰지 않는다. 합친 본문을 돌려주기만 하고, 저장은 사람이 편집기에서
#   보고 누른다. 자동으로 써 버리면 '언제 뭐가 들어갔는지' 를 놓친다.
# ═══════════════════════════════════════════════
PARA_SPLIT = re.compile(r'\n\s*\n')


@bp.route('/paragraphs')
def api_paragraphs():
    """글을 문단으로 쪼개 돌려준다. 합치기 화면이 왼쪽에 세운다."""
    rel = request.args.get('path') or ''
    try:
        fp = safe_vault_path(rel)
    except ValueError:
        return jsonify({'status': 'error', 'error': '볼트 밖 경로'}), 403
    if not fp.is_file():
        return jsonify({'status': 'error', 'error': f'없는 글입니다: {rel}'}), 404
    text = fp.read_text(encoding='utf-8')
    out = []
    for i, p in enumerate(PARA_SPLIT.split(text)):
        s = p.strip()
        if not s:
            continue
        out.append({'i': i, 'text': s,
                    # 제목·표·주석은 그대로 옮길 것이 아니라 보고 판단할 것이다
                    'kind': ('heading' if s.startswith('#')
                             else 'table' if s.startswith('|')
                             else 'comment' if s.startswith('<!--')
                             else 'marker' if s[0] in '▸※'
                             else 'text')})
    return jsonify({'status': 'ok', 'path': rel, 'paragraphs': out})

# ═══════════════════════════════════════════════
# ② 댓글 — 문장에 묶인 메모
#   마크다운에는 댓글을 담을 자리가 없다. 그래서 따로 둔다.
#   자리는 글자 위치가 아니라 **인용한 문장 자체**로 잡는다. 글을 고치면 위치는
#   밀리지만 문장은 남기 때문이다. 문장마저 사라지면 '길 잃음'으로 표시한다 —
#   엉뚱한 자리에 붙은 댓글은 없느니만 못하다.
# ═══════════════════════════════════════════════
def load_comments() -> list:
    if COMMENTS_PATH.exists():
        try:
            return json.loads(COMMENTS_PATH.read_text(encoding='utf-8')).get('comments', [])
        except Exception:                                    # noqa: BLE001
            return []
    return []


def save_comments(rows: list) -> None:
    COMMENTS_PATH.write_text(json.dumps({'comments': rows}, ensure_ascii=False, indent=2),
                             encoding='utf-8')


def anchor(text: str, c: dict) -> dict:
    """댓글이 가리키는 자리를 지금 본문에서 다시 찾는다.

    같은 문장이 여러 번 나오면 앞뒤 글자(prefix/suffix)로 가린다.
    """
    quote = c.get('quote') or ''
    if not quote:
        return {**c, 'found': False, 'start': None}
    pre, suf = c.get('prefix') or '', c.get('suffix') or ''
    # ① 앞뒤까지 맞는 자리
    if pre or suf:
        i = text.find(pre + quote + suf)
        if i >= 0:
            return {**c, 'found': True, 'start': i + len(pre)}
    # ② 문장만 맞는 자리 — 하나뿐일 때만 믿는다
    hits = [m.start() for m in re.finditer(re.escape(quote), text)]
    if len(hits) == 1:
        return {**c, 'found': True, 'start': hits[0]}
    if len(hits) > 1:
        # 예전 위치에서 가장 가까운 것
        old = c.get('start')
        if isinstance(old, int):
            best = min(hits, key=lambda h: abs(h - old))
            return {**c, 'found': True, 'start': best, 'ambiguous': True}
    return {**c, 'found': False, 'start': None}


@bp.route('/comments')
def api_comments():
    """글 하나의 댓글. 지금 본문에서 자리를 다시 잡아 돌려준다."""
    rel = request.args.get('path') or ''
    rows = [c for c in load_comments() if c.get('path') == rel]
    try:
        fp = safe_vault_path(rel)
        text = fp.read_text(encoding='utf-8') if fp.is_file() else ''
    except (ValueError, OSError):
        text = ''
    out = [anchor(text, c) for c in rows]
    return jsonify({'status': 'ok', 'comments': out,
                    'lost': sum(1 for c in out if not c['found']),
                    'path': 'Server/doc_comments.json'})


@bp.route('/comments', methods=['POST'])
def api_comment_add():
    d = request.json or {}
    rel = (d.get('path') or '').strip()
    quote = (d.get('quote') or '').strip()
    body = (d.get('body') or '').strip()
    if not rel or not quote:
        return jsonify({'status': 'error', 'error': 'path 와 quote 가 필요합니다'}), 400
    if not body:
        return jsonify({'status': 'error', 'error': '댓글이 비었습니다'}), 400
    rows = load_comments()
    rows.append({
        'id': uuid.uuid4().hex[:10],
        'path': rel,
        'quote': quote[:400],
        'prefix': (d.get('prefix') or '')[-40:],
        'suffix': (d.get('suffix') or '')[:40],
        'start': d.get('start'),
        'body': body[:2000],
        'by': d.get('by') if d.get('by') in ('me', 'ai') else 'me',
        'kind': d.get('kind') or '',         # polish · evidence · 빈 값(그냥 메모)
        'resolved': False,
        'created': _now(),
    })
    save_comments(rows)
    return jsonify({'status': 'ok', 'comments': [c for c in rows if c['path'] == rel]})


@bp.route('/comments/<cid>', methods=['PATCH', 'DELETE'])
def api_comment_edit(cid):
    rows = load_comments()
    i = next((n for n, c in enumerate(rows) if c['id'] == cid), None)
    if i is None:
        return jsonify({'status': 'error', 'error': f'댓글이 없습니다: {cid}'}), 404
    rel = rows[i]['path']
    if request.method == 'DELETE':
        rows.pop(i)
    else:
        d = request.json or {}
        for f in ('body', 'resolved'):
            if f in d:
                rows[i][f] = d[f]
    save_comments(rows)
    return jsonify({'status': 'ok', 'comments': [c for c in rows if c['path'] == rel]})


# ═══════════════════════════════════════════════
# AI 검토 — 댓글로만 남긴다
#   본문을 고치지 않는다. 고쳐 주면 편하지만, 어디가 왜 바뀌었는지 모른 채
#   논문이 흘러간다. 지적만 남기고 고치는 것은 사람이 한다.
#
#   보는 것 셋. 넓히지 않는다 — 모델이 넓게 보면 '문장이 어색합니다' 같은
#   쓸모없는 말이 쌓이고, 쌓이면 아무도 안 읽는다.
#     ① 근거 없는 주장 — 색인에서 뒷받침을 못 찾는 문단 (모델이 아니라 검색이 판단)
#     ② 인용 표기 깨짐 — [@key]·[[링크]] 모양이 틀린 것 (정규식이 판단)
#     ③ 용어 흔들림   — 같은 것을 다르게 쓴 것 (표로 판단)
#   ①②③ 모두 **기계가 먼저 거르고**, 모델은 거기에 설명을 붙일 뿐이다.
# ═══════════════════════════════════════════════
# 이 저장소에서 굳어진 표기. 왼쪽이 맞고 오른쪽은 흔들린 꼴이다.
TERMS = [
    ('SCR', [r'\bscr\b', r'단락\s*용량\s*비']),
    ('X/R', [r'\bx\s*/\s*r\b(?!\))', r'\bXR\b']),
    ('GFM', [r'\bgfm\b', r'그리드\s*포밍(?!\s*\()']),
    ('GFL', [r'\bgfl\b']),
    ('PSO', [r'\bpso\b', r'입자\s*군집']),
]
CITE_OK = re.compile(r'\[@[A-Za-z][A-Za-z0-9_:.#$%&+?<>~/-]*\]')
CITE_LOOSE = re.compile(r'\[@[^\]]*\]')
WIKI_OK = re.compile(r'\[\[[^\[\]]+\]\]')
WIKI_LOOSE = re.compile(r'\[\[[^\]]*\]?\]?')


def _cite_problems(text: str) -> list:
    """인용 표기가 망가진 곳. 모델이 [@key] 를 중간에서 끊어 먹은 적이 있다."""
    out = []
    for m in CITE_LOOSE.finditer(text):
        if not CITE_OK.fullmatch(m.group()):
            out.append(f'인용 표기가 깨졌습니다: `{m.group()[:40]}`')
    # [@ 로 열고 안 닫은 것
    for m in re.finditer(r'\[@[^\]\n]{0,60}$', text, re.M):
        out.append(f'인용이 닫히지 않았습니다: `{m.group()[:40]}`')
    return out


def _term_problems(text: str) -> list:
    out = []
    for right, wrongs in TERMS:
        if right in text:
            continue                      # 맞게 쓴 자리가 있으면 흔들림만 본다
        for w in wrongs:
            m = re.search(w, text, re.I)
            if m and m.group() != right:
                out.append(f'표기가 흔들립니다: `{m.group()}` → `{right}`')
                break
    return out


REVIEW_SYS = ('학술 원고의 한 문단을 검토합니다. 지적된 문제에 대해서만, '
              '왜 문제인지와 어떻게 고칠지를 한국어 1~2문장으로 씁니다.\n'
              '규칙: 새 사실·수치·출처를 지어내지 않습니다. 문단을 다시 쓰지 않습니다. '
              '머리말 없이 지적만 씁니다.')
REVIEW_PREFILL = '지적:'


@bp.route('/review', methods=['POST'])
def api_review():
    """글을 훑어 댓글을 단다. 본문은 글자 하나도 바뀌지 않는다.

    기계가 먼저 거르고(근거·인용·용어) 모델은 설명만 붙인다. 모델을 못 쓰면
    기계가 찾은 것만 댓글로 남는다 — 검토가 통째로 멈추지는 않는다.
    """
    d = request.json or {}
    rel = (d.get('path') or '').strip()
    try:
        fp = safe_vault_path(rel)
    except ValueError:
        return jsonify({'status': 'error', 'error': '볼트 밖 경로'}), 403
    if not fp.is_file():
        return jsonify({'status': 'error', 'error': f'없는 글입니다: {rel}'}), 404

    text = fp.read_text(encoding='utf-8')
    paras = [p.strip() for p in PARA_SPLIT.split(text) if p.strip()]
    # 제목·표·주석은 검토 대상이 아니다
    paras = [p for p in paras if not p.startswith(('#', '|', '<!--', '>'))]
    limit = max(1, min(12, int(d.get('limit') or 8)))
    paras = [p for p in paras if len(p) >= 40][:limit]
    if not paras:
        return jsonify({'status': 'ok', 'added': 0, 'comments': [],
                        'note': '검토할 문단이 없습니다 (40자 이상 본문 기준)'})

    explain = bool(d.get('explain', True))
    engine = d.get('engine')
    rows = load_comments()
    have = {(c.get('path'), c.get('quote'), c.get('body')) for c in rows}
    added, checked = [], 0

    for p in paras:
        checked += 1
        problems = []

        # ① 근거 — 검색이 판단한다. 모델에게 묻지 않는다.
        hits, err = ask.retrieve(p[:400], 3)
        if not err:
            best = hits[0]['sim'] if hits else 0
            if best < ask.MIN_SIM:
                problems.append(('evidence',
                                 f'색인에서 이 문단을 뒷받침할 대목을 찾지 못했습니다 '
                                 f'(최고 유사도 {best} < {ask.MIN_SIM}). '
                                 f'근거 없이 쓰고 있는 문장일 수 있습니다'))
        # ② 인용 표기
        for msg in _cite_problems(p):
            problems.append(('citation', msg))
        # ③ 용어
        for msg in _term_problems(p):
            problems.append(('term', msg))

        for kind, msg in problems:
            body = msg
            if explain and kind != 'evidence':
                r = llm.complete(system=REVIEW_SYS,
                                 messages=[{'role': 'user',
                                            'content': f'문단:\n{p[:800]}\n\n지적할 점: {msg}'}],
                                 engine=engine, prefill=REVIEW_PREFILL,
                                 max_tokens=200, timeout=int(d.get('timeout') or 180))
                if r['ok'] and r['text'].strip():
                    body = f'{msg}\n{r["text"].strip()}'
            quote = p[:200]
            if (rel, quote, body) in have:
                continue                  # 같은 지적을 두 번 달지 않는다
            at = text.find(quote)
            rows.append({
                'id': uuid.uuid4().hex[:10], 'path': rel, 'quote': quote,
                'prefix': text[max(0, at - 40):at] if at > 0 else '',
                'suffix': text[at + len(quote):at + len(quote) + 40] if at >= 0 else '',
                'start': at if at >= 0 else None,
                'body': body, 'by': 'ai', 'kind': kind,
                'resolved': False, 'created': _now(),
            })
            have.add((rel, quote, body))
            added.append(kind)

    save_comments(rows)
    mine = [anchor(text, c) for c in rows if c.get('path') == rel]
    return jsonify({'status': 'ok', 'checked': checked, 'added': len(added),
                    'by_kind': {k: added.count(k) for k in set(added)},
                    'comments': mine,
                    'note': ('본문은 바뀌지 않았습니다 — 지적만 댓글로 달렸습니다'
                             if added else '지적할 것을 찾지 못했습니다')})

# ═══════════════════════════════════════════════
# ③ AI 보조 — 고른 문장에 대해서만
# ═══════════════════════════════════════════════
ACTIONS = {
    'polish': {
        'label': '다듬기',
        'sys': ('학술 문장을 다듬습니다. 내용을 더하거나 빼지 않습니다.\n'
                '규칙:\n'
                '1. 없는 수치·출처·주장을 지어내지 않습니다. 원문에 있는 것만 씁니다.\n'
                '2. 용어와 기호는 원문 그대로 둡니다 (SCR, X/R, σ, GFM 등).\n'
                '3. [@citekey]·[[링크]]·▸·※ 표기는 손대지 않고 그대로 옮깁니다.\n'
                '4. 고친 문장만 출력합니다. 설명·머리말을 쓰지 않습니다.'),
        'ask': '다음 문장을 학술 문체로 다듬어 주세요.',
    },
    'shorten': {
        'label': '줄이기',
        'sys': ('학술 문장을 짧게 만듭니다. 뜻을 바꾸지 않습니다.\n'
                '규칙: 내용을 더하지 않습니다. 수치·출처·기호는 그대로 둡니다.\n'
                '[@citekey]·[[링크]]·▸·※ 는 손대지 않습니다. 고친 문장만 출력합니다.'),
        'ask': '다음 문장을 뜻을 유지한 채 짧게 만들어 주세요.',
    },
    'academic': {
        'label': '학술체로',
        'sys': ('구어체 문장을 학술 논문 문체로 바꿉니다. 내용은 그대로입니다.\n'
                '규칙: 주장을 세게 만들지 않습니다 — "증명했다" 처럼 원문에 없는 강도를\n'
                '넣지 않습니다. 기호·인용 표기는 그대로 둡니다. 고친 문장만 출력합니다.'),
        'ask': '다음 문장을 학술 논문 문체로 바꿔 주세요.',
    },
}
PREFILL = '수정:'


@bp.route('/actions')
def api_actions():
    return jsonify({'status': 'ok',
                    'actions': [{'kind': k, 'label': v['label']} for k, v in ACTIONS.items()],
                    'ollama': ask.ollama_up(),
                    # 어느 엔진으로 돌릴 수 있는지. 원격은 '밖으로 나간다'는 사실까지 화면이 말한다
                    'engines': llm.status()})


@bp.route('/assist', methods=['POST'])
def api_assist():
    """고른 문장을 고쳐 **제안**한다. 본문에 넣는 것은 사람이 누른다."""
    d = request.json or {}
    kind = d.get('kind')
    text = (d.get('text') or '').strip()
    if kind not in ACTIONS:
        return jsonify({'status': 'error', 'error': f'모르는 동작입니다: {kind}'}), 400
    if len(text) < 2:
        return jsonify({'status': 'error', 'error': '고친 문장이 너무 짧습니다'}), 400
    if len(text) > 2000:
        return jsonify({'status': 'error',
                        'error': '한 번에 2000자까지입니다 — 문단을 나눠 고르세요'}), 400

    spec = ACTIONS[kind]
    r = llm.complete(system=spec['sys'],
                     messages=[{'role': 'user', 'content': spec['ask'] + '\n\n' + text}],
                     engine=d.get('engine'), prefill=PREFILL, max_tokens=500,
                     timeout=int(d.get('timeout') or 240), temperature=0.2)
    if not r['ok']:
        return jsonify({'status': 'error', 'error': r['error'],
                        'engine': r.get('engine'), 'model': r.get('model')}), 502
    out = re.sub(r'^수정:\s*', '', r['text']).strip()

    # 인용 표기를 잃어버렸는지 본다. 모델이 [@key] 를 지우면 출처가 사라진다
    def cites(s):
        return set(re.findall(r'\[@[^\]]+\]', s)) | set(re.findall(r'\[\[[^\]]+\]\]', s))
    lost = sorted(cites(text) - cites(out))
    return jsonify({'status': 'ok', 'kind': kind, 'label': spec['label'],
                    'original': text, 'suggestion': out,
                    'model': r['model'], 'engine': r['engine'],
                    'truncated': r.get('truncated', False),
                    'lost_citations': lost,
                    'note': (f'인용 표기가 빠졌습니다: {", ".join(lost)} — 그대로 넣으면 출처가 사라집니다'
                             if lost else '')})


@bp.route('/evidence', methods=['POST'])
def api_evidence():
    """고른 문장의 근거를 내 색인에서 찾는다. 없으면 없다고 말한다."""
    d = request.json or {}
    text = (d.get('text') or '').strip()
    if len(text) < 4:
        return jsonify({'status': 'error', 'error': '문장이 너무 짧습니다'}), 400
    hits, err = ask.retrieve(text, int(d.get('n') or 5), d.get('docs'))
    if err:
        return jsonify({'status': 'error', 'error': err}), 503
    strong = [h for h in hits if h['sim'] >= ask.MIN_SIM]
    best = hits[0]['sim'] if hits else 0
    return jsonify({'status': 'ok', 'hits': strong, 'all': hits,
                    'enough': bool(strong), 'min_sim': ask.MIN_SIM,
                    'note': '' if strong else
                            f'이 문장을 뒷받침할 대목을 색인에서 찾지 못했습니다 '
                            f'(최고 유사도 {best} < {ask.MIN_SIM}). '
                            f'근거 없이 쓰고 있는 문장일 수 있습니다'})
