"""
experiment.py — 실험 에이전트

목표를 받아 조건을 정하고, 스윕을 돌리고, 결과를 읽어 다음 조건을 정한다.

도구를 4개로 묶었다. 작은 로컬 모델은 선택지가 많을수록 엉뚱한 도구를
고르거나 인수를 빠뜨린다. 읽기 도구 넷을 get_result(kind) 하나로 합치면
모델이 고를 것은 "읽을까 돌릴까"뿐이 된다.

실행:
    python agent/experiment.py --dry                    도구 목록만
    python agent/experiment.py "SCR 1.5 근처 임계값 이상을 규명하라"
    python agent/experiment.py --model qwen3:14b "..."
    python agent/experiment.py --auto "..."             승인 없이

조연호 · 연세대 스마트그리드 연구실
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from core import Agent, Ollama, Registry, check_ollama, run_script  # noqa: E402, DEFAULT_MODEL

ROOT = Path(__file__).resolve().parent.parent
SIM = 'Simulation'
RESULTS = ROOT / 'results'

# 안전 한계. 모델이 터무니없는 조건으로 계산 시간을 태우는 것을 막는다.
SCR_MIN, SCR_MAX, SCR_MAXN = 0.5, 6.0, 12
XR_MIN, XR_MAX = 0.2, 10.0

reg = Registry()

KINDS = {
    'stability':     ('eigenvalue_results.json',         'runner.py'),
    'participation': ('participation_factors.json',      'pf_export.py'),
    'sync':          ('sync_reduction.json',             'sync_reduce.py'),
    'linearization': ('linearization_validity_{i}.json', 'xval.py'),
}


def _run_dir(run=None):
    if run:
        d = RESULTS / run
        return d if d.is_dir() else None
    p = RESULTS / 'LATEST.json'
    if not p.exists():
        return None
    d = RESULTS / json.loads(p.read_text(encoding='utf-8'))['run_name']
    return d if d.is_dir() else None


def _read(d, name):
    f = d / name
    return json.loads(f.read_text(encoding='utf-8')) if f.exists() else None


# ══════════════════════════════════════════════
# 1. 결과 읽기 — 네 종류를 하나로
# ══════════════════════════════════════════════
@reg.tool(
    'get_result',
    '계산된 결과를 읽는다. kind 로 종류를 고른다.\n'
    '  stability     SCR별 감쇠율·정착시간·여유(score)·임계 모드\n'
    '  participation 동기화 모드의 델타·오메가 참여도, 실수극 여부\n'
    '  sync          동기화계수 K_eff, 시간척도 분리비 SEP\n'
    '  linearization 선형화 유효 범위와 회귀 지수',
    {'kind': {'type': 'string',
              'enum': ['stability', 'participation', 'sync', 'linearization']},
     'input': {'type': 'string',
               'description': 'linearization 일 때만. Pref 또는 Vg. 기본 Pref'},
     'run': {'type': 'string', 'description': '결과 폴더명. 생략하면 최근 실행'}},
    ['kind'])
def get_result(kind, input='Pref', run=None):
    if kind not in KINDS:
        return {'error': f'kind 는 {list(KINDS)} 중 하나'}
    d = _run_dir(run)
    if d is None:
        return {'error': '결과 폴더가 없다. run_sweep 을 먼저 실행하라.'}

    fname, script = KINDS[kind]
    j = _read(d, fname.format(i=input))
    if j is None:
        return {'error': f'{kind} 결과가 없다. run_analysis 로 생성하라 ({script}).'}

    if kind == 'stability':
        rows = [{'scr': float(k), 'sigma': v.get('sigma_min'), 't_s': v.get('t_s_max'),
                 'score': v.get('score'), 'binding': v.get('binding'),
                 'crit_state': v.get('crit_state'), 'oscillatory': v.get('crit_osc'),
                 'delta_deg': v.get('delta_deg')}
                for k, v in j.items()
                if isinstance(v, dict) and v.get('converged') is not False]
    elif kind == 'participation':
        rows = [{'scr': float(k), 'p_delta': v['p_delta'], 'p_omega': v['p_omega'],
                 'p_sum': v['p_sum'], 'sigma': v['sync_mode']['sigma'],
                 'oscillatory': v['sync_mode']['oscillatory']}
                for k, v in j['by_SCR'].items()]
    elif kind == 'sync':
        rows = [{'scr': float(k), 'K_eff': v['K_eff'], 'sep': v['sep_ratio'],
                 'sep_ok': v['sep_ok'], 'lambda_slow': v['lambda_slow'],
                 'lambda_fast': v['lambda_fast'], 'trace_pair': v['trace_pair'],
                 'p_Pf_fast': v['p_Pf_fast']}
                for k, v in j['by_SCR'].items()]
    else:
        rows = [{'scr': float(k),
                 'threshold': v.get('threshold_fit') or v['threshold_ratio'],
                 'exponent': (v.get('fit') or {}).get('exponent'),
                 'r2': (v.get('fit') or {}).get('r2'),
                 'dc_err_delta': v.get('dc_gain_error_delta')}
                for k, v in j['by_SCR'].items()]

    rows.sort(key=lambda r: -r['scr'])
    out = {'kind': kind, 'run': d.name, 'rows': rows}
    if kind == 'linearization':
        out['tol'] = j.get('tol')
        out['input'] = j.get('input')
    return out


# ══════════════════════════════════════════════
# 2. 스윕 실행
# ══════════════════════════════════════════════
@reg.tool(
    'run_sweep',
    '지정한 SCR 목록과 X/R 로 야코비안 스윕을 실행한다. '
    '이미 계산된 점은 자동으로 건너뛴다. 수 초에서 수 분 걸린다.',
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

    args = ['--SCR', *scr_list, '--XR', xr] + (['--tag', tag] if tag else [])
    r = run_script(ROOT, f'{SIM}/runner.py', args)
    return ({'ok': True, 'output': r['stdout'][-2500:]} if r['ok']
            else {'ok': False, 'error': r['stderr'][-600:]})


# ══════════════════════════════════════════════
# 3. 보조 해석
# ══════════════════════════════════════════════
@reg.tool(
    'run_analysis',
    '보조 해석을 실행한다. 최근 스윕 결과를 대상으로 한다.\n'
    '  participation 참여계수 (빠름)\n'
    '  sync          Schur 축소 K_eff (빠름)\n'
    '  linearization 선형화 유효범위 (수 분 소요)',
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
        return {'error': 'kind 는 participation, sync, linearization 중 하나'}
    return ({'ok': True, 'output': r['stdout'][-2500:]} if r['ok']
            else {'ok': False, 'error': r['stderr'][-600:]})


# ══════════════════════════════════════════════
# 4. 실행 목록
# ══════════════════════════════════════════════
@reg.tool(
    'list_runs',
    '지금까지의 실행 폴더와 계산된 조건을 돌려준다. '
    '같은 조건을 다시 계산하지 않으려면 먼저 이것을 확인하라.',
    {}, [])
def list_runs():
    if not RESULTS.is_dir():
        return {'runs': []}
    out = []
    for d in sorted(RESULTS.iterdir()):
        if not d.is_dir():
            continue
        m = _read(d, 'meta.json') or {}
        out.append({'run': d.name, 'scr': m.get('SCR_values'),
                    'xr': m.get('XR_values'), 'n_points': m.get('n_points'),
                    'has': [k for k, (f, _) in KINDS.items()
                            if (d / f.format(i='Pref')).exists()]})
    return {'runs': out}


# ══════════════════════════════════════════════
SYSTEM = """너는 전력전자 소신호 해석 실험을 수행하는 조수다.

대상
  2단 PV+ESS 그리드포밍 인버터, 22차 소신호 모델.
  단락비 SCR 이 낮을수록 계통이 약하고 불안정해진다.

판정
  score = min(sigma/sigma_ref, zeta/zeta_floor). 1.0 이상이면 요구를 만족한다.
  sigma 는 감쇠율이며 정착시간 t_s = 4/sigma 다.
  임계 모드는 전력각(delta)이 지배하는 실수극이다. 감쇠비로는 잡히지 않는다.

작업 순서
  1. list_runs 로 무엇이 이미 계산됐는지 본다.
  2. get_result 로 기존 결과를 읽는다. 있는 것을 다시 계산하지 않는다.
  3. 새 조건이 필요할 때만 run_sweep 을 부른다.
  4. 3~5회 안에 결론을 낸다. 같은 호출을 반복하지 않는다.
  5. 결론은 한국어로, 근거 수치와 함께 제시한다.

판단 지침
  결과가 예상과 다르면 물리보다 지표와 조건을 먼저 의심하라.
  이 프로젝트에서 이상 현상으로 보였던 것 대부분이 지표 결함이었다.
  SEP 가 3 미만이면 K_eff 를 신뢰하지 마라.
  커플링 효과가 0 에 가까우면 행렬이 블록삼각으로 퇴화한 것이다.
"""


def main():
    ap = argparse.ArgumentParser(description='실험 에이전트')
    ap.add_argument('goal', nargs='*')
    ap.add_argument('--model', default=DEFAULT_MODEL)
    ap.add_argument('--steps', type=int, default=10)
    ap.add_argument('--timeout', type=int, default=900,
                    help='LLM 응답 대기 초. CPU 추론이면 넉넉히')
    ap.add_argument('--think', action='store_true',
                    help='추론 과정 생성을 켠다. 느려지지만 판단이 나아질 수 있다')
    ap.add_argument('--auto', action='store_true', help='승인 없이 실행')
    ap.add_argument('--dry', action='store_true', help='도구 목록만 출력')
    args = ap.parse_args()

    if args.dry:
        print(f'  도구 {len(reg.names())}개\n')
        for n in reg.names():
            t = reg.get(n)
            print(f'  {n}{"  [승인 필요]" if t.mutates else ""}')
            for line in t.desc.splitlines():
                print(f'    {line}')
            for k, v in t.params.items():
                req = '*' if k in t.required else ' '
                print(f'      {req}{k:<10} {v.get("description", v.get("type"))}')
            print()
        return

    if not args.goal:
        ap.error('목표를 입력하세요')

    ok, msg = check_ollama(args.model)
    print(f'  {msg}')
    if not ok:
        sys.exit(1)

    Agent(llm=Ollama(args.model, timeout=args.timeout, think=args.think), reg=reg, system=SYSTEM,
          max_steps=args.steps, auto_approve=args.auto,
          log_dir=ROOT / 'agent' / 'logs').run(' '.join(args.goal))


if __name__ == '__main__':
    main()