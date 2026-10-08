# 다음에 이어서 할 것

마지막 작업: 2026-10-08 · 커밋 `346cb9ce2` 까지 반영됨 · 작업 트리 깨끗

---

## 1. 지금 당장 결정이 필요한 것

### ① 과거 런 3건의 틀린 플래그 — 고칠지 말지

`SCR_list` 중복 때문에 `all_converged` 가 거짓으로 `false` 가 된 런이 3건 있다.
**고유값·σ 값 자체는 멀쩡하다.** 플래그와 SCR 기록만 틀렸다.

| 런 | SCR_list | all_converged |
|---|---|---|
| `J0.50_Dp20.0_Kpv0.050_wc62.8_XR1.0_02c55d` | `[3.0, 2.0, 2.0, 1.5]` | false (틀림) |
| `J0.50_Dp20.0_Kpv0.050_wc62.8_XR1.0_4acbf1` | `[3.0, 2.0, 2.0, 1.5]` | false (틀림) · **현재 LATEST** |
| `J0.50_Dp25.0_Kpv0.150_wc62.8_XR1.5_e6a934` | `[3.0, 2.0, 2.0, 1.5]` | false (틀림) |

버그는 `a54a629fc` 에서 고쳤다. 과거 `meta.json` 은 **건드리지 않았다** —
`schedule.yaml` 의 `output_policy.deprecation_policy` 가 구 값을 `superseded_result`
로 남기라고 규정하고 있어서, 정책대로 처리할지 그냥 둘지는 사람이 정해야 한다.

선택지: (a) 그대로 둔다 (b) `superseded_result` 를 달고 고친다 (c) 재실행한다

### ② 임베딩 모델 bge-m3 → KURE 교체 여부

**결론을 내리기 전에 알아야 할 사실:**

- 말뭉치는 **한글 0.00%** (논문 7편 68.8만 자, 전부 영어)
- 평가 질의는 **100% 한국어**
- 즉 이건 **교차언어 검색**이다. KURE 는 한국어 특화 모델이라
  "한국어니까 더 맞다"는 추론이 거꾸로일 수 있다.
- `bge-m3` 는 교차언어를 명시적 목표로 학습된 다국어 모델이다.
- **미확인**: KURE-v2 의 실제 사양(교차언어 학습 여부, 컨텍스트 길이).
  `Scripts/02_index.py` 주석에 적힌 건 `KURE-v1` 이다.

**지금은 어느 쪽이 나은지 잴 수단이 없다** — `eval.jsonl` 의 `gold` 가 전부 비어 있다.
자를 먼저 만들고 바꿔야 한다.

---

## 2. 말뭉치의 구멍 (이게 모델 교체보다 크다)

평가 질의 10건 중 **2건은 말뭉치에 근거가 없다.**

| 질의 | 근거 |
|---|---|
| ④ 입자군집최적화로 제어 이득 조정 | `particle swarm`·`PSO`·`swarm`·`metaheuristic`·`genetic algorithm` **0회** |
| ⑧ CHIL 검증 절차 | `HIL`·`CHIL`·`RTDS`·`OPAL-RT` **0회**. `dSPACE` 2회뿐 (실험 셋업 언급) |

이 둘은 일정의 **P4(PSO 예비실험)·P6(CHIL 구축)** 이다.
말뭉치가 연구의 핵심 두 축을 비워 두고 있다. 임베딩 모델로는 해결되지 않는다.

→ `paper-searcher` 로 PSO 튜닝·CHIL 검증 논문을 먼저 넣어야 한다.

---

## 3. gold 후보 (8건, 검토 필요)

`Scripts/gold_candidates.py` 가 **본문 용어 출현**으로 뽑는다.
현재 검색 결과로 뽑지 않는 이유: 그러면 그 모델이 항상 만점을 내서 비교가 무의미해진다.

```bash
python Scripts/gold_candidates.py --top 4
```

결과는 `GFM_Research/00_Knowledge/rag/gold_candidates.json` 에 있다.

**주의 1** — `gold` 는 청크 id 가 아니라 **문서 이름**이다
(`Scripts/03_eval.py` 의 `dedup_docs()` 가 청크를 문서로 접는다).

**주의 2** — 용어 빈도는 긴 문서를 편든다. `Salem_2025_GFM_Review` 는 207청크짜리
리뷰라 거의 모든 질의에 걸린다. "그 주제를 다룬 문서" 와 "길어서 언급한 문서" 는
사람이 갈라야 한다.

**주의 3** — ⑥(PV+ESS 2단, 11회)·⑦(참여계수, 3회)는 근거가 약하다. 정답으로
쓰기에 불충분할 수 있다.

---

## 4. 다음 작업 순서 (제안)

```
1. PSO·CHIL 논문을 말뭉치에 넣는다        ← 연구 공백이자 평가 공백
     paper-searcher 로 검색 → 00_Knowledge/papers/ 에 PDF
     python Scripts/01_chunk.py && python Scripts/02_index.py

2. gold 10건을 채운다
     python Scripts/gold_candidates.py --top 4   ← 후보 확인
     GFM_Research/00_Knowledge/rag/eval.jsonl 의 "gold": [] 에 문서 이름 기입

3. 현재 모델 기준선을 잰다
     python Scripts/03_eval.py --strategy section

4. KURE 로 바꿔 같은 자로 비교한다
     python Scripts/02_index.py --model nlpai-lab/KURE-v1   (v2 존재 여부 확인 필요)
     python Scripts/03_eval.py --strategy section --model nlpai-lab/KURE-v1
```

급하면 2~3번을 근거 있는 6건(①②③⑤⑨⑩)만으로 **가(假)기준선**부터 재도 된다.

---

## 5. 이번 세션에 들어간 것

| 커밋 | 내용 |
|---|---|
| `a54a629fc` | SCR 중복이 수렴 판정을 뒤집던 버그 + `provenance.py` (git SHA·코드 해시·패키지 버전) |
| `ba500cf1d` | 런 종료 시 일지 초안 자동 생성 (`journal_hook.py`) + `/research-journal` 스킬 |
| `386020ecf` | 마크다운 내보내기가 그림을 버리고 지운 글자를 흘리던 것 |
| `346cb9ce2` | Docs 툴바 — 확대·맞춤법·이미지·편집모드(제안 추적 포함) |

검증: `test_pipeline` 23/23 통과 · 회귀에서 σ_min 저장값과 정확히 일치
(`2.16373`, 차이 `0.00e+00`) · `tsc -b` + `vite build` 통과

### 새로 생긴 것 쓰는 법

```bash
# 런 → 일지 자동 (기본 켜짐)
python Simulation/runner.py --SCR 3.0 2.0 1.5 --XR 1.0
#   → GFM_Research/RSCAD/03_실험/일지/<날짜>_<런이름>.md
#   ▸ 는 채워져 나오고 ※ 는 비어 있다

python Simulation/runner.py ... --no-journal    # 일지 끄기

# 일지의 ※ 를 채울 때
/research-journal        또는  "최근 런으로 일지 써줘"

# 런을 만든 코드 확인
python Simulation/provenance.py
```

---

## 6. 아직 안 한 것 (기획서 S 항목)

- `S2` eval gold — 위 3·4번
- `S4` 런↔주장 레코드 연결 — git SHA 는 넣었고, 결과를 주장에 잇는 고리는 아직 없다
- `S5` 운영 에이전트 — 일지는 훅+스킬로 반쯤 메웠다. 스윕 실행·원고 검토 에이전트는 없다
- `S6` 스캔본 OCR — `PV_GFM_Control_Playbook` 1편이 색인에서 빠져 있다

기획서: https://claude.ai/artifact/4gdz5Mm3g1S9vPS4TPMS2z
(`S1`·`S3` 완료 반영 안 됨 — 갱신 불필요하다고 하셨다)
