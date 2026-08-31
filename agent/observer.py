#!/usr/bin/env python3
"""
observer.py — 연구일정 에이전트 인지 계층 (3단계)

관측만 한다. 파일을 쓰지 않는다.
git log와 결과 폴더를 읽어 schedule.yaml을 "이렇게 갱신하겠다"는 제안만 출력한다.

사용:
    python3 observer.py schedule.yaml observe_map.yaml
    python3 observer.py schedule.yaml observe_map.yaml --json

설계 원칙:
    1. 자동 승격은 draft까지. verified는 사람만 올린다.
    2. 단조 전진만 제안. 관측 부재를 근거로 강등하지 않는다.
       (유일한 예외: evidence 경로가 실재하지 않는 verified → draft 강등 제안)
    3. 쓰기 경로가 코드에 존재하지 않는다. 4단계에서 별도 모듈로 추가한다.
"""

from __future__ import annotations

import argparse
import fnmatch
import json
import subprocess
import sys
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import yaml

# ── 상태 순서 ────────────────────────────────────────────────
STATE_ORDER = ["not_started", "in_progress", "draft", "verified"]
MAX_AUTO_STATE = "draft"  # 이 위로는 자동 제안 금지


def rank(state: str) -> int:
    try:
        return STATE_ORDER.index(state)
    except ValueError:
        return -1


# ── 자료구조 ─────────────────────────────────────────────────
@dataclass
class Observation:
    """파일 시스템 / git에서 관측한 사실 하나."""
    signal_id: str
    path: str
    exists: bool
    mtime: datetime | None = None
    git_last_commit: datetime | None = None


@dataclass
class Proposal:
    artifact_id: str
    phase_id: str
    current: str
    proposed: str
    kind: str          # promote | demote | hold
    reason: str
    evidence: str | None = None
    age_days: int | None = None


@dataclass
class Report:
    generated_at: str
    proposals: list[Proposal] = field(default_factory=list)
    holds: list[Proposal] = field(default_factory=list)
    silent_phases: list[dict] = field(default_factory=list)
    unmapped_artifacts: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)


# ── I/O (부작용은 전부 이 구역에만) ──────────────────────────
def load_yaml(path: Path) -> dict:
    with open(path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f) or {}


def git_last_commit(repo: Path, rel_path: str) -> datetime | None:
    """해당 경로를 마지막으로 건드린 커밋 시각. git이 없거나 이력이 없으면 None."""
    try:
        out = subprocess.run(
            ["git", "-C", str(repo), "log", "-1", "--format=%cI", "--", rel_path],
            capture_output=True, text=True, timeout=10,
        )
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return None
    if out.returncode != 0:
        return None
    stamp = out.stdout.strip()
    if not stamp:
        return None
    try:
        return datetime.fromisoformat(stamp)
    except ValueError:
        return None


def scan_glob(root: Path, pattern: str) -> list[Path]:
    """root 기준 글롭. 존재하는 경로만 반환."""
    try:
        return sorted(p for p in root.glob(pattern) if p.exists())
    except (ValueError, OSError):
        return []


def collect(root: Path, signals: list[dict], use_git: bool = True) -> dict[str, list[Observation]]:
    """신호 정의를 실제 관측으로 변환. 여기서만 디스크를 읽는다."""
    result: dict[str, list[Observation]] = {}
    for sig in signals:
        sid = sig["id"]
        pattern = sig["pattern"]
        obs: list[Observation] = []

        if any(ch in pattern for ch in "*?["):
            hits = scan_glob(root, pattern)
        else:
            candidate = root / pattern
            hits = [candidate] if candidate.exists() else []

        if not hits:
            obs.append(Observation(sid, pattern, exists=False))
        else:
            for h in hits:
                rel = h.relative_to(root).as_posix()
                obs.append(Observation(
                    signal_id=sid,
                    path=rel,
                    exists=True,
                    mtime=datetime.fromtimestamp(h.stat().st_mtime, tz=timezone.utc),
                    git_last_commit=git_last_commit(root, rel) if use_git else None,
                ))
        result[sid] = obs
    return result


# ── evidence 경로 해석 ───────────────────────────────────────
ROOT_TOKENS = ("code_root", "vault_root", "$CODE_ROOT", "$VAULT_ROOT",
               "{code_root}", "{vault_root}")


def parse_evidence(ev: str) -> tuple[str, str | None]:
    """evidence 문자열에서 (경로, 심볼) 분리. 'a/b.py :: func' → ('a/b.py', 'func')"""
    if "::" in ev:
        path, sym = ev.split("::", 1)
        return path.strip(), sym.strip() or None
    return ev.strip(), None


def normalize_evidence_path(ev: str) -> tuple[str, bool]:
    """evidence → (루트 상대 경로, 볼트 소속 여부)."""
    raw, _sym = parse_evidence(ev)
    raw = raw.replace("\\", "/").lstrip("./")
    for tok in ROOT_TOKENS:
        pre = tok.rstrip("/") + "/"
        if raw.startswith(pre):
            return raw[len(pre):], ("vault" in tok)
    return raw, False


OPEN_ISSUE_FIELDS = ("issue", "next_action", "action")


def has_open_issue(art: dict) -> str | None:
    """미해결 표시가 남아 있으면 해당 필드명을 반환.

    schedule.yaml은 미해결 사항을 issue / next_action / action 필드로 적는다.
    이 필드가 살아 있으면 산출물 파일이 존재하더라도 완료로 볼 수 없다.
    관측기는 파일 존재만 보므로, 이 검사가 없으면 낡은 결과를 완료로 오판한다.
    """
    for f in OPEN_ISSUE_FIELDS:
        v = art.get(f)
        if isinstance(v, str) and v.strip():
            return f
    return None


def derive_signals(schedule: dict, manual_only: set[str] | None = None,
                   promote_to: str = "draft") -> tuple[list[dict], list[str]]:
    """schedule.yaml의 evidence 필드에서 신호를 유도한다.

    매핑을 별도 파일에 중복 기록하지 않기 위한 것이다.
    evidence가 곧 "무엇이 보이면 됐다고 볼 것인가"의 정의이므로,
    그 파일이 실재하면 산출물이 나온 것으로 본다.

    반환: (신호 목록, 제외된 artifact 사유 목록)
    """
    manual_only = manual_only or set()
    sigs: list[dict] = []
    skipped: list[str] = []

    for aid, (_pid, art) in _artifact_index(schedule).items():
        if aid in manual_only:
            skipped.append(f"{aid}: manual_only 지정")
            continue
        ev = art.get("evidence")
        if not ev:
            skipped.append(f"{aid}: evidence 미정의")
            continue
        opened = has_open_issue(art)
        if opened:
            skipped.append(f"{aid}: {opened} 미해결 — 산출물 존재해도 승격 보류")
            continue
        path, is_vault = normalize_evidence_path(ev)
        if is_vault:
            skipped.append(f"{aid}: 볼트 산출물 — 존재가 완성을 뜻하지 않음")
            continue
        sigs.append({
            "id": f"AUTO-{aid}",
            "pattern": path,
            "reason": "evidence 산출물 실재",
            "targets": [{"artifact": aid, "propose": promote_to}],
        })
    return sigs, skipped


def resolve_evidence(ev: str, code_root: Path, vault_root: Path | None):
    """evidence를 실제 경로로 해석하고 실재 여부를 판정.

    반환: (표시경로, 존재여부, 사유)
    - 선행 토큰(code_root/, vault_root/)을 해당 루트로 치환한다.
    - 글롭 문자가 있으면 매칭 결과 유무로 판정한다.
    - 심볼 지정자(:: func)는 경로에서 분리한다. 심볼 존재는 검사하지 않는다.
    """
    raw, _sym = parse_evidence(ev)
    raw = raw.replace("\\", "/").lstrip("./")

    base = code_root
    for tok in ROOT_TOKENS:
        pre = tok.rstrip("/") + "/"
        if raw.startswith(pre):
            raw = raw[len(pre):]
            if "vault" in tok:
                base = vault_root or code_root
            break

    if vault_root is not None and base is vault_root and not vault_root.exists():
        return raw, True, "vault_root 미존재 — 판정 보류"

    if any(c in raw for c in "*?["):
        hits = scan_glob(base, raw)
        return raw, bool(hits), (hits[0].relative_to(base).as_posix() if hits else "매칭 없음")

    target = base / raw
    return raw, target.exists(), str(target)


# ── 판단 (순수 함수) ─────────────────────────────────────────
def _artifact_index(schedule: dict) -> dict[str, tuple[str, dict]]:
    """artifact_id -> (phase_id, artifact dict)"""
    idx: dict[str, tuple[str, dict]] = {}
    for phase in schedule.get("phases", []):
        pid = phase.get("id", "?")
        for i, art in enumerate(phase.get("artifacts", []), start=1):
            aid = art.get("id") or f"{pid}-A{i}"
            idx[aid] = (pid, art)
    for i, art in enumerate(schedule.get("continuous", []), start=1):
        aid = art.get("id") or f"CT-A{i}"
        idx[aid] = ("CT", art)
    return idx


def _freshest(obs_list: list[Observation]) -> Observation | None:
    live = [o for o in obs_list if o.exists]
    if not live:
        return None
    return max(live, key=lambda o: o.git_last_commit or o.mtime or datetime.min.replace(tzinfo=timezone.utc))


def _age_days(o: Observation, now: datetime) -> int | None:
    ts = o.git_last_commit or o.mtime
    if ts is None:
        return None
    return max(0, (now - ts).days)


def evaluate(schedule: dict, obs_map: dict[str, list[Observation]],
             signals: list[dict], now: datetime | None = None,
             stale_days: int = 14, root: Path | None = None,
             vault_root: Path | None = None) -> Report:
    """관측 + 현재 상태 → 제안. 부작용 없음."""
    now = now or datetime.now(timezone.utc)
    rep = Report(generated_at=now.isoformat())
    idx = _artifact_index(schedule)
    touched: set[str] = set()
    phase_activity: dict[str, int | None] = {}

    for sig in signals:
        sid = sig["id"]
        obs_list = obs_map.get(sid, [])
        best = _freshest(obs_list)

        for target in sig.get("targets", []):
            aid = target["artifact"]
            proposed = target.get("propose", "in_progress")

            if aid not in idx:
                rep.warnings.append(f"신호 {sid}가 존재하지 않는 artifact {aid}를 가리킴")
                continue

            pid, art = idx[aid]
            touched.add(aid)
            current = art.get("state", "not_started")

            # 원칙 1 — verified 자동 승격 금지
            if rank(proposed) > rank(MAX_AUTO_STATE):
                rep.warnings.append(
                    f"신호 {sid}가 {aid}에 {proposed}를 제안 — {MAX_AUTO_STATE}로 절삭")
                proposed = MAX_AUTO_STATE

            if best is None:
                # 원칙 2 — 관측 부재는 강등 근거가 아니다
                continue

            age = _age_days(best, now)
            if age is not None:
                prev = phase_activity.get(pid)
                phase_activity[pid] = age if prev is None else min(prev, age)

            if rank(proposed) > rank(current):
                rep.proposals.append(Proposal(
                    artifact_id=aid, phase_id=pid, current=current, proposed=proposed,
                    kind="promote", reason=sig.get("reason", sid),
                    evidence=best.path, age_days=age,
                ))
            else:
                rep.holds.append(Proposal(
                    artifact_id=aid, phase_id=pid, current=current, proposed=current,
                    kind="hold", reason="관측 존재, 상태 변경 불필요",
                    evidence=best.path, age_days=age,
                ))

    # evidence 실재 검증 — 유일하게 허용되는 강등 제안 (R4의 관측 근거)
    if root is not None:
        for aid, (pid, art) in idx.items():
            ev = art.get("evidence")
            state = art.get("state", "not_started")
            if state != "verified" or not ev:
                continue
            opened = has_open_issue(art)
            if opened:
                rep.proposals.append(Proposal(
                    artifact_id=aid, phase_id=pid, current="verified", proposed="draft",
                    kind="demote", reason=f"{opened} 필드가 미해결로 남아 있음",
                    evidence=ev, age_days=None,
                ))
                continue
            shown, ok, note = resolve_evidence(ev, root, vault_root)
            if not ok:
                rep.proposals.append(Proposal(
                    artifact_id=aid, phase_id=pid, current="verified", proposed="draft",
                    kind="demote", reason=f"evidence 미확인 ({note})",
                    evidence=shown, age_days=None,
                ))

    # 정체 phase — R5의 관측 근거
    for phase in schedule.get("phases", []):
        pid = phase.get("id", "?")
        age = phase_activity.get(pid)
        if age is None:
            continue
        if age >= stale_days:
            rep.silent_phases.append({"phase": pid, "age_days": age})

    rep.unmapped_artifacts = sorted(set(idx) - touched)
    return rep


# ── 렌더링 ───────────────────────────────────────────────────
def render(rep: Report, show_holds: bool = False, max_unmapped: int = 8) -> str:
    L: list[str] = ["관측 결과 (dry-run, 파일 미변경)"]

    if not rep.proposals:
        L.append("  [제안 없음] 상태를 바꿀 만한 관측 신호가 없습니다.")
    for p in sorted(rep.proposals, key=lambda x: (x.kind != "demote", x.artifact_id)):
        mark = "!" if p.kind == "demote" else " "
        L.append(f" {mark}{p.artifact_id}  {p.current} -> {p.proposed}")
        age = f" ({p.age_days}일 전)" if p.age_days is not None else ""
        L.append(f"      근거: {p.evidence}{age} — {p.reason}")

    if show_holds and rep.holds:
        L.append("")
        for h in rep.holds:
            L.append(f"  {h.artifact_id}  {h.current} 유지 — {h.evidence}")

    if rep.silent_phases:
        L.append("")
        for s in rep.silent_phases:
            L.append(f"  [정체] {s['phase']} — 최근 변경 {s['age_days']}일 전")

    if rep.unmapped_artifacts:
        L.append("")
        head = rep.unmapped_artifacts[:max_unmapped]
        more = len(rep.unmapped_artifacts) - len(head)
        tail = f" 외 {more}건" if more > 0 else ""
        L.append(f"  [관측 불가] {', '.join(head)}{tail}")
        L.append("      매핑 규칙이 없거나 산출물이 파일로 남지 않는 항목입니다.")

    for w in rep.warnings:
        L.append(f"  [경고] {w}")

    return "\n".join(L)


def to_json(rep: Report) -> str:
    d = asdict(rep)
    return json.dumps(d, ensure_ascii=False, indent=2, default=str)


# ── 진입점 ───────────────────────────────────────────────────
def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="연구일정 에이전트 인지 계층 (관측 전용)")
    ap.add_argument("schedule", type=Path)
    ap.add_argument("obsmap", type=Path)
    ap.add_argument("--root", type=Path, default=None,
                    help="코드 저장소 루트. 미지정 시 observe_map.yaml의 meta.code_root")
    ap.add_argument("--vault", type=Path, default=None,
                    help="볼트 루트. 미지정 시 schedule.yaml의 meta.vault_root")
    ap.add_argument("--verbose", action="store_true",
                    help="신호 유도에서 제외된 항목을 stderr로 출력")
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--show-holds", action="store_true")
    ap.add_argument("--no-git", action="store_true", help="git 조회 생략, mtime만 사용")
    args = ap.parse_args(argv)

    schedule = load_yaml(args.schedule)
    obsmap = load_yaml(args.obsmap)

    meta = obsmap.get("meta", {})
    raw_root = Path(meta.get("code_root", ".")).expanduser()
    root = (args.root or (raw_root if raw_root.is_absolute()
                          else args.obsmap.parent / raw_root)).resolve()

    vault = args.vault or schedule.get("meta", {}).get("vault_root")
    vault_root = Path(vault).expanduser().resolve() if vault else None
    stale = int(meta.get("stale_days", 14))
    signals = list(obsmap.get("signals", []) or [])

    if meta.get("derive_from_evidence", True):
        manual = set(obsmap.get("manual_only", []) or [])
        auto, skipped = derive_signals(schedule, manual)
        declared = {t["artifact"] for sg in signals for t in sg.get("targets", [])}
        # 손으로 쓴 규칙이 있으면 그쪽이 이긴다
        signals += [a for a in auto
                    if a["targets"][0]["artifact"] not in declared]
        if args.verbose:
            for line in skipped:
                print(f"  [유도 제외] {line}", file=sys.stderr)

    if not root.exists():
        print(f"[중단] code_root가 존재하지 않습니다: {root}", file=sys.stderr)
        return 2

    obs = collect(root, signals, use_git=not args.no_git)
    rep = evaluate(schedule, obs, signals, stale_days=stale,
                   root=root, vault_root=vault_root)

    print(to_json(rep) if args.json else render(rep, show_holds=args.show_holds))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())