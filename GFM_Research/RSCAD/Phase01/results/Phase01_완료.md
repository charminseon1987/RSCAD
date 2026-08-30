---
type: phase-log
phase: 1
date_start: 2026-08-19
date_end: 2026-08-19
status: complete
tags: [phase1, flask, numpy, dashboard]
---

# 📋 Phase 1: Flask 서버 + numpy 근사 모델

---

## 0. Phase 목표

> Flask API 서버 구축 + 웹 대시보드 연결 + 88포인트 2D 스윕 실행

```
목표: numpy 기반 소신호 모델로 야코비안·2D 스윕 API 구현
성공 기준:
  - [x] /api/jacobian stable=True 반환
  - [x] /api/sweep2d 88포인트 완료
  - [x] 웹 대시보드 Flask 연결
  - [x] results/ 폴더 관리 체계
```

---

## 1. 이전 Phase에서 넘어온 것

| 항목 | 값/상태 | 출처 |
|---|---|---|
| 연구 설계 | 제안서 v6 완료 | 교수님 검토 |
| 참고문헌 | 32편 DOI 검증 | 구글 독스 |
| ζ_threshold | 0.64 | UNIFI V3 역산 |
| 4중 차별화 | 표 6-3 확정 | Dong(2026) 비교 |

---

## 2. 이번 Phase 변경 사항

### 2.1 추가된 것 ✅
- Flask 서버 (`Server/app.py`) — numpy/scipy 기반
- `/api/jacobian` — 21차 야코비안 근사 + 고유값
- `/api/sweep2d` — 88포인트 SCR×X/R 스윕
- `/api/pso` — 시뮬레이션만 (실제 미구현)
- `/api/runs` — 실험 목록 관리
- `/api/reload` — 동적 실험 전환
- 웹 대시보드 (`Web/gfm_dashboard.html`) Flask 연결
- `results/` 파라미터별 폴더 자동 생성
- `latest/` 최신 실험 자동 복사

### 2.2 수정된 것 🔧
- `f_dom` 버그 수정: 60.0Hz → 0.3584Hz (VSG 스윙 모드 선택 로직)
- `analyze_eigenvalues` 정렬 기준: Re(λ) → ζ 오름차순
- `RESULTS_DIR` 경로: `Server/results` → `RSCAD/results`
- `/api/runs` 500 오류 수정 (폴더 없을 때 예외 처리)
- `latest/meta.json`에 `latest_copied_from` 필드 추가

### 2.3 미구현 ❌
- `/api/pso` 실제 PSO 알고리즘 (Phase 4로 이월)

---

## 3. 핵심 수치 스냅샷

| 항목 | Phase 0 (없음) | Phase 1 (numpy) | 변화 |
|---|---|---|---|
| 엔진 | — | numpy | 구축 |
| stable (SCR=1.5) | — | True | ✅ |
| ζ_min | — | 0.2564 | 근사값 |
| f_dom (Hz) | — | 0.3584 | 근사값 |
| A_k(9,6) | — | 0.003183 | 근사값 |
| SCR* | — | 0.8 (하한) | 근사 한계 |
| 88포인트 boundaries | — | 전부 null | numpy 한계 |

---

## 4. 실험 결과 목록

| 날짜         | 실험명                     | 상태  | 링크                           |
| ---------- | ----------------------- | --- | ---------------------------- |
| 2026-08-19 | jacobian SCR=1.5 XR=1.0 | ✅   | [[실험_jacobian_SCR1.5_XR1.0]] |
| 2026-08-19 | sweep2d J=0.5 Dp=20     | ✅   | [[실험 sweep2d j0.5 dp20]]     |
| 2026-08-19 | PSO (시뮬)                | ⚠️  | [[실험_pso_미구현]]               |

---

## 5. 버그 기록

| 버그명 | 상태 | 해결 방법 |
|---|---|---|
| f_dom=60.0Hz | ✅ resolved | VSG 스윙 모드 필터링 추가 |
| /api/runs 500 | ✅ resolved | 폴더 없음 예외 처리 |
| RESULTS_DIR 경로 | ✅ resolved | parent.parent로 수정 |

---

## 6. 참고문헌 연결

| 문헌 | Phase 1 연결 내용 | 검증 |
|---|---|---|
| [1] Chen 2024 | 21차 구조·파라미터 초기값 | ✅ 구조 동일 |
| [2] Dong 2026 | 4중 차별화 비교 기준 | ✅ A_k 없음 확인 |
| [3] Ganguly 2025 | X/R=5.0 null → 방향 일치 | ⚠️ 정성적 |
| [7] Zhao 2023 | A_k(9,6) 이론 적용 | ⚠️ 근사 수준 |
| [9] IEEE Std. | — | ⏳ Phase 6~7 |

---

## 7. 미해결 → Phase 2로 이월

```
[x] SymPy 21차 야코비안 (정확한 A_k, stable 판정)
    → Phase 2에서 해결 ✅
[ ] PSO 실제 알고리즘
    → Phase 4로 이월
[ ] f_dom 실측 (Prony 분석)
    → Phase 3으로 이월
```

---

## 8. 다음 Phase 준비사항

```
[x] sym.py SymPy 야코비안 구현
[x] results/ 폴더 구조 설계
[x] app.py ↔ results/ 동적 연동
```
