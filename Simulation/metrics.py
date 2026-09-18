"""
metrics.py — 안정도 지표 (P4-A0)

기존 지표의 결함
    ζ_min 을 진동 모드(|Im| > 임계)에서만 계산했다. 그런데 이 시스템의
    임계 모드는 δ 지배 **실수극**(과감쇠 동기화 모드)이므로 지표에 잡히지
    않는다. 이 상태로 PSO 를 돌리면 178 Hz LCL 공진만 최적화되고 정작
    약계통에서 무너지는 동기화 모드는 방치된다.

통합 척도 — 감쇠율 σ
    2차계:   t_s = 4/(ζ·ω_n)      →  σ ≡ ζ·ω_n
    실수극:  t_s = 4/|λ|          →  σ ≡ |λ|
    (계수 4 는 2% 정착 기준. 1% 기준이면 5 를 쓴다. 이 파일은 2% 로 통일한다 —
     SIGMA_REF 산출과 t_s 표시가 어긋나면 같은 값이 통과이자 미달로 보인다.)
    두 경우 모두 σ = -Re(λ) 이다. 실수극과 진동 모드를 한 자로 잴 수 있고,
    물리적 의미도 하나다 — **감쇠 속도**. 최소 σ 가 정착시간을 지배한다.

ζ 는 버리지 않는다
    σ 는 얼마나 빨리 잦아드는지를, ζ 는 얼마나 출렁이는지를 말한다.
    서로 다른 요구라 두 지표를 함께 본다. 단 ζ 는 진동 모드에만 정의된다.

PSO 목적함수
    두 지표를 각자의 목표로 정규화하고 **최솟값**을 취한다.
        score = min(σ_min/SIGMA_REF, ζ_min/ZETA_FLOOR)
    ≥ 1 이면 두 요구를 모두 만족. 곱이나 합이 아니라 최솟값을 쓰는 이유는,
    한쪽이 크게 좋아도 다른 쪽 미달을 보상해서는 안 되기 때문이다.

조연호 · 연세대 스마트그리드 연구실
"""

import numpy as np
from scipy import linalg

import model as M

# ══════════════════════════════════════════════
# 기준값의 근거
# ══════════════════════════════════════════════
# ζ_ref = 0.64 의 출처
#   폐기된 v0 코드에 ζ_th = 4/(2π·f_dom) 이 있었다. f_dom = 1 Hz 를 넣으면
#   4/(2π) = 0.6366 ≈ 0.64. 즉 이 값은 표준 조항이 아니라 **정착시간 1 초
#   요구를 1 Hz 모드에 대해 감쇠비로 환산한 값**이다.
#   UNIFI 사양서에는 정성적 "positive damping" 요구는 있으나 수치 감쇠비
#   조항은 확인되지 않는다. → P3-A6 에서 원 조문 확인 필요.
#
# σ 가 원형인 이유
#   2% 정착시간 t_s ≈ 4/(ζ·ω_n) = 4/σ  (σ ≡ -Re λ)
#   ζ 형태는 모드 주파수에 의존하므로 주파수가 없는 실수극에 적용할 수 없다.
#   σ 는 실수극·진동 모드 모두에 정의되며 같은 물리량(감쇠 속도)을 가리킨다.
#   따라서 ζ 기준과 σ 기준은 같은 요구를 다르게 쓴 것이고, σ 가 일반형이다.
#
# 대역 분리가 불필요해지는 이유
#   ζ 기준을 전 모드에 적용하면 LCL 공진(178 Hz, ζ≈0.21)이 최솟값을 독점해
#   목적함수가 SCR 에 반응하지 않는다. 그러나 σ 로 보면 같은 모드가
#   σ ≈ 231 (t_s ≈ 0.02 s) 로 정착에 전혀 관여하지 않는다.
#   고주파 공진은 감쇠비가 낮아도 빨리 사라지므로 σ 기준에서 자동 탈락한다.
#
# ζ 는 부차 지표로 남긴다
#   σ 는 얼마나 빨리 잦아드는지를, ζ 는 얼마나 출렁이는지를 말한다.
#   과도 중 링잉 억제를 위해 진동 모드에 하한을 둔다.

T_S_SPEC = 1.0               # 정착시간 요구 [s] — 2% 기준
SIGMA_REF = 4.0 / T_S_SPEC   # = 4.0 [1/s]. ζ_ref 0.64 와 동일한 요구
                             # (TS_COEF 와 같은 계수를 쓴다 — 아래 참조)
ZETA_FLOOR = 0.10            # 진동 모드 링잉 하한 (부차 조건)
ZETA_REF_LEGACY = 0.64       # 구 기준. 보고·대조용

TS_COEF = 4.0                # 2% 정착 기준. SIGMA_REF 와 공통 상수
IM_TOL = 1e-4                # 이보다 작은 허수부는 실수극으로 본다
DELTA = 'delta'
OMEGA = 'dw'


def participation(A):
    """P[k,i] = |Φ_ki·Ψ_ik|, 모드별 정규화."""
    ev, V = linalg.eig(A)
    W = linalg.inv(V)
    P = np.abs(V.T * W).T
    return ev, P / np.maximum(P.sum(axis=0, keepdims=True), 1e-300)


def analyze(A):
    """모드별 σ·ζ 와 물리적 귀속을 산출한다."""
    ev, P = participation(A)
    di = M.STATE_NAMES.index(DELTA) if DELTA in M.STATE_NAMES else None
    wi = M.STATE_NAMES.index(OMEGA) if OMEGA in M.STATE_NAMES else None

    modes = []
    for i in range(len(ev)):
        if ev[i].imag < -IM_TOL:                 # 켤레쌍은 한 번만
            continue
        lam = ev[i]
        sig = float(-lam.real)                   # 감쇠율 — 실수극·진동 공통
        osc = bool(abs(lam.imag) > IM_TOL)   # numpy.bool_ → JSON 불가
        top = int(np.argmax(P[:, i]))
        modes.append({
            're': float(lam.real), 'im': float(lam.imag),
            'sigma': sig,
            # 계수 4 = 2% 정착 기준. SIGMA_REF = 4/T_S_SPEC 과 반드시 일치시킨다.
            # 불안정(sig<0)이면 정착하지 않으므로 None.
            't_s': (float(TS_COEF / sig) if sig > 1e-12 else None),
            'f_hz': float(abs(lam.imag) / (2 * np.pi)) if osc else None,
            'zeta': float(sig / abs(lam)) if osc and abs(lam) > 1e-12 else None,
            'oscillatory': osc,
            'top_state': M.STATE_NAMES[top],
            'p_top': float(P[top, i]),
            'p_sync': (float(P[di, i] + P[wi, i])
                       if di is not None and wi is not None else None),
        })
    modes.sort(key=lambda m: m['sigma'])          # 느린 순
    return modes


def metrics(A):
    """PSO 목적함수와 판정에 쓰는 요약 지표."""
    modes = analyze(A)
    if not modes:
        return None

    crit = modes[0]                               # σ 최소 = 임계 모드
    sigma_min = crit['sigma']

    osc = [m for m in modes if m['oscillatory']]
    z = [m['zeta'] for m in osc if m['zeta'] is not None]
    zeta_min = min(z) if z else None
    zeta_mode = (min((m for m in osc if m['zeta'] is not None),
                     key=lambda m: m['zeta']) if z else None)

    # 동기화 모드 — δ·Δω 참여도 최대 (실수극 포함)
    sync = None
    if crit['p_sync'] is not None:
        sync = max(modes, key=lambda m: m['p_sync'])

    # ── 주 기준: 감쇠율 ──
    r_sigma = sigma_min / SIGMA_REF

    # ── 부차 기준: 진동 모드 링잉 ──
    r_zeta = (zeta_min / ZETA_FLOOR) if zeta_min is not None else np.inf

    score = float(min(r_sigma, r_zeta))
    binding = 'sigma' if r_sigma <= r_zeta else 'zeta'

    # 구 기준(ζ≥0.64)을 그대로 적용하면 어느 모드가 걸리는지 — 대조용
    legacy = (zeta_min / ZETA_REF_LEGACY) if zeta_min is not None else None

    return {
        'stable': bool(sigma_min > 0),
        'sigma_min': sigma_min,
        't_s_max': crit['t_s'],
        'critical': crit,
        'zeta_min': zeta_min,
        'zeta_mode': zeta_mode,
        'sync': sync,
        'ratio_sigma': float(r_sigma),
        'ratio_zeta': float(r_zeta) if np.isfinite(r_zeta) else None,
        'ratio_legacy': legacy,
        'score': score,
        'binding': binding,
        'n_modes': len(modes),
    }


def objective(A):
    """PSO 최소화용 비용. score 가 클수록 좋으므로 부호를 뒤집는다.

    불안정하면 큰 벌점을 주되, 불안정 정도에 비례시켜 탐색이 경계를
    향해 내려올 수 있게 한다(계단형 벌점은 기울기가 없어 PSO 가 길을 잃는다).
    """
    m = metrics(A)
    if m is None:
        return 1e6
    if not m['stable']:
        return 1e3 + abs(m['sigma_min'])
    return -m['score']


def objective_multi(ctrl, SCR_list, XR=1.0):
    """다중 운전점 PSO 목적함수.

    F_multi = min_k score(SCR_k)

    전 SCR 에서 동시에 기준을 만족해야 하므로 최솟값(가장 나쁜 운전점)이
    전체를 대표한다. 가중합이 아닌 min 을 쓰는 이유: 한 운전점이 아무리
    좋아도 다른 운전점의 미달을 보상해서는 안 되기 때문이다.

    반환: (cost, detail)
      cost   — PSO 최소화 대상 (작을수록 좋음)
      detail — 디버깅용 dict {SCR: {score, sigma_min, zeta_min, stable, ...}}
    """
    import op
    import runner

    op.CTRL.update(ctrl)
    SCR_list = sorted((float(s) for s in SCR_list), reverse=True)

    detail = {}
    worst_score = float('inf')
    penalty = 0.0

    xg = None
    for SCR in SCR_list:
        x0, ok, _ = op.solve_op(SCR, XR, xg)
        if not ok:
            detail[SCR] = {'converged': False}
            penalty += 1e4
            continue
        xg = x0
        A = op.jacobian(x0, SCR, XR)
        m = metrics(A)
        if m is None:
            detail[SCR] = {'converged': True, 'modes': False}
            penalty += 1e5
            continue

        detail[SCR] = {
            'converged': True,
            'stable': m['stable'],
            'score': m['score'],
            'sigma_min': m['sigma_min'],
            'zeta_min': m['zeta_min'],
            'binding': m['binding'],
        }

        if not m['stable']:
            penalty += 1e3 + abs(m['sigma_min'])
        else:
            worst_score = min(worst_score, m['score'])

    if penalty > 0:
        cost = penalty
    elif worst_score == float('inf'):
        cost = 1e6
    else:
        cost = -worst_score

    return cost, detail


def report(A, label=''):
    """사람이 읽는 요약."""
    m = metrics(A)
    if m is None:
        return '모드 없음'
    c, s = m['critical'], m['sync']
    kind = '진동' if c['oscillatory'] else '실수극'
    out = [f"{label}"] if label else []
    out.append(
        f"  임계 모드  λ={c['re']:+.4f}"
        + (f"{c['im']:+.4f}j" if c['oscillatory'] else '        ')
        + f"  [{kind}]  σ={c['sigma']:.4f}  t_s={c['t_s']:.2f}s"
        f"  지배={c['top_state']}({c['p_top']:.2f})")
    if s is not None:
        out.append(f"  동기화 모드  λ={s['re']:+.4f}  σ={s['sigma']:.4f}"
                   f"  p(δ+Δω)={s['p_sync']:.3f}")
    zs = f"{m['zeta_min']:.4f}" if m['zeta_min'] is not None else '—'
    zf = (f"{m['zeta_mode']['f_hz']:.1f}Hz" if m['zeta_mode'] else '—')
    out.append(f"  σ_min={m['sigma_min']:.4f} (목표 {SIGMA_REF:.2f})"
               f"   ζ_min={zs} @ {zf} (하한 {ZETA_FLOOR})")
    out.append(f"  score={m['score']:.4f}  구속={m['binding']}"
               f"   (σ 여유 {m['ratio_sigma']:.3f}"
               + (f", ζ 여유 {m['ratio_zeta']:.3f})" if m['ratio_zeta'] else ")"))
    if m['ratio_legacy']:
        out.append(f"  구 기준(ζ≥{ZETA_REF_LEGACY}) 여유 {m['ratio_legacy']:.3f}"
                   f" — LCL 공진이 최솟값을 독점하던 지표")
    return '\n'.join(out)


if __name__ == '__main__':
    import op
    print(f"주 기준  σ_ref = {SIGMA_REF:.2f} [1/s]  (t_s ≤ {T_S_SPEC:.1f} s, 2% 기준)")
    print(f"부차     ζ_floor = {ZETA_FLOOR}  (진동 모드 링잉)")
    print(f"구 기준  ζ = {ZETA_REF_LEGACY} — 대조용\n")
    print(f"{'SCR':>5} {'σ_min':>8} {'t_s[s]':>8} {'임계모드':>9} {'지배상태':>9} "
          f"{'ζ_min':>8} {'score':>8} {'구속':>7} {'구 여유':>8}")
    print('─' * 80)
    xg = None
    for SCR in [3.0, 2.0, 1.5, 1.0]:
        x0, ok, _ = op.solve_op(SCR, 1.0, xg)
        if not ok:
            continue
        xg = x0
        m = metrics(op.jacobian(x0, SCR, 1.0))
        c = m['critical']
        kind = '진동' if c['oscillatory'] else '실수극'
        zs = f"{m['zeta_min']:.4f}" if m['zeta_min'] is not None else '—'
        lg = f"{m['ratio_legacy']:.3f}" if m['ratio_legacy'] else '—'
        print(f"{SCR:>5} {m['sigma_min']:>8.4f} {m['t_s_max']:>8.2f} {kind:>9} "
              f"{c['top_state']:>9} {zs:>8} {m['score']:>8.4f} "
              f"{m['binding']:>7} {lg:>8}")

    print()
    x0, _, _ = op.solve_op(1.0, 1.0)
    print(report(op.jacobian(x0, 1.0, 1.0), 'SCR 1.0 상세'))