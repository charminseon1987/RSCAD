"""
Server/notebook.py — 노트북 화면의 두 저장소: 발췌 보관함과 산출물

  NotebookLM 식 3단 화면(소스 · 대화 · 산출물)이 쓰는 뒷단이다. 소스 목록과
  대화는 이미 있는 것을 그대로 쓴다 (scholar.py 의 수집함, ask.py 의 근거 Q&A).
  여기서 새로 맡는 것은 두 가지다.

    ① 발췌 보관함 (clips)  내 논문에 인용할 대목을 모아 둔다.
       리더에서 칠한 것, Q&A 답의 근거, 손으로 적은 것이 한곳에 쌓이고
       '내 논문 어느 절에 쓸지'를 달아 둔다 → 내논문 화면이 절별로 가져간다.

    ② 산출물 (reports)  고른 소스들을 묶어 보고서·비교표·타임라인을 만든다.
       만드는 주체는 로컬 모델(ask.ask_llm)이라 원문이 바깥으로 나가지 않는다.

  원칙(app.py·scholar.py·ask.py 와 같다): 값을 날조하지 않는다.
    - 발췌의 text 는 **원문 그대로**다. 모델이 고쳐 쓴 문장은 note(※)에 넣는다.
    - 산출물은 전부 AI 생성물이다. verified=false 로 남고, 사람이 원문을 본 뒤에만
      true 가 된다. 내보낼 때 그 표시가 함께 나간다.
    - 근거(출처·쪽)가 없는 발췌는 만들 수 없다 — cite_key 는 필수다.
"""

from __future__ import annotations

import datetime
import json
import re
import uuid

from flask import Blueprint, jsonify, request

import ask
from scholar import ROOT, VAULT, find_item, load_inbox, safe_vault_path

bp = Blueprint('notebook', __name__, url_prefix='/api/notebook')

CLIPS_PATH = ROOT / 'Server' / 'paper_clips.json'
REPORTS_PATH = ROOT / 'Server' / 'paper_reports.json'

# 내 논문의 절. MyPaper.tsx 의 SECTIONS 와 같은 기호를 쓴다 — 두 화면이
# 같은 말을 해야 '어느 절에 쓸 발췌인지'가 통한다.
PAPER_SECTIONS = [
    {'id': 'I', 'title': 'Introduction'},
    {'id': 'II', 'title': 'System Model'},
    {'id': 'III', 'title': 'Methodology'},
    {'id': 'IV', 'title': 'Results'},
    {'id': 'V', 'title': 'Conclusion'},
    {'id': '?', 'title': '미정'},
]
SECTION_IDS = {s['id'] for s in PAPER_SECTIONS}

# 발췌의 쓰임새. 노트의 ▸/※ 구분과 같은 뜻이다.
CLIP_KINDS = {
    'quote': '직접 인용 (따옴표로 쓸 문장)',
    'number': '수치 · 조건 (조건과 단위까지)',
    'claim': '주장 · 결론 (바꿔 쓸 근거)',
    'method': '방법 · 수식',
    'gap': '한계 · 공백 (내 차별점의 근거)',
}


# ═══════════════════════════════════════════════
# 공통 — 작은 JSON 저장소
# ═══════════════════════════════════════════════
def _load(path, key):
    if path.exists():
        try:
            return json.loads(path.read_text(encoding='utf-8')).get(key, [])
        except Exception:                                    # noqa: BLE001
            return []
    return []


def _save(path, key, rows):
    path.write_text(json.dumps({key: rows}, ensure_ascii=False, indent=2), encoding='utf-8')


def load_clips() -> list:
    return _load(CLIPS_PATH, 'clips')


def save_clips(rows: list) -> None:
    _save(CLIPS_PATH, 'clips', rows)


def load_reports() -> list:
    return _load(REPORTS_PATH, 'reports')


def save_reports(rows: list) -> None:
    _save(REPORTS_PATH, 'reports', rows)


def _now() -> str:
    return datetime.datetime.now().isoformat(timespec='seconds')


# ═══════════════════════════════════════════════
# ① 발췌 보관함 — 내 논문에 쓸 대목
# ═══════════════════════════════════════════════
@bp.route('/clips')
def api_clips_list():
    """절·논문으로 걸러 돌려준다. 내논문 화면이 절별로 가져가는 입구다."""
    rows = load_clips()
    sec = request.args.get('section')
    key = request.args.get('key')
    if sec:
        rows = [c for c in rows if (c.get('section') or '?') == sec]
    if key:
        rows = [c for c in rows if c.get('cite_key') == key]
    by_section = {s['id']: 0 for s in PAPER_SECTIONS}
    for c in load_clips():
        by_section[c.get('section') or '?'] = by_section.get(c.get('section') or '?', 0) + 1
    return jsonify({'status': 'ok', 'clips': rows, 'total': len(load_clips()),
                    'by_section': by_section, 'sections': PAPER_SECTIONS,
                    'kinds': CLIP_KINDS, 'path': 'Server/paper_clips.json'})


@bp.route('/clips', methods=['POST'])
def api_clips_add():
    """발췌 하나를 보관한다. 출처 없는 발췌는 받지 않는다."""
    d = request.json or {}
    key = (d.get('cite_key') or '').strip()
    text = (d.get('text') or '').strip()
    if not key:
        return jsonify({'status': 'error', 'error': 'cite_key 가 필요합니다 — '
                                                    '출처 없는 발췌는 인용할 수 없습니다'}), 400
    if not text:
        return jsonify({'status': 'error', 'error': '발췌가 비었습니다'}), 400

    rows = load_clips()
    # 같은 논문·같은 문장을 두 번 담지 않는다
    sig = (key, re.sub(r'\s+', ' ', text)[:200])
    for c in rows:
        if (c.get('cite_key'), re.sub(r'\s+', ' ', c.get('text') or '')[:200]) == sig:
            return jsonify({'status': 'ok', 'clip': c, 'clips': rows,
                            'note': '이미 보관된 발췌입니다'})

    sec = d.get('section') if d.get('section') in SECTION_IDS else '?'
    clip = {
        'id': uuid.uuid4().hex[:10],
        'cite_key': key,
        'doc': (d.get('doc') or '').strip(),        # 색인 문서명 (PDF 파일명)
        'page': str(d.get('page') or '').strip(),
        'text': text[:4000],                        # 원문 그대로 — 고치지 않는다
        'note': (d.get('note') or '').strip()[:1000],   # ※ 내 판단
        'section': sec,
        'kind': d.get('kind') if d.get('kind') in CLIP_KINDS else 'quote',
        'source': d.get('source') or 'manual',      # reader · ask · manual
        'sim': d.get('sim'),
        'used': False,                              # 초안에 넣었는지
        'created': _now(),
    }
    rows.append(clip)
    save_clips(rows)
    return jsonify({'status': 'ok', 'clip': clip, 'clips': rows})


CLIP_EDITABLE = ('section', 'kind', 'note', 'used', 'text', 'page')


@bp.route('/clips/<cid>', methods=['PATCH', 'DELETE'])
def api_clips_edit(cid):
    rows = load_clips()
    i = next((n for n, c in enumerate(rows) if c['id'] == cid), None)
    if i is None:
        return jsonify({'status': 'error', 'error': f'발췌가 없습니다: {cid}'}), 404
    if request.method == 'DELETE':
        rows.pop(i)
    else:
        d = request.json or {}
        for f in CLIP_EDITABLE:
            if f in d:
                if f == 'section' and d[f] not in SECTION_IDS:
                    continue
                if f == 'kind' and d[f] not in CLIP_KINDS:
                    continue
                rows[i][f] = d[f]
    save_clips(rows)
    return jsonify({'status': 'ok', 'clips': rows})


def _ieee_ish(key: str) -> str:
    """수집함 서지로 한 줄 참고문헌. 확인 못 한 값은 '미명시' 로 둔다."""
    it = find_item(load_inbox(), key)
    if not it:
        return f'{key} — 수집함에 없습니다 (서지 미확인)'
    p = it['paper']
    bits = [p.get('authors') or '미명시', f'"{p.get("title") or "미명시"}"',
            p.get('venue') or '미명시', str(p.get('year') or '미명시')]
    if p.get('doi'):
        bits.append(f'doi: {p["doi"]}')
    return ', '.join(bits)


@bp.route('/clips/export')
def api_clips_export():
    """내 논문에서 쓸 형태로 내보낸다.

    md   — 절별 · 논문별로 묶은 마크다운 (▸ 원문 / ※ 내 판단)
    pandoc — 문장 뒤에 [@citekey] 가 붙은 초안 재료
    """
    fmt = request.args.get('format', 'md')
    sec = request.args.get('section')
    rows = load_clips()
    if sec:
        rows = [c for c in rows if (c.get('section') or '?') == sec]
    if not rows:
        return jsonify({'status': 'ok', 'format': fmt, 'text': '(보관된 발췌가 없습니다)',
                        'n': 0})

    order = {s['id']: n for n, s in enumerate(PAPER_SECTIONS)}
    rows = sorted(rows, key=lambda c: (order.get(c.get('section') or '?', 99),
                                       c.get('cite_key') or '', c.get('page') or ''))
    out = []
    cur_sec = cur_key = None
    for c in rows:
        s = c.get('section') or '?'
        if s != cur_sec:
            title = next((x['title'] for x in PAPER_SECTIONS if x['id'] == s), '미정')
            out += ['', f'## {s}. {title}', '']
            cur_sec, cur_key = s, None
        if c['cite_key'] != cur_key:
            cur_key = c['cite_key']
            out += [f'### [[{cur_key}]] — {_ieee_ish(cur_key)}', '']
        anchor = f' → [[{c["doc"] or c["cite_key"]}.pdf#page={c["page"]}]]' if c.get('page') else ''
        if fmt == 'pandoc':
            out.append(f'{c["text"]} [@{c["cite_key"]}]')
        else:
            out.append(f'- ▸ ({CLIP_KINDS.get(c["kind"], c["kind"])}) {c["text"]}{anchor}')
        if (c.get('note') or '').strip():
            out.append(f'  - ※ {c["note"].strip()}')
        out.append('')
    head = ['# 내 논문 인용 자료', '',
            '> ▸ 는 원문 그대로, ※ 는 내 판단입니다. 쪽 앵커를 눌러 원문과 대조한 뒤 쓰세요.', '']
    return jsonify({'status': 'ok', 'format': fmt, 'n': len(rows),
                    'text': '\n'.join(head + out).strip() + '\n'})


@bp.route('/clips/to-draft', methods=['POST'])
def api_clips_to_draft():
    """고른 발췌를 초안 파일에 붙인다. 문장은 사용자가 쓴 것만 들어간다 —
    여기서 붙는 것은 원문 발췌와 [@citekey] 뿐이다."""
    from scholar import load_settings
    d = request.json or {}
    ids = set(d.get('ids') or [])
    rows = [c for c in load_clips() if c['id'] in ids] if ids else load_clips()
    if not rows:
        return jsonify({'status': 'error', 'error': '붙일 발췌가 없습니다'}), 400
    s = load_settings()
    try:
        fp = safe_vault_path(d.get('draft_path') or s['draft_path'])
    except ValueError:
        return jsonify({'status': 'error', 'error': '볼트 밖 경로'}), 403
    fp.parent.mkdir(parents=True, exist_ok=True)
    head = '' if fp.exists() else ('# 초안\n\n> lab-scholar 7단계에서 쌓인 문단. '
                                   '인용은 `[@citekey]` — Pandoc 이 읽는 형식입니다.\n')
    lines = [f'\n## {datetime.date.today().isoformat()} · 인용 자료 {len(rows)}건\n']
    for c in rows:
        anchor = f' → [[{c["doc"] or c["cite_key"]}.pdf#page={c["page"]}]]' if c.get('page') else ''
        lines.append(f'- ▸ {c["text"]} [@{c["cite_key"]}]{anchor}')
        if (c.get('note') or '').strip():
            lines.append(f'  - ※ {c["note"].strip()}')
    block = '\n'.join(lines) + '\n'
    with open(fp, 'a', encoding='utf-8') as f:
        f.write(head + block)

    marked = {c['id'] for c in rows}
    allrows = load_clips()
    for c in allrows:
        if c['id'] in marked:
            c['used'] = True
    save_clips(allrows)
    return jsonify({'status': 'ok', 'path': fp.relative_to(VAULT).as_posix(),
                    'n': len(rows), 'clips': allrows})


# ═══════════════════════════════════════════════
# ③ 합치기 — 일지 문단을 논문 절로
#   **파일을 쓰지 않는다.** 합친 본문을 돌려주기만 하고, 저장은 사람이 편집기에서
#   보고 누른다. 자동으로 써 버리면 언제 무엇이 들어갔는지 놓치고, 되돌리기도 어렵다.
# ═══════════════════════════════════════════════
SEC_HEAD = re.compile(r'^#{1,3}\s*(?:([IVX]+)\s*[.·]\s*)?(.+?)\s*$', re.M)


def section_span(text: str, sec_id: str) -> tuple:
    """논문에서 그 절의 (시작, 끝) 위치. 없으면 (-1, -1).

    제목은 '## III. Methodology' 처럼 쓰지만 사람마다 흔들린다. 로마숫자가
    맞거나 절 이름이 들어 있으면 그 절로 본다.
    """
    title = next((s['title'] for s in PAPER_SECTIONS if s['id'] == sec_id), '')
    for m in SEC_HEAD.finditer(text):
        roman, name = m.group(1), m.group(2)
        hit = (roman and roman.upper() == sec_id.upper()) or \
              (title and title.lower() in name.lower())
        if not hit:
            continue
        nxt = SEC_HEAD.search(text, m.end())
        return m.start(), (nxt.start() if nxt else len(text))
    return -1, -1


@bp.route('/merge', methods=['POST'])
def api_merge():
    """고른 문단을 논문의 그 절 끝에 붙인 본문을 돌려준다. 저장은 하지 않는다."""
    d = request.json or {}
    paper_rel = (d.get('paper') or '').strip()
    sec = d.get('section') if d.get('section') in SECTION_IDS else None
    paras = [p for p in (d.get('paragraphs') or []) if isinstance(p, str) and p.strip()]
    if not paper_rel:
        return jsonify({'status': 'error', 'error': '논문 파일이 필요합니다'}), 400
    if not sec:
        return jsonify({'status': 'error', 'error': '논문 절을 고르세요 (I~V)'}), 400
    if not paras:
        return jsonify({'status': 'error', 'error': '밀어 넣을 문단이 없습니다'}), 400
    try:
        fp = safe_vault_path(paper_rel)
    except ValueError:
        return jsonify({'status': 'error', 'error': '볼트 밖 경로'}), 403
    if not fp.is_file():
        return jsonify({'status': 'error', 'error': f'없는 글입니다: {paper_rel}'}), 404

    text = fp.read_text(encoding='utf-8')
    block = '\n\n'.join(p.strip() for p in paras)
    start, end = section_span(text, sec)
    if start < 0:
        # 절이 아직 없으면 끝에 만든다. 있는 절에 끼워 넣지 않는다 —
        # 엉뚱한 자리에 들어가면 찾기 어렵다.
        title = next((s['title'] for s in PAPER_SECTIONS if s['id'] == sec), sec)
        merged = text.rstrip() + f'\n\n## {sec}. {title}\n\n{block}\n'
        where = f'새 절 "{sec}. {title}" 을 끝에 만들었습니다'
    else:
        head = text[:end].rstrip()
        merged = head + '\n\n' + block + '\n\n' + text[end:].lstrip('\n')
        where = f'{sec} 절 끝에 붙였습니다'
    return jsonify({'status': 'ok', 'paper': paper_rel, 'section': sec,
                    'text': merged, 'added': len(paras), 'where': where,
                    # 저장하지 않았다는 사실을 화면이 그대로 말한다
                    'saved': False,
                    'note': '아직 저장하지 않았습니다 — 논문 탭에서 보고 저장하세요'})


# ═══════════════════════════════════════════════
# 논문 절 상태 — 눌러서 남는다
#   예전에는 하드코딩이라 체크해도 사라졌다.
# ═══════════════════════════════════════════════
SECTIONS_PATH = ROOT / 'Server' / 'paper_sections.json'
SECTION_STATES = ('pending', 'active', 'done')


def load_sections() -> dict:
    if SECTIONS_PATH.exists():
        try:
            return json.loads(SECTIONS_PATH.read_text(encoding='utf-8'))
        except Exception:                                    # noqa: BLE001
            return {}
    return {}


@bp.route('/sections')
def api_sections():
    st = load_sections()
    return jsonify({'status': 'ok', 'sections': PAPER_SECTIONS,
                    'state': st.get('state', {}), 'checklist': st.get('checklist', {}),
                    'states': list(SECTION_STATES), 'path': 'Server/paper_sections.json'})


@bp.route('/sections', methods=['POST'])
def api_sections_put():
    d = request.json or {}
    st = load_sections()
    state = dict(st.get('state', {}))
    checklist = dict(st.get('checklist', {}))
    for k, v in (d.get('state') or {}).items():
        if k in SECTION_IDS and v in SECTION_STATES:
            state[k] = v
    for k, v in (d.get('checklist') or {}).items():
        checklist[str(k)] = bool(v)
    out = {'state': state, 'checklist': checklist, 'updated': _now()}
    SECTIONS_PATH.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding='utf-8')
    return jsonify({'status': 'ok', **out})

# ═══════════════════════════════════════════════
# ② 산출물 — 고른 소스를 묶어 정리한다
#   만드는 주체는 로컬 모델이다. NotebookLM 처럼 보이지만 원문이 나가지 않는다.
# ═══════════════════════════════════════════════
REPORT_KINDS = {
    'brief': {
        'label': '브리핑 문서',
        'ask': '이 자료들의 핵심 주장과 근거를 정리하라. 무엇을 보였고 어떤 조건에서인지.',
        'hint': '핵심 주장 · 방법 · 조건',
    },
    'compare': {
        'label': '비교표',
        'ask': '자료들이 서로 어떻게 다른지 비교하라. 대상 계통·제어 방식·해석 방법·검증 수준의 차이.',
        'hint': '논문 간 차이 — 마크다운 표',
    },
    'gap': {
        'label': '연구 공백',
        'ask': '자료들이 다루지 않은 것, 저자가 한계로 밝힌 것을 모아라. 없는 것을 지어내지 마라.',
        'hint': '한계 · 공백 — 내 차별점의 근거',
    },
    'timeline': {
        'label': '흐름 정리',
        'ask': '이 주제가 어떤 순서로 발전해 왔는지 연도와 함께 정리하라.',
        'hint': '연도순 전개',
    },
    'faq': {
        'label': '질문 목록',
        'ask': '이 자료를 읽은 사람이 가질 법한 질문과, 자료 안에서 답할 수 있는 답을 쓰라.',
        'hint': '자주 묻는 질문',
    },
}


@bp.route('/report-kinds')
def api_report_kinds():
    return jsonify({'status': 'ok', 'kinds': [
        {'kind': k, **v} for k, v in REPORT_KINDS.items()]})


@bp.route('/reports')
def api_reports_list():
    return jsonify({'status': 'ok', 'reports': load_reports(),
                    'path': 'Server/paper_reports.json'})


@bp.route('/reports/<rid>', methods=['DELETE'])
def api_reports_del(rid):
    rows = [r for r in load_reports() if r['id'] != rid]
    save_reports(rows)
    return jsonify({'status': 'ok', 'reports': rows})


@bp.route('/generate', methods=['POST'])
def api_generate():
    """고른 소스에서 대목을 모아 산출물 하나를 만든다.

    색인에 없는 소스는 쓸 수 없다 — 그 사실을 숨기지 않고 함께 돌려준다.
    근거가 모자라면 만들지 않는다. 빈 보고서를 그럴듯하게 채우는 것보다 낫다.
    """
    d = request.json or {}
    kind = d.get('kind')
    if kind not in REPORT_KINDS:
        return jsonify({'status': 'error',
                        'error': f'모르는 종류입니다: {kind}'}), 400
    docs = [x for x in (d.get('docs') or []) if isinstance(x, str)]
    if not docs:
        return jsonify({'status': 'error', 'error': '소스를 하나 이상 고르세요'}), 400

    spec = REPORT_KINDS[kind]
    q = (d.get('focus') or '').strip() or spec['ask']
    # 소스가 여럿이면 대목도 더 모은다. 다만 로컬 모델이 느려 상한을 둔다.
    n = max(4, min(10, len(docs) * 3))
    hits, err = ask.retrieve(q, n, docs)
    if err:
        return jsonify({'status': 'error', 'error': err}), 503

    strong = [h for h in hits if h['sim'] >= ask.MIN_SIM]
    if not strong:
        best = hits[0]['sim'] if hits else 0
        return jsonify({'status': 'error',
                        'error': f'고른 소스에서 쓸 만한 대목을 찾지 못했습니다 '
                                 f'(최고 유사도 {best} < {ask.MIN_SIM}). '
                                 f'지어내지 않습니다 — 초점을 바꾸거나 소스를 늘리세요'}), 422

    res = ask.ask_llm(f'{spec["ask"]}\n\n{q if q != spec["ask"] else ""}'.strip(),
                      strong, timeout=int(d.get('timeout') or 420))
    if not res['ok']:
        return jsonify({'status': 'error', 'error': res['error'], 'hits': strong}), 504

    used_docs = sorted({h['doc'] for h in strong})
    rep = {
        'id': uuid.uuid4().hex[:10],
        'kind': kind,
        'label': spec['label'],
        'title': (d.get('title') or '').strip() or f'{spec["label"]} — {", ".join(used_docs)[:60]}',
        'focus': d.get('focus') or '',
        'docs': docs,
        'used_docs': used_docs,
        # 못 쓴 소스를 밝힌다 — 다 반영된 줄 알면 안 된다
        'missing_docs': [x for x in docs if x not in used_docs],
        'text': res['answer'],
        'grounded': res['grounded'],
        'truncated': res['truncated'],
        'model': ask.LLM_MODEL,
        'hits': [{k: h[k] for k in ('doc', 'page', 'sim', 'title')} for h in strong],
        'verified': False,          # AI 생성물이다. 사람이 원문을 본 뒤에만 true
        'created': _now(),
    }
    rows = load_reports() + [rep]
    save_reports(rows)
    notes = []
    if not res['grounded']:
        notes.append('근거 번호가 없습니다 — 대목 밖의 말일 수 있습니다')
    if res['truncated']:
        notes.append('길이 제한에 걸려 끝이 끊겼습니다')
    if rep['missing_docs']:
        notes.append(f'반영되지 않은 소스: {", ".join(rep["missing_docs"])}')
    return jsonify({'status': 'ok', 'report': rep, 'reports': rows,
                    'note': ' · '.join(notes)})


@bp.route('/reports/<rid>/verify', methods=['POST'])
def api_report_verify(rid):
    """사람이 원문과 대조했다는 표시. 이 표시가 있어야 ▸ 로 옮겨 쓸 수 있다."""
    rows = load_reports()
    r = next((x for x in rows if x['id'] == rid), None)
    if not r:
        return jsonify({'status': 'error', 'error': f'산출물이 없습니다: {rid}'}), 404
    r['verified'] = bool((request.json or {}).get('verified', True))
    r['verified_at'] = _now() if r['verified'] else ''
    save_reports(rows)
    return jsonify({'status': 'ok', 'report': r, 'reports': rows})


@bp.route('/reports/<rid>/to-vault', methods=['POST'])
def api_report_to_vault(rid):
    """산출물을 볼트에 ※ 노트로 남긴다. AI 생성물 표시를 떼지 않는다."""
    r = next((x for x in load_reports() if x['id'] == rid), None)
    if not r:
        return jsonify({'status': 'error', 'error': f'산출물이 없습니다: {rid}'}), 404
    rel = (request.json or {}).get('path') or f'00_Knowledge/mine/{r["kind"]}_{r["id"]}.md'
    try:
        fp = safe_vault_path(rel)
    except ValueError:
        return jsonify({'status': 'error', 'error': '볼트 밖 경로'}), 403
    fp.parent.mkdir(parents=True, exist_ok=True)
    body = [f'# {r["title"]}', '',
            f'> ※ **AI 생성물**입니다 ({r["model"]}). 원문을 직접 확인하기 전에는',
            '> 인용 근거(▸)로 쓰지 않습니다.', '',
            f'- 종류: {r["label"]}', f'- 소스: {", ".join(r["used_docs"]) or "없음"}']
    if r.get('missing_docs'):
        body.append(f'- 반영 안 됨: {", ".join(r["missing_docs"])}')
    body += [f'- 만든 날: {r["created"]}',
             f'- 사람 확인: {"함" if r.get("verified") else "**아직 안 함**"}', '', '---', '']
    body += [f'※ {ln}' if ln.strip() else '' for ln in (r['text'] or '').splitlines()]
    body += ['', '---', '', '## 근거로 쓰인 대목', '']
    for i, h in enumerate(r.get('hits') or [], 1):
        pg = f' p.{h["page"]}' if h.get('page') else ''
        anchor = f' → [[{h["doc"]}.pdf#page={h["page"]}]]' if h.get('page') else ''
        body.append(f'- [{i}] {h["doc"]}{pg} (유사도 {h.get("sim")}){anchor}')
    fp.write_text('\n'.join(body) + '\n', encoding='utf-8')
    return jsonify({'status': 'ok', 'path': fp.relative_to(VAULT).as_posix()})
