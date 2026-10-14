"""console_utf8.py — 콘솔 출력을 UTF-8 로 맞춘다 (import 만으로 적용).

Simulation/console_utf8.py 와 같은 처리의 Scripts/ 쪽 사본이다. RAG 파이프라인은
Simulation/ 에 의존하지 않으므로 import 경로를 끌어오지 않고 여기에 둔다
(Server/app.py 도 같은 처리를 자기 안에 갖고 있다 — 중복 호출은 무해하다).

Windows 콘솔 기본 인코딩(cp949)이 못 찍는 것이 두 종류 있다:

  · 진행 표시 이모지 — 💾 ✅ ⚠️
  · 말뭉치 본문에 섞인 수식 문자 — 𝐻 𝜃 ≡ (PDF 에서 추출된 그대로 출력될 때)

둘 다 계산이 끝난 **마지막 print** 에서 터진다. 03_eval.py 는 점수를 다 내고
eval_section.json 까지 저장한 뒤 exit 1 이 되어, 성공인지 실패인지 헷갈리는 상태로
끝났다. 산출물이 남았는데 실패로 보이는 것이 더 나쁘다.

    File "Scripts/03_eval.py", line 167, in main
        print(f'\n  \U0001f4be {out}')
    UnicodeEncodeError: 'cp949' codec can't encode character '\U0001f4be'

사용 — 파일 상단 import 블록에:

    import console_utf8  # noqa: F401 — stdout/stderr 을 UTF-8 로
"""

import sys

for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding='utf-8')       # type: ignore[union-attr]
    except (AttributeError, ValueError):            # 리다이렉트·파이프된 스트림 등
        pass
