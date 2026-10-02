/*
  web/src/pages/Docs.tsx — 내 논문 (드라이브처럼 모으고, Docs 처럼 쓴다)

    두 화면이 한 파일에 있다.
      ① 서랍  — 문서 목록. 폴더·검색·정렬·사본·휴지통·복구·완전삭제.
      ② 문서  — 편집기. 서식 도구 · 댓글 · 판 기록 · 내보내기.

    저장본은 .md 가 아니라 문서 구조(JSON)다. 그래서 **내보내기를 눈에 띄는 자리에
    둔다** — 이 저장소 밖으로 나가는 유일한 문이고, 없으면 글이 갇힌다.

    에이전트 초안은 '쓴 사람' 을 숨기지 않는다. 목록에도 문서 머리에도 누가 썼고
    무엇을 읽었는지 적힌다. 재료에 없던 인용은 ⚠ 로 바뀌어 들어온다.
*/
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableHeader from '@tiptap/extension-table-header';
import TableCell from '@tiptap/extension-table-cell';
import Link from '@tiptap/extension-link';
import { apiUrl, delJSON, fetchJSON, postJSON, putJSON } from '../lib/api';

interface Row {
  id: string; title: string; folder: string; trashed: boolean;
  created: string; updated: string; words: number; version: number;
  comments: number; by: string; sources: number;
}
interface Comment {
  id: string; body: string; quote: string; by: string; kind: string;
  resolved: boolean; created: string; replies: { id: string; body: string; by: string; created: string }[];
}
interface Version { v: number; at: string; by: string; label: string; words: number }
interface Doc extends Row {
  doc: any; comments_list?: Comment[];
  origin: { by: string; model: string; sources: { kind: string; path: string }[]; notes?: string[] };
}
interface SrcFile { kind: string; path: string; title: string; cite_key?: string; claims?: number }
interface Section { id: string; title: string }
interface Hit { id: string; doc: string; title: string; page: number | null; sim: number; text: string }
interface Clip {
  id: string; cite_key: string; doc: string; page: string; text: string; note: string;
  section: string; kind: string; used: boolean;
}

const AUTOSAVE = 2000;
const SORTS = [
  { k: 'updated', label: '고친 날' },
  { k: 'title', label: '이름' },
  { k: 'words', label: '분량' },
] as const;

function when(s: string): string {
  if (!s) return '';
  const d = new Date(s);
  if (Number.isNaN(+d)) return s.slice(0, 16).replace('T', ' ');
  const mins = Math.round((Date.now() - +d) / 60000);
  if (mins < 1) return '방금';
  if (mins < 60) return `${mins}분 전`;
  if (mins < 60 * 24) return `${Math.round(mins / 60)}시간 전`;
  return s.slice(0, 10);
}

export default function Docs() {
  const [rows, setRows] = useState<Row[]>([]);
  const [folders, setFolders] = useState<string[]>([]);
  const [trashCount, setTrashCount] = useState(0);
  const [bin, setBin] = useState(false);              // 휴지통 보기
  const [folder, setFolder] = useState('');           // '' = 전부
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<typeof SORTS[number]['k']>('updated');
  const [open, setOpen] = useState<Doc | null>(null);

  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const flash = (m: string) => { setMsg(m); window.setTimeout(() => setMsg(''), 4000); };
  const fail = (e: any) => setErr(String(e?.message || e).replace(/^HTTP \d+: /, '').slice(0, 300));

  const load = useCallback(() => fetchJSON(`/docs?trashed=${bin ? 1 : 0}`)
    .then(d => { setRows(d.docs || []); setFolders(d.folders || []); setTrashCount(d.trash || 0); })
    .catch(fail), [bin]);

  useEffect(() => { load(); }, [load]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows
      .filter(r => (!folder || r.folder === folder))
      .filter(r => !needle || r.title.toLowerCase().includes(needle))
      .sort((a, b) => sort === 'title' ? a.title.localeCompare(b.title)
        : sort === 'words' ? b.words - a.words
          : (b.updated || '').localeCompare(a.updated || ''));
  }, [rows, folder, q, sort]);

  const openDoc = (id: string) => fetchJSON(`/docs/${id}`)
    .then(d => setOpen({ ...d, comments_list: d.comments || [] })).catch(fail);

  if (open) {
    return <DocEditor doc={open} onBack={() => { setOpen(null); load(); }}
      onFail={fail} onFlash={flash} />;
  }

  return (
    <div className="scholar max-w-[1600px] mx-auto px-10 py-8 space-y-3">
      <Head />
      {err && <div className="s-error" style={{ margin: '10px 0' }}>{err}
        <button className="s-chip-sm" style={{ marginLeft: 8 }} onClick={() => setErr('')}>닫기</button></div>}
      {msg && <div className="s-ok-soft" style={{ margin: '10px 0', padding: 9, borderRadius: 8 }}>{msg}</div>}

      <DraftPanel onDone={(id) => { load(); if (id) openDoc(id); }} onFail={fail} onFlash={flash} />

      {/* ── 고르개 줄 ── */}
      <div className="s-panel" style={{ padding: 12, marginTop: 14 }}>
        <div className="flex items-center gap-2 flex-wrap">
          <button className={bin ? 's-chip' : 's-btn'} onClick={() => setBin(false)}>내 문서</button>
          <button className={bin ? 's-btn' : 's-chip'} onClick={() => setBin(true)}>
            휴지통{trashCount ? ` ${trashCount}` : ''}
          </button>
          <span style={{ width: 1, height: 22, background: 'var(--s-line)' }} />
          <button className={folder ? 's-chip-sm' : 's-chip'} onClick={() => setFolder('')}>전체</button>
          {folders.map(f => (
            <button key={f} className={folder === f ? 's-chip' : 's-chip-sm'}
              onClick={() => setFolder(f)}>{f}</button>
          ))}
          <span style={{ flex: 1 }} />
          <input className="s-input" style={{ width: 200 }} placeholder="제목으로 찾기"
            value={q} onChange={e => setQ(e.target.value)} />
          <select className="s-input" value={sort} onChange={e => setSort(e.target.value as any)}>
            {SORTS.map(s => <option key={s.k} value={s.k}>{s.label}순</option>)}
          </select>
          {!bin && <NewDoc onDone={load} onFail={fail} />}
        </div>
      </div>

      {/* ── 목록 ── */}
      <div className="s-panel" style={{ padding: 0, marginTop: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ background: 'var(--s-bg)' }}>
              {['이름', '쓴 사람', '분량', '댓글', '판', '고친 날', ''].map((h, i) => (
                <th key={i} style={{ textAlign: i >= 2 && i <= 4 ? 'right' : 'left',
                  padding: '9px 12px', fontWeight: 600, color: 'var(--ink-2)',
                  borderBottom: '1px solid var(--s-line)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map(r => (
              <tr key={r.id} className="s-card-hover" style={{ borderBottom: '1px solid var(--s-line)' }}>
                <td style={{ padding: '10px 12px' }}>
                  <button className="text-left" style={{ fontWeight: 600 }}
                    onClick={() => openDoc(r.id)}>{r.title}</button>
                  {r.folder && <span className="s-badge" style={{ marginLeft: 8 }}>{r.folder}</span>}
                </td>
                <td style={{ padding: '10px 12px', color: 'var(--ink-2)' }}>
                  {r.by === 'agent'
                    ? <span className="s-badge" title={`읽은 자료 ${r.sources}건`}>에이전트 · 자료 {r.sources}</span>
                    : '나'}
                </td>
                <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--ink-2)' }}>
                  {r.words.toLocaleString()}자</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--ink-2)' }}>
                  {r.comments || ''}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--ink-3)' }}>
                  v{r.version}</td>
                <td style={{ padding: '10px 12px', color: 'var(--ink-2)' }}>{when(r.updated)}</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <RowActions row={r} bin={bin} onDone={load} onFail={fail} onFlash={flash} />
                </td>
              </tr>
            ))}
            {!shown.length && (
              <tr><td colSpan={7} style={{ padding: 24, color: 'var(--ink-3)', textAlign: 'center' }}>
                {bin ? '휴지통이 비었습니다.'
                  : '문서가 없습니다 — 위에서 새로 만들거나, 에이전트에게 초안을 맡기세요.'}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Head() {
  return (
    <div className="s-panel" style={{ padding: 14 }}>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>내 논문</div>
      <div style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.8 }}>
        에이전트가 <b>연구일지와 선행논문 노트를 읽고</b> 초안을 씁니다. 그 뒤로는 여기서
        고치고 댓글을 달고 판을 되돌립니다.<br />
        저장본은 마크다운이 아니라 문서 구조입니다 — Obsidian·Pandoc 으로 보내려면
        문서를 열고 <b>내보내기</b>를 쓰세요.
      </div>
    </div>
  );
}

/* ── 새 문서 ── */
function NewDoc({ onDone, onFail }: { onDone: () => void; onFail: (e: any) => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <button className="s-btn" disabled={busy} onClick={() => {
      const t = window.prompt('새 문서 이름');
      if (!t) return;
      setBusy(true);
      postJSON('/docs', { title: t }).then(onDone).catch(onFail).finally(() => setBusy(false));
    }}>＋ 새 문서</button>
  );
}

/* ── 줄별 동작 ── */
function RowActions({ row, bin, onDone, onFail, onFlash }: {
  row: Row; bin: boolean; onDone: () => void; onFail: (e: any) => void; onFlash: (m: string) => void;
}) {
  const go = (p: Promise<any>, m: string) => p.then(() => { onFlash(m); onDone(); }).catch(onFail);
  if (bin) {
    return (
      <>
        <button className="s-chip-sm" onClick={() => go(postJSON(`/docs/${row.id}/restore`, {}), '되살렸습니다')}>
          되살리기</button>
        <button className="s-chip-danger" style={{ marginLeft: 6 }} onClick={() => {
          if (!window.confirm(`"${row.title}" 과 모든 판을 영영 지웁니다. 되돌릴 수 없습니다.`)) return;
          go(delJSON(`/docs/${row.id}?hard=1`), '지웠습니다');
        }}>완전 삭제</button>
      </>
    );
  }
  return (
    <>
      <button className="s-chip-sm" onClick={() => {
        const t = window.prompt('새 이름', row.title);
        if (t && t !== row.title) go(putJSON(`/docs/${row.id}`, { title: t }), '이름을 바꿨습니다');
      }}>이름</button>
      <button className="s-chip-sm" style={{ marginLeft: 6 }} onClick={() => {
        const f = window.prompt('폴더 이름 (비우면 최상위)', row.folder);
        if (f !== null) go(putJSON(`/docs/${row.id}`, { folder: f }), '옮겼습니다');
      }}>폴더</button>
      <button className="s-chip-sm" style={{ marginLeft: 6 }}
        onClick={() => go(postJSON(`/docs/${row.id}/duplicate`, {}), '사본을 만들었습니다')}>사본</button>
      <button className="s-chip-sm" style={{ marginLeft: 6 }}
        onClick={() => go(delJSON(`/docs/${row.id}`), '휴지통으로 보냈습니다 — 되살릴 수 있습니다')}>
        휴지통</button>
    </>
  );
}

/* ═══════════════════════════════════════════════
   에이전트 초안 — 무엇을 읽을지 사람이 고른다
   ═══════════════════════════════════════════════ */
function DraftPanel({ onDone, onFail, onFlash }: {
  onDone: (id: string) => void; onFail: (e: any) => void; onFlash: (m: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [src, setSrc] = useState<{ journals: SrcFile[]; literature: SrcFile[]; clips: number; sections: Section[] } | null>(null);
  const [pickJ, setPickJ] = useState<Record<string, boolean>>({});
  const [pickL, setPickL] = useState<Record<string, boolean>>({});
  const [pickS, setPickS] = useState<Record<string, boolean>>({});
  const [title, setTitle] = useState('');
  const [job, setJob] = useState<any>(null);
  const [eng, setEng] = useState<any>(null);
  const [engine, setEngine] = useState('local');
  const poll = useRef<number | null>(null);

  useEffect(() => {
    if (!open || src) return;
    fetchJSON('/docs/draft/sources').then(d => {
      setSrc(d);
      setPickS(Object.fromEntries((d.sections || [])
        .filter((s: Section) => s.id !== '?').map((s: Section) => [s.id, true])));
    }).catch(onFail);
    /* 엔진 상태는 /doc/actions 가 들고 있다 (llm.status). 두 곳에서 묻지 않는다. */
    fetchJSON('/doc/actions')
      .then(d => { setEng(d.engines); setEngine(d.engines?.default === 'claude' ? 'claude' : 'local'); })
      .catch(() => {});
  }, [open, src, onFail]);

  const tick = useCallback(() => {
    fetchJSON('/docs/draft/status').then(d => {
      setJob(d.job);
      if (!d.job.running) {
        if (poll.current) { window.clearInterval(poll.current); poll.current = null; }
        if (d.job.doc_id) { onFlash('초안을 만들었습니다'); onDone(d.job.doc_id); }
        else if (d.job.error) onFail(new Error(d.job.error));
        /* 끝났다는데 문서도 없고 오류도 없으면 작업이 통째로 사라진 것이다 (서버 재시작).
           조용히 넘어가면 '다 됐나 보다' 하고 기다리게 된다. */
        else onFail(new Error('초안 작업이 사라졌습니다 — 서버가 다시 시작된 것 같습니다. '
          + '다시 눌러 주세요. (만들어진 문서는 없습니다)'));
      }
    }).catch(() => {});
  }, [onDone, onFail, onFlash]);

  useEffect(() => () => { if (poll.current) window.clearInterval(poll.current); }, []);

  /* 화면을 떠났다 돌아와도 돌고 있는 작업을 알아본다 — 모르면 '안 돌고 있나' 싶어
     한 번 더 눌러 같은 초안을 두 번 쓰게 된다. */
  useEffect(() => {
    fetchJSON('/docs/draft/status').then(d => {
      if (!d.job?.running) return;
      setOpen(true);
      setJob(d.job);
      if (!poll.current) poll.current = window.setInterval(tick, 3000);
    }).catch(() => {});
  }, [tick]);

  const run = () => {
    const body = {
      title: title.trim() || '논문 초안',
      journals: Object.entries(pickJ).filter(([, v]) => v).map(([k]) => k),
      literature: Object.entries(pickL).filter(([, v]) => v).map(([k]) => k),
      sections: Object.entries(pickS).filter(([, v]) => v).map(([k]) => k),
      engine,
    };
    postJSON('/docs/draft', body).then(d => {
      setJob(d.job);
      onFlash(d.note);
      poll.current = window.setInterval(tick, 3000);
    }).catch(onFail);
  };

  const nJ = Object.values(pickJ).filter(Boolean).length;
  const nL = Object.values(pickL).filter(Boolean).length;
  const nS = Object.values(pickS).filter(Boolean).length;

  if (!open) {
    return (
      <div style={{ marginTop: 12 }}>
        <button className="s-btn" onClick={() => setOpen(true)}>✍ 에이전트에게 초안 맡기기</button>
        <span style={{ marginLeft: 10, fontSize: 13, color: 'var(--ink-3)' }}>
          연구일지와 선행논문 노트를 읽고 절별로 씁니다.
        </span>
      </div>
    );
  }

  return (
    <div className="s-panel" style={{ padding: 14, marginTop: 12 }}>
      <div className="flex items-center justify-between">
        <div style={{ fontWeight: 700 }}>에이전트 초안</div>
        <button className="s-chip-sm" onClick={() => setOpen(false)}>접기</button>
      </div>
      <div style={{ fontSize: 13, color: 'var(--ink-2)', margin: '6px 0 12px', lineHeight: 1.8 }}>
        고른 것만 읽습니다. 색인 전체를 넣지 않는 이유는 모델이 <b>읽지도 않은 논문을
        인용하기</b> 때문입니다. 재료에 없던 인용이 나오면 ⚠ 로 바꿔 넣고 문서에 적어 둡니다.
        {eng && (
          <><br />지금 엔진: <b>{engine === 'local' ? `로컬 ${eng.local?.model || ''}` : 'Claude'}</b>
            {engine === 'local' ? ' — 원문이 이 기기를 벗어나지 않습니다. 절당 1~4분.'
              : ` — ${eng.remote_warning || '고른 대목이 밖으로 전송됩니다'}.`}
            <button className="s-chip-sm" style={{ marginLeft: 8 }}
              onClick={() => setEngine(engine === 'local' ? 'claude' : 'local')}>
              {engine === 'local' ? 'Claude 로 바꾸기' : '로컬로 바꾸기'}</button>
          </>
        )}
      </div>

      {job?.running ? (
        <div className="s-ok-soft" style={{ padding: 10, borderRadius: 8 }}>
          쓰는 중 — {job.section || '준비'} ({job.done}/{job.total} 절).
          화면을 떠나도 계속 씁니다.
          {(job.notes || []).map((n: string, i: number) => (
            <div key={i} style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 4 }}>※ {n}</div>
          ))}
        </div>
      ) : (
        <>
          <input className="s-input" style={{ width: '100%', marginBottom: 10 }}
            placeholder="논문 제목 (예: PSO 기반 2단 PV GFM 인버터의 소신호 안정도)"
            value={title} onChange={e => setTitle(e.target.value)} />
          <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Picker label={`연구일지 ${nJ}`} hint="실험 수치. 표는 모델을 거치지 않고 그대로 옮깁니다."
              files={src?.journals || []} pick={pickJ} setPick={setPickJ} />
            <Picker label={`선행논문 노트 ${nL}`} hint="▸ 로 적힌 '논문이 말한 것' 만 재료로 씁니다."
              files={src?.literature || []} pick={pickL} setPick={setPickL} />
          </div>
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>쓸 절 {nS}</div>
            <div className="flex gap-2 flex-wrap">
              {(src?.sections || []).filter(s => s.id !== '?').map(s => (
                <button key={s.id} className={pickS[s.id] ? 's-chip' : 's-chip-sm'}
                  onClick={() => setPickS(p => ({ ...p, [s.id]: !p[s.id] }))}>
                  {s.id}. {s.title}</button>
              ))}
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <button className="s-btn" disabled={(!nJ && !nL && !(src?.clips)) || !nS} onClick={run}>
              초안 쓰기 시작 — 대략 {nS * (engine === 'local' ? 8 : 1)}분
            </button>
            {!nJ && !nL && !(src?.clips) ? (
              <span style={{ marginLeft: 10, fontSize: 13, color: 'var(--ink-3)' }}>
                읽을 재료를 하나 이상 고르세요.</span>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}

function Picker({ label, hint, files, pick, setPick }: {
  label: string; hint: string; files: SrcFile[];
  pick: Record<string, boolean>; setPick: (f: (p: Record<string, boolean>) => Record<string, boolean>) => void;
}) {
  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 12, color: 'var(--ink-3)', margin: '2px 0 6px' }}>{hint}</div>
      <div style={{ maxHeight: 190, overflowY: 'auto', border: '1px solid var(--s-line)',
        borderRadius: 8, padding: 6 }}>
        {files.map(f => (
          <label key={f.path} className="flex items-start gap-2"
            style={{ padding: '4px 4px', fontSize: 13, cursor: 'pointer' }}>
            <input type="checkbox" checked={!!pick[f.path]} style={{ marginTop: 3 }}
              onChange={() => setPick(p => ({ ...p, [f.path]: !p[f.path] }))} />
            <span>
              {f.title}
              {typeof f.claims === 'number' && (
                <span style={{ color: f.claims ? 'var(--ink-3)' : 'var(--s-danger)', marginLeft: 6 }}>
                  ▸ {f.claims}</span>
              )}
            </span>
          </label>
        ))}
        {!files.length && <div style={{ color: 'var(--ink-3)', fontSize: 13, padding: 6 }}>없습니다.</div>}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   ② 문서 — Docs 처럼 쓴다
   ═══════════════════════════════════════════════ */
function DocEditor({ doc, onBack, onFail, onFlash }: {
  doc: Doc; onBack: () => void; onFail: (e: any) => void; onFlash: (m: string) => void;
}) {
  const [title, setTitle] = useState(doc.title);
  const [version, setVersion] = useState(doc.version);
  const [words, setWords] = useState(doc.words);
  const [dirty, setDirty] = useState(false);
  const [savedAt, setSavedAt] = useState('');
  const [conflict, setConflict] = useState('');
  const [comments, setComments] = useState<Comment[]>(doc.comments_list || []);
  const [versions, setVersions] = useState<Version[]>((doc as any).versions || []);
  const [sel, setSel] = useState('');
  const [cmBody, setCmBody] = useState('');
  const [pane, setPane] = useState<'comments' | 'cite' | 'versions' | 'origin'>('comments');
  const [reviewing, setReviewing] = useState(false);
  /* 인용 — 고른 문장을 색인에 물어 뒷받침할 대목을 찾는다. 못 찾으면 못 찾았다고 쓴다. */
  const [evid, setEvid] = useState<{ hits: Hit[]; note: string; enough: boolean } | null>(null);
  const [clips, setClips] = useState<Clip[]>([]);
  const [finding, setFinding] = useState(false);
  const timer = useRef<number | null>(null);
  const vRef = useRef(doc.version);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3, 4] } }),
      Table.configure({ resizable: true }), TableRow, TableHeader, TableCell,
      Link.configure({ openOnClick: false }),
      Placeholder.configure({ placeholder: '여기에 씁니다.' }),
    ],
    content: doc.doc,
    editorProps: { attributes: { class: 'dd-doc' } },
    onUpdate: () => { setDirty(true); schedule(); },
    onSelectionUpdate: ({ editor: ed }) => {
      const { from, to } = ed.state.selection;
      setSel(from === to ? '' : ed.state.doc.textBetween(from, to, ' ').trim());
    },
  });

  const save = useCallback((label = '') => {
    if (!editor) return;
    putJSON(`/docs/${doc.id}`, {
      doc: editor.getJSON(), base_version: vRef.current, label, title,
    }).then(d => {
      vRef.current = d.version; setVersion(d.version); setWords(d.words);
      setDirty(false); setConflict('');
      setSavedAt(new Date().toLocaleTimeString('ko-KR'));
    }).catch(e => {
      if (String(e.message).includes('409')) {
        setConflict('다른 곳에서 먼저 저장했습니다. 이 화면 내용을 복사해 두고 다시 여세요 — '
          + '덮어쓰지 않았습니다.');
      } else onFail(e);
    });
  }, [editor, doc.id, title, onFail]);

  const schedule = useCallback(() => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => save(), AUTOSAVE);
  }, [save]);

  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);

  const reloadComments = () => fetchJSON(`/docs/${doc.id}/comments`)
    .then(d => setComments(d.comments || [])).catch(onFail);
  const reloadVersions = () => fetchJSON(`/docs/${doc.id}/versions`)
    .then(d => setVersions(d.versions || [])).catch(onFail);

  const exportMd = () => fetchJSON(`/docs/${doc.id}/markdown`).then(d => {
    const blob = new Blob([d.markdown], { type: 'text/markdown;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${d.title || '문서'}.md`;
    a.click();
    URL.revokeObjectURL(a.href);
    onFlash('마크다운으로 내려받았습니다 — Obsidian·Pandoc 이 그대로 읽습니다');
  }).catch(onFail);

  const B = ({ on, children, act, title: t }: any) => (
    <button className={on ? 's-chip' : 's-chip-sm'} title={t} onClick={act}>{children}</button>
  );

  return (
    <div className="scholar max-w-[1600px] mx-auto px-10 py-8 space-y-3">
      <style>{`
        .dd-doc { outline: none; min-height: 60vh; font-size: 16px; line-height: 1.95; color: var(--ink); }
        .dd-doc h1 { font-size: 26px; font-weight: 700; margin: 22px 0 10px; }
        .dd-doc h2 { font-size: 21px; font-weight: 700; margin: 20px 0 8px; }
        .dd-doc h3 { font-size: 17px; font-weight: 600; margin: 16px 0 6px; }
        .dd-doc p { margin: 9px 0; }
        .dd-doc ul, .dd-doc ol { margin: 9px 0; padding-left: 22px; }
        .dd-doc code { font-size: 14px; padding: 1px 5px; border-radius: 5px;
          background: var(--s-bg); border: 1px solid var(--s-line); }
        .dd-doc pre { padding: 11px; border-radius: 9px; background: var(--s-bg);
          border: 1px solid var(--s-line); overflow-x: auto; }
        .dd-doc blockquote { border-left: 3px solid var(--s-line); padding-left: 12px;
          color: var(--ink-2); margin: 10px 0; }
        .dd-doc table { border-collapse: collapse; margin: 12px 0; width: 100%;
          table-layout: fixed; font-size: 14px; }
        .dd-doc th, .dd-doc td { border: 1px solid var(--s-line); padding: 6px 9px;
          vertical-align: top; text-align: left; position: relative; }
        .dd-doc th { background: var(--s-bg); font-weight: 600; }
        .dd-doc p.is-editor-empty:first-child::before { content: attr(data-placeholder);
          color: var(--ink-3); float: left; height: 0; pointer-events: none; }
      `}</style>

      {/* 머리 */}
      <div className="s-panel" style={{ padding: 12 }}>
        <div className="flex items-center gap-2 flex-wrap">
          <button className="s-chip-sm" onClick={() => { if (dirty) save(); onBack(); }}>‹ 서랍으로</button>
          <input className="s-input" style={{ flex: 1, minWidth: 220, fontWeight: 700, fontSize: 16 }}
            value={title} onChange={e => { setTitle(e.target.value); setDirty(true); }}
            onBlur={() => putJSON(`/docs/${doc.id}`, { title }).then(() => onFlash('이름을 바꿨습니다')).catch(onFail)} />
          <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>
            v{version} · {words.toLocaleString()}자
            {dirty ? ' · 고치는 중' : savedAt ? ` · 저장됨 ${savedAt}` : ''}
          </span>
          <button className="s-chip-sm" onClick={() => save('손으로 저장')}>저장</button>
          <button className="s-chip-sm" disabled={reviewing} title="본문은 고치지 않습니다 — 지적만 댓글로"
            onClick={() => {
              setReviewing(true);
              save('검토 전');                       // 디스크의 글을 보므로 먼저 저장한다
              postJSON(`/docs/${doc.id}/review`, {})
                .then(d => { setComments(d.comments || []); setPane('comments'); onFlash(d.note); })
                .catch(onFail).finally(() => setReviewing(false));
            }}>{reviewing ? 'AI 검토 중…' : 'AI 검토'}</button>
          <button className="s-chip-sm" onClick={exportMd} title="Obsidian·Pandoc 으로 나가는 문">
            ↓ 마크다운</button>
          <a className="s-chip-sm" href={apiUrl(`/export/xlsx?sheets=clips,runs,sources`)}>↓ Excel</a>
        </div>
        {conflict && <div className="s-error" style={{ marginTop: 8 }}>{conflict}</div>}
        {doc.origin?.by === 'agent' && (
          <div className="s-interp-soft" style={{ marginTop: 8, padding: 9, borderRadius: 8, fontSize: 13 }}>
            ※ 에이전트가 쓴 초안입니다{doc.origin.model ? ` (${doc.origin.model})` : ''} —
            자료 {doc.origin.sources?.length || 0}건을 읽었습니다. 문장은 제안이고, 확정은 직접 하셔야 합니다.
            {(doc.origin.notes || []).map((n, i) => <div key={i} style={{ marginTop: 4 }}>⚠ {n}</div>)}
          </div>
        )}
      </div>

      {/* 서식 도구 */}
      <div className="s-panel" style={{ padding: 8, marginTop: 10 }}>
        <div className="flex items-center gap-1 flex-wrap">
          {[1, 2, 3].map(l => (
            <B key={l} on={editor?.isActive('heading', { level: l })}
              act={() => editor?.chain().focus().toggleHeading({ level: l as any }).run()}>H{l}</B>
          ))}
          <B on={editor?.isActive('paragraph')} act={() => editor?.chain().focus().setParagraph().run()}>본문</B>
          <span style={{ width: 1, height: 20, background: 'var(--s-line)', margin: '0 4px' }} />
          <B on={editor?.isActive('bold')} act={() => editor?.chain().focus().toggleBold().run()}>굵게</B>
          <B on={editor?.isActive('italic')} act={() => editor?.chain().focus().toggleItalic().run()}>기울임</B>
          <B on={editor?.isActive('strike')} act={() => editor?.chain().focus().toggleStrike().run()}>취소선</B>
          <B on={editor?.isActive('code')} act={() => editor?.chain().focus().toggleCode().run()}>코드</B>
          <span style={{ width: 1, height: 20, background: 'var(--s-line)', margin: '0 4px' }} />
          <B on={editor?.isActive('bulletList')} act={() => editor?.chain().focus().toggleBulletList().run()}>• 목록</B>
          <B on={editor?.isActive('orderedList')} act={() => editor?.chain().focus().toggleOrderedList().run()}>1. 목록</B>
          <B on={editor?.isActive('blockquote')} act={() => editor?.chain().focus().toggleBlockquote().run()}>인용</B>
          <B on={editor?.isActive('codeBlock')} act={() => editor?.chain().focus().toggleCodeBlock().run()}>코드블록</B>
          <span style={{ width: 1, height: 20, background: 'var(--s-line)', margin: '0 4px' }} />
          <B act={() => editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>표</B>
          {editor?.isActive('table') && (
            <>
              <B act={() => editor?.chain().focus().addRowAfter().run()}>＋행</B>
              <B act={() => editor?.chain().focus().addColumnAfter().run()}>＋열</B>
              <B act={() => editor?.chain().focus().deleteRow().run()}>－행</B>
              <B act={() => editor?.chain().focus().deleteColumn().run()}>－열</B>
            </>
          )}
          <span style={{ width: 1, height: 20, background: 'var(--s-line)', margin: '0 4px' }} />
          <B act={() => editor?.chain().focus().undo().run()}>되돌리기</B>
          <B act={() => editor?.chain().focus().redo().run()}>다시</B>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'minmax(0,1fr) 320px', gap: 12, marginTop: 12 }}>
        <div className="s-panel" style={{ padding: '18px 22px' }}>
          <EditorContent editor={editor} />
        </div>

        <div>
          <div className="flex gap-1" style={{ marginBottom: 8 }}>
            {([['comments', `댓글 ${comments.filter(c => !c.resolved).length}`],
            ['cite', '인용'], ['versions', `판 ${versions.length}`],
            ['origin', '출처']] as const).map(([k, l]) => (
              <button key={k} className={pane === k ? 's-btn' : 's-chip-sm'} onClick={() => {
                setPane(k as any);
                if (k === 'versions') reloadVersions();
                if (k === 'comments') reloadComments();
                if (k === 'cite' && !clips.length) {
                  fetchJSON('/notebook/clips').then(d => setClips(d.clips || [])).catch(() => {});
                }
              }}>{l}</button>
            ))}
          </div>

          {pane === 'comments' && (
            <div className="s-panel" style={{ padding: 12 }}>
              {sel ? (
                <>
                  <div style={{ fontSize: 12, color: 'var(--ink-2)', marginBottom: 6 }}>
                    고른 문장: “{sel.slice(0, 80)}{sel.length > 80 ? '…' : ''}”
                  </div>
                  <textarea className="s-input" rows={3} style={{ width: '100%' }}
                    placeholder="이 문장에 댓글" value={cmBody} onChange={e => setCmBody(e.target.value)} />
                  <button className="s-btn" style={{ marginTop: 6 }} disabled={!cmBody.trim()}
                    onClick={() => postJSON(`/docs/${doc.id}/comments`, { body: cmBody, quote: sel })
                      .then(() => { setCmBody(''); reloadComments(); onFlash('댓글을 달았습니다'); })
                      .catch(onFail)}>댓글 달기</button>
                </>
              ) : (
                <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>
                  본문에서 <b>문장을 끌어 고르면</b> 여기에 댓글을 달 수 있습니다.
                </div>
              )}
              <div style={{ marginTop: 12 }}>
                {comments.map(c => (
                  <div key={c.id} className="s-card" style={{ padding: 10, marginBottom: 8,
                    opacity: c.resolved ? 0.5 : 1 }}>
                    {c.quote && <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                      “{c.quote.slice(0, 60)}…”</div>}
                    <div style={{ fontSize: 13, margin: '4px 0', whiteSpace: 'pre-wrap' }}>{c.body}</div>
                    <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                      {c.by === 'ai' ? 'AI 검토' : '나'} · {when(c.created)}
                    </div>
                    {(c.replies || []).map(r => (
                      <div key={r.id} style={{ fontSize: 12, marginTop: 6, paddingLeft: 10,
                        borderLeft: '2px solid var(--s-line)' }}>{r.body}</div>
                    ))}
                    <div className="flex gap-1" style={{ marginTop: 6 }}>
                      <button className="s-chip-sm" onClick={() => {
                        const t = window.prompt('답글');
                        if (t) fetch(apiUrl(`/docs/${doc.id}/comments/${c.id}`), {
                          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ reply: t }),
                        }).then(reloadComments).catch(onFail);
                      }}>답글</button>
                      <button className="s-chip-sm" onClick={() => fetch(apiUrl(`/docs/${doc.id}/comments/${c.id}`), {
                        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ resolved: !c.resolved }),
                      }).then(reloadComments).catch(onFail)}>
                        {c.resolved ? '다시 열기' : '해결'}</button>
                      <button className="s-chip-danger" onClick={() => {
                        if (!window.confirm('이 댓글을 지웁니다.')) return;
                        delJSON(`/docs/${doc.id}/comments/${c.id}`).then(reloadComments).catch(onFail);
                      }}>지우기</button>
                    </div>
                  </div>
                ))}
                {!comments.length && <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>댓글이 없습니다.</div>}
              </div>
            </div>
          )}

          {pane === 'cite' && (
            <div className="s-panel" style={{ padding: 12 }}>
              <div style={{ fontSize: 13, color: 'var(--ink-2)', marginBottom: 8 }}>
                본문에서 문장을 고르고 <b>근거 찾기</b>를 누르면, 색인된 논문에서 그 문장을
                뒷받침할 대목을 찾습니다. 넣으면 <code>[@key]</code> 가 함께 들어갑니다.
              </div>
              <button className="s-btn" disabled={!sel || finding} onClick={() => {
                setFinding(true);
                postJSON('/doc/evidence', { text: sel, n: 5 })
                  .then(d => setEvid({ hits: d.all || [], note: d.note || '', enough: !!d.enough }))
                  .catch(onFail).finally(() => setFinding(false));
              }}>{finding ? '찾는 중…' : '근거 찾기'}</button>
              {!sel && <span style={{ marginLeft: 8, fontSize: 13, color: 'var(--ink-3)' }}>
                먼저 문장을 고르세요.</span>}

              {evid && !evid.enough && (
                <div className="s-interp-soft" style={{ padding: 9, borderRadius: 8,
                  marginTop: 10, fontSize: 13 }}>※ {evid.note}</div>
              )}
              {evid?.hits.map(h => (
                <div key={h.id} className="s-card" style={{ padding: 10, marginTop: 8 }}>
                  <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                    <code>[@{h.doc}]</code>{h.page ? ` · p.${h.page}` : ''} · 유사도 {h.sim}
                    {h.sim < 0.45 && <span style={{ color: 'var(--s-danger)' }}> · 기준 미달</span>}
                  </div>
                  <div style={{ fontSize: 13, margin: '4px 0' }}>{h.text.slice(0, 220)}…</div>
                  <button className="s-chip-sm" onClick={() => {
                    /* 인용 표시만 넣는다. 남의 문장을 본문에 바로 붙이지 않는다 —
                       그대로 두면 어디까지가 내 글인지 알 수 없게 된다. */
                    editor?.chain().focus().insertContent(` [@${h.doc}]`).run();
                    onFlash(`[@${h.doc}] 를 넣었습니다 — 원문은 넣지 않았습니다`);
                  }}>[@{h.doc}] 넣기</button>
                </div>
              ))}

              <div style={{ marginTop: 14, fontWeight: 600, fontSize: 13 }}>
                담아 둔 발췌 {clips.length}</div>
              {clips.length ? clips.slice(0, 20).map(c => (
                <div key={c.id} className="s-card" style={{ padding: 9, marginTop: 6 }}>
                  <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                    <code>[@{c.cite_key}]</code>{c.page ? ` · p.${c.page}` : ''}</div>
                  <div style={{ fontSize: 13, margin: '3px 0' }}>▸ {c.text.slice(0, 160)}…</div>
                  <button className="s-chip-sm" onClick={() => {
                    editor?.chain().focus().insertContent(` [@${c.cite_key}]`).run();
                    onFlash(`[@${c.cite_key}] 를 넣었습니다`);
                  }}>인용 넣기</button>
                </div>
              )) : (
                <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>
                  없습니다 — 노트북에서 원문을 읽다가 담으면 여기 쌓입니다.
                </div>
              )}
            </div>
          )}

          {pane === 'versions' && (
            <div className="s-panel" style={{ padding: 12 }}>
              <div style={{ fontSize: 12, color: 'var(--ink-2)', marginBottom: 8 }}>
                되돌려도 지금 모습이 판으로 남습니다 — 되돌린 것도 되돌릴 수 있습니다.
              </div>
              {versions.map(v => (
                <div key={v.v} className="s-card" style={{ padding: 9, marginBottom: 6 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>v{v.v} · {v.label || '저장'}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                    {v.by === 'agent' ? '에이전트' : '나'} · {when(v.at)} · {v.words}자</div>
                  <button className="s-chip-sm" style={{ marginTop: 5 }} onClick={() => {
                    if (!window.confirm(`v${v.v} 로 되돌립니다. 지금 모습도 판으로 남습니다.`)) return;
                    postJSON(`/docs/${doc.id}/revert`, { v: v.v })
                      .then(() => fetchJSON(`/docs/${doc.id}`))
                      .then(d => {
                        editor?.commands.setContent(d.doc);
                        vRef.current = d.version; setVersion(d.version); setWords(d.words);
                        reloadVersions(); onFlash(`v${v.v} 로 되돌렸습니다`);
                      }).catch(onFail);
                  }}>이 판으로</button>
                </div>
              ))}
              {!versions.length && <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>판 기록이 없습니다.</div>}
            </div>
          )}

          {pane === 'origin' && (
            <div className="s-panel" style={{ padding: 12, fontSize: 13 }}>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>무엇을 읽고 썼나</div>
              {(doc.origin?.sources || []).length ? (
                (doc.origin.sources || []).map((s, i) => (
                  <div key={i} style={{ marginBottom: 4 }}>
                    <span className="s-badge">{s.kind === 'journal' ? '일지' : '선행논문'}</span>{' '}
                    <code style={{ fontSize: 12 }}>{s.path}</code>
                  </div>
                ))
              ) : (
                <div style={{ color: 'var(--ink-3)' }}>
                  직접 쓰신 문서입니다 — 읽은 자료 기록이 없습니다.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
