"""
core.py — 에이전트 공용 뼈대

두 에이전트(실험·검색)가 공유하는 부분만 담는다.
    도구 등록 · LLM 호출 · 판단 루프 · 승인 게이트 · 기록

설계 원칙
    ▸ 도구는 화이트리스트다. 모델이 임의의 셸 명령을 실행할 수 없다.
    ▸ 부작용이 있는 도구는 승인을 받는다. 계산 시간·디스크를 쓰기 때문이다.
    ▸ 루프에는 반드시 상한이 있다. 로컬 모델은 같은 도구를 반복 호출하는
      경향이 있어, 상한이 없으면 종료하지 않는다.
    ▸ 모든 호출과 결과를 기록한다. 나중에 판단 과정을 되짚어야 한다.

조연호 · 연세대 스마트그리드 연구실
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable

OLLAMA = 'http://localhost:11434/api/chat'

# 기본 모델 — 한 곳에서만 정한다 (예전에는 7개 파일에 'qwen3:8b' 가 흩어져 있었다).
#
# qwen3:8b(5.2 GB)는 16 GB 기기에서 웹 개발 서버(Vite + esbuild)·Flask 와 함께 쓰면
# 메모리가 모자라 서로를 죽인다. 실제로 이 저장소 작업 중 개발 서버가 네 번 종료됐다.
# qwen3:4b 는 같은 계열이라 프롬프트 거동이 비슷하면서 절반 이하다.
#
# 더 작은 모델(1.7b 급)로 더 내리지 않은 이유: 이 에이전트는 도구 호출(tools)에
# 의존하는데, 그 크기에서는 도구 인자를 자주 틀린다.
#
# 바꾸려면 코드를 고치지 말고 환경변수를 쓴다:
#   GFM_AGENT_MODEL=qwen3:8b ,qwen3:4b  python agent/orchestrator.py ... 
DEFAULT_MODEL = os.environ.get('GFM_AGENT_MODEL', 'qwen3:8b')


# ══════════════════════════════════════════════
# 도구
# ══════════════════════════════════════════════
@dataclass
class Tool:
    """모델이 호출할 수 있는 함수 하나.

    schema 는 OpenAI 함수 호출 규격을 따른다. Ollama 가 같은 형식을 쓴다.
    mutates 가 True 면 실행 전에 사용자 승인을 받는다.
    """
    name: str
    desc: str
    params: dict                    # JSON schema properties
    required: list[str]
    fn: Callable[..., Any]
    mutates: bool = False           # 계산·파일쓰기 등 부작용 여부

    def schema(self):
        return {
            'type': 'function',
            'function': {
                'name': self.name,
                'description': self.desc,
                'parameters': {
                    'type': 'object',
                    'properties': self.params,
                    'required': self.required,
                },
            },
        }


class Registry:
    def __init__(self):
        self._t: dict[str, Tool] = {}

    def add(self, tool: Tool):
        self._t[tool.name] = tool
        return tool

    def tool(self, name, desc, params, required, mutates=False):
        """데코레이터 형태로 등록한다."""
        def deco(fn):
            self.add(Tool(name, desc, params, required, fn, mutates))
            return fn
        return deco

    def schemas(self):
        return [t.schema() for t in self._t.values()]

    def get(self, name):
        return self._t.get(name)

    def names(self):
        return list(self._t)


# ══════════════════════════════════════════════
# LLM 클라이언트
# ══════════════════════════════════════════════
class Ollama:
    """Ollama /api/chat 클라이언트.

    CPU 추론에서는 응답 하나에 수 분이 걸린다. 특히 qwen3 계열은 답하기 전에
    추론 과정(thinking)을 생성하므로 시간이 두세 배로 늘어난다.
    도구 호출에는 그 과정이 크게 도움이 되지 않으므로 기본적으로 끈다.
    """

    def __init__(self, model=None, url=OLLAMA, temperature=0.2,
                 timeout=900, think=False, num_ctx=8192):
        self.model, self.url = model or DEFAULT_MODEL, url
        self.temperature, self.timeout = temperature, timeout
        self.think, self.num_ctx = think, num_ctx

    def chat(self, messages, tools=None):
        import requests
        body = {
            'model': self.model,
            'messages': messages,
            'stream': False,
            # 판단이 매번 달라지면 재현이 안 된다. 낮게 고정한다.
            # num_ctx 가 크면 CPU 메모리와 시간을 많이 쓴다. 필요한 만큼만.
            'options': {'temperature': self.temperature, 'num_ctx': self.num_ctx},
        }
        # think=False 를 모르는 구버전 서버는 이 키를 무시한다.
        if not self.think:
            body['think'] = False
        if tools:
            body['tools'] = tools
        try:
            r = requests.post(self.url, json=body, timeout=self.timeout)
        except requests.exceptions.ReadTimeout:
            raise TimeoutError(
                f'{self.timeout}초 안에 응답이 없다. CPU 추론이면 정상일 수 있다. '
                f'--timeout 을 늘리거나 더 작은 모델을 쓸 것.') from None
        r.raise_for_status()
        return r.json()['message']


class StubLLM:
    """시험용. 미리 정한 응답을 순서대로 돌려준다."""
    def __init__(self, script):
        self.script, self.i = script, 0

    def chat(self, messages, tools=None):
        m = self.script[min(self.i, len(self.script) - 1)]
        self.i += 1
        return m


# ══════════════════════════════════════════════
# 에이전트
# ══════════════════════════════════════════════
@dataclass
class Agent:
    llm: Any
    reg: Registry
    system: str
    max_steps: int = 12
    auto_approve: bool = False       # True 면 승인 없이 실행 (무인 배치용)
    log_dir: Path | None = None
    transcript: list = field(default_factory=list)

    def _log(self, kind, **kw):
        rec = {'t': time.strftime('%H:%M:%S'), 'kind': kind, **kw}
        self.transcript.append(rec)
        return rec

    def _approve(self, tool: Tool, args: dict) -> bool:
        if not tool.mutates or self.auto_approve:
            return True
        print(f'\n  실행 승인이 필요합니다')
        print(f'    도구  {tool.name}')
        for k, v in args.items():
            print(f'    {k:<10} {v}')
        try:
            return input('    실행할까요? [y/N] ').strip().lower() == 'y'
        except (EOFError, KeyboardInterrupt):
            return False

    def _call(self, name, args):
        tool = self.reg.get(name)
        if tool is None:
            return {'error': f'없는 도구: {name}. 사용 가능: {self.reg.names()}'}
        if not self._approve(tool, args):
            return {'error': '사용자가 실행을 거부했다. 다른 방법을 제안하라.'}
        try:
            return tool.fn(**args)
        except TypeError as e:
            return {'error': f'인수 오류: {e}'}
        except Exception as e:                      # noqa: BLE001
            return {'error': f'{type(e).__name__}: {e}'}

    def run(self, goal: str):
        msgs = [{'role': 'system', 'content': self.system},
                {'role': 'user', 'content': goal}]
        self._log('goal', text=goal)
        print(f'  목표  {goal}\n')

        seen = {}          # 같은 도구·인수 반복 감지
        for step in range(1, self.max_steps + 1):
            try:
                m = self.llm.chat(msgs, self.reg.schemas())
            except Exception as e:                  # noqa: BLE001
                print(f'  ⚠ LLM 호출 실패: {e}')
                self._log('llm_error', error=str(e))
                break

            calls = m.get('tool_calls') or []
            msgs.append(m)

            if not calls:
                text = (m.get('content') or '').strip()
                print(f'\n  [{step}] 결론\n')
                for line in text.splitlines():
                    print(f'    {line}')
                self._log('answer', text=text)
                break

            for c in calls:
                fn = c['function']
                name = fn['name']
                args = fn.get('arguments') or {}
                if isinstance(args, str):
                    args = json.loads(args)

                key = (name, json.dumps(args, sort_keys=True))
                seen[key] = seen.get(key, 0) + 1
                if seen[key] > 2:
                    # 로컬 모델은 같은 호출을 반복하며 멈추지 않는 일이 잦다.
                    out = {'error': '같은 호출을 반복하고 있다. '
                                    '다른 조건을 쓰거나 결론을 내라.'}
                else:
                    print(f'  [{step}] {name}  {json.dumps(args, ensure_ascii=False)}')
                    out = self._call(name, args)

                if isinstance(out, dict) and out.get('error'):
                    print(f'      ⚠ {out["error"]}')
                self._log('tool', name=name, args=args, result=out)
                msgs.append({'role': 'tool', 'content':
                             json.dumps(out, ensure_ascii=False, default=str)})
        else:
            print(f'\n  ⚠ {self.max_steps}단계에 도달해 중단했다.')
            self._log('halt', reason='max_steps')

        if self.log_dir:
            self.log_dir.mkdir(parents=True, exist_ok=True)
            p = self.log_dir / f'run_{time.strftime("%Y%m%d_%H%M%S")}.json'
            p.write_text(json.dumps(
                {'goal': goal, 'model': getattr(self.llm, 'model', 'stub'),
                 'transcript': self.transcript}, ensure_ascii=False, indent=2),
                encoding='utf-8')
            print(f'\n  💾 {p}')
        return self.transcript


# ══════════════════════════════════════════════
# 보조 — 스크립트 실행
# ══════════════════════════════════════════════
def run_script(root: Path, script: str, args: list[str], timeout=1800):
    """지정한 스크립트만 실행한다. 셸을 거치지 않는다.

    shell=False 로 두고 인수를 리스트로 넘기므로, 인수에 무엇이 들어와도
    명령이 합성되지 않는다. 모델이 만든 문자열을 그대로 셸에 넘기면
    임의 명령 실행이 가능해진다.
    """
    cmd = [sys.executable, str(root / script), *map(str, args)]
    try:
        r = subprocess.run(cmd, cwd=root, capture_output=True, text=True,
                           timeout=timeout, encoding='utf-8', errors='replace')
    except subprocess.TimeoutExpired:
        return {'ok': False, 'error': f'{timeout}초 초과'}
    return {'ok': r.returncode == 0,
            'stdout': (r.stdout or '')[-4000:],
            'stderr': (r.stderr or '')[-1500:]}


def check_ollama(model, url='http://localhost:11434/api/tags'):
    """서버가 떠 있고 모델이 받아져 있는지 확인한다."""
    import requests
    try:
        r = requests.get(url, timeout=5)
        r.raise_for_status()
    except Exception:                               # noqa: BLE001
        return False, ('Ollama 서버에 연결할 수 없다. '
                       '`ollama serve` 를 실행했는지 확인할 것.')
    have = [m['name'] for m in r.json().get('models', [])]
    if not any(m == model or m.startswith(model.split(':')[0]) for m in have):
        return False, f'모델 {model} 없음. `ollama pull {model}` 실행. 보유: {have}'
    return True, f'{model} 준비됨'