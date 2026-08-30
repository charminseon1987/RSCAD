---

## type: MOC updated: 2026-08-19 phase: 1 status: active

# 🗺️ GFM 연구 전체지도

> **연구자:** 조연호 · 연세대학교 스마트그리드 연구실 · 허견 교수  
> **목표:** PSO 기반 2단 PV+ESS GFM 인버터 소신호 모델 + SCR-X/R 2D CHIL 검증  
> **저널:** IEEE Access (1차) → IEEE Trans. TSTE (최종)

---

## 📌 현재 상태

```
Phase 1 ▶ 진행 중
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Flask 서버 구축 (numpy/scipy)
✅ /api/jacobian  동작 확인
✅ /api/sweep2d   88포인트 완료
⚠️ /api/pso       시뮬만 (Phase 4에서 실제 구현)
✅ 웹 대시보드 Flask 연결
⏳ Phase 2: SymPy DC PI 구조 수정 중
```

---

## 🔑 Quick Reference

|항목|값|상태|
|---|---|---|
|ζ_threshold|0.64|✅ 수학적 검증|
|ζ* (PSO 목표)|0.707|✅|
|CHIL 포인트|88개|⏳ Phase 7|
|PSO 파라미터|14개|✅|
|MC 횟수|30회|⏳ Phase 4|
|SCR 운전점|{3.0, 2.0, 1.5, 1.0}|✅|
|X/R 조건|{0.5, 1.0, 2.0, 5.0}|✅|
|f_dom (현재)|0.3584 Hz (numpy 근사)|⚠️ Phase 3 실측|

---

## 🧪 실험 결과 링크

### Flask API 결과

- [[실험_jacobian_SCR1.5_XR1.0]] ✅
- [[실험 sweep2d j0.5 dp20]] ✅
- [[실험_pso_미구현]] ⚠️

### SymPy 결과

- [[Sym dc pi 버그 분석]] ⏳
- [[sym AC_서브시스템_안정확인]] ✅

---

## 📚 개념 노트

- [[소신호_선형화]]
- [[야코비안 행렬]]
- [[DC-AC_커플링]]
- [[고유값_안정도판단]]
- [[참여인자 지배모드]]
- [[Pso 이중수렴기준]]
- [[이중수렴기준 설계]]
-  [[과감쇠_동기화모드]] ← 동기화 모드는 실수극 ★ 
- [[모드교차_최소감쇠비_함정]] ← ζ_min 단일 지표의 함정 ★
- [[정적부하가능성_경계]] ← 2D 경계의 이중성 
- [[PSO_목적함수_설계]] ← 구 이중수렴기준 대체 -
- [[PSO_수렴판정_설계]] ← 구 이중수렴기준 설계 대체 
- ~~[[Pso 이중수렴기준]]~~ (superseded) 
- ~~[[이중수렴기준 설계]]~~ (superseded)
- 

---

## 📊 방법론 노트

- [[다중동작점_갱신절차]]
- [[21차 야코비안 유도가이드]]
- [[88포인트_2D_스윕_설계]]
- [[Prony 교차검증_절차]]

---

## 📚 문헌 노트

- [[Chen_2024_Electronics]] ← 방법론 베이스
- [[Dong_2026_FrontEnergyRes]] ← 선점 논문 ★
- [[Ganguly_2025_preprint]] ← 2D 근거
- [[Zhao_2023_Aalborg]] ← DC-AC 커플링

---

## ⚠️ 미해결 이슈

- [ ] SymPy DC PI 적분기 구조 수정 (`dpv = 0.5 + Kp1*xPI1`)
- [ ] PSO 실제 알고리즘 구현 (pyswarms Phase 4)
- [ ] f_dom 실측 (Phase 3 Prony)
- [ ] RTDS 가용 시간 예약
- [ ] 구글 독스 참고문헌 [1] 중복 삭제