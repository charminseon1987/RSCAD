"""
pv_profile.py — 8,760시간 PV 발전량·부하 프로파일 (석사 ZEB, 목차 3.4 / 부록 D)

`load_calc.py` 가 산식을 두었고, 이 파일이 **시계열을 만든다.** 둘이 만나는
곳은 `load_calc.coincidence()` 다 — V-02 의 두 번째 쟁점(동시발생)을 실제
수치로 판정하는 자리.

설계자료(대장 B-2)가 없어도 이쪽은 돈다. PV 발전량은 위치·경사각·용량만
있으면 나오고 기상은 PVGIS 가 준다. **B-2 를 우회하는 길이다.**

─────────────────────────────────────────────────────────────────────
기상 — 두 갈래이고 지위가 다르다
─────────────────────────────────────────────────────────────────────
TMY (PVGIS)       실제 관측 기반 전형기상년. 구름이 들어 있다. **네트워크 필요.**
                  "전형" 이지 그 해 실측이 아니다 — 지위는 `연구 가정` 이다.
맑은하늘 (clearsky)  Ineichen 모델. 네트워크가 필요 없고 항상 같은 값이 나온다.
                  구름이 없으므로 **상한**이다. 실제보다 크게 나온다.
                  (울산 좌표에서 TMY GHI 가 맑은하늘의 76% 였다.)

어느 쪽을 썼는지 `weather_source` 로 박는다. 섞어 쓰고 나중에 구분 못 하는
일을 막는다. TMY 가 실패해도 **조용히 맑은하늘로 바꾸지 않는다** — 예외를
그대로 올린다. 기상이 바뀌면 결과의 지위가 바뀌기 때문이다.

─────────────────────────────────────────────────────────────────────
부하 프로파일 — 이건 `연구 가정` 이다. 그렇게 표시한다
─────────────────────────────────────────────────────────────────────
공공청사 실측 부하가 없다. EnergyPlus 도 없다 (대장 B-1). 그래서 부하는
**모수로 만든다** — 기저부하비·업무시간·주말비·계절가중을 호출자가 주고
결과에 그 모수를 통째로 달아 둔다.

**이 프로파일로 낸 수치는 논문의 결론이 될 수 없다.** 쓸 수 있는 것은
"동시발생이 구조적으로 어긋난다" 는 **정성적 주장**과, 실측이 왔을 때 돌릴
**절차**다. 모수를 바꿔 가며 민감도를 보는 데는 쓸 수 있다.

기본값을 두지 않는다 — `load_calc.py` 와 같은 원칙이다.

실행:
    python ZEB_Research/04_모델/Python/pv_profile.py --selftest
    python ZEB_Research/04_모델/Python/pv_profile.py --demo --clearsky
    python ZEB_Research/04_모델/Python/pv_profile.py --demo --lat 35.57 --lon 129.19

조연호 · 연세대 스마트그리드 연구실
"""

from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
import pandas as pd

import load_calc as LC

ROOT = Path(__file__).resolve().parents[3]
CACHE = ROOT / 'ZEB_Research' / '05_결과' / 'tmy'      # .gitignore 가 csv 를 뺀다


# ─────────────────────────────────────────────────────────────────────
# 기상
# ─────────────────────────────────────────────────────────────────────

def fetch_tmy(lat, lon, cache_dir=CACHE):
    """PVGIS TMY. 받은 것은 캐시한다 — 같은 좌표로 두 번 받지 않는다.

    반환 (df, meta). df 열: ghi, dni, dhi, temp_air 등.
    실패하면 예외를 그대로 올린다 — 조용히 맑은하늘로 바꾸지 않는다.
    """
    import pvlib

    cache_dir = Path(cache_dir)
    f = cache_dir / f'pvgis_tmy_{lat:.4f}_{lon:.4f}.csv'
    if f.is_file():
        df = pd.read_csv(f, index_col=0, parse_dates=True)
        return df, {'weather_source': 'PVGIS TMY (캐시)', 'cache': str(f)}

    out = pvlib.iotools.get_pvgis_tmy(lat, lon, map_variables=True)
    df = out[0]
    cache_dir.mkdir(parents=True, exist_ok=True)
    df.to_csv(f)
    return df, {'weather_source': 'PVGIS TMY (내려받음)', 'cache': str(f)}


def clearsky_weather(lat, lon, tz, altitude, year=2023):
    """맑은하늘 기상. 네트워크가 필요 없고 **상한**이다.

    기온은 모델이 주지 않는다 — 온도보정을 하려면 TMY 를 써라.
    """
    import pvlib

    loc = pvlib.location.Location(lat, lon, tz=tz, altitude=altitude)
    idx = pd.date_range(f'{year}-01-01', f'{year}-12-31 23:00', freq='h', tz=tz)
    cs = loc.get_clearsky(idx)
    return cs, {'weather_source': '맑은하늘 Ineichen (상한 — 구름 없음)'}


def poa_global(weather, lat, lon, tz, altitude, tilt, azimuth):
    """경사면 일사 [W/m²]. (poa, 시각 정렬된 weather) 를 돌려준다."""
    import pvlib

    loc = pvlib.location.Location(lat, lon, tz=tz, altitude=altitude)
    w = weather.copy()
    if w.index.tz is None:
        w.index = w.index.tz_localize('UTC').tz_convert(tz)
    elif str(w.index.tz) != str(tz):
        w.index = w.index.tz_convert(tz)
    sp = loc.get_solarposition(w.index)
    poa = pvlib.irradiance.get_total_irradiance(
        tilt, azimuth, sp['apparent_zenith'], sp['azimuth'],
        w['dni'], w['ghi'], w['dhi'])
    return poa['poa_global'].clip(lower=0.0), w


# ─────────────────────────────────────────────────────────────────────
# PV 발전
# ─────────────────────────────────────────────────────────────────────

def pv_ac_kW(poa, dc_kW, temp_air=None, gamma_pdc=-0.004, noct=45.0,
             inv_eff=0.96, dc_ac_ratio=1.1, soiling=0.98):
    """PVWatts 계열 간이 모델. [kW]

    dc_kW         직류 설치용량 [kWp]
    gamma_pdc     출력 온도계수 [1/°C]. 결정질 실리콘 통상 -0.004 근처
    noct          공칭 작동 셀온도 [°C]
    inv_eff       인버터 효율
    dc_ac_ratio   직교류비. AC 출력은 dc_kW/dc_ac_ratio 에서 잘린다
    soiling       오염·배선 손실 묶음

    `temp_air` 를 안 주면 **온도보정을 하지 않는다.** 맑은하늘 경로가 그렇고
    그때 출력은 더 크게 나온다 — 상한 위의 상한이다. meta 에 적는다.
    """
    G = np.asarray(poa, dtype=float)
    if temp_air is None:
        pdc = dc_kW * (G / 1000.0)
        temp_note = '온도보정 없음 (기온 미제공 — 출력이 과대평가된다)'
    else:
        Ta = np.asarray(temp_air, dtype=float)
        cell = Ta + (noct - 20.0) / 800.0 * G
        pdc = dc_kW * (G / 1000.0) * (1.0 + gamma_pdc * (cell - 25.0))
        temp_note = f'NOCT {noct:g}°C · γ {gamma_pdc:g}/°C'
    pdc = np.clip(pdc, 0.0, None) * soiling
    pac = np.minimum(pdc * inv_eff, dc_kW / dc_ac_ratio)
    meta = {'dc_kW': dc_kW, 'dc_ac_ratio': dc_ac_ratio, 'inv_eff': inv_eff,
            'soiling': soiling, 'temp_model': temp_note,
            'ac_clip_kW': dc_kW / dc_ac_ratio}
    return pd.Series(pac, index=getattr(poa, 'index', None)), meta


# ─────────────────────────────────────────────────────────────────────
# 부하 — 연구 가정
# ─────────────────────────────────────────────────────────────────────

def office_load_kW(index, peak_kW, base_ratio, open_hour, close_hour,
                   weekend_ratio, season_weight, hour_shape):
    """공공청사 부하 프로파일. **연구 가정이다.**

    peak_kW        연간 최대수요 [kW]
    base_ratio     기저부하 / 최대 (0,1) — 야간·주말에도 도는 몫
    open_hour      업무 시작 시 (0~23)
    close_hour     업무 종료 시 (open_hour < close_hour <= 24)
    weekend_ratio  주말 부하 / 평일 같은 시각 (0,1]
    season_weight  월별 가중 12개, (0,1]. 냉난방 계절성
    hour_shape     **시각별 가중 24개, (0,1].** 업무시간 안의 일중 형상

    `hour_shape` 를 왜 받는가 — 업무시간을 평탄하게 두면 최대부하가 업무시간
    **첫 시각**에 걸린다(동점 중 첫 번째). 그러면 동시발생 판정이 모형의
    산물이 된다. 실제 공공청사는 오후에 피크가 오는 경우가 많고, PV 는 그때
    이미 떨어진다 — 그 어긋남이 V-02 쟁점②의 핵심이므로 **피크 시각을
    가정이 아니라 입력으로 드러낸다.**

    모수를 전부 받는다. 기본값을 두지 않는 이유는 `load_calc.py` 와 같다 —
    여기 박아 둔 값이 논문 수치가 되는 일을 막는다.
    """
    if not 0 < base_ratio < 1:
        raise ValueError(f'기저부하비는 (0,1) — {base_ratio}')
    if not 0 <= open_hour < close_hour <= 24:
        raise ValueError(f'업무시간이 이상하다: {open_hour}~{close_hour}')
    if not 0 < weekend_ratio <= 1:
        raise ValueError(f'주말비는 (0,1] — {weekend_ratio}')
    sw = np.asarray(season_weight, dtype=float)
    if sw.shape != (12,):
        raise ValueError('season_weight 는 12개여야 한다')
    if sw.max() > 1.0 or sw.min() <= 0:
        raise ValueError('season_weight 는 (0,1] 범위여야 한다')
    hs = np.asarray(hour_shape, dtype=float)
    if hs.shape != (24,):
        raise ValueError('hour_shape 는 24개여야 한다')
    if hs.max() > 1.0 or hs.min() <= 0:
        raise ValueError('hour_shape 는 (0,1] 범위여야 한다')

    h = np.asarray(index.hour)
    mon = np.asarray(index.month)
    is_weekend = np.asarray(index.dayofweek) >= 5

    occupied = (h >= open_hour) & (h < close_hour)
    shape = np.where(occupied, hs[h], base_ratio)
    shape = np.where(is_weekend & occupied, hs[h] * weekend_ratio, shape)
    shape = np.where(is_weekend & ~occupied, base_ratio * weekend_ratio, shape)

    return pd.Series(peak_kW * shape * sw[mon - 1], index=index)


# ─────────────────────────────────────────────────────────────────────
# V-02 판정
# ─────────────────────────────────────────────────────────────────────

def assess(load_kW, pv_kW, pf_load, S_tr_kVA, P_pv_nameplate_kW):
    """시계열에서 V-02 를 판정한다. 산식은 load_calc 것을 그대로 쓴다."""
    c = LC.coincidence(list(load_kW), list(pv_kW))
    P_peak = c['P_load_peak']
    Q_peak = LC.reactive_from_active(P_peak, pf_load)

    # 설계서가 뺐다고 보는 값: PV 정격 전량
    r_nameplate = LC.compare_pv_offset(P_peak, Q_peak, P_pv_nameplate_kW)
    # 실제로 그 시각에 깎이는 값
    r_actual = LC.compare_pv_offset(P_peak, Q_peak, c['P_pv_at_peak'])

    return {
        'coincidence': c,
        'peak': {'P_kW': P_peak, 'Q_kvar': Q_peak, 'pf': pf_load},
        'offset_nameplate': r_nameplate,
        'offset_at_peak': r_actual,
        'margin': {
            '설계서(정격 전량 차감)': LC.capacity_margin(
                S_tr_kVA, r_nameplate['S_designbook']),
            '벡터(정격 전량 차감)': LC.capacity_margin(
                S_tr_kVA, r_nameplate['S_vector']),
            '벡터(그 시각 실제 PV)': LC.capacity_margin(
                S_tr_kVA, r_actual['S_vector']),
        },
        'load_factor_year': LC.load_factor(list(load_kW)),
    }


# ─────────────────────────────────────────────────────────────────────

def selftest():
    ok = 0
    idx = pd.date_range('2023-01-01', '2023-12-31 23:00', freq='h')
    sw = [1.0] * 12
    # 오후 피크 형상 — 14시가 최대
    hs = [0.4] * 24
    for h_, v_ in ((9, 0.7), (10, 0.8), (11, 0.9), (12, 0.75), (13, 0.85),
                   (14, 1.0), (15, 0.95), (16, 0.85), (17, 0.6)):
        hs[h_] = v_

    # 1. 부하 프로파일 — 길이·범위·주말이 평일보다 낮다
    L = office_load_kW(idx, 1000.0, 0.3, 9, 18, 0.5, sw, hs)
    assert len(L) == 8760, len(L)
    assert L.max() <= 1000.0 + 1e-9 and L.min() > 0
    wd = L[(idx.dayofweek < 5) & (idx.hour == 13)].mean()
    we = L[(idx.dayofweek >= 5) & (idx.hour == 13)].mean()
    assert we < wd, (we, wd)
    # 피크가 hour_shape 가 지정한 14시에 온다 — 업무시간 첫 시각이 아니다
    assert idx[int(np.argmax(L.to_numpy()))].hour == 14, idx[int(np.argmax(L.to_numpy()))]
    ok += 1

    # 2. 계절가중이 실제로 먹는다
    sw2 = [1.0 if m in (7, 8) else 0.5 for m in range(1, 13)]
    L2 = office_load_kW(idx, 1000.0, 0.3, 9, 18, 0.5, sw2, hs)
    assert L2[idx.month == 7].max() > L2[idx.month == 4].max()
    ok += 1

    # 3. PV — 일사 0 이면 출력 0, 클리핑이 걸린다
    poa = pd.Series([0.0, 500.0, 1000.0, 1200.0], index=pd.RangeIndex(4))
    pac, meta = pv_ac_kW(poa, dc_kW=100.0, dc_ac_ratio=1.1)
    assert pac.iloc[0] == 0.0
    assert pac.max() <= meta['ac_clip_kW'] + 1e-9
    assert pac.iloc[2] > pac.iloc[1]
    ok += 1

    # 4. 온도보정이 더운 날 출력을 줄인다
    #    클리핑을 피하려면 dc_ac_ratio 를 **작게** 줘야 한다 — 클립값이
    #    dc_kW/dc_ac_ratio 이므로 크게 주면 오히려 꽉 조인다.
    hot = pd.Series([35.0] * 4, index=poa.index)
    pac_t, mt = pv_ac_kW(poa, dc_kW=100.0, temp_air=hot, dc_ac_ratio=0.1)
    pac_n, mn = pv_ac_kW(poa, dc_kW=100.0, dc_ac_ratio=0.1)
    assert mt['ac_clip_kW'] > 500.0, mt      # 클리핑이 안 걸리는지 먼저 확인
    assert pac_t.iloc[2] < pac_n.iloc[2], (pac_t.iloc[2], pac_n.iloc[2])
    ok += 1

    # 5. assess — 어긋난 피크에서 과다차감이 잡히고, 여유율 순서가 지켜진다
    L3 = pd.Series([100.0, 200.0, 900.0], index=pd.RangeIndex(3))
    P3 = pd.Series([0.0, 150.0, 10.0], index=pd.RangeIndex(3))
    a = assess(L3, P3, pf_load=0.9, S_tr_kVA=1500.0, P_pv_nameplate_kW=150.0)
    assert a['coincidence']['over_subtracted'] == 140.0
    assert a['margin']['벡터(그 시각 실제 PV)'] < a['margin']['설계서(정격 전량 차감)']
    ok += 1

    # 6. 잘못된 모수는 터진다
    for bad in (lambda: office_load_kW(idx, 1000, 0.0, 9, 18, 0.5, sw, hs),
                lambda: office_load_kW(idx, 1000, 0.3, 18, 9, 0.5, sw, hs),
                lambda: office_load_kW(idx, 1000, 0.3, 9, 18, 1.5, sw, hs),
                lambda: office_load_kW(idx, 1000, 0.3, 9, 18, 0.5, [1.0] * 11, hs),
                lambda: office_load_kW(idx, 1000, 0.3, 9, 18, 0.5, sw, [1.0] * 23)):
        try:
            bad()
        except ValueError:
            pass
        else:
            raise AssertionError(f'터져야 하는데 안 터졌다: {bad}')
    ok += 1

    print(f'  자가검증 {ok}/6 통과')
    return ok


def demo(lat, lon, tz, altitude, tilt, azimuth, use_clearsky):
    print('  ⚠ 부하 프로파일은 연구 가정이다. 실측도 EnergyPlus 결과도 아니다.')
    print('     여기 수치를 논문 결론으로 쓸 수 없다 — 쓸 수 있는 것은 절차와')
    print('     "동시발생이 구조적으로 어긋난다" 는 정성적 주장이다.\n')

    if use_clearsky:
        w, wmeta = clearsky_weather(lat, lon, tz, altitude)
    else:
        w, wmeta = fetch_tmy(lat, lon)
    print(f'  기상: {wmeta["weather_source"]}   ({lat:.4f}, {lon:.4f})')

    poa, w = poa_global(w, lat, lon, tz, altitude, tilt, azimuth)
    temp = w['temp_air'] if (not use_clearsky and 'temp_air' in w) else None

    DC_KW = 120.0
    pac, pmeta = pv_ac_kW(poa, dc_kW=DC_KW, temp_air=temp)
    print(f'  PV: {DC_KW:g} kWp · 경사 {tilt:g}° 방위 {azimuth:g}° · {pmeta["temp_model"]}')
    print(f'      최대 {pac.max():.1f} kW · 연간 {pac.sum()/1000:.1f} MWh · '
          f'이용률 {pac.sum()/(DC_KW*8760)*100:.1f}%\n')

    hs = [0.30] * 24
    for h_, v_ in ((9, 0.70), (10, 0.82), (11, 0.90), (12, 0.72), (13, 0.84),
                   (14, 0.96), (15, 1.00), (16, 0.92), (17, 0.65)):
        hs[h_] = v_
    par = dict(peak_kW=1000.0, base_ratio=0.30, open_hour=9, close_hour=18,
               weekend_ratio=0.45,
               season_weight=[0.85, 0.80, 0.70, 0.60, 0.70, 0.90,
                              1.00, 1.00, 0.85, 0.60, 0.70, 0.85],
               hour_shape=hs)
    load = office_load_kW(pac.index, **par)
    print('  부하 모수 (연구 가정): ' + ' · '.join(
        f'{k}={v}' for k, v in par.items() if k not in ('season_weight', 'hour_shape')))
    print(f'      계절가중 = {par["season_weight"]}')
    print(f'      일중형상(9~17시) = '
          f'{[round(hs[i], 2) for i in range(9, 18)]}  ← 피크 시각을 정하는 모수')
    print(f'      최대 {load.max():.1f} kW · 연 부하율 '
          f'{LC.load_factor(list(load)):.3f}\n')

    a = assess(load, pac, pf_load=0.90, S_tr_kVA=1500.0, P_pv_nameplate_kW=DC_KW)
    c = a['coincidence']
    ts = pac.index[c['idx_peak']]
    print('  ── 동시발생 (V-02 쟁점 ②) ──')
    print(f'  최대부하 {c["P_load_peak"]:.1f} kW @ {ts}')
    print(f'  그 시각 PV 출력 {c["P_pv_at_peak"]:.1f} kW  '
          f'(PV 최대 {c["P_pv_max"]:.1f} kW, 비 {c["ratio"]:.3f})')
    print(f'  PV 정격 {DC_KW:g} kW 를 통째로 차감했다면 과다차감 '
          f'{DC_KW - c["P_pv_at_peak"]:.1f} kW\n')

    print('  ── 차감 방식 (V-02 쟁점 ①) ──')
    for name, r in (('정격 전량 차감', a['offset_nameplate']),
                    ('그 시각 실제 PV', a['offset_at_peak'])):
        print(f'  [{name}]  설계서 {r["S_designbook"]:.1f} kVA · '
              f'벡터 {r["S_vector"]:.1f} kVA · 차 {r["delta"]:.1f} kVA · '
              f'보수적={r["conservative"]}')

    print('\n  ── 1,500 kVA 변압기 여유율 ──')
    for k, v in a['margin'].items():
        print(f'  {k:<24}{v:7.2f} %')
    worst = a['margin']['벡터(그 시각 실제 PV)']
    best = a['margin']['설계서(정격 전량 차감)']
    print(f'\n  설계서 방식이 여유를 {best - worst:.2f} %p 크게 본다 '
          '(두 쟁점이 겹친 결과)')


def main():
    ap = argparse.ArgumentParser(description='ZEB 8,760시간 PV·부하 프로파일')
    ap.add_argument('--selftest', action='store_true')
    ap.add_argument('--demo', action='store_true')
    ap.add_argument('--lat', type=float, default=35.5700)
    ap.add_argument('--lon', type=float, default=129.1900)
    ap.add_argument('--tz', default='Asia/Seoul')
    ap.add_argument('--altitude', type=float, default=50.0)
    ap.add_argument('--tilt', type=float, default=30.0)
    ap.add_argument('--azimuth', type=float, default=180.0)
    ap.add_argument('--clearsky', action='store_true',
                    help='네트워크 없이 맑은하늘로 (상한이 나온다)')
    a = ap.parse_args()
    if not (a.demo or a.selftest):
        ap.print_help()
        return
    if a.selftest:
        selftest()
    if a.demo:
        demo(a.lat, a.lon, a.tz, a.altitude, a.tilt, a.azimuth, a.clearsky)


if __name__ == '__main__':
    main()
