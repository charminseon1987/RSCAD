"""
rag_manager.py — RAG 파이프라인 관리 에이전트

Scripts/ 의 논문 RAG 파이프라인을 관리한다.
  - 청킹 (01_chunk.py)
  - 색인 (02_index.py)
  - 평가 (03_eval.py)
  - 검색 (search.py)

오케스트레이터에서 키워드 감지로 자동 배분되거나 직접 호출된다.

실행:
    python agent/rag_manager.py "논문 색인 다시 만들어줘"
    python agent/rag_manager.py "검색 품질 평가해줘"
    python agent/rag_manager.py "청크 전략 바꿔서 다시 해봐"
    python agent/rag_manager.py --action search "DC-AC 커플링 상태공간 모델"

조연호 · 연세대 스마트그리드 연구실
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SCRIPTS = ROOT / 'Scripts'
RAG_DIR = ROOT / 'GFM_Research' / '00_Knowledge' / 'rag'
PDF_DIR = ROOT / 'GFM_Research' / '00_Knowledge' / 'papers'

# ── 액션 감지 키워드 ──
ACTION_KEYWORDS = {
    'chunk':  ['청크', 'chunk', '청킹', '분할', '파싱', 'parse'],
    'index':  ['색인', 'index', '임베딩', 'embed', '벡터'],
    'eval':   ['평가', 'eval', '품질', 'quality', 'recall', 'MRR', 'nDCG',
               '리랭커', 'rerank'],
    'search': ['검색', 'search', '찾아', 'find', '근거', '논문 찾'],
    'rebuild': ['다시', 'rebuild', '재구축', '전체', 'full', '처음부터'],
}


def detect_action(command: str) -> str:
    """명령어에서 액션을 감지한다."""
    cl = command.lower()
    scores = {}
    for action, keywords in ACTION_KEYWORDS.items():
        score = sum(1 for kw in keywords if kw.lower() in cl)
        if score > 0:
            scores[action] = score

    if not scores:
        return 'search'
    return max(scores, key=scores.get)


def run_script(script_name: str, args: list[str], timeout: int = 600) -> dict:
    """Scripts/ 의 스크립트를 실행하고 결과를 반환한다."""
    script = SCRIPTS / script_name
    if not script.exists():
        return {'ok': False, 'error': f'스크립트 없음: {script}'}

    cmd = [sys.executable, str(script)] + args
    start = time.time()

    try:
        r = subprocess.run(
            cmd, cwd=str(ROOT), capture_output=True, text=True,
            timeout=timeout, encoding='utf-8', errors='replace',
            env={**__import__('os').environ, 'PYTHONIOENCODING': 'utf-8'})
    except subprocess.TimeoutExpired:
        return {'ok': False, 'error': f'{timeout}초 초과', 'elapsed': timeout}

    elapsed = round(time.time() - start, 1)
    return {
        'ok': r.returncode == 0,
        'stdout': (r.stdout or '')[-3000:],
        'stderr': (r.stderr or '')[-1000:],
        'elapsed': elapsed,
        'returncode': r.returncode,
    }


def do_chunk(strategy: str = 'section', **kwargs) -> dict:
    """청킹 실행."""
    args = [
        '--strategy', strategy,
        '--pdf-dir', str(PDF_DIR),
        '--data-dir', str(RAG_DIR),
    ]
    if kwargs.get('size'):
        args += ['--size', str(kwargs['size'])]
    if kwargs.get('max_chunk'):
        args += ['--max-chunk', str(kwargs['max_chunk'])]

    print(f'  [1] 청킹: strategy={strategy}')
    return run_script('01_chunk.py', args)


def do_index(strategy: str = 'section', **kwargs) -> dict:
    """색인 생성."""
    args = [
        '--strategy', strategy,
        '--data-dir', str(RAG_DIR),
    ]
    if kwargs.get('model'):
        args += ['--model', kwargs['model']]
    if kwargs.get('batch'):
        args += ['--batch', str(kwargs['batch'])]

    print(f'  [2] 색인: strategy={strategy}')
    return run_script('02_index.py', args, timeout=1800)  # 30분 허용


def do_eval(strategy: str = 'section', rerank: bool = False, **kwargs) -> dict:
    """검색 품질 평가."""
    args = [
        '--strategy', strategy,
        '--data-dir', str(RAG_DIR),
    ]
    if rerank:
        args.append('--rerank')
    if kwargs.get('k'):
        args += ['--k', str(kwargs['k'])]

    tag = '+rerank' if rerank else ''
    print(f'  [3] 평가: strategy={strategy} {tag}')
    return run_script('03_eval.py', args, timeout=600)


def do_search(query: str, n: int = 5, rerank: bool = False, **kwargs) -> dict:
    """논문 검색."""
    args = [query, '-n', str(n)]
    if rerank:
        args.append('--rerank')
    if kwargs.get('per_doc'):
        args += ['--per-doc', str(kwargs['per_doc'])]

    print(f'  [S] 검색: "{query[:50]}"')
    return run_script('search.py', args, timeout=300)


def do_rebuild(strategy: str = 'section') -> list[dict]:
    """전체 파이프라인 재구축: chunk → index → eval."""
    results = []
    for step_fn in [do_chunk, do_index]:
        r = step_fn(strategy=strategy)
        results.append(r)
        if not r['ok']:
            print(f'  ERROR at step: {r.get("error", r.get("stderr", "")[:200])}')
            return results
    # eval은 gold가 없을 수 있으므로 실패해도 계속
    results.append(do_eval(strategy=strategy))
    return results


def generate_note(action: str, command: str, results: list[dict] | dict) -> Path | None:
    """RAG 관리 결과를 Obsidian 노트로 생성."""
    now = datetime.now()
    vault = ROOT / 'GFM_Research'
    note_dir = vault / 'RSCAD' / 'Phase02' / 'rag_notes'
    note_dir.mkdir(parents=True, exist_ok=True)

    filename = f"RAG_{now.strftime('%Y%m%d_%H%M')}_{action}.md"
    fp = note_dir / filename

    if isinstance(results, dict):
        results = [results]

    output_lines = []
    for i, r in enumerate(results):
        status = 'OK' if r.get('ok') else 'FAIL'
        output_lines.append(f'### Step {i+1}: {status} ({r.get("elapsed", "?")}s)')
        if r.get('stdout'):
            # 마지막 30줄만
            tail = '\n'.join(r['stdout'].split('\n')[-30:])
            output_lines.append(f'```\n{tail}\n```')
        if not r.get('ok') and r.get('stderr'):
            output_lines.append(f'**Error:** `{r["stderr"][:300]}`')

    content = f"""---
type: rag_management
date: {now.strftime('%Y-%m-%d')}
action: {action}
command: "{command[:80]}"
tags: [rag, {action}, auto-generated]
---

# RAG Pipeline: {action}

> Command: {command}
> Date: {now.strftime('%Y-%m-%d %H:%M')}

---

## Results

{''.join(output_lines)}

---

## Notes

(Add observations here)

## Links

- [[Phase02_완료]]
"""
    fp.write_text(content, encoding='utf-8')
    return fp


# ══════════════════════════════════════════════
# 메인 진입점 (오케스트레이터에서 호출 가능)
# ══════════════════════════════════════════════

def execute(command: str, action: str | None = None,
            strategy: str = 'section', rerank: bool = False) -> dict:
    """명령을 해석하고 적절한 RAG 작업을 실행한다."""
    if not action:
        action = detect_action(command)

    print(f'  RAG Manager: action={action}, strategy={strategy}')
    start = time.time()

    if action == 'chunk':
        result = do_chunk(strategy=strategy)
        results = [result]
    elif action == 'index':
        result = do_index(strategy=strategy)
        results = [result]
    elif action == 'eval':
        result = do_eval(strategy=strategy, rerank=rerank)
        results = [result]
    elif action == 'search':
        result = do_search(command, rerank=rerank)
        results = [result]
    elif action == 'rebuild':
        results = do_rebuild(strategy=strategy)
    else:
        return {'ok': False, 'error': f'Unknown action: {action}'}

    elapsed = round(time.time() - start, 1)
    all_ok = all(r.get('ok') for r in results)

    # 노트 생성
    note = generate_note(action, command, results)

    # 결론 생성
    if action == 'search' and results and results[0].get('ok'):
        conclusion = results[0]['stdout'].split('\n')[-20:]
        conclusion = '\n'.join(l for l in conclusion if l.strip())
    else:
        conclusion = f'RAG {action} {"완료" if all_ok else "실패"} ({elapsed}s)'
        for r in results:
            if r.get('stdout'):
                last_lines = [l for l in r['stdout'].split('\n') if l.strip()][-5:]
                conclusion += '\n' + '\n'.join(last_lines)

    return {
        'ok': all_ok,
        'action': action,
        'agent': 'rag_manager',
        'agent_name': 'RAG관리자',
        'agent_emoji': '🔎',
        'command': command,
        'conclusion': conclusion,
        'elapsed': elapsed,
        'note_path': str(note.relative_to(ROOT)) if note else None,
        'results': [{'ok': r['ok'], 'elapsed': r.get('elapsed')}
                    for r in results],
    }


# ══════════════════════════════════════════════
# CLI
# ══════════════════════════════════════════════

def main():
    ap = argparse.ArgumentParser(description='RAG 파이프라인 관리 에이전트')
    ap.add_argument('command', nargs='+', help='명령')
    ap.add_argument('--action', choices=['chunk', 'index', 'eval', 'search', 'rebuild'],
                    default=None, help='액션 직접 지정')
    ap.add_argument('--strategy', default='section')
    ap.add_argument('--rerank', action='store_true')
    ap.add_argument('--model', default='qwen3:8b', help='(호환용, 미사용)')
    ap.add_argument('--auto', default='', nargs='?', help='(호환용)')
    args = ap.parse_args()

    command = ' '.join(args.command)
    result = execute(command, action=args.action,
                     strategy=args.strategy, rerank=args.rerank)

    if result['ok']:
        print(f'\n  OK ({result["elapsed"]}s)')
        print(f'  {result["conclusion"][:500]}')
        if result.get('note_path'):
            print(f'  Note: {result["note_path"]}')
    else:
        print(f'\n  FAIL: {result.get("conclusion", "")}')


if __name__ == '__main__':
    main()
