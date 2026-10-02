"""
Server/export.py — 논문을 Word 로, 자료를 Excel 로

  왜 템플릿을 같이 넣지 않는가
    IEEE 공식 Word 템플릿은 IEEE Author Center 에서 무료로 받을 수 있지만
    재배포 라이선스가 명시돼 있지 않다. 저장소에 넣으면 안 된다. 커뮤니티
    사본(erwinrmendez/ieee-access-template)은 아예 라이선스가 없고, MIT·0BSD
    로 열린 것은 LaTeX 쪽뿐이다. 그래서 **만드는 쪽만** 만든다.

    서식을 맞추려면 IEEE 에서 직접 받은 .docx 를 05_템플릿/ 에 두면 된다.
    그 파일의 스타일을 읽어 쓰고, 저장소에는 넣지 않는다(.gitignore).

  과장하지 않는다
    내보낸 파일을 'IEEE 규격 준수' 라고 말하지 않는다. 본문·표·인용을 옮겨
    담을 뿐이고, 서식 최종 확인은 ieee-access-format-check 와 사람이 한다.
    옮기지 못한 것(수식·그림)은 숨기지 않고 함께 돌려준다.
"""

from __future__ import annotations

import datetime
import io
import re

from flask import Blueprint, jsonify, request, send_file

from notebook import PAPER_SECTIONS, load_clips
from scholar import VAULT, find_item, load_inbox, safe_vault_path

bp = Blueprint('export', __name__, url_prefix='/api/export')

# 사용자가 직접 받아 둔 서식 파일. 저장소에 넣지 않는다 — 라이선스가 불명확하다.
TEMPLATE_DIR = 'RSCAD/05_템플릿'


def _templates() -> list:
    d = VAULT / TEMPLATE_DIR
    if not d.is_dir():
        return []
    return sorted(p.name for p in d.glob('*.docx') if not p.name.startswith('~$'))


@bp.route('/status')
def api_status():
    return jsonify({
        'status': 'ok',
        'template_dir': TEMPLATE_DIR,
        'templates': _templates(),
        'note': ('IEEE 공식 Word 템플릿은 재배포 라이선스가 없어 함께 넣지 않았습니다. '
                 'IEEE Author Center 에서 받아 위 폴더에 두면 그 서식을 씁니다.'),
    })


# ═══════════════════════════════════════════════
# 마크다운 → Word
#   완전한 변환기가 아니다. 이 볼트가 실제로 쓰는 것만 옮긴다 —
#   제목·문단·목록·표·인용블록·강조. 나머지는 '못 옮긴 것' 으로 보고한다.
# ═══════════════════════════════════════════════
INLINE = re.compile(r'(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)')
TABLE_SEP = re.compile(r'^\s*\|?[\s:|-]+\|[\s:|-]*$')


def _add_runs(para, text: str) -> None:
    """굵게·기울임·코드만 살린다. [@key]·[[링크]]·▸/※ 는 글자 그대로 둔다 —
    Word 로 옮긴 뒤에도 무엇을 인용했는지 보여야 한다."""
    for piece in INLINE.split(text):
        if not piece:
            continue
        if piece.startswith('**') and piece.endswith('**'):
            para.add_run(piece[2:-2]).bold = True
        elif piece.startswith('*') and piece.endswith('*'):
            para.add_run(piece[1:-1]).italic = True
        elif piece.startswith('`') and piece.endswith('`'):
            r = para.add_run(piece[1:-1])
            r.font.name = 'Consolas'
        else:
            para.add_run(piece)


def md_to_docx(text: str, title: str, template=None) -> tuple:
    """마크다운을 Word 문서로. (바이트, 못 옮긴 것 목록) 을 돌려준다."""
    import docx
    doc = docx.Document(str(template)) if template else docx.Document()
    # 템플릿을 썼으면 그 안의 예시 본문은 비운다 (서식만 가져온다)
    if template:
        for p in list(doc.paragraphs):
            p._element.getparent().remove(p._element)

    skipped = []
    lines = text.splitlines()
    i, n = 0, len(lines)
    while i < n:
        ln = lines[i]
        st = ln.strip()

        if not st:
            i += 1
            continue

        if st.startswith('```'):                      # 코드 블록
            block = []
            i += 1
            while i < n and not lines[i].strip().startswith('```'):
                block.append(lines[i])
                i += 1
            i += 1
            p = doc.add_paragraph()
            r = p.add_run('\n'.join(block))
            r.font.name = 'Consolas'
            continue

        if st.startswith('<!--'):                     # 주석은 옮기지 않는다
            while i < n and '-->' not in lines[i]:
                i += 1
            i += 1
            continue

        m = re.match(r'^(#{1,6})\s+(.*)$', st)
        if m:
            doc.add_heading(m.group(2), level=min(len(m.group(1)), 4))
            i += 1
            continue

        if st.startswith('|'):                        # 표
            rows = []
            while i < n and lines[i].strip().startswith('|'):
                row = lines[i].strip().strip('|')
                if not TABLE_SEP.match(lines[i]):
                    rows.append([c.strip() for c in row.split('|')])
                i += 1
            if rows:
                w = max(len(r) for r in rows)
                t = doc.add_table(rows=len(rows), cols=w)
                t.style = 'Table Grid'
                for ri, row in enumerate(rows):
                    for ci in range(w):
                        t.cell(ri, ci).text = row[ci] if ci < len(row) else ''
            continue

        if st.startswith('>'):
            p = doc.add_paragraph(style='Intense Quote' if not template else None)
            _add_runs(p, st.lstrip('> ').strip())
            i += 1
            continue

        m = re.match(r'^[-*+]\s+(.*)$', st)
        if m:
            p = doc.add_paragraph(style='List Bullet')
            _add_runs(p, m.group(1))
            i += 1
            continue
        m = re.match(r'^\d+[.)]\s+(.*)$', st)
        if m:
            p = doc.add_paragraph(style='List Number')
            _add_runs(p, m.group(1))
            i += 1
            continue

        if '$' in st and re.search(r'\$[^$]+\$', st):
            skipped.append(f'수식은 글자 그대로 들어갑니다: {st[:48]}')
        if re.match(r'^!\[', st):
            skipped.append(f'그림은 옮기지 못했습니다: {st[:48]}')
            i += 1
            continue

        p = doc.add_paragraph()
        _add_runs(p, st)
        i += 1

    buf = io.BytesIO()
    doc.save(buf)
    return buf.getvalue(), skipped


@bp.route('/docx', methods=['POST'])
def api_docx():
    """논문 .md 를 Word 로 내려받는다."""
    d = request.json or {}
    rel = (d.get('path') or '').strip()
    try:
        fp = safe_vault_path(rel)
    except ValueError:
        return jsonify({'status': 'error', 'error': '볼트 밖 경로'}), 403
    if not fp.is_file():
        return jsonify({'status': 'error', 'error': f'없는 글입니다: {rel}'}), 404

    tpl = None
    if d.get('template'):
        try:
            cand = safe_vault_path(f'{TEMPLATE_DIR}/{d["template"]}')
            tpl = cand if cand.is_file() else None
        except ValueError:
            tpl = None

    blob, skipped = md_to_docx(fp.read_text(encoding='utf-8'), fp.stem, tpl)
    out = io.BytesIO(blob)
    out.seek(0)
    resp = send_file(out, as_attachment=True, download_name=f'{fp.stem}.docx',
                     mimetype='application/vnd.openxmlformats-officedocument'
                              '.wordprocessingml.document')
    # 못 옮긴 것은 헤더로 알린다 — 파일만 받고 모르면 안 된다
    if skipped:
        resp.headers['X-Export-Skipped'] = str(len(skipped))
    return resp


# ═══════════════════════════════════════════════
# Excel — 세 가지 시트
# ═══════════════════════════════════════════════
def _sheet(ws, header: list, rows: list) -> None:
    from openpyxl.styles import Font
    ws.append(header)
    for c in ws[1]:
        c.font = Font(bold=True)
    for r in rows:
        ws.append(r)
    ws.freeze_panes = 'A2'
    for i, h in enumerate(header, 1):
        width = max([len(str(h))] + [len(str(r[i - 1])) for r in rows if i <= len(r)] or [0])
        ws.column_dimensions[ws.cell(1, i).column_letter].width = min(max(width + 2, 10), 60)


@bp.route('/xlsx')
def api_xlsx():
    """발췌·실험·비교표를 한 통합문서로. 비어 있는 시트는 만들지 않는다."""
    import openpyxl
    want = set((request.args.get('sheets') or 'clips,runs').split(','))
    wb = openpyxl.Workbook()
    wb.remove(wb.active)
    made = []

    if 'clips' in want:
        rows = []
        for c in load_clips():
            it = find_item(load_inbox(), c['cite_key'])
            p = (it or {}).get('paper') or {}
            rows.append([c.get('section') or '?', c['cite_key'], p.get('year') or '',
                         p.get('venue') or '', c.get('page') or '', c.get('kind') or '',
                         c['text'], c.get('note') or '',
                         '예' if c.get('used') else '', c.get('created') or ''])
        if rows:
            _sheet(wb.create_sheet('인용 자료'),
                   ['절', 'cite_key', '연도', '게재처', '쪽', '쓰임', '원문(▸)', '내 메모(※)',
                    '초안에 넣음', '담은 날'], rows)
            made.append('인용 자료')

    if 'runs' in want:
        from doc import _runs
        rows = [[r.get('run_name'), r.get('timestamp'), r.get('XR'),
                 ', '.join(str(x) for x in (r.get('SCR_list') or [])),
                 {True: '예', False: '아니오'}.get(r.get('all_stable'), ''),
                 r.get('zeta_min'), r.get('n_states'), r.get('model_version')]
                for r in _runs()]
        if rows:
            _sheet(wb.create_sheet('실험 결과'),
                   ['run', '시각', 'X/R', 'SCR', '전부 안정', 'ζ_min', '상태수', '모델'], rows)
            made.append('실험 결과')

    if 'sources' in want:
        rows = [[i['key'], (i.get('paper') or {}).get('title', ''),
                 (i.get('paper') or {}).get('year', ''),
                 (i.get('paper') or {}).get('venue', ''),
                 (i.get('paper') or {}).get('doi', ''),
                 i.get('stage'), ', '.join(i.get('tags') or []),
                 len(i.get('highlights') or [])]
                for i in load_inbox()]
        if rows:
            _sheet(wb.create_sheet('수집함'),
                   ['cite_key', '제목', '연도', '게재처', 'DOI', '단계', '태그', '발췌 수'], rows)
            made.append('수집함')

    if not made:
        return jsonify({'status': 'error',
                        'error': '내보낼 자료가 없습니다 — 발췌를 담거나 실험을 돌리세요'}), 404

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    day = datetime.date.today().isoformat()
    return send_file(buf, as_attachment=True, download_name=f'GFM_자료_{day}.xlsx',
                     mimetype='application/vnd.openxmlformats-officedocument'
                              '.spreadsheetml.sheet')
