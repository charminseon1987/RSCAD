---

## type: system-guide version: 2.0 date: 2026-08-20 tags: [obsidian, knowledge-management, GFM, experiment]

# GFM 연구 Obsidian 지식화 시스템 v2

> **기반:** 논문 지식화 템플릿 + 추출 프롬프트 v2 (2026-08-20 대화)  
> **원칙:** `▸` = 실험/논문에서 나온 것 / `※` = 내 판단·해석

---

## 1. 폴더 구조

```
~/dev/RSCAD/results/          ← 실험 결과 파일 저장
Obsidian Vault/
├── 00_MOC/
│   └── GFM_연구_전체지도.md    ← 허브
├── 01_개념/
│   ├── 소신호_선형화.md
│   ├── 고유값_안정도판단.md
│   ├── DC-AC_커플링.md
│   └── PSO_이중수렴기준.md
├── 02_방법론/
│   ├── 21차_야코비안_유도가이드.md
│   └── 88포인트_2D_스윕_설계.md
├── 03_실험결과/
│   ├── EXP_YYYY-MM-DD_API명_조건.md   ← 실험마다 생성
│   └── BUG_YYYY-MM-DD_버그명.md       ← 버그마다 생성
├── 04_문헌/
│   └── (논문 지식화 템플릿 v2 적용)
└── 05_템플릿/
    ├── TPL_실험결과.md
    ├── TPL_버그분석.md
    └── TPL_문헌노트.md
```

---

## 2. 실험결과 노트 템플릿 (TPL_실험결과.md)

```markdown
---
type: experiment
api: /api/{{엔드포인트}}
date: {{YYYY-MM-DD}}
phase: {{1~7}}
attempt: {{1차|2차|3차...}}
status: {{pending|running|verified|failed}}
tags: [experiment, {{api명}}, {{조건태그}}]
---

# 🧪 EXP: {{API명}} — {{핵심 조건}}

## 📥 입력

\`\`\`json
{{curl 파라미터 붙여넣기}}
\`\`\`

\`\`\`bash
# 재현 명령어
curl -X POST http://localhost:5000/api/{{엔드포인트}} \
  -H "Content-Type: application/json" \
  -d '{{파라미터}}'
\`\`\`

## 📤 출력 (API 응답 원본)

\`\`\`json
{{응답 붙여넣기}}
\`\`\`

## 📊 핵심 수치 추출

| 항목 | 값 | 기대값 | 판정 |
|---|---|---|---|
| stable | | true | |
| zeta_min | | ≥ 0.64 | |
| f_dom_hz | | 1~3 Hz | |
| A_k(9,6) | | idc0/(J·ω₀) | |
| SCR* | | | |

## 🔍 분석

### ▸ 관찰된 사실 (실험 결과)
- 

### ※ 해석 (내 판단)
- 

### ⚠️ 이상값·버그
- 

## 🔗 연관 지식

| 연결 방향 | 노트 | 이유 |
|---|---|---|
| 근거 이론 | [[DC-AC_커플링]] | A_k(9,6) 계산 근거 |
| 근거 이론 | [[고유값_안정도판단]] | stable 판정 기준 |
| 선행 실험 | | |
| 다음 실험 | | |
| 관련 버그 | | |
| 관련 문헌 | | |

## 🤖 Claude 지식 프롬프트

\`\`\`
[GFM_연구_전체지도.md 전체]
[이 노트 전체]
[연관 노트 1~2개]

→ 질문:
\`\`\`

## 📌 Obsidian 업데이트 체크리스트

- [ ] GFM_연구_전체지도.md 실험 링크 추가
- [ ] 관련 개념 노트 업데이트
- [ ] 이전 실험 노트에 "다음 실험" 링크 추가
- [ ] results/ 폴더 결과 파일 경로 기록
```

---

## 3. 버그분석 노트 템플릿 (TPL_버그분석.md)

```markdown
---
type: bug
component: {{파일명.py}}
date: {{YYYY-MM-DD}}
phase: {{1~7}}
attempt: {{1차|2차|3차...}}
status: {{open|in_progress|resolved|wontfix}}
severity: {{critical|major|minor}}
tags: [bug, {{컴포넌트}}, {{키워드}}]
---

# 🔧 BUG: {{버그명}}

## 증상

\`\`\`
예상값: 
실제값: 
오차:   
\`\`\`

## 시도 기록

| 차수 | 날짜 | 수정 내용 | 결과 | stable | zeta_min |
|---|---|---|---|---|---|
| 1차 | | | | | |
| 2차 | | | | | |
| 3차 | | | | | |
| 4차 | | | | | |

## 원인 분석

### ▸ 확인된 사실
- 

### ※ 가설
- 

## 수정 방향

\`\`\`python
# 현재 (문제)

# 수정 필요

\`\`\`

## 검증 기준

다음 조건을 모두 만족하면 RESOLVED:
- [ ] stable = True
- [ ] zeta_min > 0
- [ ] A_k(9,6) 이론값 오차 < 1%
- [ ] 4개 SCR 모두 통과

## 🔗 연관 지식

- [[21차_야코비안_유도가이드]] — 수식 근거
- [[DC-AC_커플링]] — A_k(9,6) 이론값
- [[실험결과 노트]] — 증상 발견 원본

## 🤖 Claude 지식 프롬프트

\`\`\`
[GFM_연구_전체지도.md]
[이 버그 노트 전체]
[21차_야코비안_유도가이드.md]

→ "SymPy f(x)에서 {{수정 대상}}을 올바르게 구현하는 코드를 작성해줘.
   검증 기준: stable=True, zeta_min>0, A_k(9,6)=이론값"
\`\`\`
```

---

## 4. sym.py 실행 후 Obsidian 자동 업데이트 절차

### Step 1 — 실험 실행

```bash
python Simulation/sym.py
# → results/ 폴더에 저장됨
```

### Step 2 — 결과 확인 포인트

```
확인 항목               기대값          현재값(4차)
────────────────────────────────────────────────
stable                  True            False ❌
zeta_min                > 0             -0.38 ❌
f_dom_hz                1~3 Hz          0.66  ⚠️
A_k(9,6) SCR=1.5        0.003183        0.003183 ✅
A_k(9,6) 오차           < 1%            0% ✅
```

### Step 3 — 노트 업데이트

```
BUG_sym_DC_PI.md → 시도 기록 표에 4차 결과 추가
GFM_연구_전체지도.md → 현재 상태 업데이트
```

---

## 5. 지식 연결 맵

```
sym.py 실험 결과
    │
    ├─▶ DC-AC_커플링.md
    │     A_k(9,6) = idc0/(J·ω₀) 이론값 검증
    │
    ├─▶ 야코비안_행렬.md
    │     블록 구조: A_DC(8×8), A_AC(13×13), A_coup(13×8)
    │
    ├─▶ 소신호_선형화.md
    │     선형화 유효성: Δu_pv < 5% 기준
    │
    ├─▶ 고유값_안정도판단.md
    │     Re(λ) < 0 → stable 판정
    │
    ├─▶ PSO_이중수렴기준.md
    │     최적화 대상 파라미터 14개
    │
    └─▶ Chen_2024_Electronics.md
          21차 모델 원출처, 파라미터 초기값
```

---

## 6. 논문 지식화 프롬프트 (v2 기반, GFM 연구 특화)

```
[시스템 프롬프트]

당신은 GFM 인버터·전력계통 안정도 분야 논문에서
구조화 데이터를 추출하는 도구다.

절대 규칙:
1. 원문에 없는 값은 "미명시"로 채운다
2. 초록만 있으면 수치 필드는 전부 "미확인"
3. 모든 수치는 단위+조건 포함
4. ▸ = 논문 내용 / ※ = 내 판단 — 반드시 구분
5. 출력은 Obsidian .md 형식

[GFM 도메인 필드]
- model_order: 상태변수 차수 (본 연구: 21차)
- scr_range: 검증 SCR 범위
- xr_range: X/R 조건
- validation_level: sim-only | CHIL | PHIL
- tuning_method: 수동 | PSO | GA | Lyapunov
- dc_ac_coupling: 반영여부 (본 연구 차별점)
- pso_params: PSO 최적화 파라미터 수

[출력 형식: Obsidian md]
---
cite_key: {{저자년도키워드}}
ref_num: 
year: 
venue: 
model_order: 
scr_range: 
validation_level: 
tuning_method: 
dc_ac_coupling: 
extraction_depth: full|abstract
---

# 📌 Brief Summary

# 📖 Core Content
▸ 핵심 기여:
▸ 방법:
▸ 검증:
▸ 주요 수치:
▸ 저자 한계:

# 🔗 Knowledge Connections
* 본 연구와 차이점:
* 인용 자리:
* 추적 우선 참고문헌:

# ✍️ My Take
※ 차별점:
※ 못 쓰는 이유:
※ 미확인:
```