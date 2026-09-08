"""
xval.py - Phase 2 게이트 마무리: 선형화 유효성 검증 + MATLAB export

세 가지를 수행한다.

  1. 선형화 유효성 임계값
     동일한 입력 섭동에 대해
       비선형: dx/dt = f(x,u0+Δu)   (Radau, stiff)
       선형  : dz/dt = A·z + B·Δu
     두 궤적의 상대오차가 허용치를 넘지 않는 최대 섭동 크기를 찾는다.
     → 제안서 Phase 2 산출물 "선형화 유효성 임계값"

  2. MATLAB/Simulink용 .mat export
     A, B, x0, u0, 파라미터, 상태명, 고유값. MATLAB 없이 scipy로 생성.

  3. xval_check.m 자동 생성
     MATLAB에서 고유값을 독립 계산해 대조하는 스크립트.

실행:
  python Simulation/xval.py
  python Simulation/xval.py --tol 0.02 --input Pref --T 0.5

조연호 · 연세대 스마트그리드 연구실
"""

import numpy as np
from scipy import linalg, integrate, io as sio
import json, argparse
from pathlib import Path
from datetime import datetime

import model as M
import op

parser = argparse.ArgumentParser(description='선형화 유효성 검증 + export')
parser.add_argument('--run',   type=str,   default=None,
                    help='결과 폴더명 (생략 시 LATEST.json)')
parser.add_argument('--input', type=str,   default='Pref',
                    choices=M.INPUT_NAMES, help='섭동을 가할 입력')
parser.add_argument('--tol',   type=float, default=0.05, help='허용 상대오차')
parser.add_argument('--T',     type=float, default=0.5,  help='적분 구간 [s]')
parser.add_argument('--steps', type=float, nargs='+',
                    default=[0.001, 0.005, 0.01, 0.02, 0.05, 0.10, 0.20, 0.30],
                    help='입력 섭동 비율 목록')
args = parser.parse_args()

RESULTS_ROOT = Path(__file__).parent.parent / 'results'
if args.run:
    RES_DIR = Path(args.run)
    if not RES_DIR.is_absolute():
        RES_DIR = RESULTS_ROOT / args.run
else:
    ptr = RESULTS_ROOT / 'LATEST.json'
    if not ptr.exists():
        raise SystemExit('❌ LATEST.json 없음 — runner.py를 먼저 실행하세요')
    RES_DIR = RESULTS_ROOT / json.loads(
        ptr.read_text(encoding='utf-8'))['run_name']
if not RES_DIR.is_dir():
    raise SystemExit(f"❌ {RES_DIR} 없음 — runner.py를 먼저 실행하세요")
RUN_NAME = RES_DIR.name

meta = json.loads((RES_DIR / 'meta.json').read_text(encoding='utf-8'))
XR   = meta.get('XR', 1.0)
op.CTRL.update(meta['ctrl_params'])
op.FIXED.update(meta['fixed_params'])
op.INP.update(meta['inputs'])

# 동작점이 0 에 가까운 상태(적분기 등)의 분모 바닥값.
# 이보다 작은 |x0| 는 이 값으로 대체해 0 나눗셈과 과증폭을 막는다.
NOM_FLOOR = 1e-3
# 응답 게이트: 무차원 진폭이 최대의 이 배율 미만인 상태는 판정에서 제외.
# 거의 움직이지 않는 상태가 분모 소멸로 임계값을 지배하는 것을 막는다.
GATE = 0.05

U_IDX = M.INPUT_NAMES.index(args.input)
f_fn, A_fn, B_fn = op.f_fn, op.A_fn, op.B_fn

print("=" * 76)
print(f"  Phase 2 게이트: 선형화 유효성 검증  ({RUN_NAME})")
print(f"  섭동 입력: {args.input} = {op.INP[args.input]}  |  허용오차 {args.tol:.1%}"
      f"  |  T = {args.T}s")
print("=" * 76)


# ══════════════════════════════════════════════
# 궤적 비교
# ══════════════════════════════════════════════
def trajectory_error(x0, A, B, SCR, ratio):
    """섭동 ratio에 대한 비선형 vs 선형 궤적의 최대 상대오차"""
    du = np.zeros(len(M.INPUT_NAMES))
    du[U_IDX] = op.INP[args.input] * ratio

    inp_pert = dict(op.INP)
    inp_pert[args.input] = op.INP[args.input] * (1 + ratio)

    def rhs_nl(t, x):
        saved = dict(op.INP)
        op.INP.update(inp_pert)
        try:
            return np.array(f_fn(*op._args(x, SCR, XR))).ravel()
        finally:
            op.INP.update(saved)

    def rhs_lin(t, z):
        return A @ z + B @ du

    t_eval = np.linspace(0, args.T, 400)
    kw = dict(method='Radau', t_eval=t_eval, rtol=1e-8, atol=1e-10)
    s_nl  = integrate.solve_ivp(rhs_nl,  (0, args.T), x0,               **kw)
    s_lin = integrate.solve_ivp(rhs_lin, (0, args.T), np.zeros(M.N),    **kw)
    if not (s_nl.success and s_lin.success):
        return np.nan, np.nan

    dx_nl  = s_nl.y - x0[:, None]           # 비선형 편차 궤적
    dx_lin = s_lin.y                        # 선형 예측 궤적

    # ── 오차 정규화 ──
    # 상태별 상대오차(|e|/자기진폭)는 물리적으로 옳은 지표지만, 응답이 거의
    # 0 인 상태에서 분모가 소멸해 발산한다. 실제로 i_oq 의 진폭이 SCR 1.4
    # 부근에서 극소가 되어(부호 반전 통과) 임계값에 가짜 골짜기를 만들었다.
    #
    # 반대로 모든 상태를 하나의 척도(최대값·노름)로 묶으면 동작점이 0 인
    # 적분기 상태가 분모를 독점해 오차가 희석된다.
    #
    # → 상태별 상대오차를 유지하되, "실제로 응답한 상태"만 판정에 넣는다.
    #   무차원 진폭이 최대 진폭의 GATE 배에 못 미치는 상태는 제외한다.
    nom  = np.maximum(np.abs(x0), NOM_FLOOR)
    amp  = np.abs(dx_nl).max(axis=1)               # 상태별 궤적 진폭
    rel  = amp / nom                               # 무차원 진폭
    keep = rel >= GATE * rel.max()                 # 응답한 상태만
    if not keep.any():
        return 0.0, 0

    e    = np.abs(dx_nl - dx_lin)[keep]
    err_k = e.max(axis=1) / np.maximum(amp[keep], 1e-30)
    idx  = np.flatnonzero(keep)
    k    = int(np.argmax(err_k))
    return float(err_k[k]), int(idx[k])


# ══════════════════════════════════════════════
# SCR별 임계값 탐색
# ══════════════════════════════════════════════
files = sorted(RES_DIR.glob('A_num_SCR*.npy'),
               key=lambda p: -float(p.stem.replace('A_num_SCR', '')))
if not files:
    raise SystemExit(f'❌ {RES_DIR} 에 A_num_SCR*.npy 없음')
report, export = {}, {}

for fp in files:
    SCR = float(fp.stem.replace('A_num_SCR', ''))
    A   = np.load(fp)
    x0  = np.load(RES_DIR / fp.name.replace('A_num', 'x0'))   # %.2f 규칙 그대로
    B   = np.array(B_fn(*op._args(x0, SCR, XR)), dtype=float)

    print(f"\n── SCR = {SCR} " + "─" * 54)
    print(f"  {'섭동':>8} {'정규화 오차':>13} {'판정':>6}  최악 상태")

    rows, thr = [], 0.0
    for r in args.steps:
        e, k = trajectory_error(x0, A, B, SCR, r)
        ok = (not np.isnan(e)) and e <= args.tol
        if ok:
            thr = r
        worst = M.STATE_NAMES[k] if not np.isnan(e) else '-'
        rows.append({'ratio': r, 'max_rel_error': None if np.isnan(e) else round(e, 5),
                     'pass': bool(ok), 'worst_state': worst})
        es = 'nan' if np.isnan(e) else f"{e:.4f}"
        print(f"  {r:>7.1%} {es:>14} {'✅' if ok else '❌':>5}  {worst}")

    print(f"  → 선형화 유효 임계값: {args.input} 섭동 {thr:.1%} 이내")
    report[SCR] = {'threshold_ratio': thr, 'sweep': rows}

    export[f'SCR{SCR}'.replace('.', 'p')] = {
        'A': A, 'B': B, 'x0': x0,
        'eig': linalg.eigvals(A),
        'SCR': SCR, 'XR': XR,
        'linearization_threshold': thr,
    }

# ══════════════════════════════════════════════
# MATLAB export
# ══════════════════════════════════════════════
mat = {
    'model_version': meta.get('model_version', ''),
    'state_names':   np.array(M.STATE_NAMES, dtype=object),
    'input_names':   np.array(M.INPUT_NAMES, dtype=object),
    'ctrl_params':   {k: float(v) for k, v in op.CTRL.items()},
    'fixed_params':  {k: float(v) for k, v in op.FIXED.items()},
    'inputs':        {k: float(v) for k, v in op.INP.items()},
    'cases':         export,
    'generated':     datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
}
mat_path = RES_DIR / 'gfm_model.mat'
sio.savemat(mat_path, mat, long_field_names=True)

m_script = f"""%% xval_check.m — 자동 생성 ({datetime.now().strftime('%Y-%m-%d %H:%M')})
%  Python(sympy)에서 유도한 야코비안을 MATLAB에서 독립 검산한다.
%  실행: gfm_model.mat 과 같은 폴더에서 xval_check

clear; clc;
S = load('gfm_model.mat');
names = string(S.state_names);
cases = fieldnames(S.cases);

fprintf('모델: %s   상태 %d개\\n', S.model_version, numel(names));
fprintf('%-10s %12s %12s %10s\\n', 'case', 'max Re', '느린 모드', '유효임계');

for i = 1:numel(cases)
    c = S.cases.(cases{{i}});
    e = eig(c.A);
    [~, k] = min(abs(real(e)));          % 원점에 가장 가까운 모드
    fprintf('%-10s %12.4f %12.4f %9.1f%%\\n', ...
        cases{{i}}, max(real(e)), real(e(k)), c.linearization_threshold*100);

    % Python 계산 고유값과 대조
    d = max(abs(sort(e) - sort(c.eig(:))));
    if d > 1e-8
        warning('%s: Python 고유값과 %.2e 차이', cases{{i}}, d);
    end
end

%% 상태공간 객체 생성 (Simulink 연동용)
c   = S.cases.(cases{{1}});
sys = ss(c.A, c.B, eye(numel(names)), 0, ...
         'StateName', cellstr(names), 'InputName', cellstr(string(S.input_names)));
% step(sys);  damp(sys);
"""
(RES_DIR / 'xval_check.m').write_text(m_script, encoding='utf-8')

# ══════════════════════════════════════════════
# 요약
# ══════════════════════════════════════════════
thr_min = min(v['threshold_ratio'] for v in report.values())

print("\n" + "=" * 76)
print("  Phase 2 게이트 산출물")
print("=" * 76)
print(f"  {'SCR':>6} {'선형화 유효 임계값':>20}")
for SCR, v in report.items():
    print(f"  {SCR:>6} {v['threshold_ratio']:>19.1%}")
print(f"\n  ★ 보수적 임계값 (전 SCR 공통): {args.input} 섭동 {thr_min:.1%} 이내")

out = {'run': RUN_NAME, 'input': args.input, 'tol': args.tol, 'T': args.T,
       'timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
       'threshold_common': thr_min,
       'by_SCR': {str(k): v for k, v in report.items()}}
(RES_DIR / 'linearization_validity.json').write_text(
    json.dumps(out, indent=2, ensure_ascii=False), encoding='utf-8')

tbl = "".join(f"| {SCR} | {v['threshold_ratio']:.1%} |\n" for SCR, v in report.items())
md = f"""---
type: result
phase: 2
run: {RUN_NAME}
date: {datetime.now().strftime('%Y-%m-%d %H:%M')}
threshold_input: {args.input}
threshold_common: {thr_min}
tol: {args.tol}
tags: [result, phase2, 선형화유효성, gate]
---

# 선형화 유효성 검증 — {RUN_NAME}

비선형 궤적과 선형 예측 궤적의 최대 상대오차가 **{args.tol:.0%}** 이내인
최대 입력 섭동 크기. 적분 구간 {args.T}s, Radau (stiff).

| SCR | 유효 임계값 ({args.input} 섭동) |
|---|---|
{tbl}
> [!success] Phase 2 게이트 산출물 확정
> **{args.input} 섭동 {thr_min:.1%} 이내에서 소신호 모델 유효** (전 SCR 공통, 보수적 기준)
>
> 이 범위를 넘는 대신호 과도(고장, 탈락)는 소신호 모델의 적용 대상이 아니며,
> Phase 6~7의 CHIL 시나리오 설계 시 섭동 크기를 이 이내로 잡아야 한다.

## 생성 파일

- `gfm_model.mat` — A, B, x0, 고유값, 파라미터 (MATLAB/Simulink용)
- `xval_check.m` — MATLAB 독립 검산 스크립트
- `linearization_validity.json` — 섭동별 오차 원자료

## 🔗 연결 노트

- [[Phase02_완료]]
- [[선형화_유효범위]]
- [[Phase03_참여인자]]
"""
(RES_DIR / 'linearization_validity.md').write_text(md, encoding='utf-8')

print(f"\n  💾 {mat_path.name}  (MATLAB/Simulink)")
print(f"  💾 xval_check.m")
print(f"  💾 linearization_validity.json / .md")
print("=" * 76)