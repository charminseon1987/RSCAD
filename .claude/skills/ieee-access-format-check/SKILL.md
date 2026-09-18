---
name: ieee-access-format-check
description: IEEE Access 투고 원고의 형식 규정 준수 여부를 자동 검사한다. 섹션 구조, 그림/표 캡션, 수식 번호, 참고문헌 형식, 글자수/페이지 제한, Author Bio, Open Access 진술문 등 IEEE Access 고유 요건까지 포함.
allowed-tools: Read Write Edit Bash Glob Grep
metadata:
  version: "1.0"
  skill-author: 조연호 (연세대)
---

# IEEE Access Format Check

## Overview

IEEE Access 투고 전 원고(LaTeX 또는 Markdown draft)가 IEEE Access Author Guidelines를 충족하는지 체계적으로 검사한다. 학술지 reject의 ~20%는 형식 불량(desk rejection)이므로, 내용 리뷰 전 형식을 먼저 통과시키는 것이 효율적이다.

## When to Use This Skill

- LaTeX/Markdown 원고의 IEEE Access 형식 적합성을 검사할 때
- 투고 직전 최종 형식 점검
- `academic-paper` 스킬로 생성된 원고를 IEEE Access 형식으로 변환할 때
- 공저자에게 형식 체크 결과를 전달할 때

## Check Categories

### A. Structure & Sections

| # | 검사 항목 | 규정 | 심각도 |
|---|---|---|---|
| A1 | Abstract 존재 및 길이 | 250 words 이하 (IEEE Access 명시) | ERROR |
| A2 | Index Terms / Keywords | 4~6개, IEEE Thesaurus 기반 권장 | WARN |
| A3 | 필수 섹션 | I. Introduction, Conclusion(s) 필수 | ERROR |
| A4 | 섹션 번호 형식 | 로마 숫자 대문자 (I, II, III...) | ERROR |
| A5 | 부제목 형식 | A. B. C. (대문자 라틴) | WARN |
| A6 | Acknowledgment | 선택이나 있으면 번호 없이 | WARN |
| A7 | References 섹션 | 번호 있는 참고문헌 목록 | ERROR |

### B. Figures & Tables

| # | 검사 항목 | 규정 | 심각도 |
|---|---|---|---|
| B1 | 캡션 위치 | 그림: 아래, 표: 위 | ERROR |
| B2 | 캡션 형식 | `Fig. N.` 또는 `TABLE N` (대문자) | ERROR |
| B3 | 본문 참조 | 모든 그림/표가 본문에서 최소 1회 참조 | WARN |
| B4 | 해상도 | 최소 300 DPI (제출 시) | WARN |
| B5 | 그림 번호 연속성 | Fig. 1, 2, 3... 누락/건너뜀 없음 | ERROR |
| B6 | 컬러 사용 | 무료 컬러 (IEEE Access는 컬러 무료) | INFO |

### C. Equations

| # | 검사 항목 | 규정 | 심각도 |
|---|---|---|---|
| C1 | 수식 번호 | 참조되는 수식은 (1), (2)... 우측 정렬 | WARN |
| C2 | 변수 정의 | 수식 직후 "where" 블록에서 모든 변수 정의 | WARN |
| C3 | 수식 번호 연속성 | (1), (2), (3)... 누락 없음 | ERROR |
| C4 | 본문 참조 형식 | `(1)` 괄호 포함 | WARN |

### D. References

| # | 검사 항목 | 규정 | 심각도 |
|---|---|---|---|
| D1 | 형식 | IEEE 번호순 [1], [2], [3] | ERROR |
| D2 | 본문 순서 | 첫 등장 순서대로 번호 부여 | ERROR |
| D3 | 최소 개수 | 최소 20개 권장 (IEEE Access) | WARN |
| D4 | 자기인용 비율 | 전체의 20% 이하 권장 | WARN |
| D5 | DOI 포함 | 가능한 모든 참고문헌에 DOI | WARN |
| D6 | 최신성 | 최근 5년 이내 문헌 비율 ≥ 30% | INFO |
| D7 | 저자명 형식 | "First M. Last" 또는 약어 일관성 | WARN |

### E. IEEE Access Specific

| # | 검사 항목 | 규정 | 심각도 |
|---|---|---|---|
| E1 | 페이지 수 | Regular Paper: 최대 ~30 페이지 | WARN |
| E2 | Author Photo & Bio | 각 저자 사진 + 약력 필수 | ERROR |
| E3 | ORCID | 교신저자 ORCID 필수 | WARN |
| E4 | Open Access 진술 | CCBY 4.0 라이선스 명시 | WARN |
| E5 | 이해충돌 진술 | Conflict of Interest 선언 | WARN |
| E6 | 데이터 가용성 | Data Availability Statement | WARN |
| E7 | 제목 길이 | 12 words 이하 권장 | INFO |

### F. GFM 도메인 특화 (본 연구)

| # | 검사 항목 | 규정 | 심각도 |
|---|---|---|---|
| F1 | 시스템 파라미터 표 | 시뮬레이션 재현을 위한 전 파라미터 표 존재 | WARN |
| F2 | SCR/X/R 조건 명시 | 모든 시뮬레이션 결과에 계통 조건 명시 | ERROR |
| F3 | 야코비안 차수 명시 | 소신호 모델 차수(22차) 명확 기술 | WARN |
| F4 | CHIL 환경 기술 | RTDS/dSPACE 버전, 타임스텝, 하드웨어 명시 | WARN |

## Output Format

검사 결과는 다음 형태로 출력한다:

```
IEEE Access Format Check Report
================================
File: manuscript_draft.tex
Date: 2026-09-18

ERRORS (must fix before submission):
  [A1] Abstract length: 312 words (limit: 250)
  [B2] Fig. caption format: "Figure 3" → should be "Fig. 3"
  [D2] Reference [7] appears before [5] in text

WARNINGS (strongly recommended):
  [A2] Only 3 Index Terms (recommend 4~6)
  [D4] Self-citation ratio: 25% (recommend ≤ 20%)

INFO:
  [E7] Title: 15 words (recommend ≤ 12)
  [D6] Recent (5yr) reference ratio: 45% — good

Summary: 3 ERRORS, 2 WARNINGS, 2 INFO
Status: NOT READY for submission (fix ERRORS first)
```

## LaTeX Specific Patterns

LaTeX 원고 검사 시 다음 패턴을 탐지한다:

```latex
% A4: 섹션 번호 → \section{} 이 자동 생성하는지 확인
% B2: \caption{Fig. N.} vs \caption{Figure N} 구분
% C1: \begin{equation} ... \label{eq:xxx} 매칭
% D1: \bibliographystyle{IEEEtran} 확인
% E2: \begin{IEEEbiography} 존재 확인
```

## Example Invocations

```
사용자: 이 LaTeX 파일 IEEE Access 형식 검사해줘
→ 전 항목 검사 후 ERROR/WARN/INFO 보고

사용자: abstract 길이만 확인해줘
→ A1 항목만 검사

사용자: 참고문헌 형식 검사
→ D1~D7 항목 검사
```
