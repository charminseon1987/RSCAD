### 시뮬레이터와 차이점

| 항목     | 이전 (gfm_simulator) | 이번 (gfm_dashboard)          |
| ------ | ------------------ | --------------------------- |
| 데이터 출처 | 브라우저 내부 근사         | **Flask API 실제 호출**         |
| 고유값    | JavaScript 물리 근사   | **numpy/scipy 계산값**         |
| 2D 스윕  | 브라우저 계산            | **`/api/sweep2d` 호출**       |
| PSO    | 애니메이션만             | **`/api/pso` 호출 후 슬라이더 갱신** |
| API 상태 | 없음                 | **상단 실시간 연결 상태 표시**         |
| 엔진 표시  | 없음                 | **numpy · 고유값 플롯에 출처 표시**   |
### 동작 흐름

```
슬라이더 조정
    ↓
⚡ Flask API 야코비안 계산 클릭
    ↓
POST http://localhost:5000/api/jacobian
    ↓
numpy 21차 야코비안 계산
    ↓
고유값 21개 → 복소 평면 플롯
모드 분석 → 우측 패널
ζ_min, SCR*, f_dom → 결과 패널
```


Phase01 
✅ Flask 서버 실행 (numpy/scipy)
✅ /api/jacobian  — 21차 고유값 계산
✅ /api/sweep2d   — 88포인트 2D 스윕
✅ /api/pso       — PSO 최적화
✅ 웹 대시보드 연결 — Flask API 실시간 연동
✅ 고유값 복소 평면 시각화
✅ SCR*(X/R) 2D 히트맵
✅ 감쇠비 vs SCR 곡선




✅ 88포인트 스윕 완료
✅ SCR* 경계 도출 (X/R 0.5~2.0)
⚠️ X/R=5.0: 경계 미도출 → numpy 근사 한계
⚠️ SCR* 모두 0.8 → 해상도 부족

→ Phase 2 SymPy 21차 야코비안으로 교체하면
  정확한 SCR* 1.0~2.0 범위 도출 예상