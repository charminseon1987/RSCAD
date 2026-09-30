"""
plot_xval.py — 선형화 유효성 결과 시각화

xval.py 가 저장한 linearization_validity.json 을 읽어 두 패널 그림을 생성한다.
재계산하지 않으므로 실행이 즉시 끝난다.

  (좌) 섭동 크기별 정규화 오차 — SCR 곡선군, 허용치 선, 최초 실패점 표시
  (우) SCR별 시스템 동특성 — 5τ 정착시간(막대) + 적분 구간(선) + 유효 임계값(우축)

실행:
    python Simulation/plot_xval.py                    # LATEST 실행 대상
    python Simulation/plot_xval.py results/<폴더명>
    python Simulation/plot_xval.py --out fig4.png --dpi 200

조연호 · 연세대 스마트그리드 연구실
"""

import console_utf8  # noqa: F401 — 콘솔을 UTF-8 로 (cp949 에서 이모지 print 가 죽는다)
import argparse
import json
import sys
from pathlib import Path

import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib import font_manager

ROOT = Path(__file__).resolve().parent.parent


# ── 한글 폰트 ──────────────────────────────────
def setup_font():
    # Linux/Docker 에서는 시스템 CJK 폰트가 matplotlib 목록에 없을 수 있다.
    # Noto Sans CJK 는 pan-CJK 라 JP 변형에도 한글 글리프가 들어 있다.
    import glob
    for f in glob.glob('/usr/share/fonts/**/*.ttc', recursive=True) + \
             glob.glob('/usr/share/fonts/**/*.otf', recursive=True):
        if 'CJK' in f or 'Nanum' in f:
            try:
                font_manager.fontManager.addfont(f)
            except Exception:                        # noqa: BLE001
                pass

    for name in ('Malgun Gothic', 'NanumGothic', 'Noto Sans CJK KR',
                 'AppleGothic', 'Noto Sans KR', 'Noto Sans CJK JP'):
        if any(name == f.name for f in font_manager.fontManager.ttflist):
            plt.rcParams['font.family'] = name
            plt.rcParams['axes.unicode_minus'] = False
            return True
    print('  ⚠ 한글 폰트 없음 — 영문 라벨로 출력합니다')
    return False


KO = setup_font()
L = (lambda ko, en: ko) if KO else (lambda ko, en: en)


def load(arg, tag=None):
    root = ROOT / 'results'
    if arg:
        d = Path(arg)
        if not d.is_absolute():
            d = ROOT / arg
    else:
        ptr = root / 'LATEST.json'
        if not ptr.exists():
            raise SystemExit('LATEST.json 없음 — runner.py / xval.py 를 먼저 실행하세요')
        d = root / json.loads(ptr.read_text(encoding='utf-8'))['run_name']
    cands = sorted(d.glob('linearization_validity_*.json'))
    if tag:
        p = d / f'linearization_validity_{tag}.json'
        if not p.exists():
            raise SystemExit(f'{p} 없음 — xval.py --input {tag} 를 먼저 실행하세요')
    elif len(cands) == 1:
        p = cands[0]
    elif cands:
        names = [c.stem.replace('linearization_validity_', '') for c in cands]
        p = cands[0]
        print(f"  ⚠ 결과가 여러 개입니다: {', '.join(names)}")
        print(f"     --input 미지정 → '{names[0]}' 사용. "
              f"다른 입력은 --input {names[-1]} 처럼 지정하세요.")
    else:
        raise SystemExit(f'{d} 에 linearization_validity_*.json 없음')
    return d, json.loads(p.read_text(encoding='utf-8'))


def compare(args):
    """두 섭동 입력의 오차 곡선과 유효 임계값을 비교한다."""
    ds = [load(args.run, tag) for tag in args.compare]
    d = ds[0][0]
    tol = ds[0][1]['tol']
    scrs = sorted((float(k) for k in ds[0][1]['by_SCR']), reverse=True)
    cmap = plt.cm.viridis(np.linspace(0.15, 0.85, len(scrs)))
    styles = ['-', '--']

    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 5.4))

    for (dd, J), ls in zip(ds, styles):
        for c, scr in zip(cmap, scrs):
            sw = J['by_SCR'][str(scr)]['sweep']
            x = np.array([r['ratio'] for r in sw]) * 100
            y = np.array([r['max_rel_error'] or np.nan for r in sw]) * 100
            ax1.plot(x, y, ls, color=c, lw=1.8, ms=4, marker='o')
        ax1.plot([], [], ls, color='#3A4149', lw=1.8, label=J['input'])

    # 기울기 2 기준선 — 2차 비선형의 지표
    xr = np.array([1.0, 30.0])
    ax1.plot(xr, 0.004 * xr ** 2, ':', color='#8A939B', lw=1.6,
             label=L('기울기 2 (오차 ∝ 섭동²)', 'slope 2 (error ∝ step²)'))
    ax1.axhline(tol * 100, color='crimson', ls='--', lw=1.4,
                label=L(f'허용치 ({tol:.1%})', f'Tolerance ({tol:.1%})'))

    ax1.set_xscale('log'); ax1.set_yscale('log')
    ax1.set_xlabel(L('섭동 크기 [%]', 'Perturbation step [%]'), fontsize=11)
    ax1.set_ylabel(L('정격 대비 정규화 오차 [%]', 'Normalized error [%]'), fontsize=11)
    ax1.set_title(L('섭동 입력별 선형화 오차 (색 = SCR)',
                    'Linearization error by input (color = SCR)'),
                  fontsize=12, fontweight='bold')
    ax1.grid(True, which='both', ls=':', alpha=0.45)
    ax1.legend(fontsize=9, framealpha=0.95)

    idx = np.arange(len(scrs))
    w = 0.36
    for i, ((dd, J), off) in enumerate(zip(ds, (-w/2, w/2))):
        thr = [(J['by_SCR'][str(s)].get('threshold_fit')
                or J['by_SCR'][str(s)]['threshold_ratio']) * 100 for s in scrs]
        ax2.bar(idx + off, thr, width=w, label=J['input'],
                color=['#4575B4', '#D73027'][i], alpha=0.88,
                edgecolor='white')
        for xx, v in zip(idx + off, thr):
            ax2.text(xx, v + 0.3, f'{v:.1f}', ha='center', fontsize=9,
                     color='#3A4149')

    ax2.set_xticks(idx)
    ax2.set_xticklabels([f'{s:g}' for s in scrs])
    ax2.set_xlabel(L('단락비 SCR', 'Short circuit ratio (SCR)'), fontsize=11)
    ax2.set_ylabel(L('선형화 유효 임계값 [%]', 'Validity threshold [%]'), fontsize=11)
    ax2.set_title(L(f'유효 임계값 비교 — 2차 피팅 (허용치 {tol:.1%})',
                    f'Validity threshold, quadratic fit (tol {tol:.1%})'),
                  fontsize=12, fontweight='bold')
    ax2.grid(axis='y', ls=':', alpha=0.45)
    ax2.legend(fontsize=9, title=L('섭동 입력', 'Input'))

    fig.tight_layout()
    out = Path(args.out) if args.out else d / 'linearization_compare.png'
    fig.savefig(out, dpi=args.dpi, bbox_inches='tight', facecolor='white')
    print(f'  💾 {out}')


def main():
    ap = argparse.ArgumentParser(description='선형화 유효성 결과 시각화')
    ap.add_argument('run', nargs='?', default=None)
    ap.add_argument('--out', default=None, help='출력 파일 (기본: 실행 폴더/linearization_validity.png)')
    ap.add_argument('--dpi', type=int, default=160)
    ap.add_argument('--input', default=None, help='섭동 입력 (Vg, Pref …)')
    ap.add_argument('--compare', nargs=2, metavar=('A', 'B'),
                    help='두 입력의 오차 곡선을 한 축에 중첩')
    args = ap.parse_args()

    if args.compare:
        return compare(args)
    d, J = load(args.run, args.input)
    tol = J['tol']
    inp = J['input']
    by = J['by_SCR']
    scrs = sorted((float(k) for k in by), reverse=True)

    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 5.4))
    cmap = plt.cm.viridis(np.linspace(0.15, 0.85, len(scrs)))

    # ══════════════ 좌: 섭동 vs 오차 ══════════════
    markers = ['o', 's', '^', 'D', 'X', 'v', 'P']
    fail_pts = []
    for i, (c, scr) in enumerate(zip(cmap, scrs)):
        sw = by[str(scr)]['sweep']
        x = np.array([r['ratio'] for r in sw]) * 100
        y = np.array([np.nan if r['max_rel_error'] is None
                      else r['max_rel_error'] for r in sw]) * 100
        ax1.plot(x, y, marker=markers[i % len(markers)], color=c,
                 lw=2, ms=6, label=f'SCR {scr:g}')
        bad = [k for k, r in enumerate(sw) if not r['pass']]
        if bad:
            fail_pts.append((x[bad[0]], y[bad[0]], scr))

    for fx, fy, fs in fail_pts:
        ax1.scatter([fx], [fy], color='red', s=130, edgecolors='black',
                    zorder=5)
    if fail_pts:
        f0 = fail_pts[0]
        ax1.scatter([], [], color='red', s=90, edgecolors='black',
                    label=L(f'최초 실패 (SCR {f0[2]:g}, {f0[0]:g}%)',
                            f'Fail point (SCR {f0[2]:g}, {f0[0]:g}%)'))

    ax1.axhline(tol * 100, color='crimson', ls='--', lw=1.5,
                label=L(f'허용치 ({tol:.1%})', f'Tolerance limit ({tol:.1%})'))
    ax1.set_xticks([r['ratio'] * 100 for r in by[str(scrs[0])]['sweep']])
    ax1.set_xlabel(L(f'{inp} 섭동 [%]', f'{inp} perturbation [%]'), fontsize=11)
    ax1.set_ylabel(L('정격 대비 정규화 오차 [%]', 'Normalized error [%]'), fontsize=11)
    ax1.set_title(L(f'{inp} 섭동에 따른 정규화 오차',
                    f'Normalized error vs. {inp} perturbation step'),
                  fontsize=12, fontweight='bold')
    ax1.set_ylim(bottom=0)
    ax1.grid(True, ls=':', alpha=0.6)
    ax1.legend(fontsize=9, framealpha=0.95)

    # ══════════════ 우: SCR별 동특성 ══════════════
    tau5 = [5.0 / abs(by[str(s)]['slow_pole']) for s in scrs]
    Ts = [by[str(s)]['T'] for s in scrs]
    thr = [(by[str(s)].get('threshold_fit')
            or by[str(s)]['threshold_ratio']) * 100 for s in scrs]
    idx = np.arange(len(scrs))

    ax2.bar(idx, tau5, width=0.55, color='#7BA6C9', edgecolor='#4A7BA0',
            label=L('5τ 정착시간 [s]', '5τ settling time [s]'))
    ax2.plot(idx, Ts, 'o-', color='#2C3E70', lw=1.8, ms=6,
             label=L('적분 구간 T [s]', 'Integration horizon T [s]'))
    ax2.set_xticks(idx)
    ax2.set_xticklabels([f'{s:g}' for s in scrs])   # 강계통 → 약계통 순
    ax2.set_xlabel(L('단락비 SCR', 'Short circuit ratio (SCR)'), fontsize=11)
    ax2.set_ylabel(L('시간 [s]', 'Time [s]'), fontsize=11, color='#2C3E70')
    ax2.tick_params(axis='y', labelcolor='#2C3E70')
    ax2.set_ylim(0, max(Ts) * 1.25)
    ax2.grid(axis='y', alpha=0.25, ls=':')

    ax3 = ax2.twinx()
    ax3.step(idx, thr, where='mid', color='#C0392B', lw=2,
             label=L('유효 임계값 [%]', 'Validity threshold [%]'))
    ax3.plot(idx, thr, 'o', color='#C0392B', ms=6)
    ax3.set_ylabel(L(f'유효 {inp} 섭동 임계값 [%]',
                     f'Valid {inp} step threshold [%]'),
                   fontsize=11, color='#C0392B')
    ax3.tick_params(axis='y', labelcolor='#C0392B')
    ax3.set_ylim(0, max(thr) * 1.35)

    h1, l1 = ax2.get_legend_handles_labels()
    h2, l2 = ax3.get_legend_handles_labels()
    ax2.legend(h1 + h2, l1 + l2, fontsize=9, loc='upper left', framealpha=0.95)
    ax2.set_title(L('SCR별 동특성과 선형화 유효 범위',
                    'System dynamics & linearization validity by SCR'),
                  fontsize=13, fontweight='bold')

    fig.tight_layout()
    out = (Path(args.out) if args.out
           else d / f"linearization_validity_{J['input']}.png")
    fig.savefig(out, dpi=args.dpi, bbox_inches='tight', facecolor='white')
    print(f'  💾 {out}')


if __name__ == '__main__':
    main()
