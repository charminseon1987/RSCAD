"""
check_sync.py — 동기화 모드가 δ에 반응하는지 검증

VSG 이론:
    K   = V·E·cos(δ) / X          동기화 계수
    ω_n = sqrt(K / J)             고유진동수      → K 감소 시 감소
    ζ   = Dp / (2·sqrt(J·K))      감쇠비          → K 감소 시 증가

δ 가 22° → 79° 로 밀리면 cos δ 가 4.8배 줄어들므로
ω_n 은 약 2.2배 감소, ζ 는 약 2.2배 증가해야 한다.

둘 다 평탄하면 ∂P/∂δ 항이 야코비안에 반영되지 않은 것이다.
(유한차분 검산은 이 결함을 못 잡는다 — 심볼릭과 유한차분이 똑같이
 잘못된 f(x) 를 미분하면 서로 일치하기 때문.)

실행:
    python Simulation/check_sync.py                       # LATEST 실행 대상
    python Simulation/check_sync.py results/<폴더명>
"""

import json
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'Simulation'))


def load(run_dir=None):
    root = ROOT / 'results'
    if run_dir:
        d = Path(run_dir)
        if not d.is_absolute():
            d = ROOT / run_dir
    else:
        ptr = root / 'LATEST.json'
        if not ptr.exists():
            raise SystemExit('LATEST.json 없음 — runner.py 를 먼저 실행하세요')
        d = root / json.loads(ptr.read_text(encoding='utf-8'))['run_name']
    p = d / 'eigenvalue_results.json'
    if not p.exists():
        raise SystemExit(f'{p} 없음')
    return d, json.loads(p.read_text(encoding='utf-8')), \
        json.loads((d / 'meta.json').read_text(encoding='utf-8'))


def main():
    d, res, meta = load(sys.argv[1] if len(sys.argv) > 1 else None)

    print('=' * 84)
    print(f'  동기화 모드 δ 반응 검증 — {d.name}')
    print(f'  X/R = {meta.get("XR")}   J = {meta["ctrl_params"]["J"]}   '
          f'Dp = {meta["ctrl_params"]["Dp"]}')
    print('=' * 84)

    rows = []
    for k in sorted(res, key=float, reverse=True):
        r = res[k]
        if not r.get('converged'):
            continue
        rows.append({
            'SCR':    float(k),
            'delta':  r['delta_deg'],
            'cos':    float(np.cos(np.radians(r['delta_deg']))),
            'f_sync': r['band_f_hz']['sync'],
            'z_sync': r['band_zeta']['sync'],
            'f_ctrl': r['band_f_hz']['control'],
            'z_ctrl': r['band_zeta']['control'],
        })

    if not rows:
        raise SystemExit('수렴한 SCR 없음')

    print(f"\n  {'SCR':>5} {'δ(°)':>8} {'cosδ':>8} "
          f"{'f_sync':>9} {'ζ_sync':>8} {'f_ctrl':>9} {'ζ_ctrl':>8}")
    print('  ' + '-' * 66)
    g = lambda v: '       -' if v is None else f'{v:>8.4f}'
    for r in rows:
        print(f"  {r['SCR']:>5.2f} {r['delta']:>8.2f} {r['cos']:>8.4f} "
              f"{g(r['f_sync'])} {g(r['z_sync'])} "
              f"{g(r['f_ctrl'])} {g(r['z_ctrl'])}")

    # ── 이론 대비 검증 ──
    a, b = rows[0], rows[-1]           # 강계통, 약계통
    if a['cos'] <= 0 or b['cos'] <= 0:
        raise SystemExit('\n  cosδ ≤ 0 — δ 가 90° 를 넘었습니다.')

    k_ratio = a['cos'] / b['cos']      # K 감소 배율
    pred    = np.sqrt(k_ratio)         # ω_n 감소·ζ 증가 배율

    print('\n' + '=' * 84)
    print(f'  SCR {a["SCR"]} → {b["SCR"]} 구간')
    print(f'  cosδ 비 = {k_ratio:.3f}  →  이론 예측: '
          f'f_sync {pred:.2f}배 감소, ζ_sync {pred:.2f}배 증가')
    print('=' * 84)

    verdict = []
    for label, key, direction in [('f_sync', 'f_sync', 'down'),
                                  ('ζ_sync', 'z_sync', 'up')]:
        if a[key] is None or b[key] is None:
            print(f'  {label:>8}: sync 대역 모드 미검출 — 판정 불가')
            verdict.append('missing')
            continue
        obs = (a[key] / b[key]) if direction == 'down' else (b[key] / a[key])
        rel = obs / pred
        if rel > 0.6:
            tag, note = '✅ 일치', '이론과 부합'
        elif obs < 1.10:
            tag, note = '❌ 무반응', 'δ 변화에 반응하지 않음'
            verdict.append('flat')
        else:
            tag, note = '⚠ 약함', f'예측의 {rel*100:.0f}% 수준'
            verdict.append('weak')
        print(f'  {label:>8}: 관측 {obs:.2f}배 / 예측 {pred:.2f}배   {tag} — {note}')

    print()
    if 'flat' in verdict:
        print('  ⛔ 동기화 모드가 δ 에 반응하지 않습니다.')
        print('     확인 순서:')
        print('       1) model.py 의 전력 계산식에 δ 가 들어가는지')
        print('          (P = f(δ) 형태여야 하며, 상수 P0 로 고정돼 있으면 안 됨)')
        print('       2) A[δ 행][Δω 열] 과 A[Δω 행][δ 열] 이 둘 다 0 이 아닌지')
        print('       3) sync 대역(<5Hz) 에서 잡힌 모드의 참여계수가 실제로')
        print('          δ·Δω 에 집중돼 있는지 (pf.py 필요)')
        print('     ※ 유한차분 검산은 이 결함을 검출하지 못합니다.')
        print('        심볼릭과 유한차분이 동일한 f(x) 를 미분하므로,')
        print('        f(x) 자체가 물리와 어긋나면 둘은 그대로 일치합니다.')
    elif 'missing' in verdict:
        print('  ⚠ sync 대역에 모드가 없습니다. BANDS 경계(5Hz)를 낮춰 재확인하세요.')
    else:
        print('  ✅ 동기화 모드가 δ 에 이론대로 반응합니다.')

    # ── δ 행/열 직접 점검 ──
    try:
        import model as M
    except Exception:                                   # noqa: BLE001
        return
    if 'delta' not in M.STATE_NAMES:
        print('\n  ⛔ STATE_NAMES 에 delta 없음 — 22-state 모델이 아닙니다.')
        return
    di = M.STATE_NAMES.index('delta')

    npys = sorted(d.glob('A_num_SCR*.npy'))
    if not npys:
        return
    print(f'\n  δ 행/열 결합 점검  (delta = 상태 #{di})')
    print('  ' + '-' * 66)
    print(f"  {'파일':>26} {'‖A[δ,:]‖':>12} {'‖A[:,δ]‖':>12} {'판정':>10}")
    for p in npys:
        A = np.load(str(p))
        row = float(np.linalg.norm(np.delete(A[di, :], di)))
        col = float(np.linalg.norm(np.delete(A[:, di], di)))
        ok = '✅' if (row > 1e-12 and col > 1e-12) else '❌ 단방향'
        print(f'  {p.name:>26} {row:>12.4e} {col:>12.4e} {ok:>10}')
    print('\n  ※ 둘 중 하나가 0 이면 δ 결합이 단방향이라 고유값에 나타나지 않습니다.')


if __name__ == '__main__':
    main()
