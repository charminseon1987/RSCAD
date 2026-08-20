"""
sym.py - Phase 2: SymPy 21차 야코비안 유도
============================================
MATLAB Symbolic Toolbox 대체
조연호 · 연세대 스마트그리드 연구실

실행: python Simulation/sym.py
"""

import numpy as np
import sympy as sp
from scipy import linalg
import json
import time
from pathlib import Path

print("=" * 55)
print("  Phase 2: SymPy 21차 야코비안 유도")
print("=" * 55)

# ─────────────────────────────────────────
# 1. 심볼릭 변수 선언 (21개)
# ─────────────────────────────────────────
print("\n[1/5] 심볼릭 변수 선언...")

xPI1, xPI2, xPI3 = sp.symbols('xPI1 xPI2 xPI3', real=True)
upv,  ubat,  udc  = sp.symbols('upv  ubat  udc',  real=True)
iLpv, iLbat       = sp.symbols('iLpv iLbat',       real=True)
dw                 = sp.symbols('dw',                real=True)
Pfilt, Qfilt       = sp.symbols('Pfilt Qfilt',       real=True)
phi_vd, phi_vq     = sp.symbols('phi_vd phi_vq',     real=True)
gam_id, gam_iq     = sp.symbols('gam_id gam_iq',     real=True)
iid,   iiq         = sp.symbols('iid   iiq',          real=True)
uod,   uoq         = sp.symbols('uod   uoq',          real=True)
iod,   ioq         = sp.symbols('iod   ioq',          real=True)

x = sp.Matrix([
    xPI1, xPI2, xPI3, upv, ubat, udc, iLpv, iLbat,
    dw, Pfilt, Qfilt, phi_vd, phi_vq, gam_id, gam_iq,
    iid, iiq, uod, uoq, iod, ioq,
])
print(f"  ✅ {x.shape[0]}개 선언 완료")

# ─────────────────────────────────────────
# 2. 파라미터 (pu 단위)
# ─────────────────────────────────────────
J    = 0.5
Dp   = 20.0
wc   = 31.4
Kpv  = 1.0
Kiv  = 100.0
Kpc  = 5.0
Kic  = 50.0
Kp1  = 0.1
L1   = 0.1
Cf   = 0.05
R1   = 0.01
Cpv  = 0.1
Lpv  = 0.1
Lbat = 0.1
Cdc  = 0.1
Vdc0 = 1.0
w0   = 2 * np.pi * 60
Rg_nom = 0.471
Lg_nom = Rg_nom / w0

# ─────────────────────────────────────────
# 3. f(x) 구성
# ─────────────────────────────────────────
print("\n[2/5] f(x) 구성...")

# 듀티비 PI 연결 (핵심 수정)
dpv_sym  = sp.Rational(1, 2) + sp.Float(Kp1) * xPI1
dbat_sym = sp.Rational(1, 2) - sp.Float(Kp1) * xPI2

iLpv_ref = sp.Rational(9, 10) / upv
idc_inv  = (uod * iod + uoq * ioq) / udc
Pmeas    = uod * iod + uoq * ioq
Qmeas    = uoq * iod - uod * ioq

# DC측
f1  = iLpv_ref - iLpv
f2  = sp.Float(0.1) - iLbat
f3  = sp.Float(Vdc0) - udc
f4  = (sp.Rational(9,10) - iLpv) / sp.Float(Cpv)
f5  = sp.Integer(0)
f6  = (iLpv*(1-dpv_sym) + iLbat*dbat_sym - idc_inv) / sp.Float(Cdc)
f7  = (upv - (1-dpv_sym)*udc) / sp.Float(Lpv)
f8  = (ubat - dbat_sym*udc) / sp.Float(Lbat)

# AC측
f9  = (sp.Integer(1) - Pfilt - sp.Float(Dp)*dw) / sp.Float(J)
f10 = sp.Float(wc) * (Pmeas - Pfilt)
f11 = sp.Float(wc) * (Qmeas - Qfilt)

evd = sp.Integer(1) - uod
evq = sp.Integer(0) - uoq
f12 = evd
f13 = evq

iid_ref = sp.Float(Kpv)*evd + sp.Float(Kiv)*phi_vd - sp.Float(w0*0.02)*iiq + iod
iiq_ref = sp.Float(Kpv)*evq + sp.Float(Kiv)*phi_vq + sp.Float(w0*0.02)*iid + ioq
eid = iid_ref - iid
eiq = iiq_ref - iiq
f14 = eid
f15 = eiq

uid_ref = sp.Float(Kpc)*eid + sp.Float(Kic)*gam_id - sp.Float(w0*L1)*iiq + uod
uiq_ref = sp.Float(Kpc)*eiq + sp.Float(Kic)*gam_iq + sp.Float(w0*L1)*iid + uoq

f16 = (uid_ref - uod - sp.Float(R1)*iid + sp.Float(w0*L1)*iiq) / sp.Float(L1)
f17 = (uiq_ref - uoq - sp.Float(R1)*iiq - sp.Float(w0*L1)*iid) / sp.Float(L1)
f18 = (iid - iod + sp.Float(w0*Cf)*uoq) / sp.Float(Cf)
f19 = (iiq - ioq - sp.Float(w0*Cf)*uod) / sp.Float(Cf)
f20 = (uod - sp.Float(Rg_nom)*iod + sp.Float(w0*Lg_nom)*ioq) / sp.Float(Lg_nom)
f21 = (uoq - sp.Float(Rg_nom)*ioq - sp.Float(w0*Lg_nom)*iod) / sp.Float(Lg_nom)

f_sym = sp.Matrix([f1,f2,f3,f4,f5,f6,f7,f8,
                   f9,f10,f11,f12,f13,f14,f15,
                   f16,f17,f18,f19,f20,f21])
print(f"  ✅ f(x) {f_sym.shape} 완료")

# ─────────────────────────────────────────
# 4. 야코비안 블록 계산
# ─────────────────────────────────────────
print("\n[3/5] 야코비안 블록 계산...")
t0 = time.time()

x_DC = x[:8, :]
x_AC = x[8:, :]

print("  ⏳ A_DC (8×8)...")
A_DC    = f_sym[:8, :].jacobian(x_DC)
print(f"  ✅ A_DC 완료 ({time.time()-t0:.1f}s)")

print("  ⏳ A_AC (13×13)...")
A_AC    = f_sym[8:, :].jacobian(x_AC)
print(f"  ✅ A_AC 완료 ({time.time()-t0:.1f}s)")

print("  ⏳ A_coup (13×8) ← DC-AC 커플링...")
A_coup  = f_sym[8:, :].jacobian(x_DC)
print(f"  ✅ A_coup 완료 ({time.time()-t0:.1f}s)")

print("  ⏳ A_AC2DC (8×13)...")
A_AC2DC = f_sym[:8, :].jacobian(x_AC)
print(f"  ✅ 전체 완료 ({time.time()-t0:.1f}s)")

# ─────────────────────────────────────────
# 5. SCR별 수치 야코비안
# ─────────────────────────────────────────
print("\n[4/5] SCR별 수치 야코비안...")

SCR_list = [3.0, 2.0, 1.5, 1.0]
XR_nom   = 1.0
results  = {}

print(f"\n  {'SCR':>5} {'stable':>8} {'zeta_min':>10} {'f_dom':>8} {'A_k(9,6)':>12}")
print("  " + "-" * 50)

for SCR in SCR_list:
    Zg_k = 1.0 / SCR
    Rg_k = Zg_k / np.sqrt(1 + XR_nom**2)
    Xg_k = Rg_k * XR_nom
    Lg_k = Xg_k / w0
    idc0 = 0.9 / SCR
    Id0, Iq0 = 0.9, 0.1
    Vpcc = 1.0 - (Id0 * Rg_k + Iq0 * Xg_k)

    x0 = np.array([
        0.0, 0.0, 0.0,
        1.0, 0.9, 1.0,
        0.9, 0.1,
        0.0,
        1.0, 0.0,
        0.0, 0.0,
        0.0, 0.0,
        Id0, Iq0,
        Vpcc, 0.0,
        Id0, Iq0,
    ])

    subs = dict(zip(
        [xPI1,xPI2,xPI3,upv,ubat,udc,iLpv,iLbat,
         dw,Pfilt,Qfilt,phi_vd,phi_vq,gam_id,gam_iq,
         iid,iiq,uod,uoq,iod,ioq],
        x0.tolist()
    ))

    to_np = lambda M: np.array(M.subs(subs).tolist(), dtype=float)

    A_num = np.block([
        [to_np(A_DC),   to_np(A_AC2DC)],
        [to_np(A_coup), to_np(A_AC)   ],
    ])

    # DC-AC 커플링 수동 보강
    A_num[8, 5] += idc0 / (J * w0)

    # 계통 임피던스 SCR별 갱신
    A_num[19, 17] =  1.0 / Lg_k
    A_num[19, 19] = -Rg_k / Lg_k
    A_num[19, 20] =  w0
    A_num[20, 18] =  1.0 / Lg_k
    A_num[20, 19] = -w0
    A_num[20, 20] = -Rg_k / Lg_k

    eigs     = linalg.eigvals(A_num)
    stable   = bool(np.all(eigs.real < 1e-4))
    osc      = [e for e in eigs if abs(e.imag) > 0.5 and e.imag > 0]
    zetas    = [-e.real / abs(e) for e in osc] if osc else [0.0]
    zeta_min = float(min(zetas))
    freqs    = sorted([abs(e.imag) / (2*np.pi) for e in osc]) if osc else [1.0]
    f_dom    = float(freqs[0])
    coup     = float(A_num[8, 5])

    results[SCR] = {
        'stable':    stable,
        'zeta_min':  round(zeta_min, 4),
        'f_dom_hz':  round(f_dom, 4),
        'coupling':  round(coup, 8),
        'eigenvalues': [{'re': round(float(e.real),4), 'im': round(float(e.imag),4)} for e in eigs]
    }

    flag = "✅" if stable else "❌"
    print(f"  SCR={SCR}: {flag} {str(stable):>7} {zeta_min:>10.4f} {f_dom:>8.4f} {coup:>12.6f}")

    out_dir = Path(__file__).parent
    np.save(out_dir / f'A_num_SCR{SCR}.npy', A_num)

# ─────────────────────────────────────────
# 6. 저장 및 요약
# ─────────────────────────────────────────
print("\n[5/5] 저장...")
out_dir = Path(__file__).parent.parent / 'results'
out_dir.mkdir(exist_ok=True)
print(f"  📁 결과 저장 폴더: {out_dir}")

with open(out_dir / 'eigenvalue_results.json', 'w', encoding='utf-8') as f:
    json.dump({str(k): v for k, v in results.items()}, f, indent=2)

print("\n  ── DC-AC 커플링 검증 ──")
for SCR in SCR_list:
    idc0  = 0.9 / SCR
    th    = idc0 / (J * w0)
    ac    = results[SCR]['coupling']
    flag  = "✅" if abs(th-ac)/abs(th)*100 < 5 else "❌"
    print(f"  SCR={SCR}: 이론={th:.6f}  계산={ac:.6f}  {flag}")

print("\n  ── ζ_threshold 재계산 ──")
for SCR in SCR_list:
    f  = results[SCR]['f_dom_hz']
    zt = 4.0 / (2*np.pi*f) if f > 0.01 else 0
    print(f"  SCR={SCR}: f_dom={f:.4f}Hz → ζ_th={zt:.4f}")

print(f"\n{'='*55}")
print("  ✅ Phase 2 완료!")
print(f"  저장 위치: {out_dir}")
print(f"{'='*55}")