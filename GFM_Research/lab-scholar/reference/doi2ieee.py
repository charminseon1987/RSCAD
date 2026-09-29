"""DOI → IEEE 인용문 (Crossref 무료 API)
사용: python doi2ieee.py DOI [DOI ...]  |  -f dois.txt  |  --title "논문 제목"
"""
import argparse, re, sys, time
import requests

MAILTO = "your_email@example.com"
ABBR = {
    "ieee transactions on smart grid": "IEEE Trans. Smart Grid",
    "ieee transactions on power systems": "IEEE Trans. Power Syst.",
    "ieee transactions on power electronics": "IEEE Trans. Power Electron.",
    "ieee transactions on sustainable energy": "IEEE Trans. Sustain. Energy",
    "ieee transactions on energy conversion": "IEEE Trans. Energy Convers.",
    "ieee transactions on industrial electronics": "IEEE Trans. Ind. Electron.",
    "ieee transactions on industry applications": "IEEE Trans. Ind. Appl.",
    "ieee journal of emerging and selected topics in power electronics": "IEEE J. Emerg. Sel. Topics Power Electron.",
    "ieee access": "IEEE Access",
    "applied energy": "Appl. Energy",
    "energy and buildings": "Energy Build.",
    "renewable energy": "Renew. Energy",
    "solar energy": "Sol. Energy",
    "international journal of electrical power & energy systems": "Int. J. Electr. Power Energy Syst.",
    "electric power systems research": "Electr. Power Syst. Res.",
}
MON = ["Jan.", "Feb.", "Mar.", "Apr.", "May", "Jun.", "Jul.", "Aug.", "Sep.", "Oct.", "Nov.", "Dec."]
NV = "[미검증]"


def fetch(doi):
    r = requests.get(f"https://api.crossref.org/works/{doi}", params={"mailto": MAILTO}, timeout=30)
    time.sleep(0.2)
    return r.json()["message"] if r.status_code == 200 else None


def by_title(title):
    r = requests.get("https://api.crossref.org/works",
                     params={"query.bibliographic": title, "rows": 1, "mailto": MAILTO}, timeout=30)
    items = r.json()["message"]["items"] if r.status_code == 200 else []
    norm = lambda t: re.sub(r"\W", "", t.lower())[:40]
    if items and items[0].get("title") and norm(items[0]["title"][0]) == norm(title):
        return items[0]
    return None


def author(a):
    given = a.get("given", "")
    parts = []
    for word in given.split():
        parts.append("-".join(p[0] + "." for p in word.split("-") if p))
    return f"{' '.join(parts)} {a.get('family', '')}".strip()


def authors(lst):
    names = [author(a) for a in lst or []]
    if not names:
        return NV
    if len(names) >= 7:
        return names[0] + " et al."
    if len(names) == 1:
        return names[0]
    if len(names) == 2:
        return f"{names[0]} and {names[1]}"
    return ", ".join(names[:-1]) + ", and " + names[-1]


def ieee(m):
    title = (m.get("title") or [NV])[0]
    cont = (m.get("container-title") or [""])[0]
    venue = ABBR.get(cont.lower(), cont) or NV
    parts = (m.get("published-print") or m.get("published-online") or m.get("issued") or {}).get("date-parts", [[None]])[0]
    year = parts[0] or NV
    mon = MON[parts[1] - 1] + " " if len(parts) > 1 and parts[1] else ""
    vol, no = m.get("volume"), m.get("issue")
    pages = (m.get("page") or "").replace("-", "–")
    art = m.get("article-number")
    doi = m.get("DOI", "")
    if m.get("type") == "proceedings-article":
        s = f'{authors(m.get("author"))}, "{title}," in *Proc. {cont or NV}*, {year}'
        s += f", pp. {pages}" if pages else ""
    else:
        s = f'{authors(m.get("author"))}, "{title}," *{venue}*'
        s += f", vol. {vol}" if vol else f", vol. {NV}"
        s += f", no. {no}" if no else ""
        s += f", pp. {pages}" if pages else (f", Art. no. {art}" if art else f", pp. {NV}")
        s += f", {mon}{year}"
    return s + (f", doi: {doi}." if doi else ".")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("dois", nargs="*")
    ap.add_argument("-f", "--file")
    ap.add_argument("--title")
    a = ap.parse_args()
    dois = list(a.dois)
    if a.file:
        dois += [l.strip() for l in open(a.file, encoding="utf-8") if l.strip()]
    recs = [(a.title, by_title(a.title))] if a.title else []
    for d in dois:
        d = re.sub(r"^https?://(dx\.)?doi\.org/", "", d.strip())
        recs.append((d, fetch(d)))
    ok = 0
    for i, (key, m) in enumerate(recs, 1):
        if not m:
            print(f"[{i}] {NV} Crossref에서 찾을 수 없음: {key}")
            continue
        line = ieee(m)
        ok += NV not in line
        print(f"[{i}] {line}")
    print(f"\n# 검증: 총 {len(recs)}건 / 완전 검증 {ok}건 / 미검증 포함 {len(recs) - ok}건", file=sys.stderr)


if __name__ == "__main__":
    main()
