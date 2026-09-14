# 🔍 Connect AI — LLM 연결 진단

_2026. 9. 9. 오후 4:54:06_

ℹ️ 설정된 LLM 서버: http://127.0.0.1:11434
ℹ️ 설정된 기본 모델: qwen3:14b
✅ Ollama 실행 중 (포트 11434) · 모델 2개: nomic-embed-text:latest, qwen3:14b
✅ LM Studio 실행 중 (포트 1234) · 모델 2개: google/gemma-4-e4b, text-embedding-nomic-embed-text-v1.5
✅ 설정된 서버(http://127.0.0.1:11434) 도달 OK

✅ LLM 연결 가능. 채팅 시도해보세요.

## 🐍 Python 환경
ℹ️ 자동 감지 결과: `py -3`
✅ Python 3 확인: Python 3.12.10
ℹ️ 사용자 설정 없음 (자동 감지 사용). 직접 지정하려면 명령 팔레트 → "설정 열기" → `connectAiLab.pythonPath`
ℹ️ 후보 명령 평행 테스트:
  ✅ `py` → Python 3.12.10
  ✅ `py -3` → Python 3.12.10
  ✅ `python` → Python 3.12.10
  ❌ `python3` → 실패 (status 9009)

---

## 자주 막히는 곳

### LM Studio가 처음이면
1. LM Studio 앱 열기
2. 좌측 사이드바 'Discover' (🔍) 에서 모델 검색·다운로드 (예: 'Qwen2.5 7B Instruct')
3. 좌측 사이드바 'Chat' (💬) 가서 모델이 로드되는지 확인 (한 번 채팅해봐야 메모리에 올라옴)
4. 좌측 사이드바 'Developer' (또는 'Local Server') 가기
5. **'Start Server' 버튼 클릭** ← 이게 핵심. 시작 안 하면 Connect AI에서 못 봐요.
6. 화면에 `http://localhost:1234` 같은 URL이 보이면 OK
7. Connect AI 사이드바 위 모델 메뉴에서 모델 선택 → 채팅 시도

### Ollama가 처음이면
1. `ollama pull qwen2.5:7b` (터미널, 한 번만)
2. `ollama serve` 또는 Ollama 앱 실행
3. Connect AI 모델 메뉴에서 선택 → 채팅

### 그래도 안 되면
- VS Code/Anti-Gravity 재시작
- 명령 팔레트 (Cmd+Shift+P) → `Connect AI: 연결 진단` 다시 실행
- 위 결과 스크린샷 + LM Studio 'Developer' 탭 스크린샷을 함께 제보
