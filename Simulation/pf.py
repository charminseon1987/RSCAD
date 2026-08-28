"""
pf.py — 참여계수(Participation Factor) 분석

목적: 어느 고유값이 실제 동기화 모드인지 확정한다.

주파수 대역 분류(runner.py 의 BANDS)는 대용 지표다. sync 대역(<5Hz)에서
잡히는 모드가 정말 δ·Δω 모드인지, 아니면 무관한 저주파 모드가 그 자리를
차지하고 진짜 스윙 모드는 다른 곳에 있는지 — 주파수만으로는 구분되지 않는다.

참여계수 정의:
    p_ki = Φ_ki · Ψ_ik          (Φ: 우고유벡터, Ψ = Φ⁻¹: 좌고유벡터)
    상태 k 가 모드 i 에 기여하는 정도. 스케일에 무관한 무차원 지표.

검증 논리:
    동기화 모드로 식별된 λ 에 대해 VSG 이론은
        K   = V·E·cos(δ) / X        동기화 계수
        ω_n = sqrt(K / J)           → cosδ 감소 시 감소
        ζ   = Dp / (2·sqrt(J·K))    → cosδ 감소 시 증가
    를 예측한다. 참여계수로 모드를 고정한 뒤 이 스케일링을 확인한다.

실행:
    python Simulation/pf.py                                # LATEST 실행 대상
    python Simulation/pf.py results/<폴더명>
    python Simulation/pf.py results/<폴더명> --top 8       # 모드당 상위 상태 수
"""

import argparse
import json
import sys
from pathlib import Path

import numpy as np
from scipy import linalg

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'Simulation'))

import model as M                                          # noqa: E402

# δ·Δω 로 인정할 상태 이름 후보 (모델마다 표기가 달라 폭넓게 잡는다)
DELTA_KEYS = ('delta',)
OMEGA_KEYS = ('dw', 'domega', 'omega', 'w_vsg', 'dwr', 'w')


def find_state(cands):
    for name in M.STATE_NAMES:
        if name.lower() in cands:
            return M.STATE_NAMES.index(name), name
    return None, None


def participation(A):
    """참여계수 행렬 반환.

    P[k, i] = |Φ_ki · Ψ_ik|, 각 모드(열)에 대해 합이 1이 되도록 정규화.
    """
    ev, V = linalg.eig(A)
    W = linalg.inv(V)                      # 행 i 가 모드 i 의 좌고유벡터
    P = np.abs(V.T * W).T                  # P[k,i] = |V[k,i] * W[i,k]|
    P = P / np.maximum(P.sum(axis=0, keepdims=True), 1e-300)
    return ev, P


def scr_of(path, prefix):
    try:
        return float(path.stem[len(prefix):])
    except ValueError:
        return None


def load_run(arg):
    root = ROOT / 'results'
    if arg:
        d = Path(arg)
        if not d.is_absolute():
            d = ROOT / arg
    else:
        ptr = root / 'LATEST.json'
        if not ptr.exists():
            raise SystemExit('LATEST.json 없음 — runner.py 를 먼저 실행하세요')
        d = root / json.loads(ptr.read_text(encoding='utf-8'))['run_name']
    if not d.is_dir():
        raise SystemExit(f'폴더 없음: {d}')
    meta = json.loads((d / 'meta.json').read_text(encoding='utf-8'))
    res_p = d / 'eigenvalue_results.json'
    res = json.loads(res_p.read_text(encoding='utf-8')) if res_p.exists() else {}
    return d, meta, {float(k): v for k, v in res.items()}


def main():
    ap = argparse.ArgumentParser(description='참여계수 기반 모드 식별')
    ap.add_argument('run', nargs='?', default=None, help='결과 폴더 (생략 시 LATEST)')
    ap.add_argument('--top', type=int, default=5, help='모드당 표시할 상위 상태 수')
    args = ap.parse_args()

    d, meta, res = load_run(args.run)
    J  = meta['ctrl_params']['J']
    Dp = meta['ctrl_params']['Dp']

    di, dname = find_state(DELTA_KEYS)
    wi, wname = find_state(OMEGA_KEYS)
    if di is None:
        raise SystemExit(f'STATE_NAMES 에 δ 상태 없음: {M.STATE_NAMES}')
    if wi is None:
        raise SystemExit(
            f'STATE_NAMES 에 Δω 상태를 찾지 못했습니다.\n'
            f'  후보: {OMEGA_KEYS}\n  실제: {M.STATE_NAMES}\n'
            f'  → pf.py 의 OMEGA_KEYS 에 실제 이름을 추가하세요.')

    print('=' * 86)
    print(f'  참여계수 분석 — {d.name}')
    print(f'  X/R = {meta.get("XR")}   J = {J}   Dp = {Dp}   상태 {M.N}차')
    print(f'  δ = {dname} (#{di})   Δω = {wname} (#{wi})')
    print('=' * 86)

    files = sorted(d.glob('A_num_SCR*.npy'),
                   key=lambda p: -(scr_of(p, 'A_num_SCR') or 0))
    if not files:
        raise SystemExit('A_num_SCR*.npy 없음')

    sync = []       # 참여계수로 식별한 동기화 모드 추적

    for p in files:
        scr = scr_of(p, 'A_num_SCR')
        A   = np.load(str(p))
        ev, P = participation(A)

        # ── 동기화 모드 = δ + Δω 참여도 합이 최대인 진동모드 ──
        pw = P[di, :] + P[wi, :]
        cand = [i for i in range(len(ev)) if ev[i].imag > 1e-4]
        if not cand:
            print(f'\n  SCR {scr}: 진동모드 없음')
            continue
        k = max(cand, key=lambda i: pw[i])

        lam  = ev[k]
        f_hz = float(lam.imag / (2 * np.pi))
        zeta = float(-lam.real / abs(lam))
        r    = res.get(scr, {})
        delta_deg = r.get('delta_deg')
        cosd = float(np.cos(np.radians(delta_deg))) if delta_deg is not None else None

        sync.append({'SCR': scr, 'f': f_hz, 'zeta': zeta,
                     'p_delta': float(P[di, k]), 'p_omega': float(P[wi, k]),
                     'p_sum': float(pw[k]), 'delta': delta_deg, 'cos': cosd,
                     'A_wd': float(A[wi, di])})

        print(f'\n  ── SCR {scr}  (δ = {delta_deg}°) ' + '─' * 44)
        print(f'  동기화 모드: λ = {lam.real:+.4f} {lam.imag:+.4f}j   '
              f'f = {f_hz:.4f} Hz   ζ = {zeta:.4f}')
        print(f'  참여도: {dname} = {P[di,k]:.4f},  {wname} = {P[wi,k]:.4f},  '
              f'합 = {pw[k]:.4f}')
        if pw[k] < 0.20:
            print(f'  ⚠ δ·Δω 참여도가 낮습니다 — 이 모드는 동기화 모드가 아닐 수 '
                  f'있습니다.')

        order = np.argsort(-P[:, k])[:args.top]
        print(f'  상위 참여 상태:')
        for s in order:
            print(f'      {M.STATE_NAMES[s]:>14}  {P[s,k]:.4f}')

    if len(sync) < 2:
        return

    # ── 이론 대비 검증 ──
    a, b = sync[0], sync[-1]
    print('\n' + '=' * 86)
    print(f'  이론 대비 검증  (SCR {a["SCR"]} → {b["SCR"]})')
    print('=' * 86)
    print(f"\n  {'SCR':>6} {'δ(°)':>8} {'cosδ':>8} {'f(Hz)':>9} {'ζ':>8} "
          f"{'p(δ)':>7} {'p(Δω)':>7} {'A[Δω,δ]':>13}")
    print('  ' + '-' * 74)
    for s in sync:
        print(f"  {s['SCR']:>6.2f} {s['delta']:>8.2f} {s['cos']:>8.4f} "
              f"{s['f']:>9.4f} {s['zeta']:>8.4f} "
              f"{s['p_delta']:>7.4f} {s['p_omega']:>7.4f} {s['A_wd']:>13.4e}")

    if a['cos'] is None or b['cos'] is None or b['cos'] <= 0:
        print('\n  cosδ ≤ 0 또는 미상 — 이론 비교 생략 (δ > 90° 구간)')
        return

    k_ratio = a['cos'] / b['cos']
    pred    = np.sqrt(k_ratio)
    print(f'\n  cosδ 비 = {k_ratio:.3f}  →  예측: f {pred:.2f}배 감소, '
          f'ζ {pred:.2f}배 증가')

    f_obs = a['f'] / b['f']
    z_obs = b['zeta'] / a['zeta']
    print(f'  관측: f {f_obs:.3f}배,  ζ {z_obs:.3f}배')

    # A[Δω,δ] 는 -(1/J)·∂P/∂δ 이므로 cosδ 에 비례해야 한다.
    if abs(b['A_wd']) > 1e-300:
        a_obs = abs(a['A_wd'] / b['A_wd'])
        print(f'  A[Δω,δ] 비: 관측 {a_obs:.3f}배 / 예측 {k_ratio:.3f}배 '
              f'(∂P/∂δ ∝ cosδ)')
    else:
        a_obs = None
        print(f'  ⛔ A[Δω,δ] = 0 — 스윙 방정식에 ∂P/∂δ 항이 없습니다.')

    print()
    flat = (f_obs < 1.10 and z_obs < 1.10)
    if flat and a_obs is not None and a_obs > 1.5:
        print('  ⛔ A[Δω,δ] 는 cosδ 를 따라 변하는데 모드는 반응하지 않습니다.')
        print('     → 참여계수로 고른 이 모드가 실제 스윙 모드가 아닙니다.')
        print('       위 "상위 참여 상태" 목록에서 δ·Δω 참여도를 확인하고,')
        print('       0.2 미만이면 스윙 모드가 과감쇠(실수극)로 분리된 것입니다.')
        print('       그 경우 실수 고유값 중 δ 참여도가 높은 것을 찾아야 합니다.')
    elif flat:
        print('  ⛔ 동기화 모드가 δ 에 반응하지 않습니다.')
        print('     model.py 의 스윙 방정식에서 ∂P/∂δ 경로를 확인하세요.')
    else:
        print('  ✅ 동기화 모드가 δ 에 이론대로 반응합니다.')

    # ── 실수극 중 δ 참여도 높은 것 점검 (과감쇠 스윙 모드 탐색) ──
    print('\n' + '=' * 86)
    print('  실수극 δ 참여도 점검 (스윙 모드가 과감쇠로 분리됐는지 확인)')
    print('=' * 86)
    for p in files:
        scr = scr_of(p, 'A_num_SCR')
        A = np.load(str(p))
        ev, P = participation(A)
        real_idx = [i for i in range(len(ev)) if abs(ev[i].imag) <= 1e-4]
        if not real_idx:
            continue
        best = sorted(real_idx, key=lambda i: -(P[di, i] + P[wi, i]))[:2]
        parts = '   '.join(
            f'λ={ev[i].real:+.3f} p(δ+Δω)={P[di,i]+P[wi,i]:.3f}' for i in best)
        print(f'  SCR {scr:>5.2f}:  {parts}')


if __name__ == '__main__':
    main()
