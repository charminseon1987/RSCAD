"""
GFM Research Flask Server
Phase 2: results/A_num_SCR*.npy 동적 로드 (sym.py 결과 사용)
Phase 1 fallback: numpy 근사 모델
"""
import numpy as np
from scipy import linalg
from flask import Flask, request, jsonify
from flask_cors import CORS
from pathlib import Path

app = Flask(__name__)
CORS(app)

# ─────────────────────────────────────
# Phase 2: sym.py 결과 동적 로드
# ─────────────────────────────────────
RESULTS_DIR = Path(__file__).parent / 'results'
SCR_PRESETS = [3.0, 2.0, 1.5, 1.0]

A_CACHE: dict = {}
ENGINE    = 'numpy'
RUN_META  = {}   # 현재 로드된 실험 메타 정보

def _load_precomputed(run_dir=None):
    """
    로드 우선순위:
      1) 지정된 run_dir
      2) results/latest/  (sym.py가 자동 갱신)
      3) results/ 루트     (구버전 호환)
    """
    global ENGINE, RUN_META
    A_CACHE.clear()

    # 탐색 경로 결정
    if run_dir:
        search = Path(run_dir)
    elif (RESULTS_DIR / 'latest').exists():
        search = RESULTS_DIR / 'latest'
    else:
        search = RESULTS_DIR

    # meta.json 로드
    meta_path = search / 'meta.json'
    if meta_path.exists():
        import json as _json
        RUN_META = _json.loads(meta_path.read_text(encoding='utf-8'))
    else:
        RUN_META = {'run_name': search.name, 'params': {}}

    # npy 로드
    loaded = []
    for scr in SCR_PRESETS:
        path = search / f'A_num_SCR{scr}.npy'
        if path.exists():
            A_CACHE[scr] = np.load(str(path))
            loaded.append(scr)

    if loaded:
        ENGINE = 'sympy+numpy'
        print(f"  ✅ SymPy 야코비안 로드: SCR={loaded}")
        print(f"     실험: {RUN_META.get('run_name','?')}")
        p = RUN_META.get('params', {})
        if p:
            print(f"     J={p.get('J')}, Dp={p.get('Dp')}, Kpv={p.get('Kpv')}")
    else:
        print(f"  ⚠️  results/*.npy 없음 → numpy 근사")
        print(f"     (python Simulation/sym.py 실행 후 재시작 또는 POST /api/reload)")

_load_precomputed()


# ─────────────────────────────────────
# 동적 A_num 선택
# ─────────────────────────────────────
def _get_A_num(SCR, XR, J, Dp, Kpv, Kpc, Lv, Kiv=100, Kic=50, wc=31.4):
    """
    1) results/*.npy가 있으면 가장 가까운 SCR 로드
       → 계통 임피던스(XR), 제어 파라미터(J,Dp,Kpv) 동적 반영
    2) 없으면 numpy 근사 fallback
    """
    w0 = 2 * np.pi * 60

    if A_CACHE:
        nearest = min(A_CACHE.keys(), key=lambda s: abs(s - SCR))
        A = A_CACHE[nearest].copy()   # 21×21 기반

        # ── 계통 임피던스 SCR·XR 동적 갱신 ──
        Zg   = 1.0 / SCR
        Rg   = Zg / np.sqrt(1 + XR**2)
        Xg   = Rg * XR
        Lg   = Xg / w0
        Id0  = 0.9; Iq0 = 0.1
        Vpcc = 1.0 - (Id0 * Rg + Iq0 * Xg)
        wc_  = 2 * np.pi * 10

        # iod(19), ioq(20) 행: 계통 임피던스
        A[19, 17] =  1.0 / Lg
        A[19, 19] = -Rg  / Lg
        A[19, 20] =  w0
        A[20, 18] =  1.0 / Lg
        A[20, 19] = -w0
        A[20, 20] = -Rg  / Lg

        # Pfilt(9) 행: Vpcc 갱신
        A[9,  17] = wc_ * Id0
        A[9,  18] = wc_ * Iq0
        A[9,  19] = wc_ * Vpcc

        # VSG(8) 행: J·Dp 갱신
        A[8, 8]  = -Dp / J
        A[8, 9]  = -1.0 / J
        A[9, 8]  =  wc_ * 0.02

        # DC-AC 커플링: SCR·J 갱신
        idc0 = 0.9 / SCR
        A[8, 5] = idc0 / (J * w0)

        return A, idc0, 'sympy+numpy'

    else:
        A, idc0 = build_jacobian(SCR, XR, J, Dp, Kpv, Kpc, Lv, Kiv, Kic, wc)
        return A, idc0, 'numpy'


# ─────────────────────────────────────
# numpy 근사 야코비안 (fallback)
# ─────────────────────────────────────
def build_jacobian(SCR, XR, J, Dp, Kpv, Kpc, Lv, Kiv=100, Kic=50, wc=31.4):
    w0   = 2 * np.pi * 60
    Zg   = 1.0 / (SCR * 1.0)
    Rg   = Zg / np.sqrt(1 + XR**2)
    Xg   = Rg * XR
    idc0 = 0.9 / SCR

    diag = [
        -0.5 - 0.3/SCR,
        -1.2 - 0.2*Kpv,
        -2.5 - 0.1*Kpc,
        -3.0/SCR,
        -2.0,
        -4.0/SCR,
        -5.0,
        -6.0,
        -(Dp/(2*J))*(1+0.5/SCR),
        -wc, -wc,
        -Kpv*8*(1+0.1/SCR), -Kpv*8*(1+0.1/SCR),
        -Kpc*20, -Kpc*20,
        -Kpc*50, -Kpc*50,
        -100.0, -100.0,
        -Rg*w0, -Rg*w0,
    ]
    A = np.diag(diag).astype(float)
    A[8, 5] = idc0 / (J * w0)
    A[8, 9] = -1.0 / J
    A[9, 8] =  wc * 0.02
    A[15,16]=  w0; A[16,15]= -w0
    A[17,18]=  w0; A[18,17]= -w0
    A[19,20]=  w0*Xg/Zg; A[20,19]= -w0*Xg/Zg
    return A, idc0


# ─────────────────────────────────────
# 고유값 분석
# ─────────────────────────────────────
def analyze_eigenvalues(eigs, J=0.5, Dp=20.0, wc=31.4, SCR=1.5, XR=1.0, Kpv=1.0):
    modes = []
    for e in eigs:
        if abs(e.imag) > 0.5 and e.imag > 0:
            z = -e.real / abs(e)
            f = abs(e.imag) / (2 * np.pi)
            modes.append({
                're': float(e.real), 'im': float(e.imag),
                'zeta': float(z), 'freq_hz': float(f)
            })
    modes.sort(key=lambda m: m['zeta'])
    stable   = bool(np.all(eigs.real < 0))
    zeta_min = min((m['zeta'] for m in modes), default=0.0)
    Zg = 1.0 / SCR
    f_coupling = float(np.clip(
        (1/(2*np.pi)) * np.sqrt(Kpv / (J * Zg)) * (1 + 0.3/XR), 0.1, 20.0
    ))
    critical_Dp = 2.0 * np.sqrt(J * wc)
    if Dp < critical_Dp:
        wn = np.sqrt(wc / J); zv = Dp / critical_Dp
        wd = wn * np.sqrt(1.0 - zv**2)
        f_dom = float(wd / (2 * np.pi))
        sig   = float(-zv * wn * (1 + 0.5/SCR))
        z_vsg = float(abs(sig) / np.sqrt(sig**2 + wd**2))
        modes.insert(0, {'re': sig, 'im': float(wd), 'zeta': z_vsg,
                          'freq_hz': f_dom, 'type': 'VSG 스윙'})
        zeta_min = min(zeta_min, z_vsg)
    else:
        f_dom = f_coupling
    return stable, zeta_min, f_dom, modes


# ─────────────────────────────────────
# API
# ─────────────────────────────────────

@app.route('/')
def index():
    return jsonify({
        'status': 'ok',
        'engine': ENGINE,
        'preloaded_SCR': list(A_CACHE.keys()),
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
        'engine': ENGINE,
        'preloaded_SCR': list(A_CACHE.keys()),
        'sympy_loaded': ENGINE == 'sympy+numpy',
        'note': 'sym.py 결과 자동 반영'
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

    # ★ 동적 A_num 선택
    A, idc0, eng = _get_A_num(SCR, XR, J, Dp, Kpv, Kpc, Lv, Kiv, Kic, wc)
    eigs = linalg.eigvals(A)
    stable, zeta_min, f_dom, modes = analyze_eigenvalues(
        eigs, J, Dp, wc, SCR, XR, Kpv
    )

    zeta_threshold = 4.0 / (2 * np.pi * f_dom) if f_dom > 0.01 else 0

    Vpv0_nom  = 400.0
    Vpv0_k    = Vpv0_nom * (1 - 0.083 * (3.0 - SCR))
    du_pv_pct = abs(Vpv0_k - Vpv0_nom) / Vpv0_nom * 100

    return jsonify({
        'status':   'ok',
        'engine':   eng,
        'SCR': SCR, 'XR': XR,
        'nearest_preloaded': min(A_CACHE.keys(), key=lambda s: abs(s-SCR)) if A_CACHE else None,
        'stable':   stable,
        'zeta_min': round(zeta_min, 6),
        'f_dom_hz': round(f_dom, 4),
        'zeta_threshold': round(zeta_threshold, 4),
        'coupling_A96':   round(float(A[8, 5]), 8),
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
            A, _, eng = _get_A_num(scr, xr, J, Dp, Kpv, Kpc, Lv, wc=wc)
            eigs = linalg.eigvals(A)
            stable, zeta_min, f_dom, _ = analyze_eigenvalues(
                eigs, J, Dp, wc, scr, xr, Kpv
            )
            results.append({
                'scr': scr, 'xr': xr,
                'zeta': round(zeta_min, 4),
                'stable': stable,
                'f_dom': round(f_dom, 3),
                'engine': eng
            })

    boundaries = {}
    for xr in XR_list:
        pts = sorted([r for r in results if r['xr']==xr], key=lambda p: p['scr'])
        bd  = next((p for p in pts if p['zeta'] >= 0.64), None)
        boundaries[str(xr)] = bd['scr'] if bd else None

    return jsonify({
        'status': 'ok',
        'engine': ENGINE,
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

    opt_params = {'J':0.62,'Dp':28.0,'wc':45.0,'Lv':0.12,
                  'Kpv':1.40,'Kiv':120.0,'Kpc':7.50,'Kic':65.0}

    validation = []
    for scr in SCR_list:
        A, _, _ = _get_A_num(scr, 1.0,
            opt_params['J'], opt_params['Dp'],
            opt_params['Kpv'], opt_params['Kpc'], opt_params['Lv'])
        eigs = linalg.eigvals(A)
        stable, zeta_min, f_dom, _ = analyze_eigenvalues(eigs)
        validation.append({
            'SCR': scr, 'stable': stable,
            'zeta_min': round(zeta_min, 4), 'f_dom': round(f_dom, 3)
        })

    return jsonify({
        'status': 'ok',
        'engine': ENGINE,
        'opt_params': opt_params,
        'convergence_history': history,
        'validation': validation,
        'N_final': 390,
        'note': '시뮬레이션 — 실제 PSO는 Phase 4에서 구현'
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
            'SCR': scr, 'Zg_pu': round(Zg_k,4),
            'Vpcc_pu': round(Vpcc_k,4), 'Vpv0_V': round(Vpv0_k,2),
            'idc0_pu': round(idc0_k,4), 'du_pv_pct': round(du_pv,2),
            'valid': du_pv < 5.0
        })
    return jsonify({'status':'ok','engine':ENGINE,'points':points})


@app.route('/api/reload', methods=['POST'])
def reload_matrices():
    """sym.py 재실행 후 .npy 파일 새로 로드.
    body: {"run": "J0.62_Dp28.0_Kpv1.4_wc45.0"}  ← 특정 실험 지정 (생략 시 latest)
    """
    d       = request.json or {}
    run     = d.get('run')
    run_dir = (RESULTS_DIR / run) if run else None
    _load_precomputed(run_dir)
    return jsonify({
        'status':        'ok',
        'engine':        ENGINE,
        'run_name':      RUN_META.get('run_name', '?'),
        'params':        RUN_META.get('params', {}),
        'preloaded_SCR': list(A_CACHE.keys()),
        'message':       '야코비안 행렬 재로드 완료'
    })


@app.route('/api/runs', methods=['GET'])
def list_runs():
    """results/ 폴더의 모든 실험 목록 반환"""
    import json as _json
    runs = []
    for d in sorted(RESULTS_DIR.iterdir()):
        if not d.is_dir() or d.name == 'latest':
            continue
        meta_path = d / 'meta.json'
        if meta_path.exists():
            meta = _json.loads(meta_path.read_text(encoding='utf-8'))
        else:
            meta = {'run_name': d.name}
        npy_count = len(list(d.glob('A_num_SCR*.npy')))
        runs.append({
            'run_name':  d.name,
            'timestamp': meta.get('timestamp', '?'),
            'params':    meta.get('params', {}),
            'npy_count': npy_count,
            'all_stable':meta.get('all_stable', None),
            'active':    d.name == RUN_META.get('run_name'),
        })
    return jsonify({
        'status':      'ok',
        'current_run': RUN_META.get('run_name', '?'),
        'runs':        runs,
        'total':       len(runs)
    })


if __name__ == '__main__':
    print("=" * 50)
    print("  GFM Research Flask Server")
    print(f"  엔진: {ENGINE}")
    print(f"  로드된 SCR: {list(A_CACHE.keys())}")
    print("  http://localhost:5000")
    print("=" * 50)
    app.run(host='0.0.0.0', port=5000, debug=True)