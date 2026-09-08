"""
experiment.py — 실험 에이전트

목표를 받아 조건을 정하고, 스윕을 돌리고, 결과를 읽어 다음 조건을 정한다.
지금까지 사람이 하던 판단을 대신한다.

    "SCR 1.5 근처에서 임계값이 튄다"
      → 격자를 1.7~1.3으로 좁혀 재실행
      → 결과 확인
      → 여전히 이상하면 섭동 범위를 넓혀 재실행
      → 결론

실행:
    python agent/experiment.py "SCR 1.5 근처 선형화 임계값 이상을 규명하라"
    python agent/experiment.py --model qwen3-coder:32b "..."
    python agent/experiment.py --auto "..."        # 승인 없이 (무인)
    python agent/experiment.py --dry "..."         # 도구 목록만 확인

조연호 · 연세대 스마트그리드 연구실
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from core import Agent, Ollama, Registry, Tool, check_ollama, run_script  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
SIM = 'Simulation'
RESULTS = ROOT / 'results'

# 안전 한계. 모델이 터무니없는 조건을 요구해 계산 시간을 태우는 것을 막는다.
SCR_MIN, SCR_MAX, SCR_MAXN = 0.5, 6.0, 12
XR_MIN, XR_MAX = 0.2, 10.0

reg = Registry()


# ══════════════════════════════════════════════
# 결과 읽기
# ══════════════════════════════════════════════
def _latest_dir():
    p = RESULTS / 'LATEST.json'
    if not p.exists():
        return None
    d = RESULTS / json.loads(p.read_text(encoding='utf-8'))['run_name']
    return d if d.is_dir() else None


def _load(name, run=None):
    d = (RESULTS / run) if run else _latest_dir()
    if d is None:
        return None, '결과 폴더가 없다. 먼저 run_sweep 을 실행하라.'
    f = d / name
    if not f.exists():
        return None, f'{name} 없음 (폴더 {d.name})'
    return json.loads(f.read_text(encoding='utf-8')), d.name


# ══════════════════════════════════════════════
# 도구
# ══════════════════════════════════════════════
@reg.tool(
    'run_sweep',
    '지정한 SCR 목록과 X/R 로 야코비안 스윕을 실행한다. '
    '결과는 results/ 에 저장되고 이후 get_* 도구로 읽는다. '
    '이미 계산된 점은 자동으로 건너뛴다.',
    {'scr_list': {'type': 'array', 'items': {'type': 'number'},
                  'description': f'단락비 목록. {SCR_MIN}~{SCR_MAX}, 최대 {SCR_MAXN}개'},
     'xr': {'type': 'number', 'description': 'X/R 비. 기본 1.0'},
     'tag': {'type': 'string', 'description': '실행 구분용 짧은 이름'}},
    ['scr_list'], mutates=True)
def run_sweep(scr_list, xr=1.0, tag=''):
    if not scr_list:
        return {'error': 'scr_list 가 비었다'}
    if len(scr_list) > SCR_MAXN:
        return {'error': f'한 번에 {SCR_MAXN}개까지. 나눠서 실행하라.'}
    bad = [s for s in scr_list if not (SCR_MIN <= s <= SCR_MAX)]
    if bad:
        return {'error': f'허용 범위 밖 SCR: {bad} ({SCR_MIN}~{SCR_MAX})'}
    if not (XR_MIN <= xr <= XR_MAX):
        return {'error': f'X/R 은 {XR_MIN}~{XR_MAX}'}

    args = ['--SCR', *scr_list, '--XR', xr]
    if tag:
        args += ['--tag', tag]
    r = run_script(ROOT, f'{SIM}/runner.py', args)
    if not r['ok']:
        return {'ok': False, 'error': r['stderr'][-600:]}
    return {'ok': True, 'output': r['stdout'][-2500:]}


@reg.tool(
    'get_stability',
    '최근 스윕의 안정도 지표를 읽는다. SCR 별 감쇠율, 정착시간, 여유(score), '
    '구속 조건, 임계 모드의 지배 상태를 돌려준다.',
    {'run': {'type': 'string', 'description': '결과 폴더명. 생략하면 최근 실행'}},
    [])
def get_stability(run=None):
    j, src = _load('eigenvalue_results.json', run)
    if j is None:
        return {'error': src}
    rows = [{'scr': float(k), 'sigma': v.get('sigma_min'), 't_s': v.get('t_s_max'),
             'score': v.get('score'), 'binding': v.get('binding'),
             'crit_state': v.get('crit_state'), 'oscillatory': v.get('crit_osc'),
             'delta_deg': v.get('delta_deg'), 'fd_error': v.get('fd_rel_error')}
            for k, v in j.items() if isinstance(v, dict) and v.get('converged') is not False]
    rows.sort(key=lambda r: -r['scr'])
    return {'run': src, 'n': len(rows), 'rows': rows}


@reg.tool(
    'get_participation',
    '참여계수 분석 결과를 읽는다. 동기화 모드의 δ·Δω 참여도와 실수극 여부를 '
    '돌려준다. 임계 모드가 정말 동기화 모드인지 확인할 때 쓴다.',
    {'run': {'type': 'string'}}, [])
def get_participation(run=None):
    j, src = _load('participation_factors.json', run)
    if j is None:
        return {'error': src + '  pf_export.py 를 실행해야 생성된다.'}
    rows = [{'scr': float(k), 'p_delta': v['p_delta'], 'p_omega': v['p_omega'],
             'p_sum': v['p_sum'], 'sigma': v['sync_mode']['sigma'],
             'oscillatory': v['sync_mode']['oscillatory']}
            for k, v in j['by_SCR'].items()]
    rows.sort(key=lambda r: -r['scr'])
    return {'run': src, 'rows': rows}


@reg.tool(
    'get_sync_reduction',
    'Schur 축소로 뽑은 동기화계수 K_eff 와 시간척도 분리비(SEP)를 읽는다. '
    'SEP 가 3 미만이면 준정상 소거 가정이 약해 K_eff 를 신뢰할 수 없다.',
    {'run': {'type': 'string'}}, [])
def get_sync_reduction(run=None):
    j, src = _load('sync_reduction.json', run)
    if j is None:
        return {'error': src + '  sync_reduce.py 를 실행해야 생성된다.'}
    rows = [{'scr': float(k), 'K_eff': v['K_eff'], 'sep': v['sep_ratio'],
             'sep_ok': v['sep_ok'], 'lambda_slow': v['lambda_slow'],
             'lambda_fast': v['lambda_fast'], 'trace_pair': v['trace_pair'],
             'p_Pf_fast': v['p_Pf_fast']}
            for k, v in j['by_SCR'].items()]
    rows.sort(key=lambda r: -r['scr'])
    return {'run': src, 'J': j.get('J'), 'Dp': j.get('Dp'), 'rows': rows}


@reg.tool(
    'get_linearization',
    '선형화 유효 범위를 읽는다. SCR 별 유효 섭동 크기와 회귀 지수를 돌려준다. '
    '지수가 2 에 가까우면 오차가 섭동 크기의 제곱에 비례한다는 뜻이다.',
    {'input': {'type': 'string', 'description': '섭동 입력. Pref 또는 Vg'},
     'run': {'type': 'string'}}, [])
def get_linearization(input='Pref', run=None):
    j, src = _load(f'linearization_validity_{input}.json', run)
    if j is None:
        return {'error': src + f'  xval.py --input {input} 을 실행해야 생성된다.'}
    rows = [{'scr': float(k), 'T': v['T'],
             'threshold': v.get('threshold_fit') or v['threshold_ratio'],
             'exponent': (v.get('fit') or {}).get('exponent'),
             'r2': (v.get('fit') or {}).get('r2'),
             'dc_err_delta': v.get('dc_gain_error_delta')}
            for k, v in j['by_SCR'].items()]
    rows.sort(key=lambda r: -r['scr'])
    return {'run': src, 'input': j['input'], 'tol': j['tol'], 'rows': rows}


@reg.tool(
    'run_analysis',
    '보조 해석을 실행한다. participation 은 참여계수, sync 는 Schur 축소, '
    'linearization 은 선형화 유효범위를 계산한다. 계산에 수 분이 걸린다.',
    {'kind': {'type': 'string', 'enum': ['participation', 'sync', 'linearization']},
     'input': {'type': 'string', 'description': 'linearization 일 때 섭동 입력'}},
    ['kind'], mutates=True)
def run_analysis(kind, input='Pref'):
    if kind == 'participation':
        r = run_script(ROOT, f'{SIM}/pf_export.py', [])
    elif kind == 'sync':
        r = run_script(ROOT, f'{SIM}/sync_reduce.py', [])
    elif kind == 'linearization':
        r = run_script(ROOT, f'{SIM}/xval.py',
                       ['--input', input, '--tol', 0.005,
                        '--steps', 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.3])
    else:
        return {'error': f'모르는 kind: {kind}'}
    if not r['ok']:
        return {'ok': False, 'error': r['stderr'][-600:]}
    return {'ok': True, 'output': r['stdout'][-2500:]}


@reg.tool(
    'list_runs',
    '지금까지의 실행 폴더 목록을 돌려준다. 어떤 조건이 이미 계산됐는지 확인한다.',
    {}, [])
def list_runs():
    if not RESULTS.is_dir():
        return {'runs': []}
    out = []
    for d in sorted(RESULTS.iterdir()):
        if not d.is_dir():
            continue
        m = d / 'meta.json'
        info = {'run': d.name}
        if m.exists():
            j = json.loads(m.read_text(encoding='utf-8'))
            info.update({'scr': j.get('SCR_values'), 'xr': j.get('XR_values'),
                         'n_points': j.get('n_points')})
        out.append(info)
    return {'runs': out}


# ══════════════════════════════════════════════
SYSTEM = f"""너는 전력전자 소신호 해석 실험을 수행하는 조수다.

대상 시스템
  2단 PV+ESS 그리드포밍 인버터. 22차 소신호 모델(DC 8 + AC 14).
  단락비(SCR)가 낮을수록 계통이 약하고 불안정해진다.

판정 기준
  score = min(σ_min/σ_ref, ζ_min/ζ_floor). 1.0 이상이면 요구 충족.
  σ 는 감쇠율(-Re λ)이며 t_s ≈ 4/σ 다.
  임계 모드는 δ(전력각) 지배 실수극이다. 감쇠비로는 포착되지 않는다.

작업 방식
  1. 먼저 기존 결과를 읽어라(get_*). 이미 있는 것을 다시 계산하지 마라.
  2. 새 조건이 필요할 때만 run_sweep 을 호출하라. 계산에 시간이 든다.
  3. 결과가 예상과 다르면 먼저 지표와 조건을 의심하라. 이 프로젝트에서
     "이상한 물리 현상"으로 보였던 것 대부분이 지표 결함이었다.
  4. 3~5회 안에 결론을 내라. 같은 호출을 반복하지 마라.
  5. 결론은 한국어로, 근거 수치를 함께 제시하라.

주의
  · SEP < 3 이면 K_eff 를 신뢰하지 마라.
  · 검산 오차가 1e-6 을 넘으면 모델 쪽을 의심하라.
  · 커플링 효과가 0 에 가까우면 행렬이 블록삼각으로 퇴화한 것이다.

사용 가능한 도구: {', '.join(reg.names())}
"""


def main():
    ap = argparse.ArgumentParser(description='실험 에이전트')
    ap.add_argument('goal', nargs='*', help='목표')
    ap.add_argument('--model', default='qwen3:14b')
    ap.add_argument('--steps', type=int, default=12)
    ap.add_argument('--auto', action='store_true', help='승인 없이 실행')
    ap.add_argument('--dry', action='store_true', help='도구 목록만 출력')
    args = ap.parse_args()

    if args.dry:
        print(f'  도구 {len(reg.names())}개')
        for n in reg.names():
            t = reg.get(n)
            mark = ' [승인 필요]' if t.mutates else ''
            print(f'\n  {n}{mark}')
            print(f'    {t.desc}')
            for k, v in t.params.items():
                req = '*' if k in t.required else ' '
                print(f'      {req}{k:<12} {v.get("description", v.get("type"))}')
        return

    if not args.goal:
        ap.error('목표를 입력하세요')

    ok, msg = check_ollama(args.model)
    print(f'  {msg}')
    if not ok:
        sys.exit(1)

    Agent(llm=Ollama(args.model), reg=reg, system=SYSTEM,
          max_steps=args.steps, auto_approve=args.auto,
          log_dir=ROOT / 'agent' / 'logs').run(' '.join(args.goal))


if __name__ == '__main__':
    main()
