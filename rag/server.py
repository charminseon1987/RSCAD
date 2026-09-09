"""
GMF Labs — 두뇌 검색 서버 (:5100)

  GET  /health
  POST /query  {q, k?, folder?}          → 컨텍스트 블록 (에이전트 프롬프트용)
  POST /ask    {q, k?, model?}           → 로컬 LLM(LM Studio/Ollama)이 컨텍스트 기반 답변
  POST /reindex                          → Vault 재색인

connect-ai 포크에서는 readAgentSharedContext() 안에서
  axios.post('http://127.0.0.1:5100/query', { q: taskText, k: 6 })
로 호출해 반환 문자열을 ctx 에 붙이면 된다.

실행:
  uvicorn server:app --port 5100 --reload
환경변수:
  GFM_VAULT   Vault 경로 (필수)
  GFM_DB      ChromaDB 폴더 (기본 ./chroma)
  LLM_URL     기본 http://127.0.0.1:1234 (LM Studio) / 11434 면 Ollama 로 인식
  LLM_MODEL   비우면 서버의 첫 모델 자동 사용
"""
from __future__ import annotations

import os
from pathlib import Path

import requests
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from ingest import index_vault
from query import search, to_context

VAULT = Path(os.environ.get("GFM_VAULT", "")).expanduser()
DB = Path(os.environ.get("GFM_DB", "./chroma")).resolve()
LLM_URL = os.environ.get("LLM_URL", "http://127.0.0.1:1234").rstrip("/")
LLM_MODEL = os.environ.get("LLM_MODEL", "")

SYSTEM = """당신은 GMF Labs의 연구 보조다. GFM 인버터 소신호 안정도 연구를 돕는다.
절대 규칙:
1. 아래 [두뇌 지식] 블록에 있는 내용만 근거로 답한다. 없는 값은 "미명시"라고 쓴다.
2. 모든 사실 문장 끝에 출처를 붙인다: (노트: 이름) 또는 [n].
3. ▸(실험·논문 사실)과 ※(해석·판단)을 반드시 구분해 표기한다.
4. 숫자를 추정해 만들어내지 않는다.
"""

app = FastAPI(title="GMF Labs Brain")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


class QueryIn(BaseModel):
    q: str
    k: int = 6
    folder: str | None = None
    budget: int = 6000


class AskIn(QueryIn):
    model: str | None = None


def _is_ollama() -> bool:
    return "11434" in LLM_URL


def _pick_model() -> str:
    if LLM_MODEL:
        return LLM_MODEL
    try:
        if _is_ollama():
            return requests.get(f"{LLM_URL}/api/tags", timeout=3).json()["models"][0]["name"]
        return requests.get(f"{LLM_URL}/v1/models", timeout=3).json()["data"][0]["id"]
    except Exception as e:  # noqa: BLE001
        raise HTTPException(503, f"로컬 LLM 미실행 또는 모델 없음: {e}")


def _chat(model: str, messages: list[dict]) -> str:
    if _is_ollama():
        r = requests.post(f"{LLM_URL}/api/chat",
                          json={"model": model, "messages": messages, "stream": False,
                                "options": {"temperature": 0.2}}, timeout=300)
        r.raise_for_status()
        return r.json()["message"]["content"]
    r = requests.post(f"{LLM_URL}/v1/chat/completions",
                      json={"model": model, "messages": messages, "temperature": 0.2}, timeout=300)
    r.raise_for_status()
    return r.json()["choices"][0]["message"]["content"]


@app.get("/health")
def health():
    return {"ok": True, "vault": str(VAULT), "db": str(DB), "llm": LLM_URL}


@app.post("/query")
def query(body: QueryIn):
    where = {"folder": body.folder} if body.folder else None
    hits = search(body.q, DB, k=body.k, where=where)
    return {
        "context": to_context(hits, body.budget),
        "sources": [{"name": h.meta["name"], "path": h.meta["path"], "score": round(h.score, 3),
                     "via": h.via} for h in hits],
    }


@app.post("/ask")
def ask(body: AskIn):
    where = {"folder": body.folder} if body.folder else None
    hits = search(body.q, DB, k=body.k, where=where)
    ctx = to_context(hits, body.budget)
    model = body.model or _pick_model()
    answer = _chat(model, [
        {"role": "system", "content": SYSTEM + "\n\n" + ctx},
        {"role": "user", "content": body.q},
    ])
    return {"answer": answer, "model": model,
            "sources": [{"name": h.meta["name"], "path": h.meta["path"]} for h in hits]}


@app.post("/reindex")
def reindex():
    if not VAULT.exists():
        raise HTTPException(400, f"GFM_VAULT 경로 없음: {VAULT}")
    index_vault(VAULT, DB)
    return {"ok": True}
