# lab-scholar — 연구실 스콜라

전력계통(GFM 인버터 안정도 · ZEB PV/BIPV) 연구용 개인 논문 서비스.
**Claude Code = 두뇌(검색 판단·요약·답변 생성), 웹앱 = 보기·편집·정리 화면.**
둘은 같은 백엔드를 공유한다: 백엔드는 REST API(웹용)와 MCP 서버(Claude Code용)를 동시에 제공한다.

## 필독 문서
- `docs/SPEC.md` — 아키텍처, DB 스키마, API·MCP 도구 명세, 단계별 완료 기준
- `docs/design/scholar-prototype.html` — 확정된 화면 시안 (브라우저로 열어 확인). UI는 이 시안을 기준으로 구현
- `reference/paper_agent.py` — 검증된 검색·스노볼링·스코어링 로직. **새로 짜지 말고 모듈로 이식**
- `reference/doi2ieee.py` — IEEE 인용 변환 로직. 그대로 이식

## 개발 원칙 (반드시 지킬 것)
1. **단계 게이팅**: `docs/SPEC.md`의 Stage 순서대로만 진행한다. 한 Stage의 완료 기준을 모두 통과하고 사용자 확인을 받기 전에는 다음 Stage 코드를 쓰지 않는다. Stage를 합치지 않는다.
2. 각 Stage 시작 시 계획(만들 파일 목록, 테스트 방법)을 먼저 보여주고 승인을 받는다.
3. 각 Stage 끝에 `docs/CHANGELOG.md`에 "무엇을 / 어떻게 검증했나 / 남은 이슈"를 추가한다.
4. 구버전 코드는 삭제하지 않고 `_archive/`로 옮긴다.
5. 테스트: 백엔드는 pytest. 외부 API(OpenAlex 등)는 테스트에서 모킹하고, 실제 호출 테스트는 `-m live` 마커로 분리한다.

## 정확성 규칙 (논문 서비스의 핵심)
- 서지정보(저널·연도·볼륨·페이지·DOI)는 API 응답에서만 채운다. 없으면 `null`로 두고 UI에 "미검증" 표시. 추측 금지.
- 답변 문장은 두 종류만 허용: `fact`(▸, 출처 논문 번호 1개 이상 필수) / `interp`(※, AI 종합 해석). 출처 없는 fact는 저장 거부.
- 유료 저널 PDF 자동 다운로드 금지. 오픈액세스(OpenAlex·Unpaywall·arXiv)만 저장.
- Google Scholar 스크래핑 금지.

## 환경
- Windows + Git Bash(MINGW64), Cursor, Python 3.12, Node 20+, Docker Desktop
- 경로·줄바꿈은 Windows에서도 동작하게 작성 (pathlib 사용, `.gitattributes`로 LF 고정)
- 비밀값은 `.env` (git 제외), 예시는 `.env.example`

## 코드 스타일
- 백엔드: FastAPI + SQLAlchemy 2.x + Alembic, Pydantic v2, 타입 힌트 필수
- MCP: 공식 Python SDK(`mcp`)의 FastMCP, Streamable HTTP로 `/mcp`에 마운트
- 프론트: Next.js(App Router) + TypeScript + Tailwind. 색·폰트 토큰은 시안의 CSS 변수를 그대로 가져온다
- 한국어 UI 문구는 시안의 표현을 따른다

## 커뮤니케이션
- 한국어로, 결론 먼저 → 이유.
- 막히면 추측으로 진행하지 말고 선택지를 제시하고 묻는다.
