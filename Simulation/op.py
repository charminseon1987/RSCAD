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


# ══════════════════════════════════════════════
# 정격 (정규화 기준)
# ══════════════════════════════════════════════
# 오차 지표의 분모는 반드시 설비 정격에서 가져온다.
# 데이터(|x0|, 궤적 진폭 등)에서 척도를 뽑으면 그 값이 0 에 가까워질 때
# 분모가 소멸해 오차가 발산한다. 실제로 i_oq 진폭 극소(SCR 1.4)와
# dw 동작점 0 에서 각각 가짜 골짜기와 100% 오차가 발생했다.
#
# 제어기 내부 적분기는 물리적 관측량이 아니므로 정격이 정의되지 않으며,
# 유효성 판정 대상에서 제외한다.

OBSERVABLE = [
    'v_pv', 'i_Lpv', 'v_dc', 'i_Less',                   # DC 4
    'delta', 'dw', 'Pf', 'Qf',                           # VSG 4
    'i_ld', 'i_lq', 'v_od', 'v_oq', 'i_od', 'i_oq',      # AC 6
]
INTEGRATORS = ['x_vpv', 'x_ipv', 'x_vdc', 'x_iess',
               'phi_d', 'phi_q', 'gam_d', 'gam_q']


def nominals():
    """상태별 정규화 정격. 관측량만 반환한다."""
    S = INP['Pref']                                   # 정격 용량 [VA]
    V = FIXED['V_ref']                                # 상 전압 피크 [V]
    I = S / (1.5 * V)                                 # 정격 전류 피크 [A]
    return {
        'v_pv':   INP['v_pv_ref'],
        'i_Lpv':  I,
        'v_dc':   FIXED['v_dc_ref'],
        'i_Less': I,
        # δ 는 절대 크기가 아니라 동작점 자체가 물리적 척도다.
        # 정격을 1 rad(57.3°)로 두면 수 도(度)의 변화가 희석되어
        # 동기화 특성의 오차가 보이지 않는다. π/4(45°)를 기준으로 삼는다.
        # (전형적인 정격 부하 전력각 규모)
        'delta':  np.pi / 4,
        'dw':     FIXED['w0'],                        # 정격 각주파수
        'Pf':     S,
        'Qf':     S,
        'i_ld':   I, 'i_lq': I,
        'v_od':   V, 'v_oq': V,
        'i_od':   I, 'i_oq': I,
    }


def nominal_vector():
    """M.STATE_NAMES 순서의 정격 배열과 관측량 마스크."""
    nom_d = nominals()
    nom  = np.array([nom_d.get(s, np.nan) for s in M.STATE_NAMES], float)
    mask = np.array([s in nom_d for s in M.STATE_NAMES], bool)
    nom[~mask] = 1.0                                  # 제외 상태는 사용 안 함
    return nom, mask


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
    A_fd = np.zeros((n, n))
    for j in range(n):
        dx = max(abs(x0[j]), 1.0) * h
        xp, xm = x0.copy(), x0.copy()
        xp[j] += dx; xm[j] -= dx
        fp = np.array(f_fn(*_args(xp, SCR, XR))).ravel()
        fm = np.array(f_fn(*_args(xm, SCR, XR))).ravel()
        A_fd[:, j] = (fp - fm) / (2*dx)
    return A_fd


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