"""console_utf8.py — 콘솔 출력을 UTF-8 로 맞춘다 (import 만으로 적용).

Simulation/ · Scripts/ 쪽 사본과 같은 처리의 tools/ 쪽 사본이다. 세 폴더가 서로
import 하지 않도록 사본을 둔다 (Server/app.py 도 자기 안에 같은 처리를 갖고 있다 —
중복 호출은 무해하다).

Windows 콘솔 기본 인코딩(cp949)이 못 찍는 것이 두 종류 있다:

  · 진행 표시 이모지 — 💾 ✅ ⚠️
  · 논문 본문·주장 문장에 섞인 문자 — em-dash(—) · 수식 기호(𝐻 𝜃 ≡)

둘 다 일을 다 끝낸 **마지막 print** 에서 터진다. ce_tool.py validate 는 레코드를
전부 검증하고 경고를 찍다가 em-dash 에서 UnicodeEncodeError 로 죽었다 — 검증은
통과했는데 실패로 보이는 상태다. 03_eval.py 가 같은 식으로 죽은 것과 같은 원인이다.

사용 — 파일 상단 import 블록에:

    import console_utf8  # noqa: F401 — stdout/stderr 을 UTF-8 로
"""

import sys

for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding='utf-8')       # type: ignore[union-attr]
    except (AttributeError, ValueError):            # 리다이렉트·파이프된 스트림 등
        pass
