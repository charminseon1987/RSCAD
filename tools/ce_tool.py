#!/usr/bin/env python3
"""Claim-Evidence 도구: 스키마 검증 + 무결성 검사 + Obsidian 노트 변환

사용법:
  python tools/ce_tool.py validate "GFM_Research/00_Knowledge/records/*.json"
  python tools/ce_tool.py obsidian "GFM_Research/00_Knowledge/records/*.json"
  python tools/ce_tool.py gaps     "GFM_Research/00_Knowledge/records/*.json"

출력 노트는 .claude/skills/obsidian-note-template 의 규격(frontmatter 전체 키 · ▸/※)을
따른다 — 그 스킬과 이 도구가 같은 형식을 내야 Dataview 집계가 깨지지 않는다.
의존성: pip install jsonschema
"""
import argparse, json, sys, glob
from pathlib import Path
from jsonschema import Draft202012Validator

SCHEMA = json.loads((Path(__file__).parent / "claim_evidence.schema.json").read_text(encoding="utf-8"))


def load(paths):
    files = [f for p in paths for f in glob.glob(p)]
    return [(f, json.loads(Path(f).read_text(encoding="utf-8"))) for f in files]


def integrity(rec, all_ids):
    """스키마로 못 잡는 논리 오류를 검사"""
    errs, warns = [], []
    pid = rec["paper"]["id"]
    total = rec["paper"].get("pages_total")
    cids = [c["id"] for c in rec["claims"]]
    if len(cids) != len(set(cids)):
        errs.append("중복 claim id")
    cset = set(cids)

    for c in rec["claims"]:
        for ev in c["evidence"]:
            if total and ev["page"] > total:
                errs.append(f"{c['id']}: page {ev['page']} > 총 {total}p")
        for r in c.get("relations", []):
            t = r["target"]
            if "#" in t:
                if t not in all_ids:
                    warns.append(f"{c['id']}: 외부 참조 {t} 가 로드된 레코드에 없음")
            elif t not in cset:
                errs.append(f"{c['id']}: 관계 대상 {t} 없음")
        v = c["verification"]
        if v["status"] in ("human_verified", "reproduced") and not v.get("by"):
            errs.append(f"{c['id']}: {v['status']} 인데 검증자(by) 없음")
        if c["type"] == "result" and c.get("evidence_strength") in (None, "assertion"):
            warns.append(f"{c['id']}: result인데 근거가 assertion/미기재")
        if c["type"] == "result" and not c.get("quantities"):
            warns.append(f"{c['id']}: result인데 정량값 없음 (그림에서 수치화 필요?)")

    for g in rec.get("gaps", []):
        for d in g["derived_from"]:
            if d not in cset:
                errs.append(f"{g['id']}: derived_from {d} 없음")
        if g["counter_search"]["status"] == "not_searched":
            warns.append(f"{g['id']}: 반증 검색 전 — 논문에 '공백'으로 쓰지 말 것")

    for u in rec.get("usage", []):
        for cid in u["claim_ids"]:
            if cid not in cset:
                errs.append(f"usage {u['section']}: {cid} 없음")
            else:
                st = next(c for c in rec["claims"] if c["id"] == cid)["verification"]["status"]
                if st in ("unverified", "disputed"):
                    warns.append(f"usage {u['section']}: {cid} 가 {st} 상태로 인용됨")
    return errs, warns


def cmd_validate(recs):
    v = Draft202012Validator(SCHEMA)
    all_ids = {f"{r['paper']['id']}#{c['id']}" for _, r in recs for c in r.get("claims", [])}
    bad = 0
    for f, r in recs:
        schema_errs = [f"{'/'.join(map(str, e.path))}: {e.message}" for e in v.iter_errors(r)]
        errs, warns = ([], []) if schema_errs else integrity(r, all_ids)
        errs = schema_errs + errs
        print(f"\n■ {f}  →  {'FAIL' if errs else 'OK'}  (claims {len(r.get('claims', []))}, gaps {len(r.get('gaps', []))})")
        for e in errs:
            print("  ✗", e)
        for w in warns:
            print("  △", w)
        bad += bool(errs)
    sys.exit(1 if bad else 0)


# ── Obsidian 볼트 규격 ──
# 노트 형식의 권위는 이 함수 하나다. 예전에는 .claude/agents/CLAUDE.md 에 또 다른
# 템플릿이 적혀 있어 둘이 어긋났다.
#
# frontmatter 키 목록·순서는 .claude/skills/obsidian-note-template/SKILL.md 를 따른다.
# 값이 없어도 키는 남긴다 — Dataview 는 키 부재와 빈 값을 다르게 집계한다.
#
# 본문 마커는 ▸(논문이 말한 것) / ※(내 판단)다. 이모지를 쓰지 않는다 —
# Google Docs 로 옮기는 경로에서 💡 가 'ð¡' 로 깨지는 것을 확인했다.
FM_KEYS = [
    'type', 'cite_key', 'ref_num', 'title', 'authors', 'corresponding',
    'year', 'venue', 'doi', 'pdf', 'pdf_status',
    'paper_type', 'target_system', 'control_scheme', 'model_order',
    'analysis_method', 'tuning_method', 'scr_range', 'xr_range',
    'validation_level', 'hardware', 'extraction_depth',
    # 스킬 목록에는 없지만 이 볼트의 Dataview 질의가 쓰는 필드
    'dc_ac_coupling', 'pso_params',
    'section', 'tags', 'status',
]

_QUOTE_TRIGGERS = ':#"'


def _yaml(v):
    """Dataview 가 읽을 수 있는 최소 YAML. 빈 값도 타입을 지킨다."""
    if v is None or v == '':
        return '""'
    if isinstance(v, bool):
        return 'true' if v else 'false'
    if isinstance(v, (int, float)):
        return str(v)
    if isinstance(v, (list, tuple)):
        return '[' + ', '.join(str(x) for x in v) + ']'
    sv = str(v)
    if any(ch in sv for ch in _QUOTE_TRIGGERS) or '\n' in sv or sv.strip() != sv:
        return '"' + sv.replace('"', "'") + '"'
    return sv


def _frontmatter(r):
    """레코드에서 볼트 frontmatter 를 만든다. 스키마에 없는 키는 빈 값으로 남긴다."""
    p = r['paper']
    ctx = r.get('context') or {}
    usage = r.get('usage') or []
    section = usage[0]['section'] if usage else ''
    # 사람이 검증한 주장이 있으면 noted, 인용까지 갔으면 cited
    vs = {c['verification']['status'] for c in r.get('claims', [])}
    status = 'cited' if usage else ('noted' if vs & {'human_verified', 'reproduced'} else 'read')
    fm = {
        'type': 'literature',
        'cite_key': p['id'],
        'ref_num': p.get('ref_num'),
        'title': p.get('title', ''),
        'authors': p.get('authors', []),
        'corresponding': p.get('corresponding', ''),
        'year': p.get('year'),
        'venue': p.get('venue', ''),
        'doi': p.get('doi', ''),
        'pdf': '[[' + p['id'] + '.pdf]]' if p.get('pdf') else '',
        'pdf_status': p.get('pdf_status', 'none'),
        'paper_type': ctx.get('paper_type', ''),
        'target_system': ctx.get('target_system', ''),
        'control_scheme': ctx.get('control_scheme', []),
        'model_order': ctx.get('model_order', '미명시'),
        'analysis_method': ctx.get('analysis_method', ['미명시']),
        'tuning_method': ctx.get('tuning_method', ''),
        'scr_range': ctx.get('scr_range', '미명시'),
        'xr_range': ctx.get('xr_range', '미명시'),
        'validation_level': ctx.get('validation_level', ''),
        'hardware': ctx.get('hardware', []),
        'extraction_depth': ctx.get('extraction_depth', ''),
        'dc_ac_coupling': ctx.get('dc_ac_coupling', '미명시'),
        'pso_params': ctx.get('pso_params'),
        'section': section,
        'tags': ['literature'] + list(p.get('keywords', [])),
        'status': status,
    }
    return ['---'] + [k + ': ' + _yaml(fm.get(k)) for k in FM_KEYS] + ['---']


NOT_SEARCHED_WARN = "  ※ 반증 검색 전 — 논문에 '공백'으로 쓰지 말 것"


def to_md(r):
    p = r['paper']
    L = _frontmatter(r) + ['# ' + p['title'], '']

    if r.get('context', {}).get('parameters'):
        L += ['## 조건·파라미터', '| 항목 | 기호 | 값 | 단위 |', '|---|---|---|---|']
        for q in r['context']['parameters']:
            L.append('| %s | %s | %s | %s |' % (q['name'], q.get('symbol', ''),
                                                q['value'], q.get('unit', '')))
        L.append('')

    L.append('## Claims')
    for c in r['claims']:
        ev = '; '.join('p.%s %s' % (e['page'], e['locator']) for e in c['evidence'])
        L.append('### %s `%s` — %s' % (c['id'], c['type'], c['verification']['status']))
        L.append('▸ ' + c['statement'])
        if c.get('quantities'):
            L.append('▸ 수치: ' + ', '.join(
                '%s=%s%s' % (q['name'], q['value'], q.get('unit', '')) for q in c['quantities']))
        if c.get('conditions'):
            L.append('▸ 조건: ' + ', '.join('%s=%s' % kv for kv in c['conditions'].items()))
        L.append('▸ 근거: %s (%s)' % (ev, c.get('evidence_strength', '?')))
        for rel in c.get('relations', []):
            tgt = rel['target']
            if '#' in tgt:
                a, b = tgt.split('#', 1)
                link = '[[%s#%s]]' % (a, b)
            else:
                link = '[[#%s]]' % tgt
            L.append('▸ %s → %s' % (rel['type'], link))
        if c.get('my_relevance'):
            L.append('※ ' + c['my_relevance'])
        L.append('')

    if r.get('gaps'):
        L.append('## Gaps')
        for g in r['gaps']:
            st = g['counter_search']['status']
            L.append('- **%s** [%s/%s] %s ← %s · 반증검색: `%s`' % (
                g['id'], g.get('priority', ''), g.get('target', ''), g['description'],
                ', '.join(g['derived_from']), st))
            if st == 'not_searched':
                L.append(NOT_SEARCHED_WARN)
        L.append('')

    if r.get('usage'):
        L.append('## 내 논문 인용')
        for u in r['usage']:
            L.append('- %s / %s (%s): %s' % (u['target_doc'], u['section'], u['purpose'],
                                             u.get('sentence_draft', '')))
    return '\n'.join(L) + '\n'


def cmd_obsidian(recs, out):
    Path(out).mkdir(parents=True, exist_ok=True)
    for _, r in recs:
        fp = Path(out) / f"{r['paper']['id']}.md"
        existed = fp.exists()
        fp.write_text(to_md(r), encoding="utf-8")
        # 손으로 고친 노트를 모르고 덮는 일을 막는다 (스킬의 중복 규칙 R8 과 같은 취지)
        print(("↻ 덮어씀" if existed else "→ 새로"), fp)


def cmd_gaps(recs):
    rows = [(g.get("priority", "-"), g["counter_search"]["status"], r["paper"]["id"], g["id"], g["description"])
            for _, r in recs for g in r.get("gaps", [])]
    order = {"high": 0, "medium": 1, "low": 2, "-": 3}
    for pr, st, pid, gid, d in sorted(rows, key=lambda x: order.get(x[0], 3)):
        print(f"[{pr:6}] {st:18} {pid}#{gid}  {d}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd", choices=["validate", "obsidian", "gaps"])
    ap.add_argument("files", nargs="+")
    ap.add_argument("--out", default="GFM_Research/00_Knowledge/literature",
                    help="Obsidian 볼트의 literature 폴더 (기본값이 곧 정답 위치다)")
    a = ap.parse_args()
    recs = load(a.files)
    {"validate": lambda: cmd_validate(recs), "obsidian": lambda: cmd_obsidian(recs, a.out),
     "gaps": lambda: cmd_gaps(recs)}[a.cmd]()
