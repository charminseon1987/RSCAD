# gfm-viewer — GFM 제어 루프 실시간 신호 흐름

- `gfm-live-flow.html` — 뷰어 (브라우저로 열기, 서버 불필요). 기본은 14차 교육용 모델
- `export_spec.py` — sympy 모델 → spec JSON (식은 `sympy.jscode`로 변환, 검증 벡터 포함)
- `teach_model.py` — 기본 모델의 sympy 기술 (ADAPTER 기준 구현)
- `gfm_spec.example.json` — `python export_spec.py` 출력 예
- `SPEC_FORMAT.md` — 형식·신호 슬롯 정의
- `PROMPT_CLAUDE_CODE.md` — 22차 연구 모델 연결용 Claude Code 프롬프트

```bash
pip install sympy numpy scipy
python export_spec.py                                  # 예시 재생성
python export_spec.py --module model --out gfm_spec_22.json   # ADAPTER 작성 후
```
