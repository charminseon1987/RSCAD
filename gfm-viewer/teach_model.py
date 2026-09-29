"""교육용 14차 GFM 모델 (gfm-live-flow 기본 모델)을 sympy로 기술한 예시.
export_spec.py 가 요구하는 인터페이스(STATES, INPUTS, PARAMS, RHS, SIGNALS, DEFAULT_INPUTS)의 기준 구현."""
import sympy as sp

w, dl, Pf, Qf, xd, xq, gd, gq, ild, ilq, vod, voq, iod, ioq = sp.symbols(
    "w dl Pf Qf xd xq gd gq ild ilq vod voq iod ioq")
STATES = [w, dl, Pf, Qf, xd, xq, gd, gq, ild, ilq, vod, voq, iod, ioq]
STATE_INFO = {  # 표시용 이름·단위
    "w": ("ω", "pu"), "dl": ("δ", "rad"), "Pf": ("P (필터)", "pu"), "Qf": ("Q (필터)", "pu"),
    "xd": ("∫e_vd", "pu·s"), "xq": ("∫e_vq", "pu·s"), "gd": ("∫e_cd", "pu·s"), "gq": ("∫e_cq", "pu·s"),
    "ild": ("i_ld", "pu"), "ilq": ("i_lq", "pu"), "vod": ("v_od", "pu"), "voq": ("v_oq", "pu"),
    "iod": ("i_od", "pu"), "ioq": ("i_oq", "pu")}

Pref, Qref, Vg, SCR, XR = sp.symbols("Pref Qref Vg SCR XR")
INPUTS = [Pref, Qref, Vg, SCR, XR]
DEFAULT_INPUTS = {"Pref": 0.5, "Qref": 0.0, "Vg": 1.0, "SCR": 3.0, "XR": 5.0}

Lf, Rf, Cf, Lc, Rc, wc, nq, V0, kpv, kiv, kpc, kic, Ff, H, D, wb = sp.symbols(
    "Lf Rf Cf Lc Rc wc nq V0 kpv kiv kpc kic Ff H D wb")
PARAMS = {Lf: 0.05, Rf: 0.005, Cf: 0.05, Lc: 0.02, Rc: 0.002, wc: 2 * sp.pi * 10, nq: 0.05, V0: 1.0,
          kpv: 1.5, kiv: 10, kpc: 0.8, kic: 50, Ff: 0.75, H: 0.5, D: 60, wb: 2 * sp.pi * 60}
PARAM_INFO = {"H": ("관성 H", "s", 0.1, 6), "D": ("댐핑 D", "pu", 5, 150)}   # 슬라이더로 노출할 파라미터

Xg = 1 / SCR; Rg = Xg / XR; Lt = Lc + Xg; Rt = Rc + Rg
vgd = Vg * sp.cos(dl); vgq = -Vg * sp.sin(dl)
pe = vod * iod + voq * ioq; qe = voq * iod - vod * ioq
eP = Pref - Pf; eQ = Qref - Qf; dV = nq * eQ; Vref = V0 + dV
evd = Vref - vod; evq = -voq
pvd = kpv * evd + kiv * xd; pvq = kpv * evq + kiv * xq
cvd = -w * Cf * voq; cvq = w * Cf * vod
ildr = pvd + Ff * iod + cvd; ilqr = pvq + Ff * ioq + cvq
ecd = ildr - ild; ecq = ilqr - ilq
pcd = kpc * ecd + kic * gd; pcq = kpc * ecq + kic * gq
ccd = -w * Lf * ilq; ccq = w * Lf * ild
vid = pcd + vod + ccd; viq = pcq + voq + ccq

RHS = [(Pref - Pf - D * (w - 1)) / (2 * H),
       wb * (w - 1),
       wc * (pe - Pf), wc * (qe - Qf),
       evd, evq, ecd, ecq,
       wb / Lf * (vid - vod - Rf * ild + w * Lf * ilq),
       wb / Lf * (viq - voq - Rf * ilq - w * Lf * ild),
       wb / Cf * (ild - iod + w * Cf * voq),
       wb / Cf * (ilq - ioq - w * Cf * vod),
       wb / Lt * (vod - vgd - Rt * iod + w * Lt * ioq),
       wb / Lt * (voq - vgq - Rt * ioq - w * Lt * iod)]

# 블록도 선(wire)에 표시할 신호 — 키 이름은 뷰어의 고정 슬롯 (spec 문서 참조)
SIGNALS = dict(w=w, dw=w - 1, Pf=Pf, Qf=Qf, pe=pe, qe=qe, eP=eP, eQ=eQ, dV=dV, Vref=Vref,
               vod=vod, voq=voq, iod=iod, ioq=ioq, ild=ild, ilq=ilq, evd=evd, evq=evq,
               pvd=pvd, pvq=pvq, cvd=cvd, cvq=cvq, ildr=ildr, ilqr=ilqr, ecd=ecd, ecq=ecq,
               pcd=pcd, pcq=pcq, ccd=ccd, ccq=ccq, vid=vid, viq=viq)
