---
type: phase-log
phase: 3
date_start: 
date_end: 
status: in_progress
tags: [phase3, PSO, pyswarms, optimization]
---

# 📋 Phase 3: PSO 실제 구현 (진행 중)

---

## 0. Phase 목표

> pyswarms 기반 PSO로 GFM 제어 파라미터 최적화 → ζ ≥ 0.64 달성

```
목표: 14개 파라미터 PSO 최적화 → SCR*(X/R) 경계 유효값 도출
성공 기준:
  - [ ] ζ_min ≥ 0.64 (4개 SCR 모두)
  - [ ] SCR*(X/R) boundaries 4개 X/R 조건 유효값
  - [ ] 이중 수렴 기준 달성 (조건1·2)
  - [ ] /api/pso 실제 알고리즘 동작
```

---

## 1. 이전 Phase에서 넘어온 것

| 항목 | 값/상태 | 출처 |
|---|---|---|
| 엔진 | sympy+numpy | Phase 2 |
| ζ_min | 0.1642 (< 0.64) | Phase 2 |
| A_k(9,6) 오차 | 0.0001% ✅ | Phase 2 |
| SCR* | null (전 구간) | Phase 2 |
| 88포인트 ζ_max | 0.177 | Phase 2 |

---

## 2. 이번 Phase 변경 사항

### 2.1 추가 예정 ⏳
- `pyswarms` 설치 및 PSO 엔진 구현
- `/api/pso` 실제 알고리즘 교체
- 이중 수렴 기준 구현
- PSO 결과 `results/` 저장

### 2.2 수정 예정 🔧
- `sym.py` → PSO 최적 파라미터로 재실행
- `app.py` → PSO 최적 run 자동 로드

---

## 3. 핵심 수치 스냅샷 (업데이트 예정)

| 항목 | Phase 2 | Phase 3 (목표) | 달성 |
|---|---|---|---|
| ζ_min | 0.1642 | **≥ 0.64** | ⏳ |
| SCR* (X/R=1.0) | null | **1.0~2.0** | ⏳ |
| PSO 수렴 횟수 | — | < 500회 | ⏳ |
| F_multi | — | < 0.1 | ⏳ |

---

## 4. PSO 설계

### 목적함수
```python
def F_multi(params, SCR_list=[3.0, 2.0, 1.5, 1.0]):
    F_total = 0
    for scr in SCR_list:
        eigs = get_eigenvalues(scr, params)
        F1 = sum(max(0, e.real) for e in eigs)       # 안정도
        F2 = sum((z - 0.707)**2 for z in zetas)       # ζ 추종
        F3 = sum(max(0, 0.64 - z) for z in zetas)    # 최소 ζ
        F_total += 0.3*F1 + 0.6*F2 + 0.1*F3
    return F_total / len(SCR_list)
```

### 최적화 파라미터 범위
| 파라미터 | 하한 | 상한 | 단위 |
|---|---|---|---|
| J | 0.01 | 10.0 | kg·m² |
| Dp | 1.0 | 100.0 | N·m·s |
| wc | 10.0 | 200.0 | rad/s |
| Lv | 0.001 | 0.5 | pu |
| Kpv | 0.01 | 5.0 | A/V |
| Kiv | 1.0 | 500.0 | A/Vs |
| Kpc | 0.1 | 30.0 | V/A |
| Kic | 1.0 | 200.0 | V/As |

### 이중 수렴 기준
```
조건 1: 상대 개선 < 0.1% 연속 30회
조건 2: 누적 감소 < 0.5% 동일 30회
→ 두 조건 모두 만족 시 수렴
```

---

## 5. 실험 결과 목록 (진행 중)

| 날짜 | 실험명 | 상태 | 링크 |
|---|---|---|---|
| — | PSO 1차 실행 | ⏳ | — |

---

## 6. 참고문헌 연결

| 문헌 | Phase 3 연결 내용 | 검증 |
|---|---|---|
| [1] Chen 2024 | PSO 14개 파라미터 목록 | ⏳ |
| [2] Dong 2026 | SVR 3개 vs PSO 14개 비교 | ⏳ |
| [3] Ganguly 2025 | X/R별 SCR* 검증 | ⏳ |

---

## 7. 미해결 (현재)

```
[ ] pyswarms 설치 확인
[ ] F_multi 목적함수 구현
[ ] 이중 수렴 기준 구현
[ ] PSO 실행 및 결과 확인
```

---

## 🤖 Claude 프롬프트 (PSO 구현용)

```
[GFM_마스터_컨텍스트_프롬프트.md]
[Phase02_완료.md]
[이 Phase 3 노트]

→ "pyswarms GlobalBestPSO로 이중 수렴 기준 PSO를 구현하고
   Flask /api/pso 엔드포인트에 연결해줘.
   
   목적함수: F_multi = (1/4)·Σ F(SCR_k)
   최적화 파라미터: J, Dp, wc, Lv, Kpv, Kiv, Kpc, Kic
   이중 수렴 조건1: 상대 개선 < 0.1% 연속 30회
   이중 수렴 조건2: 누적 감소 < 0.5% 동일 30회
   목표: ζ_min ≥ 0.64"
```
