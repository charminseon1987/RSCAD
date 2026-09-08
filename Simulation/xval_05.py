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
parser.add_argument('--T', default='auto',
                    help="적분 구간 [s]. 'auto' 이면 동작점별 5τ×1.5 로 자동 산출")
parser.add_argument('--tau-margin', type=float, default=1.5,
                    help='auto 구간의 5τ 대비 여유 배수')
parser.add_argument('--traj-at', type=float, default=None,
                    help='이 섭동 비율의 시간영역 궤적을 저장 (예: 0.1)')
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

# ══════════════════════════════════════════════
# 정규화 기준
# ══════════════════════════════════════════════
# 분모는 설비 정격(op.nominals)에서 가져온다. 데이터에서 척도를 뽑으면
# 그 값이 0 에 가까워질 때 분모가 소멸해 오차가 발산한다.
#   · i_oq 진폭 극소(SCR 1.4) → 임계값에 가짜 골짜기
#   · dw 동작점 0            → DC 이득 오차 100%
# 제어기 내부 적분기 8개는 물리적 관측량이 아니므로 판정에서 제외한다.
NOM, OBS  = op.nominal_vector()
OBS_NAMES = [n for n, m in zip(M.STATE_NAMES, OBS) if m]


def horizon(A):
    """적분 구간 산출.

    동작점마다 느린 극이 다르므로 고정 구간을 쓰면 SCR 간 비교가 공정하지
    않다. T=0.5s 고정 시 SCR 1.3 의 궤적은 정착의 48% 지점에서 끊겨,
    비선형 왜곡이 나타나기 전에 판정이 끝나 버린다(δ 오차 13.9% → 2초까지
    가면 45.9%). 약계통일수록 5τ 가 길어 '덜 진행 → 덜 틀려 보임' 이라는
    역전까지 발생한다.
    """
    if args.T != 'auto':
        return float(args.T), False
    slow = float(np.max(linalg.eigvals(A).real))
    if slow >= -1e-9:                       # 불안정·중립이면 고정 구간
        return 5.0, True
    return 5.0 / abs(slow) * args.tau_margin, True


def fit_threshold(rows, tol):
    """오차 곡선을 멱함수로 피팅해 허용치를 넘는 섭동 크기를 연속값으로 구한다.

    격자점 중 마지막 통과값을 임계값으로 쓰면 해상도에 갇힌다. 0.1/0.2/0.3
    격자에서는 0.13 과 0.19 가 모두 0.1 로 보고되며, SCR 의존성이 계단으로
    뭉개진다.

    선형화 오차는 테일러 전개의 2차 항이 지배하므로 err ≈ k·r^n (n≈2) 형태다.
    log-log 에서 직선이므로 1차 회귀로 k, n 을 얻고 err = tol 을 역산한다.
    """
    pts = [(r['ratio'], r['max_rel_error']) for r in rows
           if r['max_rel_error'] and r['max_rel_error'] > 0 and r['ratio'] > 0]
    if len(pts) < 3:
        return None, None
    x = np.log(np.array([p[0] for p in pts]))
    y = np.log(np.array([p[1] for p in pts]))
    n, logk = np.polyfit(x, y, 1)
    if n <= 0:
        return None, None
    r_star = float(np.exp((np.log(tol) - logk) / n))
    resid = y - (n * x + logk)
    r2 = 1.0 - resid.var() / y.var() if y.var() > 0 else np.nan
    return r_star, {'exponent': float(n), 'k': float(np.exp(logk)),
                    'r2': float(r2), 'n_points': len(pts)}


def dc_gain_error(A, B, du, x0, s_nl):
    """정상상태 이득 오차.

    선형: Δx_ss = -A⁻¹ B Δu
    비선형: 궤적 종점 (충분히 정착했다는 전제)
    궤적 형상 오차와 별개로, 선형 모델의 DC 이득 자체가 얼마나 틀리는지.
    """
    try:
        ss_lin = -linalg.solve(A, B @ du)
    except linalg.LinAlgError:
        return None
    ss_nl = s_nl.y[:, -1] - x0
    rel   = np.abs(ss_lin - ss_nl)[OBS] / NOM[OBS]        # 정격 대비
    k     = int(np.argmax(rel))
    out = {'rel': float(rel[k]), 'state': OBS_NAMES[k],
           'lin': float(ss_lin[OBS][k]), 'nl': float(ss_nl[OBS][k])}
    # δ 는 동기화 특성을 좌우하므로 항상 함께 보고한다 (정격 1 rad).
    d = M.STATE_NAMES.index('delta')
    out['delta'] = {'rel': float(abs(ss_lin[d] - ss_nl[d])),
                    'lin_deg': float(np.degrees(ss_lin[d])),
                    'nl_deg': float(np.degrees(ss_nl[d]))}
    return out


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
def trajectory_error(x0, A, B, SCR, ratio, T):
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

    t_eval = np.linspace(0, T, 600)
    kw = dict(method='Radau', t_eval=t_eval, rtol=1e-8, atol=1e-10)
    s_nl  = integrate.solve_ivp(rhs_nl,  (0, T), x0,            **kw)
    s_lin = integrate.solve_ivp(rhs_lin, (0, T), np.zeros(M.N), **kw)
    if not (s_nl.success and s_lin.success):
        return np.nan, '-', None, None

    dx_nl  = s_nl.y - x0[:, None]           # 비선형 편차 궤적
    dx_lin = s_lin.y                        # 선형 예측 궤적

    # ── 오차 정규화: 정격 대비 ──
    # 분모가 상수이므로 어떤 상태의 응답이 0 에 가까워져도 발산하지 않는다.
    # 해석도 명확하다 — "정격의 몇 %만큼 틀리는가".
    e  = np.abs(dx_nl - dx_lin)[OBS] / NOM[OBS, None]
    ek = e.max(axis=1)
    k  = int(np.argmax(ek))
    traj = (s_nl.t, s_nl.y, x0[:, None] + dx_lin)   # 시간, 비선형, 선형예측
    return float(ek[k]), OBS_NAMES[k], dc_gain_error(A, B, du, x0, s_nl), traj


# ══════════════════════════════════════════════
# SCR별 임계값 탐색
# ══════════════════════════════════════════════
files = sorted(RES_DIR.glob('A_num_SCR*.npy'),
               key=lambda p: -float(p.stem.replace('A_num_SCR', '')))
if not files:
    raise SystemExit(f'❌ {RES_DIR} 에 A_num_SCR*.npy 없음')
report, export, TRAJ = {}, {}, {}

for fp in files:
    SCR = float(fp.stem.replace('A_num_SCR', ''))
    A   = np.load(fp)
    x0  = np.load(RES_DIR / fp.name.replace('A_num', 'x0'))   # %.2f 규칙 그대로
    B   = np.array(B_fn(*op._args(x0, SCR, XR)), dtype=float)

    T, auto = horizon(A)
    slow = float(np.max(linalg.eigvals(A).real))
    print(f"\n── SCR = {SCR} " + "─" * 54)
    print(f"  느린 극 {slow:+.4f}  →  5τ = {5/abs(slow):.2f}s  |  "
          f"적분 구간 T = {T:.2f}s {'(auto)' if auto else '(고정)'}")
    print(f"  {'섭동':>8} {'정규화 오차':>13} {'판정':>6}  {'최악':>8}  "
          f"{'DC이득오차':>10}  {'상태':>7}")

    rows, thr, dcs = [], 0.0, []
    for r in args.steps:
        e, k, dc, traj = trajectory_error(x0, A, B, SCR, r, T)
        if args.traj_at is not None and abs(r - args.traj_at) < 1e-12 and traj:
            TRAJ[f'{SCR:.2f}'] = traj
        ok = (not np.isnan(e)) and e <= args.tol
        if ok:
            thr = r
        worst = k
        rows.append({'ratio': r, 'max_rel_error': None if np.isnan(e) else round(e, 5),
                     'pass': bool(ok), 'worst_state': worst,
                     'dc_gain_error': None if dc is None else round(dc['rel'], 5),
                     'dc_gain_state': None if dc is None else dc['state'],
                     'dc_gain_delta': None if dc is None else dc.get('delta')})
        if dc:
            dcs.append(dc)
        es = 'nan' if np.isnan(e) else f"{e:.4f}"
        ds = f"{dc['rel']:.4f}" if dc else '     -'
        dn = dc['state'] if dc else '-'
        print(f"  {r:>7.1%} {es:>14} {'✅' if ok else '❌':>5}  {worst:>8}  "
              f"{ds:>10}  {dn:>7}")

    thr_fit, fit = fit_threshold(rows, args.tol)
    print(f"  → 선형화 유효 임계값(격자): {args.input} 섭동 {thr:.1%} 이내")
    if thr_fit:
        print(f"  → 선형화 유효 임계값(피팅): {thr_fit:.2%}   "
              f"err ≈ {fit['k']:.3g}·r^{fit['exponent']:.2f}  (R²={fit['r2']:.4f})")
    dc_max = max((d['rel'] for d in dcs), default=None)
    dc_delta = max((d['delta']['rel'] for d in dcs if 'delta' in d), default=None)
    if dc_max is not None:
        w = max(dcs, key=lambda d: d['rel'])
        print(f"  → DC 이득 오차 최대 {dc_max:.1%}  ({w['state']}: "
              f"선형 {w['lin']:+.4g} vs 비선형 {w['nl']:+.4g})")
        dd = [d['delta'] for d in dcs if 'delta' in d]
        if dd:
            g = max(dd, key=lambda d: d['rel'])
            print(f"  → δ  DC 이득 오차 {g['rel']:.1%}  "
                  f"(선형 {g['lin_deg']:+.3f}° vs 비선형 {g['nl_deg']:+.3f}°)")
    report[SCR] = {'threshold_ratio': thr, 'threshold_fit': thr_fit,
                   'fit': fit, 'T': T, 'slow_pole': slow,
                   'dc_gain_error_max': dc_max, 'dc_gain_error_delta': dc_delta,
                   'sweep': rows}

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
# 파일명에 섭동 입력을 새긴다. 같은 이름을 쓰면 Vg 실행이 Pref 실행을
# 덮어써 비교가 불가능해진다. (실행_식별자_설계원칙: 결과를 바꾸는 조건은
# 식별자에 반영한다)
TAG = args.input
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

# ── 시간영역 궤적 저장 ──
if TRAJ:
    pack = {'states': np.array(M.STATE_NAMES, dtype=object),
            'input': TAG, 'ratio': args.traj_at, 'XR': XR,
            'scrs': np.array(sorted(TRAJ, key=float, reverse=True), dtype=object)}
    for scr, (t, y_nl, y_lin) in TRAJ.items():
        pack[f't_{scr}'] = t
        pack[f'nl_{scr}'] = y_nl
        pack[f'lin_{scr}'] = y_lin
    tp = RES_DIR / f'trajectory_{TAG}_r{args.traj_at:g}.npz'
    np.savez_compressed(tp, **pack)
    print(f"\n  💾 {tp.name}  (시간영역 궤적 {len(TRAJ)}개 운전점)")

# ══════════════════════════════════════════════
# 요약
# ══════════════════════════════════════════════
thr_min = min(v['threshold_ratio'] for v in report.values())

print("\n" + "=" * 76)
print("  Phase 2 게이트 산출물")
print("=" * 76)
print(f"  {'SCR':>6} {'T[s]':>7} {'임계(격자)':>11} {'임계(피팅)':>11} "
      f"{'지수 n':>7} {'R²':>7} {'DC오차(δ)':>10}")
for SCR, v in report.items():
    dd = '-' if v['dc_gain_error_delta'] is None else f"{v['dc_gain_error_delta']:.1%}"
    tf = '-' if v['threshold_fit'] is None else f"{v['threshold_fit']:.2%}"
    ex = '-' if not v['fit'] else f"{v['fit']['exponent']:.2f}"
    r2 = '-' if not v['fit'] else f"{v['fit']['r2']:.4f}"
    print(f"  {SCR:>6} {v['T']:>7.2f} {v['threshold_ratio']:>11.1%} {tf:>11} "
          f"{ex:>7} {r2:>7} {dd:>10}")

fits = [v['threshold_fit'] for v in report.values() if v['threshold_fit']]
thr_fit_min = min(fits) if fits else None
print(f"\n  ★ 보수적 임계값 (전 SCR 공통)")
print(f"     격자 기준: {args.input} 섭동 {thr_min:.1%} 이내")
if thr_fit_min:
    print(f"     피팅 기준: {args.input} 섭동 {thr_fit_min:.2%} 이내")

out = {'run': RUN_NAME, 'input': args.input, 'tol': args.tol,
       'T_mode': args.T, 'tau_margin': args.tau_margin,
       'timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
       'threshold_common': thr_min,
       'threshold_common_fit': thr_fit_min,
       'by_SCR': {str(k): v for k, v in report.items()}}
(RES_DIR / f'linearization_validity_{TAG}.json').write_text(
    json.dumps(out, indent=2, ensure_ascii=False), encoding='utf-8')

tbl = "".join(
    f"| {SCR} | {v['T']:.2f} | {v['threshold_ratio']:.1%} | "
    f"{'-' if v['dc_gain_error_max'] is None else format(v['dc_gain_error_max'], '.1%')} | "
    f"{'-' if v['dc_gain_error_delta'] is None else format(v['dc_gain_error_delta'], '.1%')} |\n"
    for SCR, v in report.items())
md = f"""---
type: result
phase: 2
run: {RUN_NAME}
date: {datetime.now().strftime('%Y-%m-%d %H:%M')}
threshold_input: {args.input}
T_mode: {args.T}
threshold_common: {thr_min}
tol: {args.tol}
tags: [result, phase2, 선형화유효성, gate]
---

# 선형화 유효성 검증 — {RUN_NAME}

물리적 관측량 14개(제어기 내부 적분기 제외)에 대해, 비선형 궤적과 선형 예측
궤적의 차이를 **설비 정격으로 정규화**한 최대 오차가 **{args.tol:.0%}** 이내인
최대 입력 섭동 크기. Radau (stiff).

적분 구간은 동작점별 5τ×{args.tau_margin} 로 자동 산출한다. 고정 구간을 쓰면
정착 진행도가 SCR 마다 달라져 비교가 성립하지 않는다.

| SCR | T [s] | 유효 임계값 ({args.input}) | DC 이득 오차 (최대) | DC 이득 오차 (δ) |
|---|---|---|---|---|
{tbl}
> [!warning] DC 이득 오차는 궤적 오차와 별개다
> 선형 모델은 정상상태 이득 자체를 과대평가한다. 궤적 형상이 잘 맞아도
> 최종 도달점이 어긋나므로, 두 지표를 함께 보고해야 한다.
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
(RES_DIR / f'linearization_validity_{TAG}.md').write_text(md, encoding='utf-8')

print(f"\n  💾 {mat_path.name}  (MATLAB/Simulink)")
print(f"  💾 xval_check.m")
print(f"  💾 linearization_validity_{TAG}.json / .md")
print("=" * 76)