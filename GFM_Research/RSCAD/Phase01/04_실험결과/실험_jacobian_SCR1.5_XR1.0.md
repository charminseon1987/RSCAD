---

## type: experiment api: /api/jacobian date: 2026-08-19 phase: 1 status: verified tags: [jacobian, eigenvalue, flask, numpy]

# 🧪 실험: /api/jacobian — SCR=1.5, X/R=1.0

## 입력 파라미터

```json
{
  "SCR": 1.5,
  "XR":  1.0,
  "J":   0.5,
  "Dp":  20.0,
  "Kpv": 1.0,
  "Kpc": 5.0,
  "Lv":  0.1,
  "Kiv": 100,
  "Kic": 50,
  "wc":  31.4
}
```

## 실험 결과 (실측값)

```json
{
  "stable":              true,
  "zeta_min":            0.256391,
  "f_dom_hz":            0.3584,
  "coupling_A96":        0.0031831,
  "idc0":                0.6,
  "scr_star":            1.22,
  "zeta_threshold":      1.7765,
  "valid_linearization": false,
  "du_pv_pct":           12.45,
  "engine":              "numpy"
}
```

## 고유값 (21개)

|#|Re(λ)|Im(λ)|ζ|f(Hz)|모드|
|---|---|---|---|---|---|
|1|-100.0|±376.99|0.2564|60.0|LCL 공진|
|2|-250.0|±376.99|0.5527|60.0|LCL 공진|
|3|-177.7|±266.57|0.5547|42.4|LCL 중간|
|4~21|실수극점|0|—|—|PI·전압·전류|

## 분석

### ✅ 정상 항목

- `stable=true` — 모든 고유값 좌반평면
- `coupling_A96=0.003183` — 이론값 `idc0/(J·ω₀)=0.6/(0.5×376.99)=0.003183` ✅
- `scr_star=1.22` — SCR=1.5 > 1.22이므로 현재 운전점 안전

### ⚠️ 주의 항목

- `f_dom_hz=0.36Hz` — numpy 근사 (Phase 3 Prony 실측 필요)
- `valid_linearization=false` — Δu_pv=12.45% > 5% → SCR=1.5에서 선형화 유효성 초과 → Phase 3에서 PSCAD Layer 2 교차검증 필요
- `zeta_threshold=1.78` — f_dom이 낮아서 비정상적으로 높음 → Phase 3 f_dom 실측 후 재계산 예정

### 📌 핵심 메모

```
DC-AC 커플링 A_k(9,6) 검증:
이론값 = idc0/(J·ω₀)
       = 0.6 / (0.5 × 2π × 60)
       = 0.6 / 188.496
       = 0.003183 ✅ 일치

현재 numpy 근사 모델 한계:
- VSG 스윙 모드(~1Hz) 미생성 → f_dom 부정확
- DC PI 구조 불완전 → stable 판정 신뢰도 중간
- Phase 2 SymPy 완성 후 재검증 필요
```

## Claude 프롬프트 (재현용)

```
[이 노트 전체 붙여넣기]
[GFM_연구_전체지도.md 붙여넣기]

→ "이 야코비안 결과에서 지배 모드를 식별하고
   PSO 목적함수에 반영할 모드를 결정해줘"
```

## 연결 노트

- [[DC-AC_커플링]] — 커플링 원소 이론 설명
- [[고유값_안정도판단]] — Re(λ) < 0 조건
- [[실험 sweep2d j0.5 dp20]] — 다음 실험