"""
runner.py - Phase 2 실행 계층 (v3)

model.py(심볼릭) + op.py(동작점·야코비안)를 호출해 실험을 돌리고,
파라미터별 폴더에 결과를 남긴다.

v2 → v3 변경:
  [A] 모드 대역 분류 (sync / control / lcl)
      ζ_min 단일 스칼라가 SCR·X/R 에 따라 다른 모드를 가리키는 문제 해결.
      X/R=3.0 에서 SCR 2.0→1.5 사이에 ζ_min 이 42Hz 모드에서 178Hz 모드로
      갈아타는 것이 확인됨. 대역별 ζ 를 따로 추적하고 교차를 명시 기록.
  [B] 모드 교차(band crossover) 자동 검출 → meta['band_crossovers']
  [C] 동작점 미수렴 원인 분류 (정적 부하가능성 한계 vs 수치 미수렴)
      + SCR 세분 연속화 재시도.
  [D] persist 스위치 — PSO 에서 디스크 쓰기 완전 차단
  [E] latest/ 폴더 복사 폐기 → LATEST.json 포인터 (원자적 교체)
  [F] 검산 오차 초과 SCR 목록화 (X/R=3.0 저SCR 에서 1e-6 초과 확인됨)

저장 구조:
  results/
  ├── LATEST.json                       ← 최신 실행 포인터 (폴더 복사 안 함)
  ├── J0.50_Dp20.0_Kpv0.050_wc62.8_XR3.0_91d005_xr30/
  │   ├── A_num_SCR3.00.npy
  │   ├── x0_SCR3.00.npy
  │   ├── eigenvalue_results.json
  │   ├── meta.json
  │   └── results.md

실행:
  python Simulation/runner.py
  python Simulation/runner.py --XR 3.0 --SCR 3.0 2.0 1.5 1.0 0.8 --tag xr30
  python Simulation/runner.py --no-persist          # 화면 출력만

PSO 에서:
  import runner
  _, meta, _ = runner.run(ctrl, SCR_list, XR, persist=False, quiet=True)
  cost = objective(meta)      # meta['band_zeta_min'] 로 대역별 ζ 접근

조연호 · 연세대 스마트그리드 연구실
"""

import numpy as np
from scipy import linalg
from scipy.optimize import linear_sum_assignment
import json, argparse, hashlib, os, sys
from pathlib import Path
from datetime import datetime

import model as M
import op
import metrics as MT

MODEL_VERSION = 'v3-22state'

# ── 판정 기준 ─────────────────────────────────────────────────
# TODO(출처): UNIFI Category 3 사양서의 해당 조항 번호를 명시할 것.
#   ζ=0.64 는 전력계통 진동모드 기준(통상 0.03~0.10)보다 훨씬 높은 값.
#   과도응답 오버슈트 사양에서 유도된 것이라면 유도식도 함께 기록.
ZETA_TARGET = 0.64

# ── 모드 대역 정의 ────────────────────────────────────────────
# ※ 주파수 기반 분류는 참여계수(pf.py) 분석의 '대용'이다. 물리적 모드 귀속을
#   확정하려면 참여계수로 검증해야 하며, 논문에는 참여계수 근거를 써야 한다.
#   여기서의 목적은 ζ_min 이 모드를 갈아타는 것을 감지·기록하는 것.
BANDS = [
    ('sync',    0.0,     5.0),     # 동기화 모드 (δ, Δω)
    ('control', 5.0,   100.0),     # 제어루프·DC-AC 혼합 모드 (37~43Hz 관측)
    ('lcl',   100.0,     np.inf),  # LCL 공진 (178Hz 관측)
]

# ── 수치 임계값 ───────────────────────────────────────────────
IMAG_TOL    = 1e-4     # [rad/s] 진동모드 판정 하한
STABLE_TOL  = 1e-6     # [1/s]   Re(λ) < -STABLE_TOL 이면 안정
FD_TOL      = 1e-6     # 유한차분 검산 허용 상대오차
ENTRY_TOL   = 1e-8     # 성분별 상대오차 계산 시 무시할 |A_ij| 하한
DELTA_WARN  = 75.0     # [deg] 이 이상이면 부하가능성 한계 접근
SUBSTEPS    = 4        # 미수렴 시 SCR 세분 연속화 분할 수


# ══════════════════════════════════════════════
# 모드 분석
# ══════════════════════════════════════════════
def band_of(f_hz):
    for name, lo, hi in BANDS:
        if lo <= f_hz < hi:
            return name
    return 'unknown'


def analyze(A):
    """고유값 → 진동모드 목록 + 대역별 최소감쇠 + 전역 최소감쇠

    zeta_band 가 SCR 에 따라 바뀌면 ζ_min 이 다른 물리 모드로 갈아탄 것이다.
    """
    ev = linalg.eigvals(A)

    modes = []
    for i, e in enumerate(ev):
        if e.imag <= IMAG_TOL:
            continue
        f_hz = float(e.imag / (2 * np.pi))
        modes.append({'idx': i,
                      'zeta': float(-e.real / abs(e)),
                      'f_hz': f_hz,
                      'band': band_of(f_hz),
                      're':   float(e.real),
                      'im':   float(e.imag)})

    out = {'ev': ev, 'modes': modes,
           'band_zeta': {b: None for b, _, _ in BANDS},
           'band_idx':  {b: None for b, _, _ in BANDS},
           'band_f':    {b: None for b, _, _ in BANDS},
           'zeta_min':  float('nan'), 'zeta_band': None, 'crit_idx': -1,
           'min_abs_real': float(np.min(np.abs(ev.real))),
           'n_osc': len(modes)}
    if not modes:
        return out

    for b, _, _ in BANDS:
        cand = [m for m in modes if m['band'] == b]
        if cand:
            k = min(cand, key=lambda m: m['zeta'])
            out['band_zeta'][b] = k['zeta']
            out['band_idx'][b]  = k['idx']
            out['band_f'][b]    = k['f_hz']

    k = min(modes, key=lambda m: m['zeta'])
    out['zeta_min']  = k['zeta']
    out['zeta_band'] = k['band']
    out['crit_idx']  = k['idx']
    return out


def coupling_effect(A, idx_map=None):
    """DC-AC 커플링 블록 제거 시 고유값 이동 — 22차 모델의 존재 이유 정량화

    헝가리안 매칭으로 모드를 대응시킨다 (정렬 기반 페어링은 모드가 뒤바뀜).
    idx_map: {label: 고유값 인덱스} — 대역별 대표 모드의 이동량을 개별 추적.
    """
    A_cut = A.copy()
    A_cut[M.N_DC:, :M.N_DC] = 0
    A_cut[:M.N_DC, M.N_DC:] = 0

    e1 = linalg.eigvals(A)
    e2 = linalg.eigvals(A_cut)

    C = np.abs(e1[:, None] - e2[None, :])
    r, c = linear_sum_assignment(C)
    shifts = C[r, c]

    out = {'max_shift': float(np.max(shifts)),
           'mean_shift': float(np.mean(shifts))}
    for label, idx in (idx_map or {}).items():
        if idx is None or idx < 0:
            out[f'shift_{label}'] = None
            continue
        matches = np.where(r == idx)[0]
        if len(matches) == 0:
            out[f'shift_{label}'] = None
            continue
        pos = int(matches[0])
        out[f'shift_{label}'] = float(shifts[pos])
    return out


def fd_error(A, A_fd):
    """유한차분 검산 — 전역 정규화와 성분별 상대오차를 둘 다 보고.

    전역 정규화만 쓰면 1/L_f 같은 큰 성분이 분모를 지배해 작은 성분의
    큰 상대오차가 가려진다.
    """
    d = np.abs(A - A_fd)
    glob = float(np.max(d) / max(np.max(np.abs(A)), 1.0))

    mask = np.abs(A) > ENTRY_TOL
    if mask.any():
        rel   = np.where(mask, d / np.maximum(np.abs(A), ENTRY_TOL), 0.0)
        entry = float(np.max(rel))
        ij    = np.unravel_index(int(np.argmax(rel)), A.shape)
    else:
        entry, ij = 0.0, (0, 0)
    return glob, entry, (int(ij[0]), int(ij[1]))


# ══════════════════════════════════════════════
# 동작점 — 미수렴 원인 분류 + 세분 연속화
# ══════════════════════════════════════════════
def solve_with_continuation(SCR, XR, x_prev, prev_delta_deg, prev_SCR, log):
    """동작점 해석. 실패 시 SCR 을 세분해 재시도한 뒤 원인을 분류한다.

    v2 문제: op.solve_op 실패가 (a)수치 미수렴 (b)물리적 해 부재 두 경우 모두
    같은 메시지로 나와 구분이 안 됐다. δ→90° 접근은 P = VE·sinδ/X 의 전달
    한계이며, 소신호 안정도 경계와 성격이 완전히 다르다. 2D SCR-X/R 경계도에서
    두 경계는 반드시 구분해 표기해야 한다.

    반환: (x0, ok, reason, detail)
      reason ∈ {'ok', 'loadability_limit', 'nonconvergence'}
    """
    x0, ok, msg = op.solve_op(SCR, XR, x_prev)
    if ok:
        return x0, True, 'ok', ''

    if x_prev is not None and prev_SCR is not None and prev_SCR > SCR:
        log(f"        ↻ SCR {prev_SCR}→{SCR} 세분 연속화 재시도 ({SUBSTEPS}단계)")
        xs, sub_ok = x_prev, True
        for s in np.linspace(prev_SCR, SCR, SUBSTEPS + 1)[1:]:
            xs, sub_ok, msg = op.solve_op(float(s), XR, xs)
            if not sub_ok:
                break
        if sub_ok:
            log("        ✓ 세분 연속화 성공")
            return xs, True, 'ok', '세분 연속화'

    if prev_delta_deg is not None and prev_delta_deg >= DELTA_WARN:
        return None, False, 'loadability_limit', (
            f'직전 SCR 에서 δ={prev_delta_deg:.2f}° (>{DELTA_WARN}°) — '
            f'정적 부하가능성 한계. 정상상태 해 자체가 존재하지 않음 '
            f'(소신호 불안정 아님)')
    return None, False, 'nonconvergence', f'수치 미수렴: {msg}'


# ══════════════════════════════════════════════
# 실행 식별자 / 저장
# ══════════════════════════════════════════════
def make_run_name(ctrl, XR, SCR_list, tag=''):
    """해시에 XR·SCR 리스트를 포함시켜, 같은 파라미터·다른 스윕이 동일 폴더를
    재사용해 이전 .npy 가 남는 것을 막는다."""
    payload = {'ctrl': {k: float(v) for k, v in ctrl.items()},
               'XR':   float(XR),
               'SCR':  sorted(float(s) for s in SCR_list)}
    h = hashlib.md5(json.dumps(payload, sort_keys=True).encode()).hexdigest()[:6]
    base = (f"J{ctrl['J']:.2f}_Dp{ctrl['Dp']:.1f}_"
            f"Kpv{ctrl['Kpv']:.3f}_wc{ctrl['wc']:.1f}_XR{XR:.1f}_{h}")
    return base + (f"_{tag}" if tag else '')


def clean_stale(out_dir):
    n = 0
    for pat in ('A_num_SCR*.npy', 'x0_SCR*.npy',
                'eigenvalue_results.json', 'meta.json', 'results.md'):
        for f in out_dir.glob(pat):
            f.unlink(); n += 1
    return n


def update_latest_pointer(base_dir, run_name):
    """폴더 통째 복사(shutil.copytree) 폐기 — 포인터 파일 하나만 원자적 교체.

    복사 비용 0, 디스크 사용량 절반, latest 와 원본이 어긋날 여지 없음.
    os.replace 는 POSIX·Windows 모두 원자적이라 중단 시에도 깨지지 않는다.
    """
    tmp = Path(base_dir) / '.LATEST.tmp'
    tmp.write_text(json.dumps(
        {'run_name': run_name,
         'updated':  datetime.now().isoformat(timespec='seconds')},
        indent=2, ensure_ascii=False), encoding='utf-8')
    os.replace(tmp, Path(base_dir) / 'LATEST.json')


def resolve_latest(results_root):
    """app.py 에서 쓸 해석기. LATEST.json → 폴더. 없으면 mtime 최신 폴더."""
    results_root = Path(results_root)
    ptr = results_root / 'LATEST.json'
    if ptr.exists():
        name = json.loads(ptr.read_text(encoding='utf-8'))['run_name']
        d = results_root / name
        if d.is_dir():
            return d
    cands = [p for p in results_root.iterdir()
             if p.is_dir() and (p / 'meta.json').exists()]
    if not cands:
        raise FileNotFoundError('결과 폴더 없음 — runner.py 를 먼저 실행하세요')
    return max(cands, key=lambda p: (p / 'meta.json').stat().st_mtime)


def verify_ctrl_applied(ctrl):
    """op.CTRL 전역 갱신이 실제로 반영되는지 검증.

    op.py 가 import 시점에 값을 캡처했거나 lambdify 인자로 미리 바인딩했다면
    파라미터를 바꿔도 결과가 변하지 않는다. PSO 는 이걸 수천 번 호출하므로,
    조용히 같은 값만 나오면 수렴한 것처럼 보인다.
    """
    for k, v in ctrl.items():
        if k not in op.CTRL:
            raise KeyError(f"op.CTRL 에 '{k}' 없음 — model/op 파라미터 목록 불일치")
        if not np.isclose(op.CTRL[k], v, rtol=0, atol=0):
            raise RuntimeError(
                f"op.CTRL['{k}'] 갱신 실패: {op.CTRL[k]} != {v}\n"
                f"  → op.py 가 CTRL 을 지연 참조하지 않고 있을 가능성. "
                f"solve_op/jacobian 내부에서 CTRL 을 매번 읽는지 확인할 것.")


# ══════════════════════════════════════════════
# 코어
# ══════════════════════════════════════════════
def run(ctrl, SCR_list, XR=1.0, tag='',
        persist=True, write_latest=True, base_dir=None, quiet=False):
    """스윕 1회 실행. PSO 에서 persist=False, quiet=True 로 호출.

    반환: (results dict, meta dict, out_dir Path | None)
    """
    missing = set(M.PARAM_NAMES) - set(ctrl)
    if missing:
        raise KeyError(f"ctrl 에 누락된 파라미터: {sorted(missing)}")

    op.CTRL.update(ctrl)
    verify_ctrl_applied(ctrl)

    # 동작점 연속화는 강계통(쉬운 해)에서 출발해야 안정적이므로 내림차순 고정.
    # 순서가 바뀌면 같은 SCR 이 다른 해로 수렴할 수 있다(재현성 문제).
    SCR_list = sorted((float(s) for s in SCR_list), reverse=True)

    run_name = make_run_name(ctrl, XR, SCR_list, tag)
    base_dir = Path(base_dir) if base_dir else Path(__file__).parent.parent / 'results'
    out_dir, n_clean = None, 0
    if persist:
        base_dir.mkdir(parents=True, exist_ok=True)
        out_dir = base_dir / run_name
        out_dir.mkdir(parents=True, exist_ok=True)
        n_clean = clean_stale(out_dir)

    log = (lambda *a, **k: None) if quiet else print

    log("=" * 108)
    log(f"  Phase 2: 22차 야코비안 ({MODEL_VERSION})")
    log(f"  J={ctrl['J']}  Dp={ctrl['Dp']}  Kpv={ctrl['Kpv']}  "
        f"wc={ctrl['wc']:.1f}  X/R={XR}")
    log(f"  저장: results/{run_name}/" + (f"   (stale {n_clean}개 제거)" if n_clean else "")
        if persist else "  저장: 없음 (persist=False)")
    log("=" * 108)

    results, x_prev, prev_delta, prev_SCR = {}, None, None, None

    log(f"\n  {'SCR':>5} {'수렴':>4} {'stbl':>4} {'σ_min':>8} {'t_s[s]':>7} "
        f"{'score':>7} {'구속':>6} {'임계지배':>9} {'ζ_min':>8} "
        f"{'δ(°)':>7} {'검산':>10} {'커플링':>12}")
    log("  " + "─" * 106)

    for SCR in SCR_list:
        x0, ok, reason, detail = solve_with_continuation(
            SCR, XR, x_prev, prev_delta, prev_SCR, log)
        prev_SCR = SCR

        if not ok:
            mark = '⛔' if reason == 'loadability_limit' else '✗'
            log(f"  {SCR:>5} {mark:>4}  {detail[:88]}")
            results[SCR] = {'converged': False,
                            'fail_reason': reason,
                            'message': detail}
            continue

        x_prev = x0
        d = dict(zip(M.STATE_NAMES, x0))
        delta_deg  = float(np.degrees(d['delta']))
        prev_delta = delta_deg

        A    = op.jacobian(x0, SCR, XR)
        A_fd = op.fd_jacobian(x0, SCR, XR)
        fd_glob, fd_entry, fd_ij = fd_error(A, A_fd)
        fd_worst = max(fd_glob, fd_entry)

        an     = analyze(A)
        st     = MT.metrics(A)          # σ 기준 지표 (P4-A0)
        max_re = float(np.max(an['ev'].real))
        stable = max_re < -STABLE_TOL

        idx_map = dict(an['band_idx'])
        idx_map['crit'] = an['crit_idx']
        coup = coupling_effect(A, idx_map)

        results[SCR] = {
            'converged':    True,
            'stable':       stable,
            'max_real':     round(max_re, 6),
            'min_abs_real': round(an['min_abs_real'], 8),
            'sigma_min':    round(st['sigma_min'], 5),
            't_s_max':      round(st['t_s_max'], 4),
            'score':        round(st['score'], 5),
            'binding':      st['binding'],
            'crit_state':   st['critical']['top_state'],
            'crit_osc':     st['critical']['oscillatory'],
            'zeta_min':     None if np.isnan(an['zeta_min']) else round(an['zeta_min'], 4),
            'zeta_band':    an['zeta_band'],
            'zeta_valid':   bool(not np.isnan(an['zeta_min'])),
            'f_dom_hz':     (None if an['crit_idx'] < 0 else
                             round(float(an['ev'][an['crit_idx']].imag / (2 * np.pi)), 4)),
            'band_zeta':    {k: (None if v is None else round(v, 4))
                             for k, v in an['band_zeta'].items()},
            'band_f_hz':    {k: (None if v is None else round(v, 4))
                             for k, v in an['band_f'].items()},
            'n_osc_modes':  an['n_osc'],
            'modes':        [{k: (round(v, 6) if isinstance(v, float) else v)
                              for k, v in m.items()} for m in an['modes']],
            'delta_deg':        round(delta_deg, 3),
            'delta_margin_deg': round(90.0 - delta_deg, 3),
            'delta_near_limit': bool(delta_deg >= DELTA_WARN),
            'v_od':         round(float(d['v_od']), 3),
            'v_dc':         round(float(d['v_dc']), 3),
            'fd_rel_error':       fd_glob,
            'fd_entry_rel_error': fd_entry,
            'fd_worst_entry':     fd_ij,
            'fd_exceeds_tol':     bool(fd_worst >= FD_TOL),
            'coupling':     {k: (None if v is None else round(v, 6))
                             for k, v in coup.items()},
            'x0':           {k: float(v) for k, v in d.items()},
            'eigenvalues':  [{'re': round(float(e.real), 6),
                              'im': round(float(e.imag), 6)} for e in an['ev']],
        }

        r  = results[SCR]
        fs = "✅" if stable else "❌"
        vs = "⚠️" if r['fd_exceeds_tol'] else "✅"
        dm = "⚠" if r['delta_near_limit'] else " "
        bz = r['band_zeta']
        f_ = lambda v: "       -" if v is None else f"{v:>8.4f}"
        cs = coup.get('shift_crit')
        cs_s = 'nan' if cs is None else f'{cs:.4e}'
        log(f"  {SCR:>5} {'✓':>4} {fs:>3} "
            f"{r['sigma_min']:>8.4f} {r['t_s_max']:>7.2f} "
            f"{r['score']:>7.3f} {r['binding']:>6} {r['crit_state']:>9} "
            f"{f_(r['zeta_min'])} "
            f"{delta_deg:>6.2f}{dm} {vs}{fd_worst:>8.1e} {cs_s:>12}")

        if persist:
            np.save(out_dir / f'A_num_SCR{SCR:.2f}.npy', A)
            np.save(out_dir / f'x0_SCR{SCR:.2f}.npy', x0)

    ok_runs = {k: v for k, v in results.items() if v.get('converged')}
    if not ok_runs:
        raise RuntimeError("모든 SCR에서 동작점 미수렴 — 파라미터 확인 필요")

    # ── 모드 교차 검출 ──
    # ζ_min 이 어느 대역 모드를 가리키는지가 SCR 에 따라 바뀌면, ζ_min 시계열은
    # 서로 다른 물리량을 이어붙인 것이 된다. PSO 목적함수를 ζ_min 단일값으로
    # 두면 SCR 구간마다 다른 대상을 최적화하게 된다.
    crossovers, prev_b, prev_s, last_b = [], None, None, None
    for s in SCR_list:
        v = results.get(s, {})
        if not v.get('converged') or not v.get('zeta_valid'):
            continue
        b = v['zeta_band']
        if prev_b is not None and b != prev_b:
            crossovers.append({'between': [prev_s, s], 'from': prev_b, 'to': b})
        prev_b, prev_s, last_b = b, s, b

    z_vals     = [v['zeta_min'] for v in ok_runs.values() if v['zeta_valid']]
    zeta_all   = float(np.min(z_vals)) if z_vals else float('nan')
    sc_vals    = [v['score'] for v in ok_runs.values() if v.get('score') is not None]
    score_all  = float(np.min(sc_vals)) if sc_vals else float('nan')
    sig_vals   = [v['sigma_min'] for v in ok_runs.values() if v.get('sigma_min') is not None]
    sigma_all  = float(np.min(sig_vals)) if sig_vals else float('nan')
    zeta_valid = len(z_vals) == len(ok_runs)

    band_min = {}
    for b, _, _ in BANDS:
        vals = [v['band_zeta'][b] for v in ok_runs.values()
                if v['band_zeta'][b] is not None]
        band_min[b] = round(float(np.min(vals)), 4) if vals else None

    failed = {k: v for k, v in results.items() if not v.get('converged')}
    meta = {
        'run_name':      run_name,
        'model_version': MODEL_VERSION,
        'n_states':      M.N,
        'n_dc_states':   M.N_DC,
        'timestamp':     datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        'ctrl_params':   {k: float(v) for k, v in ctrl.items()},
        'fixed_params':  {k: float(v) for k, v in op.FIXED.items()},
        'inputs':        {k: float(v) for k, v in op.INP.items()},
        'SCR_list':      SCR_list,
        'XR':            float(XR),
        'zeta_target':   ZETA_TARGET,
        'bands':         {b: [lo, (None if np.isinf(hi) else hi)] for b, lo, hi in BANDS},
        'thresholds':    {'IMAG_TOL': IMAG_TOL, 'STABLE_TOL': STABLE_TOL,
                          'FD_TOL': FD_TOL, 'DELTA_WARN': DELTA_WARN},
        'all_converged': len(ok_runs) == len(SCR_list),
        'all_stable':    all(v['stable'] for v in ok_runs.values()),
        'score_min_all':      None if np.isnan(score_all) else round(score_all, 5),
        'sigma_min_all':      None if np.isnan(sigma_all) else round(sigma_all, 5),
        'sigma_ref':          MT.SIGMA_REF,
        't_s_spec':           MT.T_S_SPEC,
        'metric_pass':        bool(score_all >= 1.0),
        'zeta_min_all':       None if np.isnan(zeta_all) else round(zeta_all, 4),
        'zeta_min_valid':     zeta_valid,
        'zeta_min_band':      last_b,
        'zeta_pass':          bool(zeta_valid and zeta_all >= ZETA_TARGET),
        'band_zeta_min':      band_min,
        'band_crossovers':    crossovers,
        'max_fd_error':       max(v['fd_rel_error'] for v in ok_runs.values()),
        'max_fd_entry_error': max(v['fd_entry_rel_error'] for v in ok_runs.values()),
        'fd_exceed_SCR':      [k for k, v in ok_runs.items() if v['fd_exceeds_tol']],
        'delta_max_deg':      max(v['delta_deg'] for v in ok_runs.values()),
        'delta_near_limit_SCR': [k for k, v in ok_runs.items() if v['delta_near_limit']],
        'loadability_limit_SCR': [k for k, v in failed.items()
                                  if v.get('fail_reason') == 'loadability_limit'],
        'nonconvergence_SCR':    [k for k, v in failed.items()
                                  if v.get('fail_reason') == 'nonconvergence'],
    }

    if persist:
        with open(out_dir / 'eigenvalue_results.json', 'w', encoding='utf-8') as fp:
            json.dump({f'{k:.2f}': v for k, v in results.items()}, fp,
                      indent=2, ensure_ascii=False)
        with open(out_dir / 'meta.json', 'w', encoding='utf-8') as fp:
            json.dump(meta, fp, indent=2, ensure_ascii=False)
        write_markdown(out_dir, run_name, ctrl, SCR_list, XR, results, meta)
        if write_latest:
            update_latest_pointer(base_dir, run_name)
            log(f"\n  📁 results/{run_name}/")
            log(f"  🔖 LATEST.json → {run_name}")
        else:
            log(f"\n  📁 results/{run_name}/   (LATEST 갱신 생략)")

    if not quiet:
        z_str = 'nan' if np.isnan(zeta_all) else f'{zeta_all:.4f}'
        s_str = 'nan' if np.isnan(score_all) else f'{score_all:.4f}'
        verdict = '기준 충족' if meta['metric_pass'] else 'PSO 필요'
        log("\n" + "=" * 108)
        log(f"  ✅ 완료 — score={s_str}  σ_min={sigma_all:.4f} "
            f"(목표 {MT.SIGMA_REF:.2f}, t_s≤{MT.T_S_SPEC:.0f}s)  {verdict}")
        log(f"     참고 — 구 지표 ζ_min={z_str} [{last_b}]   " + "  ".join(
            f"{b}={'-' if band_min[b] is None else band_min[b]}" for b, _, _ in BANDS))
        if crossovers:
            log(f"  ⚠  모드 교차 {len(crossovers)}회 — ζ_min 이 서로 다른 물리 모드를 가리킴:")
            for c in crossovers:
                log(f"       SCR {c['between'][0]} → {c['between'][1]}: "
                    f"{c['from']} → {c['to']}")
            log("       PSO 목적함수를 ζ_min 단일값으로 두면 구간마다 다른 대상을 최적화함.")
        if meta['fd_exceed_SCR']:
            log(f"  ⚠  검산 오차 {FD_TOL:.0e} 초과 SCR: {meta['fd_exceed_SCR']}")
        if meta['loadability_limit_SCR']:
            log(f"  ⛔ 정적 부하가능성 한계 SCR: {meta['loadability_limit_SCR']} "
                f"(소신호 경계 아님 — 2D 경계도에서 구분 표기)")
        if meta['nonconvergence_SCR']:
            log(f"  ✗  수치 미수렴 SCR: {meta['nonconvergence_SCR']} (원인 조사 필요)")
        log("=" * 108)

    return results, meta, out_dir


# ══════════════════════════════════════════════
# results.md (Obsidian)
# ══════════════════════════════════════════════
def write_markdown(out_dir, run_name, ctrl, SCR_list, XR, results, meta):
    rows = ""
    for SCR in SCR_list:
        r = results.get(SCR, {})
        if not r.get('converged'):
            tag = ('⛔ 해 없음' if r.get('fail_reason') == 'loadability_limit'
                   else '✗ 미수렴')
            rows += f"| {SCR:.2f} | {tag} | - | - | - | - | - | - | - |\n"
            continue
        bz = r['band_zeta']
        g  = lambda v: '-' if v is None else v
        rows += (f"| {SCR:.2f} | {'✅' if r['stable'] else '❌'} | "
                 f"{r['zeta_min']} | `{r['zeta_band']}` | {r['f_dom_hz']} | "
                 f"{g(bz['sync'])} | {g(bz['control'])} | {g(bz['lcl'])} | "
                 f"{r['delta_deg']}{'⚠' if r['delta_near_limit'] else ''} |\n")

    z_all = meta['zeta_min_all']
    if not meta['zeta_min_valid']:
        z_line = "⚠️ 판정 불가 — 진동모드가 검출되지 않은 SCR 존재"
    elif meta['zeta_pass']:
        z_line = f"✅ 달성 (ζ_min={z_all})"
    else:
        z_line = f"❌ 미달 (ζ_min={z_all}) → PSO 필요"

    if meta['band_crossovers']:
        cx = "\n".join(
            f"> - SCR {c['between'][0]} → {c['between'][1]}: `{c['from']}` → `{c['to']}`"
            for c in meta['band_crossovers'])
        cx_block = f"""> [!danger] 모드 교차 {len(meta['band_crossovers'])}회 검출
> ζ_min 이 SCR 에 따라 서로 다른 물리 모드를 가리킨다.
{cx}
>
> ▸ ζ_min 시계열은 단일 물리량이 아니라 서로 다른 모드를 이어붙인 것.
> ▸ PSO 목적함수를 ζ_min 단일값으로 두면 SCR 구간마다 다른 대상을 최적화하게 됨.
> ※ 대역별 ζ 를 가중합하는 형태로 목적함수를 재설계해야 함 (Phase 4)."""
    else:
        cx_block = ("> [!success] 모드 교차 없음\n"
                    "> ζ_min 이 전 SCR 에서 동일 대역 모드를 가리킴.")

    ld_block = ""
    if meta['loadability_limit_SCR']:
        ld_block = f"""
> [!warning] 정적 부하가능성 한계
> SCR {meta['loadability_limit_SCR']} 에서 정상상태 해가 존재하지 않는다.
> 최대 δ = {meta['delta_max_deg']}° (한계 90°).
>
> ▸ 소신호 불안정이 아니라 P = VE·sinδ/X 의 전달 한계다.
> ※ 2D SCR-X/R 경계도에서 감쇠 경계와 구분해 표기할 것."""

    fd_block = ""
    if meta['fd_exceed_SCR']:
        fd_block = (f"\n> [!warning] 검산 오차 초과\n"
                    f"> SCR {meta['fd_exceed_SCR']} 에서 상대오차가 {FD_TOL:.0e} 를 넘음.\n"
                    f"> 야코비안 정확도 재확인 필요 "
                    f"(성분 위치는 eigenvalue_results.json 의 fd_worst_entry).")

    bm = meta['band_zeta_min']
    md = f"""---
type: result
run: {run_name}
model_version: {MODEL_VERSION}
n_states: {M.N}
date: {datetime.now().strftime('%Y-%m-%d %H:%M')}
XR: {XR}
all_stable: {meta['all_stable']}
zeta_min: {z_all}
zeta_min_band: {meta['zeta_min_band']}
band_crossovers: {len(meta['band_crossovers'])}
tags: [result, phase2, jacobian, 22state, mode-band]
---

# 실험 결과: {run_name}

## 제어 파라미터 (PSO 대상 14)

| 기호 | 값 | 기호 | 값 |
|---|---|---|---|
| Kp_vpv | {ctrl['Kp_vpv']} | Kp_vdc | {ctrl['Kp_vdc']} |
| Ki_vpv | {ctrl['Ki_vpv']} | Ki_vdc | {ctrl['Ki_vdc']} |
| Kp_ipv | {ctrl['Kp_ipv']} | Kp_iess | {ctrl['Kp_iess']} |
| Ki_ipv | {ctrl['Ki_ipv']} | Ki_iess | {ctrl['Ki_iess']} |
| J | {ctrl['J']} | nq | {ctrl['nq']} |
| Dp | {ctrl['Dp']} | Kpv | {ctrl['Kpv']} |
| wc | {ctrl['wc']:.2f} | Kiv | {ctrl['Kiv']} |

## 모드 대역 정의

| 대역 | 주파수 | 물리 모드 |
|---|---|---|
| `sync` | < 5 Hz | 동기화 모드 (δ, Δω) |
| `control` | 5 ~ 100 Hz | 제어루프 · DC-AC 혼합 모드 |
| `lcl` | ≥ 100 Hz | LCL 공진 |

※ 주파수 기반 분류는 참여계수 분석의 **대용**이다. 논문에는 `pf.py` 의
참여계수로 모드 귀속을 확정한 근거를 써야 한다.

## 고유값 분석 (X/R = {XR})

| SCR | stable | ζ_min | 대역 | f_dom (Hz) | ζ_sync | ζ_control | ζ_lcl | δ (°) |
|---|---|---|---|---|---|---|---|---|
{rows}
{cx_block}
{ld_block}
{fd_block}

## 판정

- 안정도: {'✅ 전 SCR 안정' if meta['all_stable'] else '❌ 불안정 SCR 존재'}
- ζ 기준 ({ZETA_TARGET}): {z_line}
- 대역별 최소 ζ: sync={bm['sync']}, control={bm['control']}, lcl={bm['lcl']}
- 최대 δ: {meta['delta_max_deg']}° (한계 90°)
- 야코비안 검산: 전역 {meta['max_fd_error']:.2e} / 성분별 {meta['max_fd_entry_error']:.2e}

## 파일

```
{run_name}/
├── A_num_SCR*.npy           22×22 야코비안
├── x0_SCR*.npy              동작점 22×1
├── eigenvalue_results.json  modes 배열에 전 진동모드 ζ·f·대역 수록
├── meta.json
└── results.md
```

## 🔗 연결 노트

- [[Phase02_완료]]
- [[DC-AC_커플링]]
- [[동작점_SCR의존성]]
- [[고유값_안정도판단]]
- [[88포인트_2D_스윕_설계]]
"""
    (out_dir / 'results.md').write_text(md, encoding='utf-8')


# ══════════════════════════════════════════════
# CLI
# ══════════════════════════════════════════════
def parse_args(argv=None):
    p = argparse.ArgumentParser(description='GFM 22차 소신호 모델 실행')
    for name, default, help_ in [
        ('Kp_vpv',  0.1,   'PV 전압 P이득'),
        ('Ki_vpv',  10.0,  'PV 전압 I이득'),
        ('Kp_ipv',  1e-3,  '부스트 전류 P이득'),
        ('Ki_ipv',  0.1,   '부스트 전류 I이득'),
        ('Kp_vdc',  0.5,   'DC링크 전압 P이득'),
        ('Ki_vdc',  20.0,  'DC링크 전압 I이득'),
        ('Kp_iess', 1e-3,  'ESS 전류 P이득'),
        ('Ki_iess', 0.1,   'ESS 전류 I이득'),
        ('J',       0.5,   '가상 관성'),
        ('Dp',      20.0,  '댐핑'),
        ('wc',      2 * np.pi * 10, '전력 필터 차단주파수'),
        ('nq',      1e-3,  'Q 드룹 계수'),
        ('Kpv',     0.05,  'AC 전압 P이득'),
        ('Kiv',     10.0,  'AC 전압 I이득'),
    ]:
        p.add_argument(f'--{name}', type=float, default=default, help=help_)
    p.add_argument('--SCR', type=float, nargs='+', default=[3.0, 2.0, 1.5, 1.0])
    p.add_argument('--XR',  type=float, default=1.0)
    p.add_argument('--tag', type=str, default='', help='폴더명 접미사')
    p.add_argument('--no-persist', action='store_true',
                   help='디스크 저장 없이 화면 출력만')
    p.add_argument('--no-latest', action='store_true',
                   help='LATEST.json 갱신 생략')
    p.add_argument('--quiet', action='store_true')
    return p.parse_args(argv)


def main(argv=None):
    args = parse_args(argv)

    unknown = set(M.PARAM_NAMES) - set(vars(args))
    if unknown:
        raise SystemExit(
            f"❌ model.PARAM_NAMES 에 있으나 CLI 인자가 없는 파라미터: "
            f"{sorted(unknown)}\n   parse_args() 목록을 model.py 와 동기화할 것.")

    ctrl = {k: getattr(args, k) for k in M.PARAM_NAMES}
    try:
        _, meta, _ = run(ctrl, args.SCR, args.XR, args.tag,
                         persist=not args.no_persist,
                         write_latest=not args.no_latest,
                         quiet=args.quiet)
    except RuntimeError as e:
        raise SystemExit(f"\n  ❌ {e}")

    return 0 if meta['all_converged'] else 1


if __name__ == '__main__':
    sys.exit(main())