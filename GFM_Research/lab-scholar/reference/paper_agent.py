"""
논문 리서치 Agent — 100% 무료 (유료 API 키 불필요)

  [1] 서치     : OpenAlex + Semantic Scholar + arXiv  (무료 공개 API)
  [2] 스노볼링 : Cited by(후속) + References(선행) 추적  — 구글 스칼라 'Cited by'와 동일 로직
  [3] 스코어링 : 관련도 × 연평균 인용 × 저널지표 × 최신성
  [4] 스크래핑 : 오픈액세스 PDF만 다운로드 (OpenAlex / Unpaywall / arXiv) → 본문 텍스트 추출
  [5] 지식화   : Obsidian 볼트 생성
                 06_문헌/_inbox/     수집 논문 노트 (요약 + 서론/결론 발췌 + 인용관계 [[링크]])
                 06_문헌/_concepts/  개념 노트 (주제별 논문 모음 → 그래프 뷰로 연구 지형 확인)
                 00_MOC/논문수집_MOC.md 전체 지도, _agent/papers.csv · references.bib
  [6] 증분 수집: _agent/state.json 에 수집 이력 저장 → 재실행 시 신규 논문만 추가 (주간 자동화용)

요약 엔진 (--llm)
  none      : 무료, 추출 요약 (초록 + 결론 앞부분)                ← 기본값
  ollama    : 무료, 로컬 LLM (https://ollama.com 설치 후 `ollama pull qwen2.5:7b`)
  anthropic : 유료(선택), ANTHROPIC_API_KEY 필요

설치:  pip install requests pypdf
사용:
  python paper_agent.py "grid-forming inverter small-signal stability"
  python paper_agent.py "BIPV zero energy building PV sizing" --from-year 2019 --top 40 --vault ./vault
  python paper_agent.py "grid-forming inverter PSO" --llm ollama --context "PV+ESS 2단 GFM 인버터, PSO 파라미터 최적화"
"""
import argparse, csv, datetime, json, math, os, re, time, xml.etree.ElementTree as ET
from io import BytesIO
from pathlib import Path

import requests

EMAIL = os.getenv("PAPER_AGENT_EMAIL", "your_email@example.com")  # OpenAlex·Unpaywall 권장(무료) — 본인 메일로
OPENALEX, S2, ARXIV = "https://api.openalex.org", "https://api.semanticscholar.org/graph/v1", "http://export.arxiv.org/api/query"
YEAR = datetime.date.today().year
UA = {"User-Agent": f"paper-agent/1.0 (mailto:{EMAIL})"}
_src_cache = {}


# ───────────────────────── 공통 ─────────────────────────
def http_get(url, params=None, as_json=True, wait=0.3, tries=4):
    for i in range(tries):
        try:
            r = requests.get(url, params=params, headers=UA, timeout=40)
            if r.status_code == 200:
                time.sleep(wait)
                return r.json() if as_json else r
            if r.status_code in (429, 503):
                time.sleep(3 * (i + 1)); continue
            return None
        except requests.RequestException:
            time.sleep(2 * (i + 1))
    return None


def norm_title(t):
    return re.sub(r"[^a-z0-9]", "", (t or "").lower())[:120]


def slug(t, n=70):
    return re.sub(r"[^\w가-힣-]+", "_", t or "untitled")[:n].strip("_")


def empty_rec():
    return dict(title="", year=None, venue="", volume="", issue="", pages="", doi="", cited_by=0,
                authors="", abstract="", pdf_url="", landing="", topics=[], refs=[], oa_id="",
                source="", fulltext="", intro="", conclusion="", summary="", score=0.0)


# ───────────────────────── [1] 서치 ─────────────────────────
def oa_abstract(w):
    inv = w.get("abstract_inverted_index") or {}
    pos = {p: word for word, ps in inv.items() for p in ps}
    return " ".join(pos[k] for k in sorted(pos))


def from_openalex(w, source):
    r = empty_rec()
    loc, bib = w.get("primary_location") or {}, w.get("biblio") or {}
    best = w.get("best_oa_location") or {}
    r.update(
        title=w.get("display_name") or "", year=w.get("publication_year"),
        venue=(loc.get("source") or {}).get("display_name") or "",
        volume=bib.get("volume") or "", issue=bib.get("issue") or "",
        pages="-".join(p for p in [bib.get("first_page"), bib.get("last_page")] if p),
        doi=(w.get("doi") or "").replace("https://doi.org/", "").lower(),
        cited_by=w.get("cited_by_count", 0),
        authors=", ".join(a["author"]["display_name"] for a in (w.get("authorships") or [])[:6]),
        abstract=oa_abstract(w),
        pdf_url=best.get("pdf_url") or (w.get("open_access") or {}).get("oa_url") or "",
        landing=loc.get("landing_page_url") or "",
        topics=[t["display_name"] for t in (w.get("topics") or [])[:3]] +
               [k["display_name"] for k in (w.get("keywords") or [])[:4]],
        refs=[x.rsplit("/", 1)[-1] for x in (w.get("referenced_works") or [])],
        oa_id=(w.get("id") or "").rsplit("/", 1)[-1], source=source)
    r["_src_id"] = (loc.get("source") or {}).get("id")
    return r


def search_openalex(q, y, n):
    d = http_get(f"{OPENALEX}/works", {"search": q, "filter": f"from_publication_year:{y}",
                                        "sort": "relevance_score:desc", "per-page": min(n, 50), "mailto": EMAIL})
    return [from_openalex(w, "openalex") for w in (d or {}).get("results", [])]


def search_s2(q, y, n):
    d = http_get(f"{S2}/paper/search", {"query": q, "year": f"{y}-", "limit": min(n, 50),
                 "fields": "title,year,venue,externalIds,citationCount,abstract,openAccessPdf,authors,fieldsOfStudy"},
                 wait=1.2)  # 무료 키 없는 풀: 천천히
    out = []
    for p in (d or {}).get("data", []):
        r = empty_rec()
        r.update(title=p.get("title") or "", year=p.get("year"), venue=p.get("venue") or "",
                 doi=((p.get("externalIds") or {}).get("DOI") or "").lower(), cited_by=p.get("citationCount") or 0,
                 authors=", ".join(a["name"] for a in (p.get("authors") or [])[:6]), abstract=p.get("abstract") or "",
                 pdf_url=(p.get("openAccessPdf") or {}).get("url") or "", topics=p.get("fieldsOfStudy") or [],
                 source="semantic_scholar")
        out.append(r)
    return out


def search_arxiv(q, y, n):
    resp = http_get(ARXIV, {"search_query": "all:" + " AND all:".join(q.split()[:6]), "max_results": min(n, 30),
                            "sortBy": "relevance"}, as_json=False, wait=3)
    if not resp:
        return []
    ns = {"a": "http://www.w3.org/2005/Atom"}
    out = []
    for e in ET.fromstring(resp.content).findall("a:entry", ns):
        yr = int(e.findtext("a:published", "0000", ns)[:4])
        if yr < y:
            continue
        r = empty_rec()
        aid = e.findtext("a:id", "", ns)
        r.update(title=" ".join(e.findtext("a:title", "", ns).split()), year=yr, venue="arXiv (preprint)",
                 authors=", ".join(a.findtext("a:name", "", ns) for a in e.findall("a:author", ns)[:6]),
                 abstract=" ".join(e.findtext("a:summary", "", ns).split()),
                 pdf_url=aid.replace("/abs/", "/pdf/"), landing=aid, source="arxiv")
        out.append(r)
    return out


# ───────────────────────── [2] 스노볼링 ─────────────────────────
def snowball(rec, n):
    if not rec["oa_id"]:
        return []
    out = []
    d = http_get(f"{OPENALEX}/works", {"filter": f"cites:{rec['oa_id']}", "sort": "cited_by_count:desc",
                                        "per-page": n, "mailto": EMAIL})
    out += [from_openalex(w, "cited_by") for w in (d or {}).get("results", [])]
    ids = rec["refs"][:n]
    if ids:
        d = http_get(f"{OPENALEX}/works", {"filter": "openalex:" + "|".join(ids), "per-page": n, "mailto": EMAIL})
        out += [from_openalex(w, "reference") for w in (d or {}).get("results", [])]
    return out


def enrich(rec):
    """S2/arXiv 결과 → OpenAlex로 DOI·볼륨·페이지·인용관계 보강"""
    if rec["oa_id"]:
        return rec
    w = None
    if rec["doi"]:
        w = http_get(f"{OPENALEX}/works/doi:{rec['doi']}", {"mailto": EMAIL})
    if not w:
        d = http_get(f"{OPENALEX}/works", {"filter": "title.search:" + re.sub(r"[,:|!?]", " ", rec["title"])[:200],
                                           "per-page": 1, "mailto": EMAIL})
        cand = (d or {}).get("results", [])
        if cand and norm_title(cand[0].get("display_name"))[:50] == norm_title(rec["title"])[:50]:
            w = cand[0]
    if not w:
        return rec
    new = from_openalex(w, rec["source"])
    for k in ("abstract", "pdf_url", "topics"):
        new[k] = new[k] or rec[k]
    new["cited_by"] = max(new["cited_by"], rec["cited_by"])
    return new


# ───────────────────────── [3] 스코어링 ─────────────────────────
def journal_idx(rec):
    sid = rec.get("_src_id")
    if not sid:
        return 0
    if sid not in _src_cache:
        s = http_get(f"{OPENALEX}/sources/{sid.rsplit('/', 1)[-1]}", {"mailto": EMAIL}) or {}
        _src_cache[sid] = (s.get("summary_stats") or {}).get("2yr_mean_citedness") or 0
    return _src_cache[sid]


def score(rec, terms):
    text = (rec["title"] + " " + rec["abstract"]).lower()
    rel = sum(t in text for t in terms) / max(len(terms), 1)
    age = max(YEAR - (rec["year"] or YEAR) + 1, 1)
    impact = min(math.log1p(rec["cited_by"] / age) / math.log1p(100), 1)
    jour = min(math.log1p(journal_idx(rec)) / math.log1p(50), 1)
    recent = 1.0 if age <= 3 else max(0.0, 1 - (age - 3) / 10)
    return round(0.40 * rel + 0.25 * impact + 0.20 * jour + 0.15 * recent, 3)


# ───────────────────────── [4] 스크래핑 (오픈액세스만) ─────────────────────────
def unpaywall_pdf(doi):
    if not doi:
        return ""
    d = http_get(f"https://api.unpaywall.org/v2/{doi}", {"email": EMAIL}) or {}
    return ((d.get("best_oa_location") or {}).get("url_for_pdf")) or ""


def grab_fulltext(rec, pdf_dir):
    url = rec["pdf_url"] if rec["pdf_url"].lower().endswith(".pdf") or "arxiv.org/pdf" in rec["pdf_url"] else ""
    url = url or unpaywall_pdf(rec["doi"]) or rec["pdf_url"]
    if not url:
        return
    resp = http_get(url, as_json=False, wait=1)
    if not resp or b"%PDF" not in resp.content[:1024]:
        return  # HTML 랜딩/유료 페이지 → 스킵 (도서관 경유 수동 다운로드)
    try:
        from pypdf import PdfReader
        pdf_dir.mkdir(parents=True, exist_ok=True)
        path = pdf_dir / f"{rec['year']}_{slug(rec['title'], 50)}.pdf"
        path.write_bytes(resp.content)
        text = "\n".join((p.extract_text() or "") for p in PdfReader(BytesIO(resp.content)).pages[:30])
    except Exception:
        return
    rec["fulltext"] = text
    rec["pdf_local"] = path.name
    rec["intro"] = section(text, r"\n\s*(?:I\.|1\.?)?\s*INTRODUCTION", 1800)
    rec["conclusion"] = section(text, r"\n\s*(?:[IVX]+\.|\d+\.?)?\s*CONCLUSIONS?", 1800)


def section(text, pattern, n):
    m = re.search(pattern, text, re.I)
    return " ".join(text[m.end(): m.end() + n].split()) if m else ""


# ───────────────────────── [5] 지식화 ─────────────────────────
def llm(prompt, engine):
    if engine == "ollama":
        r = requests.post("http://localhost:11434/api/generate", timeout=300,
                          json={"model": os.getenv("OLLAMA_MODEL", "qwen2.5:7b"), "prompt": prompt, "stream": False})
        return r.json().get("response", "").strip()
    if engine == "anthropic":
        r = requests.post("https://api.anthropic.com/v1/messages", timeout=120,
                          headers={"x-api-key": os.environ["ANTHROPIC_API_KEY"], "anthropic-version": "2023-06-01",
                                   "content-type": "application/json"},
                          json={"model": os.getenv("ANTHROPIC_MODEL", "claude-haiku-4-5-20251001"), "max_tokens": 900,
                                "messages": [{"role": "user", "content": prompt}]})
        return "".join(b.get("text", "") for b in r.json().get("content", []))
    return ""


def summarize(rec, engine, context):
    if engine == "none":
        sents = re.split(r"(?<=[.!?])\s+", rec["abstract"])
        rec["summary"] = "**핵심(초록 발췌)**: " + " ".join(sents[:3]) if rec["abstract"] else "(초록 없음)"
        if rec["conclusion"]:
            rec["summary"] += "\n\n**결론 발췌**: " + " ".join(re.split(r"(?<=[.!?])\s+", rec["conclusion"])[:3])
        return
    body = rec["abstract"] + "\n\n[Introduction]\n" + rec["intro"] + "\n\n[Conclusion]\n" + rec["conclusion"]
    prompt = f"""다음 논문을 한국어로 요약하라. 원문에 없는 수치·주장은 만들지 말고, 불확실하면 '원문 확인 필요'로 적어라.
형식:
- 한 줄 요약:
- 문제:
- 방법:
- 결과(정량 수치 포함):
- 한계:
- 내 연구와의 연결: (내 연구: {context or '미지정'})

제목: {rec['title']} ({rec['year']}, {rec['venue']})
{body[:6000]}"""
    try:
        rec["summary"] = llm(prompt, engine) or "(요약 실패)"
    except Exception as e:
        rec["summary"] = f"(요약 실패: {e})"


def write_vault(recs, vault, query):
    pdir, cdir = vault / "06_문헌" / "_inbox", vault / "06_문헌" / "_concepts"
    pdir.mkdir(parents=True, exist_ok=True); cdir.mkdir(parents=True, exist_ok=True)
    name = {r["oa_id"]: f"{r['year']}_{slug(r['title'])}" for r in recs if r["oa_id"]}
    cited_by_me = {}
    for r in recs:
        for ref in r["refs"]:
            if ref in name and r["oa_id"] in name:
                cited_by_me.setdefault(ref, []).append(name[r["oa_id"]])
    concepts = {}
    for r in recs:
        fn = f"{r['year']}_{slug(r['title'])}"
        for t in r["topics"]:
            concepts.setdefault(t, []).append((r["score"], fn, r["title"]))
        cites = [name[x] for x in r["refs"] if x in name]
        citers = cited_by_me.get(r["oa_id"], [])
        link = f"[[{r['pdf_local']}]]" if r.get("pdf_local") else (r["pdf_url"] or "없음 — 도서관 경유 다운로드")
        md = f"""---
title: "{r['title'].replace('"', "'")}"
year: {r['year']}
venue: "{r['venue']}"
volume: "{r['volume']}"
pages: "{r['pages']}"
doi: "{r['doi'] or '미검증'}"
cited_by: {r['cited_by']}
score: {r['score']}
found_via: {r['source']}
query: "{query}"
collected: {datetime.date.today()}
tags: [paper, {'fulltext' if r['fulltext'] else 'abstract-only'}]
status: inbox
---
**Authors**: {r['authors']}
**PDF**: {link}
**개념**: {', '.join(f'[[{slug(t)}]]' for t in r['topics']) or '-'}

## 요약
{r['summary']}

## 인용 관계 (수집 내)
- 이 논문이 인용: {', '.join(f'[[{c}]]' for c in cites) or '-'}
- 이 논문을 인용: {', '.join(f'[[{c}]]' for c in citers) or '-'}

## Abstract
{r['abstract'] or '(없음)'}

## 결론 발췌
{r['conclusion'] or '(본문 미확보)'}

## 내 메모 / 인용할 문장 (페이지)
"""
        (pdir / f"{fn}.md").write_text(md, encoding="utf-8")
    for t, items in concepts.items():
        p = cdir / f"{slug(t)}.md"
        old = p.read_text(encoding="utf-8") if p.exists() else f"# {t}\n\n#concept\n\n"
        new = [f"- [[{fn}]] — {title[:80]} (score {s})" for s, fn, title in sorted(items, reverse=True) if fn not in old]
        p.write_text(old + ("\n".join(new) + "\n" if new else ""), encoding="utf-8")
    (vault / "00_MOC").mkdir(parents=True, exist_ok=True)
    idx = vault / "00_MOC" / "논문수집_MOC.md"
    rows = "\n".join(f"| {r['score']} | [[{r['year']}_{slug(r['title'])}]] | {r['year']} | {r['venue'][:30]} | {r['cited_by']} | {'✅' if r['fulltext'] else '—'} |"
                     for r in sorted(recs, key=lambda x: -x["score"]))
    head = "" if idx.exists() else "# 논문 지식 지도 (MOC)\n"
    with open(idx, "a", encoding="utf-8") as f:
        f.write(f"{head}\n## {datetime.date.today()} — \"{query}\" ({len(recs)}편)\n\n| score | 논문 | 연도 | 저널 | 인용 | 본문 |\n|---|---|---|---|---|---|\n{rows}\n")


def write_exports(recs, vault):
    new_file = not (vault / "_agent" / "papers.csv").exists()
    with open(vault / "_agent" / "papers.csv", "a", newline="", encoding="utf-8-sig") as f:
        cols = ["score", "source", "title", "year", "venue", "volume", "issue", "pages", "doi", "cited_by", "authors", "pdf_url"]
        w = csv.DictWriter(f, fieldnames=cols, extrasaction="ignore")
        if new_file:
            w.writeheader()
        w.writerows(recs)
    with open(vault / "_agent" / "references.bib", "a", encoding="utf-8") as bib:
        for r in recs:
            first = (r["authors"].split(",")[0].split() or ["anon"])[-1]
            key = f"{slug(first, 20)}{r['year']}{slug(r['title'].split()[0] if r['title'] else 'x', 12)}"
            bib.write(f"@article{{{key},\n  title={{{r['title']}}},\n  author={{{r['authors'].replace(', ', ' and ')}}},\n"
                      f"  journal={{{r['venue']}}},\n  year={{{r['year']}}},\n  volume={{{r['volume']}}},\n"
                      f"  number={{{r['issue']}}},\n  pages={{{r['pages']}}},\n  doi={{{r['doi']}}}\n}}\n\n")


# ───────────────────────── 메인 ─────────────────────────
def main():
    ap = argparse.ArgumentParser(description="무료 논문 리서치 Agent")
    ap.add_argument("query")
    ap.add_argument("--from-year", type=int, default=2018)
    ap.add_argument("--seeds", type=int, default=25)
    ap.add_argument("--snowball", type=int, default=5, help="스노볼링할 상위 시드 수 (0=끔)")
    ap.add_argument("--per-seed", type=int, default=10)
    ap.add_argument("--top", type=int, default=30)
    ap.add_argument("--no-arxiv", action="store_true")
    ap.add_argument("--no-fulltext", action="store_true", help="PDF 스크래핑 생략")
    ap.add_argument("--llm", choices=["none", "ollama", "anthropic"], default="none")
    ap.add_argument("--context", default="", help="내 연구 설명 (요약의 '연결' 항목에 사용)")
    ap.add_argument("--vault", default="./vault")
    a = ap.parse_args()

    vault = Path(a.vault); vault.mkdir(parents=True, exist_ok=True)
    meta = vault / "_agent"; meta.mkdir(exist_ok=True)
    state_p = meta / "state.json"
    seen = set(json.loads(state_p.read_text()) if state_p.exists() else [])
    terms = [t.lower() for t in re.findall(r"[\w-]+", a.query) if len(t) > 2]

    print(f"[1] 서치: {a.query}")
    pool = search_openalex(a.query, a.from_year, a.seeds)
    print(f"    OpenAlex {len(pool)}편")
    s2 = search_s2(a.query, a.from_year, a.seeds); print(f"    Semantic Scholar {len(s2)}편")
    ax = [] if a.no_arxiv else search_arxiv(a.query, a.from_year, 15); print(f"    arXiv {len(ax)}편")
    pool += [enrich(r) for r in s2 + ax]

    if a.snowball:
        for seed in sorted([r for r in pool if r["oa_id"]], key=lambda r: -r["cited_by"])[:a.snowball]:
            print(f"[2] 스노볼링: {seed['title'][:60]}")
            pool += snowball(seed, a.per_seed)

    uniq = {}
    for r in pool:
        k = r["doi"] or norm_title(r["title"])
        if k and k not in uniq:
            uniq[k] = r
    fresh = [r for k, r in uniq.items() if k not in seen]
    print(f"[3] 스코어링: 중복 제거 {len(uniq)}편 / 신규 {len(fresh)}편")
    for r in fresh:
        r["score"] = score(r, terms)
    top = sorted(fresh, key=lambda r: -r["score"])[:a.top]

    for i, r in enumerate(top, 1):
        if not a.no_fulltext:
            grab_fulltext(r, vault / "06_문헌" / "_pdf")
        summarize(r, a.llm, a.context)
        print(f"[4-5] {i:>2}/{len(top)} [{r['score']}] {'📄' if r['fulltext'] else '  '} {r['year']} {r['title'][:65]}")

    write_vault(top, vault, a.query)
    write_exports(top, vault)
    state_p.write_text(json.dumps(sorted(seen | {r['doi'] or norm_title(r['title']) for r in top})))
    ft = sum(bool(r["fulltext"]) for r in top)
    print(f"\n완료 → {vault}\n  06_문헌/_inbox {len(top)}편 (본문 확보 {ft}편) · _concepts · 00_MOC/논문수집_MOC.md · _agent/references.bib")
    print("  Obsidian에서 이 폴더를 볼트로 열고 그래프 뷰로 연구 지형을 확인하세요.")


if __name__ == "__main__":
    main()
