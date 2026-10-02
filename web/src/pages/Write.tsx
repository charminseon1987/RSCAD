/* 논문 쓰기 — 보이는 대로 편집하되 저장본은 마크다운

   화면은 WYSIWYG 이지만 파일은 .md 다. 그래야 같은 글을 Obsidian 이 열고
   Pandoc 이 돌리고, [@citekey]·[[링크]]·▸/※ 가 그대로 산다.

   문장을 고르면 띄우는 것 셋.
     다듬기·줄이기·학술체 — 모델의 **제안**이다. 넣는 것은 사람이 누른다.
     근거 찾기            — 그 문장을 뒷받침할 대목을 내 색인에서 찾는다.
                            못 찾으면 '근거 없이 쓰고 있다'고 말한다.
     댓글                 — 문장에 묶어 둔다. 본문이 바뀌면 따라가고,
                            문장이 사라지면 '길 잃음'으로 표시한다.

   오른쪽은 넣을 것 — 노트북에서 담은 내 발췌와 색인 검색 결과. 누르면
   커서 자리에 원문과 [@citekey] 가 함께 들어간다. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import TiptapText from '@tiptap/extension-text';
import HardBreak from '@tiptap/extension-hard-break';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableHeader from '@tiptap/extension-table-header';
import TableCell from '@tiptap/extension-table-cell';
import { Markdown } from 'tiptap-markdown';
import { fetchJSON, postJSON } from '../lib/api';

/* ── 마크다운 직렬화기를 두 군데 갈아 끼운다 ──

   기본 직렬화기는 글자를 쓸 때 마크다운 특수문자를 이스케이프한다. 그러면
   저장본이 이렇게 망가진다 (실제로 났던 일이다 — 대괄호와 백슬래시 앞에
   역슬래시가 하나씩 더 붙는다):
       [@chen2024electronics]      →  대괄호가 이스케이프돼 Pandoc 이 인용으로 못 읽는다
       [[kenyon2020ibrstability]]  →  Obsidian 링크가 끊긴다
       LaTeX 의 백슬래시            →  두 배가 되어 수식이 깨진다
   이 볼트에서는 대괄호·백슬래시가 **문법**이므로 이스케이프하면 안 된다.

   tiptap-markdown 의 getMarkdownSpec() 은 확장의 storage.markdown 을 먼저 보므로
   같은 이름으로 다시 등록하면 이쪽이 이긴다. */
const RawText = TiptapText.extend({
  addStorage() {
    return {
      markdown: {
        // 두 번째 인자 false = 이스케이프하지 않는다
        serialize(state: any, node: any) { state.text(node.text, false); },
        parse: {},
      },
    };
  },
});

/* 줄바꿈 하나를 기본 직렬화기는 역슬래시 + 줄바꿈으로 쓴다. 그러면 ▸/※ 줄 끝마다
   백슬래시가 생긴다. 이 볼트의 원문은 그냥 줄바꿈이므로 그대로 쓴다 —
   읽을 때 breaks:true 로 다시 줄바꿈이 되어 왕복이 맞는다. */
const PlainBreak = HardBreak.extend({
  addStorage() {
    return {
      markdown: {
        serialize(state: any) { state.write('\n'); },
        parse: {},
      },
    };
  },
});

interface DocRow { path: string; name: string; bytes: number; modified: string }
interface Hit { id: string; doc: string; title: string; page: number | null; sim: number; text: string }
interface Clip {
  id: string; cite_key: string; doc: string; page: string; text: string; note: string;
  section: string; kind: string; used: boolean;
}
interface Comment {
  id: string; path: string; quote: string; body: string; by: string; kind: string;
  resolved: boolean; created: string; found: boolean; start: number | null; ambiguous?: boolean;
}
interface Action { kind: string; label: string }
interface Suggestion {
  kind: string; label: string; original: string; suggestion: string;
  lost_citations: string[]; truncated: boolean; note: string; model: string;
}

interface Run {
  run_name: string; timestamp: string; XR: number | null;
  SCR_list: number[] | null; all_stable: boolean | null; zeta_min: number | null;
}
interface Para { i: number; text: string; kind: string }
interface Section { id: string; title: string }

const SAVE_DELAY = 1800;   // 타자가 멈추고 이만큼 지나면 저장한다

/* 글이 어느 탭의 것인지는 **폴더로** 갈린다. 연구일지와 논문을 한 목록에 섞으면
   어느 것을 고쳐야 할지 매번 헷갈린다. */
const JOURNAL_DIR = 'RSCAD/03_실험/일지';
const TABS = [
  { k: 'journal', label: '연구일지', hint: '돌린 실험 위에 내 해석을 쌓는다' },
  { k: 'merge', label: '합치기', hint: '일지 문단을 논문 절로 — 나란히 보고 민다' },
  { k: 'paper', label: '논문', hint: '본문을 쓰고 다듬고 검토한다' },
] as const;
type Tab = typeof TABS[number]['k'];

export default function Write() {
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [path, setPath] = useState('');
  const [base, setBase] = useState('');
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState('');
  const [conflict, setConflict] = useState('');
  const [newName, setNewName] = useState('');

  const [actions, setActions] = useState<Action[]>([]);
  const [ollama, setOllama] = useState<{ ok: boolean; msg: string; model: string } | null>(null);
  const [sel, setSel] = useState('');
  const [sug, setSug] = useState<Suggestion | null>(null);
  const [evid, setEvid] = useState<{ hits: Hit[]; note: string; enough: boolean } | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [cmBody, setCmBody] = useState('');
  const [clips, setClips] = useState<Clip[]>([]);
  const [q, setQ] = useState('');
  const [found, setFound] = useState<Hit[] | null>(null);

  const [tab, setTab] = useState<Tab>('paper');
  // 연구일지
  const [runs, setRuns] = useState<Run[]>([]);
  const [pickRun, setPickRun] = useState<Record<string, boolean>>({});
  const [jTitle, setJTitle] = useState('');
  // 합치기
  const [src, setSrc] = useState('');            // 어느 일지에서
  const [paras, setParas] = useState<Para[]>([]);
  const [dst, setDst] = useState('');            // 어느 논문으로
  const [sections, setSections] = useState<Section[]>([]);
  const [sec, setSec] = useState('III');
  const [pickPara, setPickPara] = useState<Record<number, boolean>>({});
  const [preview, setPreview] = useState<{ text: string; where: string } | null>(null);

  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const timer = useRef<number | null>(null);
  const pathRef = useRef('');
  const baseRef = useRef('');

  const flash = (m: string) => { setMsg(m); window.setTimeout(() => setMsg(''), 4000); };
  const fail = (e: any) => setErr(String(e?.message || e).replace(/^HTTP \d+: /, '').slice(0, 300));

  const editor = useEditor({
    extensions: [
      /* text·hardBreak 은 위에서 갈아 끼운 것을 쓴다 */
      StarterKit.configure({ text: false, hardBreak: false }),
      RawText,
      PlainBreak,
      /* 표. 없으면 연구일지의 실험 표가 저장할 때 한 줄로 뭉개진다 —
         `10:15:09` 과 `1.0` 이 붙어 `10:15:091.0` 이 된 적이 있다. 실측값이
         읽을 수 없게 되는 것이라 모양 문제가 아니다. 스키마에 table 노드가
         있으면 tiptap-markdown 이 제 직렬화기를 쓴다. */
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
      /* 저장본이 마크다운이어야 하므로 직렬화를 켠다.
         linkify — 끈다. 본문의 doi.org 주소를 멋대로 링크로 바꾸면 저장본이 달라진다.
         breaks  — 켠다. 줄바꿈 하나가 ▸/※ 를 가르는 경계다. 끄면 두 줄이 한 줄로 붙는다. */
      Markdown.configure({ html: false, linkify: false, breaks: true, transformPastedText: true }),
      Placeholder.configure({ placeholder: '왼쪽에서 글을 고르거나 새로 만드세요.' }),
    ],
    content: '',
    editorProps: { attributes: { class: 'tt-doc' } },
    onUpdate: () => { setDirty(true); schedule(); },
    onSelectionUpdate: ({ editor: ed }) => {
      const { from, to } = ed.state.selection;
      const t = from === to ? '' : ed.state.doc.textBetween(from, to, ' ').trim();
      setSel(t);
      if (!t) { setSug(null); setEvid(null); }
    },
  });

  /* ── 불러오기 ── */
  const loadDocs = useCallback(() => fetchJSON('/doc/list')
    .then(d => setDocs(d.docs || [])).catch(() => {}), []);
  const loadComments = useCallback((p: string) => p
    ? fetchJSON(`/doc/comments?path=${encodeURIComponent(p)}`)
      .then(d => setComments(d.comments || [])).catch(() => {})
    : Promise.resolve(), []);

  useEffect(() => {
    loadDocs();
    fetchJSON('/doc/actions').then(d => { setActions(d.actions || []); setOllama(d.ollama); }).catch(() => {});
    fetchJSON('/notebook/clips').then(d => setClips(d.clips || [])).catch(() => {});
    fetchJSON('/doc/runs').then(d => setRuns(d.runs || [])).catch(() => {});
    fetchJSON('/notebook/sections').then(d => setSections(d.sections || [])).catch(() => {});
  }, [loadDocs]);

  /* 탭이 바뀌면 그 탭의 글만 보여 준다 */
  const inTab = (d: DocRow, t: Tab) =>
    t === 'journal' ? d.path.startsWith(JOURNAL_DIR) : !d.path.startsWith(JOURNAL_DIR);
  const tabDocs = docs.filter(d => inTab(d, tab === 'merge' ? 'paper' : tab));
  const journals = docs.filter(d => d.path.startsWith(JOURNAL_DIR));
  const papers = docs.filter(d => !d.path.startsWith(JOURNAL_DIR));

  /* ── 연구일지 ── */
  const newJournal = () => {
    const picked = Object.entries(pickRun).filter(([, v]) => v).map(([k]) => k);
    setBusy('journal'); setErr('');
    postJSON('/doc/journal', { title: jTitle.trim() || '연구일지', runs: picked })
      .then(d => {
        setJTitle(''); setPickRun({});
        loadDocs().then(() => open(d.path));
        flash(`일지를 만들었습니다 — ${d.path}`);
      })
      .catch(e => {
        const m = String(e?.message || e);
        setErr(m.includes('409') ? '같은 이름의 일지가 이미 있습니다 — 제목을 바꾸세요' : m.slice(0, 200));
      })
      .finally(() => setBusy(''));
  };

  /* ── 합치기 ── */
  const loadParas = (p: string) => {
    setSrc(p); setParas([]); setPickPara({}); setPreview(null);
    if (!p) return;
    fetchJSON(`/doc/paragraphs?path=${encodeURIComponent(p)}`)
      .then(d => setParas(d.paragraphs || [])).catch(fail);
  };
  const doMerge = () => {
    const chosen = paras.filter(x => pickPara[x.i]).map(x => x.text);
    if (!dst) { setErr('어느 논문으로 보낼지 고르세요'); return; }
    if (!chosen.length) { setErr('밀어 넣을 문단을 고르세요'); return; }
    setBusy('merge'); setErr('');
    postJSON('/notebook/merge', { paper: dst, section: sec, paragraphs: chosen })
      .then(d => { setPreview({ text: d.text, where: d.where }); flash(`${d.where} — ${d.note}`); })
      .catch(fail).finally(() => setBusy(''));
  };
  /* 합친 본문을 논문 탭으로 넘긴다. 저장은 거기서 눌러야 한다 — 자동으로 쓰지 않는다. */
  const toPaper = () => {
    if (!preview || !editor) return;
    setTab('paper');
    fetchJSON(`/doc?path=${encodeURIComponent(dst)}`).then(d => {
      setPath(d.path); pathRef.current = d.path;
      setBase(d.base); baseRef.current = d.base;
      editor.commands.setContent(preview.text);
      setDirty(true); setPreview(null);
      loadComments(d.path);
      flash('논문 탭으로 옮겼습니다 — 보고 나서 저장하세요');
    }).catch(fail);
  };

  /* ── AI 검토 — 댓글로만 ── */
  const review = () => {
    if (!path) return;
    setBusy('review'); setErr('');
    postJSON('/doc/review', { path, explain: false })
      .then(d => {
        setComments(d.comments || []);
        flash(`${d.checked}개 문단에서 ${d.added}건 — ${d.note}`);
      }).catch(fail).finally(() => setBusy(''));
  };

  const open = (p: string) => {
    if (dirty && !window.confirm('저장하지 않은 글이 있습니다. 그래도 옮기시겠습니까?')) return;
    setErr(''); setConflict(''); setSug(null); setEvid(null); setSel('');
    fetchJSON(`/doc?path=${encodeURIComponent(p)}`).then(d => {
      setPath(d.path); pathRef.current = d.path;
      setBase(d.base); baseRef.current = d.base;
      editor?.commands.setContent(d.text || '');
      setDirty(false); setSaved(d.modified || '');
      loadComments(d.path);
    }).catch(fail);
  };

  const create = () => {
    const name = newName.trim();
    if (!name) return;
    postJSON('/doc/new', { name }).then(d => {
      setNewName('');
      loadDocs().then(() => open(d.path));
    }).catch(fail);
  };

  /* ── 저장 — 밖에서 고친 것을 모르고 덮지 않는다 ── */
  const save = useCallback(() => {
    const p = pathRef.current;
    if (!p || !editor) return;
    const text = editor.storage.markdown.getMarkdown();
    postJSON('/doc', { path: p, text, base: baseRef.current })
      .then(d => {
        setBase(d.base); baseRef.current = d.base;
        setDirty(false); setConflict('');
        if (d.saved) setSaved(d.at || new Date().toLocaleTimeString());
      })
      .catch(e => {
        const m = String(e?.message || e);
        if (m.includes('409')) {
          setConflict('이 글이 밖에서 바뀌었습니다 (Obsidian 등에서 연 것 같습니다). '
            + '덮으면 거기서 쓴 글이 사라집니다 — ‘다시 읽기’ 로 확인하세요.');
        } else fail(e);
      });
  }, [editor]);

  const schedule = () => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(save, SAVE_DELAY);
  };
  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);

  /* ── 고른 문장에 대한 보조 ── */
  const assist = (kind: string) => {
    if (!sel) return;
    setBusy(kind); setErr(''); setSug(null);
    postJSON('/doc/assist', { kind, text: sel })
      .then(setSug).catch(fail).finally(() => setBusy(''));
  };
  const applySug = () => {
    if (!sug || !editor) return;
    editor.chain().focus().insertContent(sug.suggestion).run();
    setSug(null); setDirty(true); schedule();
  };

  const evidence = () => {
    if (!sel) return;
    setBusy('evidence'); setErr(''); setEvid(null);
    postJSON('/doc/evidence', { text: sel })
      .then(d => setEvid({ hits: d.hits || [], note: d.note || '', enough: !!d.enough }))
      .catch(fail).finally(() => setBusy(''));
  };

  /* ── 댓글 — 고른 문장에 묶는다 ── */
  const addComment = (body: string, by: 'me' | 'ai' = 'me', kind = '') => {
    if (!path || !sel || !body.trim() || !editor) return;
    const md: string = editor.storage.markdown.getMarkdown();
    const at = md.indexOf(sel);
    postJSON('/doc/comments', {
      path, quote: sel, body, by, kind,
      prefix: at > 0 ? md.slice(Math.max(0, at - 40), at) : '',
      suffix: at >= 0 ? md.slice(at + sel.length, at + sel.length + 40) : '',
      start: at >= 0 ? at : null,
    }).then(d => { setComments(d.comments); setCmBody(''); flash('댓글을 달았습니다'); })
      .catch(fail);
  };
  const resolveComment = (c: Comment) =>
    fetchJSON(`/doc/comments/${c.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resolved: !c.resolved }),
    }).then(d => setComments(d.comments)).catch(fail);
  const delComment = (c: Comment) =>
    fetchJSON(`/doc/comments/${c.id}`, { method: 'DELETE' })
      .then(d => setComments(d.comments)).catch(fail);

  /* ── 넣기 — 원문과 인용을 함께 ── */
  const insertClip = (c: Clip) => {
    if (!editor) return;
    const anchor = c.page ? ` <!-- ${c.doc || c.cite_key}.pdf p.${c.page} -->` : '';
    editor.chain().focus().insertContent(`${c.text} [@${c.cite_key}]${anchor}`).run();
    setDirty(true); schedule();
  };
  const insertHit = (h: Hit) => {
    if (!editor) return;
    const key = h.doc;
    editor.chain().focus()
      .insertContent(`${h.text.trim()} [@${key}]${h.page ? ` <!-- p.${h.page} -->` : ''}`).run();
    setDirty(true); schedule();
  };

  const search = (e: React.FormEvent) => {
    e.preventDefault();
    if (q.trim().length < 2) return;
    setBusy('search'); setErr('');
    postJSON('/scholar/ask/search', { q: q.trim(), n: 6 })
      .then(d => setFound(d.hits || [])).catch(fail).finally(() => setBusy(''));
  };

  const live = useMemo(() => comments.filter(c => !c.resolved), [comments]);
  const lost = useMemo(() => comments.filter(c => !c.found && !c.resolved).length, [comments]);

  return (
    <>
      <style>{`
        .tt-doc { outline: none; min-height: 58vh; font-size: 16px; line-height: 1.95; color: var(--ink); }
        .tt-doc h1 { font-size: 25px; font-weight: 700; margin: 20px 0 10px; }
        .tt-doc h2 { font-size: 20px; font-weight: 700; margin: 18px 0 8px; }
        .tt-doc h3 { font-size: 17px; font-weight: 600; margin: 14px 0 6px; }
        .tt-doc p { margin: 9px 0; }
        .tt-doc ul, .tt-doc ol { margin: 9px 0; padding-left: 22px; }
        .tt-doc li { margin: 3px 0; }
        .tt-doc code { font-size: 14px; padding: 1px 5px; border-radius: 5px;
          background: var(--s-bg); border: 1px solid var(--s-line); }
        .tt-doc pre { padding: 11px; border-radius: 9px; background: var(--s-bg);
          border: 1px solid var(--s-line); overflow-x: auto; }
        .tt-doc blockquote { border-left: 3px solid var(--s-line); padding-left: 12px;
          color: var(--ink-2); margin: 10px 0; }
        .tt-doc p.is-editor-empty:first-child::before { content: attr(data-placeholder);
          color: var(--ink-3); float: left; height: 0; pointer-events: none; }
        /* 표 — 칸 경계가 보여야 어느 수치가 어느 열인지 읽힌다 */
        .tt-doc table { border-collapse: collapse; margin: 12px 0; width: 100%;
          table-layout: fixed; overflow: hidden; font-size: 14px; }
        .tt-doc th, .tt-doc td { border: 1px solid var(--s-line); padding: 6px 9px;
          vertical-align: top; text-align: left; position: relative; }
        .tt-doc th { background: var(--s-bg); font-weight: 600; }
        .tt-doc .selectedCell:after { content: ''; position: absolute; inset: 0;
          background: var(--s-line); opacity: .35; pointer-events: none; }
      `}</style>

      <div className="s-panel" style={{ padding: 14 }}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div style={{ fontSize: 17, fontWeight: 700 }}>쓰기</div>
            <p style={{ fontSize: 14, color: 'var(--ink-2)', marginTop: 3, lineHeight: 1.7 }}>
              <strong>연구일지</strong>에 그날 돌린 것과 해석을 쌓고 → <strong>합치기</strong>로 논문 절에 밀어 넣고
              → <strong>논문</strong>에서 다듬고 검토합니다.
              <br />보이는 대로 쓰지만 <strong>저장본은 마크다운</strong>이라 Obsidian·Pandoc 이 그대로 읽습니다.
              AI 가 고친 문장은 <strong>제안</strong>이고, 넣는 것은 직접 누르셔야 합니다.
            </p>
          </div>
          <div className="flex gap-2 flex-wrap items-center" style={{ fontSize: 12.5 }}>
            {path && (
              <span className="s-chip" style={{ cursor: 'default' }}>
                {dirty ? '쓰는 중…' : saved ? `저장됨 ${String(saved).slice(11, 19) || ''}` : '그대로'}
              </span>
            )}
            {ollama && (
              <span className="s-chip" style={{
                cursor: 'default', color: ollama.ok ? 'var(--s-ok)' : 'var(--s-interp)',
              }}>{ollama.ok ? ollama.model : ollama.msg}</span>
            )}
            {!!lost && (
              <span className="s-chip" style={{ cursor: 'default', color: 'var(--s-interp)' }}>
                길 잃은 댓글 {lost}
              </span>
            )}
          </div>
        </div>
      </div>

      {err && <p style={{ color: 'var(--error)', fontSize: 14.5 }}>{err}</p>}
      {msg && <p style={{ color: 'var(--s-ok)', fontSize: 14.5 }}>{msg}</p>}
      {conflict && (
        <div className="s-panel" style={{ padding: 12, borderColor: 'var(--s-interp)' }}>
          <span style={{ fontSize: 14.5, color: 'var(--s-interp)' }}>※ {conflict}</span>
          <button className="s-chip" style={{ marginLeft: 10 }} onClick={() => open(path)}>다시 읽기</button>
        </div>
      )}

      {/* ══ 탭 ══ */}
      <div className="s-panel flex gap-2 flex-wrap" style={{ padding: 10 }}>
        {TABS.map(t => (
          <button key={t.k} className={tab === t.k ? 's-btn' : 's-chip'}
            aria-pressed={tab === t.k} title={t.hint}
            onClick={() => setTab(t.k)}>
            {t.label}
          </button>
        ))}
        <span style={{ fontSize: 13, color: 'var(--ink-3)', alignSelf: 'center', marginLeft: 6 }}>
          {TABS.find(t => t.k === tab)?.hint}
        </span>
      </div>

      {/* ══ 합치기 — 나란히 보고 문단 단위로 민다 ══ */}
      {tab === 'merge' && (
        <div className="grid grid-cols-12 gap-4 items-start">
          <div className="col-span-12 lg:col-span-5 space-y-2">
            <div className="s-panel" style={{ padding: 14 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>어느 일지에서</div>
              <select className="s-input" style={{ marginTop: 8 }} value={src}
                onChange={e => loadParas(e.target.value)}>
                <option value="">— 연구일지 고르기 —</option>
                {journals.map(j => <option key={j.path} value={j.path}>{j.name}</option>)}
              </select>
              {!journals.length && (
                <p style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 6, lineHeight: 1.6 }}>
                  아직 일지가 없습니다 — <strong>연구일지</strong> 탭에서 만드세요.
                </p>
              )}
            </div>
            <div className="s-panel" style={{ padding: 14 }}>
              <div style={{ fontSize: 14.5, fontWeight: 700 }}>
                문단 {paras.length} · 고름 {Object.values(pickPara).filter(Boolean).length}
              </div>
              <p style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 4, lineHeight: 1.6 }}>
                제목·표·주석은 회색입니다 — 그대로 옮길 것이 아니라 보고 판단할 것입니다.
              </p>
              <div className="space-y-1 mt-2" style={{ maxHeight: '52vh', overflowY: 'auto' }}>
                {paras.map(x => (
                  <label key={x.i} className="s-src flex items-start gap-2"
                    style={{ padding: 9, cursor: 'pointer', opacity: x.kind === 'text' || x.kind === 'marker' ? 1 : 0.55 }}>
                    <input type="checkbox" style={{ marginTop: 4 }} checked={!!pickPara[x.i]}
                      onChange={() => setPickPara(s2 => ({ ...s2, [x.i]: !s2[x.i] }))} />
                    <span style={{ fontSize: 13.5, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                      {x.text.slice(0, 220)}{x.text.length > 220 ? '…' : ''}
                    </span>
                  </label>
                ))}
                {src && !paras.length && (
                  <p style={{ fontSize: 13.5, color: 'var(--ink-3)' }}>문단이 없습니다.</p>
                )}
              </div>
            </div>
          </div>

          <div className="col-span-12 lg:col-span-7 space-y-2">
            <div className="s-panel" style={{ padding: 14 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>어느 논문 · 어느 절로</div>
              <div className="flex gap-2 flex-wrap mt-2">
                <select className="s-input" style={{ flex: 1, minWidth: 220 }} value={dst}
                  onChange={e => setDst(e.target.value)}>
                  <option value="">— 논문 고르기 —</option>
                  {papers.map(d => <option key={d.path} value={d.path}>{d.name}</option>)}
                </select>
                <select className="s-input" style={{ width: 190 }} value={sec}
                  onChange={e => setSec(e.target.value)}>
                  {sections.map(x => <option key={x.id} value={x.id}>{x.id}. {x.title}</option>)}
                </select>
                <button className="s-btn" disabled={!!busy} onClick={doMerge}>
                  {busy === 'merge' ? '합치는 중…' : '→ 밀어 넣기'}
                </button>
              </div>
              <p className="s-interp" style={{ fontSize: 13, marginTop: 8 }}>
                ※ 밀어 넣어도 <strong>파일은 바뀌지 않습니다.</strong> 합친 결과를 아래에서 보고,
                논문 탭으로 옮겨 직접 저장하세요.
              </p>
            </div>

            {preview && (
              <div className="s-panel" style={{ padding: 14 }}>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span style={{ fontSize: 14.5, fontWeight: 700 }}>합친 결과 — {preview.where}</span>
                  <div className="flex gap-2">
                    <button className="s-btn" onClick={toPaper}>논문 탭으로 옮기기</button>
                    <button className="s-chip" onClick={() => setPreview(null)}>버리기</button>
                  </div>
                </div>
                <pre style={{
                  fontSize: 13, lineHeight: 1.8, marginTop: 10, padding: 11, borderRadius: 9,
                  background: 'var(--s-bg)', border: '1px solid var(--s-line)',
                  whiteSpace: 'pre-wrap', maxHeight: '52vh', overflowY: 'auto',
                }}>{preview.text}</pre>
              </div>
            )}
          </div>
        </div>
      )}

      {tab !== 'merge' && (
      <div className="grid grid-cols-12 gap-4 items-start">
        {/* ══ 왼쪽: 글 목록 ══ */}
        <div className="col-span-12 lg:col-span-2 space-y-2">
          <div className="s-panel" style={{ padding: 12 }}>
            <div style={{ fontSize: 14.5, fontWeight: 700 }}>글 {docs.length}</div>
            <div className="space-y-1 mt-2" style={{ maxHeight: '40vh', overflowY: 'auto' }}>
              {tabDocs.map(d => (
                <button key={d.path} className="s-src w-full text-left" data-hot={d.path === path}
                  style={{ padding: 8 }} onClick={() => open(d.path)}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{d.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>
                    {d.path.split('/').slice(-2, -1)[0]} · {Math.max(1, Math.round(d.bytes / 1024))} KB
                  </div>
                </button>
              ))}
            </div>
            <div className="flex gap-1 mt-2">
              <input className="s-input" style={{ fontSize: 13, padding: '6px 9px' }} value={newName}
                placeholder="새 글 이름" onChange={e => setNewName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); create(); } }} />
              <button className="s-chip" style={{ fontSize: 12 }} onClick={create}>＋</button>
            </div>
          </div>

          {/* 연구일지 — 돌린 실험을 고르면 수치가 표로 박힌다.
              사람이 숫자를 옮겨 적으면 언젠가 틀리고, 틀린 줄도 모른다. */}
          {tab === 'journal' && (
            <div className="s-panel" style={{ padding: 12 }}>
              <div style={{ fontSize: 14.5, fontWeight: 700 }}>새 일지</div>
              <input className="s-input" style={{ fontSize: 13, padding: '6px 9px', marginTop: 8 }}
                value={jTitle} placeholder="제목 (예: XR1.0 스윕 재확인)"
                onChange={e => setJTitle(e.target.value)} />
              <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 8, marginBottom: 4 }}>
                오늘 돌린 실험 — 고르면 조건·결과가 표로 들어갑니다
              </div>
              <div className="space-y-1" style={{ maxHeight: '26vh', overflowY: 'auto' }}>
                {!runs.length && (
                  <p style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>results/ 에 실험이 없습니다.</p>
                )}
                {runs.map(r => (
                  <label key={r.run_name} className="flex items-start gap-2"
                    style={{ fontSize: 12, cursor: 'pointer', lineHeight: 1.5 }}>
                    <input type="checkbox" style={{ marginTop: 3 }} checked={!!pickRun[r.run_name]}
                      onChange={() => setPickRun(x => ({ ...x, [r.run_name]: !x[r.run_name] }))} />
                    <span className="min-w-0">
                      <span style={{ display: 'block' }}>
                        X/R {r.XR ?? '—'} · SCR {(r.SCR_list || []).join(', ') || '—'}
                        {r.all_stable === true ? ' · 안정' : r.all_stable === false ? ' · 불안정' : ''}
                      </span>
                      <span style={{ color: 'var(--ink-3)' }}>{(r.timestamp || '').slice(0, 16)}</span>
                    </span>
                  </label>
                ))}
              </div>
              <button className="s-btn w-full" style={{ marginTop: 10 }}
                disabled={!!busy} onClick={newJournal}>
                {busy === 'journal' ? '만드는 중…' : '＋ 오늘 일지 만들기'}
              </button>
            </div>
          )}
        </div>

        {/* ══ 가운데: 본문 ══ */}
        <div className="col-span-12 lg:col-span-7 space-y-3">
          <div className="s-panel" style={{ padding: 18 }}>
            {!path ? (
              <p style={{ fontSize: 15, color: 'var(--ink-3)' }}>
                왼쪽에서 글을 고르거나 새로 만드세요.
              </p>
            ) : (
              <>
                <div className="flex items-center justify-between gap-2 flex-wrap"
                  style={{ marginBottom: 10, paddingBottom: 10, borderBottom: '1px solid var(--s-line)' }}>
                  <code style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>{path}</code>
                  <div className="flex gap-1 flex-wrap">
                    <button className="s-chip" style={{ fontSize: 12 }}
                      onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}>H2</button>
                    <button className="s-chip" style={{ fontSize: 12 }}
                      onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}>H3</button>
                    <button className="s-chip" style={{ fontSize: 12 }}
                      onClick={() => editor?.chain().focus().toggleBold().run()}>굵게</button>
                    <button className="s-chip" style={{ fontSize: 12 }}
                      onClick={() => editor?.chain().focus().toggleItalic().run()}>기울임</button>
                    <button className="s-chip" style={{ fontSize: 12 }}
                      onClick={() => editor?.chain().focus().toggleBulletList().run()}>목록</button>
                    <button className="s-chip" style={{ fontSize: 12 }}
                      onClick={() => editor?.chain().focus().toggleBlockquote().run()}>인용블록</button>
                    <button className="s-chip" style={{ fontSize: 12 }} onClick={save}>저장</button>
                    {tab === 'paper' && (
                      <button className="s-chip" style={{ fontSize: 12 }} disabled={!!busy}
                        title="근거 없는 주장·깨진 인용·흔들린 표기를 찾아 댓글로만 답니다. 본문은 바뀌지 않습니다"
                        onClick={review}>
                        {busy === 'review' ? 'AI 검토 중…' : 'AI 검토'}
                      </button>
                    )}
                  </div>
                </div>
                <EditorContent editor={editor} />
              </>
            )}
          </div>

          {/* 고른 문장에 대한 도구 */}
          {!!sel && (
            <div className="s-panel" style={{ padding: 14 }}>
              <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>
                고른 문장 {sel.length}자
              </div>
              <div style={{
                fontSize: 14, lineHeight: 1.8, marginTop: 5, padding: 9, borderRadius: 8,
                background: 'var(--s-bg)', border: '1px solid var(--s-line)',
              }}>{sel.slice(0, 300)}{sel.length > 300 ? '…' : ''}</div>

              <div className="flex gap-2 flex-wrap mt-3">
                {actions.map(a => (
                  <button key={a.kind} className="s-chip" disabled={!!busy || !ollama?.ok}
                    title={ollama?.ok ? '' : 'Ollama 가 꺼져 있습니다'}
                    onClick={() => assist(a.kind)}>
                    {busy === a.kind ? '고치는 중…' : a.label}
                  </button>
                ))}
                <button className="s-chip" disabled={!!busy} onClick={evidence}>
                  {busy === 'evidence' ? '찾는 중…' : '근거 찾기'}
                </button>
              </div>

              {sug && (
                <div style={{
                  marginTop: 12, padding: 12, borderRadius: 10,
                  background: 'var(--s-interp-soft)', border: '1px solid var(--s-interp)',
                }}>
                  <div style={{ fontSize: 12, color: 'var(--s-interp)', fontWeight: 600 }}>
                    ※ {sug.label} 제안 · {sug.model}
                    {sug.truncated && ' · 끝 끊김'}
                  </div>
                  {!!sug.lost_citations.length && (
                    <div style={{ fontSize: 13, color: 'var(--error)', marginTop: 4 }}>
                      ⚠ {sug.note}
                    </div>
                  )}
                  <div style={{ fontSize: 14.5, lineHeight: 1.85, marginTop: 7, whiteSpace: 'pre-wrap' }}>
                    {sug.suggestion}
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button className="s-chip" onClick={applySug}>고른 자리에 바꿔 넣기</button>
                    <button className="s-chip" onClick={() => addComment(sug.suggestion, 'ai', sug.kind)}>
                      댓글로만 달기
                    </button>
                    <button className="s-chip" onClick={() => setSug(null)}>버리기</button>
                  </div>
                </div>
              )}

              {evid && (
                <div style={{ marginTop: 12 }}>
                  {!evid.enough
                    ? <p className="s-interp" style={{ fontSize: 14 }}>※ {evid.note}</p>
                    : <div style={{ fontSize: 13, color: 'var(--ink-3)', marginBottom: 5 }}>
                        이 문장을 뒷받침하는 대목 {evid.hits.length}개
                      </div>}
                  {evid.hits.map((h, i) => (
                    <div key={h.id} className="s-src" style={{ padding: 9, marginBottom: 5 }}>
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <span style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>
                          [{i + 1}] {h.doc}{h.page ? ` p.${h.page}` : ''} · 유사도 {h.sim}
                        </span>
                        <button className="s-chip shrink-0" style={{ fontSize: 11.5, padding: '3px 8px' }}
                          onClick={() => insertHit(h)}>인용 넣기</button>
                      </div>
                      <p style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 4, lineHeight: 1.7 }}>
                        {h.text.slice(0, 220)}…
                      </p>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2 mt-3">
                <input className="s-input" value={cmBody} placeholder="이 문장에 댓글"
                  onChange={e => setCmBody(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addComment(cmBody); } }} />
                <button className="s-chip" onClick={() => addComment(cmBody)}>달기</button>
              </div>
            </div>
          )}
        </div>

        {/* ══ 오른쪽: 넣을 것 · 댓글 ══ */}
        <div className="col-span-12 lg:col-span-3 space-y-3">
          <div className="s-panel" style={{ padding: 14 }}>
            <div style={{ fontSize: 14.5, fontWeight: 700 }}>내 발췌 {clips.length}</div>
            <p style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 3, lineHeight: 1.6 }}>
              노트북에서 담은 것입니다. 누르면 커서 자리에 원문과 <code>[@key]</code> 가 들어갑니다.
            </p>
            <div className="space-y-1 mt-2" style={{ maxHeight: '30vh', overflowY: 'auto' }}>
              {!clips.length && (
                <p style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>
                  아직 없습니다 — 노트북에서 담으세요.
                </p>
              )}
              {clips.map(c => (
                <div key={c.id} className="s-src" style={{ padding: 8 }}>
                  <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>
                    {c.section} · {c.cite_key}{c.page ? ` p.${c.page}` : ''}
                    {c.used && ' · 넣음'}
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--ink-2)', marginTop: 3, lineHeight: 1.6 }}>
                    {c.text.slice(0, 80)}…
                  </div>
                  <button className="s-chip mt-1" style={{ fontSize: 11.5, padding: '3px 8px' }}
                    disabled={!path} onClick={() => insertClip(c)}>넣기</button>
                </div>
              ))}
            </div>
          </div>

          <div className="s-panel" style={{ padding: 14 }}>
            <div style={{ fontSize: 14.5, fontWeight: 700 }}>색인에서 찾기</div>
            <form onSubmit={search} className="flex gap-1 mt-2">
              <input className="s-input" style={{ fontSize: 13, padding: '6px 9px' }} value={q}
                placeholder="넣을 근거 찾기" onChange={e => setQ(e.target.value)} />
              <button type="submit" className="s-chip" style={{ fontSize: 12 }} disabled={!!busy}>
                {busy === 'search' ? '…' : '찾기'}
              </button>
            </form>
            <div className="space-y-1 mt-2" style={{ maxHeight: '28vh', overflowY: 'auto' }}>
              {found?.map((h, i) => (
                <div key={h.id} className="s-src" style={{ padding: 8 }}>
                  <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>
                    [{i + 1}] {h.doc}{h.page ? ` p.${h.page}` : ''} · {h.sim}
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--ink-2)', marginTop: 3, lineHeight: 1.6 }}>
                    {h.text.slice(0, 90)}…
                  </div>
                  <button className="s-chip mt-1" style={{ fontSize: 11.5, padding: '3px 8px' }}
                    disabled={!path} onClick={() => insertHit(h)}>넣기</button>
                </div>
              ))}
              {found && !found.length && (
                <p style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>맞는 대목이 없습니다.</p>
              )}
            </div>
          </div>

          <div className="s-panel" style={{ padding: 14 }}>
            <div style={{ fontSize: 14.5, fontWeight: 700 }}>
              댓글 {live.length}{comments.length !== live.length ? ` / ${comments.length}` : ''}
            </div>
            <div className="space-y-2 mt-2" style={{ maxHeight: '36vh', overflowY: 'auto' }}>
              {!comments.length && (
                <p style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>
                  문장을 고르고 댓글을 달면 여기 쌓입니다.
                </p>
              )}
              {comments.map(c => (
                <div key={c.id} className="s-src" style={{
                  padding: 9, opacity: c.resolved ? 0.55 : 1,
                  borderLeft: `4px solid ${c.by === 'ai' ? 'var(--s-interp)' : 'var(--s-accent)'}`,
                }}>
                  <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>
                    {c.by === 'ai' ? '※ AI' : '내 메모'}{c.kind ? ` · ${c.kind}` : ''}
                    {!c.found && <span style={{ color: 'var(--s-interp)' }}> · 길 잃음(문장이 바뀜)</span>}
                    {c.ambiguous && <span style={{ color: 'var(--s-interp)' }}> · 같은 문장이 여럿</span>}
                  </div>
                  <div style={{
                    fontSize: 12, color: 'var(--ink-3)', marginTop: 3, paddingLeft: 7,
                    borderLeft: '2px solid var(--s-line)', lineHeight: 1.55,
                  }}>{c.quote.slice(0, 70)}…</div>
                  <div style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 5, lineHeight: 1.7 }}>
                    {c.body}
                  </div>
                  <div className="flex gap-1 mt-2">
                    <button className="s-chip" style={{ fontSize: 11, padding: '2px 7px' }}
                      onClick={() => resolveComment(c)}>{c.resolved ? '다시 열기' : '해결'}</button>
                    <button className="s-chip" style={{ fontSize: 11, padding: '2px 7px', color: 'var(--error)' }}
                      onClick={() => delComment(c)}>삭제</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      )}
    </>
  );
}
