"""model.py → gfm_spec.json 내보내기 (gfm-live-flow 뷰어용)

뷰어는 이 JSON 하나만 읽어서 모델을 그대로 적분한다. 식은 sympy.jscode로 변환되므로
Python 모델과 브라우저 계산이 같은 식을 쓴다. 검증 벡터(check)로 뷰어가 f(x0)를 자체 대조한다.

사용:
    python export_spec.py                     # 기본: teach_model (예시)
    python export_spec.py --module model      # 연구 모델 — 아래 ADAPTER 부분을 model.py에 맞게 채울 것
    python export_spec.py --module model --out gfm_spec_22.json
"""
import argparse, datetime, importlib, json

import numpy as np
import sympy as sp
from scipy.optimize import fsolve
from sympy.printing.jscode import jscode

SIGNAL_SLOTS = ["w", "dw", "Pf", "Qf", "pe", "qe", "eP", "eQ", "dV", "Vref", "vod", "voq", "iod", "ioq",
                "ild", "ilq", "evd", "evq", "pvd", "pvq", "cvd", "cvq", "ildr", "ilqr", "ecd", "ecq",
                "pcd", "pcq", "ccd", "ccq", "vid", "viq"]
OPTIONAL_SLOTS = ["vdc", "ipv", "vpv", "ibat",
                  # DC 2단 캐스케이드 PI 의 중간량 — 블록도에서 각 단의 출력을 숫자로 보여준다.
                  # 없으면 그림에 라벨만 남고 값이 비어 '구조는 보이는데 숫자가 없는' 상태가 된다.
                  "evpv", "ilpvr", "dpv",      # PV:  전압오차 → 전류지령 → 듀티
                  "evdc", "ilessr", "dess"]    # ESS: 전압오차 → 전류지령 → 듀티
REQUIRED_STATES = ["w", "dl"]                    # 뷰어가 θ 적분·발산 감지에 사용


# ─────────────────────────── ADAPTER ───────────────────────────
# model.py의 구조에 맞게 이 함수만 고치면 된다. 반환 형식은 teach_model.py와 같아야 한다.
def load(module_name: str) -> dict:
    m = importlib.import_module(module_name)
    if module_name == "teach_model":
        return dict(states=m.STATES, inputs=m.INPUTS, params=m.PARAMS, rhs=m.RHS, signals=m.SIGNALS,
                    default_inputs=m.DEFAULT_INPUTS, state_info=m.STATE_INFO, param_info=m.PARAM_INFO)
    if module_name == "model":
        return _load_research(m)
    raise NotImplementedError(f"모르는 모듈: {module_name} (teach_model | model)")


def _load_research(m) -> dict:
    """22차 연구 모델(Simulation/model.py) → 뷰어 spec 재료. model.py 는 건드리지 않는다.

    뷰어와 모델의 규약이 세 군데 어긋나므로 여기서만 맞춘다.

      1) 상태 이름·단위
         뷰어는 ω를 pu 상태 `w`, 부하각을 `dl` 로 요구한다. 모델은 각주파수 편차
         `dw`[rad/s] 와 `delta`[rad] 를 쓴다. w = 1 + dw/w0 이므로
         dw → w0·(w−1) 로 치환하고, 그 행의 우변은 f[dw]/w0 로 나눈다.
         (대각 스케일링 = 닮음변환 → 고유값은 그대로. xcheck_spec.py 로 확인한다.)

      2) 계통 임피던스
         모델의 Rg·Lg 는 고정 파라미터다. 뷰어는 SCR·X/R 을 입력으로 돌리므로
         op.grid_RL() 과 같은 식을 심볼로 넣는다 — Zg=Z_base/SCR,
         Rg=Zg/√(1+XR²), Lg=Rg·XR/w0.

      3) 표시 단위
         모델은 SI(V·A·VA)다. 블록도 라벨은 pu 이므로 signals 만 정격으로 나눈다.
         적분은 SI 그대로 — 화면 숫자만 pu 다.
    """
    import numpy as _np
    import op as O                                   # 정격·고정값·동작점은 여기 한 곳에서만 온다

    S = sp.Symbol
    sym = lambda n: getattr(m, n)                    # noqa: E731 — 파라미터 기호는 반드시 모델 것을 쓴다
    #   (sympy 기호는 이름+가정으로 같고 다름이 갈린다. positive=True 로 만든 모델의 기호를
    #    real=True 로 다시 만들면 다른 기호가 되어 subs 도 free_symbols 검사도 어긋난다.)
    w, dl = S('w', real=True), S('dl', real=True)
    SCR, XR = S('SCR', positive=True), S('XR', positive=True)
    w0, w0v = sym('w0'), O.FIXED['w0']

    # ── 1) 상태 치환: delta→dl, dw→w0(w−1) ──
    sub = {m.delta: dl, m.dw: w0 * (w - 1)}
    idx_dw, idx_dl = m.STATE_NAMES.index('dw'), m.STATE_NAMES.index('delta')

    names, states = [], []
    for n in m.STATE_NAMES:
        nm = {'dw': 'w', 'delta': 'dl'}.get(n, n)
        names.append(nm)
        states.append(S(nm, real=True))

    # ── 2) 계통 임피던스를 SCR·X/R 로 ──
    Rg_e = (O.Z_BASE / SCR) / sp.sqrt(1 + XR**2)
    grid = {m.Rg: Rg_e, m.Lg: Rg_e * XR / w0}

    def T(e):                                        # 모델 식 → 뷰어 좌표
        return sp.sympify(e).subs(grid).subs(sub)

    rhs = [T(m.f[i]) for i in range(m.N)]
    rhs[idx_dw] = rhs[idx_dw] / w0                          # ẇ = dẇ/w0
    rhs[idx_dl] = T(m.f[idx_dl])                            # δ̇ = dw = w0(w−1)

    # ── 3) 파라미터 = 제어 14 + 고정 19 + 화면에서 안 건드리는 입력 3 ──
    params = {sym(k): v for k, v in {**O.FIXED, **O.CTRL}.items()}
    for k in ('Iph', 'v_pv_ref', 'V_b'):
        params[sym(k)] = O.INP[k]
    inputs = [m.Pref, m.Qref, m.Vg, SCR, XR]
    default_inputs = {'Pref': O.INP['Pref'], 'Qref': O.INP['Qref'], 'Vg': O.INP['Vg'],
                      'SCR': 3.0, 'XR': 3.0}

    # ── 표시용 정격 (op.nominals 과 같은 기준) ──
    Sb, Vb = O.INP['Pref'], O.FIXED['V_ref']
    Ib = Sb / (1.5 * Vb)
    pu = lambda e, b: T(e) / b                       # noqa: E731

    # 모델 안의 중간량을 그대로 가져와 슬롯에 붙인다 (식을 다시 쓰지 않는다)
    sig = {
        'w': w, 'dw': w - 1,
        'Pf': pu(m.Pf, Sb), 'Qf': pu(m.Qf, Sb),
        'pe': pu(sp.Rational(3, 2) * (m.v_od*m.i_od + m.v_oq*m.i_oq), Sb),
        'qe': pu(sp.Rational(3, 2) * (m.v_oq*m.i_od - m.v_od*m.i_oq), Sb),
        'eP': pu(m.Pref - m.Pf, Sb), 'eQ': pu(m.Qref - m.Qf, Sb),
        'dV': pu(-m.nq * (m.Qf - m.Qref), Vb), 'Vref': pu(m.v_od_ref, Vb),
        'vod': pu(m.v_od, Vb), 'voq': pu(m.v_oq, Vb),
        'iod': pu(m.i_od, Ib), 'ioq': pu(m.i_oq, Ib),
        'ild': pu(m.i_ld, Ib), 'ilq': pu(m.i_lq, Ib),
        'evd': pu(m.v_od_ref - m.v_od, Vb), 'evq': pu(m.v_oq_ref - m.v_oq, Vb),
        'pvd': pu(m.Kpv*(m.v_od_ref - m.v_od) + m.Kiv*m.phi_d, Ib),
        'pvq': pu(m.Kpv*(m.v_oq_ref - m.v_oq) + m.Kiv*m.phi_q, Ib),
        'cvd': pu(-m.w0*m.Cf*m.v_oq, Ib), 'cvq': pu(m.w0*m.Cf*m.v_od, Ib),
        'ildr': pu(m.i_ld_ref, Ib), 'ilqr': pu(m.i_lq_ref, Ib),
        'ecd': pu(m.i_ld_ref - m.i_ld, Ib), 'ecq': pu(m.i_lq_ref - m.i_lq, Ib),
        'pcd': pu(m.Kpc*(m.i_ld_ref - m.i_ld) + m.Kic*m.gam_d, Vb),
        'pcq': pu(m.Kpc*(m.i_lq_ref - m.i_lq) + m.Kic*m.gam_q, Vb),
        'ccd': pu(-m.w0*(m.L1 + m.Lv)*m.i_lq, Vb), 'ccq': pu(m.w0*(m.L1 + m.Lv)*m.i_ld, Vb),
        'vid': pu(m.v_id, Vb), 'viq': pu(m.v_iq, Vb),
        # DC 단 — 2단 구성이라 뷰어의 선택 슬롯이 여기서 살아난다
        'vdc': pu(m.v_dc, O.FIXED['v_dc_ref']), 'vpv': pu(m.v_pv, O.INP['v_pv_ref']),
        'ipv': pu(m.i_Lpv, Ib), 'ibat': pu(m.i_Less, Ib),
        # DC 2단 PI 의 중간량 — 모델의 식을 그대로 가져온다 (다시 쓰지 않는다).
        # PV 는 오차가 (측정 − 지령)이다. 전류를 더 끌면 PV 전압이 내려가므로
        # 그 반전을 오차 부호가 흡수한다 — ESS 의 (지령 − 측정)과 순서가 다르다.
        'evpv':   pu(m.e_vpv, O.INP['v_pv_ref']),
        'ilpvr':  pu(m.i_Lpv_rf, Ib),
        'dpv':    T(m.d_pv),                     # 듀티는 무차원 — 정격으로 나누지 않는다
        'evdc':   pu(m.e_vdc, O.FIXED['v_dc_ref']),
        'ilessr': pu(m.i_Less_rf, Ib),
        'dess':   T(m.d_ess),
    }

    # ── 동작점: fsolve 를 여기서 직접 돌리지 않고 검증된 op.solve_op 을 쓴다 ──
    x0_raw, ok, msg = O.solve_op(default_inputs['SCR'], default_inputs['XR'])
    if not ok:
        raise RuntimeError(f'동작점 수렴 실패 — spec 을 만들지 않습니다: {msg}')
    x0 = list(_np.asarray(x0_raw, float))
    x0[idx_dw] = 1.0 + x0_raw[idx_dw] / w0v                  # dw[rad/s] → w[pu]

    info = {
        'v_pv': ('v_pv', 'V'), 'i_Lpv': ('i_Lpv', 'A'), 'x_vpv': ('∫e_vpv', 'V·s'),
        'x_ipv': ('∫e_ipv', 'A·s'), 'v_dc': ('v_dc', 'V'), 'i_Less': ('i_Less', 'A'),
        'x_vdc': ('∫e_vdc', 'V·s'), 'x_iess': ('∫e_iess', 'A·s'),
        'dl': ('δ', 'rad'), 'w': ('ω', 'pu'), 'Pf': ('P (필터)', 'W'), 'Qf': ('Q (필터)', 'var'),
        'phi_d': ('∫e_vd', 'V·s'), 'phi_q': ('∫e_vq', 'V·s'),
        'gam_d': ('∫e_cd', 'A·s'), 'gam_q': ('∫e_cq', 'A·s'),
        'i_ld': ('i_ld', 'A'), 'i_lq': ('i_lq', 'A'), 'v_od': ('v_od', 'V'), 'v_oq': ('v_oq', 'V'),
        'i_od': ('i_od', 'A'), 'i_oq': ('i_oq', 'A'),
    }
    sliders = {                                     # PSO 대상 14개 중 동기화·전압 루프의 핵심
        'J':   ('관성 J', 'kg·m²', 0.1, 3.0),
        'Dp':  ('댐핑 Dp', 'N·m·s', 2.0, 80.0),
        'Kpv': ('전압 P 이득 Kpv', 'A/V', 0.005, 0.30),
        'Kiv': ('전압 I 이득 Kiv', 'A/(V·s)', 1.0, 60.0),
        'nq':  ('Q 드룹 nq', 'V/var', 1e-4, 5e-3),
        'wc':  ('전력 필터 ωc', 'rad/s', 6.28, 314.0),
    }
    return dict(states=states, inputs=inputs, params=params, rhs=rhs, signals=sig,
                default_inputs=default_inputs, state_info=info, param_info=sliders, x0=x0)
# ───────────────────────────────────────────────────────────────


def export(module_name: str, out: str):
    M = load(module_name)
    states, inputs, params, rhs = M["states"], M["inputs"], M["params"], M["rhs"]
    names = [str(s) for s in states]
    assert len(rhs) == len(states), f"rhs {len(rhs)}개 ≠ states {len(states)}개"
    for r in REQUIRED_STATES:
        assert r in names, f"상태 '{r}' 가 필요합니다 (ω: 'w', 부하각 δ: 'dl')"
    unknown = [k for k in M["signals"] if k not in SIGNAL_SLOTS + OPTIONAL_SLOTS]
    assert not unknown, f"알 수 없는 신호 슬롯: {unknown}"

    pnum = {k: float(sp.N(v)) for k, v in params.items()}
    free = set().union(*[e.free_symbols for e in rhs]) - set(states) - set(inputs) - set(params)
    assert not free, f"값이 없는 기호: {free}"

    # 운전점 x0 (기본 입력) — 검증 벡터 생성용
    u0 = M["default_inputs"]
    subs_u = {s: u0[str(s)] for s in inputs}
    f_num = sp.lambdify(states, [e.subs(pnum).subs(subs_u) for e in rhs], "numpy")
    if M.get("x0") is not None:
        # 어댑터가 이미 검증된 동작점 해석기(op.solve_op)로 푼 경우 — 22차 SI 모델은
        # 0 벡터에서 출발한 fsolve 가 수렴하지 않으므로 그 결과를 그대로 쓴다.
        x0 = np.asarray(M["x0"], float)
        r = float(np.max(np.abs(f_num(*x0))))
        print(f"  동작점: 어댑터 제공 (max|f(x0)| = {r:.3e})")
    else:
        guess = np.zeros(len(states)); guess[names.index("w")] = 1.0
        for n in ("vod",):
            if n in names: guess[names.index(n)] = 1.0
        x0, info, ier, msg = fsolve(lambda x: f_num(*x), guess, full_output=True)
        if ier != 1:
            print("⚠ 운전점 수렴 실패 — 검증 벡터는 초기 추정값으로 생성:", msg); x0 = guess
    rng = np.random.default_rng(0)
    xc = x0 + 0.01 * rng.standard_normal(len(x0))     # 운전점 근처 임의 점
    fc = np.array(f_num(*xc), dtype=float)

    to_js = lambda e: jscode(sp.sympify(e))
    spec = {
        "format": "gfm-live-flow/spec@1",
        "name": module_name,
        "exported_at": datetime.datetime.now().isoformat(timespec="seconds"),
        "states": [{"name": n, "label": M.get("state_info", {}).get(n, (n, ""))[0],
                    "unit": M.get("state_info", {}).get(n, (n, ""))[1]} for n in names],
        "inputs": {str(s): float(u0[str(s)]) for s in inputs},
        "params": {str(k): v for k, v in pnum.items()},
        "sliders": {k: {"label": v[0], "unit": v[1], "min": v[2], "max": v[3]} for k, v in M.get("param_info", {}).items()},
        "rhs": [to_js(e) for e in rhs],
        "signals": {k: to_js(v) for k, v in M["signals"].items()},
        "x0": [float(v) for v in x0],
        "check": {"x": [float(v) for v in xc], "inputs": {str(s): float(u0[str(s)]) for s in inputs},
                  "f": [float(v) for v in fc], "tol": 1e-8},
    }
    json.dump(spec, open(out, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"✓ {out}: 상태 {len(names)}개, 파라미터 {len(pnum)}개, 신호 {len(spec['signals'])}개")
    missing = [s for s in SIGNAL_SLOTS if s not in spec["signals"]]
    if missing: print("  표시 안 되는 슬롯:", ", ".join(missing))


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--module", default="teach_model")
    ap.add_argument("--out", default="gfm_spec.json")
    a = ap.parse_args()
    export(a.module, a.out)
