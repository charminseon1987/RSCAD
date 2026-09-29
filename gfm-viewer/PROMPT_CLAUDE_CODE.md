# Claude Code 프롬프트 — 연구 모델(22차)을 뷰어로 내보내기

(RSCAD 저장소에서 `gfm-viewer/` 폴더를 넣은 뒤 그대로 붙여넣기)

`gfm-viewer/SPEC_FORMAT.md`와 `gfm-viewer/export_spec.py`, `gfm-viewer/teach_model.py`를 읽어줘.
그리고 우리 연구 모델 `model.py`(22차: DC 8 + AC 14)를 이 뷰어에서 돌릴 수 있게 해줘.

1. `model.py`의 상태벡터·입력·파라미터·dx/dt 식이 어디 있는지 찾아서 요약해줘 (코드 수정 전 보고).
2. `export_spec.py`의 `load()` ADAPTER 분기만 채워서 `--module model`로 동작하게 해줘. model.py 자체는 수정하지 마.
   - ω → `w`, δ → `dl` 이름 매핑, 신호 슬롯은 SPEC_FORMAT.md 표 기준 (모델에 있는 것만)
   - DC 단 v_dc가 있으면 `vdc` 슬롯 추가
   - 슬라이더는 H(또는 J), D, 그리고 PSO 대상 파라미터 중 핵심 3~4개
3. `python export_spec.py --module model --out gfm-viewer/gfm_spec_22.json` 실행 결과를 보여줘.
4. 검증: 같은 운전점에서 `model.py`의 기존 Jacobian 고유값과, spec의 rhs를 수치미분한 고유값이 일치하는지 비교 스크립트(`gfm-viewer/xcheck_spec.py`)를 만들어 실행해줘 (최대 σ 오차 보고).
5. 브라우저에서 `gfm-live-flow.html`을 열고 `gfm_spec_22.json`을 끌어다 놓으면 "검증 ✓"가 떠야 한다는 것을 안내하고 멈춰.
