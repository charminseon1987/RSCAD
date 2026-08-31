#!/usr/bin/env python3
"""fd_worst_entry.py — 야코비안 유한차분 최악 성분 추출 (P2-A2 next_action)

사용:
    python fd_worst_entry.py "../results/J*_XR3.0*/eigenvalue_results.json"
    python fd_worst_entry.py "../results/J*_XR*_v3_*/eigenvalue_results.json" --all

구조를 모르는 JSON에서 fd_worst_entry 키를 재귀 탐색하고,
같은 딕셔너리에 들어 있는 스칼라 필드(scr, xr, 오차 등)를 함께 출력한다.
읽기 전용. 파일을 쓰지 않는다.
"""

from __future__ import annotations

import argparse
import glob
import json
import sys
from pathlib import Path

KEY = "fd_worst_entry"
CONTEXT_HINTS = ("scr", "xr", "x_r", "err", "rel", "tol", "max", "worst", "name", "idx")


def walk(node, trail=""):
    """fd_worst_entry를 품은 딕셔너리를 모두 찾는다."""
    if isinstance(node, dict):
        if KEY in node:
            yield trail or "(root)", node
        for k, v in node.items():
            yield from walk(v, f"{trail}.{k}" if trail else str(k))
    elif isinstance(node, list):
        for i, v in enumerate(node):
            yield from walk(v, f"{trail}[{i}]")


def context(d: dict) -> dict:
    """같은 딕셔너리의 스칼라 필드 중 조건 식별에 쓸 만한 것만."""
    out = {}
    for k, v in d.items():
        if k == KEY:
            continue
        if isinstance(v, (int, float, str, bool)) and any(h in k.lower() for h in CONTEXT_HINTS):
            out[k] = v
    return out


def fmt(v) -> str:
    if isinstance(v, float):
        return f"{v:.3e}" if (abs(v) < 1e-3 or abs(v) >= 1e4) else f"{v:.4g}"
    return str(v)


def show_entry(entry, indent="      "):
    """fd_worst_entry 값이 배열이든 딕셔너리든 읽히게 출력."""
    if isinstance(entry, dict):
        for k, v in entry.items():
            print(f"{indent}{k}: {fmt(v)}")
    elif isinstance(entry, list):
        if entry and all(isinstance(x, (int, float, str)) for x in entry):
            print(f"{indent}{[fmt(x) for x in entry]}")
        else:
            for i, x in enumerate(entry):
                print(f"{indent}[{i}] {json.dumps(x, ensure_ascii=False)}")
    else:
        print(f"{indent}{fmt(entry)}")


def main(argv=None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("pattern", help="따옴표로 감쌀 것. 셸이 먼저 전개하면 안 된다")
    ap.add_argument("--tol", type=float, default=1e-6, help="허용치 (기본 1e-6)")
    ap.add_argument("--all", action="store_true", help="허용치 이하도 전부 출력")
    args = ap.parse_args(argv)

    files = sorted(glob.glob(args.pattern))
    if not files:
        print(f"[없음] 매칭되는 파일이 없습니다: {args.pattern}", file=sys.stderr)
        return 1

    print(f"허용치 {args.tol:.0e} · 파일 {len(files)}건\n")
    flagged = 0

    for fp in files:
        try:
            data = json.loads(Path(fp).read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError) as e:
            print(f"[읽기 실패] {fp}: {e}", file=sys.stderr)
            continue

        hits = list(walk(data))
        if not hits:
            continue

        shown_header = False
        for trail, holder in hits:
            ctx = context(holder)
            errs = [v for k, v in ctx.items()
                    if isinstance(v, (int, float)) and not isinstance(v, bool)
                    and ("err" in k.lower() or "rel" in k.lower())]
            over = any(e > args.tol for e in errs)

            if not over and not args.all:
                continue

            if not shown_header:
                print(f"── {Path(fp).parent.name}")
                shown_header = True

            mark = "!" if over else " "
            ctx_s = "  ".join(f"{k}={fmt(v)}" for k, v in ctx.items())
            print(f"  {mark}{trail}   {ctx_s}")
            show_entry(holder[KEY])
            print()
            if over:
                flagged += 1

    if flagged:
        print(f"허용치 초과 {flagged}건. 위 성분이 P2-A2 issue 의 대상입니다.")
    elif not args.all:
        print("허용치 초과 없음. --all 로 전체를 볼 수 있습니다.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
