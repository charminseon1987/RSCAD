# schedule_sync — checkList.md → schedule.yaml 초안 생성 규칙 (secretary 스킬)

미러(checkList.md)가 YAML보다 앞서 있을 때, 또는 ID 체계가 갈라졌을 때 실행한다.
출력은 **초안**이다. state 상향은 사람이 확정한다 (output_policy.forbidden).

## 입력
1. 현재 `schedule.yaml` (진실원, 낡았을 수 있음)
2. 최신 `checkList*.md` (미러, 사람이 최근 편집)
3. `gate_check.py --json` 결과의 `mirror` 블록 (ahead / not_in_yaml)

## 변환 규칙
| 체크리스트 | YAML |
|---|---|
| `- [x]` + 증거 경로가 노트에 있음 | `state: verified`, `evidence: <경로>` |
| `- [x]` 인데 경로 없음 | `state: draft`, `evidence: null`, 주석 `# 확인 필요: <무슨 파일>` |
| `⚠️ 진행 중` | `state: in_progress` |
| `- [ ]` | `state: not_started` |
| 🔺 | `blocking: true` |
| ⬆️ 앞당김 | `window` 앞당기고 `note` 에 사유 |
| ~~취소선~~ / "구 X" / "폐기" | 항목 삭제 + phase 의 `superseded:` 목록에 한 줄 |
| `> [!danger]` / `[!warning]` 본문 | 해당 phase 의 `precondition:` 또는 artifact `note:` |
| Tier 분기표 | `meta.tier`, `tiers:`, `gates.P7.tier{n}`, `applies_to_tier` |

## 절대 규칙
- `current_month`, `month_1_start` 는 건드리지 않는다. 계산값과 다르면 주석으로만 표시.
- 체크리스트에 없는 항목을 만들어내지 않는다. ID 가 갈라졌으면(같은 ID, 다른 이름) YAML 쪽 이름을 버리고 체크리스트 이름·번호를 따른다 — 사람이 마지막으로 편집한 쪽이 의도다.
- 수치(오차, 고유값, 각도)는 체크리스트에 적힌 그대로 `note:` 에 옮긴다. 반올림·해석 금지.
- 완료 후 `gate_check.py --yaml <초안> --mirror <체크리스트>` 를 돌려 `mirror_ahead` 가 "draft(evidence 대기)" 항목만 남는지 확인한다. 그 외가 남으면 변환 누락.

## 출력
- `schedule.v{n+1}.yaml` (기존 파일 덮어쓰지 않음)
- 사람에게 보낼 한 줄: "초안 생성. draft {k}건 evidence 경로 필요: <id 목록>. 확정 후 schedule.yaml 로 교체."
