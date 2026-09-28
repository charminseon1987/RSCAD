"""
quantize.py — 계측 양자화 주입

CHIL 에서 제어기는 연속값이 아니라 ADC 를 거친 계단값을 읽는다. 소신호 모델에는
없는 잡음원이며, 이것이 검증 가능한 최소 섭동을 정한다. 장비 없이도 SIL 에서
같은 효과를 넣어 허용치 하한을 미리 잴 수 있다.

어디에 넣는가
    plant  ──[ADC]──▶  controller
    제어기가 읽는 지점에만 넣는다. 적분기 8개는 DSP 내부 상태라 대상이 아니다.
    model.f(x, u) 안에 제어기가 들어 있으므로, f 에 들어가는 x 의 계측 성분만
    양자화한 래퍼를 쓴다.

사용
    import model as M, op, quantize as Q
    q  = Q.Quantizer.from_op(op, M, bits=12, headroom=1.5)
    fq = q.wrap(lambda x, u: M.f_num(x, u, ...))     # 적분에 이 함수를 쓴다
    ...
    print(q.report())        # 채널별 LSB, 클리핑 횟수

자기 시험
    python Simulation/quantize.py

조연호 · 연세대 스마트그리드 연구실
"""

from __future__ import annotations

import numpy as np

# 제어기 내부 적분기 — DSP 안에 있으므로 ADC 를 거치지 않는다
INTEGRATOR_STATES = ('x_vpv', 'x_ipv', 'x_vdc', 'x_iess',
                     'phi_d', 'phi_q', 'gam_d', 'gam_q')

# VSG 제어기가 스스로 계산하는 상태 — 역시 DSP 안이다.
# 계측 대상은 플랜트에서 센서로 읽는 값뿐이다.
CONTROLLER_STATES = ('delta', 'dw', 'Pf', 'Qf')


class Quantizer:
    """중간 계단(mid-tread) 균일 양자화기.

    q(v) = clip(round(v / LSB) * LSB, -FS, +FS),  LSB = 2·FS / 2^bits

    Attributes
    ----------
    lsb : ndarray  채널별 계단 크기 (물리 단위)
    mask : ndarray(bool)  양자화할 상태 (계측 대상만 True)
    clips : ndarray(int)  채널별 포화 발생 횟수
    """

    def __init__(self, bits, full_scale, mask, names, offset=None, seed=None,
                 dither=0.0):
        self.bits = int(bits)
        self.fs = np.asarray(full_scale, dtype=float)
        self.mask = np.asarray(mask, dtype=bool)
        self.names = list(names)
        self.offset = np.zeros_like(self.fs) if offset is None else np.asarray(offset, float)
        self.lsb = np.where(self.mask, 2.0 * self.fs / (2 ** self.bits), 0.0)
        self.clips = np.zeros(len(self.fs), dtype=int)
        self.calls = 0
        # 디더는 계단 경계에 갇히는 것을 푸는 데 쓴다. 기본은 끈다 —
        # 켜면 결과가 실행마다 달라져 재현이 깨진다.
        self.dither = float(dither)
        self._rng = np.random.default_rng(seed)

    # ── 생성 ────────────────────────────────────────────────
    @classmethod
    def from_op(cls, op_mod, model_mod, bits=12, headroom=1.5, **kw):
        """설비 정격에서 풀스케일을 잡는다.

        headroom 은 정격 대비 여유 배수다. 작으면 과도에서 포화하고,
        크면 분해능을 낭비한다. 전압 1.5~2.0, 전류 2.0 안팎이 무난하다.
        """
        names = list(model_mod.STATE_NAMES)
        nom = np.asarray(op_mod.nominal_vector(), dtype=float)
        skip = set(INTEGRATOR_STATES) | set(CONTROLLER_STATES)
        mask = np.array([n not in skip and nom[i] > 0 for i, n in enumerate(names)])
        return cls(bits, np.abs(nom) * headroom, mask, names, **kw)

    # ── 동작 ────────────────────────────────────────────────
    def __call__(self, x):
        """계측 성분만 양자화한 벡터를 돌려준다. 원본은 건드리지 않는다."""
        x = np.asarray(x, dtype=float)
        out = x.copy()
        m = self.mask
        if not m.any():
            return out
        v = x[m] + self.offset[m]
        if self.dither:
            v = v + self._rng.uniform(-0.5, 0.5, v.shape) * self.lsb[m] * self.dither
        step = self.lsb[m]
        qv = np.round(v / step) * step
        hi = self.fs[m]
        over = np.abs(qv) > hi
        if over.any():
            idx = np.flatnonzero(m)[over]
            self.clips[idx] += 1
        qv = np.clip(qv, -hi, hi) - self.offset[m]
        out[m] = qv
        self.calls += 1
        return out

    def wrap(self, f):
        """f(x, u) 를 감싸 제어기가 계단값을 읽게 만든다."""
        def fq(x, u, *a, **kw):
            return f(self(x), u, *a, **kw)
        fq.__name__ = f'{getattr(f, "__name__", "f")}_q{self.bits}'
        return fq

    # ── 보고 ────────────────────────────────────────────────
    def resolution(self):
        """채널별 (이름, LSB, 정격 대비 %) — 양자화 대상만."""
        rows = []
        for i, n in enumerate(self.names):
            if not self.mask[i]:
                continue
            nom = self.fs[i]
            rows.append((n, self.lsb[i], self.lsb[i] / nom * 100))
        return rows

    def report(self):
        out = [f'  {self.bits}-bit, 호출 {self.calls}회, 양자화 채널 {int(self.mask.sum())}개',
               f"  {'상태':<8}{'1 LSB':>14}{'풀스케일 대비':>14}{'포화':>7}"]
        for i, n in enumerate(self.names):
            if not self.mask[i]:
                continue
            out.append(f'  {n:<8}{self.lsb[i]:>14.6g}{self.lsb[i]/self.fs[i]*100:>13.4f}%'
                       f'{self.clips[i]:>7}')
        if self.clips.any():
            bad = [self.names[i] for i in np.flatnonzero(self.clips)]
            out.append(f'  ⚠ 포화 발생: {", ".join(bad)} — headroom 을 올리거나 섭동을 줄일 것.')
            out.append('     포화는 비선형이므로 그 구간의 소신호 대조는 무효다.')
        return '\n'.join(out)


# ══════════════════════════════════════════════
def _self_test():
    """모델 없이 동작만 확인한다."""
    names = ['v_od', 'i_od', 'x_vdc', 'delta']
    nom = np.array([325.0, 20.5, 1.0, np.pi / 4])
    mask = np.array([True, True, False, False])
    q = Quantizer(12, nom * 1.5, mask, names)

    print('── 분해능 ──')
    for n, lsb, pct in q.resolution():
        print(f'  {n:<6} 1 LSB = {lsb:.4f}  ({pct:.4f}% of FS)')

    print('\n── 오차가 LSB/2 를 넘지 않는가 ──')
    rng = np.random.default_rng(0)
    worst = 0.0
    for _ in range(2000):
        x = np.array([rng.uniform(-400, 400), rng.uniform(-25, 25), 0.7, 0.6])
        e = np.abs(q(x) - x)[mask] / q.lsb[mask]
        worst = max(worst, e.max())
    print(f'  최대 오차 {worst:.4f} LSB   (0.5 이하여야 정상)')

    print('\n── 대상이 아닌 상태는 그대로인가 ──')
    x = np.array([100.0, 5.0, 0.7123456789, 0.61234567])
    y = q(x)
    print(f'  x_vdc {x[2]} → {y[2]}   delta {x[3]} → {y[3]}')

    print('\n── 포화 검출 ──')
    q2 = Quantizer(12, nom * 1.05, mask, names)
    for _ in range(5):
        q2(np.array([400.0, 30.0, 0, 0]))
    print(q2.report())

    print('\n── 비트수에 따른 바닥 ──')
    print(f"  {'bit':>5}{'v_od 1 LSB [V]':>18}{'0.5% 섭동이 차지하는 LSB':>28}")
    dv = 325.0 * 0.005 * 0.1          # 보수적 가정. 실제는 궤적에서 뽑을 것
    for b in (10, 12, 14, 16):
        qq = Quantizer(b, nom * 1.5, mask, names)
        lsb = qq.lsb[0]
        print(f'  {b:>5}{lsb:>18.4f}{dv/lsb:>28.1f}')


if __name__ == '__main__':
    _self_test()
