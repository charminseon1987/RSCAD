# 다음에 이어서 할 것

마지막 작업: 2026-10-14 · 커밋 `398c3a3ef` 까지 반영됨 + 미커밋 변경 있음

---

## 0. 먼저 읽을 것 — 신규성 주장이 바뀌어야 한다

**이전 판의 가장 큰 정정.** `NEXT.md` 이전 판 §2 는 "③ SCR·X/R 동시 변화 안정도 경계가
말뭉치에 없다 → **이것이 이 연구의 신규성 그 자체**" 라고 썼다. 2026-10-14 반증 검색 결과
**그 판정은 유지될 수 없다.**

| 선행연구 | 무엇을 했나 | 근거 |
|---|---|---|
| X. Luo et al., MedPower 2024, doi `10.1049/icp.2024.4667` | **Fig. 9 가 `m_P` vs SCR 안정도 경계를 R/X 값별로 반복 작도**한다. GFL·GFM 둘 다. SBT 알고리즘으로 최대 3파라미터 경계를 2D 곡선·3D 곡면으로 낸다 | 공개 PDF **본문 확인**. 원문: *"The 𝑚𝑃 vs. SCR stability curve is reproduced for different R/X ratios, as shown in Fig. 9."* |
| J. Wang et al. (NREL), IEEE PESGM 2025, doi `10.1109/pesgm52009.2025.11225025` | 상용 인버터 2대를 SCR·X/R **동시** 변화로 하드웨어 시험 | **초록만**. 원문: *"X/R affects the voltage stability more than SCR"* |
| J. Yu et al., IEEE TIE 69(9) 9087–9098, doi `10.1109/TIE.2021.3113000` | Luo 가 "축약 상태공간으로 R/X 별 안정도 경계를 도출했다"고 기술한 선행연구 | **초록만** · 연도 `미검증`(early access 2021 / 지면 2022) |

### 그래도 남아 있는 차별점 (※ 내 판단 — 본문 재확인 필요)

- Luo 의 R/X 는 **0~30% 구간뿐**(X/R ≥ 3.3)이고, 본문이 "R/X 10% 까지는 순 유도성 가정이
  유효하다"고 쓴다. 이 저장소의 런은 **X/R 1.0·1.5 = R/X 100%·67%** — Luo 범위 **완전 밖**이다.
- Luo 는 3-bus 학회논문이고 PSO 공동최적화·CHIL 검증이 없다. NREL 은 고유값 모델이 아니라
  상용기 전압안정도 실험이다.

→ 주장을 "SCR–X/R 경계를 아무도 안 했다" 에서
**"낮은 X/R(1.0~1.5) 영역에서, PSO 로 조정한 이득과 함께 본 강건성 경계"** 로 좁혀야 한다.
세 편 모두 가장 직접적인 경쟁 선행연구다 — 말뭉치에 넣고 정독해야 한다.

### ④ PSO 도 같다

"PSO 로 GFM 이득을 조정한 선행연구가 없다" 는 전제도 성립하지 않는다.
B. Pournazarian et al., *IEEE Trans. Smart Grid* 13(6) 4202–4217, 2022,
doi `10.1109/TSG.2022.3186165` (**인용 76**) 이 PSO 로 VSG 파라미터 + 가상임피던스를
동시 최적화하고, 소신호 안정도로 J·D 허용구간을 먼저 산정한 뒤 그 안에서 최적화한다(초록 기준).
차별점은 "PSO 를 썼다" 가 아니라 **"무엇을 목적함수·제약으로 뒀는가"** 에 있다.

검색 전말과 사용 질의어는 `GFM_Research/00_Knowledge/rag/corpus_gap_candidates.md` 에 있다.
레코드 `records/pawar2021gfcpv.json` 의 `G03`·`G04` 는 `partially_addressed` 로 갱신됐다
(`ce_tool.py validate` 통과). **`G01`·`G02`·`G05` 는 아직 `not_searched` 다 — 논문에
"공백" 으로 쓸 수 없다.**

---

## 1. 결정 상태

### ① 과거 런 3건의 틀린 플래그 — **완료 (2026-10-14)**

`superseded_result` 정책으로 정정했다. `schedule.yaml` `output_policy.deprecation_policy`
세 조항을 모두 따랐다.

| 런 | SCR_list | all_converged |
|---|---|---|
| `J0.50_Dp20.0_Kpv0.050_wc62.8_XR1.0_02c55d` | `[3.0, 2.0, 2.0, 1.5]` → **`[3.0, 2.0, 1.5]`** | false → **true** |
| `J0.50_Dp20.0_Kpv0.050_wc62.8_XR1.0_4acbf1` (LATEST) | 같음 | false → **true** |
| `J0.50_Dp25.0_Kpv0.150_wc62.8_XR1.5_e6a934` | 같음 | false → **true** |

- 구 값은 각 `meta.json` 의 `superseded_result` 에 남아 있다 (이유·수정 커밋·
  "왜 재계산하지 않았는지" 포함). `deprecation_log` 가 이력 노트를 가리킨다.
- `01_개념/폐기값_이력.md` **12절** + 요약표 1행.
- **σ·고유값·ζ 는 바뀌지 않았다.** 중복 SCR 은 어차피 한 번만 풀렸으므로 `ok_runs` 기반
  지표는 처음부터 옳았다. 재실행하지 않은 이유는 `provenance` git SHA 가 바뀌면 과거
  기록과의 대응이 끊기기 때문이다.
- 고치기 전 안전장치: `nonconvergence_SCR == []` 이고 `eigenvalue_results.json` 의 키가
  중복제거된 `SCR_list` 와 정확히 일치할 때만 손댄다. 3건 모두 `['3.00','2.00','1.50']`.

### ② 임베딩 모델 교체 — **절반 해소. 남은 것은 문항 수다**

HF 모델카드로 확인한 것 (2026-10-14, ※ 벤치마크는 안 돌렸다):

- **KURE-v2 는 바꿔 끼울 수 없다.** ColBERT late-interaction 이다 — 토큰마다 128차원
  벡터를 내고 MaxSim 으로 점수를 낸다 (154M, base `skt/A.X-Encoder-base`, 8192 토큰).
  **PyLate + PLAID 색인**이 필요하고, 단일 벡터를 Chroma 에 넣는 현재 파이프라인
  전체를 다시 써야 한다. `--model` 만 갈아 넣으면 돌지 않는다.
- **KURE-v1 은 그대로 바꿔 끼울 수 있다.** `base_model: BAAI/bge-m3` 의 한국어 파인튜닝이고
  SentenceTransformer · 1024차원 · 8192 토큰으로 지금 코드와 같다. 즉 **bge-m3 ↔ KURE-v1
  비교는 한 줄 바꿔 되는 동일 조건 비교**다.
- **교차언어는 두 카드 모두 근거를 주지 않는다.** KURE 의 평가는 MTEB(kor) 한국어 과제로
  ko→ko 다(Belebele 도 ko-ko). 이 볼트는 말뭉치 영어 100% · 질의 한국어 100% 라 **ko→en**
  이다. "한국어 특화니까 더 맞다" 는 추론이 그대로 적용되지 않는다 — bge-m3 는 교차언어를
  명시적 목표로 학습된 모델이다.

→ **아직 결정하지 말 것.** 채점 문항이 7건이라 라벨 한 건이 `Recall@1` 을 0.14 움직인다.
문항을 늘린 뒤 KURE-v1 과 같은 자로 비교한다 (아래 §4).

---

## 2. 말뭉치 — 8편 → 12편 (검색 가능 11편)

### 받은 것 (2026-10-14)

| 문서 | 주제 | 출처 |
|---|---|---|
| `Chen_2026_LCL_Resonance_SingleLoop_GFM` | LCL 공진 ↔ 능동댐핑 이득 | arXiv 2504.06981 (IEEE TIE early access) |
| `Zhao_2024_LowFreq_Resonance_GFM` | GFM-VSC 저주파 공진(SR/SSR) | arXiv 2402.14543 (TPEL 39(11), 인용 62) |
| `Chen_2025_OpenLoopUnstable_SingleLoop_GFM` | droop-I 무효전력 루프 개루프 불안정 | Cambridge Apollo (4-1 의 학회 선행판) |
| `Singh_2025_CHIL_DLL_RTDS` | RTDS cHIL 테스트벤치 + 제어기 DLL | Springer OA |

### 못 받은 것 — **봇 차단. 브라우저로 직접 받아야 한다**

| 논문 | 왜 필요한가 | 링크 |
|---|---|---|
| **Luo 2024** (§0 의 핵심) | ③ 의 가장 직접적인 경쟁 선행연구 | `https://eprints.soton.ac.uk/495949/1/MedPower2024_full_paper_2576.pdf` (Cloudflare) |
| **NREL 2025 프리프린트** | ③ 하드웨어 반증 | `10.20944/preprints202504.1145.v1` (Access Denied) |
| **Pournazarian 2022** (TSG, 인용 76) | ④ 의 핵심 | `https://research.aalto.fi/files/84991044/...pdf` (Cloudflare) |
| **Pournazarian 2021** (IEEE Access) | ④ | `https://research.aalto.fi/files/67552329/...pdf` (Cloudflare) |

이 4편이 들어오면 ③④ 의 gold 를 채울 수 있고, 그때 비로소 §0 의 차별점을 본문으로 확인할 수 있다.

### 색인에 없는 문서

`PV_GFM_Control_Playbook` 은 **본문을 한 글자도 못 뽑는다**(스캔본). `01_chunk.py` 가 이제
이름을 찍어 준다 — `문서 12편 (검색 가능 11편)`. OCR 전까지 검색되지 않는다 (기획서 `S6`).

`Report_24-06` (131청크, 15%)은 여전히 GFM 과 무관한 에너지 전망 하모나이제이션 리포트다.
10건 질의 전부에서 후보로 나오지 않는다 — distractor 역할이므로 해롭지는 않다.

---

## 3. 기준선 (2026-10-14 측정)

```bash
python Scripts/03_eval.py --strategy section --data-dir GFM_Research/00_Knowledge/rag --k 2
```

`bge-m3` · `section` 전략 · **1018청크 · 11편 · 7문항** ·
결과는 `GFM_Research/00_Knowledge/rag/eval_section.json`

| k | Recall@k | nDCG@k | | 참고문헌 포함했을 때 (1163청크) |
|---|---|---|---|---|
| 1 | **0.5000** | 0.5714 | | 0.3571 |
| 2 | **0.6429** | 0.6063 | | 0.5000 |
| 3 | **0.6429** | 0.6063 | | 0.5000 |
| 5 | 1.0000 | 0.7546 | ← 포화 | 1.0000 |

MRR = **0.7000** (참고문헌 포함했을 때 0.5857)

**이 두 열은 비교해도 된다** — 같은 질의·같은 gold·같은 모델이고, 말뭉치에서
참고문헌 145개(12.5%)만 걷어냈다. `Recall@1` +0.143 · `MRR` +0.114 다.
근거가 될 수 없는 것을 뺐을 뿐인데 임베딩 교체로 기대하던 것보다 폭이 크다 (§6-3).

더 이전 판(866청크·8편·5문항, `Recall@1` 0.3000 · `MRR` 0.6167)과는 **비교하면
안 된다** — 말뭉치도 문항도 다르다.

### 못 맞힌 3건 — 원인을 재서 좁혔다

`k=3` 까지도 정답이 안 나오는 질의 3건은 **전부 정확히 5위**다.

| 질의 | 정답 | 정답 점수 | 1위 | 차 |
|---|---|---|---|---|
| ① DC링크+AC 상태공간 | `henriquezauba2022arxiv` | 0.5840 | `Chen_2025` 0.6164 | 0.0324 |
| ⑦ 참여계수로 지배 모드 규명 | `henriquezauba2022arxiv` | 0.5079 | `kenyon` 0.5497 | 0.0418 |
| ⑩ 가상관성·댐핑과 과도응답 | `DArco_2014_VSM_Droop` | 0.5265 | `Taul` 0.5794 | 0.0528 |

**길이 편향 가설은 틀렸다.** 처음에는 긴 문서가 상위 30 청크에 조각을 넣을 기회가 많아서
(`dedup_docs()` 의 fold) 짧은 문서가 밀린다고 봤다. `--fetch` 를 30 → 60 → 120 으로 키워도
`Recall@2`·`MRR`·`nDCG@2` 가 **소수점까지 하나도 움직이지 않았다.** 정답 문서는 이미
fold 안에 있다(`Recall@5 = 1.0`) — fold 창이 아니라 **점수 자체**가 문제다.

실제 원인: **점수가 변별하지 못한다.** 질의 ⑩ 의 상위 6개 문서 점수가
0.5794 · 0.5733 · 0.5595 · 0.5451 · 0.5265 · 0.5245 — 1위와 6위 차가 0.055 다.
말뭉치 전체가 GFM 소신호 안정도 한 주제이고, 질의는 한국어 · 본문은 영어(ko→en)다.
"GFM 논문 중 **어느** 논문" 을 가리는 데 필요한 해상도가 없다.

→ 다음 지렛대는 **임베딩 교체보다 리랭커**다. `03_eval.py --rerank` 가 이미 있다
(기본 `BAAI/bge-reranker-v2-m3`). 다만 이 기계에서는 568M 모델을 새로 받아 올려야 해서
메모리에 걸릴 수 있다 — `nlpai-lab/KURE-Reranker-nano`(modernbert 기반, 훨씬 작다)나
`KURE-Reranker-base`(Qwen3-1.7B)를 `--reranker` 로 넣어 비교하는 편이 현실적이다.
**아직 돌리지 않았다** — 리랭커가 듣는다는 근거는 없고, 가설이다.

### 채점 문항 5건 → 7건

| 질의 | gold | 비고 |
|---|---|---|
| ① DC링크+AC 소신호 상태공간 | `henriquezauba2022arxiv` | |
| ② 약계통 VSM 동기화 안정도 한계 | `Taul_2020...`, `Salem_2025...` | A 안 확정 |
| ③ SCR·X/R 동시 경계 | `[]` | **말뭉치에 없다 — 논문을 못 받았기 때문이다. §0 과 혼동하지 말 것** |
| ④ PSO 로 제어 이득 조정 | `[]` | 같음 — Pournazarian 2편 수령 실패 |
| ⑤ LCL 공진 감쇠 ↔ 전류제어 이득 | **`Chen_2026_LCL_Resonance_SingleLoop_GFM`** | 신규. §III 전체가 능동댐핑이고 `G_ad(s)=k_d·s/(T_d·s+1)` 로 이득 명시 |
| ⑥ PV+ESS 공유 DC 링크 2단 | `[]` | `two-stage` 11회가 전부 "two-stage current limiting control". **반증 검색 안 했다** |
| ⑦ 참여계수로 지배 모드 규명 | `henriquezauba2022arxiv` | |
| ⑧ CHIL 검증 절차 | **`Singh_2025_CHIL_DLL_RTDS`** | 신규. 키워드에 `Control-Hardware-in-the-Loop (cHIL)` 명시 |
| ⑨ 전력각과 동기화계수 | `kenyon2020ibrstability` | |
| ⑩ 가상관성·댐핑과 과도응답 | `DArco_2014_VSM_Droop` | |

⑤⑧ 은 매칭 문장을 직접 읽고 기입했다 (아래 §5 주의 2). ⑧ 에는 한계도 note 에 남겼다 —
Singh 본문에 `delay`·`GTNET`·`cross-validation` 이 **0회**다. 루프 지연 보상과
모델↔CHIL 교차검증 절차는 이 논문이 주지 않는다.

③ 은 말뭉치 보강 후 **재확인했다**: `X/R` 이 전 말뭉치에 **2회**뿐이고, `Chen_2026` 의 1회는
고정 파라미터값(`X/R = 6`)이지 스윕이 아니다. `kenyon` 의 1회는 종전과 같은 배전망 volt-watt
문맥이다. `impedance angle`·`resistive-inductive` 는 0회.

### `--k 5` 를 쓰면 안 된다 — 포화한다

말뭉치가 11편이라 상위 5 안에 정답이 거의 자동으로 든다.
**변별력은 `Recall@1`·`Recall@2`·`MRR` 에만 있다.** 모델 비교는 이 셋으로 한다.

---

## 4. 다음 작업 순서

```
1. 못 받은 PDF 4편을 브라우저로 받는다          ← §2. ③④ 의 gold 가 여기 걸려 있다
     papers/ 에 넣고
     python Scripts/01_chunk.py --strategy section --pdf-dir ... --data-dir ...
     python Scripts/02_index.py --strategy section --data-dir ... --chunk-rows 24 --batch 2

2. Luo 2024 와 Chen_2026 을 정독한다            ← paper-reader
     Luo 는 §0 의 차별점(R/X 0~30% 한정)을 본문에서 확인해야 한다.
     레코드 → ce_tool.py validate → obsidian

3. 질의를 10건 → 25건 이상으로 늘린다
     라벨 1건이 Recall@1 을 0.14 움직이는 지금 눈금으로는 모델을 못 가른다.
     새로 넣은 문헌(LCL·CHIL·PSO·SCR-X/R)에 맞춰 질의를 쓴다.

4. 기준선을 다시 잰다 (k=1,2 와 MRR)

5. 리랭커를 재 본다                             ← 지금 **두 가지**가 여기 걸려 있다
     python Scripts/03_eval.py --strategy section --data-dir ... --k 2 --rerank \
            --reranker nlpai-lab/KURE-Reranker-nano
     (a) 검색 순위 — 점수가 0.05 띠에 몰려 있어 임베딩을 바꿔도 같은 띠가 나올 수 있다
     (b) 근거 유무 판정 — §6-3① 에서 임베딩 기하로는 못 가린다는 것이 측정으로 나왔다.
         교차인코더는 질의-문서를 함께 보므로 이 둘 다에 맞는 도구다.
     메모리: bge-m3(2.5GB) 와 같이 올려야 한다. 기본 bge-reranker-v2-m3 는 568M 이라
     새로 받아야 하고, KURE-Reranker-nano 가 더 가볍다 (주의 8).

6. 그 다음에 KURE-v1 로 임베딩을 비교한다 (KURE-v2 는 파이프라인 재작성 — §1②)
     python Scripts/02_index.py --strategy section --data-dir ... --model nlpai-lab/KURE-v1
```

gold 후보 재추출:

```bash
python Scripts/gold_candidates.py --top 4 --snippet 150 \
    --json GFM_Research/00_Knowledge/rag/gold_candidates.json
```

---

## 5. 함정 — 그대로 유효하다

**주의 1** — `gold` 는 청크 id 가 아니라 **문서 이름**이다 (`03_eval.py` 의 `dedup_docs()`).

**주의 2** — `gold_candidates.py` 의 `TERMS` 는 **넓은 OR** 이라 리뷰 논문을 과대평가한다.
후보를 받은 뒤 **매칭 문장을 직접 읽어야 한다.** 참고문헌 목록 제목 · 블록도 라벨 ·
동명이의(`two-stage`)가 빈도에 섞인다. 이전 판의 ③⑤⑥ 오판이 전부 여기서 나왔다.

**주의 3 (해결됨)** — `title` 필드는 이제 **`section`(절 제목)과 `paper_title`(논문 제목)로
나뉘어 있다.** 예전에는 절 제목(`I. INTRODUCTION`)이 논문 제목 자리에 들어가 있었다.
`paper_title` 은 PDF 메타데이터에서만 가져오고 **없으면 `null`** 이다 — 본문의 큰 글씨를
제목으로 집으면 저널 머리글·소속이 섞여 들어오고, 틀린 제목이 인용에 실리는 것이
비어 있는 것보다 나쁘다. 현재 11편 중 **6편이 `null`** 이다. 인용에 쓰려면 사람이 채워야 한다.

**주의 4 (신규 · 한 번 틀리게 적었다가 고침)** — **chromadb 는 없는 경로를 주면 에러 없이
빈 DB 를 만든다.** 그래서 "경로를 잘못 줬다" 가 "색인이 비었다" 와 화면에서 똑같아 보인다.

`Check_index.py` 는 경로를 위치 인자로 받는데, 다른 스크립트 습관대로
`--data-dir GFM_Research/00_Knowledge/rag` 를 붙였더니 문자열 `--data-dir` 이 경로가 됐다.
저장소 루트에 `./--data-dir/index/chroma.sqlite3` (컬렉션 0 · 임베딩 0) 가 생기고
`컬렉션: []` 가 찍혔다. 그때는 "색인 중 동시 접근 때문에 오독됐다" 고 적었는데 **틀렸다** —
동시 접근과 무관했고, 진짜 색인은 내내 멀쩡했다.

`Check_index.py` 는 이제 `--data-dir` 도 받고, 색인 폴더가 없으면 빈 DB 를 만들지 않고
`exit 2` 로 멈춘다. 열어 본 경로도 함께 찍는다.

**주의 5 (신규)** — 이 기계에서 **bge-m3 재색인은 메모리에 걸린다.** 물리 15.6GB 중 가용
0.5~2.6GB 상태에서 두 번 강제 종료됐다. `--chunk-rows 32 --batch 4` 로 돌리고,
브라우저 등을 닫아 두는 편이 빠르다. 중간에 죽어도 **이어받는다** (아래 §6).

**주의 6 (신규 · 비싸게 배웠다)** — **chroma 에서 `delete_collection()` + `modify(name=...)`
로 컬렉션을 맞바꾸지 마라.** 2026-10-14 에 이것으로 1163개를 통째로 날렸다.

교체 직후 두 번(검수 1회 · eval 1회)은 `section 1163개` 로 정상 조회됐다. 그 다음
클라이언트를 열었을 때 컬렉션이 없어져 있었다 — sqlite `collections` 에서 행이 사라지고
`embeddings` 1163행이 함께 날아갔다(남은 983행은 `gfm_brain`). chroma 1.5.9 에서
보류된 삭제가 **새로 그 이름을 받은 컬렉션에** 적용되는 것으로 보인다.
읽기 스크립트(`03_eval.py`·`search.py`·`Check_index.py`)에는 삭제 코드가 없다.

지금 `02_index.py` 는 **대상 컬렉션에 직접 이어 쓴다.** 이름을 바꾸지 않는다.
`index/` 에 주인 없는 세그먼트 폴더(`e106d655-…`, 3.9MB)가 하나 남아 있다 —
손으로 지우는 것이 chroma 를 또 흔들 수 있어 그대로 뒀다.

**주의 8 (신규)** — **메모리가 부족해 보이면 먼저 `ollama ps` 를 보라.**
재색인이 자꾸 죽어서 Flask 를 내렸는데 소용이 없었다. 범인은 Ollama 에 적재된
`qwen3:8b` **6.7GB** 였다 (`/api/scholar/ask/status` 가 `ollama_up()` 을 부를 때마다
살아난다). `ollama stop qwen3:8b` 하나로 가용 메모리가 0.3GB → **5.8GB** 가 됐다.

로컬 엔진으로 RAG 답변을 받으려면 bge-m3(2.5GB) + qwen3:8b(6.7GB) ≈ 9.2GB 를
동시에 올려야 한다. 15.6GB 기계에서 브라우저·Vite 까지 띄워 두면 빠듯하다.

**주의 7 (신규)** — 색인이 도는 중에 결과를 `| tail` 로 파이프하면 **진행이 보이지 않는다**
(파이프 블록 버퍼링). 긴 작업은 `python -u ... > 로그파일 2>&1` 로 돌리고 로그를 따로 읽어야
한다. 백그라운드 런처의 `exit 0` 은 런처가 끝났다는 뜻일 뿐 python 이 끝났다는 뜻이 아니다.

---

## 6. 이번에 고친 것 (전부 미커밋)

| 파일 | 내용 |
|---|---|
| `results/*/meta.json` 3건 · `01_개념/폐기값_이력.md` | 결정 ① — `superseded_result` 정정 + 12절 |
| `Scripts/01_chunk.py` | `title` → `section` + `paper_title` 분리 · 본문 0자 문서 경고 |
| `Scripts/02_index.py` | **증분 색인 + 이어받기 + 없어진 청크 제거** · KURE 머리말 정정 |
| `Scripts/search.py` | 논문 제목(📄)과 절 제목(§)을 구분해 출력. 구 색인은 절 제목으로만 읽는다 |
| `Scripts/Check_index.py` | `--data-dir` 수용 · 없는 경로면 빈 DB 를 만들지 않고 멈춘다 (주의 4) |
| `web/src/components/charts/TimeDomain.tsx` | 시간영역 패널이 죽어 있던 것 + 단위 환산 (아래 §9) |
| `tools/console_utf8.py` (신규) + `tools/*.py` 6개 | cp949 콘솔 버그 — `ce_tool.py validate` 가 검증을 다 끝내고 em-dash 에서 죽던 것. 이제 `exit 0` |
| `GFM_Research/00_Knowledge/rag/eval.jsonl` | ⑤⑧ gold 기입 · ③④⑥ note 갱신 |
| `rag/corpus_gap_candidates.md` (신규) | 검색 전말 · 사용 질의어 · 수령 가능 PDF 목록 |
| `records/pawar2021gfcpv.json` | `G03`·`G04` → `partially_addressed` |
| `Scripts/console_utf8.py` (신규, 10-12) | 이전 세션분 |

### `02_index.py` 구조가 왜 바뀌었나 — 두 번 바꿨다

**원래**: ① 1163청크를 한 번에 `encode` → ② 기존 컬렉션 `delete` → ③ `add`.
메모리 부족으로 ① 에서 죽으면 아무것도 남지 않고, ② 를 먼저 하는 구조라 ③ 전에 죽으면
쓸 수 있는 색인이 사라진다. 실제로 ① 에서 두 번 죽었다.

**1차 수정 (폐기)**: 조각마다 임베딩해 임시 컬렉션 `section__building` 에 넣고, 다 쌓인 뒤
`delete_collection('section')` + `modify(name='section')` 로 맞바꿨다. 증분·이어받기는
의도대로 동작했다(624/1163 에서 죽은 뒤 이어받았다). **그러나 맞바꾸기가 색인을 날렸다**
— §5 주의 6.

**현재**: 조각마다 임베딩해 **대상 컬렉션에 직접 넣는다.** 이름을 바꾸지 않는다.
- 피크 메모리가 청크 수에 비례하지 않는다 (모델 + 한 조각).
- 이미 들어 있는 id 는 건너뛴다 — 죽어도 다시 실행하면 빠진 것만 채운다 (`--fresh` 로 처음부터).
- 청크 파일에서 사라진 id 는 걷어낸다 — 논문을 빼거나 청킹을 바꿀 때 유령 벡터가
  검색 결과에 섞이는 것을 막는다.
- 끝에서 `색인 수 == 청크 수` 를 확인하고, 다르면 부분 상태임을 알리고 exit 1 한다.

대가: 재색인 도중에는 색인이 부분 상태다. 기존 색인을 지켜 주지는 못한다 —
맞바꾸기로 그걸 얻으려다 전부 잃었으므로, 이쪽이 낫다.

---

## 6-2. 대시보드를 띄워 보고 찾은 것 (2026-10-14)

`python Server/app.py` + `cd web && npm run dev` 로 실제로 띄워 `/lab/gfm` 을 눌러 봤다.
백엔드·프록시·고유값 패널은 정상이고 콘솔 에러도 0 이었다. `OUT[4] 시간영역` 만 죽어 있었다.

**① 7개 탭 중 6개가 빈 그래프, 1개는 엉뚱한 신호**

`TimeDomain.tsx` 가 `tr.state_idx === selectedState` 로 trace 를 찾았다. `selectedState` 는
**버튼 인덱스(0~6)** 인데 API 의 `state_idx` 는 **22차 상태벡터 안의 위치**다 —
`delta`=8 · `dw`=9 · `Pf`=10 · `Qf`=11 · `v_dc`=4 · `v_od`=18 · `i_od`=20.
그래서 거의 모든 탭이 아무것도 못 찾았고, 하필 `v_dc`(4)만 버튼 4번에 걸려
**DC 링크 전압 800 V 를 `i_od [A]` 라벨로** 그렸다. 비어 있는 것보다 나쁜 상태였다.
이름(`tr.state`)으로 찾도록 고쳤다.

백엔드는 멀쩡했다 — `/api/trajectory` 가 21 trace(7상태 × 3 SCR) × 200포인트를 정상 반환한다.
컴포넌트가 `.catch(() => {})` 로 에러를 삼키는 구조라 더 안 보였다.

**② 단위 라벨이 1000배·57배 틀렸다**

①을 고치자 수치가 라벨과 안 맞았다. 근거를 각각 확인하고 환산표(`STATE_SCALE`)를 넣었다.

| 상태 | 모델 | 라벨 | 확인 근거 |
|---|---|---|---|
| `delta` | rad | `[deg]` | 궤적 초기값 0.7404 rad = 42.42° = `meta.delta_max_deg` **42.423** |
| `dw` | rad/s | `[Hz]` | `model.py:122` `f[8] = dw` (delta 가 rad 이므로) |
| `Pf` | W | `[kW]` | `op.py:26` `Pref=10e3`, 궤적 시작값이 정확히 `10000` |
| `Qf` | var | `[kvar]` | 같은 근거 |
| `i_od`·`v_od`·`v_dc` | A·V·V | 맞음 | 1.5 × 330 V × 20 A ≈ 10 kW 로 정격과 일치 |

검증: `delta` 가 42.4° 에서 출발(meta 와 일치), `P [kW]` 가 10 → 11 kW
(`Pref` +10% 스텝과 일치), `i_od` 가 20 → 22 A. `tsc --noEmit` 통과.

**남겨 둔 것** — `OUT[4]` 의 "저장(persist)하지 않은 실행입니다" 문구는 이번 세션에서 런을
돌리지 않아 `runResult` 가 비어서 뜬 것이고 차트와 별개 조건이다. 저장된 런을 보고 있는데도
뜨니 오해를 부른다. 손대지 않았다.

**버그 아님** — "메인 대시보드 열기" 를 눌러도 안 움직이는 것은 `/dashboard` 가
`App.tsx:146` 에서 `/` 로 리다이렉트되기 때문이다. 그 랜딩이 곧 메인 대시보드고,
해석 화면은 `/lab/gfm` 이다. `/api/modes` 의 400 도 정상이다(`SCR` 파라미터 필수).

---

## 6-3. 참고문헌 오염과 유사도 문턱 (2026-10-14)

데모로 앱을 띄워 PSO 질문(말뭉치에 PSO 0회)을 던진 데서 둘 다 나왔다.

### ② 참고문헌 145개를 색인에서 뺐다 — 효과가 컸다

'근거' 상위 3개가 전부 참고문헌 목록이었다. 본문이 아니라 **다른 논문 제목의 나열**인데
도메인 단어가 빽빽해 점수는 본문보다 높게 나온다. 모델이 붙어 있었다면 그 넷을
근거랍시고 받아 답을 썼을 것이다.

탐지는 두 갈래다 (`01_chunk.py` 의 `is_reference()`).
- 절 제목이 `REFERENCES|BIBLIOGRAPHY|참고문헌` 이면 끝
- 제목이 안 잡힌 경우는 서지 표기 밀도(`vol./no./pp./doi:/IEEE Trans/Proc.`) ≥ 4.
  Elsevier 식 편집은 `SECTION_RE` 에 안 걸려 앞 절(`§6. Conclusion`)에 묻혀 있었다 —
  kenyon 4개 · Liu 12개가 그랬다.

1163청크 전수 대조: 라벨 129 + 밀도 16 = **145개, 본문 오탐 0개**. 밀도를 6 이상으로
올리면 묻힌 16개를 놓친다. 문서별로 Salem 63 · Zhao 28 · Taul 18 개였다.

효과는 §3 의 표에 있다 — `Recall@1` +0.143 · `MRR` +0.114. **KURE 비교를 이전
말뭉치 위에서 했다면 12.5% 의 잡음 위에서 잰 셈이 됐을 것이다.**

`Server/indexer.py`(화면의 '색인 추가')에도 같은 필터를 걸었다. 스크립트로 넣은 논문과
화면으로 넣은 논문이 다른 말뭉치가 되면 안 된다.

### ① 문턱은 숫자 문제가 아니었다 — 진단이 틀렸다

"`MIN_SIM 0.45` 가 너무 낮다" 고 봤는데, 10문항으로 재 보니 그 진단이 성립하지 않는다.

| | top1 유사도 | 0.45 문턱 |
|---|---|---|
| 주제 밖 — 김치찌개 | 0.3447 | **차단** |
| 주제 밖 — KTX 요금 | 0.4312 | **차단** |
| 인접 분야 — 배터리 열폭주 | 0.4553 | 통과 |
| **근거 있음** (정답 문서 최고 sim) | **0.5079 ~ 0.6441** | 통과 |
| **근거 없음** (가짜 근거 최고 sim) | **0.5310 ~ 0.5854** | 통과 |

**뒤 두 줄이 겹친다.** 0.5854 를 막으면 진짜 근거 7건 중 5건이 같이 막힌다.
z 점수(평균 대비 돌출도)와 상위 8개의 문서 집중도로도 갈라 봤지만 **둘 다 겹쳤다**.
말뭉치가 GFM 소신호 안정도 한 주제뿐이라 임베딩 기하만으로는 가릴 수 없다.

→ **값을 바꾸지 않았다.** 대신 이 값이 **'도메인 바깥 차단기'이지 '근거 유무 판정기'가
아니라는 것**을 `ask.py` 의 주석·docstring·응답 note 에 적었다. `api_ask` 의
"근거가 약하면 답하지 않는다" 는 주제 안 질문에는 성립하지 않는 약속이었다.

실제 방어선은 두 가지뿐이다 — `grounded`(답에 인용 번호가 있는가)와 **사람의 확인**.
제대로 가리려면 교차인코더 리랭커가 필요하다. **아직 재보지 않았다.**

### 곁들여 — 내가 낸 회귀를 고쳤다

`d2cc0b17e` 에서 `read_pdf` 를 3개 반환으로 바꾸고 `title` 을 `section`/`paper_title` 로
나눴는데, `Server/indexer.py` 가 그 함수를 **모듈로 불러 쓰고 있었다.** 화면의
'색인 추가' 경로가 `ValueError: too many values to unpack` 으로 죽고 있었다.
커밋 전에 참조를 찾아보지 않은 탓이다. `ask.py` 의 `retrieve()` 도 옛 `title` 키를
읽어 화면에 빈 값을 내보내고 있었다. 셋 다 고쳤다.

---

## 7. 아직 안 한 것 (기획서 S 항목)

- `S2` eval gold — 7/10 기입. ③④ 는 PDF 수령 대기, ⑥ 은 반증 검색 미실시. 위 §4
- `S4` 런↔주장 레코드 연결 — git SHA 는 넣었고, 결과를 주장에 잇는 고리는 아직 없다
- `S5` 운영 에이전트 — 일지는 훅+스킬로 반쯤 메웠다. 스윕 실행·원고 검토 에이전트는 없다
- `S6` 스캔본 OCR — `PV_GFM_Control_Playbook` 1편. 이제 `01_chunk.py` 가 이름을 찍어 준다

기획서: https://claude.ai/artifact/4gdz5Mm3g1S9vPS4TPMS2z
(`S1`·`S3` 완료 반영 안 됨 — 갱신 불필요하다고 하셨다)

---

## 8. 기존 도구 쓰는 법

```bash
# 런 → 일지 자동 (기본 켜짐)
python Simulation/runner.py --SCR 3.0 2.0 1.5 --XR 1.0
#   → GFM_Research/RSCAD/03_실험/일지/<날짜>_<런이름>.md
#   ▸ 는 채워져 나오고 ※ 는 비어 있다

python Simulation/runner.py ... --no-journal    # 일지 끄기

/research-journal        # 일지의 ※ 를 채울 때 (또는 "최근 런으로 일지 써줘")
python Simulation/provenance.py                # 런을 만든 코드 확인
python tools/ce_tool.py validate "GFM_Research/00_Knowledge/records/*.json"
```
