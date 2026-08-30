---

## type: prompt-template date: 2026-08-20 tags: [prompt, template, obsidian-update]

# ⚡ 실험 결과 → Obsidian 업데이트 Claude 프롬프트

> **사용법:** 실험 결과가 나오면 아래 프롬프트에 결과를 붙여넣고 Claude에게 전송

---

## 🔵 프롬프트 A — 일반 실험 결과 (jacobian, sweep2d)

```
═══════════════════════════════════════════════════
[연구 컨텍스트]

연구자: 조연호 · 연세대 스마트그리드 연구실 · 허견 교수
연구: PSO 기반 2단 PV+ESS GFM 인버터 21차 소신호 모델 + SCR-X/R 2D CHIL 검증
현재단계: Phase 2 — SymPy 야코비안 구현 중

4중 차별화 (표 6-3):
① 모델차수: Dong(2026) 12차 → 본연구 21차 (DC-AC 커플링, [7]Zhao근거)
② PSO역할: SVR 3개 → GFM 제어이득 14개 직접 최적화 ([1]Chen기반)
③ 검증: 소프트웨어 → RTDS CHIL + 실DSP ([9]IEEE Std.2004-2025)
④ SCR경계: 1D CSCR → SCR*(X/R) 2D 곡면 ([3]Ganguly 1D불완전 증명)

핵심 수치:
- ζ_threshold = 0.64 (UNIFI V3 역산)
- A_k(9,6) 이론: SCR=1.5 → 0.003183 = idc0/(J·ω₀)
- 상태변수 21개, PSO 파라미터 14개, CHIL 88포인트

▸ = 실험/논문 사실 / ※ = 내 판단 (반드시 구분)
═══════════════════════════════════════════════════

[이번 실험]
API: {{/api/jacobian 또는 /api/sweep2d}}
조건: SCR={{}} XR={{}} J={{}} Dp={{}}

[결과 붙여넣기]
{{curl 결과 JSON}}

═══════════════════════════════════════════════════

다음을 해줘:

1. 핵심 수치 추출 (stable, ζ_min, f_dom, A_k(9,6), SCR*)

2. 참고문헌 연결
   - [1]Chen, [2]Dong, [3]Ganguly, [7]Zhao 중 관련된 것만
   - 각각 "▸ 어떤 점에서 연결되는지" 1~2줄

3. Obsidian 노트 생성 (frontmatter 포함)
   파일명: EXP_{{날짜}}_{{API}}_{{조건}.md

4. GFM_연구_전체지도.md 업데이트할 내용 알려줘
```

---

## 🔴 프롬프트 B — 버그 분석 (sym.py 실패 시)

```
═══════════════════════════════════════════════════
[연구 컨텍스트 — 위와 동일, 생략]
═══════════════════════════════════════════════════

[버그 정보]
파일: Simulation/sym.py
단계: Phase 2 — SymPy 21차 야코비안
시도: {{몇차}}

[이번 결과]
{{python sym.py 출력 붙여넣기}}

[이전 시도 기록]
1차: dpv=0.5 고정 → stable=False, zeta=-0.68, A_k=0
2차: pu 단위 통일 → stable=False, zeta=-0.05, A_k=0
3차: AC 단독 확인 → stable=True ✅ (AC는 정상)
4차: dpv_sym=0.5+Kp1*xPI1 → stable=False, zeta=-0.38, A_k=0.003183 ✅

알려진 사실:
▸ AC 서브시스템 단독: stable=True
▸ A_k(9,6) = 이론값 일치 (4차부터)
▸ DC 서브시스템 포함 시: stable=False

가설:
A. iLpv_ref = 0.9/upv 비선형항 → 선형화 필요
B. DC PI 구조의 다른 연결 문제

═══════════════════════════════════════════════════

다음을 해줘:

1. 이번 시도에서 개선된 것 / 여전히 문제인 것 분리

2. 불안정 원인 분석
   - 어느 고유값이 우반평면?
   - [7]Zhao DC-AC 커플링과 연관?

3. {{n+1}}차 시도 코드 제안 (sym.py 수정 부분만)

4. BUG_sym_DC_PI_{{차수}}.md Obsidian 노트 업데이트 내용
   - 시도 기록 표 추가
   - 원인 분석 업데이트
   - 다음 시도 방향
```

---

## 🟡 프롬프트 C — Phase 완료 시 (stable=True 달성)

```
═══════════════════════════════════════════════════
[연구 컨텍스트 — 위와 동일]
═══════════════════════════════════════════════════

[Phase 2 완료 결과]
{{sym.py 최종 출력}}

═══════════════════════════════════════════════════

Phase 2 완료 기준 체크:
- [ ] stable=True (4개 SCR 모두)
- [ ] zeta_min > 0
- [ ] A_k(9,6) 오차 < 1%
- [ ] f_dom 0.1~10Hz 범위

다음을 해줘:

1. Phase 2 완료 여부 판정 및 근거

2. 표 6-3 차별화 업데이트
   - [7]Zhao A_k(9,6) 검증: ✅/❌
   - [1]Chen 21차 구조 일치: ✅/❌

3. app.py 연동 코드
   - numpy 근사 → SymPy 결과로 교체하는 부분

4. Obsidian 전체 업데이트
   - BUG 노트 → status: resolved
   - GFM_전체지도 → Phase 2 ✅ 완료
   - 새 EXP 노트 생성
   - Phase 3 준비사항

5. IEEE Access 논문 Section 4 (소신호 모델) 초안 1단락
```

---

## 📋 노트 업데이트 자동화 스크립트 (참고)

```python
# update_obsidian.py
# 실험 결과 JSON → Obsidian 노트 자동 생성

import json, datetime
from pathlib import Path

VAULT = Path("~/Obsidian/GFM_Research").expanduser()

def update_from_jacobian(result: dict, params: dict):
    date = datetime.date.today().strftime("%Y-%m-%d")
    fname = f"EXP_{date}_jacobian_SCR{params['SCR']}_XR{params['XR']}.md"
    
    # 참고문헌 자동 연결
    refs = []
    if abs(result['coupling_A96'] - theory_coupling(params)) < 0.001:
        refs.append("[[Zhao_2023_Aalborg]] — A_k(9,6) 이론값 일치 ✅")
    if not result['valid_linearization']:
        refs.append("[[Chen_2024_Electronics]] — 선형화 유효성 초과, Layer 2 필요")
    if result['zeta_min'] < 0.64:
        refs.append("[[PSO_이중수렴기준]] — PSO 최적화 필요")
    
    # 노트 생성
    content = f"""---
type: experiment
date: {date}
status: verified
---
# EXP: jacobian SCR={params['SCR']}

## 결과
stable: {result['stable']}
ζ_min: {result['zeta_min']}
A_k(9,6): {result['coupling_A96']}

## 참고문헌 연결
{''.join(f'- {r}' + chr(10) for r in refs)}
"""
    (VAULT / "03_실험결과" / fname).write_text(content, encoding='utf-8')
    print(f"✅ 노트 생성: {fname}")
```