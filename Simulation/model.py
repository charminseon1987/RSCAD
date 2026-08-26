"""
model.py - 22차 2단 PV+ESS GFM 인버터 소신호 모델 (심볼릭)

상태변수 22개 = DC 8 + AC 14
  DC: v_pv, i_Lpv, x_vpv, x_ipv, v_dc, i_Less, x_vdc, x_iess
  AC: delta, dw, Pf, Qf, phi_d, phi_q, gam_d, gam_q,
      i_ld, i_lq, v_od, v_oq, i_od, i_oq

핵심 구조 (이전 버전에서 빠져 있던 것):
  - delta(전력각)를 상태로 포함 → 동기화 루프 폐합
  - DC→AC: 인버터 출력전압이 v_dc에 비례
  - AC→DC: DC링크가 인버터 소비전류 i_inv = 1.5(v_od·i_ld+v_oq·i_lq)/v_dc 만큼 유출
  두 방향이 모두 있어야 블록삼각 구조가 깨지고 커플링이 고유값에 반영됨

조연호 · 연세대 스마트그리드 연구실
"""

import sympy as sp

# ══════════════════════════════════════════════
# 1. 심볼 정의
# ══════════════════════════════════════════════

# ── 상태변수 (22) ──
DC_STATES = ['v_pv', 'i_Lpv', 'x_vpv', 'x_ipv', 'v_dc', 'i_Less', 'x_vdc', 'x_iess']
AC_STATES = ['delta', 'dw', 'Pf', 'Qf', 'phi_d', 'phi_q', 'gam_d', 'gam_q',
             'i_ld', 'i_lq', 'v_od', 'v_oq', 'i_od', 'i_oq']
STATE_NAMES = DC_STATES + AC_STATES
N_DC, N_AC = len(DC_STATES), len(AC_STATES)
N = N_DC + N_AC                                    # 22

_s = sp.symbols(STATE_NAMES, real=True)
(v_pv, i_Lpv, x_vpv, x_ipv, v_dc, i_Less, x_vdc, x_iess,
 delta, dw, Pf, Qf, phi_d, phi_q, gam_d, gam_q,
 i_ld, i_lq, v_od, v_oq, i_od, i_oq) = _s
X = sp.Matrix(_s)

# ── 입력 (6) ──
INPUT_NAMES = ['Iph', 'v_pv_ref', 'Pref', 'Qref', 'Vg', 'V_b']
Iph, v_pv_ref, Pref, Qref, Vg, V_b = sp.symbols(INPUT_NAMES, real=True)
U = sp.Matrix([Iph, v_pv_ref, Pref, Qref, Vg, V_b])

# ── 최적화 대상 제어 파라미터 (14) ──
PARAM_NAMES = ['Kp_vpv', 'Ki_vpv', 'Kp_ipv', 'Ki_ipv',
               'Kp_vdc', 'Ki_vdc', 'Kp_iess', 'Ki_iess',
               'J', 'Dp', 'wc', 'nq', 'Kpv', 'Kiv']
(Kp_vpv, Ki_vpv, Kp_ipv, Ki_ipv,
 Kp_vdc, Ki_vdc, Kp_iess, Ki_iess,
 J, Dp, wc, nq, Kpv, Kiv) = sp.symbols(PARAM_NAMES, real=True, positive=True)

# ── 고정 파라미터 ──
FIXED_NAMES = ['C_pv', 'L_pv', 'C_dc', 'L_ess', 'L1', 'R1', 'Cf',
               'L2', 'R2', 'Lg', 'Rg', 'w0', 'Kpc', 'Kic', 'Lv',
               'V_ref', 'v_dc_ref', 'I0', 'nVt']
(C_pv, L_pv, C_dc, L_ess, L1, R1, Cf,
 L2, R2, Lg, Rg, w0, Kpc, Kic, Lv,
 V_ref, v_dc_ref, I0, nVt) = sp.symbols(FIXED_NAMES, real=True, positive=True)

# ══════════════════════════════════════════════
# 2. 대수 방정식 (중간량)
# ══════════════════════════════════════════════

# ── PV 단일다이오드 ──
i_pv = Iph - I0 * (sp.exp(v_pv / nVt) - 1)

# ── PV 부스트 제어 ──
e_vpv    = v_pv - v_pv_ref
i_Lpv_rf = Kp_vpv * e_vpv + Ki_vpv * x_vpv
e_ipv    = i_Lpv_rf - i_Lpv
d_pv     = Kp_ipv * e_ipv + Ki_ipv * x_ipv          # 부스트 듀티

# ── ESS 컨버터 제어 (DC링크 전압 담당) ──
e_vdc     = v_dc_ref - v_dc
i_Less_rf = Kp_vdc * e_vdc + Ki_vdc * x_vdc
e_iess    = i_Less_rf - i_Less
d_ess     = Kp_iess * e_iess + Ki_iess * x_iess

# ── VSG 전압 지령 (Q 드룹) ──
v_od_ref = V_ref - nq * (Qf - Qref)
v_oq_ref = sp.Integer(0)

# ── 전압 루프 (디커플링 + 전류 피드포워드) ──
i_ld_ref = Kpv*(v_od_ref - v_od) + Kiv*phi_d - w0*Cf*v_oq + i_od
i_lq_ref = Kpv*(v_oq_ref - v_oq) + Kiv*phi_q + w0*Cf*v_od + i_oq

# ── 전류 루프 (가상 인덕턴스 포함) ──
v_id_cmd = Kpc*(i_ld_ref - i_ld) + Kic*gam_d - w0*(L1+Lv)*i_lq + v_od
v_iq_cmd = Kpc*(i_lq_ref - i_lq) + Kic*gam_q + w0*(L1+Lv)*i_ld + v_oq

# ★ DC→AC 커플링: 변조지수는 정격 v_dc 기준, 실제 출력은 실제 v_dc에 비례
v_id = v_id_cmd * (v_dc / v_dc_ref)
v_iq = v_iq_cmd * (v_dc / v_dc_ref)

# ★ AC→DC 커플링: 인버터가 DC링크에서 끌어가는 전류 (전력 보존)
p_inv = sp.Rational(3, 2) * (v_od*i_ld + v_oq*i_lq)
i_inv = p_inv / v_dc

# ── 계통 전압을 인버터 dq 프레임에서 본 값 (delta가 여기서 작용) ──
v_gd = Vg * sp.cos(delta)
v_gq = -Vg * sp.sin(delta)

Lg_t, Rg_t = L2 + Lg, R2 + Rg                       # 필터 + 계통 등가

# ══════════════════════════════════════════════
# 3. 상태방정식 f(x,u)
# ══════════════════════════════════════════════

f = sp.zeros(N, 1)

# ── DC측 8 ──
f[0] = (i_pv - i_Lpv) / C_pv                                   # v_pv
f[1] = (v_pv - (1 - d_pv) * v_dc) / L_pv                       # i_Lpv
f[2] = e_vpv                                                   # x_vpv
f[3] = e_ipv                                                   # x_ipv
f[4] = ((1 - d_pv)*i_Lpv + (1 - d_ess)*i_Less - i_inv) / C_dc  # v_dc  ★AC→DC
f[5] = (V_b - (1 - d_ess) * v_dc) / L_ess                      # i_Less
f[6] = e_vdc                                                   # x_vdc
f[7] = e_iess                                                  # x_iess

# ── AC측 14 ──
f[8]  = dw                                                     # delta
f[9]  = ((Pref - Pf) / w0 - Dp * dw) / J                       # dw
f[10] = wc * (sp.Rational(3,2)*(v_od*i_od + v_oq*i_oq) - Pf)   # Pf
f[11] = wc * (sp.Rational(3,2)*(v_oq*i_od - v_od*i_oq) - Qf)   # Qf
f[12] = v_od_ref - v_od                                        # phi_d
f[13] = v_oq_ref - v_oq                                        # phi_q
f[14] = i_ld_ref - i_ld                                        # gam_d
f[15] = i_lq_ref - i_lq                                        # gam_q
f[16] = (v_id - v_od - R1*i_ld + w0*L1*i_lq) / L1              # i_ld  ★DC→AC
f[17] = (v_iq - v_oq - R1*i_lq - w0*L1*i_ld) / L1              # i_lq  ★DC→AC
f[18] = (i_ld - i_od + w0*Cf*v_oq) / Cf                        # v_od
f[19] = (i_lq - i_oq - w0*Cf*v_od) / Cf                        # v_oq
f[20] = (v_od - v_gd - Rg_t*i_od + w0*Lg_t*i_oq) / Lg_t        # i_od
f[21] = (v_oq - v_gq - Rg_t*i_oq - w0*Lg_t*i_od) / Lg_t        # i_oq

# ══════════════════════════════════════════════
# 4. 야코비안
# ══════════════════════════════════════════════

A_sym = f.jacobian(X)
B_sym = f.jacobian(U)

ALL_SYMS = list(_s) + list(U) + [
    Kp_vpv, Ki_vpv, Kp_ipv, Ki_ipv, Kp_vdc, Ki_vdc, Kp_iess, Ki_iess,
    J, Dp, wc, nq, Kpv, Kiv,
    C_pv, L_pv, C_dc, L_ess, L1, R1, Cf, L2, R2, Lg, Rg, w0,
    Kpc, Kic, Lv, V_ref, v_dc_ref, I0, nVt,
]


def lambdify_all():
    """f, A, B를 수치 함수로 변환. 인수 순서는 ALL_SYMS."""
    return (sp.lambdify(ALL_SYMS, f, 'numpy'),
            sp.lambdify(ALL_SYMS, A_sym, 'numpy'),
            sp.lambdify(ALL_SYMS, B_sym, 'numpy'))


def coupling_report():
    """DC-AC 커플링 블록이 양방향으로 살아있는지 심볼 수준에서 확인."""
    dc2ac = [(i, j) for i in range(N_DC, N) for j in range(N_DC)
             if A_sym[i, j] != 0]
    ac2dc = [(i, j) for i in range(N_DC) for j in range(N_DC, N)
             if A_sym[i, j] != 0]
    return dc2ac, ac2dc


if __name__ == '__main__':
    print(f"상태변수 {N}개 (DC {N_DC} + AC {N_AC})")
    d2a, a2d = coupling_report()
    print(f"\nDC→AC 커플링 (좌하단) 비영 원소: {len(d2a)}개")
    for i, j in d2a:
        print(f"  ∂{STATE_NAMES[i]}/∂{STATE_NAMES[j]}")
    print(f"\nAC→DC 커플링 (우상단) 비영 원소: {len(a2d)}개")
    for i, j in a2d:
        print(f"  ∂{STATE_NAMES[i]}/∂{STATE_NAMES[j]}")
    assert d2a and a2d, "커플링이 단방향 → 블록삼각 → 고유값에 반영 안 됨"
    print("\n✅ 양방향 커플링 확인 — 블록삼각 아님")