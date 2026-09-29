"""xcheck_spec.py — spec JSON(뷰어가 실제로 계산하는 식) ↔ model.py 교차검증

뷰어는 `rhs` 의 **JS 문자열**을 그대로 컴파일해 적분한다. 그래서 검증도 sympy 식이
아니라 그 JS 문자열을 다시 읽어서 해야 한다. `Math.*` 만 numpy 로 바꿔 파이썬에서
평가하면 jscode 변환 사고(Heaviside·Piecewise·sign 등)가 여기서 드러난다.

비교 대상
  A_model : op.jacobian(x0, SCR, XR)  — model.py 의 심볼릭 야코비안
  A_spec  : spec.rhs 를 x0 에서 수치미분한 것

상태 dw[rad/s] → w[pu] 치환은 대각 스케일링(닮음변환)이라 고유값은 변하지 않는다.
따라서 두 고유값 집합은 같아야 한다.

사용:
    PYTHONPATH=../Simulation python xcheck_spec.py [--spec gfm_spec_22.json] [--SCR 3.0 --XR 3.0]
"""
import argparse
import json
import math

import numpy as np


class JSMath:
    """jscode 가 내는 Math.* 만 최소로 흉내낸다."""
    cos, sin, tan = staticmethod(np.cos), staticmethod(np.sin), staticmethod(np.tan)
    exp, log, sqrt, abs = staticmethod(np.exp), staticmethod(np.log), staticmethod(np.sqrt), staticmethod(np.abs)
    atan, atan2, sign = staticmethod(np.arctan), staticmethod(np.arctan2), staticmethod(np.sign)
    PI, E = math.pi, math.e

    @staticmethod
    def pow(a, b):
        return a ** b


def make_rhs(spec):
    """spec 의 JS 식 22개 → f(x, u, p) 파이썬 함수."""
    names = [s['name'] for s in spec['states']]
    codes = [compile(e, f'<rhs[{i}]>', 'eval') for i, e in enumerate(spec['rhs'])]

    def f(x, u, p):
        env = {'Math': JSMath}
        env.update(p); env.update(u)
        env.update(dict(zip(names, np.asarray(x, float))))
        return np.array([eval(c, {'__builtins__': {}}, env) for c in codes], float)
    return f, names


def fd_jacobian(f, x, u, p, rel=1e-6):
    n = len(x)
    A = np.zeros((n, n))
    f0 = f(x, u, p)
    for j in range(n):
        h = rel * max(abs(x[j]), 1.0)
        xp = np.array(x, float); xp[j] += h
        xm = np.array(x, float); xm[j] -= h
        A[:, j] = (f(xp, u, p) - f(xm, u, p)) / (2 * h)
    return A, f0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--spec', default='gfm_spec_22.json')
    ap.add_argument('--SCR', type=float, default=None)
    ap.add_argument('--XR', type=float, default=None)
    a = ap.parse_args()

    spec = json.load(open(a.spec, encoding='utf-8'))
    u = dict(spec['inputs'])
    if a.SCR is not None:
        u['SCR'] = a.SCR
    if a.XR is not None:
        u['XR'] = a.XR
    p = spec['params']
    f, names = make_rhs(spec)
    x0 = np.array(spec['x0'], float)

    # ── ① 뷰어의 자체 검증 벡터 재현 ──
    c = spec['check']
    fc = f(c['x'], c['inputs'], p)
    dmax = float(np.max(np.abs(fc - np.array(c['f'], float))))
    print(f"[1] check 벡터 재현: max|Δf| = {dmax:.3e}  (tol {c['tol']:g}) "
          f"{'✓' if dmax <= c['tol'] else '✗'}")

    # ── ② 동작점 잔차 ──
    f0 = f(x0, u, p)
    print(f"[2] 동작점 잔차: max|f(x0)| = {float(np.max(np.abs(f0))):.3e}")

    # ── ③ 고유값 비교 ──
    import op as O
    import model as M

    x_model = x0.copy()
    iw = names.index('w')
    x_model[iw] = (x0[iw] - 1.0) * p['w0']                 # w[pu] → dw[rad/s]
    order = [{'w': 'dw', 'dl': 'delta'}.get(n, n) for n in names]
    assert order == M.STATE_NAMES, '상태 순서가 model.py 와 다릅니다'

    A_model = O.jacobian(x_model, u['SCR'], u['XR'])
    A_spec, _ = fd_jacobian(f, x0, u, p)

    lam_m = np.sort_complex(np.linalg.eigvals(A_model))
    lam_s = np.sort_complex(np.linalg.eigvals(A_spec))
    d_lam = float(np.max(np.abs(lam_m - lam_s)))
    d_sig = float(np.max(np.abs(lam_m.real - lam_s.real)))
    scale = float(np.max(np.abs(lam_m)))
    print(f"[3] 고유값 22개 — 최대 |Δλ| = {d_lam:.4e} (상대 {d_lam/scale:.2e}), "
          f"최대 |Δσ| = {d_sig:.4e}")
    print(f"    σ_max: model {lam_m.real.max():+.5f} / spec {lam_s.real.max():+.5f} [1/s]")
    worst = np.argsort(-np.abs(lam_m - lam_s))[:3]
    for i in worst:
        print(f"    λ {lam_m[i]:+.4f} vs {lam_s[i]:+.4f}")

    ok = dmax <= c['tol'] and d_lam / scale < 1e-6
    print('\n결과:', '✓ 뷰어 식 = 연구 모델' if ok else '✗ 불일치 — jscode 변환을 의심하세요')
    return 0 if ok else 1


if __name__ == '__main__':
    raise SystemExit(main())
