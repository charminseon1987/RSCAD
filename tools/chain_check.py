"""
chain_check.py — 논문 쓰기 전에 "이 인용키가 근거를 가지고 있나" 를 본다

NEXT.md §7 과 ZEB 관리대장 §7 이 적어 둔 끊긴 사슬(S1~S5)을 **측정**한다.
고치는 것은 사람이 하고, 이 도구는 어디가 끊겼는지만 정확히 말한다.

    PDF(papers/) → 색인(chroma) → 레코드(records/) → 노트(literature/)
                                        ↓
                              초안이 [@cite_key] 로 부른다

초안(`Server/drafter.py`)이 `[@key]` 를 쓰면 두 갈래로 근거를 찾는다.
  ② 노트 재료 — `literature/<key>.md` 의 ▸ 줄
  ③ 색인 대목 — `doc_aliases.json` 으로 key → 색인 문서명을 옮겨 검색

그래서 **키 하나가 쓸모 있으려면** 노트가 있거나, 색인에 닿거나, 둘 다여야
한다. 어느 쪽도 아니면 그 `[@key]` 는 초안에서 빈 각주가 된다. 이 도구가
그걸 미리 잡는다.

S4 가 왜 생겼나 — 말뭉치가 두 경로로 쌓였다. 손으로 넣은 것은 파일명이
`Author_Year_Topic` 이고, `paper_agent.py` 가 받은 것은 `cite_key()` 가 만든
소문자 압축형이다. 둘이 섞이면 초안의 `[@chen2026lcl_slgfm]` 에 색인이
`Chen_2026_LCL_Resonance_SingleLoop_GFM` 로 답한다. 별칭표가 그 사이를 잇고,
이 도구는 **빠진 별칭을 제안**한다. 제안만 한다 — 잘못 이으면 **다른 논문을
인용하게 되므로** `--write` 를 줘야 적는다.

실행:
    python tools/chain_check.py                     # 표 + 요약
    python tools/chain_check.py --no-index          # 색인 안 열기 (빠르다)
    python tools/chain_check.py --suggest           # 빠진 별칭 후보까지
    python tools/chain_check.py --suggest --write   # 후보를 실제로 적는다

종료코드: 끊긴 키가 없으면 0, 있으면 1.

조연호 · 연세대 스마트그리드 연구실
"""

from __future__ import annotations

import argparse
import difflib
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
KN = ROOT / 'GFM_Research' / '00_Knowledge'
PAPERS, RECORDS, NOTES = KN / 'papers', KN / 'records', KN / 'literature'
ALIASES = KN / 'doc_aliases.json'


def norm(s: str) -> str:
    """비교용 정규화. 대소문자·구분자를 지운다."""
    return re.sub(r'[^a-z0-9]', '', s.lower())


def load_aliases():
    try:
        d = json.loads(ALIASES.read_text(encoding='utf-8'))
        return {k: v['doc'] for k, v in (d.get('aliases') or {}).items()
                if isinstance(v, dict) and v.get('doc')}
    except (OSError, ValueError, TypeError, AttributeError):
        return {}


def index_docs():
    """색인 문서명. 임베딩 모델은 올리지 않는다 (drafter 와 같은 방식).

    실패하면 (None, 사유). 빈 집합과 구분해야 한다 — 색인을 못 연 것과
    색인이 비어 있는 것은 다르다.
    """
    try:
        sys.path.insert(0, str(ROOT / 'Server'))
        import ask
        st = ask._index()
        if st['error'] or st['col'] is None:
            return None, (st['error'] or '색인 핸들 없음')
        return {d['doc'] for d in ask._docs_in_index(st['col'])}, ''
    except Exception as e:                                   # noqa: BLE001
        return None, f'{type(e).__name__}: {e}'


def collect(use_index=True):
    notes = {p.stem for p in NOTES.glob('*.md')} if NOTES.is_dir() else set()
    recs = {p.stem for p in RECORDS.glob('*.json')} if RECORDS.is_dir() else set()
    pdfs = {p.stem for p in PAPERS.glob('*.pdf')} if PAPERS.is_dir() else set()
    alias = load_aliases()
    docs, err = (index_docs() if use_index else (None, '건너뜀(--no-index)'))
    return notes, recs, pdfs, alias, docs, err


def resolve(key, alias, docs):
    """키가 색인에 닿는가. (문서명 or None, 경로설명)."""
    if docs is None:
        return None, '색인 미확인'
    if key in alias:
        d = alias[key]
        return (d, '별칭') if d in docs else (None, f'별칭이 색인에 없다 → {d}')
    if key in docs:
        return key, '이름 일치'
    for d in docs:                     # 구분자만 다른 짝 — 별칭으로 적어 두면 된다
        if norm(d) == norm(key):
            return d, '정규화 일치(별칭 권장)'
    return None, '색인에 없다'


def suggest(key, docs, alias, cutoff=0.72):
    """빠진 별칭 후보. 사람이 판단하라고 **비슷한 정도**를 함께 준다."""
    if not docs:
        return []
    taken = set(alias.values())
    cand = [d for d in docs if d not in taken]
    out = []
    for d in cand:
        r = difflib.SequenceMatcher(None, norm(key), norm(d)).ratio()
        if r >= cutoff:
            out.append((d, r))
    return sorted(out, key=lambda x: -x[1])[:3]


def main():
    ap = argparse.ArgumentParser(description='문헌 사슬 진단 (S1~S5)')
    ap.add_argument('--no-index', action='store_true', help='색인을 열지 않는다')
    ap.add_argument('--suggest', action='store_true', help='빠진 별칭 후보를 낸다')
    ap.add_argument('--write', action='store_true',
                    help='후보를 doc_aliases.json 에 적는다 (--suggest 필요)')
    ap.add_argument('--cutoff', type=float, default=0.72, help='후보 유사도 문턱')
    a = ap.parse_args()

    notes, recs, pdfs, alias, docs, err = collect(not a.no_index)

    print(f'  PDF {len(pdfs)} · 색인 '
          f'{len(docs) if docs is not None else "?"} · 레코드 {len(recs)} · '
          f'노트 {len(notes)} · 별칭 {len(alias)}')
    if docs is None:
        print(f'  ⚠ 색인을 못 봤다 — {err}. 아래 "색인" 칸은 판정 불가다.')
    print()

    keys = sorted(notes | recs, key=str.lower)
    if not keys:
        print('  노트도 레코드도 없다. 말뭉치부터 쌓아야 한다.')
        return 1

    print(f"  {'인용키':<32}{'노트':>5}{'레코드':>7}{'PDF':>5}{'색인':>6}  경로")
    print('  ' + '-' * 78)
    broken, no_backing = [], []
    for k in keys:
        doc, how = resolve(k, alias, docs)
        has_pdf = any(norm(p) == norm(k) for p in pdfs) or \
            (doc is not None and any(norm(p) == norm(doc) for p in pdfs))
        o = lambda b: '○' if b else '·'             # noqa: E731
        print(f"  {k:<32}{o(k in notes):>5}{o(k in recs):>7}"
              f"{o(has_pdf):>5}{o(doc is not None):>6}  {how}")
        if docs is not None and doc is None:
            broken.append(k)
            if k not in notes:
                no_backing.append(k)

    print()
    if docs is None:
        print('  색인을 못 열어 판정을 보류한다.')
        return 1

    print(f'  색인에 닿지 않는 키 {len(broken)}개'
          + (f' — {", ".join(broken)}' if broken else ''))
    if no_backing:
        print(f'  ⚠ 노트도 색인도 없는 키 {len(no_backing)}개 — '
              f'{", ".join(no_backing)}')
        print('    이 키로 [@인용] 하면 초안에서 빈 각주가 된다.')
    else:
        print('  노트 없이 색인에도 안 닿는 키는 없다 —'
              ' 모든 키가 최소한 ▸ 재료는 가진다.')

    orphan = sorted(d for d in docs
                    if d not in alias.values()
                    and not any(norm(d) == norm(k) for k in keys))
    if orphan:
        print(f'\n  색인에만 있고 노트·레코드가 없는 문서 {len(orphan)}개 —'
              ' 검색은 되지만 구조화된 근거가 없다:')
        for d in orphan:
            print(f'    {d}')

    if a.suggest and broken:
        print('\n  ── 빠진 별칭 후보 (사람이 판단한다) ──')
        picked = {}
        for k in broken:
            cands = suggest(k, docs, alias, a.cutoff)
            if not cands:
                print(f'  {k:<32} 후보 없음')
                continue
            for i, (d, r) in enumerate(cands):
                print(f"  {k if i == 0 else '':<32} {r:.2f}  {d}")
            if cands[0][1] >= 0.85:
                picked[k] = cands[0][0]
        if picked:
            print(f'\n  유사도 0.85 이상 {len(picked)}건: '
                  + ', '.join(f'{k}→{v}' for k, v in picked.items()))
            if a.write:
                d = {}
                if ALIASES.is_file():
                    d = json.loads(ALIASES.read_text(encoding='utf-8'))
                d.setdefault('aliases', {})
                for k, v in picked.items():
                    d['aliases'][k] = {'doc': v, 'by': 'chain_check --write',
                                       'confidence': 'auto(>=0.85)'}
                ALIASES.write_text(
                    json.dumps(d, ensure_ascii=False, indent=2) + '\n',
                    encoding='utf-8')
                print(f'  적었다: {ALIASES.relative_to(ROOT)}')
                print('  ⚠ 자동 매칭이다. 인용 전에 사람이 한 번 봐야 한다 —'
                      ' 잘못 이으면 다른 논문을 인용하게 된다.')
            else:
                print('  --write 를 주면 적는다. 주지 않으면 아무것도 바꾸지 않는다.')

    return 1 if broken else 0


if __name__ == '__main__':
    sys.exit(main())
