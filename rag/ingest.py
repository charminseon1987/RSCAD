"""
GMF Labs — 두뇌 색인기
Obsidian Vault의 *.md 를 읽어 청크로 나누고 로컬 임베딩으로 ChromaDB에 저장한다.

메타데이터로 보존하는 것:
  - frontmatter (type, phase, status, tags, ...)
  - [[위키링크]] 목록  → query.py 의 1-hop 확장에 사용
  - evidence 비율      → 청크 안의 ▸(실험/논문) vs ※(해석) 줄 수
  - 노트 폴더 (00_MOC / 01_개념 / 03_실험결과 ...)

사용:
  python ingest.py --vault "C:/Users/hyese/Obsidian/GFM" --db ./chroma
  python ingest.py --vault ... --watch      # 파일 바뀌면 자동 재색인
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
import time
from pathlib import Path
from typing import Iterable

import chromadb
import requests
import yaml

# ────────────────────────────────────────────── 설정
OLLAMA_URL = "http://127.0.0.1:11434"
EMBED_MODEL = "nomic-embed-text"          # ollama pull nomic-embed-text
CHUNK_CHARS = 1200
CHUNK_OVERLAP = 150
SKIP_DIRS = {".obsidian", ".trash", "node_modules", ".git", "05_템플릿"}

WIKILINK_RE = re.compile(r"\[\[([^\]|#\n]+)(?:[#|][^\]]*)?\]\]")
FRONTMATTER_RE = re.compile(r"^---\s*\n(.*?)\n---\s*\n", re.S)
HEADING_RE = re.compile(r"^(#{1,6})\s+(.*)$", re.M)


# ────────────────────────────────────────────── 임베딩
def embed(texts: list[str]) -> list[list[float]]:
    """Ollama 임베딩. 실패 시 sentence-transformers 로 폴백."""
    try:
        out = []
        for t in texts:
            r = requests.post(f"{OLLAMA_URL}/api/embeddings",
                              json={"model": EMBED_MODEL, "prompt": t}, timeout=60)
            r.raise_for_status()
            out.append(r.json()["embedding"])
        return out
    except Exception as e:  # noqa: BLE001
        print(f"[embed] Ollama 실패({e}) → sentence-transformers 폴백", file=sys.stderr)
        from sentence_transformers import SentenceTransformer  # pip install sentence-transformers
        model = SentenceTransformer("intfloat/multilingual-e5-small")
        return model.encode([f"passage: {t}" for t in texts], normalize_embeddings=True).tolist()


# ────────────────────────────────────────────── 파싱
def parse_note(path: Path, vault: Path) -> dict:
    raw = path.read_text(encoding="utf-8", errors="ignore")
    fm: dict = {}
    body = raw
    m = FRONTMATTER_RE.match(raw)
    if m:
        try:
            fm = yaml.safe_load(m.group(1)) or {}
        except yaml.YAMLError:
            fm = {}
        body = raw[m.end():]
    # Vault 문서 일부는 "## type: ..." 형식으로 frontmatter 를 헤딩에 넣었음 → 그것도 읽음
    if not fm:
        hm = re.match(r"^\s*##\s+(type:.*)$", body, re.M)
        if hm:
            for kv in re.findall(r"(\w+):\s*([^\s\[]+|\[[^\]]*\])", hm.group(1)):
                fm[kv[0]] = kv[1].strip("[]")
    links = sorted({l.strip() for l in WIKILINK_RE.findall(raw)})
    rel = path.relative_to(vault).as_posix()
    folder = rel.split("/")[0] if "/" in rel else "_root"
    return {
        "path": rel,
        "name": path.stem,
        "folder": folder,
        "frontmatter": fm,
        "links": links,
        "body": body,
    }


def split_chunks(body: str) -> Iterable[tuple[str, str]]:
    """헤딩 단위로 자른 뒤, 길면 겹치게 재분할. (heading, text) 반환."""
    positions = [(m.start(), m.group(2).strip()) for m in HEADING_RE.finditer(body)]
    positions.append((len(body), None))
    if not positions or positions[0][0] > 0:
        positions.insert(0, (0, "(서두)"))
    for (start, heading), (end, _) in zip(positions, positions[1:]):
        section = body[start:end].strip()
        if not section:
            continue
        i = 0
        while i < len(section):
            yield heading or "", section[i:i + CHUNK_CHARS]
            i += CHUNK_CHARS - CHUNK_OVERLAP


def evidence_stats(text: str) -> tuple[int, int]:
    ev = sum(1 for ln in text.splitlines() if ln.lstrip().startswith("▸"))
    it = sum(1 for ln in text.splitlines() if ln.lstrip().startswith("※"))
    return ev, it


# ────────────────────────────────────────────── 색인
def index_vault(vault: Path, db_dir: Path, collection_name: str = "gfm_brain") -> None:
    client = chromadb.PersistentClient(path=str(db_dir))
    col = client.get_or_create_collection(collection_name, metadata={"hnsw:space": "cosine"})

    files = [p for p in vault.rglob("*.md") if not any(part in SKIP_DIRS for part in p.parts)]
    print(f"[ingest] {len(files)} notes in {vault}")

    existing = set(col.get(include=[])["ids"])
    seen: set[str] = set()
    ids, docs, metas = [], [], []

    for path in files:
        note = parse_note(path, vault)
        mtime = int(path.stat().st_mtime)
        for n, (heading, text) in enumerate(split_chunks(note["body"])):
            h = hashlib.sha1(text.encode()).hexdigest()[:10]
            cid = f"{note['path']}#{n}:{h}"
            seen.add(cid)
            if cid in existing:
                continue  # 내용 동일 → 재임베딩 생략
            ev, it = evidence_stats(text)
            fm = note["frontmatter"]
            metas.append({
                "path": note["path"],
                "name": note["name"],
                "folder": note["folder"],
                "heading": heading,
                "type": str(fm.get("type", "")),
                "phase": str(fm.get("phase", "")),
                "status": str(fm.get("status", "")),
                "tags": ",".join(map(str, fm.get("tags", []) if isinstance(fm.get("tags"), list) else [fm.get("tags", "")])),
                "links": json.dumps(note["links"], ensure_ascii=False),
                "evidence_lines": ev,
                "interpretation_lines": it,
                "mtime": mtime,
            })
            ids.append(cid)
            docs.append(f"# {note['name']} › {heading}\n{text}")

    # 삭제·변경된 청크 제거
    stale = list(existing - seen)
    if stale:
        col.delete(ids=stale)
        print(f"[ingest] removed {len(stale)} stale chunks")

    B = 32
    for i in range(0, len(ids), B):
        col.add(ids=ids[i:i + B], documents=docs[i:i + B],
                metadatas=metas[i:i + B], embeddings=embed(docs[i:i + B]))
        print(f"[ingest] {min(i + B, len(ids))}/{len(ids)}")
    print(f"[ingest] done. collection size = {col.count()}")


def watch(vault: Path, db_dir: Path, interval: float = 5.0) -> None:
    """가벼운 폴링 감시. watchdog 없이 동작."""
    def snapshot() -> dict[str, int]:
        return {str(p): int(p.stat().st_mtime) for p in vault.rglob("*.md")}
    last = snapshot()
    print("[watch] 감시 시작 — Ctrl+C 로 종료")
    while True:
        time.sleep(interval)
        cur = snapshot()
        if cur != last:
            print("[watch] 변경 감지 → 재색인")
            index_vault(vault, db_dir)
            last = cur


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--vault", required=True, help="Obsidian Vault 루트 경로")
    ap.add_argument("--db", default="./chroma", help="ChromaDB 저장 폴더")
    ap.add_argument("--watch", action="store_true", help="파일 변경 감시 + 자동 재색인")
    a = ap.parse_args()
    v, d = Path(a.vault).expanduser().resolve(), Path(a.db).resolve()
    index_vault(v, d)
    if a.watch:
        watch(v, d)
