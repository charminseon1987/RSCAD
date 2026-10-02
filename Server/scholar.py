"""
Server/scholar.py — 연구실 스콜라 7단계 워크플로 백엔드

  검색·답변과 수집 워크플로를 한 줄기로 합친다. 단계는 일곱이고, 각 단계는
  자기 산출물을 수집함(Server/scholar_inbox.json)에 남긴다. 다음 단계는 그
  산출물이 있어야 열린다 — 근거 없이 노트가 만들어지는 길을 막기 위해서다.

    ① 검색      외부 DB(OpenAlex·S2·arXiv) + 내 볼트를 한 번에
    ② 선별      점수·중복 제거 후 수집함에 담기
    ③ 원본 확보 OA PDF → 지정 폴더에 cite_key.pdf 로 보관 · BibTeX 적립
    ④ 하이라이트 내장 PDF 리더에서 5색으로 칠한다 (색 = 분류)
    ⑤ 노트화    literature 템플릿(▸/※)대로 .md 생성, 저장 폴더 지정
    ⑥ 연결      볼트의 기존 노트와 [[위키링크]]
    ⑦ 인용·초안 IEEE 인용문 · [@citekey] · 초안 파일에 삽입

  원칙(app.py 와 동일): 값을 날조하지 않는다.
    - 외부 API 가 주지 않은 서지 필드는 '미명시' 로 남긴다.
    - 초록만 읽었으면 extraction_depth=abstract 이고, 수치 필드는 채우지 않는다
      (obsidian-note-template 리젝 규칙 R1).
"""

from __future__ import annotations

import datetime
import json
import math
import re
import threading
import time
import uuid
import xml.etree.ElementTree as ET
from pathlib import Path

import requests
import yaml
from flask import Blueprint, jsonify, request, send_file

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
     'tool': 'Unpaywall · BibTeX · 첨부 보관',
     'desc': '오픈액세스 PDF를 지정 폴더에 cite_key 이름으로 보관한다. 이게 첨부 저장소다.',
     'needs': 'screen'},
    {'n': 4, 'key': 'highlight', 'title': '정독 · 하이라이트',
     'tool': '내장 PDF 리더 · 5색 규칙 = 분류',
     'desc': '보관한 PDF를 이 화면에서 읽고 끌어서 칠한다. 색이 그대로 노트의 섹션이 된다.',
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


def http_get(url, params=None, as_json=True, email='', wait=0.2, tries=3, timeout=25,
             sink=None):
    """실패는 None. 예외를 밖으로 던지지 않는다 — 한 소스가 죽어도 나머지는 살린다.

    sink 에 dict 를 주면 마지막 상태코드를 담아 둔다. 호출자가 429(속도 제한)와
    400(요청이 틀림)을 구분해 안내해야 하므로 — 추측으로 원인을 말하면 안 된다.
    """
    for i in range(tries):
        try:
            r = requests.get(url, params=params, headers=_ua(email), timeout=timeout)
            if sink is not None:
                sink['status'] = r.status_code
            if r.status_code == 200:
                time.sleep(wait)
                return r.json() if as_json else r
            if r.status_code in (429, 503):
                time.sleep(1.5 * (i + 1))
                continue
            return None
        except requests.RequestException as e:
            if sink is not None:
                sink['status'] = type(e).__name__
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


def stamp_keys(recs: list) -> list:
    """후보마다 cite_key 를 매기고 볼트·수집함에 이미 있는지 표시한다.

    검색(①)과 식별자 추가(②)가 같은 규칙으로 키를 매겨야 한다 — 경로에 따라
    키가 달라지면 같은 논문이 두 키로 들어온다.
    """
    taken = existing_cite_keys()
    inbox_keys = {i['key'] for i in load_inbox()}
    for r in recs:
        base = cite_key(r)
        r['cite_key'] = base
        r['in_vault'] = base in taken
        r['in_inbox'] = base in inbox_keys
    return recs


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


def search_openalex(q, y, n, email, sink=None):
    d = http_get(f'{OPENALEX}/works', {
        'search': q, 'filter': f'publication_year:>{int(y) - 1}',
        'sort': 'relevance_score:desc', 'per-page': min(n, 50), 'mailto': email},
        email=email, sink=sink)
    if d is None:
        return None
    return [from_openalex(w, 'openalex') for w in d.get('results', [])]


def search_s2(q, y, n, email, sink=None):
    d = http_get(f'{S2}/paper/search', {
        'query': q, 'year': f'{y}-', 'limit': min(n, 30),
        'fields': ('title,year,venue,externalIds,citationCount,abstract,'
                   'openAccessPdf,authors,fieldsOfStudy'),
    }, email=email, wait=1.0, sink=sink)
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


def search_arxiv(q, y, n, email, sink=None):
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

    pool, failed, counts, codes = [], [], {}, {}
    runners = {'openalex': search_openalex, 's2': search_s2, 'arxiv': search_arxiv}
    for name in sources:
        fn = runners.get(name)
        if not fn:
            continue
        sink = {}
        got = fn(q, year, max(top, 20), email, sink=sink)
        if got is None:
            failed.append(name)
            counts[name] = None
            codes[name] = sink.get('status')
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

    stamp_keys(papers)

    # 실패는 숨기지 않는다 — 어느 소스가 빠졌는지 알아야 결과를 믿을지 판단할 수 있다
    label = {'openalex': 'OpenAlex', 's2': 'Semantic Scholar', 'arxiv': 'arXiv'}
    hints = []
    for name in failed:
        c = codes.get(name)
        if c == 429:
            why = '속도 제한(429) — 잠시 후 재시도'
            if name == 'openalex' and not email:
                why += ' · ⚙ 설정에 연락 메일을 넣으면 완화됩니다'
        elif c == 400:
            why = '요청이 거부됨(400) — 검색 조건을 확인하세요'
        elif isinstance(c, int):
            why = f'HTTP {c}'
        elif c:
            why = f'네트워크 오류({c})'
        else:
            why = '응답 없음 — 네트워크를 확인하세요'
        hints.append(f'{label.get(name, name)} 실패 — {why}')

    return jsonify({
        'status': 'ok', 'query': q, 'papers': papers,
        'counts': counts, 'failed': failed, 'codes': codes,
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
            # 라이브러리 축 — 컬렉션은 여러 개 동시 소속이 되어야 해서 목록이다
            'collections': [],
            'tags': [],
            'starred': False,
            'added': datetime.datetime.now().isoformat(timespec='seconds'),
        })
        added.append(key)
    save_inbox(items)
    if added:
        autofetch(added)
    return jsonify({'status': 'ok', 'added': added, 'items': items,
                    'autofetch': bool(added),
                    'note': ('원본 PDF 를 받아 색인에 넣는 중입니다 — 몇 분 걸립니다. '
                             '끝나면 소스 목록의 ‘미색인’ 표시가 사라집니다') if added else ''})


def autofetch(keys: list) -> None:
    """담은 직후 원본을 받아 색인까지 넣는다. 배경에서 돈다.

    이게 없으면 담은 논문은 서지만 있고 본문이 없어서 대화·산출물에서 영영
    쓸 수 없다 (실제로 수집함 5편과 색인 6편이 하나도 겹치지 않았다).
    네트워크를 기다리느라 '담기' 가 멈추면 안 되므로 응답은 먼저 보낸다.
    """
    def work():
        s = load_settings()
        got = []
        for key in keys:
            it = find_item(load_inbox(), key)
            if not it or attach_path(it, s):          # 이미 원본이 있으면 건드리지 않는다
                continue
            res = fetch_pdf(key, it['paper'], s['contact_email'], s['pdf_dir'])
            items = load_inbox()                      # 그 사이 바뀌었을 수 있다
            cur = find_item(items, key)
            if not cur:
                continue
            cur['original'] = dict(cur.get('original') or {}, pdf=res)
            if res.get('ok'):
                cur['stage'] = max(cur.get('stage', 2), 3)
                got.append(key)
            save_inbox(items)
        if got:
            # 색인은 indexer 가 맡는다. 순환 임포트를 피해 여기서 늦게 부른다.
            try:
                import indexer
                indexer.start(got)
            except Exception:                         # noqa: BLE001
                pass

    threading.Thread(target=work, daemon=True).start()


# ═══════════════════════════════════════════════
# ② 식별자로 바로 추가 — DOI · arXiv ID · URL · 제목
#   아는 논문을 검색 단계를 거치지 않고 꽂는다. 받은 필드만 채운다 —
#   Crossref·arXiv 가 주지 않은 값은 비워 두고 '미명시' 로 흘러가게 한다.
#   제목으로 찾은 것은 한 건으로 확정하지 않는다. 후보를 돌려주고 사람이 고른다 —
#   단정하면 엉뚱한 논문이 cite_key 를 차지한다.
# ═══════════════════════════════════════════════
DOI_RE = re.compile(r'10\.\d{4,9}/[-._;()/:A-Za-z0-9]+')
ARXIV_RE = re.compile(r'(?:arxiv[:\s/]*|abs/|pdf/)(\d{4}\.\d{4,5})(?:v\d+)?', re.I)
ARXIV_BARE = re.compile(r'^(\d{4}\.\d{4,5})(?:v\d+)?$')
ARXIV_NS = {'a': 'http://www.w3.org/2005/Atom', 'x': 'http://arxiv.org/schemas/atom'}


def _cr_authors(lst) -> str:
    out = []
    for a in lst or []:
        nm = ' '.join(x for x in [(a.get('given') or '').strip(),
                                  (a.get('family') or '').strip()] if x)
        if nm:
            out.append(nm)
    return ', '.join(out[:6])


def from_crossref(m: dict) -> dict:
    """Crossref 레코드 → 내부 서지. 날짜가 없으면 year 는 None 으로 둔다."""
    r = empty_rec()
    parts = ((m.get('published-print') or m.get('published-online')
              or m.get('issued') or {}).get('date-parts') or [[None]])[0]
    r.update(
        title=(m.get('title') or [''])[0],
        year=parts[0] if parts and parts[0] else None,
        venue=(m.get('container-title') or [''])[0],
        volume=m.get('volume') or '', issue=m.get('issue') or '',
        pages=m.get('page') or '', doi=(m.get('DOI') or '').lower(),
        cited_by=m.get('is-referenced-by-count') or 0,
        authors=_cr_authors(m.get('author')),
        # Crossref 초록은 JATS 태그가 섞여 온다
        abstract=' '.join(re.sub(r'<[^>]+>', ' ', m.get('abstract') or '').split()),
        landing=m.get('URL') or '', source='crossref',
    )
    return r


def openalex_by_doi(doi: str, email: str):
    d = http_get(f'{OPENALEX}/works/https://doi.org/{doi}', {'mailto': email}, email=email)
    return from_openalex(d, 'openalex') if d else None


def arxiv_by_id(aid: str, email: str):
    """arXiv ID 하나로 받는다. 없는 ID 면 arXiv 가 'Error' 항목을 주므로 걸러낸다."""
    resp = http_get(ARXIV, {'id_list': aid, 'max_results': 1},
                    as_json=False, email=email, wait=0)
    if resp is None:
        return None
    try:
        e = ET.fromstring(resp.content).find('a:entry', ARXIV_NS)
    except ET.ParseError:
        return None
    if e is None or '/api/errors' in e.findtext('a:id', '', ARXIV_NS):
        return None
    title = ' '.join(e.findtext('a:title', '', ARXIV_NS).split())
    if not title:
        return None
    r = empty_rec()
    try:
        yr = int(e.findtext('a:published', '0000', ARXIV_NS)[:4]) or None
    except ValueError:
        yr = None
    jref = ' '.join((e.findtext('x:journal_ref', '', ARXIV_NS) or '').split())
    r.update(title=title, year=yr, venue=jref or 'arXiv (preprint)',
             doi=(e.findtext('x:doi', '', ARXIV_NS) or '').lower(),
             authors=', '.join(a.findtext('a:name', '', ARXIV_NS)
                               for a in e.findall('a:author', ARXIV_NS)[:6]),
             abstract=' '.join(e.findtext('a:summary', '', ARXIV_NS).split()),
             pdf_url=f'https://arxiv.org/pdf/{aid}',
             landing=f'https://arxiv.org/abs/{aid}', source='arxiv')
    return r


def parse_identifier(text: str) -> tuple:
    """붙여 넣은 문자열에서 식별자를 뽑는다. ('doi'|'arxiv'|'title', 값)."""
    t = text.strip()
    m = DOI_RE.search(t)
    if m:
        return 'doi', m.group(0).rstrip('.,;)]>').lower()
    m = ARXIV_BARE.match(t) or ARXIV_RE.search(t)
    if m:
        return 'arxiv', m.group(1)
    return 'title', t


@bp.route('/identify', methods=['POST'])
def api_identify():
    """② 식별자·제목으로 서지를 찾는다. 못 찾으면 못 찾았다고 말한다."""
    d = request.json or {}
    text = (d.get('text') or '').strip()
    if len(text) < 4:
        return jsonify({'status': 'error', 'error': '네 글자 이상 입력하세요'}), 400
    email = load_settings()['contact_email']
    kind, val = parse_identifier(text)

    if kind == 'title':
        got = search_openalex(val, 1900, 5, email)
        if got is None:
            return jsonify({'status': 'error',
                            'error': 'OpenAlex 응답이 없습니다 — 잠시 후 다시 시도하세요'}), 502
        cands = [r for r in got if r.get('title')]
        for r in cands:
            r['score'] = 0.0
        return jsonify({'status': 'ok', 'mode': 'candidates',
                        'candidates': stamp_keys(cands),
                        'how': f'OpenAlex 제목 검색 — 후보 {len(cands)}건',
                        'note': '제목 검색은 같은 논문이라고 단정하지 않습니다. 직접 고르세요.'})

    if kind == 'doi':
        j = http_get(f'{CROSSREF}/{val}', {'mailto': email}, email=email)
        msg = (j or {}).get('message')
        rec = from_crossref(msg) if msg else openalex_by_doi(val, email)
        how = f'Crossref · {val}' if msg else (f'OpenAlex · {val}' if rec else '')
        if not rec or not rec.get('title'):
            return jsonify({'status': 'error',
                            'error': f'{val} 를 Crossref·OpenAlex 에서 찾지 못했습니다'}), 404
    else:
        rec = arxiv_by_id(val, email)
        if not rec:
            return jsonify({'status': 'error',
                            'error': f'arXiv {val} 를 찾지 못했습니다 — ID 를 확인하세요'}), 404
        how = f'arXiv · {val}'

    rec['score'] = 0.0
    stamp_keys([rec])
    return jsonify({'status': 'ok', 'mode': 'exact', 'paper': rec, 'how': how})


@bp.route('/inbox/<key>', methods=['PATCH'])
def api_inbox_patch(key):
    items = load_inbox()
    it = find_item(items, key)
    if not it:
        return jsonify({'status': 'error', 'error': f'수집함에 없습니다: {key}'}), 404
    d = request.json or {}
    # EDITABLE 을 공유해 프리뷰가 반영하는 필드와 저장되는 필드가 갈리지 않게 한다
    for f in EDITABLE + ('links', 'note_path', 'cited', 'stage', 'memo',
                         'collections', 'tags', 'starred'):
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
# ③ 원본 확보 — PDF 첨부 보관 · BibTeX
# ═══════════════════════════════════════════════
def unpaywall_pdf(doi: str, email: str) -> str:
    if not doi or not email:
        return ''
    d = http_get(f'{UNPAYWALL}/{doi}', {'email': email}, email=email) or {}
    return ((d.get('best_oa_location') or {}).get('url_for_pdf')) or ''


def fetch_pdf(key: str, p: dict, email: str, rel_dir: str) -> dict:
    """오픈액세스 PDF 를 받아 cite_key.pdf 로 보관한다. 실패는 이유를 돌려준다.

    ③ '원본 가져오기' 와 ② '담자마자' 가 같은 길을 쓴다 — 두 벌로 두면
    한쪽만 고쳐져 어떤 경로로 담았느냐에 따라 결과가 달라진다.
    """
    url = p.get('pdf_url') or ''
    if not (url.lower().endswith('.pdf') or 'arxiv.org/pdf' in url):
        url = unpaywall_pdf(p.get('doi') or '', email) or url
    if not url:
        return {'ok': False,
                'msg': '오픈액세스 PDF 링크가 없습니다 — 도서관 경유로 직접 저장하세요'}
    resp = http_get(url, as_json=False, email=email, wait=0, tries=2, timeout=60)
    if not resp or b'%PDF' not in resp.content[:2048]:
        return {'ok': False, 'url': url,
                'msg': 'PDF 가 아니라 랜딩/유료 페이지였습니다 — 수동 저장이 필요합니다'}
    try:
        d = safe_vault_path(rel_dir)
    except ValueError:
        return {'ok': False, 'msg': '볼트 밖 경로'}
    d.mkdir(parents=True, exist_ok=True)
    fp = d / f'{key}.pdf'
    fp.write_bytes(resp.content)
    return {'ok': True, 'path': fp.relative_to(VAULT).as_posix(),
            'bytes': len(resp.content), 'msg': '원본을 저장했습니다'}


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



@bp.route('/original', methods=['POST'])
def api_original():
    """③ OA PDF → 지정 폴더 · BibTeX 적립. 채널별 결과를 따로 돌려준다.

    PDF 는 cite_key.pdf 로 고정해 보관한다 — ④ 리더와 노트의 #page 앵커가
    같은 이름을 찾기 때문이다. 유료 논문은 사용자가 같은 이름으로 넣으면 물린다.
    """
    d = request.json or {}
    items = load_inbox()
    it = find_item(items, d.get('key'))
    if not it:
        return jsonify({'status': 'error', 'error': f'수집함에 없습니다: {d.get("key")}'}), 404

    s = load_settings()
    p = it['paper']
    key = it['key']
    email = s['contact_email']
    want = d.get('channels') or ['pdf', 'bib']
    out = dict(it.get('original') or {})

    # ── PDF ──
    if 'pdf' in want:
        out['pdf'] = fetch_pdf(key, p, email, d.get('pdf_dir') or s['pdf_dir'])

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

    it['original'] = out
    it['stage'] = max(it.get('stage', 2), 3)
    save_inbox(items)
    return jsonify({'status': 'ok', 'original': out, 'item': it})


# ═══════════════════════════════════════════════
# ③ 첨부 — 보관한 PDF 를 브라우저로 내보낸다
#   Zotero 의 storage 자리. 파일 이름은 cite_key.pdf 로 고정한다 —
#   ④ 리더와 노트의 [[key.pdf#page=N]] 앵커가 같은 이름을 찾기 때문이다.
# ═══════════════════════════════════════════════
def _norm_name(s: str) -> str:
    """파일명·키 비교용. 대소문자·밑줄·공백·하이픈 차이를 지운다."""
    return re.sub(r'[^a-z0-9]', '', (s or '').lower())


def attach_path(it: dict, s: dict = None):
    """보관한 PDF 의 실제 경로. 없으면 None — 있다고 지어내지 않는다.

    손으로 모아 둔 PDF 는 파일명이 cite_key 와 다르다. 실제로 이 볼트가 그랬다:
        Salem_2025_GFM_Review.pdf    ↔ salem2025gfmreview
        DArco_2014_VSM_Droop.pdf     ↔ darco2014vsm
        Liu 2025 datadriven cpes.pdf ↔ liu2025datadriven
    이름만 정확히 맞춰 보면 이 셋을 못 찾아 '원문 없음·미색인' 으로 뜬다 —
    색인에는 멀쩡히 들어 있는데도. 그래서 이름 차이를 지운 뒤 비교하고,
    그래도 안 맞으면 한쪽이 다른 쪽으로 시작하는 경우까지 본다.

    단, **후보가 둘 이상이면 고르지 않는다**. 엉뚱한 논문의 본문을 그 논문의
    근거로 내놓는 것이 못 찾는 것보다 나쁘다.
    """
    s = s or load_settings()
    rec = (it.get('original') or {}).get('pdf') or {}
    for rel in [f'{s["pdf_dir"]}/{it["key"]}.pdf'] + ([rec['path']] if rec.get('path') else []):
        try:
            fp = safe_vault_path(rel)
        except ValueError:
            continue
        if fp.is_file():
            return fp

    try:
        d = safe_vault_path(s['pdf_dir'])
    except ValueError:
        return None
    if not d.is_dir():
        return None
    key = _norm_name(it['key'])
    if not key:
        return None
    files = list(d.glob('*.pdf'))
    exact = [p for p in files if _norm_name(p.stem) == key]
    if len(exact) == 1:
        return exact[0]
    pre = [p for p in files if _norm_name(p.stem).startswith(key)]
    if len(pre) == 1:
        return pre[0]
    return None


@bp.route('/pdf/<key>')
def api_pdf(key):
    """④ 내장 리더가 읽을 PDF. Range 요청을 받아야 pdf.js 가 점진적으로 읽는다."""
    it = find_item(load_inbox(), key)
    if not it:
        return jsonify({'status': 'error', 'error': f'수집함에 없습니다: {key}'}), 404
    fp = attach_path(it)
    if not fp:
        return jsonify({'status': 'error',
                        'error': '보관된 PDF 가 없습니다 — ③에서 받거나 직접 올리세요'}), 404
    return send_file(fp, mimetype='application/pdf', conditional=True)


@bp.route('/attachments')
def api_attachments():
    """항목별 첨부 유무. 라이브러리 표가 '원문 있음' 을 표시하는 근거다."""
    s = load_settings()
    out = {}
    for it in load_inbox():
        fp = attach_path(it, s)
        out[it['key']] = ({'ok': True, 'path': fp.relative_to(VAULT).as_posix(),
                           'bytes': fp.stat().st_size} if fp
                          else {'ok': False, 'msg': '보관된 PDF 없음'})
    return jsonify({'status': 'ok', 'attachments': out})


@bp.route('/attach/<key>', methods=['POST'])
def api_attach(key):
    """유료 논문용 — 브라우저에서 올려 cite_key.pdf 로 보관한다.

    ③의 자동 수집이 못 가져오는 논문이 대부분이다. 올리는 길이 없으면
    사용자가 파일 탐색기로 직접 넣어야 하고, 이름을 틀리면 ④가 못 찾는다.
    """
    items = load_inbox()
    it = find_item(items, key)
    if not it:
        return jsonify({'status': 'error', 'error': f'수집함에 없습니다: {key}'}), 404
    f = request.files.get('file')
    if not f:
        return jsonify({'status': 'error', 'error': 'file 이 필요합니다'}), 400
    blob = f.read()
    if blob[:4] != b'%PDF':
        return jsonify({'status': 'error',
                        'error': 'PDF 가 아닙니다 (%PDF 머리말이 없습니다)'}), 400
    s = load_settings()
    try:
        d = safe_vault_path(s['pdf_dir'])
    except ValueError:
        return jsonify({'status': 'error', 'error': '볼트 밖 경로'}), 403
    d.mkdir(parents=True, exist_ok=True)
    fp = d / f'{key}.pdf'
    fp.write_bytes(blob)
    rel = fp.relative_to(VAULT).as_posix()
    it['original'] = dict(it.get('original') or {},
                          pdf={'ok': True, 'path': rel, 'bytes': len(blob),
                               'msg': '직접 올린 원본입니다'})
    it['stage'] = max(it.get('stage', 2), 3)
    save_inbox(items)
    return jsonify({'status': 'ok', 'path': rel, 'bytes': len(blob), 'item': it})


# ═══════════════════════════════════════════════
# ④ 주석 — 수집함 highlights 를 PDF 좌표까지 확장한다
#   같은 배열에 그대로 쌓는다. 노트 렌더(_by_section·bullets)는 text·page 만
#   읽으므로 rects·color 가 늘어도 노트 모양은 바뀌지 않는다.
#   rects 는 페이지 크기로 나눈 0~1 좌표다 — 확대율이 달라도 같은 자리에 뜬다.
# ═══════════════════════════════════════════════
ANNOT_KEEP = ('section', 'text', 'page', 'color', 'rects', 'note')


def _clean_rects(v) -> list:
    """좌표만 남긴다. 숫자가 아니면 버린다 — 깨진 값이 노트까지 가면 안 된다."""
    out = []
    for r in v or []:
        try:
            out.append({k: round(float(r[k]), 6) for k in ('x', 'y', 'w', 'h')})
        except (KeyError, TypeError, ValueError):
            continue
    return out[:60]


def _find_annot(hs: list, aid: str):
    """id 로 찾고, 없으면 순번으로도 찾는다 — id 없던 옛 발췌도 지울 수 있어야 한다."""
    idx = next((i for i, h in enumerate(hs) if h.get('id') == aid), None)
    if idx is None and aid.isdigit() and int(aid) < len(hs):
        idx = int(aid)
    return idx


@bp.route('/annot', methods=['POST'])
def api_annot_add():
    """하이라이트 하나를 붙인다. 서버가 id 를 매겨 나중에 지우고 고칠 수 있게 한다."""
    d = request.json or {}
    items = load_inbox()
    it = find_item(items, d.get('key'))
    if not it:
        return jsonify({'status': 'error', 'error': f'수집함에 없습니다: {d.get("key")}'}), 404
    a = d.get('annot') or {}
    text = (a.get('text') or '').strip()
    if not text:
        return jsonify({'status': 'error', 'error': '발췌가 비었습니다'}), 400
    s = load_settings()
    rules = {h['section']: h for h in s['highlights']}
    sec = a.get('section') if a.get('section') in rules else 'background'
    page = str(a.get('page') or '').strip()
    annot = {
        'id': uuid.uuid4().hex[:10],
        'section': sec,
        'text': text[:2000],
        'page': page,
        # 색은 규칙에서 가져온다 — 섹션과 색이 갈리면 노트와 리더가 달라 보인다
        'color': a.get('color') or rules[sec]['color'],
        'rects': _clean_rects(a.get('rects')),
        'note': (a.get('note') or '').strip()[:500],
        'created': datetime.datetime.now().isoformat(timespec='seconds'),
    }
    it['highlights'] = (it.get('highlights') or []) + [annot]
    it['extraction_depth'] = 'full'              # 칠했다는 건 원문을 봤다는 뜻
    it['stage'] = max(it.get('stage', 2), 4)
    save_inbox(items)
    return jsonify({'status': 'ok', 'annot': annot, 'item': it})


@bp.route('/annot/<key>/<aid>', methods=['PATCH', 'DELETE'])
def api_annot_edit(key, aid):
    """주석 하나를 고치거나 지운다."""
    items = load_inbox()
    it = find_item(items, key)
    if not it:
        return jsonify({'status': 'error', 'error': f'수집함에 없습니다: {key}'}), 404
    hs = list(it.get('highlights') or [])
    idx = _find_annot(hs, aid)
    if idx is None:
        return jsonify({'status': 'error', 'error': f'주석이 없습니다: {aid}'}), 404
    if request.method == 'DELETE':
        hs.pop(idx)
    else:
        d = request.json or {}
        for f in ANNOT_KEEP:
            if f in d:
                hs[idx][f] = _clean_rects(d[f]) if f == 'rects' else d[f]
    it['highlights'] = hs
    save_inbox(items)
    return jsonify({'status': 'ok', 'item': it})


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
    (model_order 등)는 리젝 규칙 R1 에 따라 '미명시' 로 남긴다.
    """
    p = it['paper']
    hs = _by_section(it.get('highlights'))
    depth = it.get('extraction_depth') or 'abstract'
    # 볼트·ce_tool 과 같은 표기여야 00_MOC.md 의 GROUP BY 가 한 버킷으로 모인다
    unknown = '미명시'                      # 내가 아직 원문을 못 봄
    pdf = (it.get('original') or {}).get('pdf') or {}
    pdf_link = f'"[[{key}.pdf]]"' if pdf.get('ok') else '""'
    pdf_status = 'have' if pdf.get('ok') else ('oa-available' if p.get('pdf_url') else 'none')
    authors = [a.strip() for a in (p.get('authors') or '').split(',') if a.strip()]
    today = datetime.date.today().isoformat()

    def esc(v):
        return str(v or '').replace('"', "'")

    def scalar(f):
        """볼트 표기를 따른다 — 숫자·불리언은 그대로, 문자열만 따옴표.

        model_order: 21 / dc_ac_coupling: false 처럼 써야 Dataview 가 수치·논리로
        다룬다. 문자열을 감싸는 것은 '1.5~10' 같은 값이 깨지지 않게 하기 위함이다.
        """
        v = it.get(f)
        if v is None or v == '' or v == []:
            return unknown
        if isinstance(v, bool):
            return 'true' if v else 'false'
        if isinstance(v, (int, float)):
            return str(v)
        return f'"{esc(v)}"'

    def seq(f):
        v = it.get(f) or []
        if isinstance(v, str):
            v = [v]
        return '[' + ', '.join(f'"{esc(x)}"' for x in v) + ']' if v else '[]'

    fm = [
        '---',
        'type: literature',
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
        f'control_scheme: {seq("control_scheme")}',
        f'model_order: {scalar("model_order")}',
        f'analysis_method: {seq("analysis_method") if it.get("analysis_method") else "[" + unknown + "]"}',
        f'tuning_method: {scalar("tuning_method")}',
        f'scr_range: {scalar("scr_range")}',
        f'xr_range: {scalar("xr_range")}',
        f'validation_level: {scalar("validation_level")}',
        f'hardware: {seq("hardware")}',
        f'extraction_depth: {depth}',
        f'dc_ac_coupling: {scalar("dc_ac_coupling")}',
        'pso_params: null',
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


# 노트 frontmatter 에서 사용자가 채울 수 있는 필드.
# 뒷줄은 00_MOC.md 의 §2 갭 확인·§3 축별 분포가 GROUP BY 하는 축이다 —
# 여기서 받지 않으면 그 표가 영구히 '미명시' 한 칸에 몰린다.
EDITABLE = (
    'highlights', 'extraction_depth', 'section', 'paper_type', 'target_system',
    'model_order', 'analysis_method', 'tuning_method', 'scr_range', 'xr_range',
    'validation_level', 'hardware', 'control_scheme', 'dc_ac_coupling',
)


def _apply_edits(it: dict, d: dict) -> None:
    for f in EDITABLE:
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
# 볼트에서 가져오기 — 노트는 있는데 수집함에 없는 논문
#   수집함 입구가 검색뿐이면 이미 읽어 노트까지 쓴 논문은 ④ 리더로 못 연다.
#   여기서는 '새로 담는' 게 아니라 기존 노트에 수집함 항목을 '붙인다' —
#   그래서 cite_key 를 그대로 쓴다. unique_cite_key 로 뒤에 글자를 붙이면
#   kenyon2020ibrstabilityb 처럼 갈라져 [[kenyon2020ibrstability]] 링크가 끊긴다.
#   서지는 노트 frontmatter 에서만 읽는다. 없는 값은 비워 둔다 — 지어내지 않는다.
# ═══════════════════════════════════════════════
FM_RE = re.compile(r'\A---\r?\n(.*?)\r?\n---\r?\n', re.S)

# frontmatter 에서 수집함 항목으로 옮겨 올 축 필드 (EDITABLE 과 짝)
FM_AXES = ('paper_type', 'target_system', 'control_scheme', 'model_order',
           'analysis_method', 'tuning_method', 'scr_range', 'xr_range',
           'validation_level', 'hardware', 'dc_ac_coupling', 'section')


def read_frontmatter(path: Path) -> dict:
    try:
        text = path.read_text(encoding='utf-8')
    except OSError:
        return {}
    m = FM_RE.match(text)
    if not m:
        return {}
    try:
        fm = yaml.safe_load(m.group(1))
    except yaml.YAMLError:
        return {}
    return fm if isinstance(fm, dict) else {}


def _as_text(v) -> str:
    if v is None:
        return ''
    if isinstance(v, list):
        return ', '.join(str(x) for x in v if x not in (None, ''))
    return str(v)


def _clean_axis(v):
    """'미명시'·'N/A' 는 값이 아니다 — 비워서 '아직 안 적음'과 같게 둔다."""
    if isinstance(v, str) and (v.strip() in ('미명시', '미확인', '') or v.startswith('N/A')):
        return None
    if isinstance(v, list):
        out = [x for x in v if _clean_axis(x) is not None]
        return out or None
    return v


H1_RE = re.compile(r'^#\s+(.+?)\s*$', re.M)


def heading_title(path: Path) -> str:
    """frontmatter 에 title 이 없는 옛 노트용 — 본문 첫 H1 을 쓴다.

    이건 서지 제목이 아니라 노트 제목이다 ('# 📚 Chen et al. 2024 — Electronics').
    그래서 호출부가 title_from='heading' 으로 표시해 사람이 구분하게 한다.
    """
    try:
        body = H1_RE.search(path.read_text(encoding='utf-8'))
    except OSError:
        return ''
    if not body:
        return ''
    # 장식용 이모지만 떼고 나머지는 그대로 둔다
    return re.sub(r'^[^\w(\[]+', '', body.group(1)).strip()


def paper_from_note(path: Path, fm: dict) -> dict:
    """노트 frontmatter → 내부 서지. venue 는 'Solar Energy, vol.210, pp.149-168'
    처럼 한 줄로 적힌 경우가 많아 쪼개지 않고 그대로 둔다 — 쪼개면 추측이 된다."""
    r = empty_rec()
    year = fm.get('year')
    r.update(
        title=_as_text(fm.get('title')),
        authors=_as_text(fm.get('authors')),
        year=year if isinstance(year, int) else None,
        venue=_as_text(fm.get('venue')),
        doi=_as_text(fm.get('doi')).lower(),
        cited_by=fm.get('cited_by') if isinstance(fm.get('cited_by'), int) else 0,
        topics=[t for t in (fm.get('tags') or []) if isinstance(t, str)][:6],
        source='vault',
    )
    return r


def vault_notes(inbox_keys: set) -> list:
    """수집함에 없는 볼트 문헌 노트. 노트 폴더만 본다 (claims·mine 은 논문이 아니다)."""
    s = load_settings()
    out = []
    for folder in dict.fromkeys([s['note_dir'], '00_Knowledge/literature']):
        d = VAULT / folder
        if not d.exists():
            continue
        for f in sorted(d.glob('*.md')):
            fm = read_frontmatter(f)
            key = str(fm.get('cite_key') or f.stem).strip()
            if not key or key in inbox_keys or any(o['key'] == key for o in out):
                continue
            paper = paper_from_note(f, fm)
            title_from = 'frontmatter' if paper['title'] else ''
            if not paper['title']:
                paper['title'] = heading_title(f)
                title_from = 'heading' if paper['title'] else 'none'
            it = {
                'key': key,
                'note_path': f.relative_to(VAULT).as_posix(),
                'paper': paper,
                # 'heading' 은 서지 제목이 아니라 노트 제목이다 — ⑦에서 DOI 로 검증해야 한다
                'title_from': title_from,
                'extraction_depth': fm.get('extraction_depth') or 'abstract',
                'axes': {a: _clean_axis(fm.get(a)) for a in FM_AXES
                         if _clean_axis(fm.get(a)) is not None},
            }
            fp = attach_path({'key': key, 'original': {}}, s)
            it['has_pdf'] = bool(fp)
            out.append(it)
    return out


@bp.route('/vault-papers')
def api_vault_papers():
    """볼트에만 있는 논문 목록 — ②의 '볼트에서 가져오기' 가 쓴다."""
    inbox_keys = {i['key'] for i in load_inbox()}
    return jsonify({'status': 'ok', 'papers': vault_notes(inbox_keys)})


@bp.route('/import', methods=['POST'])
def api_import():
    """고른 볼트 노트를 수집함에 붙인다. cite_key 는 그대로 쓴다.

    노트를 다시 쓰지 않는다 — 손으로 쓴 ▸/※ 가 거기 들어 있다. 발췌를 칠하면
    /note/append 가 발췌 섹션 하나만 갈아 끼운다.
    """
    d = request.json or {}
    want = [k for k in (d.get('keys') or []) if isinstance(k, str)]
    if not want:
        return jsonify({'status': 'error', 'error': '가져올 cite_key 가 필요합니다'}), 400

    items = load_inbox()
    inbox_keys = {i['key'] for i in items}
    found = {n['key']: n for n in vault_notes(inbox_keys)}
    added, skipped = [], []
    for key in want:
        n = found.get(key)
        if not n:
            skipped.append({'key': key, 'why': '볼트에 없거나 이미 수집함에 있습니다'})
            continue
        items.append({
            'key': key,
            'paper': {f: n['paper'].get(f) for f in PAPER_FIELDS},
            # 노트가 이미 있으므로 ⑤까지 끝난 상태다. ⑥ 연결은 아직 안 했다고 본다
            'stage': 5,
            'original': {},
            'highlights': [],
            'note_path': n['note_path'],
            'links': [],
            'cited': False,
            'collections': [],
            'tags': [],
            'starred': False,
            'from_vault': True,          # ⑤가 덮어쓰기 대신 덧붙이기를 쓰게 하는 표시
            'extraction_depth': n['extraction_depth'],
            'added': datetime.datetime.now().isoformat(timespec='seconds'),
            **n['axes'],
        })
        added.append(key)
    save_inbox(items)
    return jsonify({'status': 'ok', 'added': added, 'skipped': skipped, 'items': items})


# ── 발췌만 노트에 덧붙이기 ──
HI_HEAD = '## 🖍 리더에서 칠한 발췌'
SEC_RE = re.compile(r'^#{1,6} ', re.M)


def put_section(text: str, heading: str, body: str) -> str:
    """heading 섹션을 body 로 갈아 끼운다. 없으면 끝에 붙인다.

    섹션 하나만 건드린다 — 손으로 쓴 나머지는 글자 하나도 바뀌지 않는다.
    매번 통째로 다시 쓰므로 여러 번 눌러도 발췌가 겹쳐 쌓이지 않는다.
    """
    block = f'{heading}\n\n{body}\n'
    i = text.find(heading)
    if i < 0:
        return text.rstrip() + '\n\n' + block
    m = SEC_RE.search(text, i + len(heading))
    tail = text[m.start():] if m else ''
    return text[:i] + block + ('\n' + tail if tail else '')


def highlights_md(key: str, hs: list) -> str:
    """색(섹션)별로 묶어 ▸/※ 로 적는다. 노트 본문 규칙과 같은 표기다."""
    by = _by_section(hs)
    if not by:
        return '*(아직 칠한 발췌가 없습니다.)*'
    lines = []
    for sec, label in SECTION_LABEL.items():
        rows = by.get(sec) or []
        if not rows:
            continue
        lines.append(f'**{label}**')
        for h in rows:
            mark = '※' if sec == 'unknown' else '▸'
            anchor = f'  → [[{key}.pdf#page={h["page"]}]]' if h.get('page') else ''
            lines.append(f'- {mark} {h["text"]}{anchor}')
            if (h.get('note') or '').strip():
                lines.append(f'  - ※ {h["note"].strip()}')
        lines.append('')
    return '\n'.join(lines).rstrip()


@bp.route('/note/append', methods=['POST'])
def api_note_append():
    """④에서 칠한 발췌를 기존 노트의 발췌 섹션에 반영한다 (그 섹션만 바뀐다)."""
    d = request.json or {}
    items = load_inbox()
    it = find_item(items, d.get('key'))
    if not it:
        return jsonify({'status': 'error', 'error': '수집함에 없습니다'}), 404
    if not it.get('note_path'):
        return jsonify({'status': 'error', 'error': '연결된 노트가 없습니다'}), 400
    try:
        fp = safe_vault_path(it['note_path'])
    except ValueError:
        return jsonify({'status': 'error', 'error': '볼트 밖 경로'}), 403
    if not fp.is_file():
        return jsonify({'status': 'error', 'error': f'노트가 없습니다: {it["note_path"]}'}), 404

    before = fp.read_text(encoding='utf-8')
    after = put_section(before, HI_HEAD, highlights_md(it['key'], it.get('highlights') or []))
    if after != before:
        fp.write_text(after, encoding='utf-8')
    it['stage'] = max(it.get('stage', 2), 5)
    save_inbox(items)
    return jsonify({'status': 'ok', 'path': it['note_path'], 'changed': after != before,
                    'section': HI_HEAD, 'item': it})


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


# 볼트의 연결 섹션 제목은 한 가지가 아니다 — obsidian-note-template 은
# '## 🔗 본 연구 연결', render_note 는 '# 🔗 Knowledge Connections',
# ce_tool 은 아예 만들지 않는다. 한 모양만 문자열로 찾으면
# (1) 내 노트의 정방향 링크가 조용히 버려지고 (2) 상대 노트에 섹션이 둘 생긴다.
CONN_HEAD = re.compile(
    r'^#{1,3}[ \t]*(?:🔗[ \t]*)?'
    r'(?:Knowledge Connections|본 연구 연결|연결 노트|Connections)[ \t]*$',
    re.M)


def put_under_conn(text: str, line: str, replace: str = '') -> str:
    """연결 섹션을 찾아 그 바로 아래에 line 을 넣는다.

    replace 에 정규식을 주면 그 줄이 이미 있을 때 갈아끼운다 (중복 방지).
    섹션이 없으면 끝에 하나 만든다 — 이미 있는 섹션 옆에 또 만들지 않는다.
    """
    if replace and re.search(replace, text, flags=re.M):
        return re.sub(replace, lambda _m: line, text, count=1, flags=re.M)
    m = CONN_HEAD.search(text)
    if m:
        return text[:m.end()] + '\n' + line + text[m.end():]
    return text.rstrip() + '\n\n## 🔗 연결 노트\n' + line + '\n'


def note_dir_of(it: dict) -> str:
    """문자열 target 의 폴더를 추정한다 — 내 노트와 같은 폴더로 본다."""
    return (it.get('note_path') or '').rsplit('/', 1)[0] or load_settings()['note_dir']


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
    # targets 는 {note, path} 객체 목록. 문자열만 온 경우도 받는다 —
    # /note 의 links 는 문자열이라 호출부가 섞어 보내기 쉽고, 그때 500 이 나면 안 된다.
    targets = []
    for t in (d.get('targets') or []):
        if isinstance(t, str):
            n = t.strip()
            if n:
                targets.append({'note': n, 'path': f'{note_dir_of(it)}/{n}.md'})
        elif isinstance(t, dict) and t.get('note') and t.get('path'):
            targets.append(t)
        else:
            return jsonify({'status': 'error',
                            'error': "targets 는 문자열 또는 {note, path} 여야 합니다"}), 400
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
    mine.write_text(put_under_conn(text, line, r'^\* 연결된 노트:.*$'), encoding='utf-8')

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
        tp.write_text(put_under_conn(body, f'- [[{key}]]'), encoding='utf-8')
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
# 라이브러리 — 컬렉션 · 태그 · 저장한 검색 · 중복
#   수집함은 평면 리스트다. Zotero 좌측 패널이 하던 일을 여기서 한다.
#   컬렉션은 항목을 옮기지 않는다 — 항목이 어디에 속하는지만 적는다.
#   한 논문이 여러 컬렉션에 동시에 들어가야 하기 때문이다 (Zotero 와 같다).
# ═══════════════════════════════════════════════
LIBRARY_PATH = ROOT / 'Server' / 'scholar_library.json'
DEFAULT_LIBRARY = {'collections': [], 'saved': []}


def load_library() -> dict:
    lib = {k: list(v) for k, v in DEFAULT_LIBRARY.items()}
    if LIBRARY_PATH.exists():
        try:
            d = json.loads(LIBRARY_PATH.read_text(encoding='utf-8'))
        except Exception:                                    # noqa: BLE001
            return lib
        for k in DEFAULT_LIBRARY:
            if isinstance(d.get(k), list):
                lib[k] = d[k]
    return lib


def save_library(lib: dict) -> None:
    LIBRARY_PATH.write_text(json.dumps(lib, ensure_ascii=False, indent=2), encoding='utf-8')


def tag_counts(items: list) -> list:
    c = {}
    for it in items:
        for t in it.get('tags') or []:
            c[t] = c.get(t, 0) + 1
    return [{'tag': t, 'n': n} for t, n in sorted(c.items(), key=lambda x: (-x[1], x[0]))]


def dup_groups(items: list) -> list:
    """DOI 가 같거나 제목이 같은 묶음만 모은다.

    판정은 하지 않는다 — 어느 쪽을 남길지는 사람이 고른다. 자동 병합은
    서지가 다른 두 논문을 한 키로 합쳐 버릴 수 있다.
    """
    buckets = {}
    for it in items:
        p = it.get('paper') or {}
        k = (p.get('doi') or '').lower() or norm_title(p.get('title') or '')
        if not k:
            continue
        buckets.setdefault(k, []).append(it['key'])
    return [{'on': k, 'keys': v} for k, v in buckets.items() if len(v) > 1]


@bp.route('/library')
def api_library():
    """좌측 패널이 필요한 것 한 번에 — 컬렉션·저장검색·태그 집계·중복 묶음."""
    items = load_inbox()
    lib = load_library()
    return jsonify({'status': 'ok', 'collections': lib['collections'],
                    'saved': lib['saved'], 'tags': tag_counts(items),
                    'duplicates': dup_groups(items),
                    'path': 'Server/scholar_library.json'})


@bp.route('/library/collection', methods=['POST'])
def api_collection_put():
    """컬렉션을 만들거나 이름을 고친다. id 를 주면 수정, 없으면 생성."""
    d = request.json or {}
    name = (d.get('name') or '').strip()
    if not name:
        return jsonify({'status': 'error', 'error': '이름이 필요합니다'}), 400
    parent = (d.get('parent') or '').strip()
    lib = load_library()
    cid = d.get('id')
    cur = next((c for c in lib['collections'] if c['id'] == cid), None) if cid else None
    if cur:
        if parent == cur['id']:
            return jsonify({'status': 'error', 'error': '자기 자신을 상위로 둘 수 없습니다'}), 400
        cur['name'], cur['parent'] = name, parent
    else:
        if any(c['name'] == name and (c.get('parent') or '') == parent
               for c in lib['collections']):
            return jsonify({'status': 'error',
                            'error': f'같은 자리에 "{name}" 이 이미 있습니다'}), 409
        lib['collections'].append({'id': uuid.uuid4().hex[:8], 'name': name, 'parent': parent})
    save_library(lib)
    return jsonify({'status': 'ok', 'collections': lib['collections']})


@bp.route('/library/collection/<cid>', methods=['DELETE'])
def api_collection_del(cid):
    """컬렉션만 지운다 — 논문은 수집함에 남는다 (Zotero 와 같다)."""
    lib = load_library()
    kill = {cid}
    while True:                              # 하위 컬렉션까지 따라 내려간다
        more = {c['id'] for c in lib['collections']
                if (c.get('parent') or '') in kill and c['id'] not in kill}
        if not more:
            break
        kill |= more
    lib['collections'] = [c for c in lib['collections'] if c['id'] not in kill]
    save_library(lib)
    items = load_inbox()
    for it in items:
        if it.get('collections'):
            it['collections'] = [x for x in it['collections'] if x not in kill]
    save_inbox(items)
    return jsonify({'status': 'ok', 'collections': lib['collections'],
                    'items': items, 'removed': sorted(kill)})


@bp.route('/library/saved', methods=['POST'])
def api_saved_put():
    """저장한 검색 — 조건을 이름으로 남긴다. 결과를 저장하는 게 아니다.

    결과를 저장하면 수집함이 바뀌어도 낡은 목록이 남는다. 조건만 남기면
    누를 때마다 지금의 수집함에 다시 걸린다.
    """
    d = request.json or {}
    name = (d.get('name') or '').strip()
    if not name:
        return jsonify({'status': 'error', 'error': '이름이 필요합니다'}), 400
    lib = load_library()
    row = {'id': uuid.uuid4().hex[:8], 'name': name,
           'q': (d.get('q') or '').strip(),
           'tags': [t for t in (d.get('tags') or []) if isinstance(t, str)],
           'collection': (d.get('collection') or '').strip(),
           'stage_min': max(0, min(7, int(d.get('stage_min') or 0))),
           'has_pdf': bool(d.get('has_pdf')),
           'untagged': bool(d.get('untagged')),
           'starred': bool(d.get('starred'))}
    lib['saved'] = [x for x in lib['saved'] if x['name'] != name] + [row]
    save_library(lib)
    return jsonify({'status': 'ok', 'saved': lib['saved']})


@bp.route('/library/saved/<sid>', methods=['DELETE'])
def api_saved_del(sid):
    lib = load_library()
    lib['saved'] = [x for x in lib['saved'] if x['id'] != sid]
    save_library(lib)
    return jsonify({'status': 'ok', 'saved': lib['saved']})


@bp.route('/merge', methods=['POST'])
def api_merge():
    """중복 병합 — keep 에 모으고 나머지를 수집함에서 뺀다.

    서지는 keep 것을 그대로 둔다. 섞으면 어느 쪽 값인지 알 수 없게 된다.
    하이라이트·태그·컬렉션·링크만 합친다.
    단계도 올리지 않는다 — keep 의 산출물(노트·인용)만이 근거다. 뺀 쪽이
    남긴 노트 파일은 디스크에 그대로 있으므로 경로를 돌려준다 (지우는 건 사람의 일).
    """
    d = request.json or {}
    keep_key = d.get('keep')
    drop_keys = [k for k in (d.get('drop') or []) if k and k != keep_key]
    items = load_inbox()
    keep = find_item(items, keep_key)
    if not keep:
        return jsonify({'status': 'error', 'error': f'수집함에 없습니다: {keep_key}'}), 404
    drops = [it for it in items if it['key'] in drop_keys]
    if not drops:
        return jsonify({'status': 'error', 'error': '뺄 항목이 없습니다'}), 400

    seen = {(h.get('section'), (h.get('text') or '').strip())
            for h in keep.get('highlights') or []}
    merged = list(keep.get('highlights') or [])
    orphan_notes = []
    for it in drops:
        for h in it.get('highlights') or []:
            sig = (h.get('section'), (h.get('text') or '').strip())
            if sig in seen:
                continue
            seen.add(sig)
            merged.append(h)
        for f in ('tags', 'collections', 'links'):
            keep[f] = sorted(set(keep.get(f) or []) | set(it.get(f) or []))
        if it.get('note_path'):
            orphan_notes.append(it['note_path'])
    keep['highlights'] = merged
    items = [it for it in items if it['key'] not in drop_keys]
    save_inbox(items)
    return jsonify({'status': 'ok', 'item': keep, 'items': items,
                    'dropped': drop_keys, 'orphan_notes': orphan_notes})


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
