"""
01_chunk.py — 논문 PDF 를 검색 단위로 자른다

두 전략을 비교한다.
  section — 제목 패턴으로 절을 인식한 뒤, 긴 절은 목표 길이로 다시 나눈다.
            의미 경계를 살리면서 검색 단위 크기를 맞춘다. 나뉜 조각은
            같은 절 제목을 물려받는다.
  fixed   — 절 인식 없이 글자 수로만 자르고 겹침을 준다.

왜 하위 분할이 필요한가
    IEEE 논문의 한 절은 수천~수만 자다. 임베딩 모델(bge-m3)의 입력 한도는
    8192 토큰(영문 기준 대략 3만 자)이라 긴 절은 뒷부분이 잘린다. 잘리지
    않더라도 한 벡터에 여러 주제가 뭉개져 "어느 논문인지"까지만 알 수 있고
    "어느 대목인지"는 짚지 못한다.

어느 쪽이 나은지는 문서 종류마다 다르다. 그래서 재보는 것이다.

실행:
    python scripts/01_chunk.py --strategy section
    python scripts/01_chunk.py --strategy fixed --size 900 --overlap 150
"""

import argparse
import json
import re
from pathlib import Path

try:
    import pymupdf as fitz          # 1.24.3+ 권장 이름
except ImportError:
    import fitz                     # 구버전 호환

ROOT = Path(__file__).resolve().parent.parent

# 기본 경로. --pdf-dir / --data-dir 로 덮어쓸 수 있다.
# 논문이 이미 다른 폴더에 정리돼 있으면 그쪽을 그대로 가리키는 편이 낫다.
DEF_PDF  = ROOT / 'data' / 'pdf'
DEF_DATA = ROOT / 'data'

# IEEE 계열 논문의 절 제목. 로마숫자 또는 아라비아 숫자 + 대문자 제목.
SECTION_RE = re.compile(
    r'^\s*(?:'
    r'(?:[IVXLC]+)\s*[.．]\s*[A-Z][A-Za-z \-]{2,60}'      # I. INTRODUCTION
    r'|(?:\d{1,2})\s*[.．]\s*[A-Z][A-Za-z \-]{2,60}'       # 2. System Model
    r'|(?:ABSTRACT|REFERENCES|APPENDIX|ACKNOWLEDGMENT)'
    r')\s*$', re.M)


def read_pdf(path):
    """페이지를 이어 붙이되, 줄바꿈으로 끊긴 단어를 되살린다."""
    doc = fitz.open(path)
    pages = [p.get_text('text') for p in doc]
    doc.close()
    t = '\n'.join(pages)
    t = re.sub(r'-\n(?=[a-z])', '', t)        # 하이픈 줄바꿈 복원
    t = re.sub(r'\n{3,}', '\n\n', t)
    return t


def split_section(text):
    """절 제목 위치에서 자른다. 못 찾으면 빈 리스트를 돌려준다."""
    marks = [(m.start(), m.group().strip()) for m in SECTION_RE.finditer(text)]
    if len(marks) < 2:
        return []
    marks.append((len(text), None))
    out = []
    for (s, title), (e, _) in zip(marks, marks[1:]):
        body = text[s:e].strip()
        if len(body) > 120:                    # 제목만 있는 조각 제외
            out.append({'title': title, 'text': body})
    return out


def _hard_split(t, size):
    """문단도 문장도 없는 덩어리를 강제로 자른다. 마지막 수단."""
    return [t[i:i + size] for i in range(0, len(t), size)]


def _sentences(t):
    """문장 경계로 나눈다. 마침표 뒤 공백+대문자를 기준으로 삼되,
    et al. / Fig. / Eq. 같은 약어에서 잘리지 않도록 최소 길이를 둔다."""
    parts = re.split(r'(?<=[.!?])\s+(?=[A-Z(])', t)
    out, buf = [], ''
    for p in parts:
        buf = (buf + ' ' + p).strip()
        if len(buf) > 40:          # 너무 짧은 조각은 다음과 합친다
            out.append(buf); buf = ''
    if buf:
        if out:
            out[-1] += ' ' + buf
        else:
            out.append(buf)
    return out


def split_fixed(text, size, overlap):
    """size 근처에서 자른다.

    경계 우선순위는 문단 → 문장 → 강제다. PDF 에서 추출한 본문은 빈 줄이
    거의 없어 문단 분할만으로는 한 덩어리로 남는 경우가 많다. 그래서
    문장 단위 분할이 실질적인 주 경로다.
    """
    units = []
    for para in [p.strip() for p in text.split('\n\n') if p.strip()]:
        if len(para) <= size:
            units.append(para)
            continue
        for sent in _sentences(para):
            units.extend([sent] if len(sent) <= size else _hard_split(sent, size))

    out, buf = [], ''
    for u in units:
        if buf and len(buf) + len(u) + 1 > size:
            out.append(buf)
            buf = (buf[-overlap:] + ' ' + u).strip() if overlap else u
        else:
            buf = (buf + ' ' + u).strip()
    if buf:
        out.append(buf)
    return [{'title': None, 'text': c} for c in out]


def main():
    ap = argparse.ArgumentParser(description='PDF 청킹')
    ap.add_argument('--strategy', choices=['section', 'fixed'], required=True)
    ap.add_argument('--size', type=int, default=900, help='fixed 전략의 목표 길이')
    ap.add_argument('--overlap', type=int, default=150)
    ap.add_argument('--pdf-dir', default=None, help='논문 PDF 폴더')
    ap.add_argument('--data-dir', default=None, help='산출물 폴더 (chunks·index)')
    ap.add_argument('--recursive', action='store_true', help='하위 폴더까지 훑는다')
    ap.add_argument('--max-chunk', type=int, default=1600,
                    help='section 전략에서 이 길이를 넘는 절은 다시 나눈다')
    ap.add_argument('--min-chunk', type=int, default=200,
                    help='이보다 짧은 조각은 버린다 (제목만 남은 파편)')
    args = ap.parse_args()

    pdf_dir = Path(args.pdf_dir).expanduser() if args.pdf_dir else DEF_PDF
    data_dir = Path(args.data_dir).expanduser() if args.data_dir else DEF_DATA
    if not pdf_dir.is_absolute():
        pdf_dir = (Path.cwd() / pdf_dir).resolve()
    if not data_dir.is_absolute():
        data_dir = (Path.cwd() / data_dir).resolve()

    pdfs = sorted(pdf_dir.rglob('*.pdf') if args.recursive else pdf_dir.glob('*.pdf'))
    if not pdfs:
        raise SystemExit(f'{pdf_dir} 에 PDF 가 없습니다\n'
                         '  --pdf-dir 로 논문 폴더를 지정하세요.')

    out_dir = data_dir / 'chunks'
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / f'{args.strategy}.jsonl'
    print(f'  PDF       {pdf_dir}')
    n_doc = n_chunk = n_fallback = n_split = n_drop = 0

    with out_path.open('w', encoding='utf-8') as f:
        for p in pdfs:
            doc_id = p.stem
            text = read_pdf(p)

            if args.strategy == 'section':
                secs = split_section(text)
                if not secs:
                    # 절 인식 실패. 통째로 남기면 검색이 무의미하므로 고정 길이로 대체.
                    parts = split_fixed(text, args.size, args.overlap)
                    n_fallback += 1
                else:
                    # 절 안을 다시 나눈다. 제목은 조각마다 물려준다.
                    parts = []
                    for sec in secs:
                        if len(sec['text']) <= args.max_chunk:
                            parts.append(sec)
                            continue
                        for sub in split_fixed(sec['text'], args.size, args.overlap):
                            parts.append({'title': sec['title'], 'text': sub['text']})
                        n_split += 1
            else:
                parts = split_fixed(text, args.size, args.overlap)

            # 제목만 남은 파편은 검색에 방해가 되므로 버린다.
            kept = [c for c in parts if len(c['text']) >= args.min_chunk]
            n_drop += len(parts) - len(kept)

            for i, c in enumerate(kept):
                f.write(json.dumps({
                    'id': f'{doc_id}::{i}',
                    'doc': doc_id,
                    'title': c['title'],
                    'text': c['text'],
                    'n_char': len(c['text']),
                }, ensure_ascii=False) + '\n')
            n_doc += 1
            n_chunk += len(kept)

    lens = [json.loads(l)['n_char'] for l in out_path.read_text(encoding='utf-8').splitlines()]
    lens.sort()
    print(f'  전략      {args.strategy}')
    print(f'  문서      {n_doc}편')
    print(f'  청크      {n_chunk}개  (문서당 {n_chunk/n_doc:.1f})')
    print(f'  길이      중앙값 {lens[len(lens)//2]}자  '
          f'최소 {lens[0]}  최대 {lens[-1]}')
    over = sum(1 for x in lens if x > args.max_chunk)
    if n_split:
        print(f'  분할      긴 절을 다시 나눈 문서 {n_split}편')
    if n_drop:
        print(f'  제외      {args.min_chunk}자 미만 파편 {n_drop}개')
    if over:
        print(f'  ⚠ {args.max_chunk}자 초과 청크 {over}개 — 임베딩에서 잘릴 수 있다.')
    if n_fallback:
        print(f'  ⚠ 절 인식 실패 {n_fallback}편 — 고정 길이로 대체했다.')
        print('     스캔본이거나 2단 조판이면 흔하다. 비율이 높으면 section 전략의')
        print('     비교값이 의미를 잃으므로 SECTION_RE 를 조정할 것.')
    print(f'  💾 {out_path}')


if __name__ == '__main__':
    main()