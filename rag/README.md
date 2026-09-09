# rag/ — GMF Labs 두뇌 검색

## 준비 (1회)
```bash
pip install -r requirements.txt
ollama pull nomic-embed-text          # 임베딩 모델 (270MB). 없으면 sentence-transformers 폴백
```

## 색인
```bash
# Vault 경로는 본인 Obsidian 폴더
python ingest.py --vault "C:/Users/hyese/Obsidian/GFM" --db ./chroma
python ingest.py --vault ... --watch   # 노트 수정 시 자동 재색인
```

## 검색 테스트
```bash
python query.py "A_k(9,6) 이론값의 근거 문헌은?"
python query.py "DC PI 구조 버그 시도 기록" --folder 03_실험결과
```
기대: `DC-AC_커플링`(🎯) + `Zhao_2023_Aalborg`(🔗, 링크 확장) 이 상위에 나옴.

## 서버
```bash
set GFM_VAULT=C:/Users/hyese/Obsidian/GFM     # PowerShell: $env:GFM_VAULT="..."
set LLM_URL=http://127.0.0.1:1234              # LM Studio. Ollama면 :11434
uvicorn server:app --port 5100 --reload
```
```bash
curl -X POST localhost:5100/query -H "Content-Type: application/json" -d "{\"q\":\"ζ_threshold 0.64 유도\"}"
curl -X POST localhost:5100/ask   -H "Content-Type: application/json" -d "{\"q\":\"현재 Phase 2 미해결 이슈 요약\"}"
```

## connect-ai 포크에 연결
`src/extension.ts` `readAgentSharedContext()` 에서 `readGraphRagBrainContext(...)` 호출을
아래로 교체 (동기 함수라 prefetch 패턴처럼 dispatch 직전에 미리 받아 넘기는 방식 권장):
```ts
const r = await axios.post('http://127.0.0.1:5100/query', { q: taskText, k: 6, budget: lean ? 2000 : 6000 }, { timeout: 8000 });
ctx += '\n\n' + r.data.context;
```
