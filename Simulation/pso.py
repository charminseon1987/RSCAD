"""
pso.py — 14-파라미터 PSO 예비실험 (P4)

목적함수는 새로 만들지 않는다. metrics.objective_multi 가 이미 설계돼 있다.

    score   = min(σ_min/SIGMA_REF, ζ_min/ZETA_FLOOR)     한 운전점
    F_multi = min_k score(SCR_k)                          전 운전점

없던 것은 **탐색기와 탐색 범위** 둘뿐이었다. 이 파일이 그 둘을 채운다.

─────────────────────────────────────────────────────────────────────
이 실행은 A안이다 — 범위에 물리 근거가 없다
─────────────────────────────────────────────────────────────────────
범위를 기준값의 [base/4, base*4] 로 둔다. 임의로 고른 값이고 관성 사양·
측정 대역·전압 규정 같은 물리 제약을 반영하지 않는다. 그래서 여기서 나온
best 를 **설계값이라고 부르면 안 된다.**

이 실행의 산출물은 best 가 아니라 **민감도**다. 어느 파라미터가 F 를 움직이고
어느 것이 안 움직이는지 알면, B안(파라미터마다 물리 근거를 달아 범위를 정하는
일)에서 어디에 공을 들여야 하는지가 정해진다. 안 움직이는 파라미터의 범위를
정밀하게 따지는 것은 낭비다.

로그 공간에서 탐색한다. 이득이 0.001 에서 36 까지 네 자릿수에 걸쳐 있어
선형 공간에서는 큰 값이 탐색을 독점한다.

실행:
    python Simulation/pso.py                    # LATEST.json 이 가리키는 실행
    python Simulation/pso.py results/J0.50_...
    python Simulation/pso.py --swarm 24 --iters 40 --span 4

출력: results/<run>/pso_A.json

조연호 · 연세대 스마트그리드 연구실
"""

import console_utf8  # noqa: F401 — cp949 콘솔에서 죽지 않게
import argparse
import json
import math
import time
from datetime import datetime
from pathlib import Path

import numpy as np

import metrics as MT

ROOT = Path(__file__).resolve().parent.parent

# PSO 표준 계수. Clerc 수축계수 계열로, 과한 발산 없이 수렴한다.
W, C1, C2 = 0.72, 1.49, 1.49


def resolve_run(arg):
    """실행 폴더. pf_export.py 와 같은 규칙을 쓴다."""
    root = ROOT / 'results'
    if arg:
        p = Path(arg)
        if not p.is_absolute():
            p = ROOT / p
        if not p.is_dir():
            raise SystemExit(f'{p} 없음')
        return p
    ptr = root / 'LATEST.json'
    if not ptr.exists():
        raise SystemExit('LATEST.json 없음 — runner.py 를 먼저 실행하세요')
    name = json.loads(ptr.read_text(encoding='utf-8'))['run_name']
    p = root / name
    if not p.is_dir():
        raise SystemExit(f'{p} 없음')
    return p


def evaluate(ctrl, scr_list, xr):
    """objective_multi 를 감싼다. 터지면 큰 비용으로 바꿔 탐색을 계속한다."""
    try:
        cost, detail = MT.objective_multi(dict(ctrl), scr_list, XR=xr)
    except Exception:                                    # noqa: BLE001
        return 1e7, {}
    if not np.isfinite(cost):
        return 1e7, {}
    return float(cost), detail


def resolve_bounds(base, span, bounds_doc):
    """파라미터별 (lo, hi). B안 파일이 주면 그걸 쓰고, 없는 것만 A안으로 채운다.

    섞어 쓴다는 사실을 숨기지 않는다 — 어느 파라미터가 물리 근거로 묶였고
    어느 것이 임의 배율인지는 결과 해석이 달라지는 지점이다.
    """
    src = {}
    lo, hi = {}, {}
    for k, v in base.items():
        b = (bounds_doc or {}).get('bounds', {}).get(k) or {}
        if b.get('lo') is not None and b.get('hi') is not None:
            lo[k], hi[k], src[k] = float(b['lo']), float(b['hi']), 'B'
        else:
            lo[k], hi[k], src[k] = v / span, v * span, 'A'
    return lo, hi, src


def run_pso(base, scr_list, xr, swarm, iters, span, seed, bounds_doc=None):
    """로그 공간 PSO. (best_ctrl, best_cost, history, keys, movable, src)."""
    rng = np.random.default_rng(seed)
    keys = list(base)
    b = np.array([base[k] for k in keys], dtype=float)
    blo, bhi, src = resolve_bounds(base, span, bounds_doc)

    # 로그 공간 경계. 기준값이 0 이거나 음수면 탐색할 수 없다 — 그대로 둔다.
    movable = b > 0
    lo = np.array([math.log(max(blo[k], 1e-12)) if movable[i] else 0.0
                   for i, k in enumerate(keys)])
    hi = np.array([math.log(max(bhi[k], 1e-12)) if movable[i] else 0.0
                   for i, k in enumerate(keys)])

    X = rng.uniform(lo, hi, size=(swarm, len(keys)))
    # 기준값을 한 입자로. 단 B 범위 밖이면 경계로 접는다 — 밖에서 시작하면
    # 그 입자가 범위를 벗어난 채 최적해로 뽑힐 수 있다.
    X[0] = np.clip(np.where(movable, np.log(np.maximum(b, 1e-12)), 0.0), lo, hi)
    V = rng.uniform(-1, 1, size=X.shape) * (hi - lo) * 0.1

    def ctrl_of(row):
        v = np.where(movable, np.exp(row), b)
        return {k: float(v[i]) for i, k in enumerate(keys)}

    P = X.copy()
    pcost = np.array([evaluate(ctrl_of(x), scr_list, xr)[0] for x in X])
    g = int(np.argmin(pcost))
    G, gcost = P[g].copy(), float(pcost[g])

    history = [{'iter': 0, 'best_cost': gcost,
                'feasible': int(np.sum(pcost < 0))}]

    for it in range(1, iters + 1):
        r1 = rng.random(X.shape)
        r2 = rng.random(X.shape)
        V = W * V + C1 * r1 * (P - X) + C2 * r2 * (G - X)
        # 속도를 범위의 20% 로 묶는다. 안 묶으면 경계를 튕겨 다니며 수렴하지 않는다.
        vmax = (hi - lo) * 0.2
        V = np.clip(V, -vmax, vmax)
        X = np.clip(X + V, lo, hi)

        for i in range(swarm):
            c, _ = evaluate(ctrl_of(X[i]), scr_list, xr)
            if c < pcost[i]:
                pcost[i], P[i] = c, X[i].copy()
                if c < gcost:
                    gcost, G = c, X[i].copy()
        history.append({'iter': it, 'best_cost': float(gcost),
                        'feasible': int(np.sum(pcost < 0))})

    return ctrl_of(G), float(gcost), history, keys, movable, src


def sensitivity(best_ctrl, keys, movable, scr_list, xr, span, n=9):
    """best 주변에서 한 번에 하나씩 흔든다 (OAT).

    군집 통계가 아니라 OAT 를 쓰는 이유 — 군집 분포는 '탐색이 어디를 훑었나'
    를 말할 뿐이고, '이 값을 바꾸면 F 가 얼마나 변하나' 를 말하지 않는다.
    B안에 필요한 것은 후자다.
    """
    out = []
    f0, _ = evaluate(best_ctrl, scr_list, xr)
    for i, k in enumerate(keys):
        if not movable[i]:
            out.append({'param': k, 'movable': False})
            continue
        base = best_ctrl[k]
        costs = []
        for m in np.geomspace(1 / span, span, n):
            c = dict(best_ctrl)
            c[k] = base * float(m)
            costs.append(evaluate(c, scr_list, xr)[0])
        fin = [c for c in costs if c < 1e3]          # 벌점 구간은 범위 밖이다
        out.append({
            'param': k, 'movable': True, 'base': float(base),
            'f0': float(f0),
            'f_min': float(min(fin)) if fin else None,
            'f_max': float(max(fin)) if fin else None,
            # dF — 범위 안에서 F 가 움직인 폭. 클수록 범위를 신중히 정해야 한다.
            'dF': float(max(fin) - min(fin)) if len(fin) > 1 else 0.0,
            'n_penalty': int(len(costs) - len(fin)),   # 몇 점이 불안정/미수렴이었나
        })
    return out


def main():
    ap = argparse.ArgumentParser(description='14-파라미터 PSO 예비실험 (A안)')
    ap.add_argument('run', nargs='?', default=None, help='결과 폴더 (생략 시 LATEST)')
    ap.add_argument('--swarm', type=int, default=24)
    ap.add_argument('--iters', type=int, default=40)
    ap.add_argument('--span', type=float, default=4.0,
                    help='범위 배율. base/span ~ base*span (기본 4배)')
    ap.add_argument('--seed', type=int, default=0)
    ap.add_argument('--tag', default='A')
    ap.add_argument('--bounds', default=None,
                    help='param_bounds.json (B안). 준 것만 쓰고 나머지는 A안 배율')
    a = ap.parse_args()

    bounds_doc = None
    if a.bounds:
        bp = Path(a.bounds)
        if not bp.is_absolute():
            bp = Path(__file__).resolve().parent / bp
        bounds_doc = json.loads(bp.read_text(encoding='utf-8'))

    run = resolve_run(a.run)
    meta = json.loads((run / 'meta.json').read_text(encoding='utf-8'))
    base = meta['ctrl_params']
    scr_list = [float(s) for s in meta.get('SCR_list') or [3.0, 2.0, 1.5]]
    xr = float(meta.get('XR') or 1.0)

    print(f'  실행 폴더: {run.name}')
    print(f'  파라미터 {len(base)}개 · SCR {scr_list} · X/R {xr}')
    if bounds_doc:
        nb = sum(1 for v in bounds_doc.get('bounds', {}).values()
                 if v.get('lo') is not None)
        print(f'  범위: B안 {nb}개(물리 유도) + 나머지 A안 ÷{a.span:g}~×{a.span:g}')
    else:
        print(f'  범위: 기준값 ÷{a.span:g} ~ ×{a.span:g}  (A안 — 물리 근거 없음)')
    print(f'  입자 {a.swarm} × 반복 {a.iters} = {a.swarm * (a.iters + 1)}회 평가\n')

    f_base, det_base = evaluate(base, scr_list, xr)
    print(f'  기준 파라미터 F = {f_base:+.4f}')

    t0 = time.perf_counter()
    best, gcost, history, keys, movable, src = run_pso(
        base, scr_list, xr, a.swarm, a.iters, a.span, a.seed, bounds_doc)
    dt = time.perf_counter() - t0
    print(f'  PSO     최적 F = {gcost:+.4f}   ({dt:.1f}s)')
    if f_base < 1e3 and gcost < 1e3:
        print(f'  개선폭         {f_base - gcost:+.4f}')

    print('\n  민감도 (OAT) — dF 가 클수록 범위를 신중히 정해야 한다')
    sens = sensitivity(best, keys, movable, scr_list, xr, a.span)
    for s in sorted(sens, key=lambda x: -(x.get('dF') or 0)):
        if not s.get('movable'):
            print(f"    {s['param']:10} 고정")
            continue
        print(f"    {s['param']:10} dF={s['dF']:7.4f}   벌점 {s['n_penalty']}/9")

    _, det_best = evaluate(best, scr_list, xr)
    doc = {
        'mode': 'A-relative',
        'bounds_basis': ('param_bounds.json (B안) + 미확인은 A안 배율' if bounds_doc
                         else f'base/{a.span:g} ~ base*{a.span:g} (log-uniform, 임의 — 물리 근거 없음)'),
        'bounds_source': src,
        'caution': ('이 best 는 설계값이 아니다. 범위에 물리 근거가 없으므로 '
                    '민감도를 읽는 용도로만 쓴다.'),
        'run': run.name,
        'model_version': meta.get('model_version'),
        'SCR_list': scr_list, 'XR': xr,
        'swarm': a.swarm, 'iters': a.iters, 'span': a.span, 'seed': a.seed,
        'base': base, 'base_cost': f_base, 'base_detail': det_base,
        'best': {'cost': gcost, 'ctrl': best, 'detail': det_best},
        'history': history,
        'sensitivity': sens,
        'timestamp': datetime.now().isoformat(timespec='seconds'),
    }
    out = run / f'pso_{a.tag}.json'
    out.write_text(json.dumps(doc, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'\n  저장: results/{run.name}/{out.name}')


if __name__ == '__main__':
    main()
