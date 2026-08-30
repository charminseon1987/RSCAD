# 논문 지식화 템플릿 + 추출 프롬프트 v2

기존 노트 포맷(Brief Summary / Core Content / Knowledge Connections)을 유지하되, frontmatter와 출처 표기를 추가한 버전.

---

## A. 노트 템플릿

```markdown
---
cite_key: kang2026syntheticinertia
ref_num: 4
title: Synthetic Inertia Control for a Wind Turbine Generator
authors: [J. Kang, Y. C. Kang, K. H. Kim, K. Kang, Y. Lee, K. Hur, D. H. Cho]
corresponding: Kyeon Hur
year: 2026
venue: IEEE Trans. Sustain. Energy, vol.17, no.1, pp.684-696
doi: ""
pdf: "[[kang2026syntheticinertia.pdf]]"   # 없으면 빈 문자열
pdf_status: have              # have | oa-available | request | none
paper_type: method            # review | method | analysis | experimental
target_system: WTG            # WTG | PV | ESS | PV+ESS | 일반
control_scheme: [VSG, synthetic-inertia]
model_order: 미명시
analysis_method: [미명시]
tuning_method: adaptive       # 수동 | 적응형 | PSO | GA | Lyapunov기반
scr_range: 미명시
xr_range: 미명시
validation_level: sim-only    # none | sim-only | CHIL | PHIL | 실기
hardware: [MATLAB/Simulink]
extraction_depth: full        # full | abstract | metadata
section: Introduction
tags: [paper, VSG, synthetic-inertia, wind]
status: read                  # to-read | read | noted | cited
---

# 📌 Brief Summary
(2~3문장. 무엇을 하는 논문이고 내 논문에서 어떤 자리에 쓰는지)

# 📖 Core Content
▸ 전체 인용:
▸ 핵심 기여:
▸ 방법:
▸ 검증:
▸ 주요 수치:            (조건과 단위 포함. 없으면 "미명시")
▸ 저자가 밝힌 한계:

# 🔗 Knowledge Connections
* Related Topics:
* Projects/Contexts:
* Claims: [[claim-...]]

# ✍️ My Take
※ 차별점:              (내 논문이 이것과 다른 지점)
※ 인용 자리:            (서론 / 관련연구 / 방법 / 검증)
※ 전략적 배치 이유:
※ 그대로 못 쓰는 이유:
※ 미확인 항목:
```

**표기 규칙 — 이게 핵심**

- `▸` = 논문에 쓰여 있는 것. 원문 대조 가능해야 함.
- `※` = 내가 붙인 판단. 논문 근거 없음.
- 값이 없으면 `미명시`(원문에 없음) / `미확인`(내가 원문을 못 봄) 구분.

---

## B. 추출 프롬프트 (Claude Project 지침에 삽입)

```
당신은 전력전자·계통 논문을 위 템플릿 형식의 Obsidian 노트로 변환하는 도구다.

[절대 규칙]
1. ▸ 섹션에는 원문에 명시된 내용만 쓴다. 없으면 "미명시".
2. ※ 섹션은 사용자가 제공한 판단만 옮긴다. 스스로 지어내지 않고,
   판단 근거가 없으면 "(입력 필요)"로 비워둔다.
3. extraction_depth가 full이 아니면 model_order, scr_range, 주요 수치는
   전부 "미확인"으로 둔다. 초록만 보고 숫자를 채우면 안 된다.
4. 리뷰 논문이 인용한 결과를 본 논문 결과로 적지 않는다.
   반드시 "[참고문헌번호] 인용" 표기를 붙인다.
5. frontmatter의 모든 키를 빠짐없이 출력한다. 값이 없어도 키는 남긴다.
6. 출력은 마크다운 노트 하나. 설명·머리말 금지.

[cite_key 생성] 제1저자성(소문자) + 연도 + 주제어. 예: kang2026syntheticinertia
[ref_num] 사용자가 지정하지 않으면 null. 임의로 매기지 않는다.
```

**검증 콜(2단계) 리젝 규칙**

1. `extraction_depth != full` 인데 수치 필드에 숫자 존재 → 리젝
2. `paper_type: review` 인데 `model_order`에 정수 존재 → 리젝
3. ▸ 항목인데 원문 대조 불가 → 삭제 후 `※ 미확인 항목`으로 이동
4. frontmatter 키 누락 → 리젝
5. 주요 수치에 조건·단위 없음 → 해당 항목 삭제

---

## C. Dataview 집계

노트가 쌓이면 관련연구 표가 자동으로 나온다. `literature`(남의 논문)와 `mine`(내 결과)을 같이 걸어야 비교가 된다.

````
```dataview
TABLE ref_num AS "[]", target_system, control_scheme, tuning_method,
      validation_level, scr_range, extraction_depth
FROM "00_Knowledge/literature" OR "00_Knowledge/mine"
SORT ref_num ASC
```
````

`extraction_depth` 열을 항상 띄워둘 것. 원문을 안 본 행이 표에 섞인 채로 2장을 쓰면 잘못 인용한다.

**갭 확인용 쿼리** — 아래가 0건이면 그게 곧 기여 논거다.

````
```dataview
LIST FROM "00_Knowledge/literature"
WHERE target_system = "PV+ESS"
  AND tuning_method != "수동"
  AND contains(validation_level, "CHIL")
```
````

---

## D. 채워진 예시 — 리뷰 논문 케이스

```markdown
---
cite_key: salem2025gfmreview
ref_num: null
title: "Grid Forming Converters for Low Inertia Systems-Capabilities and Limitations: A Critical Review"
authors: [Q. Salem, B. Bany Fawaz, R. Aljarrah, M. Karimi]
corresponding: Mazaher Karimi
year: 2025
venue: IEEE Open J. Ind. Electron. Soc., vol.6, pp.775-801
doi: 10.1109/OJIES.2025.3566213
paper_type: review
target_system: 일반
control_scheme: [droop, VSG, synchronverter, VOC, dVOC, matching]
model_order: N/A(리뷰)
analysis_method: [eigenvalue, phase-portrait, Lyapunov, matrix-perturbation, geometrical-2D]
tuning_method: N/A(리뷰)
scr_range: "SCR<1 ~ SCR=50 (인용 범위 전체)"
xr_range: 미명시
validation_level: none
hardware: []
extraction_depth: full
section: Introduction, Related Work
tags: [paper, GFM, review, small-signal, FRT]
status: read
---

# 📌 Brief Summary
GFM 컨버터의 제어방식·안정도·FRT 한계를 통합 정리한 비판적 리뷰.
GFM이 GFL을 어디까지 대체 가능한지가 여전히 미해결이라는 문제의식.
서론의 GFM 필요성 논거와 관련연구 분류체계 근거로 사용.

# 📖 Core Content
▸ 전체 인용: Q. Salem, B. Bany Fawaz, R. Aljarrah, and M. Karimi,
  "Grid Forming Converters for Low Inertia Systems-Capabilities and Limitations:
  A Critical Review," IEEE Open J. Ind. Electron. Soc., vol. 17, no. 6,
  pp. 775-801, 2025.  ※ 권/호 재확인 필요
▸ 핵심 기여: droop 계열과 SM 계열(VSG/synchronverter/VOC)로 GFM 제어를 분류하고,
  소신호·과도·사고후 안정도와 FRT를 표로 정리
▸ 검증: 없음 (리뷰, CC BY 4.0 오픈액세스)
▸ 주요 수치:
  - 강/약계통 경계 SCR 3 ([152],[153] 인용)
  - 과전류 공급: SG 5-7 p.u. vs 인버터 최대 2 p.u. ([169] 인용)
  - 영국 GFM 사양 초안: 단락전류 기여 1.5 p.u., 전압 dip 기준 0.85 p.u.,
    무효전력 주입 5 ms 이내 ([171] 인용)
  - 안정도 마진 확보 GFM 용량비 약 17.8% / 21.4% ([162] 인용)
▸ 저자가 밝힌 한계: 실계통 적용 사례 부족, 비의도적 단독운전 연구 희소,
  GFM 최적 위치·대수 미해결

# 🔗 Knowledge Connections
* Related Topics: Section I — Introduction, GFM-Control-Taxonomy, Small-Signal-Stability
* Projects/Contexts: PV-GFM-Thesis
* Claims: [[claim-scr3-weak-grid-threshold]],
  [[claim-current-limit-shrinks-stability-margin]],
  [[claim-virtual-impedance-lf-tradeoff]]

# ✍️ My Take
※ 차별점: 이 리뷰의 소신호 안정도 표는 해석 기법 나열에 그치고 파라미터 최적화 축이
  없음. SCR과 X/R을 동시에 스윕한 사례도 확인되지 않음.
  단, 리뷰 한 편으로 "없다"를 주장하면 안 됨 — [115],[114] 원문 확인 후 서술.
※ 인용 자리: 서론(저관성·GFM 필요성), 관련연구(분류체계), 검증조건(SCR 3 경계)
※ 전략적 배치 이유: (입력 필요)
※ 그대로 못 쓰는 이유: 리뷰라 1차 데이터·모델식 없음.
  개별 결과는 반드시 원논문 인용.
※ 미확인 항목:
  - [115] 선로 임피던스 2D 평면 안정 경계 — 내 SCR-X/R 2D와 직결, 최우선 확보
  - [114] 전차수 상태공간 + 고유치, 초약계통 — 21차 모델 차수 근거
  - [94] Lyapunov 기반 관성·감쇠 계수 선정 — PSO 대비 baseline
  - [90] GFM PV용 matching SM 제어, DC 전압 동특성
```

---

## E. 원본 논문 저장

### Vault 구조

```
GFM_Research/                              ← Obsidian 볼트 루트 (.obsidian 위치)
├── .obsidian/
├── .gitignore                             ← papers/ 반드시 포함
├── 00_Knowledge/
│   ├── papers/                            ← 원본 PDF. 파일명 = cite_key
│   │   ├── kang2026syntheticinertia.pdf
│   │   └── salem2025gfmreview.pdf
│   ├── literature/                        ← 남의 논문 1:1 노트
│   │   ├── kang2026syntheticinertia.md
│   │   └── salem2025gfmreview.md
│   ├── claims/                            ← 주장 1:1 노트
│   │   └── claim-scr3-weak-grid-threshold.md
│   └── mine/                              ← 내 결과. literature와 같은 스키마
│       └── mine2026-pso-run03.md
└── RSCAD/                                 ← 시뮬레이션 작업 폴더
```

**Dataview 경로는 볼트 루트 기준이다.** `.obsidian` 폴더가 있는 곳이 볼트 루트이므로 여기서는 `GFM_Research`가 기준이고, 쿼리 경로는 `00_Knowledge/...`로 시작한다. 쿼리가 빈 표를 뱉으면 `.obsidian` 위치부터 확인할 것.

`00_Knowledge`는 연구 단계 폴더(RSCAD 등)와 같은 층에 둔다. 문헌은 특정 시뮬레이션 도구에 종속되지 않고 PSCAD·Simulink·논문 집필에서 모두 참조하기 때문이다. `.gitignore`는 반드시 **git 레포 루트**에 둘 것 — 하위 폴더에 넣으면 상위 레포에서 적용되지 않는다.

`00_Knowledge`는 연구 단계 폴더(RSCAD 등)와 같은 층에 둔다. 문헌은 특정 시뮬레이션 도구에 종속되지 않고 PSCAD·Simulink·논문 집필에서 모두 참조하기 때문이다. `.gitignore`는 반드시 **git 레포 루트**에 둘 것 — 하위 폴더에 넣으면 상위 레포에서 적용되지 않는다.

PDF와 노트의 파일명을 **cite_key로 통일**하는 게 핵심. 그래야 `pdf: "[[{{cite_key}}.pdf]]"` 가 자동 생성되고, Zotero·BibTeX·본문 인용까지 한 키로 묶인다. `Ref-04-...` 같은 인용 번호 기반 이름은 초고 개정 때 전부 깨진다.

### 페이지 앵커

Obsidian은 PDF의 특정 페이지로 바로 링크된다. 수치를 적을 때 근거 페이지를 같이 박아두면 나중에 원문 대조가 클릭 한 번이다.

```markdown
▸ 주요 수치:
  - 강/약계통 경계 SCR 3 → ![[salem2025gfmreview.pdf#page=17]]
  - 영국 GFM 사양 초안 1.5 p.u. → ![[salem2025gfmreview.pdf#page=19]]
```

`![[...]]` 는 노트 안에 뷰어를 임베드하고, `[[...]]` 는 링크만 건다. 수치 검증용이면 링크로 충분하다. 임베드를 남발하면 노트가 무거워진다.

### 저장 방식 선택

**A. Vault에 직접 저장** — 단순. Obsidian 검색이 PDF 본문까지 훑는다. 용량이 늘고 Obsidian Sync 무료 용량을 금방 먹는다. 논문 100편이면 수백 MB.

**B. Zotero를 원본 저장소로, Vault는 링크만** — Zotero storage에 PDF를 두고 노트에는 `zotero://select/items/@kang2026syntheticinertia` 형식 링크만 건다. Zotero Integration 플러그인을 쓰면 citekey가 자동으로 맞는다. 용량 문제가 없고 BibTeX 내보내기가 그대로 논문 작성에 연결된다. 대신 Obsidian 단독으로는 PDF 본문 검색이 안 된다.

논문 30편 넘어갈 계획이면 B를 권한다. `pdf_status` 필드는 두 방식 모두에서 "아직 원문을 못 구한 논문"을 걸러내는 용도로 유지할 것.

```dataview
LIST FROM "00_Knowledge/literature" WHERE pdf_status != "have"
```

### 주의

- **git으로 vault를 관리한다면 `.gitignore`에 `papers/`를 반드시 넣을 것.** 구독 저널 PDF가 공개 레포에 올라가면 재배포가 된다. 개인 소장은 문제없지만 공개는 다른 문제다. OA(CC BY) 논문은 예외지만 섞여 있으면 구분이 어려우므로 폴더째 제외하는 편이 안전하다.
- 클라우드 동기화(iCloud, Dropbox) 사용 시에도 공유 폴더에 두지 말 것.
- `pdf_status: oa-available` 인 항목은 OpenAlex `best_oa_location`으로 자동 다운로드가 가능하다. `request`는 상호대차 큐.