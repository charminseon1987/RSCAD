# 담당별 이름표

> 이 문서들은 **Claude.ai 프로젝트 지침용 원본**이다.
> Claude Code 에서 바로 호출하는 서브에이전트 버전은 `.claude/agents/a0-hub.md` ~ `a10-archive.md` 에 있다.
> 내용을 고칠 때는 양쪽을 함께 고친다 (대조표: `.claude/agents/CLAUDE.md` §7).

| ID | 이름 | 담당 | 호출 |
|---|---|---|---|
| A0 | 허브 (Hub) | 총괄 | `@허브` / `@A0` |
| A1 | 볼트 (Volt) | GFM 인버터 모델 | `@볼트` / `@A1` |
| A2 | 옴 (Ohm) | 계통·LCL 모델 | `@옴` / `@A2` |
| A3 | 넷 (Net) | Draft 회로 통합 | `@넷` / `@A3` |
| A4 | 루프 (Loop) | 88포인트 스윕 스크립트 | `@루프` / `@A4` |
| A5 | 스코프 (Scope) | Runtime 구성 | `@스코프` / `@A5` |
| A6 | 델피노 (Delfino) | DSP 펌웨어 | `@델피노` / `@A6` |
| A7 | 브릿지 (Bridge) | CHIL 인터페이스 설계 | `@브릿지` / `@A7` |
| A8 | 게이트 (Gate) | HW 검토 게이트 | `@게이트` / `@A8` |
| A9 | 시그마 (Sigma) | 교차검증 절차 | `@시그마` / `@A9` |
| A10 | 아카이브 (Archive) | 실험 기록·아카이브 | `@아카이브` / `@A10` |

# 붙여넣기 순서

| 파일 | Claude.ai 프로젝트 이름 제안 |
|---|---|
| A0_rtds_agent_총괄.md | 논문 · RTDS 총괄 |
| A1_PV+ESS_2단_GFM_인버터_모델.md | 논문 · A1 |
| A2_LCL_필터_+_SCR–X-R_가변_계통_모델.md | 논문 · A2 |
| A3_Draft_회로_통합_설계.md | 논문 · A3 |
| A4_SCR_88포인트_스윕_스크립트_설계.md | 논문 · A4 |
| A5_Runtime_구성.md | 논문 · A5 |
| A6_DSP_TMS320F28379D_펌웨어.md | 논문 · A6 |
| A7_RTDS_I-O_카드_연결_CHIL_인터페이스_설계.md | 논문 · A7 |
| A8_DSP_-_RTDS_I-O_카드_검토.md | 논문 · A8 |
| A9_교차검증_절차.md | 논문 · A9 |
| A10_실험_절차-설정값-결과_기록.md | 논문 · A10 |

- 각 파일 전체를 해당 프로젝트의 지침(Instructions)에 그대로 붙여넣는다.
- 프로젝트 지식(Knowledge)에는 그 agent의 INPUT 산출물(예: A3 → inv_spec.yaml, grid_spec.yaml)을 업로드한다.
- 총괄 프로젝트에는 10개 파일을 모두 지식으로 넣어 라우팅 시 참조하게 한다.
