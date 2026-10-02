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
  truncated?: boolean; error?: string; note?: string; model?: string;
  engine?: string;          // 어느 엔진이 쓴 글인지 — 나중에 추적할 수 있어야 한다
  at: string;
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
/* 색인 작업 상태. 한 편에 1~3분이라 진행률을 보여 줘야 한다 —
   아무 표시 없이 몇 분 멈춰 있으면 고장난 줄 안다. */
interface IndexJob {
  running: boolean; done: number; total: number; doc: string;
  added: { doc: string; chunks: number }[];
  skipped: { doc: string; why: string }[];
  error: string;
}
interface IndexStatus {
  job: IndexJob; pending: string[]; indexed: string[];
  unusable: { doc: string; why: string }[];   // 스캔본 등 — 숨기지 않고 따로 보여 준다
}
interface AskStatus {
  chunks: number; error: string; min_sim: number; embed_model: string;
  docs: { doc: string; chunks: number; pages: number }[];
  ollama: { ok: boolean; msg: string; model: string };
}
/* 글을 쓰는 엔진. 기준은 로컬이고 Claude 는 골라 쓰는 쪽이다.
   원격을 고르면 발췌가 밖으로 나가므로 화면이 그 사실을 먼저 말한다. */
interface Engine { ok: boolean; model: string; msg: string }
interface Engines {
  default: string; local: Engine; claude: Engine; remote_warning: string;
}

/* 산출물 한 건의 상태를 낱개 배지로 끊는다 — 점으로 이어 붙이면 뭉쳐 안 읽힌다.
   컴포넌트 밖에 둔다: 상태를 전혀 닫지 않는데 안에 있으면 렌더마다 새로 만들어진다. */
const repTags = (r: Report) => {
  const t: { cls: string; text: string }[] = [
    r.verified
      ? { cls: 's-tag-ok', text: '원문 대조함' }
      : { cls: 's-tag-warn', text: 'AI · 미대조' },
  ];
  if (!r.grounded) t.push({ cls: 's-tag-warn', text: '근거번호 없음' });
  if (r.truncated) t.push({ cls: 's-tag-warn', text: '끝 끊김' });
  if (r.missing_docs.length) t.push({ cls: 's-tag-mute', text: `${r.missing_docs.length}편 미반영` });
  return t;
};

/* 글자 크기·여백·색은 styles.css 의 .scholar 유틸(t-title/t-head/t-body/t-meta,
   s-input, s-btn, s-chip-sm, s-tag)이 정한다. 예전에는 이 파일이 inline style
   객체로 따로 들고 있어 같은 개념이 자리마다 다른 값을 썼다. */
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
  const [idx, setIdx] = useState<IndexStatus | null>(null);
  const [eng, setEng] = useState<Engines | null>(null);
  const [engine, setEngine] = useState<'local' | 'claude'>('local');

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
  const loadAsk = () => fetchJSON('/scholar/ask/status').then(setSt).catch(() => {});
  const loadIdx = () => fetchJSON('/index/status').then(setIdx).catch(() => {});
  const loadEngines = () => fetchJSON('/doc/actions')
    .then(d => { setEng(d.engines); setEngine(d.engines?.default === 'claude' ? 'claude' : 'local'); })
    .catch(() => {});

  useEffect(() => {
    loadItems(); loadAttach(); loadClips(); loadReports(); loadIdx(); loadEngines();
    fetchJSON('/notebook/report-kinds').then(d => setKinds(d.kinds || [])).catch(() => {});
    fetchJSON('/scholar/vault-papers').then(d => setVaultOnly(d.papers || [])).catch(() => {});
    loadAsk();
  }, []);

  /* 색인이 도는 동안만 들여다본다. 끝나면 색인 목록을 새로 읽어 '미색인' 을 지운다. */
  useEffect(() => {
    if (!idx?.job.running) return;
    const t = window.setInterval(() => {
      fetchJSON('/index/status').then((d: IndexStatus) => {
        setIdx(d);
        if (!d.job.running) { loadAsk(); loadAttach(); }
      }).catch(() => {});
    }, 4000);
    return () => window.clearInterval(t);
  }, [idx?.job.running]);

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

  /* ── 색인에 넣기 ──
     이 길이 없어서 앱 전체가 막혀 있었다. 담은 논문과 색인된 논문이 겹치지
     않으면 소스를 다 골라도 대화·산출물이 잠긴다. */
  const runIndex = (docs?: string[]) => {
    setErr('');
    postJSON('/index/rebuild', docs ? { docs } : {})
      .then(d => { setIdx(x => (x ? { ...x, job: d.job } : x)); flash(`색인을 시작했습니다 — ${d.total}편`); })
      .catch(e => {
        const m = String(e?.message || e);
        if (m.includes('409')) flash('이미 색인 중입니다');
        else fail(e);
      });
  };

  /* ── 원문 확보 ──
     유료 논문은 자동으로 못 가져온다. 그럴 때 다른 화면으로 보내지 않고
     여기서 바로 올리게 한다 — 원문이 없으면 그 논문으로는 아무것도 못 한다. */
  const fetchOriginal = (key: string) => {
    setBusy('pdf:' + key); setErr('');
    postJSON('/scholar/original', { key, channels: ['pdf'] })
      .then(d => {
        const r = d.item?.original?.pdf || {};
        flash(`${key} — ${r.msg || (r.ok ? '받았습니다' : '받지 못했습니다')}`);
      })
      .then(loadAttach).then(loadIdx)
      .catch(fail).finally(() => setBusy(''));
  };

  const uploadOriginal = (key: string, file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    setBusy('pdf:' + key); setErr('');
    fetchJSON(`/scholar/attach/${encodeURIComponent(key)}`, { method: 'POST', body: fd })
      .then(d => flash(`${key} — 보관했습니다 (${d.path})`))
      .then(loadAttach).then(loadIdx)
      .catch(fail).finally(() => setBusy(''));
  };

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
      q: question, n: 4, engine, ...(chosenDocs.length ? { docs: chosenDocs } : {}),
    }).then(d => setTurns(t => [...t, {
      q: question, answer: d.answer || '', hits: d.hits || [], grounded: !!d.grounded,
      enough: d.enough !== false, truncated: !!d.truncated, error: d.error,
      note: d.note, model: d.model, engine: d.engine, at: new Date().toLocaleTimeString(),
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
      n: 5, docs: [d], engine,
    }).then(x => setTurns(t => [...t, {
      q: `${it.key} 는 어떤 논문인가`, answer: x.answer || '', hits: x.hits || [],
      grounded: !!x.grounded, enough: x.enough !== false, truncated: !!x.truncated,
      error: x.error, note: x.note, model: x.model, engine: x.engine,
      at: new Date().toLocaleTimeString(),
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
    <div className="scholar max-w-[1600px] mx-auto px-10 py-10 space-y-4">
      {/* ══ 머리 — 이 화면의 규칙 한 줄과 지금 상태 ══ */}
      <div className="s-panel" style={{ padding: 16 }}>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div style={{ maxWidth: 680 }}>
            <h1 className="t-title" style={{ color: 'var(--s-accent-ink)' }}>노트북</h1>
            <p className="t-body" style={{ color: 'var(--ink-2)', marginTop: 4 }}>
              왼쪽에서 고른 소스가 대화와 산출물의 범위가 됩니다.{' '}
              {engine === 'local'
                ? '색인도 모델도 이 기기에 있어 원문이 밖으로 나가지 않습니다.'
                : <strong style={{ color: 'var(--s-interp)' }}>
                    지금은 Claude 로 돌고 있어 {eng?.remote_warning || '고른 대목이 바깥 서버로 전송됩니다'}.
                  </strong>}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <span className="s-tag s-tag-mute">고른 소스 {chosen.length}</span>
            <span className={'s-tag ' + (chosenDocs.length ? 's-tag-ok' : 's-tag-warn')}>
              색인된 것 {chosenDocs.length}
            </span>
            {eng && (['local', 'claude'] as const).map(e => {
              const info = eng[e];
              const on = engine === e;
              return (
                <button key={e} className={'s-chip s-chip-sm' + (on ? ' s-chip-on' : '')}
                  aria-pressed={on} disabled={!info.ok}
                  title={info.ok
                    ? (e === 'local' ? '이 기기에서 돌립니다 — 느리지만 원문이 나가지 않습니다'
                                     : eng.remote_warning)
                    : info.msg}
                  onClick={() => setEngine(e)}>
                  {e === 'local' ? '로컬' : 'Claude'} · {info.ok ? info.model : '못 씀'}
                </button>
              );
            })}
            <span className="s-tag s-tag-mute">보관 발췌 {clips.length}</span>
          </div>
        </div>
        {/* 이 화면의 핵심 규칙 — 문단 속 굵은 글씨로는 안 읽혀서 따로 띄운다 */}
        <p className="s-interp t-body" style={{ marginTop: 12, marginBottom: 0 }}>
          ※ 여기 답과 산출물은 전부 AI 가 쓴 것입니다. 인용할 대목은 <strong>답이 아니라
          ‘근거로 쓰인 대목’</strong> 에서 담으세요 — 담은 것이 내 논문으로 갑니다.
        </p>
      </div>

      {/* 색인 상태 — 여기가 막히면 대화도 산출물도 안 된다. 가장 먼저 보여 준다. */}
      {idx && (idx.job.running || !!idx.pending.length || !!idx.unusable.length) && (
        <div className="s-panel" style={{ padding: 12 }}>
          {idx.job.running ? (
            <div className="flex items-center gap-3 flex-wrap">
              <span className="t-body">
                색인 중 {idx.job.done}/{idx.job.total}
                {idx.job.doc ? ` · ${idx.job.doc}` : ''} — 한 편에 1~3분입니다
              </span>
              <span className="t-meta" style={{ color: 'var(--ink-3)' }}>
                끝나면 ‘미색인’ 이 사라지고 그 논문으로 답할 수 있습니다
              </span>
            </div>
          ) : !!idx.pending.length && (
            <div className="flex items-center gap-3 flex-wrap">
              <span className="t-body">
                색인에 안 들어간 원문 <strong>{idx.pending.length}편</strong> — 이 논문들로는 답할 수 없습니다
              </span>
              <button className="s-chip" onClick={() => runIndex()}>
                전부 색인에 넣기 ({idx.pending.length}편 · 약 {idx.pending.length * 2}분)
              </button>
            </div>
          )}
          {!!idx.unusable.length && (
            <p className="s-interp t-meta" style={{ marginTop: 8 }}>
              ※ 색인에 넣을 수 없는 원문: {idx.unusable.map(x => `${x.doc} — ${x.why}`).join(' · ')}
            </p>
          )}
          {idx.job.error && (
            <p className="t-meta" style={{ color: 'var(--s-danger)', marginTop: 8 }}>
              색인 실패 — {idx.job.error}
            </p>
          )}
        </div>
      )}

      {err && (
        <p role="alert" className="s-interp t-body"
          style={{ color: 'var(--s-danger)', borderLeftColor: 'var(--s-danger)' }}>{err}</p>
      )}
      {msg && <p role="status" className="t-body" style={{ color: 'var(--s-ok)' }}>{msg}</p>}

      <div className="grid grid-cols-12 gap-5 items-start">
        {/* ══════ ① 소스 ══════ */}
        <div className="col-span-12 lg:col-span-3 space-y-3">
          <h2 className="s-zone"><span className="s-zone-n">1</span> 소스 고르기</h2>

          <div className="s-panel" style={{ padding: 14 }}>
            <div className="t-head">소스 추가</div>
            <form onSubmit={search} className="flex gap-2 mt-2">
              <input className="s-input" value={q} onChange={e => setQ(e.target.value)}
                placeholder="주제 · DOI · arXiv ID" />
              <button type="submit" className="s-btn shrink-0" style={{ padding: '8px 13px' }}
                disabled={busy === 'search'}>{busy === 'search' ? '…' : '찾기'}</button>
            </form>
            <p className="t-meta" style={{ marginTop: 6 }}>
              DOI·arXiv ID 는 서지를 바로 받아 오고, 그 밖에는 외부 DB 를 검색합니다.
            </p>

            {found && (
              <div className="space-y-2 mt-3" style={colBox}>
                {!found.length && <p className="t-meta">결과가 없습니다.</p>}
                {found.map((p, i) => (
                  <div key={(p.doi || p.title) + i} className="s-src" style={{ padding: 10 }}>
                    <div className="t-body" style={{ fontWeight: 600 }}>{p.title}</div>
                    <div className="t-meta" style={{ marginTop: 3 }}>
                      {p.year || '연도 미명시'} · {p.venue || '게재처 미명시'}
                    </div>
                    {p.in_inbox
                      ? <span className="s-tag s-tag-ok" style={{ marginTop: 8 }}>담김</span>
                      : <button className="s-btn s-chip-sm mt-2" onClick={() => collect(p)}>＋ 소스로</button>}
                  </div>
                ))}
              </div>
            )}

            {!!vaultOnly.length && (
              <details style={{ marginTop: 12 }}>
                <summary className="t-meta" style={{ cursor: 'pointer', color: 'var(--ink-2)' }}>
                  볼트에 있는 논문 {vaultOnly.length}편 가져오기
                </summary>
                <div className="space-y-1 mt-2" style={colBox}>
                  {vaultOnly.map(v => (
                    <div key={v.key} className="flex items-center justify-between gap-2 t-meta"
                      style={{ padding: '5px 0' }}>
                      <span className="min-w-0" style={{ color: 'var(--ink-2)' }}>
                        {v.key}{v.has_pdf && <span className="s-tag s-tag-ok" style={{ marginLeft: 5 }}>PDF</span>}
                      </span>
                      <button className="s-chip s-chip-sm shrink-0"
                        aria-label={`${v.key} 소스로 담기`}
                        onClick={() => importVault(v.key)}>＋</button>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>

          <div className="s-panel" style={{ padding: 14 }}>
            <div className="flex items-center justify-between gap-2">
              <div className="t-head">소스 {items.length}</div>
              <div className="flex gap-1">
                <button className="s-chip s-chip-sm"
                  onClick={() => setPicked(Object.fromEntries(items.map(i => [i.key, true])))}>전부</button>
                <button className="s-chip s-chip-sm" onClick={() => setPicked({})}>해제</button>
              </div>
            </div>
            <p className="t-meta" style={{ marginTop: 4 }}>
              고른 것이 대화·산출물의 범위입니다.
            </p>
            <div className="space-y-2 mt-2" style={colBox}>
              {!items.length && <p className="t-meta">아직 없습니다 — 위에서 찾아 담으세요.</p>}
              {items.map(it => (
                /* 고름/안고름은 이 화면에서 가장 중요한 상태다. 점선↔실선은 너무 약해서
                   테마가 이미 가진 data-hot(강조색 테두리+배경)으로 바꿨다. */
                <div key={it.key} className="s-src" data-hot={picked[it.key] ? 'true' : 'false'}
                  style={{ padding: 10 }}>
                  <label className="flex items-start gap-2" style={{ cursor: 'pointer' }}>
                    <input type="checkbox" style={{ marginTop: 4 }} checked={!!picked[it.key]}
                      onChange={() => setPicked(s => ({ ...s, [it.key]: !s[it.key] }))} />
                    <span className="min-w-0">
                      <span className="t-body" style={{ fontWeight: 600 }}>{it.key}</span>
                      <span className="flex gap-1 flex-wrap" style={{ marginTop: 4 }}>
                        {attach[it.key]?.ok
                          ? <span className="s-tag s-tag-ok">PDF</span>
                          : <span className="s-tag s-tag-mute">원문 없음</span>}
                        {attach[it.key]?.ok && !indexed(it.key) && (
                          <>
                            <span className="s-tag s-tag-warn"
                              title="PDF 는 있지만 색인에 없어 이 논문으로는 답할 수 없습니다">미색인</span>
                            <button className="s-chip s-chip-sm" disabled={!!idx?.job.running}
                              title="이 논문을 색인에 넣습니다 (1~3분)"
                              onClick={e => { e.preventDefault(); runIndex([docOf(it.key)]); }}>
                              색인에 넣기
                            </button>
                          </>
                        )}
                      </span>
                      <span className="t-meta" style={{ display: 'block', marginTop: 4, color: 'var(--ink-2)' }}>
                        {it.paper.title.slice(0, 64)}{it.paper.title.length > 64 ? '…' : ''}
                      </span>
                    </span>
                  </label>
                  <div className="flex gap-1 flex-wrap mt-2">
                    <button className="s-chip s-chip-sm"
                      disabled={!!busy} onClick={() => introduce(it)}>이 논문 설명</button>
                    {!attach[it.key]?.ok && (
                      <>
                        <button className="s-chip s-chip-sm" disabled={!!busy}
                          title="오픈액세스면 받아 옵니다. 유료 논문은 받지 못합니다"
                          onClick={() => fetchOriginal(it.key)}>
                          {busy === 'pdf:' + it.key ? '받는 중…' : '원문 받기'}
                        </button>
                        <label className="s-chip s-chip-sm" style={{ cursor: 'pointer' }}
                          title="내려받은 PDF 를 올립니다 — 색인까지 자동으로 들어갑니다">
                          원문 올리기
                          <input type="file" accept="application/pdf" style={{ display: 'none' }}
                            onChange={e => {
                              const f = e.target.files?.[0];
                              e.target.value = '';
                              if (f) uploadOriginal(it.key, f);
                            }} />
                        </label>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ══════ ② 대화 — 지금 작업하는 곳이라 흰 바탕으로 띄운다 ══════ */}
        <div className="col-span-12 lg:col-span-6 space-y-3">
          <h2 className="s-zone">
            <span className="s-zone-n">2</span> 묻고 근거 담기
            <span style={{ marginLeft: 'auto', fontWeight: 400, letterSpacing: 0 }}>
              {chosenDocs.length ? `범위 · 고른 ${chosenDocs.length}편` : '범위 · 색인 전체'}
            </span>
          </h2>

          <div className="s-panel s-panel-focus" style={{ padding: 16 }}>
            {st?.error && <p className="s-interp t-body" style={{ marginTop: 0 }}>※ {st.error}</p>}

            <div ref={chatRef} style={{ maxHeight: '56vh', overflowY: 'auto' }}>
              {!turns.length && (
                <div className="s-src t-body" style={{ borderStyle: 'dashed', color: 'var(--ink-3)' }}>
                  왼쪽에서 소스를 고르고 물어보세요. 답은 그 논문의 본문에서만 나오고,
                  가까운 대목이 없으면 답하지 않습니다.
                  <br />이 기기에서 답 하나에 1~4분 걸립니다.
                </div>
              )}
              {turns.map((t, ti) => (
                <div key={ti} style={{ marginBottom: 22 }}>
                  {/* 질문 — 대화의 눈금이라 왼쪽 강조선으로 끊는다 */}
                  <div className="t-body" style={{
                    fontWeight: 600, paddingLeft: 11,
                    borderLeft: '3px solid var(--s-accent)',
                  }}>
                    {t.q}
                    <span className="t-meta" style={{ fontWeight: 400, marginLeft: 6 }}>{t.at}</span>
                  </div>

                  {t.error && <p className="s-interp t-body">※ {t.error}</p>}
                  {t.note && !t.error && <p className="s-interp t-body">※ {t.note}</p>}

                  {t.answer && (
                    <div style={{
                      marginTop: 8, padding: 12, borderRadius: 10,
                      background: 'var(--s-interp-soft)',
                      borderLeft: '3px dashed var(--s-interp)',
                    }}>
                      <div className="flex gap-1 flex-wrap" style={{ marginBottom: 7 }}>
                        <span className="s-tag s-tag-warn">※ AI 생성 — 인용 근거 아님</span>
                        {t.model && (
                          <span className={'s-tag ' + (t.engine === 'claude' ? 's-tag-warn' : 's-tag-mute')}
                            title={t.engine === 'claude'
                              ? '이 답은 Claude 로 썼습니다 — 대목이 바깥으로 나갔습니다'
                              : '이 답은 이 기기에서 썼습니다'}>
                            {t.engine === 'claude' ? '바깥 · ' : '로컬 · '}{t.model}
                          </span>
                        )}
                        {!t.grounded && <span className="s-tag s-tag-warn">근거번호 없음</span>}
                        {t.truncated && <span className="s-tag s-tag-warn">끝 끊김</span>}
                      </div>
                      <div className="t-body" style={{ lineHeight: 1.85, whiteSpace: 'pre-wrap' }}>{t.answer}</div>
                    </div>
                  )}

                  {!!t.hits.length && (
                    <>
                      <div className="s-zone" style={{ marginTop: 14, marginBottom: 8, borderBottomWidth: 1 }}>
                        근거로 쓰인 대목 — 인용할 것은 여기서 담습니다
                      </div>
                      {t.hits.map((h, i) => (
                        <div key={h.id} className="s-src" style={{ padding: 11, marginBottom: 7 }}>
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-2 flex-wrap t-meta">
                              <span className="s-cite" style={{ cursor: 'default' }}>{i + 1}</span>
                              <strong style={{ color: 'var(--ink)' }}>{keyOfDoc(h.doc)}</strong>
                              <span>{h.page ? `p.${h.page}` : '쪽 모름'}</span>
                              <span className={'s-tag ' + (st && h.sim >= st.min_sim ? 's-tag-ok' : 's-tag-warn')}>
                                유사도 {h.sim}{st && h.sim < st.min_sim ? ' · 약함' : ''}
                              </span>
                            </div>
                            <button className="s-btn s-chip-sm shrink-0"
                              onClick={() => clip(h)}>＋ 내 논문 자료로</button>
                          </div>
                          <p className="t-body" style={{ color: 'var(--ink-2)', marginTop: 6 }}>
                            {h.text.slice(0, 300)}{h.text.length > 300 ? '…' : ''}
                          </p>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              ))}
            </div>

            <div className="flex gap-2 items-center mt-3" style={{
              paddingTop: 12, borderTop: '1px solid var(--s-line)',
            }}>
              <select className="s-input" style={{ width: 132 }} value={clipSec}
                title="담을 발췌가 내 논문 어느 절로 갈지" onChange={e => setClipSec(e.target.value)}>
                {sections.map(s => <option key={s.id} value={s.id}>{s.id}. {s.title}</option>)}
              </select>
              <input className="s-input" value={ask} onChange={e => setAsk(e.target.value)}
                placeholder={okToAsk ? '고른 소스에게 묻기' : '색인 또는 모델이 준비되지 않았습니다'}
                disabled={!okToAsk}
                onKeyDown={e => { if (e.key === 'Enter') send(ask); }} />
              <button className="s-btn shrink-0" disabled={!!busy || !okToAsk} onClick={() => send(ask)}>
                {busy === 'ask' ? '답 쓰는 중…' : '묻기'}
              </button>
            </div>
          </div>
        </div>

        {/* ══════ ③ 산출물 ══════ */}
        <div className="col-span-12 lg:col-span-3 space-y-3">
          <h2 className="s-zone"><span className="s-zone-n">3</span> 묶어 정리하기</h2>

          <div className="s-panel" style={{ padding: 14 }}>
            <div className="t-head">만들기</div>
            <p className="t-meta" style={{ marginTop: 4 }}>
              고른 소스 {chosenDocs.length}편을 묶어 정리합니다. 근거가 모자라면 만들지 않습니다.
            </p>
            <input className="s-input" style={{ marginTop: 8 }} value={focus}
              placeholder="초점 (선택) — 예: 약계통 조건만"
              onChange={e => setFocus(e.target.value)} />
            <div className="flex gap-2 flex-wrap mt-2">
              {kinds.map(k => (
                <button key={k.kind} className="s-chip s-chip-sm" title={k.hint}
                  disabled={!!busy || !chosenDocs.length}
                  onClick={() => generate(k.kind)}>
                  {busy === k.kind ? '만드는 중…' : k.label}
                </button>
              ))}
            </div>
          </div>

          <div className="s-panel" style={{ padding: 14 }}>
            <div className="t-head">산출물 {reports.length}</div>
            <div className="space-y-2 mt-2" style={{ maxHeight: '52vh', overflowY: 'auto' }}>
              {!reports.length && <p className="t-meta">아직 없습니다.</p>}
              {reports.map(r => (
                <div key={r.id} className="s-src" style={{ padding: 11 }}>
                  <div className="t-body" style={{ fontWeight: 600 }}>{r.title}</div>
                  <div className="t-meta" style={{ marginTop: 3 }}>
                    {r.label} · {r.created.slice(5, 16).replace('T', ' ')}
                  </div>
                  <div className="flex gap-1 flex-wrap" style={{ marginTop: 6 }}>
                    {repTags(r).map((t, i) => <span key={i} className={'s-tag ' + t.cls}>{t.text}</span>)}
                  </div>
                  {/* 삭제는 되돌릴 수 없어서 오른쪽으로 떼고 색을 달리한다 */}
                  <div className="flex gap-1 flex-wrap items-center" style={{ marginTop: 8 }}>
                    <button className="s-chip s-chip-sm"
                      onClick={() => setOpenRep(openRep === r.id ? '' : r.id)}>
                      {openRep === r.id ? '접기' : '보기'}
                    </button>
                    <button className="s-chip s-chip-sm"
                      title="원문과 대조했다는 표시" onClick={() => verify(r)}>
                      {r.verified ? '대조 해제' : '대조함'}
                    </button>
                    <button className="s-chip s-chip-sm" onClick={() => toVault(r)}>볼트로</button>
                    <button className="s-chip s-chip-sm s-chip-danger"
                      style={{ marginLeft: 'auto' }} onClick={() => delReport(r)}>삭제</button>
                  </div>
                  {openRep === r.id && (
                    <>
                      <div className="t-body" style={{
                        lineHeight: 1.8, whiteSpace: 'pre-wrap', marginTop: 8,
                        padding: 11, borderRadius: 8, background: 'var(--s-interp-soft)',
                        borderLeft: '3px dashed var(--s-interp)',
                        maxHeight: 320, overflowY: 'auto',
                      }}>{r.text}</div>
                      <div className="t-meta" style={{ marginTop: 6 }}>
                        근거: {r.hits.map((h, i) => `[${i + 1}] ${h.doc}${h.page ? ` p.${h.page}` : ''}`).join(' · ')}
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 보관한 발췌 — 내논문으로 가는 입구라 강조색 테두리로 띄운다 */}
          <div className="s-panel" style={{ padding: 14, borderColor: 'var(--s-accent)' }}>
            <div className="flex items-center justify-between gap-2">
              <div className="t-head">내 논문 자료 {clips.length}</div>
              <a className="s-chip s-chip-sm" href="/research/my-paper"
                style={{ textDecoration: 'none' }}>내논문에서 보기 ↗</a>
            </div>
            <div className="space-y-2 mt-2" style={{ maxHeight: 220, overflowY: 'auto' }}>
              {!clips.length && (
                <p className="t-meta">아직 없습니다 — 가운데 ‘근거로 쓰인 대목’ 에서 담으세요.</p>
              )}
              {clips.slice(-12).reverse().map(c => (
                <div key={c.id} className="t-meta" style={{ color: 'var(--ink-2)' }}>
                  <span className="s-tag s-tag-mute">{c.section}</span>{' '}
                  <strong style={{ color: 'var(--ink)' }}>{c.cite_key}</strong>
                  {c.page ? ` p.${c.page}` : ''} — {c.text.slice(0, 44)}…
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
