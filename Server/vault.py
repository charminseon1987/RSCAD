"""
vault.py — GFM_Research 볼트를 읽어 트리 · 노트 · 그래프 · 검색으로 내보낸다.

핵심은 링크 해석이다. 실측(2026-09-29) 결과 고유 링크 대상 86개 중 파일명과 정확히
일치하는 것은 55개뿐이었고, 나머지 상당수가 같은 노트를 공백과 언더스코어로 다르게
쓴 것이었다. 정규화하지 않으면 그래프가 절반 끊긴다.

  [[DC-AC 커플링]]        ↔ DC-AC_커플링.md
  [[88포인트 2D 스윕 설계]] ↔ 88포인트_2D_스윕_설계.md
  [[21차_야코비안_유도가이드]] ↔ 21차 야코비안 유도가이드.md

_company/ 는 SNS·회사 시뮬레이션이라 연구 볼트가 아니다. 통째로 제외한다.

조연호 · 연세대 스마트그리드 연구실
"""

from __future__ import annotations

import re
from pathlib import Path

import yaml

# ── 제외 규칙 ──
EXCLUDE_DIRS = {'_company', '.obsidian', '.trash', 'node_modules', '.git', '05_템플릿'}
# 05_템플릿 은 노트가 아니라 틀이다. 그래프에 넣으면 허브처럼 보여 왜곡된다.

LINK_RE = re.compile(r'\[\[([^\]\[]+)\]\]')
FM_RE = re.compile(r'^---\s*\n(.*?)\n---\s*\n?', re.S)

# 링크 대상이 노트가 아니라 템플릿 자리표시자인 경우
PLACEHOLDER_HINTS = ('{{', '}}', '$')


def _is_placeholder(target: str) -> bool:
    if not target or target in ('...', '…'):
        return True
    if any(h in target for h in PLACEHOLDER_HINTS):
        return True
    if target.endswith('...') or target.endswith('…'):
        return True
    return False


def normalize(name: str) -> str:
    """공백 ↔ 언더스코어 ↔ 하이픈 표기 차이를 흡수한다. 대소문자도 무시."""
    s = name.strip().lower()
    s = s.replace('_', ' ').replace('-', ' ')
    s = re.sub(r'\s+', ' ', s)
    return s.strip()


def _link_target(raw: str) -> str:
    """[[노트|표시이름]] · [[노트#섹션]] · [[폴더/노트.md]] 에서 노트 이름만 꺼낸다.

    실측에서 나온 표기 흔들림을 여기서 흡수한다 — 끝에 붙은 \\ 나 /, .md 확장자,
    폴더 경로 접두. .pdf 는 노트가 아니라 첨부라 손대지 않는다(미해석이 맞다).
    """
    t = raw.split('|')[0].split('#')[0].strip()
    t = t.rstrip('\\/ ').strip()
    if t.lower().endswith('.md'):
        t = t[:-3]
    if '/' in t:
        t = t.split('/')[-1]
    return t.strip()


def parse_frontmatter(text: str):
    """(frontmatter dict, 본문) 반환. frontmatter 가 없거나 깨지면 ({}, 원문)."""
    m = FM_RE.match(text)
    if not m:
        return {}, text
    try:
        fm = yaml.safe_load(m.group(1))
    except Exception:                                # noqa: BLE001
        return {}, text
    if not isinstance(fm, dict):
        return {}, text
    return fm, text[m.end():]


def _title_of(fm: dict, body: str, stem: str) -> str:
    t = fm.get('title')
    if isinstance(t, str) and t.strip():
        return t.strip()
    for line in body.split('\n'):
        if line.startswith('#'):
            s = line.lstrip('#').strip()
            if s:
                return s
    return stem


class Vault:
    """볼트 한 벌. mtime 합이 바뀌면 다시 읽는다 (90개 규모라 통째로 읽어도 싸다)."""

    def __init__(self, root: Path):
        self.root = Path(root)
        self._stamp = None
        self._notes = {}      # rel_path -> dict
        self._by_norm = {}    # normalized stem -> [rel_path]

    # ── 수집 ──
    def _iter_files(self):
        for p in self.root.rglob('*.md'):
            if any(part in EXCLUDE_DIRS for part in p.relative_to(self.root).parts):
                continue
            if p.name.startswith('.'):
                continue
            yield p

    def _fingerprint(self):
        n = 0
        s = 0.0
        for p in self._iter_files():
            n += 1
            try:
                s += p.stat().st_mtime
            except OSError:
                pass
        return (n, round(s, 3))

    def refresh(self, force=False):
        fp = self._fingerprint()
        if not force and fp == self._stamp:
            return
        notes, by_norm = {}, {}

        for p in self._iter_files():
            rel = p.relative_to(self.root).as_posix()
            try:
                text = p.read_text(encoding='utf-8')
            except Exception:                        # noqa: BLE001
                continue
            fm, body = parse_frontmatter(text)
            raw_links = [_link_target(m) for m in LINK_RE.findall(text)]
            out = []
            for t in raw_links:
                if _is_placeholder(t):
                    continue
                out.append(t)

            notes[rel] = {
                'path': rel,
                'name': p.stem,
                'title': _title_of(fm, body, p.stem),
                'folder': p.parent.relative_to(self.root).as_posix() or '.',
                'mtime': p.stat().st_mtime,
                'size': len(text),
                'frontmatter': fm,
                'out_raw': out,
            }
            by_norm.setdefault(normalize(p.stem), []).append(rel)

        self._notes, self._by_norm, self._stamp = notes, by_norm, fp
        self._link()

    # ── 링크 해석 ──
    def _resolve(self, target: str):
        """정규화 후 매칭. 같은 basename 이 여럿이면 폴더 우선순위로 고른다."""
        cands = self._by_norm.get(normalize(target))
        if not cands:
            return None, False
        if len(cands) == 1:
            return cands[0], False
        # literature 를 정본으로, RSCAD/06_문헌 미러보다 앞세운다
        ranked = sorted(cands, key=lambda r: (0 if '00_Knowledge/literature' in r else 1, r))
        return ranked[0], True

    def _link(self):
        for n in self._notes.values():
            n['out'] = []
            n['backlinks'] = []
            n['ambiguous'] = False

        for rel, n in self._notes.items():
            seen = set()
            for t in n['out_raw']:
                tgt, ambiguous = self._resolve(t)
                key = (t, tgt)
                if key in seen:
                    continue
                seen.add(key)
                n['out'].append({'text': t, 'path': tgt, 'resolved': tgt is not None})
                if ambiguous:
                    n['ambiguous'] = True
                if tgt and tgt != rel:
                    self._notes[tgt]['backlinks'].append(rel)

    # ── 공개 API ──
    def tree(self):
        self.refresh()
        folders = {}
        for n in self._notes.values():
            folders.setdefault(n['folder'], []).append({
                'path': n['path'], 'name': n['name'], 'title': n['title'],
                'mtime': n['mtime'], 'backlinks': len(set(n['backlinks'])),
                'outlinks': len(n['out']),
                # 표 뷰(Dataview 유사)가 쓰는 필드. 없으면 빈 dict.
                'frontmatter': n['frontmatter'],
            })
        out = []
        for f in sorted(folders):
            items = sorted(folders[f], key=lambda x: x['name'])
            out.append({'folder': f, 'count': len(items), 'notes': items})
        return {'root': 'GFM_Research', 'total': len(self._notes),
                'excluded': sorted(EXCLUDE_DIRS), 'folders': out}

    def note(self, rel: str):
        self.refresh()
        n = self._notes.get(rel)
        if not n:
            return None
        p = self.root / rel
        text = p.read_text(encoding='utf-8')
        _, body = parse_frontmatter(text)
        return {
            'path': n['path'], 'name': n['name'], 'title': n['title'], 'folder': n['folder'],
            'mtime': n['mtime'],
            'frontmatter': n['frontmatter'],
            'body': body,
            'outlinks': n['out'],
            'backlinks': [{'path': b, 'title': self._notes[b]['title']} for b in sorted(set(n['backlinks']))],
            'ambiguous': n['ambiguous'],
        }

    def graph(self):
        self.refresh()
        nodes, edges = [], []
        dangling = {}

        for rel, n in self._notes.items():
            nodes.append({
                'id': rel, 'path': rel, 'name': n['name'], 'title': n['title'],
                'folder': n['folder'], 'backlinks': len(set(n['backlinks'])), 'exists': True,
            })

        for rel, n in self._notes.items():
            for o in n['out']:
                if o['path']:
                    if o['path'] != rel:
                        edges.append({'from': rel, 'to': o['path'], 'resolved': True})
                else:
                    key = 'missing:' + normalize(o['text'])
                    dangling.setdefault(key, o['text'])
                    edges.append({'from': rel, 'to': key, 'resolved': False})

        for key, text in dangling.items():
            nodes.append({
                'id': key, 'path': None, 'name': text, 'title': text,
                'folder': '(미작성)', 'backlinks': 0, 'exists': False,
            })

        resolved = sum(1 for e in edges if e['resolved'])
        return {
            'nodes': nodes, 'edges': edges,
            'stats': {
                'notes': len(self._notes),
                'missing': len(dangling),
                'edges': len(edges),
                'resolved': resolved,
                'unresolved': len(edges) - resolved,
            },
        }

    def search(self, q: str, limit=50):
        self.refresh()
        ql = q.strip().lower()
        if len(ql) < 2:
            return {'query': q, 'hits': [], 'note': '두 글자 이상 입력하세요'}
        hits = []
        for rel, n in self._notes.items():
            text = (self.root / rel).read_text(encoding='utf-8')
            low = text.lower()
            cnt = low.count(ql)
            in_title = ql in n['title'].lower() or ql in n['name'].lower()
            if not cnt and not in_title:
                continue
            i = low.find(ql)
            snippet = ''
            if i >= 0:
                a, b = max(0, i - 60), min(len(text), i + 120)
                snippet = text[a:b].replace('\n', ' ')
            hits.append({
                'path': rel, 'title': n['title'], 'folder': n['folder'],
                'count': cnt, 'in_title': in_title, 'snippet': snippet,
            })
        hits.sort(key=lambda h: (not h['in_title'], -h['count']))
        return {'query': q, 'total': len(hits), 'hits': hits[:limit]}
