"""
runner.py - Phase 2 실행 계층

model.py(심볼릭) + op.py(동작점·야코비안)를 호출해 실험을 돌리고,
파라미터별 폴더에 결과를 남긴다. 기존 sym.py의 저장 구조를 그대로 계승.

저장 구조:
  results/
  ├── J0.50_Dp20.0_Kpv0.05_wc62.8_a3f1c2/
  │   ├── A_num_SCR3.0.npy      ← 22×22 야코비안
  │   ├── x0_SCR3.0.npy         ← 동작점 (신규)
  │   ├── eigenvalue_results.json
  │   ├── meta.json
  │   └── results.md
  └── latest/

실행:
  python Simulation/runner.py
  python Simulation/runner.py --J 0.62 --Dp 28 --Kpv 0.08
  python Simulation/runner.py --XR 2.0 --SCR 3.0 2.0 1.5 1.0 0.8

조연호 · 연세대 스마트그리드 연구실
"""

import numpy as np
from scipy import linalg
import json, argparse, shutil, hashlib
from pathlib import Path
from datetime import datetime

import model as M
import op

MODEL_VERSION = 'v1-22state'
ZETA_TARGET   = 0.64            # UNIFI Cat.3 기준

# ══════════════════════════════════════════════
# CLI — PSO 대상 14개 제어 파라미터
# ══════════════════════════════════════════════
p = argparse.ArgumentParser(description='GFM 22차 소신호 모델 실행')
for name, default, help_ in [
    ('Kp_vpv',  0.1,   'PV 전압 P이득'),
    ('Ki_vpv',  10.0,  'PV 전압 I이득'),
    ('Kp_ipv',  1e-3,  '부스트 전류 P이득'),
    ('Ki_ipv',  0.1,   '부스트 전류 I이득'),
    ('Kp_vdc',  0.5,   'DC링크 전압 P이득'),
    ('Ki_vdc',  20.0,  'DC링크 전압 I이득'),
    ('Kp_iess', 1e-3,  'ESS 전류 P이득'),
    ('Ki_iess', 0.1,   'ESS 전류 I이득'),
    ('J',       0.5,   '가상 관성'),
    ('Dp',      20.0,  '댐핑'),
    ('wc',      2*np.pi*10, '전력 필터 차단주파수'),
    ('nq',      1e-3,  'Q 드룹 계수'),
    ('Kpv',     0.05,  'AC 전압 P이득'),
    ('Kiv',     10.0,  'AC 전압 I이득'),
]:
    p.add_argument(f'--{name}', type=float, default=default, help=help_)
p.add_argument('--SCR', type=float, nargs='+', default=[3.0, 2.0, 1.5, 1.0])
p.add_argument('--XR',  type=float, default=1.0)
p.add_argument('--tag', type=str, default='', help='폴더명 접미사')
args = p.parse_args()

CTRL = {k: getattr(args, k) for k in M.PARAM_NAMES}
op.CTRL.update(CTRL)                       # op 모듈의 제어 파라미터 갱신

# ══════════════════════════════════════════════
# 실행 식별자
# ══════════════════════════════════════════════
def make_run_name(ctrl, XR, tag):
    h = hashlib.md5(
        json.dumps(ctrl, sort_keys=True).encode()).hexdigest()[:6]
    base = (f"J{ctrl['J']:.2f}_Dp{ctrl['Dp']:.1f}_"
            f"Kpv{ctrl['Kpv']:.3f}_wc{ctrl['wc']:.1f}_XR{XR:.1f}_{h}")
    return base + (f"_{tag}" if tag else '')

run_name = make_run_name(CTRL, args.XR, args.tag)
BASE_DIR = Path(__file__).parent.parent / 'results'
out_dir  = BASE_DIR / run_name
out_dir.mkdir(parents=True, exist_ok=True)

print("=" * 66)
print(f"  Phase 2: 22차 야코비안 ({MODEL_VERSION})")
print(f"  J={CTRL['J']}  Dp={CTRL['Dp']}  Kpv={CTRL['Kpv']}  "
      f"wc={CTRL['wc']:.1f}  X/R={args.XR}")
print(f"  저장: results/{run_name}/")
print("=" * 66)

# ══════════════════════════════════════════════
# 분석
# ══════════════════════════════════════════════
def analyze(A):
    ev  = linalg.eigvals(A)
    osc = [e for e in ev if e.imag > 0.5]
    if osc:
        zetas = [-e.real/abs(e) for e in osc]
        k     = int(np.argmin(zetas))
        return ev, float(zetas[k]), float(abs(osc[k].imag)/(2*np.pi))
    return ev, float('nan'), float('nan')


def coupling_effect(A):
    """커플링 블록 제거 시 고유값 변화 — 21차 모델의 존재 이유 정량화"""
    A_cut = A.copy()
    A_cut[M.N_DC:, :M.N_DC] = 0
    A_cut[:M.N_DC, M.N_DC:] = 0
    e1 = np.sort_complex(linalg.eigvals(A))
    e2 = np.sort_complex(linalg.eigvals(A_cut))
    return float(np.max(np.abs(e1 - e2)))


# ══════════════════════════════════════════════
# 메인 루프
# ══════════════════════════════════════════════
results, x_prev = {}, None

hdr = (f"\n  {'SCR':>5} {'수렴':>5} {'stable':>7} {'ζ_min':>8} "
       f"{'f_dom':>9} {'δ(°)':>7} {'v_od':>7} {'검산':>9} {'커플링':>9}")
print(hdr); print("  " + "─" * 72)

for SCR in args.SCR:
    x0, ok, msg = op.solve_op(SCR, args.XR, x_prev)
    if not ok:
        print(f"  {SCR:>5} {'✗':>5}  동작점 미수렴: {msg[:38]}")
        results[SCR] = {'converged': False, 'message': msg}
        continue
    x_prev = x0

    A       = op.jacobian(x0, SCR, args.XR)
    A_fd    = op.fd_jacobian(x0, SCR, args.XR)
    fd_err  = float(np.max(np.abs(A - A_fd)) / max(np.max(np.abs(A)), 1.0))
    ev, zeta, f_dom = analyze(A)
    max_re  = float(np.max(ev.real))
    stable  = max_re < -1e-6
    coup    = coupling_effect(A)
    d       = dict(zip(M.STATE_NAMES, x0))

    results[SCR] = {
        'converged':    True,
        'stable':       stable,
        'max_real':     round(max_re, 6),
        'zeta_min':     round(zeta, 4),
        'f_dom_hz':     round(f_dom, 4),
        'delta_deg':    round(float(np.degrees(d['delta'])), 3),
        'v_od':         round(float(d['v_od']), 3),
        'v_dc':         round(float(d['v_dc']), 3),
        'fd_rel_error': fd_err,
        'coupling_effect': round(coup, 6),
        'x0':           {k: float(v) for k, v in d.items()},
        'eigenvalues':  [{'re': round(float(e.real), 4),
                          'im': round(float(e.imag), 4)} for e in ev],
    }

    fs = "✅" if stable else "❌"
    vs = "✅" if fd_err < 1e-6 else "⚠️"
    print(f"  {SCR:>5} {'✓':>5} {fs:>6} {zeta:>8.4f} {f_dom:>8.3f}Hz "
          f"{results[SCR]['delta_deg']:>7.2f} {results[SCR]['v_od']:>7.1f} "
          f"{vs} {fd_err:>7.1e} {coup:>9.3e}")

    np.save(out_dir / f'A_num_SCR{SCR}.npy', A)
    np.save(out_dir / f'x0_SCR{SCR}.npy', x0)

ok_runs = {k: v for k, v in results.items() if v.get('converged')}
if not ok_runs:
    raise SystemExit("\n  ❌ 모든 SCR에서 동작점 미수렴 — 파라미터 확인 필요")

# ══════════════════════════════════════════════
# 저장
# ══════════════════════════════════════════════
with open(out_dir / 'eigenvalue_results.json', 'w', encoding='utf-8') as fp:
    json.dump({str(k): v for k, v in results.items()}, fp, indent=2)

meta = {
    'run_name':      run_name,
    'model_version': MODEL_VERSION,
    'n_states':      M.N,
    'timestamp':     datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
    'ctrl_params':   CTRL,
    'fixed_params':  {k: float(v) for k, v in op.FIXED.items()},
    'inputs':        {k: float(v) for k, v in op.INP.items()},
    'SCR_list':      args.SCR,
    'XR':            args.XR,
    'all_converged': len(ok_runs) == len(args.SCR),
    'all_stable':    all(v['stable'] for v in ok_runs.values()),
    'max_fd_error':  max(v['fd_rel_error'] for v in ok_runs.values()),
    'zeta_min_all':  min(v['zeta_min'] for v in ok_runs.values()),
}
with open(out_dir / 'meta.json', 'w', encoding='utf-8') as fp:
    json.dump(meta, fp, indent=2, ensure_ascii=False)

# ── latest/ 갱신 ──
latest = BASE_DIR / 'latest'
if latest.exists():
    shutil.rmtree(latest)
shutil.copytree(out_dir, latest)
lm = json.loads((latest / 'meta.json').read_text(encoding='utf-8'))
lm['latest_copied_from'] = run_name
(latest / 'meta.json').write_text(
    json.dumps(lm, indent=2, ensure_ascii=False), encoding='utf-8')

print(f"\n  📁 results/{run_name}/")
print(f"  📁 latest/ → {run_name}")

# ══════════════════════════════════════════════
# results.md (Obsidian)
# ══════════════════════════════════════════════
rows = ""
for SCR in args.SCR:
    r = results.get(SCR, {})
    if not r.get('converged'):
        rows += f"| {SCR} | ✗ 미수렴 | - | - | - | - | - |\n"; continue
    rows += (f"| {SCR} | {'✅' if r['stable'] else '❌'} | {r['zeta_min']} | "
             f"{r['f_dom_hz']} | {r['delta_deg']} | {r['v_od']} | "
             f"{r['coupling_effect']:.3e} |\n")

zeta_all = meta['zeta_min_all']
md = f"""---
type: result
run: {run_name}
model_version: {MODEL_VERSION}
n_states: {M.N}
date: {datetime.now().strftime('%Y-%m-%d %H:%M')}
XR: {args.XR}
all_stable: {meta['all_stable']}
zeta_min: {zeta_all}
tags: [result, phase2, jacobian, 22state]
---

# 실험 결과: {run_name}

## 제어 파라미터 (PSO 대상 14)

| 기호 | 값 | 기호 | 값 |
|---|---|---|---|
| Kp_vpv | {CTRL['Kp_vpv']} | Kp_vdc | {CTRL['Kp_vdc']} |
| Ki_vpv | {CTRL['Ki_vpv']} | Ki_vdc | {CTRL['Ki_vdc']} |
| Kp_ipv | {CTRL['Kp_ipv']} | Kp_iess | {CTRL['Kp_iess']} |
| Ki_ipv | {CTRL['Ki_ipv']} | Ki_iess | {CTRL['Ki_iess']} |
| J | {CTRL['J']} | nq | {CTRL['nq']} |
| Dp | {CTRL['Dp']} | Kpv | {CTRL['Kpv']} |
| wc | {CTRL['wc']:.2f} | Kiv | {CTRL['Kiv']} |

## 고유값 분석 (X/R = {args.XR})

| SCR | stable | ζ_min | f_dom (Hz) | δ (°) | v_od (V) | 커플링 효과 |
|---|---|---|---|---|---|---|
{rows}
- **커플링 효과** = DC-AC 블록 제거 시 고유값 최대 변화량. 0이면 블록삼각(모델 결함).

## 판정

- 안정도: {'✅ 전 SCR 안정' if meta['all_stable'] else '❌ 불안정 SCR 존재'}
- ζ 기준 ({ZETA_TARGET}): {'✅ 달성' if zeta_all >= ZETA_TARGET else f'❌ 미달 (ζ_min={zeta_all}) → PSO 필요'}
- 야코비안 검산: 심볼릭 vs 유한차분 최대 상대오차 {meta['max_fd_error']:.2e} \
{'✅' if meta['max_fd_error'] < 1e-6 else '⚠️ 재확인 필요'}

## 파일

```
{run_name}/
├── A_num_SCR*.npy          22×22 야코비안
├── x0_SCR*.npy             동작점 22×1
├── eigenvalue_results.json
├── meta.json
└── results.md
```

## 🔗 연결 노트

- [[Phase02_완료]]
- [[DC-AC_커플링]]
- [[동작점_SCR의존성]]
- [[고유값_안정도판단]]
- [[88포인트_2D_스윕_설계]]
"""

for d_ in (out_dir, latest):
    (d_ / 'results.md').write_text(md, encoding='utf-8')

print("  💾 results.md")
print(f"\n{'='*66}")
print(f"  ✅ 완료 — ζ_min={zeta_all:.4f} "
      f"({'기준 충족' if zeta_all >= ZETA_TARGET else 'PSO 필요'})")
print(f"{'='*66}")