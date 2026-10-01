#!/usr/bin/env python3
"""서지 검증 — DOI 해석 + 철회 탐지. 표준 라이브러리만 쓴다.

출처: aipoch/open-science v0.34.1, resources/skills/literature-review/kernel.py
      https://github.com/aipoch/open-science  ·  doi:10.5281/zenodo.22252246
라이선스: Apache-2.0 (tools/NOTICE 참조)

이 저장소에 맞춘 변경 — 중복을 들이지 않으려고 원본에서 덜어낸 것:
  - OpenAlex 경로(search_openalex / expand_citations) 제외.
    tools/paper_agent.py 와 citation-management 스킬이 이미 한다.
  - crossref_lookup(자유텍스트→DOI) 제외. Server/scholar.py api_cite 와
    lab-scholar/reference/doi2ieee.py 가 이미 한다.
  - style_pass(영문 산문 린트) 제외. 한국어 초안 파이프라인에 안 맞는다.

남긴 것은 이 저장소에 **없던 것**뿐이다:
  verify_dois   철회 탐지 + ok 3상태(True/False/None)
  litrev_head   리다이렉트를 따라가지 않는 doi.org 조회 (전 등록기관 커버)
  extract_dois  본문에서 DOI 수집

왜 3상태인가: CLAUDE.md 는 "확인 못 했으면 비우지 말고 '미검증' 으로 둔다" 다.
해석되지 않는 DOI(False)와 확인할 수 없는 DOI(None)는 서로 다른 사실이고, 둘을 합치면
네트워크 장애가 날조 판정이 되거나 그 반대가 된다.

requests 를 쓰지 않는 것은 의도다 — Server/ 밖(ce_tool.py, 에이전트)에서도 설치 없이 쓴다.
"""
import json
import os
import re
import time
import urllib.error
import urllib.parse
import urllib.request

UA_BASE = "RSCAD-bib-verify/1.0"
DOI_PATTERN = r"10\.\d{4,9}/[^\s\"'`\]\}—–&|]+"


def contact():
    """Crossref polite pool 용 연락 이메일. 없으면 None (조회는 그대로 된다).

    HOST_USER_EMAIL -> CONTACT_EMAIL -> git config user.email 순.
    HOST_USER_EMAIL='' 는 git 폴백까지 끄겠다는 명시적 의사표시로 본다.
    """
    e = os.environ.get("HOST_USER_EMAIL")
    if e is not None:
        e = e.strip()
        return e or None
    e = os.environ.get("CONTACT_EMAIL")
    if e and e.strip():
        return e.strip()
    try:
        import subprocess
        out = subprocess.run(["git", "config", "user.email"],
                             capture_output=True, text=True, timeout=5)
        e = (out.stdout or "").strip()
        return e or None
    except Exception:
        return None


def _ua():
    c = contact()
    ua = UA_BASE + (" (mailto:%s)" % c if c else "")
    return ua.encode("ascii", "ignore").decode("ascii")


def get_json(url, timeout=15):
    """GET + JSON 디코드. 429 는 2초 후 한 번 재시도. 어떤 오류든 None."""
    for attempt in (0, 1):
        req = urllib.request.Request(url, headers={"User-Agent": _ua()})
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return json.loads(r.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            if e.code == 429 and attempt == 0:
                time.sleep(2)
                continue
            return None
        except Exception:
            return None
    return None


def litrev_head(url, timeout=10):
    """리다이렉트를 **따라가지 않고** HEAD. 원 서버 자신의 상태코드를 돌려준다.

    이게 핵심이다. doi.org 로 HEAD 를 보내고 리다이렉트를 따라가면 publisher 가
    403/405(봇 차단)를 주는 일이 흔해서 멀쩡한 DOI 가 해석 불가로 보인다 —
    validate_citations.py:204-207 주석이 doi.org 를 피한 바로 그 이유다.
    따라가지 않으면 doi.org 는 등록된 DOI 에 302, 미등록 DOI 에 404 를 준다.
    Crossref/DataCite/mEDRA/arXiv 를 가리지 않는 권위 있는 판정이다.

    None 은 상태코드를 아예 못 얻은 경우(연결 실패·타임아웃)뿐이다.
    """
    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, req, fp, code, msg, headers, newurl):
            return None

    opener = urllib.request.build_opener(NoRedirect)
    for attempt in (0, 1):
        req = urllib.request.Request(url, headers={"User-Agent": _ua()}, method="HEAD")
        try:
            with opener.open(req, timeout=timeout) as r:
                return r.status
        except urllib.error.HTTPError as e:
            if e.code == 429 and attempt == 0:
                time.sleep(2)
                continue
            return e.code
        except Exception:
            return None
    return None


def quote_doi_path(doi):
    """DOI 경로 인코딩. 세그먼트별로 먼저 unquote 해서 이미 %28 인 것이
    이중 인코딩되지 않게 한다 (호출자가 어느 형태로 넘겨도 되도록)."""
    return "/".join(
        urllib.parse.quote(urllib.parse.unquote(seg), safe="")
        for seg in doi.split("/")
    )


def crossref_year(m):
    dp = (m.get("published") or {}).get("date-parts") or [[None]]
    return (dp[0] or [None])[0]


def short_authors(names):
    """노트용 저자 축약: 앞 3명을 세미콜론으로, 더 있으면 et al.

    이름은 반드시 조회된 레코드에서 온다. DOI 만 들고 있는 메모에서 나중에
    (저자 연도)를 채우면 기억이 '그럴듯한' 이름을 공급한다 — 논문의 이름이 아니다.
    """
    kept = [n.strip() for n in names if n and n.strip()]
    if not kept:
        return None
    more = len(names) > 3 or len(kept) < len(names)
    return "; ".join(kept[:3]) + (" et al." if more else "")


def crossref_authors(m):
    return short_authors(
        [a.get("family") or a.get("name") or "" for a in (m.get("author") or [])]
    )


def crossref_retracted(m):
    """Crossref message 에서 철회 표지를 읽는다.

    updated-by 는 이 논문을 갱신한 고지들을, update-to 는 고지가 갱신한 논문들을
    가리킨다. 양방향을 다 보는 이유는 철회 '고지' 레코드도 걸러야 하기 때문이다.
    True 는 철회 관련 메타데이터가 있다는 뜻이고, 방향을 확인해야 '철회된 논문'과
    '철회 고지'를 구별할 수 있다.

    correction / expression_of_concern 은 철회가 아니므로 False 다.
    """
    title = (m.get("title") or [""])[0]
    upd = [u.get("type", "")
           for field in ("updated-by", "update-to")
           for u in (m.get(field) or [])]
    return (any("retract" in t.lower() for t in upd)
            or str(m.get("subtype") or "").lower() == "retraction"
            or title.upper().startswith("RETRACTED"))


def verify_dois(dois, crossref_pause=0.06):
    """DOI 를 Crossref 로 조회하고, 실패 시 doi.org 로 해석 여부를 확정한다.

    반환: {doi: {ok, title?, authors?, year?, journal?, retracted, registry?, error?}}

      ok=True   해석된다 (Crossref 적중, 또는 doi.org 2xx/3xx)
      ok=False  해석되지 않는다 (doi.org 404 — 날조이거나 오타)
      ok=None   확인할 수 없었다 (네트워크·5xx). 날조로 단정하지 말 것

      retracted=True   철회 관련 메타데이터가 있다
      retracted=False  Crossref 적중했고 확인한 표지가 없었다
                       — '한 번도 철회되지 않았다'는 증명이 아니다
      retracted=None   확인하지 못했다 (비-Crossref 등록기관이거나 조회 실패)
    """
    out = {}
    for raw in dois:
        d = raw.strip()
        # 어느 등록기관도 DOI 접미에 빈/'.'/'..' 세그먼트를 쓰지 않는다. 먼저 걸러서
        # 경로를 정규화하는 서버·CDN 때문에 날조 식별자가 해석되는 것처럼 보이는 일을
        # 막는다. 전체를 unquote 한 뒤 쪼개야 %2E%2E 와 a%2F..%2Fb 가 둘 다 드러난다.
        segs = urllib.parse.unquote(d).split("/")
        if any(seg in ("", ".", "..") for seg in segs[1:]):
            out[d] = {"ok": False, "retracted": None, "error": "DOI 접미에 점 세그먼트"}
            continue

        enc = quote_doi_path(d)
        j = get_json("https://api.crossref.org/works/%s" % enc)
        if crossref_pause:
            time.sleep(crossref_pause)

        if j and "message" in j:
            m = j["message"]
            out[d] = {
                "ok": True,
                "title": (m.get("title") or [""])[0],
                "authors": crossref_authors(m),
                "year": crossref_year(m),
                "journal": (m.get("container-title") or [""])[0],
                "retracted": crossref_retracted(m),
                "registry": "crossref",
            }
            continue

        # Crossref 미적중이거나 일시 오류. doi.org 는 모든 등록기관을 아는
        # 권위 있는 해석기이므로 ok 는 그쪽 판정을 따른다.
        code = litrev_head("https://doi.org/%s" % enc)
        if code is not None and 200 <= code < 400:
            out[d] = {"ok": True, "registry": "non-crossref", "retracted": None}
        elif code == 404:
            out[d] = {"ok": False, "retracted": None}
        else:
            out[d] = {"ok": None, "retracted": None, "error": "확인 불가 (네트워크)"}
    return out


def html_decode(s):
    """DOI 추출용 최소 엔티티 디코드."""
    for a, b in (("&lt;", "<"), ("&gt;", ">"), ("&amp;", "&"),
                 ("&nbsp;", " "), ("&#x2F;", "/"), ("&#47;", "/")):
        s = s.replace(a, b)
    return s


def extract_dois(text):
    """본문에서 DOI 처럼 생긴 문자열을 모두 뽑는다 (verify_dois 에 먹이려고).

    HTML 디코드, SICI 괄호 균형, '</' 절단, 마크다운 강조·구두점 제거.
    """
    decoded = html_decode(text)
    out = set()
    for m in re.findall(DOI_PATTERN, decoded):
        d = m.split("</")[0]
        if d.count("<") != d.count(">"):
            d = d.split("<")[0]
        d = d.rstrip("*_]>`,;:")
        if d.endswith("."):
            d = d[:-1]
        while d.endswith(")") and d.count("(") < d.count(")"):
            d = d[:-1]
        if len(d) > 8:
            out.add(d)
    return sorted(out)


# ok(3상태) -> 레코드 스키마의 paper.bib_verification.status
_STATUS = {True: "resolved", False: "unresolved", None: "uncheckable"}


def to_bib_verification(result, date=None):
    """verify_dois 의 한 항목을 claim_evidence 스키마의 paper.bib_verification 으로."""
    from datetime import date as _date
    out = {
        "status": _STATUS[result.get("ok")],
        "retracted": result.get("retracted"),
        "registry": result.get("registry"),
        "checked_date": date or _date.today().isoformat(),
    }
    if result.get("error"):
        out["notes"] = result["error"]
    return out


if __name__ == "__main__":
    import sys
    args = sys.argv[1:]
    if not args:
        print("사용법: python tools/bib_verify.py <DOI> [DOI ...]")
        sys.exit(2)
    print(json.dumps(verify_dois(args), ensure_ascii=False, indent=1))
