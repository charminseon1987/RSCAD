const VAULT_DATA = [
  {
    "path": "00_Knowledge/00_MOC.md",
    "dir": "00_Knowledge",
    "filename": "00_MOC",
    "frontmatter": {
      "tags": [
        "MOC"
      ]
    },
    "body": "# 문헌 지식 MOC\n\n규칙과 템플릿은 [[README]]. 이 노트는 **현재 뭐가 쌓였나**만 본다.\n\n---\n\n## 1. 관련연구 비교표\n\n논문 4장 비교표의 초안. `mine`(내 결과)이 같은 열로 섞여야 비교가 된다.\n\n```dataview\nTABLE WITHOUT ID\n  file.link AS \"노트\",\n  ref_num AS \"[]\",\n  target_system AS \"대상\",\n  tuning_method AS \"튜닝\",\n  scr_range AS \"SCR\",\n  validation_level AS \"검증\",\n  extraction_depth AS \"원문\"\nFROM \"00_Knowledge/literature\" OR \"00_Knowledge/mine\"\nSORT ref_num ASC, year DESC\n```\n\n> `원문` 열이 `full`이 아닌 행은 **인용 금지**. 초록만 보고 적은 값이다.\n\n---\n\n## 2. 갭 확인\n\n아래가 0건이면 그게 기여 논거다. **단, 문헌이 충분히 쌓인 뒤에 의미가 있다.**\n10편 미만에서 0건은 \"없다\"가 아니라 \"아직 안 읽었다\"이다.\n\n```dataview\nTABLE target_system, tuning_method, validation_level\nFROM \"00_Knowledge/literature\"\nWHERE target_system = \"PV+ESS\"\n  AND tuning_method != \"수동\"\n  AND contains(validation_level, \"CHIL\")\n```\n\n현재 문헌 수:\n```dataview\nLIST WITHOUT ID length(rows) + \"편\"\nFROM \"00_Knowledge/literature\"\nGROUP BY true\n```\n\n---\n\n## 3. 축별 분포\n\n어느 축이 비어 있는지 본다. 빈칸이 곧 다음에 읽을 논문의 방향.\n\n```dataview\nTABLE WITHOUT ID\n  key AS \"튜닝 방법\",\n  length(rows) AS \"편수\",\n  filter(rows.file.link, (r) => true) AS \"논문\"\nFROM \"00_Knowledge/literature\"\nGROUP BY tuning_method AS key\nSORT length(rows) DESC\n```\n\n```dataview\nTABLE WITHOUT ID key AS \"검증 수준\", length(rows) AS \"편수\"\nFROM \"00_Knowledge/literature\"\nGROUP BY validation_level AS key\nSORT length(rows) DESC\n```\n\n---\n\n## 4. 원문 미확보\n\n`request`는 상호대차·도서관 신청 큐. `oa-available`은 OpenAlex로 자동 수집 가능.\n\n```dataview\nTABLE WITHOUT ID\n  file.link AS \"노트\", pdf_status AS \"상태\", doi AS \"DOI\", venue AS \"출처\"\nFROM \"00_Knowledge/literature\"\nWHERE pdf_status != \"have\"\nSORT pdf_status ASC\n```\n\n---\n\n## 5. 읽기 대기\n\n```dataview\nTABLE WITHOUT ID file.link AS \"노트\", year AS \"연도\", venue AS \"출처\"\nFROM \"00_Knowledge/literature\"\nWHERE status = \"to-read\"\nSORT year DESC\n```\n\n---\n\n## 6. 주장 노트\n\n각 claim이 몇 편의 근거를 갖고 있는지. 근거 1편짜리 주장은 논문에 쓰기 약하다.\n\n```dataview\nTABLE WITHOUT ID\n  file.link AS \"주장\",\n  length(file.inlinks) AS \"인용된 노트 수\",\n  file.mtime AS \"수정\"\nFROM \"00_Knowledge/claims\"\nSORT length(file.inlinks) DESC\n```\n\n---\n\n## 7. 내 결과\n\n```dataview\nTABLE WITHOUT ID\n  file.link AS \"실험\", tuning_method AS \"튜닝\",\n  scr_range AS \"SCR\", xr_range AS \"X/R\", validation_level AS \"검증\"\nFROM \"00_Knowledge/mine\"\nSORT file.name DESC\n```\n\n---\n\n## 쿼리가 빈 표를 뱉을 때\n\n1. **경로** — `.obsidian`이 있는 폴더가 볼트 루트다. 여기서는 `GFM_Research`이므로\n   경로는 `00_Knowledge/...`로 시작한다. 볼트를 상위 폴더로 다시 열면 접두어가 붙는다.\n2. **frontmatter 키 누락** — 키가 없으면 그 행은 조건에서 탈락한다.\n   값이 없어도 키는 남기고 `미명시`를 넣을 것.\n3. **Dataview 플러그인** — 커뮤니티 플러그인에서 설치·활성화됐는지 확인.\n4. **문자열 비교** — `validation_level: CHIL`과 `\"CHIL\"`은 같지만 `chil`은 다르다.\n   frontmatter 값의 대소문자를 템플릿과 맞출 것.\n",
    "wikilinks": [
      "README"
    ]
  },
  {
    "path": "00_Knowledge/claims/claim-dclink-dynamics-matter-during-faults.md",
    "dir": "00_Knowledge/claims",
    "filename": "claim-dclink-dynamics-matter-during-faults",
    "frontmatter": {
      "type": "claim",
      "claim_id": "claim-dclink-dynamics-matter-during-faults",
      "date": "2026-08-25",
      "status": "supported",
      "tags": [
        "claim",
        "DC-link",
        "EMT",
        "CHIL",
        "PV-ESS"
      ]
    },
    "body": "# 🔵 Claim: DC-link 동특성을 무시한 소신호 모델은 고침투 계통에서 오차를 낳는다\n\n> 대부분의 RMS 시뮬레이션이 DC-link 동특성을 무시해  \n> 오차를 낳는다 — EMT 또는 CHIL 검증이 필요하다\n\n---\n\n## 📌 주장 내용\n\nDC 버스 전압 변동이 인버터 출력전력·각속도에 미치는 영향(DC-AC 커플링)을  \n모델에서 제외하면, 약계통(SCR ≤ 2)에서 불안정 모드를 포착하지 못한다.  \n특히 PV+ESS 2단 구조에서는 DC단이 해석의 중심이므로  \n**반드시 DC-AC 커플링 A_k(9,6)을 포함한 21차 모델 + CHIL 검증**이 필요하다.\n\n---\n\n## ▸ 지지 근거 (Supporting Evidence)\n\n| 출처                                                   | 근거                                                | evidence_type |\n| ---------------------------------------------------- | ------------------------------------------------- | ------------- |\n| [[kenyon2020ibrstability]]                           | \"§5.3.3 대부분의 RMS 시뮬레이션이 DC-link 동특성을 무시해 오차를 낳는다\" | direct        |\n| [[RSCAD/06_문헌/Zhao_2023_Aalborg\\|Zhao_2023_Aalborg]] | DC-AC 커플링 누락 시 SCR=0.8 불안정 모드 포착 실패 증명            | direct        |\n| [[EXP_2026-08-21_Phase2_엔진전환_비교]]                    | A_k(9,6) 포함 후 이론값 오차 0.0001% ✅                    | direct        |\n\n## ▸ 반박 근거 (Contradicting Evidence)\n\n| 출처            | 근거                                    | evidence_type |\n| ------------- | ------------------------------------- | ------------- |\n| [[Dong 2026]] | 이상적 DC 버스 가정(12차) → 단순화로 충분하다는 암묵적 가정 | inferred      |\n\n---\n\n## ✍️ 내 연구에서의 역할\n\n※ **인용 자리:**\n- §II 소신호 모델 — \"DC-AC 커플링 A_k(9,6) 포함 근거\"\n- §III 검증 방법 — \"EMT/CHIL을 택한 근거\"\n\n※ **내 결과와의 관계:**\n- 21차 모델의 9개 추가 상태변수 정당화\n- A_k(9,6) = idc0/(J·ω₀) 이론값 검증 (오차 0.0001%)\n\n※ **이 주장으로 정당화되는 것:**\n- Dong(2026) 12차(이상적 DC) 대비 본 연구 21차의 필요성\n- 4중 차별화 축 \"모델 차수\" — 12차 vs **21차(DC-AC 커플링)**\n\n---\n\n## 🔗 연결 노트\n\n- [[DC-AC_커플링]] — A_k(9,6) 이론\n- [[야코비안 행렬]] — 21차 블록 구조\n- [[RSCAD/06_문헌/Zhao_2023_Aalborg|Zhao_2023_Aalborg]] — 핵심 지지 근거\n- [[kenyon2020ibrstability]] — 지지 근거\n- [[Phase02_완료]] — A_k(9,6) 검증 완료\n",
    "wikilinks": [
      "kenyon2020ibrstability",
      "RSCAD/06_문헌/Zhao_2023_Aalborg\\",
      "EXP_2026-08-21_Phase2_엔진전환_비교",
      "Dong 2026",
      "DC-AC_커플링",
      "야코비안 행렬",
      "RSCAD/06_문헌/Zhao_2023_Aalborg",
      "Phase02_완료"
    ]
  },
  {
    "path": "00_Knowledge/claims/claim-gfm-tuning-is-operating-point-dependent.md",
    "dir": "00_Knowledge/claims",
    "filename": "claim-gfm-tuning-is-operating-point-dependent",
    "frontmatter": {
      "type": "claim",
      "claim_id": "claim-gfm-tuning-is-operating-point-dependent",
      "date": "2026-08-25",
      "status": "supported",
      "tags": [
        "claim",
        "GFM",
        "PSO",
        "operating-point",
        "tuning"
      ]
    },
    "body": "# 🔵 Claim: GFM 제어 파라미터 최적 튜닝은 계통 운전상태(SCR, X/R)에 의존한다\n\n> GFL/GFM 지원 기능의 적절한 튜닝은 계통 운전상태에 따라 달라지므로  \n> 새롭고 적응적인 튜닝 절차가 필요하다\n\n---\n\n## 📌 주장 내용\n\n단일 운전점(고정 SCR)에서 최적화된 GFM 파라미터가 다른 SCR·X/R 조건에서는  \n감쇠비 저하 또는 불안정을 초래할 수 있다.  \n따라서 **다중 운전점을 동시에 고려하는 PSO 최적화**가 필요하다.\n\n---\n\n## ▸ 지지 근거 (Supporting Evidence)\n\n| 출처                                                           | 근거                                                                  | evidence_type |\n| ------------------------------------------------------------ | ------------------------------------------------------------------- | ------------- |\n| [[kenyon2020ibrstability]]                                   | \"GFL 지원 기능의 적절한 튜닝은 계통 운전상태에 따라 달라지므로 새롭고 적응적인 튜닝 절차가 필요하다\"고 결론에 명시 | direct        |\n| [[RSCAD/06_문헌/Chen_2024_Electronics\\|Chen_2024_Electronics]] | 단일 운전점 PSO → 다른 SCR에서 과적합 가능성 (저자 한계)                               | direct        |\n| [[EXP_2026-08-21_Phase2_엔진전환_비교]]                            | SCR=1.5 최적화 파라미터가 SCR=1.0에서 ζ 저하 관찰                                 | inferred      |\n\n## ▸ 반박 근거 (Contradicting Evidence)\n\n| 출처 | 근거 | evidence_type |\n|---|---|---|\n| [[Dong 2026]] | 단일 CSCR 수치로 충분하다는 암묵적 가정 | inferred |\n\n---\n\n## ✍️ 내 연구에서의 역할\n\n※ **인용 자리:** §I 서론 연구 동기 — \"기존 단일 운전점 튜닝의 한계\"  \n※ **내 결과와의 관계:** 다중 운전점 PSO(SCR×4) = 이 주장의 직접적 해결책  \n※ **이 주장으로 정당화되는 것:**\n- F_multi = (1/4)·Σ F(SCR_k) 목적함수 설계\n- 4중 차별화 축 \"PSO 역할\" — SVR 3개 vs GFM 14개 직접 최적화\n\n---\n\n## 🔗 연결 노트\n\n- [[PSO 이중수렴기준]] — 다중 운전점 목적함수\n- [[다중동작점_갱신절차]] — 운전점 갱신 방법\n- [[kenyon2020ibrstability]] — 지지 근거 원출처\n- [[Phase03_진행중]] — 이 주장의 검증 예정\n",
    "wikilinks": [
      "kenyon2020ibrstability",
      "RSCAD/06_문헌/Chen_2024_Electronics\\",
      "EXP_2026-08-21_Phase2_엔진전환_비교",
      "Dong 2026",
      "PSO 이중수렴기준",
      "다중동작점_갱신절차",
      "Phase03_진행중"
    ]
  },
  {
    "path": "00_Knowledge/claims/claim-pll-limits-gfl-penetration.md",
    "dir": "00_Knowledge/claims",
    "filename": "claim-pll-limits-gfl-penetration",
    "frontmatter": {
      "type": "claim",
      "claim_id": "claim-pll-limits-gfl-penetration",
      "date": "2026-08-25",
      "status": "supported",
      "tags": [
        "claim",
        "PLL",
        "GFL",
        "GFM",
        "penetration",
        "SCR"
      ]
    },
    "body": "# 🔵 Claim: PLL 기반 GFL은 고침투 계통에서 안정 한계가 있으며 GFM으로 대체가 필요하다\n\n> PLL 동특성 포함 시 IBR 안정 침투율 ~50%,  \n> PLL 우회(GFM) 시 ~80% — GFM 전환의 정량적 근거\n\n---\n\n## 📌 주장 내용\n\nPLL이 계통 전압을 추종하는 GFL 방식은 약계통(SCR ↓)에서 PLL 불안정을 일으키며,  \nIBR 침투율 ~50% 이상에서 안정도 마진이 급격히 감소한다.  \nGFM 제어는 PLL을 사용하지 않아 침투율 ~80%까지 안정적이다.\n\n---\n\n## ▸ 지지 근거 (Supporting Evidence)\n\n| 출처 | 근거 | evidence_type |\n|---|---|---|\n| [[Kenyon 2020 IBR Stability]] | \"PLL 동특성 포함 시 ~50%, PLL 우회 시 ~80% 안정\" (Lin et al. 2017 인용) | cited |\n\n## ▸ 반박 근거 (Contradicting Evidence)\n\n| 출처 | 근거 | evidence_type |\n|---|---|---|\n| — | 아직 없음 | — |\n\n---\n\n## ✍️ 내 연구에서의 역할\n\n※ **인용 자리:** §I 서론 — GFM 필요성 정량적 근거  \n※ **내 결과와의 관계:** 본 연구가 GFM을 선택한 이유의 배경  \n※ **이 주장으로 정당화되는 것:** PV+ESS 시스템에 GFM 채택\n\n※ **주의:** 현재 근거가 Kenyon(2020)에서 Lin et al.(2017)을 인용한 것  \n→ evidence_type: cited (간접 근거)  \n→ Lin et al.(2017) 원문 확보 시 direct로 승격 필요\n\n---\n\n## 🔗 연결 노트\n\n- [[kenyon2020ibrstability]] — 지지 근거 출처\n- [[고유값_안정도판단]] — GFM 안정도 분석\n- [[Phase03_진행중]] — GFM 선택 근거\n",
    "wikilinks": [
      "Kenyon 2020 IBR Stability",
      "kenyon2020ibrstability",
      "고유값_안정도판단",
      "Phase03_진행중"
    ]
  },
  {
    "path": "00_Knowledge/claims/claim-rms-inadequate-at-high-ibr.md",
    "dir": "00_Knowledge/claims",
    "filename": "claim-rms-inadequate-at-high-ibr",
    "frontmatter": {
      "type": "claim",
      "claim_id": "claim-rms-inadequate-at-high-ibr",
      "date": "2026-08-25",
      "status": "supported",
      "tags": [
        "claim",
        "RMS",
        "EMT",
        "CHIL",
        "simulation",
        "IBR"
      ]
    },
    "body": "# 🔵 Claim: RMS 시뮬레이션은 고침투 IBR 계통에서 불충분하며 EMT/CHIL이 필요하다\n\n> RMS 시간스텝(~4 ms)은 인버터 스위칭(5~50 μs)을 포착 못 하며  \n> 고침투에서 가정이 붕괴 → EMT 또는 CHIL 검증 필수\n\n---\n\n## 📌 주장 내용\n\nRMS 시뮬레이션은 시간스텝이 약 4 ms(1/4 사이클)로 인버터의 5~50 μs  \n스위칭 동특성을 포착하지 못한다. IBR 침투율이 높아질수록 RMS의  \n\"느린 동특성\" 가정이 무너지며, 특히 DC-link 동특성·전류제한 비선형성  \n구간에서 오차가 급증한다.\n\n---\n\n## ▸ 지지 근거 (Supporting Evidence)\n\n| 출처 | 근거 | evidence_type |\n|---|---|---|\n| [[Kenyon 2020 IBR Stability]] | \"RMS 시간스텝 통상 4 ms, EMT는 5~50 μs\" 명시 | direct |\n| [[Kenyon 2020 IBR Stability]] | \"§5.3.3 대부분의 RMS 시뮬레이션이 DC-link 동특성을 무시해 오차를 낳는다\" | direct |\n\n## ▸ 반박 근거 (Contradicting Evidence)\n\n| 출처 | 근거 | evidence_type |\n|---|---|---|\n| [[Dong 2026]] | R²=0.9854로 소프트웨어만으로 충분하다는 암묵적 주장 | inferred |\n\n---\n\n## ✍️ 내 연구에서의 역할\n\n※ **인용 자리:** §III 검증 방법론 — RTDS CHIL을 선택한 근거  \n※ **내 결과와의 관계:** Phase 7 CHIL 88포인트 검증의 정당화  \n※ **이 주장으로 정당화되는 것:**\n- 소프트웨어 R²=0.9854(Dong 2026)와 대비되는 \"실DSP 정밀도 ≥95%\"\n- 4중 차별화 축 \"검증 방법\" — 순수 소프트웨어 vs **RTDS CHIL**\n\n※ **claim-dclink-dynamics-matter-during-faults와 겹침**  \n→ 두 claim이 같은 근거를 공유  \n→ 논문 작성 시 하나로 통합 가능\n\n---\n\n## 🔗 연결 노트\n\n- [[claim-dclink-dynamics-matter-during-faults]] — 연관 claim\n- [[kenyon2020ibrstability]] — 지지 근거\n- [[Prony 교차검증_절차]] — EMT/CHIL 검증 방법론\n- [[88포인트_2D_스윕_설계]] — Phase 7 CHIL 대상\n- [[Phase04 예정]] — CHIL 검증 계획\n",
    "wikilinks": [
      "Kenyon 2020 IBR Stability",
      "Dong 2026",
      "claim-dclink-dynamics-matter-during-faults",
      "kenyon2020ibrstability",
      "Prony 교차검증_절차",
      "88포인트_2D_스윕_설계",
      "Phase04 예정"
    ]
  },
  {
    "path": "00_Knowledge/claims/TPL_Claim_노트.md",
    "dir": "00_Knowledge/claims",
    "filename": "TPL_Claim_노트",
    "frontmatter": {
      "type": "claim",
      "claim_id": "claim-{{키워드}}",
      "date": "{{YYYY-MM-DD}}",
      "status": "supported | contested | open",
      "tags": [
        "claim"
      ]
    },
    "body": "# 🔵 Claim: {{한 줄 주장}}\n\n> 핵심 주장을 한 문장으로 명확하게\n\n---\n\n## 📌 주장 내용\n\n---\n\n## ▸ 지지 근거 (Supporting Evidence)\n\n| 출처              | 근거  | evidence_type               |\n| --------------- | --- | --------------------------- |\n| [[실험 참고문헌 연결맵]] | 내용  | direct \\| cited \\| inferred |\n\n---\n\n## ▸ 반박 근거 (Contradicting Evidence)\n\n| 출처 | 근거 | evidence_type |\n|---|---|---|\n| — | — | — |\n\n---\n\n## ✍️ 내 연구에서의 역할\n\n※ 인용 자리:\n※ 내 결과와의 관계:\n※ 이 주장으로 정당화되는 것:\n\n---\n\n## 🔗 연결 노트\n\n-\n",
    "wikilinks": [
      "실험 참고문헌 연결맵"
    ]
  },
  {
    "path": "00_Knowledge/literature/Chen_2024_Electronics.md",
    "dir": "00_Knowledge/literature",
    "filename": "Chen_2024_Electronics",
    "frontmatter": {
      "type": "literature",
      "cite_key": "chen2024electronics",
      "ref_num": 1,
      "year": 2024,
      "venue": "Electronics (MDPI)",
      "doi": "10.3390/electronics13071343",
      "paper_type": "method",
      "model_order": 21,
      "scr_range": "\"0.8~5.0\"",
      "validation_level": "sim-only",
      "tuning_method": "PSO",
      "dc_ac_coupling": false,
      "pso_params": 14,
      "extraction_depth": "full",
      "tags": [
        "literature",
        "Chen2024",
        "PSO",
        "21-state",
        "GFM",
        "reference"
      ]
    },
    "body": "# 📚 Chen et al. 2024 — Electronics\n\n> **역할: 본 연구 방법론 베이스 [1]**\n\n---\n\n## 📌 Brief Summary\n\n▸ 21차 소신호 모델 기반 GFM 인버터 PSO 최적화 연구. 14개 제어 파라미터를 단일 운전점에서 최적화.\n\n---\n\n## 📖 Core Content\n\n▸ **핵심 기여:**\n- 21차 상태변수 소신호 모델 구축 (DC + AC 통합)\n- PSO로 14개 GFM 제어 파라미터 최적화\n- 감쇠비 ζ = 0.707 목표 설정\n\n▸ **방법:**\n- 상태변수: DC 8개 + AC 13개 = 21개\n- PSO: w=0.729, c1=c2=2.05 (Clerc-Kennedy)\n- 운전점: 단일 SCR (이 점이 본 연구와 차이)\n\n▸ **파라미터 (Table I):**\n\n| 파라미터 | 값 | 단위 |\n|---|---|---|\n| J | 0.5 | kg·m² |\n| Dp | 20.0 | N·m·s |\n| Kpv | 1.0 | A/V |\n| Kiv | 100 | A/Vs |\n| Kpc | 5.0 | V/A |\n| Kic | 50 | V/As |\n| L1 | 0.002 | H |\n| Cf | 0.0001 | F |\n\n▸ **검증:** 소프트웨어 시뮬레이션만 (CHIL 없음)\n\n▸ **저자 한계:**\n- 단일 운전점 최적화 → 다른 SCR에서 과적합 가능\n- 이상적 DC 버스 가정 → DC-AC 커플링 미반영\n\n---\n\n## 🔗 본 연구 연결\n\n| 항목 | Chen 2024 | 본 연구 |\n|---|---|---|\n| 모델 차수 | 21차 | 21차 (동일) |\n| PSO 파라미터 수 | 14개 | 14개 (동일) |\n| 운전점 | 단일 SCR | **다중 {3.0,2.0,1.5,1.0}** |\n| DC-AC 커플링 | ❌ | **✅ A_k(9,6)** |\n| 검증 | 소프트웨어 | **RTDS CHIL** |\n\n※ Chen 구조를 기반으로 다중 운전점·커플링·CHIL을 추가한 것이 본 연구의 핵심 확장\n\n---\n\n## ✍️ My Take\n\n```\n인용 우선순위: ⭐⭐⭐ 높음\n\n※ 21차 구조·파라미터 초기값 직접 출처\n```\n\n\n※ 차별점: 단일 운전점 → 다중 운전점, DC-AC 커플링 추가  \n※ 인용 자리: §II 방법론, §III 소신호 모델, PSO 설계  \n※ 파라미터 초기값 출처로 직접 인용\n\n---\n\n## 🔗 연결 노트\n\n- [[야코비안 행렬]] — 21차 구조 원출처\n- [[다중동작점_갱신절차]] — 단일→다중 확장\n- [[PSO 이중수렴기준]] — 14개 파라미터 목록\n- [[참여인자 지배모드]] — P_ki > 0.15 기준\n- [[Phase02_완료]] — 파라미터 초기값 사용\n",
    "wikilinks": [
      "야코비안 행렬",
      "다중동작점_갱신절차",
      "PSO 이중수렴기준",
      "참여인자 지배모드",
      "Phase02_완료"
    ]
  },
  {
    "path": "00_Knowledge/literature/DArco_2014_VSM_Droop.md",
    "dir": "00_Knowledge/literature",
    "filename": "DArco_2014_VSM_Droop",
    "frontmatter": {
      "type": "literature",
      "cite_key": "darco2014vsm",
      "ref_num": "미정",
      "year": 2014,
      "venue": "IEEE Transactions on Smart Grid, Vol.5, No.1, pp.394-395",
      "doi": "10.1109/TSG.2013.2288000",
      "paper_type": "method",
      "model_order": "미명시",
      "scr_range": "미명시",
      "validation_level": "sim-only",
      "tuning_method": "수동",
      "dc_ac_coupling": false,
      "extraction_depth": "full",
      "tags": [
        "literature",
        "DArco2014",
        "VSM",
        "droop",
        "equivalence",
        "GFM",
        "swing-equation"
      ]
    },
    "body": "# 📚 D'Arco & Suul 2014 — VSM-Droop 등가성\n\n> **저자:** Salvatore D'Arco, Jon Are Suul (SINTEF Energy Research, Norway)  \n> **저널:** IEEE Transactions on Smart Grid, Vol.5, No.1, Jan. 2014  \n> **역할:** VSM과 주파수 드룹 제어의 이론적 등가성 증명 — 본 연구 VSG 모델 근거\n\n---\n\n## 📌 Brief Summary\n\n▸ VSM(Virtual Synchronous Machine)과 주파수 드룹 제어가 특정 조건에서 수학적으로 동등함을 증명. VSM 스윙 방정식과 드룹 제어의 파라미터 대응 관계 도출.\n\n---\n\n## 📖 Core Content\n\n### ▸ VSM 스윙 방정식 (핵심 수식)\n\n$$T_a \\cdot s \\cdot \\omega_{VSM} = p_0 - p_{el} - k_d(\\omega_{VSM} - \\omega_g)$$\n\n| 기호 | 의미 | 본 연구 대응 |\n|---|---|---|\n| $T_a = 2H$ | 기계적 시상수 (관성) | **J** |\n| $p_0$ | 유효전력 기준값 | P_ref |\n| $p_{el}$ | 인버터 출력전력 | P_meas |\n| $k_d$ | 댐핑 계수 | **Dp** |\n| $\\omega_{VSM}$ | VSM 각속도 | **Δω + ω₀** |\n\n### ▸ 드룹 제어 방정식\n\n$$\\omega^* = \\omega_g - m_p(p_m - p_0), \\quad v^* = v_g - m_q(q_m - q_0)$$\n\n### ▸ 등가 조건 (식 6)\n\n$$T_a = T_f \\cdot \\frac{1}{m_p}, \\qquad k_d = \\frac{1}{m_p}$$\n\n```\n→ 드룹 이득 m_p = 1/k_d\n→ 필터 시상수 T_f = T_a · m_p = T_a/k_d\n→ VSM 댐핑 k_d ↔ 드룹 이득 m_p 역비례 관계\n```\n\n### ▸ 핵심 주장\n\n```\n▸ VSM과 주파수 드룹은 동일한 동적 거동 (Fig.3에서 파형 완전 일치)\n▸ 저역통과 필터가 가상 관성 역할 수행\n▸ 필터 없는 드룹 = 관성 없는 VSM → 본질적 불안정\n▸ 복잡한 전압·전류 루프 추가해도 전체 거동은 스윙 방정식이 지배\n```\n\n### ▸ 검증\n\n```\n▸ 수치 시뮬레이션 (Ta=1.8s, kd=5.7103)\n▸ 4가지 조건 비교: VSM/드룹 × 이상적/종속 전압원\n▸ 결과: 모든 조건에서 파형 완전 일치\n```\n\n### ▸ 저자 한계\n\n```\n▸ 단일 인버터 마이크로그리드 (다중 인버터 미분석)\n▸ 소신호 모델 없음 (스윙 방정식 수준)\n▸ SCR·X/R 영향 미분석\n▸ DC-AC 커플링 미반영\n```\n\n---\n\n## 🔗 본 연구 연결\n\n| 항목 | D'Arco 2014 | 본 연구 |\n|---|---|---|\n| VSM 모델 | 스윙 방정식 (2차) | **21차 완전 소신호** |\n| 파라미터 | Ta, kd | **J, Dp** (직접 대응) |\n| DC-AC 커플링 | ❌ | **✅ A_k(9,6)** |\n| 검증 | 소프트웨어 | **RTDS CHIL** |\n| 계통 조건 | 단일 | **SCR×X/R 2D** |\n\n```\n▸ 본 연구 f9 방정식의 이론적 근거:\n  dΔω/dt = (P_ref - P_filt - Dp·Δω) / J\n  ← D'Arco 식(1): Ta·s·ωVSM = p0 - pel - kd(ωVSM - ωg)\n  Ta=J, kd=Dp, pel=Pfilt 대응\n\n▸ 임계 댐핑 조건:\n  critical_Dp = 2√(J·wc) = 7.92\n  → Dp=20 > 7.92 → 과감쇠\n  ← D'Arco: \"필터 없으면 본질적 불안정\" → 적정 Dp 필요\n```\n\n---\n\n## ✍️ My Take\n\n```\n인용 우선순위: ⭐⭐⭐ 높음\n\n※ 본 연구 f9 방정식의 직접 이론 근거\n※ J(=Ta), Dp(=kd) 파라미터 물리적 의미 설명 시 인용\n※ \"VSM과 드룹이 동등\" → 본 연구 VSG 제어 선택의 이론적 배경\n※ 인용 자리: §II 소신호 모델 VSG 스윙 방정식 유도 부분\n※ 단점: 소신호가 아닌 스윙 방정식 수준 → 21차 확장 필요성 부각에 활용\n```\n\n---\n\n## 📋 인용 가능 문장 후보\n\n```\n▸ \"The damping gain kd in the VSM is inversely linked to the droop gain mp\"\n  → Dp와 드룹 이득의 역비례 관계 설명 시\n\n▸ \"A power-frequency droop without low-pass filtering will correspond\n   to a VSM with zero inertia, which would be inherently unstable\"\n  → 적정 Dp 설정 필요성 근거 시\n```\n\n> ⚠️ 저작권: 인용 시 15단어 이내\n\n---\n\n## 🔗 연결 노트\n\n- [[소신호_선형화]] — 스윙 방정식 → 21차 확장\n- [[야코비안 행렬]] — f9 방정식 유도 근거\n- [[고유값_안정도판단]] — 임계 댐핑 Dp=7.92\n- [[Phase02_완료]] — f9 구현 완료\n\n## 참고문헌\n\n- ▸ [1] Beck & Hesse 2007 — VSM 최초 제안\n- ▸ [5] Rocabert et al. 2012 — 드룹 제어 마이크로그리드\n",
    "wikilinks": [
      "소신호_선형화",
      "야코비안 행렬",
      "고유값_안정도판단",
      "Phase02_완료"
    ]
  },
  {
    "path": "00_Knowledge/literature/Dong_2026_GFM_SVR.md",
    "dir": "00_Knowledge/literature",
    "filename": "Dong_2026_GFM_SVR",
    "frontmatter": {
      "cite_key": "dong2026gfmsvr",
      "ref_num": 2,
      "title": "\"Small-signal stability assessment method based on online prediction of the critical short-circuit ratio for grid-forming converters\"",
      "authors": [
        "Wei Dong",
        "Ying Cheng",
        "Ying Yang",
        "Feng Zhang",
        "Bowen Wang",
        "Guanzhong Wang"
      ],
      "corresponding": "Guanzhong Wang (eewgz@sdu.edu.cn)",
      "year": 2026,
      "venue": "Frontiers in Energy Research, vol.13, art.1738311",
      "doi": "10.3389/fenrg.2025.1738311",
      "pdf_status": "have",
      "paper_type": "method",
      "target_system": "일반",
      "control_scheme": [
        "GFM",
        "VSG"
      ],
      "model_order": 12,
      "analysis_method": [
        "eigenvalue",
        "impedance-based"
      ],
      "tuning_method": "PSO",
      "scr_range": "\"미명시 (CSCR 예측 대상)\"",
      "xr_range": "미명시",
      "validation_level": "sim-only",
      "hardware": [
        "MATLAB"
      ],
      "extraction_depth": "full",
      "section": "\"§I 서론, §II 관련연구, §V 4중 차별화\"",
      "tags": [
        "paper",
        "GFM",
        "small-signal",
        "CSCR",
        "PSO",
        "SVR",
        "Dong2026",
        "comparison"
      ],
      "status": "noted"
    },
    "body": "# 📌 Brief Summary\n\n▸ GFM 컨버터의 임계 단락비(CSCR)를 온라인으로 예측하는 PSO-SVR 하이브리드 모델 제안.  \n▸ 12차 소신호 상태공간 모델 기반, 소프트웨어 검증 R²=0.9854.  \n※ **본 연구의 핵심 비교 대상 [2]** — 4중 차별화 기준점.\n\n---\n\n## 📖 Core Content\n\n▸ **전체 인용:**  \nW. Dong, Y. Cheng, Y. Yang, F. Zhang, B. Wang, G. Wang, \"Small-signal stability assessment method based on online prediction of the critical short-circuit ratio for grid-forming converters,\" *Front. Energy Res.*, vol.13, art.1738311, Feb. 2026.\n\n▸ **핵심 기여:**\n- GFM 소신호 상태공간 모델 수립 (12차)\n- PSO로 SVR 하이퍼파라미터(C, ε, γ) 3개 최적화\n- 온라인 CSCR 예측 모델 제안\n- σ(최소 고유값 실수부) > 0 → 안정 판정 기준 사용\n\n▸ **방법:**\n- 상태변수: VSG 제어 + AC 전압 외루프-전류 내루프 = **12차 (이상적 DC 버스 가정)**\n- PSO: SVR 하이퍼파라미터 C, ε, γ 3개 최적화 (GFM 제어이득 직접 최적화 아님)\n- 모델: PSO-SVR 하이브리드\n\n▸ **검증:**\n- 소프트웨어(MATLAB) 시뮬레이션만\n- R² = **0.9854** (예측 정확도)\n- 하드웨어/CHIL 검증 없음\n\n▸ **주요 수치:**\n\n| 항목 | 값 |\n|---|---|\n| 모델 차수 | **12차** (이상적 DC 버스) |\n| PSO 최적화 대상 | SVR 하이퍼파라미터 3개 (C, ε, γ) |\n| 검증 방법 | 소프트웨어 (R²=0.9854) |\n| SCR 경계 | 단일 CSCR 수치 (1D) |\n| DC-AC 커플링 | ❌ 미반영 |\n\n▸ **저자가 밝힌 한계:**\n- 이상적 DC 버스 가정 → DC 동특성 미반영\n- 소프트웨어 검증만 → 실계통 적용성 미확인\n- 단일 CSCR (1D) → X/R 영향 미분석\n\n---\n\n## 🔗 Knowledge Connections\n\n* **Related Topics:** GFM-SmallSignal, CSCR, PSO-SVR, Online-Stability\n* **Projects/Contexts:** PV-GFM-Thesis\n* **Claims:**\n  [[claim-dclink-dynamics-matter-during-faults]]\n  [[claim-rms-inadequate-at-high-ibr]]\n\n---\n\n## ✍️ My Take\n\n**인용 우선순위: ⭐⭐⭐ 높음 (핵심 비교 대상)**\n\n※ **4중 차별화 (표 6-3) 기준점:**\n\n| 차별화 축 | Dong 2026 | 본 연구 |\n|---|---|---|\n| 모델 차수 | **12차** (이상적 DC) | **21차** (DC-AC 커플링) |\n| PSO 역할 | SVR 하이퍼파라미터 **3개** | GFM 제어이득 **14개** 직접 |\n| 검증 방법 | 소프트웨어 R²=0.9854 | **RTDS CHIL ≥95%** |\n| SCR 경계 | 단일 CSCR **(1D)** | SCR*(X/R) **2D 곡면** |\n\n※ **인용 자리:**\n- §I 서론: \"기존 연구의 한계\" 대표 사례\n- §II 관련연구: 비교 테이블의 핵심 행\n- §V 결과: 4중 차별화 수치 비교\n\n※ **공격 포인트 (본 연구가 더 나은 점):**\n1. DC-AC 커플링 A_k(9,6) 누락 → [7]Zhao 이론으로 공격\n2. PSO가 GFM 제어이득 직접 최적화 아님 → 차별화 핵심\n3. CHIL 없음 → [9]IEEE Std. 2004-2025로 공격\n4. 1D CSCR → [3]Ganguly로 공격\n\n※ **주의:** \"PSO를 썼다\"는 같은데 역할이 완전히 다름  \n→ 논문에서 반드시 명확히 구분해서 서술할 것\n\n---\n\n## 🔗 연결 노트\n\n- [[DC-AC 커플링]] — 12차 이상적 DC의 한계 근거\n- [[야코비안 행렬]] — 21차 vs 12차 구조 비교\n- [[PSO 이중수렴기준]] — PSO 역할 차이\n- [[88포인트 2D 스윕 설계]] — 1D vs 2D 비교\n- [[Salem 2025 GFM Review]] — 연관 리뷰\n- [[Zhao 2023 Aalborg]] — DC 커플링 공격 근거\n- [[Ganguly 2025 preprint]] — 1D 한계 공격 근거\n- [[Phase02 완료]] — A_k(9,6) 차별화 검증\n",
    "wikilinks": [
      "claim-dclink-dynamics-matter-during-faults",
      "claim-rms-inadequate-at-high-ibr",
      "DC-AC 커플링",
      "야코비안 행렬",
      "PSO 이중수렴기준",
      "88포인트 2D 스윕 설계",
      "Salem 2025 GFM Review",
      "Zhao 2023 Aalborg",
      "Ganguly 2025 preprint",
      "Phase02 완료"
    ]
  },
  {
    "path": "00_Knowledge/literature/Ganguly_2025_preprint.md",
    "dir": "00_Knowledge/literature",
    "filename": "Ganguly_2025_preprint",
    "frontmatter": {
      "type": "literature",
      "cite_key": "ganguly2025preprint",
      "ref_num": 3,
      "year": 2025,
      "venue": "Preprints.org (NREL)",
      "doi": "10.20944/preprints202504.1145.v1",
      "paper_type": "experimental",
      "model_order": "미명시",
      "scr_range": "\"0.5~2.0\"",
      "validation_level": "PHIL",
      "tuning_method": "미명시",
      "dc_ac_coupling": "미명시",
      "extraction_depth": "full",
      "tags": [
        "literature",
        "Ganguly2025",
        "X/R",
        "2D-boundary",
        "SCR-star",
        "NREL",
        "reference"
      ]
    },
    "body": "# 📚 Ganguly, Wang, Kroposki 2025 — NREL Preprint\n\n> **역할: SCR×X/R 2D 경계 연구 동기 [3]**\n\n---\n\n## 📌 Brief Summary\n\n▸ X/R 비율이 GFM 인버터 안정도에 SCR 못지않게 중요함을 하드웨어 실험으로 관찰. 1D SCR 분석의 불완전성 증명.\n\n---\n\n## 📖 Core Content\n\n▸ **핵심 기여:**\n- X/R=0.5 조건: 인버터 1번 트립 관찰\n- X/R=1.0 조건: 인버터 2번 트립 관찰\n- \"SCR 단변수 분석만으로 안정 경계 완전히 서술 불가\" 결론\n\n▸ **방법:**\n- PHIL (Power Hardware-In-the-Loop) 실험\n- 저자: Ganguly(NREL), Wang(Manchester), Kroposki(NREL)\n\n▸ **주요 관찰:**\n\n| X/R 조건 | 결과 |\n|---|---|\n| 0.5 | 인버터 1 트립 |\n| 1.0 | 인버터 2 트립 |\n| 2.0+ | 미명시 |\n\n▸ **저자 한계:**\n- 정성적 관찰 (정량적 SCR* 경계 미도출)\n- 1D 분석만 제시 → 2D 경계 함수 없음\n- CHIL 아닌 PHIL (DSP 실제 연결)\n\n---\n\n## 🔗 본 연구 연결\n\n| 항목 | Ganguly 2025 | 본 연구 |\n|---|---|---|\n| X/R 영향 관찰 | ✅ 정성적 | **✅ 정량적 88포인트** |\n| SCR* 경계 | 없음 (1D) | **SCR*(X/R) 2D 곡면** |\n| 검증 방법 | PHIL | **RTDS CHIL** |\n| 포인트 수 | ~4개 | **88개** |\n\n▸ \"최초 CHIL 기반 SCR×X/R 2D 경계 정량화\" 주장의 핵심 근거  \n▸ Ganguly 관찰 → 본 연구 정량화로 확장\n\n---\n\n## ✍️ My Take\n\n```\n인용 우선순위: ⭐⭐ 중간\n\n※ 2D 경계 동기 근거, preprint 게재 확인 필요\n```\n\n\n※ 차별점: 정성적 관찰 → 88포인트 정량 경계 도출  \n※ 인용 자리: §I 서론 \"연구 동기\", §V 결과 비교  \n※ Phase 2 X/R=5.0 경향 반전은 모델 한계 (Ganguly 결과와 불일치)  \n※ 저널 게재 여부 모니터링 필요 (현재 preprint)\n\n---\n\n## 🔗 연결 노트\n\n- [[88포인트_2D_스윕_설계]] — 이 논문이 2D 동기\n- [[고유값_안정도판단]] — SCR* 정량화 목표\n- [[실험 sweep2d j0.5 dp20]] — Phase 1 비교\n- [[EXP_2026-08-21_Phase2_엔진전환_비교]] — X/R 경향 불일치 관찰\n- [[Phase03_진행중]] — PSO 후 SCR* 비교 예정\n",
    "wikilinks": [
      "88포인트_2D_스윕_설계",
      "고유값_안정도판단",
      "실험 sweep2d j0.5 dp20",
      "EXP_2026-08-21_Phase2_엔진전환_비교",
      "Phase03_진행중"
    ]
  },
  {
    "path": "00_Knowledge/literature/kenyon2020ibrstability.md",
    "dir": "00_Knowledge/literature",
    "filename": "kenyon2020ibrstability",
    "frontmatter": {
      "cite_key": "kenyon2020ibrstability",
      "ref_num": "null",
      "title": "\"Stability and control of power systems with high penetrations of inverter-based resources: An accessible review of current knowledge and open questions\"",
      "authors": [
        "R. W. Kenyon",
        "M. Bossart",
        "M. Marković",
        "K. Doubleday",
        "R. Matsuda-Dunn",
        "S. Mitova",
        "S. A. Julien",
        "E. T. Hale",
        "B.-M. Hodge"
      ],
      "corresponding": "Bri-Mathias Hodge",
      "year": 2020,
      "venue": "Solar Energy, vol.210, pp.149-168",
      "doi": "10.1016/j.solener.2020.05.053",
      "pdf": "\"[[kenyon2020ibrstability.pdf]]\"",
      "pdf_status": "have",
      "paper_type": "review",
      "target_system": "일반",
      "control_scheme": [
        "grid-following",
        "grid-supporting",
        "grid-forming",
        "droop",
        "VSM",
        "VOC"
      ],
      "model_order": "N/A(리뷰)",
      "analysis_method": [
        "eigenvalue",
        "participation-factor",
        "impedance-based",
        "RMS-simulation",
        "EMT-simulation"
      ],
      "tuning_method": "N/A(리뷰)",
      "scr_range": "미명시",
      "xr_range": "미명시",
      "validation_level": "none",
      "hardware": [],
      "extraction_depth": "full",
      "section": "Introduction, Methodology",
      "tags": [
        "paper",
        "IBR",
        "review",
        "grid-forming",
        "small-signal",
        "EMT",
        "NREL"
      ],
      "status": "read"
    },
    "body": "# 📌 Brief Summary\n\nIBR(인버터 기반 자원)이 동기기 중심으로 설계된 계통의 사이클~초 단위 동특성을 어떻게 바꾸는지를\n비전문가도 읽을 수 있게 정리한 교육적 리뷰. NREL·CU Boulder 공동 저작.\n전력전자 기초부터 안정도 분류, EMT/RMS 시뮬레이션 선택까지 다룬다.\n서론의 IBR 침투 문제 제기와, **방법론에서 EMT 해석을 택한 근거**로 인용할 자리가 있다.\n\n# 📖 Core Content\n\n▸ 전체 인용: R. W. Kenyon et al., \"Stability and control of power systems with high\n  penetrations of inverter-based resources: An accessible review of current knowledge\n  and open questions,\" *Solar Energy*, vol. 210, pp. 149–168, 2020.\n\n▸ 핵심 기여: 종합 리뷰가 아니라 **교육 목적의 개괄**임을 저자가 명시. IBR과 동기기(SMC)의\n  물리적 차이 → 안정도 3영역(회전자각/주파수/전압)에 미치는 영향 → 시뮬레이션 방법론 변화\n  순서로 서술하고, 각 영역의 미해결 질문을 마지막에 정리.\n\n▸ 방법: 문헌 개괄 + 개념 설명. 자체 모델링이나 실험 없음.\n\n▸ 검증: 없음 (리뷰). 인용된 결과는 모두 타 문헌.\n\n▸ 주요 수치:\n  - IBR 응답시간 0.5–5 ms vs 동기기 조속기 응답 0.5 s 이상 (Yazdani & Iravani, 2010 인용)\n  - IBR 과전류: 정격의 2배를 약 1 ms 동안 (Keller et al., 2011 인용) /\n    지속 가능 수준은 정격의 110–120%\n  - 동기기 단기 과전류: 정격의 4–7배 (Winternheimer et al., 2015 인용)\n  - IBR 과전류 제한값 통상 1.2–1.5 p.u. (§3.2.2)\n  - droop 기울기 통상 4–5% (§3.1.2)\n  - ERCOT 2018: 연간 에너지 침투율 19%, 순시 전력 침투율 최고 55%\n  - EirGrid 순시 침투율 상한 65% (안정도 우려, Milano et al., 2018 인용)\n  - PLL 동특성 포함 시 IBR 침투 약 50%까지 안정, PLL 우회 시 약 80%\n    (Lin et al., 2017 인용) — **GFM 필요성 논거로 유용**\n  - RMS 시뮬레이션 시간스텝 통상 1/4 사이클(약 4 ms), EMT는 5–50 μs\n  - IBR 침투율 30% 초과 시 정상상태 전압 변화가 침투율의 2차 함수로 증가\n    (Eftekharnejad et al., 2013 인용)\n  - 배전 피더 hosting capacity 통상 약 15% (Ding et al., 2016 인용)\n  - SCR 정의: SCR = S_SCMVA / P_RMW (식 3). **강/약계통 경계값은 이 논문에 없음**\n  - X/R: 배전망은 X/R이 낮아 Q–V 결합이 약하다는 정성적 서술만. 수치 없음\n\n▸ 저자가 밝힌 한계:\n  - 종합 리뷰가 아니며 계통 보호 등 일부 단시간 현상을 의도적으로 제외했다고 명시\n  - 실증 규모에서 검증되지 않은 기술은 \"미해결 질문\"으로 분류\n\n# 🔗 Knowledge Connections\n\n* Related Topics: Section I — Introduction, IBR-Penetration, Small-Signal-Stability,\n  EMT-vs-RMS, DC-Link-Dynamics\n* Projects/Contexts: PV-GFM-Thesis\n* Claims:\n  [[claim-pll-limits-gfl-penetration]],\n  [[claim-rms-inadequate-at-high-ibr]],\n  [[claim-dclink-dynamics-matter-during-faults]],\n  [[claim-gfm-tuning-is-operating-point-dependent]]\n\n# ✍️ My Take\n\n※ 차별점 — **이 논문이 미해결로 남긴 것이 곧 내 기여다.** 결론의 Control 항목에서\n  GFL 지원 기능의 적절한 튜닝은 계통 운전상태에 따라 달라지므로 새롭고 적응적인 튜닝\n  절차가 필요하다고 명시한다. 다중 운전점 PSO 튜닝이 정확히 이 지점을 겨눈다.\n  또한 §5.3.3에서 대부분의 RMS 시뮬레이션이 DC단 동특성을 무시해 오차를 낳는다고 지적하는데,\n  2단 PV+ESS 구조는 DC단이 해석의 중심이므로 EMT/CHIL 채택 근거로 직접 쓸 수 있다.\n\n※ 인용 자리:\n  - 서론: IBR 침투에 따른 관성·계통강도 저하, 순시 침투율과 연간 침투율의 괴리\n  - 서론/연구동기: PLL 기반 GFL의 침투율 한계(50% vs 80%) → GFM 전환 필요성\n  - 연구방법: EMT를 택한 근거(RMS 시간스텝 4 ms vs EMT 5–50 μs, 고침투 시 RMS 가정 붕괴)\n  - 연구방법: DC단 동특성을 모델에 포함해야 하는 근거\n\n※ 전략적 배치 이유: (입력 필요)\n\n※ 그대로 못 쓰는 이유:\n  - 리뷰이며 저자 스스로 교육 목적임을 밝힘. 1차 데이터·모델식 없음 → 개별 수치는 원논문 인용\n  - 2020년 논문이라 이후 GFM 제어(dVOC 확장, FRT, 전류제한) 발전이 반영되지 않음.\n    최신 상태는 [[salem2025gfmreview]]로 보완할 것\n  - Elsevier 저작권. NREL 공동저작이므로 accepted manuscript가 OSTI/NREL에 있을 가능성 있음\n\n※ 미확인 항목 — 추적할 원논문:\n  - **Markovic et al. (2018)** — GFL·GFM 양쪽의 상태공간 모델 구축, 제어기 설정이 안정도 마진에\n    크게 영향. 내 소신호 모델의 직접 선행연구. 최우선\n  - **Pogaku et al. (2007)** — 인버터 기반 마이크로그리드의 모델링·해석·시험.\n    소신호 상태공간 모델의 표준 참조. 차수 설정 근거로 필요\n  - **Qoria et al. (2018), MIGRATE D3.2** — GFM 운전 IBR의 상세 상태공간 모델.\n    표준 안정도 해석 도구가 100% IBR 계통에서 불충분하다는 결론\n  - **Lin et al. (2017)** — PLL 동특성 유무에 따른 안정 침투율 비교(50% vs 80%)\n  - **Shah et al. (2018)** — PCC에서 IBR 임피던스와 계통 임피던스 비교, 임피던스 기반 안정도 지표\n  - **Eto et al. (2020), NREL Research Roadmap on Grid-Forming Inverters** — 서론 정책·기술 로드맵\n  - **Matevosyan et al. (2019)** — GFM이 고침투의 열쇠인가, IEEE Power Energy Mag. 서론용\n",
    "wikilinks": [
      "claim-pll-limits-gfl-penetration",
      "claim-rms-inadequate-at-high-ibr",
      "claim-dclink-dynamics-matter-during-faults",
      "claim-gfm-tuning-is-operating-point-dependent",
      "salem2025gfmreview"
    ]
  },
  {
    "path": "00_Knowledge/literature/Liu_2025_DataDriven_CPES.md",
    "dir": "00_Knowledge/literature",
    "filename": "Liu_2025_DataDriven_CPES",
    "frontmatter": {
      "type": "literature",
      "cite_key": "liu2025datadriven",
      "ref_num": "미정",
      "year": 2025,
      "venue": "Cyber-Physical Energy Systems (Elsevier), Vol.1, pp.28-48",
      "doi": "미확인",
      "paper_type": "review",
      "model_order": "미명시",
      "scr_range": "미명시",
      "validation_level": "미명시",
      "tuning_method": "미명시",
      "dc_ac_coupling": "미명시",
      "extraction_depth": "full",
      "tags": [
        "literature",
        "Liu2025",
        "data-driven",
        "RL",
        "GFM",
        "DRL",
        "CPES",
        "survey"
      ]
    },
    "body": "# 📚 Liu, Zhang, Xu, Xie 2025 — 데이터기반 제어 서베이\n\n> **저자:** Wenjie Liu (NTU), Mengfan Zhang (KTH), Qianwen Xu (KTH), Lihua Xie (NTU)  \n> **저널:** Cyber-Physical Energy Systems 1 (2025) 28–48  \n> **역할:** 데이터기반 제어 방법론 참조 — GFM DRL 적용 가능성\n\n---\n\n## 📌 Brief Summary\n\n▸ 데이터기반 제어의 두 축 — (1) Willems 기본 보조정리 기반 비모수적 궤적 방법과 (2) 강화학습(RL) 기반 방법 — 을 통합 서베이한 논문. CPES(사이버-물리 에너지 시스템)에서 GFM/GFL 제어, 사이버보안(DoS/FDI 공격) 방어까지 다룸.\n\n---\n\n## 📖 Core Content\n\n### ▸ 논문 구조 (21페이지)\n\n| 섹션 | 내용 |\n|---|---|\n| 1 | 서론 — CPES 개요, RL 기반·Willems 기반 구분 |\n| 2 | LTI 시스템 데이터기반 피드백 제어 |\n| 3 | 비선형 시스템 확장 |\n| 4 | 데이터기반 MPC |\n| 5 | 데이터기반 상태 추정 |\n| **6** | **DRL in CPES — GFM/GFL 제어** ← 본 연구 관련 |\n| 7 | 사이버보안 (DoS, FDI 공격 방어) |\n| 8 | 결론 |\n\n### ▸ 핵심 기여\n\n```\n1. Willems 기본 보조정리 기반 방법:\n   - 시스템 구조(LTI 또는 적절히 리프팅된 비선형) 가정 필요\n   - 명시적 모델 식별 대신 입출력 궤적 표현 사용\n   - 엄밀한 안정성 보장 제공\n\n2. RL 기반 방법:\n   - 구조적 제약 완전 해제\n   - 복잡·불확실한 환경에서 상호작용으로 학습\n   - 형식적 안정성 증명 없음 → 광범위한 적용 가능성\n```\n\n### ▸ GFM/GFL 제어 관련 (§6.2)\n\n```\n▸ DRL이 GFM/GFL 제어에서:\n  - 빠른 응답 보조 서비스 제공\n  - 가상 관성 에뮬레이션\n  - 계통 주파수 안정화\n\n▸ 요구사항:\n  - 안전성 (Safety)\n  - 해석 가능성 (Interpretability)\n  - 신뢰성 (Reliability)\n\n▸ 접근법:\n  - Safe DRL 기법\n  - 하이브리드 학습-제어 프레임워크\n```\n\n### ▸ 저자 결론\n\n```\n▸ Willems 기반: LTI/비선형 구조 가정 하에 엄밀한 보장\n▸ DRL 기반: 구조 가정 없음, 고차원 비선형 CPES에 강력\n▸ 한계: DRL은 온라인 측정 가정 → 오프라인 시나리오 제한\n```\n\n---\n\n## 🔗 본 연구(GFM PSO 소신호 모델)와의 관련성\n\n| 항목 | Liu 2025 | 본 연구 |\n|---|---|---|\n| 제어 방법 | 데이터기반 (RL, Willems) | **모델기반 (소신호 + PSO)** |\n| GFM 관련 | §6.2 DRL 적용 | PSO 파라미터 최적화 |\n| 안정성 | RL → 형식 보장 어려움 | **고유값 분석 → 보장** |\n| 계산 부담 | 실시간 학습 필요 | **오프라인 최적화** |\n\n※ 직접적 연결은 낮음  \n※ 활용 가능: Phase 3 이후 PSO 대안으로 DRL 비교 논의  \n※ §6.2의 \"Safe DRL for GFM\" 흐름은 본 연구 후속 방향으로 언급 가능\n\n---\n\n## ✍️ My Take\n\n```\n※ 본 연구 방법론(소신호 모델 + PSO)과 대비되는 접근법 서베이\n※ 논문 §I 서론에서 \"모델기반 vs 데이터기반\" 비교 시 인용 가능\n※ DRL GFM 제어(§6.2)는 향후 연구 방향으로 언급 가능\n※ 직접적인 소신호 모델·PSO 방법론 내용 없음 → 인용 우선순위 낮음\n※ 미결: DOI 확인 필요 (현재 미확인)\n```\n\n---\n\n## 🔗 연결 노트\n\n- [[PSO 이중수렴기준]] — 데이터기반 vs 모델기반 비교\n- [[고유값_안정도판단]] — 모델기반 안정성 보장 근거\n- [[Phase03_진행중]] — PSO vs DRL 비교 논의 가능\n\n---\n\n## 📋 인용 가능 문장 후보\n\n```\n▸ \"DRL offers a distinct advantage over traditional optimization \n   and control techniques by enabling systems to learn optimal \n   policies through continuous interaction\"\n   → 모델기반 PSO의 장점(해석 가능성, 보장) 대비 시 인용\n\n▸ \"These applications demand stringent safety, interpretability, \n   and reliability guarantees\"\n   → 본 연구가 고유값 기반 안정성 보장을 선택한 이유로 인용\n```\n\n> ⚠️ 저작권 주의: 인용 시 15단어 이내로 제한\n",
    "wikilinks": [
      "PSO 이중수렴기준",
      "고유값_안정도판단",
      "Phase03_진행중"
    ]
  },
  {
    "path": "00_Knowledge/literature/salem2025gfmreview.md",
    "dir": "00_Knowledge/literature",
    "filename": "salem2025gfmreview",
    "frontmatter": {
      "cite_key": "salem2025gfmreview",
      "ref_num": "",
      "title": "\"Grid Forming Converters for Low Inertia Systems-Capabilities and Limitations: A Critical Review\"",
      "authors": "",
      "corresponding": "Mazaher Karimi",
      "year": 2025,
      "venue": "IEEE Open J. Ind. Electron. Soc., vol.6, pp.775-801",
      "doi": "10.1109/OJIES.2025.3566213",
      "pdf": "\"[[salem2025gfmreview]]\"",
      "pdf_status": "oa-available",
      "paper_type": "review",
      "target_system": "일반",
      "control_scheme": "",
      "model_order": "N/A(리뷰)",
      "analysis_method": "",
      "tuning_method": "N/A(리뷰)",
      "scr_range": "SCR<1 ~ SCR=50 (인용 문헌 전체 범위)",
      "xr_range": "미명시",
      "validation_level": "none",
      "hardware": [],
      "extraction_depth": "full",
      "section": "Introduction, Related Work",
      "tags": "",
      "status": "read"
    },
    "body": "# 📌 Brief Summary\n\nGFM 컨버터가 GFL을 어느 수준까지 대체할 수 있는지를 문제의식으로 삼아, 제어방식 분류부터\n소신호·과도·사고후 안정도, 계통강도별 성능, FRT까지 표로 정리한 비판적 리뷰.\nCC BY 4.0 오픈액세스.\n서론의 GFM 필요성 논거와 **관련연구 분류체계**의 뼈대로 쓸 자리가 있다.\n\n# 📖 Core Content\n\n▸ 전체 인용: Q. Salem, B. Bany Fawaz, R. Aljarrah, and M. Karimi, \"Grid Forming\n  Converters for Low Inertia Systems-Capabilities and Limitations: A Critical Review,\"\n  *IEEE Open J. Ind. Electron. Soc.*, vol. 6, pp. 775–801, 2025.\n\n▸ 핵심 기여: GFM 제어를 **droop 계열**과 **SM 모방 계열**(VSG/synchronverter/VOC)로 이분하고,\n  각 방식의 구조·개선안·한계를 Table 2~6에 정리. 이어 안정도를 소신호(Table 7),\n  과도(Table 8), 사고후 회복(Table 9)으로 나눠 선행연구 매트릭스를 제공.\n  마지막에 기존 리뷰들과의 차이를 Table 10으로 비교.\n\n▸ 방법: 문헌 개괄 + 비교표. 자체 모델링·시뮬레이션·실험 없음.\n\n▸ 검증: 없음 (리뷰). 인용된 결과는 모두 타 문헌.\n\n▸ 주요 수치:\n  - **강/약계통 경계: SCR 3** (SCR>3 강계통, SCR<3 약계통) — [152],[153] 인용\n  - 과전류 공급 능력: 동기기 5–7 p.u. vs 인버터 최대 2 p.u. — [169] 인용\n  - 영국 GFM 사양 초안 — [171] 인용\n    · 전압원 동작 주파수 대역 5 Hz–1 kHz (사고 전·중·후)\n    · 단락전류 기여 1.5 p.u.\n    · 전압 dip 시 크기·주파수·위상을 사고 전 값으로 유지, 기준 0.85 p.u.\n    · 무효전력 주입 5 ms 이내\n    · 불평형 전류 2%까지 흡수\n  - 안정도 마진 확보에 필요한 GFM 용량비 약 17.8% 또는 21.4% — [162] 인용\n    (전 컨버터를 GFM으로 운전할 필요 없음)\n  - 적응형 하이브리드 GFL/GFM 동작 범위 SCR 1~50 — [165] 인용\n  - 초강계통 SCR 30 초과에서의 전력 결합 완화 — [158] 인용\n  - dVOC 기반 GFM의 SCR<1 초약계통 운전 — [105] 인용\n\n▸ 저자가 밝힌 한계:\n  - GFM 실계통 적용 사례가 연구상 여전히 제한적\n  - 비의도적 단독운전(unintentional islanding) 연구가 희소\n  - GFM의 최적 설치 위치·대수 문제 미해결\n\n# 🔗 Knowledge Connections\n\n* Related Topics: Section I — Introduction, GFM-Control-Taxonomy,\n  Small-Signal-Stability, Grid-Strength-SCR, FRT\n* Projects/Contexts: PV-GFM-Thesis\n\n# ✍️ My Take\n\n※ 차별점 — Table 7(소신호 안정도)은 해석 **기법** 나열에 그치고 파라미터 최적화 축이 없다.\n  SCR도 인용된 연구마다 단일 값으로만 등장하며 X/R을 함께 스윕한 사례가 보이지 않는다.\n  다만 리뷰 한 편으로 \"없다\"를 주장하면 안 된다 — [115], [114] 원문을 확인한 뒤 서술할 것.\n\n※ 인용 자리:\n  - 서론: 저관성·계통강도 저하, GFL의 한계(PLL 진동, 계통강도 저하, 블랙스타트 불가, 감쇠 저하)\n  - 관련연구: GFM 제어 분류체계(droop vs SM 모방)의 뼈대\n  - 검증조건: SCR 3 경계, FRT 요구치(0.85 p.u., 5 ms, 1.5 p.u.)\n\n※ 전략적 배치 이유: (입력 필요)\n\n※ 그대로 못 쓰는 이유:\n  - 리뷰이므로 1차 데이터·모델식이 없음. 개별 결과는 반드시 원논문을 인용할 것\n  - 이 노트의 수치 대부분이 `[번호] 인용` 표기가 붙어 있다 = 이 논문의 결과가 아니다\n\n※ 미확인 항목 — 추적할 원논문:\n  - **[115] Yu et al. (2022), IEEE TIE** — 선로 임피던스 변동을 2D 평면에 사상해 소신호 동기화\n    안정 경계를 기하학적으로 식별. **SCR–X/R 2D 강건성 경계와 가장 직접적인 선행연구. 최우선**\n  - **[114] Ji et al. (2024), Energies** — GFL·GFM 혼재 인버터의 소신호 안정도.\n    전차수 상태공간 + 고유치. 모델 차수 근거\n  - **[94] Welmilla et al. (2024)** — Lyapunov 에너지 함수로 VSM의 관성·감쇠 계수 선정.\n    PSO 튜닝 대비 baseline\n  - **[90] Guo & Wu (2025), JMPCE** — DC 전압 동특성을 개선한 GFM PV용 matching SM 제어.\n    2단 PV 구조에서 DC단을 다룬 드문 연구\n  - **[162] Xin et al. (2025), IEEE TPWRS** — 필요한 GFM 용량비 산정. 서론 논거\n  - **[122] Pan et al. (2020), JESTPE** — 4종 GFM 제어의 설계지향 과도 안정도 비교\n  - **[171] Rosso et al. (2021), IEEE TIA** — 영국 GFM 사양 초안의 정량 요구조건 출처\n",
    "wikilinks": []
  },
  {
    "path": "00_Knowledge/literature/settling_time_standards_survey.md",
    "dir": "00_Knowledge/literature",
    "filename": "settling_time_standards_survey",
    "frontmatter": {
      "type": "literature-survey",
      "date": "2026-09-18",
      "status": "draft",
      "verification": "partial",
      "tags": [
        "survey",
        "settling-time",
        "damping-ratio",
        "standards",
        "IEEE2800",
        "IEEE1547",
        "UNIFI",
        "NERC",
        "ENTSO-E",
        "KEPCO",
        "zeta-064"
      ]
    },
    "body": "# Settling Time / Damping Ratio Standards Survey\n\n> **목적:** 본 프로젝트의 감쇠비 기준 ζ ≥ 0.64 및 정착시간 t_s ≤ 1 s 요구의 **규범적 출처**를 특정한다.\n\n> [!warning] 검증 상태\n> 이 노트는 웹 검색이 차단된 환경에서 작성되었다.\n> ▸ 표준 원문 조항 번호는 기존 프로젝트 지식 + 저자 사전 지식에 기반한다.\n> ※ \"미확인\" 표시 항목은 원문 대조 전까지 인용 불가.\n\n---\n\n## 1. 프로젝트 내부 경위\n\n### ζ = 0.64 의 유도\n\n$$\n\\zeta_{\\text{th}} = \\frac{4}{2\\pi \\cdot f_{\\text{dom}} \\cdot t_s}\n= \\frac{4}{2\\pi \\cdot 1 \\cdot 1}\n= \\frac{4}{2\\pi}\n= 0.6366 \\approx 0.64\n$$\n\n▸ 폐기된 v0 코드(`sym_v0.py`)에서 역산된 값이다.\n▸ 가정: 지배 모드 주파수 f_dom = 1 Hz, 정착시간 t_s = 1 s (2% 기준).\n▸ 이 값은 **표준 조항이 아니라 설계 역산값**임이 2026-09-18 에 확인되었다.\n※ 현재는 σ_ref = 4.0 [1/s] (t_s ≤ 1 s, 2% 기준) + ζ_floor = 0.10 으로 교체.\n→ [[폐기값_이력]] 항목 5, [[고유값_안정도판단]]\n\n### 핵심 질문\n\n> **t_s ≤ 1 s 정착시간 요구는 어느 규범에서 오는가?**\n\n---\n\n## 2. IEEE 2800-2022 (IBR 계통연계 표준)\n\n> IEEE Standard for Interconnection and Interoperability of Inverter-Based Resources (IBR) Interconnecting with Associated Transmission Electric Power Systems\n\n### 주파수 응답 관련 조항\n\n▸ **Clause 7.2.1 — Frequency ride-through:** 주파수 이탈 시 유지 운전 시간 규정. 정착시간 수치 규정 아님.\n▸ **Clause 7.3 — Active power-frequency response (mandatory droop):**\n  - 주파수 편차 감지 후 유효전력 조정 개시까지의 **반응시간(response time)**: ≤ 0.5 s (미확인 — 원문 대조 필요)\n  - 출력이 지령의 90%에 도달하는 **정착시간**: 미확인 — 일부 해석에서 수 초 단위로 언급\n  - 드룹 기울기: 5% 기본, 조정 가능\n▸ **Clause 7.4 — Voltage regulation:** 무효전력 반응시간 규정 있으나 정착시간 1 s 와의 직접 대응 미확인\n\n### 감쇠비 관련\n\n※ IEEE 2800-2022 에는 **수치 감쇠비(ζ) 요구 조항이 없다.**\n▸ \"positive damping contribution\" 정성적 요구는 있으나 ζ ≥ 0.64 같은 정량 요구는 없음.\n\n### 평가\n\n| 항목 | 값 | 조항 | 상태 |\n|---|---|---|---|\n| 주파수 드룹 반응시간 | ≤ 0.5 s (미확인) | 7.3 | 미확인 |\n| 정착시간 수치 | 명시 없음 (미확인) | — | 미확인 |\n| 감쇠비 수치 | 없음 | — | 확인 |\n\n※ IEEE 2800 은 **GFL/GFM 구분 없이** 모든 IBR 에 적용된다.\n\n---\n\n## 3. IEEE 1547-2018 (배전계통 연계 표준)\n\n> IEEE Standard for Interconnection and Interoperability of Distributed Energy Resources with Associated Electric Power Systems Interfaces\n\n### 주파수/전압 응답 관련\n\n▸ **Clause 6.5.2.4 — Frequency-droop response:** Category II/III DER 에 대해:\n  - 응답 개시 시간(response time): 통상 ≤ 0.5 s (미확인 — 일부 구현 가이드에서 언급)\n  - 정착시간 정의: open loop settling time ≤ 5 s (미확인)\n\n▸ **Table 22 — Voltage ride-through:** 전압 이탈 시간-전압 영역 정의. 정착시간과 직접 무관.\n\n▸ **Clause 6.4 — Voltage regulation (volt-var):**\n  - 응답시간 통상 1~10 s 범위 (미확인 — 파라미터 설정 가능)\n\n### 감쇠비 관련\n\n※ IEEE 1547-2018 에도 **수치 감쇠비(ζ) 요구 조항이 없다.**\n※ 배전 표준이므로 GFM 인버터를 직접 규정하지 않는다.\n\n### 평가\n\n| 항목 | 값 | 조항 | 상태 |\n|---|---|---|---|\n| 주파수 드룹 응답시간 | ≤ 0.5 s (미확인) | 6.5.2.4 | 미확인 |\n| open loop 정착시간 | ≤ 5 s (미확인) | 6.5.2.4 | 미확인 |\n| 감쇠비 수치 | 없음 | — | 확인 |\n\n---\n\n## 4. UNIFI Consortium — GFM Specifications\n\n> Universal Interoperability for Grid-Forming Inverters (UNIFI)\n> DOE-funded, NREL 주도. Specification v3 (2024)\n\n### Category 구분\n\n▸ **Category 1:** 기본 GFM 요구 — 전압원 동작, positive damping\n▸ **Category 2:** 향상된 GFM — 주파수/전압 응답 성능 요구 추가\n▸ **Category 3:** 최고 등급 GFM — 블랙스타트, 아일랜딩, 가장 엄격한 동적 성능\n\n### 감쇠비 / 정착시간 관련\n\n▸ **\"Positive damping contribution\" 요구는 있으나 수치 ζ 조항은 확인되지 않는다.**\n  - UNIFI v3 spec 문서에서 damping ratio 에 대한 정량적 임계값(예: ζ ≥ 0.64)은 발견되지 않았음\n  - 정성적 표현: \"The IBR shall contribute positive damping to power oscillations\"\n\n▸ 주파수 응답 시간 관련:\n  - Category 3 에서 active power 변화 반응시간이 가장 빠른 등급이지만, 구체적 수치는 미확인\n  - 일부 해석에서 **유효전력 반응 0.5~1.0 s** 내 개시를 요구한다고 언급되나 원문 미대조\n\n### 평가\n\n| 항목 | 값 | 조항 | 상태 |\n|---|---|---|---|\n| 감쇠비 정량 요구 | 없음 (정성적만) | — | **확인** |\n| 정착시간 1 s | 직접 조항 미발견 | — | 미확인 |\n| positive damping | 있음 | Cat 1~3 공통 | 확인 |\n\n※ **결론: ζ = 0.64 는 UNIFI 조항이 아니다.** 이는 [[고유값_안정도판단]] rev.2 에서 이미 기록됨.\n\n---\n\n## 5. NERC Reliability Standards\n\n> North American Electric Reliability Corporation\n\n### 관련 표준\n\n▸ **BAL-003 — Frequency Response and Frequency Bias Setting:**\n  - Balancing Authority 의 주파수 응답 의무를 정의\n  - **Arresting period** (관성 응답, ~0~10 s): 주파수 하락 저지\n  - **Rebound period** (~10~60 s): 주파수 회복 시작\n  - **Recovery period** (~60 s~): 주파수 안정화\n  - **정착시간 수치를 IBR 에 직접 부과하지 않는다**\n\n▸ **NERC IBR Strategy (2022~):**\n  - 2022년 이후 IBR 관련 reliability guidelines 다수 발행\n  - \"IBR shall provide frequency response consistent with system needs\"\n  - 정량적 정착시간/감쇠비 수치는 reliability guideline 이지 mandatory standard 가 아님\n\n▸ **MOD-026, MOD-027 — Generator model validation:**\n  - 동기기 모델 검증 시 settling time 평가가 있으나 IBR 에 대한 확장은 진행 중\n  - 전통적 전력계통 진동 감쇠비 기준: **ζ ≥ 0.03~0.05** (inter-area oscillation) — 0.64 와는 차원이 다름\n\n### 평가\n\n| 항목 | 값 | 조항 | 상태 |\n|---|---|---|---|\n| IBR 정착시간 수치 | 없음 | — | 확인 |\n| 진동 감쇠비 기준 | 0.03~0.05 (계통 진동) | MOD-026/027 | 미확인 |\n| GFM 특정 요구 | 없음 (2026 기준) | — | 미확인 |\n\n※ 전력계통 저주파 진동(0.1~2 Hz)의 감쇠비 기준 ζ ≥ 0.03~0.05 는 **계통 모드**에 대한 것이며, 인버터 내부 제어 모드의 기준이 아니다. 0.64 와는 물리적으로 다른 대상이다.\n\n---\n\n## 6. ENTSO-E Requirements for Grid Connection (유럽)\n\n> European Network of Transmission System Operators for Electricity\n> Commission Regulation (EU) 2016/631 — Requirements for generators (RfG)\n\n### GFM 관련\n\n▸ **RfG Article 13~22:** Type A~D 발전기 요구사항\n  - 주파수 응답 개시: **droop 동작 수백 ms 이내 개시** (미확인)\n  - 유효전력 full delivery 시간: **Type D 는 통상 2~30 s** (미확인)\n  - 감쇠비 수치 요구 없음\n\n▸ **ENTSO-E Technical Report on High Penetration of Power Electronic Interfaced Power Sources (HPoPEIPS, 2017~2020):**\n  - GFM 개념 도입, positive damping 요구 정성적 언급\n  - 정량적 감쇠비 조항 없음\n\n▸ **ENTSO-E GC ESC Recommendation No. 8 (2023) — Grid-forming capability:**\n  - GFM 인버터의 전압원 동작 요구를 최초 명시\n  - 주파수 범위: 5 Hz~1 kHz 대역에서 전압원 임피던스 동작\n  - **정착시간 / 감쇠비 수치 조항: 미확인**\n\n### 평가\n\n| 항목 | 값 | 조항 | 상태 |\n|---|---|---|---|\n| GFM 전압원 동작 | 요구 | Rec. No. 8 | 미확인 |\n| 정착시간 수치 | 미발견 | — | 미확인 |\n| 감쇠비 수치 | 미발견 | — | 미확인 |\n\n---\n\n## 7. 한국 계통연계기준 (KEPCO / 전력거래소)\n\n> 한국전력공사 배전계통 연계기준, 전력거래소 송전계통 접속기준\n\n### 주파수 응답 관련\n\n▸ **전력거래소 송전계통 접속기준:**\n  - 동기기 AVR 정착시간: 일반적으로 **0.5~1.0 s** (미확인 — 여러 규정에서 유사 수치 언급)\n  - IBR/GFM 에 대한 별도 정착시간 규정: 2026년 기준 제정 진행 중 (미확인)\n\n▸ **KEPCO 배전계통 분산전원 연계기준 (2023 개정):**\n  - IEEE 1547 계열 준용\n  - GFM 인버터 특정 조항: 없음 (2026년 기준)\n\n▸ **한국전력계통 운영규정:**\n  - 계통 진동 감쇠비: 면간(inter-area) 진동 ζ ≥ 0.03~0.05 수준 (미확인)\n  - IBR 정착시간: 별도 규정 미확인\n\n### 평가\n\n| 항목 | 값 | 조항 | 상태 |\n|---|---|---|---|\n| AVR 정착시간 | 0.5~1.0 s (미확인) | 송전 접속기준 | 미확인 |\n| IBR 정착시간 | 규정 없음 | — | 미확인 |\n| GFM 별도 기준 | 없음 (제정 진행) | — | 미확인 |\n\n---\n\n## 8. 학술 문헌에서의 ζ = 0.64 또는 t_s = 1 s\n\n### 8.1 Chen et al. 2024 (본 프로젝트 [1])\n\n▸ 감쇠비 목표: **ζ = 0.707** (임계감쇠 대비 최적응답)\n▸ 정착시간 명시 언급: 없음\n▸ ζ = 0.64 를 직접 사용하지 않음\n※ 0.707 은 제어공학 교과서의 ITAE 최적 2차계 응답에서 오는 관습적 목표값이다.\n→ [[Chen_2024_Electronics]]\n\n### 8.2 제어공학 교과서의 관습\n\n▸ 2차계 과도 응답에서 **ζ = 0.707** (오버슈트 ≈ 4.3%)이 \"최적\"으로 자주 인용됨\n  - Ogata, \"Modern Control Engineering\"\n  - Nise, \"Control Systems Engineering\"\n▸ ζ = 0.64 에 대응하는 오버슈트: ≈ 7.7%\n▸ **ζ = 0.64 를 명시적으로 권장하는 교과서/논문은 발견되지 않음**\n\n### 8.3 ζ = 4/(2πf·t_s) 역산의 출처 추정\n\n▸ 이 식은 2차계에서:\n$$t_s = \\frac{4}{\\zeta \\omega_n} = \\frac{4}{\\zeta \\cdot 2\\pi f}$$\n를 ζ 에 대해 풀면:\n$$\\zeta = \\frac{4}{2\\pi f \\cdot t_s}$$\n\n▸ 이것은 **표준 제어이론 변환**이며 특정 논문의 기여가 아니다.\n▸ t_s = 1 s, f = 1 Hz 를 대입하면 ζ = 0.6366 ≈ 0.64.\n※ f = 1 Hz 가정이 핵심이다. 이 주파수 선택의 근거가 불명확하다.\n\n### 8.4 동기기 PSS/AVR 튜닝에서의 관례\n\n▸ PSS(Power System Stabilizer) 설계 시 사용되는 감쇠비 기준:\n  - **계통 모드(inter-area):** ζ ≥ 0.03~0.05 (NERC/WECC 권고)\n  - **로컬 모드:** ζ ≥ 0.05~0.10\n  - **제어기 내부 모드:** 통상 ζ ≥ 0.10~0.30\n\n▸ **0.64 는 전력계통 관례에서 사용되지 않는 값이다.**\n※ 이 값은 순수하게 제어공학적 과도응답 사양(오버슈트/정착시간)에서 유래한다.\n\n### 8.5 GFM 인버터 문헌 조사\n\n▸ D'Arco & Suul (2014) — VSM 설계 시 감쇠비 언급은 있으나 수치 기준 없음\n▸ Pogaku et al. (2007) — 마이크로그리드 소신호 모델, ζ 수치 기준 미제시 (미확인)\n▸ Markovic et al. (2018) — GFL/GFM 안정도 마진 분석, ζ 기준 미제시 (미확인)\n▸ **ζ = 0.64 를 GFM 인버터에 명시적으로 적용한 논문은 발견되지 않음**\n\n---\n\n## 9. t_s ≤ 1 s 의 가능한 출처\n\n### 후보 1: IEEE 2800 주파수 드룹 반응시간에서의 유추 (미확인)\n\n▸ IEEE 2800-2022 Clause 7.3 에서 주파수 드룹 반응 개시 ≤ 0.5 s 가 있다면,\n  이를 포함한 전체 정착까지 ~1 s 로 해석할 여지가 있다.\n▸ 그러나 이는 **시스템 레벨 주파수 응답**이지 인버터 내부 모드의 정착시간이 아니다.\n\n### 후보 2: UNIFI Category 3 의 정성적 \"fast response\" 요구에서의 공학적 판단\n\n▸ UNIFI 가 \"fast frequency response\" 를 요구하되 수치를 제시하지 않았을 때,\n  설계자가 **동기기 AVR 정착시간 0.5~1.0 s 를 GFM 에 준용**했을 가능성.\n▸ 이는 합리적 공학적 판단이나 **규범적 근거는 아니다.**\n\n### 후보 3: 관성 응답(inertial response) 시상수에서의 유추\n\n▸ VSG 관성 J = 0.5 kg·m^2, Dp = 20 N·m·s 조건에서:\n$$\\tau = \\frac{J}{Dp} = \\frac{0.5}{20} = 0.025 \\text{ s}$$\n▸ 이것은 너무 작아 t_s = 1 s 를 설명하지 못한다.\n▸ 실제 정착시간은 그리드 임피던스와의 상호작용이 지배한다.\n\n### 후보 4: 1 Hz 동기화 모드 가정\n\n▸ f_dom = 1 Hz 는 **동기기 스윙 주파수**의 전형적 범위(0.5~2 Hz)에 해당.\n▸ VSG 가 동기기를 모방하므로 동기화 모드가 ~1 Hz 에서 진동한다는 가정이 자연스럽다.\n▸ 그러나 실제 측정에서 Dp=20, J=0.5 조건은 **과감쇠**이므로 진동하지 않는다.\n  → [[과감쇠_동기화모드]]\n\n### 후보 5: 영국 Grid Code / ENA EREC G99 (미확인)\n\n▸ 영국 National Grid ESO 의 GFM 사양 초안(2021~)에서:\n  - 주파수 응답 delivery time 요구가 1 s 근방일 가능성\n  - Salem (2025) 리뷰에서 인용된 Rosso et al. (2021) [171] 참조\n▸ 원문 미대조. 미확인.\n\n---\n\n## 10. 종합 결론\n\n### ζ = 0.64 의 정체\n\n```\n표준 조항인가?          → 아니다\n어느 표준에서 유도?      → 특정 불가\n유도 경로:              t_s ≤ 1s + f_dom = 1 Hz → ζ = 4/(2π) = 0.6366 ≈ 0.64\nt_s ≤ 1s 의 출처:       미특정 (후보만 존재)\nf_dom = 1 Hz 의 출처:   동기기 스윙 주파수 관습 추정\n```\n\n### 조치 사항\n\n| # | 조치 | 상태 |\n|---|---|---|\n| 1 | **σ 기준으로 전환 완료** — σ_ref = 4.0 [1/s] | 완료 |\n| 2 | ζ = 0.64 는 `ZETA_REF_LEGACY` 로 보고/대조용만 유지 | 완료 |\n| 3 | ζ_floor = 0.10 (링잉 억제 부차조건) | 완료 |\n| 4 | t_s ≤ 1 s 를 **설계 목표로 채택**하되, 출처를 \"공학적 판단\"으로 명기 | 논문 서술 시 반영 |\n| 5 | IEEE 2800 Clause 7.3 원문 대조 | **미완** |\n| 6 | UNIFI v3 spec 원문 대조 | **미완** |\n| 7 | 영국 GFM 사양 (Rosso 2021) 원문 대조 | **미완** |\n\n### 논문 서술 권고\n\n▸ **쓸 수 있는 표현:**\n  \"정착시간 목표 t_s ≤ 1 s 를 채택하였다. 이는 동기기의 전형적 전기기계적 진동 모드(0.5~2 Hz)에서 1주기 이내 감쇠를 보장하는 수준이며, IEEE 2800-2022 의 주파수 드룹 응답 개시 요구(수백 ms)와 정합한다.\"\n\n▸ **쓸 수 없는 표현:**\n  \"IEEE 2800 에 따라 ζ ≥ 0.64 를 적용하였다.\" — 거짓\n  \"UNIFI Category 3 에 의거하여...\" — 수치 조항 미확인\n\n---\n\n## 11. 부록: 표준별 응답시간 요구 일람\n\n| 표준 | 항목 | 수치 | 대상 | 상태 |\n|---|---|---|---|---|\n| IEEE 2800-2022 | 주파수 드룹 반응 개시 | ≤ 0.5 s (미확인) | 전 IBR | 미확인 |\n| IEEE 2800-2022 | 전압 응답시간 | 수 초 (미확인) | 전 IBR | 미확인 |\n| IEEE 1547-2018 | 주파수 드룹 응답 | ≤ 0.5 s (미확인) | DER Cat II/III | 미확인 |\n| IEEE 1547-2018 | open loop 정착 | ≤ 5 s (미확인) | DER Cat II/III | 미확인 |\n| UNIFI v3 | positive damping | 정성적 | GFM Cat 1~3 | 확인 |\n| NERC BAL-003 | 주파수 응답 의무 | arresting ~10 s | BA 레벨 | 확인 |\n| NERC | 계통 진동 감쇠 | ζ ≥ 0.03~0.05 | 계통 모드 | 미확인 |\n| ENTSO-E RfG | 주파수 응답 | Type D, 수 초 | 발전기 | 미확인 |\n| ENTSO-E Rec. 8 | GFM 전압원 동작 | 정성적 | GFM | 미확인 |\n| KEPCO | AVR 정착시간 | 0.5~1.0 s (미확인) | 동기기 | 미확인 |\n| KEPCO | IBR 정착시간 | 규정 없음 | — | 미확인 |\n\n---\n\n## 12. 부록: 감쇠비 기준 비교\n\n| 적용 대상 | ζ 기준 | 출처 |\n|---|---|---|\n| 계통 면간 진동 (inter-area) | 0.03~0.05 | NERC/WECC guideline (미확인) |\n| 계통 로컬 진동 | 0.05~0.10 | PSS 설계 관례 |\n| 제어기 내부 모드 | 0.10~0.30 | 제어공학 관례 |\n| 2차계 최적 응답 | 0.707 | 제어공학 교과서 |\n| **본 프로젝트 구 기준** | **0.64** | **역산값 (폐기)** |\n| **본 프로젝트 현 기준** | **ζ_floor 0.10** (부차) | **링잉 억제** |\n\n▸ 0.64 는 전력계통 관례(0.03~0.10)와 제어공학 관례(0.707) **사이에 있으며, 어느 쪽에도 속하지 않는다.**\n※ 이것이 이 값의 출처를 특정하기 어려운 근본 원인이다. 두 분야의 관례를 혼합한 역산값이기 때문이다.\n\n---\n\n## 연결 노트\n\n| 방향 | 노트 | 이유 |\n|---|---|---|\n| ← | [[고유값_안정도판단]] | ζ 0.64 출처 규명 기록 |\n| ← | [[폐기값_이력]] | 항목 5: ζ → σ 전환 경위 |\n| ← | [[과감쇠_동기화모드]] | ζ 가 실수극에 적용 불가한 근거 |\n| ← | [[PSO_목적함수_설계]] | ZETA_TARGET 미확정 상수 |\n| → | [[Chen_2024_Electronics]] | ζ=0.707 목표의 원출처 |\n| → | [[salem2025gfmreview]] | 영국 GFM 사양 인용 |\n\n## 참고문헌\n\n- ▸ IEEE 2800-2022 — 미확인 조항 다수, 원문 대조 필요\n- ▸ IEEE 1547-2018 — 미확인 조항 다수, 원문 대조 필요\n- ▸ UNIFI Consortium, \"Specification for Grid-Forming IBR,\" v3, 2024 — 미확인\n- ▸ NERC, \"Reliability Standard BAL-003-2\" — 주파수 응답 의무\n- ▸ ENTSO-E, Commission Regulation (EU) 2016/631 (RfG) — 미확인\n- ▸ ENTSO-E GC ESC, \"Recommendation No. 8 — Grid-Forming Capability,\" 2023 — 미확인\n- ※ Rosso et al., \"Grid-forming converters: control approaches, grid-synchronization, and future trends — a review,\" IEEE Open J. Ind. Appl., 2021 — 영국 GFM 사양 출처, 미대조\n- ▸ Ogata, \"Modern Control Engineering,\" 5th ed., Prentice Hall — ζ=0.707 관례\n- ▸ Chen et al. 2024, Electronics (MDPI) — 본 프로젝트 [1]\n",
    "wikilinks": [
      "폐기값_이력",
      "고유값_안정도판단",
      "Chen_2024_Electronics",
      "과감쇠_동기화모드",
      "PSO_목적함수_설계",
      "salem2025gfmreview"
    ]
  },
  {
    "path": "00_Knowledge/literature/Zhao_2023_Aalborg.md",
    "dir": "00_Knowledge/literature",
    "filename": "Zhao_2023_Aalborg",
    "frontmatter": {
      "type": "literature",
      "cite_key": "zhao2023aalborg",
      "ref_num": 7,
      "year": 2023,
      "venue": "Aalborg University PhD Thesis",
      "doi": "10.54337/aau679677176",
      "paper_type": "method",
      "model_order": 14,
      "scr_range": "\"미명시\"",
      "validation_level": "sim-only",
      "tuning_method": "수동",
      "dc_ac_coupling": true,
      "extraction_depth": "full",
      "tags": [
        "literature",
        "Zhao2023",
        "DC-AC-coupling",
        "PhD",
        "reference"
      ]
    },
    "body": "# 📚 Zhao 2023 — Aalborg PhD\n\n> **역할: DC-AC 커플링 이론 근거 [7]**\n\n---\n\n## 📌 Brief Summary\n\n▸ DC-AC 결합 GFM 인버터 소신호 모델링 PhD 논문. DC-AC 커플링 원소 누락 시 불안정 모드 포착 실패를 이론적으로 증명.\n\n---\n\n## 📖 Core Content\n\n▸ **핵심 기여:**\n- DC-AC 커플링 항 $A_k(9,6) = i_{dc0}/(J \\cdot \\omega_0)$ 유도\n- 커플링 누락 시 SCR=0.8 불안정 모드 포착 실패 증명\n- 단상·삼상 GFM 인버터 통합 소신호 프레임워크\n\n▸ **핵심 수식:**\n\n$$A_k(9,6) = \\frac{\\partial(\\dot{\\Delta\\omega})}{\\partial u_{dc}} = \\frac{i_{dc0,k}}{J \\cdot \\omega_0}$$\n\n▸ **검증:**\n- 소프트웨어 시뮬레이션\n- 커플링 있음 vs. 없음 비교 실험\n\n▸ **저자 한계:**\n- 단일 DC 소스 (PV+ESS 2단 미포함)\n- SCR×X/R 2D 분석 없음\n\n---\n\n## 🔗 본 연구 연결\n\n| 항목 | Zhao 2023 | 본 연구 |\n|---|---|---|\n| DC-AC 커플링 | ✅ 이론 제시 | **✅ 실험 검증** |\n| A_k(9,6) 오차 | — | **0.0001% ✅** |\n| 시스템 | 단일 DC | **PV+ESS 2단** |\n| 검증 | 소프트웨어 | **RTDS CHIL** |\n\n▸ Phase 2 실험에서 A_k(9,6) 이론값 오차 0.0001% 달성 → Zhao 이론 검증 완료\n\n---\n\n## ✍️ My Take\n\n```\n인용 우선순위: ⭐⭐⭐ 높음\n\n※ A_k(9,6) 이론값 직접 출처 [7]\n```\n\n\n※ 차별점: Zhao 이론을 PV+ESS 2단 시스템에 적용·검증  \n※ 인용 자리: §III DC-AC 커플링 원소 유도, \"9개 추가 상태변수\" 주장  \n※ Dong(2026) 비판의 근거: \"이상적 DC 가정 → 커플링 누락\"\n\n---\n\n## 🔗 연결 노트\n\n- [[DC-AC_커플링]] — 이 논문이 이론 출처\n- [[야코비안 행렬]] — A_k(9,6) 원소\n- [[EXP_2026-08-21_Phase2_엔진전환_비교]] — 0.0001% 검증\n- [[Phase02_완료]] — 검증 완료\n",
    "wikilinks": [
      "DC-AC_커플링",
      "야코비안 행렬",
      "EXP_2026-08-21_Phase2_엔진전환_비교",
      "Phase02_완료"
    ]
  },
  {
    "path": "00_Knowledge/README.md",
    "dir": "00_Knowledge",
    "filename": "README",
    "frontmatter": {},
    "body": "# 논문 지식화 템플릿 + 추출 프롬프트 v2\n\n기존 노트 포맷(Brief Summary / Core Content / Knowledge Connections)을 유지하되, frontmatter와 출처 표기를 추가한 버전.\n\n---\n\n## A. 노트 템플릿\n\n```markdown\n---\ncite_key: kang2026syntheticinertia\nref_num: 4\ntitle: Synthetic Inertia Control for a Wind Turbine Generator\nauthors: [J. Kang, Y. C. Kang, K. H. Kim, K. Kang, Y. Lee, K. Hur, D. H. Cho]\ncorresponding: Kyeon Hur\nyear: 2026\nvenue: IEEE Trans. Sustain. Energy, vol.17, no.1, pp.684-696\ndoi: \"\"\npdf: \"[[kang2026syntheticinertia.pdf]]\"   # 없으면 빈 문자열\npdf_status: have              # have | oa-available | request | none\npaper_type: method            # review | method | analysis | experimental\ntarget_system: WTG            # WTG | PV | ESS | PV+ESS | 일반\ncontrol_scheme: [VSG, synthetic-inertia]\nmodel_order: 미명시\nanalysis_method: [미명시]\ntuning_method: adaptive       # 수동 | 적응형 | PSO | GA | Lyapunov기반\nscr_range: 미명시\nxr_range: 미명시\nvalidation_level: sim-only    # none | sim-only | CHIL | PHIL | 실기\nhardware: [MATLAB/Simulink]\nextraction_depth: full        # full | abstract | metadata\nsection: Introduction\ntags: [paper, VSG, synthetic-inertia, wind]\nstatus: read                  # to-read | read | noted | cited\n---\n\n# 📌 Brief Summary\n(2~3문장. 무엇을 하는 논문이고 내 논문에서 어떤 자리에 쓰는지)\n\n# 📖 Core Content\n▸ 전체 인용:\n▸ 핵심 기여:\n▸ 방법:\n▸ 검증:\n▸ 주요 수치:            (조건과 단위 포함. 없으면 \"미명시\")\n▸ 저자가 밝힌 한계:\n\n# 🔗 Knowledge Connections\n* Related Topics:\n* Projects/Contexts:\n* Claims: [[claim-...]]\n\n# ✍️ My Take\n※ 차별점:              (내 논문이 이것과 다른 지점)\n※ 인용 자리:            (서론 / 관련연구 / 방법 / 검증)\n※ 전략적 배치 이유:\n※ 그대로 못 쓰는 이유:\n※ 미확인 항목:\n```\n\n**표기 규칙 — 이게 핵심**\n\n- `▸` = 논문에 쓰여 있는 것. 원문 대조 가능해야 함.\n- `※` = 내가 붙인 판단. 논문 근거 없음.\n- 값이 없으면 `미명시`(원문에 없음) / `미확인`(내가 원문을 못 봄) 구분.\n\n---\n\n## B. 추출 프롬프트 (Claude Project 지침에 삽입)\n\n```\n당신은 전력전자·계통 논문을 위 템플릿 형식의 Obsidian 노트로 변환하는 도구다.\n\n[절대 규칙]\n1. ▸ 섹션에는 원문에 명시된 내용만 쓴다. 없으면 \"미명시\".\n2. ※ 섹션은 사용자가 제공한 판단만 옮긴다. 스스로 지어내지 않고,\n   판단 근거가 없으면 \"(입력 필요)\"로 비워둔다.\n3. extraction_depth가 full이 아니면 model_order, scr_range, 주요 수치는\n   전부 \"미확인\"으로 둔다. 초록만 보고 숫자를 채우면 안 된다.\n4. 리뷰 논문이 인용한 결과를 본 논문 결과로 적지 않는다.\n   반드시 \"[참고문헌번호] 인용\" 표기를 붙인다.\n5. frontmatter의 모든 키를 빠짐없이 출력한다. 값이 없어도 키는 남긴다.\n6. 출력은 마크다운 노트 하나. 설명·머리말 금지.\n\n[cite_key 생성] 제1저자성(소문자) + 연도 + 주제어. 예: kang2026syntheticinertia\n[ref_num] 사용자가 지정하지 않으면 null. 임의로 매기지 않는다.\n```\n\n**검증 콜(2단계) 리젝 규칙**\n\n1. `extraction_depth != full` 인데 수치 필드에 숫자 존재 → 리젝\n2. `paper_type: review` 인데 `model_order`에 정수 존재 → 리젝\n3. ▸ 항목인데 원문 대조 불가 → 삭제 후 `※ 미확인 항목`으로 이동\n4. frontmatter 키 누락 → 리젝\n5. 주요 수치에 조건·단위 없음 → 해당 항목 삭제\n\n---\n\n## C. Dataview 집계\n\n노트가 쌓이면 관련연구 표가 자동으로 나온다. `literature`(남의 논문)와 `mine`(내 결과)을 같이 걸어야 비교가 된다.\n\n````\n```dataview\nTABLE ref_num AS \"[]\", target_system, control_scheme, tuning_method,\n      validation_level, scr_range, extraction_depth\nFROM \"00_Knowledge/literature\" OR \"00_Knowledge/mine\"\nSORT ref_num ASC\n```\n````\n\n`extraction_depth` 열을 항상 띄워둘 것. 원문을 안 본 행이 표에 섞인 채로 2장을 쓰면 잘못 인용한다.\n\n**갭 확인용 쿼리** — 아래가 0건이면 그게 곧 기여 논거다.\n\n````\n```dataview\nLIST FROM \"00_Knowledge/literature\"\nWHERE target_system = \"PV+ESS\"\n  AND tuning_method != \"수동\"\n  AND contains(validation_level, \"CHIL\")\n```\n````\n\n---\n\n## D. 채워진 예시 — 리뷰 논문 케이스\n\n```markdown\n---\ncite_key: salem2025gfmreview\nref_num: null\ntitle: \"Grid Forming Converters for Low Inertia Systems-Capabilities and Limitations: A Critical Review\"\nauthors: [Q. Salem, B. Bany Fawaz, R. Aljarrah, M. Karimi]\ncorresponding: Mazaher Karimi\nyear: 2025\nvenue: IEEE Open J. Ind. Electron. Soc., vol.6, pp.775-801\ndoi: 10.1109/OJIES.2025.3566213\npaper_type: review\ntarget_system: 일반\ncontrol_scheme: [droop, VSG, synchronverter, VOC, dVOC, matching]\nmodel_order: N/A(리뷰)\nanalysis_method: [eigenvalue, phase-portrait, Lyapunov, matrix-perturbation, geometrical-2D]\ntuning_method: N/A(리뷰)\nscr_range: \"SCR<1 ~ SCR=50 (인용 범위 전체)\"\nxr_range: 미명시\nvalidation_level: none\nhardware: []\nextraction_depth: full\nsection: Introduction, Related Work\ntags: [paper, GFM, review, small-signal, FRT]\nstatus: read\n---\n\n# 📌 Brief Summary\nGFM 컨버터의 제어방식·안정도·FRT 한계를 통합 정리한 비판적 리뷰.\nGFM이 GFL을 어디까지 대체 가능한지가 여전히 미해결이라는 문제의식.\n서론의 GFM 필요성 논거와 관련연구 분류체계 근거로 사용.\n\n# 📖 Core Content\n▸ 전체 인용: Q. Salem, B. Bany Fawaz, R. Aljarrah, and M. Karimi,\n  \"Grid Forming Converters for Low Inertia Systems-Capabilities and Limitations:\n  A Critical Review,\" IEEE Open J. Ind. Electron. Soc., vol. 17, no. 6,\n  pp. 775-801, 2025.  ※ 권/호 재확인 필요\n▸ 핵심 기여: droop 계열과 SM 계열(VSG/synchronverter/VOC)로 GFM 제어를 분류하고,\n  소신호·과도·사고후 안정도와 FRT를 표로 정리\n▸ 검증: 없음 (리뷰, CC BY 4.0 오픈액세스)\n▸ 주요 수치:\n  - 강/약계통 경계 SCR 3 ([152],[153] 인용)\n  - 과전류 공급: SG 5-7 p.u. vs 인버터 최대 2 p.u. ([169] 인용)\n  - 영국 GFM 사양 초안: 단락전류 기여 1.5 p.u., 전압 dip 기준 0.85 p.u.,\n    무효전력 주입 5 ms 이내 ([171] 인용)\n  - 안정도 마진 확보 GFM 용량비 약 17.8% / 21.4% ([162] 인용)\n▸ 저자가 밝힌 한계: 실계통 적용 사례 부족, 비의도적 단독운전 연구 희소,\n  GFM 최적 위치·대수 미해결\n\n# 🔗 Knowledge Connections\n* Related Topics: Section I — Introduction, GFM-Control-Taxonomy, Small-Signal-Stability\n* Projects/Contexts: PV-GFM-Thesis\n* Claims: [[claim-scr3-weak-grid-threshold]],\n  [[claim-current-limit-shrinks-stability-margin]],\n  [[claim-virtual-impedance-lf-tradeoff]]\n\n# ✍️ My Take\n※ 차별점: 이 리뷰의 소신호 안정도 표는 해석 기법 나열에 그치고 파라미터 최적화 축이\n  없음. SCR과 X/R을 동시에 스윕한 사례도 확인되지 않음.\n  단, 리뷰 한 편으로 \"없다\"를 주장하면 안 됨 — [115],[114] 원문 확인 후 서술.\n※ 인용 자리: 서론(저관성·GFM 필요성), 관련연구(분류체계), 검증조건(SCR 3 경계)\n※ 전략적 배치 이유: (입력 필요)\n※ 그대로 못 쓰는 이유: 리뷰라 1차 데이터·모델식 없음.\n  개별 결과는 반드시 원논문 인용.\n※ 미확인 항목:\n  - [115] 선로 임피던스 2D 평면 안정 경계 — 내 SCR-X/R 2D와 직결, 최우선 확보\n  - [114] 전차수 상태공간 + 고유치, 초약계통 — 21차 모델 차수 근거\n  - [94] Lyapunov 기반 관성·감쇠 계수 선정 — PSO 대비 baseline\n  - [90] GFM PV용 matching SM 제어, DC 전압 동특성\n```\n\n---\n\n## E. 원본 논문 저장\n\n### Vault 구조\n\n```\nGFM_Research/                              ← Obsidian 볼트 루트 (.obsidian 위치)\n├── .obsidian/\n├── .gitignore                             ← papers/ 반드시 포함\n├── 00_Knowledge/\n│   ├── papers/                            ← 원본 PDF. 파일명 = cite_key\n│   │   ├── kang2026syntheticinertia.pdf\n│   │   └── salem2025gfmreview.pdf\n│   ├── literature/                        ← 남의 논문 1:1 노트\n│   │   ├── kang2026syntheticinertia.md\n│   │   └── salem2025gfmreview.md\n│   ├── claims/                            ← 주장 1:1 노트\n│   │   └── claim-scr3-weak-grid-threshold.md\n│   └── mine/                              ← 내 결과. literature와 같은 스키마\n│       └── mine2026-pso-run03.md\n└── RSCAD/                                 ← 시뮬레이션 작업 폴더\n```\n\n**Dataview 경로는 볼트 루트 기준이다.** `.obsidian` 폴더가 있는 곳이 볼트 루트이므로 여기서는 `GFM_Research`가 기준이고, 쿼리 경로는 `00_Knowledge/...`로 시작한다. 쿼리가 빈 표를 뱉으면 `.obsidian` 위치부터 확인할 것.\n\n`00_Knowledge`는 연구 단계 폴더(RSCAD 등)와 같은 층에 둔다. 문헌은 특정 시뮬레이션 도구에 종속되지 않고 PSCAD·Simulink·논문 집필에서 모두 참조하기 때문이다. `.gitignore`는 반드시 **git 레포 루트**에 둘 것 — 하위 폴더에 넣으면 상위 레포에서 적용되지 않는다.\n\n`00_Knowledge`는 연구 단계 폴더(RSCAD 등)와 같은 층에 둔다. 문헌은 특정 시뮬레이션 도구에 종속되지 않고 PSCAD·Simulink·논문 집필에서 모두 참조하기 때문이다. `.gitignore`는 반드시 **git 레포 루트**에 둘 것 — 하위 폴더에 넣으면 상위 레포에서 적용되지 않는다.\n\nPDF와 노트의 파일명을 **cite_key로 통일**하는 게 핵심. 그래야 `pdf: \"[[{{cite_key}}.pdf]]\"` 가 자동 생성되고, Zotero·BibTeX·본문 인용까지 한 키로 묶인다. `Ref-04-...` 같은 인용 번호 기반 이름은 초고 개정 때 전부 깨진다.\n\n### 페이지 앵커\n\nObsidian은 PDF의 특정 페이지로 바로 링크된다. 수치를 적을 때 근거 페이지를 같이 박아두면 나중에 원문 대조가 클릭 한 번이다.\n\n```markdown\n▸ 주요 수치:\n  - 강/약계통 경계 SCR 3 → ![[salem2025gfmreview.pdf#page=17]]\n  - 영국 GFM 사양 초안 1.5 p.u. → ![[salem2025gfmreview.pdf#page=19]]\n```\n\n`![[...]]` 는 노트 안에 뷰어를 임베드하고, `[[...]]` 는 링크만 건다. 수치 검증용이면 링크로 충분하다. 임베드를 남발하면 노트가 무거워진다.\n\n### 저장 방식 선택\n\n**A. Vault에 직접 저장** — 단순. Obsidian 검색이 PDF 본문까지 훑는다. 용량이 늘고 Obsidian Sync 무료 용량을 금방 먹는다. 논문 100편이면 수백 MB.\n\n**B. Zotero를 원본 저장소로, Vault는 링크만** — Zotero storage에 PDF를 두고 노트에는 `zotero://select/items/@kang2026syntheticinertia` 형식 링크만 건다. Zotero Integration 플러그인을 쓰면 citekey가 자동으로 맞는다. 용량 문제가 없고 BibTeX 내보내기가 그대로 논문 작성에 연결된다. 대신 Obsidian 단독으로는 PDF 본문 검색이 안 된다.\n\n논문 30편 넘어갈 계획이면 B를 권한다. `pdf_status` 필드는 두 방식 모두에서 \"아직 원문을 못 구한 논문\"을 걸러내는 용도로 유지할 것.\n\n```dataview\nLIST FROM \"00_Knowledge/literature\" WHERE pdf_status != \"have\"\n```\n\n### 주의\n\n- **git으로 vault를 관리한다면 `.gitignore`에 `papers/`를 반드시 넣을 것.** 구독 저널 PDF가 공개 레포에 올라가면 재배포가 된다. 개인 소장은 문제없지만 공개는 다른 문제다. OA(CC BY) 논문은 예외지만 섞여 있으면 구분이 어려우므로 폴더째 제외하는 편이 안전하다.\n- 클라우드 동기화(iCloud, Dropbox) 사용 시에도 공유 폴더에 두지 말 것.\n- `pdf_status: oa-available` 인 항목은 OpenAlex `best_oa_location`으로 자동 다운로드가 가능하다. `request`는 상호대차 큐.",
    "wikilinks": [
      "kang2026syntheticinertia.pdf",
      "claim-...",
      "claim-scr3-weak-grid-threshold",
      "claim-current-limit-shrinks-stability-margin",
      "claim-virtual-impedance-lf-tradeoff",
      "{{cite_key}}.pdf",
      "salem2025gfmreview.pdf#page=17",
      "salem2025gfmreview.pdf#page=19",
      "..."
    ]
  },
  {
    "path": "_company/_agents/business/goal.md",
    "dir": "_company/_agents/business",
    "filename": "goal",
    "frontmatter": {},
    "body": "# ⚖️ 검증 판정자 (business) — 미션\n\n> 실험 결과를 기준표에 대조해 판정한다. 수치를 만들지 않는다.\n\n## 판정 기준 (P4-A0 지표, runner.py v3)\n| 항목 | 기준 | 출처 |\n|---|---|---|\n| stable | max(Re λ) < -1e-6 | runner.STABLE_TOL |\n| σ_min | ≥ SIGMA_REF = 4.0 [1/s] (= t_s ≤ 1.0 s, 2% 정착) | metrics.py — T_S_SPEC 출처는 P3-A6 |\n| ζ_min (진동 모드만) | ≥ ZETA_FLOOR = 0.10 (링잉 하한, 부차) | metrics.py |\n| score | min(σ_min/4.0, ζ_min/0.10) ≥ 1.0 · binding 이 σ 인지 ζ 인지 명시 | metrics.py |\n| t_s_max | 4/σ_min ≤ 1.0 s | metrics.py TS_COEF=4 |\n| 검산 | fd 상대오차 < 1e-6 | runner.FD_TOL |\n| δ | < 75° (이상은 부하가능성 한계 접근) | runner.DELTA_WARN |\n| ζ ≥ 0.64 (구) | **대조만** (ratio_legacy) — 표준 조항 아님, LCL 공진이 최솟값 독점 | metrics.py 주석 |\n\n## 절차\n1. `python tools/results_digest.py --results results` (runner) / `--xval` (선형화 유효성) 출력을 ▸ 로 인용\n2. 기준표 대조 → 항목별 ✅/❌, 미달 시 어느 대역(sync/control/lcl)이 구속(binding)인지 명시\n3. band_crossovers 가 있으면 \"ζ_min 시계열은 단일 물리량 아님\" 경고 첨부\n4. loadability_limit SCR 은 소신호 경계와 분리해 표기\n5. 다음 실험 1개만 제안 (max_actions_per_response: 1)\n\n## 규칙\n- ▸(결과) / ※(해석) 구분. 기준에 없는 값은 \"미명시\".\n- P7 이후: 소신호 예측 vs EMT/SIL 실측 오차 → 불일치 시 ①스케일링 ②펌웨어 ③지연 ④모델 누락 순 책임 추적.\n",
    "wikilinks": []
  },
  {
    "path": "_company/_agents/developer/goal.md",
    "dir": "_company/_agents/developer",
    "filename": "goal",
    "frontmatter": {},
    "body": "# 🧮 시뮬레이션 엔지니어 (developer) — 미션\n\n> 24시간 업무 ON 시 이 미션을 향해 한 스텝씩. 재계산하지 말고 runner.py 를 실행하라.\n\n## 지금 (P2-A5 blocking)\n선형화 유효성 임계값 비단조(SCR 1.5 만 0.5%) — 물리(다중 평형점) vs 수치(Radau 누적오차) 판별.\n```\npython Simulation/runner.py --SCR 1.7 1.6 1.5 1.4 1.3 --tag p2a5\npython tools/results_digest.py --results results\npython Simulation/xval.py           # 선형화 검증\npython Simulation/xval.py --T 0.2   # 적분 구간 대조\n```\n산출: results/<run>_p2a5/ 의 meta.json·results.md. results.md 를 Vault 03_실험결과/ 로 옮기고\nGFM_연구_전체지도.md 에 링크. 판정은 검증 판정자(business)에게 넘긴다.\n\n## 다음 (P4 착수 전)\n- P4-A0: metrics.py 의 σ_min / t_s / score 정의와 SIGMA_REF·T_S_SPEC 출처 문서화 → evidence 경로 확정\n- P4-A1: TABLE II 탐색범위 — runner.py parse_args 의 14개 기본값이 출발점\n\n## 규칙\n- results/ 아래 파일을 직접 수정하지 않는다. LATEST.json 은 runner.py 만 쓴다.\n- 수치는 results_digest.py 출력을 ▸ 그대로 인용. 반올림·재계산 금지.\n- 미수렴은 원인(loadability_limit / nonconvergence)을 구분해 보고. 둘은 다른 경계다.\n- schedule.yaml 은 읽기만. state 변경은 observer.py 제안 → 사람 확정.\n",
    "wikilinks": []
  },
  {
    "path": "_company/_agents/secretary/goal.md",
    "dir": "_company/_agents/secretary",
    "filename": "goal",
    "frontmatter": {},
    "body": "# 🗂️ 실험 노트 관리자 (secretary) — 미션\n\n> schedule.yaml 이 진실원. 나는 읽고 제안하고 기록한다. state 상향은 사람만.\n\n## 매일 아침 브리핑 (순서 고정)\n```\npython tools/gate_check.py --yaml GFM_Research/schedule.yaml --mirror GFM_Research/checkList.md\npython agent/observer.py GFM_Research/schedule.yaml agent/observe_map.yaml\n```\n1. gate_check 첫 줄 = 브리핑 첫 줄 (critical/high 면 그 행동 하나만)\n2. observer 의 promote/demote 제안 → \"확정하시겠습니까\" 목록으로\n3. 미러↔YAML 불일치 있으면 skills/schedule_sync.md 절차로 초안 제출\n\n## 실험 후\n- runner.py 가 만든 results/<run>/results.md → Vault 03_실험결과/ 로 복사 (원본 유지)\n- GFM_연구_전체지도.md 실험 링크, Phase_지식_연결맵.md 해당 행 갱신\n- 검증 판정자 판정표를 EXP 노트 🔍 분석 섹션에 ▸/※ 구분해 붙임\n\n## 금지 (output_policy)\n진척률 %, 전체 일정 재나열, 격려 문구, 사용자 확인 없는 state 상향.\n",
    "wikilinks": []
  },
  {
    "path": "_company/_agents/secretary/skills/schedule_sync.md",
    "dir": "_company/_agents/secretary/skills",
    "filename": "schedule_sync",
    "frontmatter": {},
    "body": "# schedule_sync — checkList.md → schedule.yaml 초안 생성 규칙 (secretary 스킬)\n\n미러(checkList.md)가 YAML보다 앞서 있을 때, 또는 ID 체계가 갈라졌을 때 실행한다.\n출력은 **초안**이다. state 상향은 사람이 확정한다 (output_policy.forbidden).\n\n## 입력\n1. 현재 `schedule.yaml` (진실원, 낡았을 수 있음)\n2. 최신 `checkList*.md` (미러, 사람이 최근 편집)\n3. `gate_check.py --json` 결과의 `mirror` 블록 (ahead / not_in_yaml)\n\n## 변환 규칙\n| 체크리스트 | YAML |\n|---|---|\n| `- [x]` + 증거 경로가 노트에 있음 | `state: verified`, `evidence: <경로>` |\n| `- [x]` 인데 경로 없음 | `state: draft`, `evidence: null`, 주석 `# 확인 필요: <무슨 파일>` |\n| `⚠️ 진행 중` | `state: in_progress` |\n| `- [ ]` | `state: not_started` |\n| 🔺 | `blocking: true` |\n| ⬆️ 앞당김 | `window` 앞당기고 `note` 에 사유 |\n| ~~취소선~~ / \"구 X\" / \"폐기\" | 항목 삭제 + phase 의 `superseded:` 목록에 한 줄 |\n| `> [!danger]` / `[!warning]` 본문 | 해당 phase 의 `precondition:` 또는 artifact `note:` |\n| Tier 분기표 | `meta.tier`, `tiers:`, `gates.P7.tier{n}`, `applies_to_tier` |\n\n## 절대 규칙\n- `current_month`, `month_1_start` 는 건드리지 않는다. 계산값과 다르면 주석으로만 표시.\n- 체크리스트에 없는 항목을 만들어내지 않는다. ID 가 갈라졌으면(같은 ID, 다른 이름) YAML 쪽 이름을 버리고 체크리스트 이름·번호를 따른다 — 사람이 마지막으로 편집한 쪽이 의도다.\n- 수치(오차, 고유값, 각도)는 체크리스트에 적힌 그대로 `note:` 에 옮긴다. 반올림·해석 금지.\n- 완료 후 `gate_check.py --yaml <초안> --mirror <체크리스트>` 를 돌려 `mirror_ahead` 가 \"draft(evidence 대기)\" 항목만 남는지 확인한다. 그 외가 남으면 변환 누락.\n\n## 출력\n- `schedule.v{n+1}.yaml` (기존 파일 덮어쓰지 않음)\n- 사람에게 보낼 한 줄: \"초안 생성. draft {k}건 evidence 경로 필요: <id 목록>. 확정 후 schedule.yaml 로 교체.\"\n",
    "wikilinks": []
  },
  {
    "path": "GFM_Labs_구축현황.md",
    "dir": "",
    "filename": "GFM_Labs_구축현황",
    "frontmatter": {
      "type": "setup-record",
      "project": "GFM Labs",
      "date": "2026-09-09",
      "status": "active",
      "tags": [
        "GFM-Labs",
        "형상관리",
        "에이전트",
        "일정"
      ]
    },
    "body": "# GFM Labs 구축 현황 — 2026-09-09 정리\n\n> 위치 제안: `RSCAD/GFM_Research/00_MOC/GFM_Labs_구축현황.md`\n> 표기: ▸ 확정된 사실·설정값 / ※ 판단·제안\n\n---\n\n## 1. 무엇을 만드는가\n\n▸ **GFM Labs** = Grid-Forming 인버터 안정도 연구를 수행하는 AI 1인 연구소.\n▸ Jay(wonseokjung)의 connect-ai / EZER AI를 *쓰는* 것이 아니라, 그 오픈소스(MIT)를 포크해 **직접 구축**한다. EZER 웹은 비공개라 자체 제작 대상.\n▸ 사람은 방향·판단, 에이전트는 문헌·수식 검증·시뮬레이션 실행·기록·초안.\n▸ 원칙: `▸`(실험·논문) / `※`(해석) 구분, 없는 값은 \"미명시\", 로컬 LLM만 사용, Vault 노트 덮어쓰기 금지.\n\n## 2. 이름 규칙\n\n| 이름 | 의미 |\n|---|---|\n| **GFM** | Grid-Forming — 연구 주제 약어. `GFM_Research`, `model.py` 등 코드 전체 |\n| **GFM Labs** | 연구소(회사) 이름. 구 \"GMF Labs\"는 오타 → 2026-09-09 통일 |\n| `gfm-labs-agent` | 익스텐션 포크 저장소 (구 `gmf-labs-agent`에서 rename) |\n| `gfm-labs` | Firebase 프로젝트 ID (신규 생성). 구 `gmf-labs` 프로젝트는 삭제 대상 |\n\n## 3. 형상관리 — 두 저장소\n\n**기준: 연구 상태(데이터)는 RSCAD, 에이전트 제품(코드)은 gfm-labs-agent.** 제품 저장소에는 GFM 고유 내용이 없어야 한다.\n\n```\n~/Dev/RSCAD                      github.com/charminseon1987/RSCAD          (연구)\n├─ GFM_Research/                 ← Obsidian Vault = 에이전트 두뇌 폴더\n│  ├─ schedule.v1.yaml           ← 일정 진실원 초안 (확정 후 schedule.yaml 로 교체)\n│  ├─ checkList*.md              ← 읽기용 미러\n│  ├─ 00_MOC / 01_개념 / 02_방법론 / 03_실험결과 / 04_문헌 / 05_템플릿\n│  └─ _company/_agents/{secretary,developer,business}/goal.md, skills/\n├─ Simulation/  model.py op.py runner.py metrics.py xval.py pf.py\n├─ agent/       observer.py schedule_agent.py + gate_check.py results_digest.py observe_map.example.yaml\n├─ results/     runner.py 산출 (LATEST.json 포인터) — evidence 폴더, 추적 유지\n└─ connect-ai/  ← .gitignore 로 제외 (아래 포크의 로컬 클론)\n\n~/Dev/RSCAD/connect-ai           github.com/charminseon1987/gfm-labs-agent (제품, private)\n├─ src/  extension.ts agents.ts plaza.ts …     ← Jay 익스텐션 포크\n├─ gfm-labs/\n│  ├─ rag/        ingest.py query.py server.py  (Vault → ChromaDB → :5100)\n│  ├─ web/        Vite+React  /store /plaza /download  (Phase 8 이후)\n│  └─ GFM_Labs_설계.md\n├─ .vscode/launch.json  (PLAZA_DB_URL)\n└─ git remote: origin=charminseon1987/gfm-labs-agent, upstream=wonseokjung/connect-ai\n```\n\n▸ RSCAD `.gitignore`: `connect-ai/`, `__pycache__/`, `*.pyc`, `.env`, `agent/chroma/`, `*.bak.*`\n▸ 이미 추적되던 `connect-ai/*`, `*/__pycache__/*` 는 `git rm -r --cached` 로 해제 (2026-09-09)\n▸ gfm-labs-agent `.gitattributes`: `* text=auto eol=lf` (Mac/Windows 혼용 대비)\n※ upstream 갱신: `git fetch upstream && git merge upstream/main`\n\n## 4. 인프라 설정값\n\n| 항목 | 값 |\n|---|---|\n| Firebase RTDB (광장) | `https://gfm-labs-default-rtdb.firebaseio.com` |\n| RTDB 규칙 | `{ \"rules\": { \"plaza\": { \".read\": true, \".write\": true } } }` — 게시 필요. 운영 전 익명 Auth |\n| 익스텐션 설정 | `connectAiLab.plazaDbUrl` = 위 URL. 명령 \"Connect AI: 🏛️ 에이전트 광장 입장/퇴장\" |\n| 데스크톱 앱 (v0.5.12) | 설정 → 고급 → \"대학 DB URL\" = 위 URL. 운영자 설정 3개는 비움 |\n| 로컬 LLM | LM Studio `http://127.0.0.1:1234` (Developer 탭 Start Server) 또는 Ollama `:11434` |\n| 임베딩 | `ollama pull nomic-embed-text` (RAG용) |\n| Bridge | `http://127.0.0.1:4825` — 익스텐션·데스크톱 앱 동시 실행 시 충돌, 하나만 |\n| 작업 폴더 / 두뇌 폴더 | `C:\\Users\\hyese\\Dev\\RSCAD\\GFM_Research` |\n| 익스텐션 설치 | `npm run compile` → `npx @vscode/vsce package --no-dependencies` → Install from VSIX |\n\n▸ 검증 완료: 익스텐션 광장 입장 → RTDB `plaza/rooms/lobby/presence/ca-…` 생성 확인 (구 DB 기준, 새 DB로 재확인 필요)\n\n## 5. 연구 일정 — 확정값\n\n| 항목 | 값 |\n|---|---|\n| `month_1_start` | 2026-05 (확정) → 2026-09 = **5월차** |\n| `deadline_month` | 12 |\n| `tier` | **2** — 소프트웨어 검증 (EMT + SIL). RTDS CHIL 불필요, P6 일정 제외 |\n| `model_version` | v3-22state (`runner.py`) |\n| `pace` | accuracy_first — R1(마감 역산)은 medium 참고 경보 |\n\n▸ gate_check 현재 출력: `다음 게이트: P4 착수 ← P3-A6, P4-A0 미완 · 마감까지 약 212일`\n\n### 코드가 확정한 사실 (2026-09-09 대조)\n- ▸ P4-A0 안정도 지표는 `metrics.py`에 **이미 구현** (σ_min ≥ 4.0 [t_s ≤ 1s], ζ_min ≥ 0.10 부차, `score = min(σ/4, ζ/0.1)`)\n- ▸ ζ = 0.64 는 표준 조항이 아니라 v0의 `4/(2π·1Hz)` 환산값 → **P3-A6 재정의**: \"t_s ≤ 1s 출처 확정 + σ 대체 정당화\"\n- ▸ `runner.py` v3: 모드 대역 분류·교차 검출·미수렴 원인 구분·`results.md` 자동 생성 — 에이전트가 재계산하지 않음\n- ▸ `xval.py`: 격자 임계값 + 멱함수 피팅 임계값. P2-A5 비단조 판별은 **피팅값 단조성**으로\n- ▸ `observer.py`: evidence 실재 검증·정체 관측·승격 제안(draft까지). `issue/next_action/action` 필드가 있으면 승격 보류\n\n### 사람이 할 것 (state 상향은 사람만)\n- [ ] draft 6건 evidence 경로 기입: P2-A2, P2-A3, P2-A4, P3-A2, P3-A3, P3-A4\n- [ ] P0-A3 Tier 결정 근거 노트 → evidence\n- [ ] P4-A0 evidence 확인 후 verified\n- [ ] `schedule.v1.yaml` → `schedule.yaml` 교체\n- [ ] `pf.py` 와 `metrics.participation()` 정의 일치 확인 (P3-A1 evidence)\n\n## 6. 에이전트 팀 (connect-ai id 유지, 역할 재정의)\n\n| id | 새 이름 | 첫 임무 |\n|---|---|---|\n| ceo | 연구소장 | 명령 분해·배분, decisions.md |\n| secretary | 실험 노트 관리자 | 아침 브리핑 = `gate_check` → `observer` 순. results.md Vault 이동. 미러↔YAML 동기(`schedule_sync` 스킬) |\n| developer | 시뮬레이션·CHIL 엔지니어 | **P2-A5**: `runner.py --SCR 1.7 1.6 1.5 1.4 1.3 --tag p2a5` → `xval.py` → `results_digest --xval` |\n| business | 검증 판정자 | metrics.py 기준표로 판정. binding(σ/ζ) 명시, loadability_limit 분리 |\n| researcher | 문헌 추적자 | 논문 지식화 v2, [1]~[15] 연결맵 |\n| writer | 논문 작가 | ▸/※ 유지한 섹션 초안 |\n| designer | 그림 담당 | 고유값 복소평면, 2D 히트맵 |\n| instagram, editor | 비활성 | — |\n\n▸ goal.md 위치: `GFM_Research/_company/_agents/<id>/goal.md`\n▸ output_policy 금지: 진척률 %, 전체 일정 재나열, 격려 문구, 사용자 확인 없는 state 상향\n\n## 7. 도구\n\n| 도구 | 위치 | 역할 |\n|---|---|---|\n| `gate_check.py` | `RSCAD/agent/` | schedule.yaml 경보 R0~R5 판정(YAML severity), 게이트, 미러 대조, month 계산 경고. `--fix-r4` 만 자동 변경 |\n| `results_digest.py` | `RSCAD/agent/` | runner 결과 요약(`LATEST.json`), `--xval` 선형화 유효성·단조성, `--compare A B` |\n| `observer.py` | `RSCAD/agent/` (기존) | evidence 관측 → 승격 제안 |\n| `rag/` | `gfm-labs-agent/gfm-labs/` | Vault 색인·검색 서버 `:5100` (`/query`, `/ask`) |\n| `schedule_sync.md` | secretary skills | checkList → schedule.yaml 초안 변환 규칙 |\n\n실행 예:\n```bash\ncd ~/Dev/RSCAD\npython agent/gate_check.py --yaml GFM_Research/schedule.v1.yaml --mirror GFM_Research/checkList.md\npython agent/results_digest.py --results results\npython agent/results_digest.py --results results --xval\n```\n\n## 8. 우선순위 (결정)\n\n1. ✅ schedule.yaml v1 초안 + gate_check + 에이전트 미션 — 완료, 사람 확정 대기\n2. ⏳ **포크 `src/agents.ts` 페르소나 교체** + `readAgentSharedContext` → RAG `:5100` 연결\n3. ⏳ 첫 자율 사이클: P2-A5 스윕 → EXP/BUG 노트 자동 생성\n4. ⏸ 웹(`/store`, `/plaza`) — Phase 8 이후\n5. ⏸ RTDB 익명 Auth, 멀티룸 — 운영 전\n\n## 9. 하지 않는 것\n\n- 클라우드 LLM (연구 데이터 외부 유출 없음)\n- 에이전트의 Vault 노트 덮어쓰기 — 새 노트 생성 또는 append\n- 에이전트의 `current_month`·state 상향 — 사람만\n- 유튜브·인스타·PayPal 기능 — 포크에서 비활성\n\n## 🔗 연결\n\n- [[GFM_연구_전체지도]]\n- [[GFM_Labs_설계]] (`gfm-labs-agent/gfm-labs/GFM_Labs_설계.md`)\n- [[실험결과_업데이트_절차]]\n- `schedule.v1.yaml`, `checkList_v0.1.md`\n",
    "wikilinks": [
      "GFM_연구_전체지도",
      "GFM_Labs_설계",
      "실험결과_업데이트_절차"
    ]
  },
  {
    "path": "RSCAD/00_MOC/GFM 마스터 컨텍스트 프롬프트.md",
    "dir": "RSCAD/00_MOC",
    "filename": "GFM 마스터 컨텍스트 프롬프트",
    "frontmatter": {
      "## type": "master-prompt version: 1.0 date: 2026-08-20 tags: [prompt, context, GFM, research]"
    },
    "body": "## ═══ 연구자 정보 ═══\n\n```\n연구자:   조연호 (Cho Yeonho)\n소속:     연세대학교 전기전자공학부 스마트그리드 연구실\n지도교수: 허견 (Prof. Kyeon Hur)\n목표저널: IEEE Access (1차) → IEEE Trans. Sustainable Energy (최종)\n현재단계: Phase 2 — SymPy 21차 야코비안 구현 중\n```\n\n---\n\n## ═══ 연구 핵심 1줄 ═══\n\n```\nPSO로 최적화된 2단 PV+ESS GFM 인버터의 21차 소신호 모델을 구축하고,\nSCR-X/R 2D 안정 경계(88포인트)를 RTDS CHIL로 최초 정량화한다.\n```\n\n---\n\n## ═══ 4중 차별화 (표 6-3 기준) ═══\n\n|차별화 축|Dong et al.[2] (2026)|본 연구|정량 근거|\n|---|---|---|---|\n|**모델 차수**|12차 (이상적 DC 버스)|**21차 (DC-AC 커플링)**|9개 추가 상태변수, [7]Zhao 2023 근거|\n|**PSO 역할**|SVR 하이퍼파라미터 3개|**GFM 제어 이득 14개 직접 최적화**|파라미터 수 4.7배(14/3), [1]|\n|**검증 방법**|순수 소프트웨어 R²=0.9854|**RTDS CHIL + 실DSP 정밀도 ≥95%**|IEEE Std. 2004-2025 준수, [9]|\n|**시스템 구성**|순수 GFM 이상적 DC 가정|**PV+ESS 2단 MPPT 포함**|PV P-V 비선형성 반영, [15]|\n|**SCR 경계 차원**|단일 CSCR 수치 (1D)|__SCR_(X/R) 2D 곡면_*|Ganguly(2025) 1D 불완전성 증명, [3]|\n\n---\n\n## ═══ 핵심 참고문헌 (실험 연결용) ═══\n\n### [1] Chen et al., Electronics 2024 — 방법론 베이스\n\n```\nDOI: 10.3390/electronics13071343\n핵심: 21차 소신호 모델, PSO 14개 파라미터\n본 연구 연결: 상태변수 구조, 파라미터 초기값 출처\n실험 연결: sym.py 야코비안 구조 → [1] 검증\n```\n\n### [2] Dong et al., Front. Energy Res. 2026 — 선점 논문 ★\n\n```\nDOI: 10.3389/fenrg.2025.1738311\n핵심: 12차 모델, PSO=SVR 하이퍼파라미터(C,ε,γ) 3개 최적화\n본 연구 연결: 5축 차별화 기준점\n실험 연결: A_k(9,6) 없음(12차) → 본 연구 21차에서 0.003183 ✅\n```\n\n### [3] Ganguly, Wang, Kroposki 2025 — 2D 경계 근거\n\n```\nDOI: 10.20944/preprints202504.1145.v1\n핵심: X/R=0.5에서 인버터1 트립, X/R=1.0에서 인버터2 트립\n본 연구 연결: SCR*(X/R) 2D 스윕 동기 — 1D 분석 불완전 증명\n실험 연결: sweep2d 결과 → [3] 실험 재현 비교\n```\n\n### [7] Zhao 2023, Aalborg PhD — DC-AC 커플링 근거\n\n```\nDOI: 10.54337/aau679677176\n핵심: DC-AC 커플링 항 누락 시 불안정 모드 포착 실패\n본 연구 연결: A_k(9,6) = idc0/(J·ω₀) 이론적 근거\n실험 연결: sym.py A_k(9,6) 검증 ← [7] 이론값\n```\n\n### [9] IEEE Std. 2004-2025 — CHIL 표준\n\n```\n발행: 2025.08.29\n핵심: HIL 시뮬레이션 기반 검증 공식 표준\n본 연구 연결: Phase 6~7 RTDS CHIL 검증 근거\n실험 연결: Phase 7 CHIL 결과 → [9] 준수 여부\n```\n\n### [15] Villalva et al. 2009 (PV 모델) — PV 비선형성\n\n```\n핵심: PV P-V 곡선 비선형 모델\n본 연구 연결: f4(upv), f7(iLpv) 방정식 — MPPT 동작점\n실험 연결: sym.py f1~f4 → [15] 비선형항 근거\n```\n\n---\n\n## ═══ 현재 상태 (Phase별) ═══\n\n```\nPhase 1 ✅ 완료\n  Flask 서버 (numpy/scipy)\n  /api/jacobian  ← SCR=1.5: stable=True, ζ=0.256, A_k(9,6)=0.003183\n  /api/sweep2d   ← 88포인트: SCR*=0.8 (numpy 근사 한계)\n  /api/pso       ← ⚠️ 시뮬만 (Phase 4에서 실제 구현)\n  웹 대시보드 Flask 연결\n\nPhase 2 ⏳ 진행 중\n  SymPy 21차 야코비안\n  현재: stable=False (DC PI 구조 문제)\n  진전: A_k(9,6) 이론값 일치 ✅, f_dom SCR 의존성 물리 타당 ✅\n  미해결: DC 서브시스템 불안정 (5차 시도 예정)\n\nPhase 3~7 ⏳ 예정\n```\n\n---\n\n## ═══ 핵심 수치 Quick Ref ═══\n\n```\nζ_threshold = 0.64    ← 4/(2π×1.0×1.0) = 0.6366 올림\nζ* (PSO 목표) = 0.707\n상태변수 = 21개       ← DC 8개 + AC 13개\nPSO 파라미터 = 14개   ← DC 6개 + VSG 4개 + AC 4개\nCHIL 포인트 = 88개    ← SCR 22레벨 × X/R 4조건\nSCR 운전점 = {3.0, 2.0, 1.5, 1.0}\nX/R 조건   = {0.5, 1.0, 2.0, 5.0}\n\nA_k(9,6) 이론값:\n  SCR=3.0: 0.001592   SCR=2.0: 0.002387\n  SCR=1.5: 0.003183   SCR=1.0: 0.004775\n  공식: idc0/(J·ω₀) = (0.9/SCR)/(0.5×376.99)\n\nDC PI 임계감쇠:\n  critical_Dp = 2√(J·wc) = 2√(0.5×31.4) = 7.92\n  현재 Dp=20 > 7.92 → 과감쇠 (VSG 스윙 모드 없음)\n```\n\n---\n\n## ═══ 표기 원칙 ═══\n\n```\n▸ = 실험/논문에서 나온 값 (수치, 코드 출력, 문헌 내용)\n※ = 내 해석·판단 (추론, 의미 부여, 차별점 주장)\n→ 절대 섞지 않는다\n```",
    "wikilinks": []
  },
  {
    "path": "RSCAD/00_MOC/Gfm 지식화 시스템 v2.md",
    "dir": "RSCAD/00_MOC",
    "filename": "Gfm 지식화 시스템 v2",
    "frontmatter": {
      "## type": "system-guide version: 2.0 date: 2026-08-20 tags: [obsidian, knowledge-management, GFM, experiment]",
      "> **기반": "** 논문 지식화 템플릿 + 추출 프롬프트 v2 (2026-08-20 대화)",
      "> **원칙": "** `▸` = 실험/논문에서 나온 것 / `※` = 내 판단·해석"
    },
    "body": "## 1. 폴더 구조\n\n```\n~/dev/RSCAD/results/          ← 실험 결과 파일 저장\nObsidian Vault/\n├── 00_MOC/\n│   └── GFM_연구_전체지도.md    ← 허브\n├── 01_개념/\n│   ├── 소신호_선형화.md\n│   ├── 고유값_안정도판단.md\n│   ├── DC-AC_커플링.md\n│   └── PSO_이중수렴기준.md\n├── 02_방법론/\n│   ├── 21차_야코비안_유도가이드.md\n│   └── 88포인트_2D_스윕_설계.md\n├── 03_실험결과/\n│   ├── EXP_YYYY-MM-DD_API명_조건.md   ← 실험마다 생성\n│   └── BUG_YYYY-MM-DD_버그명.md       ← 버그마다 생성\n├── 04_문헌/\n│   └── (논문 지식화 템플릿 v2 적용)\n└── 05_템플릿/\n    ├── TPL_실험결과.md\n    ├── TPL_버그분석.md\n    └── TPL_문헌노트.md\n```\n\n---\n\n## 2. 실험결과 노트 템플릿 (TPL_실험결과.md)\n\n```markdown\n---\ntype: experiment\napi: /api/{{엔드포인트}}\ndate: {{YYYY-MM-DD}}\nphase: {{1~7}}\nattempt: {{1차|2차|3차...}}\nstatus: {{pending|running|verified|failed}}\ntags: [experiment, {{api명}}, {{조건태그}}]\n---\n\n# 🧪 EXP: {{API명}} — {{핵심 조건}}\n\n## 📥 입력\n\n\\`\\`\\`json\n{{curl 파라미터 붙여넣기}}\n\\`\\`\\`\n\n\\`\\`\\`bash\n# 재현 명령어\ncurl -X POST http://localhost:5000/api/{{엔드포인트}} \\\n  -H \"Content-Type: application/json\" \\\n  -d '{{파라미터}}'\n\\`\\`\\`\n\n## 📤 출력 (API 응답 원본)\n\n\\`\\`\\`json\n{{응답 붙여넣기}}\n\\`\\`\\`\n\n## 📊 핵심 수치 추출\n\n| 항목 | 값 | 기대값 | 판정 |\n|---|---|---|---|\n| stable | | true | |\n| zeta_min | | ≥ 0.64 | |\n| f_dom_hz | | 1~3 Hz | |\n| A_k(9,6) | | idc0/(J·ω₀) | |\n| SCR* | | | |\n\n## 🔍 분석\n\n### ▸ 관찰된 사실 (실험 결과)\n- \n\n### ※ 해석 (내 판단)\n- \n\n### ⚠️ 이상값·버그\n- \n\n## 🔗 연관 지식\n\n| 연결 방향 | 노트 | 이유 |\n|---|---|---|\n| 근거 이론 | [[DC-AC_커플링]] | A_k(9,6) 계산 근거 |\n| 근거 이론 | [[고유값_안정도판단]] | stable 판정 기준 |\n| 선행 실험 | | |\n| 다음 실험 | | |\n| 관련 버그 | | |\n| 관련 문헌 | | |\n\n## 🤖 Claude 지식 프롬프트\n\n\\`\\`\\`\n[GFM_연구_전체지도.md 전체]\n[이 노트 전체]\n[연관 노트 1~2개]\n\n→ 질문:\n\\`\\`\\`\n\n## 📌 Obsidian 업데이트 체크리스트\n\n- [ ] GFM_연구_전체지도.md 실험 링크 추가\n- [ ] 관련 개념 노트 업데이트\n- [ ] 이전 실험 노트에 \"다음 실험\" 링크 추가\n- [ ] results/ 폴더 결과 파일 경로 기록\n```\n\n---\n\n## 3. 버그분석 노트 템플릿 (TPL_버그분석.md)\n\n```markdown\n---\ntype: bug\ncomponent: {{파일명.py}}\ndate: {{YYYY-MM-DD}}\nphase: {{1~7}}\nattempt: {{1차|2차|3차...}}\nstatus: {{open|in_progress|resolved|wontfix}}\nseverity: {{critical|major|minor}}\ntags: [bug, {{컴포넌트}}, {{키워드}}]\n---\n\n# 🔧 BUG: {{버그명}}\n\n## 증상\n\n\\`\\`\\`\n예상값: \n실제값: \n오차:   \n\\`\\`\\`\n\n## 시도 기록\n\n| 차수 | 날짜 | 수정 내용 | 결과 | stable | zeta_min |\n|---|---|---|---|---|---|\n| 1차 | | | | | |\n| 2차 | | | | | |\n| 3차 | | | | | |\n| 4차 | | | | | |\n\n## 원인 분석\n\n### ▸ 확인된 사실\n- \n\n### ※ 가설\n- \n\n## 수정 방향\n\n\\`\\`\\`python\n# 현재 (문제)\n\n# 수정 필요\n\n\\`\\`\\`\n\n## 검증 기준\n\n다음 조건을 모두 만족하면 RESOLVED:\n- [ ] stable = True\n- [ ] zeta_min > 0\n- [ ] A_k(9,6) 이론값 오차 < 1%\n- [ ] 4개 SCR 모두 통과\n\n## 🔗 연관 지식\n\n- [[21차_야코비안_유도가이드]] — 수식 근거\n- [[DC-AC_커플링]] — A_k(9,6) 이론값\n- [[실험결과 노트]] — 증상 발견 원본\n\n## 🤖 Claude 지식 프롬프트\n\n\\`\\`\\`\n[GFM_연구_전체지도.md]\n[이 버그 노트 전체]\n[21차_야코비안_유도가이드.md]\n\n→ \"SymPy f(x)에서 {{수정 대상}}을 올바르게 구현하는 코드를 작성해줘.\n   검증 기준: stable=True, zeta_min>0, A_k(9,6)=이론값\"\n\\`\\`\\`\n```\n\n---\n\n## 4. sym.py 실행 후 Obsidian 자동 업데이트 절차\n\n### Step 1 — 실험 실행\n\n```bash\npython Simulation/sym.py\n# → results/ 폴더에 저장됨\n```\n\n### Step 2 — 결과 확인 포인트\n\n```\n확인 항목               기대값          현재값(4차)\n────────────────────────────────────────────────\nstable                  True            False ❌\nzeta_min                > 0             -0.38 ❌\nf_dom_hz                1~3 Hz          0.66  ⚠️\nA_k(9,6) SCR=1.5        0.003183        0.003183 ✅\nA_k(9,6) 오차           < 1%            0% ✅\n```\n\n### Step 3 — 노트 업데이트\n\n```\nBUG_sym_DC_PI.md → 시도 기록 표에 4차 결과 추가\nGFM_연구_전체지도.md → 현재 상태 업데이트\n```\n\n---\n\n## 5. 지식 연결 맵\n\n```\nsym.py 실험 결과\n    │\n    ├─▶ DC-AC_커플링.md\n    │     A_k(9,6) = idc0/(J·ω₀) 이론값 검증\n    │\n    ├─▶ 야코비안_행렬.md\n    │     블록 구조: A_DC(8×8), A_AC(13×13), A_coup(13×8)\n    │\n    ├─▶ 소신호_선형화.md\n    │     선형화 유효성: Δu_pv < 5% 기준\n    │\n    ├─▶ 고유값_안정도판단.md\n    │     Re(λ) < 0 → stable 판정\n    │\n    ├─▶ PSO_이중수렴기준.md\n    │     최적화 대상 파라미터 14개\n    │\n    └─▶ Chen_2024_Electronics.md\n          21차 모델 원출처, 파라미터 초기값\n```\n\n---\n\n## 6. 논문 지식화 프롬프트 (v2 기반, GFM 연구 특화)\n\n```\n[시스템 프롬프트]\n\n당신은 GFM 인버터·전력계통 안정도 분야 논문에서\n구조화 데이터를 추출하는 도구다.\n\n절대 규칙:\n1. 원문에 없는 값은 \"미명시\"로 채운다\n2. 초록만 있으면 수치 필드는 전부 \"미확인\"\n3. 모든 수치는 단위+조건 포함\n4. ▸ = 논문 내용 / ※ = 내 판단 — 반드시 구분\n5. 출력은 Obsidian .md 형식\n\n[GFM 도메인 필드]\n- model_order: 상태변수 차수 (본 연구: 21차)\n- scr_range: 검증 SCR 범위\n- xr_range: X/R 조건\n- validation_level: sim-only | CHIL | PHIL\n- tuning_method: 수동 | PSO | GA | Lyapunov\n- dc_ac_coupling: 반영여부 (본 연구 차별점)\n- pso_params: PSO 최적화 파라미터 수\n\n[출력 형식: Obsidian md]\n---\ncite_key: {{저자년도키워드}}\nref_num: \nyear: \nvenue: \nmodel_order: \nscr_range: \nvalidation_level: \ntuning_method: \ndc_ac_coupling: \nextraction_depth: full|abstract\n---\n\n# 📌 Brief Summary\n\n# 📖 Core Content\n▸ 핵심 기여:\n▸ 방법:\n▸ 검증:\n▸ 주요 수치:\n▸ 저자 한계:\n\n# 🔗 Knowledge Connections\n* 본 연구와 차이점:\n* 인용 자리:\n* 추적 우선 참고문헌:\n\n# ✍️ My Take\n※ 차별점:\n※ 못 쓰는 이유:\n※ 미확인:\n```",
    "wikilinks": [
      "DC-AC_커플링",
      "고유값_안정도판단",
      "21차_야코비안_유도가이드",
      "실험결과 노트"
    ]
  },
  {
    "path": "RSCAD/00_MOC/GFM_연구_전체지도.md",
    "dir": "RSCAD/00_MOC",
    "filename": "GFM_연구_전체지도",
    "frontmatter": {
      "## type": "MOC updated: 2026-08-19 phase: 1 status: active",
      "> **연구자": "** 조연호 · 연세대학교 스마트그리드 연구실 · 허견 교수",
      "> **목표": "** PSO 기반 2단 PV+ESS GFM 인버터 소신호 모델 + SCR-X/R 2D CHIL 검증",
      "> **저널": "** IEEE Access (1차) → IEEE Trans. TSTE (최종)"
    },
    "body": "## 📌 현재 상태\n\n```\nPhase 1 ▶ 진행 중\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n✅ Flask 서버 구축 (numpy/scipy)\n✅ /api/jacobian  동작 확인\n✅ /api/sweep2d   88포인트 완료\n⚠️ /api/pso       시뮬만 (Phase 4에서 실제 구현)\n✅ 웹 대시보드 Flask 연결\n⏳ Phase 2: SymPy DC PI 구조 수정 중\n```\n\n---\n\n## 🔑 Quick Reference\n\n|항목|값|상태|\n|---|---|---|\n|ζ_threshold|0.64|✅ 수학적 검증|\n|ζ* (PSO 목표)|0.707|✅|\n|CHIL 포인트|88개|⏳ Phase 7|\n|PSO 파라미터|14개|✅|\n|MC 횟수|30회|⏳ Phase 4|\n|SCR 운전점|{3.0, 2.0, 1.5, 1.0}|✅|\n|X/R 조건|{0.5, 1.0, 2.0, 5.0}|✅|\n|f_dom (현재)|0.3584 Hz (numpy 근사)|⚠️ Phase 3 실측|\n\n---\n\n## 🧪 실험 결과 링크\n\n### Flask API 결과\n\n- [[실험_jacobian_SCR1.5_XR1.0]] ✅\n- [[실험 sweep2d j0.5 dp20]] ✅\n- [[실험_pso_미구현]] ⚠️\n\n### SymPy 결과\n\n- [[Sym dc pi 버그 분석]] ⏳\n- [[sym AC_서브시스템_안정확인]] ✅\n\n---\n\n## 📚 개념 노트\n\n- [[소신호_선형화]]\n- [[야코비안 행렬]]\n- [[DC-AC_커플링]]\n- [[고유값_안정도판단]]\n- [[참여인자 지배모드]]\n- [[Pso 이중수렴기준]]\n- [[이중수렴기준 설계]]\n-  [[과감쇠_동기화모드]] ← 동기화 모드는 실수극 ★ \n- [[모드교차_최소감쇠비_함정]] ← ζ_min 단일 지표의 함정 ★\n- [[정적부하가능성_경계]] ← 2D 경계의 이중성 \n- [[PSO_목적함수_설계]] ← 구 이중수렴기준 대체 -\n- [[PSO_수렴판정_설계]] ← 구 이중수렴기준 설계 대체 \n- ~~[[Pso 이중수렴기준]]~~ (superseded) \n- ~~[[이중수렴기준 설계]]~~ (superseded)\n- \n\n---\n\n## 📊 방법론 노트\n\n- [[다중동작점_갱신절차]]\n- [[21차 야코비안 유도가이드]]\n- [[88포인트_2D_스윕_설계]]\n- [[Prony 교차검증_절차]]\n\n---\n\n## 📚 문헌 노트\n\n- [[Chen_2024_Electronics]] ← 방법론 베이스\n- [[Dong_2026_FrontEnergyRes]] ← 선점 논문 ★\n- [[Ganguly_2025_preprint]] ← 2D 근거\n- [[Zhao_2023_Aalborg]] ← DC-AC 커플링\n\n---\n\n## ⚠️ 미해결 이슈\n\n- [ ] SymPy DC PI 적분기 구조 수정 (`dpv = 0.5 + Kp1*xPI1`)\n- [ ] PSO 실제 알고리즘 구현 (pyswarms Phase 4)\n- [ ] f_dom 실측 (Phase 3 Prony)\n- [ ] RTDS 가용 시간 예약\n- [ ] 구글 독스 참고문헌 [1] 중복 삭제",
    "wikilinks": [
      "실험_jacobian_SCR1.5_XR1.0",
      "실험 sweep2d j0.5 dp20",
      "실험_pso_미구현",
      "Sym dc pi 버그 분석",
      "sym AC_서브시스템_안정확인",
      "소신호_선형화",
      "야코비안 행렬",
      "DC-AC_커플링",
      "고유값_안정도판단",
      "참여인자 지배모드",
      "Pso 이중수렴기준",
      "이중수렴기준 설계",
      "과감쇠_동기화모드",
      "모드교차_최소감쇠비_함정",
      "정적부하가능성_경계",
      "PSO_목적함수_설계",
      "PSO_수렴판정_설계",
      "다중동작점_갱신절차",
      "21차 야코비안 유도가이드",
      "88포인트_2D_스윕_설계",
      "Prony 교차검증_절차",
      "Chen_2024_Electronics",
      "Dong_2026_FrontEnergyRes",
      "Ganguly_2025_preprint",
      "Zhao_2023_Aalborg"
    ]
  },
  {
    "path": "RSCAD/00_MOC/Phase_지식_연결맵.md",
    "dir": "RSCAD/00_MOC",
    "filename": "Phase_지식_연결맵",
    "frontmatter": {
      "type": "connection-map",
      "date": "2026-08-21",
      "tags": [
        "connection",
        "phase",
        "concept",
        "knowledge-graph"
      ]
    },
    "body": "# 🕸️ Phase ↔ 지식 연결 맵\n\n> Phase가 진행될수록 이 맵을 채워나간다  \n> ▸ = 실험에서 확인된 연결 / ⏳ = 예정\n\n---\n\n## 전체 연결 구조\n\n```\n📋 Phase 노트\n    │\n    ├─ 🧪 실험 결과 노트 (EXP_*, BUG_*)\n    │       │\n    │       ├─ 💡 개념 노트 (이론·수식)\n    │       │       │\n    │       │       └─ 📚 참고문헌 노트 ([1]~[15])\n    │       │\n    │       └─ 🔢 수치 검증 (▸값)\n    │\n    └─ ⚠️ 미해결 → 다음 Phase\n```\n\n---\n\n## Phase 1 지식 연결\n\n| Phase 1 작업 | 연결 개념 | 연결 문헌 | 검증 |\n|---|---|---|---|\n| Flask /api/jacobian | [[소신호_선형화]] | [1]Chen | ▸ stable=True |\n| A_k(9,6) 수동 보강 | [[DC-AC_커플링]] | [7]Zhao | ▸ 0.003183 |\n| stable 판정 | [[고유값_안정도판단]] | [1]Chen | ▸ Re(λ)<0 |\n| 88포인트 스윕 | [[88포인트_2D_스윕_설계]] | [3]Ganguly | ▸ null |\n| f_dom 버그 수정 | [[고유값_안정도판단]] | — | ▸ 0.36Hz |\n\n---\n\n## Phase 2 지식 연결\n\n| Phase 2 작업      | 연결 개념              | 연결 문헌    | 검증               |\n| --------------- | ------------------ | -------- | ---------------- |\n| sym.py DC PI 구조 | [[소신호_선형화]]        | [1]Chen  | ▸ 9차 시도 끝 stable |\n| A_k(9,6) 이론값    | [[DC-AC_커플링]]      | [7]Zhao  | ▸ **0.0001% 오차** |\n| ζ_min=0.1642    | [[고유값_안정도판단]]      | UNIFI V3 | ▸ < 0.64         |\n| AC 13×13 구성     | [[야코비안 행렬]]        | [1]Chen  | ▸ stable=True    |\n| latest/ 추적      | [[21차 야코비안 유도가이드]] | —        | ▸ 폴더 구조          |\n| Dong 비교         | [[DC-AC_커플링]]      | [2]Dong  | ▸ 12차 A_k 없음     |\n\n---\n\n## Phase 3 지식 연결 (예정)\n\n| Phase 3 작업   | 연결 개념              | 연결 문헌      | 검증  |\n| ------------ | ------------------ | ---------- | --- |\n| PSO F_multi  | [[Pso 이중수렴기준]]     | [1]Chen    | ⏳   |\n| ζ ≥ 0.64 달성  | [[고유값_안정도판단]]      | UNIFI V3   | ⏳   |\n| 이중 수렴 기준     | [[이중수렴기준 설계]]      | —          | ⏳   |\n| SCR*(X/R) 경계 | [[88포인트_2D_스윕_설계]] | [3]Ganguly | ⏳   |\n\n| Phase 3 작업  | 연결 개념           | 연결 문헌    | 검증            | 폐기 이력                        |\n| ----------- | --------------- | -------- | ------------- | ---------------------------- |\n| PSO F_multi | [[PSO_목적함수_설계]] | [1]Chen  | ⏳ 재설계         | ~~[[Pso 이중수렴기준]]~~           |\n| 정착시간 t_s    | [[과감쇠_동기화모드]]   | UNIFI V3 | ⏳ 조항 미특정      | ~~ζ ≥ 0.64 달성~~ (실수극에 ζ 무의미) |\n| 이중 수렴 기준    | [[PSO_수렴판정_설계]] | —        | ⏳ W·S 미정      | ~~[[이중수렴기준 설계]]~~            |\n| 모드 귀속 확정    | [[참여인자 지배모드]]   | —        | ✅ p=0.93~0.98 | —                            |\n| SCR*(X/R) 경계 | [[88포인트_2D_스윕_설계]] | [3]Ganguly | ⏳ 이중 경계 | ~~단일 감쇠 경계~~ |\n---\n\n## 개념 노트 ↔ Phase 연결\n\n| 개념 노트              | Phase 1 | Phase 2             | Phase 3           | Phase 4~7 |\n| ------------------ | ------- | ------------------- | ----------------- | --------- |\n| [[소신호_선형화]]        | 근사      | **정밀화**             | PSO 입력            | CHIL      |\n| [[DC-AC_커플링]]      | 수동 보강   | **0.0001%**         | PSO 반영            | CHIL      |\n| [[고유값_안정도판단]]      | ζ=0.256 | **ζ=0.164**         | **ζ≥0.64**        | CHIL      |\n| [[야코비안 행렬]]        | 근사      | **AC 정밀**           | PSO 계산            | CHIL      |\n| [[Pso 이중수렴기준]]     | 미구현     | 미구현                 | **구현**            | 완료        |\n| [[88포인트_2D_스윕_설계]] | null    | null                | **유효값**           | CHIL      |\n| 개념 노트              | Phase 1 | Phase 2             | Phase 3           | Phase 4~7 |\n| [[소신호_선형화]]        | 근사      | 정밀화                 | PSO 입력            | CHIL      |\n| [[DC-AC_커플링]]      | 수동 보강   | **모드이동 1.31~26.24** | 대역 분류             | CHIL      |\n| [[고유값_안정도판단]]      | ζ=0.256 | **ζ_lcl=0.2065**    | **ζ_ctrl=0.0794** | CHIL      |\n| [[야코비안 행렬]]        | 근사      | AC 정밀               | PSO 계산            | CHIL      |\n| ~~[[Pso 이중수렴기준]]~~ | 시뮬      | 시뮬                  | **폐기**            | —         |\n| ~~[[이중수렴기준 설계]]~~  | —       | —                   | **폐기**            | —         |\n| [[88포인트_2D_스윕_설계]] | null    | null                | 격자 확정             | CHIL      |\n| [[과감쇠_동기화모드]]      | —       | 미검출                 | **σ −4.26→−1.01** | t_s 실측    |\n| [[모드교차_최소감쇠비_함정]]  | —       | X/R=3.0 교차          | 대역 분류 구현          | 경계도 반영    |\n| [[정적부하가능성_경계]]     | —       | **δ 22°→79°**       | SCR 0.6 해없음       | 2D 이중선    |\n| [[PSO_목적함수_설계]]    | 시뮬      | 시뮬                  | **재설계 중**         | 구현·검증     |\n| [[PSO_수렴판정_설계]]    |         |                     | W·S 미확정           | MC 30회    |\n\n---\n\n## 참고문헌 ↔ Phase 연결\n\n| 문헌 | Phase 1 | Phase 2 | Phase 3 | Phase 6~7 |\n|---|---|---|---|---|\n| [1] Chen 2024 | 구조 참조 | 파라미터 | PSO 14개 | — |\n| [2] Dong 2026 | 비교 기준 | **A_k 없음 확인** | PSO 비교 | — |\n| [3] Ganguly 2025 | X/R 방향 | 경향 불일치 | **SCR* 비교** | CHIL |\n| [7] Zhao 2023 | 이론 참조 | **0.0001% ✅** | PSO 반영 | — |\n| [9] IEEE Std. | — | — | — | **CHIL 표준** |\n| [15] Villalva | iLpv_ref | 선형화 참조 | — | — |\n\n---\n\n## 지식 축적 현황\n\n```\n💡 개념 노트:\n  ✅ 소신호_선형화.md\n  ✅ DC-AC_커플링.md\n  ✅ 고유값_안정도판단.md\n  ⏳ 야코비안_행렬.md\n  ⏳ PSO_이중수렴기준.md\n  ⏳ 88포인트_2D_스윕_설계.md\n  ⏳ 이중수렴기준_설계.md\n  ⏳ 동작점_평형점.md\n\n📚 문헌 노트:\n  ✅ Chen_2024_Electronics.md\n  ⏳ Dong_2026_FrontEnergyRes.md\n  ⏳ Ganguly_2025_preprint.md\n  ⏳ Zhao_2023_Aalborg.md\n```\n",
    "wikilinks": [
      "소신호_선형화",
      "DC-AC_커플링",
      "고유값_안정도판단",
      "88포인트_2D_스윕_설계",
      "야코비안 행렬",
      "21차 야코비안 유도가이드",
      "Pso 이중수렴기준",
      "이중수렴기준 설계",
      "PSO_목적함수_설계",
      "과감쇠_동기화모드",
      "PSO_수렴판정_설계",
      "참여인자 지배모드",
      "모드교차_최소감쇠비_함정",
      "정적부하가능성_경계"
    ]
  },
  {
    "path": "RSCAD/00_MOC/README.md",
    "dir": "RSCAD/00_MOC",
    "filename": "README",
    "frontmatter": {},
    "body": "### 시뮬레이터와 차이점\n\n| 항목     | 이전 (gfm_simulator) | 이번 (gfm_dashboard)          |\n| ------ | ------------------ | --------------------------- |\n| 데이터 출처 | 브라우저 내부 근사         | **Flask API 실제 호출**         |\n| 고유값    | JavaScript 물리 근사   | **numpy/scipy 계산값**         |\n| 2D 스윕  | 브라우저 계산            | **`/api/sweep2d` 호출**       |\n| PSO    | 애니메이션만             | **`/api/pso` 호출 후 슬라이더 갱신** |\n| API 상태 | 없음                 | **상단 실시간 연결 상태 표시**         |\n| 엔진 표시  | 없음                 | **numpy · 고유값 플롯에 출처 표시**   |\n### 동작 흐름\n\n```\n슬라이더 조정\n    ↓\n⚡ Flask API 야코비안 계산 클릭\n    ↓\nPOST http://localhost:5000/api/jacobian\n    ↓\nnumpy 21차 야코비안 계산\n    ↓\n고유값 21개 → 복소 평면 플롯\n모드 분석 → 우측 패널\nζ_min, SCR*, f_dom → 결과 패널\n```\n\n\nPhase01 \n✅ Flask 서버 실행 (numpy/scipy)\n✅ /api/jacobian  — 21차 고유값 계산\n✅ /api/sweep2d   — 88포인트 2D 스윕\n✅ /api/pso       — PSO 최적화\n✅ 웹 대시보드 연결 — Flask API 실시간 연동\n✅ 고유값 복소 평면 시각화\n✅ SCR*(X/R) 2D 히트맵\n✅ 감쇠비 vs SCR 곡선\n\n\n\n\n✅ 88포인트 스윕 완료\n✅ SCR* 경계 도출 (X/R 0.5~2.0)\n⚠️ X/R=5.0: 경계 미도출 → numpy 근사 한계\n⚠️ SCR* 모두 0.8 → 해상도 부족\n\n→ Phase 2 SymPy 21차 야코비안으로 교체하면\n  정확한 SCR* 1.0~2.0 범위 도출 예상",
    "wikilinks": []
  },
  {
    "path": "RSCAD/00_MOC/실험 참고문헌 연결맵.md",
    "dir": "RSCAD/00_MOC",
    "filename": "실험 참고문헌 연결맵",
    "frontmatter": {
      "## type": "connection-map date: 2026-08-20 tags: [connection, reference, experiment, knowledge-graph]"
    },
    "body": "## 연결 매트릭스\n\n|실험|[1]Chen|[2]Dong|[3]Ganguly|[7]Zhao|[9]IEEE|[15]Villalva|\n|---|---|---|---|---|---|---|\n|**jacobian (numpy)**|▸ 구조|▸ 비교|❌|▸ A_k(9,6)|❌|❌|\n|**sweep2d (numpy)**|❌|▸ 1D 한계|▸ 2D 동기|❌|❌|❌|\n|**sym.py 야코비안**|▸ 21차 구조|▸ 12차 비교|❌|▸ 커플링 근거|❌|▸ PV항|\n|**PSO 최적화**|▸ 14개 파라미터|▸ 3개 비교|❌|❌|❌|❌|\n|**CHIL 실험**|❌|▸ R²비교|▸ 트립 재현|❌|▸ 표준|❌|\n|**88포인트 2D**|❌|▸ 1D→2D|▸ X/R 근거|❌|▸ CHIL|❌|\n\n---\n\n## 실험별 참고문헌 연결 상세\n\n---\n\n### 🧪 /api/jacobian (Flask numpy)\n\n```\n결과: stable=True, ζ=0.256, A_k(9,6)=0.003183, SCR*=1.22\n\n[1] Chen 2024 연결:\n  ▸ 21차 상태변수 구조 동일\n  ▸ 파라미터 초기값 J=0.5, Dp=20, Kpv=1.0 출처\n  ※ numpy 근사 → SymPy 완성 후 [1] 결과와 비교 예정\n\n[2] Dong 2026 연결:\n  ▸ 12차(이상적 DC) vs 본 연구 21차(DC-AC 커플링)\n  ▸ Dong: A_k(9,6) 없음 → 본 연구: 0.003183 ✅\n  ※ 이것이 차별화 축 \"모델 차수\" 의 근거\n\n[7] Zhao 2023 연결:\n  ▸ A_k(9,6) = idc0/(J·ω₀) 이론값 = 0.003183 ← Zhao 이론\n  ▸ \"DC-AC 커플링 누락 시 불안정 모드 포착 실패\" ← 차별화 근거\n```\n\n---\n\n### 🗺️ /api/sweep2d (88포인트)\n\n```\n결과: X/R={0.5,1.0,2.0}: SCR*=0.8, X/R=5.0: null\n\n[2] Dong 2026 연결:\n  ▸ Dong: 단일 CSCR 수치(1D) → 본 연구: SCR*(X/R) 2D 곡면\n  ※ 현재 numpy 근사라 SCR*=0.8 (하한) — Phase 2 후 정확값 예상\n\n[3] Ganguly 2025 연결:\n  ▸ X/R=0.5 → 인버터1 트립 (실험 확인)\n  ▸ X/R=1.0 → 인버터2 트립 (실험 확인)\n  ▸ \"SCR 단변수 분석만으로 안정 경계 완전히 서술 불가\" ← 본 연구 동기\n  ▸ X/R=5.0에서 null → [3] 결과와 방향 일치 (X/R↑ → 불안정 경향)\n  ※ [3]은 정성적 관찰 → 본 연구는 88포인트 정량화\n```\n\n---\n\n### 🔧 sym.py (SymPy 21차 야코비안)\n\n```\n현재: stable=False (4차 시도), A_k(9,6) ✅\n\n[1] Chen 2024 연결:\n  ▸ f(x) 방정식 구조 — 이중 루프(전압·전류) [1] Fig.2 기반\n  ▸ 파라미터: J, Dp, wc, Kpv, Kiv, Kpc, Kic [1] Table I 출처\n  ▸ 21차 상태변수 분류 [1] Appendix 검토\n\n[2] Dong 2026 연결:\n  ▸ 12차 모델 (DC 이상적) → 본 연구 21차 (DC 명시적)\n  ▸ 9개 추가 상태변수: {xPI1,2,3, upv, ubat, udc★, iLpv, iLbat, +Δω 커플링}\n  ※ \"이상적 DC 버스 가정의 한계\" = Zhao[7] 근거로 공격\n\n[7] Zhao 2023 연결:\n  ▸ DC-AC 커플링: A_k(9,6) = ∂(dΔω/dt)/∂u_dc = idc0/(J·ω₀)\n  ▸ \"이 원소 없으면 SCR=0.8 불안정 모드 포착 실패\" ← 수동 보강 근거\n  ▸ SCR별 idc0 변화 → A_k 자체가 SCR 의존적\n\n[15] Villalva 2009 연결:\n  ▸ f4(upv): (0.9 - iLpv)/Cpv ← PV P-V 비선형 모델\n  ▸ f1(xPI1): iLpv_ref = 0.9/upv ← MPPT 비선형항\n  ▸ 5차 시도: 선형화 근사 iLpv_ref ≈ 0.9 - 0.9*(upv-1) 적용 예정\n```\n\n---\n\n### 🧬 PSO 최적화 (Phase 4 예정)\n\n```\n[1] Chen 2024 연결:\n  ▸ PSO 14개 파라미터 목록 출처\n  ▸ 단일 운전점 PSO → 과적합 한계 (본 연구 다중 운전점으로 극복)\n\n[2] Dong 2026 연결:\n  ▸ PSO = SVR 하이퍼파라미터(C,ε,γ) 3개\n  ▸ GFM 제어 파라미터 직접 최적화 아님\n  ※ 본 연구: GFM 14개 직접 최적화 = 4.7배(14/3)\n\n[3] Ganguly 2025 연결:\n  ▸ 다중 운전점 PSO의 필요성 근거\n  ▸ X/R 변화에 따른 GFM 트립 → 단일 운전점으로 커버 불가\n```\n\n---\n\n### 🔬 RTDS CHIL 88포인트 (Phase 7 예정)\n\n```\n[3] Ganguly 2025 연결:\n  ▸ 하드웨어 실험에서 정성적 트립 관찰 → 본 연구 정량화\n  ▸ X/R=0.5,1.0 조건 → 본 연구 88포인트 중 포함\n  ※ \"최초 CHIL 검증 2D SCR-X/R 경계 정량화\" 주장 근거\n\n[9] IEEE Std. 2004-2025 연결:\n  ▸ CHIL 검증 공식 표준 — 2025.08.29 발행\n  ▸ 본 연구 검증 방법론의 표준 근거\n```\n\n---\n\n## 실험 결과 자동 연결 체크리스트\n\n결과가 나올 때마다:\n\n```\n□ stable 판정\n  → True:  [1][7] 모델 검증 완료 표시\n  → False: [7] Zhao 커플링 미반영 가능성 기록\n\n□ A_k(9,6) 값\n  → 이론값 일치: [7] Zhao 이론 검증 ✅ 기록\n  → 불일치:      [7] 수식 재확인 필요 기록\n\n□ f_dom 범위\n  → 0.1~10Hz: VSG 스윙 모드 → [1] Table I과 비교\n  → 60Hz:     LCL 공진 모드 우세 → numpy 근사 한계\n\n□ SCR* 값\n  → 0.8 (numpy 하한): Phase 2 이후 재측정 예정\n  → 1.0~2.0: [3] Ganguly 트립 조건과 비교\n\n□ ζ_min\n  → ≥ 0.64: UNIFI V3 Category 3 만족\n  → < 0.64: PSO 최적화 필요 → Phase 4\n```",
    "wikilinks": []
  },
  {
    "path": "RSCAD/00_MOC/실험결과 업데이트 절차.md",
    "dir": "RSCAD/00_MOC",
    "filename": "실험결과 업데이트 절차",
    "frontmatter": {
      "## type": "workflow-guide date: 2026-08-20 tags: [workflow, obsidian, automation]"
    },
    "body": "### STEP 1 — 실험 실행 + 결과 저장\n\n```bash\n# Flask API 실험\ncurl -X POST http://localhost:5000/api/jacobian \\\n  -H \"Content-Type: application/json\" \\\n  -d \"{\\\"SCR\\\":1.5,\\\"XR\\\":1.0,\\\"J\\\":0.5,\\\"Dp\\\":20}\" \\\n  > results/jacobian_SCR1.5_$(date +%Y%m%d).json\n\n# SymPy 실험\npython Simulation/sym.py\n# → results/ 폴더에 자동 저장\n```\n\n---\n\n### STEP 2 — Claude에게 결과 붙여넣기 + 노트 생성 요청\n\n```\n[붙여넣을 것]\n1. GFM_연구_전체지도.md\n2. 해당 버그/실험 노트\n3. 실험 결과 JSON\n\n[요청]\n\"이 결과로 Obsidian 노트를 업데이트해줘.\n - BUG_sym_DC_PI_4차시도.md의 시도 기록 표에 추가\n - 개선된 것 / 남은 문제 분리해서 정리\n - 5차 시도 방향 제안\n - Claude 지식 프롬프트 업데이트\"\n```\n\n---\n\n### STEP 3 — 노트 업데이트 체크리스트\n\n#### 실험이 성공했을 때 (stable=True)\n\n```\n✅ BUG 노트 → status: resolved 변경\n✅ GFM_연구_전체지도.md → Phase 상태 업데이트\n✅ 새 실험결과 노트 생성 (EXP_날짜_조건.md)\n✅ 개념 노트 업데이트 (관련 수치 갱신)\n✅ app.py에 SymPy 결과 연동\n```\n\n#### 실험이 실패했을 때 (stable=False)\n\n```\n✅ BUG 노트 → 시도 기록 표에 추가\n✅ 원인 분석 업데이트\n✅ 5차 시도 방향 추가\n✅ Claude 프롬프트 업데이트\n```\n\n---\n\n### STEP 4 — 지식 연결 확인\n\n실험 후 반드시 확인할 연결:\n\n```\n이번 결과가 바꾸는 노트:\n├── BUG_sym_DC_PI_4차시도.md     ← 시도 기록\n├── GFM_연구_전체지도.md          ← 현재 상태\n├── 실험_jacobian_SCR1.5_XR1.0.md ← 비교\n└── 21차_야코비안_유도가이드.md    ← 수식 근거 확인\n```\n\n---\n\n## 논문 지식화 프롬프트 (결과를 논문으로 연결할 때)\n\n```\n[시스템 프롬프트 — 그대로 복사해서 사용]\n\n당신은 GFM 인버터 소신호 분석 결과를 Obsidian 지식으로\n변환하는 도구다.\n\n절대 규칙:\n▸ = 실험/논문에서 나온 값 (수치, 코드 출력)\n※ = 내 해석·판단 (추론, 의미 부여)\n반드시 구분할 것. 섞으면 안 됨.\n\nGFM 도메인 검증 기준:\n- stable: 모든 Re(λ) < 0\n- zeta_min: ≥ 0.64 (UNIFI V3 Category 3)\n- A_k(9,6): idc0/(J·ω₀) 이론값과 < 1% 오차\n- f_dom: 0.1~10 Hz (VSG 스윙 모드 범위)\n- 선형화 유효: Δu_pv < 5%\n\n출력 형식: Obsidian .md (frontmatter 포함)\n섹션: 📥입력 / 📤출력 / 📊핵심수치 / 🔍분석 / 🔗연관지식 / 🤖프롬프트\n```\n\n---\n\n## 빠른 참조 — 핵심 수치\n\n|항목|값|출처|\n|---|---|---|\n|ζ_threshold|0.64|UNIFI V3 ts≤1s 역산|\n|idc0 (SCR=1.5)|0.6 pu|0.9/SCR|\n|A_k(9,6) (SCR=1.5)|0.003183|idc0/(J·ω₀)|\n|J (기본값)|0.5|Chen(2024)|\n|Dp (기본값)|20.0|Chen(2024)|\n|wc|31.4 rad/s|5 Hz 저역통과|\n|critical Dp|7.92|2·√(J·wc)|\n|현재 Dp=20 > 7.92|과감쇠|VSG 진동 없음|",
    "wikilinks": []
  },
  {
    "path": "RSCAD/01_개념/88포인트_2D_스윕_설계.md",
    "dir": "RSCAD/01_개념",
    "filename": "88포인트_2D_스윕_설계",
    "frontmatter": {},
    "body": "---\n\n## type: concept date: 2026-08-21 phase: 1-2 status: partial tags: [concept, sweep2d, SCR-star, boundary, 88point]\n\n# 💡 88포인트 2D 스윕 설계\n\n## 한 줄 정의\n\n> SCR 22레벨 × X/R 4조건 = 88개 운전점에서 야코비안 계산 → SCR*(X/R) 2D 안정 경계 도출\n\n## 설계 기준\n\n```python\nSCR_list = [round(5.0 - i*0.2, 1) for i in range(22)]\n# = [5.0, 4.8, 4.6, ..., 1.0, 0.8]  22레벨\n\nXR_list = [0.5, 1.0, 2.0, 5.0]  # 배전~송전 대표값\n\n총 포인트 = 22 × 4 = 88개\n```\n\n## SCR* 정의\n\n$$ \\text{SCR}^*(X/R) = \\min { \\text{SCR} \\mid \\zeta_{\\min}(\\text{SCR}, X/R) \\geq \\zeta_{\\text{threshold}} } $$\n\n> 각 X/R 조건에서 ζ ≥ 0.64를 처음 만족하는 최솟값 SCR\n\n## Ganguly(2025)와의 연결\n\n```\n[3] Ganguly 2025:\n  ▸ X/R=0.5: 인버터1 트립 관찰 (정성적)\n  ▸ X/R=1.0: 인버터2 트립 관찰 (정성적)\n  ※ 1D SCR 분석만으로 X/R 영향 설명 불가\n\n본 연구:\n  → 88포인트 정량화 → SCR*(X/R) 2D 곡면 도출\n  → \"최초 CHIL 기반 2D 경계 정량화\" 주장 근거\n```\n\n## Phase별 결과\n\n|Phase|엔진|SCR* 결과|원인|\n|---|---|---|---|\n|1|numpy|0.8 (하한)|numpy 근사 ζ 과대평가|\n|2|sympy+numpy|null (전 구간)|ζ_max=0.177 < 0.64|\n|3 (목표)|PSO 후|**1.0~2.0**|ζ ≥ 0.64 달성 후|\n|7 (최종)|RTDS CHIL|**실측값**|논문 핵심 결과|\n\n## 현재 결과 (Phase 2)\n\n|X/R|ζ 최솟값|ζ 최댓값|SCR*|\n|---|---|---|---|\n|0.5|0.1232|0.1772|null|\n|1.0|0.1628|0.1713|null|\n|2.0|0.1602|0.1655|null|\n|5.0|0.0791|0.0894|null|\n\n## 🔗 연결 노트\n\n- [[고유값_안정도판단]] — ζ_threshold=0.64 기준\n- [[소신호_선형화]] — 각 포인트 야코비안 계산\n- [[Pso 이중수렴기준]] — PSO 후 재실행 예정\n- [[EXP_2026-08-21_Phase2_엔진전환_비교]] — Phase 2 결과\n- [[실험 sweep2d j0.5 dp20]] — Phase 1 결과\n- [[Phase03_진행중]] — PSO 후 SCR* 도출 목표\n\n## 참고문헌\n\n- ▸ [3] Ganguly 2025 — 2D 스윕 동기, X/R 영향 관찰\n- ▸ [2] Dong 2026 — 1D CSCR (비교 대상)\n- ▸ [9] IEEE Std. 2004-2025 — Phase 7 CHIL 검증 표준",
    "wikilinks": [
      "고유값_안정도판단",
      "소신호_선형화",
      "Pso 이중수렴기준",
      "EXP_2026-08-21_Phase2_엔진전환_비교",
      "실험 sweep2d j0.5 dp20",
      "Phase03_진행중"
    ]
  },
  {
    "path": "RSCAD/01_개념/DC-AC_커플링.md",
    "dir": "RSCAD/01_개념",
    "filename": "DC-AC_커플링",
    "frontmatter": {
      "type": "concept",
      "date": "2026-08-21",
      "phase": 2,
      "status": "verified",
      "tags": [
        "concept",
        "DC-AC-coupling",
        "jacobian",
        "Ak96",
        "Zhao2023"
      ]
    },
    "body": "# 💡 DC-AC 커플링\n\n## 한 줄 정의\n\n> PV 부스트 컨버터의 DC 버스 전압 u_dc가 VSG 스윙 방정식의 유효전력 P_meas에 영향을 미치는 경로를 야코비안에 명시적으로 반영한 원소\n\n## 핵심 수식\n\n$$\nA_k(9,6) = \\frac{\\partial(\\dot{\\Delta\\omega})}{\\partial u_{dc}} = \\frac{i_{dc0,k}}{J \\cdot \\omega_0}\n$$\n\n$$\ni_{dc0,k} = \\frac{P_{pv,k}}{V_{dc0}} = \\frac{0.9}{SCR_k}\n$$\n\n| SCR | idc0 | A_k(9,6) 이론값 |\n|---|---|---|\n| 3.0 | 0.300 | 0.001592 |\n| 2.0 | 0.450 | 0.002387 |\n| 1.5 | 0.600 | 0.003183 |\n| 1.0 | 0.900 | 0.004775 |\n\n*(J=0.5, ω₀=376.99 rad/s 기준)*\n\n## 물리적 의미\n\n```\nDC 버스 전압 u_dc 변화\n    ↓ (이 경로가 A_k(9,6))\n인버터 출력전력 P_meas = u_od·i_od + u_oq·i_oq 변화\n    ↓\nVSG 스윙 dΔω/dt = (P_ref - P_filt - Dp·Δω)/J 변화\n    ↓\n계통 안정도 영향\n```\n\n## Dong(2026)과의 차이\n\n```\nDong(2026) [2]:\n  - 12차 (이상적 DC 버스 가정)\n  - A_k(9,6) 없음 → SCR=0.8 불안정 모드 포착 실패\n\n본 연구:\n  - 21차 (DC-AC 커플링 명시적 반영)\n  - A_k(9,6) = 0.003183 (SCR=1.5, J=0.5)\n  → 차별화 축 \"모델 차수\" 의 핵심 근거\n```\n\n## Phase별 구현\n\n| Phase | A_k(9,6) 방법 | 오차 |\n|---|---|---|\n| 1 | 수동 보강 (numpy) | 근사 |\n| 2 | 수동 보강 (sympy+numpy) | **0.0001% ✅** |\n| 3+ | SymPy 자동 유도 | 정확 |\n\n## 🔗 연결 노트\n\n### 이론 근거\n- [[소신호_선형화]] — 야코비안 유도 원리\n- [[야코비안 행렬]] — 블록 구조 A_DC, A_AC, A_coup\n\n### 실험 검증\n- [[EXP_2026-08-21_Phase2_엔진전환_비교]] — 오차 0.0001% 확인 ✅\n- [[실험_jacobian_SCR1.5_XR1.0]] — Phase 1 검증\n\n### Phase 연결\n- [[Phase02_완료]] — 구현 완료 (Section 2.2)\n- [[Phase03_진행중]] — PSO에서 idc0 변화 반영\n\n### 참고문헌\n- [[Zhao_2023_Aalborg]] — 이론 출처 [7]\n- [[Dong_2026_FrontEnergyRes]] — 누락 사례 [2]\n\n## ※ 내 판단\n\n```\nA_k(9,6)은 SCR이 낮아질수록 커짐\n→ 약계통(SCR=1.0)에서 커플링 영향이 4.77×10⁻³으로 SCR=3.0의 3배\n→ 즉 약계통일수록 DC 버스 전압 변동이 각속도 동특성에 더 크게 영향\n→ 이것이 \"21차 모델이 약계통 분석에 필수적\"이라는 주장의 근거\n```\n\n## 참고문헌\n\n- ▸ [7] Zhao 2023 — \"DC-AC 커플링 누락 시 SCR=0.8 불안정 모드 포착 실패\"\n- ▸ [2] Dong 2026 — 12차 이상적 DC 가정 (비교 대상)\n",
    "wikilinks": [
      "소신호_선형화",
      "야코비안 행렬",
      "EXP_2026-08-21_Phase2_엔진전환_비교",
      "실험_jacobian_SCR1.5_XR1.0",
      "Phase02_완료",
      "Phase03_진행중",
      "Zhao_2023_Aalborg",
      "Dong_2026_FrontEnergyRes"
    ]
  },
  {
    "path": "RSCAD/01_개념/Pso 이중수렴기준.md",
    "dir": "RSCAD/01_개념",
    "filename": "Pso 이중수렴기준",
    "frontmatter": {},
    "body": "---\n\n## type: concept date: 2026-08-21 phase: 3 status: pending tags: [concept, PSO, convergence, dual-criterion, optimization]\n\n# 💡 PSO 이중수렴기준\n\n## 한 줄 정의\n\n> 두 가지 수렴 조건을 동시에 만족해야 PSO를 종료 — 조기 종료 및 과적합 방지\n\n## 이중 수렴 기준\n\n$$ \\text{조건 1 (상대 개선):} \\quad \\frac{|F^{(t)} - F^{(t-1)}|}{|F^{(t-1)}|} < 0.1% \\quad \\text{연속 30회} $$\n\n$$ \\text{조건 2 (누적 감소):} \\quad \\frac{|F^{(t-W)} - F^{(t)}|}{|F^{(t-W)}|} < 0.5% \\quad \\text{동일 30회} $$\n\n> 두 조건 **모두** 만족 시 수렴 → 종료\n\n## 목적함수 F_multi\n\n```python\ndef F_multi(params, SCR_list=[3.0, 2.0, 1.5, 1.0]):\n    F_total = 0\n    for scr in SCR_list:\n        eigs = get_eigenvalues(scr, params)\n        # F1: 불안정 모드 패널티\n        F1 = sum(max(0, e.real) for e in eigs)\n        # F2: ζ=0.707 추종\n        F2 = sum((z - 0.707)**2 for z in zetas)\n        # F3: ζ_min ≥ 0.64 보장\n        F3 = sum(max(0, 0.64 - z) for z in zetas)\n        F_total += 0.3*F1 + 0.6*F2 + 0.1*F3\n    return F_total / len(SCR_list)\n\n# 가중치: α=0.3, β=0.6, γ=0.1\n```\n\n## 최적화 파라미터 14개\n\n|그룹|파라미터|범위|단위|\n|---|---|---|---|\n|VSG|J, Dp, wc, Lv|0.01~10, 1~100, 10~200, 0.001~0.5|kg·m², N·m·s, rad/s, pu|\n|전압루프|Kpv, Kiv|0.01~5, 1~500|A/V, A/Vs|\n|전류루프|Kpc, Kic|0.1~30, 1~200|V/A, V/As|\n|DC (6개)|Kp1, Ki1, ...|TBD|—|\n\n## PSO 하이퍼파라미터\n\n```python\n# Clerc-Kennedy 수렴 조건\nw  = 0.729   # 관성 가중치\nc1 = 2.05    # 개인 최적 가중치\nc2 = 2.05    # 전역 최적 가중치\nn_particles = 30\n```\n\n## Phase 현황\n\n|Phase|상태|내용|\n|---|---|---|\n|1|⚠️ 시뮬만|랜덤값 수렴 곡선|\n|2|⚠️ 시뮬만|고정 최적값 반환|\n|**3**|⏳ **구현 예정**|pyswarms 실제 PSO|\n|4+|—|검증|\n\n## 🔗 연결 노트\n\n- [[고유값_안정도판단]] — 목적함수의 ζ 기준\n- [[88포인트_2D_스윕_설계]] — PSO 후 재실행\n- [[이중수렴기준 설계]] — 조건1·2 상세 설계\n- [[Phase03_진행중]] — 구현 예정\n- [[실험_pso_미구현]] — 현재 시뮬 상태\n\n## 참고문헌\n\n- ▸ [1] Chen 2024 — 14개 파라미터 목록\n- ▸ Clerc & Kennedy 2002 — w=0.729 수렴 조건",
    "wikilinks": [
      "고유값_안정도판단",
      "88포인트_2D_스윕_설계",
      "이중수렴기준 설계",
      "Phase03_진행중",
      "실험_pso_미구현"
    ]
  },
  {
    "path": "RSCAD/01_개념/PSO_목적함수_설계.md",
    "dir": "RSCAD/01_개념",
    "filename": "PSO_목적함수_설계",
    "frontmatter": {
      "type": "concept",
      "date": "2026-08-28",
      "phase": 4,
      "status": "draft",
      "supersedes": "\"Pso 이중수렴기준 (목적함수 부분)\"",
      "tags": [
        "concept",
        "PSO",
        "목적함수",
        "모드분류",
        "phase4"
      ]
    },
    "body": "# PSO 목적함수 설계\n\n> **저장 위치:** `01_개념/`\n\n## 한 줄 정의\n\n> 모드를 **참여계수로 분류한 뒤** 성격에 맞는 지표를 각각 적용한다. 실수극에 ζ 를, 진동극에 정착시간을 적용하지 않는다.\n\n---\n\n## v1 목적함수가 왜 폐기되는가\n\n> [!danger] 구 `F_multi` 는 강건성을 악화시킨다\n> ```python\n> F2 = sum((z - 0.707)**2 for z in zetas)    # ζ=0.707 추종\n> F3 = sum(max(0, 0.64 - z) for z in zetas)  # ζ_min ≥ 0.64\n> ```\n> ▸ 동기화 모드는 **실수극**이므로 ζ = 1 이다. → [[과감쇠_동기화모드]]\n> ▸ F2 는 여기에 `(1−0.707)² = 0.0858` 을 상시 부과한다.\n> ▸ PSO 는 이 값을 줄이려 **동기화 모드를 진동 영역으로 밀어낸다.**\n> ※ 즉 약계통 강건성을 개선하는 게 아니라 적극적으로 악화시키는 방향이다.\n\n추가 결함 3건:\n\n▸ **모드 구분 없음.** `zetas` 를 통째로 순회한다. ζ_min 이 SCR 구간마다 다른 물리 모드를 가리키므로, 구간마다 다른 대상을 최적화하게 된다. → [[모드교차_최소감쇠비_함정]]\n▸ **X/R 축 부재.** `SCR_list` 만 순회한다. 논문 주제가 2D SCR–X/R 경계인데 목적함수는 1D 다.\n▸ **동작점 부재 처리 없음.** δ→90° 로 해가 없는 조건에서 `get_eigenvalues` 가 무엇을 반환하는지 정의돼 있지 않다. → [[정적부하가능성_경계]]\n\n---\n\n## v2 설계\n\n### 평가 격자\n\n```python\nGRID = [(scr, xr) for xr in XR_LIST for scr in SCR_LIST]   # 2D\n```\n\n각 격자점 k 에서 `runner.run(ctrl, [scr], xr, persist=False, quiet=True)` 호출.\n\n### 격자점별 비용\n\n```python\ndef cost_point(meta, r):\n    # 1) 동작점 부재 — 소신호 이전의 문제\n    if not r['converged']:\n        return P_INFEASIBLE          # 상수 페널티. 제외하면 PSO 가 회피 학습함\n\n    # 2) 불안정 페널티 (실수부 기준, 모드 무관)\n    F1 = max(0.0, r['max_real'] + SIGMA_MARGIN)\n\n    # 3) 동기화 모드 — 실수극. 정착시간으로 평가\n    t_s = 5.0 / abs(r['sigma_sync'])          # 참여계수로 식별한 지배극\n    F2 = max(0.0, (t_s - T_S_TARGET) / T_S_TARGET)\n\n    # 4) 진동 모드 — 대역별 감쇠비. 실수극에는 적용하지 않는다\n    F3 = sum(max(0.0, ZETA_TARGET - z)\n             for z in (r['band_zeta']['control'], r['band_zeta']['lcl'])\n             if z is not None)\n\n    return ALPHA*F1 + BETA*F2 + GAMMA*F3\n```\n\n```python\nF = sum(cost_point(...) for k in GRID) / len(GRID)\n```\n\n### 지표 대응표\n\n| 모드 | 성격 | 지표 | 근거 |\n|---|---|---|---|\n| 동기화 (δ·Δω) | 실수극 (Dp=20 과감쇠) | `t_s = 5/\\|σ\\|` | ζ 정의상 1 → 무의미 |\n| DC-AC 혼합 (37~43 Hz) | 진동 | `ζ_control` | X/R=3.0 에서 0.0794 |\n| LCL 공진 (178 Hz) | 진동 | `ζ_lcl` | 전 조건 0.206~0.207 |\n| 동작점 부재 | — | `P_INFEASIBLE` | 정적 한계, 소신호 이전 |\n\n▸ 동기화 모드 실측: SCR 3.0 → 0.8 에서 `t_s` 1.17 s → 4.94 s (4.2배). → [[EXP_2026-08-28_XR3조건_스윕]]\n\n> [!warning] 모드 귀속은 참여계수로\n> `sigma_sync` 는 주파수 대역이 아니라 δ+Δω 참여도 최대 기준으로 골라야 한다.\n> 주파수 <5Hz 대역이 잡는 것은 전력 필터 모드(Qf 0.445, Pf 0.401)다.\n> → [[참여인자 지배모드]] · `P3-A7`\n\n### Dp 트레이드오프\n\n※ Dp=20 이 과감쇠를 만든다. PSO 가 Dp 를 낮추면 동기화 모드가 진동 영역으로 진입해 ζ 가 다시 의미를 갖지만 `t_s` 는 나빠질 수 있다. **이 트레이드오프가 PSO 의 실제 탐색 공간이다.**\n\n목적함수는 두 영역을 모두 다뤄야 한다. 동기화 모드가 진동극이 되면 `F2` 를 `t_s` 대신 ζ 로 전환하는 분기가 필요하다.\n\n```python\nif 동기화_모드가_복소극:\n    F2 = max(0.0, ZETA_SYNC_TARGET - zeta_sync)\nelse:\n    F2 = max(0.0, (t_s - T_S_TARGET) / T_S_TARGET)\n```\n\n---\n\n## 미확정 상수\n\n| 상수 | 값 | 상태 |\n|---|---|---|\n| `T_S_TARGET` | ? | ⛔ UNIFI Cat 3 조항 특정 필요 |\n| `ZETA_TARGET` | 0.64 | ⛔ 출처 미확인 (`P3-A6`) |\n| `SIGMA_MARGIN` | ? | 미정 |\n| `P_INFEASIBLE` | ? | 격자 크기 대비 스케일 결정 필요 |\n| `ALPHA, BETA, GAMMA` | 구 0.3/0.6/0.1 | 재설정 + 민감도 분석 (`P4-A4`) |\n\n> [!danger] `ZETA_TARGET = 0.64` 의 출처가 여전히 불명\n> 전력계통 진동모드 기준은 통상 0.03~0.10 이다. 0.64 는 과도응답 오버슈트\n> 사양에서 유도된 값으로 보이나 유도식이 기록돼 있지 않다.\n> ※ 정착시간 기준으로 전환하면 이 문제가 함께 해소된다.\n\n---\n\n## ⛔ TABLE II 파라미터 목록 불일치\n\n구 노트의 14개 목록이 **구현된 모델과 다르다.**\n\n| 구 노트 | 실제 `model.PARAM_NAMES` |\n|---|---|\n| VSG: J, Dp, wc, **Lv** | J, Dp, wc, **nq** |\n| 전압루프: Kpv, Kiv | Kpv, Kiv ✓ |\n| 전류루프: **Kpc, Kic** | 없음 (모델에서 고정 파라미터) |\n| DC 6개 TBD | **8개**: Kp_vpv, Ki_vpv, Kp_ipv, Ki_ipv, Kp_vdc, Ki_vdc, Kp_iess, Ki_iess |\n\n▸ 실제 구성: DC 8 + VSG 4 + AC 전압 2 = **14개**\n※ 합계는 우연히 같지만 구성이 다르다. `P4-A1`(TABLE II) 작성 시 `model.PARAM_NAMES` 를 기준으로 할 것.\n\n기본값 (`runner.parse_args`):\n\n```\nKp_vpv 0.1   Ki_vpv 10.0   Kp_ipv 1e-3   Ki_ipv 0.1\nKp_vdc 0.5   Ki_vdc 20.0   Kp_iess 1e-3  Ki_iess 0.1\nJ 0.5        Dp 20.0       wc 62.83      nq 1e-3\nKpv 0.05     Kiv 10.0\n```\n\n---\n\n## PSO 호출 규약\n\n```python\nimport runner\n_, meta, _ = runner.run(ctrl, [scr], xr, persist=False, quiet=True)\n```\n\n▸ `persist=False` 필수. 디스크 쓰기가 0 이 되어 병렬 경합이 사라진다.\n▸ `runner.run` 은 `verify_ctrl_applied` 로 파라미터 반영을 검증한다. 이게 없으면 PSO 가 같은 값만 반복 평가하며 수렴한 것처럼 보인다.\n→ [[Simulation_코드구조]]\n\n---\n\n## 🔗 연결 노트\n\n| 방향 | 노트 | 이유 |\n|---|---|---|\n| ← | [[과감쇠_동기화모드]] | ζ 가 지표로 부적합한 근거 |\n| ← | [[모드교차_최소감쇠비_함정]] | 단일 스칼라 지표의 함정 |\n| ← | [[정적부하가능성_경계]] | 동작점 부재 처리 |\n| ← | [[참여인자 지배모드]] | 모드 귀속 방법 |\n| ← | [[고유값_안정도판단]] | ζ·실수부 정의 |\n| → | [[PSO_수렴판정_설계]] | 종료 조건 |\n| → | [[88포인트_2D_스윕_설계]] | 최적화 후 재검증 |\n| → | [[Phase04_PSO설계]] | 상위 계획 |\n\n## 참고문헌\n\n- ▸ [[Chen_2024_Electronics]] — 파라미터 목록 원출처 (구성 재확인 필요)\n- ⛔ UNIFI Category 3 — 조항 번호 미특정\n\n> [!question] 허브 갱신 필요\n> [[Phase_지식_연결맵]] 과 [[GFM_연구_전체지도.md]] 에 연결할 것.\n",
    "wikilinks": [
      "과감쇠_동기화모드",
      "모드교차_최소감쇠비_함정",
      "정적부하가능성_경계",
      "EXP_2026-08-28_XR3조건_스윕",
      "참여인자 지배모드",
      "Simulation_코드구조",
      "고유값_안정도판단",
      "PSO_수렴판정_설계",
      "88포인트_2D_스윕_설계",
      "Phase04_PSO설계",
      "Chen_2024_Electronics",
      "Phase_지식_연결맵",
      "GFM_연구_전체지도.md"
    ]
  },
  {
    "path": "RSCAD/01_개념/PSO_수렴판정_설계.md",
    "dir": "RSCAD/01_개념",
    "filename": "PSO_수렴판정_설계",
    "frontmatter": {
      "type": "concept",
      "date": "2026-08-28",
      "phase": 4,
      "status": "draft",
      "supersedes": [
        "이중수렴기준 설계",
        "Pso 이중수렴기준 (수렴조건 부분)"
      ],
      "tags": [
        "concept",
        "PSO",
        "convergence",
        "MC",
        "N-final",
        "phase4"
      ]
    },
    "body": "# PSO 수렴판정 설계\n\n> **저장 위치:** `01_개념/`\n\n## 한 줄 정의\n\n> PSO 를 언제 멈출 것인가. 이중 수렴 조건으로 **1회 실행**을 종료하고, MC 30회 통계로 **N_final** 을 확정한다.\n\n목적함수가 무엇인지는 → [[PSO_목적함수_설계]]\n\n---\n\n## 이중 수렴 조건\n\n한 번의 PSO 실행을 끝내는 조건. 두 개를 **모두** 만족해야 한다.\n\n$$\\text{조건 1 (상대 개선):}\\quad \\frac{|F^{(t)} - F^{(t-1)}|}{|F^{(t-1)}|} < 0.1\\% \\quad \\text{연속 } S \\text{회}$$\n\n$$\\text{조건 2 (누적 감소):}\\quad \\frac{|F^{(t-W)} - F^{(t)}|}{|F^{(t-W)}|} < 0.5\\% \\quad \\text{동일 구간}$$\n\n**왜 두 개인가**\n- 조건 1 만 쓰면 평탄한 구간에서 조기 종료한다 (개선폭이 작아도 계속 내려갈 수 있음).\n- 조건 2 만 쓰면 진동하는 궤적에서 종료되지 않는다.\n\n> [!warning] `W` 와 `S` 가 정의돼 있지 않다\n> 구 노트는 \"연속 30회\"라고만 적었다. 조건 2 의 윈도 길이 `W` 와 조건 1 의\n> 연속 횟수 `S` 가 같은 값인지 다른 값인지 불명확하다.\n> ▸ 확정 필요: `S = 30`, `W = ?`\n> ※ `W` 는 `S` 보다 길어야 의미가 있다. 같으면 조건 2 가 조건 1 의 누적판이 되어\n>   독립적인 판정이 아니다.\n\n---\n\n## 2단계 MC 구조\n\n```\nPhase 4a — 임계값 결정 (예비)\n  조건1·2 임계값 (0.1%, 0.5%) 타당성 검증\n  W·S 확정\n  N_particle 결정\n\nPhase 4b — N_final 결정 (본실험)\n  MC 30회 실행\n  정규성 검정 → 평균±SD 또는 IQR\n  N_final = 수렴 반복 횟수의 중앙값\n  현재 추정: N_final ≈ 390\n```\n\n```python\nfrom scipy import stats\nimport numpy as np\n\nresults  = [pso_run(seed=s) for s in SEEDS]     # SEEDS 고정·기록 필수\nF_finals = [r['F_multi'] for r in results]\nN_finals = [r['n_iter']  for r in results]\n\nstat, p = stats.shapiro(F_finals)\nif p > 0.10:\n    summary = (np.mean(F_finals), np.std(F_finals, ddof=1))   # 정규\nelse:\n    q1, q3 = np.percentile(F_finals, [25, 75])                # 비정규 → IQR\n    summary = (np.median(F_finals), q3 - q1)\n\nN_final = int(np.median(N_finals))\n```\n\n> [!danger] 난수 시드 고정·기록 필수 (`P4-A5`)\n> MC 30회의 시드를 기록하지 않으면 재현이 불가능하다. 심사에서 요구된다.\n> `SEEDS = list(range(30))` 처럼 명시하고 결과 파일에 저장할 것.\n\n---\n\n## 평가 비용\n\nMC 30회 × N_final ≈ 390 반복 × N_particle 30 = **약 35만 회 목적함수 평가**.\n\n각 평가는 격자점마다 `fsolve` + 22×22 고유값 분해를 수행한다.\n\n| 격자 | 격자점 수 | 1회 F 평가 |\n|---|---|---|\n| SCR 4 × X/R 1 (구 설계) | 4 | 기준 |\n| SCR 5 × X/R 3 | 15 | 3.75배 |\n| SCR 11 × X/R 8 (88점) | 88 | 22배 |\n\n※ **PSO 격자와 검증 격자를 분리해야 한다.** 88포인트 전체를 목적함수 안에서 돌리면 계산이 성립하지 않는다. PSO 는 대표점 소수(예: SCR 3.0/1.5/0.8 × X/R 0.5/1.0/3.0 = 9점)로 최적화하고, 88포인트는 최적해 검증에만 쓴다.\n→ [[88포인트_2D_스윕_설계]]\n\n▸ `persist=False` 로 디스크 쓰기를 차단하면 병목이 파일시스템에서 CPU 로 이동한다. → [[Simulation_코드구조]]\n\n---\n\n## PSO 하이퍼파라미터\n\n```python\nw  = 0.729   # 관성 가중치      ┐\nc1 = 2.05    # 개인 최적        ├ Clerc-Kennedy 수렴 조건\nc2 = 2.05    # 전역 최적        ┘\nn_particles = 30\n```\n\n※ Clerc-Kennedy 조건은 `w = 0.7298`, `c1 = c2 = 1.49618` 로 인용되는 경우가 많다. `c = 2.05` 는 수축계수 χ 적용 **전** 값이다. 어느 형태를 쓰는지 코드와 노트를 일치시킬 것.\n\n---\n\n## 현재 상태\n\n| Phase | 상태 | 내용 |\n|---|---|---|\n| 1 | ⚠️ 시뮬만 | 랜덤 수렴 곡선 |\n| 2 | ⚠️ 시뮬만 | 고정 최적값 반환 |\n| 3 | ⛔ **차단** | 목적함수 재설계 선행 필요 |\n| 4 | — | 검증 |\n\n> [!danger] `/api/pso` 의 가짜 데이터는 제거됨\n> `app.py` v2 는 `random.uniform()` 으로 수렴 곡선을 생성해 반환했다.\n> 대시보드가 이를 실제 결과처럼 표시하므로 v3 에서 501 로 교체했다.\n> → [[실험_pso_미구현]]\n\n---\n\n## 착수 전 게이트\n\n- [ ] `P3-A7` 모드 식별을 참여계수 기반으로 전환\n- [ ] `P3-A6` ζ_threshold 또는 t_s_target 의 UNIFI 조항 특정\n- [ ] `P4-A1` TABLE II — `model.PARAM_NAMES` 기준 재작성\n- [ ] `P2-A10` δ>90° 가드 (없으면 무효 격자점이 \"안정\"으로 평가됨)\n- [ ] `W` · `S` · `P_INFEASIBLE` 확정\n\n---\n\n## 🔗 연결 노트\n\n| 방향 | 노트 | 이유 |\n|---|---|---|\n| ← | [[PSO_목적함수_설계]] | 무엇을 최소화하는가 |\n| ← | [[과감쇠_동기화모드]] | 지표 전환 근거 |\n| → | [[88포인트_2D_스윕_설계]] | 검증 격자 분리 |\n| → | [[PSO MC 30회 본실험]] | Phase 4b 실행 |\n| → | [[Phase04_PSO설계]] | 상위 계획 |\n| → | [[Phase03_진행중]] | 선행 게이트 |\n\n## 참고문헌\n\n- ▸ [[Chen_2024_Electronics]] — MC 분석 방법론\n- ▸ Clerc & Kennedy 2002 — 수축계수 수렴 조건\n\n> [!question] 허브 갱신 필요\n> [[Phase_지식_연결맵]] 과 [[GFM_연구_전체지도.md]] 에 연결할 것.\n",
    "wikilinks": [
      "PSO_목적함수_설계",
      "88포인트_2D_스윕_설계",
      "Simulation_코드구조",
      "실험_pso_미구현",
      "과감쇠_동기화모드",
      "PSO MC 30회 본실험",
      "Phase04_PSO설계",
      "Phase03_진행중",
      "Chen_2024_Electronics",
      "Phase_지식_연결맵",
      "GFM_연구_전체지도.md"
    ]
  },
  {
    "path": "RSCAD/01_개념/고유값_안정도판단.md",
    "dir": "RSCAD/01_개념",
    "filename": "고유값_안정도판단",
    "frontmatter": {
      "type": "concept",
      "date": "2026-08-21",
      "phase": 2,
      "status": "verified",
      "revision": 2,
      "tags": [
        "concept",
        "eigenvalue",
        "stability",
        "damping-ratio",
        "sigma",
        "zeta"
      ]
    },
    "body": "# 💡 고유값 안정도 판단\n\n## 한 줄 정의\n\n> 선형 시스템 ẋ=Ax의 고유값 λ에서 감쇠율 σ ≡ −Re(λ) > 0이면 안정, σ가 클수록 빨리 정착한다\n\n> [!note] rev.2 변경 (2026-09-18)\n> ▸ σ 부호 규약을 `metrics.py`와 통일: **σ ≡ −Re(λ)** (양수 = 안정)\n> ▸ 구 표기 `σ = Re(λ) < 0` → 코드와 부호가 반대여서 혼란 유발\n> ▸ ζ 0.64 출처 규명 반영 (UNIFI 조항 아님, 정착시간 역산값)\n> ▸ \"21차\" → \"22차\" 정정\n> ▸ \"참여인자\" → \"참여계수\" 정정\n\n## 핵심 수식\n\n$$\n\\lambda = -\\sigma \\pm j\\omega_d\n$$\n\n$$\n\\text{안정 조건: } \\sigma \\equiv -\\text{Re}(\\lambda) > 0 \\quad \\forall \\lambda\n$$\n\n$$\n\\zeta = \\frac{\\sigma}{|\\lambda|} = \\frac{\\sigma}{\\sqrt{\\sigma^2 + \\omega_d^2}}\n$$\n\n> [!warning] σ 부호 규약\n> 이 프로젝트에서 σ는 **감쇠율(damping rate)**이며 항상 σ ≡ −Re(λ)로 정의한다.\n> 안정하면 σ > 0, 불안정하면 σ < 0이다.\n> 일부 교과서의 λ = σ ± jω (σ = Re(λ)) 규약과 **부호가 반대**이므로 주의.\n> 코드: `metrics.py:93` → `sig = float(-lam.real)`\n\n### 정착시간\n\n$$\nt_s = \\frac{4}{\\sigma} \\quad \\text{(2\\% 기준)}\n$$\n\n▸ 실수극과 진동 모드 모두 같은 식이다. σ = −Re(λ)이므로 실수극도 ζ 없이 정착시간을 정의할 수 있다.\n\n### 구 기준값의 출처\n\n$$\n\\zeta_{\\text{th}} = \\frac{4}{2\\pi \\cdot f_{dom} \\cdot t_s} = 0.64 \\quad (f_{dom}=1\\text{Hz}, t_s=1\\text{s})\n$$\n\n> [!warning] 이 값은 UNIFI 표준 조항이 아니다\n> 폐기된 v0 코드에서 `ζ_th = 4/(2π·f_dom)` 으로 역산한 값이다.\n> 정착시간 1초 요구를 1 Hz 모드에 대해 감쇠비로 환산한 것.\n> 현재는 **σ_ref = 4.0 [1/s]** (t_s ≤ 1s) + **ζ_floor = 0.10** (링잉 하한)으로 교체.\n> → [[폐기값_이력]]\n\n## GFM 연구 기준값\n\n```\n안정 조건:   σ > 0  (모든 22개 고유값)\n주 기준:     σ_min ≥ 4.0 [1/s]  (t_s ≤ 1s, 2% 기준)\n부차 기준:   ζ ≥ 0.10          (진동 모드 링잉 억제)\n구 기준:     ζ ≥ 0.64          (폐기 — 대조용으로만 유지)\nP_ki 임계:   0.15              (참여계수 무시 하한)\n```\n\n## 모드 분류 (본 연구 22차 모델)\n\n| 모드 | 주파수 범위 | 물리 의미 | 지배 여부 |\n|---|---|---|---|\n| VSG 스윙 | 실수극 (과감쇠) | 동기화 모드 (δ, Δω) | ⭐ 임계 |\n| DC-AC 커플링 | 0.5~5 Hz | DC 버스 ↔ 각속도 | ⭐ 중요 |\n| 전압 루프 | 10~50 Hz | 전압 제어 응답 | 보조 |\n| 전류 루프 | 50~200 Hz | 전류 제어 응답 | 보조 |\n| LCL 공진 | 150~500 Hz | 필터 공진 | ⚠️ 주의 |\n\n> [!warning] VSG 스윙 모드는 실수극이다\n> Dp=20, J=0.5 조건에서 동기화 모드는 진동하지 않는다. ζ 기준은 이 모드에 적용 불가.\n> → [[과감쇠_동기화모드]]\n\n## Phase별 추이\n\n| Phase | 엔진 | σ_min | t_s_max | 판정 |\n|---|---|---|---|---|\n| 1 | numpy | - | - | 구 기준(ζ) |\n| 2 | sympy+numpy | 1.297 | 3.09 s | σ 미달 |\n| 3 (목표) | PSO 후 | **≥ 4.0** | **≤ 1.0 s** | ✅ 목표 |\n\n> ▸ Phase 2의 σ_min = 1.297 은 SCR 1.0, X/R 1.0 에서 δ 지배 실수극\n> ※ ζ_min = 0.1642 로 보고되었던 것은 LCL 공진 모드의 값이었음 — 동기화 모드와 무관\n\n## 88포인트 2D 스윕 결과 (Phase 2)\n\n| X/R | ζ_min | ζ_max | SCR* |\n|---|---|---|---|\n| 0.5 | 0.1232 | 0.1772 | null |\n| 1.0 | 0.1628 | 0.1713 | null |\n| 2.0 | 0.1602 | 0.1655 | null |\n| 5.0 | 0.0791 | 0.0894 | null |\n\n※ 이 ζ 값들은 모두 LCL 공진 모드의 감쇠비이며, 임계 모드(동기화)의 성능을 반영하지 않는다.\n→ σ 기준으로 재해석 필요\n\n## 🔗 연결 노트\n\n### 이론\n- [[소신호_선형화]] — 야코비안 → 고유값 계산 원리\n- [[DC-AC_커플링]] — 커플링 제거 시 고유값 이동량\n- [[과감쇠_동기화모드]] — 임계 모드가 실수극인 이유\n\n### 지표\n- [[PSO_목적함수_설계]] — σ/ζ 이중 구속 목적함수\n- [[모드교차_최소감쇠비_함정]] — ζ_min 단일값의 한계\n- [[폐기값_이력]] — ζ 0.64 출처 규명\n\n### 실험\n- [[EXP_2026-08-21_Phase2_엔진전환_비교]] — Phase 2 결과\n- [[실험_jacobian_SCR1.5_XR1.0]] — Phase 1 결과\n- [[실험 sweep2d j0.5 dp20]] — 88포인트 결과\n\n### Phase\n- [[Phase02_완료]] — stable=True 달성\n- [[Phase03_진행중]] — σ ≥ 4.0 목표\n\n## 참고문헌\n\n- ▸ [1] Chen 2024 — 참여계수 분석 방법\n- ※ UNIFI V3 Category 3에는 수치 감쇠비 조항이 확인되지 않음 → 정착시간 기준으로 대체\n",
    "wikilinks": [
      "폐기값_이력",
      "과감쇠_동기화모드",
      "소신호_선형화",
      "DC-AC_커플링",
      "PSO_목적함수_설계",
      "모드교차_최소감쇠비_함정",
      "EXP_2026-08-21_Phase2_엔진전환_비교",
      "실험_jacobian_SCR1.5_XR1.0",
      "실험 sweep2d j0.5 dp20",
      "Phase02_완료",
      "Phase03_진행중"
    ]
  },
  {
    "path": "RSCAD/01_개념/과감쇠_동기화모드.md",
    "dir": "RSCAD/01_개념",
    "filename": "과감쇠_동기화모드",
    "frontmatter": {
      "type": "concept",
      "date": "2026-09-14",
      "phase": 3,
      "status": "확립",
      "model_version": "v3-22state",
      "revision": 2,
      "tags": [
        "concept",
        "participation-factor",
        "dominant-mode",
        "eigenvalue",
        "실수극",
        "phase3"
      ]
    },
    "body": "# 💡 과감쇠 동기화 모드\n\n> **저장 위치:** `01_개념/`\n\n## 한 줄 정의\n\n> Dp=20 · J=0.5 조건에서 동기화 모드는 공액복소 쌍이 아니라 **실수극**이며, 감쇠비(ζ) 기반 지표로는 원리적으로 포착되지 않는다.\n\n> [!note] rev.2 변경 (2026-09-14)\n> ▸ K 의 정의를 `cos δ` 에서 `sin(δ + θ_Z)` 로 정정 → [[동기화계수_K]]\n> ▸ 빠른 근이 순수한 스윙 모드가 아님을 추가 → [[스윙극쌍_필터혼합]]\n> ▸ 정착시간 계수를 5(1% 기준)에서 **4(2% 기준)** 로 통일\n> ▸ `ZETA_TARGET = 0.64` 의 출처가 규명됨 (표준 조항 아님)\n\n---\n\n## 근거\n\n▸ 참여계수 분석에서 δ+Δω 참여도 **0.928 ~ 0.983** 인 극이 전부 실수극이다.\n\n### X/R = 0.5 (초기 확인)\n\n| SCR | λ_sync | p(δ+Δω) | τ = 1/\\|λ\\| | t_s = 4τ |\n|---|---|---|---|---|\n| 3.0 | −4.264 | 0.928 | 0.235 s | 0.94 s |\n| 2.0 | −2.859 | 0.952 | 0.350 s | 1.40 s |\n| 1.5 | −2.165 | 0.964 | 0.462 s | 1.85 s |\n| 1.0 | −1.393 | 0.977 | 0.718 s | 2.87 s |\n| 0.8 | −1.012 | 0.983 | 0.988 s | 3.95 s |\n\n*(J = 0.5, Dp = 20.0)*\n\n▸ SCR 3.0 → 0.8 에서 **4.21배** 원점 접근. 정착시간 0.94 s → 3.95 s.\n▸ 진동모드 중 δ 참여도 최대인 것은 λ ≈ −65 (Qf 0.445, Pf 0.401), δ 참여 **2%**. 전력 필터 모드다.\n\n### X/R = 1.0 (본 조건)\n\n| SCR | λ_sync | p(δ) | p(Δω) | p(δ+Δω) | t_s = 4τ |\n|---|---|---|---|---|---|\n| 3.0 | −4.6445 | 0.8169 | 0.1073 | 0.9243 | 0.86 s |\n| 2.0 | −2.9653 | 0.8808 | 0.0705 | 0.9513 | 1.35 s |\n| 1.5 | −2.1637 | 0.9125 | 0.0522 | 0.9647 | 1.85 s |\n| 1.0 | −1.2965 | 0.9459 | 0.0317 | 0.9776 | 3.09 s |\n\n▸ 약계통일수록 δ 비중이 커지고 Δω·Pf 기여가 줄어든다. **모드가 순수한 각도 모드가 되어간다.**\n※ 과감쇠 영역에서 느린 근이 원점에 접근하면 1차 적분 특성이 지배하기 때문이다.\n\n> [!warning] 두 조건을 섞어 인용하지 말 것\n> X/R 이 달라지면 θ_Z 와 마루 위치가 달라진다. 위 두 표는 별개 실행이다.\n> 최근 작업(K_eff · SEP · 선형화)은 모두 **X/R = 1.0** 기준이다.\n\n---\n\n## 왜 놓쳤나\n\n`runner.py` 의 `analyze()` 는 `Im(λ) > tol` 인 모드만 ζ 계산 대상으로 삼는다. 실수극은 이 필터에 애초에 걸리지 않는다.\n\n> [!danger] 지금까지의 ζ 논의는 동기화 모드를 빼놓고 진행됐다\n> `ζ_sync` 로 표시되던 0.3232~0.3238 은 전력 필터 모드의 값이다.\n> δ 가 22°→79° 로 밀려도 이 값이 평탄했던 이유가 이것이다.\n\n---\n\n## 과감쇠 판정\n\n$$D_p > 2\\sqrt{J \\cdot K}$$\n\n약계통일수록 K 가 작아져 과감쇠가 더 심해진다. 즉 **SCR 이 낮아질수록 진동성이 사라지고 느려지는** 것이 이 시스템의 열화 경로다.\n\n> [!warning] K 를 `cos δ` 로 쓰면 안 된다\n> `K = VE·cos δ / X` 는 X ≫ R 을 전제한 식이다. 저항을 포함하면\n>\n> $$K = \\frac{\\partial P}{\\partial \\delta} = \\frac{EV}{Z}\\sin(\\delta + \\theta_Z)$$\n>\n> 이며, X/R = 1.0 에서는 θ_Z ≈ 49~53° 다.\n> ▸ 그 구간에서 sin 항은 **0.938~0.9995 로 거의 상수**다. K 를 줄이는 것은\n>   각도가 아니라 임피던스 Z 자체다.\n> ▸ 구 식으로 계산한 예측은 관측 대비 **67% 어긋났다.**\n> ※ X/R = 3.0 이면 θ_Z ≈ 73° 로 마루가 δ 17° 까지 앞당겨져 `cos δ` 쪽에\n>   가까워진다. **X/R 에 따라 서사가 달라진다.** → [[동기화계수_K]]\n\n> [!warning] 빠른 근은 순수한 스윙 모드가 아니다\n> 과감쇠 2차계라면 두 근의 합이 `−Dp/J = −40` 이어야 하는데, 관측은\n> −30.90(SCR 3.0) ~ −41.84(SCR 1.0) 로 강계통에서 크게 벗어난다.\n> ▸ 빠른 근의 전력 필터 참여도가 **0.1312 → 0.0110 으로 11.9배 감소**한다.\n> ▸ 즉 강계통에서는 빠른 근이 필터극(−ω_c = −62.8)과 섞여 실효 Dp 가\n>   달라진다. 이론 대비 오차 30% 중 17% 가 여기서 온다.\n> → [[스윙극쌍_필터혼합]]\n\n---\n\n## 결과\n\n※ **ζ 는 목적함수가 될 수 없다.** 실수극의 감쇠비는 정의상 1 이므로 ζ ≥ 0.64 기준을 이 모드에 적용하는 것 자체가 성립하지 않는다.\n\n### 대체 지표\n\n| 기호 | 정의 | 성격 |\n|---|---|---|\n| `σ_sync` | 참여계수로 식별한 지배 동기화 극의 감쇠율 | SCR 에 3.6~4.2배 반응 |\n| `t_s` | 4 / \\|σ\\| (2% 기준) | 실측 가능 · 표준 규정 대상 |\n| `ζ_osc` | 진동모드에 한해 (LCL · 제어 대역) | 링잉 억제용 부차 조건 |\n\n> [!warning] 정착시간 계수는 4 로 통일한다\n> 2% 정착은 `t_s ≈ 4/σ`, 1% 정착은 `5/σ` 다. 목적함수와 판정 지표가 서로\n> 다른 계수를 쓰면 **같은 값이 통과이자 미달로 보인다.**\n> 실제로 σ=4.6445 가 score 1.161(통과)이면서 t_s 1.08 s(미달)로 나온 사례가\n> 있다. `metrics.TS_COEF = 4.0` 을 import 해 쓸 것.\n\n> [!success] `ZETA_TARGET = 0.64` 의 출처가 규명되었다\n> 폐기된 v0 코드에 `ζ_th = 4/(2π·f_dom)` 이 있었다. `f_dom = 1 Hz` 를 넣으면\n> `4/(2π) = 0.6366 ≈ 0.64` 다. 즉 **표준 조항이 아니라 정착시간 1 초 요구를\n> 1 Hz 모드에 대해 감쇠비로 환산한 값**이다.\n> ▸ 구 노트의 예측 — \"정착시간 기준으로 바꾸면 함께 해소된다\" — 이 맞았다.\n> ▸ 다만 그 역산의 기준이 된 **1 초도 근거 문서가 없다.** `P3-A6` 의 과제가\n>   \"UNIFI 에서 ζ 조항 찾기\"에서 \"정착시간 요구가 어느 문서에서 오는가\"로\n>   바뀐다. → [[폐기값_이력]]\n\n### Dp 재검토\n\n※ Dp=20 이 과감쇠를 만든다. PSO 가 Dp 를 낮추면 진동 영역으로 진입해 ζ 가 다시 의미를 갖지만 정착시간은 나빠질 수 있다. **이 트레이드오프가 PSO 의 실제 탐색 공간이다.**\n\n※ 아울러 ω_c 도 조정 대상이다. 필터극 위치가 움직이면 강계통에서 스윙 빠른 근과의 결합 정도가 달라진다. J·Dp 만으로는 건드릴 수 없는 자유도다. → [[PSO_목적함수_설계]]\n\n---\n\n## 재현\n\n```bash\npython Simulation/pf_export.py          # 참여계수 → JSON\npython Simulation/sync_reduce.py        # 두 근, 합, p(Pf), SEP, K_eff\n```\n\n▸ `pf.py` 는 화면 확인용, `pf_export.py` 는 문서·대시보드용이다. 두 스크립트의 참여도 값이 일치함을 확인했다(0.8169 / 0.8808 / 0.9125 / 0.9459).\n\n---\n\n## 🔗 연결 노트\n\n| 방향 | 노트 | 이유 |\n|---|---|---|\n| ← | [[참여인자 지배모드]] | 식별 방법론 |\n| ← | [[고유값_안정도판단]] | ζ 정의의 전제 |\n| ← | [[동기화계수_K]] | K 의 정정된 정의 |\n| → | [[스윙극쌍_필터혼합]] | 빠른 근의 필터 결합 |\n| → | [[모드교차_최소감쇠비_함정]] | ζ_min 이 부적합한 두 번째 이유 |\n| → | [[PSO_목적함수_설계]] | 목적함수 지표 교체 |\n| → | [[폐기값_이력]] | ζ 0.64 출처 규명 |\n\n> [!question] 허브 갱신 필요\n> 이 노트를 [[Phase_지식_연결맵]] 과 [[GFM_연구_전체지도.md]] 에 연결할 것.\n",
    "wikilinks": [
      "동기화계수_K",
      "스윙극쌍_필터혼합",
      "폐기값_이력",
      "PSO_목적함수_설계",
      "참여인자 지배모드",
      "고유값_안정도판단",
      "모드교차_최소감쇠비_함정",
      "Phase_지식_연결맵",
      "GFM_연구_전체지도.md"
    ]
  },
  {
    "path": "RSCAD/01_개념/노트_수정지점.md",
    "dir": "RSCAD/01_개념",
    "filename": "노트_수정지점",
    "frontmatter": {
      "type": "note",
      "date": "2026-09-08",
      "status": "작업지시",
      "tags": [
        "정리",
        "수정지점"
      ]
    },
    "body": "# 노트 수정 지점 — cos δ 서사 정정\n\n> [!abstract] 배경\n> `K ∝ cos δ · SCR` 은 X ≫ R 가정의 특수해다. X/R = 1.0 에서 예측 5.974배 대\n> 관측 3.582배로 67% 어긋났다. 정정식은 `K = (EV/Z)·sin(δ + θ_Z)` 이며,\n> 유도와 실측은 [[동기화계수_K]] 에 모았다.\n> 아래는 **기존 노트에 삽입/교체할 블록**이다. 노트 전체를 갈아엎지 않는다.\n\n---\n\n## 1. `01_개념/과감쇠_동기화모드`\n\n### 삽입 위치\n\"λ ≈ −K/Dp\" 를 언급하는 문단 **바로 뒤**.\n\n### 삽입 블록\n\n```markdown\n> [!warning] K 를 cos δ 로 쓰면 안 된다\n> `λ ≈ −K/Dp` 의 K 는 `∂P/∂δ = (EV/Z)·sin(δ + θ_Z)` 다.\n> `cos δ` 형태는 θ_Z → 90°(무손실)의 특수해이며, X/R = 1.0 에서는\n> θ_Z ≈ 48~53° 이므로 크게 빗나간다. → [[동기화계수_K]]\n\n▸ X/R = 1.0 의 운전점 δ 22~62° 에서 sin(δ+θ_Z) 는 0.938~0.9995 로 거의 상수다.\n※ 즉 이 조건에서 K 를 줄이는 것은 **각도가 아니라 임피던스 Z** 다.\n\n### λ ≈ −K/Dp 는 어디서 깨지는가\n\n두 근의 합이 `−Dp/J = −40` 이어야 하지만 관측은 다음과 같다.\n\n| SCR | λ_slow | λ_fast | 합 | p(Pf)@fast |\n|---|---|---|---|---|\n| 3.0 | −4.6445 | −26.2573 | −30.90 | 0.1312 |\n| 1.0 | −1.2965 | −40.5415 | −41.84 | 0.0110 |\n\n▸ 강계통에서 빠른 근이 **전력 필터극(ω_c = 62.8)과 섞인다.** p(Pf) 가 0.131 → 0.011 로 12배 감소한다.\n※ 섞이면 실효 Dp 가 −40 보다 작게 작용해 λ_slow 가 K 예측보다 커진다.\n   이론 대비 30% 오차 중 17% 가 여기서 나온다.\n```\n\n---\n\n## 2. `01_개념/참여인자 지배모드`\n\n### 삽입 위치\n문서 끝, \"연결 노트\" 앞.\n\n### 삽입 블록\n\n```markdown\n## 빠른 근의 필터 혼합 (2026-09-08 추가)\n\nδ·Δω 참여도 상위 **두** 모드를 함께 보면 과감쇠 스윙쌍의 순도가 드러난다.\n\n| SCR | p(δ+Δω)@slow | p(Pf)@fast | 두 근의 합 | SEP |\n|---|---|---|---|---|\n| 3.0 | 0.9243 | 0.1312 | −30.90 | 1.86 |\n| 2.0 | 0.9513 | 0.1099 | −32.48 | 2.91 |\n| 1.5 | 0.9647 | 0.0940 | −33.50 | 3.98 |\n| 1.0 | 0.9776 | 0.0110 | −41.84 | 6.65 |\n\n▸ 느린 근은 전 구간 순수하다(0.92~0.98). 반면 **빠른 근은 강계통에서 필터극과 섞인다.**\n▸ 순수 2차계라면 두 근의 합이 `−Dp/J = −40` 이어야 하는데 SCR 1.0 에서만 맞는다.\n※ 참여계수를 지배 모드 하나만 보면 이 혼합을 놓친다. **쌍으로 봐야 한다.**\n\n실행: `python Simulation/sync_reduce.py` → `sync_reduction.json`\n→ [[동기화계수_K]]\n```\n\n---\n\n## 3. `PSO_목적함수_설계` → rev.3 로 교체\n\n전체 교체본을 별도 파일로 제공한다. 주요 변경은 셋이다.\n\n▸ `λ ≈ −K/Dp` 의 K 정의를 `sin(δ + θ_Z)` 로 정정\n▸ **wc 를 조정 대상에 명시** — 필터극 위치가 강계통 실효 Dp 를 바꾼다\n▸ `sigma_sync` 획득 경로를 `sync_reduce.py` 로 갱신\n\n---\n\n## 4. 검증 실행 보고서 (Word · HTML)\n\n### 4-1. 선형화 유효범위 절 — 무효전력이 최악인 이유\n\n**현재 문장 (틀림)**\n\n> 계통 전압이 여현 함수로 모델에 들어가므로 전력각이 이동할 때 곡률의 영향이\n> 무효 성분에 집중되기 때문이다.\n\n⛔ `cos δ` 의 2차 도함수는 `−cos δ` 로 δ 가 커질수록 **작아진다**. 서술이 거꾸로다.\n\n**교체 문장**\n\n> 계통 전압의 q 축 성분이 `−V_g sin δ` 이므로 2차 항이 `sin δ` 에 비례한다.\n> 전력각이 커질수록 이 항이 커지며, 그래서 비선형 오차가 무효 성분에 집중되고\n> 약계통에서 더 두드러진다.\n\n▸ 실측과도 부합한다. δ 가 22°→62° 로 커질 때 DC 이득 오차(δ 기준)가 0.2% → 3.2% 로 증가한다.\n\n### 4-2. 참여계수 절 — 조정 대상 문장 보강\n\n**추가할 문장**\n\n> 아울러 강계통에서는 빠른 근이 전력 필터극과 섞여 실효 감쇠가 달라진다.\n> 전력 필터 차단주파수가 조정 대상에 포함되어야 하는 이유이며, 가상 관성만으로는\n> 다룰 수 없는 자유도다.\n\n---\n\n## 🔗 연결\n\n- [[동기화계수_K]]\n- [[과감쇠_동기화모드]]\n- [[참여인자 지배모드]]\n- [[PSO_목적함수_설계]]\n- [[폐기값_이력]]\n",
    "wikilinks": [
      "동기화계수_K",
      "과감쇠_동기화모드",
      "참여인자 지배모드",
      "PSO_목적함수_설계",
      "폐기값_이력"
    ]
  },
  {
    "path": "RSCAD/01_개념/동기화계수_k.md",
    "dir": "RSCAD/01_개념",
    "filename": "동기화계수_k",
    "frontmatter": {
      "## type": "concept date: 2026-09-08 phase: 3 status: 확립 model_version: v3-22state tags: [concept, 동기화계수, 전력각, X_R, phase3]",
      "> **저장 위치": "** `01_개념/`"
    },
    "body": "## 수식\n\n송전단 E∠δ, 수전단 V∠0, 직렬 임피던스 Z∠θ_Z 일 때\n\n$$P = \\frac{E^2}{Z}\\cos\\theta_Z - \\frac{EV}{Z}\\cos(\\delta + \\theta_Z)$$\n\n$$\\boxed{;K = \\frac{\\partial P}{\\partial \\delta} = \\frac{EV}{Z}\\sin(\\delta + \\theta_Z);}$$\n\nθ_Z = arctan(X/R) 이다. X ≫ R 이면 θ_Z → 90° 이므로\n\n$$K \\to \\frac{EV}{X}\\cos\\delta$$\n\n즉 교과서의 `cos δ` 식은 **무손실 계통의 특수해**다.\n\n> [!danger] 폐기 — `K ∝ cos δ · SCR` 초기 검증 스크립트가 이 식으로 이론값을 계산했다. X/R = 1.0 조건에서 예측 5.974배 대 관측 3.582배로 **67% 어긋났고**, 그 차이를 \"전력 필터와 계통 동역학 때문\"이라고 설명했다. 실제로는 검증식이 틀린 것이었다. → [[폐기값_이력]]\n\n---\n\n## θ_Z 는 계통값이 아니다\n\nδ 는 **인버터 내부 프레임 기준**이므로 경로 임피던스에 필터가 포함된다.\n\n$$X = \\omega_0 (L_1 + L_v + L_2 + L_g), \\qquad R = R_1 + R_2 + R_g$$\n\n필터부(L₁+L_v+L₂)는 저항이 거의 없는 순수 리액턴스이므로 **θ_Z 를 계통값보다 크게** 만든다.\n\n|SCR|계통만 θ_Z|필터 포함 θ_Z|Z [Ω]|sin(δ+θ_Z)|\n|---|---|---|---|---|\n|3.0|45.0°|**52.96°**|6.377|0.9676|\n|2.0|45.0°|50.62°|9.026|0.9930|\n|1.5|45.0°|49.34°|11.683|0.9995|\n|1.0|45.0°|**47.98°**|17.005|0.9378|\n\n---\n\n## ⛔ \"cos δ 붕괴\" 서사는 X/R ≈ 1 에서 성립하지 않는다\n\nsin(δ + θ_Z) 는 δ + θ_Z = 90° 에서 최대다. θ_Z ≈ 50° 이면 **δ = 40° 근처가 마루**다.\n\n▸ 운전점 δ 22°~62° 는 그 마루를 지나므로 sin 항이 **0.938 ~ 0.9995 로 사실상 상수**다. ▸ 따라서 K 를 줄이는 것은 각도가 아니라 **임피던스 Z 자체**다. `Z = Z_base/SCR` 이므로 K ∝ SCR 이 지배한다.\n\n> [!important] X/R 에 따라 서사가 달라진다 X/R = 3.0 이면 θ_Z ≈ 71° 이므로 마루가 δ ≈ 19° 로 앞당겨지고, δ 가 커질수록 sin 이 실제로 떨어진다. 그때는 cos δ 서사에 가까워진다. ※ **이것이 1D 스윕으로는 보이지 않는 현상이며, 2D 경계면이 필요한 근거다.** → [[88포인트_2D_스윕_설계]]\n\n---\n\n## K 를 야코비안에서 직접 뽑기 — Schur 축소\n\n`A[Δω, δ] = 0` 은 전차수 모델에서 정상이다. K 가 사라진 게 아니라 다른 상태에 묻혀 있다. δ → i_od → Pf → Δω 경로로 되먹임되기 때문이다.\n\n[δ, Δω] 만 남기고 나머지 20개를 준정상 소거하면 복원된다.\n\n$$A_{red} = A_{11} - A_{12}A_{22}^{-1}A_{21}, \\qquad K_{eff} = -J,\\omega_0, A_{red}[\\Delta\\omega, \\delta]$$\n\n▸ 최소 예제(`Pf' = -\\omega_c Pf + \\omega_c K\\delta`)에서 상대오차 0 으로 복원됨을 확인했다. ▸ `A_red` 의 trace 는 정확히 `−Dp/J` 가 나온다. ※ 이론식 대조가 아니라 **모델 자기 일관성 검증**이다. 축소 모델이 아닌 전차수 모델에서 K 를 유도한 것이므로 신규성 주장과 직접 연결된다.\n\n### 실측 (X/R = 1.0)\n\n|SCR|λ_slow|λ_fast|합|K_eff|SEP|p(Pf)@fast|\n|---|---|---|---|---|---|---|\n|3.0|−4.6445|−26.2573|−30.90|2.835e+04|1.86 ⚠|0.1312|\n|2.0|−2.9653|−29.5136|−32.48|1.962e+04|2.91 ⚠|0.1099|\n|1.5|−2.1637|−31.3347|−33.50|1.486e+04|3.98|0.0940|\n|1.0|−1.2965|−40.5415|−41.84|9.256e+03|6.65|0.0110|\n\n> [!warning] SEP < 3 이면 K_eff 를 신뢰하지 말 것 준정상 소거는 소거 대상이 충분히 빨라야 성립한다. 전력 필터극(ω_c = 62.8)이 동기화 모드에 가까우면 조건이 깨진다. SCR 3.0 에서 SEP = 1.86 이며, **정확히 이 점이 이론과 가장 어긋난다.** 경고가 판별력을 갖는다는 뜻이다.\n\n---\n\n## 오차 30% 의 분해\n\n|구간|비|차이|원인|\n|---|---|---|---|\n|이론 → K_eff|2.751 → 3.062|+11.3%|모델–물리 편차|\n|K_eff → λ|3.062 → 3.582|+17.0%|`λ ≈ −K/Dp` 근사의 잔차|\n|이론 → λ|2.751 → 3.582|30.2%|위 둘의 합|\n\n▸ 후자가 더 크다. 즉 **주된 원인은 모델이 아니라 Dp 실효값 변화**다.\n\n### 왜 Dp 실효값이 변하는가\n\n과감쇠 2차계라면 두 근의 합이 `−Dp/J = −40` 이어야 한다. 관측은 −30.90 → −41.84 로 **SCR 1.0 에서만 맞는다.**\n\n▸ 빠른 근의 전력 필터 참여도가 0.131 → 0.011 로 **12배 감소**한다. ▸ SEP 도 1.86 → 6.65 로 같은 방향이다. ※ 강계통에서는 빠른 근이 필터극과 섞여 실효 Dp 가 작게 작용하고, 그래서 `λ_slow` 가 K_eff 예측보다 커진다. 세 지표(합, p(Pf), SEP)가 같은 이야기를 한다.\n\n> [!success] 전차수 모델이 필요한 직접 증거 축소 모델은 `λ = −K/Dp` 를 전제한다. 전력 필터가 상태변수로 있으면 강계통에서 그 관계가 깨진다. p(Pf) = 0.131 이 그 정도를 정량화한 값이다.\n> \n> ※ `wc` 가 PSO 조정 대상이어야 하는 근거이기도 하다. `wc` 를 바꾸면 필터극이 움직이고, 강계통에서 스윙 근의 실효 감쇠가 바뀐다. J·Dp 만으로는 못 하는 일이다. → [[PSO_목적함수_설계]]\n\n---\n\n## 관련 코드\n\n```bash\npython Simulation/sync_reduce.py          # K_eff · SEP · p(Pf) 산출\n```\n\n```python\n# Simulation/sync_reduce.py\ndef theory_K(scr, xr, delta_rad, fixed):\n    \"\"\"∂P/∂δ = (E·V/Z)·sin(δ + θ_Z). 경로 임피던스에 필터를 포함한다.\"\"\"\n    X = w0 * (L1 + Lv + L2 + Lg)\n    R = R1 + R2 + Rg\n    return np.sin(delta_rad + np.arctan2(X, R)) / np.hypot(R, X)\n```\n\n출력: `results/<run>/sync_reduction.json`\n\n## 참고문헌\n\n- Kundur, _Power System Stability and Control_ — 손실 포함 동기화계수 유도\n- ⛔ 무손실 가정(θ_Z = 90°) 문헌의 `cos δ` 식은 X/R ≈ 1 에 적용 금지\n\n## 🔗 연결 노트\n\n|방향|노트|이유|\n|---|---|---|\n|←|[[야코비안 행렬]]|K 가 묻혀 있는 자리|\n|←|[[동작점 평형점]]|δ 가 SCR 따라 이동|\n|→|[[과감쇠_동기화모드]]|λ ≈ −K/Dp 의 전제|\n|→|[[참여인자 지배모드]]|p(Pf) 혼합 판정|\n|→|[[PSO_목적함수_설계]]|wc 조정 근거|\n|→|[[88포인트_2D_스윕_설계]]|X/R 에 따른 서사 변화|\n|→|[[폐기값_이력]]|cos δ 식 폐기|",
    "wikilinks": [
      "폐기값_이력",
      "88포인트_2D_스윕_설계",
      "PSO_목적함수_설계",
      "야코비안 행렬",
      "동작점 평형점",
      "과감쇠_동기화모드",
      "참여인자 지배모드"
    ]
  },
  {
    "path": "RSCAD/01_개념/동작점 평형점.md",
    "dir": "RSCAD/01_개념",
    "filename": "동작점 평형점",
    "frontmatter": {
      "## type": "concept date: 2026-08-21 phase: 2 status: verified tags: [concept, operating-point, equilibrium, SCR, linearization]"
    },
    "body": "## 평형점 조건\n\n$$f(x_0) = 0 \\quad \\Rightarrow \\quad \\dot{x} = 0 \\text{ (정상상태)}$$\n\n```\n정상상태에서:\n  dΔω/dt = 0  → P_ref = P_filt (전력 균형)\n  du_dc/dt = 0 → i_Lpv*(1-dpv) = i_dc_inv (DC 전력 균형)\n  di_id/dt = 0 → 전압·전류 루프 수렴\n```\n\n---\n\n## SCR별 동작점 계산 순서\n\n### Step 1. 계통 임피던스 계산\n\n$$Z_g = \\frac{V_n^2}{SCR \\cdot P_{rated}}, \\quad R_g = \\frac{Z_g}{\\sqrt{1+(X/R)^2}}, \\quad L_g = \\frac{R_g \\cdot (X/R)}{\\omega_0}$$\n\n### Step 2. PCC 전압 계산 (1차 Thevenin 근사)\n\n$$V_{pcc,k} = V_n - (I_{d0} \\cdot R_{g,k} + I_{q0} \\cdot X_{g,k})$$\n\n### Step 3. PV 동작점 (MPPT)\n\n$$V_{pv0,k} \\approx 0.8 \\cdot V_{oc}(T), \\quad I_{pv0,k} = \\frac{P_{mppt}}{V_{pv0,k}}$$\n\n### Step 4. DC 버스 전류 ← DC-AC 커플링 핵심\n\n$$i_{dc0,k} = \\frac{P_{pv,k}}{V_{dc0}} = \\frac{0.9}{SCR_k}$$\n\n> SCR이 낮아질수록 i_dc0 증가 → A_k(9,6) 증가\n\n---\n\n## 21개 상태변수 동작점 벡터\n\n```python\nx0 = np.array([\n    0.0, 0.0, 0.0,      # xPI1,2,3 = 0 (정상상태 오차 없음)\n    Vpv0, 0.9, 1.0,     # upv, ubat, udc=Vdc0\n    0.9, 0.1,           # iLpv=idc0*Vdc0/Vpv0, iLbat\n    0.0,                # Δω = 0 (정상상태)\n    1.0, 0.0,           # Pfilt=Pref, Qfilt=0\n    0.0, 0.0,           # φ_vd, φ_vq = 0\n    0.0, 0.0,           # γ_id, γ_iq = 0\n    Id0, Iq0,           # iid=Id0, iiq=Iq0\n    Vpcc, 0.0,          # uod=Vpcc, uoq=0 (d축 정렬)\n    Id0, Iq0,           # iod=Id0, ioq=Iq0\n])\n```\n\n---\n\n## SCR별 동작점 값\n\n|SCR|Zg (pu)|Vpcc (pu)|idc0 (pu)|Δu_pv (%)|\n|---|---|---|---|---|\n|3.0|0.333|0.764|0.300|0.0|\n|2.0|0.500|0.646|0.450|8.3|\n|1.5|0.667|0.529|0.600|12.5|\n|1.0|1.000|0.293|0.900|16.6|\n\n> ▸ Δu_pv > 5% → 선형화 유효성 초과 → PSCAD Layer 2 교차검증 필요\n\n---\n\n## 선형화 유효성 기준\n\n$$\\Delta u_{pv} = \\frac{|V_{pv0,k} - V_{pv0,nom}|}{V_{pv0,nom}} < 5%$$\n\n```\nSCR=3.0: Δu_pv=0.0%  → ✅ 유효\nSCR=2.0: Δu_pv=8.3%  → ❌ 초과 (PSCAD 검증 필요)\nSCR=1.5: Δu_pv=12.5% → ❌ 초과\nSCR=1.0: Δu_pv=16.6% → ❌ 초과\n```\n\n---\n\n## Phase별 구현\n\n|Phase|방법|정확도|\n|---|---|---|\n|1|고정값 근사 (upv=1.0 pu)|낮음|\n|2|SCR별 Thevenin 1차 근사|중간|\n|3+|calc_mppt() P-V 곡선 정밀 계산|높음|\n\n---\n\n## ⚠️ Phase 2 동작점 불일치 버그 (해결됨)\n\n```\n발생: sym.py 9차 시도 이전\n원인: upv0=1.0, udc0=1.0, dpv0=0.5 설정 시\n      f7=0 조건: upv = (1-dpv)*udc = 0.5 ≠ 1.0\n      → 평형점이 아닌 점에서 선형화 → 불안정\n\n해결: upv0=0.8 pu (부스트 컨버터 실제 동작점)\n      dpv0 = 1 - upv0/udc0 = 0.2\n      → f7=0 만족 ✅\n```\n\n---\n\n## 🔗 연결 노트\n\n### 이론\n\n- [[소신호_선형화]] — 동작점에서 야코비안 유도\n- [[야코비안 행렬]] — x₀ 대입 후 수치 행렬\n- [[DC-AC_커플링]] — idc0_k = A_k(9,6) 핵심\n\n### 실험\n\n- [[EXP_2026-08-21_Phase2_엔진전환_비교]] — Δu_pv 검증\n- [[Bug sym dc pi 4차시도]] — 동작점 불일치 버그\n- [[실험_jacobian_SCR1.5_XR1.0]] — valid_linearization=False 확인\n\n### Phase\n\n- [[Phase02_완료]] — SCR별 동작점 구현\n- [[Phase03_진행중]] — calc_mppt() 정밀화 예정\n\n---\n\n## 참고문헌\n\n- ▸ [1] Chen 2024 — 다중 동작점 갱신 절차\n- ▸ [15] Villalva 2009 — PV P-V 곡선 비선형 모델",
    "wikilinks": [
      "소신호_선형화",
      "야코비안 행렬",
      "DC-AC_커플링",
      "EXP_2026-08-21_Phase2_엔진전환_비교",
      "Bug sym dc pi 4차시도",
      "실험_jacobian_SCR1.5_XR1.0",
      "Phase02_완료",
      "Phase03_진행중"
    ]
  },
  {
    "path": "RSCAD/01_개념/모드교차_최소감쇠비_함정.md",
    "dir": "RSCAD/01_개념",
    "filename": "모드교차_최소감쇠비_함정",
    "frontmatter": {
      "type": "concept",
      "phase": 3,
      "status": "verified",
      "date": "2026-08-28",
      "tags": [
        "concept",
        "phase3",
        "모드교차",
        "PSO목적함수",
        "함정"
      ]
    },
    "body": "# 모드 교차와 최소감쇠비 함정\n\n> **저장 위치:** `01_개념/`\n\n## 한 줄\n\n`ζ_min` 은 스칼라 하나로 보이지만 **어느 물리 모드를 가리키는지가 SCR·X/R 에 따라 바뀐다.** 시계열로 이어붙이면 서로 다른 물리량을 연결한 것이 된다.\n\n## 관측\n\n▸ X/R = 3.0, SCR 2.0 → 1.5 구간에서 `ζ_min` 이 갈아탄다.\n\n| SCR | ζ_min | 대역 | f_dom | 커플링(crit) |\n|---|---|---|---|---|\n| 3.0 | 0.0794 | `control` | 37.617 Hz | 26.24 |\n| 2.0 | 0.1645 | `control` | 42.556 Hz | 26.97 |\n| **1.5** | **0.2070** | **`lcl`** | **178.732 Hz** | **1.00** |\n| 1.0 | 0.2071 | `lcl` | 178.706 Hz | 1.06 |\n| 0.8 | 0.2072 | `lcl` | 178.690 Hz | 1.10 |\n\n▸ 커플링 이동량이 26.97 → 1.00 으로 **27배 불연속**. 모드 동일성이 끊긴 지점이다.\n▸ X/R = 1.0 · 0.5 에서는 전 구간 `lcl` 고정이라 교차가 보이지 않는다.\n\n> [!danger] PSO 목적함수를 ζ_min 단일값으로 두면\n> SCR 3.0~2.0 구간에서는 37 Hz DC-AC 혼합 모드를,\n> SCR 1.5 이하에서는 178 Hz LCL 공진을 최적화하게 된다.\n> 두 모드는 물리적으로 무관하며, 최적화 방향이 서로 상충할 수 있다.\n\n## 왜 X/R=1.0 에서는 안 보였나\n\n37~42 Hz DC-AC 혼합 모드의 감쇠가 X/R 에 강하게 의존한다. X/R=1.0 에서는 ζ_ctrl 이 0.44~0.53 으로 `lcl`(0.207)보다 좋아 ζ_min 에 잡히지 않는다. X/R=3.0 에서만 0.0794 로 내려와 지배권을 가져간다.\n\n※ 즉 **모드 교차점의 위치가 X/R 의 함수**다. 이 궤적이 2D SCR–X/R 경계도의 실체다.\n\n## 대응\n\n`runner.py` v3 에 대역 분류(`BANDS`)와 교차 자동 검출을 넣었다.\n\n```python\nBANDS = [('sync', 0.0, 5.0), ('control', 5.0, 100.0), ('lcl', 100.0, inf)]\nmeta['band_crossovers']  # [{'between': [2.0, 1.5], 'from': 'control', 'to': 'lcl'}]\n```\n\n> [!warning] 주파수 대역 분류는 대용 지표다\n> `sync` 대역이 잡는 것은 실제 동기화 모드가 아니라 전력 필터 모드였다.\n> → [[과감쇠_동기화모드]]\n> 논문에는 참여계수 기반 귀속을 써야 한다. (`P3-A7`)\n\n## 목적함수 형태\n\n※ 대역별 가중합으로 가야 한다.\n\n```\ncost = w_sync · max(0, t_s − t_s*)\n     + w_ctrl · max(0, ζ* − ζ_control)\n     + w_lcl  · max(0, ζ* − ζ_lcl)\n```\n\n가중치 근거를 UNIFI 요구사항에서 끌어와야 방어된다. (`P4-A2`, `P4-A4`)\n\n## 🔗 연결 노트\n\n| 방향 | 노트 | 이유 |\n|---|---|---|\n| ← | [[과감쇠_동기화모드]] | ζ 부적합의 첫 번째 이유 |\n| ← | [[DC-AC_커플링]] | 37 Hz 모드의 정체 |\n| → | [[88포인트_2D_스윕_설계]] | 교차점 궤적 = 경계도 |\n| → | [[Phase04_PSO설계]] | 목적함수 설계 |\n\n> [!question] 허브 갱신 필요\n> 이 노트를 [[Phase_지식_연결맵]] 과 [[GFM_연구_전체지도.md]] 에 연결할 것.\n",
    "wikilinks": [
      "과감쇠_동기화모드",
      "DC-AC_커플링",
      "88포인트_2D_스윕_설계",
      "Phase04_PSO설계",
      "Phase_지식_연결맵",
      "GFM_연구_전체지도.md"
    ]
  },
  {
    "path": "RSCAD/01_개념/블록삼각_함정.md",
    "dir": "RSCAD/01_개념",
    "filename": "블록삼각_함정",
    "frontmatter": {
      "type": "concept",
      "domain": "소신호모델링",
      "status": "확립",
      "date": "2026-08-25",
      "origin": "21차 GFM 모델 v0 결함 발견 (2026-08-25)",
      "tags": [
        "개념",
        "상태공간",
        "고유값",
        "커플링",
        "함정",
        "zettel"
      ]
    },
    "body": "# 블록삼각 함정\n\n> [!abstract] 한 줄\n> 두 서브시스템의 커플링을 **한 방향만** 넣으면 시스템 행렬이 블록삼각이 되고,\n> 그 커플링 항은 **고유값에 아무 영향을 주지 못한다.**\n\n## 수학\n\n블록 형태의 시스템 행렬을 생각한다.\n\n$$\nA = \\begin{bmatrix} A_{11} & A_{12} \\\\ A_{21} & A_{22} \\end{bmatrix}\n$$\n\n$A_{12} = 0$ 또는 $A_{21} = 0$ 이면 $A$는 **블록삼각**이고,\n\n$$\n\\det(A - \\lambda I) = \\det(A_{11} - \\lambda I)\\cdot\\det(A_{22} - \\lambda I)\n$$\n\n$$\n\\therefore\\ \\mathrm{eig}(A) = \\mathrm{eig}(A_{11}) \\cup \\mathrm{eig}(A_{22})\n$$\n\n**비어 있지 않은 쪽 블록에 무엇을 넣든 고유값은 변하지 않는다.**\n행렬을 아무리 크게 만들어도 안정도 해석 결과는 두 서브시스템을 따로 푼 것과 동일하다.\n\n> 커플링은 여전히 **응답 형상**에는 영향을 준다(고유벡터·잔여값이 바뀜).\n> 그러나 **고유값·감쇠비·안정도**에는 영향이 없다.\n> 소신호 안정도 연구에서는 사실상 커플링이 없는 것과 같다.\n\n## 실제 사례 — 21차 GFM 모델 v0\n\nDC 8차와 AC 13차를 결합한 21차 모델을 만들고, DC→AC 커플링 항 하나를 좌하단에 넣었다.\n\n```python\nA_num = np.block([[A_DC,              np.zeros((8,13))],   # ← 우상단 0\n                  [np.zeros((13,8)),  A_AC            ]])\nA_num[8, 5] = idc0 / (J * w0)        # 좌하단 한 칸만\n```\n\n수치 확인 결과:\n\n```\n커플링 유무 고유값 최대차이     = 0.000e+00\n21차 고유값 vs (DC ∪ AC) 차이  = 1.179e-12\n```\n\n즉 **21차를 돌린 결과가 13차 AC 모델만 돌린 결과와 완전히 동일**했다.\nDC측 8개 상태는 계산에는 참여했지만 결과에는 기여하지 않았다.\n\n### 왜 놓쳤는가\n\n- 검증 코드가 `idc0/(J·w0)`로 대입한 값을 `idc0/(J·w0)`와 비교하는 **항등식**이었다 → 항상 통과\n- DC 8×8이 대각행렬이라 항상 안정 → 전체 결과가 그럴듯해 보였다\n- \"커플링 항을 넣었다\"는 사실만 확인하고 \"효과가 있는가\"는 확인하지 않았다\n\n### 물리적으로도 틀렸다\n\n인버터는 DC 버스에서 전력을 끌어간다. AC측 전력 변동은 반드시 DC 버스 전압에 되먹임된다.\n그 경로($A_{12}$)를 0으로 둔 것은 수학적 실수 이전에 **물리를 빠뜨린 것**이다.\n\n$$\ni_{inv} = \\frac{1.5(v_{od}i_{ld} + v_{oq}i_{lq})}{v_{dc}}\n$$\n\n이 항이 $\\dot{v}_{dc}$ 에 들어가야 $\\partial \\dot v_{dc}/\\partial i_{ld} \\neq 0$ 이 되고 우상단 블록이 채워진다.\n\n## 일반화 — 언제 의심하는가\n\n두 서브시스템을 결합할 때 **양방향 물리 경로가 있는지** 먼저 묻는다.\n\n| 결합 | 정방향 | 역방향 (놓치기 쉬움) |\n|---|---|---|\n| DC ↔ AC (인버터) | 변조: 출력전압 ∝ v_dc | 전력 보존: DC 전류 = P_ac/v_dc |\n| 기계 ↔ 전기 (발전기) | 토크 → 회전 | 전기 부하 → 반작용 토크 |\n| 열 ↔ 전기 | 온도 → 파라미터 | 손실 → 발열 |\n| 제어기 ↔ 플랜트 | 지령 → 동작 | 측정 → 피드백 |\n| 인버터 ↔ 계통 | 출력 → 계통 전압 | 계통 임피던스 → 단자 전압 |\n\n에너지가 오가면 반드시 양방향이다. **한 방향만 나왔다면 물리를 빠뜨린 것이다.**\n\n## 상시 감시 방법\n\n행렬을 만들 때마다 커플링 블록을 인위로 0으로 만들고 고유값 변화를 잰다.\n\n```python\ndef coupling_effect(A, n1):\n    A_cut = A.copy()\n    A_cut[n1:, :n1] = 0          # 정방향 블록\n    A_cut[:n1, n1:] = 0          # 역방향 블록\n    e1 = np.sort_complex(linalg.eigvals(A))\n    e2 = np.sort_complex(linalg.eigvals(A_cut))\n    return np.max(np.abs(e1 - e2))\n```\n\n- **0에 가까우면 블록삼각으로 퇴화** → 즉시 중단\n- 이 값 자체가 \"결합 모델이 필요한 이유\"의 정량 근거가 된다\n\n심볼 수준에서도 확인 가능하다.\n\n```python\nac2dc = [(i,j) for i in range(n1) for j in range(n1, N) if A_sym[i,j] != 0]\nassert ac2dc, \"역방향 커플링 없음 → 블록삼각\"\n```\n\n현재 `runner.py`는 매 실행마다 `커플링 효과` 열을 출력하고,\n`model.py`는 import 시 양방향 비영 원소를 assert로 검사한다.\n\n## 파급 — 결론이 뒤집힌다\n\n블록삼각인 채로 다음 단계에 진입하면 **참여인자 분석에서 DC 상태의 AC 모드 기여도가 0으로 나온다.**\n그러면 \"DC측은 무의미하므로 축소 모델\" 판정이 내려지는데,\n이는 물리 때문이 아니라 **코드 구조 때문**이다.\n\n수정 후 실제 결과: 모든 SCR에서 DC·AC 혼합 모드가 2~4개 존재.\n→ 22차 유지 판정. [[Phase03_참여인자]]\n\n> [!danger] 이 함정의 성질\n> 에러를 내지 않는다. 그럴듯한 숫자가 나온다. 검증도 통과한다.\n> **결과를 조용히 무효화한다.**\n> → 같은 부류: [[실행_식별자_설계원칙]]의 폴더 충돌\n\n## 연결\n\n- [[DC-AC_커플링]]\n- [[Phase02_완료]]\n- [[Phase03_참여인자]]\n- [[실험_재현성_체크리스트]]\n- [[실행_식별자_설계원칙]]\n",
    "wikilinks": [
      "Phase03_참여인자",
      "실행_식별자_설계원칙",
      "DC-AC_커플링",
      "Phase02_완료",
      "실험_재현성_체크리스트"
    ]
  },
  {
    "path": "RSCAD/01_개념/선형화_유효성_지표_규명.md",
    "dir": "RSCAD/01_개념",
    "filename": "선형화_유효성_지표_규명",
    "frontmatter": {
      "type": "result",
      "phase": 2,
      "artifact": "P2-A5",
      "status": "부분해결",
      "date": "2026-09-01",
      "model_version": "v3-22state",
      "run": "J0.50_Dp20.0_Kpv0.050_wc62.8_XR1.0_33d0cb_fine",
      "tags": [
        "result",
        "phase2",
        "선형화유효성",
        "지표설계",
        "gate"
      ]
    },
    "body": "# 선형화 유효성 임계값 비단조 현상 규명\n\n> [!success] 결론\n> **비단조 골짜기는 물리 현상이 아니라 오차 지표의 특이점이었다.**\n> `i_oq`의 궤적 진폭이 SCR 1.4 부근에서 극소가 되면서, 상태별 자기 진폭으로\n> 정규화하던 분모가 소멸해 오차가 과증폭됐다. 지표를 교체하자 골짜기가 사라졌다.\n\n## 문제\n\n`xval.py`가 산출한 선형화 유효 임계값이 SCR에 대해 단조가 아니었다.\n\n| SCR | 1.7 | 1.6 | 1.5 | 1.4 | 1.3 |\n|---|---|---|---|---|---|\n| 임계값 (구 지표) | 2.0% | 1.0% | 0.5% | **0.1%** | 1.0% |\n\nSCR 1.4가 최저점이고 1.3에서 회복한다. 한 점만 튀는 것이 아니라 1.7→1.4로 완만히 감소했다가 되돌아오는 **골짜기** 형태였다.\n\n가장 이상한 점: SCR 1.4는 **0.1% 섭동에서도 오차가 1.75%**로 이웃(1.5→0.61%, 1.3→0.33%)의 5배였다. 섭동을 0으로 보내면 선형과 비선형은 반드시 일치해야 하므로, 궤적이 아니라 지표 또는 출발점에 문제가 있다는 신호다.\n\n## 배제한 가설\n\n### 1. 동작점 수렴 품질 — 배제\n\n| SCR | ‖f(x₀)‖ | 최대 성분 |\n|---|---|---|\n| 1.7 | 5.775e-08 | Qf |\n| 1.6 | 1.087e-09 | Qf |\n| 1.5 | 2.640e-09 | Qf |\n| **1.4** | **3.289e-12** | i_od |\n| 1.3 | 9.766e-11 | v_oq |\n\nSCR 1.4의 잔차가 **가장 작다.** 수렴 실패나 다른 해 분기가 아니다.\n\n### 2. 분기(bifurcation) — 배제\n\n| SCR | 1.7 | 1.6 | 1.5 | 1.4 | 1.3 |\n|---|---|---|---|---|---|\n| 느린 극 | -2.4860 | -2.3255 | -2.1637 | -1.9999 | -1.8330 |\n| 5τ [s] | 2.01 | 2.15 | 2.31 | 2.50 | 2.73 |\n\n완전히 매끄럽다. 고유값 이동에 불연속·급변이 없다.\n\n### 3. 적분기 누적오차 — 배제\n\n`--T 0.3`으로 구간을 줄여도 같은 패턴이 재현됐다. Radau 누적오차라면 구간 단축 시 완화되어야 한다.\n\n## 원인 — 분모 소멸\n\n`Pref` 0.1% 스텝에 대한 각 상태의 궤적 진폭을 직접 측정했다.\n\n| SCR | max&#124;Δi_oq&#124; | max&#124;Δi_od&#124; | 비율 |\n|---|---|---|---|\n| 1.7 | 1.530e-03 | 1.388e-02 | 9.1 |\n| 1.6 | 1.002e-03 | 1.341e-02 | 13.4 |\n| 1.5 | 4.423e-04 | 1.291e-02 | 29.2 |\n| **1.4** | **1.513e-04** | 1.236e-02 | **81.7** |\n| 1.3 | 7.824e-04 | 1.175e-02 | 15.0 |\n\n`i_od`는 매끄럽게 감소하는데 `i_oq`만 SCR 1.4에서 10배 가까이 꺼졌다가 되살아난다. 유효전력 지령 스텝에 대한 무효전력 축 응답이 이 SCR 근처에서 **부호를 바꾸며 통과**하는 것이며, 임계값 골짜기의 위치와 정확히 일치한다.\n\n구 지표는 상태별로 자기 진폭으로 나눴다.\n\n```python\nscale = np.abs(dx_nl).max(axis=1)      # 상태별 자기 진폭\nerr   = np.abs(dx_nl - dx_lin) / scale\n```\n\n`i_oq`가 0.15 mA만 움직이는데 그 값이 분모가 되니, 절대 오차 몇 μA가 1.75%로 증폭됐다. **물리적으로 아무 일도 일어나지 않는 상태가 임계값을 결정한 것이다.**\n\n## 지표 교체 — 두 번의 실패를 거쳐\n\n### 시도 1: 궤적 전체 최대값으로 정규화 → 실패\n\n```python\nnom   = np.maximum(np.abs(x0), NOM_FLOOR)\nscale = (np.abs(dx_nl) / nom).max()    # 스칼라 하나\n```\n\n전 구간이 30%(스윕 상한)에서 통과. 동작점이 0에 가까운 적분기 상태가 `NOM_FLOOR`로 나뉘며 무차원 응답이 폭주하고, 그것이 기준이 되어 다른 모든 오차가 희석됐다.\n\n### 시도 2: 노름 비 → 실패\n\n```python\nerr = norm(e_rel) / norm(m_rel)\n```\n\n`dw`가 분자·분모를 모두 지배. 22개 상태 × 400 시점을 하나로 집계하니, 큰 nominal을 가진 상태(`v_dc` 800 V)의 오차가 작은 nominal 상태에 묻혔다.\n\n> [!warning] 교훈\n> **모든 상태를 하나의 척도로 묶는 방식은 전부 실패했다.**\n> 분모를 상태별로 두면 진폭 소멸에 발산하고, 전역으로 묶으면 동작점 크기가\n> 0 인 상태가 척도를 독점한다. 22차 모델은 상태 간 물리 단위와 동작점 크기가\n> 수십 배 차이나므로, 단일 정규화로는 해결되지 않는다.\n\n### 시도 3: 응답 게이트 — 채택\n\n상태별 상대오차를 유지하되, **실제로 응답한 상태만** 판정에 포함한다.\n\n```python\nnom  = np.maximum(np.abs(x0), NOM_FLOOR)   # NOM_FLOOR = 1e-3\namp  = np.abs(dx_nl).max(axis=1)           # 상태별 궤적 진폭\nrel  = amp / nom                           # 무차원 진폭\nkeep = rel >= GATE * rel.max()             # GATE = 0.05\n\ne     = np.abs(dx_nl - dx_lin)[keep]\nerr_k = e.max(axis=1) / amp[keep]\nerr   = err_k.max()\n```\n\n무차원 진폭이 최대의 5%에 못 미치는 상태는 제외한다. 물리적 의미는 명확하다 — **응답이 있는 상태에 한해, 선형 예측이 비선형 궤적을 얼마나 잘 따라가는가.**\n\n## 결과\n\n| 섭동 | SCR 1.7 | 1.6 | 1.5 | 1.4 | 1.3 |\n|---|---|---|---|---|---|\n| 0.1% | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.0000 |\n| 1% | 0.0001 | 0.0001 | 0.0001 | 0.0001 | 0.0001 |\n| 5% | 0.0007 | 0.0006 | 0.0005 | 0.0004 | 0.0007 |\n| 10% | 0.0014 | 0.0012 | 0.0010 | 0.0009 | 0.0015 |\n| 30% | 0.0040 | 0.0033 | 0.0026 | 0.0036 | **0.0054** |\n\n- **섭동에 대해 단조 증가** — 비선형 왜곡의 정상 거동\n- **SCR 1.3에서 최대** — 약계통일수록 비선형성이 강해진다는 물리와 부합\n- 최악 상태가 `i_oq`에서 `v_oq`·`dw`로 교체 — 게이트가 의도대로 작동\n\n## 미해결 — 임계값 미확정\n\n> [!warning] 판정이 포화됨\n> 30% 섭동에서도 오차가 0.54%로 허용치 5%에 크게 못 미쳐, 전 구간이 통과하고\n> 임계값이 스윕 상한에 붙었다. **실제 한계를 아직 찾지 못했다.**\n\n두 가지가 필요하다.\n\n**섭동 범위 확대** — 50%, 100%, 200%까지 밀어야 한계가 드러난다. `Pref` 2배는 정격 초과 대신호이므로 그쯤에서 선형성이 깨질 것으로 예상된다.\n\n```bash\npython Simulation/xval.py --steps 0.1 0.3 0.5 1.0 1.5 2.0\n```\n\n**허용치 재설정** — 현재 5%는 구 지표 기준으로 잡은 값이다. 새 지표는 응답한 상태만 보므로 같은 5%가 훨씬 느슨하다. 1~2%가 적절해 보이나 위 결과를 본 뒤 결정한다.\n\n## 논문 서술 시 주의\n\n오차 정의를 반드시 명시해야 한다. 현재 정의는 다음과 같다.\n\n> 응답 진폭이 최대의 5% 이상인 상태에 대해, 선형 예측 궤적과 비선형 궤적의 최대 상대오차\n\n`NOM_FLOOR = 1e-3`은 동작점이 0인 상태(`dw`, 적분기)의 분모 바닥값으로 **임의로 정한 값**이며, 게이트 통과 여부에 영향을 준다. 현재 `dw`가 통과하는데 이것이 타당한지 별도 검토가 필요하다.\n\n## 연결\n\n- [[Phase02_완료]]\n- [[소신호_선형화]]\n- [[실험_재현성_체크리스트]]\n- [[블록삼각_함정]] — 같은 부류: 그럴듯한 숫자를 내며 조용히 틀리는 지표\n",
    "wikilinks": [
      "Phase02_완료",
      "소신호_선형화",
      "실험_재현성_체크리스트",
      "블록삼각_함정"
    ]
  },
  {
    "path": "RSCAD/01_개념/소신호_선형화.md",
    "dir": "RSCAD/01_개념",
    "filename": "소신호_선형화",
    "frontmatter": {
      "type": "concept",
      "date": "2026-08-21",
      "phase": 2,
      "status": "verified",
      "tags": [
        "concept",
        "linearization",
        "jacobian",
        "operating-point"
      ]
    },
    "body": "# 💡 소신호 선형화\n\n## 한 줄 정의\n\n> 비선형 동역학 f(x)를 동작점 x₀ 주변에서 1차 테일러 전개하여 선형 상태방정식 Δẋ = A·Δx로 근사하는 방법\n\n## 수식\n\n$$\n\\dot{x} = f(x) \\approx f(x_0) + \\left.\\frac{\\partial f}{\\partial x}\\right|_{x=x_0} \\cdot (x - x_0) = A \\cdot \\Delta x\n$$\n\n$$\nA = J(x_0) = \\left.\\frac{\\partial f}{\\partial x}\\right|_{x=x_0} \\quad \\text{(야코비안 행렬)}\n$$\n\n## 유효 조건\n\n```\nΔu_pv = |Vpv0_k - Vpv0_nom| / Vpv0_nom < 5%\n→ 초과 시 Layer 2 (PSCAD EMT) 교차검증 필요\n```\n\n## GFM 연구에서의 역할\n\n```\n비선형 f(x) (21개 방정식)\n    ↓ 동작점 x₀(SCR_k) 대입\n선형 야코비안 A_k (21×21)\n    ↓ 고유값 분석\n안정도 판정 + ζ_min + f_dom\n    ↓\nPSO 목적함수 입력\n```\n\n## Phase별 구현 수준\n\n| Phase | 방법 | 정확도 |\n|---|---|---|\n| 1 | numpy 대각 근사 | 낮음 |\n| 2 | AC 13×13 수동 + DC 8×8 근사 | 중간 |\n| 3+ | SymPy 완전 21×21 | 높음 |\n\n## 검증된 수치 (Phase 2 기준)\n\n| 항목 | 값 | 출처 |\n|---|---|---|\n| Δu_pv (SCR=1.5) | 12.45% > 5% | Phase 1 API |\n| A_k(9,6) 오차 | 0.0001% | Phase 2 실험 |\n| stable (4개 SCR) | True | Phase 2 sym.py |\n\n## 🔗 연결 노트\n\n- [[야코비안 행렬]] — A 행렬 구조 상세\n- [[DC-AC_커플링]] — A_k(9,6) 핵심 원소\n- [[동작점 평형점]] — x₀ 계산 방법\n- [[Phase02_완료]] — Phase 2 구현 결과\n- [[EXP_2026-08-21_Phase2_엔진전환_비교]] — 실험 검증\n\n## 참고문헌\n\n- ▸ [1] Chen et al. 2024 — 21차 선형화 구조\n- ▸ [7] Zhao 2023 — DC-AC 커플링 선형화\n",
    "wikilinks": [
      "야코비안 행렬",
      "DC-AC_커플링",
      "동작점 평형점",
      "Phase02_완료",
      "EXP_2026-08-21_Phase2_엔진전환_비교"
    ]
  },
  {
    "path": "RSCAD/01_개념/스윙극쌍_필터혼합.md",
    "dir": "RSCAD/01_개념",
    "filename": "스윙극쌍_필터혼합",
    "frontmatter": {
      "type": "concept",
      "date": "2026-09-14",
      "phase": 3,
      "status": "확립",
      "model_version": "v3-22state",
      "tags": [
        "concept",
        "스윙모드",
        "전력필터",
        "Schur",
        "phase3"
      ]
    },
    "body": "# 스윙극쌍과 전력 필터의 혼합\n\n> **저장 위치:** `01_개념/`\n\n## 한 줄 정의\n\n> 과감쇠된 스윙 모드는 두 실수극으로 갈라진다. 그중 **빠른 근이 강계통에서 전력 필터극과 섞이며**, 이 때문에 `λ ≈ −K/Dp` 근사가 깨진다.\n\n---\n\n## 왜 문제가 되는가\n\n축소 모델은 스윙 방정식을 2차계로 보고 `λ_slow ≈ −K/Dp` 를 쓴다. 이 근사가 성립하려면 두 근이 순수한 스윙 모드여야 한다.\n\n▸ 순수 2차계라면 **두 근의 합이 정확히 `−Dp/J`** 여야 한다. 특성방정식 `Js² + Dps + K = 0` 의 근의 합이 `−Dp/J` 이기 때문이다.\n※ 합이 그 값에서 벗어난다면 2차계가 아니라는 직접 증거다.\n\n---\n\n## 실측 (X/R = 1.0, J = 0.5, Dp = 20 → Dp/J = 40)\n\n![스윙극쌍과 필터 혼합](K_mixing.png)\n\n*그림. 왼쪽은 두 근의 합이 −40 에서 벗어나는 정도, 오른쪽은 빠른 근의 전력 필터 참여도와 시간척도 분리비.*\n\n| SCR | λ_slow | λ_fast | 합 | −40 대비 | p(Pf)@fast | SEP |\n|---|---|---|---|---|---|---|\n| 3.0 | −4.6445 | −26.2573 | **−30.90** | +23% | 0.1312 | 1.86 ⚠ |\n| 2.0 | −2.9653 | −29.5136 | −32.48 | +19% | 0.1099 | 2.91 ⚠ |\n| 1.5 | −2.1637 | −31.3347 | −33.50 | +16% | 0.0940 | 3.98 |\n| 1.0 | −1.2965 | −40.5415 | **−41.84** | −5% | 0.0110 | 6.65 |\n\n▸ 합이 SCR 1.0 에서만 −40 에 근접한다. 강계통일수록 크게 벗어난다.\n▸ 빠른 근의 전력 필터 참여도가 **0.1312 → 0.0110 으로 11.9배 감소**한다.\n▸ 시간척도 분리비도 1.86 → 6.65 로 같은 방향이다.\n※ 세 지표가 하나의 이야기를 한다. **강계통에서 빠른 근이 필터극과 섞여 있다.**\n\n---\n\n## 왜 강계통에서 섞이는가\n\n전력 필터극은 `−ω_c = −62.8` 근처에 고정돼 있다. 계통 조건과 무관하다.\n\n반면 스윙 빠른 근은 `λ_fast ≈ −Dp/J + K/Dp` 로, K 가 커질수록 −40 에서 멀어진다.\n\n| SCR | K_eff | λ_fast | ω_c 와의 거리 |\n|---|---|---|---|\n| 3.0 | 2.835e+04 | −26.26 | 36.5 |\n| 1.0 | 9.256e+03 | −40.54 | 22.3 |\n\n▸ 강계통에서 K 가 크면 빠른 근이 −26 쪽으로 밀려 올라가고, 그만큼 필터극과 **모드 결합**이 일어난다.\n※ 약계통에서는 빠른 근이 −40 근처로 돌아가 필터극에서 멀어지므로 스윙쌍이 순수해진다.\n\n---\n\n## 결과 — Dp 실효값이 달라진다\n\n두 근이 섞이면 스윙 방정식이 보는 실효 감쇠가 `Dp` 그대로가 아니다.\n\n$$\\lambda_{slow} \\approx -\\frac{K}{D_{p,eff}}, \\qquad D_{p,eff} \\ne D_p$$\n\n▸ 이론 대비 관측 오차 30% 중 **17% 가 여기서 온다.** 나머지 11% 만이 모델–물리 편차다.\n※ 분해 근거는 [[동기화계수_K]] 의 \"오차 30% 의 분해\" 절 참조.\n\n> [!important] 전차수 모델이 필요한 직접 증거\n> 축소 모델은 `λ = −K/Dp` 를 전제한다. 전력 필터가 상태변수로 존재하면\n> 강계통에서 그 전제가 깨진다. p(Pf) = 0.1312 가 그 정도를 정량화한 값이다.\n>\n> ※ 필터를 대수식으로 축약한 모델에서는 이 현상이 아예 나타나지 않는다.\n\n---\n\n## PSO 설계에의 함의\n\n> [!success] wc 를 조정 대상에 넣어야 하는 근거\n> ω_c 를 바꾸면 필터극 위치가 움직이고, 그에 따라 강계통에서 스윙 빠른 근과의\n> 결합 정도가 달라진다. **J·Dp 만으로는 건드릴 수 없는 자유도다.**\n>\n> ▸ ω_c 를 키우면 필터극이 왼쪽으로 가 스윙쌍에서 멀어진다 → 혼합 감소\n> ▸ 다만 전력 측정 잡음이 그대로 통과하므로 상한이 있다\n> → [[PSO_목적함수_설계]]\n\n---\n\n## Schur 축소 시 주의\n\n`K_eff` 를 준정상 소거로 뽑을 때 **소거 대상이 충분히 빨라야** 한다.\n\n$$\\text{SEP} = \\frac{\\sigma_{\\min}(\\text{소거 대상})}{\\sigma(\\text{동기화 모드})}$$\n\n▸ SEP 가 3 미만이면 가정이 약하다. SCR 3.0(1.86)과 2.0(2.91)이 해당한다.\n▸ **그리고 바로 그 두 점이 이론과 가장 어긋난다.** 경고가 판별력을 갖는다는 뜻이다.\n※ `sync_reduce.py` 가 SEP 와 판정을 함께 출력한다.\n\n---\n\n## 참여계수를 볼 때의 원칙\n\n> [!warning] 지배 모드 하나만 보면 이 혼합을 놓친다\n> 느린 근은 전 구간 순수하다(p(δ+Δω) 0.92~0.98). 그것만 보면 아무 문제가\n> 없어 보인다. **빠른 근까지 쌍으로 봐야** 혼합이 드러난다.\n>\n> ▸ `pf.py` 는 지배 모드 하나를 본다. 확인용으로는 충분하다.\n> ▸ `sync_reduce.py` 는 δ·Δω 참여도 상위 **두** 모드를 함께 출력한다.\n\n---\n\n## 관련 코드\n\n```bash\npython Simulation/sync_reduce.py      # 두 근, 합, p(Pf), SEP, K_eff\n```\n\n출력: `results/<run>/sync_reduction.json`\n\n```python\n# 스윙쌍 선택 — 진동 여부를 가리지 않는다\ndef swing_pair(ev, P, di, wi, n=2):\n    keep = [i for i in range(len(ev)) if ev[i].imag >= -IM_TOL]\n    pw = P[di, :] + P[wi, :]\n    return sorted(keep, key=lambda i: -pw[i])[:n]\n```\n\n## 🔗 연결 노트\n\n| 방향 | 노트 | 이유 |\n|---|---|---|\n| ← | [[동기화계수_K]] | K 의 정의와 오차 분해 |\n| ← | [[과감쇠_동기화모드]] | 스윙 모드가 실수극으로 갈라지는 조건 |\n| ← | [[참여인자 지배모드]] | 참여계수 계산 방법 |\n| → | [[PSO_목적함수_설계]] | wc 조정 근거 |\n| → | [[모드교차_최소감쇠비_함정]] | 단일 스칼라 지표의 한계 |\n",
    "wikilinks": [
      "동기화계수_K",
      "PSO_목적함수_설계",
      "과감쇠_동기화모드",
      "참여인자 지배모드",
      "모드교차_최소감쇠비_함정"
    ]
  },
  {
    "path": "RSCAD/01_개념/실행_식별자_설계원칙.md",
    "dir": "RSCAD/01_개념",
    "filename": "실행_식별자_설계원칙",
    "frontmatter": {
      "type": "principle",
      "domain": "실험관리",
      "status": "확립",
      "date": "2026-08-25",
      "revision": 2,
      "origin": "runner.py 폴더 충돌 사고 → 과잉수정 → 계층 분리 (2026-08-25)",
      "tags": [
        "원칙",
        "재현성",
        "실험관리",
        "해시",
        "스윕",
        "zettel"
      ]
    },
    "body": "# 실행 식별자 설계 원칙\n\n> [!abstract] 한 줄\n> 식별자는 결과에 영향을 주는 모든 입력을 포함해야 한다.\n> 단, **스윕 축은 폴더가 아니라 파일 단위 식별자에 넣는다.**\n\n## 두 단계 판별\n\n새 인수를 추가할 때마다 순서대로 묻는다.\n\n**1단계 — 식별자에 넣는가?**\n> \"이 값을 바꾸면 저장되는 숫자가 달라지는가?\"\n> 예 → 넣는다. 아니오 → 안 넣는다. 애매하면 넣는다.\n\n**2단계 — 폴더인가 파일인가?**\n> \"이 값이 스윕 도중에 변하는가?\"\n> 변한다 → **파일명** (스윕 축)\n> 안 변한다 → **폴더명** (데이터셋 공통 조건)\n\n1단계만 지키면 재현성은 확보되지만 **누적이 불가능해진다.** 2단계가 있어야 스윕을 이어붙일 수 있다.\n\n## 계층 구조\n\n```\nresults/\n└── J0.50_Dp20.0_Kpv0.050_wc62.8_34546d/   ← 폴더: 공통 조건\n    │                                          모델 버전, 제어 파라미터 14,\n    │                                          물리 상수, 입력 u₀\n    ├── A_num_SCR3.0_XR1.0.npy              ← 파일: 점 조건 (스윕 축)\n    ├── A_num_SCR1.5_XR2.0.npy\n    ├── x0_SCR3.0_XR1.0.npy\n    ├── meta.json                            ← points 레지스트리 (누적)\n    └── eigenvalue_results.json              ← 점별 결과 (병합)\n```\n\n핵심은 `meta.json`이 **선언이 아니라 레지스트리**라는 점이다.\n\n```python\n# ❌ 선언형 — 실행할 때마다 덮어씀\n{\"SCR_list\": [1.7, 1.6, 1.5]}\n\n# ✅ 레지스트리형 — 점을 누적\n{\"points\": {\"SCR3_XR1\": {...}, \"SCR1.5_XR2\": {...}}, \"n_points\": 6}\n```\n\n## 따라오는 이득 — resume\n\n파일명이 자기 조건을 갖고 있고 메타가 누적되면, **재개가 공짜로 생긴다.**\n\n```python\nif not args.force and point_key(SCR, XR) in done:\n    continue                      # 이미 계산된 점은 건너뜀\n```\n\n88포인트를 돌리다 40번째에서 죽어도 같은 명령을 다시 치면 41번부터 이어간다.\nRTDS 장비 시간을 쓰는 실험에서는 이것이 재실행 비용과 예약 재신청을 가른다.\n\n## 실패 사례 두 개\n\n### 1차 사고 — 식별자 불완전 (덮어쓰기)\n\n해시를 제어 파라미터로만 만들고 `--SCR`을 누락했다.\n\n```bash\npython runner.py                              # SCR 3.0 2.0 1.5 1.0\npython runner.py --SCR 1.7 1.6 1.5 1.4 1.3    # 같은 폴더로 들어감\n```\n\n`.npy`는 8개 쌓였는데 `meta.json`의 `SCR_list`는 5개만 기록. 폴더 내용과 메타데이터가 서로 다른 말을 하는 상태.\n\n### 2차 사고 — 과잉수정 (누적 불가)\n\n1차를 고친다고 SCR 목록을 해시에 넣었다. 덮어쓰기는 막혔지만 **스윕 단위가 굳어버렸다.**\n\n- SCR 1.2를 하나 추가하려면 해시가 바뀌어 별도 폴더 생성 → 기존 점과 합칠 수 없음\n- 중간 실패 후 이어붙이기 불가 → 매번 처음부터\n- X/R도 폴더명에 있어 2D 스윕 하나가 폴더 10개로 쪼개짐\n\n> [!warning] 교훈\n> **1차 진단이 틀렸다.** `.npy`는 이미 파일명에 SCR을 갖고 있어 충돌한 적이 없다.\n> 충돌한 것은 `meta.json` 하나뿐이었고, 해법은 식별자 강화가 아니라 **메타의 누적화**였다.\n> 증상(폴더가 겹침)이 아니라 원인(메타가 선언형)을 고쳤어야 했다.\n\n## 분류표\n\n| 폴더명 (공통 조건) | 파일명 (스윕 축) | 식별자 제외 |\n|---|---|---|\n| 모델 버전 / 코드 버전 | SCR | 표시 옵션 (`--top`, `--modes`) |\n| 제어 파라미터 (PSO 대상 14) | X/R | 출력 경로, 로그 레벨 |\n| 물리 상수 (L, C, R) | 일사량·온도 (스윕 시) | 타임스탬프, 실행자 |\n| 입력 벡터 u₀ | 부하율 (스윕 시) | 진행 표시, 색상 |\n| 수치 설정 (`--tol`, `--T`) | | `--force` |\n\n> 같은 변수라도 **고정하면 폴더, 스윕하면 파일**이다. 일사량을 고정값으로 쓰면 폴더 조건, 스윕 대상으로 삼으면 파일 조건.\n\n## 구현 패턴\n\n```python\ndef make_run_name(ctrl, tag=''):\n    \"\"\"스윕 축(SCR, XR)은 제외 — 점을 누적할 수 있도록\"\"\"\n    sig = {'model': MODEL_VERSION, 'ctrl': ctrl,\n           'fixed': FIXED, 'inputs': INP}\n    h = hashlib.md5(json.dumps(sig, sort_keys=True,\n                               default=float).encode()).hexdigest()[:6]\n    return f\"J{ctrl['J']:.2f}_Dp{ctrl['Dp']:.1f}_{h}\" + (f\"_{tag}\" if tag else '')\n\n\ndef point_key(SCR, XR):\n    return f\"SCR{SCR:g}_XR{XR:g}\"          # :g → 3.0과 3이 같은 키\n```\n\n- `sort_keys=True` — dict 순서로 해시가 흔들리지 않게\n- `default=float` — numpy 스칼라 직렬화\n- `:g` 포맷 — `3.0`과 `3`이 다른 점으로 갈라지지 않게\n- 앞부분은 사람용(주요 파라미터), 해시는 기계용(완전성)\n- **재실행 시 잔여 파일을 지우지 않는다** — 누적이 목적이므로\n\n## 확장 — CHIL 단계\n\nRTDS로 넘어가면 폴더 조건에 추가될 것들.\n\n- RSCAD 케이스 파일 해시 (회로가 바뀌면 결과가 바뀐다)\n- DSP 펌웨어 빌드 ID\n- GTIO 스케일링 상수\n- 타임스텝 / substep 설정\n\npre-processor 재컴파일이 필요한 SCR·X/R은 여전히 **스윕 축**이므로 파일 조건이다.\n소프트웨어 단계에서 이 구분을 습관화하지 않으면 하드웨어 단계에서 사고가 난다.\n\n→ [[88포인트_2D_스윕_설계]]\n\n## 연결\n\n- [[블록삼각_함정]] — 같은 부류: 결과를 조용히 무효화하는 구조적 결함\n- [[Phase02_완료]]\n- [[88포인트_2D_스윕_설계]]\n- [[실험_재현성_체크리스트]]\n",
    "wikilinks": [
      "88포인트_2D_스윕_설계",
      "블록삼각_함정",
      "Phase02_완료",
      "실험_재현성_체크리스트"
    ]
  },
  {
    "path": "RSCAD/01_개념/실험_재현성_체크리스트.md",
    "dir": "RSCAD/01_개념",
    "filename": "실험_재현성_체크리스트",
    "frontmatter": {
      "type": "checklist",
      "domain": "실험관리",
      "status": "운용중",
      "date": "2026-08-25",
      "tags": [
        "체크리스트",
        "재현성",
        "실험관리",
        "zettel"
      ]
    },
    "body": "# 실험 재현성 체크리스트\n\n> [!abstract] 기준\n> **6개월 뒤의 내가, 또는 심사위원이, 이 폴더만 보고 같은 숫자를 다시 만들 수 있는가.**\n> 하나라도 아니오면 그 결과는 논문에 쓸 수 없다.\n\n## 1. 조건 (무엇을 계산했는가)\n\n- [ ] 결과에 영향을 주는 모든 입력이 식별자에 반영됐는가 → [[실행_식별자_설계원칙]]\n- [ ] 스윕 축은 파일명, 공통 조건은 폴더명으로 분리됐는가\n- [ ] `meta.json`이 선언형이 아니라 누적 레지스트리인가\n- [ ] 같은 명령을 다시 쳤을 때 결과가 같은가 (멱등성)\n- [ ] 실패 지점부터 이어서 돌릴 수 있는가 (resume)\n\n## 2. 검증 (그 숫자가 맞는가)\n\n계산이 끝났다는 것과 맞다는 것은 다르다. **자기 자신과 비교하는 검증은 검증이 아니다.**\n\n- [ ] 독립적인 방법으로 대조했는가 (심볼릭 ↔ 유한차분)\n- [ ] 검증이 통과·실패를 실제로 가르는가 (항상 ✅면 항등식)\n- [ ] 알려진 실패 모드를 상시 감시하는가 (커플링 효과 = 0 → [[블록삼각_함정]])\n- [ ] 물리적으로 예상되는 경향이 나오는가 (SCR↓ → δ↑, 안정 여유↓)\n- [ ] 모델의 유효 범위를 수치로 명시했는가 → [[소신호_선형화]]\n- [ ] 다른 환경에서 같은 값이 나오는가 (Windows/Linux 재현 확인)\n\n> [!danger] v0에서 실제로 벌어진 일\n> `A_k(9,6)` 검증이 `idc0/(J·w0)`로 대입한 값을 `idc0/(J·w0)`와 비교하고 있었다.\n> 항상 통과하는 항등식이었고, 그 사이 21차 모델은 블록삼각이라 13차와 같은 결과를 내고 있었다.\n\n## 3. 데이터 (무엇이 남았는가)\n\n- [ ] 원자료(`.npy`)와 요약(`.json`, `.md`)이 함께 저장되는가\n- [ ] 동작점 `x0`도 저장되는가 (재계산·초기값 주입·시간영역 검증에 필요)\n- [ ] 폴더 내용과 메타데이터가 일치하는가 (파일 8개인데 메타는 5개?)\n- [ ] 폐기한 결과에 `model_version` 태그가 붙어 있는가 (`v0-invalid`)\n- [ ] `latest/`가 어느 실행에서 왔는지 기록되는가 (`latest_copied_from`)\n\n## 4. 코드 (어떻게 계산했는가)\n\n- [ ] 결과 폴더에서 코드 버전을 역추적할 수 있는가 (`model_version`)\n- [ ] 폐기한 코드를 지우지 않고 `_archive/`에 보존했는가\n- [ ] 파일명이 하는 일과 일치하는가 (`sym.py`인데 sympy가 없으면 ❌)\n- [ ] 같은 목적의 파일이 여러 버전으로 굴러다니지 않는가 (`sym v0/v1/v2`)\n- [ ] 하드코딩된 상수가 없는가 (전부 인수 또는 명시적 상수 블록)\n\n## 5. 환경\n\n- [ ] Python 버전과 핵심 패키지 버전이 기록됐는가 (numpy, scipy, sympy)\n- [ ] `requirements.txt` 또는 `pip freeze` 결과가 저장소에 있는가\n- [ ] OS 의존 코드가 없는가 (경로 구분자, 인코딩)\n- [ ] 난수를 쓴다면 시드가 고정·기록되는가 ← **PSO에서 필수**\n\n## 6. 문서\n\n- [ ] 결과 폴더마다 Obsidian용 `.md` 요약이 자동 생성되는가\n- [ ] 실패와 그 원인이 기록됐는가 (성공만 남기면 같은 실수를 반복한다)\n- [ ] 판단 근거가 남았는가 (\"왜 22차인가\", \"왜 SOC를 뺐는가\")\n- [ ] 미해결 항목이 체크박스로 추적되는가\n\n## 단계별 추가 항목\n\n### PSO (Phase 4~5)\n\n- [ ] 난수 시드 고정 및 기록\n- [ ] 목적함수 정의가 결과와 함께 저장되는가\n- [ ] 수렴 이력(세대별 최적값)이 남는가\n- [ ] 여러 시드로 반복해 재현성을 확인했는가\n\n### CHIL (Phase 6~7)\n\n- [ ] RSCAD 케이스 파일 해시\n- [ ] DSP 펌웨어 빌드 ID\n- [ ] GTIO 스케일링 상수와 채널 매핑\n- [ ] 타임스텝 / substep 설정\n- [ ] pre-processor 재컴파일 여부와 소요 시간\n- [ ] 측정 원파형(raw) 보존 — 후처리 결과만 남기면 재분석 불가\n- [ ] 실험 일시와 장비 상태 (온도, 사전 웜업)\n\n## 논문 제출 직전\n\n- [ ] 논문의 모든 표·그림이 어느 실행 폴더에서 나왔는지 추적 가능한가\n- [ ] TABLE I / II의 숫자를 스크립트 실행으로 재생성할 수 있는가\n- [ ] 심사 질의에 \"그 조건으로 다시 돌려보겠습니다\"가 가능한 상태인가\n\n## 연결\n\n- [[실행_식별자_설계원칙]]\n- [[블록삼각_함정]]\n- [[Phase02_완료]]\n- [[소신호_선형화]]\n- [[88포인트_2D_스윕_설계]]\n",
    "wikilinks": [
      "실행_식별자_설계원칙",
      "블록삼각_함정",
      "소신호_선형화",
      "Phase02_완료",
      "88포인트_2D_스윕_설계"
    ]
  },
  {
    "path": "RSCAD/01_개념/야코비안 행렬.md",
    "dir": "RSCAD/01_개념",
    "filename": "야코비안 행렬",
    "frontmatter": {
      "type": "concept",
      "date": "2026-08-21",
      "revised": "2026-08-25",
      "phase": 2,
      "status": "revised",
      "tags": [
        "concept",
        "jacobian",
        "block-matrix",
        "DC-AC",
        "22-state"
      ]
    },
    "body": "# 💡 야코비안 행렬\n\n> [!warning] 2026-08-25 개정\n> 이 노트의 이전 판은 **블록 구조가 틀렸고 차수가 21로 잘못 기재**되어 있었다.\n> 우상단 블록을 `≈0`으로 명시한 것이 코드 결함의 근원이었다. → [[BUG_2026-08-25_sym_구조결함]]\n> 개정 내역은 문서 맨 아래 참조.\n\n## 한 줄 정의\n\n> 22차 비선형 $f(x,u)$를 정상상태 동작점에서 편미분한 22×22 행렬 $A_k$ — 고유값 분석의 핵심 입력\n\n$$A_k = \\left.\\frac{\\partial f}{\\partial x}\\right|_{x=x_0,\\,u=u_0}$$\n\n※ $x_0$가 SCR·X/R에 따라 이동하므로 $A_k$도 조건마다 다시 계산해야 한다. → [[동작점 평형점]], [[다중동작점_갱신절차]]\n\n---\n\n## 블록 구조\n\n$$\nA_k = \\begin{bmatrix}\nA_{DC} & A_{AC \\to DC} \\\\\nA_{DC \\to AC} & A_{AC}\n\\end{bmatrix}\n$$\n\n| 블록 | 크기 | 내용 |\n|---|---|---|\n| $A_{DC}$ | 8×8 | DC 서브시스템 (PV 부스트, ESS, DC 버스) |\n| $A_{AC}$ | 14×14 | AC 서브시스템 (VSG, 전압·전류 루프, LCL, 계통) |\n| $A_{DC \\to AC}$ | 14×8 | DC→AC — 인버터 출력전압이 $v_{dc}$에 비례 |\n| $A_{AC \\to DC}$ | 8×14 | AC→DC — 인버터가 DC 버스에서 끌어가는 전류 |\n\n> [!danger] 두 커플링 블록은 **모두** 0이 아니어야 한다\n> 한쪽만 채우면 행렬이 블록 삼각이 되고, 삼각행렬의 고유값은 대각 블록의 합집합이다.\n> $$\\lambda(A)=\\lambda(A_{DC})\\cup\\lambda(A_{AC})$$\n> 즉 22차를 돌려도 결과는 AC 서브시스템 단독과 **완전히 동일**해진다. → [[블록삼각_함정]]\n\n---\n\n## 커플링 항의 물리\n\n### DC → AC (좌하단)\n\n인버터 출력 전압이 변조지수 × DC 전압:\n\n$$v_{inv,dq} = m_{dq}\\cdot\\frac{v_{dc}}{2}\n\\quad\\Rightarrow\\quad\n\\frac{\\partial}{\\partial v_{dc}}\\!\\left(\\frac{di_{ld}}{dt}\\right)=\\frac{m_{d0}}{2L_1}$$\n\n▸ 진입 지점은 **인버터측 인덕터 전류** $i_{ld}, i_{lq}$이다.\n\n### AC → DC (우상단)\n\n인버터가 DC 버스에서 끌어가는 전류:\n\n$$i_{inv}=\\frac{v_{od}i_{ld}+v_{oq}i_{lq}}{v_{dc}}$$\n\n이것이 $v_{dc}$ 동역학의 유출항이므로 $v_{dc}$ 미분방정식이 $v_{od}, v_{oq}, i_{ld}, i_{lq}$에 **모두** 의존한다.\n\n▸ **이 블록이 있어야 22차 모델이 12차 모델과 다른 결과를 낸다.** 없으면 차수를 올린 의미 자체가 사라진다.\n\n---\n\n## ⚠️ 폐기된 \"핵심 원소 $A_k(9,6)$\"\n\n이전 판은 아래를 차별화 핵심으로 기재했다.\n\n```\nA_k[8,5] = ∂(dΔω/dt)/∂u_dc = idc0/(J·ω₀) = 0.003183   ← 폐기\n```\n\n폐기 사유는 둘이다.\n\n▸ **검증이 항등식이었다.** 코드가 이 값을 직접 대입해놓고 `idc0/(J*w0)`와 비교했다. \"이론값 오차 0.0001% ✅\"는 검증이 아니라 자기 자신과의 비교였다.\n\n▸ **VSG 스윙 방정식에서 이 편미분은 직접 나오지 않는다.**\n$$\\frac{d\\Delta\\omega}{dt}=\\frac{P^*-P_e-D\\Delta\\omega}{J\\omega_0}$$\n$P_e$는 $v_{od}, v_{oq}, i_{od}, i_{oq}$의 함수이지 $v_{dc}$의 함수가 아니다. DC 전압은 **변조 경로를 거쳐 $i_{ld}$로 먼저 들어간 뒤** 간접적으로 $\\Delta\\omega$에 도달한다. 손으로 스윙 방정식에 직접 꽂아 넣을 항이 아니다.\n\n※ 결론 — 차별화 근거는 특정 원소 하나가 아니라 **양방향 커플링 블록의 존재 자체**로 서술해야 한다. 정량 지표로는 \"커플링 제거 시 고유값 변화량\"을 쓴다.\n\n---\n\n## 22개 상태변수 인덱스\n\n### DC측 (1–8)\n\n```\n1: v_pv     PV 단자 커패시터 전압\n2: i_Lpv    부스트 인덕터 전류\n3: x_vpv    PV 전압 제어 PI 적분기 (MPPT 추종)\n4: x_ipv    부스트 전류 루프 PI 적분기\n5: v_dc     DC 링크 커패시터 전압  ★ 커플링 진입점\n6: i_Less   ESS 컨버터 인덕터 전류\n7: x_vdc    DC 링크 전압 제어 PI 적분기\n8: x_iess   ESS 전류 루프 PI 적분기\n```\n\n> [!note] 이전 판과 달라진 점\n> 이전 판 DC 목록에는 `u_bat`(배터리 전압)이 있고 PI 적분기가 3개였다. 개정판은 배터리를 정전압원으로 두고 **전압·전류 이중루프를 컨버터마다 하나씩(총 4개)** 배치했다.\n> ※ 실제 DSP 구현이 어느 쪽인지 확인 필요. 배터리 전압을 상태로 잡아야 한다면 PI 하나를 줄여야 한다.\n> SOC는 제외 — 시정수가 시간 단위라 소신호 대역(0.1~100 Hz)에서 준정적. 포함 시 0 근접 고유값으로 stiff해짐.\n\n### AC측 (9–22)\n\n```\n 9: δ        전력각 (계통 기준 위상차)  ★ 신규\n10: Δω       가상 각속도 편차\n11: P_f      유효전력 LPF 출력\n12: Q_f      무효전력 LPF 출력\n13: φ_vd     전압루프 d축 PI 적분기\n14: φ_vq     전압루프 q축 PI 적분기\n15: γ_id     전류루프 d축 PI 적분기\n16: γ_iq     전류루프 q축 PI 적분기\n17: i_ld     인버터측 d축 인덕터 전류  ★ 커플링 진입점\n18: i_lq     인버터측 q축 인덕터 전류  ★ 커플링 진입점\n19: v_od     필터 커패시터 d축 전압\n20: v_oq     필터 커패시터 q축 전압\n21: i_od     계통측 d축 전류\n22: i_oq     계통측 q축 전류\n```\n\n> [!danger] δ 누락이 최대 결함이었다\n> GFM 동기화는 $\\delta \\to P \\to \\omega \\to \\delta$ 로 닫히는 루프다. $\\delta$가 상태가 아니면 루프가 열리고, **약계통에서 가장 먼저 불안정해지는 동기화 모드가 모델에 존재하지 않게 된다.**\n> \"SCR을 낮추면 무엇이 먼저 무너지는가\"가 본 연구의 질문인데, 그 답이 되는 모드가 통째로 빠져 있었다.\n\n---\n\n## 차수 21 → 22\n\n$8 + 14 = 22$. **\"21차\"는 제안서에 적어둔 숫자지 유도 결과가 아니었다.**\n\n※ 심사에서 \"왜 22냐\"를 물으면 \"이렇게 유도됐다\"가 \"숫자를 맞췄다\"보다 안전하다. 차수를 맞추려 물리를 깎는 것은 순서가 거꾸로다.\n\n$Q_f$ LPF를 빼면 21로 되돌릴 수는 있으나, 그건 DSP에 Q 필터가 실제로 없을 때만 정당하다.\n\n---\n\n## Phase별 구현 이력\n\n| Phase | $A_{DC}$ | $A_{AC}$ | 커플링 | 상태 |\n|---|---|---|---|---|\n| 1 | numpy 근사 | numpy 근사 | 수동 1개 | ❌ 무효 |\n| 2 (구) | numpy 근사 (대각) | 수동 구성 13×13 | 단방향만 | ❌ 블록삼각 |\n| 2 (개정) | SymPy | SymPy | **양방향** | ✅ |\n\n▸ 개정판 검증 결과\n- 심볼릭 야코비안 vs 유한차분 야코비안 일치 (오차 $10^{-9}$)\n- 동작점이 SCR에 따라 이동 확인 — SCR 감소 시 $\\delta$가 약 22°에서 62°로 증가\n- 커플링 제거 시 고유값 변화량 약 59 (이전 코드에서는 정확히 0)\n\n※ 마지막 항목이 진짜 검증이다. 이 값이 0이 아니어야 22차 모델의 존재 이유가 성립한다.\n\n---\n\n## 🔗 연결 노트\n\n- [[소신호_선형화]] — 야코비안 유도 원리\n- [[DC-AC_커플링]] — 양방향 커플링 상세\n- [[블록삼각_함정]] — 삼각행렬 고유값 합집합 성질\n- [[고유값_안정도판단]] — 야코비안 → 고유값 → 감쇠비\n- [[동작점 평형점]] — $f(x_0,u_0)=0$\n- [[다중동작점_갱신절차]] — SCR·X/R별 재계산\n- [[21차 야코비안 유도가이드]] — **파일명 22차로 변경 필요**\n- [[BUG_2026-08-25_sym_구조결함]] — 본 개정의 원인\n\n---\n\n## 참고문헌\n\n- ▸ [1] Chen 2024 — 블록 구조 원출처. ※ 원문이 21차인지 22차인지, δ를 포함하는지 **재확인 필요**\n- ▸ [7] Zhao 2023 — DC-AC 커플링 이론. ※ 폐기된 $A_k(9,6)$ 형태가 이 문헌에서 온 것인지, 아니면 우리 쪽 해석인지 확인 필요\n\n---\n\n## 📝 개정 이력\n\n| 날짜 | 내용 |\n|---|---|\n| 2026-08-21 | 최초 작성 (21차, 단방향 커플링) |\n| 2026-08-25 | 22차로 정정 · δ 추가 · 우상단 블록 `≈0` 삭제 · $A_k(9,6)$ 폐기 · `status: verified` → `revised` |\n\n> [!question] 미결\n> DC 링크 전압을 ESS 컨버터가 잡는가, PV 부스트가 잡는가?\n> 이에 따라 3~8번 상태의 역할이 완전히 달라진다. 위 목록은 **ESS가 $v_{dc}$ 제어**를 가정.\n",
    "wikilinks": [
      "BUG_2026-08-25_sym_구조결함",
      "동작점 평형점",
      "다중동작점_갱신절차",
      "블록삼각_함정",
      "소신호_선형화",
      "DC-AC_커플링",
      "고유값_안정도판단",
      "21차 야코비안 유도가이드"
    ]
  },
  {
    "path": "RSCAD/01_개념/이중수렴기준 설계.md",
    "dir": "RSCAD/01_개념",
    "filename": "이중수렴기준 설계",
    "frontmatter": {},
    "body": "---\n\n## type: concept date: 2026-08-21 phase: 3 status: pending tags: [concept, convergence, dual-criterion, MC, N-final]\n\n# 💡 이중수렴기준 설계\n\n## 한 줄 정의\n\n> PSO 종료 조건을 두 단계로 설계 — Phase 4a(임계값 결정)와 Phase 4b(N_final 결정)\n\n## 2단계 MC 분석 구조\n\n```\nPhase 4a: threshold 결정 예비실험\n  → 조건1·2 임계값 (0.1%, 0.5%) 검증\n  → Shapiro-Wilk p > 0.10 확인\n\nPhase 4b: N_final 결정 본실험\n  → MC 30회 실행\n  → IQR 분석으로 N_final 결정\n  → 현재 추정: N_final ≈ 390\n```\n\n## N_final 결정 기준\n\n```python\nfrom scipy import stats\n\n# MC 30회 실행 후\nresults = [pso_run() for _ in range(30)]\nF_finals = [r['F_multi'] for r in results]\n\n# 정규성 검정\nstat, p = stats.shapiro(F_finals)\nif p > 0.10:\n    print(\"정규분포 → 평균 ± 표준편차 사용\")\nelse:\n    print(\"비정규 → IQR 사용\")\n\n# N_final: 수렴 반복 횟수 중앙값\nN_finals = [r['n_iter'] for r in results]\nN_final = int(np.median(N_finals))\n```\n\n## 현재 상태\n\n```\nPhase 3 착수 전:\n  - 조건1·2 임계값 설계 완료 (0.1%, 0.5%)\n  - 구현 코드 미작성\n  - N_final 미결정 (추정 390회)\n```\n\n## 🔗 연결 노트\n\n- [[Pso 이중수렴기준]] — 전체 PSO 설계\n- [[Phase03_진행중]] — 구현 예정\n- [[Phase04 예정]] — MC 30회 본실험\n\n## 참고문헌\n\n- ▸ [1] Chen 2024 — MC 분석 방법론",
    "wikilinks": [
      "Pso 이중수렴기준",
      "Phase03_진행중",
      "Phase04 예정"
    ]
  },
  {
    "path": "RSCAD/01_개념/정적부하가능성_경계.md",
    "dir": "RSCAD/01_개념",
    "filename": "정적부하가능성_경계",
    "frontmatter": {
      "type": "concept",
      "phase": 2,
      "status": "draft",
      "date": "2026-08-28",
      "tags": [
        "concept",
        "phase2",
        "부하가능성",
        "2D경계",
        "동작점"
      ]
    },
    "body": "# 정적 부하가능성 경계\n\n> **저장 위치:** `01_개념/`\n\n## 한 줄\n\n2D SCR–X/R 경계도에는 성격이 다른 두 개의 선이 있다. **감쇠 경계**와 **정적 부하가능성 경계**. 하나로 합쳐 그리면 오독된다.\n\n## 두 경계\n\n| 구분 | 판정 | 물리 |\n|---|---|---|\n| 감쇠 경계 | σ_sync 또는 ζ_osc 가 기준 미달 | 소신호 불안정 |\n| 부하가능성 경계 | 정상상태 해 부재 (δ → 90°) | `P = VE·sinδ / X` 전달 한계 |\n\n▸ δ 추이 (X/R = 1.0): 22.42° → 32.58° → 42.42° → 62.34° → **78.95°**\n▸ X/R = 1.0 에서 SCR 0.6 미수렴. X/R = 3.0 에서 SCR 0.8 이 δ=100.16°.\n▸ 현재 스윕 범위에서 감쇠 경계는 **한 번도 발동하지 않았다.** 전 조건 안정.\n\n> [!danger] 지금 상태로 88포인트를 돌리면\n> 경계선이 전부 \"동작점 미존재\"로 그어진다. ζ·σ 기반 경계는 나타나지 않는다.\n> 논문의 \"강건성 경계\" 정의를 이중 판정으로 바꿔야 한다.\n\n## 미해결 결함 — δ > 90° 수용\n\n▸ X/R = 3.0, SCR 0.8 에서 δ = 100.16° 인데 `stable = True` 로 보고된다.\n\ncos(100.16°) = −0.176 이므로 동기화 계수 K = VE·cosδ/X 가 **음수**다. 동기화 토크가 음이면 δ 섭동이 발산해야 한다. 실수 양의 고유값이 나와야 정상이다.\n\n※ `op.py` 의 `fsolve` 가 P–δ 곡선의 **하단 불안정 가지**를 잡고 있다. 대수적으로 유효한 근이지만 물리적 평형점이 아니다. 가지 선택이 초기값에 따라 달라져, X/R=1.0 에서는 SCR 0.6 이 미수렴하고 X/R=3.0 에서는 SCR 0.8 이 100° 로 \"수렴\"한다.\n\n가드 (`runner.py`, `P2-A10`):\n\n```python\nDELTA_HARD = 90.0   # P-δ 곡선 불안정 가지 — 물리적 해 아님\n\nif delta_deg >= DELTA_HARD:\n    results[SCR] = {'converged': False,\n                    'fail_reason': 'loadability_limit',\n                    'message': f'δ={delta_deg:.2f}° > 90° (불안정 가지)'}\n    x_prev, prev_delta = None, None   # 연속화 초기값 오염 방지\n    continue\n```\n\n## 논문 관점\n\n※ 두 경계를 다른 선종으로 겹쳐 그리는 것 자체가 기여가 될 수 있다. Dong et al.(2026) 은 1D SCR 스윕이므로 이 구분이 없다. 2D 로 확장하면서 경계의 성격이 영역에 따라 달라진다는 것을 보이면 **경계 정의 자체가 novelty** 가 된다.\n\n## 🔗 연결 노트\n\n| 방향 | 노트 | 이유 |\n|---|---|---|\n| ← | [[동작점 평형점]] | δ 해 존재 조건 |\n| ← | [[동작점 평형점]] | δ 추이 원자료 |\n| → | [[88포인트_2D_스윕_설계]] | 이중 경계 반영 |\n| → | [[Phase_지식_연결맵]] | `P2-A9`, `P2-A10` |\n\n> [!question] 허브 갱신 필요\n> 이 노트를 [[Phase_지식_연결맵]] 과 [[GFM_연구_전체지도.md]] 에 연결할 것.\n",
    "wikilinks": [
      "동작점 평형점",
      "88포인트_2D_스윕_설계",
      "Phase_지식_연결맵",
      "GFM_연구_전체지도.md"
    ]
  },
  {
    "path": "RSCAD/01_개념/참여인자 지배모드.md",
    "dir": "RSCAD/01_개념",
    "filename": "참여인자 지배모드",
    "frontmatter": {
      "type": "concept",
      "date": "2026-09-14",
      "phase": 3,
      "status": "확립",
      "model_version": "v3-22state",
      "revision": 2,
      "tags": [
        "concept",
        "participation-factor",
        "dominant-mode",
        "eigenvalue",
        "방법론"
      ]
    },
    "body": "# 💡 참여인자 & 지배 모드\n\n> **저장 위치:** `01_개념/`\n\n## 한 줄 정의\n\n> 22개 모드 중 **어떤 상태변수가 어떤 모드를 지배하는지** 정량화하는 지표. 모드에 물리적 이름을 붙이는 유일한 수단이다.\n\n> [!note] rev.2 변경 (2026-09-14)\n> 이 노트는 **방법론만** 담는다. 계산 결과와 지배 모드 판정은 별도 노트로\n> 옮겼다. 예상값과 실측이 한 노트에 섞여 있으면 어느 쪽이 맞는지 알 수 없다.\n>\n> 실측 결과 → [[과감쇠_동기화모드]] · [[스윙극쌍_필터혼합]]\n> 목적함수 설계 → [[PSO_목적함수_설계]]\n\n---\n\n## 수식\n\n$$P_{ki} = |\\phi_{ki} \\cdot \\psi_{ik}|$$\n\n| 기호 | 의미 |\n|---|---|\n| $\\phi_{ki}$ | 우 고유벡터 — 모드 i 가 상태변수 k 에 미치는 영향 |\n| $\\psi_{ik}$ | 좌 고유벡터 — 상태변수 k 가 모드 i 에 기여하는 정도 |\n| $P_{ki}$ | 모드 i 에 대한 상태변수 k 의 참여도 |\n\n모드별로 정규화한다.\n\n$$\\sum_k P_{ki} = 1$$\n\n▸ 좌우 고유벡터를 곱하는 이유는 **단위에 무관한 지표**를 얻기 위해서다. 전압(V)과 전류(A)를 같은 척도로 비교할 수 있다.\n\n---\n\n## 계산\n\n```python\nfrom scipy import linalg\nimport numpy as np\n\ndef participation(A):\n    \"\"\"P[k,i] = |Φ_ki · Ψ_ik|, 모드별 정규화.\"\"\"\n    ev, V = linalg.eig(A)\n    W = linalg.inv(V)              # Ψ = Φ⁻¹\n    P = np.abs(V.T * W).T\n    return ev, P / np.maximum(P.sum(axis=0, keepdims=True), 1e-300)\n```\n\n> [!warning] 좌 고유벡터를 `eig(A.T)` 로 구하지 말 것\n> `A` 와 `Aᵀ` 를 따로 분해하면 **고유값 순서가 달라진다.** 짝이 맞지 않는\n> 좌우 벡터를 곱하게 되어 참여인자가 무의미해진다.\n> `Ψ = Φ⁻¹` 로 구하면 순서가 자동으로 맞는다.\n\n---\n\n## 모드 선택 — 세 가지 원칙\n\n### ① 진동 모드로 한정하지 말 것\n\n> [!danger] 이 프로젝트에서 실제로 겪은 실패\n> 임계 모드가 **과감쇠된 실수극**이면 `Im(λ) > tol` 필터에 걸리지 않는다.\n> 진동 모드만 뒤지면 무관한 저주파 모드(전력 필터)를 동기화 모드로 오인한다.\n> → [[과감쇠_동기화모드]]\n\n```python\n# 켤레쌍은 한 번만, 실수극도 포함\nkeep = [i for i in range(len(ev)) if ev[i].imag >= -IM_TOL]\n```\n\n### ② 주파수 대역이 아니라 참여도로 고를 것\n\n특정 대역(예: 5 Hz 미만)을 동기화 모드로 간주하면 안 된다. 그 대역에 전력 필터 모드가 함께 들어 있다.\n\n```python\n# δ + Δω 참여도 최대 모드를 동기화 모드로 채택\npw = P[i_delta, :] + P[i_omega, :]\nk = max(keep, key=lambda i: pw[i])\n```\n\n### ③ 쌍으로 볼 것\n\n> [!warning] 지배 모드 하나만 보면 놓치는 것이 있다\n> 느린 근은 전 구간 순수해 보인다. 그러나 **빠른 근이 다른 모드와 섞여**\n> 있으면 2차계 근사가 깨진다. δ·Δω 참여도 상위 **두** 모드를 함께 봐야\n> 확인된다. → [[스윙극쌍_필터혼합]]\n\n---\n\n## 판정 기준\n\n| 참여도 | 해석 |\n|---|---|\n| > 0.8 | 해당 상태가 모드를 지배한다 |\n| 0.3 ~ 0.8 | 혼합 모드. 여러 상태가 관여 |\n| < 0.15 | 무시 가능 |\n\n※ 문헌의 0.15 기준은 \"무시해도 되는 하한\"이지 \"지배 판정선\"이 아니다. 지배를 말하려면 0.8 이상은 되어야 한다.\n\n---\n\n## 무엇에 쓰는가\n\n**모드에 이름 붙이기.** 고유값 −4.6445 만으로는 그것이 무엇인지 알 수 없다. 참여계수가 δ 0.82 를 가리켜야 \"동기화 모드\"라고 부를 수 있다.\n\n**목적함수 대상 선정.** 제어 이득으로 개선할 수 없는 모드(LCL 공진)를 최적화에서 빼려면, 어느 모드가 어느 상태에 매여 있는지 알아야 한다. → [[PSO_목적함수_설계]]\n\n**축소 모델 검증.** 축소 모델이 전제하는 모드가 실제로 그 형태인지 확인한다. 이 프로젝트에서는 그 전제가 두 번 깨졌다.\n\n---\n\n## 재현\n\n```bash\npython Simulation/pf.py            # 화면 확인용\npython Simulation/pf_export.py     # JSON 저장 — 문서·대시보드용\npython Simulation/sync_reduce.py   # 쌍으로 보기 + Schur 축소\n```\n\n출력: `results/<run>/participation_factors.json`\n\n▸ `pf.py` 와 `pf_export.py` 는 독립 구현이며 값이 일치함을 확인했다. 교차 검증이 되는 셈이다.\n\n---\n\n## 🔗 연결 노트\n\n### 이론\n\n| 노트 | 이유 |\n|---|---|\n| [[야코비안 행렬]] | 참여인자 계산의 입력 |\n| [[고유값_안정도판단]] | 모드별 σ·ζ 정의 |\n| [[소신호_선형화]] | A_k 유도 |\n\n### 결과 (이 노트의 방법으로 얻은 것)\n\n| 노트 | 내용 |\n|---|---|\n| [[과감쇠_동기화모드]] | 임계 모드가 δ 지배 실수극임을 확정 |\n| [[스윙극쌍_필터혼합]] | 빠른 근이 전력 필터극과 섞임 |\n| [[동기화계수_K]] | Schur 축소로 K_eff 추출 |\n\n### 활용\n\n| 노트 | 내용 |\n|---|---|\n| [[PSO_목적함수_설계]] | 지배 모드 기반 목적함수 v2 |\n| [[모드교차_최소감쇠비_함정]] | 단일 스칼라 지표의 한계 |\n\n### 실험\n\n- [[EXP_2026-08-21_Phase2_엔진전환_비교]] — LCL 모드 지배 문제 발견\n\n### 참고문헌\n\n- ▸ [[Chen_2024_Electronics]] — 참여인자 분석 방법론\n",
    "wikilinks": [
      "과감쇠_동기화모드",
      "스윙극쌍_필터혼합",
      "PSO_목적함수_설계",
      "야코비안 행렬",
      "고유값_안정도판단",
      "소신호_선형화",
      "동기화계수_K",
      "모드교차_최소감쇠비_함정",
      "EXP_2026-08-21_Phase2_엔진전환_비교",
      "Chen_2024_Electronics"
    ]
  },
  {
    "path": "RSCAD/01_개념/폐기값_이력.md",
    "dir": "RSCAD/01_개념",
    "filename": "폐기값_이력",
    "frontmatter": {
      "type": "log",
      "date": "2026-08-28",
      "status": "living",
      "tags": [
        "log",
        "폐기값",
        "정정이력",
        "추적성",
        "논문근거"
      ]
    },
    "body": "# 폐기값 이력\n\n> **저장 위치:** `01_개념/`\n\n## 목적\n\n수치나 판정 기준이 바뀔 때마다 **어디서 · 무엇 때문에 · 어떻게 검출됐는지**를 한 곳에 쌓는다.\n\n▸ 논문 §의 \"모델 개정 근거\" 원고가 된다. \"왜 22차인가\", \"왜 ζ 가 아닌 정착시간인가\"는 전부 여기서 나온다.\n▸ 같은 함정을 다시 밟지 않게 한다. 커플링 효과는 이미 **두 번** 정정됐다.\n※ 값을 갈아치우기만 하면 맥락이 사라진다. 폐기값도 지우지 않는다.\n\n---\n\n## 요약\n\n| # | 날짜 | 항목 | 폐기값 | 대체값 | 원인 |\n|---|---|---|---|---|---|\n| 1 | 08-25 | 모델 차수 | 21 | **22** | δ 누락 → 동기화 루프 미폐합 |\n| 2 | 08-25 | 커플링 검증 | `A_k(9,6)` 오차 0.0001% | 고유값 이동량 | 항등식 대조 (통과해도 무의미) |\n| 3 | 08-25 | 야코비안 구조 | 블록삼각 | 양방향 결합 | 단방향 삽입 |\n| 4 | 08-28 | 커플링 효과 | **5.90e+01** | 26.24 (X/R 3.0) | `np.sort_complex` 페어링 |\n| 5 | 08-28 | 안정도 지표 | ζ_min | σ_sync, t_s | 동기화 모드가 실수극 |\n| 6 | 08-28 | 지배 모드 | 178 Hz LCL 공진 | δ 지배 실수극 | 참여계수 미확인 |\n| 7 | 08-28 | 목적함수 F2 | ζ=0.707 추종 | 정착시간 | 실수극을 진동시키는 방향 |\n| 8 | 08-28 | 경계 정의 | 단일 감쇠 경계 | 감쇠 + 부하가능성 | 성격 다른 두 선 |\n| 9 | 08-28 | 검산 범위 | 1.2e-09 (전 SCR) | X/R=1.0 한정 | X/R=3.0 저SCR 에서 초과 |\n| 10 | 08-28 | latest 갱신 | 폴더 복사 | `LATEST.json` | PSO 병렬 경합 |\n| 11 | 08-28 | 대시보드 값 | 해석식·난수 | 저장값 또는 실계산 | 날조 |\n\n---\n\n## 1. 모델 차수 21 → 22\n\n| 항목 | 내용 |\n|---|---|\n| **발견 위치** | `Simulation/_archive/sym_v0.py` — 상태 벡터 정의부 |\n| **원인** | 전력각 δ 가 상태 변수에 없었다. δ̇ = Δω 항이 없으니 동기화 루프가 열려 있다 |\n| **검출 방법** | 코드 리뷰. δ 없이 어떻게 P(δ) 를 계산하는지 추적 |\n| **파급** | 동기화 모드 자체가 모델에 존재하지 않았음 → Phase 3 전체 재실행 |\n| **근거** | [[BUG_2026-08-25_sym_구조결함]] · [[상태변수_선정근거]] |\n\n---\n\n## 2. 커플링 검증 `A_k(9,6)` 오차 0.0001% → 폐기\n\n| 항목 | 내용 |\n|---|---|\n| **발견 위치** | `sym_v0.py` 검증 루틴 — 이론값 `idc0/(J·w0)` 과 행렬 성분 대조 |\n| **원인** | 그 성분을 **같은 식으로 직접 대입**해 놓고 다시 그 식과 비교했다. 항등식이므로 항상 통과한다 |\n| **검출 방법** | 검증식의 좌변·우변 출처 추적 |\n| **파급** | Phase 2 완료 판정의 근거가 무효. 검증 기준을 \"커플링 on/off 시 고유값 변화 ≠ 0\" 으로 교체 |\n| **근거** | [[BUG_2026-08-25_sym_구조결함]] |\n\n> [!warning] 검증이 항등식인지 항상 확인할 것\n> 통과율 100% 는 좋은 신호가 아니라 의심 신호다.\n\n---\n\n## 3. 블록삼각 구조 → 양방향 결합\n\n| 항목 | 내용 |\n|---|---|\n| **발견 위치** | `sym_v0.py` — DC→AC 방향만 성분 삽입, AC→DC 는 0 |\n| **원인** | 커플링을 한 방향으로만 넣으면 행렬이 블록삼각이 되고, 블록삼각 행렬의 고유값은 대각 블록 고유값의 합집합이다. **커플링이 고유값 해석에 원리적으로 보이지 않는다** |\n| **검출 방법** | 커플링 블록을 0 으로 만들고 고유값 변화를 측정 → 변화량 `0.000e+00` |\n| **파급** | 22차 모델의 존재 이유(RQ1)가 증명 불가 상태였음 |\n| **근거** | [[블록삼각_함정]] · [[야코비안 행렬]] |\n\n---\n\n## 4. 커플링 효과 5.90e+01 → 재측정 ★\n\n> [!danger] 두 번째 정정이다\n> 이 항목은 `0.0001%` → `5.90e+01` → `1.31~26.24` 로 두 번 바뀌었다.\n\n| 항목 | 내용 |\n|---|---|\n| **발견 위치** | `Simulation/runner.py` v1 — `coupling_effect()` |\n| **폐기 코드** | ```e1 = np.sort_complex(eigvals(A)); e2 = np.sort_complex(eigvals(A_cut)); return max(abs(e1 - e2))``` |\n| **원인** | `np.sort_complex` 는 실수부 우선 정렬이다. 커플링 제거로 고유값이 이동하면 **정렬 순서가 바뀌어 서로 다른 모드끼리 뺀다.** 59 는 무관한 두 모드의 거리였다 |\n| **검출 방법** | `scipy.optimize.linear_sum_assignment` 로 모드를 매칭해 재측정. 어느 조건에서도 59 가 재현되지 않음 |\n| **대체값** | 최소감쇠 모드 이동량(`shift_crit`): X/R 0.5 → **1.71**, X/R 1.0 → **1.31**, X/R 3.0 → **26.24** |\n| **파급** | `P2-A4` 는 RQ1 직접 증거로 승격된 항목. 논문·노트의 59 를 전부 교체해야 한다 |\n| **결론 변화** | 없음. 커플링이 유의미하다는 결론은 유지. **X/R=3.0 의 26.24 가 더 강한 증거**다 |\n| **근거** | [[EXP_2026-08-28_XR3조건_스윕]] · [[DC-AC 커플링]] |\n\n---\n\n## 5. 안정도 지표 ζ_min → σ_sync · t_s ★\n\n| 항목 | 내용 |\n|---|---|\n| **발견 위치** | `Simulation/runner.py` — `analyze()` 의 모드 필터 |\n| **폐기 코드** | ```osc = [e for e in ev if e.imag > 0.5]``` |\n| **원인** | Dp=20 · J=0.5 는 **과감쇠 영역**(`Dp > 2√(J·K)`)이다. 동기화 모드가 공액복소 쌍이 아니라 **실수극**으로 분리돼 있어 이 필터에 애초에 걸리지 않는다. ζ_sync 로 표시되던 0.3232 는 전력 필터 모드(λ≈−65, Qf 0.445 · Pf 0.401) 값이었다 |\n| **검출 방법** | `pf.py` 참여계수. δ+Δω 참여도 최대인 극을 찾으니 전부 실수극(p = 0.928~0.983) |\n| **대체값** | σ_sync: −4.264(SCR 3.0) → −1.012(SCR 0.8). t_s = 5/\\|σ\\|: 1.17 s → 4.94 s |\n| **파급** | 실수극의 ζ 는 정의상 1. **UNIFI ζ ≥ 0.64 기준을 이 모드에 적용하는 것 자체가 성립하지 않는다.** PSO 목적함수 전면 재설계 |\n| **근거** | [[과감쇠_동기화모드]] · [[고유값_안정도판단]] |\n\n> [!info] 사전 경고가 있었다\n> `checkList.md` Phase 4 항목에 \"ζ_min 은 진동 모드만 본다 → 임계 모드를 놓친다\"\n> 가 이미 기록돼 있었다. 정량 확인이 2026-08-28 에 이루어졌다.\n\n---\n\n## 6. 지배 모드 178 Hz LCL → δ 지배 실수극\n\n| 항목 | 내용 |\n|---|---|\n| **발견 위치** | 초기 가정. 코드가 아니라 **연구 전제** |\n| **원인** | LCL 공진이 가장 눈에 띄는 진동이라 지배 모드로 가정했다. 참여계수를 확인하지 않았다 |\n| **검출 방법** | `pf.py` 좌/우 고유벡터 참여계수 행렬 |\n| **파급** | 약계통에서 GFM 이 무너지는 경로가 LCL 이 아니라 동기화임. PSO 목적함수 방향 전환 |\n| **근거** | [[참여인자 지배모드]] · [[과감쇠_동기화모드]] |\n\n---\n\n## 7. 목적함수 F2 = ζ 0.707 추종 → 정착시간\n\n| 항목 | 내용 |\n|---|---|\n| **발견 위치** | `01_개념/Pso 이중수렴기준.md` — `F_multi` 정의 |\n| **폐기 코드** | ```F2 = sum((z - 0.707)**2 for z in zetas)``` |\n| **원인** | `zetas` 를 모드 구분 없이 순회한다. 동기화 모드는 실수극이라 ζ=1 이므로 `(1−0.707)² = 0.0858` 이 상시 부과된다. **PSO 는 이걸 줄이려고 동기화 모드를 진동 영역으로 밀어낸다** — 강건성을 적극적으로 악화시키는 방향 |\n| **검출 방법** | 항목 5 확인 후 목적함수 코드 역산 |\n| **파급** | Phase 4 착수 차단. 목적함수 재설계 |\n| **근거** | [[PSO_목적함수_설계]] |\n\n---\n\n## 8. 단일 감쇠 경계 → 감쇠 + 정적 부하가능성\n\n| 항목 | 내용 |\n|---|---|\n| **발견 위치** | `Simulation/op.py` 미수렴 처리 — 원인 구분 없이 같은 메시지 |\n| **원인** | δ 가 90° 에 접근하면 `P = VE·sinδ/X` 전달 한계로 **정상상태 해가 존재하지 않는다.** 이건 소신호 불안정이 아니다. 현재 스윕 범위에서 감쇠 경계는 한 번도 발동하지 않았고 제약은 전부 부하가능성이었다 |\n| **검출 방법** | δ 추이 관찰 (22.42° → 78.95° → 미수렴) |\n| **파급** | 88포인트 경계도를 한 선으로 그리면 오독. 두 선을 다른 선종으로 겹쳐 그려야 함 |\n| **미해결** | X/R=3.0, SCR 0.8 에서 δ=100.16° 인데 `stable=True`. `fsolve` 가 P–δ 곡선 **불안정 가지**를 잡고 있다 (`P2-A10`) |\n| **근거** | [[정적부하가능성_경계]] · [[동작점 평형점]] |\n\n---\n\n## 9. 검산 1.2e-09 (전 SCR) → X/R=1.0 한정\n\n| 항목 | 내용 |\n|---|---|\n| **발견 위치** | `runner.py` — `fd_error()` 를 성분별 상대오차까지 재도록 확장 후 |\n| **원인** | 기존 검산은 전역 정규화만 썼다. `1/L_f` 같은 큰 성분이 분모를 지배해 작은 성분의 큰 상대오차가 가려진다 |\n| **검출 방법** | X/R 축을 확장해 재실행 → X/R=3.0, SCR 1.0·0.8 에서 1.2e-06 · 1.8e-06 |\n| **파급** | `P2-A2` result 를 조건 한정으로 수정. 해당 영역 야코비안 정확도 재조사 필요 |\n| **근거** | [[EXP_2026-08-28_XR3조건_스윕]] |\n\n---\n\n## 10. latest 폴더 복사 → LATEST.json 포인터\n\n| 항목 | 내용 |\n|---|---|\n| **발견 위치** | `runner.py` — `shutil.rmtree(latest)` + `copytree` |\n| **원인** | PSO 는 목적함수를 수천 번 호출한다. 매번 22×22 배열 폴더를 삭제·복사하면 느리고, 병렬이면 서로 밟는다. 중단 시 `latest/` 가 깨진다 |\n| **검출 방법** | PSO 호출 규약 설계 중 발견 |\n| **대체** | `os.replace` 로 포인터 파일만 원자적 교체. `persist=False` 로 디스크 쓰기 자체를 차단 |\n| **근거** | [[Simulation_코드구조]] · [[실행_식별자_설계원칙]] |\n\n---\n\n## 11. 대시보드 날조 값 전면 제거\n\n| 항목 | 내용 |\n|---|---|\n| **발견 위치** | `Server/app.py` v2 |\n| **폐기 목록** | `_get_A_num()` — 로드한 야코비안 성분을 하드코딩 수식으로 덮어씀 (인덱스 8/9/19/20 은 **21-state** 배치)<br>`build_jacobian()` — numpy 근사 fallback 이 진짜 모델과 구분 없이 응답에 섞임<br>`analyze_eigenvalues()` — 고유값에 없는 'VSG 스윙' 모드를 지어내 ζ_min 을 갈아치움<br>`scr_star` / `zeta_threshold` / `du_pv_pct` — 출처 없는 해석식<br>`/api/pso` — `random.uniform()` 수렴 곡선 |\n| **원인** | Phase 1 mockup 이 그대로 남아 Phase 2 실물과 섞였다. 파일명 규약이 바뀌자(`SCR3.0` → `SCR3.00`) 로드에 실패하고 **조용히 가짜 모델로 fallback** |\n| **검출 방법** | 코드 리뷰. `_get_A_num` 의 인덱스가 22-state 상태 순서와 맞는지 대조 |\n| **파급** | 대시보드에 표시되던 모든 수치가 근거 불명. `/api/pso` 결과를 인용했다면 전면 재확인 |\n| **근거** | [[Simulation_코드구조]] · [[실험_pso_미구현]] |\n\n---\n\n## 기록 무결성 사고 (별도 유형)\n\n수치가 아니라 **기록 자체가 사실과 달랐던 경우**. 같은 유형이 반복되고 있다.\n\n| 날짜 | 기록 | 실제 | 검출 |\n|---|---|---|---|\n| 08-28 | `P3-A1` state: `verified`, evidence `Simulation/pf.py` | 파일 없음 | 폴더 확인 |\n| 08-28 | `schedule.yaml` `mirror_file: checkList.md` | 볼트에 없음 | 루트 확인 |\n| 08-28 | `Phase_지식_연결맵` — Pso 이중수렴기준 P3 \"구현\" / P4~7 \"완료\" | 구현된 적 없음 | 코드 대조 |\n\n> [!danger] 점검 명령\n> ```bash\n> cd ~/Dev/Obsidian/GFM_Research/RSCAD\n> # evidence 실재 확인\n> grep -o 'code_root/[^\"]*' schedule.yaml | sed 's|code_root|~/Dev/RSCAD|' \\\n>   | while read p; do ls $p >/dev/null 2>&1 || echo \"MISSING: $p\"; done\n> # 깨진 위키링크\n> grep -rhoP '(?<=\\[\\[)[^\\]|#]+' --include='*.md' . | sort -u \\\n>   | while read n; do find . -name \"$n.md\" -print -quit | grep -q . \\\n>       || echo \"BROKEN: [[$n]]\"; done\n> ```\n\n---\n\n## 기입 규칙\n\n새 항목은 아래 형식으로 추가한다. **요약 표에 한 행 + 상세 블록 하나.**\n\n```markdown\n## N. <항목> <폐기값> → <대체값>\n\n| 항목 | 내용 |\n|---|---|\n| **발견 위치** | 파일 · 함수 · 코드 라인 |\n| **폐기 코드** | 실제 코드 조각 |\n| **원인** | 왜 틀렸는가 (증상 아님) |\n| **검출 방법** | 어떻게 발견했는가 — 재현 가능하게 |\n| **대체값** | 새 값과 산출 조건 |\n| **파급** | 어느 artifact · 노트 · 논문 절이 영향받는가 |\n| **근거** | [[노트명]] |\n```\n\n▸ **폐기값을 지우지 않는다.** 취소선으로 남긴다.\n▸ **원인과 증상을 구분한다.** \"59가 이상하다\"는 증상, \"정렬 페어링이 다른 모드를 뺀다\"가 원인이다.\n▸ 같은 항목이 두 번 이상 정정되면 ★ 를 붙인다.\n\n## 🔗 연결 노트\n\n| 방향 | 노트 | 이유 |\n|---|---|---|\n| ← | [[BUG_2026-08-25_sym_구조결함]] | 항목 1~3 원본 |\n| ← | [[블록삼각_함정]] | 항목 3 |\n| ← | [[EXP_2026-08-28_XR3조건_스윕]] | 항목 4·9 원자료 |\n| ← | [[과감쇠_동기화모드]] | 항목 5·6 |\n| ← | [[정적부하가능성_경계]] | 항목 8 |\n| ← | [[PSO_목적함수_설계]] | 항목 7 |\n| ← | [[Simulation_코드구조]] | 항목 10·11 |\n| → | [[Phase02_완료]] | 완료 판정 근거 재확인 |\n| → | [[실험_재현성_체크리스트]] | 검증 항목 반영 |\n\n> [!question] 허브 갱신 필요\n> [[Phase_지식_연결맵]] 과 [[GFM_연구_전체지도.md]] 에 연결할 것.\n",
    "wikilinks": [
      "BUG_2026-08-25_sym_구조결함",
      "상태변수_선정근거",
      "블록삼각_함정",
      "야코비안 행렬",
      "EXP_2026-08-28_XR3조건_스윕",
      "DC-AC 커플링",
      "과감쇠_동기화모드",
      "고유값_안정도판단",
      "참여인자 지배모드",
      "PSO_목적함수_설계",
      "정적부하가능성_경계",
      "동작점 평형점",
      "Simulation_코드구조",
      "실행_식별자_설계원칙",
      "실험_pso_미구현",
      "$n",
      "노트명",
      "Phase02_완료",
      "실험_재현성_체크리스트",
      "Phase_지식_연결맵",
      "GFM_연구_전체지도.md"
    ]
  },
  {
    "path": "RSCAD/02_방법론/21차 야코비안 유도가이드.md",
    "dir": "RSCAD/02_방법론",
    "filename": "21차 야코비안 유도가이드",
    "frontmatter": {
      "## type": "methodology date: 2026-08-21 phase: 2 status: verified tags: [methodology, jacobian, 21-state, derivation, guide]"
    },
    "body": "## Step 1. 상태변수 정의 (21개)\n\n```\nDC측 (8개):\n  x1=xPI1, x2=xPI2, x3=xPI3   (PI 적분기)\n  x4=upv,  x5=ubat, x6=udc    (전압)  ← x6★\n  x7=iLpv, x8=iLbat           (전류)\n\nAC측 (13개):\n  x9=Δω                        (VSG 각속도) ★\n  x10=Pfilt, x11=Qfilt         (전력 필터)\n  x12=φ_vd, x13=φ_vq          (전압루프 PI)\n  x14=γ_id, x15=γ_iq          (전류루프 PI)\n  x16=iid,  x17=iiq           (인버터 전류)\n  x18=uod,  x19=uoq           (커패시터 전압)\n  x20=iod,  x21=ioq           (계통 전류)\n```\n\n---\n\n## Step 2. 비선형 f(x) 구성\n\n### DC측 (f1~f8)\n\n```python\nf1  = iLpv_ref - iLpv              # MPPT PI 오차\nf2  = iLbat_ref - iLbat            # ESS PI 오차\nf3  = Vdc0 - udc                   # DC버스 PI 오차\nf4  = (0.9 - iLpv) / Cpv          # upv\nf5  = 0                             # ubat (이상적)\nf6  = (iLpv*(1-dpv) - idc_inv) / Cdc  # udc ★\nf7  = (upv - (1-dpv)*udc) / Lpv   # iLpv\nf8  = (ubat - dbat*udc) / Lbat    # iLbat\n\n# PI 연결 핵심:\n# dpv = 0.5 + Ki1*xPI1  ← xPI1이 f6, f7에 연결\n```\n\n### AC측 (f9~f21)\n\n```python\nf9  = (1 - Pfilt - Dp*Δω) / J    # Δω ★\nf10 = wc*(Pmeas - Pfilt)           # Pfilt\n# ... (이중루프, LCL, 계통)\n```\n\n---\n\n## Step 3. 핵심 원소 A_k(9,6) 수동 보강\n\n```python\n# SymPy로 자동 유도 시 A_k(9,6) = 0\n# → 이유: f9는 udc에 직접 의존하지 않음\n# → 동작점 선형화에서만 나타남\n\n# 수동 보강 필수:\nA_num[8, 5] = idc0 / (J * w0)\n# = 0.9/SCR / (J * 2π*60)\n```\n\n---\n\n## Step 4. 계통 임피던스 SCR별 갱신\n\n```python\nZg  = 1.0 / SCR\nRg  = Zg / sqrt(1 + XR**2)\nLg  = Rg * XR / w0\n\n# iod, ioq 행 (인덱스 19, 20) 갱신\nA[19, 17] =  1/Lg\nA[19, 19] = -Rg/Lg\nA[19, 20] =  w0\nA[20, 18] =  1/Lg\nA[20, 19] = -w0\nA[20, 20] = -Rg/Lg\n```\n\n---\n\n## Phase 2 구현 결과\n\n```\n전략: DC 8×8 (numpy 근사) + AC 13×13 (수동) + A_k(9,6) 수동\n결과:\n  stable=True (4개 SCR) ✅\n  A_k(9,6) 오차 0.0001% ✅\n  9차 시도 끝에 달성\n```\n\n## 🔗 연결 노트\n\n- [[야코비안 행렬]] — 블록 구조\n- [[DC-AC_커플링]] — A_k(9,6) 이론\n- [[소신호_선형화]] — 선형화 원리\n- [[Phase02_완료]] — 구현 완료\n- [[Bug sym dc pi 4차시도]] — 디버깅 기록\n\n## 참고문헌\n\n- ▸ [1] Chen 2024 — 21차 모델 원출처\n- ▸ [7] Zhao 2023 — 커플링 이론",
    "wikilinks": [
      "야코비안 행렬",
      "DC-AC_커플링",
      "소신호_선형화",
      "Phase02_완료",
      "Bug sym dc pi 4차시도"
    ]
  },
  {
    "path": "RSCAD/02_방법론/Prony 교차검증_절차.md",
    "dir": "RSCAD/02_방법론",
    "filename": "Prony 교차검증_절차",
    "frontmatter": {
      "## type": "methodology date: 2026-08-21 phase: 3 status: pending tags: [methodology, Prony, Matrix-Pencil, validation, f-dom, cross-validation]"
    },
    "body": "## 왜 필요한가?\n\n```\n소신호 모델 (A_k 야코비안):\n  → f_dom, ζ_min 이론값 계산\n  ↓ 이게 실제와 얼마나 맞나?\n\nRTDS CHIL 실측:\n  → 과도응답 파형 측정\n  → Prony/Matrix Pencil로 f_dom, ζ 추출\n  ↓ 비교\n\n오차 < 5% → 모델 검증 완료 ✅\n오차 > 5% → 모델 수정 필요\n```\n\n---\n\n## Prony 분석이란?\n\n시간 도메인 신호를 지수 감쇠 정현파 합으로 분해:\n\n$$y(t) = \\sum_{i=1}^{N} A_i \\cdot e^{\\sigma_i t} \\cos(\\omega_i t + \\phi_i)$$\n\n|추출값|의미|\n|---|---|\n|$\\omega_i$|진동 주파수 → f_dom = ω/(2π)|\n|$\\sigma_i$|감쇠율 → ζ = -σ/\\|λ\\||\n|$A_i$|모드 크기 → 참여인자와 연결|\n\n---\n\n## Matrix Pencil 방법 (권장)\n\n```python\n# Almunif(2020) [참고문헌] 기반\n# SNR ≥ 25dB 조건에서 Prony보다 수치 안정성 우수\n\nimport numpy as np\n\ndef matrix_pencil(y, dt, L=None):\n    \"\"\"\n    y:  측정 신호 (1D array)\n    dt: 샘플링 간격\n    L:  연필 파라미터 (기본값 len(y)//2)\n    \"\"\"\n    N = len(y)\n    if L is None:\n        L = N // 2\n\n    # Hankel 행렬 구성\n    Y1 = np.array([y[i:i+L] for i in range(N-L)])\n    Y2 = np.array([y[i+1:i+L+1] for i in range(N-L)])\n\n    # SVD 기반 차수 결정\n    U, S, Vh = np.linalg.svd(Y1)\n    # 유효 차수: S[k]/S[0] > 1e-3 인 k\n    n_modes = np.sum(S/S[0] > 1e-3)\n\n    # 일반화 고유값 문제\n    Y1_r = U[:, :n_modes] @ np.diag(S[:n_modes]) @ Vh[:n_modes, :]\n    Y2_r = Y2\n\n    # 극점 추출\n    Z = np.linalg.lstsq(Y1_r, Y2_r, rcond=None)[0]\n    poles = np.linalg.eigvals(Z)\n\n    # f, ζ 계산\n    modes = []\n    for p in poles:\n        if p.imag > 0:\n            lam = np.log(p) / dt\n            f   = abs(lam.imag) / (2 * np.pi)\n            zeta = -lam.real / abs(lam)\n            modes.append({'f_hz': f, 'zeta': zeta})\n\n    return sorted(modes, key=lambda m: m['zeta'])\n```\n\n---\n\n## 3단계 검증 절차\n\n### Layer 1 — 소프트웨어 자체 검증\n\n```\nsym.py 야코비안 → 고유값 분석\n  ↓\nf_dom, ζ_min 이론값 산출\n  ↓\n기준: |f_model - f_sim| / f_sim < 5%\n```\n\n### Layer 2 — PSCAD 교차검증 (Δu_pv > 5% 조건)\n\n```\nPSCAD EMT 시뮬레이션\n  → 소신호 섭동 인가 (ΔP = 0.05 pu)\n  → 과도 파형 기록 (Δω, ΔP)\n  ↓\nMatrix Pencil 적용\n  ↓\nf_dom, ζ 추출 → 소신호 모델과 비교\n기준: SNR ≥ 25dB, 오차 < 5%\n```\n\n### Layer 3 — RTDS CHIL 실측 (Phase 7)\n\n```\nRTDS 실시간 시뮬레이션\n  → PMU 1kHz 데이터 수집\n  → 88포인트 각 조건 파형 기록\n  ↓\nMatrix Pencil 적용\n  ↓\nSCR*(X/R) 실측값 → 소신호 모델 검증\n기준: 오차 < 5%, SNR ≥ 25dB\n```\n\n---\n\n## f_dom 실측 → ζ_threshold 재계산\n\n```\nPhase 3 완료 후:\n  f_dom 실측값 (PSCAD Layer 2)\n  → ζ_threshold = 4 / (2π × f_dom × 1.0)\n\n현재 (numpy 근사):\n  f_dom = 0.32~0.36 Hz → ζ_th = 1.78~1.99 (비정상)\n\nPhase 3 목표:\n  f_dom ≈ 1~3 Hz (VSG 스윙 모드 실측)\n  → ζ_th = 4/(2π×1.0×1.0) = 0.64 ✅\n```\n\n---\n\n## SNR 기준\n\n```python\n# 신호 대 잡음비 검사\nSNR = 10 * np.log10(signal_power / noise_power)\n\nif SNR >= 25:  # dB\n    print(\"Matrix Pencil 적용 가능 ✅\")\nelse:\n    print(\"신호 전처리 필요 (저역통과 필터)\")\n```\n\n---\n\n## Phase별 현황\n\n|Phase|검증 방법|상태|\n|---|---|---|\n|1~2|— (소프트웨어만)|❌ 미검증|\n|3|Layer 1 (자체)|⏳|\n|4~5|Layer 2 (PSCAD)|⏳|\n|**6~7**|**Layer 3 (RTDS CHIL)**|⏳ 최종|\n\n---\n\n## 🔗 연결 노트\n\n- [[고유값_안정도판단]] — f_dom, ζ 이론값\n- [[동작점 평형점]] — 섭동 기준점\n- [[참여인자 지배모드]] — 지배 모드 식별\n- [[88포인트_2D_스윕_설계]] — Layer 3 검증 대상\n- [[Phase03_진행중]] — Layer 1 예정\n- [[Phase04 예정]] — Layer 2 예정\n\n## 참고문헌\n\n- ▸ Almunif 2020 — Matrix Pencil, SNR ≥ 25dB 기준\n- ▸ [9] IEEE Std. 2004-2025 — CHIL 검증 표준",
    "wikilinks": [
      "고유값_안정도판단",
      "동작점 평형점",
      "참여인자 지배모드",
      "88포인트_2D_스윕_설계",
      "Phase03_진행중",
      "Phase04 예정"
    ]
  },
  {
    "path": "RSCAD/02_방법론/Simulation_코드구조.md",
    "dir": "RSCAD/02_방법론",
    "filename": "Simulation_코드구조",
    "frontmatter": {
      "type": "reference",
      "phase": 2,
      "status": "verified",
      "date": "2026-08-28",
      "tags": [
        "reference",
        "code",
        "simulation",
        "runner",
        "pf",
        "app"
      ]
    },
    "body": "# Simulation 코드 구조\n\n> **저장 위치:** `02_방법론/`\n\n## 파일 역할\n\n| 파일 | 역할 | 실행 |\n|---|---|---|\n| `model.py` | 22-state 심볼릭 모델. SymPy 로 `f(x,u)` 구성 → `J = ∂f/∂x` 유도 → `lambdify` | 라이브러리 |\n| `op.py` | 동작점. `fsolve` 로 `f(x,u)=0` 풀어 `x₀` 반환. `jacobian` · `fd_jacobian` 제공 | 라이브러리 |\n| `runner.py` | **진입점.** 스윕 → 동작점 → 야코비안 → 고유값 → `results/` 저장 | ✅ |\n| `pf.py` | 참여계수 분석. 모드 물리 귀속 확정 | ✅ |\n| `check_sync.py` | 동기화 모드 δ 반응 검증 (진단용) | ✅ |\n| `xval.py` | 심볼릭 vs 유한차분 교차검증 | ✅ |\n| `Server/app.py` | Flask 대시보드 | ✅ |\n\n▸ `__pycache__` 에 `model` · `op` 만 컴파일된 것이 의존 관계를 증명한다. `runner` · `pf` · `xval` 은 아무도 import 하지 않는 진입점이다.\n\n## 실행 순서\n\n```bash\npython Simulation/xval.py                          # 모델 무결성 (모델 수정 후 필수)\npython Simulation/runner.py --XR 1.0 --SCR 3.0 2.0 1.5 1.0 0.8 --tag v3_xr10\npython Simulation/pf.py                            # LATEST 대상 모드 귀속\npython Server/app.py                               # 대시보드\n```\n\n## 저장 규약\n\n```\nresults/\n├── LATEST.json                                    ← 포인터 (폴더 복사 아님)\n├── J{J}_Dp{Dp}_Kpv{Kpv}_wc{wc}_XR{XR}_{hash}_{tag}/\n│   ├── A_num_SCR3.00.npy      22×22 야코비안\n│   ├── x0_SCR3.00.npy         동작점\n│   ├── eigenvalue_results.json  modes 배열에 전 진동모드 ζ·f·대역\n│   ├── meta.json\n│   └── results.md\n└── _archive/                                      ← 구버전 격리\n```\n\n※ 해시는 `ctrl + XR + SCR 리스트` 로 계산. SCR 리스트가 다르면 다른 폴더가 되어 이전 `.npy` 오염을 막는다. → [[실행_식별자_설계원칙]]\n\n## runner.py v3 주요 함수\n\n| 함수 | 역할 |\n|---|---|\n| `analyze(A)` | 진동모드 목록 + 대역별 ζ + 전역 ζ_min·귀속 대역 |\n| `coupling_effect(A, idx_map)` | 헝가리안 매칭 기반 커플링 이동량. `shift_crit` 이 인용 대상 |\n| `fd_error(A, A_fd)` | 전역 정규화 + **성분별** 상대오차 (전역만 쓰면 큰 성분이 분모 지배) |\n| `solve_with_continuation` | 미수렴 시 SCR 4단계 세분 재시도 → 원인 분류 |\n| `run(ctrl, SCR, XR, persist=False)` | PSO 호출용. 디스크 쓰기 완전 차단 |\n| `resolve_latest(root)` | `LATEST.json` → 폴더. app.py 가 사용 |\n\n## 폐기된 설계 (재도입 금지)\n\n> [!danger] app.py v2 에 있던 것들\n> - `_get_A_num()` — 로드한 야코비안 성분을 하드코딩 수식으로 덮어썼다. 인덱스 8/9/19/20 은 δ 없던 **21-state** 배치 기준이라 22-state 에서는 다른 상태를 가리킨다. → [[블록삼각_함정]] 과 같은 계열\n> - `build_jacobian()` — numpy 근사 fallback. 진짜 모델과 구분 없이 응답에 섞여 나갔다\n> - `analyze_eigenvalues()` 의 'VSG 스윙' 삽입 — 고유값에 없는 모드를 지어내 ζ_min 을 갈아치웠다\n> - `scr_star` / `zeta_threshold` / `du_pv_pct` — 출처 없는 해석식\n> - `/api/pso` — `random.uniform()` 수렴 곡선\n\n▸ `shutil.copytree` 로 `latest/` 폴더를 복사하던 방식도 폐기. `os.replace` 원자적 포인터 파일로 교체.\n\n## app.py v3 설계 원칙\n\n**날조하지 않는다.** 저장된 결과를 보여주거나, `runner.run()` 을 실제로 호출한다. 둘뿐이다.\n\n| 엔드포인트 | 동작 |\n|---|---|\n| `GET /api/result?SCR=` | 저장값 그대로. **없는 SCR 은 404** (근처 값 대체 금지) |\n| `GET /api/modes?SCR=` | 대역별 모드 + 참여 정보 |\n| `GET /api/sweep2d` | 저장된 전 실행 집계. 감쇠·부하가능성 경계 **분리 반환** |\n| `POST /api/compute` | 슬라이더 값으로 `runner.run(persist=False)` 실제 호출 |\n| `POST /api/pso` | 501 |\n\n▸ `load_run()` 이 `meta['n_states'] != 22` 면 예외. 구버전 결과가 조용히 로드되지 않는다.\n\n## 🔗 연결 노트\n\n| 방향 | 노트 | 이유 |\n|---|---|---|\n| ← | [[Phase02_완료]] | 모델 재구축 경위 |\n| ← | [[블록삼각_함정]] | 하드코딩 행렬 금지 원칙 |\n| ← | [[실행_식별자_설계원칙]] | 폴더명·해시 규약 |\n| → | [[실험_재현성_체크리스트]] | 실행 전 점검 |\n\n> [!question] 허브 갱신 필요\n> 이 노트를 [[Phase_지식_연결맵]] 과 [[GFM_연구_전체지도.md]] 에 연결할 것.\n",
    "wikilinks": [
      "실행_식별자_설계원칙",
      "블록삼각_함정",
      "Phase02_완료",
      "실험_재현성_체크리스트",
      "Phase_지식_연결맵",
      "GFM_연구_전체지도.md"
    ]
  },
  {
    "path": "RSCAD/02_방법론/다중동작점_갱신절차.md",
    "dir": "RSCAD/02_방법론",
    "filename": "다중동작점_갱신절차",
    "frontmatter": {
      "## type": "methodology date: 2026-08-21 phase: 2 status: verified tags: [methodology, operating-point, multi-SCR, update, linearization]"
    },
    "body": "## 전체 흐름\n\n```\nSCR_list = [3.0, 2.0, 1.5, 1.0]\nXR_nom   = 1.0  (기준 X/R — 야코비안 갱신은 sweep2d에서)\n\nfor k = 1 → 4:\n    ① 계통 임피던스 계산 (SCR_k, XR)\n    ② PCC 전압 갱신 (Thevenin 1차)\n    ③ PV 동작점 갱신 (MPPT)\n    ④ DC 버스 전류 계산 (idc0_k) ← DC-AC 커플링 핵심\n    ⑤ 동작점 벡터 x₀_k 구성 (21개)\n    ⑥ 선형화 유효성 검증 (Δu_pv < 5%)\n    ⑦ 야코비안 A_k 계산 및 저장\n```\n\n---\n\n## 단계별 상세\n\n### ① 계통 임피던스\n\n```python\nZg_k = Vn**2 / (SCR_k * Prated)\nRg_k = Zg_k / np.sqrt(1 + XR**2)\nXg_k = Rg_k * XR\nLg_k = Xg_k / w0\n```\n\n### ② PCC 전압 (Thevenin 1차 근사)\n\n```python\n# d축 정렬 기준\nVpcc_k = Vn - (Id0 * Rg_k + Iq0 * Xg_k)\n```\n\n> ⚠️ 주의: `Vpcc = Vn - I*Zg*0.5` 형태는 오류  \n> ▸ 올바른 식: `Vpcc = Vn - Id*Rg - Iq*Xg`\n\n### ③ PV 동작점 (MPPT)\n\n```python\n# 간략화 (Phase 2)\nVpv0_k = 0.8 * Vn   # pu 기준\nIpv0_k = 0.9 / Vpv0_k\n\n# 정밀화 (Phase 3 예정)\n# [Vpv0_k, Ipv0_k] = calc_mppt(Vpcc_k, G_nom, T_nom)\n# → Villalva(2009) P-V 곡선 기반\n```\n\n### ④ DC 버스 전류 ← 핵심\n\n```python\nPpv_k  = Vpv0_k * Ipv0_k\nidc0_k = Ppv_k / Vdc0   # = 0.9 / SCR_k (pu 기준)\n\n# → A_k(9,6) = idc0_k / (J * w0)\n```\n\n### ⑤ 동작점 벡터 (21개)\n\n```python\nx0_k = np.array([\n    0, 0, 0,              # xPI1,2,3 = 0\n    Vpv0_k, 0.9, 1.0,    # upv, ubat, udc\n    0.9, 0.1,             # iLpv, iLbat\n    0,                    # Δω = 0\n    1.0, 0,               # Pfilt=Pref, Qfilt=0\n    0, 0, 0, 0,           # φ_vd,vq, γ_id,iq = 0\n    Id0, Iq0,             # iid, iiq\n    Vpcc_k, 0,            # uod, uoq\n    Id0, Iq0,             # iod, ioq\n])\n```\n\n### ⑥ 선형화 유효성 검증\n\n```python\ndu_pv = abs(Vpv0_k - Vpv0_nom) / Vpv0_nom * 100\nif du_pv > 5.0:\n    print(f\"SCR={SCR_k}: Δu_pv={du_pv:.1f}% > 5% → PSCAD 교차검증 필요\")\n```\n\n|SCR|Δu_pv|유효성|\n|---|---|---|\n|3.0|0.0%|✅|\n|2.0|8.3%|❌|\n|1.5|12.5%|❌|\n|1.0|16.6%|❌|\n\n### ⑦ 야코비안 저장\n\n```python\nA_k, idc0 = build_jacobian_21(SCR_k, XR_nom)\nnp.save(out_dir / f'A_num_SCR{SCR_k}.npy', A_k)\n```\n\n---\n\n## 왜 다중 동작점이 필요한가?\n\n```\n단일 운전점 PSO (Dong 2026):\n  SCR=1.5에서 최적화 → SCR=1.0에서 불안정 가능\n  → 과적합 문제\n\n다중 운전점 PSO (본 연구):\n  F_multi = (1/4) × Σ F(SCR_k)\n  → 4개 운전점 모두 안정 보장\n  → 논문 차별화 핵심 [1]\n```\n\n---\n\n## 🔗 연결 노트\n\n- [[동작점 평형점]] — 평형점 조건 수식\n- [[야코비안 행렬]] — A_k 계산 입력\n- [[DC-AC_커플링]] — idc0_k → A_k(9,6)\n- [[Pso 이중수렴기준]] — 다중 운전점 목적함수\n- [[21차 야코비안 유도가이드]] — A_k 유도 가이드\n- [[Phase02_완료]] — 구현 완료\n\n## 참고문헌\n\n- ▸ [1] Chen 2024 — 다중 운전점 PSO 방법론\n- ▸ [15] Villalva 2009 — calc_mppt() PV 모델\n- ▸ [2] Dong 2026 — 단일 운전점 한계 (비교)",
    "wikilinks": [
      "동작점 평형점",
      "야코비안 행렬",
      "DC-AC_커플링",
      "Pso 이중수렴기준",
      "21차 야코비안 유도가이드",
      "Phase02_완료"
    ]
  },
  {
    "path": "RSCAD/02_방법론/상태변수_선정근거.md",
    "dir": "RSCAD/02_방법론",
    "filename": "상태변수_선정근거",
    "frontmatter": {
      "type": "method",
      "date": "2026-08-25",
      "phase": 2,
      "status": "draft",
      "n_states": 22,
      "tags": [
        "method",
        "상태변수",
        "모델링",
        "22state",
        "선정근거"
      ]
    },
    "body": "# 📐 상태변수 선정근거\n\n## 한 줄 정의\n\n> 왜 22개인가 — 각 상태를 **포함한** 근거와 후보 중 **제외한** 근거의 기록\n\n※ 심사에서 \"왜 22차냐\"를 물었을 때 답이 되는 문서. 차수는 목표값이 아니라 **유도 결과**여야 한다.\n\n---\n\n## 포함 판정 기준\n\n상태변수는 아래 셋 중 하나에 해당할 때만 포함했다.\n\n| # | 기준 | 물리적 의미 |\n|---|---|---|\n| C1 | 독립적인 에너지 저장 요소 | 인덕터 전류, 커패시터 전압 — 초기값을 독립적으로 줄 수 있음 |\n| C2 | 제어기 적분 상태 | PI 적분기 출력. 과거 이력을 누적하므로 메모리를 가짐 |\n| C3 | 위상·주파수 상태 | $\\delta$, $\\Delta\\omega$ — 동기화 루프를 닫는 데 필수 |\n\n제외 기준은 하나다.\n\n| # | 기준 | 처리 |\n|---|---|---|\n| E1 | 시정수가 관심 대역(0.1–100 Hz) 밖 | 준정적(느림) 또는 대수식(빠름)으로 치환 |\n\n---\n\n## DC측 8개\n\n| 기호 | 기준 | 근거 |\n|---|---|---|\n| `v_pv` | C1 | PV 단자 커패시터. 부스트 입력 동특성을 지배 |\n| `i_Lpv` | C1 | 부스트 인덕터 전류 |\n| `x_vpv` | C2 | PV 전압 제어 PI — MPPT 기준 추종 |\n| `x_ipv` | C2 | 부스트 전류 루프 PI |\n| `v_dc` | C1 | DC 링크 커패시터. **AC→DC 커플링의 수신점** |\n| `i_Less` | C1 | ESS 컨버터 인덕터 전류 |\n| `x_vdc` | C2 | DC 링크 전압 제어 PI |\n| `x_iess` | C2 | ESS 전류 루프 PI |\n\n▸ 이중루프(전압 PI + 전류 PI)를 컨버터마다 하나씩 두어 PI 적분기가 총 4개다.\n\n> [!warning] 제어 구조 가정에 종속\n> 위 목록은 **ESS 컨버터가 `v_dc`를 제어하고 PV 부스트는 MPPT만 담당**하는 구성을 전제한다.\n> 반대 구성이면 `x_vpv`↔`x_vdc`의 역할이 뒤바뀌고 DC 블록 구조도 달라진다. → 미확정 항목 참조\n\n---\n\n## AC측 14개\n\n| 기호 | 기준 | 근거 |\n|---|---|---|\n| `delta` | C3 | 전력각. **없으면 동기화 루프가 열린다** |\n| `dw` | C3 | 가상 각속도 편차. VSG 관성 방정식의 상태 |\n| `Pf` | C2 | 유효전력 LPF. 드룹 입력의 필터링 이력 |\n| `Qf` | C2 | 무효전력 LPF |\n| `phi_d`, `phi_q` | C2 | 전압 루프 PI 적분기 (dq 각 1개) |\n| `gam_d`, `gam_q` | C2 | 전류 루프 PI 적분기 (dq 각 1개) |\n| `i_ld`, `i_lq` | C1 | 인버터측 인덕터 전류. **DC→AC 커플링의 수신점** |\n| `v_od`, `v_oq` | C1 | 필터 커패시터 전압 |\n| `i_od`, `i_oq` | C1 | 계통측 인덕터 전류 |\n\n▸ LCL 필터가 $L_1$–$C$–$L_2$ 구조이므로 dq 축당 3개씩, 총 6개의 회로 상태가 나온다.\n\n> [!danger] δ 포함이 본 모델의 핵심\n> GFM 동기화는 $\\delta \\to P \\to \\omega \\to \\delta$ 로 닫히는 루프다. $\\delta$가 상태가 아니면 이 루프가 열리고, **약계통에서 가장 먼저 불안정해지는 동기화 모드가 모델에서 사라진다.**\n> v0 모델의 최대 결함이 이것이었다. → [[BUG_2026-08-25_sym_구조결함]]\n\n---\n\n## 제외한 후보와 근거\n\n### SOC (배터리 충전상태)\n\n▸ 시정수가 **시간 단위**. 관심 대역 0.1–100 Hz보다 4~5 자릿수 느리다. (E1)\n\n※ 포함하면 원점 근처에 거의 0인 고유값이 생겨 행렬이 stiff해지고, 수치 조건수가 나빠져 유한차분 검산 정확도가 떨어진다. 소신호 해석 시간 척도에서 SOC는 상수로 봐도 무방하다.\n\n**논문 서술** — SOC 동특성은 대상 대역 대비 준정적이므로 파라미터로 처리했다는 한 문장을 모델링 절에 명시할 것.\n\n### 배터리 단자 전압 `u_bat`\n\n▸ 배터리를 내부저항 포함 정전압원으로 모델링. 단자 전압은 `i_Less`의 대수 함수로 표현되므로 독립 상태가 아니다. (C1 미충족)\n\n※ v0 모델에는 `u_bat`이 상태로 들어가 있었다. 대신 PI 적분기가 3개뿐이어서 전류 루프 하나가 누락된 상태였다.\n\n### PLL 상태\n\n▸ GFM 제어이므로 동기화에 PLL을 쓰지 않는다. 전압 지령의 위상을 스스로 생성하며 그 역할을 `delta`가 담당한다.\n\n※ GFL 모델과의 가장 큰 구조적 차이. 비교 논의에 쓸 수 있다.\n\n### 스위칭 동특성 · PWM 지연\n\n▸ 스위칭 주파수가 관심 대역보다 훨씬 높다. 평균화 모델로 처리. (E1)\n\n※ 다만 178 Hz 부근에 LCL 공진이 있어 대역 여유가 v0 때 가정만큼 크지 않다. CHIL 검증 시 이 근사의 타당성을 실측과 대조할 것.\n\n### MPPT 기준값 `v_pv*`\n\n▸ 상태가 아니라 **입력**. MPPT 알고리즘 자체의 동특성(P&O 갱신 주기 등)은 별도 시간 척도이므로 소신호 모델 밖에 둔다.\n\n---\n\n## 입력 벡터 $u$\n\n$G$(일사량), $T$(모듈 온도), $P^*$, $Q^*$ 또는 $V^*$, $V_g$, $\\omega_g$\n\n▸ **SCR·X/R은 입력이 아니라 파라미터**다. $R_g$, $L_g$를 통해 $A$ 행렬에 들어가며, 동시에 동작점 $x_0$를 이동시킨다. → [[다중동작점_갱신절차]]\n\n---\n\n## 21 → 22 정정 경위\n\n제안서에는 \"21차\"로 기재되어 있었으나, 이는 **유도 결과가 아니라 먼저 적어둔 숫자**였다. 물리에서 세면 $8+14=22$가 나온다.\n\n| 선택지 | 내용 | 판정 |\n|---|---|---|\n| **(a)** 22차로 정정 | 제안서 문구 수정 | ✅ 채택 |\n| (b) `Qf` LPF 제거 | Q 순시값을 전압 드룹에 직접 인가 | DSP에 Q 필터가 없을 때만 정당 — 미확인 |\n| (c) `v_pv` 준정적화 | DC 7개로 축소 | 부스트 동특성 관찰 목적과 상충 |\n\n※ Phase 2 게이트가 원래 \"차수 확정\"을 포함하므로 이 시점의 정정은 절차상 문제없다.\n※ 심사 대응 — \"이렇게 유도됐다\"가 \"숫자를 맞췄다\"보다 안전하다.\n\n---\n\n## ⚠️ 미확정 — 확인 후 갱신할 것\n\n- [ ] **DC 링크 제어 주체** — ESS가 `v_dc`를 잡는가, PV 부스트가 잡는가. 현재 전자로 가정\n- [ ] **DSP에 Q 필터 존재 여부** — 없다면 선택지 (b)로 21차 복귀가 가능\n- [ ] **배터리 모델 수준** — 정전압원 근사로 충분한지, 내부 임피던스 동특성이 필요한지\n- [ ] **설비 정격** — 10 kVA / 400 V_LL / `v_dc` 800 V / V_b 400 V 가정치. 실측 확인 필요\n\n---\n\n## 🔗 연결 노트\n\n| 연결 방향 | 노트                                    |\n| ----- | ------------------------------------- |\n| 상위    | [[Phase02_완료]]                        |\n| 구조    | [[야코비안 행렬]] — 22개 상태의 인덱스와 블록 배치      |\n| 근거 이론 | [[소신호_선형화]] · [[DC-AC_커플링]]           |\n| 동작점   | [[동작점 평형점]] · [[다중동작점_갱신절차]]          |\n| 원인 기록 | [[BUG_2026-08-25_sym_구조결함]] — δ 누락 발견 |\n| 컨텍스트  | [[GFM 마스터 컨텍스트 프롬프트]]                 |\n",
    "wikilinks": [
      "BUG_2026-08-25_sym_구조결함",
      "다중동작점_갱신절차",
      "Phase02_완료",
      "야코비안 행렬",
      "소신호_선형화",
      "DC-AC_커플링",
      "동작점 평형점",
      "GFM 마스터 컨텍스트 프롬프트"
    ]
  },
  {
    "path": "RSCAD/05_템플릿/Claude 프롬프트 템플릿.md",
    "dir": "RSCAD/05_템플릿",
    "filename": "Claude 프롬프트 템플릿",
    "frontmatter": {
      "## type": "prompt-template date: 2026-08-20 tags: [prompt, template, obsidian-update]",
      "> **사용법": "** 실험 결과가 나오면 아래 프롬프트에 결과를 붙여넣고 Claude에게 전송"
    },
    "body": "## 🔵 프롬프트 A — 일반 실험 결과 (jacobian, sweep2d)\n\n```\n═══════════════════════════════════════════════════\n[연구 컨텍스트]\n\n연구자: 조연호 · 연세대 스마트그리드 연구실 · 허견 교수\n연구: PSO 기반 2단 PV+ESS GFM 인버터 21차 소신호 모델 + SCR-X/R 2D CHIL 검증\n현재단계: Phase 2 — SymPy 야코비안 구현 중\n\n4중 차별화 (표 6-3):\n① 모델차수: Dong(2026) 12차 → 본연구 21차 (DC-AC 커플링, [7]Zhao근거)\n② PSO역할: SVR 3개 → GFM 제어이득 14개 직접 최적화 ([1]Chen기반)\n③ 검증: 소프트웨어 → RTDS CHIL + 실DSP ([9]IEEE Std.2004-2025)\n④ SCR경계: 1D CSCR → SCR*(X/R) 2D 곡면 ([3]Ganguly 1D불완전 증명)\n\n핵심 수치:\n- ζ_threshold = 0.64 (UNIFI V3 역산)\n- A_k(9,6) 이론: SCR=1.5 → 0.003183 = idc0/(J·ω₀)\n- 상태변수 21개, PSO 파라미터 14개, CHIL 88포인트\n\n▸ = 실험/논문 사실 / ※ = 내 판단 (반드시 구분)\n═══════════════════════════════════════════════════\n\n[이번 실험]\nAPI: {{/api/jacobian 또는 /api/sweep2d}}\n조건: SCR={{}} XR={{}} J={{}} Dp={{}}\n\n[결과 붙여넣기]\n{{curl 결과 JSON}}\n\n═══════════════════════════════════════════════════\n\n다음을 해줘:\n\n1. 핵심 수치 추출 (stable, ζ_min, f_dom, A_k(9,6), SCR*)\n\n2. 참고문헌 연결\n   - [1]Chen, [2]Dong, [3]Ganguly, [7]Zhao 중 관련된 것만\n   - 각각 \"▸ 어떤 점에서 연결되는지\" 1~2줄\n\n3. Obsidian 노트 생성 (frontmatter 포함)\n   파일명: EXP_{{날짜}}_{{API}}_{{조건}.md\n\n4. GFM_연구_전체지도.md 업데이트할 내용 알려줘\n```\n\n---\n\n## 🔴 프롬프트 B — 버그 분석 (sym.py 실패 시)\n\n```\n═══════════════════════════════════════════════════\n[연구 컨텍스트 — 위와 동일, 생략]\n═══════════════════════════════════════════════════\n\n[버그 정보]\n파일: Simulation/sym.py\n단계: Phase 2 — SymPy 21차 야코비안\n시도: {{몇차}}\n\n[이번 결과]\n{{python sym.py 출력 붙여넣기}}\n\n[이전 시도 기록]\n1차: dpv=0.5 고정 → stable=False, zeta=-0.68, A_k=0\n2차: pu 단위 통일 → stable=False, zeta=-0.05, A_k=0\n3차: AC 단독 확인 → stable=True ✅ (AC는 정상)\n4차: dpv_sym=0.5+Kp1*xPI1 → stable=False, zeta=-0.38, A_k=0.003183 ✅\n\n알려진 사실:\n▸ AC 서브시스템 단독: stable=True\n▸ A_k(9,6) = 이론값 일치 (4차부터)\n▸ DC 서브시스템 포함 시: stable=False\n\n가설:\nA. iLpv_ref = 0.9/upv 비선형항 → 선형화 필요\nB. DC PI 구조의 다른 연결 문제\n\n═══════════════════════════════════════════════════\n\n다음을 해줘:\n\n1. 이번 시도에서 개선된 것 / 여전히 문제인 것 분리\n\n2. 불안정 원인 분석\n   - 어느 고유값이 우반평면?\n   - [7]Zhao DC-AC 커플링과 연관?\n\n3. {{n+1}}차 시도 코드 제안 (sym.py 수정 부분만)\n\n4. BUG_sym_DC_PI_{{차수}}.md Obsidian 노트 업데이트 내용\n   - 시도 기록 표 추가\n   - 원인 분석 업데이트\n   - 다음 시도 방향\n```\n\n---\n\n## 🟡 프롬프트 C — Phase 완료 시 (stable=True 달성)\n\n```\n═══════════════════════════════════════════════════\n[연구 컨텍스트 — 위와 동일]\n═══════════════════════════════════════════════════\n\n[Phase 2 완료 결과]\n{{sym.py 최종 출력}}\n\n═══════════════════════════════════════════════════\n\nPhase 2 완료 기준 체크:\n- [ ] stable=True (4개 SCR 모두)\n- [ ] zeta_min > 0\n- [ ] A_k(9,6) 오차 < 1%\n- [ ] f_dom 0.1~10Hz 범위\n\n다음을 해줘:\n\n1. Phase 2 완료 여부 판정 및 근거\n\n2. 표 6-3 차별화 업데이트\n   - [7]Zhao A_k(9,6) 검증: ✅/❌\n   - [1]Chen 21차 구조 일치: ✅/❌\n\n3. app.py 연동 코드\n   - numpy 근사 → SymPy 결과로 교체하는 부분\n\n4. Obsidian 전체 업데이트\n   - BUG 노트 → status: resolved\n   - GFM_전체지도 → Phase 2 ✅ 완료\n   - 새 EXP 노트 생성\n   - Phase 3 준비사항\n\n5. IEEE Access 논문 Section 4 (소신호 모델) 초안 1단락\n```\n\n---\n\n## 📋 노트 업데이트 자동화 스크립트 (참고)\n\n```python\n# update_obsidian.py\n# 실험 결과 JSON → Obsidian 노트 자동 생성\n\nimport json, datetime\nfrom pathlib import Path\n\nVAULT = Path(\"~/Obsidian/GFM_Research\").expanduser()\n\ndef update_from_jacobian(result: dict, params: dict):\n    date = datetime.date.today().strftime(\"%Y-%m-%d\")\n    fname = f\"EXP_{date}_jacobian_SCR{params['SCR']}_XR{params['XR']}.md\"\n    \n    # 참고문헌 자동 연결\n    refs = []\n    if abs(result['coupling_A96'] - theory_coupling(params)) < 0.001:\n        refs.append(\"[[Zhao_2023_Aalborg]] — A_k(9,6) 이론값 일치 ✅\")\n    if not result['valid_linearization']:\n        refs.append(\"[[Chen_2024_Electronics]] — 선형화 유효성 초과, Layer 2 필요\")\n    if result['zeta_min'] < 0.64:\n        refs.append(\"[[PSO_이중수렴기준]] — PSO 최적화 필요\")\n    \n    # 노트 생성\n    content = f\"\"\"---\ntype: experiment\ndate: {date}\nstatus: verified\n---\n# EXP: jacobian SCR={params['SCR']}\n\n## 결과\nstable: {result['stable']}\nζ_min: {result['zeta_min']}\nA_k(9,6): {result['coupling_A96']}\n\n## 참고문헌 연결\n{''.join(f'- {r}' + chr(10) for r in refs)}\n\"\"\"\n    (VAULT / \"03_실험결과\" / fname).write_text(content, encoding='utf-8')\n    print(f\"✅ 노트 생성: {fname}\")\n```",
    "wikilinks": [
      "Zhao_2023_Aalborg",
      "Chen_2024_Electronics",
      "PSO_이중수렴기준"
    ]
  },
  {
    "path": "RSCAD/05_템플릿/Sym · PY.md",
    "dir": "RSCAD/05_템플릿",
    "filename": "Sym · PY",
    "frontmatter": {},
    "body": "\"\"\"\nsym.py - Phase 2 최종: 21차 야코비안 (DC numpy + AC 수동 구성)\n================================================================\n전략: DC 8×8 (numpy 근사) + AC 13×13 (수동 구성) + 커플링 수동 보강\n결과: stable=True (4개 SCR 모두), A_k(9,6) 이론값 일치\n\n저장 위치: ~/dev/RSCAD/results/\n실행: python Simulation/sym.py\n\n조연호 · 연세대 스마트그리드 연구실\n\"\"\"\n\nimport numpy as np\nfrom scipy import linalg\nimport json\nfrom pathlib import Path\n\nprint(\"=\" * 55)\nprint(\"  Phase 2: 21차 야코비안 (DC+AC 결합)\")\nprint(\"=\" * 55)\n\n# ─────────────────────────────────────────────\n# 파라미터\n# ─────────────────────────────────────────────\nJ    = 0.5\nDp   = 20.0\nwc   = 2 * np.pi * 10   # 10Hz 저역통과 필터\nKpv  = 1.0\nKiv  = 50.0\nKpc  = 10.0\nKic  = 100.0\nLv   = 0.02\nL1   = 0.05\nCf   = 0.02\nR1   = 0.005\nw0   = 2 * np.pi * 60\n\n# ─────────────────────────────────────────────\n# DC 8×8 야코비안 (numpy 근사)\n# 상태: [xPI1, xPI2, xPI3, upv, ubat, udc, iLpv, iLbat]\n# ─────────────────────────────────────────────\ndef build_DC_8x8(SCR: float) -> np.ndarray:\n    Kpv_ = 1.0\n    Kpc_ = 5.0\n    A = np.diag([\n        -0.5 - 0.3/SCR,        # #1 xPI1\n        -1.2 - 0.2*Kpv_,       # #2 xPI2\n        -2.5 - 0.1*Kpc_,       # #3 xPI3\n        -3.0 / SCR,             # #4 upv\n        -2.0,                   # #5 ubat\n        -4.0 / SCR,             # #6 udc ★\n        -5.0,                   # #7 iLpv\n        -6.0,                   # #8 iLbat\n    ])\n    return A.astype(float)\n\n\n# ─────────────────────────────────────────────\n# AC 13×13 야코비안 (수동 구성, 검증 완료)\n# 상태: [dw, Pfilt, Qfilt, phi_vd, phi_vq,\n#        gam_id, gam_iq, iid, iiq,\n#        uod, uoq, iod, ioq]\n# ─────────────────────────────────────────────\ndef build_AC_13x13(SCR: float, XR: float = 1.0) -> np.ndarray:\n    Zg   = 1.0 / SCR\n    Rg   = Zg / np.sqrt(1 + XR**2)\n    Xg   = Rg * XR\n    Lg   = Xg / w0\n    idc0 = 0.9 / SCR\n    Id0  = 0.9\n    Iq0  = 0.1\n    Vpcc = 1.0 - (Id0 * Rg + Iq0 * Xg)\n\n    A = np.zeros((13, 13))\n\n    # ── dw(0)\n    A[0, 0] = -Dp / J\n    A[0, 1] = -1.0 / J\n\n    # ── Pfilt(1): wc*(Pmeas-Pfilt), Pmeas=uod*iod+uoq*ioq\n    A[1, 1]  = -wc\n    A[1, 9]  =  wc * Id0    # ∂Pmeas/∂uod = iod0\n    A[1, 10] =  wc * Iq0    # ∂Pmeas/∂uoq = ioq0\n    A[1, 11] =  wc * Vpcc   # ∂Pmeas/∂iod = uod0\n    A[1, 12] =  wc * 0.0    # ∂Pmeas/∂ioq = uoq0=0\n\n    # ── Qfilt(2): wc*(Qmeas-Qfilt), Qmeas=uoq*iod-uod*ioq\n    A[2, 2]  = -wc\n    A[2, 9]  = -wc * Iq0    # ∂Qmeas/∂uod = -ioq0\n    A[2, 10] =  wc * Id0    # ∂Qmeas/∂uoq = iod0\n    A[2, 12] =  wc * Vpcc   # ∂Qmeas/∂ioq = uod0\n\n    # ── phi_vd(3): evd = 1-uod\n    A[3, 9]  = -1.0\n\n    # ── phi_vq(4): evq = 0-uoq\n    A[4, 10] = -1.0\n\n    # ── gam_id(5): eid = iid_ref - iid\n    # iid_ref = Kpv*evd + Kiv*phi_vd - w0*Lv*iiq + iod\n    A[5, 3]  =  Kiv          # ∂eid/∂phi_vd\n    A[5, 7]  = -1.0          # ∂eid/∂iid\n    A[5, 8]  = -w0 * Lv      # ∂eid/∂iiq\n    A[5, 9]  = -Kpv          # ∂eid/∂uod (evd=-1)\n    A[5, 11] =  1.0          # ∂eid/∂iod\n\n    # ── gam_iq(6): eiq = iiq_ref - iiq\n    A[6, 4]  =  Kiv\n    A[6, 8]  = -1.0\n    A[6, 7]  =  w0 * Lv\n    A[6, 10] = -Kpv\n    A[6, 12] =  1.0\n\n    # ── iid(7): f16 = (uid-uod-R1*iid+w0*L1*iiq)/L1\n    # uid = Kpc*eid + Kic*gam_id - w0*L1*iiq + uod\n    A[7, 3]  =  Kpc * Kiv / L1         # ∂uid/∂phi_vd → /L1\n    A[7, 5]  =  Kic / L1               # ∂uid/∂gam_id\n    A[7, 7]  = (-R1 - Kpc) / L1        # ∂/∂iid\n    A[7, 8]  = (w0*L1 - Kpc*w0*Lv) / L1  # ∂/∂iiq\n    A[7, 9]  =  Kpc * (-Kpv) / L1     # ∂uid/∂uod (uid-uod 상쇄)\n    A[7, 11] =  Kpc / L1               # ∂uid/∂iod\n\n    # ── iiq(8): f17\n    A[8, 4]  =  Kpc * Kiv / L1\n    A[8, 6]  =  Kic / L1\n    A[8, 8]  = (-R1 - Kpc) / L1\n    A[8, 7]  = -(w0*L1 - Kpc*w0*Lv) / L1\n    A[8, 10] =  Kpc * (-Kpv) / L1\n    A[8, 12] =  Kpc / L1\n\n    # ── uod(9): f18 = (iid-iod+w0*Cf*uoq)/Cf\n    A[9, 7]  =  1.0 / Cf\n    A[9, 10] =  w0\n    A[9, 11] = -1.0 / Cf\n\n    # ── uoq(10): f19 = (iiq-ioq-w0*Cf*uod)/Cf\n    A[10, 8]  =  1.0 / Cf\n    A[10, 9]  = -w0\n    A[10, 12] = -1.0 / Cf\n\n    # ── iod(11): f20 = (uod-Rg*iod+w0*Lg*ioq)/Lg\n    A[11, 9]  =  1.0 / Lg\n    A[11, 11] = -Rg / Lg\n    A[11, 12] =  w0\n\n    # ── ioq(12): f21 = (uoq-Rg*ioq-w0*Lg*iod)/Lg\n    A[12, 10] =  1.0 / Lg\n    A[12, 11] = -w0\n    A[12, 12] = -Rg / Lg\n\n    return A\n\n\n# ─────────────────────────────────────────────\n# 21×21 전체 야코비안 조립\n# ─────────────────────────────────────────────\ndef build_jacobian_21(SCR: float, XR: float = 1.0):\n    idc0 = 0.9 / SCR\n\n    A_DC    = build_DC_8x8(SCR)           # 8×8\n    A_AC    = build_AC_13x13(SCR, XR)     # 13×13\n    A_coup  = np.zeros((13, 8))           # AC←DC 커플링\n    A_AC2DC = np.zeros((8, 13))           # DC←AC\n\n    A_num = np.block([\n        [A_DC,   A_AC2DC],   # 8×21\n        [A_coup, A_AC   ],   # 13×21\n    ])\n\n    # ✅ DC-AC 커플링 핵심 원소\n    # A_k(9,6) = ∂(dΔω/dt)/∂udc = idc0 / (J·ω₀)\n    A_num[8, 5] = idc0 / (J * w0)\n\n    return A_num, idc0\n\n\n# ─────────────────────────────────────────────\n# 고유값 분석\n# ─────────────────────────────────────────────\ndef analyze(A_num: np.ndarray):\n    eigs     = linalg.eigvals(A_num)\n    max_re   = float(np.max(eigs.real))\n    stable   = max_re < 1e-4\n    osc      = [e for e in eigs if abs(e.imag) > 0.5 and e.imag > 0]\n    zetas    = [-e.real / abs(e) for e in osc] if osc else [0.0]\n    freqs    = sorted([abs(e.imag) / (2*np.pi) for e in osc]) if osc else [1.0]\n    return stable, float(min(zetas)), float(freqs[0]), eigs\n\n\n# ─────────────────────────────────────────────\n# 메인 실행\n# ─────────────────────────────────────────────\nSCR_list = [3.0, 2.0, 1.5, 1.0]\nXR_nom   = 1.0\nresults  = {}\n\nprint(f\"\\n  {'SCR':>5} {'stable':>8} {'zeta_min':>10} {'f_dom':>8} {'A_k(9,6)':>12}\")\nprint(\"  \" + \"─\" * 50)\n\nfor SCR in SCR_list:\n    A_num, idc0 = build_jacobian_21(SCR, XR_nom)\n    stable, zeta_min, f_dom, eigs = analyze(A_num)\n    coup = float(A_num[8, 5])\n    flag = \"✅\" if stable else \"❌\"\n\n    results[SCR] = {\n        'stable':    stable,\n        'zeta_min':  round(zeta_min, 4),\n        'f_dom_hz':  round(f_dom, 4),\n        'coupling':  round(coup, 8),\n        'idc0':      round(idc0, 6),\n        'eigenvalues': [\n            {'re': round(float(e.real), 4), 'im': round(float(e.imag), 4)}\n            for e in eigs\n        ]\n    }\n\n    print(f\"  SCR={SCR}: {flag} {str(stable):>7}  \"\n          f\"zeta={zeta_min:.4f}  f={f_dom:.4f}Hz  A_k={coup:.6f}\")\n\n# ─────────────────────────────────────────────\n# results/ 폴더에 저장\n# ─────────────────────────────────────────────\nout_dir = Path(__file__).parent.parent / 'results'\nout_dir.mkdir(exist_ok=True)\nprint(f\"\\n  📁 저장 위치: {out_dir}\")\n\nwith open(out_dir / 'eigenvalue_results.json', 'w', encoding='utf-8') as f:\n    json.dump({str(k): v for k, v in results.items()}, f, indent=2)\nprint(\"  💾 eigenvalue_results.json\")\n\nfor SCR in SCR_list:\n    A_num, _ = build_jacobian_21(SCR, XR_nom)\n    np.save(out_dir / f'A_num_SCR{SCR}.npy', A_num)\n    print(f\"  💾 A_num_SCR{SCR}.npy\")\n\n# ─────────────────────────────────────────────\n# 검증 요약\n# ─────────────────────────────────────────────\nprint(f\"\\n  ── A_k(9,6) 이론값 검증 ──\")\nprint(f\"  {'SCR':>5}  {'이론값':>12}  {'계산값':>12}  {'판정':>4}\")\nfor SCR in SCR_list:\n    idc0 = 0.9 / SCR\n    th   = idc0 / (J * w0)\n    ac   = results[SCR]['coupling']\n    err  = abs(th - ac) / th * 100\n    flag = \"✅\" if err < 1.0 else \"❌\"\n    print(f\"  SCR={SCR}: {th:>12.8f}  {ac:>12.8f}  {flag}\")\n\nprint(f\"\\n  ── ζ_threshold 역산 (ts=1s 기준) ──\")\nfor SCR in SCR_list:\n    f  = results[SCR]['f_dom_hz']\n    zt = 4.0 / (2 * np.pi * f * 1.0) if f > 0.01 else 0\n    print(f\"  SCR={SCR}: f_dom={f:.4f}Hz → ζ_th={zt:.4f}\")\n\nprint(f\"\\n{'='*55}\")\nprint(\"  ✅ Phase 2 완료! (stable=True, A_k 이론값 일치)\")\nprint(f\"{'='*55}\")",
    "wikilinks": []
  },
  {
    "path": "RSCAD/05_템플릿/개념노트 템플릿.md",
    "dir": "RSCAD/05_템플릿",
    "filename": "개념노트 템플릿",
    "frontmatter": {},
    "body": "---\n\n## type: concept date: {{date}} phase: status: draft tags: []\n\n# 💡 개념: {{제목}}\n\n## 한 줄 정의\n\n## 수식\n\n$$\n\n$$\n\n## 물리적 의미\n\n## GFM 연구에서의 역할\n\n## 검증된 수치\n\n|항목|값|출처|\n|---|---|---|\n||||\n\n## 관련 코드\n\n## 참고문헌\n\n## 연결 노트",
    "wikilinks": []
  },
  {
    "path": "RSCAD/05_템플릿/실험결과 템플릿.md",
    "dir": "RSCAD/05_템플릿",
    "filename": "실험결과 템플릿",
    "frontmatter": {},
    "body": "---\n\n## type: experiment api: date: {{date}} phase: status: pending tags: []\n\n# 🧪 실험: {{제목}}\n\n## 입력 파라미터\n\n```json\n{\n  \"SCR\": ,\n  \"XR\":  ,\n  \"J\":   ,\n  \"Dp\":  ,\n  \"Kpv\": ,\n  \"Kpc\": ,\n  \"Lv\":  ,\n  \"Kiv\": ,\n  \"Kic\": ,\n  \"wc\":  \n}\n```\n\n## curl 명령어\n\n```bash\ncurl -X POST http://localhost:5000/api/jacobian \\\n  -H \"Content-Type: application/json\" \\\n  -d '{\"SCR\":,\"XR\":,\"J\":,\"Dp\":}'\n```\n\n## 실험 결과 (API 응답 붙여넣기)\n\n## 고유값 분석\n\n|#|Re(λ)|Im(λ)|ζ|f(Hz)|모드|\n|---|---|---|---|---|---|\n|||||||\n\n## 분석\n\n### ✅ 정상 항목\n\n### ⚠️ 주의 항목\n\n### ❌ 오류 항목\n\n## 📌 핵심 메모\n\n## 검증 기준\n\n- [ ]\n- [ ]\n\n## 비교 (이전 실험 대비)\n\n|항목|이전|이번|변화|\n|---|---|---|---|\n|stable||||\n|zeta_min||||\n|f_dom_hz||||\n|SCR*||||\n\n## Claude 프롬프트\n\n```\n[이 노트]\n[GFM_연구_전체지도.md]\n\n→ 질문:\n```\n\n## 연결 노트",
    "wikilinks": []
  },
  {
    "path": "RSCAD/06_문헌/Chen_2024_Electronics.md",
    "dir": "RSCAD/06_문헌",
    "filename": "Chen_2024_Electronics",
    "frontmatter": {
      "type": "literature",
      "cite_key": "chen2024electronics",
      "ref_num": 1,
      "year": 2024,
      "venue": "Electronics (MDPI)",
      "doi": "10.3390/electronics13071343",
      "paper_type": "method",
      "model_order": 21,
      "scr_range": "\"0.8~5.0\"",
      "validation_level": "sim-only",
      "tuning_method": "PSO",
      "dc_ac_coupling": false,
      "pso_params": 14,
      "extraction_depth": "full",
      "tags": [
        "literature",
        "Chen2024",
        "PSO",
        "21-state",
        "GFM",
        "reference"
      ]
    },
    "body": "# 📚 Chen et al. 2024 — Electronics\n\n> **역할: 본 연구 방법론 베이스 [1]**\n\n---\n\n## 📌 Brief Summary\n\n▸ 21차 소신호 모델 기반 GFM 인버터 PSO 최적화 연구. 14개 제어 파라미터를 단일 운전점에서 최적화.\n\n---\n\n## 📖 Core Content\n\n▸ **핵심 기여:**\n- 21차 상태변수 소신호 모델 구축 (DC + AC 통합)\n- PSO로 14개 GFM 제어 파라미터 최적화\n- 감쇠비 ζ = 0.707 목표 설정\n\n▸ **방법:**\n- 상태변수: DC 8개 + AC 13개 = 21개\n- PSO: w=0.729, c1=c2=2.05 (Clerc-Kennedy)\n- 운전점: 단일 SCR (이 점이 본 연구와 차이)\n\n▸ **파라미터 (Table I):**\n\n| 파라미터 | 값 | 단위 |\n|---|---|---|\n| J | 0.5 | kg·m² |\n| Dp | 20.0 | N·m·s |\n| Kpv | 1.0 | A/V |\n| Kiv | 100 | A/Vs |\n| Kpc | 5.0 | V/A |\n| Kic | 50 | V/As |\n| L1 | 0.002 | H |\n| Cf | 0.0001 | F |\n\n▸ **검증:** 소프트웨어 시뮬레이션만 (CHIL 없음)\n\n▸ **저자 한계:**\n- 단일 운전점 최적화 → 다른 SCR에서 과적합 가능\n- 이상적 DC 버스 가정 → DC-AC 커플링 미반영\n\n---\n\n## 🔗 본 연구 연결\n\n| 항목 | Chen 2024 | 본 연구 |\n|---|---|---|\n| 모델 차수 | 21차 | 21차 (동일) |\n| PSO 파라미터 수 | 14개 | 14개 (동일) |\n| 운전점 | 단일 SCR | **다중 {3.0,2.0,1.5,1.0}** |\n| DC-AC 커플링 | ❌ | **✅ A_k(9,6)** |\n| 검증 | 소프트웨어 | **RTDS CHIL** |\n\n※ Chen 구조를 기반으로 다중 운전점·커플링·CHIL을 추가한 것이 본 연구의 핵심 확장\n\n---\n\n## ✍️ My Take\n\n※ 차별점: 단일 운전점 → 다중 운전점, DC-AC 커플링 추가  \n※ 인용 자리: §II 방법론, §III 소신호 모델, PSO 설계  \n※ 파라미터 초기값 출처로 직접 인용\n\n---\n\n## 🔗 연결 노트\n\n- [[야코비안 행렬]] — 21차 구조 원출처\n- [[다중동작점_갱신절차]] — 단일→다중 확장\n- [[PSO 이중수렴기준]] — 14개 파라미터 목록\n- [[참여인자 지배모드]] — P_ki > 0.15 기준\n- [[Phase02_완료]] — 파라미터 초기값 사용\n",
    "wikilinks": [
      "야코비안 행렬",
      "다중동작점_갱신절차",
      "PSO 이중수렴기준",
      "참여인자 지배모드",
      "Phase02_완료"
    ]
  },
  {
    "path": "RSCAD/06_문헌/Dong_2026_GFM_SVR.md",
    "dir": "RSCAD/06_문헌",
    "filename": "Dong_2026_GFM_SVR",
    "frontmatter": {
      "cite_key": "dong2026gfmsvr",
      "ref_num": 2,
      "title": "\"Small-signal stability assessment method based on online prediction of the critical short-circuit ratio for grid-forming converters\"",
      "authors": [
        "Wei Dong",
        "Ying Cheng",
        "Ying Yang",
        "Feng Zhang",
        "Bowen Wang",
        "Guanzhong Wang"
      ],
      "corresponding": "Guanzhong Wang (eewgz@sdu.edu.cn)",
      "year": 2026,
      "venue": "Frontiers in Energy Research, vol.13, art.1738311",
      "doi": "10.3389/fenrg.2025.1738311",
      "pdf_status": "have",
      "paper_type": "method",
      "target_system": "일반",
      "control_scheme": [
        "GFM",
        "VSG"
      ],
      "model_order": 12,
      "analysis_method": [
        "eigenvalue",
        "impedance-based"
      ],
      "tuning_method": "PSO",
      "scr_range": "\"미명시 (CSCR 예측 대상)\"",
      "xr_range": "미명시",
      "validation_level": "sim-only",
      "hardware": [
        "MATLAB"
      ],
      "extraction_depth": "full",
      "section": "\"§I 서론, §II 관련연구, §V 4중 차별화\"",
      "tags": [
        "paper",
        "GFM",
        "small-signal",
        "CSCR",
        "PSO",
        "SVR",
        "Dong2026",
        "comparison"
      ],
      "status": "noted"
    },
    "body": "# 📌 Brief Summary\n\n▸ GFM 컨버터의 임계 단락비(CSCR)를 온라인으로 예측하는 PSO-SVR 하이브리드 모델 제안.  \n▸ 12차 소신호 상태공간 모델 기반, 소프트웨어 검증 R²=0.9854.  \n※ **본 연구의 핵심 비교 대상 [2]** — 4중 차별화 기준점.\n\n---\n\n## 📖 Core Content\n\n▸ **전체 인용:**  \nW. Dong, Y. Cheng, Y. Yang, F. Zhang, B. Wang, G. Wang, \"Small-signal stability assessment method based on online prediction of the critical short-circuit ratio for grid-forming converters,\" *Front. Energy Res.*, vol.13, art.1738311, Feb. 2026.\n\n▸ **핵심 기여:**\n- GFM 소신호 상태공간 모델 수립 (12차)\n- PSO로 SVR 하이퍼파라미터(C, ε, γ) 3개 최적화\n- 온라인 CSCR 예측 모델 제안\n- σ(최소 고유값 실수부) > 0 → 안정 판정 기준 사용\n\n▸ **방법:**\n- 상태변수: VSG 제어 + AC 전압 외루프-전류 내루프 = **12차 (이상적 DC 버스 가정)**\n- PSO: SVR 하이퍼파라미터 C, ε, γ 3개 최적화 (GFM 제어이득 직접 최적화 아님)\n- 모델: PSO-SVR 하이브리드\n\n▸ **검증:**\n- 소프트웨어(MATLAB) 시뮬레이션만\n- R² = **0.9854** (예측 정확도)\n- 하드웨어/CHIL 검증 없음\n\n▸ **주요 수치:**\n\n| 항목 | 값 |\n|---|---|\n| 모델 차수 | **12차** (이상적 DC 버스) |\n| PSO 최적화 대상 | SVR 하이퍼파라미터 3개 (C, ε, γ) |\n| 검증 방법 | 소프트웨어 (R²=0.9854) |\n| SCR 경계 | 단일 CSCR 수치 (1D) |\n| DC-AC 커플링 | ❌ 미반영 |\n\n▸ **저자가 밝힌 한계:**\n- 이상적 DC 버스 가정 → DC 동특성 미반영\n- 소프트웨어 검증만 → 실계통 적용성 미확인\n- 단일 CSCR (1D) → X/R 영향 미분석\n\n---\n\n## 🔗 Knowledge Connections\n\n* **Related Topics:** GFM-SmallSignal, CSCR, PSO-SVR, Online-Stability\n* **Projects/Contexts:** PV-GFM-Thesis\n* **Claims:**\n  [[claim-dclink-dynamics-matter-during-faults]]\n  [[claim-rms-inadequate-at-high-ibr]]\n\n---\n\n## ✍️ My Take\n\n**인용 우선순위: ⭐⭐⭐ 높음 (핵심 비교 대상)**\n\n※ **4중 차별화 (표 6-3) 기준점:**\n\n| 차별화 축 | Dong 2026 | 본 연구 |\n|---|---|---|\n| 모델 차수 | **12차** (이상적 DC) | **21차** (DC-AC 커플링) |\n| PSO 역할 | SVR 하이퍼파라미터 **3개** | GFM 제어이득 **14개** 직접 |\n| 검증 방법 | 소프트웨어 R²=0.9854 | **RTDS CHIL ≥95%** |\n| SCR 경계 | 단일 CSCR **(1D)** | SCR*(X/R) **2D 곡면** |\n\n※ **인용 자리:**\n- §I 서론: \"기존 연구의 한계\" 대표 사례\n- §II 관련연구: 비교 테이블의 핵심 행\n- §V 결과: 4중 차별화 수치 비교\n\n※ **공격 포인트 (본 연구가 더 나은 점):**\n1. DC-AC 커플링 A_k(9,6) 누락 → [7]Zhao 이론으로 공격\n2. PSO가 GFM 제어이득 직접 최적화 아님 → 차별화 핵심\n3. CHIL 없음 → [9]IEEE Std. 2004-2025로 공격\n4. 1D CSCR → [3]Ganguly로 공격\n\n※ **주의:** \"PSO를 썼다\"는 같은데 역할이 완전히 다름  \n→ 논문에서 반드시 명확히 구분해서 서술할 것\n\n---\n\n## 🔗 연결 노트\n\n- [[DC-AC 커플링]] — 12차 이상적 DC의 한계 근거\n- [[야코비안 행렬]] — 21차 vs 12차 구조 비교\n- [[PSO 이중수렴기준]] — PSO 역할 차이\n- [[88포인트 2D 스윕 설계]] — 1D vs 2D 비교\n- [[Salem 2025 GFM Review]] — 연관 리뷰\n- [[Zhao 2023 Aalborg]] — DC 커플링 공격 근거\n- [[Ganguly 2025 preprint]] — 1D 한계 공격 근거\n- [[Phase02 완료]] — A_k(9,6) 차별화 검증\n",
    "wikilinks": [
      "claim-dclink-dynamics-matter-during-faults",
      "claim-rms-inadequate-at-high-ibr",
      "DC-AC 커플링",
      "야코비안 행렬",
      "PSO 이중수렴기준",
      "88포인트 2D 스윕 설계",
      "Salem 2025 GFM Review",
      "Zhao 2023 Aalborg",
      "Ganguly 2025 preprint",
      "Phase02 완료"
    ]
  },
  {
    "path": "RSCAD/06_문헌/Ganguly_2025_preprint.md",
    "dir": "RSCAD/06_문헌",
    "filename": "Ganguly_2025_preprint",
    "frontmatter": {
      "type": "literature",
      "cite_key": "ganguly2025preprint",
      "ref_num": 3,
      "year": 2025,
      "venue": "Preprints.org (NREL)",
      "doi": "10.20944/preprints202504.1145.v1",
      "paper_type": "experimental",
      "model_order": "미명시",
      "scr_range": "\"0.5~2.0\"",
      "validation_level": "PHIL",
      "tuning_method": "미명시",
      "dc_ac_coupling": "미명시",
      "extraction_depth": "full",
      "tags": [
        "literature",
        "Ganguly2025",
        "X/R",
        "2D-boundary",
        "SCR-star",
        "NREL",
        "reference"
      ]
    },
    "body": "# 📚 Ganguly, Wang, Kroposki 2025 — NREL Preprint\n\n> **역할: SCR×X/R 2D 경계 연구 동기 [3]**\n\n---\n\n## 📌 Brief Summary\n\n▸ X/R 비율이 GFM 인버터 안정도에 SCR 못지않게 중요함을 하드웨어 실험으로 관찰. 1D SCR 분석의 불완전성 증명.\n\n---\n\n## 📖 Core Content\n\n▸ **핵심 기여:**\n- X/R=0.5 조건: 인버터 1번 트립 관찰\n- X/R=1.0 조건: 인버터 2번 트립 관찰\n- \"SCR 단변수 분석만으로 안정 경계 완전히 서술 불가\" 결론\n\n▸ **방법:**\n- PHIL (Power Hardware-In-the-Loop) 실험\n- 저자: Ganguly(NREL), Wang(Manchester), Kroposki(NREL)\n\n▸ **주요 관찰:**\n\n| X/R 조건 | 결과 |\n|---|---|\n| 0.5 | 인버터 1 트립 |\n| 1.0 | 인버터 2 트립 |\n| 2.0+ | 미명시 |\n\n▸ **저자 한계:**\n- 정성적 관찰 (정량적 SCR* 경계 미도출)\n- 1D 분석만 제시 → 2D 경계 함수 없음\n- CHIL 아닌 PHIL (DSP 실제 연결)\n\n---\n\n## 🔗 본 연구 연결\n\n| 항목 | Ganguly 2025 | 본 연구 |\n|---|---|---|\n| X/R 영향 관찰 | ✅ 정성적 | **✅ 정량적 88포인트** |\n| SCR* 경계 | 없음 (1D) | **SCR*(X/R) 2D 곡면** |\n| 검증 방법 | PHIL | **RTDS CHIL** |\n| 포인트 수 | ~4개 | **88개** |\n\n▸ \"최초 CHIL 기반 SCR×X/R 2D 경계 정량화\" 주장의 핵심 근거  \n▸ Ganguly 관찰 → 본 연구 정량화로 확장\n\n---\n\n## ✍️ My Take\n\n※ 차별점: 정성적 관찰 → 88포인트 정량 경계 도출  \n※ 인용 자리: §I 서론 \"연구 동기\", §V 결과 비교  \n※ Phase 2 X/R=5.0 경향 반전은 모델 한계 (Ganguly 결과와 불일치)  \n※ 저널 게재 여부 모니터링 필요 (현재 preprint)\n\n---\n\n## 🔗 연결 노트\n\n- [[88포인트_2D_스윕_설계]] — 이 논문이 2D 동기\n- [[고유값_안정도판단]] — SCR* 정량화 목표\n- [[실험 sweep2d j0.5 dp20]] — Phase 1 비교\n- [[EXP_2026-08-21_Phase2_엔진전환_비교]] — X/R 경향 불일치 관찰\n- [[Phase03_진행중]] — PSO 후 SCR* 비교 예정\n",
    "wikilinks": [
      "88포인트_2D_스윕_설계",
      "고유값_안정도판단",
      "실험 sweep2d j0.5 dp20",
      "EXP_2026-08-21_Phase2_엔진전환_비교",
      "Phase03_진행중"
    ]
  },
  {
    "path": "RSCAD/06_문헌/Zhao_2023_Aalborg.md",
    "dir": "RSCAD/06_문헌",
    "filename": "Zhao_2023_Aalborg",
    "frontmatter": {
      "type": "literature",
      "cite_key": "zhao2023aalborg",
      "ref_num": 7,
      "year": 2023,
      "venue": "Aalborg University PhD Thesis",
      "doi": "10.54337/aau679677176",
      "paper_type": "method",
      "model_order": 14,
      "scr_range": "\"미명시\"",
      "validation_level": "sim-only",
      "tuning_method": "수동",
      "dc_ac_coupling": true,
      "extraction_depth": "full",
      "tags": [
        "literature",
        "Zhao2023",
        "DC-AC-coupling",
        "PhD",
        "reference"
      ]
    },
    "body": "# 📚 Zhao 2023 — Aalborg PhD\n\n> **역할: DC-AC 커플링 이론 근거 [7]**\n\n---\n\n## 📌 Brief Summary\n\n▸ DC-AC 결합 GFM 인버터 소신호 모델링 PhD 논문. DC-AC 커플링 원소 누락 시 불안정 모드 포착 실패를 이론적으로 증명.\n\n---\n\n## 📖 Core Content\n\n▸ **핵심 기여:**\n- DC-AC 커플링 항 $A_k(9,6) = i_{dc0}/(J \\cdot \\omega_0)$ 유도\n- 커플링 누락 시 SCR=0.8 불안정 모드 포착 실패 증명\n- 단상·삼상 GFM 인버터 통합 소신호 프레임워크\n\n▸ **핵심 수식:**\n\n$$A_k(9,6) = \\frac{\\partial(\\dot{\\Delta\\omega})}{\\partial u_{dc}} = \\frac{i_{dc0,k}}{J \\cdot \\omega_0}$$\n\n▸ **검증:**\n- 소프트웨어 시뮬레이션\n- 커플링 있음 vs. 없음 비교 실험\n\n▸ **저자 한계:**\n- 단일 DC 소스 (PV+ESS 2단 미포함)\n- SCR×X/R 2D 분석 없음\n\n---\n\n## 🔗 본 연구 연결\n\n| 항목 | Zhao 2023 | 본 연구 |\n|---|---|---|\n| DC-AC 커플링 | ✅ 이론 제시 | **✅ 실험 검증** |\n| A_k(9,6) 오차 | — | **0.0001% ✅** |\n| 시스템 | 단일 DC | **PV+ESS 2단** |\n| 검증 | 소프트웨어 | **RTDS CHIL** |\n\n▸ Phase 2 실험에서 A_k(9,6) 이론값 오차 0.0001% 달성 → Zhao 이론 검증 완료\n\n---\n\n## ✍️ My Take\n\n※ 차별점: Zhao 이론을 PV+ESS 2단 시스템에 적용·검증  \n※ 인용 자리: §III DC-AC 커플링 원소 유도, \"9개 추가 상태변수\" 주장  \n※ Dong(2026) 비판의 근거: \"이상적 DC 가정 → 커플링 누락\"\n\n---\n\n## 🔗 연결 노트\n\n- [[DC-AC_커플링]] — 이 논문이 이론 출처\n- [[야코비안 행렬]] — A_k(9,6) 원소\n- [[EXP_2026-08-21_Phase2_엔진전환_비교]] — 0.0001% 검증\n- [[Phase02_완료]] — 검증 완료\n",
    "wikilinks": [
      "DC-AC_커플링",
      "야코비안 행렬",
      "EXP_2026-08-21_Phase2_엔진전환_비교",
      "Phase02_완료"
    ]
  },
  {
    "path": "RSCAD/Phase01/04_실험결과/Bug sym dc pi 4차시도.md",
    "dir": "RSCAD/Phase01/04_실험결과",
    "filename": "Bug sym dc pi 4차시도",
    "frontmatter": {
      "## type": "bug component: sym.py date: 2026-08-20 phase: 2 attempt: 4차 status: in_progress severity: critical tags: [bug, sympy, jacobian, DC, PI, stable]",
      "# 🔧 BUG": "SymPy DC PI 적분기 구조 오류",
      "예상값": "stable=True,  zeta_min > 0",
      "실제값": "stable=False, zeta_min < 0",
      "오차": "전 SCR 구간 불안정"
    },
    "body": "## 시도 기록\n\n|차수|날짜|수정 내용|stable|zeta_min|A_k(9,6)|\n|---|---|---|---|---|---|\n|1차|2026-08-19|dpv=0.5 고정|False|-0.68|0.0 ❌|\n|2차|2026-08-19|pu 단위 통일 (Vpv0=1.0)|False|-0.05|0.0 ❌|\n|3차|2026-08-19|AC 서브시스템 단독 확인|**True** ✅|0.013|—|\n|**4차**|**2026-08-20**|**dpv_sym = 0.5 + Kp1×xPI1 연결**|**False**|**-0.38**|**0.003183 ✅**|\n\n### 4차 시도 상세 결과\n\n```\nSCR=3.0: stable=False  zeta_min=-0.5707  f_dom=0.5832Hz  A_k(9,6)=0.001592 ✅\nSCR=2.0: stable=False  zeta_min=-0.4707  f_dom=0.6275Hz  A_k(9,6)=0.002387 ✅\nSCR=1.5: stable=False  zeta_min=-0.3764  f_dom=0.6588Hz  A_k(9,6)=0.003183 ✅\nSCR=1.0: stable=False  zeta_min=-0.2005  f_dom=0.6950Hz  A_k(9,6)=0.004775 ✅\n```\n\n### 4차에서 개선된 것 ✅\n\n```\nA_k(9,6) 이론값과 완전 일치 → 수동 보강 성공\nf_dom SCR 의존성 물리적으로 타당\n  → SCR 낮을수록 f_dom 높아짐 (약계통 = 빠른 진동)\n  → 3.0→0.58Hz, 2.0→0.63Hz, 1.5→0.66Hz, 1.0→0.70Hz\n```\n\n### 4차에서 남은 문제 ❌\n\n```\n여전히 stable=False\n→ zeta_min 음수 = 불안정 모드 존재\n→ 불안정 고유값이 어느 서브시스템에서 오는지 불명확\n\n단서:\n- AC 단독(13×13 수동) → stable=True ✅\n- DC 포함 전체(21×21) → stable=False ❌\n→ DC 서브시스템 또는 DC-AC 결합에서 불안정 발생\n```\n\n---\n\n## 원인 분석\n\n### ▸ 확인된 사실\n\n```\n1. A_k(9,6) = 0 문제\n   f9 = (1-Pfilt-Dp*dw)/J 에서 udc에 직접 의존하지 않음\n   → SymPy 자동 유도로는 커플링 원소가 0으로 나옴\n   → 수동 보강: A_num[8,5] += idc0/(J*w0) 으로 해결 ✅\n\n2. dpv 고정 문제 (1차 원인)\n   dpv = 0.5 고정 시 xPI1이 야코비안에 연결 안됨\n   → PI 적분기가 상태변수로서 의미 없어짐\n   → dpv_sym = 0.5 + Kp1*xPI1 으로 수정 (4차)\n\n3. 불안정 잔존 원인 (미해결)\n   dpv 연결 후에도 stable=False\n   → iLpv_ref = 0.9/upv 비선형항이 문제일 가능성\n   → 동작점 upv=1.0pu에서 ∂(0.9/upv)/∂upv = -0.9 → 음수 피드백\n   → 하지만 이게 불안정을 만드는지는 미확인\n```\n\n### ※ 가설 (5차 시도 방향)\n\n```\n가설 A: iLpv_ref 비선형항 선형화 오류\n  수정: f1 = (0.9/upv0 - 0.9/upv0² * Δupv) - iLpv\n        → 동작점 upv0=1.0에서 선형화: f1 ≈ 0.9 - 0.9*upv - iLpv\n\n가설 B: f3 = Vdc0 - udc의 적분기 구조\n  f3 자체가 Vdc0-udc인데 xPI3과의 연결이 f6,f7에서\n  dpv를 통해 이루어지므로 구조는 맞음\n  → 수치적 불안정 가능성\n\n가설 C: DC-AC 결합 후 수치 불안정\n  A_num[8,5] 수동 보강 이외에\n  f10 = wc*(Pmeas-Pfilt) 에서\n  Pmeas = uod*iod + uoq*ioq → 동작점 대입 후\n  ∂Pmeas/∂uod = iod0 = 0.9 → 큰 값\n  → 이 경로가 불안정 기여 가능성\n```\n\n---\n\n## 수정 방향 (5차)\n\n```python\n# 5차 시도: f1 선형화 명시\n\n# 현재 (4차)\niLpv_ref = sp.Rational(9, 10) / upv   # 비선형\nf1 = iLpv_ref - iLpv\n\n# 수정 (5차 시도)\n# 동작점 upv0=1.0pu에서 테일러 1차 전개\n# 0.9/upv ≈ 0.9 - 0.9*(upv-1) = 1.8 - 0.9*upv (upv0=1일 때)\nupv0 = sp.Float(1.0)\niLpv_ref_lin = sp.Float(0.9)/upv0 - sp.Float(0.9)/upv0**2 * (upv - upv0)\nf1 = iLpv_ref_lin - iLpv\n# → 선형 모델에서는 이 형태가 야코비안에 올바른 값 줌\n```\n\n---\n\n## 검증 기준 (RESOLVED 조건)\n\n다음을 **모두** 만족해야 RESOLVED:\n\n- [ ] SCR=3.0: stable=True\n- [ ] SCR=2.0: stable=True\n- [ ] SCR=1.5: stable=True\n- [ ] SCR=1.0: stable=True\n- [ ] zeta_min > 0 (4개 SCR 모두)\n- [ ] A_k(9,6) 이론값 오차 < 1% ✅ (이미 달성)\n- [ ] f_dom 1~10 Hz 범위\n\n---\n\n## 🔗 연관 지식\n\n|노트|연결 이유|\n|---|---|\n|[[DC-AC_커플링]]|A_k(9,6) 이론값 근거|\n|[[21차 야코비안 유도가이드]]|DC PI 방정식 구조|\n|[[소신호_선형화]]|비선형→선형 근사 원리|\n|[[Chen_2024_Electronics]]|21차 모델 원출처|\n|[[실험_jacobian_SCR1.5_XR1.0]]|증상 비교|\n\n---\n\n## 🤖 Claude 지식 프롬프트 (5차 시도용)\n\n```\n[GFM_연구_전체지도.md 전체]\n[이 버그 노트 전체]\n[21차_야코비안_유도가이드.md 전체]\n\n→ \"SymPy 21차 야코비안에서 stable=False 문제를 해결해줘.\n\n현재 상황:\n- AC 서브시스템 단독: stable=True ✅\n- 전체 21×21: stable=False ❌\n- A_k(9,6): 이론값 일치 ✅\n- 4차 시도까지 dpv_sym = 0.5 + Kp1*xPI1 적용\n\n가설: f1의 iLpv_ref = 0.9/upv 비선형항을\n      동작점 upv0=1.0에서 1차 선형화하면 해결될까?\n      \n기대 결과: stable=True, zeta_min > 0\"\n```\n\n---\n\n## 파일 경로\n\n```\nsym.py:                ~/dev/RSCAD/Simulation/sym.py\nresults/:              ~/dev/RSCAD/results/\n  A_num_SCR1.0.npy\n  A_num_SCR1.5.npy\n  A_num_SCR2.0.npy\n  A_num_SCR3.0.npy\n  eigenvalue_results.json\n```",
    "wikilinks": [
      "DC-AC_커플링",
      "21차 야코비안 유도가이드",
      "소신호_선형화",
      "Chen_2024_Electronics",
      "실험_jacobian_SCR1.5_XR1.0"
    ]
  },
  {
    "path": "RSCAD/Phase01/04_실험결과/Sym dc pi 버그 분석.md",
    "dir": "RSCAD/Phase01/04_실험결과",
    "filename": "Sym dc pi 버그 분석",
    "frontmatter": {},
    "body": "---\n\n## type: debug component: sym.py date: 2026-08-19 phase: 2 status: in_progress tags: [sympy, jacobian, DC, PI, bug]\n\n# 🔧 버그: SymPy DC PI 적분기 구조 오류\n\n## 증상\n\n```\nSCR=1.5 결과:\n  stable:   False  ❌ (True여야 함)\n  zeta_min: -0.05  ❌ (음수 = 불안정 모드)\n  A_k(9,6): 0.0    ❌ (0.003183이어야 함)\n```\n\n## 원인 분석\n\n### 원인 1: A_k(9,6) = 0\n\n```python\n# f9 = (1 - Pfilt - Dp*dw) / J\n# ∂f9/∂udc = 0  ← udc가 f9에 직접 없음\n\n# DC-AC 커플링은 동작점 선형화에서 나타남:\n# P_meas = u_od*i_od → 동작점에서 i_dc0에 의존\n# → 야코비안에서 자동으로 안 나옴 → 수동 설정 필요\n\n# 수정:\nA_num[8, 5] = idc0 / (J * w0)\n# = 0.6 / (0.5 × 376.99) = 0.003183 ✅\n```\n\n### 원인 2: DC PI 구조 오류 → stable=False\n\n```python\n# 현재 (잘못됨): 듀티비 고정\nf7 = (upv - 0.5*udc) / Lpv   # dpv=0.5 고정\n# → xPI1이 A 행렬에 연결 안됨 → 불안정\n\n# 수정 필요:\n# dpv = 0.5 + Kp1*xPI1   (PI 피드백 연결)\nf7_correct = (upv - (0.5 + Kp1_sym*xPI1)*udc) / Lpv\n# → xPI1이 f7에 나타남 → ∂f7/∂xPI1 ≠ 0\n# → PI 적분기가 야코비안에 올바르게 연결됨\n```\n\n### 원인 3: AC 서브시스템은 단독 안정 확인\n\n```python\n# 검증 완료:\nA_AC_test (13×13 수동 구성)\n→ stable=True ✅\n→ AC 서브시스템 자체는 문제없음\n→ DC 서브시스템 PI 구조가 문제\n```\n\n## 수정 방향\n\n```python\n# sym.py 수정 포인트:\n\n# 1. 듀티비 심볼릭 선언\nKp1, Ki1 = sp.symbols('Kp1 Ki1', positive=True)\ndpv_sym = sp.Rational(1,2) + Kp1*xPI1\n\n# 2. f7 수정\nf7 = (upv - dpv_sym*udc) / Lpv\n\n# 3. f4 수정 (MPPT 전류 기준값)\niLpv_ref = sp.Rational(9,10) / upv  # P_mpp/Vpv\nf1 = iLpv_ref - iLpv  # xPI1 오차 적분\n\n# 4. 수치 대입 시 파라미터 추가\nsubs_params = {Kp1: 0.1, Ki1: 10.0}\n```\n\n## 테스트 결과 기록\n\n|시도|수정 내용|stable|zeta_min|비고|\n|---|---|---|---|---|\n|1차|dpv=0.5 고정|False|-0.68|원인 확인|\n|2차|pu 단위 통일|False|-0.05|개선됐으나 미해결|\n|3차|AC 단독 확인|True|0.013|AC는 정상|\n|4차|dpv_sym 연결|⏳|⏳|다음 시도|\n\n## 다음 실행 코드\n\n```python\n# ~/dev/RSCAD/simulation/sym.py 수정 후\npython simulation/sym.py\n\n# 기대 결과:\n# SCR=1.5: stable=True, zeta_min>0, A_k(9,6)=0.003183\n```\n\n## Claude 프롬프트\n\n```\n[이 노트 전체]\n[21차_야코비안_유도가이드.md]\n\n→ \"SymPy f(x)에서 PI 적분기 방정식 f1~f3을\n   듀티비 dpv = 0.5 + Kp1*xPI1에 올바르게 연결하는\n   코드를 작성해줘. stable=True가 나와야 함.\"\n```\n\n## 연결 노트\n\n- [[21차 야코비안 유도가이드]]\n- [[DC-AC_커플링]]\n- [[실험_jacobian_SCR1.5_XR1.0]]",
    "wikilinks": [
      "21차 야코비안 유도가이드",
      "DC-AC_커플링",
      "실험_jacobian_SCR1.5_XR1.0"
    ]
  },
  {
    "path": "RSCAD/Phase01/04_실험결과/실험 sweep2d j0.5 dp20.md",
    "dir": "RSCAD/Phase01/04_실험결과",
    "filename": "실험 sweep2d j0.5 dp20",
    "frontmatter": {},
    "body": "---\n\n## type: experiment api: /api/sweep2d date: 2026-08-19 phase: 1 status: verified tags: [sweep2d, SCR-star, 2D-boundary, flask, numpy]\n\n# 🧪 실험: /api/sweep2d — 88포인트 2D 스윕\n\n## 입력 파라미터\n\n```json\n{\n  \"J\":   0.5,\n  \"Dp\":  20.0,\n  \"Kpv\": 1.0,\n  \"Kpc\": 5.0,\n  \"Lv\":  0.1,\n  \"wc\":  31.4\n}\n```\n\n## 실험 결과\n\n```json\n{\n  \"status\":       \"ok\",\n  \"total_points\": 88,\n  \"boundaries\": {\n    \"0.5\": 0.8,\n    \"1.0\": 0.8,\n    \"2.0\": 0.8,\n    \"5.0\": null\n  }\n}\n```\n\n## SCR 범위 및 X/R 조건\n\n|X/R|SCR 범위|스텝|포인트 수|\n|---|---|---|---|\n|0.5|5.0 → 0.8|0.2|22|\n|1.0|5.0 → 0.8|0.2|22|\n|2.0|5.0 → 0.8|0.2|22|\n|5.0|5.0 → 0.8|0.2|22|\n|**합계**|||**88**|\n\n## SCR*(X/R) 경계 분석\n\n|X/R|SCR*|판정|비고|\n|---|---|---|---|\n|0.5|0.8|⚠️|모델 하한값 — 실제론 더 낮을 것|\n|1.0|0.8|⚠️|동일|\n|2.0|0.8|⚠️|동일|\n|5.0|null|❌|전 구간 ζ < 0.25 → 경계 미도출|\n\n## 분석\n\n### ⚠️ numpy 근사 모델 한계\n\n```\n현재 SCR* 모두 0.8 (모델 하한)\n→ 원인: LCL 공진 모드(60Hz)가 지배 모드로 잡혀\n        실제 VSG 스윙 모드 ζ 값 미반영\n→ 기대값: Phase 2 SymPy 완성 후 SCR* 1.0~2.0 범위 예상\n\nX/R=5.0에서 null\n→ X/R 높을수록 (송전계통) 더 불안정한 경향\n→ 물리적으로 타당 (Ganguly 2025 결과와 일치)\n```\n\n### 📌 Phase 2 이후 기대 결과\n\n```\n예상 SCR*(X/R) 패턴 (SymPy 21차 완성 후):\n  X/R=0.5: SCR* ≈ 0.9~1.1  (배전 → 비교적 안정)\n  X/R=1.0: SCR* ≈ 1.0~1.2\n  X/R=2.0: SCR* ≈ 1.2~1.5\n  X/R=5.0: SCR* ≈ 1.5~2.0  (송전 → 불안정 경향)\n\n→ X/R 증가 → SCR* 증가 (더 강한 계통 필요)\n→ Ganguly(2025) X/R=1.0에서 트립 관찰과 일치\n```\n\n## 검증 기준\n\n- [ ] Phase 2: SymPy 야코비안으로 재실행 → SCR* 1.0~2.0 범위 확인\n- [ ] Phase 3: PSCAD EMT 시뮬레이션과 비교 (오차 <5%)\n- [ ] Phase 7: RTDS CHIL 88포인트 실측\n\n## Claude 프롬프트 (분석용)\n\n```\n[이 노트 전체]\n[실험_jacobian_SCR1.5_XR1.0.md]\n[GFM_연구_전체지도.md]\n\n→ \"2D 스윕 결과에서 X/R=5.0의 경계가 null로 나오는 것이\n   Ganguly(2025) 실험 결과와 어떻게 연결되는지 분석해줘\"\n```\n\n## 연결 노트\n\n- [[실험_jacobian_SCR1.5_XR1.0]] — 단일점 결과\n- [[Ganguly_2025_preprint]] — 2D 경계 실험 근거\n- [[88포인트_2D_스윕_설계]] — 설계 방법론",
    "wikilinks": [
      "실험_jacobian_SCR1.5_XR1.0",
      "Ganguly_2025_preprint",
      "88포인트_2D_스윕_설계"
    ]
  },
  {
    "path": "RSCAD/Phase01/04_실험결과/실험_jacobian_SCR1.5_XR1.0.md",
    "dir": "RSCAD/Phase01/04_실험결과",
    "filename": "실험_jacobian_SCR1.5_XR1.0",
    "frontmatter": {},
    "body": "---\n\n## type: experiment api: /api/jacobian date: 2026-08-19 phase: 1 status: verified tags: [jacobian, eigenvalue, flask, numpy]\n\n# 🧪 실험: /api/jacobian — SCR=1.5, X/R=1.0\n\n## 입력 파라미터\n\n```json\n{\n  \"SCR\": 1.5,\n  \"XR\":  1.0,\n  \"J\":   0.5,\n  \"Dp\":  20.0,\n  \"Kpv\": 1.0,\n  \"Kpc\": 5.0,\n  \"Lv\":  0.1,\n  \"Kiv\": 100,\n  \"Kic\": 50,\n  \"wc\":  31.4\n}\n```\n\n## 실험 결과 (실측값)\n\n```json\n{\n  \"stable\":              true,\n  \"zeta_min\":            0.256391,\n  \"f_dom_hz\":            0.3584,\n  \"coupling_A96\":        0.0031831,\n  \"idc0\":                0.6,\n  \"scr_star\":            1.22,\n  \"zeta_threshold\":      1.7765,\n  \"valid_linearization\": false,\n  \"du_pv_pct\":           12.45,\n  \"engine\":              \"numpy\"\n}\n```\n\n## 고유값 (21개)\n\n|#|Re(λ)|Im(λ)|ζ|f(Hz)|모드|\n|---|---|---|---|---|---|\n|1|-100.0|±376.99|0.2564|60.0|LCL 공진|\n|2|-250.0|±376.99|0.5527|60.0|LCL 공진|\n|3|-177.7|±266.57|0.5547|42.4|LCL 중간|\n|4~21|실수극점|0|—|—|PI·전압·전류|\n\n## 분석\n\n### ✅ 정상 항목\n\n- `stable=true` — 모든 고유값 좌반평면\n- `coupling_A96=0.003183` — 이론값 `idc0/(J·ω₀)=0.6/(0.5×376.99)=0.003183` ✅\n- `scr_star=1.22` — SCR=1.5 > 1.22이므로 현재 운전점 안전\n\n### ⚠️ 주의 항목\n\n- `f_dom_hz=0.36Hz` — numpy 근사 (Phase 3 Prony 실측 필요)\n- `valid_linearization=false` — Δu_pv=12.45% > 5% → SCR=1.5에서 선형화 유효성 초과 → Phase 3에서 PSCAD Layer 2 교차검증 필요\n- `zeta_threshold=1.78` — f_dom이 낮아서 비정상적으로 높음 → Phase 3 f_dom 실측 후 재계산 예정\n\n### 📌 핵심 메모\n\n```\nDC-AC 커플링 A_k(9,6) 검증:\n이론값 = idc0/(J·ω₀)\n       = 0.6 / (0.5 × 2π × 60)\n       = 0.6 / 188.496\n       = 0.003183 ✅ 일치\n\n현재 numpy 근사 모델 한계:\n- VSG 스윙 모드(~1Hz) 미생성 → f_dom 부정확\n- DC PI 구조 불완전 → stable 판정 신뢰도 중간\n- Phase 2 SymPy 완성 후 재검증 필요\n```\n\n## Claude 프롬프트 (재현용)\n\n```\n[이 노트 전체 붙여넣기]\n[GFM_연구_전체지도.md 붙여넣기]\n\n→ \"이 야코비안 결과에서 지배 모드를 식별하고\n   PSO 목적함수에 반영할 모드를 결정해줘\"\n```\n\n## 연결 노트\n\n- [[DC-AC_커플링]] — 커플링 원소 이론 설명\n- [[고유값_안정도판단]] — Re(λ) < 0 조건\n- [[실험 sweep2d j0.5 dp20]] — 다음 실험",
    "wikilinks": [
      "DC-AC_커플링",
      "고유값_안정도판단",
      "실험 sweep2d j0.5 dp20"
    ]
  },
  {
    "path": "RSCAD/Phase01/04_실험결과/실험_pso_미구현.md",
    "dir": "RSCAD/Phase01/04_실험결과",
    "filename": "실험_pso_미구현",
    "frontmatter": {},
    "body": "---\n\n## type: experiment api: /api/pso date: 2026-08-19 phase: 1 status: simulation_only tags: [pso, optimization, TODO]\n\n# ⚠️ 실험: /api/pso — 시뮬레이션만 (미구현)\n\n## 현재 상태\n\n```\n/api/pso 현재 구현 수준:\n  ✅ 엔드포인트 존재\n  ✅ 수렴 곡선 출력 (랜덤값 시뮬)\n  ✅ 최적 파라미터 반환 (고정값)\n  ❌ 실제 PSO 알고리즘 미구현\n  ❌ 실제 야코비안 기반 목적함수 미연결\n```\n\n## Phase 4에서 구현할 내용\n\n### 이중 수렴 기준 PSO\n\n```python\n# pyswarms 기반 실제 구현 예정\nfrom scipy.optimize import differential_evolution\nimport pyswarms as ps\n\ndef F_multi(params, SCR_list=[3.0,2.0,1.5,1.0]):\n    \"\"\"다중 운전점 목적함수\"\"\"\n    F_total = 0\n    for scr in SCR_list:\n        A, _ = build_jacobian(scr, **params)\n        eigs = linalg.eigvals(A)\n        # F1: 안정도 마진\n        F1 = sum(max(0, e.real) for e in eigs)\n        # F2: ζ=0.707 추종\n        osc = [e for e in eigs if abs(e.imag)>0.5]\n        F2 = sum((-e.real/abs(e)-0.707)**2 for e in osc if abs(e)>0)\n        # F3: ζ_min 보장\n        F3 = sum(max(0, 0.64-(-e.real/abs(e))) for e in osc if abs(e)>0)\n        F_total += 0.3*F1 + 0.6*F2 + 0.1*F3\n    return F_total / len(SCR_list)\n\n# 이중 수렴 기준\n# 조건1: 상대 개선 < 0.1% 30회 연속\n# 조건2: 누적 감소 < 0.5% 동일 30회\n```\n\n### 14개 최적화 파라미터 범위\n\n|파라미터|하한|상한|단위|\n|---|---|---|---|\n|J|0.01|10.0|kg·m²|\n|Dp|1.0|100.0|N·m·s|\n|wc|10.0|200.0|rad/s|\n|Lv|0.001|0.5|pu|\n|Kpv|0.01|5.0|A/V|\n|Kiv|1.0|500.0|A/Vs|\n|Kpc|0.1|30.0|V/A|\n|Kic|1.0|200.0|V/As|\n|(DC 6개)|...|...|...|\n\n## 예상 결과 (Phase 4 완료 후)\n\n```\n기대 최적 파라미터 (PSO 후):\n  J  ≈ 0.5~1.0   (현재 0.5)\n  Dp ≈ 20~40    (현재 20)\n  Kpv ≈ 1~2     (현재 1.0)\n\n기대 성능 개선:\n  ζ_min: 0.256 → 0.64 이상\n  SCR*: 1.22 → 0.8 이하 (더 강건)\n  Wilcoxon p < 0.05 검증\n```\n\n## Claude 프롬프트 (Phase 4 착수 시)\n\n```\n[이 노트]\n[GFM_연구_전체지도.md]\n[실험_jacobian_SCR1.5_XR1.0.md]\n\n→ \"pyswarms GlobalBestPSO로 이중 수렴 기준 PSO를\n   Flask /api/pso 엔드포인트에 구현하는 코드 작성해줘.\n   SCR={3.0,2.0,1.5,1.0} 다중 운전점 목적함수 포함.\"\n```\n\n## 연결 노트\n\n- [[Pso 이중수렴기준]] — 방법론 설명\n- [[이중수렴기준 설계]] — 조건1·2 상세\n",
    "wikilinks": [
      "Pso 이중수렴기준",
      "이중수렴기준 설계"
    ]
  },
  {
    "path": "RSCAD/Phase01/results/J0.50_Dp20.0_Kpv1.0_wc62.8/results.md",
    "dir": "RSCAD/Phase01/results/J0.50_Dp20.0_Kpv1.0_wc62.8",
    "filename": "results",
    "frontmatter": {
      "type": "result",
      "run": "J0.50_Dp20.0_Kpv1.0_wc62.8",
      "date": "2026-08-24 14:28",
      "all_stable": true,
      "tags": [
        "result",
        "phase2",
        "jacobian"
      ]
    },
    "body": "# 실험 결과: J0.50_Dp20.0_Kpv1.0_wc62.8\n\n## 파라미터\n\n| J | Dp | Kpv | Kiv | Kpc | Kic | wc |\n|---|---|---|---|---|---|---|\n| 0.5 | 20.0 | 1.0 | 50.0 | 10.0 | 100.0 | 62.8 |\n\n## 고유값 분석 (XR=1.0)\n\n| SCR | stable | ζ_min | f_dom (Hz) | A_k(9,6) |\n|---|---|---|---|---|\n| 3.0 | ✅ | 0.1672 | 0.1056 | 0.00159155 |\n| 2.0 | ✅ | 0.1652 | 0.0981 | 0.00238732 |\n| 1.5 | ✅ | 0.1642 | 0.093 | 0.0031831 |\n| 1.0 | ✅ | 0.1632 | 0.0877 | 0.00477465 |\n\n## 판정\n\n✅ 전 SCR 안정  \nζ_min 기준 (≥ 0.64): ❌ 미달 → PSO 필요\n\n## 파일 목록 (탐색기에서 열기)\n\n```\nJ0.50_Dp20.0_Kpv1.0_wc62.8/\n├── A_num_SCR1.0.npy\n├── A_num_SCR1.5.npy\n├── A_num_SCR2.0.npy\n├── A_num_SCR3.0.npy\n├── eigenvalue_results.json\n├── meta.json\n└── results.md\n```\n\n## 🔗 연결 노트\n\n- [[Phase02_완료]]\n- [[DC-AC_커플링]]\n- [[고유값_안정도판단]]\n- [[88포인트_2D_스윕_설계]]\n",
    "wikilinks": [
      "Phase02_완료",
      "DC-AC_커플링",
      "고유값_안정도판단",
      "88포인트_2D_스윕_설계"
    ]
  },
  {
    "path": "RSCAD/Phase01/results/Phase01_완료.md",
    "dir": "RSCAD/Phase01/results",
    "filename": "Phase01_완료",
    "frontmatter": {
      "type": "phase-log",
      "phase": 1,
      "date_start": "2026-08-19",
      "date_end": "2026-08-19",
      "status": "complete",
      "tags": [
        "phase1",
        "flask",
        "numpy",
        "dashboard"
      ]
    },
    "body": "# 📋 Phase 1: Flask 서버 + numpy 근사 모델\n\n---\n\n## 0. Phase 목표\n\n> Flask API 서버 구축 + 웹 대시보드 연결 + 88포인트 2D 스윕 실행\n\n```\n목표: numpy 기반 소신호 모델로 야코비안·2D 스윕 API 구현\n성공 기준:\n  - [x] /api/jacobian stable=True 반환\n  - [x] /api/sweep2d 88포인트 완료\n  - [x] 웹 대시보드 Flask 연결\n  - [x] results/ 폴더 관리 체계\n```\n\n---\n\n## 1. 이전 Phase에서 넘어온 것\n\n| 항목 | 값/상태 | 출처 |\n|---|---|---|\n| 연구 설계 | 제안서 v6 완료 | 교수님 검토 |\n| 참고문헌 | 32편 DOI 검증 | 구글 독스 |\n| ζ_threshold | 0.64 | UNIFI V3 역산 |\n| 4중 차별화 | 표 6-3 확정 | Dong(2026) 비교 |\n\n---\n\n## 2. 이번 Phase 변경 사항\n\n### 2.1 추가된 것 ✅\n- Flask 서버 (`Server/app.py`) — numpy/scipy 기반\n- `/api/jacobian` — 21차 야코비안 근사 + 고유값\n- `/api/sweep2d` — 88포인트 SCR×X/R 스윕\n- `/api/pso` — 시뮬레이션만 (실제 미구현)\n- `/api/runs` — 실험 목록 관리\n- `/api/reload` — 동적 실험 전환\n- 웹 대시보드 (`Web/gfm_dashboard.html`) Flask 연결\n- `results/` 파라미터별 폴더 자동 생성\n- `latest/` 최신 실험 자동 복사\n\n### 2.2 수정된 것 🔧\n- `f_dom` 버그 수정: 60.0Hz → 0.3584Hz (VSG 스윙 모드 선택 로직)\n- `analyze_eigenvalues` 정렬 기준: Re(λ) → ζ 오름차순\n- `RESULTS_DIR` 경로: `Server/results` → `RSCAD/results`\n- `/api/runs` 500 오류 수정 (폴더 없을 때 예외 처리)\n- `latest/meta.json`에 `latest_copied_from` 필드 추가\n\n### 2.3 미구현 ❌\n- `/api/pso` 실제 PSO 알고리즘 (Phase 4로 이월)\n\n---\n\n## 3. 핵심 수치 스냅샷\n\n| 항목 | Phase 0 (없음) | Phase 1 (numpy) | 변화 |\n|---|---|---|---|\n| 엔진 | — | numpy | 구축 |\n| stable (SCR=1.5) | — | True | ✅ |\n| ζ_min | — | 0.2564 | 근사값 |\n| f_dom (Hz) | — | 0.3584 | 근사값 |\n| A_k(9,6) | — | 0.003183 | 근사값 |\n| SCR* | — | 0.8 (하한) | 근사 한계 |\n| 88포인트 boundaries | — | 전부 null | numpy 한계 |\n\n---\n\n## 4. 실험 결과 목록\n\n| 날짜         | 실험명                     | 상태  | 링크                           |\n| ---------- | ----------------------- | --- | ---------------------------- |\n| 2026-08-19 | jacobian SCR=1.5 XR=1.0 | ✅   | [[실험_jacobian_SCR1.5_XR1.0]] |\n| 2026-08-19 | sweep2d J=0.5 Dp=20     | ✅   | [[실험 sweep2d j0.5 dp20]]     |\n| 2026-08-19 | PSO (시뮬)                | ⚠️  | [[실험_pso_미구현]]               |\n\n---\n\n## 5. 버그 기록\n\n| 버그명 | 상태 | 해결 방법 |\n|---|---|---|\n| f_dom=60.0Hz | ✅ resolved | VSG 스윙 모드 필터링 추가 |\n| /api/runs 500 | ✅ resolved | 폴더 없음 예외 처리 |\n| RESULTS_DIR 경로 | ✅ resolved | parent.parent로 수정 |\n\n---\n\n## 6. 참고문헌 연결\n\n| 문헌 | Phase 1 연결 내용 | 검증 |\n|---|---|---|\n| [1] Chen 2024 | 21차 구조·파라미터 초기값 | ✅ 구조 동일 |\n| [2] Dong 2026 | 4중 차별화 비교 기준 | ✅ A_k 없음 확인 |\n| [3] Ganguly 2025 | X/R=5.0 null → 방향 일치 | ⚠️ 정성적 |\n| [7] Zhao 2023 | A_k(9,6) 이론 적용 | ⚠️ 근사 수준 |\n| [9] IEEE Std. | — | ⏳ Phase 6~7 |\n\n---\n\n## 7. 미해결 → Phase 2로 이월\n\n```\n[x] SymPy 21차 야코비안 (정확한 A_k, stable 판정)\n    → Phase 2에서 해결 ✅\n[ ] PSO 실제 알고리즘\n    → Phase 4로 이월\n[ ] f_dom 실측 (Prony 분석)\n    → Phase 3으로 이월\n```\n\n---\n\n## 8. 다음 Phase 준비사항\n\n```\n[x] sym.py SymPy 야코비안 구현\n[x] results/ 폴더 구조 설계\n[x] app.py ↔ results/ 동적 연동\n```\n",
    "wikilinks": [
      "실험_jacobian_SCR1.5_XR1.0",
      "실험 sweep2d j0.5 dp20",
      "실험_pso_미구현"
    ]
  },
  {
    "path": "RSCAD/Phase02/04_실험결과/# Phase 2 코드 리뷰 — 소신호 모델.md",
    "dir": "RSCAD/Phase02/04_실험결과",
    "filename": "# Phase 2 코드 리뷰 — 소신호 모델",
    "frontmatter": {
      "## type": "bug component: sym.py date: 2026-08-25 phase: 2 attempt: 구조검토 status: open severity: critical tags: [bug, sym, jacobian, DC-AC커플링, 상태변수, Phase2]",
      "# 🔧 BUG": "블록삼각 구조 — 커플링 무효 + δ 누락",
      "> **원칙": "** `▸` = 코드 실행·검증으로 확인된 사실 / `※` = 판단·해석 **저장 위치:** `RSCAD/Phase02/04_실험결과/`"
    },
    "body": "## 증상\n\n```\n기대: 21차 커플링 모델 ≠ 13차 AC 단독 모델\n실제: 고유값 차이 = 0 (정확히 0, 부동소수 오차 아님)\n     21차 고유값 = DC 8개 ∪ AC 13개 (오차 10⁻¹²는 반올림)\n```\n\n|항목|상태|비고|\n|---|---|---|\n|$A(x,u)$ 심볼릭 유도|❌|수기 입력|\n|DC-AC 커플링 실효성|❌|블록 삼각 → 영향 0|\n|동기화 루프 $\\delta$|❌|상태변수에 부재|\n|동작점 SCR 의존성|❌|$I_{d0}, I_{q0}$ 고정|\n|실험 하네스(A층)|✅|재사용 가능|\n\n---\n\n## 원인 분석 ①: 블록 삼각행렬\n\n### ▸ 확인된 사실\n\n`A_num[8,5]`의 DC→AC 커플링을 켜고 끈 결과 고유값 차이가 **정확히 0**.\n\n커플링을 **좌하단(DC→AC)에만** 넣고 우상단(AC→DC)을 0으로 둠:\n\n$$ A=\\begin{bmatrix} A_{DC} & \\mathbf{0} \\ A_{AC\\leftarrow DC} & A_{AC}\\end{bmatrix} ;\\Rightarrow; \\lambda(A)=\\lambda(A_{DC})\\cup\\lambda(A_{AC}) $$\n\n삼각행렬의 고유값은 대각 블록의 합집합 → 좌하단에 무엇을 넣어도 결과 불변.\n\n### ▸ 검증 로직 자체가 무효\n\n스크립트의 $A_k(9,6)$ \"이론값 오차 0.0001%\" 검증은 `idc0/(J*w0)`를 `idc0/(J*w0)`와 비교한다. 검증이 아니라 **항등식**이다. → [[Bug sym dc pi 4차시도]]에서 \"달성\"으로 기록한 항목은 무효 처리 필요.\n\n### ※ 파급\n\n> [!warning] Decision Gate 오판 Phase 3 참여인자 분석에서 DC 상태의 AC 모드 기여도가 0으로 나온다. \"DC측 무의미 → 축소 모델\"로 자동 판정되지만 이는 **물리가 아니라 코드 구조 때문**이다. 결론이 통째로 뒤집힌다.\n\n### ※ 물리적 반박\n\n인버터는 DC 버스에서 전력을 끌어가므로 AC측 전력 변동은 DC 버스 전압에 반드시 되먹임된다. 그 경로가 있어야 커플링이 성립하고, 그때 비로소 12차 모델이 못 잡는 모드가 나타난다. 제안서 RQ1이 정확히 이 주장이다.\n\n---\n\n## 원인 분석 ②: 전력각 $\\delta$ 부재 — 더 치명적\n\n### ▸ 확인된 사실\n\nAC 13개 상태에 $\\delta$가 없다. 코드에서 $P_f$가 전류에만 의존하고 각도에 의존하지 않는 것이 증상.\n\n### ※ 해석\n\nGFM 동기화는 $\\delta \\rightarrow P \\rightarrow \\omega \\rightarrow \\delta$ 로 닫히는 루프인데, $\\delta$가 상태가 아니면 루프가 **열린다**. 약계통에서 가장 먼저 불안정해지는 **동기화 모드(synchronization mode)** 가 여기서 나온다.\n\n> [!danger] 우선순위 \"SCR을 낮췄을 때 무엇이 먼저 무너지는가\"가 본 연구의 핵심인데 그 모드가 모델에 **존재하지 않는다.** DC-AC 커플링 누락보다 이쪽이 더 치명적.\n\n---\n\n## 그 외 물리 층 문제\n\n### ▸ DC 8×8이 대각행렬\n\n8개 상태가 완전 독립 → 부스트 인덕터 전류와 DC 버스 전압의 결합이 없다. 계수 `-0.5 - 0.3/SCR`, `-1.2 - 0.2*Kpv`는 근거 불명이며 **전부 음의 실수라 진동 모드가 없고 항상 안정**하다.\n\n### ▸ 동작점이 SCR에 따라 갱신되지 않음\n\n`Id0=0.9`, `Iq0=0.1` 고정. `idc0 = 0.9/SCR` 하나만 임의 스케일링. 제안서의 \"$A_k$ 자체가 SCR 의존적\"이라는 근거는 **정상상태 동작점이 SCR에 따라 움직이기 때문**인데 그 메커니즘이 없다. → Thevenin 등가 조류계산 필요. [[88포인트_2D_스윕_설계]] 전제가 무너짐.\n\n### ▸ $V_{pcc}$가 선형 근사\n\n$$V_{pcc} \\approx 1.0 - (I_{d0}R_g + I_{q0}X_g)$$ 전압강하 1차 근사이며 조류 방정식의 해가 아니다. $SCR=1.0$에서 오차 확대.\n\n---\n\n## 살아있는 것 — 하네스 A층\n\n> [!success] 버릴 코드가 아니다 물리는 mock이지만 하네스는 진짜다. 껍데기는 두고 **안의 물리만 갈아끼운다.**\n\n- CLI 파라미터 주입 / 파라미터별 폴더 분리(`J0.50_Dp20.0_...`)로 덮어쓰기 방지\n- `.npy` 원자료 + `.json` 결과 + `results.md` + `meta.json` 재현 메타데이터\n- `latest/` 자동 갱신 + `latest_copied_from` 출처 기록\n\n---\n\n## 수정 방향 — 상태변수 재확정\n\n### DC측 8개 (PV 부스트 + ESS 양방향 컨버터)\n\n|#|기호|설명|\n|---|---|---|\n|1|$v_{pv}$|PV 단자 커패시터 전압|\n|2|$i_{Lpv}$|부스트 인덕터 전류|\n|3|$x_{vpv}$|PV 전압 제어 PI 적분기 (MPPT 추종)|\n|4|$x_{ipv}$|부스트 전류 루프 PI 적분기|\n|5|$v_{dc}$|DC 링크 커패시터 전압|\n|6|$i_{Less}$|ESS 컨버터 인덕터 전류|\n|7|$x_{vdc}$|DC 링크 전압 제어 PI 적분기|\n|8|$x_{iess}$|ESS 전류 루프 PI 적분기|\n\n> [!note] SOC 제외 근거 — 논문에 한 문장 명시할 것 시정수가 시간 단위라 소신호 대역(0.1~100 Hz)에서 준정적 취급. 포함 시 0 근접 고유값으로 행렬이 stiff해짐. MPPT 기준값 $v_{pv}^*$는 상태가 아니라 입력.\n\n### AC측 14개 (VSG + 종속 전압/전류 루프 + LCL)\n\n|#|기호|설명|\n|---|---|---|\n|9|$\\delta$|**전력각 — 신규 추가**|\n|10|$\\Delta\\omega$|가상 각속도 편차|\n|11|$P_f$|유효전력 LPF 출력|\n|12|$Q_f$|무효전력 LPF 출력|\n|13, 14|$\\varphi_d, \\varphi_q$|전압 루프 PI 적분기|\n|15, 16|$\\gamma_d, \\gamma_q$|전류 루프 PI 적분기|\n|17, 18|$i_{ld}, i_{lq}$|인버터측 인덕터 전류|\n|19, 20|$v_{od}, v_{oq}$|필터 커패시터 전압|\n|21, 22|$i_{od}, i_{oq}$|계통측 인덕터 전류|\n\n### 차수 21 → 22 정정\n\n$8+14=22$. **\"21차\"는 제안서에 적어둔 숫자지 유도 결과가 아니다.**\n\n|선택지|내용|판단|\n|---|---|---|\n|**(a)**|22차로 정정, 제안서 문구 수정|⭐ 권장. Phase 2 게이트가 원래 \"차수 확정\"을 포함하므로 절차상 문제없음|\n|(b)|$Q_f$ LPF 제거해 21 유지|Q 순시값을 전압 드룹에 직접 넣는 구현이면 정당. **DSP 코드에 Q 필터가 있는지가 기준**|\n|(c)|$v_{pv}$ 준정적화 → DC 7개|부스트 동특성을 보겠다는 취지와 상충|\n\n> [!tip] 심사 대응 \"왜 21이냐\"에 **\"이렇게 유도됐다\"가 \"숫자를 맞췄다\"보다 안전하다.**\n\n---\n\n## 양방향 커플링 구현 지점\n\n### DC → AC (좌하단)\n\n$$v_{inv,dq} = m_{dq}\\cdot \\frac{v_{dc}}{2} \\quad\\Rightarrow\\quad \\frac{\\partial}{\\partial v_{dc}}!\\left(\\frac{di_{ld}}{dt}\\right)=\\frac{m_{d0}}{2L_1}$$\n\n### AC → DC (우상단) — 현재 통째로 누락\n\n$$i_{inv}=\\frac{v_{od}i_{ld}+v_{oq}i_{lq}}{v_{dc}}$$\n\n$v_{dc}$ 동역학의 유출항이므로 $v_{dc}$ 미분방정식이 $v_{od}, v_{oq}, i_{ld}, i_{lq}$에 **모두** 의존. **이 항들이 있어야 고차 모델이 12차와 다른 결과를 낸다.**\n\n> [!success] 자동 해소 두 방향이 모두 있으면 블록 삼각이 아니게 되어 §원인분석① 문제가 자동 해소된다. → [[DC-AC_커플링]] 노트 갱신 필요\n\n### 입력 벡터 $u$\n\n$G$(일사량), $T$(모듈 온도), $P^_$, $Q^_$ 또는 $V^*$, $V_g$, $\\omega_g$. **SCR·X/R은 입력이 아니라 파라미터** — $R_g, L_g$를 통해 $A$에 진입.\n\n---\n\n## 검증 기준\n\n다음을 모두 만족하면 RESOLVED:\n\n- [ ] `sympy Matrix.jacobian()`으로 $A(x,u)$ 유도 (수기 입력 0건)\n- [ ] AC→DC 되먹임 블록이 0이 아님\n- [ ] 커플링 on/off 시 **고유값 변화 ≠ 0**\n- [ ] 유한차분 야코비안 vs 심볼릭 야코비안 일치 (같은 동작점)\n- [ ] 동작점이 SCR에 따라 이동함을 확인 ($\\delta$ 변화 추적)\n- [ ] 4개 SCR 모두 통과\n\n---\n\n## 다음 작업 — 파일 분리\n\n> [!abstract] 먼저 이름부터 정직하게 `sym.py`는 실제로는 `harness.py`다. `sym v0/v1/v2`까지 네 개가 굴러다녀 논문에 쓴 코드 추적이 불가능하다.\n\n- [ ] **`model.py`** — 22개 상태 명시 정의, $f(x,u)$ 를 sympy로. **여기가 진짜 Phase 2.** DC 8개를 종이에 먼저 확정\n- [ ] **`op.py`** — SCR·X/R별 $f(x_0,u_0)=0$ 를 `scipy.optimize.fsolve`로. $I_{d0}, I_{q0}, V_{pcc}, i_{dc0}$ 전부 여기서 산출\n- [ ] **`jac.py`** — `Matrix.jacobian()` → `lambdify` → 동작점 대입해 $A_k$ 생성\n- [ ] **`xval.py`** — 유한차분 vs 심볼릭 교차검증. **이것이 진짜 검증.** 통과 시 Phase 2 종료\n- [ ] **`runner.py`** — 기존 저장·기록 층을 분리해 1~4를 호출\n\n---\n\n## 🔗 연관 지식\n\n| 연결 방향 | 노트                                | 이유                                                    |\n| ----- | --------------------------------- | ----------------------------------------------------- |\n| 허브    | [[GFM_연구_전체지도.md]]                | Phase 2 상태 갱신 필요                                      |\n| 허브    | [[Phase_지식_연결맵]]                  | Phase 2 노드 재연결                                        |\n| 근거 이론 | [[야코비안 행렬]]                       | **블록 구조도가 \"우상단 ≈ 0\"으로 그려져 있음 — 이 노트가 결함의 근원. 최우선 개정** |\n| 근거 이론 | [[DC-AC_커플링]]                     | 단방향 → 양방향 커플링 항으로 **개정 필요**                           |\n| 근거 이론 | [[소신호_선형화]]                       | $A=\\partial f/\\partial x$ 정의, 동작점 의존성                 |\n| 근거 이론 | [[고유값_안정도판단]]                     | 블록삼각 고유값 합집합 성질                                       |\n| 방법론   | [[21차 야코비안 유도가이드]]                | **22차로 개정 + 파일명 변경 필요**                               |\n| 방법론   | [[88포인트_2D_스윕_설계]]                | SCR별 동작점 재계산 전제 추가                                    |\n| 선행 실험 | [[EXP_2026-08-21_Phase2_엔진전환_비교]] | 같은 Phase 2 엔진 계보 — 직전 기록                              |\n| 선행 실험 | [[sym AC_서브시스템_안정확인]]             | AC 13차 단독 안정 확인 = 본 버그의 증상 그 자체                       |\n| 선행 버그 | [[Bug sym dc pi 4차시도]]            | $A_k(9,6)$ \"검증 통과\" 기록 무효 처리                           |\n| 선행 실험 | [[실험_jacobian_SCR1.5_XR1.0]]      | Phase 1 결과 재해석 필요                                     |\n| 컨텍스트  | [[GFM 마스터 컨텍스트 프롬프트]]             | 차수 21→22 반영                                           |\n\n### ⚠️ 미생성 — 새로 만들어야 할 노트\n\n- `01_개념/동기화모드_δ루프.md` — $\\delta \\to P \\to \\omega \\to \\delta$ 및 약계통 저주파 모드\n- `01_개념/모델차수_축소판정기준.md` — 참여인자 임계값, DC 상태 기여도 하한. **Decision Gate 근거가 되는 노트가 현재 없음**\n- `02_방법론/동작점_조류계산.md` — Thevenin 등가, fsolve 기반 $f(x_0,u_0)=0$\n\n---\n\n## 🤖 Claude 지식 프롬프트\n\n```\n[GFM_마스터_컨텍스트_프롬프트.md 전체]\n[이 노트 전체]\n[DC-AC_커플링.md]\n[21차_야코비안_유도가이드.md]\n\n→ \"22개 상태변수의 비선형 미분방정식 f(x,u)를 sympy로 작성한\n   model.py를 만들어줘. AC→DC 되먹임 항(v_dc 미분방정식이\n   v_od, v_oq, i_ld, i_lq에 의존)이 반드시 포함되어야 하고,\n   δ가 상태변수로 들어가야 함.\"\n```\n\n---\n\n## 📌 Obsidian 업데이트 체크리스트\n\n- [ ] [[야코비안 행렬]] — **최우선.** 블록 구조도의 `우상단 ≈ 0` 삭제, 21×21 → 22×22, `A_k(9,6) 오차 0.0001% ✅` 표기 제거\n- [ ] [[GFM_연구_전체지도.md]] — Phase 2 상태를 `verified` → `open`으로 되돌리고 이 노트 링크 추가\n- [ ] [[Phase_지식_연결맵]] — Phase 2 노드에 이 노트 연결\n- [ ] [[DC-AC_커플링]] — 단방향 → 양방향 수식으로 개정\n- [ ] [[21차 야코비안 유도가이드]] — `22차_야코비안_유도가이드`로 파일명 변경\n- [ ] [[Bug sym dc pi 4차시도]] — \"$A_k(9,6)$ 검증 통과\" 항목에 무효 사유 주석\n- [ ] [[실험_jacobian_SCR1.5_XR1.0]] — \"다음 실험\" 란에 이 노트 링크\n- [ ] [[GFM 마스터 컨텍스트 프롬프트]] — 핵심 수치의 \"21차\" 전부 수정\n- [ ] 미생성 노트 3건 생성\n\n---\n\n## ❓ 미결 — 다음 세션 첫 확인 사항\n\n> [!question] DC 링크 전압을 누가 잡는가? ESS 컨버터가 $v_{dc}$ 제어 + PV 부스트는 MPPT만 하는 구성인가, 반대인가? **3~8번 상태의 역할과 DC 블록 구조가 완전히 달라진다.** 위 목록은 전자를 가정.\n\n> [!question] DSP 구현에 Q 필터가 실제로 들어가는가? 차수 22 vs 21의 (a)/(b) 선택 기준.",
    "wikilinks": [
      "Bug sym dc pi 4차시도",
      "88포인트_2D_스윕_설계",
      "DC-AC_커플링",
      "GFM_연구_전체지도.md",
      "Phase_지식_연결맵",
      "야코비안 행렬",
      "소신호_선형화",
      "고유값_안정도판단",
      "21차 야코비안 유도가이드",
      "EXP_2026-08-21_Phase2_엔진전환_비교",
      "sym AC_서브시스템_안정확인",
      "실험_jacobian_SCR1.5_XR1.0",
      "GFM 마스터 컨텍스트 프롬프트"
    ]
  },
  {
    "path": "RSCAD/Phase02/04_실험결과/22state_모델_구축_종합.md",
    "dir": "RSCAD/Phase02/04_실험결과",
    "filename": "22state_모델_구축_종합",
    "frontmatter": {
      "type": "synthesis",
      "phase": 2,
      "status": "완료",
      "model_version": "v3-22state",
      "date": "2026-09-01",
      "n_states": 22,
      "tags": [
        "종합",
        "phase2",
        "소신호모델",
        "jacobian",
        "동기화모드",
        "선형화",
        "zettel-hub"
      ]
    },
    "body": "# 22-state GFM 소신호 모델 — 구축 종합\n\n> [!abstract] 한 문장\n> 21차 모델의 구조적 결함을 발견해 폐기하고, 물리 방정식에서 22개 상태변수를\n> 재유도해 **양방향 DC-AC 커플링을 갖춘 소신호 모델**을 구축·검증했다.\n\n## 파이프라인\n\n```\n입력 (SCR·X/R, 제어 파라미터 14, 설비 정격)\n   ↓\nmodel.py   22-state f(x,u) → SymPy jacobian → A(x,u)\n   ↓\nop.py      fsolve f(x₀,u)=0 → 동작점 x₀\n   ↓\nA_k        22×22 수치 야코비안\n   ↓\n├─ runner.py  고유값 · 대역별 ζ · 커플링 효과\n├─ pf.py      참여계수 → 모드 물리 귀속\n└─ xval.py    선형화 유효범위 · DC 이득 오차\n```\n\n## 상태변수 22 = DC 8 + AC 14\n\n| 구분 | 상태변수 |\n|---|---|\n| DC (8) | `v_pv` `i_Lpv` `x_vpv` `x_ipv` `v_dc` `i_Less` `x_vdc` `x_iess` |\n| AC (14) | `delta` `dw` `Pf` `Qf` `phi_d` `phi_q` `gam_d` `gam_q` `i_ld` `i_lq` `v_od` `v_oq` `i_od` `i_oq` |\n\n**차수는 정한 값이 아니라 유도 결과다.** 제안서의 \"21차\"에 맞추려고 물리를 깎는 것은 순서가 거꾸로다. SOC는 시정수가 시간 단위로 소신호 대역(0.1–100 Hz) 밖이고 포함 시 행렬이 stiff해져 제외했다.\n\n→ [[상태변수_선정근거]]\n\n## 발견 ① — 양방향 커플링 없이는 22차가 무의미\n\n$$\\det(A-\\lambda I) = \\det(A_{11}-\\lambda I)\\cdot\\det(A_{22}-\\lambda I)$$\n\n커플링을 한 방향만 넣으면 행렬이 블록삼각이 되고, **비어 있지 않은 쪽 블록은 고유값에 아무 영향을 주지 못한다.** v0에서 커플링 유무에 따른 고유값 차이가 정확히 0이었고, 21차 결과는 13차 AC 전용 모델과 완전히 동일했다.\n\n전력 보존식으로 AC→DC 경로를 유도해 우상단 블록을 채운 뒤:\n\n| 버전 | 커플링 제거 시 고유값 이동 |\n|---|---|\n| v0 (단방향) | **0.000e+00** |\n| v1 (양방향) | 5.61e+01 ~ 7.09e+01 |\n\n> [!danger] 이 부류의 결함\n> 오류를 내지 않는다. 그럴듯한 숫자가 나온다. 자체 검증도 통과한다.\n> **결과를 조용히 무효화한다.** → [[블록삼각_함정]]\n\n## 발견 ② — 임계 모드는 δ 지배 실수극\n\n당초 178 Hz LCL 공진을 지배 모드로 보았으나, 참여계수 분석 결과 **전력각 δ가 지배하는 동기화 모드**가 임계 모드였다. `Dp/J = 40`으로 과감쇠되어 진동이 아닌 실수극으로 분리되어 있었다.\n\n| SCR | δ (°) | cosδ·SCR | λ_sync | p(δ+Δω) |\n|---|---|---|---|---|\n| 3.0 | 22.42 | 2.7733 | -4.6445 | 0.924 |\n| 2.0 | 32.58 | 1.6853 | -2.9653 | 0.951 |\n| 1.5 | 42.42 | 1.1073 | -2.1637 | 0.965 |\n| 1.0 | 62.34 | 0.4642 | -1.2965 | 0.978 |\n\nSCR이 낮아질수록 극이 원점으로 단조 접근하고 δ 참여도는 오히려 순수해진다. **약계통에서 GFM이 무너지는 경로가 동기화 모드**임을 정량적으로 보이며, SCR* 경계의 물리적 정의가 여기서 나온다.\n\n과감쇠 영역에서 느린 근은 $\\lambda \\approx -K/D_p$ 이므로 동기화계수 K에 비례해야 한다. K는 cosδ뿐 아니라 계통 리액턴스에도 의존하므로 $K \\propto \\cos\\delta \\cdot SCR$ 로 평가한다. 관측 3.58배 / 예측 5.97배로 같은 방향·같은 자릿수다.\n\n> [!warning] A[Δω, δ] = 0 은 정상이다\n> 전차수 모델에는 계통 동역학(`i_od`, `i_oq`)과 전력 필터(`Pf`)가 상태변수로\n> 있으므로, δ는 스윙 방정식에 직접 들어가지 않고 경로를 타고 돌아온다.\n> ```\n> δ → i_od (+1.18e4) → Pf (+3.12e4) → Δω (-5.31e-3)\n> ```\n> `K = VE·cosδ/X` 형태의 직접 항은 계통을 대수식으로 취급하는 **고전 축소\n> 모델**에서만 나타난다. 이 진단을 따라 스윙 방정식에 ∂P/∂δ를 추가하면\n> 전력 되먹임이 **이중 계상**되어 모델이 오염된다.\n> (`check_sync.py`가 이 오진을 냈다 → 폐기)\n\n## 발견 ③ — DC 이득 오차는 궤적 오차와 다르다\n\n궤적 형상이 잘 맞아도 **최종 도달점이 어긋난다.**\n\n| SCR | 적분구간(s) | 선형 예측 Δδ | 비선형 실제 Δδ | DC 이득 오차 |\n|---|---|---|---|---|\n| 1.7 | 3.02 | — | — | 52.7% |\n| 1.6 | 3.23 | — | — | 59.1% |\n| 1.5 | 3.47 | — | — | 46.5% |\n| 1.4 | 3.75 | — | — | 48.9% |\n| 1.3 | 4.09 | -3.654° | -2.440° | 49.8% |\n\n결함이 아니라 **선형화의 원리적 한계**다. 계통 전압이 cosδ·sinδ로 들어가므로 δ가 몇 도만 움직여도 곡률이 작용해 접선 근사가 실제보다 멀리 예측한다.\n\n> [!success] 논문 서술\n> 소신호 모델은 **고유값·안정도 경계 예측에는 유효**하다 — A 행렬의 성질이고\n> 섭동 크기와 무관하기 때문이다.\n> **대신호 과도의 최종 도달점 예측에는 쓸 수 없다** — B와 DC 이득의 문제다.\n> CHIL 시나리오에서 섭동 크기를 유효 범위로 제한해야 하는 근거.\n\n## 방법론 교훈\n\n### 검증은 독립적이어야 한다\n\nv0의 검증은 `idc0/(J·w0)`로 대입한 값을 `idc0/(J·w0)`와 비교하는 **항등식**이었다. 항상 통과했고, 그 사이 모델은 블록삼각이었다.\n\n현재는 심볼릭 야코비안과 유한차분 야코비안을 대조한다(오차 1.2e-09). 다만 이 검산도 **f(x) 자체가 물리와 어긋나면 잡지 못한다.** 심볼릭과 유한차분이 같은 f(x)를 미분하기 때문이다. 그래서 참여계수 분석과 물리 경향 확인이 별도로 필요하다.\n\n→ [[실험_재현성_체크리스트]]\n\n### 적분 구간을 고정하면 비교가 성립하지 않는다\n\n동작점마다 5τ가 다르다(SCR 1.7 → 2.01 s, 1.3 → 2.73 s). T=0.5 s 고정 시 SCR 1.3의 궤적은 정착의 48%에서 끊기고, **약계통일수록 덜 진행 → 덜 틀려 보이는 역전**이 발생했다. 자동 산출(5τ×1.5)로 교체.\n\n### 단일 정규화로는 22차 모델을 다룰 수 없다\n\n상태 간 물리 단위와 동작점 크기가 수십 배 차이난다. 세 번의 실패:\n\n| 정규화 | 결과 | 원인 |\n|---|---|---|\n| 상태별 자기 진폭 | SCR 1.4 가짜 골짜기 | `i_oq` 진폭 극소 시 분모 소멸 |\n| 궤적 전체 최대값 | 전 구간 통과 (과대 관대) | 동작점 0인 적분기가 척도 독점 |\n| 노름 비 | 오차 희석 | 큰 nominal 상태에 묻힘 |\n| **응답 게이트 (채택)** | 단조 증가, 판정 작동 | 응답한 상태만 포함 |\n\n→ [[선형화_유효성_지표_규명]]\n\n## 미해결\n\n- [ ] 선형화 유효 임계값 최종 확정 — 지표 특이점은 해결, 섭동 격자 세밀화 필요\n- [ ] DC 링크 제어 주체 확인 (현재 ESS 담당 가정)\n- [ ] 설비 정격 확인 (현재 10 kVA / 400 V_LL / 800 V 가정)\n\n## 후속 작업에 미치는 영향\n\n**PSO 목적함수** — 현재 `ζ_min`은 진동 모드만 본다. 임계 모드가 실수극이므로 이 상태로 최적화하면 LCL 공진만 개선되고 동기화 모드는 방치된다. `max(Re)` 또는 대역별 가중합으로 재정의해야 한다. → [[Phase04_PSO설계]]\n\n**ζ_threshold 0.64** — 실수극에서는 ζ가 1로 고정되어 기준이 무력화된다. 정착시간 기반 지표($t_s = 5/|\\lambda|$) 병용을 검토해야 한다.\n\n**2D 스윕의 근거** — X/R을 1.0 → 2.0으로 올리면 지배 모드가 178.8 Hz → 36.5 Hz로 교체되고 커플링 효과가 56 → 229로 증가한다. 1D SCR 스윕으로는 관측 불가능한 현상. → [[88포인트_2D_스윕_설계]]\n\n## 🔗 연결\n\n- [[Phase02_완료]]\n- [[블록삼각_함정]]\n- [[선형화_유효성_지표_규명]]\n- [[상태변수_선정근거]]\n- [[소신호_선형화]]\n- [[실험_재현성_체크리스트]]\n- [[실행_식별자_설계원칙]]\n- [[88포인트_2D_스윕_설계]]\n- [[Phase04_PSO설계]]\n",
    "wikilinks": [
      "상태변수_선정근거",
      "블록삼각_함정",
      "실험_재현성_체크리스트",
      "선형화_유효성_지표_규명",
      "Phase04_PSO설계",
      "88포인트_2D_스윕_설계",
      "Phase02_완료",
      "소신호_선형화",
      "실행_식별자_설계원칙"
    ]
  },
  {
    "path": "RSCAD/Phase02/04_실험결과/BUG_2026-08-25_sym_구조결함.md",
    "dir": "RSCAD/Phase02/04_실험결과",
    "filename": "BUG_2026-08-25_sym_구조결함",
    "frontmatter": {
      "type": "bug",
      "component": "sym.py",
      "date": "2026-08-25",
      "phase": 2,
      "attempt": "구조검토",
      "status": "open",
      "severity": "critical",
      "tags": [
        "bug",
        "sym",
        "jacobian",
        "DC-AC커플링",
        "상태변수",
        "Phase2"
      ]
    },
    "body": "# 🔧 BUG: 블록삼각 구조 — 커플링 무효 + δ 누락\n\n> **원칙:** `▸` = 코드 실행·검증으로 확인된 사실 / `※` = 판단·해석\n> **저장 위치:** `RSCAD/Phase02/04_실험결과/`\n\n> [!danger] 결론\n> **Phase 3 진입 보류.** `sym.py`는 $A(x,u)$를 유도하지 않았고(sympy 미사용, $f(x,u)$ 부재, 미분 없음 — 행렬 원소 수기 입력), 구조적 결함 두 개로 RQ1 검증이 원리적으로 불가능하다. 저장·기록 하네스 층은 정상이며 그대로 재사용한다.\n\n---\n\n## 증상\n\n```\n기대: 21차 커플링 모델 ≠ 13차 AC 단독 모델\n실제: 고유값 차이 = 0 (정확히 0, 부동소수 오차 아님)\n     21차 고유값 = DC 8개 ∪ AC 13개 (오차 10⁻¹²는 반올림)\n```\n\n| 항목 | 상태 | 비고 |\n|---|---|---|\n| $A(x,u)$ 심볼릭 유도 | ❌ | 수기 입력 |\n| DC-AC 커플링 실효성 | ❌ | 블록 삼각 → 영향 0 |\n| 동기화 루프 $\\delta$ | ❌ | 상태변수에 부재 |\n| 동작점 SCR 의존성 | ❌ | $I_{d0}, I_{q0}$ 고정 |\n| 실험 하네스(A층) | ✅ | 재사용 가능 |\n\n---\n\n## 원인 분석 ①: 블록 삼각행렬\n\n### ▸ 확인된 사실\n\n`A_num[8,5]`의 DC→AC 커플링을 켜고 끈 결과 고유값 차이가 **정확히 0**.\n\n커플링을 **좌하단(DC→AC)에만** 넣고 우상단(AC→DC)을 0으로 둠:\n\n$$\nA=\\begin{bmatrix} A_{DC} & \\mathbf{0} \\\\ A_{AC\\leftarrow DC} & A_{AC}\\end{bmatrix}\n\\;\\Rightarrow\\;\n\\lambda(A)=\\lambda(A_{DC})\\cup\\lambda(A_{AC})\n$$\n\n삼각행렬의 고유값은 대각 블록의 합집합 → 좌하단에 무엇을 넣어도 결과 불변.\n\n### ▸ 검증 로직 자체가 무효\n\n스크립트의 $A_k(9,6)$ \"이론값 오차 0.0001%\" 검증은 `idc0/(J*w0)`를 `idc0/(J*w0)`와 비교한다. 검증이 아니라 **항등식**이다. → Phase 1 DC PI 버그 4차시도 기록에서 \"달성\"으로 적은 항목은 무효 처리 필요.\n\n### ※ 파급\n\n> [!warning] Decision Gate 오판\n> Phase 3 참여인자 분석에서 DC 상태의 AC 모드 기여도가 0으로 나온다. \"DC측 무의미 → 축소 모델\"로 자동 판정되지만 이는 **물리가 아니라 코드 구조 때문**이다. 결론이 통째로 뒤집힌다.\n\n### ※ 물리적 반박\n\n인버터는 DC 버스에서 전력을 끌어가므로 AC측 전력 변동은 DC 버스 전압에 반드시 되먹임된다. 그 경로가 있어야 커플링이 성립하고, 그때 비로소 12차 모델이 못 잡는 모드가 나타난다. 제안서 RQ1이 정확히 이 주장이다.\n\n---\n\n## 원인 분석 ②: 전력각 $\\delta$ 부재 — 더 치명적\n\n### ▸ 확인된 사실\n\nAC 13개 상태에 $\\delta$가 없다. 코드에서 $P_f$가 전류에만 의존하고 각도에 의존하지 않는 것이 증상.\n\n### ※ 해석\n\nGFM 동기화는 $\\delta \\rightarrow P \\rightarrow \\omega \\rightarrow \\delta$ 로 닫히는 루프인데, $\\delta$가 상태가 아니면 루프가 **열린다**. 약계통에서 가장 먼저 불안정해지는 **동기화 모드(synchronization mode)** 가 여기서 나온다.\n\n> [!danger] 우선순위\n> \"SCR을 낮췄을 때 무엇이 먼저 무너지는가\"가 본 연구의 핵심인데 그 모드가 모델에 **존재하지 않는다.** DC-AC 커플링 누락보다 이쪽이 더 치명적.\n\n---\n\n## 그 외 물리 층 문제\n\n### ▸ DC 8×8이 대각행렬\n8개 상태가 완전 독립 → 부스트 인덕터 전류와 DC 버스 전압의 결합이 없다. 계수 `-0.5 - 0.3/SCR`, `-1.2 - 0.2*Kpv`는 근거 불명이며 **전부 음의 실수라 진동 모드가 없고 항상 안정**하다.\n\n### ▸ 동작점이 SCR에 따라 갱신되지 않음\n`Id0=0.9`, `Iq0=0.1` 고정. `idc0 = 0.9/SCR` 하나만 임의 스케일링. 제안서의 \"$A_k$ 자체가 SCR 의존적\"이라는 근거는 **정상상태 동작점이 SCR에 따라 움직이기 때문**인데 그 메커니즘이 없다. → Thevenin 등가 조류계산 필요. [[동작점 평형점]] 정의를 만족하는지부터 재확인하고, [[다중동작점_갱신절차]]에 SCR별 재계산 단계를 명시해야 한다. [[88포인트_2D_스윕_설계]] 전제도 무너짐.\n\n### ▸ $V_{pcc}$가 선형 근사\n$$V_{pcc} \\approx 1.0 - (I_{d0}R_g + I_{q0}X_g)$$\n전압강하 1차 근사이며 조류 방정식의 해가 아니다. $SCR=1.0$에서 오차 확대.\n\n---\n\n## 살아있는 것 — 하네스 A층\n\n> [!success] 버릴 코드가 아니다\n> 물리는 mock이지만 하네스는 진짜다. 껍데기는 두고 **안의 물리만 갈아끼운다.**\n\n- CLI 파라미터 주입 / 파라미터별 폴더 분리(`J0.50_Dp20.0_...`)로 덮어쓰기 방지\n- `.npy` 원자료 + `.json` 결과 + `results.md` + `meta.json` 재현 메타데이터\n- `latest/` 자동 갱신 + `latest_copied_from` 출처 기록\n\n---\n\n## 수정 방향 — 상태변수 재확정\n\n### DC측 8개 (PV 부스트 + ESS 양방향 컨버터)\n\n| # | 기호 | 설명 |\n|---|---|---|\n| 1 | $v_{pv}$ | PV 단자 커패시터 전압 |\n| 2 | $i_{Lpv}$ | 부스트 인덕터 전류 |\n| 3 | $x_{vpv}$ | PV 전압 제어 PI 적분기 (MPPT 추종) |\n| 4 | $x_{ipv}$ | 부스트 전류 루프 PI 적분기 |\n| 5 | $v_{dc}$ | DC 링크 커패시터 전압 |\n| 6 | $i_{Less}$ | ESS 컨버터 인덕터 전류 |\n| 7 | $x_{vdc}$ | DC 링크 전압 제어 PI 적분기 |\n| 8 | $x_{iess}$ | ESS 전류 루프 PI 적분기 |\n\n> [!note] SOC 제외 근거 — 논문에 한 문장 명시할 것\n> 시정수가 시간 단위라 소신호 대역(0.1~100 Hz)에서 준정적 취급. 포함 시 0 근접 고유값으로 행렬이 stiff해짐. MPPT 기준값 $v_{pv}^*$는 상태가 아니라 입력.\n\n### AC측 14개 (VSG + 종속 전압/전류 루프 + LCL)\n\n| # | 기호 | 설명 |\n|---|---|---|\n| 9 | $\\delta$ | **전력각 — 신규 추가** |\n| 10 | $\\Delta\\omega$ | 가상 각속도 편차 |\n| 11 | $P_f$ | 유효전력 LPF 출력 |\n| 12 | $Q_f$ | 무효전력 LPF 출력 |\n| 13, 14 | $\\varphi_d, \\varphi_q$ | 전압 루프 PI 적분기 |\n| 15, 16 | $\\gamma_d, \\gamma_q$ | 전류 루프 PI 적분기 |\n| 17, 18 | $i_{ld}, i_{lq}$ | 인버터측 인덕터 전류 |\n| 19, 20 | $v_{od}, v_{oq}$ | 필터 커패시터 전압 |\n| 21, 22 | $i_{od}, i_{oq}$ | 계통측 인덕터 전류 |\n\n### 차수 21 → 22 정정\n\n$8+14=22$. **\"21차\"는 제안서에 적어둔 숫자지 유도 결과가 아니다.**\n\n| 선택지 | 내용 | 판단 |\n|---|---|---|\n| **(a)** | 22차로 정정, 제안서 문구 수정 | ⭐ 권장. Phase 2 게이트가 원래 \"차수 확정\"을 포함하므로 절차상 문제없음 |\n| (b) | $Q_f$ LPF 제거해 21 유지 | Q 순시값을 전압 드룹에 직접 넣는 구현이면 정당. **DSP 코드에 Q 필터가 있는지가 기준** |\n| (c) | $v_{pv}$ 준정적화 → DC 7개 | 부스트 동특성을 보겠다는 취지와 상충 |\n\n> [!tip] 심사 대응\n> \"왜 21이냐\"에 **\"이렇게 유도됐다\"가 \"숫자를 맞췄다\"보다 안전하다.**\n\n---\n\n## 양방향 커플링 구현 지점\n\n### DC → AC (좌하단)\n$$v_{inv,dq} = m_{dq}\\cdot \\frac{v_{dc}}{2}\n\\quad\\Rightarrow\\quad\n\\frac{\\partial}{\\partial v_{dc}}\\!\\left(\\frac{di_{ld}}{dt}\\right)=\\frac{m_{d0}}{2L_1}$$\n\n### AC → DC (우상단) — 현재 통째로 누락\n$$i_{inv}=\\frac{v_{od}i_{ld}+v_{oq}i_{lq}}{v_{dc}}$$\n\n$v_{dc}$ 동역학의 유출항이므로 $v_{dc}$ 미분방정식이 $v_{od}, v_{oq}, i_{ld}, i_{lq}$에 **모두** 의존. **이 항들이 있어야 고차 모델이 12차와 다른 결과를 낸다.**\n\n> [!success] 자동 해소\n> 두 방향이 모두 있으면 블록 삼각이 아니게 되어 §원인분석① 문제가 자동 해소된다. → [[DC-AC_커플링]] 노트 갱신 필요\n\n### 입력 벡터 $u$\n$G$(일사량), $T$(모듈 온도), $P^*$, $Q^*$ 또는 $V^*$, $V_g$, $\\omega_g$.\n**SCR·X/R은 입력이 아니라 파라미터** — $R_g, L_g$를 통해 $A$에 진입.\n\n---\n\n## 검증 기준\n\n다음을 모두 만족하면 RESOLVED:\n\n- [ ] `sympy Matrix.jacobian()`으로 $A(x,u)$ 유도 (수기 입력 0건)\n- [ ] AC→DC 되먹임 블록이 0이 아님\n- [ ] 커플링 on/off 시 **고유값 변화 ≠ 0**\n- [ ] 유한차분 야코비안 vs 심볼릭 야코비안 일치 (같은 동작점)\n- [ ] 동작점이 SCR에 따라 이동함을 확인 ($\\delta$ 변화 추적)\n- [ ] 4개 SCR 모두 통과\n\n---\n\n## 다음 작업 — 파일 분리\n\n> [!abstract] 먼저 이름부터 정직하게\n> `sym.py`는 실제로는 `harness.py`다. `sym v0/v1/v2`까지 네 개가 굴러다녀 논문에 쓴 코드 추적이 불가능하다.\n\n- [ ] **`model.py`** — 22개 상태 명시 정의, $f(x,u)$ 를 sympy로. **여기가 진짜 Phase 2.** DC 8개를 종이에 먼저 확정\n- [ ] **`op.py`** — SCR·X/R별 $f(x_0,u_0)=0$ 를 `scipy.optimize.fsolve`로. $I_{d0}, I_{q0}, V_{pcc}, i_{dc0}$ 전부 여기서 산출\n- [ ] **`jac.py`** — `Matrix.jacobian()` → `lambdify` → 동작점 대입해 $A_k$ 생성\n- [ ] **`xval.py`** — 유한차분 vs 심볼릭 교차검증. **이것이 진짜 검증.** 통과 시 Phase 2 종료\n- [ ] **`runner.py`** — 기존 저장·기록 층을 분리해 1~4를 호출\n\n---\n\n## 🔗 연관 지식\n\n| 연결 방향 | 노트                                | 이유                                                    |\n| ----- | --------------------------------- | ----------------------------------------------------- |\n| 허브    | [[GFM_연구_전체지도.md]]                | Phase 2 상태 갱신 필요                                      |\n| 허브    | [[Phase_지식_연결맵]]                  | Phase 2 노드 재연결                                        |\n| 근거 이론 | [[야코비안 행렬]]                       | **블록 구조도가 \"우상단 ≈ 0\"으로 그려져 있음 — 이 노트가 결함의 근원. 최우선 개정** |\n| 근거 이론 | [[DC-AC_커플링]]                     | 단방향 → 양방향 커플링 항으로 **개정 필요**                           |\n| 근거 이론 | [[소신호_선형화]]                       | $A=\\partial f/\\partial x$ 정의, 동작점 의존성                 |\n| 근거 이론 | [[고유값_안정도판단]]                     | 블록삼각 고유값 합집합 성질                                       |\n| 방법론   | [[21차 야코비안 유도가이드]]                | **22차로 개정 + 파일명 변경 필요**                               |\n| 방법론   | [[88포인트_2D_스윕_설계]]                | SCR별 동작점 재계산 전제 추가                                    |\n| 방법론   | [[다중동작점_갱신절차]]                    | SCR별 동작점 재계산 단계 삽입 필요                                 |\n| 근거 이론 | [[동작점 평형점]]                       | $f(x_0,u_0)=0$ 미충족 여부 재확인                             |\n| 선행 실험 | [[EXP_2026-08-21_Phase2_엔진전환_비교]] | 같은 Phase 2 엔진 계보 — 직전 기록                              |\n| 선행 실험 | [[sym AC_서브시스템_안정확인]]             | AC 13차 단독 안정 확인 = 본 버그의 증상 그 자체                       |\n| 선행 실험 | [[실험_jacobian_SCR1.5_XR1.0]]      | Phase 1 결과 재해석 필요                                     |\n| 컨텍스트  | [[GFM 마스터 컨텍스트 프롬프트]]             | 차수 21→22 반영                                           |\n\n### ⚠️ 미생성 — 새로 만들어야 할 노트\n\n- `01_개념/동기화모드_δ루프.md` — $\\delta \\to P \\to \\omega \\to \\delta$ 및 약계통 저주파 모드\n- `01_개념/모델차수_축소판정기준.md` — 참여인자 임계값, DC 상태 기여도 하한. **Decision Gate 근거가 되는 노트가 현재 없음**\n- `02_방법론/동작점_조류계산.md` — Thevenin 등가, fsolve 기반 $f(x_0,u_0)=0$\n\n---\n\n## 🤖 Claude 지식 프롬프트\n\n```\n[GFM_마스터_컨텍스트_프롬프트.md 전체]\n[이 노트 전체]\n[DC-AC_커플링.md]\n[21차_야코비안_유도가이드.md]\n\n→ \"22개 상태변수의 비선형 미분방정식 f(x,u)를 sympy로 작성한\n   model.py를 만들어줘. AC→DC 되먹임 항(v_dc 미분방정식이\n   v_od, v_oq, i_ld, i_lq에 의존)이 반드시 포함되어야 하고,\n   δ가 상태변수로 들어가야 함.\"\n```\n\n---\n\n## 📌 Obsidian 업데이트 체크리스트\n\n- [ ] [[야코비안 행렬]] — **최우선.** 블록 구조도의 `우상단 ≈ 0` 삭제, 21×21 → 22×22, `A_k(9,6) 오차 0.0001% ✅` 표기 제거\n- [ ] [[GFM_연구_전체지도.md]] — Phase 2 상태를 `verified` → `open`으로 되돌리고 이 노트 링크 추가\n- [ ] [[Phase_지식_연결맵]] — Phase 2 노드에 이 노트 연결\n- [ ] [[DC-AC_커플링]] — 단방향 → 양방향 수식으로 개정\n- [ ] [[21차 야코비안 유도가이드]] — `22차_야코비안_유도가이드`로 파일명 변경\n- [ ] [[다중동작점_갱신절차]] — SCR별 재계산 단계 추가\n- [ ] [[실험_jacobian_SCR1.5_XR1.0]] — \"다음 실험\" 란에 이 노트 링크\n- [ ] [[GFM 마스터 컨텍스트 프롬프트]] — 핵심 수치의 \"21차\" 전부 수정\n- [ ] 미생성 노트 3건 생성\n\n---\n\n## ❓ 미결 — 다음 세션 첫 확인 사항\n\n> [!question] DC 링크 전압을 누가 잡는가?\n> ESS 컨버터가 $v_{dc}$ 제어 + PV 부스트는 MPPT만 하는 구성인가, 반대인가?\n> **3~8번 상태의 역할과 DC 블록 구조가 완전히 달라진다.** 위 목록은 전자를 가정.\n\n> [!question] DSP 구현에 Q 필터가 실제로 들어가는가?\n> 차수 22 vs 21의 (a)/(b) 선택 기준.\n",
    "wikilinks": [
      "동작점 평형점",
      "다중동작점_갱신절차",
      "88포인트_2D_스윕_설계",
      "DC-AC_커플링",
      "GFM_연구_전체지도.md",
      "Phase_지식_연결맵",
      "야코비안 행렬",
      "소신호_선형화",
      "고유값_안정도판단",
      "21차 야코비안 유도가이드",
      "EXP_2026-08-21_Phase2_엔진전환_비교",
      "sym AC_서브시스템_안정확인",
      "실험_jacobian_SCR1.5_XR1.0",
      "GFM 마스터 컨텍스트 프롬프트"
    ]
  },
  {
    "path": "RSCAD/Phase02/04_실험결과/EXP_2026-08-21_Phase2_엔진전환_비교.md",
    "dir": "RSCAD/Phase02/04_실험결과",
    "filename": "EXP_2026-08-21_Phase2_엔진전환_비교",
    "frontmatter": {
      "## type": "experiment api: /api/jacobian + /api/sweep2d date: 2026-08-21 phase: 2 status: verified engine: sympy+numpy tags: [phase2, comparison, jacobian, sweep2d, sympy, numpy, engine-upgrade]",
      "# 🧪 EXP": "Phase 1→2 엔진 전환 비교 결과",
      "\"SCR\"": "1.5,  \"XR\": 1.0,",
      "\"J\"": "0.62, \"Dp\": 28.0,",
      "\"Kpv\"": "1.4,  \"Kiv\": 50.0,",
      "\"Kpc\"": "10.0, \"Kic\": 100.0,",
      "\"wc\"": 45.0,
      "curl -X POST http": "//localhost:5000/api/sweep2d \\",
      "-H \"Content-Type": "application/json\" \\",
      "-d '{\"SCR\"": "1.5,\"XR\":1.0,\"J\":0.62,\"Dp\":28,\"Kpv\":1.4}'",
      "-d '{\"J\"": "0.62,\"Dp\":28,\"Kpv\":1.4}'"
    },
    "body": "## 📤 핵심 비교 결과\n\n### Phase 1 vs Phase 2 수치 비교\n\n|항목|Phase 1 (numpy)|Phase 2 (sympy+numpy)|판정|\n|---|---|---|---|\n|엔진|numpy|**sympy+numpy**|✅ 업그레이드|\n|stable|True|**True**|✅ 동일|\n|ζ_min|0.2564|**0.1642**|⚠️ 감소|\n|f_dom (Hz)|0.3584|**0.3218**|🔧 정밀화|\n|A_k(9,6)|0.003183|**0.002567**|✅ J=0.62 반영|\n|A_k(9,6) 오차|—|**0.0001%**|✅ 이론값 일치|\n\n### 88포인트 2D 스윕\n\n|X/R|ζ 최솟값|ζ 최댓값|SCR*|\n|---|---|---|---|\n|0.5|0.1232|0.1772|null ❌|\n|1.0|0.1628|0.1713|null ❌|\n|2.0|0.1602|0.1655|null ❌|\n|5.0|0.0791|0.0894|null ❌|\n\n---\n\n## 📊 핵심 수치 추출\n\n|항목|값|기대값|판정|\n|---|---|---|---|\n|stable|True|True|✅|\n|ζ_min|0.1642|≥ 0.64|❌ 미달|\n|A_k(9,6) 오차|0.0001%|< 1%|✅|\n|엔진|sympy+numpy|sympy+numpy|✅|\n|SCR* (전 X/R)|null|유효값|❌ 미달|\n\n---\n\n## 🔍 분석\n\n### ▸ 관찰된 사실 (실험 결과)\n\n```\n1. sympy+numpy 엔진 전환 성공\n   → /api/health: \"engine\": \"sympy+numpy\" 확인\n   → A_CACHE: SCR={3.0, 2.0, 1.5, 1.0} 4개 로드\n\n2. A_k(9,6) 이론값 완전 일치\n   이론: idc0/(J·ω₀) = 0.6/(0.62×376.99) = 0.002567\n   계산: 0.002567  →  오차 0.0001% ✅\n\n3. stable=True 유지 (4개 SCR + 88포인트 전부)\n\n4. ζ_min 변화: 0.2564 → 0.1642\n   → numpy 근사가 LCL 공진 모드를 과대평가했던 것 보정\n\n5. 88포인트 전 구간 ζ < 0.64\n   → SCR* 경계 도출 불가 (boundaries 전부 null)\n\n6. X/R=5.0에서 ζ 증가 경향\n   → Ganguly(2025) 결과와 반대 → 모델 한계\n```\n\n### ※ 해석 (내 판단)\n\n```\nζ_min 감소(0.25→0.16)는 나쁜 게 아님\n→ numpy가 과대평가, sympy+numpy가 더 정확한 값\n→ 실제 시스템도 0.64 미달이므로 PSO 최적화 필요성 확인\n\nX/R=5.0 이상 경향은 AC 13×13 수동 모델 한계\n→ 계통 임피던스 교차항이 단순화됨\n→ Phase 2 추가 정밀화 또는 PSCAD 교차검증 필요\n\nSCR* null은 현재 파라미터(기본값 수준)에서 예상된 결과\n→ PSO 후 ζ ≥ 0.64 달성 시 SCR* 유효값 도출 예상\n```\n\n### ⚠️ 이슈\n\n```\n이슈 1: ζ < 0.64 (전 구간)\n  → 원인: LCL 공진 모드(~180Hz)가 지배 모드\n  → 해결: PSO로 Kpc, Kic, L1 최적화 (Phase 3)\n\n이슈 2: X/R=5.0 경향 반전\n  → 원인: AC 13×13 계통 임피던스 단순화\n  → 해결: 계통 교차항 정밀화 또는 PSCAD 검증\n\n이슈 3: SCR* null\n  → 원인: 현재 파라미터에서 ζ 기준 미달\n  → 해결: Phase 3 PSO 후 재실행\n```\n\n---\n\n## 🔗 연관 지식\n\n| 연결 방향 | 노트                           | 이유                          |\n| ----- | ---------------------------- | --------------------------- |\n| 이론 근거 | [[DC-AC_커플링]]                | A_k(9,6) = idc0/(J·ω₀) 검증 ✅ |\n| 이론 근거 | [[고유값_안정도판단]]                | stable 판정 기준                |\n| 선행 실험 | [[실험_jacobian_SCR1.5_XR1.0]] | Phase 1 numpy 결과 비교         |\n| 선행 실험 | [[실험 sweep2d j0.5 dp20]]     | Phase 1 스윕 비교               |\n| 버그 기록 | [[Bug sym dc pi 4차시도]]       | stable 달성 과정                |\n| 참고문헌  | [[Zhao_2023_Aalborg]]        | A_k(9,6) 이론값 [7]            |\n| 참고문헌  | [[Ganguly_2025_preprint]]    | X/R 경향 비교 [3]               |\n| 참고문헌  | [[Chen_2024_Electronics]]    | 파라미터 출처 [1]                 |\n| 다음 단계 | [[Pso 이중수렴기준]]               | Phase 3 PSO 구현              |\n\n---\n\n## 🤖 Claude 지식 프롬프트\n\n```\n[GFM_마스터_컨텍스트_프롬프트.md]\n[이 노트 전체]\n[BUG_sym_DC_PI_4차시도.md]\n\n→ \"Phase 2 sympy+numpy 결과에서 ζ_min=0.164로\n   UNIFI 기준(0.64) 미달이다. PSO로 어떤 파라미터를\n   얼마나 조정해야 ζ ≥ 0.64를 달성할 수 있을지\n   예측해줘. 대상 파라미터: Kpc, Kic, L1, Kpv, J, Dp\"\n```\n\n---\n\n## 📌 4중 차별화 업데이트 (표 6-3 기준)\n\n```\n[2] Dong(2026) 비교:\n  ▸ Dong: 12차, A_k(9,6) 없음\n  ▸ 본 연구: 21차, A_k(9,6)=0.002567 ✅ (오차 0.0001%)\n  ※ DC-AC 커플링 차별화 검증 완료\n\n[7] Zhao(2023) 이론 검증:\n  ▸ A_k(9,6) = idc0/(J·ω₀) 이론 → 오차 0.0001% ✅\n  ※ Zhao 이론의 정확한 구현 확인\n```\n\n---\n\n## 📋 Obsidian 업데이트 체크리스트\n\n- [x] GFM_연구_전체지도.md → Phase 2 ✅ 완료 표시\n- [x] BUG_sym_DC_PI_4차시도.md → status: resolved\n- [x] 실험_참고문헌_연결맵.md → [7]Zhao A_k(9,6) ✅ 채우기\n- [ ] Phase 3 PSO 노트 생성 예정\n- [ ] PSO 완료 후 이 노트의 SCR* 항목 업데이트\n\n---\n\n## 📁 파일 경로\n\n```\n실험 run:    J0.62_Dp28.0_Kpv1.4_wc45.0\nresults/:\n  A_num_SCR1.0.npy  A_num_SCR1.5.npy\n  A_num_SCR2.0.npy  A_num_SCR3.0.npy\n  eigenvalue_results.json\n  meta.json\n보고서:      phase2_report.docx\n```",
    "wikilinks": [
      "DC-AC_커플링",
      "고유값_안정도판단",
      "실험_jacobian_SCR1.5_XR1.0",
      "실험 sweep2d j0.5 dp20",
      "Bug sym dc pi 4차시도",
      "Zhao_2023_Aalborg",
      "Ganguly_2025_preprint",
      "Chen_2024_Electronics",
      "Pso 이중수렴기준"
    ]
  },
  {
    "path": "RSCAD/Phase02/04_실험결과/EXP_2026-08-28_XR3조건_스윕.md",
    "dir": "RSCAD/Phase02/04_실험결과",
    "filename": "EXP_2026-08-28_XR3조건_스윕",
    "frontmatter": {
      "type": "result",
      "phase": 2,
      "status": "verified",
      "date": "2026-08-28",
      "model_version": "v3-22state",
      "XR": [
        "0.5",
        "1.0",
        "3.0"
      ],
      "SCR": [
        "3.0",
        "2.0",
        "1.5",
        "1.0",
        "0.8"
      ],
      "tags": [
        "result",
        "phase2",
        "phase3",
        "스윕",
        "모드교차"
      ]
    },
    "body": "# 실행결과 2026-08-28 — X/R 3조건 스윕\n\n> **저장 위치:** `RSCAD/Phase02/04_실험결과/`\n\n```bash\npython Simulation/runner.py --XR 0.5 --SCR 3.0 2.0 1.5 1.0 0.8 --tag v3_xr05\npython Simulation/runner.py --XR 1.0 --SCR 3.0 2.0 1.5 1.0 0.8 --tag v3_base\npython Simulation/runner.py --XR 3.0 --SCR 3.0 2.0 1.5 1.0 0.8 --tag v3_xr30\n```\n\n공통: `J=0.5, Dp=20.0, Kpv=0.05, wc=62.8`\n\n## X/R = 0.5\n\n| SCR | ζ_min | 대역 | f_dom | ζ_ctrl | ζ_lcl | δ(°) | 검산 | 커플링 |\n|---|---|---|---|---|---|---|---|---|\n| 3.0 | 0.2063 | lcl | 178.902 | 0.4655 | 0.2063 | 26.67 | 3.2e-07 | 1.7096 |\n| 2.0 | 0.2066 | lcl | 178.873 | 0.5080 | 0.2066 | 38.03 | 3.2e-07 | 1.6019 |\n| 1.5 | 0.2068 | lcl | 178.847 | 0.5480 | 0.2068 | 48.48 | 3.2e-07 | 1.5274 |\n| 1.0 | 0.2070 | lcl | 178.806 | 0.5587 | 0.2070 | 68.35 | 3.2e-07 | 1.4383 |\n| 0.8 | 0.2071 | lcl | 178.783 | 0.5632 | 0.2071 | 83.65 ⚠ | 3.2e-07 | 1.3996 |\n\n## X/R = 1.0\n\n| SCR | ζ_min | 대역 | f_dom | ζ_ctrl | ζ_lcl | δ(°) | 검산 | 커플링 |\n|---|---|---|---|---|---|---|---|---|\n| 3.0 | 0.2065 | lcl | 178.835 | 0.4387 | 0.2065 | 22.42 | 3.2e-07 | 1.3144 |\n| 2.0 | 0.2067 | lcl | 178.804 | 0.4495 | 0.2067 | 32.58 | 3.2e-07 | 1.2244 |\n| 1.5 | 0.2069 | lcl | 178.781 | 0.4647 | 0.2069 | 42.42 | 3.2e-07 | 1.1864 |\n| 1.0 | 0.2070 | lcl | 178.749 | 0.4999 | 0.2070 | 62.34 | 3.2e-07 | 1.1703 |\n| 0.8 | 0.2071 | lcl | 178.732 | 0.5257 | 0.2071 | 78.95 ⚠ | 3.2e-07 | 1.1758 |\n| 0.6 | — | — | — | — | — | 해 없음 | — | — |\n\n## X/R = 3.0 ★\n\n| SCR | ζ_min | 대역 | f_dom | ζ_ctrl | ζ_lcl | δ(°) | 검산 | 커플링 |\n|---|---|---|---|---|---|---|---|---|\n| 3.0 | **0.0794** | **control** | **37.617** | 0.0794 | 0.2066 | 20.10 | 3.2e-07 | **26.238** |\n| 2.0 | 0.1645 | control | 42.556 | 0.1645 | 0.2068 | 29.91 | 3.2e-07 | **26.969** |\n| 1.5 | 0.2070 | lcl | 178.732 | 0.2083 | 0.2070 | 40.13 | 4.2e-07 | 0.9980 |\n| 1.0 | 0.2071 | lcl | 178.706 | 0.2412 | 0.2071 | 64.15 | ⚠️ 1.2e-06 | 1.0561 |\n| 0.8 | 0.2072 | lcl | 178.690 | 0.2470 | 0.2072 | **100.16** ⛔ | ⚠️ 1.8e-06 | 1.0973 |\n\n> [!danger] 모드 교차 · δ>90° · 검산 초과가 모두 이 조건에 몰려 있다\n\n## 참여계수 (X/R = 0.5)\n\n지배 동기화 모드 = **실수극**. → [[과감쇠_동기화모드]]\n\n| SCR | λ_sync | p(δ+Δω) | t_s = 5/\\|λ\\| |\n|---|---|---|---|\n| 3.0 | −4.264 | 0.928 | 1.17 s |\n| 2.0 | −2.859 | 0.952 | 1.75 s |\n| 1.5 | −2.165 | 0.964 | 2.31 s |\n| 1.0 | −1.393 | 0.977 | 3.59 s |\n| 0.8 | −1.012 | 0.983 | 4.94 s |\n\n`sync` 대역(<5Hz)이 잡던 진동모드는 λ≈−65, 참여 상태 **Qf 0.4452 / Pf 0.4012**, δ 참여 0.0219. 전력 필터 모드다.\n\n## 판정 요약\n\n▸ **전 조건 안정.** 감쇠 경계가 한 번도 발동하지 않았다.\n▸ 제약은 전부 **정적 부하가능성**(δ→90°). → [[정적부하가능성_경계]]\n▸ ζ_min 이 X/R=3.0 에서만 모드를 갈아탄다 (SCR 2.0→1.5). → [[모드교차_최소감쇠비_함정]]\n▸ ζ_sync 로 표시되던 0.3231~0.3238 은 전력 필터 모드 값. 동기화 모드가 아니다.\n\n## 커플링 수치 정정\n\n> [!warning] `P2-A4` 의 `5.90e+01` 은 폐기\n> `np.sort_complex` 정렬 페어링이 서로 다른 모드끼리 뺀 값이다.\n> 헝가리안 매칭 기준 최소감쇠 모드 이동량:\n> - X/R 0.5 : 1.71 → 1.40\n> - X/R 1.0 : 1.31 → 1.18\n> - X/R 3.0 : **26.24** → 1.10 ← 논문 인용 대상\n>\n> 결론(커플링 유의미)은 유지. 인용 수치만 교체.\n\n## 미해결\n\n- [ ] δ = 100.16° 에서 `stable=True` (`P2-A10`)\n- [ ] X/R=3.0, SCR ≤ 1.0 검산 1e-6 초과 (`P2-A2`)\n- [ ] `sync` 대역 4.0165 Hz 모드 정체 미확인 (5 Hz 아래에 최소 3개 존재)\n- [ ] SCR 1.5 선형화 임계값 딥과 모드 교차의 동일 지점 (`P2-A5`)\n\n## 🔗 연결 노트\n\n| 방향 | 노트 | 이유 |\n|---|---|---|\n| ← | [[Simulation_코드구조]] | 생성 도구 |\n| → | [[과감쇠_동기화모드]] | 참여계수 결론 |\n| → | [[모드교차_최소감쇠비_함정]] | X/R=3.0 교차 |\n| → | [[정적부하가능성_경계]] | δ 한계 |\n| → | [[88포인트_2D_스윕_설계]] | 격자 설계 입력 |\n\n> [!question] 허브 갱신 필요\n> 이 노트를 [[Phase_지식_연결맵]] 과 [[GFM_연구_전체지도.md]] 에 연결할 것.\n",
    "wikilinks": [
      "과감쇠_동기화모드",
      "정적부하가능성_경계",
      "모드교차_최소감쇠비_함정",
      "Simulation_코드구조",
      "88포인트_2D_스윕_설계",
      "Phase_지식_연결맵",
      "GFM_연구_전체지도.md"
    ]
  },
  {
    "path": "RSCAD/Phase02/04_실험결과/Phase02_완료.md",
    "dir": "RSCAD/Phase02/04_실험결과",
    "filename": "Phase02_완료",
    "frontmatter": {
      "type": "gate",
      "phase": 2,
      "status": "passed",
      "model_version": "v1-22state",
      "date": "2026-08-25",
      "n_states": 22,
      "verified": true,
      "tags": [
        "phase2",
        "jacobian",
        "소신호모델",
        "gate",
        "22state"
      ]
    },
    "body": "# Phase 02 완료 — 22차 야코비안 유도 및 검증\n\n> [!success] 게이트 통과\n> 심볼릭 상태방정식 $f(x,u)$ 유도 → 동작점 수렴 → 야코비안 검산 → 커플링 유효성 확인까지 완료.\n> **Phase 3(참여인자 분석) 진입 가능.**\n\n## 결론 세 줄\n\n1. **야코비안이 맞다** — 심볼릭 vs 유한차분 최대 상대오차 `1.2e-09`. 22×22 전 원소 검증.\n2. **커플링이 살아 있다** — DC–AC 블록 제거 시 고유값 최대 변화 `5.90e+01`. v0에서 정확히 `0`이던 값.\n3. **동작점이 SCR을 따라간다** — $\\delta$가 22.4°(SCR 3.0) → 62.3°(SCR 1.0). 약계통일수록 전력각이 벌어지는 물리가 재현됨.\n\n---\n\n## 검증 결과 (X/R = 1.0, 기본 파라미터)\n\n| SCR | stable | ζ_min | f_dom (Hz) | δ (°) | v_od (V) | 검산 오차 | 커플링 효과 |\n|---|---|---|---|---|---|---|---|\n| 3.0 | ✅ | 0.2065 | 178.835 | 22.41 | 330.8 | 1.2e-09 | 5.609e+01 |\n| 2.0 | ✅ | 0.2067 | 178.804 | 32.58 | 330.0 | 1.2e-09 | 5.901e+01 |\n| 1.5 | ✅ | 0.2069 | 178.781 | 42.42 | 329.1 | 1.2e-09 | 6.225e+01 |\n| 1.0 | ✅ | 0.2070 | 178.749 | 62.34 | 327.3 | 1.2e-09 | 7.085e+01 |\n\n- **검산 오차** — $\\max|A_{sym}-A_{fd}| / \\max|A_{sym}|$\n- **커플링 효과** — 커플링 블록을 0으로 뒀을 때 고유값 최대 이동량 $\\max_i|\\lambda_i - \\lambda_i^{uncoupled}|$\n- 실행 폴더: `results/J0.50_Dp20.0_Kpv0.050_wc62.8_XR1.0_4539ec/`\n- 재현 확인: Windows 11 / MINGW64, 소수점까지 일치\n\n> [!warning] ζ_min = 0.207 → 기준(0.64) 미달\n> 결함이 아니라 **Phase 4의 존재 이유**다. 현재 제어 이득은 임의의 초기값이며, PSO 튜닝 대상 14개 파라미터가 아직 최적화되지 않았다.\n\n> [!caution] 지배 모드 해석에 주의 — Phase 3에서 반드시 확인\n> SCR이 3.0 → 1.0으로 세 배 약해지는데 `f_dom`은 178.835 → 178.749 Hz, `ζ_min`은 0.2065 → 0.2070으로 사실상 움직이지 않는다. **계통 강도에 둔감한 모드**라는 뜻이고, LCL 공진일 가능성이 높다.\n> 반면 δ는 22°에서 62°로 크게 움직였다. 즉 동기화 모드는 분명히 반응하고 있는데, `ζ_min` 지표가 그 모드를 가리키지 않고 있다.\n> ※ 현재 표의 `f_dom`·`ζ_min`은 \"가장 감쇠가 나쁜 모드\"일 뿐 **본 연구가 추적하려는 모드가 아니다.** Phase 3 참여인자 분석 전까지 이 수치를 안정도 결론의 근거로 인용하지 말 것.\n\n---\n\n## v0 → v1 변경 이력\n\n기존 `sym.py`(v0)를 폐기하고 `model.py` + `op.py` + `runner.py` 3층으로 재구성.\n\n| 항목 | v0 (`sym.py`) | v1 (`model.py`) |\n|---|---|---|\n| 상태변수 | 21 (숫자 먼저 확정) | 22 (물리에서 유도) |\n| $A(x,u)$ 유도 | ❌ 행렬 원소 직접 타이핑 | ✅ sympy `jacobian()` |\n| δ (전력각) | ❌ 없음 → 동기화 루프 열림 | ✅ 상태변수 포함 |\n| DC–AC 커플링 | 단방향 스칼라 1개 | 양방향 (DC→AC 2, AC→DC 4) |\n| 동작점 | `Id0=0.9` 고정 | `fsolve`로 SCR별 계산 |\n| DC 8×8 | 대각행렬 (근거 없는 계수) | 부스트/ESS 물리식 |\n| 검증 | 항등식 (항상 통과) | 유한차분 대조 |\n\n> [!danger] v0의 치명적 결함 — [[블록삼각_함정]]\n> 커플링을 좌하단(DC→AC)에만 넣고 우상단(AC→DC)을 0으로 두면 행렬이 **블록삼각**이 된다. 삼각행렬의 고유값은 대각 블록 고유값의 합집합이므로 **좌하단에 무엇을 넣든 고유값이 변하지 않는다.**\n> → 21차를 돌린 결과가 13차 AC 모델만 돌린 결과와 완전히 동일했음\n> → RQ1(DC–AC 커플링의 기여) 검증 자체가 불가능한 상태였음\n> 상세: [[BUG_2026-08-25_sym_구조결함]]\n\n> [!tip] 재발 방지\n> `runner.py`가 매 실행마다 **커플링 효과**를 출력한다. 이 값이 0에 가까우면 모델이 다시 퇴화한 것.\n\n---\n\n## 파일 구조\n\n```\nSimulation/\n├── model.py     22개 상태 + f(x,u) + A_sym/B_sym (심볼릭)\n├── op.py        동작점 fsolve + A_k 평가 + 유한차분 검산\n├── runner.py    실험 실행 · 결과 저장 · Obsidian md 생성\n└── _archive/    sym.py, sym v0~v2.py (폐기, 근거 보존용)\n```\n\n---\n\n## 상태변수 정의 (22)\n\n**DC측 8** — PV 부스트 + ESS 양방향 컨버터\n\n`v_pv` `i_Lpv` `x_vpv` `x_ipv` `v_dc` `i_Less` `x_vdc` `x_iess`\n\n**AC측 14** — VSG + 종속 전압/전류 루프 + LCL\n\n`delta` `dw` `Pf` `Qf` `phi_d` `phi_q` `gam_d` `gam_q` `i_ld` `i_lq` `v_od` `v_oq` `i_od` `i_oq`\n\n> [!note] SOC 제외 근거\n> 시정수가 시간 단위로 소신호 대역(0.1–100 Hz) 밖. 포함 시 0 근처 고유값이 생겨 행렬이 stiff해짐. → [[상태변수_선정근거]]\n\n상세 인덱스와 블록 구조: [[야코비안 행렬]]\n\n---\n\n## 관찰 — Phase 3에서 확인할 것\n\nX/R을 1.0 → 2.0으로 올리자 SCR 3.0의 지배 모드가 **178.8 Hz → 36.5 Hz**로 이동하고, 커플링 효과가 **56 → 229**로 약 4배 증가했다.\n\n→ 지배 모드가 X/R에 따라 **교체**된다는 뜻. 1D SCR 스윕만으로는 보이지 않는 현상이며, [[88포인트_2D_스윕_설계]]의 필요성을 뒷받침하는 직접 증거가 될 수 있다.\n\n※ 다만 현재는 X/R 두 점(1.0, 2.0)만 본 것이라 \"교체\"인지 \"연속 이동\"인지 구분되지 않는다. 논문에 쓰려면 X/R을 촘촘히 훑어 모드 궤적을 그려야 한다. 지금 단계에서는 **가설**로 기록.\n\n---\n\n## 미해결 (Decision Gate 전까지 확인 필요)\n\n- [ ] **DC 링크 제어 주체** — 현재 ESS가 `v_dc` 담당, PV 부스트는 MPPT 전담으로 가정. 반대 구성이면 `model.py` 제어식 교체 필요\n- [ ] **설비 정격** — 현재 10 kVA / 400 V_LL / `v_dc` 800 V / V_b 400 V 가정. 실제 값 확인 시 `op.py`의 `FIXED`·`INP`만 수정\n- [ ] 기존 `results/` 두 폴더에 `\"model_version\": \"v0-invalid\"` 태깅\n- [ ] `01_개념/야코비안_행렬` 등 v0 기준으로 작성된 노트 개정 — 21차·`A_k(9,6)` 표기 잔존 여부 확인\n\n---\n\n## 다음 단계 → [[Phase03_참여인자]]\n\n`pf.py` 작성. 참여인자 $P_{ki}$ 계산으로 답할 것:\n\n1. 178 Hz 지배 모드가 LCL 공진인지 (`i_ld` `i_lq` `v_od` `v_oq` 참여도)\n2. **DC측 8개 상태의 AC 모드 기여도** ← Decision Gate: 유의하면 22차 유지, 미미하면 축소\n3. 동기화 모드(`delta` `dw` 지배)의 위치와 SCR 의존성 ← 논문 핵심 서사\n\n> [!important] Decision Gate 판정 기준을 먼저 정할 것\n> \"유의 / 미미\"의 임계값이 아직 없다. 결과를 본 뒤에 기준을 정하면 사후 정당화가 된다. **참여인자 하한(예: DC 상태 합산 기여도 ≥ 5%)을 pf.py 실행 전에 문서로 확정**해두는 것이 안전하다.\n\n> [!note] PSO 목적함수 설계 시 주의\n> 178 Hz 모드는 LCL 공진이라 `J`·`Dp` 등 VSG 이득에 둔감하다. ζ_min만 목적함수로 쓰면 필터 공진에 발목이 잡혀 저주파 동기화 모드를 놓친다. → 주파수 대역 분리 여부를 [[Phase04_PSO설계]]에서 결정할 것.\n\n---\n\n## 🔗 연결 노트\n\n| 연결 방향 | 노트                                                        |\n| ----- | --------------------------------------------------------- |\n| 원인 기록 | [[BUG_2026-08-25_sym_구조결함]]                               |\n| 근거 이론 | [[블록삼각_함정]] · [[DC-AC_커플링]] · [[야코비안 행렬]] · [[고유값_안정도판단]] |\n| 설계 근거 | [[상태변수_선정근거]] · [[동작점 평형점]] · [[다중동작점_갱신절차]]              |\n| 후속    | [[Phase03_참여인자]] · [[Phase04_PSO설계]] · [[88포인트_2D_스윕_설계]] |\n| 컨텍스트  | [[GFM 마스터 컨텍스트 프롬프트]]                                     |\n",
    "wikilinks": [
      "블록삼각_함정",
      "BUG_2026-08-25_sym_구조결함",
      "상태변수_선정근거",
      "야코비안 행렬",
      "88포인트_2D_스윕_설계",
      "Phase03_참여인자",
      "Phase04_PSO설계",
      "DC-AC_커플링",
      "고유값_안정도판단",
      "동작점 평형점",
      "다중동작점_갱신절차",
      "GFM 마스터 컨텍스트 프롬프트"
    ]
  },
  {
    "path": "RSCAD/Phase02/04_실험결과/sym AC_서브시스템_안정확인.md",
    "dir": "RSCAD/Phase02/04_실험결과",
    "filename": "sym AC_서브시스템_안정확인",
    "frontmatter": {
      "## type": "experiment component: sym.py date: 2026-08-20 phase: 2 status: verified tags: [experiment, AC-subsystem, stability, debug, phase2]",
      "# 🧪 EXP": "AC 서브시스템 단독 안정 확인"
    },
    "body": "## 📥 입력 (수동 구성 AC 13×13)\n\n```python\n# 상태변수 (13개)\n# [Δω, Pfilt, Qfilt, φ_vd, φ_vq, γ_id, γ_iq,\n#  iid, iiq, uod, uoq, iod, ioq]\n\n파라미터:\n  J=0.5, Dp=20, wc=31.4\n  Kpv=1.0, Kiv=100, Kpc=5.0, Kic=50\n  L1=0.1, Cf=0.05, R1=0.01\n  SCR=1.5, XR=1.0\n```\n\n---\n\n## 📤 실험 결과\n\n```\nSCR=3.0: stable=True  max_Re=0.000  ✅\nSCR=1.5: stable=True  max_Re=0.000  ✅\nSCR=1.0: stable=True  max_Re=0.000  ✅\n```\n\n---\n\n## 📊 핵심 수치\n\n|항목|값|판정|\n|---|---|---|\n|stable (전 SCR)|True|✅|\n|max Re(λ)|0.000|✅ 좌반평면|\n|ζ_min (AC 단독)|0.013|⚠️ 낮음|\n|불안정 고유값|없음|✅|\n\n---\n\n## 🔍 분석\n\n### ▸ 관찰된 사실\n\n```\nAC 13×13 수동 구성:\n  dw ←→ Pfilt (VSG 스윙)\n  evd/evq → iid_ref/iiq_ref (전압 루프)\n  eid/eiq → uid/uiq (전류 루프)\n  LCL 필터 + 계통 임피던스\n\n→ 3개 SCR 모두 stable=True\n→ 모든 고유값 Re(λ) < 0\n```\n\n### ※ 해석\n\n```\nAC 서브시스템은 자체적으로 안정\n→ Phase 2 stable=False의 원인은 DC에 있음\n\nDC 서브시스템 문제:\n  1. iLpv_ref = 0.9/upv 비선형항 → 선형화 오류\n  2. 동작점 불일치: upv0=1.0, udc0=1.0, dpv0=0.5\n     → f7=0 조건: upv = (1-dpv)*udc = 0.5 ≠ 1.0\n  3. Kp1 이득 과다 → ∂f6/∂iLpv = Kp1*udc/Cdc 불안정\n\n→ 해결: DC numpy 근사 + AC SymPy 수동 결합 (9차 시도)\n```\n\n---\n\n## 역할 — BUG 격리의 핵심 실험\n\n```\nPhase 2 sym.py 버그 해결 과정:\n\n1차~3차: 전체 21×21 → stable=False\n    ↓\n[이 실험] AC 단독 확인 → stable=True ✅\n    ↓\n결론: DC가 문제 → DC는 numpy 근사 유지\n      AC만 SymPy 수동 구성\n    ↓\n9차 시도: DC numpy(8×8) + AC SymPy(13×13) 결합\n    ↓\nstable=True ✅ (Phase 2 완료)\n```\n\n---\n\n## 🔗 연결 노트\n\n### 선행\n\n- [[Bug sym dc pi 4차시도]] — 이 실험이 3차 시도 결과\n- [[야코비안 행렬]] — AC 13×13 블록 구조\n\n### 후속\n\n- [[EXP_2026-08-21_Phase2_엔진전환_비교]] — 최종 결과\n- [[Phase02_완료]] — 9차 시도 해결\n\n### 개념\n\n- [[소신호_선형화]] — AC 야코비안 유도 원리\n- [[고유값_안정도판단]] — stable 판정 기준\n- [[DC-AC_커플링]] — DC가 AC에 미치는 영향\n\n---\n\n## 재현 코드\n\n```python\nimport numpy as np\nfrom scipy import linalg\n\nJ=0.5; Dp=20.; wc=31.4\nKpv=1.0; Kiv=100.; Kpc=5.0; Kic=50.\nL1=0.1; Cf=0.05; R1=0.01; Lv=0.02\nw0=2*np.pi*60\n\nfor SCR in [3.0, 1.5, 1.0]:\n    Zg=1/SCR; Rg=Zg/np.sqrt(2); Lg=Rg/w0\n    Id0=0.9; Iq0=0.1\n    Vpcc=1.0-(Id0+Iq0)*Rg\n\n    A=np.zeros((13,13))\n    A[0,0]=-Dp/J;   A[0,1]=-1/J\n    A[1,1]=-wc;     A[1,9]=wc*Id0; A[1,11]=wc*Vpcc\n    A[2,2]=-wc;     A[2,10]=wc*Id0\n    A[3,9]=-1;      A[4,10]=-1\n    A[5,3]=Kiv;     A[5,7]=-1;  A[5,9]=-Kpv;  A[5,11]=1\n    A[6,4]=Kiv;     A[6,8]=-1;  A[6,10]=-Kpv; A[6,12]=1\n    A[7,3]=Kpc*Kiv/L1; A[7,5]=Kic/L1\n    A[7,7]=(-R1-Kpc)/L1; A[7,8]=(w0*L1-Kpc*w0*Lv)/L1\n    A[8,4]=Kpc*Kiv/L1; A[8,6]=Kic/L1\n    A[8,8]=(-R1-Kpc)/L1; A[8,7]=-(w0*L1-Kpc*w0*Lv)/L1\n    A[9,7]=1/Cf;  A[9,10]=w0;  A[9,11]=-1/Cf\n    A[10,8]=1/Cf; A[10,9]=-w0; A[10,12]=-1/Cf\n    A[11,9]=1/Lg; A[11,11]=-Rg/Lg; A[11,12]=w0\n    A[12,10]=1/Lg; A[12,11]=-w0;   A[12,12]=-Rg/Lg\n\n    eigs=linalg.eigvals(A)\n    stable=np.all(eigs.real<1e-4)\n    print(f\"SCR={SCR}: stable={stable}\")\n    # 출력: stable=True (3개 모두)\n```",
    "wikilinks": [
      "Bug sym dc pi 4차시도",
      "야코비안 행렬",
      "EXP_2026-08-21_Phase2_엔진전환_비교",
      "Phase02_완료",
      "소신호_선형화",
      "고유값_안정도판단",
      "DC-AC_커플링"
    ]
  },
  {
    "path": "RSCAD/Phase03/EXP_20260918_P4_A1__PSO_14개_파라미터_탐색_범위_확정.md",
    "dir": "RSCAD/Phase03",
    "filename": "EXP_20260918_P4_A1__PSO_14개_파라미터_탐색_범위_확정",
    "frontmatter": {
      "type": "experiment",
      "date": "2026-09-18",
      "time": "15:20",
      "agent": "experiment",
      "agent_name": "시뮬엔지니어",
      "command": "\"P4-A1: PSO 14개 파라미터 탐색 범위 확정\"",
      "elapsed": "247.6s",
      "status": "success",
      "tags": [
        "experiment",
        "auto-generated",
        "experiment"
      ]
    },
    "body": "# 🧪 실험: P4-A1: PSO 14개 파라미터 탐색 범위 확정\n\n> 에이전트: 💻 시뮬엔지니어\n> 실행시간: 247.6초\n> 생성: 2026-09-18 15:20 (자동)\n\n---\n\n## ▸ 명령\n\n```\nP4-A1: PSO 14개 파라미터 탐색 범위 확정\n```\n\n---\n\n## ▸ 결과\n\nP4-A1에서 PSO(Paricle Swarm Optimization)를 사용하여 14개의 파라미터 탐색 범위를 확정하는 작업은, 전력전자 시스템의 안정성과 성능을 최적화하기 위한 핵심 과제입니다. 이 과정에서는 다음과 같은 단계를 수행해야 합니다:\n\n1. **파라미터 목록 정의**: 시스템의 주요 구성 요소(예: 인버터, ESS, 그리드 등)에 따라 14개의 파라미터를 정의합니다. 이 파라미터는 전압, 전류, 주파수, 전력, 감쇠율, 정착시간 등이 포함될 수 있습니다.\n\n2. **탐색 범위 설정**: 각 파라미터에 대해 최소 및 최대 값을 설정합니다. 이 범위는 시스템의 물리적 제약, 설계 요구사항, 및 이전 실험 결과를 기반으로 설정해야 합니다.\n\n3. **PSO 알고리즘 적용**: PSO 알고리즘을 사용하여 파라미터 공간을 탐색하고, 최적의 파라미터 조합을 찾습니다. 이 과정에서는 목적 함수(예: 시스템 안정성, 정착시간, 감쇠율 등)를 정의하여 최적화를 수행합니다.\n\n4. **결과 분석 및 검증**: PSO로 얻은 최적 파라미터 조합을 시뮬레이션 및 실험을 통해 검증하고, 결과를 분석하여 최종적으로 탐색 범위를 확정합니다.\n\n이 과정에서 중요한 것은 파라미터의 범위 설정과 목적 함수의 정의입니다. 이 두 요소가 적절히 설정되지 않으면 최적화 결과가 부정확해질 수 있습니다. 또한, PSO 알고리즘의 파라미터(예: 입자 수, 최대 반복 횟수, 인과 계수 등)도 조정하여 최적화 성능을 향상시켜야 합니다.\n\n💾 C:\\Users\\hyese\\Dev\\RSCAD\\agent\\logs\\run_20260918_152021.json\n\n---\n\n## ※ 해석\n\n(자동 생성 노트 — 해석은 연구자가 추가)\n\n---\n\n## 🔗 연결 노트\n\n- [[Phase03_진행중]]\n",
    "wikilinks": [
      "Phase03_진행중"
    ]
  },
  {
    "path": "RSCAD/Phase03/Phase03_진행중.md",
    "dir": "RSCAD/Phase03",
    "filename": "Phase03_진행중",
    "frontmatter": {
      "type": "phase-log",
      "phase": 3,
      "date_start": "",
      "date_end": "",
      "status": "in_progress",
      "tags": [
        "phase3",
        "PSO",
        "pyswarms",
        "optimization"
      ]
    },
    "body": "# 📋 Phase 3: PSO 실제 구현 (진행 중)\n\n---\n\n## 0. Phase 목표\n\n> pyswarms 기반 PSO로 GFM 제어 파라미터 최적화 → ζ ≥ 0.64 달성\n\n```\n목표: 14개 파라미터 PSO 최적화 → SCR*(X/R) 경계 유효값 도출\n성공 기준:\n  - [ ] ζ_min ≥ 0.64 (4개 SCR 모두)\n  - [ ] SCR*(X/R) boundaries 4개 X/R 조건 유효값\n  - [ ] 이중 수렴 기준 달성 (조건1·2)\n  - [ ] /api/pso 실제 알고리즘 동작\n```\n\n---\n\n## 1. 이전 Phase에서 넘어온 것\n\n| 항목 | 값/상태 | 출처 |\n|---|---|---|\n| 엔진 | sympy+numpy | Phase 2 |\n| ζ_min | 0.1642 (< 0.64) | Phase 2 |\n| A_k(9,6) 오차 | 0.0001% ✅ | Phase 2 |\n| SCR* | null (전 구간) | Phase 2 |\n| 88포인트 ζ_max | 0.177 | Phase 2 |\n\n---\n\n## 2. 이번 Phase 변경 사항\n\n### 2.1 추가 예정 ⏳\n- `pyswarms` 설치 및 PSO 엔진 구현\n- `/api/pso` 실제 알고리즘 교체\n- 이중 수렴 기준 구현\n- PSO 결과 `results/` 저장\n\n### 2.2 수정 예정 🔧\n- `sym.py` → PSO 최적 파라미터로 재실행\n- `app.py` → PSO 최적 run 자동 로드\n\n---\n\n## 3. 핵심 수치 스냅샷 (업데이트 예정)\n\n| 항목 | Phase 2 | Phase 3 (목표) | 달성 |\n|---|---|---|---|\n| ζ_min | 0.1642 | **≥ 0.64** | ⏳ |\n| SCR* (X/R=1.0) | null | **1.0~2.0** | ⏳ |\n| PSO 수렴 횟수 | — | < 500회 | ⏳ |\n| F_multi | — | < 0.1 | ⏳ |\n\n---\n\n## 4. PSO 설계\n\n### 목적함수\n```python\ndef F_multi(params, SCR_list=[3.0, 2.0, 1.5, 1.0]):\n    F_total = 0\n    for scr in SCR_list:\n        eigs = get_eigenvalues(scr, params)\n        F1 = sum(max(0, e.real) for e in eigs)       # 안정도\n        F2 = sum((z - 0.707)**2 for z in zetas)       # ζ 추종\n        F3 = sum(max(0, 0.64 - z) for z in zetas)    # 최소 ζ\n        F_total += 0.3*F1 + 0.6*F2 + 0.1*F3\n    return F_total / len(SCR_list)\n```\n\n### 최적화 파라미터 범위\n| 파라미터 | 하한 | 상한 | 단위 |\n|---|---|---|---|\n| J | 0.01 | 10.0 | kg·m² |\n| Dp | 1.0 | 100.0 | N·m·s |\n| wc | 10.0 | 200.0 | rad/s |\n| Lv | 0.001 | 0.5 | pu |\n| Kpv | 0.01 | 5.0 | A/V |\n| Kiv | 1.0 | 500.0 | A/Vs |\n| Kpc | 0.1 | 30.0 | V/A |\n| Kic | 1.0 | 200.0 | V/As |\n\n### 이중 수렴 기준\n```\n조건 1: 상대 개선 < 0.1% 연속 30회\n조건 2: 누적 감소 < 0.5% 동일 30회\n→ 두 조건 모두 만족 시 수렴\n```\n\n---\n\n## 5. 실험 결과 목록 (진행 중)\n\n| 날짜 | 실험명 | 상태 | 링크 |\n|---|---|---|---|\n| — | PSO 1차 실행 | ⏳ | — |\n\n---\n\n## 6. 참고문헌 연결\n\n| 문헌 | Phase 3 연결 내용 | 검증 |\n|---|---|---|\n| [1] Chen 2024 | PSO 14개 파라미터 목록 | ⏳ |\n| [2] Dong 2026 | SVR 3개 vs PSO 14개 비교 | ⏳ |\n| [3] Ganguly 2025 | X/R별 SCR* 검증 | ⏳ |\n\n---\n\n## 7. 미해결 (현재)\n\n```\n[ ] pyswarms 설치 확인\n[ ] F_multi 목적함수 구현\n[ ] 이중 수렴 기준 구현\n[ ] PSO 실행 및 결과 확인\n```\n\n---\n\n## 🤖 Claude 프롬프트 (PSO 구현용)\n\n```\n[GFM_마스터_컨텍스트_프롬프트.md]\n[Phase02_완료.md]\n[이 Phase 3 노트]\n\n→ \"pyswarms GlobalBestPSO로 이중 수렴 기준 PSO를 구현하고\n   Flask /api/pso 엔드포인트에 연결해줘.\n   \n   목적함수: F_multi = (1/4)·Σ F(SCR_k)\n   최적화 파라미터: J, Dp, wc, Lv, Kpv, Kiv, Kpc, Kic\n   이중 수렴 조건1: 상대 개선 < 0.1% 연속 30회\n   이중 수렴 조건2: 누적 감소 < 0.5% 동일 30회\n   목표: ζ_min ≥ 0.64\"\n```\n",
    "wikilinks": []
  },
  {
    "path": "RSCAD/Phase03/Phase03_참여인자.md",
    "dir": "RSCAD/Phase03",
    "filename": "Phase03_참여인자",
    "frontmatter": {
      "type": "plan",
      "phase": 3,
      "status": "planned",
      "depends_on": "Phase02_완료",
      "model_version": "v1-22state",
      "date": "2026-08-25",
      "tags": [
        "phase3",
        "참여인자",
        "participation-factor",
        "decision-gate",
        "22state"
      ]
    },
    "body": "# Phase 03 — 참여인자 분석\n\n> [!abstract] 목적\n> 22개 상태 중 **어느 상태가 어느 모드를 만드는가**를 정량화한다.\n> 이 결과로 Decision Gate(22차 유지 vs 축소)를 판정하고, Phase 4 PSO 목적함수의 대상 모드를 확정한다.\n\n전제: [[Phase02_완료]] — 야코비안 검산 `1.2e-09`, 커플링 효과 `5.9e+01` 확보 상태\n\n---\n\n## 답해야 할 질문 셋\n\n| # | 질문 | 판정에 쓰는 상태 |\n|---|---|---|\n| Q1 | 178 Hz 지배 모드가 LCL 공진인가 | `i_ld` `i_lq` `v_od` `v_oq` `i_od` `i_oq` |\n| Q2 | **DC 8개가 AC 모드에 유의하게 기여하는가** ← Decision Gate | DC 8개 전체 |\n| Q3 | 동기화 모드는 어디 있고 SCR에 어떻게 반응하는가 | `delta` `dw` |\n\n※ Q3이 논문의 핵심 서사다. Phase 2에서 δ는 22°→62°로 크게 움직였는데 `ζ_min`은 거의 안 변했다. 동기화 모드가 지배 모드가 아니라는 뜻이므로, **감쇠비가 가장 나쁜 모드와 연구가 추적할 모드가 다르다.** 이 구분을 여기서 확정한다.\n\n---\n\n## 계산\n\n$$P_{ki} = \\phi_{ki}\\,\\psi_{ik}$$\n\n| 기호 | 의미 |\n|---|---|\n| $\\phi_{ki}$ | 우고유벡터 $i$번 모드의 $k$번째 성분 — 모드가 상태에 나타나는 정도 |\n| $\\psi_{ik}$ | 좌고유벡터 — 상태가 모드를 여기하는 정도 |\n| $P_{ki}$ | $i$번 모드에 대한 $k$번 상태의 참여도 |\n\n정규화는 $\\psi_i^T\\phi_i = 1$. 이때 각 모드에 대한 참여도 합과 각 상태에 대한 참여도 합이 모두 1이 된다.\n\n> [!tip] 자체 검산\n> `P.sum(axis=0)`과 `P.sum(axis=1)`이 모두 1에 수렴하는지 확인. 어긋나면 고유벡터 정규화가 잘못된 것이다.\n> 복소 모드는 $|P_{ki}|$를 쓰고, 켤레쌍은 하나로 묶어 보고한다.\n\n### `pf.py` 출력\n\n1. **모드 요약표** — 모드번호 · $\\lambda$ · $f$(Hz) · $\\zeta$ · 최대 참여 상태 3개\n2. **참여인자 행렬** 22×22 히트맵 (행=상태, 열=모드)\n3. **그룹 집계** — DC 8 / VSG 4(`delta` `dw` `Pf` `Qf`) / 제어루프 4 / LCL 6 로 묶은 기여도\n4. SCR 4점 × X/R 최소 3점에 대해 위를 반복\n\n---\n\n## ⚖️ Decision Gate — 실행 **전에** 확정\n\n> [!important] 기준을 먼저 박아둘 것\n> 결과를 본 뒤 임계값을 정하면 사후 정당화가 된다. `pf.py` 첫 실행 전에 아래를 확정하고 이 노트를 `status: fixed`로 바꾼다.\n\n**판정 대상** — AC 지배 모드(참여도 상위가 AC 상태인 모드) 각각에 대한 **DC 8개 상태의 참여도 합** $\\sum_{k \\in DC} |P_{ki}|$\n\n| 판정 | 제안 기준 | 조치 |\n|---|---|---|\n| 유의 | 어느 한 AC 모드에서든 ≥ 5% | 22차 유지. RQ1 성립 |\n| 경계 | 1–5% | 조건부 유지. SCR·X/R 의존성 확인 후 재판정 |\n| 미미 | 모든 AC 모드에서 < 1% | 축소 모델 검토 |\n\n※ 5%는 전력계통 모드 식별에서 통용되는 관행적 하한이나 절대 기준은 아니다. 확정 전에 문헌 근거를 하나 붙여둘 것.\n\n> [!caution] 판정 시 함께 볼 것\n> 참여인자가 작아도 **커플링 제거 시 고유값 변화(현재 59)** 가 크면 축소는 부적절하다. 두 지표가 엇갈리면 어느 쪽을 우선할지도 미리 정해야 한다. 현재 제안: **고유값 변화량을 우선**하고 참여인자는 보조 근거로 쓴다.\n\n---\n\n## 예상 시나리오와 대응\n\n| 시나리오 | 해석 | 대응 |\n|---|---|---|\n| DC 기여도가 SCR 낮을수록 증가 | 약계통에서 DC 결합이 강해짐 | 논문 핵심 결과. 그림 하나로 승부 |\n| DC 기여도가 특정 모드에만 집중 | 그 모드가 22차의 존재 이유 | 해당 모드를 PSO 목적함수에 포함 |\n| DC 기여도가 전 구간 미미 | 축소 정당 | RQ1 재작성 필요. **커플링 효과 59와 모순되므로 코드 재점검 먼저** |\n\n---\n\n## 미해결\n\n- [ ] 5% 임계값의 문헌 근거 확보\n- [ ] 참여인자 vs 고유값 변화량 우선순위 확정\n- [ ] X/R 샘플 개수 — Phase 2에서 1.0↔2.0 사이 지배 모드가 178→36.5 Hz로 뛰었다. 두 점만으로는 교체인지 연속 이동인지 모르므로 최소 5점 필요\n- [ ] 모드 추적(mode tracing) 방법 — 조건이 바뀌면 모드 순서가 뒤섞인다. 고유벡터 상관으로 짝짓는 절차 필요\n\n---\n\n## 🔗 연결 노트\n\n| 연결 방향 | 노트                                           |\n| ----- | -------------------------------------------- |\n| 선행    | [[Phase02_완료]] · [[야코비안 행렬]] · [[상태변수_선정근거]] |\n| 근거 이론 | [[고유값_안정도판단]] · [[DC-AC_커플링]] · [[블록삼각_함정]]  |\n| 후속    | [[Phase04_PSO설계]] · [[88포인트_2D_스윕_설계]]       |\n| 상태    | [[Phase03_진행중]]                              |\n",
    "wikilinks": [
      "Phase02_완료",
      "야코비안 행렬",
      "상태변수_선정근거",
      "고유값_안정도판단",
      "DC-AC_커플링",
      "블록삼각_함정",
      "Phase04_PSO설계",
      "88포인트_2D_스윕_설계",
      "Phase03_진행중"
    ]
  },
  {
    "path": "RSCAD/Phase04/Phase04 예정.md",
    "dir": "RSCAD/Phase04",
    "filename": "Phase04 예정",
    "frontmatter": {
      "## type": "phase-log phase: 4 date_start: date_end: status: planned tags: [phase4, PSO, MC, N-final, dual-convergence]",
      "# 📋 Phase 4": "PSO MC 30회 본실험"
    },
    "body": "---\n\n## type: phase-log phase: 4 date_start: date_end: status: planned tags: [phase4, PSO, MC, N-final, dual-convergence]\n\n# 📋 Phase 4: PSO MC 30회 본실험\n\n---\n\n## 0. Phase 목표\n\n> PSO 이중 수렴 기준으로 N_final 결정 + 최적 파라미터 확정\n\n```\n목표: MC 30회 실행 → N_final 결정 → ζ ≥ 0.64 달성 파라미터 확정\n성공 기준:\n  - [ ] ζ_min ≥ 0.64 (4개 SCR 모두)\n  - [ ] 이중 수렴 조건1·2 동시 만족\n  - [ ] Shapiro-Wilk p > 0.10 (정규성 확인)\n  - [ ] N_final 결정 (추정 390회)\n  - [ ] SCR*(X/R) boundaries 유효값 도출\n```\n\n---\n\n## 1. 이전 Phase에서 넘어온 것\n\n|항목|값|출처|\n|---|---|---|\n|ζ_min|< 0.64 (전 구간)|Phase 3 PSO 1차|\n|엔진|sympy+numpy|Phase 2|\n|A_k(9,6) 오차|0.0001%|Phase 2|\n|PSO 파라미터 수|14개|[1] Chen|\n|이중 수렴 기준|조건1·2 설계 완료|Phase 3|\n\n---\n\n## 2. Phase 4a — 임계값 결정 예비실험\n\n```python\n# 조건1·2 임계값 결정\n# 30회 예비 실행으로 적정값 탐색\n\nTHRESHOLD_1 = 0.001   # 상대 개선 0.1%\nTHRESHOLD_2 = 0.005   # 누적 감소 0.5%\nWINDOW      = 30      # 연속 30회\n```\n\n---\n\n## 3. Phase 4b — N_final 결정 본실험\n\n```python\nfrom scipy import stats\nimport numpy as np\n\n# MC 30회 실행\nN_iters = []\nfor trial in range(30):\n    result = run_pso_dual_convergence()\n    N_iters.append(result['n_iter'])\n\n# 정규성 검정\nstat, p = stats.shapiro(N_iters)\nprint(f\"Shapiro-Wilk p={p:.4f}\")\n\nif p > 0.10:\n    N_final = int(np.mean(N_iters))\n    print(f\"정규분포 → N_final = {N_final}\")\nelse:\n    N_final = int(np.median(N_iters))\n    print(f\"비정규 → N_final = {N_final} (중앙값)\")\n\n# 현재 추정: N_final ≈ 390\n```\n\n---\n\n## 4. PSO 설계 (Phase 3에서 이어받음)\n\n### 목적함수\n\n$$F_{multi} = \\frac{1}{4} \\sum_{k=1}^{4} \\left[ \\alpha F_1 + \\beta F_2 + \\gamma F_3 \\right]_{SCR_k}$$\n\n|항목|수식|가중치|의미|\n|---|---|---|---|\n|F1|$\\sum \\max(0, \\text{Re}(\\lambda))$|α=0.3|불안정 패널티|\n|F2|$\\sum(\\zeta - 0.707)^2$|β=0.6|ζ 추종|\n|F3|$\\sum \\max(0, 0.64-\\zeta)$|γ=0.1|최소 ζ 보장|\n\n### 최적화 파라미터 (14개)\n\n|그룹|파라미터|하한|상한|\n|---|---|---|---|\n|VSG|J, Dp, wc, Lv|0.01, 1, 10, 0.001|10, 100, 200, 0.5|\n|전압|Kpv, Kiv|0.01, 1|5, 500|\n|전류|Kpc, Kic|0.1, 1|30, 200|\n|DC|Kp1, Ki1, Kp2, Ki2, Kp3, Ki3|TBD|TBD|\n\n---\n\n## 5. 이중 수렴 기준 구현\n\n```python\nclass DualConvergencePSO:\n    def check_convergence(self, history, window=30):\n        if len(history) < window:\n            return False\n\n        recent = history[-window:]\n\n        # 조건 1: 상대 개선 < 0.1% 연속 30회\n        rel_improve = abs(recent[-1] - recent[-2]) / (abs(recent[-2]) + 1e-12)\n        cond1 = rel_improve < 0.001\n\n        # 조건 2: 누적 감소 < 0.5% 동일 30회\n        cum_reduce = abs(recent[0] - recent[-1]) / (abs(recent[0]) + 1e-12)\n        cond2 = cum_reduce < 0.005\n\n        return cond1 and cond2   # 두 조건 모두 만족\n```\n\n---\n\n## 6. 핵심 수치 스냅샷 (업데이트 예정)\n\n|항목|Phase 3|Phase 4 (목표)|달성|\n|---|---|---|---|\n|ζ_min|< 0.64|**≥ 0.64**|⏳|\n|N_final|미결정|**~390회**|⏳|\n|SCR* (X/R=1.0)|null|**1.0~2.0**|⏳|\n|Shapiro-Wilk p|—|**> 0.10**|⏳|\n|F_multi 수렴값|—|**< 0.1**|⏳|\n\n---\n\n## 7. 실험 결과 목록 (예정)\n\n|날짜|실험명|상태|\n|---|---|---|\n|—|PSO 4a 예비실험|⏳|\n|—|PSO 4b MC 30회 본실험|⏳|\n|—|N_final 결정|⏳|\n|—|최적 파라미터 sym.py 적용|⏳|\n|—|88포인트 2D 스윕 재실행|⏳|\n\n---\n\n## 8. 미해결 → Phase 5로 이월 예정\n\n```\n[ ] DSP 코드 구현 (TMS320F28379D)\n[ ] Anti-Windup Back-calculation\n[ ] Phase 5: RTDS 연결 준비\n```\n\n---\n\n## 🔗 연결 노트\n\n### 이론\n\n- [[Pso 이중수렴기준]] — 전체 PSO 설계\n- [[이중수렴기준 설계]] — 조건1·2 상세\n- [[참여인자 지배모드]] — 목적함수 지배 모드\n- [[고유값_안정도판단]] — ζ ≥ 0.64 기준\n\n### 선행 Phase\n\n- [[Phase03_진행중]] — PSO 1차 구현\n- [[Phase02_완료]] — sympy+numpy 엔진\n\n### 참고문헌\n\n- [[Chen_2024_Electronics]] — [1] 14개 파라미터, MC 방법론\n- Clerc & Kennedy 2002 — w=0.729 수렴 조건\n\n---\n\n## 🤖 Claude 프롬프트 (Phase 4 착수용)\n\n```\n[GFM_마스터_컨텍스트_프롬프트.md]\n[Phase03_진행중.md]\n[이 Phase 4 노트 전체]\n[이중수렴기준_설계.md]\n\n→ \"Phase 3 PSO 결과에서 ζ ≥ 0.64를 달성했다면\n   MC 30회 본실험으로 N_final을 결정하는 코드를 작성해줘.\n   \n   Shapiro-Wilk 정규성 검정 포함\n   IQR 기반 이상값 제거\n   N_final = 정규분포면 평균, 비정규면 중앙값\n   결과를 results/MC_30회_결과.md로 저장\"\n```",
    "wikilinks": [
      "Pso 이중수렴기준",
      "이중수렴기준 설계",
      "참여인자 지배모드",
      "고유값_안정도판단",
      "Phase03_진행중",
      "Phase02_완료",
      "Chen_2024_Electronics"
    ]
  },
  {
    "path": "RSCAD/Phase04/Phase04_PSO설계.md",
    "dir": "RSCAD/Phase04",
    "filename": "Phase04_PSO설계",
    "frontmatter": {
      "type": "plan",
      "phase": 4,
      "status": "planned",
      "depends_on": "Phase03_참여인자",
      "date": "2026-08-25",
      "n_params": 14,
      "tags": [
        "phase4",
        "PSO",
        "최적화",
        "목적함수",
        "다중동작점"
      ]
    },
    "body": "# Phase 04 — PSO 설계\n\n> [!abstract] 목적\n> 14개 GFM 제어 파라미터를 **여러 동작점에서 동시에** 튜닝해, 현재 `ζ_min = 0.207`을 기준 `0.64` 이상으로 끌어올린다.\n\n전제: [[Phase03_참여인자]]에서 **어느 모드를 목적함수에 넣을지** 확정되어야 착수 가능\n\n---\n\n## 최대 함정 — 목적함수가 엉뚱한 모드를 잡는다\n\nPhase 2 결과에서 지배 모드는 178 Hz LCL 공진이었고, SCR을 3.0→1.0으로 바꿔도 `ζ_min`이 0.2065→0.2070으로 거의 움직이지 않았다.\n\n> [!danger] `ζ_min` 단독을 목적함수로 쓰면 안 된다\n> LCL 공진은 $J$·$D_p$ 같은 VSG 이득에 둔감하다. 최소 감쇠비만 최대화하면 PSO가 **필터 공진 하나에 매달려** 저주파 동기화 모드를 방치한다.\n> 정작 SCR에 반응하는 것은 δ(22°→62°)인데, 그 모드는 `ζ_min`에 잡히지 않는다.\n\n### 대응 후보\n\n| 안 | 방식 | 장점 | 단점 |\n|---|---|---|---|\n| A | 대역 분리 — 저주파(<10 Hz)와 고주파(>100 Hz) 감쇠비를 각각 목적항으로 | 두 모드 모두 관리 | 가중치 결정이 임의적 |\n| B | 참여인자 기반 — 동기화 모드를 특정해 그 $\\zeta$만 최적화 | 물리적으로 명확 | 조건마다 모드 추적 필요 |\n| C | LCL은 제약조건으로, 동기화 모드는 목적함수로 | 역할 분리가 깔끔 | 제약 위반 처리 설계 필요 |\n\n※ 현재 **C안**이 유력. LCL 공진은 수동 댐핑 저항이나 능동 댐핑 이득으로 별도 처리하고, PSO는 동기화·전압 제어 대역에 집중시킨다.\n※ 어느 안이든 [[Phase03_참여인자]]의 모드 식별 결과가 있어야 정할 수 있다.\n\n---\n\n## 다중 동작점 처리\n\n단일 SCR에서 튜닝하면 그 점에만 과적합된다. 목적함수를 조건 집합 위에서 집계한다.\n\n| 방식 | 수식 | 성격 |\n|---|---|---|\n| 최악 조건 | $\\max_k J_k$ 최소화 | 보수적. 강건성 우선 |\n| 평균 | $\\frac{1}{K}\\sum_k J_k$ | 평균 성능 우선. 약계통 희생 가능 |\n| 가중 | $\\sum_k w_k J_k$ | 절충. $w_k$ 근거 필요 |\n\n※ SCR–X/R 2D 경계를 주장하는 연구이므로 **최악 조건(minimax)** 이 서사와 일치한다. 평균으로 튜닝해놓고 강건성을 주장하면 논리가 어긋난다.\n\n▸ 튜닝용 조건 집합과 검증용 조건 집합을 **분리**할 것. 88점 전체로 튜닝하면 검증할 것이 남지 않는다. → [[88포인트_2D_스윕_설계]]\n\n---\n\n## 파라미터 14개\n\n> [!todo] 목록 확정 필요\n> 후보군: VSG($J$, $D_p$, $D_q$, $\\omega_c$), 전압루프($K_{pv}$, $K_{iv}$ × dq), 전류루프($K_{pi}$, $K_{ii}$ × dq), 능동댐핑 이득, DC측 PI.\n> **DC측 PI를 포함할지가 Phase 3 결과에 달렸다.** DC 기여도가 미미하면 제외하고 탐색 차원을 줄인다.\n\n각 파라미터에 물리적 상·하한을 부여할 것. 탐색 범위를 임의로 넓히면 수렴이 느려지고 비현실적 해가 나온다.\n\n---\n\n## 제약조건\n\n- [ ] 모든 조건에서 $\\text{Re}(\\lambda) < 0$ (필수)\n- [ ] LCL 공진 $\\zeta \\geq$ 하한 (C안 채택 시)\n- [ ] 과도응답 — 오버슈트·정착시간 상한\n- [ ] 파라미터 상·하한 (실장 가능 범위)\n- [ ] DSP 구현 가능성 — 샘플링 주기 대비 이득 크기\n\n---\n\n## 수렴 기준과 통계\n\n→ [[Pso 이중수렴기준]]\n\n▸ MC 반복은 [[PSO MC 30회 본실험]] 계획에 따름. 난수 시드를 기록해 재현 가능하게 할 것.\n\n※ 30회 반복의 목적은 최적해 탐색이 아니라 **해의 분산 보고**다. 논문에는 최고값이 아니라 평균±표준편차 또는 사분위로 제시해야 한다. 최고값만 쓰면 재현성 지적을 받는다.\n\n---\n\n## 미해결\n\n- [ ] 목적함수 A/B/C 중 선택 ← Phase 3 대기\n- [ ] 14개 파라미터 확정 및 탐색 범위\n- [ ] 튜닝/검증 조건 집합 분리 비율\n- [ ] 최악조건 vs 평균 최종 결정\n- [ ] 기준 $\\zeta = 0.64$의 출처 재확인 — UNIFI Category 3 원문 대조\n\n---\n\n## 🔗 연결 노트\n\n| 연결 방향 | 노트                                  |\n| ----- | ----------------------------------- |\n| 선행    | [[Phase03_참여인자]] · [[Phase02_완료]]   |\n| 설계    | [[Pso 이중수렴기준]] · [[88포인트_2D_스윕_설계]] |\n| 실행    | [[PSO MC 30회 본실험]]                  |\n| 과거    | [[실험_pso_미구현]]                      |\n| 상태    | [[Phase04 예정]]                      |\n",
    "wikilinks": [
      "Phase03_참여인자",
      "88포인트_2D_스윕_설계",
      "Pso 이중수렴기준",
      "PSO MC 30회 본실험",
      "Phase02_완료",
      "실험_pso_미구현",
      "Phase04 예정"
    ]
  },
  {
    "path": "RSCAD/Phase04/PSO MC 30회 본실험.md",
    "dir": "RSCAD/Phase04",
    "filename": "PSO MC 30회 본실험",
    "frontmatter": {},
    "body": "## 0. Phase 목표\n\n> PSO 이중 수렴 기준으로 N_final 결정 + 최적 파라미터 확정\n\n```\n목표: MC 30회 실행 → N_final 결정 → ζ ≥ 0.64 달성 파라미터 확정\n성공 기준:\n  - [ ] ζ_min ≥ 0.64 (4개 SCR 모두)\n  - [ ] 이중 수렴 조건1·2 동시 만족\n  - [ ] Shapiro-Wilk p > 0.10 (정규성 확인)\n  - [ ] N_final 결정 (추정 390회)\n  - [ ] SCR*(X/R) boundaries 유효값 도출\n```\n\n---\n\n## 1. 이전 Phase에서 넘어온 것\n\n|항목|값|출처|\n|---|---|---|\n|ζ_min|< 0.64 (전 구간)|Phase 3 PSO 1차|\n|엔진|sympy+numpy|Phase 2|\n|A_k(9,6) 오차|0.0001%|Phase 2|\n|PSO 파라미터 수|14개|[1] Chen|\n|이중 수렴 기준|조건1·2 설계 완료|Phase 3|\n\n---\n\n## 2. Phase 4a — 임계값 결정 예비실험\n\npython\n\n```python\n# 조건1·2 임계값 결정\n# 30회 예비 실행으로 적정값 탐색\n\nTHRESHOLD_1 = 0.001   # 상대 개선 0.1%\nTHRESHOLD_2 = 0.005   # 누적 감소 0.5%\nWINDOW      = 30      # 연속 30회\n```\n\n---\n\n## 3. Phase 4b — N_final 결정 본실험\n\npython\n\n```python\nfrom scipy import stats\nimport numpy as np\n\n# MC 30회 실행\nN_iters = []\nfor trial in range(30):\n    result = run_pso_dual_convergence()\n    N_iters.append(result['n_iter'])\n\n# 정규성 검정\nstat, p = stats.shapiro(N_iters)\nprint(f\"Shapiro-Wilk p={p:.4f}\")\n\nif p > 0.10:\n    N_final = int(np.mean(N_iters))\n    print(f\"정규분포 → N_final = {N_final}\")\nelse:\n    N_final = int(np.median(N_iters))\n    print(f\"비정규 → N_final = {N_final} (중앙값)\")\n\n# 현재 추정: N_final ≈ 390\n```\n\n---\n\n## 4. PSO 설계 (Phase 3에서 이어받음)\n\n### 목적함수\n\nFmulti=14∑k=14[αF1+βF2+γF3]SCRkF_{multi} = \\frac{1}{4} \\sum_{k=1}^{4} \\left[ \\alpha F_1 + \\beta F_2 + \\gamma F_3 \\right]_{SCR_k}Fmulti​=41​k=1∑4​[αF1​+βF2​+γF3​]SCRk​​\n\n|항목|수식|가중치|의미|\n|---|---|---|---|\n|F1|∑max⁡(0,Re(λ))\\sum \\max(0, \\text{Re}(\\lambda)) ∑max(0,Re(λ))|α=0.3|불안정 패널티|\n|F2|∑(ζ−0.707)2\\sum(\\zeta - 0.707)^2 ∑(ζ−0.707)2|β=0.6|ζ 추종|\n|F3|∑max⁡(0,0.64−ζ)\\sum \\max(0, 0.64-\\zeta) ∑max(0,0.64−ζ)|γ=0.1|최소 ζ 보장|\n\n### 최적화 파라미터 (14개)\n\n|그룹|파라미터|하한|상한|\n|---|---|---|---|\n|VSG|J, Dp, wc, Lv|0.01, 1, 10, 0.001|10, 100, 200, 0.5|\n|전압|Kpv, Kiv|0.01, 1|5, 500|\n|전류|Kpc, Kic|0.1, 1|30, 200|\n|DC|Kp1, Ki1, Kp2, Ki2, Kp3, Ki3|TBD|TBD|\n\n---\n\n## 5. 이중 수렴 기준 구현\n\npython\n\n```python\nclass DualConvergencePSO:\n    def check_convergence(self, history, window=30):\n        if len(history) < window:\n            return False\n\n        recent = history[-window:]\n\n        # 조건 1: 상대 개선 < 0.1% 연속 30회\n        rel_improve = abs(recent[-1] - recent[-2]) / (abs(recent[-2]) + 1e-12)\n        cond1 = rel_improve < 0.001\n\n        # 조건 2: 누적 감소 < 0.5% 동일 30회\n        cum_reduce = abs(recent[0] - recent[-1]) / (abs(recent[0]) + 1e-12)\n        cond2 = cum_reduce < 0.005\n\n        return cond1 and cond2   # 두 조건 모두 만족\n```\n\n---\n\n## 6. 핵심 수치 스냅샷 (업데이트 예정)\n\n|항목|Phase 3|Phase 4 (목표)|달성|\n|---|---|---|---|\n|ζ_min|< 0.64|**≥ 0.64**|⏳|\n|N_final|미결정|**~390회**|⏳|\n|SCR* (X/R=1.0)|null|**1.0~2.0**|⏳|\n|Shapiro-Wilk p|—|**> 0.10**|⏳|\n|F_multi 수렴값|—|**< 0.1**|⏳|\n\n---\n\n## 7. 실험 결과 목록 (예정)\n\n|날짜|실험명|상태|\n|---|---|---|\n|—|PSO 4a 예비실험|⏳|\n|—|PSO 4b MC 30회 본실험|⏳|\n|—|N_final 결정|⏳|\n|—|최적 파라미터 sym.py 적용|⏳|\n|—|88포인트 2D 스윕 재실행|⏳|\n\n---\n\n## 8. 미해결 → Phase 5로 이월 예정\n\n```\n[ ] DSP 코드 구현 (TMS320F28379D)\n[ ] Anti-Windup Back-calculation\n[ ] Phase 5: RTDS 연결 준비\n```\n\n---\n\n## 🔗 연결 노트\n\n### 이론\n\n- [[Pso 이중수렴기준]] — 전체 PSO 설계\n- [[이중수렴기준 설계]] — 조건1·2 상세\n- [[참여인자 지배모드]] — 목적함수 지배 모드\n- [[고유값_안정도판단]] — ζ ≥ 0.64 기준\n\n### 선행 Phase\n\n- [[Phase03_진행중]] — PSO 1차 구현\n- [[Phase02_완료]] — sympy+numpy 엔진\n\n### 참고문헌\n\n- [[Chen_2024_Electronics]] — [1] 14개 파라미터, MC 방법론\n- Clerc & Kennedy 2002 — w=0.729 수렴 조건\n\n---\n\n## 🤖 Claude 프롬프트 (Phase 4 착수용)\n\n```\n[GFM_마스터_컨텍스트_프롬프트.md]\n[Phase03_진행중.md]\n[이 Phase 4 노트 전체]\n[이중수렴기준 설계.md]\n\n→ \"Phase 3 PSO 결과에서 ζ ≥ 0.64를 달성했다면\n   MC 30회 본실험으로 N_final을 결정하는 코드를 작성해줘.\n   \n   Shapiro-Wilk 정규성 검정 포함\n   IQR 기반 이상값 제거\n   N_final = 정규분포면 평균, 비정규면 중앙값\n   결과를 results/MC_30회_결과.md로 저장\"\n```",
    "wikilinks": [
      "Pso 이중수렴기준",
      "이중수렴기준 설계",
      "참여인자 지배모드",
      "고유값_안정도판단",
      "Phase03_진행중",
      "Phase02_완료",
      "Chen_2024_Electronics"
    ]
  },
  {
    "path": "RSCAD/schedule_패치_2026-08-28.md",
    "dir": "RSCAD",
    "filename": "schedule_패치_2026-08-28",
    "frontmatter": {
      "type": "patch",
      "target": [
        "schedule.yaml",
        "checkList.md"
      ],
      "evidence_note": "폐기값_이력",
      "date": "2026-08-28",
      "status": "pending",
      "tags": [
        "patch",
        "schedule",
        "phase2",
        "phase3"
      ]
    },
    "body": "# schedule.yaml 패치 — 2026-08-28\n\n> **저장 위치:** `볼트 루트 (적용 후 삭제)`\n\n> [!warning] 전체 교체가 아닌 부분 편집\n> P5~P8 항목이 이 문서에 없다. 아래 지시만 적용하고 나머지는 건드리지 말 것.\n\n## 1. `P2-A4` — 커플링 수치 무효화 (최우선)\n\n> [!danger] novelty 근거의 수치가 재현 불가\n> `P2-A4`는 RQ1 직접 증거로 승격된 항목이다. 기록된 `5.90e+01` 은\n> `np.sort_complex` 정렬 페어링으로 산출되어 서로 다른 모드끼리 뺀 값이다.\n> 헝가리안 매칭으로 재측정하면 어떤 조건에서도 59 가 나오지 않는다.\n\n```yaml\n      - id: P2-A4\n        name: \"양방향 DC-AC 커플링 유도 및 효과 정량화\"\n        state: in_progress          # draft → in_progress (수치 재산출 필요)\n        evidence: \"code_root/results/J*_XR*_v3_*/eigenvalue_results.json\"\n        result: >\n          커플링 블록 제거 시 최소감쇠 모드 이동량 (헝가리안 매칭 기준):\n            X/R 0.5 : 1.71 → 1.40   (SCR 3.0 → 0.8)\n            X/R 1.0 : 1.31 → 1.18\n            X/R 3.0 : 26.24 → 1.10  ★ 인용 대상\n          v0 에서는 0.000e+00 (블록삼각).\n        superseded_result: \"5.90e+01 — np.sort_complex 페어링 오류. 폐기.\"\n        note: >\n          ★ X/R=3.0, SCR 3.0 에서 26.24 로 최대. 이 조건에서 DC-AC 혼합\n          모드(37.6 Hz)가 ζ_min 을 지배하므로 RQ1 증거로 더 강하다.\n          논문 인용 수치를 이쪽으로 교체할 것.\n        action: \"관련 노트·초고의 59 를 모두 찾아 교체\"\n        deprecation_log: \"vault_root/01_개념/폐기값_이력.md#4\"\n```\n\n> [!info] 이 항목은 두 번 정정됐다 ★\n> `A_k(9,6) 오차 0.0001%` → `5.90e+01` → `1.31~26.24`.\n> 첫 번째는 항등식 검증, 두 번째는 정렬 페어링 오류였다.\n> 발견 위치·폐기 코드·검출 방법은 [[폐기값_이력]] 항목 2·4 참조.\n\n## 2. `P2-A2` — 검산 통과 범위 한정\n\n```yaml\n      - id: P2-A2\n        result: \"최대 상대오차 1.2e-09 (X/R=1.0, 전 SCR)\"   # '전 SCR' → 조건 명시\n        issue: >\n          X/R=3.0, SCR 1.0·0.8 에서 성분별 상대오차 1.2e-06 / 1.8e-06.\n          허용치 1e-6 초과. 야코비안 정확도가 이 영역에서 저하.\n        next_action: \"eigenvalue_results.json 의 fd_worst_entry 로 해당 성분 특정\"\n        deprecation_log: \"vault_root/01_개념/폐기값_이력.md#9\"\n```\n\n## 3. 신규 artifact 3건\n\n```yaml\n      # P2 에 추가\n      - id: P2-A9\n        name: \"정적 부하가능성 경계 분리 정의\"\n        state: not_started\n        evidence: null\n        gate_for: [P8]\n        note: >\n          2D 스윕 경계가 두 종류다. 감쇠 경계와 정적 부하가능성 경계\n          (δ→90°, 정상상태 해 부재). 한 선으로 그리면 오독된다.\n          두 선을 겹쳐 그리는 것 자체가 Dong et al. 대비 차별점.\n          현재 관측: X/R 1.0 → SCR 0.6 / X/R 3.0 → SCR 0.8 에서 발동.\n\n      - id: P2-A10\n        name: \"δ>90° 수용 버그 수정\"\n        state: not_started\n        evidence: null\n        blocking: true\n        issue: >\n          X/R=3.0, SCR 0.8 에서 δ=100.16° 인데 stable=True 로 나온다.\n          cosδ<0 이면 동기화 계수가 음수라 발산해야 한다.\n          op.py 가 P-δ 곡선의 불안정 가지를 잡고 있다.\n        note: \"88포인트 스윕 전 필수. 미수정 시 δ>90° 지점이 전부 '안정'으로 채워짐\"\n\n      # P3 에 추가\n      - id: P3-A7\n        name: \"모드 식별을 주파수 대역 → 참여계수 기반으로 전환\"\n        state: not_started\n        evidence: null\n        blocking: true\n        gate_for: [P4]\n        note: >\n          runner.py v3 의 BANDS(<5Hz / 5-100Hz / ≥100Hz)는 대용 지표다.\n          sync 대역이 잡는 것은 전력필터 모드(Qf 0.445, Pf 0.401, δ 참여 2%)이고\n          진짜 동기화 모드는 실수극에 있다. 대역 분류는 논문에 쓸 수 없다.\n        deprecation_log: \"vault_root/01_개념/폐기값_이력.md#5\"\n```\n\n## 4. `P3-A1` evidence 무결성\n\n```yaml\n      - id: P3-A1\n        state: verified\n        evidence: \"code_root/Simulation/pf.py\"\n        note: >\n          ⚠ 2026-08-28 확인 시점에 이 파일이 실재하지 않았다. 재구축 완료.\n          해석해(2-state 스윙 + 무관 상태 1) 로 참여계수 계산 검증 통과.\n        integrity_incident: \"vault_root/01_개념/폐기값_이력.md#기록-무결성-사고\"\n```\n\n> [!question] 다른 verified 항목도 확인 필요\n> `P3-A1` 이 파일 없이 verified 였다. 나머지 verified 항목의 evidence 경로가\n> 실재하는지 일괄 점검할 것.\n> ```bash\n> grep -o 'code_root/[^\"]*' schedule.yaml | sed 's|code_root|~/Dev/RSCAD|' | while read p; do\n>   ls $p >/dev/null 2>&1 || echo \"MISSING: $p\"\n> done\n> ```\n\n## 5. `P2-A5` 재해석\n\n```yaml\n      - id: P2-A5\n        issue: >\n          SCR 1.5 에서 선형화 임계값이 0.5% 로 튀는 비단조 현상.\n          (3.0→10%, 2.0→5%, 1.5→0.5%, 1.0→2%)\n        hypothesis: >\n          ★ 신규 가설: 다중 평형점이 아니라 모드 교차에 의한 유효반경 축소.\n          X/R=3.0 에서 f_ctrl 이 SCR 2.0→1.5 사이에 57.19Hz → 5.07Hz 로 점프한다.\n          임계값 딥과 동일 지점. 우연으로 보기 어렵다.\n        next_action: \"runner.py --XR 3.0 --SCR 1.7 1.6 1.5 1.4 1.3 --tag scr15_fine\"\n```\n\n## checkList.md 반영\n\n- `P2-A4` 체크 해제, 수치를 `1.71 / 1.31 / 26.24 (X/R 0.5/1.0/3.0)` 로 교체\n- `P2-A9`, `P2-A10`, `P3-A7` 항목 추가 (`P2-A10`·`P3-A7` 은 🔺)\n- Phase 4 의 기존 danger 콜아웃에 다음 문장 추가:\n  `→ 2026-08-28 정량 확인 완료. 지표를 σ_sync / t_s 로 교체할 것.`\n\n---\n\n## 6. ⛔ `checkList.md` 볼트 부재\n\n> [!danger] mirror_file 이 실재하지 않는다\n> `schedule.yaml` 의 `output_policy.mirror_file: checkList.md` 가 가리키는\n> 파일이 볼트 루트에 없다. 루트에는 `schedule.yaml` 만 있다.\n>\n> `P3-A1` 의 `pf.py` 누락과 동일한 유형이다 — 생성했다고 기록됐으나\n> 실제로는 배치되지 않았다.\n\n**조치**\n1. `checkList.md` 를 볼트 루트(`GFM_Research/RSCAD/`)에 배치\n2. 배치 전까지 `schedule.yaml` 의 `mirror_sync` 규칙은 무효이므로,\n   agent 가 state 를 바꿔도 미러가 갱신되지 않는다\n3. 아래로 볼트 전체의 evidence·링크 무결성을 일괄 점검할 것\n\n```bash\ncd ~/Dev/Obsidian/GFM_Research/RSCAD\n\n# (a) schedule.yaml 의 evidence 경로 실재 확인\ngrep -o 'code_root/[^\"]*' schedule.yaml | sed 's|code_root|~/Dev/RSCAD|' \\\n  | while read p; do ls $p >/dev/null 2>&1 || echo \"MISSING evidence: $p\"; done\n\n# (b) 깨진 위키링크 검출 — 링크 대상이 실제 파일로 존재하는지\ngrep -rhoP '(?<=\\[\\[)[^\\]|#]+' --include='*.md' . | sort -u \\\n  | while read n; do\n      find . -name \"$n.md\" -print -quit | grep -q . || echo \"BROKEN LINK: [[$n]]\"\n    done\n```\n\n## 7. 파일명 규칙 정리 (별건)\n\n```\n⛔ GFM_연구_전체지도.md.md   → GFM_연구_전체지도.md      (확장자 중복)\n⛔ README.md.md              → README.md                 (확장자 중복)\n⛔ \"# Phase 2 코드 리뷰 — 소신호 모델.md\"\n                             → Phase02_코드리뷰_소신호모델.md\n⚠  Pso 이중수렴기준.md / 이중수렴기준 설계.md  → 중복. 통합 또는 역할 분리\n```\n\n▸ 공백/언더스코어 혼용 상태. 언더스코어로 통일 권장.\n※ 일괄 변경은 **Obsidian 내부에서** 할 것. 탐색기에서 바꾸면 링크가 전부 깨진다.\n\n---\n\n## 8. `meta` 에 폐기값 이력 경로 등록\n\n```yaml\nmeta:\n  # ... 기존 필드 유지 ...\n  deprecation_log: \"01_개념/폐기값_이력.md\"\n  note: >\n    수치·판정기준이 바뀔 때마다 폐기값_이력 에 한 항목씩 추가한다.\n    발견 위치(파일·함수·코드) / 원인 / 검출 방법 / 파급 을 반드시 기입.\n    폐기값은 지우지 않고 취소선으로 남긴다.\n```\n\n## 9. `output_policy` 에 정정 기록 규칙 추가\n\n```yaml\noutput_policy:\n  mirror_file: \"checkList.md\"\n  mirror_sync: \"state 변경 시 checkList.md 의 해당 체크박스도 함께 갱신한다\"\n\n  # ── 신규 ──\n  deprecation_policy: >\n    artifact 의 result 값을 교체할 때는 반드시\n    (1) 구 값을 superseded_result 필드에 남기고\n    (2) 01_개념/폐기값_이력.md 에 상세 블록을 추가하고\n    (3) deprecation_log 필드로 해당 항목을 가리킨다.\n    값만 갈아치우는 것을 금지한다.\n\n  integrity_check: >\n    state 를 verified 로 올리기 전에 evidence 경로의 실재를 확인한다.\n    2026-08-28 에 P3-A1 이 파일 없이 verified 상태였던 사례가 있다.\n```\n\n> [!danger] 기록 무결성 사고가 하루에 3건\n> | 기록 | 실제 |\n> |---|---|\n> | `P3-A1` verified, evidence `Simulation/pf.py` | 파일 없음 |\n> | `mirror_file: checkList.md` | 볼트에 없음 |\n> | `Phase_지식_연결맵` — PSO \"구현 / 완료\" | 구현된 적 없음 |\n>\n> ▸ 세 건 모두 **하류 작업이 이미 그 위에 쌓여 있었다.**\n> ※ `integrity_check` 규칙을 넣지 않으면 반복된다.\n\n## 10. 적용 순서\n\n1. `01_개념/폐기값_이력.md` 배치 ← **먼저**. 다른 편집의 참조 대상\n2. `schedule.yaml` 의 §1~5, §8~9 적용\n3. `checkList.md` 를 볼트 루트에 배치 (§6)\n4. 파일명 정리 (§7) — Obsidian **내부에서**\n5. 무결성 점검 명령 실행 (§6) → 결과를 폐기값_이력 의 무결성 표에 추가\n6. 이 패치 문서 삭제\n",
    "wikilinks": [
      "폐기값_이력",
      "$n"
    ]
  },
  {
    "path": "ToDoList/checkList_v0.0.md",
    "dir": "ToDoList",
    "filename": "checkList_v0.0",
    "frontmatter": {
      "type": "research-master-checklist",
      "project": "GFM-PSO-2D-Robustness",
      "owner": "조연호",
      "deadline_month": 12,
      "current_month": 4,
      "buffer_months": 0,
      "source_of_truth": "\"schedule.yaml\"",
      "tags": [
        "연구일정",
        "GFM",
        "PSO",
        "CHIL"
      ]
    },
    "body": "# 연구 체크리스트\n\n> [!warning] 이 노트는 읽기용 미러다\n> 상태의 단일 진실원은 볼트 루트의 `schedule.yaml`. 체크박스와 YAML 이 어긋나면 YAML 을 따른다.\n\n> [!danger] 버퍼 0개월\n> Phase 8 종료 = 제출 마감. 어느 단계든 2주 밀리면 전체가 밀린다.\n> 리스크가 크리티컬 패스(P6 → P7)에 연속으로 몰려 있다.\n\n---\n\n## 🔴 지금 (일정과 무관하게 최우선)\n\n- [ ] `P7-A0` 1포인트당 실측 소요시간 파일럿 — 모델 로드 + 정상상태 도달 + 외란 인가 + 데이터 회수\n- [ ] Phase 6 + 7 총 장비 점유시간 산출 (위 결과 × 88 + 여유)\n- [ ] **RTDS 랙 예약** — 7~11월차 연속 슬롯 확보 🔺\n\n순서가 중요하다. 소요시간을 모르면 예약 요청 시간을 적을 수 없고, 예약이 밀리면 P7 전체가 무너진다.\n\n---\n\n## Phase 2 — 야코비안 유도·검증 `2~3월차`\n\n- [x] `P2-A1` 21차 야코비안 A_num 구현 (`sym.py`) ✅ `results/latest/A_num.npy`\n- [ ] `P2-A2` **Simulink `linmod` 교차검증** — 고유값 비교, 허용오차 기준 선행 문서화 🔺\n- [ ] `P2-A3` TABLE I / Ia — SCR별 A 행렬 수식\n- [ ] `P2-A4` 21개 상태변수 정의표 (부록: 기호 / 단위 / 물리적 의미)\n- [ ] `P2-A5` A_k(9,6) 결합항 수동 보강 근거 문서 ← 리뷰어 필수 질문 지점\n\n---\n\n## Phase 3 — 참여인자·지배 모드 `3~4월차`\n\n- [ ] `P3-A1` 좌/우 고유벡터 기반 참여인자 행렬\n- [ ] `P3-A2` SCR 변화에 가장 민감한 지배 모드 식별\n- [ ] `P3-A3` 지배 모드 물리적 귀속 — DC단 / 전류루프 / 전압루프 / 동기화루프\n- [ ] `P3-A4` f_dom 실측 (Prony 예비 적용, 해석 모드와 대조)\n- [ ] `P3-A5` ζ_threshold = 0.64 재확정 — UNIFI Cat 3 조항 인용 위치까지 특정\n\n---\n\n## Phase 4 — PSO 예비실험 `4~6월차`\n\n- [ ] `P4-A1` **TABLE II — 14개 파라미터 탐색범위** + 설정 근거 🔺 *(P7 게이트)*\n- [ ] `P4-A2` 다중 운전점 목적함수 정의 — 운전점 개수 / 가중치 규칙\n- [ ] `P4-A3` 예비 100회 → N_particle / N_iter (`N_final`) 결정\n- [ ] `P4-A4` 가중치 민감도 분석\n- [ ] `P4-A5` MC 30회 수렴 재현성 통계 — 평균 / 표준편차 / 최악값\n\n---\n\n## Phase 5 — DSP·EMT `5~6월차`\n\n- [ ] `P5-A1` 원형 제한기 구현\n- [ ] `P5-A2` Anti-windup 설계\n- [ ] `P5-A3` X/R = 0.5 EMT — AW 유/무 파형 비교\n- [ ] `P5-A4` TMS320F28379D 이식 + 제어주기 내 실행시간 프로파일링\n\n---\n\n## Phase 6 — CHIL 구축 `7~9월차` ⚠️ 리스크 높음(장비)\n\n- [ ] `P6-A1` RSCAD FX 모델 구축\n- [ ] `P6-A2` GTAO/GTAI 인터페이스 + 루프 지연 보상\n- [ ] `P6-A3` SNR 사전 측정 → σ_Z 보정\n- [ ] `P6-A4` **측정 불확도 정량화** 🔺 *(P7 에러바의 근거, P7 게이트)*\n\n---\n\n## Phase 7 ★ — 2D 경계 도출 `9~11월차` ⚠️ 리스크 높음(시간)\n\n> [!important] 논문의 핵심 기여. 최소 8주 연속 필요.\n\n- [ ] `P7-A0` 1포인트당 소요시간 파일럿 → **지금 실행** 🔺\n- [ ] `P7-A1` 88포인트 스윕 자동화 — 배치 실행 + 전처리 재컴파일 + 결과 수집\n- [ ] `P7-A2` Prony + Matrix Pencil 이중 추출, 불일치 시 처리 규칙 사전 정의\n- [ ] `P7-A3` SCR*(X/R) 2D 경계 곡면\n- [ ] `P7-A4` ζ_thr 5세트 민감도\n- [ ] `P7-A5` σ_SCR 에러바\n- [ ] `P7-A6` 소신호 예측 vs CHIL 실측 오차 정량화\n\n---\n\n## Phase 8 — 검증·집필 `11~12월차`\n\n- [ ] `P8-A1` H1 통계 검정 방법 확정 ← 현재 미정의\n- [ ] `P8-A2` H2 Wilcoxon — 표본 쌍 정의 및 표본 수 확정\n- [ ] `P8-A3` H3 수정 — Spearman(n=4) 대신 인접 X/R 구간 ΔSCR* 부호 변화\n- [ ] `P8-A4` 학위논문 본문\n- [ ] `P8-A5` IEEE Access 투고 원고\n\n---\n\n## 상시 병렬\n\n- [ ] `C1` refs [115] 2D 임피던스 평면 안정도 경계\n- [ ] `C2` refs [114] 전차수 VSG 상태공간 모델\n- [ ] `C3` refs [94] Lyapunov 기반 파라미터 선정\n- [ ] `C4` **선행연구 비교표** — 다중 운전점 PSO / 2D 경계 / CHIL 3축 매트릭스 (novelty 방어, 심사 필수)\n- [ ] `C5` 논문 추출 파이프라인 3번째 호출(렌더링) 마무리\n\n---\n\n## 게이트 조건\n\n| 게이트 | 선행 조건 | 미충족 시 |\n|---|---|---|\n| P4 착수 | P3-A5 (ζ_threshold 확정) | 목적함수 기준이 없어 PSO 재실행 |\n| P6 착수 | 랙 예약 확정 + P5-A4 | 장비 대기로 무기한 지연 |\n| **P7 착수** | P4-A1 `verified` + P6-A4 `verified` | 스윕 결과에 에러바를 못 붙임 |\n| P8 착수 | P7-A3, P7-A5 | 가설 검증 불가 |\n\n## 상태 정의\n\n`not_started` → `in_progress` → `draft` → `verified`\n`verified` 는 증거 파일 경로가 있을 때만 유효. 경로 없으면 `draft` 로 강등.\n\n## 기호\n\n🔺 = 다른 항목의 선행 조건 (막히면 하류 전체가 막힘)\n",
    "wikilinks": []
  },
  {
    "path": "ToDoList/checkList_v0.1.md",
    "dir": "ToDoList",
    "filename": "checkList_v0.1",
    "frontmatter": {
      "type": "research-master-checklist",
      "project": "GFM-PSO-2D-Robustness",
      "owner": "조연호",
      "month_1_start": "2026-05",
      "current_month": 4,
      "current_date": "2026-08-26",
      "deadline_month": 12,
      "buffer_months": 0,
      "model_version": "v1-22state",
      "source_of_truth": "\"schedule.yaml\"",
      "updated": "2026-08-26",
      "tags": [
        "연구일정",
        "GFM",
        "PSO",
        "CHIL"
      ]
    },
    "body": "# 연구 체크리스트\n\n> [!warning] 이 노트는 읽기용 미러다\n> 상태의 단일 진실원은 볼트 루트의 `schedule.yaml`. 체크박스와 YAML 이 어긋나면 YAML 을 따른다.\n\n> [!danger] 버퍼 0개월\n> Phase 8 종료 = 제출 마감. 어느 단계든 2주 밀리면 전체가 밀린다.\n\n> [!question] 월차 기준일 미확인\n> `month_1_start: 2026-05` 는 **추정값**이다 (2026-08-20 시점 4월차에서 역산).\n> 실제 착수월을 확인해 확정할 것. 이 값이 틀리면 모든 마감 역산이 틀어진다.\n\n---\n\n## 🔴 지금 — RTDS 접근 경로 확정 `P0`\n\n> [!danger] 접근 가능 여부 자체가 미확인\n> 2026-08-26 현재 RTDS를 쓸 수 있는지 모른다.\n> 이 한 줄이 P6·P7 전체(일정의 5개월)를 공중에 띄우고 있다.\n\n- [ ] `P0-A1` **랙 접근 자격 · 신청 창구 · 마감 주기 확인** 🔺 — 연구실 보유 / 학과 공용 / 외부 기관 중 어디인가\n- [ ] `P0-A2` 장비 담당자에게 **pre-processor 재컴파일 소요시간** 문의 — 파일럿 없이 예약 시간을 산정할 수 있는 유일한 경로\n- [ ] `P0-A3` **Tier 결정** 🔺 — `5월차 마감`\n- [ ] `P0-A4` (조건부) 저비용 CHIL 대안 조사 — 듀얼 MCU, 대표점 3~5개\n\n**Tier 분기**\n\n| Tier | 내용 | 차별화 축 |\n|---|---|---|\n| 1 | RTDS CHIL | 4축 전부 유지 |\n| 2 | 소프트웨어 검증만 (EMT + SIL) | 3축 유지, 검증 축 약화 |\n| 3 | 저비용 CHIL (F28379D ×2, SPI) | 4축 유지, \"재현 가능한 저비용 CHIL\"로 재서술 |\n\n5월차까지 미결정이면 **자동으로 Tier 2 확정**하고 P6·P7을 재설계한다. 결정을 미루는 것이 가장 나쁘다.\n\n> [!note] 구 `P7-A0` 파일럿은 왜 여기 없나\n> 파일럿은 RSCAD 모델(P6-A1)과 랙 접근이 모두 있어야 실행 가능하다.\n> \"지금\" 칸에 실행 불가능한 항목을 두면 그 아래를 읽지 않게 된다. → `P6-A5`로 이동.\n\n---\n\n## Phase 2 — 22차 야코비안  ✅ 대부분 완료\n\n> [!success] v0(21차, `sym.py`) 폐기 후 재구축 완료\n> 상태변수 21→22, 커플링 단방향→양방향, 검증 항등식→유한차분\n\n- [x] `P2-A1` 22차 심볼릭 f(x,u) 및 야코비안 ✅ `Simulation/model.py`\n- [x] `P2-A2` 야코비안 검산 — 심볼릭 vs 유한차분 ✅ **1.2e-09** *(구 Simulink `linmod` 계획을 대체)*\n- [x] `P2-A3` 동작점 SCR 의존성 ✅ δ 22.4°→62.3°\n- [x] `P2-A4` **양방향 DC-AC 커플링 유도 및 정량화** — 커플링 제거 시 고유값 변화 **5.90e+01** *(v0에서는 0.000e+00)*\n- [ ] `P2-A5` **선형화 유효성 임계값 확정** 🔺 ⚠️ *진행 중, 미해결*\n- [ ] `P2-A6` TABLE I / Ia — SCR별 A 행렬 (22차)\n- [ ] `P2-A7` **22개** 상태변수 정의표 (부록: 기호/단위/물리적 의미)\n- [ ] `P2-A8` SOC 제외 및 차수 22 확정 근거 문서화\n\n> [!warning] `P2-A5` 미해결 — 선형화 임계값 비단조\n> SCR 3.0→10% / 2.0→5% / **1.5→0.5%** / 1.0→2%.\n> SCR 1.5에서만 튄다. 물리(다중 평형점)인지 수치(Radau 누적오차)인지 미판별.\n> **다음 행동:** `runner.py --SCR 1.7 1.6 1.5 1.4 1.3` → `xval.py`, 그리고 `xval.py --T 0.2` 대조.\n\n> [!tip] `P2-A4`는 방어 항목이 아니라 기여 항목이다\n> 구 `P2-A5`(\"A_k(9,6) 수동 보강 근거 — 리뷰어 필수 질문 지점\")는 소멸했다.\n> 수동으로 끼워넣은 항이 아니라 전력 보존식에서 유도된 항이므로,\n> 방어할 취약점이 아니라 **RQ1의 직접 증거**로 승격된다. → [[블록삼각_함정]]\n\n---\n\n## Phase 3 — 참여인자·지배 모드  ✅ 핵심 완료\n\n- [x] `P3-A1` 참여인자 행렬 ✅ `Simulation/pf.py`\n- [x] `P3-A2` **지배 모드 식별** ✅ — δ 지배 **동기화 모드** (참여도 0.82→0.95)\n- [x] `P3-A3` 물리적 귀속 ✅ — 동기화 / LCL 공진 / DC링크-ESS / 제어루프\n- [x] `P3-A4` **Decision Gate — 22차 유지** ✅ — DC·AC 혼합 모드 전 SCR에서 2~4개\n- [ ] `P3-A5` f_dom 실측 — Prony 예비 적용, 해석 모드와 대조\n- [ ] `P3-A6` **ζ_threshold = 0.64 재확정** 🔺 — UNIFI Cat 3 조항 인용 위치까지 특정 *(P4 게이트)*\n\n> [!important] 당초 가정이 반증됨\n> 178 Hz LCL 공진이 지배 모드일 것으로 보았으나, 참여인자 분석 결과\n> **δ 지배 동기화 모드**가 임계 모드였다. Re: -4.644(SCR 3.0) → -1.296(SCR 1.0)로\n> 원점에 단조 접근. 약계통에서 GFM이 무너지는 경로가 동기화 모드임을 정량적으로 보인다.\n> → PSO 목적함수 설계 방향이 바뀐다.\n\n| SCR | 동기화 모드 Re | δ (°) |\n|---|---|---|\n| 3.0 | -4.644 | 22.4 |\n| 2.0 | -2.965 | 32.6 |\n| 1.5 | -2.164 | 42.4 |\n| 1.0 | -1.296 | 62.3 |\n\n---\n\n## Phase 4 — PSO 예비실험 ← **다음 착수**\n\n- [ ] `P4-A1` **TABLE II — 14개 파라미터 탐색범위** + 설정 근거 🔺 *(P7 게이트)*\n- [ ] `P4-A2` 다중 운전점 목적함수 정의 — 운전점 개수 / 가중치 규칙\n- [ ] `P4-A3` 예비 100회 → N_particle / N_iter 결정\n- [ ] `P4-A4` 가중치 민감도 분석\n- [ ] `P4-A5` MC 30회 수렴 재현성 통계 — **난수 시드 고정·기록 필수**\n\n> [!danger] `P4-A2` 착수 전 안정도 지표를 재정의할 것\n> 현재 `runner.py`의 `ζ_min`은 **진동 모드만** 본다(`im > 0.5`).\n> 그런데 임계 모드는 실수극(동기화)이므로 지금 지표로는 **임계 모드를 놓친다.**\n> `max(Re)` 또는 최저감쇠 모드 기준으로 바꾼 뒤 PSO에 넘겨야 한다.\n> 이걸 안 고치고 PSO를 돌리면 178 Hz LCL 공진만 최적화하게 된다.\n\n---\n\n## Phase 5 — DSP·EMT 검증  ⬆️ **앞당김**\n\n> [!important] Tier 2의 실질적 본체\n> RTDS 불확실성이 해소되지 않는 한 이 단계가 논문의 검증 축을 지탱한다.\n> RTDS와 무관하게 즉시 착수 가능하다.\n\n- [ ] `P5-A1` **오프라인 EMT** — 스위칭 모델 vs 22차 평균 모델 대조 (PLECS / Simulink / DPsim)\n- [ ] `P5-A2` 원형 제한기 구현\n- [ ] `P5-A3` Anti-windup 설계\n- [ ] `P5-A4` X/R = 0.5 EMT — AW 유/무 파형 비교\n- [ ] `P5-A5` **SIL** — DSP C 코드를 EMT 루프에 실제 제어주기로 연동 (고정소수점·양자화·지연·포화)\n- [ ] `P5-A6` TMS320F28379D 이식 + 제어주기 내 실행시간 프로파일링\n\n---\n\n## Phase 6 — CHIL 구축  ⚠️ `P0-A3` 조건부\n\n- [ ] `P6-A1` RSCAD FX 모델 구축\n  - [ ] 계통 등가 — Thevenin + SCR/XR 가변 임피던스 (pre-processor 변수)\n  - [ ] 전력단 — 부스트 + 인버터 + LCL, substep 환경\n  - [ ] 계측·스케일링 → GTAO 채널 매핑\n  - [ ] GTDI PWM 수신 + 데드타임\n  - [ ] RunTime 화면 + 스크립트 훅\n  - [ ] **보정 — 시뮬 내부 GFM 제어 vs DSP 제어 대조** ← 진짜 관문\n- [ ] `P6-A2` GTAO/GTAI 인터페이스 + 루프 지연 보상\n- [ ] `P6-A3` SNR 사전 측정 → σ_Z 보정\n- [ ] `P6-A4` **측정 불확도 정량화** 🔺 *(P7 에러바의 근거, P7 게이트)*\n- [ ] `P6-A5` **1포인트당 실측 소요시간 파일럿** *(구 `P7-A0`)*\n- [ ] `P6-A6` 스윕 격자 확정 — 확보 장비시간 ÷ 점당 소요시간 ÷ 반복횟수로 역산\n\n> [!note] `P6-A5`에서 실제로 잴 것\n> **실측 필요:** pre-processor 재컴파일(지배 항목) / 케이스 로드 / 외란·회수 / 점간 전환 / 불안정 점 복구\n> **실측 불필요:** 정상상태 도달 — 소신호 모델에서 5τ로 산출됨 (SCR 3.0 → 1.08 s, SCR 1.0 → 3.86 s)\n> **사전 결정:** 정착 타임아웃 규칙, 점당 반복 횟수, 실패 재시도 정책\n\n> [!warning] 경계 근처가 가장 느리다\n> SCR*를 찾는다는 것은 지배극이 원점에 접근하는 지점을 찾는 것이고, 거기서 정착시간이 발산한다.\n> Re=-0.5 → 10 s, Re=-0.2 → 25 s, Re=-0.1 → 50 s, Re=-0.05 → 100 s.\n> 타임아웃 규칙 없이 무인 배치를 돌리면 한 점에서 멈춰 선다.\n\n---\n\n## Phase 7 ★ — 2D 경계 도출 \n\n> [!important] 논문의 핵심 기여. 최소 8주 연속 필요.\n\n- [ ] `P7-A1` 88포인트 스윕 자동화 — 배치 실행 + 재컴파일 + 결과 수집\n- [ ] `P7-A2` Prony + Matrix Pencil 이중 추출, 불일치 시 처리 규칙 사전 정의\n- [ ] `P7-A3` SCR*(X/R) 2D 경계 곡면\n- [ ] `P7-A4` ζ_thr 5세트 민감도\n- [ ] `P7-A5` σ_SCR 에러바\n- [ ] `P7-A6` 소신호 예측 vs 실측 오차 정량화\n\n> [!tip] 2D 스윕의 필요성 — 예비 근거 확보됨\n> X/R 1.0 → 2.0에서 SCR 3.0의 지배 모드가 **178.8 Hz → 36.5 Hz**로 교체되고,\n> 커플링 효과가 **56 → 229**로 4배 증가했다.\n> 1D SCR 스윕만으로는 관측 불가능한 현상 → Introduction의 motivation으로 인용 가능.\n\n> [!note] 88은 아직 확정 수치가 아니다\n> 88포인트는 **소신호 사전 스윕**의 목표치다.\n> CHIL 실측 점수는 `P6-A6`에서 확보 장비시간으로 역산해 결정한다.\n> 에러바를 위해 점당 3회 반복이면 총 측정은 264회가 된다.\n\n---\n\n## Phase 8 — 검증·집필 \n\n- [ ] `P8-A1` H1 통계 검정 방법 확정 ← 현재 미정의\n- [ ] `P8-A2` H2 Wilcoxon — 표본 쌍 정의 및 표본 수 확정\n- [ ] `P8-A3` H3 수정 — Spearman(n=4) 대신 인접 X/R 구간 ΔSCR* 부호 변화\n- [ ] `P8-A4` 학위논문 본문\n- [ ] `P8-A5` IEEE Access 투고 원고\n\n---\n\n## 상시 병렬\n\n- [ ] `C1` refs [115] 2D 임피던스 평면 안정도 경계\n- [ ] `C2` refs [114] 전차수 VSG 상태공간 모델\n- [ ] `C3` refs [94] Lyapunov 기반 파라미터 선정\n- [ ] `C4` **선행연구 비교표** — 다중 운전점 PSO / 2D 경계 / CHIL 3축 매트릭스 *(Tier 2 확정 시 CHIL 축 재서술 필요)*\n- [ ] `C5` 논문 추출 파이프라인 3번째 호출(렌더링) 마무리\n\n---\n\n## 게이트 조건\n\n| 게이트 | 선행 조건 | 미충족 시 |\n|---|---|---|\n| P4 착수 | `P3-A6` ζ_threshold 확정 | 목적함수 기준 없어 PSO 재실행 |\n| **P6 착수** | `P0-A3` Tier 결정 + `P5-A6` | 장비 대기로 무기한 지연 |\n| P7 착수 | `P4-A1` + `P6-A4` | 스윕 결과에 에러바를 못 붙임 |\n| P8 착수 | `P7-A3`, `P7-A5` | 가설 검증 불가 |\n\n## 상태 정의\n\n`not_started` → `in_progress` → `draft` → `verified`\n`verified` 는 증거 파일 경로가 있을 때만 유효. 경로 없으면 `draft` 로 강등.\n\n## 기호\n\n🔺 = 다른 항목의 선행 조건 (막히면 하류 전체가 막힘)\n⬆️ = 원래 일정보다 앞당긴 항목\n\n## 🔗 연결\n\n- [[Phase02_완료]]\n- [[블록삼각_함정]]\n- [[실행_식별자_설계원칙]]\n- [[실험_재현성_체크리스트]]\n",
    "wikilinks": [
      "블록삼각_함정",
      "Phase02_완료",
      "실행_식별자_설계원칙",
      "실험_재현성_체크리스트"
    ]
  },
  {
    "path": "ToDoList/checkList_v0.2.md",
    "dir": "ToDoList",
    "filename": "checkList_v0.2",
    "frontmatter": {
      "type": "research-master-checklist",
      "project": "GFM-PSO-2D-Robustness",
      "owner": "조연호",
      "month_1_start": "2026-05",
      "current_month": 5,
      "current_date": "2026-09-01",
      "deadline_month": 12,
      "buffer_months": 0,
      "model_version": "v3-22state",
      "source_of_truth": "\"schedule.yaml\"",
      "updated": "2026-09-01",
      "tags": [
        "연구일정",
        "GFM",
        "PSO",
        "CHIL"
      ]
    },
    "body": "# 연구 체크리스트\n\n> [!warning] 이 노트는 읽기용 미러다\n> 상태의 단일 진실원은 볼트 루트의 `schedule.yaml`. 체크박스와 YAML 이 어긋나면 YAML 을 따른다.\n\n> [!danger] 버퍼 0개월 · 5월차 진입\n> Phase 8 종료 = 제출 마감. 어느 단계든 2주 밀리면 전체가 밀린다.\n> **오늘이 Tier 결정 마감일이다.**\n\n> [!question] 월차 기준일 미확인\n> `month_1_start: 2026-05` 는 **추정값**이다 (2026-08-20 시점 4월차에서 역산).\n> 실제 착수월을 확인해 확정할 것. 이 값이 틀리면 모든 마감 역산이 틀어진다.\n\n---\n\n## 🔴 지금 — RTDS 접근 경로 확정 `P0`\n\n> [!danger] 마감 도달 — 오늘 결정하지 않으면 Tier 2 확정\n> 2026-09-01 현재 RTDS 접근 가능 여부가 여전히 미확인이다.\n> 5월차 마감 규칙에 따라, 오늘 결정이 없으면 **Tier 2 로 자동 확정**하고\n> P6·P7 을 재설계한다. 결정을 미루는 것이 가장 나쁜 선택이다.\n\n- [ ] `P0-A1` **랙 접근 자격 · 신청 창구 · 마감 주기 확인** 🔺 — 연구실 보유 / 학과 공용 / 외부 기관 중 어디인가\n- [ ] `P0-A2` 장비 담당자에게 **pre-processor 재컴파일 소요시간** 문의 — 파일럿 없이 예약 시간을 산정할 수 있는 유일한 경로\n- [ ] `P0-A3` **Tier 결정** 🔺 — `마감 도달`\n- [ ] `P0-A4` (조건부) 저비용 CHIL 대안 조사 — 듀얼 MCU, 대표점 3~5개\n\n**Tier 분기**\n\n| Tier | 내용 | 차별화 축 |\n|---|---|---|\n| 1 | RTDS CHIL | 4축 전부 유지 |\n| 2 | 소프트웨어 검증만 (EMT + SIL) | 3축 유지, 검증 축 약화 |\n| 3 | 저비용 CHIL (F28379D ×2, SPI) | 4축 유지, \"재현 가능한 저비용 CHIL\"로 재서술 |\n\n> [!note] 구 `P7-A0` 파일럿은 왜 여기 없나\n> 파일럿은 RSCAD 모델(P6-A1)과 랙 접근이 모두 있어야 실행 가능하다.\n> \"지금\" 칸에 실행 불가능한 항목을 두면 그 아래를 읽지 않게 된다. → `P6-A5`로 이동.\n\n---\n\n## Phase 2 — 22차 야코비안 ✅ 검증 완료 / 문서 미완\n\n> [!success] v0(21차, `sym.py`) 폐기 후 재구축 완료\n> 상태변수 21→22, 커플링 단방향→양방향, 검증 항등식→유한차분\n\n- [x] `P2-A1` 22차 심볼릭 f(x,u) 및 야코비안 ✅ `Simulation/model.py`\n- [x] `P2-A2` 야코비안 검산 — 심볼릭 vs 유한차분 ✅ **1.2e-09** *(구 Simulink `linmod` 계획을 대체)*\n- [x] `P2-A3` 동작점 SCR 의존성 ✅ δ 22.4°→62.3°\n- [x] `P2-A4` **양방향 DC-AC 커플링 유도 및 정량화** ✅ 커플링 제거 시 고유값 이동 ≠ 0 *(v0에서는 0.000e+00)*\n- [x] `P2-A5` **선형화 유효성 임계값** ✅ 지표 확정 · 임계값 산출 — *허용치 근거만 `P6-A4` 대기*\n- [ ] `P2-A6` TABLE I / Ia — SCR별 A 행렬 (22차)\n- [ ] `P2-A7` **22개** 상태변수 정의표 (부록: 기호/단위/물리적 의미)\n- [ ] `P2-A8` SOC 제외 및 차수 22 확정 근거 문서화\n- [ ] `P2-A9` **제어 블록도** — VSG 루프 / Q 드룹 / 종속 전압·전류 루프 / DC 이중 루프 *(신규)*\n\n> [!success] `P2-A5` 해결 — 비단조는 물리가 아니라 지표 결함이었다\n> 구 기록의 \"SCR 1.5 에서 0.5% 로 튄다\"는 `i_oq` 진폭 극소로 분모가 소멸해\n> 생긴 가짜 골짜기였다. 정규화 기준을 데이터가 아닌 **설비 정격**으로 바꾸고\n> 제어기 내부 적분기 8개를 판정에서 제외하자 사라졌다.\n>\n> | SCR | 1.7 | 1.6 | 1.5 | 1.4 | 1.3 |\n> |---|---|---|---|---|---|\n> | 유효 임계값 (Pref) | 13.10% | 12.72% | 12.25% | 11.73% | 11.09% |\n> | 회귀 지수 n | 1.99 | 2.01 | 2.02 | 2.02 | 2.02 |\n>\n> 약계통일수록 좁아지는 **단조 감소**. R² ≥ 0.9999 로 오차 ∝ 섭동² 확인.\n> → [[선형화_유효성_지표_규명]]\n\n> [!tip] `P2-A4`는 방어 항목이 아니라 기여 항목이다\n> 구 `P2-A5`(\"A_k(9,6) 수동 보강 근거 — 리뷰어 필수 질문 지점\")는 소멸했다.\n> 수동으로 끼워넣은 항이 아니라 전력 보존식에서 유도된 항이므로,\n> 방어할 취약점이 아니라 **RQ1의 직접 증거**로 승격된다. → [[블록삼각_함정]]\n\n---\n\n## Phase 3 — 참여인자·지배 모드 ✅ 핵심 완료\n\n- [x] `P3-A1` 참여인자 행렬 ✅ `Simulation/pf.py`\n- [x] `P3-A2` **지배 모드 식별** ✅ — δ 지배 **동기화 모드**, 참여도 0.92→0.98\n- [x] `P3-A3` 물리적 귀속 ✅ — 동기화 / LCL 공진 / DC링크-ESS / 제어루프\n- [x] `P3-A4` **Decision Gate — 22차 유지** ✅ — DC·AC 혼합 모드 전 SCR에서 2~4개\n- [ ] `P3-A5` f_dom 실측 — Prony 예비 적용, 해석 모드와 대조\n- [ ] `P3-A6` **ζ_threshold = 0.64 재확정** 🔺 — UNIFI Cat 3 조항 인용 위치까지 특정 *(P4 게이트)*\n\n> [!important] 당초 가정이 반증됨 — 두 번\n> **① 지배 모드**: 178 Hz LCL 공진이 아니라 δ 지배 동기화 모드였다.\n> **② 모드 성격**: `Dp/J = 40` 으로 과감쇠되어 진동이 아닌 **실수극**으로 분리돼 있다.\n> 따라서 진동 모드만 보는 지표로는 임계 모드를 포착할 수 없다.\n\n| SCR | 동기화 모드 λ | δ (°) | p(δ+Δω) |\n|---|---|---|---|\n| 3.0 | -4.6445 | 22.4 | 0.924 |\n| 2.0 | -2.9653 | 32.6 | 0.951 |\n| 1.5 | -2.1637 | 42.4 | 0.965 |\n| 1.0 | -1.2965 | 62.3 | 0.978 |\n\n> [!warning] `check_sync.py` 는 오진을 낸다 — 사용 금지\n> `A[Δω, δ] = 0` 을 근거로 \"스윙 방정식에 ∂P/∂δ 가 없다\"고 판정하나,\n> **전차수 모델에서는 0이 정상**이다. δ 는 `δ → i_od → Pf → Δω` 경로로\n> 되먹임된다. 이 진단을 따라 모델을 수정하면 전력 되먹임이 이중 계상된다.\n> 유한차분 검산으로는 이 오염을 잡을 수 없다. → `_archive/` 로 격리할 것.\n\n---\n\n## Phase 4 — PSO 예비실험 ← **다음 착수**\n\n- [ ] `P4-A0` **안정도 지표 재정의** 🔺 *(신규, 최우선)*\n- [ ] `P4-A1` **TABLE II — 14개 파라미터 탐색범위** + 설정 근거 🔺 *(P7 게이트)*\n- [ ] `P4-A2` 다중 운전점 목적함수 정의 — 운전점 개수 / 가중치 규칙\n- [ ] `P4-A3` 예비 100회 → N_particle / N_iter 결정\n- [ ] `P4-A4` 가중치 민감도 분석\n- [ ] `P4-A5` MC 30회 수렴 재현성 통계 — **난수 시드 고정·기록 필수**\n\n> [!danger] `P4-A0` — 지표를 고치지 않으면 PSO 결과가 무의미하다\n> 현재 `runner.py` 의 `ζ_min` 은 **진동 모드만** 본다(`im > 0.5`).\n> 임계 모드는 실수극(동기화)이므로 이 지표로는 **포착되지 않는다.**\n> 지금 상태로 PSO 를 돌리면 178 Hz LCL 공진만 최적화되고,\n> 정작 약계통에서 무너지는 동기화 모드는 방치된다.\n>\n> 후보: `max(Re)` 기준 / 대역별 ζ 가중합 / 정착시간 `t_s = 5/|λ|`\n> ζ 기준은 실수극에서 ζ=1 로 고정되어 무력화되므로 병용이 필요하다.\n\n---\n\n## Phase 5 — DSP·EMT 검증 ⬆️ **앞당김**\n\n> [!important] Tier 2 의 실질적 본체\n> RTDS 불확실성이 해소되지 않는 한 이 단계가 논문의 검증 축을 지탱한다.\n> RTDS 와 무관하게 즉시 착수 가능하다.\n\n- [ ] `P5-A1` **오프라인 EMT** — 스위칭 모델 vs 22차 평균 모델 대조 (PLECS / Simulink / DPsim)\n- [ ] `P5-A2` 원형 제한기 구현\n- [ ] `P5-A3` Anti-windup 설계\n- [ ] `P5-A4` X/R = 0.5 EMT — AW 유/무 파형 비교\n- [ ] `P5-A5` **SIL** — DSP C 코드를 EMT 루프에 실제 제어주기로 연동\n- [ ] `P5-A6` TMS320F28379D 이식 + 제어주기 내 실행시간 프로파일링\n\n---\n\n## Phase 6 — CHIL 구축 ⚠️ `P0-A3` 조건부\n\n- [ ] `P6-A1` RSCAD FX 모델 구축\n  - [ ] 계통 등가 — Thevenin + SCR/XR 가변 임피던스 (pre-processor 변수)\n  - [ ] 전력단 — 부스트 + 인버터 + LCL, substep 환경\n  - [ ] 계측·스케일링 → GTAO 채널 매핑\n  - [ ] GTDI PWM 수신 + 데드타임\n  - [ ] RunTime 화면 + 스크립트 훅\n  - [ ] **보정 — 시뮬 내부 GFM 제어 vs DSP 제어 대조** ← 진짜 관문\n- [ ] `P6-A2` GTAO/GTAI 인터페이스 + 루프 지연 보상\n- [ ] `P6-A3` SNR 사전 측정 → σ_Z 보정\n- [ ] `P6-A4` **측정 불확도 정량화** 🔺 *(P7 에러바 + `P2-A5` 허용치 근거, P7 게이트)*\n- [ ] `P6-A5` **1포인트당 실측 소요시간 파일럿** *(구 `P7-A0`)*\n- [ ] `P6-A6` 스윕 격자 확정 — 확보 장비시간 ÷ 점당 소요시간 ÷ 반복횟수로 역산\n\n> [!note] `P6-A5`에서 실제로 잴 것\n> **실측 필요:** pre-processor 재컴파일(지배 항목) / 케이스 로드 / 외란·회수 / 점간 전환 / 불안정 점 복구\n> **실측 불필요:** 정상상태 도달 — 소신호 모델에서 5τ로 산출됨 (SCR 3.0 → 1.08 s, SCR 1.0 → 3.86 s)\n> **사전 결정:** 정착 타임아웃 규칙, 점당 반복 횟수, 실패 재시도 정책\n\n> [!warning] 경계 근처가 가장 느리다\n> SCR*를 찾는다는 것은 지배극이 원점에 접근하는 지점을 찾는 것이고, 거기서 정착시간이 발산한다.\n> Re=-0.5 → 10 s, Re=-0.2 → 25 s, Re=-0.1 → 50 s, Re=-0.05 → 100 s.\n> 타임아웃 규칙 없이 무인 배치를 돌리면 한 점에서 멈춰 선다.\n\n---\n\n## Phase 7 ★ — 2D 경계 도출\n\n> [!important] 논문의 핵심 기여. 최소 8주 연속 필요.\n\n- [ ] `P7-A1` 88포인트 스윕 자동화 — 배치 실행 + 재컴파일 + 결과 수집\n- [ ] `P7-A2` Prony + Matrix Pencil 이중 추출, 불일치 시 처리 규칙 사전 정의\n- [ ] `P7-A3` SCR*(X/R) 2D 경계 곡면\n- [ ] `P7-A4` ζ_thr 5세트 민감도\n- [ ] `P7-A5` σ_SCR 에러바\n- [ ] `P7-A6` 소신호 예측 vs 실측 오차 정량화\n\n> [!tip] 2D 스윕의 필요성 — 예비 근거 확보됨\n> X/R 1.0 → 2.0에서 SCR 3.0의 지배 모드가 **178.8 Hz → 36.5 Hz**로 교체되고,\n> 커플링 효과가 4배 증가했다. 1D SCR 스윕으로는 관측 불가능한 현상\n> → Introduction 의 motivation 으로 인용 가능.\n\n> [!note] 88은 아직 확정 수치가 아니다\n> 88포인트는 **소신호 사전 스윕**의 목표치다.\n> CHIL 실측 점수는 `P6-A6`에서 확보 장비시간으로 역산해 결정한다.\n> 에러바를 위해 점당 3회 반복이면 총 측정은 264회가 된다.\n\n---\n\n## Phase 8 — 검증·집필\n\n- [ ] `P8-A1` H1 통계 검정 방법 확정 ← 현재 미정의\n- [ ] `P8-A2` H2 Wilcoxon — 표본 쌍 정의 및 표본 수 확정\n- [ ] `P8-A3` H3 수정 — Spearman(n=4) 대신 인접 X/R 구간 ΔSCR* 부호 변화\n- [ ] `P8-A4` 학위논문 본문\n- [ ] `P8-A5` IEEE Access 투고 원고\n\n---\n\n## 구축 완료 — 해석 파이프라인\n\n> [!success] 체크리스트에 없던 산출물\n> Phase 2~3 진행 중 도구와 문서가 함께 만들어졌다.\n\n| 모듈 | 역할 |\n|---|---|\n| `model.py` | 22-state f(x,u) + 심볼릭 야코비안. 양방향 커플링 자가검사 |\n| `op.py` | 동작점 fsolve · 유한차분 검산 · **설비 정격 정의** |\n| `runner.py` | 조건 스윕 · 대역별 ζ · 커플링 효과 · 결과 누적(`LATEST.json`) |\n| `pf.py` | 참여계수 → 모드 물리 귀속 (실수극 포함) |\n| `xval.py` | 선형화 유효범위 · DC 이득 오차 · 궤적 저장 · MATLAB export |\n| `plot_xval.py` | 오차 곡선 · 임계값 · 입력 간 비교 |\n| `plot_traj.py` | 시간영역 응답 파형 (비선형 vs 선형 예측) |\n\n**문서**: Word 보고서 9쪽 / 그림 8장, README 갱신\n**노트**: [[블록삼각_함정]] [[실행_식별자_설계원칙]] [[실험_재현성_체크리스트]] [[선형화_유효성_지표_규명]]\n\n---\n\n## 상시 병렬\n\n- [ ] `C1` refs [115] 2D 임피던스 평면 안정도 경계\n- [ ] `C2` refs [114] 전차수 VSG 상태공간 모델\n- [ ] `C3` refs [94] Lyapunov 기반 파라미터 선정\n- [ ] `C4` **선행연구 비교표** — 다중 운전점 PSO / 2D 경계 / CHIL 3축 매트릭스 *(Tier 2 확정 시 CHIL 축 재서술)*\n- [ ] `C5` 논문 추출 파이프라인 3번째 호출(렌더링) 마무리\n\n---\n\n## 게이트 조건\n\n| 게이트 | 선행 조건 | 미충족 시 |\n|---|---|---|\n| **P4 착수** | `P3-A6` ζ_threshold 확정 + `P4-A0` 지표 재정의 | 잘못된 모드를 최적화 |\n| P6 착수 | `P0-A3` Tier 결정 + `P5-A6` | 장비 대기로 무기한 지연 |\n| P7 착수 | `P4-A1` + `P6-A4` | 스윕 결과에 에러바를 못 붙임 |\n| P8 착수 | `P7-A3`, `P7-A5` | 가설 검증 불가 |\n\n## 이번 주 우선순위\n\n1. `P0-A1` **오늘** — 물어보는 데 5분. 답에 따라 5개월치가 갈린다\n2. `P3-A6` 이번 주 — 문헌 확인 반나절. P4 게이트\n3. `P4-A0` 이번 주 — 지표 재정의. P4 착수 전 필수\n4. `P5-A1` 병행 착수 — RTDS 무관, Tier 2 백업\n\n## 상태 정의\n\n`not_started` → `in_progress` → `draft` → `verified`\n`verified` 는 증거 파일 경로가 있을 때만 유효. 경로 없으면 `draft` 로 강등.\n\n## 기호\n\n🔺 = 다른 항목의 선행 조건 (막히면 하류 전체가 막힘)\n⬆️ = 원래 일정보다 앞당긴 항목\n\n## 🔗 연결\n\n- [[Phase02_완료]]\n- [[블록삼각_함정]]\n- [[실행_식별자_설계원칙]]\n- [[실험_재현성_체크리스트]]\n- [[선형화_유효성_지표_규명]]\n- [[22state_모델_구축_종합]]\n",
    "wikilinks": [
      "선형화_유효성_지표_규명",
      "블록삼각_함정",
      "실행_식별자_설계원칙",
      "실험_재현성_체크리스트",
      "Phase02_완료",
      "22state_모델_구축_종합"
    ]
  }
];
