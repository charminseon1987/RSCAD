# 논문 읽기 스킬 2종 — paper-translate · equation-explain

기존 paper-agent 스킬(ieee-citation · paper-note · research-gap · thesis-writing)에 "읽기" 쪽을 보탠다.

## 설치
1. 두 폴더를 `paper-agent/.claude/skills/` 에 복사 (RSCAD 저장소에서도 쓰려면 `RSCAD/.claude/skills/` 에도).
2. `pip install pdfplumber sympy`
3. Claude Code에서 `/skills` → 목록에 두 개가 보이면 완료.

## 사용 예
- "이 PDF 초록이랑 서론 번역해줘" → paper-translate (문단 1:1, 용어집 적용)
- "식 (5) 설명해줘" / 수식 캡처 붙여넣기 → equation-explain
- "Fig. 7 근궤적 해석해줘" → equation-explain (그림 해설)

## 스크립트 단독 실행
```bash
python .claude/skills/paper-translate/scripts/pdf_paragraphs.py paper.pdf -o paras.md --pages 1-3
python .claude/skills/equation-explain/scripts/symbols_check.py "J \frac{d\omega}{dt} = P^* - P - D_p(\omega-\omega_0)" \
  --units "J=kg*m**2, omega=1/s, P=W, D_p=W*s, t=s"
```
위 예시는 일부러 단위가 안 맞는 식이다 — 좌변에 ω_0 가 빠진 걸 ✗로 잡아낸다.

## 스콜라 웹앱 연동
두 스킬 모두 JSON 출력 형식이 정의돼 있다 (SKILL.md "출력 형식").
- 번역: `{"id","src","ko","note"}` 배열 → 원문/번역 나란히 보기 화면
- 수식: `{"target","latex","symbols","meaning","assumptions","units_ok","link_to_my_research"}` → 수식 클릭 시 팝업

## 유지보수
- 새 용어 → `paper-translate/references/glossary.md` (번역 끝에 "용어집 추가 후보"로 나옴)
- 새 기호 → `equation-explain/references/symbols.md`
