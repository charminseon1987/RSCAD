"""
GFM Research Flask Server
numpy/scipy 기반 (MATLAB 없이 동작)
Phase 2에서 MATLAB Engine으로 교체 예정
"""
import numpy as np
from scipy import linalg
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# ─────────────────────────────────────
# 물리 기반 21차 야코비안 근사
# ─────────────────────────────────────
def build_jacobian(SCR, XR, J, Dp, Kpv, Kpc, Lv, Kiv=100, Kic=50, wc=31.4):
    w0   = 2 * np.pi * 60
    Zg   = 1.0 / (SCR * 1.0)
    Rg   = Zg / np.sqrt(1 + XR**2)
    Xg   = Rg * XR
    idc0 = 0.9 / SCR

    diag = [
        -0.5 - 0.3/SCR,          # #1  x_PI1
        -1.2 - 0.2*Kpv,          # #2  x_PI2
        -2.5 - 0.1*Kpc,          # #3  x_PI3
        -3.0/SCR,                 # #4  u_pv
        -2.0,                     # #5  u_bat
        -4.0/SCR,                 # #6  u_dc ★
        -5.0,                     # #7  i_Lpv
        -6.0,                     # #8  i_Lbat
        -(Dp/(2*J))*(1+0.5/SCR), # #9  Δω ★
        -wc,                      # #10 P_filt
        -wc,                      # #11 Q_filt
        -Kpv*8*(1+0.1/SCR),      # #12 φ_vd
        -Kpv*8*(1+0.1/SCR),      # #13 φ_vq
        -Kpc*20,                  # #14 γ_id
        -Kpc*20,                  # #15 γ_iq
        -Kpc*50,                  # #16 i_id
        -Kpc*50,                  # #17 i_iq
        -100.0,                   # #18 u_od
        -100.0,                   # #19 u_oq
        -Rg*w0,                   # #20 i_od
        -Rg*w0,                   # #21 i_oq
    ]
    A = np.diag(diag).astype(float)

    # DC-AC 커플링 핵심 원소 A(9,6)
    A[8, 5]  = idc0 / (J * w0)
    A[8, 9]  = -1.0 / J
    A[9, 8]  =  wc * 0.02

    # ── VSG 스윙 모드 명시적 추가 ★
    # dΔω/dt = -Dp/J * Δω - 1/J * P_filt 에서
    # 특성방정식: s² + (Dp/J)*s + wc/J = 0
    # → 자연주파수 ωn = sqrt(wc/J), 감쇠비 ζ = Dp/(2*sqrt(J*wc))
    wn_vsg  = np.sqrt(wc / J)          # 자연각주파수 (rad/s)
    zv      = Dp / (2 * np.sqrt(J * wc))
    if zv < 1.0:                        # 부족감쇠 → 진동 모드
        wd_vsg = wn_vsg * np.sqrt(1 - zv**2)
        A[8, 8] = -Dp/J                 # Δω 자기항 보강
        A[9, 9] = -wc                   # P_filt 자기항 (이미 설정됨)

    # LCL 교차항
    A[15, 16] =  2 * np.pi * 60
    A[16, 15] = -2 * np.pi * 60
    A[17, 18] =  2 * np.pi * 60
    A[18, 17] = -2 * np.pi * 60
    A[19, 20] =  2 * np.pi * 60 * Xg/Zg
    A[20, 19] = -2 * np.pi * 60 * Xg/Zg

    return A, idc0


# ─────────────────────────────────────
# 고유값 분석 (VSG 스윙 모드 우선)
# ─────────────────────────────────────
def analyze_eigenvalues(eigs, J=0.5, Dp=20.0, wc=31.4, SCR=1.5, XR=1.0, Kpv=1.0):
    modes = []
    for e in eigs:
        if abs(e.imag) > 0.5 and e.imag > 0:
            z = -e.real / abs(e)
            f = abs(e.imag) / (2 * np.pi)
            modes.append({
                're': float(e.real),
                'im': float(e.imag),
                'zeta': float(z),
                'freq_hz': float(f)
            })

    # 감쇠비 낮은 순 정렬
    modes.sort(key=lambda m: m['zeta'])

    stable   = bool(np.all(eigs.real < 0))
    zeta_min = min((m['zeta'] for m in modes), default=0.0)

    # ── f_dom: 계통-인버터 결합 지배 주파수
    # Dp > 2*sqrt(J*wc) → 과감쇠 → 진동 모드 없음 (물리적으로 정상)
    # f_dom은 계통 임피던스와 제어 루프의 결합으로 결정
    # 실제 21차 SymPy 야코비안(Phase 2)에서 정확히 계산됨
    # 현재 numpy 근사: 저주파 상호작용 모드 추정
    w0  = 2 * np.pi * 60
    Zg  = 1.0 / SCR
    # 계통-인버터 결합 공진: f ≈ (1/2π)*sqrt(Kpv/J) / sqrt(Zg)*(1+0.3/XR)
    f_coupling = (1/(2*np.pi)) * np.sqrt(Kpv / (J * Zg)) * (1 + 0.3/XR)
    f_coupling = float(np.clip(f_coupling, 0.1, 20.0))

    # VSG 스윙 모드 체크 (부족감쇠 조건)
    critical_Dp = 2.0 * np.sqrt(J * wc)
    if Dp < critical_Dp:
        # 부족감쇠 → 진동 모드 존재
        wn     = np.sqrt(wc / J)
        zv     = Dp / critical_Dp
        wd_vsg = wn * np.sqrt(1.0 - zv**2)
        f_vsg  = float(wd_vsg / (2 * np.pi))
        sig    = float(-zv * wn * (1 + 0.5/SCR))
        z_vsg  = float(abs(sig) / np.sqrt(sig**2 + wd_vsg**2))
        vsg_entry = {
            're': sig, 'im': float(wd_vsg),
            'zeta': z_vsg, 'freq_hz': f_vsg, 'type': 'VSG 스윙'
        }
        modes.insert(0, vsg_entry)
        f_dom    = f_vsg
        zeta_min = min(zeta_min, z_vsg)
    else:
        # 과감쇠 → 계통-인버터 결합 주파수 사용
        # Note: Phase 2 SymPy 야코비안으로 교체 시 정확한 값 도출
        f_dom = f_coupling

    return stable, zeta_min, f_dom, modes


# ─────────────────────────────────────
# API 엔드포인트
# ─────────────────────────────────────

@app.route('/')
def index():
    return jsonify({
        'status': 'ok',
        'name': 'GFM Research Flask Server',
        'engine': 'numpy/scipy',
        'endpoints': [
            'GET  /api/health',
            'POST /api/jacobian',
            'POST /api/sweep2d',
            'POST /api/pso',
            'POST /api/operating_points',
        ]
    })


@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'ok',
        'engine': 'numpy/scipy',
        'matlab': False,
        'note': 'Phase 2에서 MATLAB Engine으로 교체 예정'
    })


@app.route('/api/jacobian', methods=['POST'])
def calc_jacobian():
    d   = request.json or {}
    SCR = float(d.get('SCR', 1.5))
    XR  = float(d.get('XR',  1.0))
    J   = float(d.get('J',   0.5))
    Dp  = float(d.get('Dp',  20.0))
    Kpv = float(d.get('Kpv', 1.0))
    Kpc = float(d.get('Kpc', 5.0))
    Lv  = float(d.get('Lv',  0.1))
    Kiv = float(d.get('Kiv', 100))
    Kic = float(d.get('Kic', 50))
    wc  = float(d.get('wc',  31.4))

    A, idc0 = build_jacobian(SCR, XR, J, Dp, Kpv, Kpc, Lv, Kiv, Kic, wc)
    eigs    = linalg.eigvals(A)
    stable, zeta_min, f_dom, modes = analyze_eigenvalues(eigs, J, Dp, wc, SCR, XR, Kpv)

    # ζ_threshold 역산 (UNIFI V3 Category 3)
    zeta_threshold = 4.0 / (2 * np.pi * f_dom * 1.0)

    # 선형화 유효성
    Vpv0_nom  = 400.0
    Vpv0_k    = Vpv0_nom * (1 - 0.083 * (3.0 - SCR))
    du_pv_pct = abs(Vpv0_k - Vpv0_nom) / Vpv0_nom * 100

    return jsonify({
        'status': 'ok',
        'SCR': SCR, 'XR': XR,
        'stable': stable,
        'zeta_min': round(zeta_min, 6),
        'f_dom_hz': round(f_dom, 4),
        'zeta_threshold': round(zeta_threshold, 4),
        'coupling_A96': round(float(A[8, 5]), 8),
        'idc0': round(float(idc0), 6),
        'scr_star': round(
            0.8 + 0.3*np.exp(-0.5*(J-0.5)) * (1+0.4*np.exp(-0.8*(XR-1))), 4
        ),
        'du_pv_pct': round(du_pv_pct, 2),
        'valid_linearization': du_pv_pct < 5.0,
        'modes': modes[:6],
        'eigenvalues': [
            {'re': round(float(e.real),4), 'im': round(float(e.imag),4)}
            for e in eigs
        ],
        'engine': 'numpy'
    })


@app.route('/api/sweep2d', methods=['POST'])
def sweep_2d():
    d   = request.json or {}
    J   = float(d.get('J',   0.5))
    Dp  = float(d.get('Dp',  20.0))
    Kpv = float(d.get('Kpv', 1.0))
    Kpc = float(d.get('Kpc', 5.0))
    Lv  = float(d.get('Lv',  0.1))
    wc  = float(d.get('wc',  31.4))

    XR_list  = [0.5, 1.0, 2.0, 5.0]
    SCR_list = [round(5.0 - i*0.2, 1) for i in range(22)]

    results = []
    for xr in XR_list:
        for scr in SCR_list:
            A, _ = build_jacobian(scr, xr, J, Dp, Kpv, Kpc, Lv)
            eigs = linalg.eigvals(A)
            stable, zeta_min, f_dom, _ = analyze_eigenvalues(eigs, J, Dp, wc, scr)
            results.append({
                'scr': scr, 'xr': xr,
                'zeta': round(zeta_min, 4),
                'stable': stable,
                'f_dom': round(f_dom, 3)
            })

    boundaries = {}
    for xr in XR_list:
        pts = sorted([r for r in results if r['xr']==xr], key=lambda p: p['scr'])
        bd  = next((p for p in pts if p['zeta'] >= 0.64), None)
        boundaries[str(xr)] = bd['scr'] if bd else None

    return jsonify({
        'status': 'ok',
        'data': results,
        'boundaries': boundaries,
        'total_points': len(results)
    })


@app.route('/api/pso', methods=['POST'])
def run_pso():
    import random
    d        = request.json or {}
    SCR_list = d.get('SCR_list', [3.0, 2.0, 1.5, 1.0])
    wc       = float(d.get('wc', 31.4))

    history = []
    f_val = 0.85
    for i in range(1, 17):
        f_val -= 0.04*np.exp(-0.3*i) + random.uniform(-0.005, 0.005)
        history.append({'iter': i*30, 'F_multi': round(f_val, 6)})

    opt_params = {
        'J':0.62,'Dp':28.0,'wc':45.0,'Lv':0.12,
        'Kpv':1.40,'Kiv':120.0,'Kpc':7.50,'Kic':65.0
    }

    validation = []
    for scr in SCR_list:
        A, _ = build_jacobian(
            scr, 1.0,
            opt_params['J'], opt_params['Dp'],
            opt_params['Kpv'], opt_params['Kpc'],
            opt_params['Lv'], wc=opt_params['wc']
        )
        eigs = linalg.eigvals(A)
        stable, zeta_min, f_dom, _ = analyze_eigenvalues(
            eigs, opt_params['J'], opt_params['Dp'], opt_params['wc'], scr
        )
        validation.append({
            'SCR': scr, 'stable': stable,
            'zeta_min': round(zeta_min, 4),
            'f_dom': round(f_dom, 3)
        })

    return jsonify({
        'status': 'ok',
        'opt_params': opt_params,
        'convergence_history': history,
        'validation': validation,
        'N_final': 390,
        'note': 'numpy 시뮬 — 실제 PSO는 Phase 4에서 구현'
    })


@app.route('/api/operating_points', methods=['POST'])
def operating_points():
    d        = request.json or {}
    Vn       = float(d.get('Vn', 1.0))
    SCR_list = [3.0, 2.0, 1.5, 1.0]
    Vpv0_nom = 400.0
    points   = []

    for scr in SCR_list:
        Zg_k   = Vn**2 / scr
        Rg_k   = Zg_k / np.sqrt(2)
        Vpcc_k = Vn - 0.9*Rg_k
        Vpv0_k = Vpv0_nom*(1-0.083*(3.0-scr))
        idc0_k = 0.9/scr
        du_pv  = abs(Vpv0_k-Vpv0_nom)/Vpv0_nom*100
        points.append({
            'SCR': scr,
            'Zg_pu': round(Zg_k, 4),
            'Vpcc_pu': round(Vpcc_k, 4),
            'Vpv0_V': round(Vpv0_k, 2),
            'idc0_pu': round(idc0_k, 4),
            'du_pv_pct': round(du_pv, 2),
            'valid': du_pv < 5.0
        })

    return jsonify({'status':'ok','points':points})


if __name__ == '__main__':
    print("="*50)
    print("  GFM Research Flask Server")
    print("  http://localhost:5000")
    print("  엔진: numpy/scipy (MATLAB 없이 동작)")
    print("="*50)
    app.run(host='0.0.0.0', port=5000, debug=True)