/* 노트북 — 소스 · 대화 · 산출물 3단 화면

   왼쪽  위: 소스 추가 (검색 · DOI · 볼트에서)    아래: 소스 목록 (고르면 범위가 된다)
   가운데   : 고른 소스에게 묻고 답을 받는다. 답의 [n] 은 원문 쪽을 가리킨다.
   오른쪽 위: 고른 소스를 묶어 보고서·비교표 만들기   아래: 만들어진 산출물

   여기 나오는 답과 산출물은 전부 로컬 모델이 쓴 것이다 (원문은 기기 밖으로
   나가지 않는다). 그래도 AI 생성물이라 ※ 로만 다루고, 인용할 대목은 답이 아니라
   '근거로 쓰인 대목' 에서 골라 발췌 보관함에 담는다 — 그게 내 논문으로 간다. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchJSON, postJSON } from '../lib/api';

interface Paper {
  title: string; authors: string; year: number | null; venue: string; doi: string;
  cited_by: number; abstract: string; pdf_url: string; topics: string[]; source: string;
  score: number; cite_key?: string; in_vault?: boolean; in_inbox?: boolean;
}
interface Item {
  key: string; paper: Paper; stage: number; note_path: string;
  tags?: string[]; highlights: unknown[];
}
interface Attach { ok: boolean; path?: string; bytes?: number }
interface Hit { id: string; doc: string; title: string; page: number | null; sim: number; text: string }
interface Turn {
  q: string; answer: string; hits: Hit[]; grounded: boolean; enough: boolean;
  truncated?: boolean; error?: string; note?: string; model?: string; at: string;
}
interface Report {
  id: string; kind: string; label: string; title: string; text: string;
  docs: string[]; used_docs: string[]; missing_docs: string[];
  grounded: boolean; truncated: boolean; verified: boolean; model: string;
  hits: { doc: string; page: number | null; sim: number; title: string }[]; created: string;
}
interface Kind { kind: string; label: string; hint: string; ask: string }
interface Section { id: string; title: string }
interface Clip {
  id: string; cite_key: string; doc: string; page: string; text: string; note: string;
  section: string; kind: string; source: string; used: boolean; created: string;
}
interface AskStatus {
  chunks: number; error: string; min_sim: number; embed_model: string;
  docs: { doc: string; chunks: number; pages: number }[];
  ollama: { ok: boolean; msg: string; model: string };
}

const input: React.CSSProperties = {
  fontSize: 14, padding: '8px 11px', borderRadius: 9,
  border: '1px solid var(--s-line)', background: 'var(--s-bg)', color: 'var(--ink)', width: '100%',
};
const primary: React.CSSProperties = {
  fontSize: 14, fontWeight: 600, padding: '8px 16px', borderRadius: 9,
  background: 'var(--s-accent)', color: '#fff', border: 'none', cursor: 'pointer',
};
const label: React.CSSProperties = { fontSize: 12.5, color: 'var(--ink-3)', marginBottom: 4 };
const colBox: React.CSSProperties = { maxHeight: '46vh', overflowY: 'auto' };

export default function Notebook() {
  // 소스
  const [items, setItems] = useState<Item[]>([]);
  const [attach, setAttach] = useState<Record<string, Attach>>({});
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [q, setQ] = useState('');
  const [found, setFound] = useState<Paper[] | null>(null);
  const [vaultOnly, setVaultOnly] = useState<{ key: string; paper: Paper; has_pdf: boolean }[]>([]);

  // 대화
  const [turns, setTurns] = useState<Turn[]>([]);
  const [ask, setAsk] = useState('');
  const [st, setSt] = useState<AskStatus | null>(null);

  // 산출물
  const [kinds, setKinds] = useState<Kind[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [focus, setFocus] = useState('');
  const [openRep, setOpenRep] = useState('');

  // 발췌 보관함
  const [clips, setClips] = useState<Clip[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [clipKinds, setClipKinds] = useState<Record<string, string>>({});
  const [clipSec, setClipSec] = useState('?');

  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const chatRef = useRef<HTMLDivElement>(null);

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 5000); };
  const fail = (e: any) => setErr(String(e?.message || e).replace(/^HTTP \d+: /, '').slice(0, 300));

  const loadItems = () => fetchJSON('/scholar/inbox').then(d => setItems(d.items || [])).catch(() => {});
  const loadAttach = () => fetchJSON('/scholar/attachments').then(d => setAttach(d.attachments || {})).catch(() => {});
  const loadClips = () => fetchJSON('/notebook/clips').then(d => {
    setClips(d.clips || []); setSections(d.sections || []); setClipKinds(d.kinds || {});
  }).catch(() => {});
  const loadReports = () => fetchJSON('/notebook/reports').then(d => setReports(d.reports || [])).catch(() => {});

  useEffect(() => {
    loadItems(); loadAttach(); loadClips(); loadReports();
    fetchJSON('/notebook/report-kinds').then(d => setKinds(d.kinds || [])).catch(() => {});
    fetchJSON('/scholar/vault-papers').then(d => setVaultOnly(d.papers || [])).catch(() => {});
    fetchJSON('/scholar/ask/status').then(setSt).catch(() => {});
  }, []);

  useEffect(() => { chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight }); }, [turns]);

  /* 색인은 PDF 파일명으로 문서를 센다. cite_key 와 다른 논문이 있어 첨부 경로에서 꺼낸다 */
  const docOf = (key: string) =>
    (attach[key]?.path || '').split('/').pop()?.replace(/\.pdf$/i, '') || '';
  const indexed = (key: string) => {
    const d = docOf(key);
    return !!d && !!st?.docs.some(x => x.doc === d);
  };
  const chosen = useMemo(() => items.filter(i => picked[i.key]), [items, picked]);
  const chosenDocs = useMemo(
    () => chosen.map(i => docOf(i.key)).filter(Boolean).filter(d => st?.docs.some(x => x.doc === d)),
    [chosen, attach, st]);
  const keyOfDoc = (doc: string) =>
    items.find(i => docOf(i.key) === doc)?.key || doc;

  /* ── 소스 추가 ── */
  const search = (e: React.FormEvent) => {
    e.preventDefault();
    const text = q.trim();
    if (text.length < 2) return;
    setBusy('search'); setErr(''); setFound(null);
    /* 숫자·DOI 꼴이면 식별자로, 아니면 검색으로 — 사람이 고르게 하지 않는다 */
    const looksId = /10\.\d{4,9}\//.test(text) || /^\s*\d{4}\.\d{4,5}/.test(text) || /arxiv/i.test(text);
    const p = looksId
      ? postJSON('/scholar/identify', { text }).then(d => (d.paper ? [d.paper] : d.candidates || []))
      : postJSON('/scholar/search', { q: text }).then(d => d.papers || []);
    p.then(setFound).catch(fail).finally(() => setBusy(''));
  };

  const collect = (p: Paper) => postJSON('/scholar/inbox', { paper: p })
    .then(d => {
      setItems(d.items);
      setFound(f => f && f.map(x => (x.doi === p.doi && x.title === p.title ? { ...x, in_inbox: true } : x)));
      if (d.added?.length) { setPicked(s => ({ ...s, [d.added[0]]: true })); flash(`담았습니다 — ${d.added[0]}`); }
      else flash('이미 소스에 있습니다');
    }).then(loadAttach).catch(fail);

  const importVault = (key: string) => postJSON('/scholar/import', { keys: [key] })
    .then(d => {
      setItems(d.items);
      setVaultOnly(v => v.filter(x => x.key !== key));
      setPicked(s => ({ ...s, [key]: true }));
      flash(`볼트에서 가져왔습니다 — ${key}`);
    }).then(loadAttach).catch(fail);

  /* ── 대화 ── */
  const send = (text: string) => {
    const question = text.trim();
    if (question.length < 2 || busy) return;
    if (!st?.ollama.ok) { setErr('Ollama 가 꺼져 있습니다 — 터미널에서 `ollama serve`'); return; }
    setBusy('ask'); setErr(''); setAsk('');
    postJSON('/scholar/ask', {
      q: question, n: 4, ...(chosenDocs.length ? { docs: chosenDocs } : {}),
    }).then(d => setTurns(t => [...t, {
      q: question, answer: d.answer || '', hits: d.hits || [], grounded: !!d.grounded,
      enough: d.enough !== false, truncated: !!d.truncated, error: d.error,
      note: d.note, model: d.model, at: new Date().toLocaleTimeString(),
    }])).catch(fail).finally(() => setBusy(''));
  };

  /* 소스를 누르면 그 논문이 무엇인지부터 묻는다 — 소개가 대화의 출발점이다 */
  const introduce = (it: Item) => {
    setPicked({ [it.key]: true });
    const d = docOf(it.key);
    if (!d || !st?.docs.some(x => x.doc === d)) {
      flash(`${it.key} 는 색인에 없어 본문으로 답할 수 없습니다 — ③에서 PDF 를 보관하고 재색인하세요`);
      return;
    }
    setBusy('ask'); setErr('');
    postJSON('/scholar/ask', {
      q: `이 논문은 무엇을 다루고 무엇을 보였는가. 방법과 검증 조건도 함께.`,
      n: 5, docs: [d],
    }).then(x => setTurns(t => [...t, {
      q: `${it.key} 는 어떤 논문인가`, answer: x.answer || '', hits: x.hits || [],
      grounded: !!x.grounded, enough: x.enough !== false, truncated: !!x.truncated,
      error: x.error, note: x.note, model: x.model, at: new Date().toLocaleTimeString(),
    }])).catch(fail).finally(() => setBusy(''));
  };

  /* ── 발췌 보관 — 답이 아니라 '근거로 쓰인 대목' 을 담는다 ── */
  const clip = (h: Hit, note = '') => postJSON('/notebook/clips', {
    cite_key: keyOfDoc(h.doc), doc: h.doc, page: h.page, text: h.text,
    note, section: clipSec, kind: 'quote', source: 'ask', sim: h.sim,
  }).then(d => {
    setClips(d.clips);
    flash(d.note || `발췌를 보관했습니다 — ${keyOfDoc(h.doc)}${h.page ? ` p.${h.page}` : ''}`);
  }).catch(fail);

  /* ── 산출물 ── */
  const generate = (kind: string) => {
    if (!chosenDocs.length) { setErr('색인된 소스를 하나 이상 고르세요'); return; }
    if (!st?.ollama.ok) { setErr('Ollama 가 꺼져 있습니다'); return; }
    setBusy(kind); setErr('');
    postJSON('/notebook/generate', { kind, docs: chosenDocs, focus: focus.trim() })
      .then(d => { setReports(d.reports); setOpenRep(d.report.id); flash(d.note || `${d.report.label} 을 만들었습니다`); })
      .catch(fail).finally(() => setBusy(''));
  };
  const verify = (r: Report) => postJSON(`/notebook/reports/${r.id}/verify`, { verified: !r.verified })
    .then(d => setReports(d.reports)).catch(fail);
  const toVault = (r: Report) => postJSON(`/notebook/reports/${r.id}/to-vault`, {})
    .then(d => flash(`볼트에 적었습니다 — ${d.path}`)).catch(fail);
  const delReport = (r: Report) => fetchJSON(`/notebook/reports/${r.id}`, { method: 'DELETE' })
    .then(d => setReports(d.reports)).catch(fail);

  const okToAsk = !!st && !st.error && st.chunks > 0 && st.ollama.ok;

  return (
    <>
      <div className="s-panel" style={{ padding: 14 }}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div style={{ fontSize: 17, fontWeight: 700 }}>노트북 — 소스 · 대화 · 산출물</div>
            <p style={{ fontSize: 14, color: 'var(--ink-2)', marginTop: 3, lineHeight: 1.7 }}>
              왼쪽에서 고른 소스가 대화와 산출물의 범위가 됩니다. 답은 그 소스의 본문에서만 나옵니다 —
              색인도 모델도 이 기기에 있어 원문이 밖으로 나가지 않습니다.
              <br /><strong>인용할 대목은 답이 아니라 ‘근거로 쓰인 대목’ 에서 담으세요.</strong> 담은 것이 내논문으로 갑니다.
            </p>
          </div>
          <div className="flex gap-2 flex-wrap" style={{ fontSize: 12.5 }}>
            <span className="s-chip" style={{ cursor: 'default' }}>
              고른 소스 {chosen.length} · 색인된 것 {chosenDocs.length}
            </span>
            {st && (
              <span className="s-chip" style={{
                cursor: 'default', color: st.ollama.ok ? 'var(--s-ok)' : 'var(--s-interp)',
              }}>{st.ollama.ok ? st.ollama.model : st.ollama.msg}</span>
            )}
            <span className="s-chip" style={{ cursor: 'default' }}>보관 발췌 {clips.length}</span>
          </div>
        </div>
      </div>

      {err && <p style={{ color: 'var(--error)', fontSize: 14.5 }}>{err}</p>}
      {msg && <p style={{ color: 'var(--s-ok)', fontSize: 14.5 }}>{msg}</p>}

      <div className="grid grid-cols-12 gap-4 items-start">
        {/* ══ 왼쪽: 소스 ══ */}
        <div className="col-span-12 lg:col-span-3 space-y-3">
          <div className="s-panel" style={{ padding: 14 }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>소스 추가</div>
            <form onSubmit={search} className="flex gap-2 mt-2">
              <input style={input} value={q} onChange={e => setQ(e.target.value)}
                placeholder="주제 검색 · DOI · arXiv ID" />
              <button type="submit" className="s-chip" style={{ ...primary, padding: '7px 12px' }}
                disabled={busy === 'search'}>{busy === 'search' ? '…' : '찾기'}</button>
            </form>
            <p style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 6, lineHeight: 1.6 }}>
              DOI·arXiv ID 는 서지를 바로 받아 오고, 그 밖에는 외부 DB 를 검색합니다.
            </p>

            {found && (
              <div className="space-y-2 mt-3" style={colBox}>
                {!found.length && <p style={{ fontSize: 13.5, color: 'var(--ink-3)' }}>결과가 없습니다.</p>}
                {found.map((p, i) => (
                  <div key={(p.doi || p.title) + i} className="s-src" style={{ padding: 9 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.5 }}>{p.title}</div>
                    <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 3 }}>
                      {p.year || '연도 미명시'} · {p.venue || '게재처 미명시'}
                    </div>
                    <button className="s-chip mt-2" disabled={p.in_inbox}
                      style={p.in_inbox ? { fontSize: 12 } : { ...primary, padding: '5px 11px', fontSize: 12 }}
                      onClick={() => collect(p)}>{p.in_inbox ? '담김' : '＋ 소스로'}</button>
                  </div>
                ))}
              </div>
            )}

            {!!vaultOnly.length && (
              <details style={{ marginTop: 12 }}>
                <summary style={{ fontSize: 13.5, cursor: 'pointer', color: 'var(--ink-2)' }}>
                  볼트에 있는 논문 {vaultOnly.length}편 가져오기
                </summary>
                <div className="space-y-1 mt-2" style={colBox}>
                  {vaultOnly.map(v => (
                    <div key={v.key} className="flex items-center justify-between gap-2"
                      style={{ fontSize: 12.5, padding: '5px 0' }}>
                      <span className="min-w-0">
                        {v.key}{v.has_pdf && <span className="s-badge" style={{ marginLeft: 4 }}>PDF</span>}
                      </span>
                      <button className="s-chip shrink-0" style={{ fontSize: 11.5, padding: '3px 8px' }}
                        onClick={() => importVault(v.key)}>＋</button>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>

          <div className="s-panel" style={{ padding: 14 }}>
            <div className="flex items-center justify-between gap-2">
              <div style={{ fontSize: 15, fontWeight: 700 }}>소스 {items.length}</div>
              <div className="flex gap-1">
                <button className="s-chip" style={{ fontSize: 11.5, padding: '3px 8px' }}
                  onClick={() => setPicked(Object.fromEntries(items.map(i => [i.key, true])))}>전부</button>
                <button className="s-chip" style={{ fontSize: 11.5, padding: '3px 8px' }}
                  onClick={() => setPicked({})}>해제</button>
              </div>
            </div>
            <p style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 4, lineHeight: 1.6 }}>
              고른 것이 대화·산출물의 범위입니다. 제목을 누르면 그 논문부터 설명합니다.
            </p>
            <div className="space-y-1 mt-2" style={colBox}>
              {!items.length && (
                <p style={{ fontSize: 13.5, color: 'var(--ink-3)' }}>
                  아직 없습니다 — 위에서 찾아 담으세요.
                </p>
              )}
              {items.map(it => (
                <div key={it.key} className="s-src" style={{
                  padding: 9, borderStyle: picked[it.key] ? 'solid' : 'dashed',
                }}>
                  <label className="flex items-start gap-2" style={{ cursor: 'pointer' }}>
                    <input type="checkbox" style={{ marginTop: 3 }} checked={!!picked[it.key]}
                      onChange={() => setPicked(s => ({ ...s, [it.key]: !s[it.key] }))} />
                    <span className="min-w-0">
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{it.key}</span>
                      {attach[it.key]?.ok
                        ? <span className="s-badge" style={{ marginLeft: 4 }}>PDF</span>
                        : <span style={{ fontSize: 11, color: 'var(--ink-3)', marginLeft: 4 }}>원문 없음</span>}
                      {attach[it.key]?.ok && !indexed(it.key) && (
                        <span className="s-chip" style={{ marginLeft: 4, fontSize: 10.5, padding: '1px 5px', cursor: 'default' }}
                          title="PDF 는 있지만 색인에 없습니다 — 재색인이 필요합니다">미색인</span>
                      )}
                      <span style={{ display: 'block', fontSize: 12, color: 'var(--ink-2)', marginTop: 2, lineHeight: 1.5 }}>
                        {it.paper.title.slice(0, 64)}{it.paper.title.length > 64 ? '…' : ''}
                      </span>
                    </span>
                  </label>
                  <button className="s-chip mt-2" style={{ fontSize: 11.5, padding: '3px 9px' }}
                    disabled={!!busy} onClick={() => introduce(it)}>이 논문 설명</button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ══ 가운데: 대화 ══ */}
        <div className="col-span-12 lg:col-span-6 space-y-3">
          <div className="s-panel" style={{ padding: 16 }}>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div style={{ fontSize: 15.5, fontWeight: 700 }}>대화</div>
              <span style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>
                {chosenDocs.length
                  ? `범위: 고른 ${chosenDocs.length}편`
                  : '범위: 색인 전체 — 왼쪽에서 고르면 좁혀집니다'}
              </span>
            </div>
            {st?.error && (
              <p className="s-interp" style={{ fontSize: 13.5, marginTop: 8 }}>※ {st.error}</p>
            )}

            <div ref={chatRef} style={{ maxHeight: '54vh', overflowY: 'auto', marginTop: 10 }}>
              {!turns.length && (
                <div className="s-src" style={{ borderStyle: 'dashed', fontSize: 13.5, lineHeight: 1.8, color: 'var(--ink-3)' }}>
                  왼쪽에서 소스를 고르고 물어보세요. 답은 그 논문의 본문에서만 나오고,
                  가까운 대목이 없으면 답하지 않습니다.
                  <br />이 기기에서 답 하나에 1~4분 걸립니다.
                </div>
              )}
              {turns.map((t, ti) => (
                <div key={ti} style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 600 }}>
                    <span style={{ color: 'var(--s-accent-ink)' }}>묻기</span> · {t.q}
                    <span style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 400 }}> · {t.at}</span>
                  </div>
                  {t.error && <p className="s-interp" style={{ fontSize: 13.5 }}>※ {t.error}</p>}
                  {t.note && !t.error && <p className="s-interp" style={{ fontSize: 13 }}>※ {t.note}</p>}
                  {t.answer && (
                    <div style={{
                      marginTop: 6, padding: 12, borderRadius: 10,
                      background: 'var(--s-interp-soft)', border: '1px solid var(--s-interp)',
                    }}>
                      <div style={{ fontSize: 12, color: 'var(--s-interp)', fontWeight: 600, marginBottom: 5 }}>
                        ※ AI 생성 — 원문 확인 전에는 인용 근거(▸)로 쓰지 않습니다
                        {t.model ? ` · ${t.model}` : ''}
                        {!t.grounded && ' · 근거 번호 없음'}
                        {t.truncated && ' · 끝 끊김'}
                      </div>
                      <div style={{ fontSize: 14.5, lineHeight: 1.85, whiteSpace: 'pre-wrap' }}>{t.answer}</div>
                    </div>
                  )}
                  {!!t.hits.length && (
                    <>
                      <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 8, marginBottom: 4 }}>
                        근거로 쓰인 대목 — <strong>인용할 것은 여기서 담으세요</strong>
                      </div>
                      {t.hits.map((h, i) => (
                        <div key={h.id} className="s-src" style={{ padding: 10, marginBottom: 6 }}>
                          <div className="flex items-start justify-between gap-2 flex-wrap">
                            <div style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>
                              <strong style={{ color: 'var(--ink)' }}>[{i + 1}]</strong> {keyOfDoc(h.doc)}
                              {h.page ? ` · p.${h.page}` : ' · 쪽 모름'} · 유사도 {h.sim}
                            </div>
                            <button className="s-chip shrink-0" style={{ fontSize: 11.5, padding: '3px 9px' }}
                              onClick={() => clip(h)}>＋ 내 논문 자료로</button>
                          </div>
                          <p style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 5, lineHeight: 1.7 }}>
                            {h.text.slice(0, 300)}{h.text.length > 300 ? '…' : ''}
                          </p>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              ))}
            </div>

            <div className="flex gap-2 items-center mt-3">
              <select style={{ ...input, width: 128 }} value={clipSec}
                title="담을 발췌가 내 논문 어느 절로 갈지" onChange={e => setClipSec(e.target.value)}>
                {sections.map(s => <option key={s.id} value={s.id}>{s.id}. {s.title}</option>)}
              </select>
              <input style={input} value={ask} onChange={e => setAsk(e.target.value)}
                placeholder={okToAsk ? '고른 소스에게 묻기' : '색인 또는 모델이 준비되지 않았습니다'}
                disabled={!okToAsk}
                onKeyDown={e => { if (e.key === 'Enter') send(ask); }} />
              <button style={primary} disabled={!!busy || !okToAsk} onClick={() => send(ask)}>
                {busy === 'ask' ? '답 쓰는 중…' : '묻기'}
              </button>
            </div>
          </div>
        </div>

        {/* ══ 오른쪽: 산출물 ══ */}
        <div className="col-span-12 lg:col-span-3 space-y-3">
          <div className="s-panel" style={{ padding: 14 }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>만들기</div>
            <p style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 4, lineHeight: 1.6 }}>
              고른 소스 {chosenDocs.length}편을 묶어 정리합니다. 근거가 모자라면 만들지 않습니다.
            </p>
            <input style={{ ...input, marginTop: 8 }} value={focus}
              placeholder="초점 (선택) — 예: 약계통 조건만"
              onChange={e => setFocus(e.target.value)} />
            <div className="flex gap-2 flex-wrap mt-2">
              {kinds.map(k => (
                <button key={k.kind} className="s-chip" title={k.hint}
                  style={{ fontSize: 12.5 }} disabled={!!busy || !chosenDocs.length}
                  onClick={() => generate(k.kind)}>
                  {busy === k.kind ? '만드는 중…' : k.label}
                </button>
              ))}
            </div>
          </div>

          <div className="s-panel" style={{ padding: 14 }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>산출물 {reports.length}</div>
            <div className="space-y-2 mt-2" style={{ maxHeight: '52vh', overflowY: 'auto' }}>
              {!reports.length && (
                <p style={{ fontSize: 13.5, color: 'var(--ink-3)' }}>아직 없습니다.</p>
              )}
              {reports.map(r => (
                <div key={r.id} className="s-src" style={{ padding: 10 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.5 }}>{r.title}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 3 }}>
                    {r.label} · {r.created.slice(5, 16).replace('T', ' ')}
                    {r.verified
                      ? <span style={{ color: 'var(--s-ok)' }}> · 확인함</span>
                      : <span style={{ color: 'var(--s-interp)' }}> · 미확인(AI)</span>}
                    {!r.grounded && <span style={{ color: 'var(--s-interp)' }}> · 근거번호 없음</span>}
                    {r.truncated && <span style={{ color: 'var(--s-interp)' }}> · 끊김</span>}
                  </div>
                  {!!r.missing_docs.length && (
                    <div style={{ fontSize: 11.5, color: 'var(--s-interp)', marginTop: 3 }}>
                      반영 안 됨: {r.missing_docs.join(', ')}
                    </div>
                  )}
                  <div className="flex gap-1 flex-wrap mt-2">
                    <button className="s-chip" style={{ fontSize: 11.5, padding: '3px 8px' }}
                      onClick={() => setOpenRep(openRep === r.id ? '' : r.id)}>
                      {openRep === r.id ? '접기' : '보기'}
                    </button>
                    <button className="s-chip" style={{ fontSize: 11.5, padding: '3px 8px' }}
                      title="원문과 대조했다는 표시" onClick={() => verify(r)}>
                      {r.verified ? '확인 해제' : '확인함'}
                    </button>
                    <button className="s-chip" style={{ fontSize: 11.5, padding: '3px 8px' }}
                      onClick={() => toVault(r)}>볼트로</button>
                    <button className="s-chip" style={{ fontSize: 11.5, padding: '3px 8px', color: 'var(--error)' }}
                      onClick={() => delReport(r)}>삭제</button>
                  </div>
                  {openRep === r.id && (
                    <>
                      <div style={{
                        fontSize: 13, lineHeight: 1.8, whiteSpace: 'pre-wrap', marginTop: 8,
                        padding: 10, borderRadius: 8, background: 'var(--s-interp-soft)',
                        border: '1px solid var(--s-interp)', maxHeight: 320, overflowY: 'auto',
                      }}>{r.text}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 6 }}>
                        근거: {r.hits.map((h, i) => `[${i + 1}] ${h.doc}${h.page ? ` p.${h.page}` : ''}`).join(' · ')}
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 보관한 발췌 — 내논문으로 가는 입구 */}
          <div className="s-panel" style={{ padding: 14 }}>
            <div className="flex items-center justify-between gap-2">
              <div style={{ fontSize: 15, fontWeight: 700 }}>내 논문 자료 {clips.length}</div>
              <a className="s-chip" href="/research/my-paper" style={{ fontSize: 11.5, textDecoration: 'none' }}>
                내논문에서 보기 ↗
              </a>
            </div>
            <div className="space-y-1 mt-2" style={{ maxHeight: 220, overflowY: 'auto' }}>
              {!clips.length && (
                <p style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.6 }}>
                  아직 없습니다 — 가운데 ‘근거로 쓰인 대목’ 에서 담으세요.
                </p>
              )}
              {clips.slice().reverse().slice(0, 12).map(c => (
                <div key={c.id} style={{ fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.6 }}>
                  <strong>{c.section}</strong> · {c.cite_key}{c.page ? ` p.${c.page}` : ''} —{' '}
                  {c.text.slice(0, 48)}…
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
