"""
Server/app.py — GFM Research Flask Server (v3)

설계 원칙: 값을 날조하지 않는다.
  - 저장된 결과를 보여주거나 (viewer)
  - runner.run() 을 실제로 호출해 계산한다 (compute)
  두 가지뿐. 근사식·해석식으로 만든 숫자는 응답에 넣지 않는다.

v2 app.py 에서 제거한 것:
  ✗ _get_A_num()  — 로드한 야코비안에 하드코딩 수식을 덮어쓰던 코드.
                    인덱스 8/9/19/20 은 δ 없던 21-state 배치 기준이라
                    22-state 모델에서는 전혀 다른 상태를 가리킨다.
  ✗ build_jacobian() — numpy 근사 fallback. 진짜 모델과 구분 없이 응답에
                    섞여 나가 대시보드가 가짜 값을 정상처럼 표시했다.
  ✗ analyze_eigenvalues() 의 'VSG 스윙' 모드 삽입 — 고유값에 없는 모드를
                    해석식으로 지어내 ζ_min 을 갈아치우던 코드.
  ✗ scr_star / zeta_threshold / du_pv_pct — 출처 없는 해석식.
  ✗ /api/pso 의 random.uniform() 수렴 곡선.
  ✗ /api/operating_points 의 근사식 — op.solve_op 결과(x0)를 읽어 쓴다.

실행:
  python Server/app.py
"""

import sys, json
from pathlib import Path

import numpy as np
import yaml
from flask import Flask, request, jsonify
from flask_cors import CORS

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'Simulation'))

import model as M                       # noqa: E402
import runner                           # noqa: E402
from runner import resolve_latest, BANDS, ZETA_TARGET   # noqa: E402

RESULTS_ROOT = ROOT / 'results'
WEB_DIR      = ROOT / 'Web'

app = Flask(__name__, static_folder=str(WEB_DIR), static_url_path='')
CORS(app)


# ═══════════════════════════════════════════════
# 결과 로드 — 저장된 것만 읽는다
# ═══════════════════════════════════════════════
STATE = {
    'run_dir':  None,   # Path
    'meta':     {},     # meta.json
    'results':  {},     # eigenvalue_results.json  {SCR(float): {...}}
    'A':        {},     # {SCR(float): 22×22 ndarray}
    'x0':       {},     # {SCR(float): 22 ndarray}
}


def _scr_from_name(path, prefix):
    """A_num_SCR3.00.npy / A_num_SCR3.0.npy 둘 다 파싱 (구버전 호환)."""
    try:
        return float(path.stem[len(prefix):])
    except ValueError:
        return None


def load_run(run_dir=None):
    """run_dir 지정 없으면 LATEST.json 이 가리키는 폴더."""
    run_dir = Path(run_dir) if run_dir else resolve_latest(RESULTS_ROOT)
    if not run_dir.is_dir():
        raise FileNotFoundError(f'실행 폴더 없음: {run_dir}')

    meta_p = run_dir / 'meta.json'
    if not meta_p.exists():
        raise FileNotFoundError(f'meta.json 없음: {run_dir}')
    meta = json.loads(meta_p.read_text(encoding='utf-8'))

    if meta.get('n_states') != M.N:
        raise ValueError(
            f'상태 수 불일치: 저장본 {meta.get("n_states")} vs 현재 모델 {M.N}. '
            f'구버전 결과입니다. runner.py 를 다시 실행하세요.')

    res_p = run_dir / 'eigenvalue_results.json'
    raw   = json.loads(res_p.read_text(encoding='utf-8')) if res_p.exists() else {}
    results = {float(k): v for k, v in raw.items()}

    A, x0 = {}, {}
    for p in run_dir.glob('A_num_SCR*.npy'):
        s = _scr_from_name(p, 'A_num_SCR')
        if s is not None:
            A[s] = np.load(str(p))
    for p in run_dir.glob('x0_SCR*.npy'):
        s = _scr_from_name(p, 'x0_SCR')
        if s is not None:
            x0[s] = np.load(str(p))

    bad = [s for s, a in A.items() if a.shape != (M.N, M.N)]
    if bad:
        raise ValueError(f'야코비안 차원 불일치 SCR={bad} (기대 {M.N}×{M.N})')

    STATE.update({'run_dir': run_dir, 'meta': meta,
                  'results': results, 'A': A, 'x0': x0})

    print(f"  ✅ 로드: {run_dir.name}")
    print(f"     상태 {meta['n_states']}차 · X/R={meta.get('XR')} · "
          f"SCR={sorted(A, reverse=True)}")
    if meta.get('band_crossovers'):
        print(f"     ⚠ 모드 교차 {len(meta['band_crossovers'])}회 "
              f"— ζ_min 이 서로 다른 물리 모드를 가리킴")
    return meta


try:
    load_run()
except Exception as e:                      # noqa: BLE001
    print(f"  ⚠️  결과 로드 실패: {e}")
    print(f"     python Simulation/runner.py 실행 후 POST /api/reload")


def _require_loaded():
    if STATE['run_dir'] is None:
        return jsonify({'status': 'error',
                        'error': '로드된 실행 결과 없음',
                        'hint': 'python Simulation/runner.py 실행 후 '
                                'POST /api/reload'}), 503
    return None


# ═══════════════════════════════════════════════
# API — 조회
# ═══════════════════════════════════════════════
@app.route('/')
def index():
    return jsonify({
        'status':  'ok',
        'run':     STATE['run_dir'].name if STATE['run_dir'] else None,
        'n_states': M.N,
        'loaded_SCR': sorted(STATE['A'], reverse=True),
        'endpoints': [
            'GET  /api/health',
            'GET  /api/runs',
            'POST /api/reload      {"run": "<폴더명>"}',
            'GET  /api/result?SCR=1.5',
            'GET  /api/modes?SCR=1.5',
            'GET  /api/sweep2d',
            'POST /api/compute     {"J":0.62, "Dp":28, ..., "SCR":[...], "XR":1.0}',
        ],
    })


@app.route('/api/health')
def health():
    m = STATE['meta']
    return jsonify({
        'status':     'ok' if STATE['run_dir'] else 'no_data',
        'run':        STATE['run_dir'].name if STATE['run_dir'] else None,
        'model_version': m.get('model_version'),
        'n_states':   m.get('n_states'),
        'XR':         m.get('XR'),
        'loaded_SCR': sorted(STATE['A'], reverse=True),
        'all_stable': m.get('all_stable'),
        'zeta_min':   m.get('zeta_min_all'),
        'zeta_min_band':    m.get('zeta_min_band'),
        'band_crossovers':  len(m.get('band_crossovers', [])),
        'fd_exceed_SCR':    m.get('fd_exceed_SCR', []),
        'loadability_limit_SCR': m.get('loadability_limit_SCR', []),
    })


@app.route('/api/result')
def get_result():
    """저장된 SCR 의 결과를 그대로 반환. 보간·근사 없음."""
    err = _require_loaded()
    if err:
        return err

    q = request.args.get('SCR')
    if q is None:
        return jsonify({'status': 'ok',
                        'meta': STATE['meta'],
                        'results': {str(k): v for k, v in STATE['results'].items()}})

    scr = float(q)
    if scr not in STATE['results']:
        # 근처 값으로 바꿔치기하지 않는다. 없으면 없다고 답한다.
        return jsonify({
            'status': 'error',
            'error':  f'SCR={scr} 결과 없음',
            'available': sorted(STATE['results'], reverse=True),
            'hint': 'POST /api/compute 로 실제 계산하거나 runner.py 를 해당 '
                    'SCR 로 실행하세요.',
        }), 404

    r = dict(STATE['results'][scr])
    r['run'] = STATE['run_dir'].name
    r['XR']  = STATE['meta'].get('XR')
    return jsonify({'status': 'ok', 'SCR': scr, 'result': r})


@app.route('/api/modes')
def get_modes():
    """대역별 진동모드 목록. runner.analyze() 가 분류한 결과를 그대로 전달."""
    err = _require_loaded()
    if err:
        return err

    q = request.args.get('SCR')
    if q is None or float(q) not in STATE['results']:
        return jsonify({'status': 'error', 'error': 'SCR 지정 필요',
                        'available': sorted(STATE['results'], reverse=True)}), 400

    r = STATE['results'][float(q)]
    if not r.get('converged'):
        return jsonify({'status': 'error', 'SCR': float(q),
                        'converged': False,
                        'fail_reason': r.get('fail_reason'),
                        'message': r.get('message')}), 409

    return jsonify({
        'status':     'ok',
        'SCR':        float(q),
        'XR':         STATE['meta'].get('XR'),
        'bands':      STATE['meta'].get('bands'),
        'modes':      sorted(r['modes'], key=lambda m: m['zeta']),
        'band_zeta':  r['band_zeta'],
        'band_f_hz':  r['band_f_hz'],
        'zeta_min':   r['zeta_min'],
        'zeta_band':  r['zeta_band'],
        'coupling':   r['coupling'],
        'note': '주파수 대역 분류는 참여계수 분석의 대용. 모드 귀속 확정은 pf.py 필요.',
    })


@app.route('/api/sweep2d')
def sweep2d():
    """results/ 의 모든 실행을 (SCR, X/R) 격자로 집계.

    v2 처럼 그 자리에서 근사 행렬을 만들어 채우지 않는다. 저장된 실행만
    모으므로, 격자가 비어 있으면 그 조건으로 runner.py 를 돌려야 한다.
    """
    pts, runs_used = [], []
    for d in sorted(RESULTS_ROOT.iterdir()):
        if not d.is_dir():
            continue
        mp = d / 'meta.json'
        if not mp.exists():
            continue
        m = json.loads(mp.read_text(encoding='utf-8'))
        # if m.get('n_states') != M.N:
        #     continue   
        # n_states 만으로는 부족하다. v2 결과도 22-state 지만 대역 분류 필드가 없어서 KeyError 가 난다.
        # 없어서 아래 r['zeta_band'] 접근에서 KeyError 가 난다.
        if m.get('n_states') != M.N or not str(m.get('model_version','')).startswith('v3'):
            continue


                            # 구버전 결과 배제
        rp = d / 'eigenvalue_results.json'
        if not rp.exists():
            continue
        runs_used.append(d.name)
        for k, r in json.loads(rp.read_text(encoding='utf-8')).items():
            if not r.get('converged'):
                pts.append({'SCR': float(k), 'XR': m['XR'],
                            'converged': False,
                            'fail_reason': r.get('fail_reason'),
                            'run': d.name})
                continue
            pts.append({
                'SCR': float(k), 'XR': m['XR'],
                'converged': True,
                'stable':    r['stable'],
                'zeta_min':  r['zeta_min'],
                'zeta_band': r['zeta_band'],
                'band_zeta': r['band_zeta'],
                'f_dom_hz':  r['f_dom_hz'],
                'delta_deg': r['delta_deg'],
                'delta_margin_deg': r['delta_margin_deg'],
                'run': d.name,
            })

    # ── 경계 산출: 두 경계를 반드시 분리한다 ──
    #  damping     : ζ_min 이 ZETA_TARGET 아래로 내려가는 SCR
    #  loadability : 정상상태 해가 존재하지 않게 되는 SCR (δ→90°)
    # 이 둘은 물리적으로 다른 선이며, 한 선으로 합쳐 그리면 오독된다.
    boundaries = {}
    for xr in sorted({p['XR'] for p in pts}):
        col = sorted([p for p in pts if p['XR'] == xr],
                     key=lambda p: -p['SCR'])          # 강 → 약
        damp = next((p['SCR'] for p in col
                     if p['converged'] and p['zeta_min'] is not None
                     and p['zeta_min'] < ZETA_TARGET), None)
        load = next((p['SCR'] for p in col
                     if not p['converged']
                     and p.get('fail_reason') == 'loadability_limit'), None)
        boundaries[str(xr)] = {
            'damping_SCR':     damp,
            'loadability_SCR': load,
            'n_points':        len(col),
        }

    return jsonify({
        'status': 'ok',
        'zeta_target': ZETA_TARGET,
        'bands': {b: [lo, (None if np.isinf(hi) else hi)] for b, lo, hi in BANDS},
        'points': pts,
        'boundaries': boundaries,
        'runs_used': runs_used,
        'total_points': len(pts),
        'note': '저장된 실행만 집계합니다. 격자가 비면 해당 조건으로 '
                'runner.py 를 실행하거나 POST /api/compute 를 쓰세요.',
    })


@app.route('/api/operating_points')
def operating_points():
    """저장된 동작점 x0 를 반환. 근사식으로 재구성하지 않는다."""
    err = _require_loaded()
    if err:
        return err

    out = []
    for scr in sorted(STATE['results'], reverse=True):
        r = STATE['results'][scr]
        if not r.get('converged'):
            out.append({'SCR': scr, 'converged': False,
                        'fail_reason': r.get('fail_reason')})
            continue
        out.append({
            'SCR': scr, 'converged': True,
            'delta_deg':        r['delta_deg'],
            'delta_margin_deg': r['delta_margin_deg'],
            'delta_near_limit': r['delta_near_limit'],
            'v_od': r['v_od'], 'v_dc': r['v_dc'],
            'x0':   r['x0'],
        })
    return jsonify({'status': 'ok', 'XR': STATE['meta'].get('XR'),
                    'delta_limit_deg': 90.0, 'points': out})


# ═══════════════════════════════════════════════
# API — 실제 계산
# ═══════════════════════════════════════════════
@app.route('/api/compute', methods=['POST'])
def compute():
    """슬라이더 값으로 runner.run() 을 실제 호출한다.

    v2 는 저장된 행렬의 특정 성분을 수식으로 덮어써서 '동적 반영'을 흉내냈다.
    그건 다른 파라미터의 야코비안이 아니라 훼손된 야코비안이다. 여기서는
    동작점부터 다시 푼다. 느리지만 값이 맞다. persist=False 라 디스크에
    아무것도 쓰지 않는다.
    """
    d = request.json or {}

    base = dict(STATE['meta'].get('ctrl_params') or {})
    if not base:
        return jsonify({'status': 'error',
                        'error': '기준 파라미터 없음 — 먼저 runner.py 실행'}), 503

    ctrl, bad = dict(base), []
    for k in M.PARAM_NAMES:
        if k in d:
            try:
                ctrl[k] = float(d[k])
            except (TypeError, ValueError):
                bad.append(k)
    if bad:
        return jsonify({'status': 'error', 'error': f'숫자가 아닌 값: {bad}'}), 400

    SCR_list = d.get('SCR') or STATE['meta'].get('SCR_list') or [3.0, 2.0, 1.5, 1.0]
    XR       = float(d.get('XR', STATE['meta'].get('XR', 1.0)))

    if len(SCR_list) > 12:
        return jsonify({'status': 'error',
                        'error': 'SCR 12개 초과 — 배치 실행은 runner.py 로'}), 400

    try:
        results, meta, _ = runner.run(ctrl, SCR_list, XR,
                                      persist=False, quiet=True)
    except Exception as e:                  # noqa: BLE001
        return jsonify({'status': 'error', 'error': str(e),
                        'type': type(e).__name__}), 500

    return jsonify({
        'status':  'ok',
        'computed': True,
        'persisted': False,
        'ctrl':    ctrl,
        'XR':      XR,
        'meta':    meta,
        'results': {f'{k:.2f}': v for k, v in results.items()},
    })


# ═══════════════════════════════════════════════
# API — 실행 관리
# ═══════════════════════════════════════════════
@app.route('/api/runs')
def list_runs():
    if not RESULTS_ROOT.exists():
        return jsonify({'status': 'ok', 'runs': [], 'total': 0,
                        'note': f'results 폴더 없음: {RESULTS_ROOT}'})

    ptr = RESULTS_ROOT / 'LATEST.json'
    latest_name = (json.loads(ptr.read_text(encoding='utf-8'))['run_name']
                   if ptr.exists() else None)
    active = STATE['run_dir'].name if STATE['run_dir'] else None

    runs, legacy = [], []
    for d in sorted(RESULTS_ROOT.iterdir()):
        if not d.is_dir():
            continue
        mp = d / 'meta.json'
        if not mp.exists():
            legacy.append(d.name)
            continue
        m = json.loads(mp.read_text(encoding='utf-8'))
        entry = {
            'run_name':  d.name,
            'timestamp': m.get('timestamp'),
            'model_version': m.get('model_version'),
            'n_states':  m.get('n_states'),
            'XR':        m.get('XR'),
            'SCR_list':  m.get('SCR_list'),
            'ctrl':      m.get('ctrl_params'),
            'all_stable':  m.get('all_stable'),
            'zeta_min':    m.get('zeta_min_all'),
            'zeta_min_band': m.get('zeta_min_band'),
            'band_crossovers': len(m.get('band_crossovers', [])),
            'npy_count': len(list(d.glob('A_num_SCR*.npy'))),
            'is_latest': d.name == latest_name,
            'is_active': d.name == active,
            # 'compatible': m.get('n_states') == M.N,
            'compatible': (m.get('n_states') == M.N and
                           str(m.get('model_version','')).startswith('v3')),
        }
        (runs if entry['compatible'] else legacy).append(
            entry if entry['compatible'] else d.name)

    return jsonify({
        'status': 'ok',
        'current_run': active,
        'latest_run':  latest_name,
        'model_n_states': M.N,
        'runs':  runs,
        'total': len(runs),
        'incompatible': legacy,
        'note': ('구버전(상태 수 불일치) 실행은 incompatible 로 분리했습니다. '
                 '삭제하거나 _archive 로 옮기세요.') if legacy else None,
    })


@app.route('/api/reload', methods=['POST'])
def reload_run():
    d   = request.json or {}
    run = d.get('run')
    try:
        meta = load_run(RESULTS_ROOT / run if run else None)
    except Exception as e:                  # noqa: BLE001
        return jsonify({'status': 'error', 'error': str(e),
                        'type': type(e).__name__}), 400
    return jsonify({'status': 'ok',
                    'run': STATE['run_dir'].name,
                    'loaded_SCR': sorted(STATE['A'], reverse=True),
                    'meta': meta})


@app.route('/api/schedule_status', methods=['GET'])
def schedule_status():
    """schedule.yaml 를 읽어 페이즈별 상태를 JSON 으로 반환한다."""
    sched_path = ROOT / 'GFM_Research' / 'schedule.yaml'
    if not sched_path.exists():
        return jsonify({'status': 'error',
                        'error': f'schedule.yaml not found: {sched_path}'}), 404
    try:
        with open(sched_path, 'r', encoding='utf-8') as f:
            data = yaml.safe_load(f)
    except Exception as e:                          # noqa: BLE001
        return jsonify({'status': 'error',
                        'error': f'YAML parse error: {e}'}), 500

    meta = data.get('meta', {})
    phases_raw = data.get('phases', [])

    phases = []
    for ph in phases_raw:
        phases.append({
            'id':     ph.get('id'),
            'name':   ph.get('name'),
            'window': ph.get('window'),
            'status': ph.get('status', 'in_progress'),
            'critical': ph.get('critical', False),
            'depends_on': ph.get('depends_on', []),
            'artifacts': [
                {'id': a.get('id'), 'name': a.get('name'), 'state': a.get('state')}
                for a in ph.get('artifacts', [])
            ],
        })

    return jsonify({
        'status': 'ok',
        'project': meta.get('project'),
        'current_month': meta.get('current_month'),
        'deadline_month': meta.get('deadline_month'),
        'buffer_months': meta.get('buffer_months'),
        'tier': meta.get('tier'),
        'phases': phases,
    })


@app.route('/api/plaza', methods=['GET'])
def plaza():
    """Firebase RTDB plaza URL 을 반환한다."""
    # TODO: connect-ai 설정에서 읽어오도록 교체
    plaza_url = 'https://rscad-plaza-default-rtdb.firebaseio.com'
    return jsonify({
        'status': 'ok',
        'plaza_url': plaza_url,
    })


@app.route('/api/notes')
def list_notes():
    """GFM_Research 볼트의 실험 노트·문헌 노트 목록을 반환."""
    vault = ROOT / 'GFM_Research'
    notes = []
    for pattern, category in [
        ('RSCAD/Phase*/*.md', 'phase'),
        ('RSCAD/Phase*/*/*.md', 'phase'),
        ('00_Knowledge/literature/*.md', 'literature'),
        ('00_Knowledge/claims/*.md', 'claim'),
    ]:
        for p in sorted(vault.glob(pattern)):
            if p.name.startswith('.') or p.name.startswith('_'):
                continue
            try:
                text = p.read_text(encoding='utf-8')
                title = next((l.lstrip('#').strip() for l in text.split('\n')
                              if l.startswith('#') and not l.startswith('---')), p.stem)
                notes.append({
                    'name': p.stem,
                    'title': title[:80],
                    'category': category,
                    'path': str(p.relative_to(vault)),
                    'size': len(text),
                    'mtime': p.stat().st_mtime,
                })
            except Exception:
                continue
    notes.sort(key=lambda n: -n['mtime'])
    return jsonify({'status': 'ok', 'notes': notes[:50], 'total': len(notes)})


@app.route('/api/note')
def get_note():
    """특정 노트의 마크다운 내용을 반환."""
    path = request.args.get('path')
    if not path:
        return jsonify({'status': 'error', 'error': 'path 파라미터 필요'}), 400
    vault = ROOT / 'GFM_Research'
    fp = vault / path
    if not fp.exists() or not fp.suffix == '.md':
        return jsonify({'status': 'error', 'error': f'파일 없음: {path}'}), 404
    try:
        fp.resolve().relative_to(vault.resolve())
    except ValueError:
        return jsonify({'status': 'error', 'error': '경로 이탈'}), 403
    text = fp.read_text(encoding='utf-8')
    return jsonify({'status': 'ok', 'path': path, 'content': text})


@app.route('/api/pso', methods=['POST'])
def pso_not_implemented():
    return jsonify({
        'status': 'not_implemented',
        'error':  'PSO 미구현 (Phase 4)',
        'note':   'v2 의 /api/pso 는 random.uniform() 으로 수렴 곡선을 '
                  '생성해 반환했습니다. 가짜 데이터가 대시보드에 실제 결과처럼 '
                  '표시되므로 제거했습니다.',
        'blocker': '목적함수 미확정 — ζ_min 이 SCR 구간마다 다른 모드를 '
                   '가리키므로 대역별 가중합으로 재설계 필요.',
    }), 501


if __name__ == '__main__':
    print("=" * 62)
    print("  GFM Research Flask Server (v3)")
    print(f"  모델: {M.N}-state")
    print(f"  실행: {STATE['run_dir'].name if STATE['run_dir'] else '없음'}")
    print(f"  SCR : {sorted(STATE['A'], reverse=True)}")
    print("  http://localhost:5000")
    print("=" * 62)
    app.run(host='0.0.0.0', port=5000, debug=True)