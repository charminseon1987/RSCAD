#!/usr/bin/env python3
"""eval.jsonl 의 gold 후보를 말뭉치 본문에서 뽑는다.

왜 검색 결과로 뽑지 않나 — 현재 임베딩 모델이 올린 문서를 gold 로 삼으면 그 자가
항상 만점을 낸다. 모델을 바꿔 비교하려는 목적 자체가 무너진다. 그래서 본문 용어
출현으로 모델과 **독립하게** 후보를 만든다.

한계 — 용어 빈도는 긴 문서를 편든다. Salem_2025_GFM_Review 는 207청크짜리 리뷰라
거의 모든 질의에 걸린다. '그 주제를 다룬 문서' 와 '길어서 언급한 문서' 는 사람이
갈라야 한다. 이 스크립트는 후보와 근거를 보여줄 뿐 gold 를 정하지 않는다.

gold 는 청크 id 가 아니라 **문서 이름**이다 — Scripts/03_eval.py 의 dedup_docs() 가
청크를 문서 단위로 접는다.

사용:
  python Scripts/gold_candidates.py
  python Scripts/gold_candidates.py --top 6 --snippet 200
"""
from __future__ import annotations

import console_utf8  # noqa: F401 — stdout/stderr 을 UTF-8 로
import argparse
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent
RAG = ROOT / 'GFM_Research' / '00_Knowledge' / 'rag'

#  한국어 질의 → 본문에서 찾을 영어 용어.
#  이 매핑이 도메인 판단이고, 검토 대상이다. 질의를 바꾸면 여기도 바꾼다.
TERMS = {
    '그리드포밍': [r'state[- ]space', r'small[- ]signal', r'dc[- ]link', r'DC side', r'eigenvalue'],
    '약계통': [r'synchroni[sz]ation stability', r'weak grid', r'virtual synchronous', r'\bVSM\b',
             r'transient stability'],
    '단락비': [r'short[- ]circuit ratio', r'\bSCR\b', r'X/R', r'stability (boundary|limit|margin)'],
    '입자군집': [r'particle swarm', r'\bPSO\b', r'\bswarm\b', r'metaheuristic',
              r'genetic algorithm', r'evolutionary'],
    'LCL': [r'\bLCL\b', r'resonan', r'current (control|loop|controller)', r'active damping'],
    'PV 부스트': [r'boost converter', r'\bESS\b', r'energy storage', r'two[- ]stage', r'shared dc'],
    '참여계수': [r'participation factor', r'dominant mode', r'mode shape', r'eigenvector'],
    'CHIL': [r'hardware[- ]in[- ]the[- ]loop', r'\bHIL\b', r'\bCHIL\b', r'\bPHIL\b',
             r'real[- ]time simulat', r'\bRTDS\b', r'OPAL[- ]?RT', r'Typhoon', r'dSPACE'],
    '전력각': [r'power angle', r'synchroni[sz]ing (coefficient|torque|power)', r'\bload angle\b'],
    '가상 관성': [r'virtual inertia', r'damping (coefficient|factor|gain)', r'transient response',
               r'inertia (constant|emulation)'],
}


def key_for(q: str) -> str | None:
    for k in TERMS:
        if k in q:
            return k
    return None


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--strategy', default='section')
    ap.add_argument('--top', type=int, default=4)
    ap.add_argument('--snippet', type=int, default=110)
    ap.add_argument('--json', help='후보를 이 경로에 JSON 으로 쓴다')
    a = ap.parse_args()

    chunks = [json.loads(l) for l in
              (RAG / 'chunks' / f'{a.strategy}.jsonl').read_text(encoding='utf-8').splitlines()
              if l.strip()]
    qs = [json.loads(l) for l in
          (RAG / 'eval.jsonl').read_text(encoding='utf-8').splitlines() if l.strip()]
    docs = sorted({c['doc'] for c in chunks})
    print(f'문서 {len(docs)}개 · 청크 {len(chunks)}개 · 질의 {len(qs)}건\n')

    out = []
    for q in qs:
        text = q['q']
        k = key_for(text)
        pats = TERMS.get(k or '', [])
        print(f'◆ {text}')
        if not pats:
            print('   (용어 매핑 없음 — TERMS 에 추가할 것)\n')
            out.append({'q': text, 'candidates': [], 'note': 'no term mapping'})
            continue

        hit: dict = {}
        best: dict = {}
        for c in chunks:
            n = sum(len(re.findall(p, c['text'], re.I)) for p in pats)
            if not n:
                continue
            hit[c['doc']] = hit.get(c['doc'], 0) + n
            if n > best.get(c['doc'], (0, None))[0]:
                best[c['doc']] = (n, c)

        if not hit:
            print('   → 말뭉치에 해당 용어가 없다. 이 질의는 gold 를 만들 수 없다.\n')
            out.append({'q': text, 'candidates': [], 'note': 'NOT COVERED BY CORPUS'})
            continue

        rank = sorted(((v, d) for d, v in hit.items()), reverse=True)
        for v, d in rank[:a.top]:
            c = best[d][1]
            snip = re.sub(r'\s+', ' ', c['text'])[:a.snippet]
            print(f'   {v:4}회  {d:32} p.{c.get("page")}  {snip}')
        print()
        out.append({'q': text, 'candidates': [{'doc': d, 'hits': v} for v, d in rank]})

    missing = [o['q'] for o in out if o.get('note') == 'NOT COVERED BY CORPUS']
    if missing:
        print('─' * 70)
        print('말뭉치가 다루지 않는 질의 — 문헌을 더 넣기 전에는 gold 를 만들 수 없다:')
        for m in missing:
            print(f'  · {m}')

    if a.json:
        pathlib.Path(a.json).write_text(
            json.dumps(out, ensure_ascii=False, indent=2), encoding='utf-8')
        print(f'\n→ {a.json}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
