"""
sym.py - Phase 2: 21차 야코비안 (DC numpy + AC 수동 구성)
파라미터별 폴더로 결과 관리 — 덮어씌움 방지

저장 구조:
  results/
  ├── J0.50_Dp20.0_Kpv1.0_wc31.4/   ← 파라미터별 폴더
  │   ├── A_num_SCR3.0.npy
  │   ├── A_num_SCR1.5.npy
  │   ├── eigenvalue_results.json
  │   └── meta.json                  ← 파라미터·타임스탬프
  └── latest/                        ← 최신 실험 심링크(복사)

실행: python Simulation/sym.py [--J 0.62 --Dp 28]
조연호 · 연세대 스마트그리드 연구실
"""

import numpy as np
from scipy import linalg
import json, argparse, shutil
from pathlib import Path
from datetime import datetime

# ─────────────────────────────────────────────
# 파라미터 (CLI 인수 또는 기본값)
# ─────────────────────────────────────────────
parser = argparse.ArgumentParser(description='GFM 21차 야코비안 계산')
parser.add_argument('--J',   type=float, default=0.5,          help='가상 관성')
parser.add_argument('--Dp',  type=float, default=20.0,         help='댐핑')
parser.add_argument('--wc',  type=float, default=2*np.pi*10,   help='필터 차단주파수')
parser.add_argument('--Kpv', type=float, default=1.0,          help='전압 P이득')
parser.add_argument('--Kiv', type=float, default=50.0,         help='전압 I이득')
parser.add_argument('--Kpc', type=float, default=10.0,         help='전류 P이득')
parser.add_argument('--Kic', type=float, default=100.0,        help='전류 I이득')
parser.add_argument('--Lv',  type=float, default=0.02,         help='가상 인덕턴스')
args, _ = parser.parse_known_args()

J    = args.J
Dp   = args.Dp
wc   = args.wc
Kpv  = args.Kpv
Kiv  = args.Kiv
Kpc  = args.Kpc
Kic  = args.Kic
Lv   = args.Lv

# 기타 고정 파라미터
L1   = 0.05
Cf   = 0.02
R1   = 0.005
w0   = 2 * np.pi * 60

# ─────────────────────────────────────────────
# 폴더명 생성 (파라미터 → 식별 문자열)
# ─────────────────────────────────────────────
def make_run_name(J, Dp, Kpv, wc):
    return f"J{J:.2f}_Dp{Dp:.1f}_Kpv{Kpv:.1f}_wc{wc:.1f}"

run_name = make_run_name(J, Dp, Kpv, wc)
BASE_DIR = Path(__file__).parent.parent / 'results'
out_dir  = BASE_DIR / run_name
out_dir.mkdir(parents=True, exist_ok=True)

print("=" * 55)
print(f"  Phase 2: 21차 야코비안")
print(f"  파라미터: J={J}, Dp={Dp}, Kpv={Kpv}, wc={wc:.1f}")
print(f"  저장: results/{run_name}/")
print("=" * 55)

# ─────────────────────────────────────────────
# DC 8×8
# ─────────────────────────────────────────────
def build_DC_8x8(SCR):
    A = np.diag([
        -0.5 - 0.3/SCR,
        -1.2 - 0.2*Kpv,
        -2.5 - 0.1*Kpc,
        -3.0 / SCR,
        -2.0,
        -4.0 / SCR,
        -5.0,
        -6.0,
    ])
    return A.astype(float)

# ─────────────────────────────────────────────
# AC 13×13
# ─────────────────────────────────────────────
def build_AC_13x13(SCR, XR=1.0):
    Zg   = 1.0 / SCR
    Rg   = Zg / np.sqrt(1 + XR**2)
    Xg   = Rg * XR
    Lg   = Xg / w0
    Id0  = 0.9; Iq0 = 0.1
    Vpcc = 1.0 - (Id0 * Rg + Iq0 * Xg)

    A = np.zeros((13, 13))
    A[0,0]=-Dp/J;    A[0,1]=-1/J
    A[1,1]=-wc;      A[1,9]=wc*Id0;   A[1,10]=wc*Iq0;  A[1,11]=wc*Vpcc
    A[2,2]=-wc;      A[2,9]=-wc*Iq0;  A[2,10]=wc*Id0;  A[2,12]=wc*Vpcc
    A[3,9]=-1;       A[4,10]=-1
    A[5,3]=Kiv;      A[5,7]=-1;       A[5,8]=-w0*Lv;   A[5,9]=-Kpv;  A[5,11]=1
    A[6,4]=Kiv;      A[6,8]=-1;       A[6,7]=w0*Lv;    A[6,10]=-Kpv; A[6,12]=1
    A[7,3]=Kpc*Kiv/L1; A[7,5]=Kic/L1
    A[7,7]=(-R1-Kpc)/L1; A[7,8]=(w0*L1-Kpc*w0*Lv)/L1
    A[7,9]=Kpc*(-Kpv)/L1; A[7,11]=Kpc/L1
    A[8,4]=Kpc*Kiv/L1; A[8,6]=Kic/L1
    A[8,8]=(-R1-Kpc)/L1; A[8,7]=-(w0*L1-Kpc*w0*Lv)/L1
    A[8,10]=Kpc*(-Kpv)/L1; A[8,12]=Kpc/L1
    A[9,7]=1/Cf;  A[9,10]=w0;  A[9,11]=-1/Cf
    A[10,8]=1/Cf; A[10,9]=-w0; A[10,12]=-1/Cf
    A[11,9]=1/Lg; A[11,11]=-Rg/Lg; A[11,12]=w0
    A[12,10]=1/Lg; A[12,11]=-w0;   A[12,12]=-Rg/Lg
    return A

# ─────────────────────────────────────────────
# 21×21 조립
# ─────────────────────────────────────────────
def build_jacobian_21(SCR, XR=1.0):
    idc0  = 0.9 / SCR
    A_DC  = build_DC_8x8(SCR)
    A_AC  = build_AC_13x13(SCR, XR)
    A_num = np.block([
        [A_DC,          np.zeros((8,13))],
        [np.zeros((13,8)), A_AC         ],
    ])
    A_num[8, 5] = idc0 / (J * w0)   # DC-AC 커플링
    return A_num, idc0

def analyze(A_num):
    eigs  = linalg.eigvals(A_num)
    max_re = float(np.max(eigs.real))
    stable = max_re < 1e-4
    osc   = [e for e in eigs if abs(e.imag) > 0.5 and e.imag > 0]
    zetas = [-e.real / abs(e) for e in osc] if osc else [0.0]
    freqs = sorted([abs(e.imag)/(2*np.pi) for e in osc]) if osc else [1.0]
    return stable, float(min(zetas)), float(freqs[0]), eigs

# ─────────────────────────────────────────────
# 메인 실행
# ─────────────────────────────────────────────
SCR_list = [3.0, 2.0, 1.5, 1.0]
XR_nom   = 1.0
results  = {}

print(f"\n  {'SCR':>5} {'stable':>8} {'zeta_min':>10} {'f_dom':>8} {'A_k(9,6)':>12}")
print("  " + "─" * 50)

for SCR in SCR_list:
    A_num, idc0 = build_jacobian_21(SCR, XR_nom)
    stable, zeta_min, f_dom, eigs = analyze(A_num)
    coup = float(A_num[8, 5])
    flag = "✅" if stable else "❌"

    results[SCR] = {
        'stable':   stable,
        'zeta_min': round(zeta_min, 4),
        'f_dom_hz': round(f_dom, 4),
        'coupling': round(coup, 8),
        'idc0':     round(idc0, 6),
        'eigenvalues': [
            {'re': round(float(e.real),4), 'im': round(float(e.imag),4)}
            for e in eigs
        ]
    }
    print(f"  SCR={SCR}: {flag} {str(stable):>7}  "
          f"zeta={zeta_min:.4f}  f={f_dom:.4f}Hz  A_k={coup:.6f}")

    # npy 저장
    np.save(out_dir / f'A_num_SCR{SCR}.npy', A_num)

# ─────────────────────────────────────────────
# eigenvalue_results.json 저장
# ─────────────────────────────────────────────
with open(out_dir / 'eigenvalue_results.json', 'w', encoding='utf-8') as f:
    json.dump({str(k): v for k, v in results.items()}, f, indent=2)

# ─────────────────────────────────────────────
# meta.json — 파라미터 + 타임스탬프 기록
# ─────────────────────────────────────────────
meta = {
    'run_name':  run_name,
    'timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
    'params': {
        'J': J, 'Dp': Dp, 'wc': round(wc,4),
        'Kpv': Kpv, 'Kiv': Kiv, 'Kpc': Kpc, 'Kic': Kic, 'Lv': Lv,
        'L1': L1, 'Cf': Cf, 'R1': R1,
    },
    'SCR_list':  SCR_list,
    'XR_nom':    XR_nom,
    'all_stable': all(v['stable'] for v in results.values()),
}
with open(out_dir / 'meta.json', 'w', encoding='utf-8') as f:
    json.dump(meta, f, indent=2, ensure_ascii=False)

# ─────────────────────────────────────────────
# latest/ 폴더 갱신 (최신 실험 복사)
# ─────────────────────────────────────────────
latest_dir = BASE_DIR / 'latest'
if latest_dir.exists():
    shutil.rmtree(latest_dir)
shutil.copytree(out_dir, latest_dir)

print(f"\n  📁 저장 완료: results/{run_name}/")
print(f"  📁 latest/   갱신됨 (app.py가 이걸 로드)")

# ─────────────────────────────────────────────
# 검증
# ─────────────────────────────────────────────
print(f"\n  ── A_k(9,6) 이론값 검증 ──")
for SCR in SCR_list:
    th   = (0.9/SCR) / (J * w0)
    ac   = results[SCR]['coupling']
    flag = "✅" if abs(th-ac)/th*100 < 1 else "❌"
    print(f"  SCR={SCR}: 이론={th:.6f}  계산={ac:.6f}  {flag}")

print(f"\n  ── ζ_threshold ──")
for SCR in SCR_list:
    f  = results[SCR]['f_dom_hz']
    zt = 4.0/(2*np.pi*f) if f > 0.01 else 0
    print(f"  SCR={SCR}: f_dom={f:.4f}Hz → ζ_th={zt:.4f}")

print(f"\n{'='*55}")
print(f"  ✅ 완료! ({run_name})")
print(f"{'='*55}")