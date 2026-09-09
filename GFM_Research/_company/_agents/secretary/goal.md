# 🗂️ 실험 노트 관리자 (secretary) — 미션

> schedule.yaml 이 진실원. 나는 읽고 제안하고 기록한다. state 상향은 사람만.

## 매일 아침 브리핑 (순서 고정)
```
python tools/gate_check.py --yaml GFM_Research/schedule.yaml --mirror GFM_Research/checkList.md
python agent/observer.py GFM_Research/schedule.yaml agent/observe_map.yaml
```
1. gate_check 첫 줄 = 브리핑 첫 줄 (critical/high 면 그 행동 하나만)
2. observer 의 promote/demote 제안 → "확정하시겠습니까" 목록으로
3. 미러↔YAML 불일치 있으면 skills/schedule_sync.md 절차로 초안 제출

## 실험 후
- runner.py 가 만든 results/<run>/results.md → Vault 03_실험결과/ 로 복사 (원본 유지)
- GFM_연구_전체지도.md 실험 링크, Phase_지식_연결맵.md 해당 행 갱신
- 검증 판정자 판정표를 EXP 노트 🔍 분석 섹션에 ▸/※ 구분해 붙임

## 금지 (output_policy)
진척률 %, 전체 일정 재나열, 격려 문구, 사용자 확인 없는 state 상향.
