/* 연구실 스콜라 — 7단계 워크플로 (검색·답변 + 수집을 한 줄기로)

   ① 검색 → ② 선별 → ③ 원본 확보 → ④ 하이라이트 → ⑤ 노트화 → ⑥ 연결 → ⑦ 인용·초안

   검색과 수집을 따로 두면 "찾은 논문"과 "가진 논문"이 갈라진다. 그래서 한 화면에
   두고, 각 단계의 산출물은 서버 수집함(Server/scholar_inbox.json)에 남는다.
   ▸ 는 원문에 있는 것, ※ 는 내 판단 — 이 구분은 노트에도 그대로 간다. */
import { useEffect, useMemo, useState } from 'react';
import { fetchJSON, postJSON } from '../lib/api';

/* ── 타입 ── */
export interface Paper {
  title: string; authors: string; year: number | null; venue: string;
  volume?: string; issue?: string; pages?: string; doi: string;
  cited_by: number; abstract: string; pdf_url: string; landing?: string;
  topics: string[]; oa_id?: string; source: string; score: number;
  cite_key?: string; in_vault?: boolean; in_inbox?: boolean;
}
interface Highlight { section: string; text: string; page?: string }
interface Channel { ok: boolean; msg: string; path?: string; url?: string; bytes?: number }
interface NblmSource { kind: string; title: string; ok: boolean; msg: string; source_id?: string }
interface NblmArtifact { kind: string; label: string; status: string; artifact_id?: string; url?: string; msg?: string; at?: string }
interface Nblm { notebook_id: string; title?: string; url?: string; sources?: NblmSource[]; artifacts?: NblmArtifact[]; updated?: string }
interface Item {
  key: string; paper: Paper; stage: number;
  original: { pdf?: Channel; bib?: Channel; zotero?: Channel };
  highlights: Highlight[]; note_path: string; links: string[]; cited: boolean;
  extraction_depth?: string; section?: string; paper_type?: string; target_system?: string;
  nblm?: Nblm; added: string;
}
interface Stage { n: number; key: string; title: string; tool: string; desc: string; needs: string | null }
interface HiRule { color: string; callout: string; mean: string; section: string }
interface Settings {
  contact_email: string; from_year: number; top: number; sources: string[];
  pdf_dir: string; note_dir: string; draft_path: string; bib_path: string;
  zotero_enabled: boolean; zotero_url: string; highlights: HiRule[];
}
interface Related { note: string; path: string; shared: string[]; n: number }
interface VaultHit { path: string; title: string; folder: string; count: number; snippet: string }

const NUM = ['①', '②', '③', '④', '⑤', '⑥', '⑦'];
const SRC_LABEL: Record<string, string> = {
  openalex: 'OpenAlex', s2: 'Semantic Scholar', arxiv: 'arXiv',
};
/* NotebookLM 스튜디오 — 버튼 하나가 MCP 도구 하나 */
const NBLM_KINDS = [
  { kind: 'infographic', label: '인포그래픽' },
  { kind: 'mindmap', label: '마인드맵' },
  { kind: 'report', label: '리포트(브리핑)' },
  { kind: 'audio', label: '오디오 개요' },
  { kind: 'slides', label: '슬라이드' },
] as const;

const input: React.CSSProperties = {
  fontSize: 15, padding: '9px 12px', borderRadius: 9,
  border: '1px solid var(--s-line)', background: 'var(--s-bg)', color: 'var(--ink)', width: '100%',
};
const primary: React.CSSProperties = {
  fontSize: 15, fontWeight: 600, padding: '10px 20px', borderRadius: 10,
  background: 'var(--s-accent)', color: '#fff', border: 'none', cursor: 'pointer',
};
const label: React.CSSProperties = { fontSize: 13, color: 'var(--ink-3)', marginBottom: 4 };
const pre: React.CSSProperties = {
  fontSize: 13.5, lineHeight: 1.7, color: 'var(--ink-2)', background: 'var(--s-bg)',
  border: '1px solid var(--s-line)', borderRadius: 10, padding: 12,
  whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 420, overflowY: 'auto',
};

/* 채널·검사 결과 한 줄 */
function Res({ r }: { r?: Channel }) {
  if (!r) return null;
  return (
    <div style={{
      fontSize: 14, padding: '7px 11px', borderRadius: 8, marginTop: 6,
      background: r.ok ? 'var(--s-ok-soft)' : 'var(--s-interp-soft)',
      color: r.ok ? 'var(--s-ok)' : 'var(--s-interp)',
      border: `1px solid ${r.ok ? 'var(--s-ok)' : 'var(--s-interp)'}`,
    }}>
      {r.ok ? '✓ ' : '! '}{r.msg}{r.path ? ` — ${r.path}` : ''}
      {r.bytes ? ` (${Math.round(r.bytes / 1024)} KB)` : ''}
    </div>
  );
}

function Copy({ text, label: lb }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button className="s-chip" onClick={() => navigator.clipboard.writeText(text)
      .then(() => { setDone(true); setTimeout(() => setDone(false), 1500); }).catch(() => {})}>
      {done ? '복사했습니다' : lb}
    </button>
  );
}

export default function ScholarFlow() {
  const [stages, setStages] = useState<Stage[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [folders, setFolders] = useState<{ path: string; notes: number }[]>([]);
  const [step, setStep] = useState(1);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  // ① 검색
  const [q, setQ] = useState('');
  const [papers, setPapers] = useState<Paper[] | null>(null);
  const [counts, setCounts] = useState<Record<string, number | null>>({});
  const [searchNote, setSearchNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [vaultHits, setVaultHits] = useState<VaultHit[] | null>(null);

  // ② 수집함
  const [items, setItems] = useState<Item[]>([]);
  const [activeKey, setActiveKey] = useState('');

  // ④ 하이라이트 입력
  const [hi, setHi] = useState<Highlight>({ section: 'quote', text: '', page: '' });

  // ⑤ 노트
  const [preview, setPreview] = useState<{ path: string; markdown: string; exists: boolean } | null>(null);
  const [noteDir, setNoteDir] = useState('');
  const [links, setLinks] = useState<string[]>([]);
  const [suggested, setSuggested] = useState<Related[]>([]);

  // ⑥ 연결
  const [related, setRelated] = useState<Related[]>([]);
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [backlinks, setBacklinks] = useState<{ path: string; ok: boolean; msg: string }[]>([]);

  // ④ NotebookLM — 읽기 보조 (인포그래픽·마인드맵·오디오·리포트)
  const [nb, setNb] = useState<{ installed: boolean; authenticated: boolean; error?: string; auth_cmd?: string } | null>(null);
  const [nbUrl, setNbUrl] = useState('');
  const [nbOpt, setNbOpt] = useState({ meta: true, pdf: false, lang: 'ko', focus: '' });
  const [nbText, setNbText] = useState('');
  const [nbQ, setNbQ] = useState('');
  const [nbAns, setNbAns] = useState('');
  const [nbBusy, setNbBusy] = useState('');
  const [nbErr, setNbErr] = useState('');

  // ⑦ 인용·초안
  const [cite, setCite] = useState<{ ieee: string; verified: boolean; pandoc: string; bibtex: string } | null>(null);
  const [draft, setDraft] = useState('');

  // 설정
  const [cfgOpen, setCfgOpen] = useState(false);
  const [cfg, setCfg] = useState<Settings | null>(null);
  const [cfgMsg, setCfgMsg] = useState('');

  const active = useMemo(() => items.find(i => i.key === activeKey) || null, [items, activeKey]);

  useEffect(() => {
    fetchJSON('/scholar/stages').then(d => setStages(d.stages || [])).catch(() => {});
    fetchJSON('/scholar/settings').then(d => { setSettings(d.settings); setCfg(d.settings); })
      .catch(() => setErr('설정을 불러오지 못했습니다 — Flask 가 떠 있는지 확인하세요.'));
    fetchJSON('/scholar/vault-folders').then(d => setFolders(d.folders || [])).catch(() => {});
    fetchJSON('/scholar/inbox').then(d => setItems(d.items || [])).catch(() => {});
  }, []);

  useEffect(() => { if (settings && !noteDir) setNoteDir(settings.note_dir); }, [settings]);

  /* 활성 논문이 바뀌면 단계별 임시 상태를 비운다 — 남의 결과가 섞이지 않게 */
  useEffect(() => {
    setPreview(null); setCite(null); setBacklinks([]); setPicked({});
    setLinks(active?.links || []); setRelated([]);
    setNbAns(''); setNbErr(''); setNbText('');
    setNbUrl(active ? (active.paper.landing || active.paper.pdf_url || '') : '');
  }, [activeKey]);

  /* NotebookLM 상태는 ④에 처음 들어갈 때만 확인한다 — MCP 프로세스를 띄우는 데 몇 초 걸린다 */
  useEffect(() => { if (step === 4 && !nb) checkNb(); }, [step]);

  const rule = (sec: string) => settings?.highlights.find(h => h.section === sec);
  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 4000); };
  const fail = (e: any) => setErr(String(e?.message || e).slice(0, 300));

  /* ── ① 검색 ── */
  const search = (e: React.FormEvent) => {
    e.preventDefault();
    if (q.trim().length < 2 || !settings) return;
    setBusy(true); setErr(''); setPapers(null); setVaultHits(null);
    postJSON('/scholar/search', {
      q: q.trim(), from_year: settings.from_year, top: settings.top, sources: settings.sources,
    }).then(d => { setPapers(d.papers || []); setCounts(d.counts || {}); setSearchNote(d.note || ''); })
      .catch(fail).finally(() => setBusy(false));
    fetchJSON('/vault/search?q=' + encodeURIComponent(q.trim()))
      .then(d => setVaultHits(d.hits || [])).catch(() => setVaultHits([]));
  };

  /* ── ② 담기 ── */
  const collect = (p: Paper) => postJSON('/scholar/inbox', { paper: p })
    .then(d => {
      setItems(d.items);
      setPapers(ps => ps && ps.map(x => x.doi === p.doi && x.title === p.title ? { ...x, in_inbox: true } : x));
      if (d.added?.length) { setActiveKey(d.added[0]); flash(`수집함에 담았습니다 — ${d.added[0]}`); }
      else flash('이미 수집함에 있습니다');
    }).catch(fail);

  const drop = (key: string) => fetchJSON(`/scholar/inbox/${key}`, { method: 'DELETE' })
    .then(d => { setItems(d.items); if (activeKey === key) setActiveKey(''); }).catch(fail);

  const patch = (key: string, body: object) =>
    fetchJSON(`/scholar/inbox/${key}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    }).then(d => { setItems(is => is.map(i => i.key === key ? d.item : i)); return d.item as Item; });

  /* ── ③ 원본 ── */
  const [channels, setChannels] = useState({ pdf: true, bib: true, zotero: true });
  const getOriginal = () => {
    if (!active || !settings) return;
    setBusy(true); setErr('');
    postJSON('/scholar/original', {
      key: active.key,
      channels: Object.entries(channels).filter(([, v]) => v).map(([k]) => k),
      pdf_dir: settings.pdf_dir, bib_path: settings.bib_path,
    }).then(d => { setItems(is => is.map(i => i.key === active.key ? d.item : i)); })
      .catch(fail).finally(() => setBusy(false));
  };

  /* ── ④ 하이라이트 ── */
  const addHi = () => {
    if (!active || !hi.text.trim()) return;
    const next = [...active.highlights, { ...hi, text: hi.text.trim() }];
    patch(active.key, { highlights: next, extraction_depth: 'full' })
      .then(() => setHi({ section: hi.section, text: '', page: '' })).catch(fail);
  };
  const delHi = (idx: number) => {
    if (!active) return;
    patch(active.key, { highlights: active.highlights.filter((_, i) => i !== idx) }).catch(fail);
  };

  /* ── ④ NotebookLM ── */
  const nbFail = (e: any) => setNbErr(String(e?.message || e).replace(/^HTTP \d+: /, '').slice(0, 400));
  const nbRun = <T,>(tag: string, p: Promise<T>) => {
    setNbBusy(tag); setNbErr('');
    return p.finally(() => setNbBusy(''));
  };
  const putItem = (it: Item) => setItems(is => is.map(x => x.key === it.key ? it : x));

  const checkNb = () => nbRun('status', fetchJSON('/scholar/nblm/status')
    .then(setNb).catch(nbFail));

  const makeNotebook = () => {
    if (!active) return;
    nbRun('notebook', postJSON('/scholar/nblm/notebook', {
      key: active.key,
      urls: nbUrl.trim() ? [nbUrl.trim()] : [],
      add_meta: nbOpt.meta, add_pdf: nbOpt.pdf,
    }).then(d => putItem({ ...active, nblm: d.nblm })).catch(nbFail));
  };

  const addNbSource = () => {
    if (!active) return;
    const body: any = { key: active.key };
    if (nbText.trim()) { body.text = nbText; body.title = `${active.key} 붙여 넣은 본문`; }
    else if (nbUrl.trim()) body.url = nbUrl.trim();
    else return;
    nbRun('source', postJSON('/scholar/nblm/source', body)
      .then(d => { putItem({ ...active, nblm: d.nblm }); setNbText(''); }).catch(nbFail));
  };

  const genNb = (kind: string) => {
    if (!active) return;
    nbRun(kind, postJSON('/scholar/nblm/generate', {
      key: active.key, kind, language: nbOpt.lang,
      options: nbOpt.focus.trim() ? { focus_prompt: nbOpt.focus.trim() } : {},
    }).then(d => putItem({ ...active, nblm: d.nblm })).catch(nbFail));
  };

  const studio = () => {
    if (!active) return;
    nbRun('studio', fetchJSON('/scholar/nblm/studio?key=' + encodeURIComponent(active.key))
      .then(d => putItem({ ...active, nblm: { ...(active.nblm || { notebook_id: '' }), artifacts: d.artifacts } }))
      .catch(nbFail));
  };

  const askNb = () => {
    if (!active || !nbQ.trim()) return;
    setNbAns('');
    nbRun('query', postJSON('/scholar/nblm/query', { key: active.key, question: nbQ.trim() })
      .then(d => setNbAns(d.answer || '(빈 답변)')).catch(nbFail));
  };

  const nbToNote = () => {
    if (!active) return;
    nbRun('to-note', postJSON('/scholar/nblm/to-note', { key: active.key })
      .then(d => flash(`노트에 적었습니다 — ${d.path}`)).catch(nbFail));
  };

  /* ── ⑤ 노트 ── */
  const doPreview = () => {
    if (!active) return;
    setBusy(true); setErr('');
    postJSON('/scholar/note/preview', { key: active.key, note_dir: noteDir, links: links.length ? links : undefined })
      .then(d => {
        setPreview({ path: d.path, markdown: d.markdown, exists: d.exists });
        setSuggested(d.suggested || []);
        if (!links.length) setLinks(d.links || []);
      }).catch(fail).finally(() => setBusy(false));
  };
  const saveNote = (overwrite = false) => {
    if (!active) return;
    setBusy(true); setErr('');
    postJSON('/scholar/note', { key: active.key, note_dir: noteDir, links, overwrite })
      .then(d => {
        setItems(is => is.map(i => i.key === active.key ? d.item : i));
        flash(`노트를 저장했습니다 — ${d.path}`); setStep(6);
      })
      .catch(e => {
        const m = String(e?.message || '');
        if (m.includes('409')) setErr('같은 이름의 노트가 이미 있습니다. 덮어쓰려면 아래 “덮어쓰기” 를 누르세요.');
        else fail(e);
      })
      .finally(() => setBusy(false));
  };

  /* ── ⑥ 연결 ── */
  const loadRelated = () => {
    if (!active) return;
    postJSON('/scholar/related', { key: active.key })
      .then(d => setRelated(d.suggested || [])).catch(fail);
  };
  const doLink = () => {
    if (!active) return;
    const targets = related.filter(r => picked[r.note]).map(r => ({ note: r.note, path: r.path }));
    if (!targets.length) { flash('연결할 노트를 고르세요'); return; }
    setBusy(true);
    postJSON('/scholar/link', { key: active.key, targets })
      .then(d => {
        setBacklinks(d.backlinks || []); setLinks(d.links || []);
        setItems(is => is.map(i => i.key === active.key ? { ...i, links: d.links, stage: Math.max(i.stage, 6) } : i));
        flash('양쪽 노트를 이었습니다');
      }).catch(fail).finally(() => setBusy(false));
  };

  /* ── ⑦ 인용·초안 ── */
  const makeCite = () => {
    if (!active) return;
    setBusy(true); setErr('');
    postJSON('/scholar/cite', { key: active.key }).then(setCite).catch(fail).finally(() => setBusy(false));
  };
  const appendDraft = () => {
    if (!active || !draft.trim() || !settings) return;
    setBusy(true);
    postJSON('/scholar/draft', { key: active.key, text: draft, draft_path: settings.draft_path })
      .then(d => {
        setItems(is => is.map(i => i.key === active.key ? { ...i, cited: true, stage: 7 } : i));
        setDraft(''); flash(`초안에 넣었습니다 — ${d.path}`);
      }).catch(fail).finally(() => setBusy(false));
  };

  /* ── 설정 저장 ── */
  const saveCfg = () => {
    if (!cfg) return;
    postJSON('/scholar/settings', { settings: cfg })
      .then(d => {
        if (d.status === 'ok') { setSettings(d.settings); setNoteDir(d.settings.note_dir); setCfgMsg(''); setCfgOpen(false); }
        else setCfgMsg(d.error || '저장 실패');
      }).catch(e => setCfgMsg(String(e?.message || e).slice(0, 200)));
  };

  const done = (it: Item, n: number) => it.stage >= n;

  return (
    <>
      {/* ── 단계 막대 ── */}
      <div className="s-panel" style={{ padding: 14 }}>
        <div className="flex items-center justify-between gap-3 flex-wrap" style={{ marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700 }}>수집 워크플로 7단계</div>
            <p style={{ fontSize: 14, color: 'var(--ink-2)', marginTop: 3 }}>
              검색에서 인용까지 한 줄기입니다. 지금 다루는 논문: {active
                ? <strong>{active.key}</strong>
                : <span style={{ color: 'var(--ink-3)' }}>없음 — ①에서 찾아 ②로 담으세요</span>}
            </p>
          </div>
          <button className="s-chip" aria-pressed={cfgOpen} onClick={() => setCfgOpen(v => !v)}>
            ⚙ 저장 폴더 · 색 규칙
          </button>
        </div>
        <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(7, minmax(0,1fr))' }}>
          {stages.map(s => {
            const ok = active ? done(active, s.n) : false;
            return (
              <button key={s.n} onClick={() => setStep(s.n)} className="s-src" title={s.desc}
                data-hot={step === s.n}
                style={{ textAlign: 'left', cursor: 'pointer', padding: 11, borderStyle: ok ? 'solid' : 'dashed' }}>
                <div className="flex items-center gap-1">
                  <span style={{ fontSize: 17, color: 'var(--s-accent-ink)', fontWeight: 700 }}>{NUM[s.n - 1]}</span>
                  {ok && <span style={{ fontSize: 12, color: 'var(--s-ok)' }}>✓</span>}
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, marginTop: 2 }}>{s.title}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 4, lineHeight: 1.5 }}>{s.tool}</div>
              </button>
            );
          })}
        </div>
      </div>

      {err && <p style={{ color: 'var(--error)', fontSize: 15 }}>{err}</p>}
      {msg && <p style={{ color: 'var(--s-ok)', fontSize: 15 }}>{msg}</p>}

      {/* ── 설정 ── */}
      {cfgOpen && cfg && (
        <div className="s-panel" style={{ padding: 18 }}>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>저장 폴더 · 하이라이트 색 규칙</div>
              <p style={{ fontSize: 14, color: 'var(--ink-2)', marginTop: 4, lineHeight: 1.8 }}>
                경로는 모두 볼트(<code>GFM_Research/</code>) 기준입니다. 색은 노트의 어느 자리로 갈지를 정합니다.
                <br />저장하면 <code>Server/scholar_settings.json</code> 에 남습니다.
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <button className="s-chip" onClick={() => postJSON('/scholar/settings/reset', {})
                .then(d => { setCfg(d.settings); setSettings(d.settings); setCfgMsg('기본값으로 되돌렸습니다'); })
                .catch(() => setCfgMsg('되돌리지 못했습니다'))}>기본값</button>
              <button className="s-chip" style={{ ...primary, padding: '6px 16px' }} onClick={saveCfg}>저장</button>
            </div>
          </div>
          {cfgMsg && <p style={{ fontSize: 14, color: 'var(--s-accent-ink)', marginTop: 8 }}>{cfgMsg}</p>}

          <datalist id="vault-folders">
            {folders.map(f => <option key={f.path} value={f.path}>{f.notes}개 노트</option>)}
          </datalist>

          <div className="grid gap-3 mt-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px,1fr))' }}>
            {([
              ['note_dir', '문헌 노트 폴더 (.md 저장 위치)', true],
              ['pdf_dir', '원본 PDF 폴더 (Zotero 저장 위치)', true],
              ['bib_path', 'BibTeX 파일', false],
              ['draft_path', '초안 파일', false],
            ] as const).map(([k, lb, isDir]) => (
              <div key={k}>
                <div style={label}>{lb}</div>
                <input style={input} value={(cfg as any)[k]} list={isDir ? 'vault-folders' : undefined}
                  onChange={e => setCfg({ ...cfg, [k]: e.target.value } as Settings)} />
              </div>
            ))}
            <div>
              <div style={label}>연락 메일 — OpenAlex·Unpaywall 권장 (없으면 429 로 막힐 수 있습니다)</div>
              <input style={input} value={cfg.contact_email} placeholder="you@yonsei.ac.kr"
                onChange={e => setCfg({ ...cfg, contact_email: e.target.value })} />
            </div>
            <div>
              <div style={label}>Zotero 커넥터 주소</div>
              <div className="flex gap-2 items-center">
                <input style={input} value={cfg.zotero_url}
                  onChange={e => setCfg({ ...cfg, zotero_url: e.target.value })} />
                <button className="s-chip" aria-pressed={cfg.zotero_enabled}
                  onClick={() => setCfg({ ...cfg, zotero_enabled: !cfg.zotero_enabled })}>
                  {cfg.zotero_enabled ? '연동 켜짐' : '연동 꺼짐'}
                </button>
              </div>
            </div>
            <div>
              <div style={label}>검색 범위</div>
              <div className="flex gap-2 items-center flex-wrap">
                <input style={{ ...input, width: 90 }} type="number" value={cfg.from_year}
                  onChange={e => setCfg({ ...cfg, from_year: +e.target.value })} title="이 해부터" />
                <input style={{ ...input, width: 80 }} type="number" value={cfg.top}
                  onChange={e => setCfg({ ...cfg, top: +e.target.value })} title="최대 편수" />
                {(['openalex', 's2', 'arxiv'] as const).map(s => (
                  <button key={s} className="s-chip" aria-pressed={cfg.sources.includes(s)}
                    onClick={() => setCfg({
                      ...cfg, sources: cfg.sources.includes(s)
                        ? cfg.sources.filter(x => x !== s) : [...cfg.sources, s],
                    })}>{SRC_LABEL[s]}</button>
                ))}
              </div>
            </div>
          </div>

          <div style={{ fontSize: 15, fontWeight: 600, marginTop: 18, marginBottom: 6 }}>하이라이트 색 규칙</div>
          <div className="space-y-2">
            {cfg.highlights.map((h, i) => (
              <div key={i} style={{
                display: 'grid', gridTemplateColumns: '54px 1.2fr 1fr 1fr', gap: 10, alignItems: 'center',
                padding: 9, borderRadius: 10, background: 'var(--s-bg)',
                border: '1px solid var(--s-line)', borderLeft: `5px solid ${h.color}`,
              }}>
                <input type="color" value={h.color} style={{ width: 44, height: 30, border: 'none', background: 'none' }}
                  onChange={e => setCfg({
                    ...cfg, highlights: cfg.highlights.map((x, j) => j === i ? { ...x, color: e.target.value } : x),
                  })} />
                <input style={input} value={h.mean} placeholder="뜻 (핵심 · 인용 후보 …)"
                  onChange={e => setCfg({
                    ...cfg, highlights: cfg.highlights.map((x, j) => j === i ? { ...x, mean: e.target.value } : x),
                  })} />
                <input style={input} value={h.callout} placeholder="callout"
                  onChange={e => setCfg({
                    ...cfg, highlights: cfg.highlights.map((x, j) => j === i ? { ...x, callout: e.target.value } : x),
                  })} />
                <select style={input} value={h.section}
                  onChange={e => setCfg({
                    ...cfg, highlights: cfg.highlights.map((x, j) => j === i ? { ...x, section: e.target.value } : x),
                  })}>
                  <option value="core">노트 ▸ 핵심 기여</option>
                  <option value="method">노트 ▸ 방법</option>
                  <option value="quote">노트 ▸ 주요 수치</option>
                  <option value="background">노트 ▸ 요약</option>
                  <option value="unknown">노트 ※ 미확인 항목</option>
                </select>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-12 gap-5 items-start">
        {/* ══ 왼쪽: 단계 본문 ══ */}
        <div className="col-span-12 lg:col-span-8 space-y-4">

          {/* ① 검색 */}
          {step === 1 && (
            <>
              <form onSubmit={search} className="s-panel flex gap-2" style={{ padding: 14 }}>
                <input value={q} onChange={e => setQ(e.target.value)} style={{ ...input, fontSize: 16 }}
                  placeholder="찾을 주제 — 예: grid-forming inverter small-signal stability weak grid" />
                <button type="submit" style={primary} disabled={busy}>{busy ? '찾는 중' : '검색'}</button>
              </form>

              {searchNote && <p className="s-interp" style={{ fontSize: 15 }}>※ {searchNote}</p>}

              {papers && (
                <div className="flex flex-wrap gap-2" style={{ fontSize: 14, color: 'var(--ink-3)' }}>
                  {Object.entries(counts).map(([k, v]) => (
                    <span key={k} className="s-chip" style={{ cursor: 'default' }}>
                      {SRC_LABEL[k] || k}: {v === null ? '실패' : `${v}편`}
                    </span>
                  ))}
                  <span className="s-chip" style={{ cursor: 'default' }}>중복 제거 후 {papers.length}편</span>
                </div>
              )}

              <div className="space-y-2">
                {(papers ?? []).map((p, i) => (
                  <div key={(p.doi || p.title) + i} className="s-src">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div style={{ fontSize: 15.5, fontWeight: 600, lineHeight: 1.5 }}>{p.title}</div>
                        <div style={{ fontSize: 13.5, color: 'var(--ink-3)', marginTop: 4 }}>
                          {p.authors || '저자 미확인'} · {p.year || '연도 미확인'} · {p.venue || '게재처 미확인'}
                        </div>
                        <div className="flex gap-2 mt-2 flex-wrap" style={{ fontSize: 13 }}>
                          <span className="s-chip" style={{ cursor: 'default' }}>점수 {p.score}</span>
                          <span className="s-chip" style={{ cursor: 'default' }}>인용 {p.cited_by}</span>
                          <span className="s-chip" style={{ cursor: 'default' }}>{SRC_LABEL[p.source] || p.source}</span>
                          {p.pdf_url && <span className="s-badge">OA PDF</span>}
                          {p.doi
                            ? <a className="s-chip" href={`https://doi.org/${p.doi}`} target="_blank" rel="noreferrer"
                              style={{ textDecoration: 'none' }}>DOI ↗</a>
                            : <span className="s-chip" style={{ cursor: 'default', color: 'var(--s-interp)' }}>DOI 없음</span>}
                          {p.in_vault && <span className="s-chip" style={{ cursor: 'default' }}>볼트에 이미 있음</span>}
                        </div>
                      </div>
                      <button className="s-chip shrink-0" disabled={p.in_inbox}
                        style={p.in_inbox ? undefined : { ...primary, padding: '7px 14px', fontSize: 14 }}
                        onClick={() => collect(p)}>{p.in_inbox ? '담김' : '＋ 담기'}</button>
                    </div>
                    {p.abstract && (
                      <p style={{ fontSize: 14, color: 'var(--ink-2)', marginTop: 8, lineHeight: 1.7 }}>
                        {p.abstract.slice(0, 260)}{p.abstract.length > 260 ? '…' : ''}
                      </p>
                    )}
                  </div>
                ))}
                {papers && !papers.length && (
                  <p style={{ fontSize: 15, color: 'var(--ink-3)' }}>검색 결과가 없습니다.</p>
                )}
                {papers === null && (
                  <div className="s-src" style={{ borderStyle: 'dashed', color: 'var(--ink-3)', fontSize: 14.5, lineHeight: 1.8 }}>
                    외부 DB(OpenAlex · Semantic Scholar · arXiv)와 내 볼트를 같이 찾습니다.
                    <br />▸ 는 근거, ※ 는 해석입니다 — 아래 볼트 답변에도 같은 규칙이 적용됩니다.
                  </div>
                )}
              </div>

              {/* 볼트 쪽 답변 — 옛 '검색·답변' 화면이 하던 일 */}
              {vaultHits && (
                <div className="s-panel" style={{ padding: 18 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>내 볼트에서 (답변)</div>
                  {vaultHits.length === 0 ? (
                    <p style={{ fontSize: 15, color: 'var(--ink-3)' }}>
                      이 주제로 쓴 노트가 아직 없습니다 — 위에서 논문을 담아 ⑤까지 진행하면 여기 잡힙니다.
                    </p>
                  ) : (
                    <>
                      <div className="s-fact">
                        ▸ 볼트에서 <strong>{vaultHits.length}</strong>개 노트가 이 주제와 닿아 있습니다.
                      </div>
                      {vaultHits.slice(0, 3).map((h, i) => (
                        <div key={h.path} className="s-fact">
                          ▸ {h.snippet ? `…${h.snippet}…` : h.title}
                          <span className="s-cite">{i + 1}</span>
                          <div style={{ fontSize: 13, color: 'var(--ink-3)', fontFamily: 'system-ui' }}>{h.path}</div>
                        </div>
                      ))}
                      <div className="s-interp">
                        ※ 위는 <strong>내 볼트 안에서만</strong> 찾은 것입니다. 외부 논문의 주장은 ③에서 원본을
                        확보하고 ④에서 직접 읽어 확인한 뒤에만 근거로 쓰세요.
                      </div>
                    </>
                  )}
                </div>
              )}
            </>
          )}

          {/* ② 선별 */}
          {step === 2 && (
            <div className="s-panel" style={{ padding: 18 }}>
              <div style={{ fontSize: 16, fontWeight: 700 }}>선별 — 수집함</div>
              <p style={{ fontSize: 14.5, color: 'var(--ink-2)', marginTop: 4, lineHeight: 1.8 }}>
                오른쪽 수집함에서 논문을 고르면 ③부터가 그 논문에 대해 열립니다.
                cite_key 는 <code>제1저자성+연도+주제어</code> 로 자동 부여되고, 볼트에 같은 키가 있으면 뒤에 글자를 붙입니다.
              </p>
              {!items.length && (
                <p style={{ fontSize: 15, color: 'var(--ink-3)', marginTop: 10 }}>
                  아직 담은 논문이 없습니다 — ①에서 검색해 ‘담기’ 를 누르세요.
                </p>
              )}
              {!!items.length && (
                <table className="s-tbl" style={{ marginTop: 12 }}>
                  <thead>
                    <tr><th>cite_key</th><th>논문</th><th>연도</th><th>단계</th><th /></tr>
                  </thead>
                  <tbody>
                    {items.map(it => (
                      <tr key={it.key} style={it.key === activeKey ? { background: 'var(--s-accent-soft)' } : undefined}>
                        <td style={{ fontWeight: 600 }}>{it.key}</td>
                        <td style={{ maxWidth: 420 }}>{it.paper.title}</td>
                        <td>{it.paper.year || '—'}</td>
                        <td>{NUM[Math.min(it.stage, 7) - 1]} / ⑦</td>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          <button className="s-chip" onClick={() => { setActiveKey(it.key); setStep(3); }}>고르기</button>{' '}
                          <button className="s-chip" style={{ color: 'var(--error)' }} onClick={() => drop(it.key)}>빼기</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* ③ 원본 확보 */}
          {step === 3 && (
            <div className="s-panel" style={{ padding: 18 }}>
              <div style={{ fontSize: 16, fontWeight: 700 }}>원본 확보 — 폴더 저장 · Zotero</div>
              {!active ? (
                <p style={{ fontSize: 15, color: 'var(--ink-3)', marginTop: 8 }}>②에서 논문을 먼저 고르세요.</p>
              ) : (
                <>
                  <p style={{ fontSize: 14.5, color: 'var(--ink-2)', marginTop: 4, lineHeight: 1.8 }}>
                    오픈액세스 PDF 를 <code>{settings?.pdf_dir}/{active.key}.pdf</code> 로 저장하고,
                    BibTeX 에 <code>{active.key}</code> 항목을 적립하고, 실행 중인 Zotero 에 같은 항목을 보냅니다.
                    <br />유료 논문은 링크만 남습니다 — 도서관 경유로 직접 내려받아 같은 이름으로 넣으면 노트가 그대로 물립니다.
                  </p>
                  <div className="flex gap-2 items-center flex-wrap mt-3">
                    {([['pdf', 'PDF 원본'], ['bib', 'BibTeX'], ['zotero', 'Zotero 전송']] as const).map(([k, lb]) => (
                      <button key={k} className="s-chip" aria-pressed={(channels as any)[k]}
                        onClick={() => setChannels({ ...channels, [k]: !(channels as any)[k] })}>{lb}</button>
                    ))}
                    <button style={primary} onClick={getOriginal} disabled={busy}>
                      {busy ? '가져오는 중' : '원본 가져오기'}
                    </button>
                  </div>
                  <Res r={active.original.pdf} />
                  <Res r={active.original.bib} />
                  <Res r={active.original.zotero} />
                  {active.paper.pdf_url && (
                    <p style={{ fontSize: 13.5, marginTop: 10 }}>
                      <a href={active.paper.pdf_url} target="_blank" rel="noreferrer">원본 링크 열기 ↗</a>
                      {active.paper.landing && <> · <a href={active.paper.landing} target="_blank" rel="noreferrer">게재 페이지 ↗</a></>}
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          {/* ④ 하이라이트 */}
          {step === 4 && (
            <div className="s-panel" style={{ padding: 18 }}>
              <div style={{ fontSize: 16, fontWeight: 700 }}>정독 · 하이라이트 — 색이 곧 분류</div>
              {!active ? (
                <p style={{ fontSize: 15, color: 'var(--ink-3)', marginTop: 8 }}>②에서 논문을 먼저 고르세요.</p>
              ) : (
                <>
                  <p style={{ fontSize: 14.5, color: 'var(--ink-2)', marginTop: 4, lineHeight: 1.8 }}>
                    Zotero 에서 칠한 색 그대로 발췌를 넣으세요. 색마다 노트의 들어갈 자리가 정해져 있습니다.
                    페이지를 적으면 <code>[[{active.key}.pdf#page=N]]</code> 앵커가 붙어 원문 대조가 클릭 한 번이 됩니다.
                  </p>
                  <div className="flex gap-2 flex-wrap mt-3">
                    {settings?.highlights.map(h => (
                      <button key={h.section} className="s-chip" aria-pressed={hi.section === h.section}
                        onClick={() => setHi({ ...hi, section: h.section })}
                        style={{ borderLeft: `5px solid ${h.color}` }}>{h.mean}</button>
                    ))}
                  </div>
                  <div className="flex gap-2 mt-3">
                    <input style={input} value={hi.text} placeholder="발췌 — 조건·단위까지 그대로 (예: SCR 1.5, X/R=5 에서 ζ=0.21)"
                      onChange={e => setHi({ ...hi, text: e.target.value })}
                      onKeyDown={e => e.key === 'Enter' && addHi()} />
                    <input style={{ ...input, width: 110 }} value={hi.page} placeholder="p."
                      onChange={e => setHi({ ...hi, page: e.target.value })} />
                    <button className="s-chip" style={{ ...primary, padding: '8px 16px' }} onClick={addHi}>추가</button>
                  </div>

                  <div className="space-y-2 mt-4">
                    {active.highlights.map((h, i) => (
                      <div key={i} className="flex items-start justify-between gap-2" style={{
                        padding: '9px 12px', borderRadius: 10, background: 'var(--s-bg)',
                        border: '1px solid var(--s-line)',
                        borderLeft: `5px solid ${rule(h.section)?.color || 'var(--s-line)'}`,
                      }}>
                        <div style={{ fontSize: 14.5, lineHeight: 1.7 }}>
                          {h.section === 'unknown' ? '※ ' : '▸ '}{h.text}
                          {h.page && <span style={{ color: 'var(--ink-3)' }}> — p.{h.page}</span>}
                          <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 2 }}>
                            {rule(h.section)?.mean || h.section}
                          </div>
                        </div>
                        <button className="s-chip shrink-0" style={{ color: 'var(--error)' }}
                          onClick={() => delHi(i)}>삭제</button>
                      </div>
                    ))}
                    {!active.highlights.length && (
                      <p style={{ fontSize: 14.5, color: 'var(--ink-3)' }}>
                        발췌가 없으면 노트의 수치·기여 칸은 <code>미확인</code> 으로 남습니다 (날조하지 않기 위해서입니다).
                      </p>
                    )}
                  </div>

                  {/* ── NotebookLM — 읽기 보조 ── */}
                  <div style={{ marginTop: 22, paddingTop: 16, borderTop: '1px dashed var(--s-line)' }}>
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div>
                        <div style={{ fontSize: 15.5, fontWeight: 700 }}>NotebookLM — 인포그래픽 · 마인드맵 · 오디오 · 리포트</div>
                        <p style={{ fontSize: 14, color: 'var(--ink-2)', marginTop: 3, lineHeight: 1.8 }}>
                          논문 하나에 노트북 하나를 만들고, 링크·서지·초록·발췌(있으면 저장된 PDF 본문)를 소스로 넣습니다.
                          <br />여기서 나오는 것은 <strong>전부 AI 생성물</strong>이라 노트에도 ※ 로만 적힙니다 — 인용은 원문을 본 뒤에.
                        </p>
                      </div>
                      <button className="s-chip shrink-0" onClick={checkNb} disabled={nbBusy === 'status'}>
                        {nbBusy === 'status' ? '확인 중' : '연결 확인'}
                      </button>
                    </div>

                    {nb && !nb.authenticated && (
                      <div className="s-interp" style={{ fontSize: 14.5 }}>
                        ※ {nb.error || 'NotebookLM 에 연결되지 않았습니다.'}
                        {nb.installed && (
                          <div className="flex gap-2 mt-2 items-center">
                            <code>{nb.auth_cmd || 'notebooklm-mcp-auth'}</code>
                            <Copy text={nb.auth_cmd || 'notebooklm-mcp-auth'} label="명령 복사" />
                            <span style={{ fontSize: 13 }}>터미널에서 한 번 실행한 뒤 ‘연결 확인’</span>
                          </div>
                        )}
                      </div>
                    )}
                    {nbErr && <p style={{ color: 'var(--error)', fontSize: 14.5, marginTop: 8 }}>{nbErr}</p>}

                    {nb?.authenticated && (
                      <>
                        <div className="flex gap-2 items-end flex-wrap mt-3">
                          <div style={{ minWidth: 320, flex: 1 }}>
                            <div style={label}>소스 URL — 논문 페이지·PDF (예: KIEE XmlViewer 주소)</div>
                            <input style={input} value={nbUrl} onChange={e => setNbUrl(e.target.value)}
                              placeholder="http://www.tkiee.org/kiee/XmlViewer/f427325" />
                          </div>
                          <button className="s-chip" aria-pressed={nbOpt.meta}
                            onClick={() => setNbOpt({ ...nbOpt, meta: !nbOpt.meta })}>서지·초록·발췌</button>
                          <button className="s-chip" aria-pressed={nbOpt.pdf}
                            onClick={() => setNbOpt({ ...nbOpt, pdf: !nbOpt.pdf })}
                            title="③에서 저장한 PDF 본문을 텍스트로 넣습니다 (pypdf 필요)">저장된 PDF 본문</button>
                          <button style={primary} onClick={makeNotebook} disabled={!!nbBusy}>
                            {nbBusy === 'notebook' ? '만드는 중' : active.nblm?.notebook_id ? '소스 다시 넣기' : '노트북 만들기'}
                          </button>
                        </div>

                        {active.nblm?.notebook_id && (
                          <>
                            <p style={{ fontSize: 14, marginTop: 10 }}>
                              노트북: <a href={active.nblm.url} target="_blank" rel="noreferrer">{active.nblm.url} ↗</a>
                            </p>
                            {(active.nblm.sources || []).map((s, i) => (
                              <Res key={i} r={{ ok: s.ok, msg: `[${s.kind}] ${s.title} — ${s.msg}` }} />
                            ))}

                            {/* JS 로 그리는 뷰어(KIEE 등)는 크롤링이 빈 껍데기로 들어간다 — 본문 붙여넣기 통로 */}
                            <details style={{ marginTop: 10 }}>
                              <summary style={{ fontSize: 14, color: 'var(--ink-2)', cursor: 'pointer' }}>
                                본문이 안 들어갔나요? — 텍스트로 직접 넣기
                              </summary>
                              <p style={{ fontSize: 13.5, color: 'var(--ink-3)', margin: '6px 0', lineHeight: 1.7 }}>
                                KIEE XmlViewer 처럼 본문을 JavaScript 로 그리는 페이지는 URL 소스로 넣어도 메뉴만 들어갈 수 있습니다.
                                그럴 때는 뷰어에서 본문을 복사해 여기 붙여 넣으세요.
                              </p>
                              <textarea value={nbText} onChange={e => setNbText(e.target.value)} rows={5}
                                style={{ ...input, fontFamily: 'inherit', lineHeight: 1.7 }}
                                placeholder="논문 본문을 붙여 넣으세요" />
                              <button className="s-chip" style={{ marginTop: 6 }} onClick={addNbSource} disabled={!!nbBusy}>
                                {nbBusy === 'source' ? '넣는 중' : '소스로 추가'}
                              </button>
                            </details>

                            <div className="flex gap-2 items-end flex-wrap mt-4">
                              <div style={{ minWidth: 260, flex: 1 }}>
                                <div style={label}>무엇에 집중할지 (선택) — 생성물 전체에 적용</div>
                                <input style={input} value={nbOpt.focus} onChange={e => setNbOpt({ ...nbOpt, focus: e.target.value })}
                                  placeholder="예: SCR 변화에 따른 감쇠비와 검증 방법 위주로" />
                              </div>
                              <div>
                                <div style={label}>언어</div>
                                <select style={{ ...input, width: 110 }} value={nbOpt.lang}
                                  onChange={e => setNbOpt({ ...nbOpt, lang: e.target.value })}>
                                  <option value="ko">한국어</option>
                                  <option value="en">English</option>
                                  <option value="ja">日本語</option>
                                </select>
                              </div>
                            </div>
                            <div className="flex gap-2 flex-wrap mt-2">
                              {NBLM_KINDS.map(k => (
                                <button key={k.kind} className="s-chip" onClick={() => genNb(k.kind)} disabled={!!nbBusy}>
                                  {nbBusy === k.kind ? '요청 중…' : `＋ ${k.label}`}
                                </button>
                              ))}
                              <div className="flex-1" />
                              <button className="s-chip" onClick={studio} disabled={!!nbBusy}>
                                {nbBusy === 'studio' ? '확인 중' : '생성 상태 새로고침'}
                              </button>
                              <button className="s-chip" onClick={nbToNote} disabled={!!nbBusy || !active.note_path}
                                title={active.note_path ? '노트에 ※ 로 적습니다' : '먼저 ⑤에서 노트를 저장하세요'}>
                                노트에 적기
                              </button>
                            </div>

                            <div className="space-y-2 mt-3">
                              {(active.nblm.artifacts || []).map((a, i) => (
                                <div key={i} className="flex items-center justify-between gap-2" style={{
                                  padding: '9px 12px', borderRadius: 10, background: 'var(--s-bg)',
                                  border: '1px solid var(--s-line)',
                                }}>
                                  <div style={{ fontSize: 14.5 }}>
                                    ※ {a.label || a.kind}
                                    <span style={{ color: 'var(--ink-3)' }}> — {a.status}{a.msg ? ` · ${a.msg}` : ''}</span>
                                  </div>
                                  {a.url && <a className="s-chip shrink-0" href={a.url} target="_blank" rel="noreferrer"
                                    style={{ textDecoration: 'none' }}>열기 ↗</a>}
                                </div>
                              ))}
                              {!(active.nblm.artifacts || []).length && (
                                <p style={{ fontSize: 14, color: 'var(--ink-3)' }}>
                                  아직 만든 것이 없습니다. 오디오는 몇 분 걸리니 ‘생성 상태 새로고침’ 으로 확인하세요.
                                </p>
                              )}
                            </div>

                            <div className="flex gap-2 mt-4">
                              <input style={input} value={nbQ} onChange={e => setNbQ(e.target.value)}
                                placeholder="이 논문에 물어보기 — 노트북 안 소스에만 근거해 답합니다"
                                onKeyDown={e => e.key === 'Enter' && askNb()} />
                              <button className="s-chip" onClick={askNb} disabled={!!nbBusy}>
                                {nbBusy === 'query' ? '묻는 중' : '질문'}
                              </button>
                            </div>
                            {nbAns && <div className="s-interp" style={{ fontSize: 15 }}>※ {nbAns}</div>}
                          </>
                        )}
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ⑤ 노트화 */}
          {step === 5 && (
            <div className="s-panel" style={{ padding: 18 }}>
              <div style={{ fontSize: 16, fontWeight: 700 }}>노트화 — 저장 규칙대로 .md 만들기</div>
              {!active ? (
                <p style={{ fontSize: 15, color: 'var(--ink-3)', marginTop: 8 }}>②에서 논문을 먼저 고르세요.</p>
              ) : (
                <>
                  <p style={{ fontSize: 14.5, color: 'var(--ink-2)', marginTop: 4, lineHeight: 1.8 }}>
                    frontmatter 전체 키 + ▸/※ 4개 섹션으로 만듭니다. 원문에서 확인하지 못한 값은
                    <code> 미확인</code> 으로 남습니다 — 정독 후 ④에 발췌를 넣으면 채워집니다.
                  </p>
                  <div className="flex gap-2 items-end flex-wrap mt-3">
                    <div style={{ minWidth: 300, flex: 1 }}>
                      <div style={label}>저장 폴더 (볼트 기준)</div>
                      <input style={input} value={noteDir} list="vault-folders"
                        onChange={e => setNoteDir(e.target.value)} />
                    </div>
                    <button className="s-chip" onClick={doPreview} disabled={busy}>미리보기</button>
                    <button style={primary} onClick={() => saveNote(false)} disabled={busy || !preview}>노트 저장</button>
                    {preview?.exists && (
                      <button className="s-chip" style={{ color: 'var(--error)' }}
                        onClick={() => saveNote(true)}>덮어쓰기</button>
                    )}
                  </div>

                  {preview && (
                    <>
                      <p style={{ fontSize: 14, color: 'var(--ink-3)', marginTop: 10 }}>
                        저장 경로: <strong>{preview.path}</strong>
                        {preview.exists && <span style={{ color: 'var(--s-interp)' }}> — 같은 이름의 노트가 이미 있습니다</span>}
                      </p>
                      {!!suggested.length && (
                        <div className="flex gap-2 flex-wrap mt-2">
                          <span style={{ fontSize: 13.5, color: 'var(--ink-3)' }}>연결 제안:</span>
                          {suggested.map(s => (
                            <button key={s.note} className="s-chip" aria-pressed={links.includes(s.note)}
                              title={`겹치는 말: ${s.shared.join(', ')}`}
                              onClick={() => setLinks(l => l.includes(s.note)
                                ? l.filter(x => x !== s.note) : [...l, s.note])}>{s.note}</button>
                          ))}
                        </div>
                      )}
                      <pre style={{ ...pre, marginTop: 12 }}>{preview.markdown}</pre>
                    </>
                  )}
                  {active.note_path && (
                    <p style={{ fontSize: 14, color: 'var(--s-ok)', marginTop: 10 }}>
                      ✓ 저장됨 — {active.note_path}
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          {/* ⑥ 연결 */}
          {step === 6 && (
            <div className="s-panel" style={{ padding: 18 }}>
              <div style={{ fontSize: 16, fontWeight: 700 }}>연결 — 이미 가진 지식과 잇기</div>
              {!active ? (
                <p style={{ fontSize: 15, color: 'var(--ink-3)', marginTop: 8 }}>②에서 논문을 먼저 고르세요.</p>
              ) : !active.note_path ? (
                <p style={{ fontSize: 15, color: 'var(--s-interp)', marginTop: 8 }}>
                  먼저 ⑤에서 노트를 저장하세요 — 연결은 저장된 노트끼리만 겁니다.
                </p>
              ) : (
                <>
                  <p style={{ fontSize: 14.5, color: 'var(--ink-2)', marginTop: 4, lineHeight: 1.8 }}>
                    주제어가 겹치는 기존 노트를 찾아 양쪽에 링크를 넣습니다. 내 노트에는 <code>연결된 노트</code> 줄,
                    상대 노트에는 <code>## 🔗 연결 노트</code> 아래 역링크가 생깁니다.
                  </p>
                  <div className="flex gap-2 mt-3">
                    <button className="s-chip" onClick={loadRelated}>관련 노트 찾기</button>
                    <button style={primary} onClick={doLink} disabled={busy || !related.length}>선택한 노트와 연결</button>
                  </div>
                  <div className="space-y-2 mt-3">
                    {related.map(r => (
                      <button key={r.path} className="s-src w-full text-left" data-hot={!!picked[r.note]}
                        onClick={() => setPicked(p => ({ ...p, [r.note]: !p[r.note] }))}>
                        <div style={{ fontSize: 15, fontWeight: 600 }}>{r.note}</div>
                        <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 3 }}>
                          {r.path} · 겹치는 말 {r.n}개: {r.shared.join(', ')}
                        </div>
                      </button>
                    ))}
                    {!related.length && (
                      <p style={{ fontSize: 14.5, color: 'var(--ink-3)' }}>‘관련 노트 찾기’ 를 눌러 보세요.</p>
                    )}
                  </div>
                  {backlinks.map(b => <Res key={b.path} r={b} />)}
                  {!!links.length && (
                    <p style={{ fontSize: 14, color: 'var(--ink-2)', marginTop: 10 }}>
                      현재 연결: {links.map(l => `[[${l}]]`).join(', ')}
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          {/* ⑦ 인용·초안 */}
          {step === 7 && (
            <div className="s-panel" style={{ padding: 18 }}>
              <div style={{ fontSize: 16, fontWeight: 700 }}>인용 · 초안</div>
              {!active ? (
                <p style={{ fontSize: 15, color: 'var(--ink-3)', marginTop: 8 }}>②에서 논문을 먼저 고르세요.</p>
              ) : (
                <>
                  <p style={{ fontSize: 14.5, color: 'var(--ink-2)', marginTop: 4, lineHeight: 1.8 }}>
                    Crossref 로 서지를 대조해 IEEE 인용문을 만듭니다. 대조에 실패한 필드는 <code>[미검증]</code> 으로
                    남습니다 — 그대로 논문에 넣지 마세요.
                    초안에는 <code>[@{active.key}]</code> 로 넣습니다 (<code>[[ ]]</code> 는 Pandoc 이 인용으로 읽지 않습니다).
                  </p>
                  <div className="flex gap-2 mt-3">
                    <button className="s-chip" onClick={makeCite} disabled={busy}>IEEE 인용문 만들기</button>
                  </div>
                  {cite && (
                    <>
                      <div style={{
                        marginTop: 12, padding: 12, borderRadius: 10, fontSize: 14.5, lineHeight: 1.8,
                        background: 'var(--s-bg)', border: `1px solid ${cite.verified ? 'var(--s-ok)' : 'var(--s-interp)'}`,
                      }}>{cite.ieee}</div>
                      <div className="flex gap-2 mt-2 flex-wrap">
                        <Copy text={cite.ieee} label="IEEE 복사" />
                        <Copy text={cite.pandoc} label={`${cite.pandoc} 복사`} />
                        <Copy text={cite.bibtex} label="BibTeX 복사" />
                        <span className="s-chip" style={{ cursor: 'default', color: cite.verified ? 'var(--s-ok)' : 'var(--s-interp)' }}>
                          {cite.verified ? 'Crossref 검증됨' : '검증 실패 — 직접 확인 필요'}
                        </span>
                      </div>
                    </>
                  )}

                  <div style={{ fontSize: 15, fontWeight: 600, marginTop: 18 }}>초안에 문단 넣기</div>
                  <p style={{ fontSize: 14, color: 'var(--ink-3)', marginTop: 4 }}>
                    쓴 문장 뒤에 <code>[@{active.key}]</code> 가 붙어 <code>{settings?.draft_path}</code> 에 쌓입니다.
                  </p>
                  <textarea value={draft} onChange={e => setDraft(e.target.value)} rows={4}
                    style={{ ...input, marginTop: 8, fontFamily: 'inherit', lineHeight: 1.8 }}
                    placeholder="예: 약계통에서 GFM 인버터의 감쇠는 SCR 에 강하게 의존한다" />
                  <div className="flex gap-2 mt-2">
                    <button style={primary} onClick={appendDraft} disabled={busy || !draft.trim()}>초안에 추가</button>
                    {active.cited && <span className="s-badge" style={{ alignSelf: 'center' }}>인용됨</span>}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* ══ 오른쪽: 수집함 ══ */}
        <aside className="col-span-12 lg:col-span-4 space-y-2">
          <div className="flex items-center justify-between">
            <div style={{ fontSize: 15, fontWeight: 700 }}>수집함 {items.length}</div>
            <span style={{ fontSize: 13, color: 'var(--ink-3)' }}>단계는 논문마다 따로 갑니다</span>
          </div>
          {items.map(it => (
            <button key={it.key} className="s-src w-full text-left" data-hot={it.key === activeKey}
              onClick={() => setActiveKey(it.key)}>
              <div style={{ fontSize: 14.5, fontWeight: 600 }}>{it.key}</div>
              <div style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 3, lineHeight: 1.5 }}>
                {it.paper.title.slice(0, 80)}{it.paper.title.length > 80 ? '…' : ''}
              </div>
              <div className="flex gap-1 mt-2" style={{ fontSize: 12 }}>
                {NUM.map((n, i) => (
                  <span key={i} title={stages[i]?.title} style={{
                    color: it.stage >= i + 1 ? 'var(--s-ok)' : 'var(--ink-3)',
                    opacity: it.stage >= i + 1 ? 1 : .45,
                  }}>{n}</span>
                ))}
                {it.note_path && <span className="s-badge" style={{ marginLeft: 6 }}>노트</span>}
                {it.cited && <span className="s-badge">인용</span>}
              </div>
            </button>
          ))}
          {!items.length && (
            <div className="s-src" style={{ borderStyle: 'dashed', fontSize: 14, color: 'var(--ink-3)', lineHeight: 1.8 }}>
              비어 있습니다. ①에서 검색해 ‘담기’ 를 누르면 여기 쌓이고, 창을 닫아도 남습니다
              (<code>Server/scholar_inbox.json</code>).
            </div>
          )}
        </aside>
      </div>
    </>
  );
}
