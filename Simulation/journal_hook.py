#!/usr/bin/env python3
"""런이 끝나면 연구일지 초안을 남긴다.

왜 이게 있나 — 실험을 돌린 날과 일지를 쓰는 날이 벌어지면 '본 것' 을 기억으로
채우게 된다. 그 순간 이 저장소가 지키는 단 하나의 원칙(값을 날조하지 않는다)이
사람 쪽에서 먼저 깨진다. 런이 끝난 자리에서 사실만이라도 받아 적어 둔다.

무엇을 쓰고 무엇을 안 쓰나
  쓴다   — meta.json 에서 읽은 값, 직전 런과의 차이, 기계적으로 잡히는 이상
  안 쓴다 — 해석(※). 왜 그런지는 사람이나 `/research-journal` 스킬이 채운다.

LLM 을 부르지 않는다. 런 경로에서 느려지고, 같은 입력에 다른 글이 나오면
일지가 증거로서의 값을 잃는다.

연결
  - 쓰는 곳: GFM_Research/RSCAD/03_실험/일지/  (Server/doc.py 의 JOURNAL_DIR)
  - 같은 형식을 `/research-journal` 스킬이 이어받아 ※ 를 채운다
  - 쓰기 화면의 '합치기' 가 이 파일을 문단으로 쪼개 논문 절로 보낸다
"""
from __future__ import annotations

import datetime
import json
from pathlib import Path

JOURNAL_REL = 'GFM_Research/RSCAD/03_실험/일지'


def _repo_root() -> Path:
    return Path(__file__).resolve().parent.parent


def _runs(base_dir: Path) -> list:
    """meta.json 을 가진 런을 timestamp 순으로. _archive 는 제외한다."""
    out = []
    for p in sorted(base_dir.iterdir()):
        if not p.is_dir() or p.name.startswith('_') or p.name.startswith('.'):
            continue
        f = p / 'meta.json'
        if not f.is_file():
            continue
        try:
            out.append(json.loads(f.read_text(encoding='utf-8')))
        except (OSError, ValueError):
            continue          # 읽히지 않는 런은 조용히 건너뛴다 — 일지 때문에 런을 깨지 않는다
    out.sort(key=lambda m: m.get('timestamp') or '')
    return out


def previous_run(base_dir: Path, run_name: str) -> dict | None:
    """이번 런 바로 앞 런. 없으면 None."""
    rs = _runs(base_dir)
    for i, m in enumerate(rs):
        if m.get('run_name') == run_name:
            return rs[i - 1] if i > 0 else None
    return rs[-1] if rs else None


def self_check(meta: dict) -> list:
    """기계적으로 잡히는 이상만. 판단하지 않고 어긋난 사실만 적는다."""
    bad = []

    conv = meta.get('all_converged')
    noncon = meta.get('nonconvergence_SCR')
    if conv is False and not noncon:
        bad.append('`all_converged: false` 인데 `nonconvergence_SCR` 가 비어 있다 — '
                   '어느 운전점이 수렴하지 않았는지 기록이 없어 추적할 수 없다')

    scr = meta.get('SCR_list') or []
    dup = sorted({x for x in scr if scr.count(x) > 1})
    if dup:
        bad.append(f'`SCR_list` 에 중복이 있다 ({", ".join(str(d) for d in dup)}) — '
                   f'같은 운전점을 두 번 풀었다면 커버리지는 {len(scr)}점이 아니라 '
                   f'{len(set(scr))}점이다')

    fd = meta.get('max_fd_error')
    tol = (meta.get('thresholds') or {}).get('FD_TOL')
    if fd is not None and tol is not None and fd > tol:
        bad.append(f'`max_fd_error` {fd:.3e} 가 `FD_TOL` {tol:.0e} 를 넘는다 — '
                   '야코비안 검산이 통과하지 못했다')

    if meta.get('all_stable') and meta.get('metric_pass') is False:
        bad.append(None)      # 이상이 아니라 정상 상태 — 아래 표에서 이미 보인다
    return [b for b in bad if b]


def _table(meta: dict) -> str:
    scr = ', '.join(str(x) for x in (meta.get('SCR_list') or [])) or '—'
    stable = {True: '예', False: '아니오'}.get(meta.get('all_stable'), '—')
    z = meta.get('zeta_min_all')
    return ('| run | 날짜 | X/R | SCR | 전부 안정 | ζ_min | 상태수 |\n'
            '|---|---|---|---|---|---|---|\n'
            f"| `{meta.get('run_name', '—')}` | {meta.get('timestamp') or '—'} | "
            f"{meta.get('XR', '—')} | {scr} | {stable} | "
            f"{z if z is not None else '—'} | {meta.get('n_states', '—')} |")


#  유효숫자 차이로 볼 상대오차. 이 아래면 '바꾼 것' 이 아니라 저장 정밀도 차이다 —
#  wc 를 62.83 으로 적은 런과 2π·10 을 그대로 쓴 런이 실제로 그랬다. 숨기지는 않고
#  따로 묶어 적는다. 지웠다가는 진짜 미세조정을 놓친다.
ROUNDING_REL = 1e-4


def _param_diff(prev: dict, cur: dict) -> tuple:
    """(바꾼 것, 유효숫자만 다른 것, 새로 생긴 것)"""
    real, noise, added = [], [], []
    for k, v in cur.items():
        if k not in prev:
            added.append(f'`{k}` (새로 생김) {v}')
            continue
        o = prev[k]
        if o == v:
            continue
        try:
            rel = abs(v - o) / max(abs(o), abs(v), 1e-30)
        except TypeError:
            rel = 1.0                       # 숫자가 아니면 그냥 바뀐 것으로 본다
        (noise if rel < ROUNDING_REL else real).append(f'`{k}` {o} → {v}')
    return real, noise, added


def _changed_params(meta: dict, prev: dict | None) -> str:
    """직전 런과 달라진 제어 파라미터만. 전부 나열하면 무엇을 건드렸는지 묻힌다."""
    if not prev:
        return '직전 런이 없다 — 이번이 첫 런이다.'
    real, noise, added = _param_diff(prev.get('ctrl_params') or {},
                                     meta.get('ctrl_params') or {})
    if not real and not added:
        s = '제어 파라미터는 직전 런과 같다.'
    else:
        s = ', '.join(real + added) + '. 나머지는 직전 런과 같다.'
    if noise:
        s += (f' (유효숫자만 다른 것: {", ".join(noise)} — 저장 정밀도 차이로 본다)')
    return s


def _facts(meta: dict, prev: dict | None) -> list:
    """▸ 줄. 측정값과 그 값이 나온 조건만 — 해석을 섞지 않는다."""
    xr, scr = meta.get('XR'), meta.get('SCR_list') or []
    where = f"(X/R {xr}, SCR {min(scr)}~{max(scr)})" if scr and xr is not None else ''
    f = []

    s, ref = meta.get('sigma_min_all'), meta.get('sigma_ref')
    if s is not None:
        line = f'σ_min {s} {where}'.rstrip()
        if ref is not None:
            line += f'. 목표 `sigma_ref` {ref} 에 ' + \
                    ('도달' if meta.get('metric_pass') else '미달') + \
                    f' — `metric_pass: {str(meta.get("metric_pass")).lower()}`'
        f.append(line)

    if meta.get('all_stable') is not None:
        f.append(('불안정 극이 없다' if meta['all_stable'] else '불안정 극이 있다')
                 + f" — `all_stable: {str(meta['all_stable']).lower()}`"
                 + ('. 안정하지만 목표 미달이다'
                    if meta.get('all_stable') and meta.get('metric_pass') is False else ''))

    if prev:
        pn = prev.get('run_name', '?')
        for key, label in (('sigma_min_all', 'σ_min'), ('zeta_min_all', 'ζ_min(전체)')):
            x, y = prev.get(key), meta.get(key)
            if x is not None and y is not None and x != y:
                f.append(f'직전 런 `{pn}` 대비: {label} {x} → {y} ({y - x:+.5g})')
        pb, cb = prev.get('band_zeta_min') or {}, meta.get('band_zeta_min') or {}
        moved = [f'{b} {pb[b]} → {cb[b]}' for b in cb if b in pb and pb[b] != cb[b]]
        if moved:
            f.append('직전 런 대비 대역별 ζ_min: ' + ' / '.join(moved))

    zv = meta.get('zeta_min_valid')
    if meta.get('zeta_min_all') is not None:
        f.append(f"ζ_min {meta['zeta_min_all']} — "
                 + ('`zeta_min_valid: true` 이므로 인용 가능하다'
                    if zv else '`zeta_min_valid: false` — 이 값은 인용하지 않는다')
                 + (f". `zeta_pass: {str(meta.get('zeta_pass')).lower()}`"
                    if meta.get('zeta_pass') is not None else ''))

    fd = meta.get('max_fd_error')
    tol = (meta.get('thresholds') or {}).get('FD_TOL')
    if fd is not None:
        f.append(f'수치 건전성: `max_fd_error` {fd:.4e}'
                 + (f' — 임계 `FD_TOL` {tol:.0e} ' +
                    ('초과' if tol is not None and fd > tol else '미만') if tol is not None else ''))

    d = meta.get('delta_max_deg')
    warn = (meta.get('thresholds') or {}).get('DELTA_WARN')
    if d is not None:
        f.append(f'δ 최대 {d}°'
                 + (f" — `DELTA_WARN` {warn}° " +
                    ('초과' if warn is not None and d > warn else '미만') if warn is not None else ''))

    for key, label in (('band_crossovers', '대역 교차'),
                       ('delta_near_limit_SCR', 'δ 한계 근접 SCR'),
                       ('loadability_limit_SCR', '부하가능성 한계 SCR'),
                       ('nonconvergence_SCR', '비수렴 SCR')):
        v = meta.get(key)
        if v:
            f.append(f'{label}: {v}')
    return f


def draft(meta: dict, prev: dict | None) -> str:
    """일지 본문. ※ 는 비워 둔다 — 해석은 사람이 한다."""
    day = (meta.get('timestamp') or '')[:10] or datetime.date.today().isoformat()
    run = meta.get('run_name', '이름 없는 런')
    bad = self_check(meta)

    L = [f'# {day} {run}', '',
         '## 돌린 것', '',
         '<!-- results/ 의 meta.json 에서 그대로 옮긴 값이다. 손으로 고치지 않는다. -->',
         _table(meta), '',
         f"조건: {_changed_params(meta, prev)} "
         f"모델 {meta.get('model_version', '—')} ({meta.get('n_states', '—')}차).", '']

    if meta.get('sigma_min_all') is not None:
        L += [f"판정: 안정 {str(meta.get('all_stable')).lower()} · "
              f"σ_min {meta.get('sigma_min_all')} / 목표 {meta.get('sigma_ref')} → "
              f"**{str(meta.get('metric_pass')).lower()}**", '']

    L += ['## 본 것', '']
    L += [f'▸ {x}' for x in _facts(meta, prev)]
    L += ['',
          '## 내 해석', '',
          '※ ', '',
          '## 막힌 것', '']
    L += ([f'- {x}' for x in bad] if bad else ['없음'])
    L += ['',
          '## 다음', '',
          '1. ', '',
          '## 논문 어디에', '',
          '※ I~V 중 어느 절 — schedule.yaml 의 어느 산출물에 해당하는지', '',
          '---', '',
          '<!-- 이 초안은 런이 끝날 때 Simulation/journal_hook.py 가 썼다.',
          '     ▸ 는 meta.json 에서 읽은 값이고, ※ 는 비어 있다 —',
          '     해석은 사람이 채우거나 /research-journal 스킬로 채운다. -->']
    return '\n'.join(L) + '\n'


def write_journal(meta: dict, base_dir: Path, root: Path | None = None) -> Path | None:
    """일지 초안을 쓴다. 이미 있으면 덮지 않고 None 을 돌려준다."""
    root = root or _repo_root()
    day = (meta.get('timestamp') or '')[:10] or datetime.date.today().isoformat()
    run = meta.get('run_name', 'run')
    out = root / JOURNAL_REL / f'{day}_{run}.md'
    if out.exists():
        return None
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(draft(meta, previous_run(base_dir, run)), encoding='utf-8')
    return out


def on_run_finished(meta: dict, base_dir, log=print) -> Path | None:
    """runner 가 부르는 입구. 어떤 이유로도 런을 깨뜨리지 않는다."""
    try:
        p = write_journal(meta, Path(base_dir))
        if p is None:
            log('  📔 일지: 같은 이름이 이미 있어 그대로 두었다')
        else:
            log(f'  📔 일지 초안 → {p.relative_to(_repo_root()).as_posix()}')
        return p
    except Exception as e:                                   # noqa: BLE001
        log(f'  ⚠  일지 초안을 쓰지 못했다 ({type(e).__name__}: {e}) — 런 결과는 영향 없다')
        return None


if __name__ == '__main__':
    import sys
    base = _repo_root() / 'results'
    name = sys.argv[1] if len(sys.argv) > 1 else json.loads(
        (base / 'LATEST.json').read_text(encoding='utf-8'))['run_name']
    m = json.loads((base / name / 'meta.json').read_text(encoding='utf-8'))
    print(draft(m, previous_run(base, name)))
