"""논문 PDF -> 번호 붙은 문단 목록(markdown).
사용: python pdf_paragraphs.py paper.pdf [-o paras.md] [--pages 1-5]
- 2단 레이아웃은 페이지를 좌/우로 나눠 읽는다(자동 감지).
- 절 제목(I. INTRODUCTION, 2.1 Model ...)을 만나면 절 번호를 바꾼다.
- 수식으로 보이는 줄은 [EQ?] 로 표시 -> 원문과 대조해 LaTeX로 옮길 것.
필요: pip install pdfplumber
"""
import argparse, re, sys
import pdfplumber

HEAD = re.compile(r"^((?:[IVX]+|\d+(?:\.\d+)*)\.?)\s+([A-Z][A-Za-z ,\-:&]{2,80})$")
EQ = re.compile(r"(=|∑|∫|≈|≤|≥|\(\d{1,3}\)\s*$)")


def columns(page):
    w = page.width
    words = page.extract_words()
    mid = [x for x in words if x["x0"] < w / 2 < x["x1"]]
    if len(words) > 50 and len(mid) < len(words) * 0.05:  # 2단
        return [page.crop((0, 0, w / 2, page.height)), page.crop((w / 2, 0, w, page.height))]
    return [page]


def lines_of(pdf, pages):
    """줄 단위로 내보내되, 줄 간격이 크거나 첫 줄 들여쓰기가 있으면 빈 줄("")로 문단 경계를 표시한다."""
    for i, page in enumerate(pdf.pages, 1):
        if pages and i not in pages:
            continue
        for col in columns(page):
            lines = col.extract_text_lines()
            gaps = sorted(b["top"] - a["top"] for a, b in zip(lines, lines[1:]) if b["top"] > a["top"])
            step = gaps[len(gaps) // 2] if gaps else 0
            lefts = sorted(round(l["x0"]) for l in lines)
            left = lefts[len(lefts) // 4] if lefts else 0   # 본문 왼쪽 기준선
            prev = None
            for ln in lines:
                gap = prev is not None and step and ln["top"] - prev > step * 1.4
                indent = 6 < ln["x0"] - left < 30               # IEEE식 첫 줄 들여쓰기
                if gap or indent:
                    yield ""
                yield ln["text"].strip()
                prev = ln["top"]
            yield ""


def paragraphs(lines):
    sec, buf, out = "0", [], []

    def flush():
        if buf:
            out.append((sec, " ".join(buf)))
            buf.clear()

    for ln in lines:
        if not ln:
            flush(); continue
        m = HEAD.match(ln)
        if m and len(ln) < 90:
            flush(); sec = m.group(1).rstrip(".")
            out.append((sec, f"## {ln}")); continue
        if EQ.search(ln) and len(ln) < 80:
            flush(); out.append((sec, f"[EQ?] {ln}")); continue
        buf.append(ln[:-1] if ln.endswith("-") else ln)
    flush()
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("pdf"); ap.add_argument("-o"); ap.add_argument("--pages")
    a = ap.parse_args()
    pages = None
    if a.pages:
        s, _, e = a.pages.partition("-"); pages = set(range(int(s), int(e or s) + 1))
    with pdfplumber.open(a.pdf) as pdf:
        paras = paragraphs(lines_of(pdf, pages))
    n, res = {}, []
    for sec, text in paras:
        if text.startswith("## "):
            res.append(f"\n{text}\n"); continue
        n[sec] = n.get(sec, 0) + 1
        res.append(f"[P{sec}-{n[sec]}] {text}\n")
    md = "\n".join(res)
    if a.o:
        open(a.o, "w", encoding="utf-8").write(md); print(f"✓ {sum(n.values())} 문단 -> {a.o}")
    else:
        sys.stdout.write(md)


if __name__ == "__main__":
    main()
