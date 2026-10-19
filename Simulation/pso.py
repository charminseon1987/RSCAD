"""
pso.py — 14-파라미터 PSO 예비실험 (P4)

목적함수는 새로 만들지 않는다. metrics.objective_multi 가 이미 설계돼 있다.

    score   = min(σ_min/SIGMA_REF, ζ_min/ZETA_FLOOR)     한 운전점
    F_multi = min_k score(SCR_k)                          전 운전점

없던 것은 **탐색기와 탐색 범위** 둘뿐이었다. 이 파일이 그 둘을 채운다.

─────────────────────────────────────────────────────────────────────
범위는 두 갈래다 — 어느 쪽으로 돌렸는지가 결과의 의미를 바꾼다
─────────────────────────────────────────────────────────────────────
A안 (--bounds 없이) : 범위를 기준값의 [base/span, base*span] 으로 둔다. 임의로
    고른 값이고 관성 사양·측정 대역·전압 규정 같은 물리 제약을 반영하지 않는다.
    그래서 여기서 나온 best 를 **설계값이라고 부르면 안 된다.** 이 실행의
    산출물은 best 가 아니라 **민감도**다 — 어느 파라미터가 F 를 움직이는지 알면
    B안에서 어디에 공을 들여야 하는지가 정해진다.

B안 (--bounds param_bounds.json) : 범위가 플랜트 상수와 요구사항에서 나온다.
    param_bounds.py 가 만든다. 14개 전부가 유도되면 best 를 설계 후보로 읽을 수
    있지만, 그 전에 param_bounds.json 의 assumptions 를 봐야 한다 — 요구값
    (RoCoF·드룹·전압 규정)은 아직 '미검증' 이다 (가정 A4).

어느 쪽이었는지는 출력 파일의 `mode` 가 말한다: A-relative / B-mixed (n/14
A안) / B-physical. 라벨을 손으로 적지 않는다 — bounds_source 에서 센다.

로그 공간에서 탐색한다. 이득이 0.001 에서 36 까지 네 자릿수에 걸쳐 있어
선형 공간에서는 큰 값이 탐색을 독점한다.

실행:
    python Simulation/pso.py                    # A안, LATEST.json 의 실행
    python Simulation/pso.py results/J0.50_...
    python Simulation/pso.py --swarm 24 --iters 40 --span 4
    python Simulation/pso.py --bounds Simulation/param_bounds.json --tag B14

출력: results/<run>/pso_<tag>.json   (--tag 기본 A)

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


def evaluate(ctrl, points):
    """objective_points 를 감싼다. 터지면 큰 비용으로 바꿔 탐색을 계속한다.

    운전점은 **(SCR, X/R) 쌍 목록**이다. X/R 을 하나로 고정하면 PSO 가 그
    값에 과적합한다 — 2026-10-16 격자에서 30점 중 15점이 불안정했다.
    """
    try:
        cost, detail = MT.objective_points(dict(ctrl), points)
    except Exception:                                    # noqa: BLE001
        return 1e7, {}
    if not np.isfinite(cost):
        return 1e7, {}
    return float(cost), detail


def jkeys(detail):
    """detail 의 키를 JSON 이 받는 문자열로 바꾼다.

    objective_points 는 키를 `(SCR, XR)` 튜플로 준다. json 은 튜플 키를
    거부해서 저장 단계에서 터진다 — 실제로 한 번 터졌고, 그때 PSO 는 이미
    다 돈 뒤였다. 형식은 'SCR@XR' 로 고정한다 (예: '3.0@0.5').
    """
    out = {}
    for k, v in (detail or {}).items():
        out[f'{k[0]:g}@{k[1]:g}' if isinstance(k, tuple) else str(k)] = v
    return out


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


def run_pso(base, points, swarm, iters, span, seed, bounds_doc=None):
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
    pcost = np.array([evaluate(ctrl_of(x), points)[0] for x in X])
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
            c, _ = evaluate(ctrl_of(X[i]), points)
            if c < pcost[i]:
                pcost[i], P[i] = c, X[i].copy()
                if c < gcost:
                    gcost, G = c, X[i].copy()
        history.append({'iter': it, 'best_cost': float(gcost),
                        'feasible': int(np.sum(pcost < 0))})

    return ctrl_of(G), float(gcost), history, keys, movable, src


def sensitivity(best_ctrl, keys, movable, points, span, n=9):
    """best 주변에서 한 번에 하나씩 흔든다 (OAT).

    군집 통계가 아니라 OAT 를 쓰는 이유 — 군집 분포는 '탐색이 어디를 훑었나'
    를 말할 뿐이고, '이 값을 바꾸면 F 가 얼마나 변하나' 를 말하지 않는다.
    B안에 필요한 것은 후자다.
    """
    out = []
    f0, _ = evaluate(best_ctrl, points)
    for i, k in enumerate(keys):
        if not movable[i]:
            out.append({'param': k, 'movable': False})
            continue
        base = best_ctrl[k]
        costs = []
        for m in np.geomspace(1 / span, span, n):
            c = dict(best_ctrl)
            c[k] = base * float(m)
            costs.append(evaluate(c, points)[0])
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
    ap.add_argument('--train-xr', type=float, nargs='+', default=None,
                    metavar='XR',
                    help='학습 격자의 X/R 목록 (기본: meta.json 의 XR 하나). '
                         'SCR 목록과 외적을 이뤄 운전점이 된다')
    ap.add_argument('--bounds', default=None,
                    help='param_bounds.json (B안). 준 것만 쓰고 나머지는 A안 배율')
    a = ap.parse_args()

    bounds_doc = None
    if a.bounds:
        bp = Path(a.bounds)
        if not bp.is_absolute():
            # 상대경로 기준이 두 곳이다 — resolve_run 은 저장소 루트를, 예전
            # 코드는 스크립트 폴더를 썼다. 둘 다 받는다. 한쪽만 받으면
            # 'Simulation/param_bounds.json' 과 'param_bounds.json' 중
            # 하나가 조용히 FileNotFound 로 떨어진다.
            tried = [ROOT / bp, Path(__file__).resolve().parent / bp]
            bp = next((c for c in tried if c.is_file()), None)
            if bp is None:
                raise SystemExit('--bounds 파일을 찾지 못했다:\n  '
                                 + '\n  '.join(str(t) for t in tried))
        bounds_doc = json.loads(bp.read_text(encoding='utf-8'))

    run = resolve_run(a.run)
    meta = json.loads((run / 'meta.json').read_text(encoding='utf-8'))
    base = meta['ctrl_params']
    scr_list = [float(s) for s in meta.get('SCR_list') or [3.0, 2.0, 1.5]]
    xr = float(meta.get('XR') or 1.0)

    print(f'  실행 폴더: {run.name}')
    # 학습 격자 — PSO 가 보는 운전점. 검증 격자(robust_map.py, 30점)와
    # 분리한다. 평가비용이 점수에 비례하므로 둘을 같게 두면 PSO 가 느려진다
    # (schedule.yaml P4-A3 의 note 가 경고한 것).
    train_xr = a.train_xr if a.train_xr else [xr]
    points = [(s_, x_) for x_ in train_xr for s_ in scr_list]
    print(f'  파라미터 {len(base)}개 · SCR {scr_list} · X/R {train_xr}'
          f' = 학습 {len(points)}점')
    if len(train_xr) == 1:
        print('  ⚠ X/R 이 한 값이다 — 그 값에 과적합한다. --train-xr 로 넓혀라.')
    if bounds_doc:
        # 유도된 개수가 아니라 **실제로 B 를 받은 개수**를 센다. bounds 파일에
        # 있어도 base 에 없는 키는 쓰이지 않으므로 둘이 어긋날 수 있다.
        nb = sum(1 for v in bounds_doc.get('bounds', {}).values()
                 if v.get('lo') is not None)
        print(f'  범위: B안 {nb}/{len(base)}개 물리 유도'
              + (f' + 나머지 A안 ÷{a.span:g}~×{a.span:g}' if nb < len(base) else ''))
    else:
        print(f'  범위: 기준값 ÷{a.span:g} ~ ×{a.span:g}  (A안 — 물리 근거 없음)')
    print(f'  입자 {a.swarm} × 반복 {a.iters} = {a.swarm * (a.iters + 1)}회 평가\n')

    f_base, det_base = evaluate(base, points)
    print(f'  기준 파라미터 F = {f_base:+.4f}')

    t0 = time.perf_counter()
    best, gcost, history, keys, movable, src = run_pso(
        base, points, a.swarm, a.iters, a.span, a.seed, bounds_doc)
    dt = time.perf_counter() - t0
    print(f'  PSO     최적 F = {gcost:+.4f}   ({dt:.1f}s)')
    if f_base < 1e3 and gcost < 1e3:
        print(f'  개선폭         {f_base - gcost:+.4f}')

    print('\n  민감도 (OAT) — dF 가 클수록 범위를 신중히 정해야 한다')
    sens = sensitivity(best, keys, movable, points, a.span)
    for s in sorted(sens, key=lambda x: -(x.get('dF') or 0)):
        if not s.get('movable'):
            print(f"    {s['param']:10} 고정")
            continue
        print(f"    {s['param']:10} dF={s['dF']:7.4f}   벌점 {s['n_penalty']}/9")

    _, det_best = evaluate(best, points)
    # 섞임 정도를 라벨이 말한다. 'A-relative' 를 박아 두면 B 범위로 돌린 파일도
    # A 로 기록돼, 나중에 그 best 를 설계값으로 읽을 위험이 생긴다.
    n_a = sum(1 for s in src.values() if s == 'A')
    mode = ('A-relative' if n_a == len(src) else
            'B-physical' if n_a == 0 else f'B-mixed ({n_a}/{len(src)} A안)')
    doc = {
        'mode': mode,
        'bounds_basis': (
            (f'param_bounds.json (B안) — {len(src) - n_a}/{len(src)} 유도'
             + (f', 나머지 {n_a}개는 A안 배율' if n_a else '')) if bounds_doc
            else f'base/{a.span:g} ~ base*{a.span:g} (log-uniform, 임의 — 물리 근거 없음)'),
        'bounds_source': src,
        'caution': ('범위 전부가 물리 근거에서 왔다. 그래도 best 를 설계값으로 '
                    '쓰기 전에 param_bounds.json 의 assumptions — 특히 A4(요구값 '
                    '미검증) — 를 확인해야 한다.' if n_a == 0 else
                    '이 best 는 설계값이 아니다. 범위 일부에 물리 근거가 없으므로 '
                    '민감도를 읽는 용도로만 쓴다.'),
        'run': run.name,
        'model_version': meta.get('model_version'),
        'SCR_list': scr_list, 'XR': xr,
        'train_points': [[s_, x_] for s_, x_ in points],
        'train_xr': list(train_xr),
        'swarm': a.swarm, 'iters': a.iters, 'span': a.span, 'seed': a.seed,
        'base': base, 'base_cost': f_base, 'base_detail': jkeys(det_base),
        'best': {'cost': gcost, 'ctrl': best, 'detail': jkeys(det_best)},
        'history': history,
        'sensitivity': sens,
        'timestamp': datetime.now().isoformat(timespec='seconds'),
    }
    out = run / f'pso_{a.tag}.json'
    out.write_text(json.dumps(doc, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'\n  저장: results/{run.name}/{out.name}')


if __name__ == '__main__':
    main()
