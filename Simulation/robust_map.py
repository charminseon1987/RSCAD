"""
robust_map.py — SCR × X/R 강건성 경계 지도 (P4 → P7)

PSO 는 **한 점에서** 조정했다. Category III 기준선(`pso_C3s3.json`)은
X/R = 1.0, SCR [3.0, 2.0, 1.5] 에서 나온 이득이다. 그 이득이 **다른 계통에서도
기준을 지키는가** 는 아직 재지 않았다. 이 파일이 그걸 격자로 쓴다.

    조정한 한 점  →  (SCR, X/R) 격자 전체  →  score ≥ 1 인 영역 = 강건성 경계

─────────────────────────────────────────────────────────────────────
왜 이게 논문의 그림이 되나
─────────────────────────────────────────────────────────────────────
NEXT.md §0 이 신규성 주장을 두 번 좁혔다. 남은 것은 **"낮은 X/R 영역에서,
PSO 로 조정한 이득과 함께 본 강건성 경계"** 다. 그러면 보여야 하는 것은
점 하나의 score 가 아니라 **경계가 어디로 움직이는가** 다.

그래서 이 도구는 **두 벌을 같은 격자에 올린다.**
  기준 이득  (meta.json 의 ctrl_params)
  조정 이득  (pso_*.json 의 best.ctrl)
둘의 통과 영역 차이가 "PSO 가 경계를 얼마나 넓혔나" 다. 한 벌만 그리면
그 질문에 답할 수 없다.

─────────────────────────────────────────────────────────────────────
읽을 때 주의
─────────────────────────────────────────────────────────────────────
· 이 격자는 **모델(22차 고유값)** 이다. SIL·RTDS 교차검증은 A9 가 따로 한다.
· `objective_multi` 는 SCR 들의 **최솟값**을 돌려주므로 점별 값은 `detail`
  에서 꺼낸다 — min 을 점 하나로 착각하면 안 된다.
· 수렴 실패·불안정은 **숨기지 않는다.** 표에서 각각 다른 기호로 찍고
  JSON 에 사유를 남긴다. 비어 있는 칸과 떨어진 칸은 다르다.
· 조정 이득이 **조정한 점에서조차** 미달이면 그 사실이 먼저 보여야 한다.
  격자를 넓혀 가리지 않는다.

실행:
    python Simulation/robust_map.py                          # LATEST + Cat III best
    python Simulation/robust_map.py --best pso_C3s3.json
    python Simulation/robust_map.py --scr 3 2.5 2 1.5 1 --xr 5 3 2 1.5 1 0.5
    python Simulation/robust_map.py --tag wide --base-only

출력: results/<run>/robust_map_<tag>.json

조연호 · 연세대 스마트그리드 연구실
"""

import console_utf8  # noqa: F401
import argparse
import json
import time
from datetime import datetime
from pathlib import Path

import metrics as MT
import pso

ROOT = Path(__file__).resolve().parent.parent

# metrics.objective_multi 가 구분해 넣는 실패 모양을 그대로 보존한다.
# 세 가지는 원인이 다르다 — 뭉개면 "경계가 왜 거기서 끊겼나" 를 못 읽는다.
#   converged=False      조류계산이 안 선다 (운전점 자체가 없다)
#   modes=False          선형화는 됐는데 모드 식별 실패
#   stable=False         운전점은 있고 불안정하다
PASS, FAIL = '●', '○'          # score ≥ 1 / 미달
UNSTABLE = '✕'                 # 불안정
NOOP, NOMODE = '·', '?'        # 운전점 없음 / 모드 식별 실패


def eval_row(ctrl, scr_list, xr):
    """X/R 한 값에서 SCR 들을 한 번에 본다.

    objective_multi 는 min 을 주지만 detail 에 점별 값이 들어 있다.
    여기서는 detail 만 쓴다 — min 은 호출자가 따로 낸다.
    """
    try:
        _, detail = MT.objective_multi(dict(ctrl), scr_list, XR=xr)
    except Exception as e:                                   # noqa: BLE001
        return {float(s): {'error': f'{type(e).__name__}: {e}'} for s in scr_list}
    # metrics 는 detail 키를 **float** 으로 넣는다 (metrics.py:204 `detail[SCR]`).
    # pso_*.json 에서 '3.0' 처럼 보이는 것은 JSON 직렬화가 바꾼 것이지
    # 메모리상의 키가 아니다 — 문자열로 찾으면 전부 못 찾는다.
    out = {}
    for s in scr_list:
        d = (detail or {}).get(float(s)) or (detail or {}).get(str(float(s)))
        out[float(s)] = d or {'error': f'detail 에 SCR {s:g} 가 없다'}
    return out


def classify(d):
    """점 하나의 기호와 상태. 비어 있는 칸과 떨어진 칸을 가른다."""
    if not d or d.get('error'):
        return NOMODE, 'error'
    if not d.get('converged', False):
        return NOOP, 'nonconverged'         # 조류계산 실패 — 운전점이 없다
    if d.get('modes') is False:
        return NOMODE, 'no_modes'           # 선형화는 됐는데 모드 식별 실패
    if not d.get('stable', False):
        return UNSTABLE, 'unstable'
    sc = d.get('score')
    if sc is None:
        return NOMODE, 'no_score'
    return (PASS if sc >= 1.0 else FAIL), ('pass' if sc >= 1.0 else 'fail')


def sweep(name, ctrl, scr_list, xr_list):
    pts, t0 = [], time.time()
    for xr in xr_list:
        row = eval_row(ctrl, scr_list, xr)
        for s in scr_list:
            d = row[float(s)] or {}
            _, st = classify(d)
            pts.append({'SCR': float(s), 'XR': float(xr), 'state': st,
                        'score': d.get('score'), 'sigma_min': d.get('sigma_min'),
                        'zeta_min': d.get('zeta_min'), 'binding': d.get('binding'),
                        'error': d.get('error')})
    return {'name': name, 'ctrl': dict(ctrl), 'points': pts,
            'seconds': round(time.time() - t0, 1)}


SYM = {'pass': PASS, 'fail': FAIL, 'unstable': UNSTABLE,
       'nonconverged': NOOP, 'no_modes': NOMODE, 'no_score': NOMODE,
       'error': NOMODE}


def grid_table(case, scr_list, xr_list):
    """격자를 찍는다. X/R 이 행, SCR 이 열 — 약한 계통이 오른쪽으로 간다.

    sweep() 이 이미 분류해 둔 `state` 를 쓴다. 저장된 점에는 `converged`·
    `stable` 이 없으므로 여기서 classify() 를 다시 부르면 전부
    '운전점 없음' 으로 찍힌다 — 실제로 한 번 그렇게 틀렸다.
    """
    look = {(p['XR'], p['SCR']): p for p in case['points']}
    print(f"\n  [{case['name']}]  ({case['seconds']}s)")
    print('      X/R ╲ SCR' + ''.join(f'{s:>9g}' for s in scr_list))
    print('      ' + '-' * (10 + 9 * len(scr_list)))
    for xr in xr_list:
        cells = []
        for s in scr_list:
            p = look.get((float(xr), float(s)))
            sym = SYM.get((p or {}).get('state'), NOMODE)
            cells.append(f'{sym:>9}')
        print(f'      {xr:>7g}  ' + ''.join(cells))
    print('      ' + '-' * (10 + 9 * len(scr_list)) + '   score')
    for xr in xr_list:
        vals = []
        for s in scr_list:
            sc = (look.get((float(xr), float(s))) or {}).get('score')
            vals.append(f'{sc:>9.3f}' if isinstance(sc, (int, float)) else f'{"—":>9}')
        print(f'      {xr:>7g}  ' + ''.join(vals))
    n_pass = sum(1 for p in case['points'] if p['state'] == 'pass')
    print(f"      통과 {n_pass}/{len(case['points'])}")
    return n_pass


def main():
    ap = argparse.ArgumentParser(description='SCR × X/R 강건성 경계')
    ap.add_argument('run', nargs='?', default=None)
    ap.add_argument('--best', default='pso_C3s3.json',
                    help='조정 이득을 꺼낼 pso 결과 파일 (실행 폴더 안)')
    ap.add_argument('--scr', type=float, nargs='+',
                    default=[3.0, 2.5, 2.0, 1.5, 1.0])
    ap.add_argument('--xr', type=float, nargs='+',
                    default=[5.0, 3.0, 2.0, 1.5, 1.0, 0.5])
    ap.add_argument('--tag', default='a')
    ap.add_argument('--base-only', action='store_true', help='기준 이득만')
    a = ap.parse_args()

    run = pso.resolve_run(a.run)
    meta = json.loads((run / 'meta.json').read_text(encoding='utf-8'))
    scr_list = sorted(a.scr, reverse=True)
    xr_list = sorted(a.xr, reverse=True)

    print(f'  실행 폴더: {run.name}')
    print(f'  격자: SCR {scr_list} × X/R {xr_list} = '
          f'{len(scr_list) * len(xr_list)}점')
    print(f"  기호: {PASS} score≥1 · {FAIL} 미달 · {UNSTABLE} 불안정 · "
          f"{NOOP} 운전점없음 · {NOMODE} 모드식별실패")
    print(f'  조정한 점: X/R {meta.get("XR")} · SCR {meta.get("SCR_list")}'
          ' — 이 점 밖은 전부 외삽이다')

    cases = [sweep('기준 이득 (meta.ctrl_params)', meta['ctrl_params'],
                   scr_list, xr_list)]
    if not a.base_only:
        bp = run / a.best
        if not bp.is_file():
            raise SystemExit(f'{bp} 없음 — --best 로 지정하거나 --base-only')
        bd = json.loads(bp.read_text(encoding='utf-8'))
        cases.append(sweep(f'조정 이득 ({a.best}, 조정점 score '
                           f'{-bd["best"]["cost"]:.4f})',
                           bd['best']['ctrl'], scr_list, xr_list))

    passes = [grid_table(c, scr_list, xr_list) for c in cases]

    if len(cases) == 2:
        n = len(cases[0]['points'])
        print(f'\n  통과 영역: 기준 {passes[0]}/{n} → 조정 {passes[1]}/{n}'
              f'  ({passes[1] - passes[0]:+d}점)')
        base = {(p['XR'], p['SCR']): p['state'] for p in cases[0]['points']}
        lost = [(p['XR'], p['SCR']) for p in cases[1]['points']
                if p['state'] != 'pass' and base.get((p['XR'], p['SCR'])) == 'pass']
        if lost:
            print('  ⚠ 조정 때문에 **잃은** 점이 있다 — ' +
                  ', '.join(f'X/R {x:g}·SCR {s:g}' for x, s in lost))
            print('    한 점에서 조정한 이득이 다른 점을 깎는다는 뜻이다.')

    out = run / f'robust_map_{a.tag}.json'
    out.write_text(json.dumps({
        'run': run.name, 'model_version': meta.get('model_version'),
        'tuned_at': {'XR': meta.get('XR'), 'SCR_list': meta.get('SCR_list')},
        'grid': {'SCR': scr_list, 'XR': xr_list},
        'sigma_ref': MT.SIGMA_REF, 'zeta_floor': MT.ZETA_FLOOR,
        'caution': ('모델(22차 고유값) 격자다. SIL·RTDS 교차검증은 별도(A9). '
                    '조정점 밖은 외삽이다.'),
        'cases': cases,
        'timestamp': datetime.now().isoformat(timespec='seconds'),
    }, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'\n  저장: {out.relative_to(ROOT)}')


if __name__ == '__main__':
    main()
