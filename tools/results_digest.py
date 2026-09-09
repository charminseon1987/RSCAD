#!/usr/bin/env python3
"""
results_digest.py — runner.py 결과를 에이전트 컨텍스트용 한 화면으로 요약 (계산 없음, 읽기만)

runner.py v3 가 남긴 results/<run>/meta.json + eigenvalue_results.json 을 읽어
"판정에 필요한 것만" 출력한다. 에이전트는 이 출력을 근거(▸)로 쓰고, 수치를 재계산하지 않는다.

사용:
  python results_digest.py                       # results/LATEST.json 이 가리키는 실행
  python results_digest.py --run <run_name>      # 특정 폴더
  python results_digest.py --results ~/Dev/RSCAD/results --json
  python results_digest.py --compare <run_a> <run_b>   # 두 실행의 SCR별 지표 차이 (P2-A5 비단조 판별용)

connect-ai: _agents/developer/tools/results_digest.py 와 _agents/business/tools/ 양쪽에 두고,
developer 는 runner 실행 직후, business(판정자) 는 판정표 작성 시 호출한다.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path


def resolve(results_root: Path, run: str | None) -> Path:
    if run:
        d = results_root / run
        if not d.is_dir():
            raise SystemExit(f"폴더 없음: {d}")
        return d
    ptr = results_root / "LATEST.json"
    if ptr.exists():
        name = json.loads(ptr.read_text(encoding="utf-8"))["run_name"]
        return results_root / name
    cands = [p for p in results_root.iterdir() if (p / "meta.json").exists()]
    if not cands:
        raise SystemExit("결과 없음 — runner.py 를 먼저 실행")
    return max(cands, key=lambda p: (p / "meta.json").stat().st_mtime)


def load(run_dir: Path) -> tuple[dict, dict]:
    meta = json.loads((run_dir / "meta.json").read_text(encoding="utf-8"))
    ev = json.loads((run_dir / "eigenvalue_results.json").read_text(encoding="utf-8"))
    return meta, ev


def digest(meta: dict, ev: dict) -> dict:
    rows = []
    for scr, r in sorted(ev.items(), key=lambda kv: -float(kv[0])):
        if not r.get("converged"):
            rows.append({"SCR": float(scr), "converged": False, "reason": r.get("fail_reason")})
            continue
        rows.append({
            "SCR": float(scr),
            "converged": True,
            "stable": r["stable"],
            "max_real": r["max_real"],
            "sigma_min": r.get("sigma_min"),
            "t_s_max": r.get("t_s_max"),
            "score": r.get("score"),
            "binding": r.get("binding"),
            "crit_state": r.get("crit_state"),
            "crit_osc": r.get("crit_osc"),
            "zeta_min": r.get("zeta_min"),
            "zeta_band": r.get("zeta_band"),
            "f_dom_hz": r.get("f_dom_hz"),
            "delta_deg": r.get("delta_deg"),
            "delta_near_limit": r.get("delta_near_limit"),
            "fd_exceeds_tol": r.get("fd_exceeds_tol"),
            "coupling_shift_crit": (r.get("coupling") or {}).get("shift_crit"),
        })
    return {
        "run": meta["run_name"],
        "model_version": meta["model_version"],
        "timestamp": meta["timestamp"],
        "XR": meta["XR"],
        "ctrl": meta["ctrl_params"],
        "verdict": {
            "all_converged": meta["all_converged"],
            "all_stable": meta["all_stable"],
            "metric_pass": meta.get("metric_pass"),
            "score_min_all": meta.get("score_min_all"),
            "sigma_min_all": meta.get("sigma_min_all"),
            "sigma_ref": meta.get("sigma_ref"),
            "t_s_spec": meta.get("t_s_spec"),
            "zeta_min_all(참고)": meta.get("zeta_min_all"),
            "zeta_min_band": meta.get("zeta_min_band"),
        },
        "flags": {
            "band_crossovers": meta.get("band_crossovers", []),
            "fd_exceed_SCR": meta.get("fd_exceed_SCR", []),
            "loadability_limit_SCR": meta.get("loadability_limit_SCR", []),
            "nonconvergence_SCR": meta.get("nonconvergence_SCR", []),
            "delta_near_limit_SCR": meta.get("delta_near_limit_SCR", []),
        },
        "rows": rows,
    }


def render(d: dict) -> str:
    L = [f"▸ {d['run']}  ({d['model_version']}, {d['timestamp']})  X/R={d['XR']}",
         f"▸ 판정: converged={d['verdict']['all_converged']} stable={d['verdict']['all_stable']} "
         f"metric_pass={d['verdict']['metric_pass']} score_min={d['verdict']['score_min_all']} "
         f"σ_min={d['verdict']['sigma_min_all']} (σ_ref={d['verdict']['sigma_ref']}, t_s≤{d['verdict']['t_s_spec']}s)",
         f"  {'SCR':>5} {'stbl':>4} {'max_Re':>9} {'σ_min':>8} {'t_s':>6} {'score':>6} {'구속':>7} {'임계상태':>9} {'ζ_min':>7} {'대역':>7} {'δ°':>6} {'FD':>3}"]
    for r in d["rows"]:
        if not r["converged"]:
            L.append(f"  {r['SCR']:>5} {'—':>4}  ✗ {r['reason']}")
            continue
        z = "-" if r["zeta_min"] is None else f"{r['zeta_min']:.4f}"
        L.append(f"  {r['SCR']:>5} {'✅' if r['stable'] else '❌':>4} {r['max_real']:>9.4f} "
                 f"{r['sigma_min']:>8.4f} {r['t_s_max']:>6.2f} {r['score']:>6.3f} {str(r['binding']):>7} "
                 f"{str(r['crit_state']):>9} {z:>7} {str(r['zeta_band']):>7} {r['delta_deg']:>6.2f}"
                 f"{'⚠' if r['delta_near_limit'] else ' '} {'⚠' if r['fd_exceeds_tol'] else 'ok':>3}")
    f = d["flags"]
    if f["band_crossovers"]:
        L.append("▸ 모드 교차: " + "; ".join(f"SCR {c['between'][0]}→{c['between'][1]} {c['from']}→{c['to']}" for c in f["band_crossovers"]))
    if f["fd_exceed_SCR"]:
        L.append(f"▸ 검산 오차 초과 SCR: {f['fd_exceed_SCR']}")
    if f["loadability_limit_SCR"]:
        L.append(f"▸ 정적 부하가능성 한계 SCR: {f['loadability_limit_SCR']} (소신호 경계 아님)")
    if f["nonconvergence_SCR"]:
        L.append(f"▸ 수치 미수렴 SCR: {f['nonconvergence_SCR']}")
    return "\n".join(L)


def compare(results_root: Path, a: str, b: str) -> str:
    ma, ea = load(results_root / a)
    mb, eb = load(results_root / b)
    keys = sorted(set(ea) | set(eb), key=lambda k: -float(k))
    L = [f"▸ 비교: {a}  vs  {b}", f"  {'SCR':>5} {'σ_min A':>9} {'σ_min B':>9} {'Δσ':>9} {'δ A':>7} {'δ B':>7} {'Δδ':>7}"]
    for k in keys:
        ra, rb = ea.get(k, {}), eb.get(k, {})
        if not (ra.get("converged") and rb.get("converged")):
            L.append(f"  {float(k):>5}  (한쪽 미수렴)")
            continue
        ds = rb["sigma_min"] - ra["sigma_min"]
        dd = rb["delta_deg"] - ra["delta_deg"]
        L.append(f"  {float(k):>5} {ra['sigma_min']:>9.4f} {rb['sigma_min']:>9.4f} {ds:>+9.4f} {ra['delta_deg']:>7.2f} {rb['delta_deg']:>7.2f} {dd:>+7.2f}")
    return "\n".join(L)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--results", default="results", help="results 루트 (기본: ./results)")
    ap.add_argument("--run", help="특정 run_name")
    ap.add_argument("--compare", nargs=2, metavar=("RUN_A", "RUN_B"))
    ap.add_argument("--json", action="store_true")
    a = ap.parse_args()
    root = Path(a.results).expanduser().resolve()
    if a.compare:
        print(compare(root, *a.compare))
    else:
        d = digest(*load(resolve(root, a.run)))
        print(json.dumps(d, ensure_ascii=False, indent=2) if a.json else render(d))
