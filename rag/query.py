"""
GMF Labs — 두뇌 검색
벡터 검색으로 시드 청크를 찾고, 그 노트들이 [[위키링크]]로 가리키는 노트를 1-hop 확장한다.
(connect-ai 의 readGraphRagBrainContext 와 같은 아이디어 — 키워드 대신 임베딩)

반환 컨텍스트는 에이전트 프롬프트에 그대로 붙일 수 있는 마크다운 블록이며,
각 청크에 🎯(직접 매칭)/🔗(링크로 도달) 와 ▸/※ 비율을 표시한다.

사용:
  python query.py "A_k(9,6) 이론값 근거가 뭐야" --db ./chroma
"""
from __future__ import annotations

import argparse
import json
from dataclasses import dataclass
from pathlib import Path

import chromadb

from ingest import embed  # 같은 임베딩 함수 재사용


@dataclass
class Hit:
    id: str
    text: str
    meta: dict
    score: float
    via: str | None = None   # 링크 확장으로 들어온 경우 시드 노트 이름


def _embed_query(q: str) -> list[float]:
    # e5 폴백일 때는 "query:" 프리픽스가 성능에 영향 — embed() 내부에서 passage 프리픽스를
    # 쓰므로 여기서는 그대로 두되, Ollama 경로는 프리픽스 무관.
    return embed([q])[0]


def search(
    q: str,
    db_dir: Path,
    collection: str = "gfm_brain",
    k: int = 6,
    hop: int = 4,
    where: dict | None = None,
) -> list[Hit]:
    client = chromadb.PersistentClient(path=str(db_dir))
    col = client.get_collection(collection)
    res = col.query(query_embeddings=[_embed_query(q)], n_results=k,
                    where=where, include=["documents", "metadatas", "distances"])
    hits: list[Hit] = []
    for cid, doc, meta, dist in zip(res["ids"][0], res["documents"][0],
                                    res["metadatas"][0], res["distances"][0]):
        hits.append(Hit(cid, doc, meta, 1 - dist))

    # ── 1-hop: 시드 노트들이 링크한 노트 중 아직 없는 것을 가져온다
    seed_names = {h.meta["name"] for h in hits}
    linked: dict[str, str] = {}
    for h in hits:
        for ln in json.loads(h.meta.get("links", "[]")):
            if ln not in seed_names and ln not in linked:
                linked[ln] = h.meta["name"]
    if linked and hop > 0:
        extra = col.get(where={"name": {"$in": list(linked)[:hop * 3]}},
                        include=["documents", "metadatas"])
        seen_notes: set[str] = set()
        for cid, doc, meta in zip(extra["ids"], extra["documents"], extra["metadatas"]):
            # 노트당 첫 청크(서두)만 — 링크 확장은 맥락 제공이 목적
            if meta["name"] in seen_notes:
                continue
            seen_notes.add(meta["name"])
            best = max(h.score for h in hits if h.meta["name"] == linked[meta["name"]])
            hits.append(Hit(cid, doc, meta, best * 0.5, via=linked[meta["name"]]))
            if len(seen_notes) >= hop:
                break
    hits.sort(key=lambda h: h.score, reverse=True)
    return hits


def to_context(hits: list[Hit], budget_chars: int = 6000) -> str:
    """에이전트 시스템 프롬프트에 붙이는 블록."""
    lines = ["[두뇌 지식 — 🎯 직접 매칭 / 🔗 링크 확장. ▸=실험·논문 ※=해석. 여기 없는 값은 '미명시'로 답하라]"]
    used = len(lines[0])
    for h in hits:
        tag = "🔗" if h.via else "🎯"
        via = f" ← [[{h.via}]]" if h.via else ""
        ev, it = h.meta.get("evidence_lines", 0), h.meta.get("interpretation_lines", 0)
        head = f"\n{tag} **{h.meta['name']}** › {h.meta.get('heading','')} ({h.meta['folder']}, ▸{ev}/※{it}){via}"
        body = h.text.split("\n", 1)[1] if "\n" in h.text else h.text
        block = head + "\n" + body.strip()
        if used + len(block) > budget_chars:
            break
        lines.append(block)
        used += len(block)
    return "\n".join(lines)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("q")
    ap.add_argument("--db", default="./chroma")
    ap.add_argument("-k", type=int, default=6)
    ap.add_argument("--folder", help="예: 04_문헌 (폴더로 제한)")
    a = ap.parse_args()
    where = {"folder": a.folder} if a.folder else None
    print(to_context(search(a.q, Path(a.db), k=a.k, where=where)))
