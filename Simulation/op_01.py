"""
op.py - 동작점 계산 + 수치 야코비안 A_k 생성

f(x0,u0)=0 을 fsolve로 풀어 SCR·X/R별 동작점을 구하고,
그 점에서 A_k = ∂f/∂x 를 평가한다.
"""

import numpy as np
from scipy import linalg, optimize
import model as M

# ── 고정 파라미터 (SI, 10 kVA / 400 V_LL 급) ──
FIXED = dict(
    C_pv=470e-6, L_pv=2e-3, C_dc=2200e-6, L_ess=2e-3,
    L1=2e-3, R1=0.05, Cf=10e-6, L2=0.5e-3, R2=0.02,
    w0=2*np.pi*60, Kpc=5.0, Kic=200.0, Lv=1e-3,
    V_ref=325.0, v_dc_ref=800.0, I0=1e-9, nVt=24.0,
)
# ── 제어 파라미터 (PSO 대상 14개의 초기값) ──
CTRL = dict(
    Kp_vpv=0.1, Ki_vpv=10.0, Kp_ipv=1e-3, Ki_ipv=0.1,
    Kp_vdc=0.5, Ki_vdc=20.0, Kp_iess=1e-3, Ki_iess=0.1,
    J=0.5, Dp=20.0, wc=2*np.pi*10, nq=1e-3, Kpv=0.05, Kiv=10.0,
)
# ── 입력 ──
INP = dict(Iph=25.0, v_pv_ref=500.0, Pref=10e3, Qref=0.0, Vg=325.0, V_b=400.0)

Z_BASE = 400.0**2 / 10e3            # 16 Ω


def grid_RL(SCR, XR):
    Zg = Z_BASE / SCR
    Rg = Zg / np.sqrt(1 + XR**2)
    Xg = Rg * XR
    return Rg, Xg / FIXED['w0']


f_fn, A_fn, B_fn = M.lambdify_all()


def _args(x, SCR, XR):
    Rg, Lg = grid_RL(SCR, XR)
    d = dict(zip(M.STATE_NAMES, x))
    d.update(INP); d.update(CTRL); d.update(FIXED)
    d['Rg'], d['Lg'] = Rg, Lg
    return [d[s.name] for s in M.ALL_SYMS]


def x0_guess():
    g = dict.fromkeys(M.STATE_NAMES, 0.0)
    g['v_pv'] = INP['v_pv_ref']; g['v_dc'] = FIXED['v_dc_ref']
    g['i_Lpv'] = 23.0; g['x_vpv'] = 23.0 / CTRL['Ki_vpv']
    g['x_ipv'] = 0.375 / CTRL['Ki_ipv']
    g['i_Less'] = -4.0; g['x_vdc'] = -4.0 / CTRL['Ki_vdc']
    g['x_iess'] = 0.5 / CTRL['Ki_iess']
    g['v_od'] = 325.0; g['i_ld'] = 20.0; g['i_od'] = 20.0
    g['delta'] = 0.2
    return np.array([g[s] for s in M.STATE_NAMES])


def solve_op(SCR, XR=1.0, x_init=None):
    x_init = x0_guess() if x_init is None else x_init
    sol, info, ier, msg = optimize.fsolve(
        lambda x: np.array(f_fn(*_args(x, SCR, XR))).ravel(),
        x_init, fprime=lambda x: np.array(A_fn(*_args(x, SCR, XR))),
        full_output=True, xtol=1e-11, maxfev=6000)
    return sol, ier == 1, msg


def jacobian(x0, SCR, XR=1.0):
    return np.array(A_fn(*_args(x0, SCR, XR)), dtype=float)


def fd_jacobian(x0, SCR, XR=1.0, h=1e-6):
    """유한차분 야코비안 — 심볼릭 검산용"""
    n = M.N
    Jm = np.zeros((n, n))
    for j in range(n):
        dx = max(abs(x0[j]), 1.0) * h
        xp, xm = x0.copy(), x0.copy()
        xp[j] += dx; xm[j] -= dx
        fp = np.array(f_fn(*_args(xp, SCR, XR))).ravel()
        fm = np.array(f_fn(*_args(xm, SCR, XR))).ravel()
        Jm[:, j] = (fp - fm) / (2*dx)
    return Jm


if __name__ == '__main__':
    print(f"{'SCR':>5} {'수렴':>5} {'v_od':>8} {'delta°':>8} "
          f"{'max Re':>11} {'ζ_min':>8} {'심볼vs유한차분':>14}")
    print("─"*70)
    xg = None
    for SCR in [3.0, 2.0, 1.5, 1.0]:
        x0, ok, msg = solve_op(SCR, 1.0, xg)
        if not ok:
            print(f"{SCR:>5} {'✗':>5}  {msg[:40]}"); continue
        xg = x0
        A = jacobian(x0, SCR)
        Afd = fd_jacobian(x0, SCR)
        rel = np.max(np.abs(A - Afd)) / max(np.max(np.abs(A)), 1.0)
        ev = linalg.eigvals(A)
        osc = [e for e in ev if e.imag > 0.5]
        z = min([-e.real/abs(e) for e in osc]) if osc else float('nan')
        d = dict(zip(M.STATE_NAMES, x0))
        print(f"{SCR:>5} {'✓':>5} {d['v_od']:>8.1f} "
              f"{np.degrees(d['delta']):>8.2f} {max(ev.real):>11.3e} "
              f"{z:>8.4f} {rel:>14.2e}")

    # ── 커플링 블록을 인위로 0으로 만들면 고유값이 실제로 바뀌는가 ──
    x0, ok, _ = solve_op(2.0, 1.0)
    A = jacobian(x0, 2.0)
    A_cut = A.copy()
    A_cut[M.N_DC:, :M.N_DC] = 0
    A_cut[:M.N_DC, M.N_DC:] = 0
    e1 = np.sort_complex(linalg.eigvals(A))
    e2 = np.sort_complex(linalg.eigvals(A_cut))
    print(f"\n커플링 제거 시 고유값 최대 변화: {np.max(np.abs(e1-e2)):.4e}")