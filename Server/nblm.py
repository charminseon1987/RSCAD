"""
Server/nblm.py — NotebookLM 연동 (연구실 스콜라 ④단계 읽기 보조)

  NotebookLM 은 공개 REST API 가 없다. 대신 로컬에 설치된 MCP 서버
  (`notebooklm-mcp`, stdio)를 백엔드가 직접 붙잡고 JSON-RPC 로 부린다.
  Claude Code 없이도 웹 화면에서 인포그래픽·마인드맵·오디오·리포트를 만든다.

  흐름
    ⓪ 인증   터미널에서 `notebooklm-mcp-auth` 한 번 (Chrome 로그인, 쿠키 보관)
    ① 노트북  논문 하나 = 노트북 하나 (cite_key 로 제목)
    ② 소스    논문 URL + 서지·초록 텍스트 + (있으면) 저장된 PDF 본문
    ③ 생성    infographic / mindmap / audio / report / slides
    ④ 확인    studio_status 로 URL 을 받아 노트에 적는다

  원칙: 여기서 나온 것은 전부 AI 생성물이다. 노트에는 ※ 로만 적고
  ▸(원문 근거)로 승격하지 않는다 — 인용은 원문을 본 뒤에.
"""

from __future__ import annotations

import datetime
import json
import shutil
import subprocess
import threading
from pathlib import Path

from flask import Blueprint, jsonify, request

from scholar import (VAULT, find_item, load_inbox, load_settings, safe_vault_path,
                     save_inbox)

bp = Blueprint('scholar_nblm', __name__, url_prefix='/api/scholar/nblm')

CMD = 'notebooklm-mcp'
AUTH_CMD = 'notebooklm-mcp-auth'

# 스튜디오 산출물 — 화면의 버튼 하나가 MCP 도구 하나에 대응한다
KINDS = {
    'infographic': {'tool': 'infographic_create', 'label': '인포그래픽',
                    'args': {'orientation': 'landscape', 'detail_level': 'standard'}},
    'mindmap':     {'tool': 'mind_map_create', 'label': '마인드맵', 'args': {}},
    'report':      {'tool': 'report_create', 'label': '리포트',
                    'args': {'report_format': 'Briefing Doc'}},
    'audio':       {'tool': 'audio_overview_create', 'label': '오디오 개요',
                    'args': {'format': 'deep_dive', 'length': 'default'}},
    'slides':      {'tool': 'slide_deck_create', 'label': '슬라이드', 'args': {}},
}


# ═══════════════════════════════════════════════
# MCP stdio 클라이언트 — 프로세스 하나를 붙잡고 재사용한다
# ═══════════════════════════════════════════════
class MCPError(RuntimeError):
    pass


class NblmClient:
    def __init__(self, cmd: str = CMD):
        self.cmd = cmd
        self.proc: subprocess.Popen | None = None
        self.lock = threading.Lock()
        self._id = 0

    def available(self) -> bool:
        return shutil.which(self.cmd) is not None

    def _spawn(self):
        self.proc = subprocess.Popen(
            [self.cmd], stdin=subprocess.PIPE, stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL, text=True, encoding='utf-8', bufsize=1)
        self._send({'jsonrpc': '2.0', 'id': 0, 'method': 'initialize', 'params': {
            'protocolVersion': '2024-11-05', 'capabilities': {},
            'clientInfo': {'name': 'rscad-scholar', 'version': '1.0'}}})
        self._read_until(0, timeout=60)
        self._send({'jsonrpc': '2.0', 'method': 'notifications/initialized'})

    def _send(self, obj: dict):
        assert self.proc and self.proc.stdin
        self.proc.stdin.write(json.dumps(obj, ensure_ascii=False) + '\n')
        self.proc.stdin.flush()

    def _read_until(self, want_id: int, timeout: float):
        """id 가 맞는 응답만 집어낸다. 알림(notification)은 흘려보낸다."""
        assert self.proc and self.proc.stdout
        box: dict = {}

        def reader():
            for line in self.proc.stdout:            # type: ignore[union-attr]
                line = line.strip()
                if not line:
                    continue
                try:
                    msg = json.loads(line)
                except json.JSONDecodeError:
                    continue
                if msg.get('id') == want_id:
                    box['msg'] = msg
                    return

        t = threading.Thread(target=reader, daemon=True)
        t.start()
        t.join(timeout)
        if 'msg' not in box:
            raise MCPError(f'NotebookLM 응답이 {int(timeout)}초 안에 오지 않았습니다')
        return box['msg']

    def call(self, tool: str, args: dict, timeout: float = 120) -> dict:
        """도구 하나 호출. 결과는 structuredContent(dict) 우선."""
        if not self.available():
            raise MCPError(f'{self.cmd} 를 찾을 수 없습니다 — NotebookLM MCP 가 설치되지 않았습니다')
        with self.lock:
            if self.proc is None or self.proc.poll() is not None:
                self._spawn()
            self._id += 1
            rid = self._id
            try:
                self._send({'jsonrpc': '2.0', 'id': rid, 'method': 'tools/call',
                            'params': {'name': tool, 'arguments': args}})
                msg = self._read_until(rid, timeout)
            except (BrokenPipeError, OSError) as e:
                self.proc = None
                raise MCPError(f'NotebookLM MCP 연결이 끊겼습니다: {e}') from e

        if msg.get('error'):
            raise MCPError(str(msg['error'].get('message') or msg['error']))
        res = msg.get('result') or {}
        if isinstance(res.get('structuredContent'), dict):
            return res['structuredContent']
        for c in res.get('content') or []:
            if c.get('type') == 'text':
                try:
                    return json.loads(c['text'])
                except json.JSONDecodeError:
                    return {'status': 'ok', 'text': c['text']}
        return {'status': 'ok', 'raw': res}


client = NblmClient()

AUTH_HINT = (f'NotebookLM 인증이 없습니다 — 터미널에서 `{AUTH_CMD}` 를 한 번 실행하세요 '
             '(Chrome 로그인 후 쿠키가 보관됩니다).')


def _needs_auth(d: dict) -> bool:
    return 'authentication' in str(d.get('error', '')).lower()


def _call(tool: str, args: dict, timeout: float = 120):
    """도구 호출 + 인증 오류를 한국어로 바꿔 준다."""
    d = client.call(tool, args, timeout)
    if isinstance(d, dict) and d.get('status') == 'error' and _needs_auth(d):
        raise MCPError(AUTH_HINT)
    if isinstance(d, dict) and d.get('status') == 'error':
        raise MCPError(str(d.get('error'))[:400])
    return d


def _item_or_404(key: str):
    items = load_inbox()
    it = find_item(items, key)
    if not it:
        return None, None, (jsonify({'status': 'error', 'error': f'수집함에 없습니다: {key}'}), 404)
    return items, it, None


def _nblm(it: dict) -> dict:
    it.setdefault('nblm', {'notebook_id': '', 'title': '', 'sources': [], 'artifacts': []})
    return it['nblm']


# ═══════════════════════════════════════════════
# 상태 · 인증
# ═══════════════════════════════════════════════
@bp.route('/status')
def status():
    if not client.available():
        return jsonify({'status': 'ok', 'installed': False, 'authenticated': False,
                        'error': f'{CMD} 가 PATH 에 없습니다 — NotebookLM MCP 를 설치하세요'})
    try:
        d = client.call('notebook_list', {'max_results': 20}, timeout=90)
    except MCPError as e:
        return jsonify({'status': 'ok', 'installed': True, 'authenticated': False,
                        'error': str(e)})
    if d.get('status') == 'error':
        return jsonify({'status': 'ok', 'installed': True, 'authenticated': False,
                        'error': AUTH_HINT if _needs_auth(d) else str(d.get('error'))[:300],
                        'auth_cmd': AUTH_CMD})
    books = d.get('notebooks') or d.get('items') or []
    return jsonify({'status': 'ok', 'installed': True, 'authenticated': True,
                    'notebooks': books if isinstance(books, list) else [], 'raw': d})


@bp.route('/refresh', methods=['POST'])
def refresh():
    try:
        return jsonify({'status': 'ok', 'result': _call('refresh_auth', {}, timeout=90)})
    except MCPError as e:
        return jsonify({'status': 'error', 'error': str(e)}), 502


# ═══════════════════════════════════════════════
# 노트북 만들기 · 소스 넣기
# ═══════════════════════════════════════════════
def _pdf_text(key: str, s: dict, limit_pages: int = 30) -> tuple[str, str]:
    """③에서 저장한 PDF 본문을 뽑는다. pypdf 가 없으면 그렇다고 말한다."""
    fp = VAULT / s['pdf_dir'] / f'{key}.pdf'
    if not fp.exists():
        return '', f'저장된 PDF 가 없습니다 ({s["pdf_dir"]}/{key}.pdf) — ③에서 원본을 먼저 받으세요'
    try:
        from pypdf import PdfReader
    except ImportError:
        return '', 'pypdf 가 설치되지 않아 PDF 본문을 넣지 못했습니다 — pip install pypdf'
    try:
        text = '\n'.join((p.extract_text() or '') for p in PdfReader(str(fp)).pages[:limit_pages])
    except Exception as e:                                   # noqa: BLE001
        return '', f'PDF 를 읽지 못했습니다: {str(e)[:120]}'
    text = text.strip()
    if len(text) < 200:
        return '', 'PDF 에서 글자를 뽑지 못했습니다 (스캔본일 수 있습니다)'
    return text, ''


def _meta_text(it: dict) -> str:
    """서지·초록·내 발췌 — URL 크롤링이 실패해도 이것만은 확실히 들어간다."""
    p = it['paper']
    lines = [f'# {p.get("title") or "(제목 미확인)"}', '',
             f'- cite_key: {it["key"]}',
             f'- 저자: {p.get("authors") or "미확인"}',
             f'- 연도: {p.get("year") or "미확인"}',
             f'- 게재처: {p.get("venue") or "미확인"}',
             f'- DOI: {p.get("doi") or "미확인"}',
             f'- 링크: {p.get("landing") or p.get("pdf_url") or "미확인"}', '',
             '## 초록', p.get('abstract') or '(초록 없음)']
    hs = it.get('highlights') or []
    if hs:
        lines += ['', '## 내가 표시한 발췌 (읽으며 색으로 분류한 것)']
        lines += [f'- [{h.get("section")}] {h.get("text")}'
                  + (f' (p.{h["page"]})' if h.get('page') else '') for h in hs]
    return '\n'.join(lines)


@bp.route('/notebook', methods=['POST'])
def notebook():
    """논문 하나에 노트북 하나. URL·텍스트·PDF 본문을 소스로 넣는다."""
    d = request.json or {}
    items, it, err = _item_or_404(d.get('key', ''))
    if err:
        return err
    s = load_settings()
    nb = _nblm(it)
    reports = []

    try:
        nid = (d.get('notebook_id') or nb.get('notebook_id') or '').strip()
        if not nid:
            title = d.get('title') or f'{it["key"]} · {(it["paper"].get("title") or "")[:60]}'
            made = _call('notebook_create', {'title': title}, timeout=120)
            nid = made.get('notebook_id') or made.get('id') or (made.get('notebook') or {}).get('id')
            if not nid:
                return jsonify({'status': 'error', 'error': f'노트북 id 를 받지 못했습니다: {made}'}), 502
            nb['title'] = title
        nb['notebook_id'] = nid

        # ── URL 소스 ──
        urls = d.get('urls')
        if urls is None:
            urls = [u for u in [it['paper'].get('landing'), it['paper'].get('pdf_url')] if u]
        for u in urls:
            try:
                r = _call('notebook_add_url', {'notebook_id': nid, 'url': u}, timeout=180)
                reports.append({'kind': 'url', 'title': u, 'ok': r.get('status') != 'error',
                                'msg': r.get('message') or 'URL 소스를 넣었습니다',
                                'source_id': r.get('source_id') or ''})
            except MCPError as e:
                reports.append({'kind': 'url', 'title': u, 'ok': False, 'msg': str(e)[:200]})

        # ── 서지·초록·발췌 텍스트 ──
        if d.get('add_meta', True):
            try:
                r = _call('notebook_add_text', {'notebook_id': nid, 'text': _meta_text(it),
                                                'title': f'{it["key"]} 서지·초록·발췌'}, timeout=180)
                reports.append({'kind': 'text', 'title': '서지·초록·발췌', 'ok': r.get('status') != 'error',
                                'msg': r.get('message') or '텍스트 소스를 넣었습니다',
                                'source_id': r.get('source_id') or ''})
            except MCPError as e:
                reports.append({'kind': 'text', 'title': '서지·초록·발췌', 'ok': False, 'msg': str(e)[:200]})

        # ── 저장된 PDF 본문 ──
        if d.get('add_pdf'):
            text, why = _pdf_text(it['key'], s)
            if not text:
                reports.append({'kind': 'pdf', 'title': 'PDF 본문', 'ok': False, 'msg': why})
            else:
                try:
                    r = _call('notebook_add_text', {
                        'notebook_id': nid, 'text': text[:400000],
                        'title': f'{it["key"]} 본문 (PDF 추출)'}, timeout=300)
                    reports.append({'kind': 'pdf', 'title': 'PDF 본문', 'ok': r.get('status') != 'error',
                                    'msg': r.get('message') or f'{len(text)}자를 넣었습니다',
                                    'source_id': r.get('source_id') or ''})
                except MCPError as e:
                    reports.append({'kind': 'pdf', 'title': 'PDF 본문', 'ok': False, 'msg': str(e)[:200]})
    except MCPError as e:
        return jsonify({'status': 'error', 'error': str(e)}), 502

    nb['sources'] = (nb.get('sources') or []) + reports
    nb['url'] = f'https://notebooklm.google.com/notebook/{nb["notebook_id"]}'
    nb['updated'] = datetime.datetime.now().isoformat(timespec='seconds')
    save_inbox(items)
    return jsonify({'status': 'ok', 'nblm': nb, 'added': reports})


@bp.route('/source', methods=['POST'])
def add_source():
    """소스 한 개 더 — JS 로 그리는 뷰어 페이지처럼 크롤링이 안 될 때 직접 붙여 넣는다."""
    d = request.json or {}
    items, it, err = _item_or_404(d.get('key', ''))
    if err:
        return err
    nb = _nblm(it)
    if not nb.get('notebook_id'):
        return jsonify({'status': 'error', 'error': '먼저 노트북을 만드세요'}), 400
    url, text = (d.get('url') or '').strip(), (d.get('text') or '').strip()
    try:
        if url:
            r = _call('notebook_add_url', {'notebook_id': nb['notebook_id'], 'url': url}, timeout=180)
            rep = {'kind': 'url', 'title': url, 'ok': r.get('status') != 'error',
                   'msg': r.get('message') or 'URL 소스를 넣었습니다'}
        elif text:
            r = _call('notebook_add_text', {'notebook_id': nb['notebook_id'], 'text': text[:400000],
                                            'title': d.get('title') or '붙여 넣은 텍스트'}, timeout=180)
            rep = {'kind': 'text', 'title': d.get('title') or '붙여 넣은 텍스트',
                   'ok': r.get('status') != 'error', 'msg': r.get('message') or '텍스트 소스를 넣었습니다'}
        else:
            return jsonify({'status': 'error', 'error': 'url 이나 text 가 필요합니다'}), 400
    except MCPError as e:
        return jsonify({'status': 'error', 'error': str(e)}), 502
    nb['sources'] = (nb.get('sources') or []) + [rep]
    save_inbox(items)
    return jsonify({'status': 'ok', 'nblm': nb, 'added': [rep]})


@bp.route('/sources')
def sources():
    """노트북이 실제로 무엇을 읽었는지 확인 — 크롤링이 빈 껍데기였는지 여기서 드러난다."""
    items, it, err = _item_or_404(request.args.get('key', ''))
    if err:
        return err
    nid = _nblm(it).get('notebook_id')
    if not nid:
        return jsonify({'status': 'ok', 'sources': []})
    try:
        return jsonify({'status': 'ok', **_call('notebook_get', {'notebook_id': nid}, timeout=120)})
    except MCPError as e:
        return jsonify({'status': 'error', 'error': str(e)}), 502


# ═══════════════════════════════════════════════
# 스튜디오 — 인포그래픽·마인드맵·오디오·리포트
# ═══════════════════════════════════════════════
@bp.route('/generate', methods=['POST'])
def generate():
    """버튼을 누른 것이 곧 사용자 승인이므로 confirm=True 로 보낸다."""
    d = request.json or {}
    items, it, err = _item_or_404(d.get('key', ''))
    if err:
        return err
    kind = d.get('kind')
    spec = KINDS.get(kind)
    if not spec:
        return jsonify({'status': 'error', 'error': f'모르는 종류: {kind}'}), 400
    nb = _nblm(it)
    if not nb.get('notebook_id'):
        return jsonify({'status': 'error', 'error': '먼저 노트북을 만드세요'}), 400

    args = {'notebook_id': nb['notebook_id'], 'confirm': True, **spec['args']}
    args.update({k: v for k, v in (d.get('options') or {}).items() if v not in (None, '')})
    if kind in ('infographic', 'report', 'audio', 'slides'):
        args.setdefault('language', d.get('language') or 'ko')
    try:
        r = _call(spec['tool'], args, timeout=300)
    except MCPError as e:
        return jsonify({'status': 'error', 'error': str(e)}), 502

    rec = {'kind': kind, 'label': spec['label'], 'status': r.get('status') or 'started',
           'artifact_id': r.get('artifact_id') or '', 'url': r.get('url') or r.get('share_url') or '',
           'msg': r.get('message') or '', 'at': datetime.datetime.now().isoformat(timespec='seconds')}
    nb['artifacts'] = [a for a in (nb.get('artifacts') or []) if a.get('kind') != kind] + [rec]
    nb['updated'] = rec['at']
    save_inbox(items)
    return jsonify({'status': 'ok', 'artifact': rec, 'nblm': nb, 'raw': r})


@bp.route('/studio')
def studio():
    """생성 상태 확인 — 오디오는 몇 분 걸리므로 화면이 여기로 폴링한다."""
    items, it, err = _item_or_404(request.args.get('key', ''))
    if err:
        return err
    nb = _nblm(it)
    if not nb.get('notebook_id'):
        return jsonify({'status': 'ok', 'artifacts': []})
    try:
        r = _call('studio_status', {'notebook_id': nb['notebook_id']}, timeout=120)
    except MCPError as e:
        return jsonify({'status': 'error', 'error': str(e)}), 502

    live = r.get('artifacts') or r.get('items') or []
    if isinstance(live, list) and live:
        nb['artifacts'] = [{
            'kind': a.get('type') or a.get('kind') or '?',
            'label': a.get('title') or a.get('type') or '산출물',
            'status': a.get('status') or 'unknown',
            'artifact_id': a.get('id') or a.get('artifact_id') or '',
            'url': a.get('url') or a.get('share_url') or '',
            'msg': a.get('message') or '',
            'at': datetime.datetime.now().isoformat(timespec='seconds'),
        } for a in live]
        save_inbox(items)
    return jsonify({'status': 'ok', 'artifacts': nb.get('artifacts') or [], 'raw': r})


@bp.route('/query', methods=['POST'])
def query():
    """노트북 안 소스에만 근거한 답. ※ 로만 쓰고 ▸ 로 승격하지 않는다."""
    d = request.json or {}
    items, it, err = _item_or_404(d.get('key', ''))
    if err:
        return err
    nb = _nblm(it)
    if not nb.get('notebook_id'):
        return jsonify({'status': 'error', 'error': '먼저 노트북을 만드세요'}), 400
    q = (d.get('question') or '').strip()
    if not q:
        return jsonify({'status': 'error', 'error': '질문이 비었습니다'}), 400
    try:
        r = _call('notebook_query', {'notebook_id': nb['notebook_id'], 'query': q}, timeout=300)
    except MCPError as e:
        return jsonify({'status': 'error', 'error': str(e)}), 502
    return jsonify({'status': 'ok',
                    'answer': r.get('answer') or r.get('response') or r.get('text') or '',
                    'raw': r})


# ═══════════════════════════════════════════════
# 노트에 적기 — AI 생성물임을 못 박고 ※ 로만
# ═══════════════════════════════════════════════
@bp.route('/to-note', methods=['POST'])
def to_note():
    d = request.json or {}
    items, it, err = _item_or_404(d.get('key', ''))
    if err:
        return err
    if not it.get('note_path'):
        return jsonify({'status': 'error', 'error': '먼저 ⑤에서 노트를 저장하세요'}), 400
    nb = _nblm(it)
    if not nb.get('notebook_id'):
        return jsonify({'status': 'error', 'error': '만들어진 NotebookLM 산출물이 없습니다'}), 400
    try:
        fp = safe_vault_path(it['note_path'])
    except ValueError:
        return jsonify({'status': 'error', 'error': '볼트 밖 경로'}), 403
    if not fp.exists():
        return jsonify({'status': 'error', 'error': f'노트가 없습니다: {it["note_path"]}'}), 404

    lines = ['## 🎧 NotebookLM (AI 생성 — 인용 금지)', '',
             f'※ 노트북: {nb.get("url") or nb.get("notebook_id")}',
             '※ 아래는 NotebookLM 이 만든 것입니다. 원문 대조 전에는 근거(▸)로 쓰지 않습니다.']
    for a in nb.get('artifacts') or []:
        lines.append(f'- {a.get("label") or a.get("kind")} — {a.get("status")}'
                     + (f' · {a["url"]}' if a.get('url') else ''))
    for extra in (d.get('notes') or []):
        lines.append(f'※ {extra}')
    block = '\n'.join(lines) + '\n'

    text = fp.read_text(encoding='utf-8')
    if '## 🎧 NotebookLM' in text:
        head, _, rest = text.partition('## 🎧 NotebookLM')
        tail = rest.split('\n---\n', 1)
        text = head + block + ('\n---\n' + tail[1] if len(tail) > 1 else '')
    else:
        text = text.rstrip() + '\n\n---\n\n' + block
    fp.write_text(text, encoding='utf-8')
    return jsonify({'status': 'ok', 'path': it['note_path'], 'appended': block})
