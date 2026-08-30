---
type: reference
phase: 2
status: verified
date: 2026-08-28
tags: [reference, code, simulation, runner, pf, app]
---

# Simulation 코드 구조

> **저장 위치:** `02_방법론/`

## 파일 역할

| 파일 | 역할 | 실행 |
|---|---|---|
| `model.py` | 22-state 심볼릭 모델. SymPy 로 `f(x,u)` 구성 → `J = ∂f/∂x` 유도 → `lambdify` | 라이브러리 |
| `op.py` | 동작점. `fsolve` 로 `f(x,u)=0` 풀어 `x₀` 반환. `jacobian` · `fd_jacobian` 제공 | 라이브러리 |
| `runner.py` | **진입점.** 스윕 → 동작점 → 야코비안 → 고유값 → `results/` 저장 | ✅ |
| `pf.py` | 참여계수 분석. 모드 물리 귀속 확정 | ✅ |
| `check_sync.py` | 동기화 모드 δ 반응 검증 (진단용) | ✅ |
| `xval.py` | 심볼릭 vs 유한차분 교차검증 | ✅ |
| `Server/app.py` | Flask 대시보드 | ✅ |

▸ `__pycache__` 에 `model` · `op` 만 컴파일된 것이 의존 관계를 증명한다. `runner` · `pf` · `xval` 은 아무도 import 하지 않는 진입점이다.

## 실행 순서

```bash
python Simulation/xval.py                          # 모델 무결성 (모델 수정 후 필수)
python Simulation/runner.py --XR 1.0 --SCR 3.0 2.0 1.5 1.0 0.8 --tag v3_xr10
python Simulation/pf.py                            # LATEST 대상 모드 귀속
python Server/app.py                               # 대시보드
```

## 저장 규약

```
results/
├── LATEST.json                                    ← 포인터 (폴더 복사 아님)
├── J{J}_Dp{Dp}_Kpv{Kpv}_wc{wc}_XR{XR}_{hash}_{tag}/
│   ├── A_num_SCR3.00.npy      22×22 야코비안
│   ├── x0_SCR3.00.npy         동작점
│   ├── eigenvalue_results.json  modes 배열에 전 진동모드 ζ·f·대역
│   ├── meta.json
│   └── results.md
└── _archive/                                      ← 구버전 격리
```

※ 해시는 `ctrl + XR + SCR 리스트` 로 계산. SCR 리스트가 다르면 다른 폴더가 되어 이전 `.npy` 오염을 막는다. → [[실행_식별자_설계원칙]]

## runner.py v3 주요 함수

| 함수 | 역할 |
|---|---|
| `analyze(A)` | 진동모드 목록 + 대역별 ζ + 전역 ζ_min·귀속 대역 |
| `coupling_effect(A, idx_map)` | 헝가리안 매칭 기반 커플링 이동량. `shift_crit` 이 인용 대상 |
| `fd_error(A, A_fd)` | 전역 정규화 + **성분별** 상대오차 (전역만 쓰면 큰 성분이 분모 지배) |
| `solve_with_continuation` | 미수렴 시 SCR 4단계 세분 재시도 → 원인 분류 |
| `run(ctrl, SCR, XR, persist=False)` | PSO 호출용. 디스크 쓰기 완전 차단 |
| `resolve_latest(root)` | `LATEST.json` → 폴더. app.py 가 사용 |

## 폐기된 설계 (재도입 금지)

> [!danger] app.py v2 에 있던 것들
> - `_get_A_num()` — 로드한 야코비안 성분을 하드코딩 수식으로 덮어썼다. 인덱스 8/9/19/20 은 δ 없던 **21-state** 배치 기준이라 22-state 에서는 다른 상태를 가리킨다. → [[블록삼각_함정]] 과 같은 계열
> - `build_jacobian()` — numpy 근사 fallback. 진짜 모델과 구분 없이 응답에 섞여 나갔다
> - `analyze_eigenvalues()` 의 'VSG 스윙' 삽입 — 고유값에 없는 모드를 지어내 ζ_min 을 갈아치웠다
> - `scr_star` / `zeta_threshold` / `du_pv_pct` — 출처 없는 해석식
> - `/api/pso` — `random.uniform()` 수렴 곡선

▸ `shutil.copytree` 로 `latest/` 폴더를 복사하던 방식도 폐기. `os.replace` 원자적 포인터 파일로 교체.

## app.py v3 설계 원칙

**날조하지 않는다.** 저장된 결과를 보여주거나, `runner.run()` 을 실제로 호출한다. 둘뿐이다.

| 엔드포인트 | 동작 |
|---|---|
| `GET /api/result?SCR=` | 저장값 그대로. **없는 SCR 은 404** (근처 값 대체 금지) |
| `GET /api/modes?SCR=` | 대역별 모드 + 참여 정보 |
| `GET /api/sweep2d` | 저장된 전 실행 집계. 감쇠·부하가능성 경계 **분리 반환** |
| `POST /api/compute` | 슬라이더 값으로 `runner.run(persist=False)` 실제 호출 |
| `POST /api/pso` | 501 |

▸ `load_run()` 이 `meta['n_states'] != 22` 면 예외. 구버전 결과가 조용히 로드되지 않는다.

## 🔗 연결 노트

| 방향 | 노트 | 이유 |
|---|---|---|
| ← | [[Phase02_완료]] | 모델 재구축 경위 |
| ← | [[블록삼각_함정]] | 하드코딩 행렬 금지 원칙 |
| ← | [[실행_식별자_설계원칙]] | 폴더명·해시 규약 |
| → | [[실험_재현성_체크리스트]] | 실행 전 점검 |

> [!question] 허브 갱신 필요
> 이 노트를 [[Phase_지식_연결맵]] 과 [[GFM_연구_전체지도.md]] 에 연결할 것.
