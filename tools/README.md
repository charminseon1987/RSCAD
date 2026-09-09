# tools/ — 에이전트 도구 (connect-ai `_agents/<id>/tools/` 로 복사)

| 도구 | 담당 에이전트 | 하는 일 |
|---|---|---|
| `gate_check.py` | secretary (노트 관리자) | schedule.yaml 경보 판정 + 미러 대조. 아침 브리핑 첫 줄 |

connect-ai 도구 규약: `<name>.py` + `<name>.json`(설정) + `<name>.md`(설명) 3종.
스크립트는 같은 폴더의 json을 읽어 인자로 쓴다 — 현재 gate_check.py는 CLI 인자를 받으므로
도구 폴더에 넣을 때는 아래 래퍼를 쓰거나, `<run_command>`에 경로를 직접 넘긴다:

    python gate_check.py --yaml "C:/Users/hyese/Dev/RSCAD/GFM_Research/schedule.yaml"
