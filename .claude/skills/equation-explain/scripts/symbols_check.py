"""LaTeX 수식에서 기호 목록을 뽑고, (선택) 양변 단위를 검증한다.
사용:
  python symbols_check.py "J \\frac{d\\omega}{dt} = P^* - P - D_p(\\omega-\\omega_0)"
  python symbols_check.py "<LaTeX>" --units "J=kg*m**2, omega=1/s, P=W, D_p=W*s, t=s"
- 기호 목록을 기호 표와 대조해 누락을 찾는 용도.
- --units: 기호별 단위를 주면 좌변·우변 각 항의 차원을 비교한다(SI 기본 단위로 환원).
필요: pip install sympy
"""
import argparse, re, sys

GREEK = r"alpha|beta|gamma|delta|epsilon|zeta|eta|theta|lambda|mu|xi|pi|rho|sigma|tau|phi|psi|omega|Delta|Omega|Theta|Phi"
SYM = re.compile(r"\\(?:" + GREEK + r")(?:_\{?[\w,]+\}?)?(?:\^\{?[*\w]+\}?)?|[A-Za-z](?:_\{?[\w,]+\}?)?(?:\^\{?[*\w]+\}?)?")
SKIP = {"frac", "left", "right", "cdot", "sqrt", "sum", "int", "d", "dt", "e", "j", "mathrm", "text", "sin", "cos", "exp", "ln"}


def symbols(latex):
    s = re.sub(r"\\(frac|left|right|cdot|sqrt|mathrm|text|sin|cos|exp|ln|sum|int)", " ", latex)
    s = re.sub(r"\bd(?=\\|[A-Za-z])", " ", s)  # 미분 d 제거
    out = []
    for m in SYM.findall(s):
        base = m.lstrip("\\").split("_")[0].split("^")[0]
        if base in SKIP or m in out:
            continue
        out.append(m)
    return out


def to_expr(latex):
    """LaTeX 한쪽 변 -> sympy 식 (차원 검증용 간이 변환)."""
    s = latex
    while "\\frac" in s:
        s = re.sub(r"\\frac\{([^{}]*)\}\{([^{}]*)\}", r"((\1)/(\2))", s)
    s = re.sub(r"\\(left|right|cdot|,|;)", " ", s)
    s = re.sub(r"(?<![A-Za-z\\])d(?=\\|[A-Za-z])", " ", s)          # 미분 d
    s = re.sub(r"\\([A-Za-z]+)", r"\1", s)                             # \omega -> omega
    s = re.sub(r"_\{?(\w+)\}?", r"_\1", s)
    s = re.sub(r"\^\{?\*\}?", "star", s)
    s = re.sub(r"\^\{?(\w+)\}?", r"**\1", s)
    s = s.replace("{", "(").replace("}", ")")
    s = re.sub(r"(\w)\s*\(", r"\1*(", s)                 # D_p(x) -> D_p*(x)
    s = re.sub(r"\)\s*(?=[\w(])", ")*", s)                # )x -> )*x
    s = re.sub(r"(?<=\w)\s+(?=\w)", "*", s.strip())        # 공백 곱
    from sympy.parsing.sympy_parser import parse_expr
    return parse_expr(s)


def units_check(latex, spec):
    import sympy as sp
    from sympy.physics import units as u
    loc = {"kg": u.kg, "m": u.m, "s": u.s, "W": u.W, "V": u.V, "A": u.A, "H": u.henry,
           "F": u.farad, "Ohm": u.ohm, "var": u.W, "rad": 1, "pu": 1}
    table = {k.strip(): sp.sympify(v.strip(), locals=loc)
             for k, v in (p.split("=") for p in spec.split(","))}

    def unit_of(sym):
        n = str(sym)
        for key in (n, n.replace("star", ""), n.split("_")[0]):
            if key in table:
                return table[key]
        raise KeyError(f"단위 미지정 기호: {n}")

    def dims(side):
        out = []
        for t in sp.Add.make_args(sp.expand(to_expr(side))):
            q = t.subs({x: unit_of(x) for x in t.free_symbols})
            q = u.convert_to(q, [u.kg, u.m, u.s, u.A])
            coeff, _ = q.as_coeff_Mul()
            out.append((str(t), sp.simplify(q / coeff)))
        return out

    lhs, rhs = latex.split("=", 1)
    terms = dims(lhs) + dims(rhs)
    ref = terms[0][1]
    ok = True
    for name, d in terms:
        same = sp.simplify(d / ref).is_number
        ok &= bool(same)
        print(f"  {'✓' if same else '✗'} {name:28s} [{d}]")
    print("→ 단위 일치" if ok else "→ 단위 불일치: per-unit 식인지, 누락된 기호(예: ω_0 곱)가 있는지 확인")
    return ok


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("latex"); ap.add_argument("--units")
    a = ap.parse_args()
    syms = symbols(a.latex)
    print("기호:", ", ".join(syms))
    if a.units:
        try:
            units_check(a.latex, a.units)
        except Exception as e:
            print(f"단위 검증 실패(파싱): {e} — 기호 목록만 사용하세요.")
            return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
