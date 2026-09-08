"""
pf_export.py — 참여계수를 JSON 으로 저장

pf.py 는 화면 출력만 하므로 대시보드·문서에서 재사용할 수 없다.
이 스크립트는 pf.py 를 수정하지 않고 같은 계산을 다시 수행해
`participation_factors.json` 을 남긴다.

실행:
    python Simulation/pf_export.py                 # LATEST.json 이 가리키는 실행
    python Simulation/pf_export.py results/J0.50_...
    python Simulation/pf_export.py --top 5

출력: results/<run>/participation_factors.json
      대시보드 Report 패널의 '결과 · 그림 불러오기' 로 읽는다.

조연호 · 연세대 스마트그리드 연구실
"""

import argparse
import json
import re
from datetime import datetime
from pathlib import Path

import numpy as np
from scipy import linalg

import model as M

ROOT = Path(__file__).resolve().parent.parent
DELTA, OMEGA = 'delta', 'dw'
IM_TOL = 1e-4


# ══════════════════════════════════════════════
# 참여계수
# ══════════════════════════════════════════════
def participation(A):
    """P[k,i] = |Φ_ki · Ψ_ik|, 모드별 정규화.

    Φ = 우고유벡터, Ψ = Φ⁻¹ = 좌고유벡터.
    metrics.participation 과 같은 정의다.
    """
    ev, V = linalg.eig(A)
    W = linalg.inv(V)
    P = np.abs(V.T * W).T
    return ev, P / np.maximum(P.sum(axis=0, keepdims=True), 1e-300)


def sync_mode(ev, P, di, wi):
    """δ+Δω 참여도가 가장 큰 모드를 동기화 모드로 채택한다.

    진동 모드로 한정하면 안 된다. Dp/J 가 크면 동기화 모드가 과감쇠되어
    실수극으로 분리되며, 그때 진동 모드만 뒤지면 무관한 저주파 모드
    (Qf·Pf 드룹)가 동기화 모드로 오인된다.
    """
    keep = [i for i in range(len(ev)) if ev[i].imag >= -IM_TOL]   # 켤레쌍 한 번만
    pw = P[di, :] + P[wi, :]
    k = max(keep, key=lambda i: pw[i])
    return k, float(pw[k])


# ══════════════════════════════════════════════
# 실행 폴더 찾기
# ══════════════════════════════════════════════
def resolve_run(arg):
    root = ROOT / 'results'
    if arg:
        d = Path(arg)
        if not d.is_absolute():
            d = ROOT / arg if (ROOT / arg).exists() else root / arg
    else:
        ptr = root / 'LATEST.json'
        if not ptr.exists():
            raise SystemExit('LATEST.json 없음 — runner.py 를 먼저 실행하세요')
        d = root / json.loads(ptr.read_text(encoding='utf-8'))['run_name']
    if not d.is_dir():
        raise SystemExit(f'{d} 없음')
    return d


def scr_of(path):
    """A_num_SCR3.00.npy / A_num_SCR3.0_XR1.0.npy 양쪽 모두 처리."""
    m = re.search(r'SCR([0-9.]+)', path.stem)
    if not m:
        return None
    return float(m.group(1).rstrip('.'))


# ══════════════════════════════════════════════
def main():
    ap = argparse.ArgumentParser(description='참여계수 JSON 저장')
    ap.add_argument('run', nargs='?', default=None, help='결과 폴더 (생략 시 LATEST)')
    ap.add_argument('--top', type=int, default=3, help='모드당 기록할 상위 상태 수')
    args = ap.parse_args()

    d = resolve_run(args.run)
    files = sorted(d.glob('A_num_SCR*.npy'), key=lambda p: -(scr_of(p) or 0))
    if not files:
        raise SystemExit(f'{d} 에 A_num_SCR*.npy 없음')

    mp = d / 'meta.json'
    meta = json.loads(mp.read_text(encoding='utf-8')) if mp.exists() else {}
    eig_res = {}
    ep = d / 'eigenvalue_results.json'
    if ep.exists():
        eig_res = json.loads(ep.read_text(encoding='utf-8'))

    if DELTA not in M.STATE_NAMES or OMEGA not in M.STATE_NAMES:
        raise SystemExit(f'상태변수에 {DELTA}/{OMEGA} 가 없습니다 — model.py 확인')
    di = M.STATE_NAMES.index(DELTA)
    wi = M.STATE_NAMES.index(OMEGA)

    out = {
        'run': d.name,
        'model_version': meta.get('model_version'),
        'XR': meta.get('last_run_XR', meta.get('XR')),
        'timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        'ctrl_params': meta.get('ctrl_params', {}),
        'delta_state': DELTA,
        'omega_state': OMEGA,
        'by_SCR': {},
    }

    print(f'  실행 폴더: {d.name}')
    print(f"\n  {'SCR':>6} {'λ':>22} {'유형':>7} {'p(δ)':>8} {'p(Δω)':>8} {'합':>8}")
    print('  ' + '─' * 66)

    for p in files:
        scr = scr_of(p)
        if scr is None:
            continue
        A = np.load(str(p))
        ev, P = participation(A)
        k, psum = sync_mode(ev, P, di, wi)
        lam = ev[k]
        osc = bool(abs(lam.imag) > IM_TOL)
        order = np.argsort(-P[:, k])[:args.top]

        r = eig_res.get(f'{scr:.2f}', eig_res.get(f'{scr:g}', {}))

        out['by_SCR'][f'{scr:g}'] = {
            'sync_mode': {
                're': float(lam.real),
                'im': float(lam.imag),
                'oscillatory': osc,
                'sigma': float(-lam.real),
                'f_hz': float(abs(lam.imag) / (2 * np.pi)) if osc else None,
                'zeta': (float(-lam.real / abs(lam))
                         if osc and abs(lam) > 1e-12 else None),
            },
            'p_delta': float(P[di, k]),
            'p_omega': float(P[wi, k]),
            'p_sum':   float(psum),
            'top_states': [{'state': M.STATE_NAMES[s], 'p': float(P[s, k])}
                           for s in order],
            'delta_deg': r.get('delta_deg'),
            'A_omega_delta': float(A[wi, di]),
        }

        lam_s = f'{lam.real:+.4f}{lam.imag:+.4f}j'
        print(f'  {scr:>6.2f} {lam_s:>22} {"진동" if osc else "실수극":>6} '
              f'{P[di,k]:>8.4f} {P[wi,k]:>8.4f} {psum:>8.4f}')

    (d / 'participation_factors.json').write_text(
        json.dumps(out, indent=2, ensure_ascii=False), encoding='utf-8')
    print(f'\n  💾 results/{d.name}/participation_factors.json')

    # A[Δω, δ] = 0 은 전차수 모델에서 정상이다. 오해를 막기 위해 함께 알린다.
    a0 = [v['A_omega_delta'] for v in out['by_SCR'].values()]
    if a0 and max(abs(x) for x in a0) < 1e-12:
        print('\n  참고 — A[Δω, δ] = 0 은 전차수 모델에서 정상이다.')
        print('         계통 동역학과 전력 필터가 상태변수이므로 δ 는 스윙 방정식에')
        print('         직접 들어가지 않고 δ → i_od → Pf → Δω 경로로 되먹임된다.')


if __name__ == '__main__':
    main()
