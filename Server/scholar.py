"""
Server/scholar.py — 연구실 스콜라 7단계 워크플로 백엔드

  검색·답변과 수집 워크플로를 한 줄기로 합친다. 단계는 일곱이고, 각 단계는
  자기 산출물을 수집함(Server/scholar_inbox.json)에 남긴다. 다음 단계는 그
  산출물이 있어야 열린다 — 근거 없이 노트가 만들어지는 길을 막기 위해서다.

    ① 검색      외부 DB(OpenAlex·S2·arXiv) + 내 볼트를 한 번에
    ② 선별      점수·중복 제거 후 수집함에 담기
    ③ 원본 확보 OA PDF → 지정 폴더 저장 · BibTeX 적립 · Zotero 커넥터 전송
    ④ 하이라이트 5색 규칙으로 발췌 분류 (색 = 분류)
    ⑤ 노트화    literature 템플릿(▸/※)대로 .md 생성, 저장 폴더 지정
    ⑥ 연결      볼트의 기존 노트와 [[위키링크]]
    ⑦ 인용·초안 IEEE 인용문 · [@citekey] · 초안 파일에 삽입

  원칙(app.py 와 동일): 값을 날조하지 않는다.
    - 외부 API 가 주지 않은 서지 필드는 '미확인' 으로 남긴다.
    - 초록만 읽었으면 extraction_depth=abstract 이고, 수치 필드는 채우지 않는다
      (obsidian-note-template 리젝 규칙 R1).
"""

from __future__ import annotations

import datetime
import json
import math
import re
import time
import xml.etree.ElementTree as ET
from pathlib import Path

import requests
from flask import Blueprint, jsonify, request

ROOT = Path(__file__).resolve().parent.parent
VAULT = ROOT / 'GFM_Research'
SETTINGS_PATH = ROOT / 'Server' / 'scholar_settings.json'
INBOX_PATH = ROOT / 'Server' / 'scholar_inbox.json'

OPENALEX = 'https://api.openalex.org'
S2 = 'https://api.semanticscholar.org/graph/v1'
ARXIV = 'http://export.arxiv.org/api/query'
CROSSREF = 'https://api.crossref.org/works'
UNPAYWALL = 'https://api.unpaywall.org/v2'

bp = Blueprint('scholar_flow', __name__, url_prefix='/api/scholar')


# ═══════════════════════════════════════════════
# 7단계 정의 — 화면과 문서가 같은 표를 보게 한 곳에 둔다
# ═══════════════════════════════════════════════
STAGES = [
    {'n': 1, 'key': 'search', 'title': '검색',
     'tool': 'OpenAlex · Semantic Scholar · arXiv · 내 볼트',
     'desc': '질문 하나로 외부 DB와 볼트를 동시에 찾는다. 답변의 근거는 여기서만 나온다.',
     'needs': None},
    {'n': 2, 'key': 'screen', 'title': '선별',
     'tool': '관련도 · 인용 · 최신성 점수',
     'desc': '중복을 지우고 점수를 매긴 뒤, 쓸 논문만 수집함에 담는다.',
     'needs': 'search'},
    {'n': 3, 'key': 'original', 'title': '원본 확보',
     'tool': 'Unpaywall · Zotero 커넥터 · BibTeX',
     'desc': '오픈액세스 PDF를 지정 폴더에 cite_key 이름으로 저장하고 Zotero에도 넣는다.',
     'needs': 'screen'},
    {'n': 4, 'key': 'highlight', 'title': '정독 · 하이라이트',
     'tool': '5색 규칙 = 분류',
     'desc': '발췌를 색으로 나눈다. 색이 그대로 노트의 섹션이 된다.',
     'needs': 'screen'},
    {'n': 5, 'key': 'note', 'title': '노트화',
     'tool': 'literature 템플릿 · ▸/※ · frontmatter 전체 키',
     'desc': '저장 규칙대로 .md 를 만든다. 저장 폴더는 여기서 고른다.',
     'needs': 'screen'},
    {'n': 6, 'key': 'link', 'title': '연결',
     'tool': '볼트 검색 · 백링크',
     'desc': '이미 있는 노트와 겹치는 주제를 찾아 [[위키링크]]로 잇는다.',
     'needs': 'note'},
    {'n': 7, 'key': 'cite', 'title': '인용 · 초안',
     'tool': 'Crossref IEEE · [@citekey] · Pandoc',
     'desc': 'IEEE 인용문을 검증해 받아 초안 문단에 [@citekey]로 심는다.',
     'needs': 'note'},
]


# ═══════════════════════════════════════════════
# 설정 — 저장 폴더·하이라이트 색 규칙은 사용자가 고친다
# ═══════════════════════════════════════════════
DEFAULT_SETTINGS = {
    'contact_email': '',                     # OpenAlex·Unpaywall 권장 mailto (없어도 동작)
    'from_year': 2018,
    'top': 25,
    'sources': ['openalex', 's2', 'arxiv'],
    'pdf_dir': '00_Knowledge/papers',        # 원본 PDF — 볼트 기준 상대경로
    'note_dir': '00_Knowledge/literature',   # 문헌 노트
    'draft_path': '00_Knowledge/mine/초안.md',
    'bib_path': '00_Knowledge/references.bib',
    'zotero_enabled': True,
    'zotero_url': 'http://127.0.0.1:23119',
    'highlights': [
        {'color': '#e03131', 'callout': 'danger', 'mean': '핵심 · 논쟁 지점', 'section': 'core'},
        {'color': '#f59f00', 'callout': 'warning', 'mean': '인용 후보', 'section': 'quote'},
        {'color': '#1c7ed6', 'callout': 'tip', 'mean': '방법 · 수식', 'section': 'method'},
        {'color': '#ae3ec9', 'callout': 'question', 'mean': '내 의문', 'section': 'unknown'},
        {'color': '#868e96', 'callout': 'note', 'mean': '배경', 'section': 'background'},
    ],
}

# 하이라이트가 노트의 어느 자리로 가는지 — section 키의 뜻
SECTION_LABEL = {
    'core': '핵심 기여 · 논쟁 (▸)',
    'quote': '주요 수치 · 인용 후보 (▸)',
    'method': '방법 · 수식 (▸)',
    'unknown': '미확인 항목 (※)',
    'background': '배경 요약 (▸)',
}


def load_settings() -> dict:
    s = dict(DEFAULT_SETTINGS)
    if SETTINGS_PATH.exists():
        try:
            s.update(json.loads(SETTINGS_PATH.read_text(encoding='utf-8')))
        except Exception:                                    # noqa: BLE001
            pass
    return s


def save_settings(s: dict) -> None:
    SETTINGS_PATH.write_text(json.dumps(s, ensure_ascii=False, indent=2), encoding='utf-8')


# ═══════════════════════════════════════════════
# 수집함 — 7단계의 상태가 여기 남는다
# ═══════════════════════════════════════════════
def load_inbox() -> list:
    if INBOX_PATH.exists():
        try:
            return json.loads(INBOX_PATH.read_text(encoding='utf-8')).get('items', [])
        except Exception:                                    # noqa: BLE001
            return []
    return []


def save_inbox(items: list) -> None:
    INBOX_PATH.write_text(json.dumps({'items': items}, ensure_ascii=False, indent=2),
                          encoding='utf-8')


def find_item(items: list, key: str):
    return next((i for i in items if i.get('key') == key), None)


# ═══════════════════════════════════════════════
# 공통 유틸
# ═══════════════════════════════════════════════
def _ua(email: str) -> dict:
    return {'User-Agent': f'lab-scholar/1.0 (mailto:{email or "unknown"})'}


def http_get(url, params=None, as_json=True, email='', wait=0.2, tries=3, timeout=25):
    """실패는 None. 예외를 밖으로 던지지 않는다 — 한 소스가 죽어도 나머지는 살린다."""
    for i in range(tries):
        try:
            r = requests.get(url, params=params, headers=_ua(email), timeout=timeout)
            if r.status_code == 200:
                time.sleep(wait)
                return r.json() if as_json else r
            if r.status_code in (429, 503):
                time.sleep(1.5 * (i + 1))
                continue
            return None
        except requests.RequestException:
            time.sleep(1.0 * (i + 1))
    return None


def norm_title(t: str) -> str:
    return re.sub(r'[^a-z0-9]', '', (t or '').lower())[:120]


def empty_rec() -> dict:
    return dict(title='', year=None, venue='', volume='', issue='', pages='', doi='',
                cited_by=0, authors='', abstract='', pdf_url='', landing='', topics=[],
                oa_id='', source='', score=0.0)


# ── cite_key: 제1저자성(소문자) + 연도 + 주제어/학회약어 ──
_WORD = re.compile(r'[a-z]+')


def cite_key(rec: dict) -> str:
    first = (rec.get('authors') or '').split(',')[0].strip()
    last = re.sub(r'[^A-Za-z가-힣]', '', first.split()[-1] if first else '') or 'anon'
    year = rec.get('year') or ''
    skip = {'ieee', 'the', 'of', 'on', 'and', 'international', 'journal', 'transactions',
            'proceedings', 'conference', 'in', 'for', 'a', 'an'}
    token = next((w for w in _WORD.findall((rec.get('venue') or '').lower())
                  if w not in skip and len(w) > 2), '')
    if not token:
        token = next((w for w in _WORD.findall((rec.get('title') or '').lower())
                      if w not in skip and len(w) > 3), 'paper')
    return f'{last.lower()}{year}{token[:12]}'


def unique_cite_key(base: str, taken: set) -> str:
    if base not in taken:
        return base
    for suffix in 'bcdefghijk':
        if base + suffix not in taken:
            return base + suffix
    return base + str(int(time.time()) % 1000)


def existing_cite_keys() -> set:
    keys = set()
    lit = VAULT / '00_Knowledge' / 'literature'
    if lit.exists():
        for p in lit.glob('*.md'):
            try:
                m = re.search(r'^cite_key:\s*(\S+)', p.read_text(encoding='utf-8'), re.M)
            except OSError:
                continue
            keys.add(m.group(1).strip() if m else p.stem.lower())
    return keys


def safe_vault_path(rel: str) -> Path:
    """볼트 밖으로 나가는 경로를 막는다."""
    p = (VAULT / rel).resolve()
    p.relative_to(VAULT.resolve())          # 이탈이면 ValueError
    return p


# ═══════════════════════════════════════════════
# ① 검색 — 외부 DB
# ═══════════════════════════════════════════════
def oa_abstract(w: dict) -> str:
    inv = w.get('abstract_inverted_index') or {}
    pos = {p: word for word, ps in inv.items() for p in ps}
    return ' '.join(pos[k] for k in sorted(pos))


def from_openalex(w: dict, source: str) -> dict:
    r = empty_rec()
    loc = w.get('primary_location') or {}
    bib = w.get('biblio') or {}
    best = w.get('best_oa_location') or {}
    r.update(
        title=w.get('display_name') or '',
        year=w.get('publication_year'),
        venue=(loc.get('source') or {}).get('display_name') or '',
        volume=bib.get('volume') or '', issue=bib.get('issue') or '',
        pages='-'.join(p for p in [bib.get('first_page'), bib.get('last_page')] if p),
        doi=(w.get('doi') or '').replace('https://doi.org/', '').lower(),
        cited_by=w.get('cited_by_count', 0),
        authors=', '.join(a['author']['display_name'] for a in (w.get('authorships') or [])[:6]),
        abstract=oa_abstract(w),
        pdf_url=best.get('pdf_url') or (w.get('open_access') or {}).get('oa_url') or '',
        landing=loc.get('landing_page_url') or '',
        topics=[t['display_name'] for t in (w.get('topics') or [])[:3]]
               + [k['display_name'] for k in (w.get('keywords') or [])[:4]],
        oa_id=(w.get('id') or '').rsplit('/', 1)[-1],
        source=source,
    )
    return r


def search_openalex(q, y, n, email):
    d = http_get(f'{OPENALEX}/works', {
        'search': q, 'filter': f'from_publication_year:{y}',
        'sort': 'relevance_score:desc', 'per-page': min(n, 50), 'mailto': email}, email=email)
    if d is None:
        return None
    return [from_openalex(w, 'openalex') for w in d.get('results', [])]


def search_s2(q, y, n, email):
    d = http_get(f'{S2}/paper/search', {
        'query': q, 'year': f'{y}-', 'limit': min(n, 30),
        'fields': ('title,year,venue,externalIds,citationCount,abstract,'
                   'openAccessPdf,authors,fieldsOfStudy'),
    }, email=email, wait=1.0)
    if d is None:
        return None
    out = []
    for p in d.get('data', []):
        r = empty_rec()
        r.update(title=p.get('title') or '', year=p.get('year'), venue=p.get('venue') or '',
                 doi=((p.get('externalIds') or {}).get('DOI') or '').lower(),
                 cited_by=p.get('citationCount') or 0,
                 authors=', '.join(a['name'] for a in (p.get('authors') or [])[:6]),
                 abstract=p.get('abstract') or '',
                 pdf_url=(p.get('openAccessPdf') or {}).get('url') or '',
                 topics=p.get('fieldsOfStudy') or [], source='semantic_scholar')
        out.append(r)
    return out


def search_arxiv(q, y, n, email):
    resp = http_get(ARXIV, {'search_query': 'all:' + ' AND all:'.join(q.split()[:6]),
                            'max_results': min(n, 25), 'sortBy': 'relevance'},
                    as_json=False, email=email, wait=1.0)
    if resp is None:
        return None
    ns = {'a': 'http://www.w3.org/2005/Atom'}
    try:
        entries = ET.fromstring(resp.content).findall('a:entry', ns)
    except ET.ParseError:
        return None
    out = []
    for e in entries:
        try:
            yr = int(e.findtext('a:published', '0000', ns)[:4])
        except ValueError:
            continue
        if yr < y:
            continue
        r = empty_rec()
        aid = e.findtext('a:id', '', ns)
        r.update(title=' '.join(e.findtext('a:title', '', ns).split()), year=yr,
                 venue='arXiv (preprint)',
                 authors=', '.join(a.findtext('a:name', '', ns)
                                   for a in e.findall('a:author', ns)[:6]),
                 abstract=' '.join(e.findtext('a:summary', '', ns).split()),
                 pdf_url=aid.replace('/abs/', '/pdf/'), landing=aid, source='arxiv')
        out.append(r)
    return out


def score(rec: dict, terms: list) -> float:
    year_now = datetime.date.today().year
    text = (rec['title'] + ' ' + rec['abstract']).lower()
    rel = sum(t in text for t in terms) / max(len(terms), 1)
    age = max(year_now - (rec['year'] or year_now) + 1, 1)
    impact = min(math.log1p(rec['cited_by'] / age) / math.log1p(100), 1)
    recent = 1.0 if age <= 3 else max(0.0, 1 - (age - 3) / 10)
    return round(0.45 * rel + 0.30 * impact + 0.25 * recent, 3)


@bp.route('/stages')
def api_stages():
    return jsonify({'status': 'ok', 'stages': STAGES})


@bp.route('/search', methods=['POST'])
def api_search():
    """① 검색 — 외부 DB를 훑는다. 죽은 소스는 죽었다고 말한다."""
    d = request.json or {}
    q = (d.get('q') or '').strip()
    if len(q) < 2:
        return jsonify({'status': 'error', 'error': '두 글자 이상 입력하세요'}), 400

    s = load_settings()
    email = d.get('email') or s['contact_email']
    year = int(d.get('from_year') or s['from_year'])
    top = int(d.get('top') or s['top'])
    sources = d.get('sources') or s['sources']

    pool, failed, counts = [], [], {}
    runners = {'openalex': search_openalex, 's2': search_s2, 'arxiv': search_arxiv}
    for name in sources:
        fn = runners.get(name)
        if not fn:
            continue
        got = fn(q, year, max(top, 20), email)
        if got is None:
            failed.append(name)
            counts[name] = None
            continue
        counts[name] = len(got)
        pool += got

    uniq = {}
    for r in pool:
        k = r['doi'] or norm_title(r['title'])
        if k and k not in uniq:
            uniq[k] = r
    terms = [t.lower() for t in re.findall(r'[\w-]+', q) if len(t) > 2]
    for r in uniq.values():
        r['score'] = score(r, terms)
    papers = sorted(uniq.values(), key=lambda r: -r['score'])[:top]

    taken = existing_cite_keys()
    inbox_keys = {i['key'] for i in load_inbox()}
    for r in papers:
        base = cite_key(r)
        r['cite_key'] = base
        r['in_vault'] = base in taken
        r['in_inbox'] = base in inbox_keys

    # 실패는 숨기지 않는다 — 어느 소스가 빠졌는지 알아야 결과를 믿을지 판단할 수 있다
    hints = []
    if 'openalex' in failed:
        hints.append('OpenAlex 실패' + (' — ⚙ 설정에 연락 메일을 넣으면 속도 제한(429)을 피할 수 있습니다'
                                        if not email else ' — 잠시 후 다시 시도하세요'))
    if 's2' in failed:
        hints.append('Semantic Scholar 실패 — 무료 공용 풀이라 429 가 잦습니다. 잠시 후 재시도')
    if 'arxiv' in failed:
        hints.append('arXiv 실패 — 네트워크를 확인하세요')

    return jsonify({
        'status': 'ok', 'query': q, 'papers': papers,
        'counts': counts, 'failed': failed,
        'note': ' · '.join(hints),
    })


# ═══════════════════════════════════════════════
# ② 선별 — 수집함
# ═══════════════════════════════════════════════
PAPER_FIELDS = ('title', 'authors', 'year', 'venue', 'volume', 'issue', 'pages', 'doi',
                'cited_by', 'abstract', 'pdf_url', 'landing', 'topics', 'oa_id',
                'source', 'score')


@bp.route('/inbox')
def api_inbox_list():
    return jsonify({'status': 'ok', 'items': load_inbox()})


@bp.route('/inbox', methods=['POST'])
def api_inbox_add():
    """수집함에 담는다. 같은 cite_key 가 이미 있으면 건드리지 않는다."""
    d = request.json or {}
    papers = d.get('papers') or ([d['paper']] if d.get('paper') else [])
    if not papers:
        return jsonify({'status': 'error', 'error': 'paper(s) 가 필요합니다'}), 400

    items = load_inbox()
    taken = existing_cite_keys() | {i['key'] for i in items}
    added = []
    for p in papers:
        base = p.get('cite_key') or cite_key(p)
        if find_item(items, base):
            continue
        key = unique_cite_key(base, taken)
        taken.add(key)
        items.append({
            'key': key,
            'paper': {k: p.get(k) for k in PAPER_FIELDS},
            'stage': 2,
            'original': {},
            'highlights': [],
            'note_path': '',
            'links': [],
            'cited': False,
            'added': datetime.datetime.now().isoformat(timespec='seconds'),
        })
        added.append(key)
    save_inbox(items)
    return jsonify({'status': 'ok', 'added': added, 'items': items})


@bp.route('/inbox/<key>', methods=['PATCH'])
def api_inbox_patch(key):
    items = load_inbox()
    it = find_item(items, key)
    if not it:
        return jsonify({'status': 'error', 'error': f'수집함에 없습니다: {key}'}), 404
    d = request.json or {}
    for f in ('highlights', 'links', 'note_path', 'cited', 'stage', 'memo',
              'extraction_depth', 'section', 'paper_type', 'target_system'):
        if f in d:
            it[f] = d[f]
    save_inbox(items)
    return jsonify({'status': 'ok', 'item': it})


@bp.route('/inbox/<key>', methods=['DELETE'])
def api_inbox_delete(key):
    items = [i for i in load_inbox() if i.get('key') != key]
    save_inbox(items)
    return jsonify({'status': 'ok', 'items': items})


# ═══════════════════════════════════════════════
# ③ 원본 확보 — PDF · BibTeX · Zotero
# ═══════════════════════════════════════════════
def unpaywall_pdf(doi: str, email: str) -> str:
    if not doi or not email:
        return ''
    d = http_get(f'{UNPAYWALL}/{doi}', {'email': email}, email=email) or {}
    return ((d.get('best_oa_location') or {}).get('url_for_pdf')) or ''


def bibtex_entry(key: str, p: dict) -> str:
    def f(v):
        return str(v or '')
    return (f'@article{{{key},\n'
            f'  title = {{{f(p.get("title"))}}},\n'
            f'  author = {{{f(p.get("authors")).replace(", ", " and ")}}},\n'
            f'  journal = {{{f(p.get("venue"))}}},\n'
            f'  year = {{{f(p.get("year"))}}},\n'
            f'  volume = {{{f(p.get("volume"))}}},\n'
            f'  number = {{{f(p.get("issue"))}}},\n'
            f'  pages = {{{f(p.get("pages"))}}},\n'
            f'  doi = {{{f(p.get("doi"))}}}\n}}\n\n')


def zotero_save(p: dict, pdf_url: str, s: dict) -> dict:
    """로컬 Zotero 커넥터로 항목을 보낸다. Zotero 가 꺼져 있으면 그렇다고 말한다."""
    creators = []
    for name in [a.strip() for a in (p.get('authors') or '').split(',') if a.strip()]:
        parts = name.split()
        creators.append({'creatorType': 'author',
                         'firstName': ' '.join(parts[:-1]), 'lastName': parts[-1]})
    item = {
        'itemType': 'preprint' if 'arxiv' in (p.get('venue') or '').lower() else 'journalArticle',
        'title': p.get('title') or '',
        'creators': creators,
        'date': str(p.get('year') or ''),
        'publicationTitle': p.get('venue') or '',
        'volume': str(p.get('volume') or ''),
        'issue': str(p.get('issue') or ''),
        'pages': str(p.get('pages') or ''),
        'DOI': p.get('doi') or '',
        'url': p.get('landing') or '',
        'abstractNote': (p.get('abstract') or '')[:4000],
        'attachments': ([{'title': 'Full Text PDF', 'url': pdf_url,
                          'mimeType': 'application/pdf'}] if pdf_url else []),
        'tags': [{'tag': t} for t in (p.get('topics') or [])[:6]],
    }
    try:
        r = requests.post(
            s['zotero_url'].rstrip('/') + '/connector/saveItems',
            json={'items': [item], 'uri': p.get('landing') or p.get('pdf_url') or ''},
            headers={'Content-Type': 'application/json',
                     'zotero-connector-api-version': '2',
                     'User-Agent': 'lab-scholar/1.0'},
            timeout=20)
        if r.status_code in (200, 201):
            return {'ok': True, 'msg': 'Zotero 라이브러리에 저장했습니다'}
        return {'ok': False, 'msg': f'Zotero 응답 {r.status_code} — 저장되지 않았습니다'}
    except requests.RequestException:
        return {'ok': False, 'msg': 'Zotero 가 실행 중이 아닙니다 (커넥터 23119 응답 없음)'}


@bp.route('/original', methods=['POST'])
def api_original():
    """③ OA PDF → 지정 폴더 · BibTeX 적립 · Zotero 전송. 채널별 결과를 따로 돌려준다."""
    d = request.json or {}
    items = load_inbox()
    it = find_item(items, d.get('key'))
    if not it:
        return jsonify({'status': 'error', 'error': f'수집함에 없습니다: {d.get("key")}'}), 404

    s = load_settings()
    p = it['paper']
    key = it['key']
    email = s['contact_email']
    want = d.get('channels') or ['pdf', 'bib', 'zotero']
    out = dict(it.get('original') or {})

    # ── PDF ──
    if 'pdf' in want:
        url = p.get('pdf_url') or ''
        if not (url.lower().endswith('.pdf') or 'arxiv.org/pdf' in url):
            url = unpaywall_pdf(p.get('doi') or '', email) or url
        if not url:
            out['pdf'] = {'ok': False,
                          'msg': '오픈액세스 PDF 링크가 없습니다 — 도서관 경유로 직접 저장하세요'}
        else:
            resp = http_get(url, as_json=False, email=email, wait=0, tries=2, timeout=60)
            if not resp or b'%PDF' not in resp.content[:2048]:
                out['pdf'] = {'ok': False, 'url': url,
                              'msg': 'PDF 가 아니라 랜딩/유료 페이지였습니다 — 수동 저장이 필요합니다'}
            else:
                try:
                    pdf_dir = safe_vault_path(d.get('pdf_dir') or s['pdf_dir'])
                except ValueError:
                    return jsonify({'status': 'error', 'error': '볼트 밖 경로'}), 403
                pdf_dir.mkdir(parents=True, exist_ok=True)
                fp = pdf_dir / f'{key}.pdf'
                fp.write_bytes(resp.content)
                out['pdf'] = {'ok': True, 'path': fp.relative_to(VAULT).as_posix(),
                              'bytes': len(resp.content), 'msg': '원본을 저장했습니다'}

    # ── BibTeX ──
    if 'bib' in want:
        try:
            bib = safe_vault_path(d.get('bib_path') or s['bib_path'])
        except ValueError:
            return jsonify({'status': 'error', 'error': '볼트 밖 경로'}), 403
        bib.parent.mkdir(parents=True, exist_ok=True)
        old = bib.read_text(encoding='utf-8') if bib.exists() else ''
        if f'@article{{{key},' in old:
            out['bib'] = {'ok': True, 'path': bib.relative_to(VAULT).as_posix(),
                          'msg': '이미 등록된 항목입니다'}
        else:
            bib.write_text(old + bibtex_entry(key, p), encoding='utf-8')
            out['bib'] = {'ok': True, 'path': bib.relative_to(VAULT).as_posix(),
                          'msg': 'BibTeX 에 추가했습니다'}

    # ── Zotero ──
    if 'zotero' in want:
        if s.get('zotero_enabled'):
            out['zotero'] = zotero_save(p, p.get('pdf_url') or '', s)
        else:
            out['zotero'] = {'ok': False, 'msg': '설정에서 Zotero 연동이 꺼져 있습니다'}

    it['original'] = out
    it['stage'] = max(it.get('stage', 2), 3)
    save_inbox(items)
    return jsonify({'status': 'ok', 'original': out, 'item': it})


# ═══════════════════════════════════════════════
# ⑤ 노트화 — literature 템플릿
# ═══════════════════════════════════════════════
def _by_section(highlights: list) -> dict:
    out = {}
    for h in highlights or []:
        if (h.get('text') or '').strip():
            out.setdefault(h.get('section') or 'background', []).append(h)
    return out


def render_note(key: str, it: dict, links: list) -> str:
    """obsidian-note-template 규칙대로 문헌 노트를 만든다.

    ▸ 는 원문에 있는 것만. 외부 API 에서 받은 건 서지·초록뿐이므로 사용자가
    '정독함'을 표시하기 전까지 extraction_depth 는 abstract 고, 수치 필드
    (model_order 등)는 리젝 규칙 R1 에 따라 '미확인' 으로 남긴다.
    """
    p = it['paper']
    hs = _by_section(it.get('highlights'))
    depth = it.get('extraction_depth') or 'abstract'
    unknown = '미확인'                      # 내가 아직 원문을 못 봄
    pdf = (it.get('original') or {}).get('pdf') or {}
    pdf_link = f'"[[{key}.pdf]]"' if pdf.get('ok') else '""'
    pdf_status = 'have' if pdf.get('ok') else ('oa-available' if p.get('pdf_url') else 'none')
    authors = [a.strip() for a in (p.get('authors') or '').split(',') if a.strip()]
    today = datetime.date.today().isoformat()

    def esc(v):
        return str(v or '').replace('"', "'")

    fm = [
        '---',
        f'cite_key: {key}',
        'ref_num: null',
        f'title: "{esc(p.get("title"))}"',
        'authors: [' + ', '.join(f'"{esc(a)}"' for a in authors) + ']',
        'corresponding: ""',
        f'year: {p.get("year") or unknown}',
        f'venue: "{esc(p.get("venue"))}"',
        f'doi: "{esc(p.get("doi"))}"',
        f'pdf: {pdf_link}',
        f'pdf_status: {pdf_status}',
        f'paper_type: {it.get("paper_type") or unknown}',
        f'target_system: {it.get("target_system") or unknown}',
        'control_scheme: []',
        f'model_order: {unknown}',
        f'analysis_method: [{unknown}]',
        f'tuning_method: {unknown}',
        f'scr_range: {unknown}',
        f'xr_range: {unknown}',
        f'validation_level: {unknown}',
        'hardware: []',
        f'extraction_depth: {depth}',
        f'section: "{esc(it.get("section"))}"',
        'tags: [paper, lab-scholar]',
        f'status: {"read" if depth == "full" else "to-read"}',
        f'collected: {today}',
        f'found_via: {p.get("source") or unknown}',
        f'cited_by: {p.get("cited_by") or 0}',
        '---',
        '',
    ]

    def bullets(sec):
        return [f'  - {h["text"]}'
                + (f'  → [[{key}.pdf#page={h["page"]}]]' if h.get('page') else '')
                for h in hs.get(sec, [])]

    full_cite = ', '.join(x for x in [
        p.get('authors'), f'"{p.get("title")}"', p.get('venue'),
        f'vol. {p["volume"]}' if p.get('volume') else '',
        f'no. {p["issue"]}' if p.get('issue') else '',
        f'pp. {p["pages"]}' if p.get('pages') else '',
        str(p.get('year') or ''), f'doi: {p["doi"]}' if p.get('doi') else '',
    ] if x)

    body = ['# 📌 Brief Summary', '',
            f'▸ {(p.get("abstract") or "").strip()[:400] or "(초록 없음 — 원문 확인 필요)"}']
    for h in hs.get('background', []):
        body.append(f'▸ {h["text"]}')

    body += ['', '---', '', '# 📖 Core Content', '', f'▸ 전체 인용: {full_cite}', '']
    body += ['▸ 핵심 기여:'] + (bullets('core') or [f'  - {unknown} — 원문 정독 후 채웁니다'])
    body += ['', '▸ 방법:'] + (bullets('method') or [f'  - {unknown}'])
    body += ['', f'▸ 검증: {unknown}']
    body += ['', '▸ 주요 수치:'] + (bullets('quote')
                                 or [f'  - {unknown} (조건·단위와 함께만 적습니다)'])
    body += ['', '▸ 저자가 밝힌 한계:', f'  - {unknown}']

    body += ['', '---', '', '# 🔗 Knowledge Connections', '']
    body += [f'* Related Topics: {", ".join(p.get("topics") or []) or unknown}']
    body += ['* Projects/Contexts: GFM 소신호 안정도 (lab-scholar 수집)']
    body += ['* 연결된 노트: ' + (', '.join(f'[[{l}]]' for l in links) if links else '없음')]

    body += ['', '---', '', '# ✍️ My Take', '']
    body += [f'※ 차별점: {unknown}',
             f'※ 인용 자리: {it.get("section") or unknown}',
             f'※ 전략적 배치 이유: {unknown}',
             f'※ 그대로 못 쓰는 이유: {unknown}',
             '※ 미확인 항목:']
    body += (bullets('unknown') or [f'  - 원문 정독 전입니다 (extraction_depth: {depth})'])

    # NotebookLM 산출물은 전부 AI 생성이다 — ※ 로만 적고 ▸ 로 올리지 않는다
    nb = it.get('nblm') or {}
    if nb.get('notebook_id'):
        body += ['', '---', '', '## 🎧 NotebookLM (AI 생성 — 인용 금지)', '',
                 f'※ 노트북: {nb.get("url") or nb["notebook_id"]}',
                 '※ 아래는 NotebookLM 이 만든 것입니다. 원문 대조 전에는 근거(▸)로 쓰지 않습니다.']
        body += [f'- {a.get("label") or a.get("kind")} — {a.get("status")}'
                 + (f' · {a["url"]}' if a.get('url') else '')
                 for a in (nb.get('artifacts') or [])]

    body += ['', '---', '', '# 📎 인용', '',
             f'- 초안에는 `[@{key}]` 로 넣습니다 (Pandoc). 노트 링크는 `[[{key}]]`.',
             f'- BibTeX 키: `{key}`']
    return '\n'.join(fm + body) + '\n'


def suggest_links(it: dict, limit: int = 6) -> list:
    """볼트의 기존 노트 중 주제어가 겹치는 것을 고른다. 없는 노트로는 링크하지 않는다."""
    p = it['paper']
    stop = {'with', 'from', 'this', 'that', 'using', 'based', 'under', 'system', 'systems',
            'analysis', 'study', 'paper', 'method', 'model', 'power', 'control'}
    terms = set()
    for t in (p.get('topics') or []):
        terms |= {w.lower() for w in re.findall(r'[A-Za-z가-힣]{4,}', t)}
    terms |= {w.lower() for w in re.findall(r'[A-Za-z가-힣]{4,}', p.get('title') or '')}
    terms -= stop
    if not terms:
        return []
    out = []
    for folder in ('00_Knowledge/literature', '00_Knowledge/claims', '00_Knowledge/mine'):
        d = VAULT / folder
        if not d.exists():
            continue
        for f in d.glob('*.md'):
            if f.stem == it['key']:
                continue
            try:
                text = f.read_text(encoding='utf-8').lower()
            except OSError:
                continue
            hit = sorted(t for t in terms if t in text)
            if hit:
                out.append({'note': f.stem, 'path': f'{folder}/{f.name}',
                            'shared': hit[:6], 'n': len(hit)})
    out.sort(key=lambda x: -x['n'])
    return out[:limit]


def _apply_edits(it: dict, d: dict) -> None:
    for f in ('highlights', 'extraction_depth', 'section', 'paper_type', 'target_system'):
        if f in d:
            it[f] = d[f]


@bp.route('/note/preview', methods=['POST'])
def api_note_preview():
    """⑤ 저장 전 미리보기 — 어디에 어떤 내용으로 쓸지 먼저 보여준다."""
    d = request.json or {}
    items = load_inbox()
    it = find_item(items, d.get('key'))
    if not it:
        return jsonify({'status': 'error', 'error': '수집함에 없습니다'}), 404
    s = load_settings()
    _apply_edits(it, d)
    suggested = suggest_links(it)
    links = d.get('links') if d.get('links') is not None else [l['note'] for l in suggested]
    note_dir = (d.get('note_dir') or s['note_dir']).rstrip('/')
    path = f'{note_dir}/{it["key"]}.md'
    return jsonify({'status': 'ok', 'path': path,
                    'markdown': render_note(it['key'], it, links),
                    'exists': (VAULT / path).exists(),
                    'links': links, 'suggested': suggested})


@bp.route('/note', methods=['POST'])
def api_note_save():
    """⑤ 실제 저장. 기존 노트는 덮지 않는다 (overwrite=true 를 줘야 덮는다)."""
    d = request.json or {}
    items = load_inbox()
    it = find_item(items, d.get('key'))
    if not it:
        return jsonify({'status': 'error', 'error': '수집함에 없습니다'}), 404
    s = load_settings()
    _apply_edits(it, d)
    links = d.get('links') or []
    note_dir = (d.get('note_dir') or s['note_dir']).rstrip('/')
    try:
        target = safe_vault_path(f'{note_dir}/{it["key"]}.md')
    except ValueError:
        return jsonify({'status': 'error', 'error': '볼트 밖 경로'}), 403
    if target.exists() and not d.get('overwrite'):
        return jsonify({'status': 'error', 'exists': True,
                        'error': f'이미 있는 노트입니다: {target.name} — 덮어쓰려면 확인이 필요합니다'}), 409
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(d.get('markdown') or render_note(it['key'], it, links), encoding='utf-8')

    rel = target.relative_to(VAULT).as_posix()
    it['note_path'] = rel
    it['links'] = links
    it['stage'] = max(it.get('stage', 2), 5)
    save_inbox(items)
    return jsonify({'status': 'ok', 'path': rel, 'item': it})


# ═══════════════════════════════════════════════
# ⑥ 연결 — 양쪽에 링크를 심는다
# ═══════════════════════════════════════════════
@bp.route('/related', methods=['POST'])
def api_related():
    items = load_inbox()
    it = find_item(items, (request.json or {}).get('key'))
    if not it:
        return jsonify({'status': 'error', 'error': '수집함에 없습니다'}), 404
    return jsonify({'status': 'ok', 'suggested': suggest_links(it, limit=12)})


@bp.route('/link', methods=['POST'])
def api_link():
    """내 노트의 '연결된 노트' 줄과 상대 노트의 '연결 노트' 섹션을 같이 고친다."""
    d = request.json or {}
    items = load_inbox()
    it = find_item(items, d.get('key'))
    if not it:
        return jsonify({'status': 'error', 'error': '수집함에 없습니다'}), 404
    if not it.get('note_path'):
        return jsonify({'status': 'error', 'error': '먼저 ⑤에서 노트를 저장하세요'}), 400
    targets = [t for t in (d.get('targets') or []) if t.get('note') and t.get('path')]
    key = it['key']
    try:
        mine = safe_vault_path(it['note_path'])
    except ValueError:
        return jsonify({'status': 'error', 'error': '볼트 밖 경로'}), 403
    if not mine.exists():
        return jsonify({'status': 'error', 'error': f'노트가 사라졌습니다: {it["note_path"]}'}), 404

    text = mine.read_text(encoding='utf-8')
    linked = sorted({t['note'] for t in targets} | set(it.get('links') or []))
    line = '* 연결된 노트: ' + (', '.join(f'[[{l}]]' for l in linked) if linked else '없음')
    if re.search(r'^\* 연결된 노트:.*$', text, flags=re.M):
        text = re.sub(r'^\* 연결된 노트:.*$', lambda _m: line, text, count=1, flags=re.M)
    else:
        text = text.replace('# 🔗 Knowledge Connections\n',
                            f'# 🔗 Knowledge Connections\n\n{line}\n', 1)
    mine.write_text(text, encoding='utf-8')

    back = []
    for t in targets:
        try:
            tp = safe_vault_path(t['path'])
        except ValueError:
            back.append({'path': t['path'], 'ok': False, 'msg': '볼트 밖 경로'})
            continue
        if not tp.exists():
            back.append({'path': t['path'], 'ok': False, 'msg': '파일 없음'})
            continue
        body = tp.read_text(encoding='utf-8')
        if f'[[{key}]]' in body:
            back.append({'path': t['path'], 'ok': True, 'msg': '이미 연결되어 있습니다'})
            continue
        if '## 🔗 연결 노트' in body:
            body = body.replace('## 🔗 연결 노트', f'## 🔗 연결 노트\n- [[{key}]]', 1)
        else:
            body = body.rstrip() + f'\n\n## 🔗 연결 노트\n- [[{key}]]\n'
        tp.write_text(body, encoding='utf-8')
        back.append({'path': t['path'], 'ok': True, 'msg': '역링크를 넣었습니다'})

    it['links'] = linked
    it['stage'] = max(it.get('stage', 5), 6)
    save_inbox(items)
    return jsonify({'status': 'ok', 'links': linked, 'backlinks': back})


# ═══════════════════════════════════════════════
# ⑦ 인용 · 초안
# ═══════════════════════════════════════════════
IEEE_ABBR = {
    'ieee transactions on smart grid': 'IEEE Trans. Smart Grid',
    'ieee transactions on power systems': 'IEEE Trans. Power Syst.',
    'ieee transactions on power electronics': 'IEEE Trans. Power Electron.',
    'ieee transactions on sustainable energy': 'IEEE Trans. Sustain. Energy',
    'ieee transactions on energy conversion': 'IEEE Trans. Energy Convers.',
    'ieee transactions on industrial electronics': 'IEEE Trans. Ind. Electron.',
    'ieee transactions on industry applications': 'IEEE Trans. Ind. Appl.',
    'ieee journal of emerging and selected topics in power electronics':
        'IEEE J. Emerg. Sel. Topics Power Electron.',
    'ieee access': 'IEEE Access',
    'applied energy': 'Appl. Energy',
    'energy and buildings': 'Energy Build.',
    'renewable energy': 'Renew. Energy',
    'solar energy': 'Sol. Energy',
    'international journal of electrical power & energy systems':
        'Int. J. Electr. Power Energy Syst.',
    'electric power systems research': 'Electr. Power Syst. Res.',
}
MON = ['Jan.', 'Feb.', 'Mar.', 'Apr.', 'May', 'Jun.',
       'Jul.', 'Aug.', 'Sep.', 'Oct.', 'Nov.', 'Dec.']
NV = '[미검증]'


def _ieee_author(a: dict) -> str:
    parts = ['-'.join(p[0] + '.' for p in w.split('-') if p)
             for w in (a.get('given') or '').split()]
    return f'{" ".join(parts)} {a.get("family", "")}'.strip()


def _ieee_authors(lst) -> str:
    names = [_ieee_author(a) for a in lst or []]
    if not names:
        return NV
    if len(names) >= 7:
        return names[0] + ' et al.'
    if len(names) == 1:
        return names[0]
    if len(names) == 2:
        return f'{names[0]} and {names[1]}'
    return ', '.join(names[:-1]) + ', and ' + names[-1]


def ieee_from_crossref(m: dict) -> str:
    title = (m.get('title') or [NV])[0]
    cont = (m.get('container-title') or [''])[0]
    venue = IEEE_ABBR.get(cont.lower(), cont) or NV
    parts = (m.get('published-print') or m.get('published-online')
             or m.get('issued') or {}).get('date-parts', [[None]])[0]
    year = parts[0] or NV
    mon = MON[parts[1] - 1] + ' ' if len(parts) > 1 and parts[1] else ''
    vol, no = m.get('volume'), m.get('issue')
    pages = (m.get('page') or '').replace('-', '–')
    art = m.get('article-number')
    doi = m.get('DOI', '')
    if m.get('type') == 'proceedings-article':
        s = f'{_ieee_authors(m.get("author"))}, "{title}," in Proc. {cont or NV}, {year}'
        s += f', pp. {pages}' if pages else ''
    else:
        s = f'{_ieee_authors(m.get("author"))}, "{title}," {venue}'
        s += f', vol. {vol}' if vol else f', vol. {NV}'
        s += f', no. {no}' if no else ''
        s += f', pp. {pages}' if pages else (f', Art. no. {art}' if art else f', pp. {NV}')
        s += f', {mon}{year}'
    return s + (f', doi: {doi}.' if doi else '.')


@bp.route('/cite', methods=['POST'])
def api_cite():
    """⑦ Crossref 로 서지를 검증해 IEEE 문자열을 만든다. 못 찾으면 [미검증] 을 남긴다."""
    d = request.json or {}
    items = load_inbox()
    it = find_item(items, d.get('key'))
    if not it:
        return jsonify({'status': 'error', 'error': '수집함에 없습니다'}), 404
    s = load_settings()
    p = it['paper']
    key = it['key']
    m = None
    if p.get('doi'):
        j = http_get(f'{CROSSREF}/{p["doi"]}', {'mailto': s['contact_email']},
                     email=s['contact_email'])
        m = (j or {}).get('message')
    if not m and p.get('title'):
        j = http_get(CROSSREF, {'query.bibliographic': p['title'], 'rows': 1,
                                'mailto': s['contact_email']}, email=s['contact_email'])
        cand = ((j or {}).get('message') or {}).get('items') or []
        if cand and norm_title((cand[0].get('title') or [''])[0])[:40] == norm_title(p['title'])[:40]:
            m = cand[0]
    if m:
        ieee = ieee_from_crossref(m)
        verified = NV not in ieee
    else:
        ieee = (f'{p.get("authors") or NV}, "{p.get("title") or NV}," '
                f'{p.get("venue") or NV}, {p.get("year") or NV}. — Crossref 확인 실패 {NV}')
        verified = False

    return jsonify({'status': 'ok', 'key': key, 'ieee': ieee, 'verified': verified,
                    'pandoc': f'[@{key}]', 'wikilink': f'[[{key}]]',
                    'bibtex': bibtex_entry(key, p)})


@bp.route('/draft', methods=['POST'])
def api_draft():
    """⑦ 초안 파일에 인용이 붙은 문단을 덧붙인다. 문장은 사용자가 쓴 것만 들어간다."""
    d = request.json or {}
    items = load_inbox()
    it = find_item(items, d.get('key'))
    if not it:
        return jsonify({'status': 'error', 'error': '수집함에 없습니다'}), 404
    s = load_settings()
    text = (d.get('text') or '').strip()
    if not text:
        return jsonify({'status': 'error', 'error': '초안 문장이 비었습니다'}), 400
    try:
        fp = safe_vault_path(d.get('draft_path') or s['draft_path'])
    except ValueError:
        return jsonify({'status': 'error', 'error': '볼트 밖 경로'}), 403
    fp.parent.mkdir(parents=True, exist_ok=True)
    head = '' if fp.exists() else ('# 초안\n\n> lab-scholar 7단계에서 쌓인 문단. '
                                   '인용은 `[@citekey]` — Pandoc 이 읽는 형식입니다.\n')
    block = (f'\n## {datetime.date.today().isoformat()} · [[{it["key"]}]]\n\n'
             f'{text} [@{it["key"]}]\n')
    with open(fp, 'a', encoding='utf-8') as f:
        f.write(head + block)
    it['cited'] = True
    it['stage'] = max(it.get('stage', 6), 7)
    save_inbox(items)
    return jsonify({'status': 'ok', 'path': fp.relative_to(VAULT).as_posix(),
                    'appended': block.strip()})


# ═══════════════════════════════════════════════
# 설정 · 폴더 목록
# ═══════════════════════════════════════════════
@bp.route('/settings')
def api_settings_get():
    return jsonify({'status': 'ok', 'settings': load_settings(),
                    'defaults': DEFAULT_SETTINGS,
                    'section_label': SECTION_LABEL,
                    'path': 'Server/scholar_settings.json'})


@bp.route('/settings', methods=['POST'])
def api_settings_post():
    d = (request.json or {}).get('settings') or {}
    s = load_settings()
    for k in DEFAULT_SETTINGS:
        if k in d:
            s[k] = d[k]
    for k in ('pdf_dir', 'note_dir', 'draft_path', 'bib_path'):
        try:
            safe_vault_path(s[k])
        except ValueError:
            return jsonify({'status': 'error', 'error': f'{k} 가 볼트 밖을 가리킵니다'}), 400
    save_settings(s)
    return jsonify({'status': 'ok', 'settings': s})


@bp.route('/settings/reset', methods=['POST'])
def api_settings_reset():
    if SETTINGS_PATH.exists():
        SETTINGS_PATH.unlink()
    return jsonify({'status': 'ok', 'settings': DEFAULT_SETTINGS})


@bp.route('/vault-folders')
def api_vault_folders():
    """저장 폴더 고르기용 — 볼트 안의 폴더와 각 폴더의 .md 개수."""
    skip = {'.obsidian', '.git', '_company', 'node_modules', 'lab-scholar'}
    out = []
    for p in sorted(VAULT.rglob('*')):
        if not p.is_dir():
            continue
        rel = p.relative_to(VAULT)
        if any(part in skip or part.startswith('.') for part in rel.parts):
            continue
        if len(rel.parts) > 3:
            continue
        out.append({'path': rel.as_posix(), 'notes': len(list(p.glob('*.md')))})
    return jsonify({'status': 'ok', 'root': 'GFM_Research', 'folders': out})
