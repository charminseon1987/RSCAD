/* 연구실 스콜라 — 7단계 워크플로 (검색·답변 + 수집을 한 줄기로)

   ① 검색 → ② 선별 → ③ 원본 확보 → ④ 하이라이트 → ⑤ 노트화 → ⑥ 연결 → ⑦ 인용·초안

   검색과 수집을 따로 두면 "찾은 논문"과 "가진 논문"이 갈라진다. 그래서 한 화면에
   두고, 각 단계의 산출물은 서버 수집함(Server/scholar_inbox.json)에 남는다.
   ▸ 는 원문에 있는 것, ※ 는 내 판단 — 이 구분은 노트에도 그대로 간다.

   바깥 프로그램에 기대지 않는다. 라이브러리(컬렉션·태그·저장검색·중복), 식별자로
   바로 추가, PDF 리더와 색 하이라이트까지 이 화면 안에서 끝낸다 — 한 단계라도
   다른 앱으로 나가면 "칠한 것"과 "노트에 적힌 것"이 갈라지기 때문이다. */
import { useEffect, useMemo, useState } from 'react';
import { apiUrl, fetchJSON, postJSON } from '../lib/api';
import PdfReader, { type Annot } from '../components/PdfReader';
import AskPanel from '../components/AskPanel';

/* ── 타입 ── */
export interface Paper {
  title: string; authors: string; year: number | null; venue: string;
  volume?: string; issue?: string; pages?: string; doi: string;
  cited_by: number; abstract: string; pdf_url: string; landing?: string;
  topics: string[]; oa_id?: string; source: string; score: number;
  cite_key?: string; in_vault?: boolean; in_inbox?: boolean;
}
interface Channel { ok: boolean; msg: string; path?: string; url?: string; bytes?: number }
/* 라이브러리 — Zotero 좌측 패널 자리. 컬렉션은 항목을 옮기지 않고 소속만 적는다 */
interface Collection { id: string; name: string; parent: string }
interface Saved {
  id: string; name: string; q: string; tags: string[]; collection: string;
  stage_min: number; has_pdf: boolean; untagged: boolean; starred: boolean;
}
interface TagCount { tag: string; n: number }
/* 볼트에만 있는 논문 — 노트는 썼는데 수집함에 없어 ④ 리더로 못 여는 것들.
   title_from='heading' 은 frontmatter 에 title 이 없어 본문 제목을 가져왔다는 뜻이다 —
   서지 제목이 아니므로 화면에서 구분해 보여 준다. */
interface VaultPaper {
  key: string; note_path: string; paper: Paper; has_pdf: boolean;
  extraction_depth: string; title_from: string; axes: Record<string, unknown>;
}
interface DupGroup { on: string; keys: string[] }
interface NblmSource { kind: string; title: string; ok: boolean; msg: string; source_id?: string }
interface NblmArtifact { kind: string; label: string; status: string; artifact_id?: string; url?: string; msg?: string; at?: string }
interface Nblm { notebook_id: string; title?: string; url?: string; sources?: NblmSource[]; artifacts?: NblmArtifact[]; updated?: string }
interface Item {
  key: string; paper: Paper; stage: number;
  original: { pdf?: Channel; bib?: Channel };
  highlights: Annot[]; note_path: string; links: string[]; cited: boolean;
  collections?: string[]; tags?: string[]; starred?: boolean;
  from_vault?: boolean;          // 볼트에서 가져온 항목 — ⑤는 덮어쓰지 않고 덧붙인다
  extraction_depth?: string; section?: string; paper_type?: string; target_system?: string;
  /* 00_MOC.md 의 갭 표가 GROUP BY 하는 축. 서버 scholar.py EDITABLE 과 짝이다 */
  model_order?: number | string; tuning_method?: string; validation_level?: string;
  scr_range?: string; xr_range?: string;
  analysis_method?: string[]; hardware?: string[]; control_scheme?: string[];
  dc_ac_coupling?: boolean | string;
  nblm?: Nblm; added: string;
}
interface Stage { n: number; key: string; title: string; tool: string; desc: string; needs: string | null }
interface HiRule { color: string; callout: string; mean: string; section: string }
interface Settings {
  contact_email: string; from_year: number; top: number; sources: string[];
  pdf_dir: string; note_dir: string; draft_path: string; bib_path: string;
  highlights: HiRule[];
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

/* ⑤ 노트화에서 사람이 채우는 축 필드.
   이 값들이 00_MOC.md §2 갭 확인·§3 축별 분포의 GROUP BY 키다 — 비워 두면
   그 표가 전부 '미명시' 한 칸에 몰려 "어느 축이 비었나"를 볼 수 없다.
   enum 은 tools/claim_evidence.schema.json 과 같아야 한다. */
type AxisKind = 'num' | 'text' | 'list' | 'bool';
const AXIS: { f: keyof Item; label: string; kind: AxisKind; opts?: string[]; ph?: string }[] = [
  { f: 'paper_type', label: '논문 성격', kind: 'text', opts: ['review', 'method', 'analysis', 'experimental'] },
  { f: 'target_system', label: '대상 계통', kind: 'text', opts: ['WTG', 'PV', 'ESS', 'PV+ESS', '일반'] },
  { f: 'control_scheme', label: '제어 방식', kind: 'list', ph: 'droop, VSG, dVOC' },
  { f: 'model_order', label: '모델 차수', kind: 'num', ph: '22' },
  { f: 'analysis_method', label: '해석 방법', kind: 'list', ph: '고유값, 임피던스, 시간영역' },
  { f: 'tuning_method', label: '튜닝 방법', kind: 'text', opts: ['수동', '적응형', 'PSO', 'GA', 'Lyapunov기반'] },
  { f: 'scr_range', label: 'SCR 범위', kind: 'text', ph: '1.5~10' },
  { f: 'xr_range', label: 'X/R 범위', kind: 'text', ph: '0.2~5' },
  { f: 'validation_level', label: '검증 수준', kind: 'text', opts: ['none', 'sim-only', 'CHIL', 'PHIL', '실기'] },
  { f: 'hardware', label: '하드웨어', kind: 'list', ph: 'RTDS NovaCor, TMS320F28379D' },
  { f: 'dc_ac_coupling', label: 'DC-AC 커플링', kind: 'bool' },
];

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

/* 검색 결과·식별자 결과가 같은 카드를 쓴다 — 두 경로에서 모양이 갈리면
   "검색으로 담은 것"과 "DOI 로 담은 것"이 다른 물건처럼 보인다. */
function PaperCard({ p, onCollect }: { p: Paper; onCollect: (p: Paper) => void }) {
  return (
    <div className="s-src">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div style={{ fontSize: 15.5, fontWeight: 600, lineHeight: 1.5 }}>{p.title}</div>
          <div style={{ fontSize: 13.5, color: 'var(--ink-3)', marginTop: 4 }}>
            {p.authors || '저자 미확인'} · {p.year || '연도 미확인'} · {p.venue || '게재처 미확인'}
          </div>
          <div className="flex gap-2 mt-2 flex-wrap" style={{ fontSize: 13 }}>
            {!!p.score && <span className="s-chip" style={{ cursor: 'default' }}>점수 {p.score}</span>}
            <span className="s-chip" style={{ cursor: 'default' }}>인용 {p.cited_by}</span>
            <span className="s-chip" style={{ cursor: 'default' }}>{SRC_LABEL[p.source] || p.source}</span>
            {p.cite_key && <span className="s-chip" style={{ cursor: 'default' }}>키 {p.cite_key}</span>}
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
          onClick={() => onCollect(p)}>{p.in_inbox ? '담김' : '＋ 담기'}</button>
      </div>
      {p.abstract && (
        <p style={{ fontSize: 14, color: 'var(--ink-2)', marginTop: 8, lineHeight: 1.7 }}>
          {p.abstract.slice(0, 260)}{p.abstract.length > 260 ? '…' : ''}
        </p>
      )}
    </div>
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

  // ④ 손입력 발췌 · 리더 쪽수 · 첨부 현황
  const [hi, setHi] = useState({ section: 'quote', text: '', page: '' });
  const [pdfPage, setPdfPage] = useState(1);
  const [attachments, setAttachments] =
    useState<Record<string, { ok: boolean; path?: string; bytes?: number; msg?: string }>>({});

  // ⑤ 노트
  const [axis, setAxis] = useState<Record<string, string>>({});
  const [axisKey, setAxisKey] = useState('');   // 어느 논문의 폼인지 — 바뀌면 다시 채운다
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

  // 라이브러리 — 컬렉션 · 태그 · 저장검색 · 중복
  const [lib, setLib] = useState<{
    collections: Collection[]; saved: Saved[]; tags: TagCount[]; duplicates: DupGroup[];
  }>({ collections: [], saved: [], tags: [], duplicates: [] });
  const [filter, setFilter] = useState({
    q: '', tags: [] as string[], collection: '', stage_min: 0,
    has_pdf: false, untagged: false, starred: false,
  });
  const [newCol, setNewCol] = useState('');
  const [savedName, setSavedName] = useState('');
  const [tagDraft, setTagDraft] = useState('');
  const [mergeKeep, setMergeKeep] = useState('');
  const [vaultOnly, setVaultOnly] = useState<VaultPaper[]>([]);
  const [pickVault, setPickVault] = useState<Record<string, boolean>>({});

  // ② 식별자로 바로 추가
  const [ident, setIdent] = useState('');
  const [identBusy, setIdentBusy] = useState(false);
  const [identErr, setIdentErr] = useState('');
  const [identRes, setIdentRes] = useState<{
    mode: string; how: string; note?: string; paper?: Paper; candidates?: Paper[];
  } | null>(null);

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
    fetchJSON('/scholar/inbox').then(d => {
      setItems(d.items || []);
      /* 노트북에서 '원문 읽기' 로 넘어온 경우 — 그 논문을 바로 열어 준다.
         화면을 옮겨 놓고 "어느 논문이었더라" 를 다시 찾게 하면 안 된다. */
      const q = new URLSearchParams(window.location.search);
      const want = q.get('key');
      if (want && (d.items || []).some((i: Item) => i.key === want)) {
        setActiveKey(want);
        setStep(Math.min(Math.max(Number(q.get('step')) || 4, 1), 7));
      }
    }).catch(() => {});
    loadAttachments();
    loadLibrary();
    loadVaultOnly();
  }, []);

  useEffect(() => { if (settings && !noteDir) setNoteDir(settings.note_dir); }, [settings]);

  /* 활성 논문이 바뀌면 단계별 임시 상태를 비운다 — 남의 결과가 섞이지 않게 */
  useEffect(() => {
    setPreview(null); setCite(null); setBacklinks([]); setPicked({});
    setLinks(active?.links || []); setRelated([]);
    setNbAns(''); setNbErr(''); setNbText('');
    setNbUrl(active ? (active.paper.landing || active.paper.pdf_url || '') : '');
    setPdfPage(1);
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
    .then(d => { setItems(d.items); if (activeKey === key) setActiveKey(''); })
    .then(loadLibrary).catch(fail);

  const patch = (key: string, body: object) =>
    fetchJSON(`/scholar/inbox/${key}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    }).then(d => { setItems(is => is.map(i => i.key === key ? d.item : i)); return d.item as Item; });

  /* ── ③ 원본 · 첨부 ── */
  const [channels, setChannels] = useState({ pdf: true, bib: true });
  /* 첨부 유무는 디스크를 봐야 안다 — 수집함 기록만 믿으면 손으로 넣은 PDF 를 놓친다 */
  const loadAttachments = () =>
    fetchJSON('/scholar/attachments').then(d => setAttachments(d.attachments || {})).catch(() => {});
  const attachOf = (it: Item | null) => (it ? attachments[it.key] : undefined);

  const getOriginal = () => {
    if (!active || !settings) return;
    setBusy(true); setErr('');
    postJSON('/scholar/original', {
      key: active.key,
      channels: Object.entries(channels).filter(([, v]) => v).map(([k]) => k),
      pdf_dir: settings.pdf_dir, bib_path: settings.bib_path,
    }).then(d => { setItems(is => is.map(i => i.key === active.key ? d.item : i)); })
      .then(loadAttachments)
      .catch(fail).finally(() => setBusy(false));
  };

  const upload = (file: File) => {
    if (!active) return;
    const fd = new FormData();
    fd.append('file', file);
    setBusy(true); setErr('');
    fetchJSON(`/scholar/attach/${encodeURIComponent(active.key)}`, { method: 'POST', body: fd })
      .then(d => { putItem(d.item); flash(`보관했습니다 — ${d.path}`); })
      .then(loadAttachments)
      .catch(fail).finally(() => setBusy(false));
  };

  /* ── ④ 하이라이트 ──
     모두 /annot 을 거친다. 서버가 id 를 매기고 색을 규칙에서 채워야
     리더에 뜨는 색과 노트에 적히는 자리가 갈리지 않는다. */
  const addAnnot = (a: Omit<Annot, 'id' | 'created'>) => {
    if (!active) return Promise.resolve();
    return postJSON('/scholar/annot', { key: active.key, annot: a })
      .then(d => { putItem(d.item); })
      .catch(e => { fail(e); throw e; });
  };
  const annotRef = (h: Annot, idx: number) => encodeURIComponent(h.id || String(idx));
  const delAnnot = (h: Annot, idx: number) => {
    if (!active) return;
    fetchJSON(`/scholar/annot/${encodeURIComponent(active.key)}/${annotRef(h, idx)}`,
      { method: 'DELETE' }).then(d => putItem(d.item)).catch(fail);
  };
  const patchAnnot = (h: Annot, idx: number, body: object) => {
    if (!active) return;
    fetchJSON(`/scholar/annot/${encodeURIComponent(active.key)}/${annotRef(h, idx)}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    }).then(d => putItem(d.item)).catch(fail);
  };
  const addHi = () => {
    if (!active || !hi.text.trim()) return;
    addAnnot({ section: hi.section, text: hi.text.trim(), page: hi.page })
      .then(() => setHi({ section: hi.section, text: '', page: '' })).catch(() => {});
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

  /* ── ⑤ 축 필드 ── */
  /* 폼은 문자열만 들고, 서버에 보낼 때 종류에 맞게 되돌린다.
     빈 칸은 보내지 않는다 — 보내면 '미명시' 를 덮어쓴 것으로 남는다. */
  const axisBody = () => {
    const out: Record<string, unknown> = {};
    for (const a of AXIS) {
      const v = (axis[a.f as string] ?? '').trim();
      if (a.kind === 'bool') { if (v) out[a.f as string] = v === 'true'; continue; }
      if (!v) continue;
      if (a.kind === 'num') { const n = Number(v); out[a.f as string] = Number.isFinite(n) ? n : v; }
      else if (a.kind === 'list') out[a.f as string] = v.split(',').map(x => x.trim()).filter(Boolean);
      else out[a.f as string] = v;
    }
    return out;
  };
  const saveAxis = () => {
    if (!active) return;
    setBusy(true); setErr('');
    patch(active.key, axisBody())
      .then(() => doPreview())
      .catch(fail).finally(() => setBusy(false));
  };

  /* 논문을 바꾸면 그 논문의 저장값으로 폼을 다시 채운다 */
  useEffect(() => {
    if (!active || active.key === axisKey) return;
    const f: Record<string, string> = {};
    for (const a of AXIS) {
      const v = active[a.f] as unknown;
      f[a.f as string] = Array.isArray(v) ? v.join(', ')
        : typeof v === 'boolean' ? String(v)
          : v == null ? '' : String(v);
    }
    setAxis(f); setAxisKey(active.key);
  }, [active, axisKey]);

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

  /* ── 라이브러리 ──
     컬렉션은 항목을 옮기지 않는다. 항목이 어디에 속하는지만 적는다 —
     한 논문이 '박사·GFM' 과 '리뷰 논문' 에 동시에 들어가야 하기 때문이다. */
  const loadLibrary = () => fetchJSON('/scholar/library')
    .then(d => setLib({
      collections: d.collections || [], saved: d.saved || [],
      tags: d.tags || [], duplicates: d.duplicates || [],
    })).catch(() => {});

  const colName = (id: string) => lib.collections.find(c => c.id === id)?.name || id;

  const makeCol = () => {
    const name = newCol.trim();
    if (!name) return;
    postJSON('/scholar/library/collection', { name })
      .then(d => { setLib(l => ({ ...l, collections: d.collections })); setNewCol(''); })
      .catch(fail);
  };
  const delCol = (cid: string) =>
    fetchJSON(`/scholar/library/collection/${cid}`, { method: 'DELETE' })
      .then(d => {
        setLib(l => ({ ...l, collections: d.collections }));
        setItems(d.items);
        if (d.removed?.includes(filter.collection)) setFilter(f => ({ ...f, collection: '' }));
        flash('컬렉션을 지웠습니다 — 논문은 수집함에 남아 있습니다');
      }).catch(fail);

  const toggleCol = (it: Item, cid: string) => {
    const has = (it.collections || []).includes(cid);
    patch(it.key, {
      collections: has ? (it.collections || []).filter(x => x !== cid)
        : [...(it.collections || []), cid],
    }).then(loadLibrary).catch(fail);
  };
  const toggleTag = (it: Item, tag: string) => {
    const has = (it.tags || []).includes(tag);
    patch(it.key, {
      tags: has ? (it.tags || []).filter(x => x !== tag) : [...(it.tags || []), tag],
    }).then(loadLibrary).catch(fail);
  };
  const addTags = (it: Item, raw: string) => {
    const add = raw.split(',').map(x => x.trim()).filter(Boolean);
    if (!add.length) return;
    patch(it.key, { tags: Array.from(new Set([...(it.tags || []), ...add])) })
      .then(loadLibrary).then(() => setTagDraft('')).catch(fail);
  };
  const star = (it: Item) => patch(it.key, { starred: !it.starred }).catch(fail);

  /* 저장한 검색은 조건만 남긴다 — 결과를 저장하면 수집함이 바뀔 때 낡은 목록이 남는다 */
  const saveSearch = () => {
    const name = savedName.trim();
    if (!name) { flash('저장할 이름을 적으세요'); return; }
    postJSON('/scholar/library/saved', { name, ...filter })
      .then(d => { setLib(l => ({ ...l, saved: d.saved })); setSavedName(''); flash(`저장했습니다 — ${name}`); })
      .catch(fail);
  };
  const applySaved = (sv: Saved) => setFilter({
    q: sv.q || '', tags: sv.tags || [], collection: sv.collection || '',
    stage_min: sv.stage_min || 0, has_pdf: !!sv.has_pdf,
    untagged: !!sv.untagged, starred: !!sv.starred,
  });
  const delSaved = (sid: string) =>
    fetchJSON(`/scholar/library/saved/${sid}`, { method: 'DELETE' })
      .then(d => setLib(l => ({ ...l, saved: d.saved }))).catch(fail);

  /* 중복 병합 — 서지는 keep 것을 그대로 두고 발췌·태그·컬렉션·링크만 합친다 */
  const doMerge = (keep: string, drop: string[]) => {
    if (!keep || !drop.length) return;
    setBusy(true);
    postJSON('/scholar/merge', { keep, drop })
      .then(d => {
        setItems(d.items);
        if (activeKey && d.dropped?.includes(activeKey)) setActiveKey(keep);
        const orphans: string[] = d.orphan_notes || [];
        flash(orphans.length
          ? `${keep} 로 합쳤습니다 — 뺀 쪽 노트가 남아 있습니다: ${orphans.join(', ')} (지우는 건 직접)`
          : `${keep} 로 합쳤습니다`);
      })
      .then(loadLibrary).then(loadAttachments)
      .catch(fail).finally(() => setBusy(false));
  };

  /* ── 볼트에서 가져오기 ──
     새로 담는 게 아니라 기존 노트에 수집함 항목을 붙이는 것이다. 그래서 키가 그대로다 —
     키가 바뀌면 kenyon2020ibrstabilityb 처럼 갈라져 기존 [[링크]]가 끊긴다. */
  const loadVaultOnly = () => fetchJSON('/scholar/vault-papers')
    .then(d => setVaultOnly(d.papers || [])).catch(() => {});

  const doImport = () => {
    const keys = Object.entries(pickVault).filter(([, v]) => v).map(([k]) => k);
    if (!keys.length) return;
    setBusy(true); setErr('');
    postJSON('/scholar/import', { keys })
      .then(d => {
        setItems(d.items);
        setPickVault({});
        if (d.added?.length) setActiveKey(d.added[0]);
        const skip = (d.skipped || []).map((x: any) => x.key).join(', ');
        flash(`${d.added.length}편을 가져왔습니다${skip ? ` (건너뜀: ${skip})` : ''}`);
      })
      .then(loadVaultOnly).then(loadAttachments).then(loadLibrary)
      .catch(fail).finally(() => setBusy(false));
  };

  /* 가져온 논문은 노트를 다시 쓰지 않는다 — 발췌 섹션 하나만 갈아 끼운다 */
  const appendNote = () => {
    if (!active) return;
    setBusy(true); setErr('');
    postJSON('/scholar/note/append', { key: active.key })
      .then(d => {
        putItem(d.item);
        flash(d.changed ? `발췌를 노트에 반영했습니다 — ${d.path}` : '노트가 이미 최신입니다');
      }).catch(fail).finally(() => setBusy(false));
  };

  /* 걸러 보기 — 저장검색과 같은 조건을 쓴다 */
  const shown = useMemo(() => items.filter(it => {
    if (filter.collection && !(it.collections || []).includes(filter.collection)) return false;
    if (filter.untagged && (it.tags || []).length) return false;
    if (filter.starred && !it.starred) return false;
    if (filter.tags.length && !filter.tags.every(t => (it.tags || []).includes(t))) return false;
    if (filter.stage_min && it.stage < filter.stage_min) return false;
    if (filter.has_pdf && !attachments[it.key]?.ok) return false;
    if (filter.q) {
      const hay = [it.key, it.paper.title, it.paper.authors, it.paper.venue,
        (it.tags || []).join(' ')].join(' ').toLowerCase();
      if (!hay.includes(filter.q.toLowerCase())) return false;
    }
    return true;
  }), [items, filter, attachments]);

  const filterOn = !!(filter.q || filter.tags.length || filter.collection || filter.stage_min
    || filter.has_pdf || filter.untagged || filter.starred);

  /* ── ② 식별자로 바로 추가 ── */
  const runIdent = (e: React.FormEvent) => {
    e.preventDefault();
    const text = ident.trim();
    if (text.length < 4) { setIdentErr('네 글자 이상 입력하세요'); return; }
    setIdentBusy(true); setIdentErr(''); setIdentRes(null);
    postJSON('/scholar/identify', { text })
      .then(d => setIdentRes({
        mode: d.mode, how: d.how, note: d.note, paper: d.paper, candidates: d.candidates,
      }))
      .catch(e2 => setIdentErr(String(e2?.message || e2).replace(/^HTTP \d+: /, '').slice(0, 300)))
      .finally(() => setIdentBusy(false));
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
              ['pdf_dir', '원본 PDF 폴더 (④ 리더가 읽는 자리)', true],
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

              {/* 아는 논문 바로 추가 — 검색을 거치지 않는 길 */}
              <div className="s-panel" style={{ padding: 14 }}>
                <div style={{ fontSize: 15, fontWeight: 700 }}>아는 논문 바로 추가</div>
                <p style={{ fontSize: 14, color: 'var(--ink-2)', marginTop: 4, lineHeight: 1.75 }}>
                  DOI · arXiv ID · 논문 주소를 붙여 넣으면 Crossref·arXiv 에서 서지를 받아 옵니다.
                  받아 온 필드만 채우고, 주지 않은 값은 비워 둡니다 — 노트에서 <code>미명시</code> 로 남습니다.
                  <br />제목을 넣으면 <strong>후보만</strong> 보여 줍니다. 같은 논문이라고 단정하지 않습니다.
                </p>
                <form onSubmit={runIdent} className="flex gap-2 mt-3">
                  <input value={ident} onChange={e => setIdent(e.target.value)} style={input}
                    placeholder="10.1109/TIE.2025.3581260 · arXiv:2502.16161 · https://doi.org/… · 논문 제목" />
                  <button type="submit" className="s-chip" style={{ ...primary, padding: '8px 16px' }}
                    disabled={identBusy}>{identBusy ? '찾는 중' : '찾기'}</button>
                </form>
                {identErr && (
                  <p style={{ fontSize: 14, color: 'var(--error)', marginTop: 8 }}>{identErr}</p>
                )}
                {identRes && (
                  <div style={{ marginTop: 10 }}>
                    <p style={{ fontSize: 13.5, color: 'var(--ink-3)' }}>출처: {identRes.how}</p>
                    {identRes.note && (
                      <p className="s-interp" style={{ fontSize: 14 }}>※ {identRes.note}</p>
                    )}
                    <div className="space-y-2 mt-2">
                      {identRes.paper && <PaperCard p={identRes.paper} onCollect={collect} />}
                      {(identRes.candidates || []).map((c, i) => (
                        <PaperCard key={(c.doi || c.title) + i} p={c} onCollect={collect} />
                      ))}
                      {identRes.mode === 'candidates' && !identRes.candidates?.length && (
                        <p style={{ fontSize: 14.5, color: 'var(--ink-3)' }}>후보가 없습니다.</p>
                      )}
                    </div>
                  </div>
                )}
              </div>

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
                  <PaperCard key={(p.doi || p.title) + i} p={p} onCollect={collect} />
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
            <>
              <div className="s-panel" style={{ padding: 18 }}>
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div style={{ fontSize: 16, fontWeight: 700 }}>선별 — 수집함</div>
                  <span style={{ fontSize: 13.5, color: 'var(--ink-3)' }}>
                    {filterOn ? `걸러 보기 ${shown.length} / ${items.length}편` : `${items.length}편`}
                  </span>
                </div>
                <p style={{ fontSize: 14.5, color: 'var(--ink-2)', marginTop: 4, lineHeight: 1.8 }}>
                  오른쪽 라이브러리에서 컬렉션·태그로 걸러 보고, 논문을 고르면 ③부터가 그 논문에 대해 열립니다.
                  cite_key 는 <code>제1저자성+연도+주제어</code> 로 자동 부여되고, 볼트에 같은 키가 있으면 뒤에 글자를 붙입니다.
                </p>
                {!items.length && (
                  <p style={{ fontSize: 15, color: 'var(--ink-3)', marginTop: 10 }}>
                    아직 담은 논문이 없습니다 — ①에서 검색하거나 DOI 를 붙여 넣어 담으세요.
                  </p>
                )}
                {!!items.length && !shown.length && (
                  <p style={{ fontSize: 15, color: 'var(--ink-3)', marginTop: 10 }}>
                    걸러 보기 조건에 맞는 논문이 없습니다 — 오른쪽에서 조건을 지우세요.
                  </p>
                )}
                {!!shown.length && (
                  <table className="s-tbl" style={{ marginTop: 12 }}>
                    <thead>
                      <tr>
                        <th style={{ width: 28 }} />
                        <th>cite_key</th><th>논문</th><th>연도</th><th>원문</th><th>태그</th><th>단계</th><th />
                      </tr>
                    </thead>
                    <tbody>
                      {shown.map(it => (
                        <tr key={it.key} style={it.key === activeKey ? { background: 'var(--s-accent-soft)' } : undefined}>
                          <td>
                            <button className="s-chip" title={it.starred ? '별표 해제' : '별표'}
                              style={{ padding: '2px 5px', border: 'none', background: 'none', fontSize: 15 }}
                              onClick={() => star(it)}>{it.starred ? '★' : '☆'}</button>
                          </td>
                          <td style={{ fontWeight: 600 }}>{it.key}</td>
                          <td style={{ maxWidth: 360 }}>{it.paper.title}</td>
                          <td>{it.paper.year || '—'}</td>
                          <td>{attachments[it.key]?.ok
                            ? <span className="s-badge">PDF</span>
                            : <span style={{ color: 'var(--ink-3)', fontSize: 13 }}>없음</span>}</td>
                          <td style={{ maxWidth: 180, fontSize: 12.5, color: 'var(--ink-3)' }}>
                            {(it.tags || []).join(', ') || '—'}
                          </td>
                          <td>{NUM[Math.min(Math.max(it.stage, 1), 7) - 1]} / ⑦</td>
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

              {/* 고른 논문의 정리 — 컬렉션 소속과 태그 */}
              {active && (
                <div className="s-panel" style={{ padding: 18 }}>
                  <div style={{ fontSize: 15.5, fontWeight: 700 }}>
                    {active.key} 정리 — 컬렉션 · 태그
                  </div>
                  <p style={{ fontSize: 14, color: 'var(--ink-2)', marginTop: 4, lineHeight: 1.75 }}>
                    한 논문이 여러 컬렉션에 동시에 들어갈 수 있습니다. 컬렉션을 바꿔도 파일은 움직이지 않습니다 —
                    소속만 적습니다.
                  </p>

                  <div style={{ ...label, marginTop: 12 }}>컬렉션</div>
                  <div className="flex gap-2 flex-wrap">
                    {lib.collections.map(c => (
                      <button key={c.id} className="s-chip"
                        aria-pressed={(active.collections || []).includes(c.id)}
                        onClick={() => toggleCol(active, c.id)}>{c.name}</button>
                    ))}
                    {!lib.collections.length && (
                      <span style={{ fontSize: 14, color: 'var(--ink-3)' }}>
                        컬렉션이 없습니다 — 오른쪽에서 만드세요.
                      </span>
                    )}
                  </div>

                  <div style={{ ...label, marginTop: 14 }}>태그</div>
                  <div className="flex gap-2 flex-wrap items-center">
                    {(active.tags || []).map(t => (
                      <button key={t} className="s-chip" title="떼기" aria-pressed
                        onClick={() => toggleTag(active, t)}>{t} ✕</button>
                    ))}
                    {!(active.tags || []).length && (
                      <span style={{ fontSize: 14, color: 'var(--ink-3)' }}>아직 없습니다.</span>
                    )}
                  </div>
                  <div className="flex gap-2 mt-2">
                    <input style={input} value={tagDraft} placeholder="태그 — 쉼표로 여러 개 (예: GFM, 소신호, 리뷰)"
                      onChange={e => setTagDraft(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTags(active, tagDraft); } }} />
                    <button className="s-chip" onClick={() => addTags(active, tagDraft)}>붙이기</button>
                  </div>
                  {!!lib.tags.length && (
                    <>
                      <div style={{ ...label, marginTop: 12 }}>이미 쓴 태그 — 눌러서 붙이거나 뗍니다</div>
                      <div className="flex gap-2 flex-wrap">
                        {lib.tags.map(t => (
                          <button key={t.tag} className="s-chip"
                            aria-pressed={(active.tags || []).includes(t.tag)}
                            onClick={() => toggleTag(active, t.tag)}>{t.tag} · {t.n}</button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* 볼트에서 가져오기 — 노트는 있는데 수집함에 없는 논문 */}
              {!!vaultOnly.length && (
                <div className="s-panel" style={{ padding: 18 }}>
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div style={{ fontSize: 15.5, fontWeight: 700 }}>
                      볼트에서 가져오기 — {vaultOnly.length}편
                    </div>
                    <button className="s-chip" onClick={loadVaultOnly}>다시 읽기</button>
                  </div>
                  <p style={{ fontSize: 14, color: 'var(--ink-2)', marginTop: 4, lineHeight: 1.75 }}>
                    노트는 이미 썼는데 수집함에 없어 ④ 리더로 열 수 없는 논문입니다.
                    가져와도 <strong>cite_key 는 그대로</strong> 쓰고 <strong>노트는 다시 쓰지 않습니다</strong> —
                    새로 칠한 발췌만 ⑤에서 노트 끝의 발췌 섹션에 반영합니다.
                  </p>
                  <div className="space-y-1 mt-3">
                    {vaultOnly.map(v => (
                      <label key={v.key} className="flex items-start gap-2 s-src" style={{ cursor: 'pointer' }}>
                        <input type="checkbox" style={{ marginTop: 4 }} checked={!!pickVault[v.key]}
                          onChange={() => setPickVault(p => ({ ...p, [v.key]: !p[v.key] }))} />
                        <div className="min-w-0">
                          <div style={{ fontSize: 14.5, fontWeight: 600 }}>
                            {v.key}
                            {v.has_pdf && <span className="s-badge" style={{ marginLeft: 6 }}>PDF</span>}
                            {v.title_from === 'heading' && (
                              <span className="s-chip" style={{ marginLeft: 6, fontSize: 11.5, cursor: 'default' }}
                                title="frontmatter 에 title 이 없어 노트 제목을 가져왔습니다">노트 제목</span>
                            )}
                          </div>
                          <div style={{ fontSize: 13.5, color: 'var(--ink-2)', marginTop: 2 }}>
                            {v.paper.title || '(제목 없음)'}
                          </div>
                          <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 2 }}>
                            {v.paper.authors || '저자 미명시'} · {v.paper.year || '연도 미명시'}
                            {v.paper.venue ? ` · ${v.paper.venue}` : ''} · {v.note_path}
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                  <div className="flex gap-2 items-center flex-wrap mt-3">
                    <button style={primary} disabled={busy || !Object.values(pickVault).some(Boolean)}
                      onClick={doImport}>
                      고른 논문 가져오기
                    </button>
                    <button className="s-chip"
                      onClick={() => setPickVault(Object.fromEntries(vaultOnly.map(v => [v.key, true])))}>
                      전부 고르기
                    </button>
                    <button className="s-chip" onClick={() => setPickVault({})}>고르기 해제</button>
                  </div>
                  <p className="s-interp" style={{ fontSize: 13.5, marginTop: 10 }}>
                    ※ <strong>노트 제목</strong> 표시가 붙은 것은 frontmatter 에 <code>title</code> 이 없어
                    본문 첫 제목을 가져온 것입니다 — 서지 제목이 아닙니다. 가져온 뒤 ⑦에서 DOI 로
                    Crossref 검증을 거치면 올바른 서지가 나옵니다.
                  </p>
                </div>
              )}

              {/* 중복 — 판정은 사람이 한다 */}
              {!!lib.duplicates.length && (
                <div className="s-panel" style={{ padding: 18 }}>
                  <div style={{ fontSize: 15.5, fontWeight: 700 }}>
                    중복으로 보이는 묶음 {lib.duplicates.length}건
                  </div>
                  <p style={{ fontSize: 14, color: 'var(--ink-2)', marginTop: 4, lineHeight: 1.75 }}>
                    DOI 나 제목이 같은 항목입니다. 어느 쪽을 남길지는 직접 고르세요 — 서지는 남긴 쪽 값을
                    그대로 두고 발췌·태그·컬렉션·링크만 합칩니다. 단계는 올리지 않습니다.
                  </p>
                  {lib.duplicates.map(g => (
                    <div key={g.on} className="s-src" style={{ marginTop: 10 }}>
                      <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>같은 값: {g.on}</div>
                      <div className="space-y-1 mt-2">
                        {g.keys.map(k => {
                          const row = items.find(x => x.key === k);
                          return (
                            <label key={k} className="flex items-center gap-2" style={{ fontSize: 14 }}>
                              <input type="radio" name={`keep-${g.on}`} checked={mergeKeep === k}
                                onChange={() => setMergeKeep(k)} />
                              <strong>{k}</strong>
                              <span style={{ color: 'var(--ink-3)' }}>
                                {row ? `${NUM[Math.min(Math.max(row.stage, 1), 7) - 1]} · 발췌 ${row.highlights.length}개` : ''}
                                {row?.note_path ? ' · 노트 있음' : ''}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                      <button className="s-chip mt-2" disabled={busy || !g.keys.includes(mergeKeep)}
                        onClick={() => doMerge(mergeKeep, g.keys.filter(k => k !== mergeKeep))}>
                        {g.keys.includes(mergeKeep) ? `${mergeKeep} 로 합치기` : '남길 쪽을 고르세요'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* ③ 원본 확보 */}
          {step === 3 && (
            <div className="s-panel" style={{ padding: 18 }}>
              <div style={{ fontSize: 16, fontWeight: 700 }}>원본 확보 — 첨부 보관 · BibTeX</div>
              {!active ? (
                <p style={{ fontSize: 15, color: 'var(--ink-3)', marginTop: 8 }}>②에서 논문을 먼저 고르세요.</p>
              ) : (
                <>
                  <p style={{ fontSize: 14.5, color: 'var(--ink-2)', marginTop: 4, lineHeight: 1.8 }}>
                    오픈액세스 PDF 를 <code>{settings?.pdf_dir}/{active.key}.pdf</code> 로 보관하고,
                    BibTeX 에 <code>{active.key}</code> 항목을 적립합니다.
                    이 파일이 ④ 리더가 읽는 원본이고, 노트의 <code>#page=</code> 앵커가 가리키는 대상입니다.
                    <br />유료 논문은 자동으로 못 가져옵니다 — 도서관 경유로 받아 아래에서 올리면 같은 이름으로 보관됩니다.
                  </p>
                  <div className="flex gap-2 items-center flex-wrap mt-3">
                    {([['pdf', 'PDF 원본'], ['bib', 'BibTeX']] as const).map(([k, lb]) => (
                      <button key={k} className="s-chip" aria-pressed={(channels as any)[k]}
                        onClick={() => setChannels({ ...channels, [k]: !(channels as any)[k] })}>{lb}</button>
                    ))}
                    <button style={primary} onClick={getOriginal} disabled={busy}>
                      {busy ? '가져오는 중' : '원본 가져오기'}
                    </button>
                  </div>
                  <Res r={active.original.pdf} />
                  <Res r={active.original.bib} />

                  {/* 직접 올리기 — 자동 수집이 못 가져오는 논문이 대부분이다 */}
                  <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px dashed var(--s-line)' }}>
                    <div style={{ fontSize: 15, fontWeight: 600 }}>직접 올리기</div>
                    <p style={{ fontSize: 14, color: 'var(--ink-2)', marginTop: 4, lineHeight: 1.7 }}>
                      내려받은 PDF 를 고르면 <code>{active.key}.pdf</code> 로 보관합니다.
                      파일 이름을 손으로 맞출 필요가 없습니다 — 틀리면 ④가 못 찾습니다.
                    </p>
                    <div className="flex gap-2 items-center flex-wrap mt-2">
                      <input type="file" accept="application/pdf" style={{ fontSize: 14 }}
                        onChange={e => {
                          const f = e.target.files?.[0];
                          e.target.value = '';
                          if (f) upload(f);
                        }} />
                      {attachOf(active)?.ok && (
                        <span className="s-badge">보관됨 · {Math.round((attachOf(active)!.bytes || 0) / 1024)} KB</span>
                      )}
                    </div>
                    {attachOf(active) && !attachOf(active)!.ok && (
                      <p style={{ fontSize: 13.5, color: 'var(--ink-3)', marginTop: 6 }}>
                        아직 보관된 PDF 가 없습니다.
                      </p>
                    )}
                  </div>

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
                    보관한 PDF 를 여기서 읽고 끌어서 칠합니다. 색마다 노트의 들어갈 자리가 정해져 있습니다.
                    칠한 쪽수가 같이 저장되어 <code>[[{active.key}.pdf#page=N]]</code> 앵커가 붙습니다 —
                    원문 대조가 클릭 한 번이 됩니다.
                  </p>

                  {attachOf(active)?.ok ? (
                    <div style={{ marginTop: 12 }}>
                      <PdfReader
                        src={apiUrl(`/scholar/pdf/${encodeURIComponent(active.key)}`)}
                        page={pdfPage} onPage={setPdfPage}
                        annots={active.highlights} rules={settings?.highlights || []}
                        onAdd={addAnnot} />
                    </div>
                  ) : (
                    <div className="s-src" style={{ borderStyle: 'dashed', marginTop: 12, fontSize: 14.5, lineHeight: 1.8 }}>
                      보관된 PDF 가 없어 리더를 띄울 수 없습니다 — ③에서 받거나 직접 올리면 여기서 바로 읽습니다.
                      <br />인쇄본으로 읽는 중이라면 아래 ‘손으로 넣기’ 로 발췌를 넣으세요. 쪽수를 적으면 앵커는 똑같이 붙습니다.
                    </div>
                  )}

                  {/* 손으로 넣기 — 리더로 못 읽는 원문(유료·인쇄본·스캔)용 */}
                  <details style={{ marginTop: 14 }}>
                    <summary style={{ fontSize: 14.5, cursor: 'pointer', color: 'var(--ink-2)' }}>
                      손으로 넣기 (리더로 못 읽는 원문)
                    </summary>
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
                  </details>

                  {/* 발췌 목록 — 고치기·지우기·쪽 이동은 여기서 한다 */}
                  <div className="space-y-2 mt-4">
                    {active.highlights.map((h, i) => (
                      <div key={h.id || i} style={{
                        padding: '9px 12px', borderRadius: 10, background: 'var(--s-bg)',
                        border: '1px solid var(--s-line)',
                        borderLeft: `5px solid ${h.color || rule(h.section)?.color || 'var(--s-line)'}`,
                      }}>
                        <div className="flex items-start justify-between gap-2">
                          <div style={{ fontSize: 14.5, lineHeight: 1.7, minWidth: 0 }}>
                            {h.section === 'unknown' ? '※ ' : '▸ '}{h.text}
                            {h.page && <span style={{ color: 'var(--ink-3)' }}> — p.{h.page}</span>}
                            <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 2 }}>
                              {rule(h.section)?.mean || h.section}
                              {(h.rects || []).length ? ' · 리더에서 칠함' : ' · 손으로 넣음'}
                            </div>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            {h.page && attachOf(active)?.ok && (
                              <button className="s-chip" title="그 쪽으로"
                                onClick={() => setPdfPage(Number(h.page) || 1)}>p.{h.page} ↗</button>
                            )}
                            <select className="s-chip" value={h.section} title="분류 바꾸기"
                              style={{ fontSize: 13 }}
                              onChange={e => {
                                const r = settings?.highlights.find(x => x.section === e.target.value);
                                patchAnnot(h, i, { section: e.target.value, color: r?.color || '' });
                              }}>
                              {settings?.highlights.map(x => (
                                <option key={x.section} value={x.section}>{x.mean}</option>
                              ))}
                            </select>
                            <button className="s-chip" style={{ color: 'var(--error)' }}
                              onClick={() => delAnnot(h, i)}>삭제</button>
                          </div>
                        </div>
                        {/* 내 메모 — ※ 로 간다. 원문(▸)과 섞이지 않게 따로 받는다 */}
                        <input style={{ ...input, fontSize: 13.5, marginTop: 8 }}
                          defaultValue={h.note || ''} placeholder="※ 내 메모 (원문이 아닌 내 판단)"
                          onBlur={e => {
                            if (e.target.value !== (h.note || '')) patchAnnot(h, i, { note: e.target.value });
                          }} />
                      </div>
                    ))}
                    {!active.highlights.length && (
                      <p style={{ fontSize: 14.5, color: 'var(--ink-3)' }}>
                        발췌가 없으면 노트의 수치·기여 칸은 <code>미명시</code> 로 남습니다 (날조하지 않기 위해서입니다).
                      </p>
                    )}
                  </div>

                  {/* ── 근거 Q&A — 내 색인으로 답한다 ── */}
                  <AskPanel
                    docId={(attachOf(active)?.path || '').split('/').pop()?.replace(/\.pdf$/i, '') || ''}
                    citeKey={active.key}
                    noteReady={!!active.note_path}
                    onJump={(_doc, page) => { setStep(4); setPdfPage(page); }} />

                  {/* ── NotebookLM — 오디오 개요 전용 ── */}
                  <div style={{ marginTop: 22, paddingTop: 16, borderTop: '1px dashed var(--s-line)' }}>
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div>
                        <div style={{ fontSize: 15.5, fontWeight: 700 }}>NotebookLM — 오디오 개요 (바깥 서비스)</div>
                        <p style={{ fontSize: 14, color: 'var(--ink-2)', marginTop: 3, lineHeight: 1.8 }}>
                          <strong>글로 묻는 것은 위 ‘근거 Q&amp;A’ 로 하세요</strong> — 색인도 모델도 이 기기 안에 있습니다.
                          여기는 그걸로 못 만드는 것, 즉 <strong>음성 합성이 필요한 오디오 개요</strong> 때문에 남겨 둡니다.
                          인포그래픽·마인드맵·리포트도 여기서 만들 수 있지만, 원문이 구글 서버로 올라갑니다.
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
                  {active.from_vault ? (
                    <p style={{ fontSize: 14.5, color: 'var(--ink-2)', marginTop: 4, lineHeight: 1.8 }}>
                      볼트에서 가져온 논문입니다 — <strong>기존 노트를 다시 쓰지 않습니다.</strong>
                      손으로 쓴 ▸/※ 는 그대로 두고, ④에서 칠한 발췌만 노트 끝의
                      <code> ## 🖍 리더에서 칠한 발췌</code> 섹션에 반영합니다.
                      여러 번 눌러도 그 섹션만 갈아 끼우므로 겹쳐 쌓이지 않습니다.
                    </p>
                  ) : (
                    <p style={{ fontSize: 14.5, color: 'var(--ink-2)', marginTop: 4, lineHeight: 1.8 }}>
                      frontmatter 전체 키 + ▸/※ 4개 섹션으로 만듭니다. 채우지 않은 값은
                      <code> 미명시</code> 로 남습니다 — 추측해 채우지 않습니다.
                    </p>
                  )}

                  {/* 축 필드 — 00_MOC.md 의 갭 표가 이 값들로 GROUP BY 한다.
                      비워 두면 그 표에서 전부 '미명시' 한 칸에 몰린다. */}
                  <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--s-line)' }}>
                    <div style={{ fontSize: 15, fontWeight: 600 }}>축 필드 — 갭 표의 집계 키</div>
                    <p style={{ fontSize: 13.5, color: 'var(--ink-3)', marginTop: 4, lineHeight: 1.7 }}>
                      <code>00_MOC.md</code> 의 「갭 확인」·「축별 분포」가 이 값들로 집계합니다.
                      <strong> 원문에서 확인한 것만 적으세요</strong> — 비워 두는 것이 추측보다 낫습니다.
                    </p>
                    <div style={{
                      display: 'grid', gap: 10, marginTop: 10,
                      gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))',
                    }}>
                      {AXIS.map(a => {
                        const id = `axis-${String(a.f)}`;
                        const val = axis[a.f as string] ?? '';
                        const set = (v: string) => setAxis(x => ({ ...x, [a.f as string]: v }));
                        return (
                          <div key={String(a.f)}>
                            <label style={label} htmlFor={id}>{a.label}</label>
                            {a.kind === 'bool' ? (
                              <select id={id} style={input} value={val} onChange={e => set(e.target.value)}>
                                <option value="">미명시</option>
                                <option value="true">포함</option>
                                <option value="false">미포함</option>
                              </select>
                            ) : a.opts ? (
                              <select id={id} style={input} value={val} onChange={e => set(e.target.value)}>
                                <option value="">미명시</option>
                                {a.opts.map(o => <option key={o} value={o}>{o}</option>)}
                              </select>
                            ) : (
                              <input id={id} style={input} value={val} placeholder={a.ph || ''}
                                inputMode={a.kind === 'num' ? 'numeric' : undefined}
                                onChange={e => set(e.target.value)} />
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex gap-2 items-center flex-wrap mt-3">
                      <button className="s-chip" onClick={saveAxis} disabled={busy}>축 필드 저장 + 미리보기</button>
                      <span style={{ fontSize: 13, color: 'var(--ink-3)' }}>
                        쉼표로 여러 값 (제어 방식 · 해석 방법 · 하드웨어)
                      </span>
                    </div>
                  </div>
                  {active.from_vault ? (
                    <div className="flex gap-2 items-center flex-wrap mt-3">
                      <button style={primary} onClick={appendNote} disabled={busy}>
                        발췌를 기존 노트에 반영
                      </button>
                      <span style={{ fontSize: 13.5, color: 'var(--ink-3)' }}>
                        대상: <code>{active.note_path}</code> · 발췌 {active.highlights.length}개
                      </span>
                    </div>
                  ) : (
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
                  )}

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

        {/* ══ 오른쪽: 라이브러리 + 수집함 ══ */}
        <aside className="col-span-12 lg:col-span-4 space-y-2">

          {/* 라이브러리 — 컬렉션 · 태그 · 저장한 검색 */}
          <div className="s-panel" style={{ padding: 14 }}>
            <div className="flex items-center justify-between gap-2">
              <div style={{ fontSize: 15, fontWeight: 700 }}>라이브러리</div>
              {filterOn && (
                <button className="s-chip" style={{ fontSize: 12.5 }}
                  onClick={() => setFilter({
                    q: '', tags: [], collection: '', stage_min: 0,
                    has_pdf: false, untagged: false, starred: false,
                  })}>조건 지우기</button>
              )}
            </div>

            <input style={{ ...input, marginTop: 8, fontSize: 14 }} value={filter.q}
              placeholder="제목 · 저자 · 키 · 태그 안에서 찾기"
              onChange={e => setFilter({ ...filter, q: e.target.value })} />

            <div style={{ ...label, marginTop: 10 }}>컬렉션</div>
            <div className="flex gap-1 flex-wrap">
              <button className="s-chip" style={{ fontSize: 12.5 }} aria-pressed={!filter.collection}
                onClick={() => setFilter({ ...filter, collection: '' })}>전체 {items.length}</button>
              {lib.collections.map(c => {
                const n = items.filter(it => (it.collections || []).includes(c.id)).length;
                return (
                  <span key={c.id} className="flex items-center" style={{ gap: 2 }}>
                    <button className="s-chip" style={{ fontSize: 12.5 }}
                      aria-pressed={filter.collection === c.id}
                      onClick={() => setFilter({
                        ...filter, collection: filter.collection === c.id ? '' : c.id,
                      })}>{c.name} {n}</button>
                    <button className="s-chip" title="컬렉션 지우기 (논문은 남습니다)"
                      style={{ fontSize: 11, padding: '2px 5px', color: 'var(--error)' }}
                      onClick={() => delCol(c.id)}>✕</button>
                  </span>
                );
              })}
            </div>
            <div className="flex gap-1 mt-2">
              <input style={{ ...input, fontSize: 13.5, padding: '6px 9px' }} value={newCol}
                placeholder="새 컬렉션 이름"
                onChange={e => setNewCol(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); makeCol(); } }} />
              <button className="s-chip" style={{ fontSize: 12.5 }} onClick={makeCol}>＋</button>
            </div>

            <div style={{ ...label, marginTop: 12 }}>태그 — 여러 개를 고르면 모두 가진 것만</div>
            <div className="flex gap-1 flex-wrap">
              {lib.tags.map(t => (
                <button key={t.tag} className="s-chip" style={{ fontSize: 12.5 }}
                  aria-pressed={filter.tags.includes(t.tag)}
                  onClick={() => setFilter({
                    ...filter,
                    tags: filter.tags.includes(t.tag)
                      ? filter.tags.filter(x => x !== t.tag) : [...filter.tags, t.tag],
                  })}>{t.tag} {t.n}</button>
              ))}
              {!lib.tags.length && (
                <span style={{ fontSize: 13, color: 'var(--ink-3)' }}>
                  아직 태그가 없습니다 — ②에서 논문을 고르고 붙이세요.
                </span>
              )}
            </div>

            <div style={{ ...label, marginTop: 12 }}>조건</div>
            <div className="flex gap-1 flex-wrap">
              <button className="s-chip" style={{ fontSize: 12.5 }} aria-pressed={filter.starred}
                onClick={() => setFilter({ ...filter, starred: !filter.starred })}>★ 별표만</button>
              <button className="s-chip" style={{ fontSize: 12.5 }} aria-pressed={filter.has_pdf}
                onClick={() => setFilter({ ...filter, has_pdf: !filter.has_pdf })}>원문 있음</button>
              <button className="s-chip" style={{ fontSize: 12.5 }} aria-pressed={filter.untagged}
                onClick={() => setFilter({ ...filter, untagged: !filter.untagged })}>태그 없음</button>
              <select className="s-chip" style={{ fontSize: 12.5 }} value={filter.stage_min}
                onChange={e => setFilter({ ...filter, stage_min: +e.target.value })}>
                <option value={0}>단계 무관</option>
                {NUM.map((n, i) => <option key={i} value={i + 1}>{n} 이상</option>)}
              </select>
            </div>

            <div style={{ ...label, marginTop: 12 }}>저장한 검색 — 조건만 남습니다</div>
            <div className="flex gap-1 flex-wrap">
              {lib.saved.map(sv => (
                <span key={sv.id} className="flex items-center" style={{ gap: 2 }}>
                  <button className="s-chip" style={{ fontSize: 12.5 }}
                    onClick={() => applySaved(sv)}>{sv.name}</button>
                  <button className="s-chip" title="지우기"
                    style={{ fontSize: 11, padding: '2px 5px', color: 'var(--error)' }}
                    onClick={() => delSaved(sv.id)}>✕</button>
                </span>
              ))}
              {!lib.saved.length && (
                <span style={{ fontSize: 13, color: 'var(--ink-3)' }}>없습니다.</span>
              )}
            </div>
            <div className="flex gap-1 mt-2">
              <input style={{ ...input, fontSize: 13.5, padding: '6px 9px' }} value={savedName}
                placeholder="지금 조건을 이 이름으로 저장"
                onChange={e => setSavedName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); saveSearch(); } }} />
              <button className="s-chip" style={{ fontSize: 12.5 }} disabled={!filterOn}
                title={filterOn ? '' : '걸러 볼 조건이 없습니다'} onClick={saveSearch}>저장</button>
            </div>
          </div>

          {/* 수집함 */}
          <div className="flex items-center justify-between">
            <div style={{ fontSize: 15, fontWeight: 700 }}>
              수집함 {filterOn ? `${shown.length} / ${items.length}` : items.length}
            </div>
            <span style={{ fontSize: 13, color: 'var(--ink-3)' }}>단계는 논문마다 따로 갑니다</span>
          </div>
          {shown.map(it => (
            <button key={it.key} className="s-src w-full text-left" data-hot={it.key === activeKey}
              onClick={() => setActiveKey(it.key)}>
              <div className="flex items-center gap-1">
                {it.starred && <span style={{ fontSize: 13 }}>★</span>}
                <div style={{ fontSize: 14.5, fontWeight: 600 }}>{it.key}</div>
                {attachments[it.key]?.ok && <span className="s-badge" style={{ marginLeft: 4 }}>PDF</span>}
              </div>
              <div style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 3, lineHeight: 1.5 }}>
                {it.paper.title.slice(0, 80)}{it.paper.title.length > 80 ? '…' : ''}
              </div>
              {!!(it.tags || []).length && (
                <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 3 }}>
                  {(it.tags || []).join(' · ')}
                </div>
              )}
              {!!(it.collections || []).length && (
                <div style={{ fontSize: 12, color: 'var(--s-accent-ink)', marginTop: 2 }}>
                  {(it.collections || []).map(colName).join(' · ')}
                </div>
              )}
              <div className="flex gap-1 mt-2" style={{ fontSize: 12 }}>
                {NUM.map((n, i) => (
                  <span key={i} title={stages[i]?.title} style={{
                    color: it.stage >= i + 1 ? 'var(--s-ok)' : 'var(--ink-3)',
                    opacity: it.stage >= i + 1 ? 1 : .45,
                  }}>{n}</span>
                ))}
                {!!it.highlights.length && (
                  <span className="s-badge" style={{ marginLeft: 6 }}>발췌 {it.highlights.length}</span>
                )}
                {it.note_path && <span className="s-badge">노트</span>}
                {it.cited && <span className="s-badge">인용</span>}
              </div>
            </button>
          ))}
          {!items.length && (
            <div className="s-src" style={{ borderStyle: 'dashed', fontSize: 14, color: 'var(--ink-3)', lineHeight: 1.8 }}>
              비어 있습니다. ①에서 검색하거나 DOI 를 붙여 넣어 ‘담기’ 를 누르면 여기 쌓이고, 창을 닫아도 남습니다
              (<code>Server/scholar_inbox.json</code>).
            </div>
          )}
          {!!items.length && !shown.length && (
            <div className="s-src" style={{ borderStyle: 'dashed', fontSize: 14, color: 'var(--ink-3)', lineHeight: 1.8 }}>
              걸러 보기 조건에 맞는 논문이 없습니다 — 위에서 ‘조건 지우기’.
            </div>
          )}
        </aside>
      </div>
    </>
  );
}
