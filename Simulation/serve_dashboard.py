#!/usr/bin/env python3
"""
serve_dashboard.py — Lightweight HTTP server for gfm_stability_dashboard.html

Usage:
    python Simulation/serve_dashboard.py [--port 8765]

Serves the RSCAD project root and opens the dashboard in the default browser.
Also provides a JSON API endpoint:
    GET /api/grid2d  →  aggregated 2D σ_min grid from all results/ folders
"""

import http.server
import json
import os
import sys
import threading
import webbrowser
from pathlib import Path

PORT = 8765
ROOT = Path(__file__).resolve().parent.parent
RESULTS = ROOT / "results"


def scan_grid2d():
    """Scan all results/ subfolders and build {XR: {SCR: sigma_min}} grid."""
    grid = {}
    all_xr = set()
    all_scr = set()

    if not RESULTS.is_dir():
        return {"grid": {}, "gridXR": [], "gridSCR": []}

    for d in sorted(RESULTS.iterdir()):
        if not d.is_dir() or d.name.startswith("_"):
            continue
        meta_f = d / "meta.json"
        eig_f = d / "eigenvalue_results.json"
        if not meta_f.exists() or not eig_f.exists():
            continue
        try:
            meta = json.loads(meta_f.read_text(encoding="utf-8"))
            eig = json.loads(eig_f.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            continue

        xr = meta.get("XR")
        if xr is None:
            continue
        xr_key = f"{float(xr):.1f}"
        all_xr.add(float(xr))

        if xr_key not in grid:
            grid[xr_key] = {}

        for scr_key, val in eig.items():
            if not isinstance(val, dict):
                continue
            # sigma_min (new format) or min_abs_real (old format)
            sigma = val.get("sigma_min") or val.get("min_abs_real")
            if sigma is None:
                continue
            scr_num = float(scr_key)
            all_scr.add(scr_num)
            # Keep the largest (most recent / best) sigma for each cell
            if scr_num not in grid[xr_key] or sigma > grid[xr_key][scr_num]:
                grid[xr_key][scr_num] = round(sigma, 5)

    return {
        "grid": grid,
        "gridXR": sorted(all_xr),
        "gridSCR": sorted(all_scr, reverse=True),
    }


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_GET(self):
        if self.path == "/api/grid2d":
            data = scan_grid2d()
            body = json.dumps(data, ensure_ascii=False).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", len(body))
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(body)
            return
        return super().do_GET()

    def log_message(self, fmt, *args):
        # Quieter logging — only show non-200 or API requests
        status = args[1] if len(args) > 1 else ""
        if "/api/" in str(args[0]) or str(status) != "200":
            super().log_message(fmt, *args)


def main():
    port = PORT
    if "--port" in sys.argv:
        idx = sys.argv.index("--port")
        port = int(sys.argv[idx + 1])

    url = f"http://localhost:{port}/Web/gfm_stability_dashboard.html"
    server = http.server.HTTPServer(("", port), Handler)
    print(f"Serving RSCAD root at http://localhost:{port}/")
    print(f"Dashboard: {url}")

    # Open browser after a short delay (so server is ready)
    threading.Timer(0.5, lambda: webbrowser.open(url)).start()

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down.")
        server.server_close()


if __name__ == "__main__":
    main()
