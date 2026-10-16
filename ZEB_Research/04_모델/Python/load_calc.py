"""
load_calc.py — 부하 집계·피상전력·용량여유 계산식 (석사 ZEB, 목차 3.4 / 부록 D)

설계자료가 이 PC 에 0건이고 EnergyPlus 도 없다 (관리대장 차단요인 B-1·B-2).
그래서 **수치가 아니라 산식을 먼저 둔다.** 대장 §6-7 이 지목한 범위다 —
"부하율·용량여유율·피상전력 산식은 설계자료 없이도 정의할 수 있다".

─────────────────────────────────────────────────────────────────────
이 파일이 겨누는 쟁점 — V-02
─────────────────────────────────────────────────────────────────────
대장 §3 의 검증항목 V-02:

    TR4 부하계산에서 PV 119.6 kW 를 피상전력 kVA 에서 차감한 산식의
    기술적 타당성 (역률·접속위치·시간별 출력)

**kVA 에서 kW 를 뺀다.** 차원이 다른 둘을 빼는 것이고, 두 가지가 숨는다.

1. **무효전력을 빼먹는다.** PV 가 P 만 줄여도 Q 는 그대로 남는다.
   올바른 계산은 복소전력에서 빼고 크기를 다시 내는 것이다.

       설계서:  S' = S - P_pv                    (kVA - kW)
       올바름:  S' = |(P - P_pv) + jQ|
                   = sqrt((P - P_pv)^2 + Q^2)

   어느 쪽이 큰가는 정해져 있다 — **설계서 쪽이 항상 작거나 같다.**
   즉 변압기가 실제로 받는 부하를 **작게 본다.** 여유율이 실제보다 크게
   나온다. 틀리는 방향이 안전한 쪽이 아니라 **위험한 쪽**이다.

2. **동시발생을 가정한다.** 최대부하 시각과 PV 최대출력 시각이 같다고
   보고 전량을 뺀다. 공공청사는 최대부하가 늦은 오후~저녁에 오는 경우가
   있고 그때 PV 출력은 이미 떨어진다. 시간별로 봐야 알 수 있다.

이 파일은 **두 방식을 나란히 계산**해서 차이를 수치로 낸다. 그게 논문이
주장할 것이고, 한쪽을 지우고 "올바른 값"만 내면 비교가 사라진다.

─────────────────────────────────────────────────────────────────────
값을 지어내지 않는다
─────────────────────────────────────────────────────────────────────
기본값을 두지 않는다. 역률도, 수용률도, 변압기 용량도 호출자가 준다.
설계도서를 아직 못 열었으므로(대장 §2) 여기에 기본값을 박으면 그 값이
논문까지 흘러간다. 인자를 안 주면 돈다 — 가 아니라 **터진다.**

`--demo` 로 나오는 수치는 **형식 확인용 예시**이고 실제 사례값이 아니다.
전사본에 적힌 TR1~TR4 값은 전부 `미확인` 이다 (대장 §2).

검증상태 어휘는 대장·일지와 같은 다섯 개만 쓴다:
    원문 확인 · 교차검증 완료 · 불일치 · 연구 가정 · 미확인

실행:
    python ZEB_Research/04_모델/Python/load_calc.py --demo
    python ZEB_Research/04_모델/Python/load_calc.py --selftest

조연호 · 연세대 스마트그리드 연구실
"""

from __future__ import annotations

import argparse
import math
from dataclasses import dataclass, field

VERIF_STATES = ('원문 확인', '교차검증 완료', '불일치', '연구 가정', '미확인')


def _check_state(s):
    if s not in VERIF_STATES:
        raise ValueError(f'검증상태는 {VERIF_STATES} 중 하나여야 한다: {s!r}')
    return s


# ─────────────────────────────────────────────────────────────────────
# 기본 환산
# ─────────────────────────────────────────────────────────────────────

def apparent_from_active(P_kW, pf):
    """유효전력과 역률에서 피상전력. S = P / pf [kVA]."""
    if not 0 < pf <= 1:
        raise ValueError(f'역률은 (0, 1] 이어야 한다: {pf}')
    return P_kW / pf


def reactive_from_active(P_kW, pf):
    """유효전력과 역률에서 무효전력. Q = P·tan(acos(pf)) [kvar]."""
    if not 0 < pf <= 1:
        raise ValueError(f'역률은 (0, 1] 이어야 한다: {pf}')
    return P_kW * math.tan(math.acos(pf))


def pf_from_PQ(P_kW, Q_kvar):
    """P·Q 에서 역률. S=0 이면 정의되지 않는다 — None 을 준다."""
    S = math.hypot(P_kW, Q_kvar)
    return (P_kW / S) if S > 0 else None


# ─────────────────────────────────────────────────────────────────────
# 부하 집계
# ─────────────────────────────────────────────────────────────────────

@dataclass
class LoadItem:
    """부하 한 줄. 설비용량과 수용률을 따로 둔다 — 집계에서 둘을 섞으면
    나중에 어느 쪽이 바뀌었는지 복원할 수 없다."""
    name: str
    installed_kW: float          # 설비용량
    demand_factor: float         # 수용률 (0, 1]
    pf: float                    # 역률
    source: str = ''             # 어느 문서 몇 쪽에서 온 값인지
    verification: str = '미확인'  # 대장과 같은 다섯 어휘

    def __post_init__(self):
        _check_state(self.verification)
        if not 0 < self.demand_factor <= 1:
            raise ValueError(f'{self.name}: 수용률은 (0, 1] — {self.demand_factor}')
        if not 0 < self.pf <= 1:
            raise ValueError(f'{self.name}: 역률은 (0, 1] — {self.pf}')

    @property
    def P_kW(self):
        """최대수요전력 = 설비용량 × 수용률."""
        return self.installed_kW * self.demand_factor

    @property
    def Q_kvar(self):
        return reactive_from_active(self.P_kW, self.pf)


@dataclass
class Aggregate:
    """부하 집계 결과. P·Q 를 **따로 합산**하고 마지막에 크기를 낸다.

    피상전력을 그냥 더하면 안 된다 — 역률이 다른 부하들의 kVA 합은
    실제 합성 피상전력보다 크다. 여기서 크게 나오면 변압기를 과대
    선정하게 되고, 그건 V-02 와 반대 방향의 오차다.
    """
    P_kW: float
    Q_kvar: float
    diversity: float = 1.0       # 부등률 — 1.0 이면 적용 안 함
    items: list = field(default_factory=list)

    @property
    def S_kVA(self):
        return math.hypot(self.P_kW, self.Q_kvar) / self.diversity

    @property
    def pf(self):
        return pf_from_PQ(self.P_kW, self.Q_kvar)


def aggregate(items, diversity=1.0):
    """LoadItem 목록을 P·Q 로 합산한다. 부등률은 선택이고 기본은 미적용."""
    if not items:
        raise ValueError('집계할 부하가 없다 — 빈 목록으로 돌리지 않는다')
    if not 0 < diversity <= 1.0:
        raise ValueError(f'부등률은 (0, 1] — {diversity}')
    P = sum(i.P_kW for i in items)
    Q = sum(i.Q_kvar for i in items)
    return Aggregate(P_kW=P, Q_kvar=Q, diversity=diversity, items=list(items))


def naive_kVA_sum(items):
    """각 부하의 kVA 를 그냥 더한 값 — **틀린 방법**. 대조용으로만 둔다.

    집계표가 이 방식으로 쓰여 있으면 합성 역률이 반영되지 않은 것이다.
    aggregate() 결과와 비교해 차이를 보고하라고 남긴다.
    """
    return sum(apparent_from_active(i.P_kW, i.pf) for i in items)


# ─────────────────────────────────────────────────────────────────────
# V-02 — PV 차감 두 방식
# ─────────────────────────────────────────────────────────────────────

def pv_offset_designbook(S_load_kVA, P_pv_kW):
    """설계서 방식 — 피상전력에서 PV 유효전력을 그대로 뺀다.

        S' = S - P_pv        (kVA 에서 kW 를 뺀다)

    차원이 맞지 않는다. 재현을 위해 그대로 구현한다 — 비교 대상이다.
    """
    return S_load_kVA - P_pv_kW


def pv_offset_vector(P_load_kW, Q_load_kvar, P_pv_kW, Q_pv_kvar=0.0):
    """복소전력 방식 — P 에서 빼고 크기를 다시 낸다.

        S' = |(P_load - P_pv) + j(Q_load - Q_pv)|

    Q_pv 는 기본 0 이다. 인버터가 무효전력을 내면(역률제어·Volt-VAr)
    그 값을 넣는다. 넣지 않으면 '역률 1 운전' 이라는 **가정**이고,
    그 가정은 호출자가 기록해야 한다.
    """
    return math.hypot(P_load_kW - P_pv_kW, Q_load_kvar - Q_pv_kvar)


def compare_pv_offset(P_load_kW, Q_load_kvar, P_pv_kW, Q_pv_kvar=0.0):
    """두 방식을 나란히 계산하고 차이를 낸다.

    반환 dict:
        S_load        PV 차감 전 피상전력 [kVA]
        S_designbook  설계서 방식 결과 [kVA]
        S_vector      복소전력 방식 결과 [kVA]
        delta         벡터 - 설계서 [kVA]. 양수면 설계서가 작게 본 것
        conservative  설계서 방식이 보수적인가 (delta <= 0 이면 True)
    """
    S_load = math.hypot(P_load_kW, Q_load_kvar)
    S_db = pv_offset_designbook(S_load, P_pv_kW)
    S_vec = pv_offset_vector(P_load_kW, Q_load_kvar, P_pv_kW, Q_pv_kvar)
    delta = S_vec - S_db
    return {
        'S_load': S_load,
        'S_designbook': S_db,
        'S_vector': S_vec,
        'delta': delta,
        'delta_pct_of_vector': (delta / S_vec * 100.0) if S_vec > 0 else None,
        'conservative': delta <= 0.0,
    }


# ─────────────────────────────────────────────────────────────────────
# 용량여유·부하율
# ─────────────────────────────────────────────────────────────────────

def capacity_margin(S_tr_kVA, S_load_kVA):
    """변압기 용량여유율 [%]. (정격 - 부하) / 정격 × 100.

    음수면 과부하다. 숨기지 않고 음수 그대로 돌려준다.
    """
    if S_tr_kVA <= 0:
        raise ValueError(f'변압기 정격은 양수여야 한다: {S_tr_kVA}')
    return (S_tr_kVA - S_load_kVA) / S_tr_kVA * 100.0


def load_factor(P_series):
    """부하율 = 평균전력 / 최대전력. 시계열이 필요하다.

    8,760시간 계열이 오면 연 부하율이, 하루치가 오면 일 부하율이 된다.
    어느 기간인지는 호출자가 기록한다.
    """
    if len(P_series) == 0:
        raise ValueError('시계열이 비어 있다')
    pmax = max(P_series)
    if pmax <= 0:
        raise ValueError('최대전력이 0 이하다 — 부하율을 정의할 수 없다')
    return (sum(P_series) / len(P_series)) / pmax


def coincidence(P_load_series, P_pv_series):
    """최대부하와 PV 출력의 동시발생을 본다 — V-02 의 두 번째 쟁점.

    반환 dict:
        idx_peak        최대부하가 난 시각 인덱스
        P_load_peak     그때의 부하 [kW]
        P_pv_at_peak    **그때의** PV 출력 [kW]
        P_pv_max        PV 최대출력 [kW]
        ratio           P_pv_at_peak / P_pv_max. 1.0 이면 동시발생
        over_subtracted 설계서가 전량 차감했다면 과다차감분 [kW]

    설계계산서가 PV 정격(또는 최대출력)을 통째로 뺐다면, 실제로 깎이는
    것은 `P_pv_at_peak` 뿐이고 차이가 `over_subtracted` 다.
    """
    if len(P_load_series) != len(P_pv_series):
        raise ValueError('두 시계열의 길이가 다르다 — 시각이 안 맞는다')
    if len(P_load_series) == 0:
        raise ValueError('시계열이 비어 있다')
    idx = max(range(len(P_load_series)), key=lambda i: P_load_series[i])
    pv_at = P_pv_series[idx]
    pv_max = max(P_pv_series)
    return {
        'idx_peak': idx,
        'P_load_peak': P_load_series[idx],
        'P_pv_at_peak': pv_at,
        'P_pv_max': pv_max,
        'ratio': (pv_at / pv_max) if pv_max > 0 else None,
        'over_subtracted': pv_max - pv_at,
    }


# ─────────────────────────────────────────────────────────────────────
# 자가검증 — 산식이 맞는지 여기서 본다
# ─────────────────────────────────────────────────────────────────────

def selftest():
    ok = 0

    # 1. 환산 왕복
    P, pf = 800.0, 0.8
    S = apparent_from_active(P, pf)
    Q = reactive_from_active(P, pf)
    assert abs(S - 1000.0) < 1e-9, S
    assert abs(math.hypot(P, Q) - S) < 1e-9
    assert abs(pf_from_PQ(P, Q) - pf) < 1e-12
    ok += 1

    # 2. 설계서 방식은 항상 작거나 같다 (Q != 0 이면 반드시 작다)
    for Q_l in (0.0, 300.0, 600.0):
        for P_pv in (0.0, 100.0, 200.0):
            r = compare_pv_offset(800.0, Q_l, P_pv)
            assert r['delta'] >= -1e-9, r
            if Q_l > 0 and P_pv > 0:
                assert r['delta'] > 0, r          # 위험한 방향
                assert not r['conservative'], r
    ok += 1

    # 3. Q=0 이면 두 방식이 일치한다 — 경계 확인
    r = compare_pv_offset(800.0, 0.0, 200.0)
    assert abs(r['delta']) < 1e-9, r
    assert r['conservative'], r
    ok += 1

    # 4. kVA 단순합은 P·Q 합산보다 크거나 같다 (역률이 다르면 반드시 크다)
    items = [LoadItem('A', 500, 1.0, 0.80, verification='연구 가정'),
             LoadItem('B', 500, 1.0, 0.95, verification='연구 가정')]
    agg = aggregate(items)
    assert naive_kVA_sum(items) > agg.S_kVA, (naive_kVA_sum(items), agg.S_kVA)
    ok += 1

    # 5. 용량여유 — 과부하면 음수가 그대로 나온다
    assert abs(capacity_margin(1000, 900) - 10.0) < 1e-9
    assert capacity_margin(1000, 1100) < 0
    ok += 1

    # 6. 동시발생 — 부하 피크가 PV 피크와 어긋나면 과다차감이 잡힌다
    load = [10, 20, 50, 40, 90]
    pv = [0, 60, 100, 30, 5]
    c = coincidence(load, pv)
    assert c['idx_peak'] == 4, c
    assert abs(c['P_pv_at_peak'] - 5) < 1e-9
    assert abs(c['over_subtracted'] - 95) < 1e-9
    ok += 1

    # 7. 잘못된 입력은 터진다 — 조용히 넘어가지 않는다
    for bad in (lambda: apparent_from_active(100, 0.0),
                lambda: apparent_from_active(100, 1.5),
                lambda: capacity_margin(0, 100),
                lambda: aggregate([]),
                lambda: load_factor([]),
                lambda: coincidence([1, 2], [1]),
                lambda: LoadItem('X', 10, 1.0, 0.9, verification='확인됨')):
        try:
            bad()
        except (ValueError, ZeroDivisionError):
            pass
        else:
            raise AssertionError(f'터져야 하는데 안 터졌다: {bad}')
    ok += 1

    print(f'  자가검증 {ok}/7 통과')
    return ok


def demo():
    """형식 확인용. **실제 사례값이 아니다** — 대장 §2 의 전사본 수치는
    전부 `미확인` 이고 여기에 옮기지 않는다."""
    print('  ⚠ 아래 수치는 산식의 거동을 보이기 위한 예시다. 설계도서 값이 아니다.\n')

    P_load, pf_load, P_pv = 800.0, 0.80, 200.0
    Q_load = reactive_from_active(P_load, pf_load)
    r = compare_pv_offset(P_load, Q_load, P_pv)

    print(f'  부하 P={P_load:.0f} kW · 역률 {pf_load:.2f} → Q={Q_load:.1f} kvar · '
          f'S={r["S_load"]:.1f} kVA')
    print(f'  PV  P={P_pv:.0f} kW (역률 1 운전 가정 — Q_pv=0)\n')
    print(f'  {"설계서 방식  S - P_pv":<26}{r["S_designbook"]:>10.1f} kVA')
    print(f'  {"복소전력 방식 |(P-P_pv)+jQ|":<26}{r["S_vector"]:>10.1f} kVA')
    print(f'  {"차이 (벡터 - 설계서)":<26}{r["delta"]:>10.1f} kVA'
          f'   ({r["delta_pct_of_vector"]:.1f}% of 벡터값)')
    print(f'  설계서가 보수적인가: {r["conservative"]}'
          '   → False 면 부하를 작게 봐서 여유를 과대평가한 것이다\n')

    for S_tr in (1000.0, 1500.0):
        m_db = capacity_margin(S_tr, r['S_designbook'])
        m_vec = capacity_margin(S_tr, r['S_vector'])
        print(f'  변압기 {S_tr:>6.0f} kVA  여유율  설계서 {m_db:6.2f} %'
              f'   벡터 {m_vec:6.2f} %   차 {m_db - m_vec:5.2f} %p')

    print('\n  ── 동시발생 (예시 하루, 5구간) ──')
    load = [120.0, 300.0, 560.0, 640.0, 800.0]
    pv = [0.0, 120.0, 200.0, 90.0, 10.0]
    c = coincidence(load, pv)
    print(f'  최대부하 {c["P_load_peak"]:.0f} kW 시각의 PV 출력 = '
          f'{c["P_pv_at_peak"]:.0f} kW (PV 최대 {c["P_pv_max"]:.0f} kW, '
          f'비 {c["ratio"]:.2f})')
    print(f'  PV 최대출력을 통째로 차감했다면 과다차감 '
          f'{c["over_subtracted"]:.0f} kW')
    print(f'  일 부하율 = {load_factor(load):.3f}')


def main():
    ap = argparse.ArgumentParser(description='ZEB 부하·용량여유 계산식 (3.4 / 부록 D)')
    ap.add_argument('--demo', action='store_true', help='산식 거동 예시 (실제값 아님)')
    ap.add_argument('--selftest', action='store_true', help='산식 자가검증')
    a = ap.parse_args()
    if not (a.demo or a.selftest):
        ap.print_help()
        print('\n  설계자료가 아직 없다 (관리대장 B-2). 이 모듈은 산식만 제공하고'
              '\n  수치는 호출자가 준다 — 기본값을 두지 않는다.')
        return
    if a.selftest:
        selftest()
    if a.demo:
        demo()


if __name__ == '__main__':
    main()
