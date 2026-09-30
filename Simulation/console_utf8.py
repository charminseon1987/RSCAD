"""console_utf8.py — 콘솔 출력을 UTF-8 로 맞춘다 (import 만으로 적용).

Windows 콘솔 기본 인코딩(cp949)은 💾 ✅ ⚠️ 를 찍지 못한다. Simulation/ 의 스크립트
대부분이 이런 이모지를 print 하므로, 맨손으로 실행하면 계산을 다 끝낸 뒤 마지막
print 에서 UnicodeEncodeError 로 죽는다. 산출물은 이미 저장된 상태로 exit 1 이 되어
성공인지 실패인지 헷갈리는 것이 더 나쁘다.

    File "Simulation/pf_export.py", line 167, in main
        print(f'\\n  \\U0001f4be results/{d.name}/participation_factors.json')
    UnicodeEncodeError: 'cp949' codec can't encode character '\\U0001f4be'

PYTHONIOENCODING=utf-8 을 매번 붙이는 대신 여기서 한 번 처리한다.
Server/app.py 는 같은 처리를 자기 안에 갖고 있다 (중복 호출은 무해하다).

사용 — 파일 상단 import 블록에:

    import console_utf8  # noqa: F401 — stdout/stderr 을 UTF-8 로

model.py 가 이미 import 하므로, model 을 쓰는 스크립트는 따로 넣지 않아도 된다.
"""

import sys

for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding='utf-8')       # type: ignore[union-attr]
    except (AttributeError, ValueError):            # 리다이렉트·파이프된 스트림 등
        pass
