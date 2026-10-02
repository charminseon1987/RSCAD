"""
Server/llm.py — 글을 쓰는 모델 한 곳

  기준은 **로컬 Ollama** 다. 원문이 기기 밖으로 나가지 않는 것이 이 저장소의
  기본값이고, 그래서 화면도 그렇게 적혀 있다. Claude 는 골라서 쓰는 쪽이다.

  엔진을 둘 두는 이유
    로컬  qwen3 는 느리고(답 하나 1~8분) 가끔 지어낸다. 실제로 4b 가 IBR 을
          '인공지능 기반 리더' 로 풀고 [@salem2025gfmreview] 를 망가뜨렸다.
    원격  Claude 는 빠르고 정확하지만 **고른 대목이 Anthropic 으로 나간다**.
          공짜가 아니고, 지금 이 계정은 크레딧이 없어 호출이 거절된다.

  그래서 고르게 하되, 고른 결과를 숨기지 않는다.
    - 어느 엔진으로 썼는지 답마다 함께 돌려준다 (engine·model). 노트에도 적힌다.
    - 원격을 쓸 때는 '밖으로 나간다' 는 사실을 화면이 먼저 말한다.
    - 못 쓰는 엔진은 왜 못 쓰는지 그대로 보여 준다 — 조용히 다른 엔진으로
      바꿔치기하지 않는다. 느린 줄 알았는데 밖으로 나가고 있으면 안 된다.
"""

from __future__ import annotations

import os
import pathlib
import re
import time

import requests

from scholar import ROOT

# ── 로컬 ──
OLLAMA_CHAT = 'http://localhost:11434/api/chat'
OLLAMA_TAGS = 'http://localhost:11434/api/tags'

# ── 원격 ──
ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'
ANTHROPIC_VERSION = '2023-06-01'
CLAUDE_MODEL = os.environ.get('GFM_CLAUDE_MODEL', 'claude-sonnet-5')

DEFAULT_ENGINE = os.environ.get('GFM_LLM_ENGINE', 'local')

# qwen3 는 생각 과정을 길게 쓴다. 어시스턴트 턴을 미리 열어 두면 그 서두를
# 건너뛴다 — think=false 도 /no_think 도 듣지 않아서 이 방법을 쓴다.
STOP = ['Okay,', 'Let me', 'Wait,', 'First,', 'The user', 'Hmm']

THINK_PAIR = re.compile(r'<think>.*?</think>\s*', re.S)
# 여는 태그 없이 닫기만 하는 경우가 있다 (프리필로 턴을 열어 두면 그렇게 된다).
CLOSE_THINK = re.compile(r'(?s)^.*</think>\s*')


def clean_answer(text: str) -> str:
    """생각 과정을 떼어낸다. 닫는 태그가 있으면 그 뒤만 답이다."""
    if '</think>' in text:
        text = CLOSE_THINK.sub('', text)
    return THINK_PAIR.sub('', text).strip()


# ═══════════════════════════════════════════════
# 설정 — 키는 web/.env 에 있다 (gitignore 에 걸려 있어 커밋되지 않는다)
# ═══════════════════════════════════════════════
def _dotenv() -> dict:
    out = {}
    fp = ROOT / 'web' / '.env'
    if not fp.exists():
        return out
    try:
        for line in fp.read_text(encoding='utf-8').splitlines():
            if '=' in line and not line.strip().startswith('#'):
                k, v = line.split('=', 1)
                # 키 이름 끝에 공백이 붙어 있는 경우가 있다 — 떼고 읽는다
                out[k.strip()] = v.strip().strip('"').strip("'")
    except OSError:
        pass
    return out


def _claude_cfg() -> dict:
    env = _dotenv()
    return {
        'key': os.environ.get('ANTHROPIC_API_KEY') or env.get('ANTHROPIC_API_KEY', ''),
        # 조직 키는 워크스페이스를 지정해야 한다. 없으면 400 이 난다.
        'workspace': (os.environ.get('ANTHROPIC_WORKSPACE_ID')
                      or env.get('ANTHROPIC_WORKSPACE_ID', '')),
        'model': CLAUDE_MODEL,
    }


def local_model() -> str:
    """agent/core.py 의 DEFAULT_MODEL 한 곳에서만 정한다."""
    import sys
    d = str(ROOT / 'agent')
    if d not in sys.path:
        sys.path.insert(0, d)
    try:
        from core import DEFAULT_MODEL
        return DEFAULT_MODEL
    except Exception:                                        # noqa: BLE001
        return os.environ.get('GFM_AGENT_MODEL', 'qwen3:4b')


# ═══════════════════════════════════════════════
# 상태 — 무엇을 쓸 수 있고, 못 쓰면 왜인지
# ═══════════════════════════════════════════════
def local_status() -> dict:
    model = local_model()
    try:
        r = requests.get(OLLAMA_TAGS, timeout=3)
        if r.status_code != 200:
            return {'ok': False, 'model': model, 'msg': f'Ollama 응답 {r.status_code}'}
        names = [m['name'] for m in r.json().get('models', [])]
        base = model.split(':')[0]
        have = model in names or any(n.split(':')[0] == base for n in names)
        return {'ok': have, 'model': model, 'models': names,
                'msg': '' if have else f'{model} 가 없습니다 — `ollama pull {model}`'}
    except requests.RequestException:
        return {'ok': False, 'model': model, 'models': [],
                'msg': 'Ollama 가 꺼져 있습니다 — 터미널에서 `ollama serve`'}


# 찔러 본 결과를 잠깐 기억한다. 키가 있다고 쓸 수 있는 게 아니다 —
# 크레딧이 떨어지면 키는 멀쩡해도 거절당한다. 그걸 '사용 가능' 으로 띄우면
# 눌러 보고 나서야 알게 된다. 그렇다고 상태를 볼 때마다 부르면 낭비다.
_probe: dict = {'at': 0.0, 'ok': False, 'msg': '', 'done': False}
PROBE_TTL = float(os.environ.get('GFM_CLAUDE_PROBE_TTL', '300'))


def claude_status(probe: bool = True) -> dict:
    """Claude 를 실제로 쓸 수 있는지. 키·워크스페이스가 있어도 한 번 불러 봐야 안다."""
    c = _claude_cfg()
    if not c['key']:
        return {'ok': False, 'model': c['model'], 'probed': False,
                'msg': 'ANTHROPIC_API_KEY 가 없습니다 — web/.env 에 넣으세요'}
    if not c['workspace']:
        return {'ok': False, 'model': c['model'], 'probed': False,
                'msg': ('조직 키라 워크스페이스가 필요합니다 — '
                        'web/.env 에 ANTHROPIC_WORKSPACE_ID 를 넣으세요')}
    if not probe:
        return {'ok': True, 'model': c['model'], 'msg': '', 'probed': False}

    fresh = _probe['done'] and (time.time() - _probe['at']) < PROBE_TTL
    if not fresh:
        r = _claude_call(c, system='한 단어로 답하세요.',
                         messages=[{'role': 'user', 'content': 'ping'}],
                         max_tokens=8, timeout=20)
        _probe.update({'at': time.time(), 'ok': r['ok'],
                       'msg': r.get('error', ''), 'done': True})
    return {'ok': _probe['ok'], 'model': c['model'], 'msg': _probe['msg'],
            'probed': True, 'checked_ago': int(time.time() - _probe['at'])}


def status(probe_claude: bool = True) -> dict:
    """무엇을 쓸 수 있는지. 못 쓰면 왜인지까지 — 눌러 보고 알게 하지 않는다."""
    return {'default': DEFAULT_ENGINE,
            'local': local_status(),
            'claude': claude_status(probe_claude),
            # 원격을 쓰면 원문이 밖으로 나간다. 화면이 이 문장을 그대로 띄운다.
            'remote_warning': '고른 대목이 Anthropic 서버로 전송됩니다'}


# ═══════════════════════════════════════════════
# 호출
# ═══════════════════════════════════════════════
def _local_call(system, messages, prefill, max_tokens, timeout, temperature) -> dict:
    model = local_model()
    msgs = ([{'role': 'system', 'content': system}] if system else []) + list(messages)
    if prefill:
        msgs.append({'role': 'assistant', 'content': prefill})
    body = {'model': model, 'stream': False, 'think': False, 'messages': msgs,
            'options': {'temperature': temperature, 'num_predict': max_tokens, 'stop': STOP}}
    try:
        r = requests.post(OLLAMA_CHAT, json=body, timeout=timeout)
    except requests.Timeout:
        return {'ok': False, 'engine': 'local', 'model': model,
                'error': f'{timeout}초 안에 답이 오지 않았습니다 — {model} 는 이 기기에서 '
                         '느립니다. 질문을 짧게 하거나 ‘검색만’ 을 쓰세요'}
    except requests.RequestException as e:
        return {'ok': False, 'engine': 'local', 'model': model,
                'error': f'Ollama 호출 실패 ({type(e).__name__}) — `ollama serve` 확인'}
    if r.status_code != 200:
        return {'ok': False, 'engine': 'local', 'model': model,
                'error': f'Ollama 응답 {r.status_code}: {r.text[:200]}'}
    j = r.json()
    text = clean_answer((prefill or '') + ((j.get('message') or {}).get('content') or ''))
    return {'ok': True, 'engine': 'local', 'model': model, 'text': text,
            'truncated': j.get('done_reason') == 'length'}


def _claude_call(cfg, system, messages, max_tokens=800, timeout=120,
                 temperature=0.2, prefill='') -> dict:
    msgs = list(messages) + ([{'role': 'assistant', 'content': prefill}] if prefill else [])
    body = {'model': cfg['model'], 'max_tokens': max_tokens, 'temperature': temperature,
            'messages': msgs}
    if system:
        body['system'] = system
    headers = {'content-type': 'application/json', 'x-api-key': cfg['key'],
               'anthropic-version': ANTHROPIC_VERSION}
    if cfg['workspace']:
        headers['anthropic-workspace-id'] = cfg['workspace']
    try:
        r = requests.post(ANTHROPIC_URL, json=body, headers=headers, timeout=timeout)
    except requests.RequestException as e:
        return {'ok': False, 'engine': 'claude', 'model': cfg['model'],
                'error': f'Claude 호출 실패 ({type(e).__name__})'}
    if r.status_code != 200:
        try:
            msg = r.json()['error']['message']
        except Exception:                                    # noqa: BLE001
            msg = r.text[:200]
        return {'ok': False, 'engine': 'claude', 'model': cfg['model'],
                'error': f'Claude {r.status_code}: {msg}'}
    j = r.json()
    text = ''.join(b.get('text', '') for b in j.get('content', []) if b.get('type') == 'text')
    return {'ok': True, 'engine': 'claude', 'model': cfg['model'],
            'text': ((prefill or '') + text).strip(),
            'truncated': j.get('stop_reason') == 'max_tokens',
            'usage': j.get('usage')}


def complete(system: str, messages: list, engine: str = None, prefill: str = '',
             max_tokens: int = 600, timeout: int = 300, temperature: float = 0.2) -> dict:
    """글 하나를 받아 온다. 어느 엔진으로 썼는지 함께 돌려준다.

    고른 엔진이 안 되면 **다른 엔진으로 바꿔치기하지 않는다.** 느린 줄 알았는데
    원문이 밖으로 나가고 있거나, 밖으로 안 나가는 줄 알았는데 나가 있으면
    안 되기 때문이다. 안 되는 이유를 그대로 돌려주고 사람이 고르게 한다.
    """
    eng = (engine or DEFAULT_ENGINE).lower()
    if eng == 'claude':
        cfg = _claude_cfg()
        st = claude_status()
        if not st['ok']:
            return {'ok': False, 'engine': 'claude', 'model': cfg['model'], 'error': st['msg']}
        return _claude_call(cfg, system, messages, max_tokens, timeout, temperature, prefill)
    if eng != 'local':
        return {'ok': False, 'engine': eng, 'model': '', 'error': f'모르는 엔진입니다: {eng}'}
    return _local_call(system, messages, prefill, max_tokens, timeout, temperature)
