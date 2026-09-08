"""
plot_traj.py — 시간영역 응답 파형

xval.py --traj-at 이 저장한 궤적을 읽어, 섭동 인가 후의 응답을
비선형(실선)과 선형 예측(점선)으로 겹쳐 그린다.

요약 지표(오차·임계값)만으로는 보이지 않는 두 가지가 드러난다.
  · 과도 구간의 형상 — 어느 모드가 어떻게 감쇠하는가
  · 정상상태 도달점의 어긋남 — DC 이득 오차가 파형에서 직접 보인다

실행:
    python Simulation/xval.py --input Pref --traj-at 0.1 --steps 0.02 0.05 0.1
    python Simulation/plot_traj.py
    python Simulation/plot_traj.py --scr 1.3 --out fig6.png

조연호 · 연세대 스마트그리드 연구실
"""

import argparse
import json
from pathlib import Path

import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib import font_manager

ROOT = Path(__file__).resolve().parent.parent


def setup_font():
    import glob
    for f in glob.glob('/usr/share/fonts/**/*.ttc', recursive=True) + \
             glob.glob('/usr/share/fonts/**/*.otf', recursive=True):
        if 'CJK' in f or 'Nanum' in f:
            try:
                font_manager.fontManager.addfont(f)
            except Exception:                       # noqa: BLE001
                pass
    for name in ('Malgun Gothic', 'NanumGothic', 'Noto Sans CJK KR',
                 'AppleGothic', 'Noto Sans KR', 'Noto Sans CJK JP'):
        if any(name == f.name for f in font_manager.fontManager.ttflist):
            plt.rcParams['font.family'] = name
            plt.rcParams['axes.unicode_minus'] = False
            return True
    return False


KO = setup_font()
L = (lambda ko, en: ko) if KO else (lambda ko, en: en)

# 표시할 패널 — (상태, 라벨, 환산함수)
PANELS = [
    ('delta', L('δ [°]', 'delta [deg]'), np.degrees),
    ('dw',    L('Δf [Hz]', 'df [Hz]'),   lambda v: v / (2 * np.pi)),
    ('Pf',    L('P [kW]', 'P [kW]'),     lambda v: v / 1e3),
    ('Qf',    L('Q [kvar]', 'Q [kvar]'), lambda v: v / 1e3),
    ('i_od',  L('i_od [A]', 'i_od [A]'), lambda v: v),
    ('v_od',  L('v_od [V]', 'v_od [V]'), lambda v: v),
    ('v_dc',  L('v_dc [V]', 'v_dc [V]'), lambda v: v),
]


def load(run, tag, ratio):
    if run:
        d = Path(run)
        if not d.is_absolute():
            d = ROOT / run
    else:
        ptr = ROOT / 'results' / 'LATEST.json'
        if not ptr.exists():
            raise SystemExit('LATEST.json 없음 — runner.py 를 먼저 실행하세요')
        d = ROOT / 'results' / json.loads(ptr.read_text(encoding='utf-8'))['run_name']

    pat = f"trajectory_{tag or '*'}_r{ratio if ratio else '*'}.npz"
    cands = sorted(d.glob(pat))
    if not cands:
        raise SystemExit(
            f'{d} 에 {pat} 없음\n'
            '  → python Simulation/xval.py --input Pref --traj-at 0.1 ... 로 생성하세요')
    if len(cands) > 1:
        print(f"  ⚠ 궤적 파일 {len(cands)}개 — '{cands[0].name}' 사용")
    return d, np.load(cands[0], allow_pickle=True)


def main():
    ap = argparse.ArgumentParser(description='시간영역 응답 파형')
    ap.add_argument('run', nargs='?', default=None)
    ap.add_argument('--input', default=None, help='섭동 입력 (Pref, Vg …)')
    ap.add_argument('--ratio', default=None, help='섭동 비율 (예: 0.1)')
    ap.add_argument('--scr', type=float, default=None,
                    help='단일 SCR만 표시 (생략 시 전체 중첩)')
    ap.add_argument('--out', default=None)
    ap.add_argument('--dpi', type=int, default=160)
    args = ap.parse_args()

    d, Z = load(args.run, args.input, args.ratio)
    names = list(Z['states'])
    scrs = [s for s in Z['scrs']]
    if args.scr is not None:
        scrs = [s for s in scrs if abs(float(s) - args.scr) < 1e-9]
        if not scrs:
            raise SystemExit(f'SCR {args.scr} 궤적 없음')
    idx = {n: i for i, n in enumerate(names)}
    panels = [p for p in PANELS if p[0] in idx]
    cmap = plt.cm.viridis(np.linspace(0.15, 0.85, len(scrs)))

    fig, axes = plt.subplots(len(panels), 1, figsize=(9, 1.55 * len(panels)),
                             sharex=True)
    axes = np.atleast_1d(axes)

    for c, scr in zip(cmap, scrs):
        t = Z[f't_{scr}']
        y_nl, y_lin = Z[f'nl_{scr}'], Z[f'lin_{scr}']
        for ax, (st, lab, conv) in zip(axes, panels):
            i = idx[st]
            ax.plot(t, conv(y_nl[i]), '-', color=c, lw=1.6,
                    label=f'SCR {float(scr):g}')
            ax.plot(t, conv(y_lin[i]), '--', color=c, lw=1.2, alpha=0.85)

    for ax, (st, lab, conv) in zip(axes, panels):
        ax.set_ylabel(lab, fontsize=10)
        ax.grid(True, ls=':', alpha=0.45)
        ax.margins(x=0)

    axes[-1].set_xlabel(L('시간 [s]', 'Time [s]'), fontsize=11)

    h, l = axes[0].get_legend_handles_labels()
    h.append(plt.Line2D([], [], color='#3A4149', ls='-', lw=1.6))
    l.append(L('비선형', 'Nonlinear'))
    h.append(plt.Line2D([], [], color='#3A4149', ls='--', lw=1.2))
    l.append(L('선형 예측', 'Linear prediction'))
    axes[0].legend(h, l, fontsize=8.5, ncol=2, loc='best', framealpha=0.95)

    r = float(Z['ratio']) * 100
    fig.suptitle(L(f"{Z['input']} {r:g}% 계단 섭동 응답  (X/R = {float(Z['XR']):g})",
                   f"Step response to {r:g}% {Z['input']} perturbation"),
                 fontsize=13, fontweight='bold', y=0.995)
    fig.tight_layout(rect=[0, 0, 1, 0.985])

    out = Path(args.out) if args.out else \
        d / f"trajectory_{Z['input']}_r{float(Z['ratio']):g}.png"
    fig.savefig(out, dpi=args.dpi, bbox_inches='tight', facecolor='white')
    print(f'  💾 {out}')


if __name__ == '__main__':
    main()
