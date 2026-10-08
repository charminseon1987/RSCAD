#!/usr/bin/env python3
"""런을 만든 코드와 환경을 기록한다.

왜 — 런 이름 해시는 **파라미터** 정체성이다. 같은 파라미터라도 코드가 바뀌면 다른
결과인데 폴더 이름이 같다. 심사에서 "이 그림은 어느 코드로 뽑았나" 를 물으면
지금은 답할 수단이 없다.

git SHA 를 런 이름 해시에 넣지 않는 이유 — 넣으면 커밋할 때마다 같은 파라미터가
새 폴더를 만든다. 기존 런이 전부 고아가 되고, PSO 가 같은 점을 재탐색할 때
캐시가 듣지 않는다. 코드 정체성은 meta.json 에 **기록**하는 것으로 족하다.

SHA 만으로는 모자라는 이유 — 작업 트리가 더러우면(커밋 안 한 수정) SHA 가 거짓말을
한다. 그래서 수치를 결정하는 모듈의 내용 해시를 따로 뜬다. 이건 거짓말을 못 한다.
"""
from __future__ import annotations

import hashlib
import platform
import subprocess
import sys
from pathlib import Path

#  결과 수치를 실제로 결정하는 모듈. 여기 것이 바뀌면 같은 파라미터라도 다른 런이다.
#  (플롯·기록 모듈은 넣지 않는다 — 숫자를 바꾸지 않는다.)
NUMERIC_SOURCES = ('model.py', 'op.py', 'runner.py', 'metrics.py')

#  수치가 버전 간에 달라질 수 있는 것만. 전부 적으면 노이즈가 된다.
NUMERIC_PACKAGES = ('numpy', 'scipy', 'sympy')


def _git(*args: str, cwd: Path) -> str | None:
    try:
        r = subprocess.run(('git',) + args, cwd=cwd, capture_output=True,
                           text=True, timeout=5)
        return r.stdout.strip() if r.returncode == 0 else None
    except Exception:              # noqa: BLE001 — git 이 없어도 런은 돌아야 한다
        return None


def code_hash(src_dir: Path) -> dict:
    """수치 결정 모듈의 내용 해시. 커밋 여부와 무관하게 '지금 이 코드' 를 가리킨다."""
    h = hashlib.sha256()
    files = {}
    for name in sorted(NUMERIC_SOURCES):
        p = src_dir / name
        if not p.is_file():
            files[name] = None
            continue
        b = p.read_bytes()
        files[name] = hashlib.sha256(b).hexdigest()[:12]
        h.update(name.encode())
        h.update(b)
    return {'combined': h.hexdigest()[:16], 'files': files}


def packages() -> dict:
    import importlib.metadata as md
    out = {}
    for p in NUMERIC_PACKAGES:
        try:
            out[p] = md.version(p)
        except Exception:          # noqa: BLE001
            out[p] = None
    return out


#  한 프로세스 안에서는 코드가 바뀌지 않는다. git 호출이 Windows 에서 호출당
#  0.4~0.9초라 스윕마다 다시 묻지 않는다.
_CACHE: dict | None = None


def collect(src_dir: Path | None = None, use_cache: bool = True) -> dict:
    """meta.json 에 박을 출처 블록. 어떤 이유로도 예외를 내지 않는다."""
    global _CACHE
    if use_cache and _CACHE is not None:
        return dict(_CACHE)
    try:
        src_dir = Path(src_dir) if src_dir else Path(__file__).resolve().parent
        repo = src_dir.parent

        sha = _git('rev-parse', 'HEAD', cwd=repo)

        # 더러움 판정은 **수치를 결정하는 파일로 좁힌다**. 두 가지 이유다.
        #  1) 의미 — 노트나 웹 코드가 바뀐 것은 이 런의 숫자와 무관하다. 그걸로
        #     'dirty' 를 띄우면 거의 모든 런이 항상 dirty 가 되어 경고가 죽는다.
        #  2) 속도 — 이 저장소 전체에 git status 를 돌리면 10초를 넘긴다
        #     (chroma 색인 22MB, node_modules). 매 런에 그 값을 치를 이유가 없다.
        #     경로를 지정하면 즉시 끝난다.
        paths = [f'Simulation/{n}' for n in NUMERIC_SOURCES]
        status = _git('status', '--porcelain', '--', *paths, cwd=repo)
        # status 가 None 이면 git 을 못 쓴 것 — '깨끗하다' 고 단정하지 않는다.
        dirty = None if status is None else bool(status)

        out = {
            'git_sha': sha,
            'git_sha_short': sha[:9] if sha else None,
            'git_branch': _git('rev-parse', '--abbrev-ref', 'HEAD', cwd=repo),
            'git_dirty': dirty,
            'code_hash': code_hash(src_dir),
            'python': sys.version.split()[0],
            'platform': platform.platform(),
            'packages': packages(),
        }
        if dirty:
            # 더러운 트리에서 돈 런은 SHA 만으로 되살릴 수 없다. 그 사실을 남긴다.
            out['warning'] = ('수치 결정 모듈에 커밋하지 않은 수정이 있는 상태로 돌았다 — '
                              'git_sha 만으로는 이 런을 재현할 수 없다. code_hash 를 쓸 것.')
            # porcelain 은 'XY path' — 상태 2칸 + 공백 1칸. 경로가 잘리지 않게
            # 자르지 말고 쪼갠다 (예전 코드가 l[3:] 로 첫 글자를 먹었다).
            out['git_dirty_files'] = [
                l.split(maxsplit=1)[1] if len(l.split(maxsplit=1)) > 1 else l
                for l in (status or '').splitlines()]
        if use_cache:
            _CACHE = dict(out)
        return out
    except Exception as e:          # noqa: BLE001
        return {'error': f'{type(e).__name__}: {e}'}


if __name__ == '__main__':
    import json
    print(json.dumps(collect(), ensure_ascii=False, indent=2))
