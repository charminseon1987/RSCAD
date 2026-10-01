/* 내 논문에게 묻기 — 근거 Q&A

   질문 → 로컬 색인에서 대목 검색 → 그 대목만으로 답 → 문장마다 [n] 인용.
   [n] 을 누르면 그 논문의 그 쪽이 ④ 리더에 열린다.

   여기 나오는 답은 전부 AI 가 쓴 것이다. 화면에서도 노트에서도 ※ 로만 다루고
   ▸(원문 근거)로 올리지 않는다 — 인용은 원문을 본 뒤에. */
import { useEffect, useState } from 'react';
import { fetchJSON, postJSON } from '../lib/api';

export interface Hit {
  id: string; doc: string; title: string; page: number | null; sim: number; text: string;
}
interface Status {
  chunks: number; error: string; strategy: string; embed_model: string; min_sim: number;
  docs: { doc: string; chunks: number; pages: number }[];
  ollama: { ok: boolean; msg: string; model: string; models: string[] };
}
interface Props {
  docId: string;                     // 지금 논문의 색인 문서 이름 (PDF 파일명) — 없으면 ''
  citeKey: string;
  noteReady: boolean;                // 노트가 저장돼 있어야 ※로 남길 수 있다
  onJump: (doc: string, page: number) => void;
}

const input: React.CSSProperties = {
  fontSize: 15, padding: '9px 12px', borderRadius: 9,
  border: '1px solid var(--s-line)', background: 'var(--s-bg)', color: 'var(--ink)', width: '100%',
};
const primary: React.CSSProperties = {
  fontSize: 15, fontWeight: 600, padding: '9px 18px', borderRadius: 10,
  background: 'var(--s-accent)', color: '#fff', border: 'none', cursor: 'pointer',
};

/* 답의 [n] 을 누를 수 있게 쪼갠다 */
function Answer({ text, hits, onCite }: { text: string; hits: Hit[]; onCite: (h: Hit) => void }) {
  const parts = text.split(/(\[\d{1,2}\])/g);
  return (
    <div style={{ fontSize: 15, lineHeight: 1.85, whiteSpace: 'pre-wrap' }}>
      {parts.map((p, i) => {
        const m = /^\[(\d{1,2})\]$/.exec(p);
        const h = m ? hits[+m[1] - 1] : undefined;
        if (!h) return <span key={i}>{p}</span>;
        return (
          <button key={i} className="s-chip" onClick={() => onCite(h)}
            title={`${h.doc}${h.page ? ` p.${h.page}` : ''} — 유사도 ${h.sim}`}
            style={{ padding: '0 6px', margin: '0 2px', fontSize: 12.5, verticalAlign: 'baseline' }}>
            {m![1]}
          </button>
        );
      })}
    </div>
  );
}

export default function AskPanel({ docId, citeKey, noteReady, onJump }: Props) {
  const [st, setSt] = useState<Status | null>(null);
  const [q, setQ] = useState('');
  const [scope, setScope] = useState<'this' | 'all'>('all');
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [res, setRes] = useState<{
    q: string; answer: string; hits: Hit[]; grounded: boolean; enough: boolean;
    truncated?: boolean; error?: string; note?: string; model?: string;
  } | null>(null);

  useEffect(() => {
    fetchJSON('/scholar/ask/status').then(setSt)
      .catch(e => setErr(String(e?.message || e).slice(0, 200)));
  }, []);

  /* 이 논문만 보려면 색인 안의 문서 이름을 알아야 한다. PDF 파일명이 cite_key 와
     다른 논문이 있어 (Salem_2025_GFM_Review ↔ salem2025gfmreview) 첨부 경로에서 가져온다. */
  const indexed = !!docId && !!st?.docs.some(d => d.doc === docId);
  /* 대목 수: 답을 쓸 때는 적게(프롬프트가 길수록 느려진다), 검색만 할 때는 넉넉히 */
  const body = (n: number) => ({
    q: q.trim(), n,
    ...(scope === 'this' && indexed ? { docs: [docId] } : {}),
  });

  const run = (path: string, tag: string) => {
    if (q.trim().length < 2) { setErr('두 글자 이상 입력하세요'); return; }
    setBusy(tag); setErr(''); setMsg(''); setRes(null);
    postJSON(path, body(4))
      .then(d => setRes({
        q: d.q, answer: d.answer || '', hits: d.hits || [],
        grounded: !!d.grounded, enough: d.enough !== false, truncated: !!d.truncated,
        error: d.error, note: d.note, model: d.model,
      }))
      .catch(e => setErr(String(e?.message || e).replace(/^HTTP \d+: /, '').slice(0, 300)))
      .finally(() => setBusy(''));
  };

  /* 검색만 — Ollama 없이도 '어느 논문 몇 쪽'까지는 알 수 있다 */
  const searchOnly = () => {
    if (q.trim().length < 2) { setErr('두 글자 이상 입력하세요'); return; }
    setBusy('search'); setErr(''); setMsg(''); setRes(null);
    postJSON('/scholar/ask/search', body(8))
      .then(d => setRes({
        q: d.q, answer: '', hits: d.hits || [], grounded: false,
        enough: !!d.enough, note: d.note,
      }))
      .catch(e => setErr(String(e?.message || e).replace(/^HTTP \d+: /, '').slice(0, 300)))
      .finally(() => setBusy(''));
  };

  const toNote = () => {
    if (!res?.answer) return;
    setBusy('note'); setErr('');
    postJSON('/scholar/ask/to-note', {
      key: citeKey, q: res.q, answer: res.answer, hits: res.hits,
    }).then(d => setMsg(`노트에 ※ 로 적었습니다 — ${d.path}`))
      .catch(e => setErr(String(e?.message || e).replace(/^HTTP \d+: /, '').slice(0, 300)))
      .finally(() => setBusy(''));
  };

  const cite = (h: Hit) => {
    if (!h.page) { setMsg(`${h.doc} — 쪽 번호를 모르는 대목입니다`); return; }
    if (h.doc === docId) { onJump(h.doc, h.page); setMsg(''); }
    else setMsg(`${h.doc} p.${h.page} — 지금 열린 원문과 다른 논문입니다. 그 논문을 골라야 그 쪽이 열립니다.`);
  };

  const ready = !!st && !st.error && st.chunks > 0;

  return (
    <div style={{ marginTop: 22, paddingTop: 16, borderTop: '1px dashed var(--s-line)' }}>
      <div style={{ fontSize: 15.5, fontWeight: 700 }}>내 논문에게 묻기 — 근거 Q&A</div>
      <p style={{ fontSize: 14, color: 'var(--ink-2)', marginTop: 4, lineHeight: 1.8 }}>
        색인된 내 PDF 에서 대목을 찾아 <strong>그 대목만으로</strong> 답합니다. 바깥으로 보내지 않습니다.
        문장 뒤 번호를 누르면 그 논문의 그 쪽이 위 리더에 열립니다.
        <br />가까운 대목을 못 찾으면 <strong>답하지 않습니다</strong> — 지어내는 것보다 낫기 때문입니다.
        <br />답을 쓰는 데 <strong>1~4분</strong> 걸립니다. 로컬 모델이라 이 기기에서 초당 3토큰쯤 나옵니다 —
        급하면 <strong>검색만</strong> 쓰세요 (몇 초).
      </p>

      {/* 무엇으로 답하는지 먼저 밝힌다 */}
      {!st && !err && <p style={{ fontSize: 14, color: 'var(--ink-3)', marginTop: 8 }}>색인 상태를 확인하는 중…</p>}
      {st && (
        <div className="flex gap-2 flex-wrap items-center" style={{ marginTop: 8, fontSize: 13 }}>
          {st.error
            ? <span className="s-chip" style={{ cursor: 'default', color: 'var(--s-interp)' }}>색인 없음 — {st.error}</span>
            : <span className="s-chip" style={{ cursor: 'default' }}>
                색인 {st.chunks}청크 · 논문 {st.docs.length}편
              </span>}
          <span className="s-chip" style={{ cursor: 'default' }}>임베딩 {st.embed_model}</span>
          <span className="s-chip" style={{
            cursor: 'default', color: st.ollama.ok ? 'var(--s-ok)' : 'var(--s-interp)',
          }}>
            {st.ollama.ok ? `모델 ${st.ollama.model}` : `모델 없음 — ${st.ollama.msg}`}
          </span>
          {docId && (
            <span className="s-chip" style={{ cursor: 'default' }}>
              이 논문: {indexed ? `색인됨 (${docId})` : '색인에 없음'}
            </span>
          )}
        </div>
      )}

      {ready && (
        <>
          <div className="flex gap-2 flex-wrap items-center" style={{ marginTop: 10 }}>
            <button className="s-chip" aria-pressed={scope === 'all'}
              onClick={() => setScope('all')}>색인 전체</button>
            <button className="s-chip" aria-pressed={scope === 'this'} disabled={!indexed}
              title={indexed ? '' : '이 논문은 색인에 없습니다'}
              onClick={() => setScope('this')}>이 논문만</button>
          </div>
          <div className="flex gap-2 mt-2">
            <input style={input} value={q} onChange={e => setQ(e.target.value)}
              placeholder="예: 약계통에서 GFM 의 과도 안정도 한계는 무엇으로 결정되나"
              onKeyDown={e => { if (e.key === 'Enter' && !busy) run('/scholar/ask', 'ask'); }} />
            <button style={primary} disabled={!!busy || !st?.ollama.ok}
              title={st?.ollama.ok ? '' : 'Ollama 가 꺼져 있습니다'}
              onClick={() => run('/scholar/ask', 'ask')}>
              {busy === 'ask' ? '답 쓰는 중…' : '묻기'}
            </button>
            <button className="s-chip" disabled={!!busy} onClick={searchOnly}>
              {busy === 'search' ? '찾는 중' : '검색만'}
            </button>
          </div>
          {!st?.ollama.ok && (
            <p className="s-interp" style={{ fontSize: 13.5, marginTop: 8 }}>
              ※ 모델이 없어 ‘묻기’ 는 막혀 있습니다. <strong>검색만</strong> 은 지금도 됩니다 —
              어느 논문 몇 쪽을 볼지는 알 수 있습니다.
            </p>
          )}
        </>
      )}

      {err && <p style={{ fontSize: 14, color: 'var(--error)', marginTop: 8 }}>{err}</p>}
      {msg && <p style={{ fontSize: 14, color: 'var(--s-accent-ink)', marginTop: 8 }}>{msg}</p>}

      {res && (
        <div style={{ marginTop: 12 }}>
          {res.error && (
            <p className="s-interp" style={{ fontSize: 14.5 }}>※ {res.error}</p>
          )}
          {res.note && !res.error && (
            <p className="s-interp" style={{ fontSize: 14 }}>※ {res.note}</p>
          )}

          {res.answer && (
            <div style={{
              padding: 14, borderRadius: 10, marginTop: 8,
              background: 'var(--s-interp-soft)', border: '1px solid var(--s-interp)',
            }}>
              <div style={{ fontSize: 12.5, color: 'var(--s-interp)', fontWeight: 600, marginBottom: 6 }}>
                ※ AI 생성 — 원문 확인 전에는 인용 근거(▸)로 쓰지 않습니다
                {res.model ? ` · ${res.model}` : ''}
                {!res.grounded && ' · 근거 번호 없음'}
                {res.truncated && ' · 마지막 문장 끊김'}
              </div>
              <Answer text={res.answer} hits={res.hits} onCite={cite} />
              <div className="flex gap-2 mt-3 flex-wrap">
                <button className="s-chip" disabled={!!busy || !noteReady} onClick={toNote}
                  title={noteReady ? '' : '먼저 ⑤에서 노트를 저장하세요'}>
                  노트에 ※ 로 남기기
                </button>
                {!noteReady && (
                  <span style={{ fontSize: 13, color: 'var(--ink-3)', alignSelf: 'center' }}>
                    노트를 저장한 뒤에 남길 수 있습니다
                  </span>
                )}
              </div>
            </div>
          )}

          {!!res.hits.length && (
            <>
              <div style={{ fontSize: 14, fontWeight: 600, marginTop: 14, marginBottom: 6 }}>
                근거로 쓰인 대목 {res.hits.length}개
              </div>
              <div className="space-y-2">
                {res.hits.map((h, i) => (
                  <div key={h.id} className="s-src">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div style={{ fontSize: 13.5, color: 'var(--ink-3)' }}>
                        <strong style={{ color: 'var(--ink)' }}>[{i + 1}]</strong> {h.doc}
                        {h.page ? ` · p.${h.page}` : ' · 쪽 모름'}
                        {h.title ? ` · ${h.title}` : ''} · 유사도 {h.sim}
                        {h.sim < (st?.min_sim ?? 0.35) && (
                          <span style={{ color: 'var(--s-interp)' }}> · 약함</span>
                        )}
                      </div>
                      {h.page && h.doc === docId && (
                        <button className="s-chip shrink-0"
                          onClick={() => onJump(h.doc, h.page!)}>p.{h.page} 열기 ↗</button>
                      )}
                    </div>
                    <p style={{ fontSize: 13.5, color: 'var(--ink-2)', marginTop: 6, lineHeight: 1.7 }}>
                      {h.text.slice(0, 320)}{h.text.length > 320 ? '…' : ''}
                    </p>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
