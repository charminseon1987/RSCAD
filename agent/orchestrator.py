"""
orchestrator.py — 연구소장 오케스트레이터

비서(텔레그램/광장)로부터 자연어 명령을 받아 적절한 에이전트에 분배하고,
결과를 요약하여 반환한다. 실험 완료 시 일지 MD 노트를 자동 생성한다.

흐름:
  텔레그램 → 비서 → POST /api/command → orchestrator.dispatch()
  → experiment.py / research.py → 결과 → 일지 노트 생성 → 요약 반환

실행:
  python agent/orchestrator.py "SCR 1.5에서 안정도 분석해줘"
  python agent/orchestrator.py --agent experiment "SCR 3.0 2.0 1.5 스윕"
  python agent/orchestrator.py --agent research "DC-AC 커플링 논문 찾아줘"

조연호 · 연세대 스마트그리드 연구실
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path

from core import DEFAULT_MODEL   # 기본 모델은 core 한 곳에서만 정한다

ROOT = Path(__file__).resolve().parent.parent

# ══════════════════════════════════════════════
# 에이전트 라우팅
# ══════════════════════════════════════════════

AGENT_MAP = {
    'experiment': {
        'script': 'agent/experiment.py',
        'keywords': ['스윕', 'sweep', 'SCR', 'XR', 'X/R', '야코비안', 'jacobian',
                     '안정도', 'stability', '고유값', 'eigenvalue', '참여계수',
                     'participation', '동기화', 'sync', '선형화', 'linearization',
                     '실험', 'experiment', '분석', 'analysis', '감쇠', 'damping',
                     'σ', 'sigma', 'ζ', 'zeta', '정착시간', 'settling'],
        'emoji': '💻',
        'name': '시뮬엔지니어',
    },
    'research': {
        'script': 'agent/research.py',
        'keywords': ['논문', 'paper', '문헌', 'literature', '검색', 'search',
                     '찾아', 'find', '리뷰', 'review', '인용', 'citation',
                     'IEEE', 'DOI', '저자', 'author'],
        'emoji': '📚',
        'name': '문헌추적자',
    },
    'rag_manager': {
        'script': 'agent/rag_manager.py',
        'keywords': ['색인', 'index', '청크', 'chunk', '임베딩', 'embed',
                     'RAG', 'rag', '벡터', 'vector', '리랭커', 'rerank',
                     '평가셋', 'eval', 'recall', 'MRR', 'nDCG',
                     '재구축', 'rebuild', '파이프라인', 'pipeline',
                     '청킹', '색인 만들', '검색 품질'],
        'emoji': '🔎',
        'name': 'RAG관리자',
    },
}


def detect_agent(command: str) -> str:
    """명령어에서 키워드를 감지하여 적절한 에이전트를 선택한다."""
    command_lower = command.lower()
    scores = {}
    for agent_id, info in AGENT_MAP.items():
        score = sum(1 for kw in info['keywords'] if kw.lower() in command_lower)
        if score > 0:
            scores[agent_id] = score

    if not scores:
        return 'experiment'  # 기본값: 실험 에이전트
    return max(scores, key=scores.get)


# ══════════════════════════════════════════════
# 에이전트 실행
# ══════════════════════════════════════════════

def run_agent(agent_id: str, command: str, model: str | None = None,
              auto: bool = True, timeout: int = 900) -> dict:
    """에이전트를 subprocess로 실행하고 결과를 반환한다."""
    info = AGENT_MAP.get(agent_id)
    if not info:
        return {'ok': False, 'error': f'알 수 없는 에이전트: {agent_id}',
                'agent': agent_id}

    script = str(ROOT / info['script'])
    cmd = [sys.executable, script, '--model', model, '--auto', command]

    start = time.time()
    try:
        r = subprocess.run(
            cmd, cwd=str(ROOT), capture_output=True, text=True,
            timeout=timeout, encoding='utf-8', errors='replace')
    except subprocess.TimeoutExpired:
        return {'ok': False, 'error': f'{timeout}초 초과',
                'agent': agent_id, 'elapsed': timeout}
    except FileNotFoundError:
        return {'ok': False, 'error': f'스크립트 없음: {info["script"]}',
                'agent': agent_id}

    elapsed = round(time.time() - start, 1)
    stdout = (r.stdout or '')[-3000:]
    stderr = (r.stderr or '')[-500:]

    # 결론 추출: "[N] 결론" 이후의 텍스트
    conclusion = ''
    lines = stdout.split('\n')
    in_conclusion = False
    for line in lines:
        if '결론' in line and re.match(r'\s*\[\d+\]', line):
            in_conclusion = True
            continue
        if in_conclusion:
            conclusion += line.strip() + '\n'

    if not conclusion.strip():
        # 마지막 비어있지 않은 줄 몇 개를 가져옴
        non_empty = [l.strip() for l in lines if l.strip()]
        conclusion = '\n'.join(non_empty[-5:])

    return {
        'ok': r.returncode == 0,
        'agent': agent_id,
        'agent_name': info['name'],
        'agent_emoji': info['emoji'],
        'command': command,
        'conclusion': conclusion.strip(),
        'elapsed': elapsed,
        'stdout': stdout,
        'stderr': stderr if not r.returncode == 0 else '',
    }


# ══════════════════════════════════════════════
# 일지 노트 자동 생성
# ══════════════════════════════════════════════

def generate_note(result: dict) -> Path | None:
    """실험 결과를 Obsidian 실험 노트로 자동 생성한다."""
    if not result.get('ok'):
        return None

    now = datetime.now()
    date_str = now.strftime('%Y-%m-%d')
    time_str = now.strftime('%H:%M')
    slug = re.sub(r'[^\w가-힣]', '_', result['command'][:30]).strip('_')

    # Phase 폴더 결정 (현재 진행 중인 Phase)
    vault = ROOT / 'GFM_Research'
    note_dir = vault / 'RSCAD' / 'Phase03'
    note_dir.mkdir(parents=True, exist_ok=True)

    filename = f"EXP_{now.strftime('%Y%m%d')}_{slug}.md"
    note_path = note_dir / filename

    content = f"""---
type: experiment
date: {date_str}
time: {time_str}
agent: {result['agent']}
agent_name: {result['agent_name']}
command: "{result['command']}"
elapsed: {result['elapsed']}s
status: {'success' if result['ok'] else 'failed'}
tags: [experiment, auto-generated, {result['agent']}]
---

# 🧪 실험: {result['command'][:60]}

> 에이전트: {result['agent_emoji']} {result['agent_name']}
> 실행시간: {result['elapsed']}초
> 생성: {date_str} {time_str} (자동)

---

## ▸ 명령

```
{result['command']}
```

---

## ▸ 결과

{result['conclusion']}

---

## ※ 해석

(자동 생성 노트 — 해석은 연구자가 추가)

---

## 🔗 연결 노트

- [[Phase03_진행중]]
"""
    note_path.write_text(content, encoding='utf-8')
    return note_path


# ══════════════════════════════════════════════
# 디스패치 (Flask에서 호출)
# ══════════════════════════════════════════════

def dispatch(command: str, agent_id: str | None = None,
             model: str | None = None, auto: bool = True) -> dict:
    """명령을 받아 에이전트를 선택·실행하고, 일지 노트를 생성한다.

    반환: {ok, agent, conclusion, note_path, elapsed, ...}
    """
    if not agent_id:
        agent_id = detect_agent(command)

    result = run_agent(agent_id, command, model=model, auto=auto)

    note_path = None
    if result['ok']:
        p = generate_note(result)
        if p:
            note_path = str(p.relative_to(ROOT))

    result['note_path'] = note_path
    return result


# ══════════════════════════════════════════════
# CLI
# ══════════════════════════════════════════════

def main():
    ap = argparse.ArgumentParser(description='연구소장 오케스트레이터')
    ap.add_argument('command', nargs='+', help='자연어 명령')
    ap.add_argument('--agent', choices=list(AGENT_MAP), default=None,
                    help='에이전트 직접 지정 (생략 시 자동 감지)')
    ap.add_argument('--model', default=DEFAULT_MODEL)
    ap.add_argument('--no-note', action='store_true', help='일지 노트 생성 생략')
    args = ap.parse_args()

    command = ' '.join(args.command)
    agent_id = args.agent or detect_agent(command)
    info = AGENT_MAP[agent_id]

    print(f'  🧭 연구소장: "{command}"')
    print(f'  → {info["emoji"]} {info["name"]}에 배분합니다\n')

    result = run_agent(agent_id, command, model=args.model, auto=True)

    if result['ok']:
        print(f'\n  ✅ {info["name"]} 완료 ({result["elapsed"]}초)')
        print(f'  결론:')
        for line in result['conclusion'].split('\n')[:10]:
            print(f'    {line}')

        if not args.no_note:
            p = generate_note(result)
            if p:
                print(f'\n  📋 일지 노트: {p.relative_to(ROOT)}')
    else:
        print(f'\n  ❌ 실패: {result.get("error", result.get("stderr", ""))}')


if __name__ == '__main__':
    main()
