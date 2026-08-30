---
tags: [MOC]
---

# 문헌 지식 MOC

규칙과 템플릿은 [[README]]. 이 노트는 **현재 뭐가 쌓였나**만 본다.

---

## 1. 관련연구 비교표

논문 4장 비교표의 초안. `mine`(내 결과)이 같은 열로 섞여야 비교가 된다.

```dataview
TABLE WITHOUT ID
  file.link AS "노트",
  ref_num AS "[]",
  target_system AS "대상",
  tuning_method AS "튜닝",
  scr_range AS "SCR",
  validation_level AS "검증",
  extraction_depth AS "원문"
FROM "00_Knowledge/literature" OR "00_Knowledge/mine"
SORT ref_num ASC, year DESC
```

> `원문` 열이 `full`이 아닌 행은 **인용 금지**. 초록만 보고 적은 값이다.

---

## 2. 갭 확인

아래가 0건이면 그게 기여 논거다. **단, 문헌이 충분히 쌓인 뒤에 의미가 있다.**
10편 미만에서 0건은 "없다"가 아니라 "아직 안 읽었다"이다.

```dataview
TABLE target_system, tuning_method, validation_level
FROM "00_Knowledge/literature"
WHERE target_system = "PV+ESS"
  AND tuning_method != "수동"
  AND contains(validation_level, "CHIL")
```

현재 문헌 수:
```dataview
LIST WITHOUT ID length(rows) + "편"
FROM "00_Knowledge/literature"
GROUP BY true
```

---

## 3. 축별 분포

어느 축이 비어 있는지 본다. 빈칸이 곧 다음에 읽을 논문의 방향.

```dataview
TABLE WITHOUT ID
  key AS "튜닝 방법",
  length(rows) AS "편수",
  filter(rows.file.link, (r) => true) AS "논문"
FROM "00_Knowledge/literature"
GROUP BY tuning_method AS key
SORT length(rows) DESC
```

```dataview
TABLE WITHOUT ID key AS "검증 수준", length(rows) AS "편수"
FROM "00_Knowledge/literature"
GROUP BY validation_level AS key
SORT length(rows) DESC
```

---

## 4. 원문 미확보

`request`는 상호대차·도서관 신청 큐. `oa-available`은 OpenAlex로 자동 수집 가능.

```dataview
TABLE WITHOUT ID
  file.link AS "노트", pdf_status AS "상태", doi AS "DOI", venue AS "출처"
FROM "00_Knowledge/literature"
WHERE pdf_status != "have"
SORT pdf_status ASC
```

---

## 5. 읽기 대기

```dataview
TABLE WITHOUT ID file.link AS "노트", year AS "연도", venue AS "출처"
FROM "00_Knowledge/literature"
WHERE status = "to-read"
SORT year DESC
```

---

## 6. 주장 노트

각 claim이 몇 편의 근거를 갖고 있는지. 근거 1편짜리 주장은 논문에 쓰기 약하다.

```dataview
TABLE WITHOUT ID
  file.link AS "주장",
  length(file.inlinks) AS "인용된 노트 수",
  file.mtime AS "수정"
FROM "00_Knowledge/claims"
SORT length(file.inlinks) DESC
```

---

## 7. 내 결과

```dataview
TABLE WITHOUT ID
  file.link AS "실험", tuning_method AS "튜닝",
  scr_range AS "SCR", xr_range AS "X/R", validation_level AS "검증"
FROM "00_Knowledge/mine"
SORT file.name DESC
```

---

## 쿼리가 빈 표를 뱉을 때

1. **경로** — `.obsidian`이 있는 폴더가 볼트 루트다. 여기서는 `GFM_Research`이므로
   경로는 `00_Knowledge/...`로 시작한다. 볼트를 상위 폴더로 다시 열면 접두어가 붙는다.
2. **frontmatter 키 누락** — 키가 없으면 그 행은 조건에서 탈락한다.
   값이 없어도 키는 남기고 `미명시`를 넣을 것.
3. **Dataview 플러그인** — 커뮤니티 플러그인에서 설치·활성화됐는지 확인.
4. **문자열 비교** — `validation_level: CHIL`과 `"CHIL"`은 같지만 `chil`은 다르다.
   frontmatter 값의 대소문자를 템플릿과 맞출 것.
