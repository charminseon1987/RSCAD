"""
Server/docs_store.py — 논문 문서 저장소 (Docs 처럼 쓰고, CRUD 로 관리한다)

  왜 .md 가 아닌가
    사용자가 고른 길이다. 본문을 마크다운 글자가 아니라 **문서 구조(ProseMirror
    JSON)** 로 들고 있으면 댓글 자리·버전·서식을 글자 위치가 아니라 노드로 잡을
    수 있다. 마크다운으로는 "이 문장에 달린 댓글" 이 글자 수가 바뀔 때마다 길을
    잃는다 — 실제로 doc.py 의 anchor() 가 그 일을 하고 있고 종종 놓친다.

  대신 잃는 것을 그대로 적는다 (고를 때 이미 말씀드렸다)
    Obsidian 이 이 파일을 못 읽는다. Pandoc·ce_tool 도 못 읽는다.
    그래서 **내보내기를 같이 만든다** — to_markdown() 이 이 JSON 을 마크다운으로
    되돌리고, 그 길로 Obsidian·Pandoc·export.py(docx) 가 다시 닿는다.
    내보내기가 없으면 이 저장소는 글을 가두는 감옥이 된다.

  값을 날조하지 않는다
    에이전트가 쓴 초안에는 **무엇을 읽고 썼는지**(origin.sources)가 반드시 붙는다.
    읽은 적 없는 논문을 인용한 문장은 만들지 않는다 — 초안 생성은 주어진 발췌
    안에서만 쓰고, 근거를 못 찾으면 그 자리를 비워 두고 비었다고 적는다.
"""

from __future__ import annotations

import datetime
import json
import pathlib
import re
import uuid

from flask import Blueprint, jsonify, request

from scholar import ROOT

bp = Blueprint('docs', __name__, url_prefix='/api/docs')

STORE = ROOT / 'Server' / 'documents'
TRASH_DAYS = 30          # 휴지통에서 이만큼 지나면 목록에서 흐려 보인다 (지우지는 않는다)
MAX_VERSIONS = 50        # 한 문서가 들고 있는 스냅샷 수


def _now() -> str:
    return datetime.datetime.now().isoformat(timespec='seconds')


def _new_id() -> str:
    return 'd_' + uuid.uuid4().hex[:10]


def _path(doc_id: str) -> pathlib.Path:
    return STORE / f'{doc_id}.json'


def _vpath(doc_id: str) -> pathlib.Path:
    return STORE / f'{doc_id}.versions.jsonl'


SAFE_ID = re.compile(r'^d_[0-9a-f]{10}$')


def load(doc_id: str) -> dict | None:
    """문서 하나. 없으면 None. id 모양을 먼저 보는 것은 경로를 타고 나가지 못하게 하려는 것이다."""
    if not SAFE_ID.match(doc_id or ''):
        return None
    fp = _path(doc_id)
    if not fp.is_file():
        return None
    try:
        return json.loads(fp.read_text(encoding='utf-8'))
    except (OSError, ValueError):
        return None


def save(d: dict) -> None:
    STORE.mkdir(parents=True, exist_ok=True)
    _path(d['id']).write_text(json.dumps(d, ensure_ascii=False, indent=2), encoding='utf-8')


def listing(include_trashed: bool = False) -> list:
    """목록용 요약. 본문은 빼고 보낸다 — 목록 한 번에 원고 전체가 따라오면 안 된다."""
    out = []
    if not STORE.is_dir():
        return out
    for fp in STORE.glob('d_*.json'):
        if fp.name.endswith('.versions.jsonl'):
            continue
        try:
            d = json.loads(fp.read_text(encoding='utf-8'))
        except (OSError, ValueError):
            continue
        if d.get('trashed') and not include_trashed:
            continue
        out.append({
            'id': d.get('id'), 'title': d.get('title') or '제목 없음',
            'folder': d.get('folder') or '', 'trashed': bool(d.get('trashed')),
            'created': d.get('created'), 'updated': d.get('updated'),
            'words': d.get('words', 0), 'version': d.get('version', 1),
            'comments': len([c for c in (d.get('comments') or []) if not c.get('resolved')]),
            'by': (d.get('origin') or {}).get('by') or 'user',
            'sources': len(((d.get('origin') or {}).get('sources')) or []),
        })
    out.sort(key=lambda r: r.get('updated') or '', reverse=True)
    return out


# ═══════════════════════════════════════════════
# 본문 — ProseMirror JSON
#   편집기가 쓰는 노드만 다룬다. 모르는 노드는 버리지 않고 글자라도 건진다.
# ═══════════════════════════════════════════════
EMPTY_DOC = {'type': 'doc', 'content': [{'type': 'paragraph'}]}


def plain_text(node: dict) -> str:
    """노드 안의 글자만 이어 붙인다. 글자수·검색·근거 조회에 쓴다."""
    if not isinstance(node, dict):
        return ''
    if node.get('type') == 'text':
        return node.get('text') or ''
    if node.get('type') == 'hardBreak':
        return '\n'
    parts = [plain_text(c) for c in (node.get('content') or [])]
    sep = '\n' if node.get('type') in ('paragraph', 'heading', 'listItem',
                                       'blockquote', 'codeBlock', 'tableRow') else ''
    return sep.join(p for p in parts if p is not None) + (sep if sep else '')


def word_count(doc: dict) -> int:
    return len([w for w in re.split(r'\s+', plain_text(doc)) if w])


# ── 마크다운으로 되돌리기 (Obsidian·Pandoc·docx 로 나가는 유일한 문) ──
def _inline(node: dict) -> str:
    if node.get('type') == 'hardBreak':
        return '\n'
    if node.get('type') != 'text':
        return ''.join(_inline(c) for c in (node.get('content') or []))
    t = node.get('text') or ''
    for m in (node.get('marks') or []):
        k = m.get('type')
        if k == 'bold':
            t = f'**{t}**'
        elif k == 'italic':
            t = f'*{t}*'
        elif k == 'code':
            t = f'`{t}`'
        elif k == 'link':
            t = f'[{t}]({(m.get("attrs") or {}).get("href", "")})'
    return t


def _children_md(node: dict) -> str:
    return ''.join(_inline(c) for c in (node.get('content') or []))


def to_markdown(doc: dict) -> str:
    """ProseMirror JSON → 마크다운. [@key]·[[링크]]·▸/※ 는 글자 그대로 나간다."""
    out: list = []

    def block(n: dict, indent: str = '', ordered_i: int = 0) -> None:
        t = n.get('type')
        if t == 'heading':
            lvl = int((n.get('attrs') or {}).get('level') or 1)
            out.append(f'{"#" * max(1, min(6, lvl))} {_children_md(n)}')
            out.append('')
        elif t == 'paragraph':
            out.append(indent + _children_md(n))
            out.append('')
        elif t == 'blockquote':
            for c in (n.get('content') or []):
                out.append('> ' + _children_md(c))
            out.append('')
        elif t == 'codeBlock':
            lang = (n.get('attrs') or {}).get('language') or ''
            out.append(f'```{lang}')
            out.append(plain_text(n).rstrip('\n'))
            out.append('```')
            out.append('')
        elif t in ('bulletList', 'orderedList'):
            for i, li in enumerate(n.get('content') or [], 1):
                mark = f'{i}.' if t == 'orderedList' else '-'
                inner = [_children_md(c) for c in (li.get('content') or [])
                         if c.get('type') == 'paragraph']
                out.append(f'{indent}{mark} ' + (inner[0] if inner else ''))
                for sub in (li.get('content') or []):
                    if sub.get('type') in ('bulletList', 'orderedList'):
                        block(sub, indent + '  ')
            out.append('')
        elif t == 'table':
            rows = n.get('content') or []
            for ri, row in enumerate(rows):
                cells = [_children_md((c.get('content') or [{}])[0] if c.get('content') else {})
                         for c in (row.get('content') or [])]
                out.append('| ' + ' | '.join(cells) + ' |')
                if ri == 0:
                    out.append('| ' + ' | '.join(['---'] * len(cells)) + ' |')
            out.append('')
        elif t == 'horizontalRule':
            out.append('---')
            out.append('')
        else:
            txt = plain_text(n).strip()
            if txt:
                out.append(txt)
                out.append('')

    for n in (doc.get('content') or []):
        block(n)
    md = '\n'.join(out).rstrip() + '\n'
    return re.sub(r'\n{3,}', '\n\n', md)


# ── 마크다운에서 들여오기 (연구일지·선행논문 노트를 문서로 끌어온다) ──
TABLE_SEP = re.compile(r'^\s*\|?[\s:|-]+\|[\s:|-]*$')
INLINE_RE = re.compile(r'(\*\*[^*]+\*\*|(?<!\*)\*[^*\n]+\*|`[^`\n]+`)')


def _text_nodes(s: str) -> list:
    """굵게·기울임·코드만 살린다. [@key]·[[링크]]·▸/※ 는 건드리지 않는다."""
    nodes = []
    for piece in INLINE_RE.split(s):
        if not piece:
            continue
        if piece.startswith('**') and piece.endswith('**') and len(piece) > 4:
            nodes.append({'type': 'text', 'text': piece[2:-2], 'marks': [{'type': 'bold'}]})
        elif piece.startswith('*') and piece.endswith('*') and len(piece) > 2:
            nodes.append({'type': 'text', 'text': piece[1:-1], 'marks': [{'type': 'italic'}]})
        elif piece.startswith('`') and piece.endswith('`') and len(piece) > 2:
            nodes.append({'type': 'text', 'text': piece[1:-1], 'marks': [{'type': 'code'}]})
        else:
            nodes.append({'type': 'text', 'text': piece})
    return nodes or []


def _cell(s: str, header: bool) -> dict:
    return {'type': 'tableHeader' if header else 'tableCell',
            'attrs': {'colspan': 1, 'rowspan': 1, 'colwidth': None},
            'content': [{'type': 'paragraph', 'content': _text_nodes(s)} if s
                        else {'type': 'paragraph'}]}


def from_markdown(text: str) -> dict:
    """마크다운 → ProseMirror JSON. 이 볼트가 실제로 쓰는 것만 다룬다."""
    content: list = []
    lines = text.splitlines()
    i, n = 0, len(lines)
    while i < n:
        ln, st = lines[i], lines[i].strip()
        if not st:
            i += 1
            continue
        if st.startswith('```'):
            buf = []
            i += 1
            while i < n and not lines[i].strip().startswith('```'):
                buf.append(lines[i])
                i += 1
            i += 1
            content.append({'type': 'codeBlock',
                            'content': [{'type': 'text', 'text': '\n'.join(buf)}] if buf else []})
            continue
        if st.startswith('<!--'):                      # 주석은 문단으로 보존한다
            buf = [st]
            while i < n and '-->' not in lines[i]:
                i += 1
                if i < n:
                    buf.append(lines[i].strip())
            i += 1
            content.append({'type': 'paragraph', 'content': _text_nodes(' '.join(buf))})
            continue
        m = re.match(r'^(#{1,6})\s+(.*)$', st)
        if m:
            content.append({'type': 'heading', 'attrs': {'level': len(m.group(1))},
                            'content': _text_nodes(m.group(2))})
            i += 1
            continue
        if st.startswith('|'):
            rows = []
            while i < n and lines[i].strip().startswith('|'):
                if not TABLE_SEP.match(lines[i]):
                    rows.append([c.strip() for c in lines[i].strip().strip('|').split('|')])
                i += 1
            if rows:
                w = max(len(r) for r in rows)
                trs = []
                for ri, r in enumerate(rows):
                    cells = [_cell(r[ci] if ci < len(r) else '', ri == 0) for ci in range(w)]
                    trs.append({'type': 'tableRow', 'content': cells})
                content.append({'type': 'table', 'content': trs})
            continue
        if st.startswith('>'):
            content.append({'type': 'blockquote', 'content': [
                {'type': 'paragraph', 'content': _text_nodes(st.lstrip('> ').strip())}]})
            i += 1
            continue
        m = re.match(r'^[-*+]\s+(.*)$', st)
        if m:
            items = []
            while i < n and re.match(r'^[-*+]\s+', lines[i].strip()):
                items.append({'type': 'listItem', 'content': [
                    {'type': 'paragraph',
                     'content': _text_nodes(re.sub(r'^[-*+]\s+', '', lines[i].strip()))}]})
                i += 1
            content.append({'type': 'bulletList', 'content': items})
            continue
        m = re.match(r'^\d+[.)]\s+(.*)$', st)
        if m:
            items = []
            while i < n and re.match(r'^\d+[.)]\s+', lines[i].strip()):
                items.append({'type': 'listItem', 'content': [
                    {'type': 'paragraph',
                     'content': _text_nodes(re.sub(r'^\d+[.)]\s+', '', lines[i].strip()))}]})
                i += 1
            content.append({'type': 'orderedList', 'content': items})
            continue
        if re.match(r'^(-{3,}|\*{3,}|_{3,})$', st):
            content.append({'type': 'horizontalRule'})
            i += 1
            continue
        content.append({'type': 'paragraph', 'content': _text_nodes(st)})
        i += 1
    return {'type': 'doc', 'content': content or [{'type': 'paragraph'}]}


# ═══════════════════════════════════════════════
# 버전 — 되돌릴 수 있어야 고치는 것이 무섭지 않다
# ═══════════════════════════════════════════════
def push_version(d: dict, label: str, by: str) -> None:
    """지금 본문을 스냅샷으로 남긴다. 본문과 따로 둬서 문서 파일이 붓지 않게 한다."""
    STORE.mkdir(parents=True, exist_ok=True)
    rec = {'v': d.get('version', 1), 'at': _now(), 'by': by, 'label': label,
           'words': d.get('words', 0), 'doc': d.get('doc') or EMPTY_DOC}
    with _vpath(d['id']).open('a', encoding='utf-8') as f:
        f.write(json.dumps(rec, ensure_ascii=False) + '\n')
    # 너무 길어지면 앞을 잘라낸다
    lines = _vpath(d['id']).read_text(encoding='utf-8').splitlines()
    if len(lines) > MAX_VERSIONS:
        _vpath(d['id']).write_text('\n'.join(lines[-MAX_VERSIONS:]) + '\n', encoding='utf-8')


def versions(doc_id: str) -> list:
    fp = _vpath(doc_id)
    if not fp.is_file():
        return []
    out = []
    for line in fp.read_text(encoding='utf-8').splitlines():
        try:
            r = json.loads(line)
        except ValueError:
            continue
        out.append({k: r.get(k) for k in ('v', 'at', 'by', 'label', 'words')})
    return list(reversed(out))


def version_doc(doc_id: str, v: int) -> dict | None:
    fp = _vpath(doc_id)
    if not fp.is_file():
        return None
    for line in reversed(fp.read_text(encoding='utf-8').splitlines()):
        try:
            r = json.loads(line)
        except ValueError:
            continue
        if r.get('v') == v:
            return r.get('doc')
    return None


# ═══════════════════════════════════════════════
# 라우트 — CRUD
# ═══════════════════════════════════════════════
@bp.route('')
@bp.route('/')
def api_list():
    trashed = request.args.get('trashed') in ('1', 'true')
    rows = listing(include_trashed=True)
    folders = sorted({r['folder'] for r in rows if r['folder'] and not r['trashed']})
    return jsonify({'status': 'ok',
                    'docs': [r for r in rows if bool(r['trashed']) == trashed],
                    'folders': folders,
                    'trash': len([r for r in rows if r['trashed']]),
                    'store': 'Server/documents'})


@bp.route('', methods=['POST'])
@bp.route('/', methods=['POST'])
def api_create():
    d = request.json or {}
    title = (d.get('title') or '').strip() or '제목 없는 문서'
    doc = d.get('doc')
    if not doc and d.get('markdown'):
        doc = from_markdown(d['markdown'])
    doc = doc or EMPTY_DOC
    row = {
        'id': _new_id(), 'title': title, 'folder': (d.get('folder') or '').strip(),
        'trashed': False, 'created': _now(), 'updated': _now(), 'version': 1,
        'doc': doc, 'words': word_count(doc), 'comments': [],
        'origin': {'by': d.get('by') or 'user', 'model': d.get('model') or '',
                   'sources': d.get('sources') or []},
    }
    save(row)
    push_version(row, '처음 만듦', row['origin']['by'])
    return jsonify({'status': 'ok', **row})


@bp.route('/<doc_id>')
def api_get(doc_id):
    d = load(doc_id)
    if not d:
        return jsonify({'status': 'error', 'error': '없는 문서입니다'}), 404
    return jsonify({'status': 'ok', **d, 'versions': versions(doc_id)})


@bp.route('/<doc_id>', methods=['PUT', 'PATCH'])
def api_update(doc_id):
    d = load(doc_id)
    if not d:
        return jsonify({'status': 'error', 'error': '없는 문서입니다'}), 404
    body = request.json or {}

    # 다른 탭이 먼저 고쳤으면 덮지 않는다 — 어느 쪽이 사라졌는지 모르게 되면 안 된다
    base = body.get('base_version')
    if base is not None and int(base) != int(d.get('version', 1)):
        return jsonify({'status': 'error', 'conflict': True,
                        'error': f'다른 곳에서 먼저 저장했습니다 (내 판 {base} · 지금 {d.get("version")})',
                        'current': d}), 409

    changed = False
    if 'title' in body:
        t = (body['title'] or '').strip()
        if t and t != d.get('title'):
            d['title'] = t
            changed = True
    if 'folder' in body:
        d['folder'] = (body['folder'] or '').strip()
        changed = True
    if 'doc' in body and isinstance(body['doc'], dict):
        if json.dumps(body['doc'], sort_keys=True) != json.dumps(d.get('doc') or {}, sort_keys=True):
            push_version(d, body.get('label') or '저장 전', body.get('by') or 'user')
            d['doc'] = body['doc']
            d['words'] = word_count(body['doc'])
            d['version'] = int(d.get('version', 1)) + 1
            changed = True
    if changed:
        d['updated'] = _now()
        save(d)
    return jsonify({'status': 'ok', 'id': d['id'], 'version': d['version'],
                    'words': d['words'], 'updated': d['updated'], 'changed': changed})


@bp.route('/<doc_id>', methods=['DELETE'])
def api_delete(doc_id):
    """기본은 휴지통이다. 진짜 지우는 것은 hard=1 을 받았을 때만 — 화면이 한 번 더 묻는다."""
    d = load(doc_id)
    if not d:
        return jsonify({'status': 'error', 'error': '없는 문서입니다'}), 404
    if request.args.get('hard') in ('1', 'true'):
        _path(doc_id).unlink(missing_ok=True)
        _vpath(doc_id).unlink(missing_ok=True)
        return jsonify({'status': 'ok', 'hard': True,
                        'note': '문서와 모든 판을 지웠습니다 — 되돌릴 수 없습니다'})
    d['trashed'] = True
    d['trashed_at'] = _now()
    d['updated'] = _now()
    save(d)
    return jsonify({'status': 'ok', 'hard': False, 'note': '휴지통으로 보냈습니다'})


@bp.route('/<doc_id>/restore', methods=['POST'])
def api_restore(doc_id):
    d = load(doc_id)
    if not d:
        return jsonify({'status': 'error', 'error': '없는 문서입니다'}), 404
    d['trashed'] = False
    d.pop('trashed_at', None)
    d['updated'] = _now()
    save(d)
    return jsonify({'status': 'ok', 'id': doc_id})


@bp.route('/<doc_id>/duplicate', methods=['POST'])
def api_duplicate(doc_id):
    d = load(doc_id)
    if not d:
        return jsonify({'status': 'error', 'error': '없는 문서입니다'}), 404
    row = dict(d)
    row['id'] = _new_id()
    row['title'] = f'{d.get("title")} (사본)'
    row['created'] = row['updated'] = _now()
    row['version'] = 1
    row['comments'] = []          # 댓글은 따라가지 않는다 — 어느 글의 댓글인지 흐려진다
    save(row)
    push_version(row, '사본으로 만듦', 'user')
    return jsonify({'status': 'ok', **row})


# ── 버전 ──
@bp.route('/<doc_id>/versions')
def api_versions(doc_id):
    if not load(doc_id):
        return jsonify({'status': 'error', 'error': '없는 문서입니다'}), 404
    return jsonify({'status': 'ok', 'versions': versions(doc_id)})


@bp.route('/<doc_id>/versions/<int:v>')
def api_version_one(doc_id, v):
    doc = version_doc(doc_id, v)
    if doc is None:
        return jsonify({'status': 'error', 'error': f'{v} 판을 찾지 못했습니다'}), 404
    return jsonify({'status': 'ok', 'v': v, 'doc': doc, 'markdown': to_markdown(doc)})


@bp.route('/<doc_id>/revert', methods=['POST'])
def api_revert(doc_id):
    """옛 판으로 되돌린다. 지우지 않고 **새 판으로 쌓는다** — 되돌린 것도 되돌릴 수 있다."""
    d = load(doc_id)
    if not d:
        return jsonify({'status': 'error', 'error': '없는 문서입니다'}), 404
    v = int((request.json or {}).get('v') or 0)
    doc = version_doc(doc_id, v)
    if doc is None:
        return jsonify({'status': 'error', 'error': f'{v} 판을 찾지 못했습니다'}), 404
    push_version(d, f'{v} 판으로 되돌리기 직전', 'user')
    d['doc'] = doc
    d['words'] = word_count(doc)
    d['version'] = int(d.get('version', 1)) + 1
    d['updated'] = _now()
    save(d)
    return jsonify({'status': 'ok', 'version': d['version'],
                    'note': f'{v} 판으로 되돌렸습니다 — 직전 모습도 판으로 남아 있습니다'})


# ── 댓글 ──
@bp.route('/<doc_id>/comments')
def api_comments(doc_id):
    d = load(doc_id)
    if not d:
        return jsonify({'status': 'error', 'error': '없는 문서입니다'}), 404
    return jsonify({'status': 'ok', 'comments': d.get('comments') or []})


@bp.route('/<doc_id>/comments', methods=['POST'])
def api_comment_add(doc_id):
    d = load(doc_id)
    if not d:
        return jsonify({'status': 'error', 'error': '없는 문서입니다'}), 404
    b = request.json or {}
    body = (b.get('body') or '').strip()
    if not body:
        return jsonify({'status': 'error', 'error': '댓글 내용이 비었습니다'}), 400
    c = {'id': uuid.uuid4().hex[:10], 'body': body,
         'quote': (b.get('quote') or '')[:300],
         'by': b.get('by') or 'user', 'kind': b.get('kind') or '',
         'resolved': False, 'created': _now(), 'replies': []}
    d.setdefault('comments', []).append(c)
    d['updated'] = _now()
    save(d)
    return jsonify({'status': 'ok', 'comment': c})


@bp.route('/<doc_id>/comments/<cid>', methods=['PATCH', 'DELETE'])
def api_comment_edit(doc_id, cid):
    d = load(doc_id)
    if not d:
        return jsonify({'status': 'error', 'error': '없는 문서입니다'}), 404
    rows = d.get('comments') or []
    hit = next((c for c in rows if c.get('id') == cid), None)
    if not hit:
        return jsonify({'status': 'error', 'error': '없는 댓글입니다'}), 404
    if request.method == 'DELETE':
        d['comments'] = [c for c in rows if c.get('id') != cid]
    else:
        b = request.json or {}
        if 'resolved' in b:
            hit['resolved'] = bool(b['resolved'])
        if (b.get('body') or '').strip():
            hit['body'] = b['body'].strip()
        if (b.get('reply') or '').strip():
            hit.setdefault('replies', []).append(
                {'id': uuid.uuid4().hex[:8], 'body': b['reply'].strip(),
                 'by': b.get('by') or 'user', 'created': _now()})
    d['updated'] = _now()
    save(d)
    return jsonify({'status': 'ok', 'comments': d.get('comments') or []})


# ── AI 검토 — 댓글로만 남긴다 ──
#   doc.py 가 .md 에 대해 하던 것과 **같은 검사**를 이 저장소에도 건다. 검사 규칙을
#   두 벌로 두지 않는다 — 한쪽만 고치면 어느 쪽이 맞는지 알 수 없게 된다.
#   본문은 글자 하나도 바꾸지 않는다. 지적만 댓글로 쌓인다.
@bp.route('/<doc_id>/review', methods=['POST'])
def api_review(doc_id):
    d = load(doc_id)
    if not d:
        return jsonify({'status': 'error', 'error': '없는 문서입니다'}), 404

    import ask
    import doc as D
    import llm

    body = request.json or {}
    limit = max(1, min(12, int(body.get('limit') or 8)))
    explain = bool(body.get('explain', True))
    engine = body.get('engine')

    # 문단만 본다. 제목·표·코드·인용블록은 검토 대상이 아니다.
    paras = []
    for n in (d.get('doc') or {}).get('content') or []:
        if n.get('type') != 'paragraph':
            continue
        t = plain_text(n).strip()
        if len(t) >= 40:
            paras.append(t)
    paras = paras[:limit]
    if not paras:
        return jsonify({'status': 'ok', 'checked': 0, 'added': 0, 'by_kind': {},
                        'comments': d.get('comments') or [],
                        'note': '검토할 문단이 없습니다 (40자 이상 본문 기준)'})

    rows = d.setdefault('comments', [])
    have = {(c.get('quote'), c.get('body')) for c in rows}
    added = []

    for p in paras:
        problems = []
        hits, err = ask.retrieve(p[:400], 3)          # ① 근거 — 검색이 판단한다
        if not err:
            best = hits[0]['sim'] if hits else 0
            if best < ask.MIN_SIM:
                problems.append(('evidence',
                                 f'색인에서 이 문단을 뒷받침할 대목을 찾지 못했습니다 '
                                 f'(최고 유사도 {best} < {ask.MIN_SIM}). '
                                 f'근거 없이 쓰고 있는 문장일 수 있습니다'))
        for m in D._cite_problems(p):                 # ② 인용 표기
            problems.append(('citation', m))
        for m in D._term_problems(p):                 # ③ 용어
            problems.append(('term', m))

        for kind, msg in problems:
            text = msg
            if explain and kind != 'evidence':
                r = llm.complete(system=D.REVIEW_SYS,
                                 messages=[{'role': 'user',
                                            'content': f'문단:\n{p[:800]}\n\n지적할 점: {msg}'}],
                                 engine=engine, prefill=D.REVIEW_PREFILL,
                                 max_tokens=200, timeout=int(body.get('timeout') or 180))
                if r['ok'] and r['text'].strip():
                    text = f'{msg}\n{r["text"].strip()}'
            quote = p[:200]
            if (quote, text) in have:
                continue                               # 같은 지적을 두 번 달지 않는다
            rows.append({'id': uuid.uuid4().hex[:10], 'body': text, 'quote': quote,
                         'by': 'ai', 'kind': kind, 'resolved': False,
                         'created': _now(), 'replies': []})
            have.add((quote, text))
            added.append(kind)

    d['updated'] = _now()
    save(d)                                            # version 은 올리지 않는다 — 본문이 안 바뀌었다
    return jsonify({'status': 'ok', 'checked': len(paras), 'added': len(added),
                    'by_kind': {k: added.count(k) for k in set(added)},
                    'comments': rows,
                    'note': ('본문은 바뀌지 않았습니다 — 지적만 댓글로 달렸습니다'
                             if added else '지적할 것을 찾지 못했습니다')})


# ── 내보내기 (Obsidian·Pandoc 으로 돌아가는 문) ──
@bp.route('/<doc_id>/markdown')
def api_markdown(doc_id):
    d = load(doc_id)
    if not d:
        return jsonify({'status': 'error', 'error': '없는 문서입니다'}), 404
    return jsonify({'status': 'ok', 'title': d.get('title'),
                    'markdown': to_markdown(d.get('doc') or EMPTY_DOC)})


@bp.route('/<doc_id>/docx')
def api_docx(doc_id):
    """Word 로 내려받는다. 마크다운을 거쳐 export.md_to_docx 를 그대로 쓴다 —
    변환기를 두 벌 두지 않는다."""
    import io

    from flask import send_file

    import export as E

    d = load(doc_id)
    if not d:
        return jsonify({'status': 'error', 'error': '없는 문서입니다'}), 404

    tpl = None
    name = request.args.get('template')
    if name:
        cand = (ROOT / 'GFM_Research' / E.TEMPLATE_DIR / name)
        tpl = cand if cand.is_file() else None

    title = d.get('title') or '문서'
    blob, skipped = E.md_to_docx(to_markdown(d.get('doc') or EMPTY_DOC), title, tpl)
    out = io.BytesIO(blob)
    out.seek(0)
    resp = send_file(out, as_attachment=True, download_name=f'{title}.docx',
                     mimetype='application/vnd.openxmlformats-officedocument'
                              '.wordprocessingml.document')
    if skipped:                       # 못 옮긴 것은 헤더로 알린다 — 모르고 지나가면 안 된다
        resp.headers['X-Export-Skipped'] = str(len(skipped))
    return resp
