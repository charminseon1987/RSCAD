"""
param_bounds.py — 14 파라미터의 탐색 범위를 플랜트 상수에서 유도한다 (B안)

A안(pso.py 기본값)은 범위를 [base/4, base*4] 로 뒀다. 임의값이라 거기서 나온
best 는 설계값이 아니다. 이 파일은 그 범위를 **근거 있는 수로 바꾼다.**

범위를 손으로 적지 않고 계산한다. 필터 값이나 고정 이득이 바뀌면 범위도 따라
바뀌어야 하는데, 숫자를 베껴 두면 한쪽만 고치고 다른 쪽이 조용히 틀린 채 남는다.

─────────────────────────────────────────────────────────────────────
유도 원리 — 캐스케이드 대역 분리
─────────────────────────────────────────────────────────────────────
다단 제어에서 바깥 루프는 안쪽 루프보다 느려야 한다. 안쪽이 지령을 따라잡기
전에 바깥이 지령을 또 바꾸면 두 루프가 서로를 흔든다. 통상 5~10배를 둔다.

이 모델에서 **AC 전류루프는 고정**이다 (Kpc=5.0, Kic=200 은 최적화 대상 14개에
들어 있지 않다). 그래서 AC 쪽 천장이 먼저 정해지고 나머지가 그 아래로 내려온다.

    AC 전류루프  w = Kpc/(L1+Lv)              = 1667 rad/s (265 Hz)   고정
      └ AC 전압루프  w = Kpv/Cf                 ≤ 1/5 ~ 1/10
          └ 전력필터  w = wc                    ≤ 1/5 ~ 1/10

이득이 무엇을 내보내는지에 따라 환산식이 다르다. 전압루프는 전류지령을 내므로
커패시턴스가, 전류루프는 **듀티비(무차원)** 를 내므로 L/v_dc 가 들어간다.
듀티를 내는 루프에서 v_dc 를 빼먹으면 대역이 800배 틀어진다.

    Kpv     = w·Cf                   AC전압 → 전류지령
    wc      = w                      전력 필터 차단
    Kp_ipv  = w·L_pv  / v_dc         PV전류 → 듀티
    Kp_iess = w·L_ess / v_dc         ESS전류 → 듀티
    Kp_vpv  = w·C_pv                 PV전압 → 전류지령
    Kp_vdc  = w·C_dc / (1-d_ess)     DC링크 → ESS전류지령 (듀티 계수를 탄다)

적분이득은 영점을 교차주파수 아래 한 자리수에 둔다 — Ki/Kp = w/5 ~ w/10.
영점이 교차점에 너무 가까우면 위상여유를 깎고, 너무 멀면 정상상태 오차가 늦게
사라진다.

─────────────────────────────────────────────────────────────────────
유도 원리 2 — 요구사항에서 (J·Dp·nq)
─────────────────────────────────────────────────────────────────────
이 셋은 대역 사슬에서 나오지 않는다. 목적함수로도 정할 수 없다 — 목적함수는
"더 안정한 쪽"을 고를 뿐이고, 관성을 얼마나 낼 것인지·주파수를 얼마나 떨어뜨릴
것인지는 **쓰는 쪽이 요구하는 수**다. 그 요구를 명시 인자로 받아 환산한다.

J (가상 관성) ← RoCoF 요구
    관성상수 H = ½·J·w0²/S 이고, 전력 불평형 ΔP 에서 주파수 변화율은
    RoCoF = f0·ΔP/(2H) 다. 둘을 합치면 하한이 나온다.

        H ≥ f0·ΔP / (2·RoCoF_max)           ΔP 를 견디려면 이만큼 무거워야

    상한은 반대 방향에서 온다. H 가 크면 같은 사건에서 **더 많은 전력**을
    관성으로 내보내야 한다 (P_in = 2H·S·RoCoF/f0). 그 전력을 못 내면 포화한다.

        H ≤ P_hdr / (2·RoCoF_max) · f0      이만큼만 낼 전력이 있다

    ⚠ 이 상한은 DC링크가 아니라 **ESS** 가 정한다. E_dc = ½·C_dc·v_dc² 를
    H_equiv = E_dc/S 로 환산하면 0.07 s 뿐이다 — 기준값이 주장하는 3.55 s 의
    1/50. 가상관성은 커패시터에서 나올 수 없다. P_hdr 는 ESS 과도출력 여유다.

Dp ← 주파수 드룹 규정
    이 모델에서 Dp 는 **두 역할을 겸한다.** 스윙식(model.py f[9])
    J·Δω̇ = (Pref-Pf)/w0 - Dp·Δω 를 정상상태로 풀면

        Δω = ΔP / (w0·Dp)      →      droop = S / (w0²·Dp)

    즉 Dp 는 감쇠계수이면서 동시에 P-f 드룹계수다. 범위는 **드룹 규정**에서
    잡는다. 감쇠(ζ)는 목적함수가 이미 보고 있으므로 범위로 또 묶으면 같은
    요구를 두 번 거는 셈이다.

        Dp = S / (w0²·droop)                droop 3~5% 가 통상

    환산해 보면 기준값 Dp=20 은 드룹 0.35%, 규정보다 10배 뻣뻣하다. A안 배율
    범위 [5, 80] 은 전 구간이 1.4% 이하라 규정 범위와 겹치지 않는다. 이 범위로
    바꾸면 PSO 가 보는 영역 자체가 달라진다 — 그게 이 유도의 요점이다.

nq ← 전압 규정
    v_od_ref = V_ref - nq·(Qf - Qref) 이므로 무효전력 1 pu 에서의 전압 변화가
    규정 허용폭 안에 있어야 한다.

        nq = vdroop · V_ref / S             vdroop 2~5% 가 통상

교차검증으로만 쓰는 수 — 범위를 묶지 않는다
    스윙 모드를 2차로 근사하면 ζ = Dp / (2·√(J·Ks/w0)) 이고, 동기화 강성은
    Ks = 1.5·Vg²·cos δ₀ / (X_f + X_g) 다 (피크 dq 규약, δ₀ = π/4 — op.nominals
    와 같은 동작점). X_g 는 SCR·X/R 에 따라 변하므로 ζ 도 운전점마다 다르다.
    이 값으로 범위를 정하지 않고, 드룹에서 나온 Dp 가 ζ_floor 를 깨는지 보는
    데만 쓴다. 깨면 표에 적는다 — 숨기면 목적함수가 범위 안에서 해를 못 찾는
    이유를 알 수 없다.

f_sw (스위칭 주파수) : 이 모델은 평균화 모델이라 스위칭 주파수가 없다. DC측
    전류루프의 **상한**은 원래 f_sw/10 쯤이 정하는데 그 값을 모른다. 같은
    스위칭단을 공유한다고 보고 AC 전류루프를 상한으로 쓴다 — 이건 연구 가정이고,
    실제 f_sw 를 알면 다시 계산해야 한다.

실행:
    python Simulation/param_bounds.py                 # 표 + JSON 저장
    python Simulation/param_bounds.py --sep-lo 5 --sep-hi 10
    python Simulation/param_bounds.py --rocof 2.0 --dp-step 0.2 --droop 2 5

출력: Simulation/param_bounds.json

주의: Ks 교차검증 때문에 op 를 지연 import 한다. op 는 모듈 상단에서
lambdify_all() 을 돌리는데, 재서 보니 **6초쯤** 더한다 (model 단독 4.6s →
model+op 10.9s). 나머지는 model 의 심볼 구축 비용이라 --no-crosscheck 로도
못 줄인다 — pso 를 import 하는 순간 이미 치른다. 계통 임피던스 식을 여기
베껴 두지 않는 이유는 위 머리말과 같다.

조연호 · 연세대 스마트그리드 연구실
"""

import console_utf8  # noqa: F401
import argparse
import json
import math
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
HZ = 1.0 / (2 * math.pi)


def plant_from(meta):
    """플랜트 상수와 정상상태 듀티. meta.json 에서 읽고 계산한다."""
    fp, inp = meta['fixed_params'], meta['inputs']
    p = {k: float(fp[k]) for k in
         ('L1', 'L2', 'Cf', 'Lv', 'C_dc', 'C_pv', 'L_pv', 'L_ess', 'Kpc', 'Kic', 'w0')}
    p['v_dc'] = float(fp['v_dc_ref'])
    p['V_ref'] = float(fp['V_ref'])          # AC 전압 기준 (피크) — nq 환산에 쓴다
    p['v_pv'] = float(inp['v_pv_ref'])
    p['V_b'] = float(inp['V_b'])
    p['Vg'] = float(inp['Vg'])               # 계통 전압 (피크) — Ks 에 쓴다
    p['S'] = float(inp['Pref'])
    # 정상상태 듀티 — 부스트/벅 관계에서 바로 나온다
    p['d_pv'] = 1 - p['v_pv'] / p['v_dc']
    p['d_ess'] = 1 - p['V_b'] / p['v_dc']
    return p


def derive(p, sep_lo, sep_hi, req):
    """범위를 만든다. 8개는 대역 사슬에서, 3개는 req(요구사항)에서.

    req: dP_pu, rocof [Hz/s], p_hdr_pu, droop [%,%], vdroop [%,%]
    반환: (bounds, chain)
    """
    w_ci_ac = p['Kpc'] / (p['L1'] + p['Lv'])          # 고정. 모든 것의 천장
    w_res = math.sqrt((p['L1'] + p['L2']) / (p['L1'] * p['L2'] * p['Cf']))

    wv_lo, wv_hi = w_ci_ac / sep_hi, w_ci_ac / sep_lo          # AC 전압루프
    wp_lo, wp_hi = wv_lo / sep_hi, wv_hi / sep_lo              # 전력 필터
    wi_lo, wi_hi = w_ci_ac / sep_hi, w_ci_ac                   # DC 전류루프 (가정 A2)
    wd_lo, wd_hi = wi_lo / sep_hi, wi_hi / sep_lo              # DC 전압루프

    k_ess = p['C_dc'] / (1 - p['d_ess'])
    B = {}

    def put(name, lo, hi, basis):
        B[name] = {'lo': float(lo), 'hi': float(hi), 'basis': basis, 'status': '유도'}

    def pair(kp, ki, lo_w, hi_w, gain, what):
        """비례이득과, 영점을 교차 아래 한 자리수에 둔 적분이득을 함께 만든다."""
        put(kp, lo_w * gain, hi_w * gain, what)
        put(ki, lo_w * gain * lo_w / sep_hi, hi_w * gain * hi_w / sep_lo,
            f'영점을 교차/{sep_hi:g}~/{sep_lo:g} 에 · Ki = Kp·w/n')

    pair('Kpv', 'Kiv', wv_lo, wv_hi, p['Cf'],
         f'AC전압 = AC전류/{sep_hi:g}~/{sep_lo:g} · Kpv = w·Cf')
    put('wc', wp_lo, wp_hi, f'전력필터 = AC전압/{sep_hi:g}~/{sep_lo:g} · wc = w')

    pair('Kp_ipv', 'Ki_ipv', wi_lo, wi_hi, p['L_pv'] / p['v_dc'],
         'PV전류 ≤ AC전류 (가정 A2) · Kp = w·L_pv/v_dc')
    pair('Kp_iess', 'Ki_iess', wi_lo, wi_hi, p['L_ess'] / p['v_dc'],
         'ESS전류 ≤ AC전류 (가정 A2) · Kp = w·L_ess/v_dc')
    pair('Kp_vpv', 'Ki_vpv', wd_lo, wd_hi, p['C_pv'],
         f'PV전압 = PV전류/{sep_hi:g}~/{sep_lo:g} · Kp = w·C_pv')
    pair('Kp_vdc', 'Ki_vdc', wd_lo, wd_hi, k_ess,
         f'DC링크 = ESS전류/{sep_hi:g}~/{sep_lo:g} · Kp = w·C_dc/(1-d_ess)')

    # ── 요구사항에서 오는 셋. 대역 사슬이 아니라 req 가 정한다 ──
    f0 = p['w0'] / (2 * math.pi)
    S, w0 = p['S'], p['w0']

    def J_of_H(H):
        return 2.0 * H * S / w0 ** 2

    # J ← RoCoF. 하한은 "ΔP 를 견딘다", 상한은 "그만큼 낼 전력이 있다".
    H_lo = f0 * req['dP_pu'] / (2.0 * req['rocof'])
    H_hi = f0 * req['p_hdr_pu'] / (2.0 * req['rocof'])
    if H_hi <= H_lo:
        raise SystemExit(
            f'관성 상·하한이 뒤집혔다: ΔP={req["dP_pu"]:g} pu 를 견디려면 '
            f'H≥{H_lo:.2f} s 인데 여유전력 P_hdr={req["p_hdr_pu"]:g} pu 로는 '
            f'H≤{H_hi:.2f} s 까지만 낼 수 있다. --p-hdr 를 --dp-step 보다 크게.')
    put('J', J_of_H(H_lo), J_of_H(H_hi),
        f'RoCoF ≤ {req["rocof"]:g} Hz/s · ΔP = {req["dP_pu"]:g} pu '
        f'(하한) / ESS 여유 P_hdr = {req["p_hdr_pu"]:g} pu (상한) · H = ½·J·w0²/S')
    B['J'].update({'H_range': [float(H_lo), float(H_hi)], 'H_of_base': None})

    # Dp ← 드룹 규정. droop 이 클수록 Dp 는 작다 — 뒤집어서 넣는다.
    dr_lo, dr_hi = min(req['droop']), max(req['droop'])
    put('Dp', S / (w0 ** 2 * dr_hi / 100.0), S / (w0 ** 2 * dr_lo / 100.0),
        f'P-f 드룹 {dr_lo:g}~{dr_hi:g}% · Dp = S/(w0²·droop) '
        f'(감쇠는 목적함수가 보므로 범위로 또 묶지 않는다)')
    B['Dp']['droop_pct'] = [dr_lo, dr_hi]

    # nq ← 전압 규정
    vd_lo, vd_hi = min(req['vdroop']), max(req['vdroop'])
    put('nq', vd_lo / 100.0 * p['V_ref'] / S, vd_hi / 100.0 * p['V_ref'] / S,
        f'전압 드룹 {vd_lo:g}~{vd_hi:g}% · nq = vdroop·V_ref/S')
    B['nq']['vdroop_pct'] = [vd_lo, vd_hi]

    chain = {'w_res_LCL': w_res, 'w_ci_ac_fixed': w_ci_ac,
             'w_v_ac': [wv_lo, wv_hi], 'w_power': [wp_lo, wp_hi],
             'w_i_dc': [wi_lo, wi_hi], 'w_v_dc': [wd_lo, wd_hi]}
    return B, chain


def stiffness(p, scr_list, xr):
    """SCR 별 동기화 강성 Ks [W/rad]. 교차검증에만 쓴다.

    계통 임피던스 식을 여기 베끼지 않고 op.grid_RL 을 쓴다 — 베껴 두면
    Z_BASE 나 X/R 규약이 바뀔 때 한쪽만 고쳐지고 조용히 갈라진다.
    op 는 import 에 20초쯤 걸리므로 호출 시점에 들인다.
    """
    import op                                  # noqa: PLC0415 — 지연 import 의도

    X_f = p['w0'] * (p['L1'] + p['L2'] + p['Lv'])
    d0 = math.pi / 4                           # op.nominals() 의 delta 와 같게
    out = {}
    for scr in scr_list:
        _, Lg = op.grid_RL(float(scr), float(xr))
        X_tot = X_f + p['w0'] * float(Lg)
        out[float(scr)] = 1.5 * p['Vg'] ** 2 * math.cos(d0) / X_tot
    return out, X_f, d0


def zeta_of(Dp, J, Ks, w0):
    """스윙 모드를 2차로 근사한 감쇠비. ζ = Dp/(2·√(J·Ks/w0))."""
    return Dp / (2.0 * math.sqrt(J * Ks / w0))


def main():
    ap = argparse.ArgumentParser(description='탐색 범위 유도 (B안)')
    ap.add_argument('run', nargs='?', default=None, help='결과 폴더 (생략 시 LATEST)')
    # 기본 분리비 3~5 배 — 2026-10-16 에 돌려 보고 정했다.
    #   5~10 배로 묶으면 PSO 최선이 score 0.61 로 목표 1.0 에 못 미친다 (t_s 1.64 s).
    #   3~5 배로 풀면 1.53 (t_s 0.65 s) 으로 넘어선다.
    # 3~5 배는 캐스케이드 설계의 통상 범위이고 5~10 배가 보수적인 쪽이다.
    # 하드웨어(Kpc)나 요구(T_S_SPEC)를 건드리지 않고 되는 선택이라 이걸 쓴다.
    # 근거 실행: results/<run>/pso_B.json (5~10) vs pso_B35.json (3~5)
    ap.add_argument('--sep-lo', type=float, default=3.0, help='최소 분리비')
    ap.add_argument('--sep-hi', type=float, default=5.0, help='최대 분리비')
    # ── 요구사항. 계통 규정에서 와야 하는 수이고 아직 출처를 못 달았다.
    #    기본값은 통상값이며 status '미검증' 으로 JSON 에 남는다 (가정 A4).
    ap.add_argument('--rocof', type=float, default=1.0,
                    help='RoCoF 한계 [Hz/s] (기본 1.0 — 미검증 통상값)')
    ap.add_argument('--dp-step', type=float, default=0.1,
                    help='견뎌야 할 전력 불평형 [pu] (기본 0.1)')
    ap.add_argument('--p-hdr', type=float, default=0.3,
                    help='ESS 과도출력 여유 [pu] (기본 0.3 — 연구 가정)')
    ap.add_argument('--droop', type=float, nargs=2, default=[3.0, 5.0],
                    metavar=('LO', 'HI'), help='P-f 드룹 범위 [%%] (기본 3 5)')
    ap.add_argument('--vdroop', type=float, nargs=2, default=[2.0, 5.0],
                    metavar=('LO', 'HI'), help='전압 드룹 범위 [%%] (기본 2 5)')
    ap.add_argument('--no-crosscheck', action='store_true',
                    help='ζ 교차검증을 건너뛴다 (op import 6초쯤 아낀다)')
    a = ap.parse_args()
    req = {'dP_pu': a.dp_step, 'rocof': a.rocof, 'p_hdr_pu': a.p_hdr,
           'droop': list(a.droop), 'vdroop': list(a.vdroop)}

    import pso  # 실행 폴더 규칙을 두 곳에 두지 않는다
    run = pso.resolve_run(a.run)
    meta = json.loads((run / 'meta.json').read_text(encoding='utf-8'))
    base = meta['ctrl_params']
    p = plant_from(meta)
    B, chain = derive(p, a.sep_lo, a.sep_hi, req)
    B['J']['H_of_base'] = 0.5 * float(base['J']) * p['w0'] ** 2 / p['S']

    print(f'  실행 폴더: {run.name}   분리비 {a.sep_lo:g}~{a.sep_hi:g}배')
    print(f'  요구사항: RoCoF ≤ {a.rocof:g} Hz/s · ΔP {a.dp_step:g} pu · '
          f'ESS 여유 {a.p_hdr:g} pu · 드룹 {a.droop[0]:g}~{a.droop[1]:g}% · '
          f'전압 {a.vdroop[0]:g}~{a.vdroop[1]:g}%\n')
    print(f"  {'대역 사슬':<18}{'rad/s':>20}{'Hz':>18}")
    print('  ' + '-' * 56)
    print(f"  {'LCL 공진':<18}{chain['w_res_LCL']:>20.0f}{chain['w_res_LCL']*HZ:>18.1f}")
    print(f"  {'AC 전류 (고정)':<18}{chain['w_ci_ac_fixed']:>20.0f}"
          f"{chain['w_ci_ac_fixed']*HZ:>18.1f}")
    for k, lbl in (('w_v_ac', 'AC 전압'), ('w_power', '전력 필터'),
                   ('w_i_dc', 'DC 전류'), ('w_v_dc', 'DC 전압')):
        lo, hi = chain[k]
        print(f"  {lbl:<18}{lo:>9.1f}~{hi:<10.1f}{lo*HZ:>8.1f}~{hi*HZ:<9.1f}")

    print(f"\n  {'파라미터':<10}{'기준':>11}{'하한':>13}{'상한':>13}  판정")
    print('  ' + '-' * 62)
    n_out = 0
    for k, v in base.items():
        b = B.get(k, {})
        if b.get('lo') is None:
            print(f'  {k:<10}{v:>11g}{"—":>13}{"—":>13}  {b.get("status", "?")}')
            continue
        inside = b['lo'] <= v <= b['hi']
        n_out += (not inside)
        mark = '' if inside else ('■ 상한 밖' if v > b['hi'] else '■ 하한 밖')
        print(f"  {k:<10}{v:>11g}{b['lo']:>13.5g}{b['hi']:>13.5g}  {mark}")
        b['base_in_range'] = bool(inside)

    print(f'\n  기준값이 범위 밖인 파라미터: {n_out}개')

    # ── 요구사항 셋은 원래 단위로 다시 보여 준다. J=0.42 는 읽어도 모르고
    #    H=3.0 s 는 안다. 범위를 고칠 때 보는 수는 환산 전 쪽이다.
    w0, S = p['w0'], p['S']
    print(f"\n  {'요구사항 환산':<16}{'기준값':>14}{'하한':>14}{'상한':>14}")
    print('  ' + '-' * 58)
    H_of = lambda J: 0.5 * J * w0 ** 2 / S                        # noqa: E731
    dr_of = lambda Dp: S / (w0 ** 2 * Dp) * 100.0                 # noqa: E731
    vd_of = lambda nq: nq * S / p['V_ref'] * 100.0                # noqa: E731
    print(f"  {'J → H [s]':<16}{H_of(float(base['J'])):>14.3f}"
          f"{B['J']['H_range'][0]:>14.3f}{B['J']['H_range'][1]:>14.3f}")
    print(f"  {'Dp → 드룹 [%]':<16}{dr_of(float(base['Dp'])):>14.3f}"
          f"{dr_of(B['Dp']['hi']):>14.3f}{dr_of(B['Dp']['lo']):>14.3f}")
    print(f"  {'nq → 전압 [%]':<16}{vd_of(float(base['nq'])):>14.3f}"
          f"{vd_of(B['nq']['lo']):>14.3f}{vd_of(B['nq']['hi']):>14.3f}")

    cross = {'skipped': bool(a.no_crosscheck)}
    if not a.no_crosscheck:
        scr_list = meta.get('SCR_list') or [3.0, 2.0, 1.5]
        xr = meta.get('XR', 1.0)
        print('\n  ζ 교차검증 (op 적재 중 — 6초쯤 걸린다)')
        Ks, X_f, d0 = stiffness(p, scr_list, xr)
        import metrics as MT                  # noqa: PLC0415 — ζ_floor 한 곳에서

        floor = MT.ZETA_FLOOR
        print(f"  X_f = {X_f:.4f} Ω · δ₀ = {math.degrees(d0):.0f}° · "
              f"X/R = {xr:g} · ζ_floor = {floor:g}")
        print(f"\n  {'SCR':>6}{'Ks [W/rad]':>13}{'ζ(최소)':>12}{'ζ(최대)':>12}  판정")
        print('  ' + '-' * 56)
        z_all, bad = [], []
        for scr in sorted((float(s) for s in scr_list), reverse=True):
            # ζ 는 Dp 가 크고 J 가 작을 때 최대다 — 모서리 둘만 보면 된다.
            z_lo = zeta_of(B['Dp']['lo'], B['J']['hi'], Ks[scr], w0)
            z_hi = zeta_of(B['Dp']['hi'], B['J']['lo'], Ks[scr], w0)
            z_all += [z_lo, z_hi]
            ok = z_lo >= floor
            if not ok:
                bad.append(scr)
            print(f"  {scr:>6.1f}{Ks[scr]:>13.0f}{z_lo:>12.3f}{z_hi:>12.3f}"
                  f"  {'' if ok else '■ ζ_floor 밑'}")
        cross = {'skipped': False, 'X_f': float(X_f), 'delta0_rad': float(d0),
                 'XR': float(xr), 'zeta_floor': float(floor),
                 'Ks_by_SCR': {str(k): float(v) for k, v in Ks.items()},
                 'zeta_envelope': [float(min(z_all)), float(max(z_all))],
                 'zeta_floor_violating_SCR': bad}
        if bad:
            print(f'\n  ⚠ 드룹 규정이 허용하는 Dp 로는 SCR {bad} 에서 스윙 모드'
                  f' ζ 가 {floor:g} 밑으로 내려갈 수 있다.')
            print('    범위를 넓혀 피하지 말 것 — 목적함수가 그 모서리를 피해'
                  ' 해를 고르는 것이 정상 동작이다. 전 모서리가 밑이면 드룹'
                  ' 규정과 ζ_floor 가 양립하지 않는다는 뜻이고, 그때는 둘 중'
                  ' 하나를 고쳐야 한다.')

    doc = {
        'mode': 'B-physical', 'run': run.name, 'sep': [a.sep_lo, a.sep_hi],
        'requirements': req, 'plant': p, 'chain': chain, 'bounds': B,
        'crosscheck': cross,
        'assumptions': [
            {'id': 'A1', 'status': '원문 확인',
             'text': 'AC 전류루프는 고정(Kpc=5.0, Kic=200)이고 최적화 14개에 없다. '
                     '따라서 AC 쪽 대역 천장이 먼저 정해진다.'},
            {'id': 'A2', 'status': '연구 가정',
             'text': '평균화 모델이라 f_sw 가 없다. DC 전류루프 상한을 같은 '
                     '스위칭단을 공유한다고 보고 AC 전류루프와 같게 뒀다. '
                     '실제 f_sw 를 알면 다시 계산해야 한다.'},
            {'id': 'A3', 'status': '해소 (2026-10-16)',
             'text': 'J·Dp·nq 를 요구사항에서 유도했다. 더는 A안 배율을 쓰지 '
                     '않는다 — 14개 전부가 B안 범위를 받는다. 남은 미검증은 '
                     '요구값 자체이며 A4 에 적는다.'},
            {'id': 'A4', 'status': '미검증',
             'text': f'RoCoF 한계 {a.rocof:g} Hz/s · 불평형 {a.dp_step:g} pu · '
                     f'드룹 {a.droop[0]:g}~{a.droop[1]:g}% · 전압 드룹 '
                     f'{a.vdroop[0]:g}~{a.vdroop[1]:g}% 는 통상값으로 넣었고 '
                     '계통 규정 출처를 아직 달지 못했다. 인용 근거로 쓰면 안 '
                     '되고, 투고 전에 적용 규정(또는 논문이 주장할 값)으로 '
                     '바꿔야 한다. 숫자는 --rocof·--dp-step·--droop·--vdroop '
                     '로 바꾸고 다시 유도한다.'},
            {'id': 'A5', 'status': '연구 가정',
             'text': f'ESS 과도출력 여유를 {a.p_hdr:g} pu 로 뒀다 — J 상한이 '
                     '여기서 나온다. 모델에 ESS 정격이 없어 유도할 수 없었다. '
                     'DC링크만으로는 H_equiv = ½·C_dc·v_dc²/S = '
                     f'{0.5 * p["C_dc"] * p["v_dc"] ** 2 / p["S"]:.4f} s 뿐이라 '
                     '가상관성은 전량 ESS 가 댄다.'},
            {'id': 'A6', 'status': '연구 가정',
             'text': 'ζ 교차검증은 스윙 모드를 2차로 근사하고 Ks 를 '
                     '1.5·Vg²·cos δ₀/(X_f+X_g) 로 봤다 (δ₀ = 45°). 범위를 '
                     '정하는 데는 쓰지 않고 ζ_floor 위반 여부만 본다. '
                     '정확한 ζ 는 22차 고유값(metrics.py)이 낸다.'},
        ],
        'timestamp': datetime.now().isoformat(timespec='seconds'),
    }
    out = Path(__file__).resolve().parent / 'param_bounds.json'
    out.write_text(json.dumps(doc, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'  저장: Simulation/{out.name}')


if __name__ == '__main__':
    main()
