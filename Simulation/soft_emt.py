# soft_emt.py — RSCAD EMT 엔진 대체
import numpy as np
from scipy.integrate import solve_ivp
import asyncio, time

class GFMSimulator:
    """
    RSCAD EMT 시뮬레이터 Python 구현
    타임스텝: 50μs 목표
    실시간성: 소프트웨어 근사 (논문: 'software emulation')
    """
    DT = 50e-6  # 50 μs

    def __init__(self, params):
        self.p = params
        self.x = np.zeros(21)   # 21차 상태변수
        self.t = 0.0
        self.log = []

    def nonlinear_f(self, t, x, SCR, XR):
        """3.1~3.4 비선형 동역학 방정식"""
        p = self.p
        w0 = 2*np.pi*60

        Zg = 1.0/(SCR*1.0)
        Rg = Zg/np.sqrt(1+XR**2)
        Xg = Rg*XR

        xPI1,xPI2,xPI3 = x[0:3]
        upv,ubat,udc   = x[3:6]
        iLpv,iLbat     = x[6:8]
        dw             = x[8]
        Pfilt,Qfilt    = x[9:11]
        phi_vd,phi_vq  = x[11:13]
        gam_id,gam_iq  = x[13:15]
        iid,iiq        = x[15:17]
        uod,uoq        = x[17:19]
        iod,ioq        = x[19:21]

        # DC측
        f1  = 0.9/upv - iLpv              # xPI1
        f2  = 0.0 - iLbat                 # xPI2
        f3  = 1.0 - udc                   # xPI3
        f4  = (0.9 - iLpv)/p['Cpv']      # upv
        f5  = 0.0                          # ubat
        f6  = (iLpv*0.5 - 0.9)/p['Cdc']  # udc ★
        f7  = (upv - 0.5*udc)/p['Lpv']   # iLpv
        f8  = (ubat - 0.5*udc)/p['Lbat'] # iLbat

        # AC측 (VSG 스윙)
        f9  = (1.0 - Pfilt - p['Dp']*dw)/p['J']   # dw ★
        f10 = p['wc']*(iod*uod+ioq*uoq - Pfilt)    # Pfilt
        f11 = p['wc']*(0.0 - Qfilt)                # Qfilt

        # 전압 루프
        evd = 1.0 - uod; evq = 0.0 - uoq
        f12 = evd; f13 = evq
        iid_ref = p['Kpv']*evd + p['Kiv']*phi_vd
        iiq_ref = p['Kpv']*evq + p['Kiv']*phi_vq

        # 전류 루프
        eid = iid_ref - iid; eiq = iiq_ref - iiq
        f14 = eid; f15 = eiq
        uid = p['Kpc']*eid + p['Kic']*gam_id
        uiq = p['Kpc']*eiq + p['Kic']*gam_iq

        # LCL 필터
        f16 = (uid - uod - p['R1']*iid + w0*p['L1']*iiq)/p['L1']
        f17 = (uiq - uoq - p['R1']*iiq - w0*p['L1']*iid)/p['L1']
        f18 = (iid - iod + w0*p['Cf']*uoq)/p['Cf']
        f19 = (iiq - ioq - w0*p['Cf']*uod)/p['Cf']
        f20 = (uod - Rg*iod + w0*Xg/w0*ioq)/p['Lg']
        f21 = (uoq - Rg*ioq - w0*Xg/w0*iod)/p['Lg']

        return [f1,f2,f3,f4,f5,f6,f7,f8,
                f9,f10,f11,f12,f13,f14,f15,
                f16,f17,f18,f19,f20,f21]

    def run_scenario(self, duration, SCR, XR, disturbance=None):
        """시나리오 실행 (예: 3상 단락 100ms)"""
        t_span = (0, duration)
        t_eval = np.arange(0, duration, self.DT)

        def f_with_dist(t, x):
            u = disturbance(t) if disturbance else None
            return self.nonlinear_f(t, x, SCR, XR)

        sol = solve_ivp(
            f_with_dist,
            t_span,
            self.x,
            method='RK45',
            t_eval=t_eval,
            max_step=self.DT*10
        )
        return sol.t, sol.y

    def sweep_88pt(self, params_pso):
        """88포인트 2D 스윕 — RSCAD 실험 대체"""
        from multiprocessing import Pool
        import mlx.core as mx

        XR_list  = [0.5, 1.0, 2.0, 5.0]
        SCR_list = [round(5.0-i*0.2,1) for i in range(22)]
        jobs = [(scr,xr) for xr in XR_list for scr in SCR_list]

        # Mac 멀티코어 병렬 처리
        with Pool() as pool:
            results = pool.starmap(self._single_point, jobs)

        return results

    def _single_point(self, SCR, XR):
        from scipy import linalg
        A = self._jacobian_numeric(SCR, XR)
        eigs = linalg.eigvals(A)
        osc = [e for e in eigs if abs(e.imag)>0.5 and e.imag>0]
        zeta = min([-e.real/abs(e) for e in osc], default=0)
        return {'scr':SCR,'xr':XR,'zeta':round(zeta,4),
                'stable':bool(np.all(eigs.real<0))}

    def _jacobian_numeric(self, SCR, XR):
        """수치 야코비안 (Phase 2에서 SymPy 결과로 교체)"""
        from app import build_jacobian
        A, _ = build_jacobian(SCR, XR, **self.p)
        return A