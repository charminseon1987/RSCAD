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
정하지 못한 것 — 숨기지 않는다
─────────────────────────────────────────────────────────────────────
J (가상 관성) : 최적화는 J 를 줄이려 한다. 작을수록 스윙 모드가 빠르고 잘
    잦아들기 때문이다. 그런데 GFM 을 쓰는 이유가 관성 제공이라, 수치만 따르면
    연구 목적과 반대로 간다. 하한은 목적함수가 아니라 **요구사항**이 정해야
    한다 — 계통 규정의 RoCoF 한계든, 논문이 주장할 H 값이든. 사용자 결정 전까지
    status 를 '미확인' 으로 두고 유도하지 않는다.

f_sw (스위칭 주파수) : 이 모델은 평균화 모델이라 스위칭 주파수가 없다. DC측
    전류루프의 **상한**은 원래 f_sw/10 쯤이 정하는데 그 값을 모른다. 같은
    스위칭단을 공유한다고 보고 AC 전류루프를 상한으로 쓴다 — 이건 연구 가정이고,
    실제 f_sw 를 알면 다시 계산해야 한다.

실행:
    python Simulation/param_bounds.py                 # 표 + JSON 저장
    python Simulation/param_bounds.py --sep-lo 5 --sep-hi 10

출력: Simulation/param_bounds.json

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
    p['v_pv'] = float(inp['v_pv_ref'])
    p['V_b'] = float(inp['V_b'])
    p['S'] = float(inp['Pref'])
    # 정상상태 듀티 — 부스트/벅 관계에서 바로 나온다
    p['d_pv'] = 1 - p['v_pv'] / p['v_dc']
    p['d_ess'] = 1 - p['V_b'] / p['v_dc']
    return p


def derive(p, sep_lo, sep_hi):
    """대역 사슬을 타고 내려오며 범위를 만든다. (bounds, chain) 반환."""
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

    # 사용자 결정이 필요한 셋 — 유도하지 않는다
    B['J'] = {'lo': None, 'hi': None, 'status': '미확인', 'H_of_base': None,
              'basis': 'H = ½·J·w0²/S 로 환산해 요구사항에서 정한다. '
                       'RoCoF 한계 또는 논문이 주장할 H 값이 있어야 한다.'}
    B['Dp'] = {'lo': None, 'hi': None, 'status': '미확인',
               'basis': 'J 와 짝이다. 스윙 모드 ζ = Dp/(2·√(J·Ks/w0)) 이라 '
                        'J 가 정해져야 범위가 정해진다.'}
    B['nq'] = {'lo': None, 'hi': None, 'status': '미확인',
               'basis': '무효전력 드룹. 전압 규정(예: ±5%)이 허용 기울기를 정한다. '
                        '민감도 dF=0.08 로 가장 낮아 우선순위는 뒤다.'}

    chain = {'w_res_LCL': w_res, 'w_ci_ac_fixed': w_ci_ac,
             'w_v_ac': [wv_lo, wv_hi], 'w_power': [wp_lo, wp_hi],
             'w_i_dc': [wi_lo, wi_hi], 'w_v_dc': [wd_lo, wd_hi]}
    return B, chain


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
    a = ap.parse_args()

    import pso  # 실행 폴더 규칙을 두 곳에 두지 않는다
    run = pso.resolve_run(a.run)
    meta = json.loads((run / 'meta.json').read_text(encoding='utf-8'))
    base = meta['ctrl_params']
    p = plant_from(meta)
    B, chain = derive(p, a.sep_lo, a.sep_hi)
    B['J']['H_of_base'] = 0.5 * float(base['J']) * p['w0'] ** 2 / p['S']

    print(f'  실행 폴더: {run.name}   분리비 {a.sep_lo:g}~{a.sep_hi:g}배\n')
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

    doc = {
        'mode': 'B-physical', 'run': run.name, 'sep': [a.sep_lo, a.sep_hi],
        'plant': p, 'chain': chain, 'bounds': B,
        'assumptions': [
            {'id': 'A1', 'status': '원문 확인',
             'text': 'AC 전류루프는 고정(Kpc=5.0, Kic=200)이고 최적화 14개에 없다. '
                     '따라서 AC 쪽 대역 천장이 먼저 정해진다.'},
            {'id': 'A2', 'status': '연구 가정',
             'text': '평균화 모델이라 f_sw 가 없다. DC 전류루프 상한을 같은 '
                     '스위칭단을 공유한다고 보고 AC 전류루프와 같게 뒀다. '
                     '실제 f_sw 를 알면 다시 계산해야 한다.'},
            {'id': 'A3', 'status': '미확인',
             'text': 'J·Dp·nq 는 유도하지 않았다. 요구사항(RoCoF 한계·주장할 H·'
                     '전압 규정)이 있어야 정해지며 목적함수로는 정할 수 없다.'},
        ],
        'timestamp': datetime.now().isoformat(timespec='seconds'),
    }
    out = Path(__file__).resolve().parent / 'param_bounds.json'
    out.write_text(json.dumps(doc, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'  저장: Simulation/{out.name}')


if __name__ == '__main__':
    main()
