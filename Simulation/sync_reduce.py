"""
sync_reduce.py — 동기화계수 K_eff 를 야코비안에서 직접 추출

배경
    A[Δω, δ] = 0 은 전차수 모델에서 정상이다. 계통 동역학과 전력 필터가
    상태변수이므로 δ 는 스윙 방정식에 직접 들어가지 않고
    δ → i_od → Pf → Δω 경로로 되먹임된다.
    즉 K 가 사라진 게 아니라 다른 상태에 묻혀 있다.

방법 — Schur 보수
    상태를 [δ, Δω] 와 나머지로 나누고 나머지를 준정상 소거한다.

        A_red = A₁₁ − A₁₂ · A₂₂⁻¹ · A₂₁

    스윙 방정식이 f_Δω = ((P* − Pf)/ω₀ − Dp·Δω) / J 이므로

        A_red[Δω, δ] = −(1/(J·ω₀)) · ∂Pf/∂δ ≡ −K_eff / (J·ω₀)
        K_eff = −J·ω₀·A_red[Δω, δ]      [W/rad]

    이론식(∂P/∂δ = (EV/Z)·sin(δ+θ_Z)) 과 달리 전차수 모델 자체에서 나온
    값이므로, '이론 대비'가 아니라 '모델 자기 일관성' 검증이 된다.

전제 — 시간척도 분리
    준정상 소거는 소거 대상이 충분히 빨라야 성립한다. 소거 상태 중 가장
    느린 모드와 동기화 모드의 감쇠율 비(SEP)를 함께 보고한다.
    SEP < 3 이면 K_eff 를 신뢰하지 말 것. 특히 전력 필터극(wc)이
    동기화 모드에 가까우면 이 조건이 깨진다.

실행
    python Simulation/sync_reduce.py                 # LATEST
    python Simulation/sync_reduce.py results/J0.50_...
    python Simulation/sync_reduce.py --xr 1.0        # 이론식 대조에 쓸 X/R

조연호 · 연세대 스마트그리드 연구실
"""

import argparse
import json
import re
from pathlib import Path

import numpy as np
from scipy import linalg

import model as M

ROOT = Path(__file__).resolve().parent.parent
DELTA, OMEGA, PFILT = 'delta', 'dw', 'Pf'
IM_TOL = 1e-4
SEP_MIN = 3.0                      # 시간척도 분리비 하한


# ══════════════════════════════════════════════
def participation(A):
    ev, V = linalg.eig(A)
    W = linalg.inv(V)
    P = np.abs(V.T * W).T
    return ev, P / np.maximum(P.sum(axis=0, keepdims=True), 1e-300)


def schur_swing(A, di, wi):
    """[δ, Δω] 만 남기고 나머지를 준정상 소거한다."""
    keep = [di, wi]
    rest = [i for i in range(A.shape[0]) if i not in keep]
    A11 = A[np.ix_(keep, keep)]
    A12 = A[np.ix_(keep, rest)]
    A21 = A[np.ix_(rest, keep)]
    A22 = A[np.ix_(rest, rest)]

    # A22 가 특이하면 소거 자체가 성립하지 않는다 (적분기가 남아 있는 경우 등)
    cond = np.linalg.cond(A22)
    try:
        A_red = A11 - A12 @ linalg.solve(A22, A21)
    except linalg.LinAlgError:
        return None, None, cond

    # 소거 대상의 최소 감쇠율 = 시간척도 분리 판정용
    sig_rest = float(np.min(-linalg.eigvals(A22).real))
    return A_red, sig_rest, cond


def sync_mode(ev, P, di, wi):
    keep = [i for i in range(len(ev)) if ev[i].imag >= -IM_TOL]
    pw = P[di, :] + P[wi, :]
    k = max(keep, key=lambda i: pw[i])
    return k, float(pw[k])


def swing_pair(ev, P, di, wi, n=2):
    """δ·Δω 참여도 상위 n 개 모드 (빠른 근 포함)."""
    keep = [i for i in range(len(ev)) if ev[i].imag >= -IM_TOL]
    pw = P[di, :] + P[wi, :]
    return sorted(keep, key=lambda i: -pw[i])[:n]


def theory_K(scr, xr, delta_rad, fixed):
    """∂P/∂δ = (E·V/Z)·sin(δ + θ_Z).  X≫R 이면 cos δ 로 환원된다.

    δ 는 인버터 내부 프레임 기준이므로 경로 임피던스에 필터
    (L1 + Lv + L2)까지 포함해야 한다. 이 부분은 저항이 거의 없어
    θ_Z 를 계통값보다 크게 만든다 (X/R=1 에서 45° → 48~53°).
    """
    w0 = fixed['w0']
    Zb = 400.0 ** 2 / 10e3
    Zg = Zb / scr
    Rg = Zg / np.sqrt(1 + xr ** 2)
    Lg = Rg * xr / w0
    X = w0 * (fixed['L1'] + fixed['Lv'] + fixed['L2'] + Lg)
    R = fixed['R1'] + fixed['R2'] + Rg
    Z = float(np.hypot(R, X))
    th = float(np.arctan2(X, R))
    return np.sin(delta_rad + th) / Z, np.degrees(th), Z


# ══════════════════════════════════════════════
def resolve_run(arg):
    root = ROOT / 'results'
    if arg:
        d = Path(arg)
        if not d.is_absolute():
            d = ROOT / arg if (ROOT / arg).exists() else root / arg
    else:
        p = root / 'LATEST.json'
        if not p.exists():
            raise SystemExit('LATEST.json 없음 — runner.py 를 먼저 실행하세요')
        d = root / json.loads(p.read_text(encoding='utf-8'))['run_name']
    if not d.is_dir():
        raise SystemExit(f'{d} 없음')
    return d


def scr_of(p):
    m = re.search(r'SCR([0-9.]+)', p.stem)
    return float(m.group(1).rstrip('.')) if m else None


def main():
    ap = argparse.ArgumentParser(description='Schur 축소로 K_eff 추출')
    ap.add_argument('run', nargs='?', default=None)
    ap.add_argument('--xr', type=float, default=None, help='이론식 대조용 X/R')
    args = ap.parse_args()

    d = resolve_run(args.run)
    files = sorted(d.glob('A_num_SCR*.npy'), key=lambda p: -(scr_of(p) or 0))
    if not files:
        raise SystemExit(f'{d} 에 A_num_SCR*.npy 없음')

    mp = d / 'meta.json'
    meta = json.loads(mp.read_text(encoding='utf-8')) if mp.exists() else {}
    eig = {}
    ep = d / 'eigenvalue_results.json'
    if ep.exists():
        eig = json.loads(ep.read_text(encoding='utf-8'))

    xr = args.xr if args.xr is not None else meta.get('last_run_XR', meta.get('XR', 1.0))
    ctrl = meta.get('ctrl_params', {})
    fixed = meta.get('fixed_params', {})
    J = ctrl.get('J'); Dp = ctrl.get('Dp'); w0 = fixed.get('w0', 2 * np.pi * 60)

    di = M.STATE_NAMES.index(DELTA)
    wi = M.STATE_NAMES.index(OMEGA)
    pi = M.STATE_NAMES.index(PFILT) if PFILT in M.STATE_NAMES else None

    print(f'  실행 폴더: {d.name}')
    if J and Dp:
        print(f'  J={J}  Dp={Dp}  →  −Dp/J = {-Dp/J:.2f}  (스윙 2×2 trace 이론값)')
    print(f'  X/R = {xr}')

    print(f"\n  {'SCR':>5} {'λ_slow':>9} {'λ_fast':>9} {'합':>9} "
          f"{'K_eff':>11} {'SEP':>7} {'p(δ+Δω)':>9} {'p(Pf)':>7}")
    print('  ' + '─' * 76)

    out, rows = {}, []
    for p in files:
        scr = scr_of(p)
        A = np.load(str(p))
        ev, P = participation(A)
        pair = swing_pair(ev, P, di, wi, 2)
        k_slow = min(pair, key=lambda i: -ev[i].real)   # σ 작은 쪽
        k_fast = [i for i in pair if i != k_slow]
        k_fast = k_fast[0] if k_fast else k_slow

        A_red, sig_rest, cond = schur_swing(A, di, wi)
        if A_red is None:
            print(f'  {scr:>5.2f}  Schur 소거 실패 (A22 특이, cond={cond:.1e})')
            continue

        sig_slow = float(-ev[k_slow].real)
        sep = sig_rest / sig_slow if sig_slow > 0 else np.inf
        K_eff = (-J * w0 * A_red[1, 0]) if (J and w0) else None

        r = eig.get(f'{scr:.2f}', eig.get(f'{scr:g}', {}))
        dd = r.get('delta_deg')
        th_K = th = Z = None
        if dd is not None and fixed:
            th_K, th, Z = theory_K(scr, xr, np.radians(dd), fixed)

        s = float(ev[k_slow].real + ev[k_fast].real)
        pw = float(P[di, k_slow] + P[wi, k_slow])
        ppf = float(P[pi, k_fast]) if pi is not None else float('nan')

        flag = '' if sep >= SEP_MIN else '  ⚠ 분리 부족'
        print(f'  {scr:>5.2f} {ev[k_slow].real:>9.4f} {ev[k_fast].real:>9.4f} '
              f'{s:>9.2f} {K_eff:>11.4g} {sep:>7.2f} {pw:>9.4f} {ppf:>7.4f}{flag}')

        rows.append((scr, K_eff, th_K, sig_slow))
        out[f'{scr:g}'] = {
            'lambda_slow': float(ev[k_slow].real),
            'lambda_fast': float(ev[k_fast].real),
            'trace_pair': s,
            'K_eff': None if K_eff is None else float(K_eff),
            'A_red_wd': float(A_red[1, 0]),
            'sep_ratio': float(sep),
            'sep_ok': bool(sep >= SEP_MIN),
            'cond_A22': float(cond),
            'p_sync_slow': pw,
            'p_Pf_fast': ppf,
            'theory_K_rel': None if th_K is None else float(th_K),
            'theta_Z_deg': th, 'Z_ohm': Z,
        }

    # ── 이론 대조 ──
    if len(rows) >= 2 and all(r[2] is not None for r in rows):
        a, b = rows[0], rows[-1]
        print(f"\n  {'':>5} {'K_eff 비':>10} {'이론 비':>10} {'λ 비':>10} {'차이':>9}")
        print('  ' + '─' * 50)
        rk = a[1] / b[1]; rt = a[2] / b[2]; rl = a[3] / b[3]
        print(f"  {'SCR ' + f'{a[0]:g}/{b[0]:g}':>5} {rk:>10.3f} {rt:>10.3f} "
              f"{rl:>10.3f} {(rk/rt-1)*100:>8.1f}%")
        print(f"\n  이론식: ∂P/∂δ = (E·V/Z)·sin(δ + θ_Z),  θ_Z = "
              f"{rows[0][2] and out[f'{a[0]:g}']['theta_Z_deg']:.1f}° … "
              f"{out[f'{b[0]:g}']['theta_Z_deg']:.1f}°")
        print('  ※ X≫R 가정의 cos δ 식은 X/R 이 1 부근이면 크게 빗나간다.')
        print('     θ_Z 가 45° 근처면 sin(δ+θ_Z) 는 δ 22~62° 구간에서 거의 상수이므로,')
        print('     감소를 만드는 것은 각도가 아니라 임피던스 Z 자체다.')

    bad = [k for k, v in out.items() if not v['sep_ok']]
    if bad:
        print(f"\n  ⚠ 시간척도 분리 부족 (SEP < {SEP_MIN}): SCR {', '.join(bad)}")
        print('     준정상 소거 가정이 약하므로 해당 K_eff 는 참고값으로만 쓸 것.')
        print('     전력 필터극(wc)이 동기화 모드에 가까운 것이 원인일 수 있다.')

    (d / 'sync_reduction.json').write_text(
        json.dumps({'run': d.name, 'XR': xr, 'J': J, 'Dp': Dp,
                    'sep_min': SEP_MIN, 'by_SCR': out},
                   indent=2, ensure_ascii=False), encoding='utf-8')
    print(f'\n  💾 results/{d.name}/sync_reduction.json')


if __name__ == '__main__':
    main()
