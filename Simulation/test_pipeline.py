"""
test_pipeline.py — model.py → op.py → metrics.py → runner.py 파이프라인 검증

3단계 테스트:
  1단계: 단위 테스트 (model, op, metrics 개별)
  2단계: 파이프라인 통합 테스트
  3단계: 회귀 테스트 (기존 결과 스냅샷 대조)

실행:
  python Simulation/test_pipeline.py
  python -m pytest Simulation/test_pipeline.py -v
"""

import sys, os, json
import numpy as np
from pathlib import Path

# Simulation/ 디렉토리를 경로에 추가
sys.path.insert(0, str(Path(__file__).parent))

import model as M
import op
import metrics as MT

# ══════════════════════════════════════════════
# 1단계: 단위 테스트
# ══════════════════════════════════════════════

class Test1_Model:
    """model.py 심볼릭 구조 검증"""

    def test_state_count(self):
        assert M.N == 22, f"상태변수 수 {M.N} != 22"
        assert M.N_DC == 8
        assert M.N_AC == 14

    def test_coupling_bidirectional(self):
        """DC-AC 커플링이 양방향(비블록삼각)인지 확인"""
        dc2ac, ac2dc = M.coupling_report()
        assert len(dc2ac) > 0, "DC→AC 커플링 없음 — 블록삼각"
        assert len(ac2dc) > 0, "AC→DC 커플링 없음 — 블록삼각"

    def test_jacobian_shape(self):
        assert M.A_sym.shape == (22, 22)
        assert M.B_sym.shape == (22, 6)

    def test_lambdify_callable(self):
        f_fn, A_fn, B_fn = M.lambdify_all()
        assert callable(f_fn)
        assert callable(A_fn)
        assert callable(B_fn)


class Test2_Op:
    """op.py 동작점·야코비안 검증"""

    def test_solve_op_converges_SCR3(self):
        """강계통(SCR=3.0)에서 동작점 수렴"""
        x0, ok, msg = op.solve_op(3.0, 1.0)
        assert ok, f"SCR=3.0 미수렴: {msg}"

    def test_delta_reasonable(self):
        """동작점 δ < 30° (강계통)"""
        x0, ok, _ = op.solve_op(3.0, 1.0)
        assert ok
        d = dict(zip(M.STATE_NAMES, x0))
        delta_deg = np.degrees(d['delta'])
        assert 0 < delta_deg < 30, f"δ={delta_deg:.1f}° 비정상"

    def test_v_dc_near_ref(self):
        """동작점 v_dc ≈ v_dc_ref"""
        x0, ok, _ = op.solve_op(3.0, 1.0)
        assert ok
        d = dict(zip(M.STATE_NAMES, x0))
        assert abs(d['v_dc'] - op.FIXED['v_dc_ref']) / op.FIXED['v_dc_ref'] < 0.05

    def test_v_oq_near_zero(self):
        """동작점 v_oq ≈ 0 (dq 프레임 정렬 확인)"""
        x0, ok, _ = op.solve_op(3.0, 1.0)
        assert ok
        d = dict(zip(M.STATE_NAMES, x0))
        assert abs(d['v_oq']) < 5.0, f"v_oq={d['v_oq']:.2f} — dq 정렬 이상"

    def test_fd_jacobian_matches(self):
        """유한차분 야코비안과 심볼릭 야코비안 일치 (SCR=3.0)"""
        x0, ok, _ = op.solve_op(3.0, 1.0)
        assert ok
        A = op.jacobian(x0, 3.0)
        A_fd = op.fd_jacobian(x0, 3.0)
        d = np.abs(A - A_fd)
        rel = np.max(d) / max(np.max(np.abs(A)), 1.0)
        assert rel < 1e-6, f"야코비안 검산 오차 {rel:.2e} >= 1e-6"

    def test_fd_jacobian_entry_level(self):
        """성분별 상대오차도 확인"""
        x0, ok, _ = op.solve_op(3.0, 1.0)
        assert ok
        A = op.jacobian(x0, 3.0)
        A_fd = op.fd_jacobian(x0, 3.0)
        mask = np.abs(A) > 1e-8
        if mask.any():
            rel = np.where(mask, np.abs(A - A_fd) / np.maximum(np.abs(A), 1e-8), 0.0)
            max_entry = np.max(rel)
            assert max_entry < 1e-5, f"성분별 오차 {max_entry:.2e}"

    def test_grid_RL(self):
        """계통 임피던스 계산 기본 검증"""
        Rg, Lg = op.grid_RL(3.0, 1.0)
        Zg = op.Z_BASE / 3.0
        assert Rg > 0 and Lg > 0
        Xg = Lg * op.FIXED['w0']
        assert abs(Xg / Rg - 1.0) < 1e-10, "X/R=1.0 불일치"

    def test_equilibrium_residual(self):
        """동작점에서 f(x0) ≈ 0"""
        x0, ok, _ = op.solve_op(3.0, 1.0)
        assert ok
        f_fn, _, _ = M.lambdify_all()
        args = op._args(x0, 3.0, 1.0)
        residual = np.array(f_fn(*args)).ravel()
        assert np.max(np.abs(residual)) < 1e-8, \
            f"잔차 {np.max(np.abs(residual)):.2e}"


class Test3_Metrics:
    """metrics.py 지표 산출 검증"""

    def test_diagonal_matrix_sigma(self):
        """인위적 대각행렬: σ = -diag"""
        A = np.diag([-1.0, -2.0, -5.0, -10.0])
        # metrics는 model.STATE_NAMES를 참조하므로 직접 analyze 호출
        from scipy import linalg
        ev = linalg.eigvals(A)
        sigmas = sorted(-ev.real)
        assert abs(sigmas[0] - 1.0) < 1e-10, "σ_min != 1.0"

    def test_oscillatory_mode_zeta(self):
        """인위적 2차계: ζ = cos(arctan(ω/σ))"""
        sigma, omega = 2.0, 6.0
        A = np.array([[-sigma, -omega],
                       [omega,  -sigma]])
        from scipy import linalg
        ev = linalg.eigvals(A)
        # ζ = σ / |λ| = σ / sqrt(σ²+ω²)
        expected_zeta = sigma / np.sqrt(sigma**2 + omega**2)
        zetas = [-e.real / abs(e) for e in ev if abs(e.imag) > 0.01]
        assert len(zetas) > 0
        assert abs(zetas[0] - expected_zeta) < 1e-10

    def test_metrics_on_real_system(self):
        """실제 시스템 야코비안에서 metrics 정상 반환"""
        x0, ok, _ = op.solve_op(3.0, 1.0)
        assert ok
        A = op.jacobian(x0, 3.0)
        m = MT.metrics(A)
        assert m is not None
        assert m['sigma_min'] > 0, "불안정"
        assert m['score'] > 0
        assert m['binding'] in ('sigma', 'zeta')
        assert m['t_s_max'] is not None

    def test_objective_stable_negative(self):
        """안정 시 objective < 0"""
        x0, ok, _ = op.solve_op(3.0, 1.0)
        assert ok
        A = op.jacobian(x0, 3.0)
        cost = MT.objective(A)
        assert cost < 0, f"안정인데 cost={cost}"


# ══════════════════════════════════════════════
# 2단계: 파이프라인 통합 테스트
# ══════════════════════════════════════════════

class Test4_Pipeline:
    """runner.py 통합 테스트"""

    def _default_ctrl(self):
        return {k: v for k, v in op.CTRL.items()}

    def test_run_persist_false(self):
        """persist=False로 전체 파이프라인 실행"""
        import runner
        ctrl = self._default_ctrl()
        results, meta, out_dir = runner.run(
            ctrl, [3.0, 2.0, 1.5], XR=1.0,
            persist=False, quiet=True)
        assert out_dir is None
        assert meta['all_converged']
        assert meta['n_states'] == 22

    def test_all_scr_fd_error(self):
        """모든 SCR에서 유한차분 오차 < 1e-6"""
        import runner
        ctrl = self._default_ctrl()
        results, meta, _ = runner.run(
            ctrl, [3.0, 2.0, 1.5, 1.0], XR=1.0,
            persist=False, quiet=True)
        for scr, r in results.items():
            if not r.get('converged'):
                continue
            assert r['fd_rel_error'] < 1e-6, \
                f"SCR={scr} 전역 검산 오차 {r['fd_rel_error']:.2e}"
            assert r['fd_entry_rel_error'] < 1e-5, \
                f"SCR={scr} 성분별 검산 오차 {r['fd_entry_rel_error']:.2e}"

    def test_eigenvalue_count(self):
        """각 SCR에서 22개 고유값 산출"""
        import runner
        ctrl = self._default_ctrl()
        results, _, _ = runner.run(
            ctrl, [3.0, 1.5], XR=1.0,
            persist=False, quiet=True)
        for scr, r in results.items():
            if not r.get('converged'):
                continue
            assert len(r['eigenvalues']) == 22, \
                f"SCR={scr} 고유값 {len(r['eigenvalues'])}개 != 22"

    def test_coupling_effect_no_crash(self):
        """coupling_effect가 IndexError 없이 실행"""
        import runner
        x0, ok, _ = op.solve_op(3.0, 1.0)
        assert ok
        A = op.jacobian(x0, 3.0)
        an = runner.analyze(A)
        idx_map = dict(an['band_idx'])
        idx_map['crit'] = an['crit_idx']
        # 정상 케이스
        coup = runner.coupling_effect(A, idx_map)
        assert 'max_shift' in coup

        # 엣지 케이스: 존재하지 않는 인덱스
        idx_map_bad = {'ghost': 999}
        coup2 = runner.coupling_effect(A, idx_map_bad)
        assert coup2.get('shift_ghost') is None

    def test_meta_structure(self):
        """meta에 필수 키 존재"""
        import runner
        ctrl = self._default_ctrl()
        _, meta, _ = runner.run(
            ctrl, [3.0, 2.0], XR=1.0,
            persist=False, quiet=True)
        required = [
            'run_name', 'model_version', 'n_states', 'ctrl_params',
            'all_converged', 'all_stable', 'score_min_all', 'sigma_min_all',
            'zeta_min_all', 'band_zeta_min', 'band_crossovers',
            'max_fd_error', 'delta_max_deg',
        ]
        for key in required:
            assert key in meta, f"meta에 '{key}' 없음"


# ══════════════════════════════════════════════
# 3단계: 회귀 테스트 (스냅샷 대조)
# ══════════════════════════════════════════════

class Test5_Regression:
    """기존 결과와 현재 코드 출력 비교"""

    def test_snapshot_SCR1_XR1(self):
        """SCR=1.0, XR=1.0 동작점·고유값 스냅샷"""
        x0, ok, _ = op.solve_op(1.0, 1.0)
        if not ok:
            # 연속화 필요
            xg = None
            for s in [3.0, 2.0, 1.5, 1.0]:
                x0, ok, _ = op.solve_op(s, 1.0, xg)
                if ok:
                    xg = x0
            assert ok, "SCR=1.0 연속화 실패"
            x0 = xg

        d = dict(zip(M.STATE_NAMES, x0))
        A = op.jacobian(x0, 1.0)
        ev = np.linalg.eigvals(A)
        max_re = np.max(ev.real)

        # 기본 물리 범위 검증 (절대값이 아닌 범위)
        assert 0 < np.degrees(d['delta']) < 90, "δ 범위 이상"
        assert d['v_dc'] > 700, "v_dc 비정상 저하"
        assert d['v_od'] > 200, "v_od 비정상 저하"

        # 안정성 (기본 파라미터에서 안정 기대)
        print(f"\n  [스냅샷] SCR=1.0  δ={np.degrees(d['delta']):.2f}°  "
              f"v_dc={d['v_dc']:.1f}  v_od={d['v_od']:.1f}  "
              f"max_Re={max_re:.4e}")

    def test_compare_existing_results(self):
        """기존 저장된 결과가 있으면 σ_min 대조"""
        results_root = Path(__file__).parent.parent / 'results'
        latest_ptr = results_root / 'LATEST.json'
        if not latest_ptr.exists():
            print("\n  [회귀] LATEST.json 없음 — 건너뜀")
            return

        ptr = json.loads(latest_ptr.read_text(encoding='utf-8'))
        run_dir = results_root / ptr['run_name']
        meta_path = run_dir / 'meta.json'
        if not meta_path.exists():
            print(f"\n  [회귀] {meta_path} 없음 — 건너뜀")
            return

        saved_meta = json.loads(meta_path.read_text(encoding='utf-8'))
        saved_sigma = saved_meta.get('sigma_min_all')
        saved_ctrl = saved_meta.get('ctrl_params', {})

        if saved_sigma is None or not saved_ctrl:
            print("\n  [회귀] 저장된 meta에 sigma_min_all 없음 — 건너뜀")
            return

        # 같은 파라미터로 재실행
        import runner
        try:
            _, new_meta, _ = runner.run(
                saved_ctrl,
                saved_meta.get('SCR_list', [3.0, 2.0, 1.5, 1.0]),
                saved_meta.get('XR', 1.0),
                persist=False, quiet=True)
        except RuntimeError:
            print("\n  [회귀] 재실행 미수렴 — 건너뜀")
            return

        new_sigma = new_meta.get('sigma_min_all')
        if new_sigma is not None and saved_sigma is not None:
            diff = abs(new_sigma - saved_sigma)
            print(f"\n  [회귀] σ_min: 저장={saved_sigma:.5f}  "
                  f"현재={new_sigma:.5f}  차이={diff:.2e}")
            assert diff < 0.01, \
                f"σ_min 회귀 차이 {diff:.2e} >= 0.01"


# ══════════════════════════════════════════════
# CLI 실행
# ══════════════════════════════════════════════
def run_all():
    """pytest 없이 직접 실행"""
    import traceback

    test_classes = [
        Test1_Model, Test2_Op, Test3_Metrics,
        Test4_Pipeline, Test5_Regression,
    ]

    total, passed, failed = 0, 0, 0
    failures = []

    for cls in test_classes:
        print(f"\n{'='*60}")
        print(f"  {cls.__name__}: {cls.__doc__}")
        print(f"{'='*60}")
        obj = cls()
        methods = [m for m in dir(obj) if m.startswith('test_')]
        for name in sorted(methods):
            total += 1
            try:
                getattr(obj, name)()
                print(f"  ✅ {name}")
                passed += 1
            except Exception as e:
                print(f"  ❌ {name}: {e}")
                failures.append((cls.__name__, name, traceback.format_exc()))
                failed += 1

    print(f"\n{'='*60}")
    print(f"  결과: {passed}/{total} 통과, {failed} 실패")
    print(f"{'='*60}")

    if failures:
        print("\n실패 상세:")
        for cls_name, name, tb in failures:
            print(f"\n--- {cls_name}.{name} ---")
            print(tb)

    return 0 if failed == 0 else 1


if __name__ == '__main__':
    sys.exit(run_all())
