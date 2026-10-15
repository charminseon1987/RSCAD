/* 지식화 — GFM_Research 볼트를 Obsidian 처럼 본다.
   좌: 볼트 트리 / 중앙: 그래프 · 노트 · 표 / 우: 백링크 · frontmatter
   링크 해석(공백↔언더스코어 정규화, 중복 해소, 미작성 판정)은 서버가 끝내서 보낸다. */
import { useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide,
  type SimulationNodeDatum,
} from 'd3-force';
import { useSearchParams } from 'react-router-dom';
import { fetchJSON } from '../lib/api';

/* ── 타입 ── */
interface TreeNote {
  path: string; name: string; title: string; mtime: number;
  backlinks: number; outlinks: number; frontmatter: Record<string, any>;
}
interface Folder { folder: string; count: number; notes: TreeNote[] }
interface Tree { total: number; excluded: string[]; folders: Folder[] }

interface GNode extends SimulationNodeDatum {
  id: string; path: string | null; name: string; title: string;
  folder: string; backlinks: number; exists: boolean;
}
interface GEdge { from: string; to: string; resolved: boolean }
interface Graph {
  nodes: GNode[]; edges: GEdge[];
  stats: { notes: number; missing: number; edges: number; resolved: number; unresolved: number };
}

interface Outlink { text: string; path: string | null; resolved: boolean }
interface NoteDetail {
  path: string; title: string; folder: string; mtime: number;
  frontmatter: Record<string, any>; body: string;
  outlinks: Outlink[]; backlinks: { path: string; title: string }[];
  ambiguous: boolean;
}

/* ── 폴더 색 — 그래프 노드 색과 트리 배지에 같이 쓴다 ── */
const FOLDER_COLORS: [RegExp, string][] = [
  [/01_개념/, '#4f8ef7'],
  [/02_방법론/, '#12b886'],
  [/00_MOC/, '#ae7bff'],
  [/Phase0/, '#f59f00'],
  [/literature|06_문헌/, '#e8590c'],
  [/claims/, '#e64980'],
  [/ToDoList|00_Raw/, '#868e96'],
];
/* 범례이자 필터. 키는 FOLDER_COLORS 의 패턴과 같은 것을 쓴다 —
   두 군데서 따로 정하면 색과 필터가 어긋난다. */
const GROUPS: { key: string; label: string; re: RegExp }[] = [
  { key: '01_개념', label: '개념', re: /01_개념/ },
  { key: '02_방법론', label: '방법론', re: /02_방법론/ },
  { key: '00_MOC', label: 'MOC', re: /00_MOC/ },
  { key: 'Phase0', label: 'Phase', re: /Phase0/ },
  { key: 'literature', label: '문헌', re: /literature|06_문헌/ },
  { key: 'claims', label: '주장', re: /claims/ },
];
const ETC = '기타';

const groupOf = (folder: string) =>
  GROUPS.find(g => g.re.test(folder))?.key ?? ETC;

const colorOf = (folder: string, exists = true) => {
  if (!exists) return 'var(--outline-variant)';
  for (const [re, c] of FOLDER_COLORS) if (re.test(folder)) return c;
  return '#748ffc';
};

const VIEWS = [
  { key: 'graph', label: '그래프' },
  { key: 'note', label: '노트' },
  { key: 'table', label: '표' },
] as const;
type View = typeof VIEWS[number]['key'];

/* [[링크]] 를 마크다운 링크로 바꿔 ReactMarkdown 이 앵커로 렌더하게 한다.
   href 는 #wiki: 접두를 붙여 클릭을 가로챈다. */
function wikiToMarkdown(body: string) {
  return body.replace(/\[\[([^\]\[]+)\]\]/g, (_m, inner: string) => {
    const [rawTarget, alias] = inner.split('|');
    const target = rawTarget.split('#')[0].trim();
    const label = (alias || rawTarget).trim();
    return `[${label}](#wiki:${encodeURIComponent(target)})`;
  });
}

/* 문단·항목의 첫 글자가 ▸ 면 사실, ※ 면 해석. 볼트의 표기 규칙 그대로. */
function markClass(children: React.ReactNode): string | undefined {
  const first = Array.isArray(children) ? children[0] : children;
  if (typeof first !== 'string') return undefined;
  const s = first.trimStart();
  if (s.startsWith('▸')) return 'fact';
  if (s.startsWith('※')) return 'interp';
  return undefined;
}

/* ── 힘 기반 그래프 (자체 SVG — Lab 의 ComboChart 와 같은 방식) ── */
function ForceGraph({ graph, onPick, active }: {
  graph: Graph; onPick: (path: string) => void; active: string | null;
}) {
  const W = 900, H = 560;
  const [tick, setTick] = useState(0);
  const [hover, setHover] = useState<string | null>(null);
  const simRef = useRef<{ nodes: GNode[]; links: any[] } | null>(null);

  useEffect(() => {
    const nodes: GNode[] = graph.nodes.map(n => ({ ...n }));
    const byId = new Map(nodes.map(n => [n.id, n]));
    const links = graph.edges
      .filter(e => byId.has(e.from) && byId.has(e.to))
      .map(e => ({ source: byId.get(e.from)!, target: byId.get(e.to)!, resolved: e.resolved }));

    const sim = forceSimulation(nodes)
      .force('link', forceLink(links).distance(70).strength(0.35))
      .force('charge', forceManyBody().strength(-240))
      .force('center', forceCenter(W / 2, H / 2))
      .force('collide', forceCollide<GNode>().radius(d => 8 + Math.sqrt(d.backlinks) * 2.6))
      .stop();

    // 애니메이션 없이 한 번에 수렴시킨다 — 86 노드 규모라 즉시 끝난다
    for (let i = 0; i < 320; i++) sim.tick();

    simRef.current = { nodes, links };
    setTick(t => t + 1);
  }, [graph]);

  const s = simRef.current;
  if (!s) return <p className="mono-clock" style={{ color: 'var(--outline)' }}>레이아웃 계산 중...</p>;

  /* viewBox 를 절대 min/max 로 잡으면 척력에 멀리 튕긴 노드 서넛이 화면을
     통째로 늘려서, 정작 읽어야 할 가운데 뭉치가 점이 된다 (노트 106개일 때
     실제로 그랬다). 백분위로 자른다 — 2~98% 범위를 담고, 밖으로 나간 노드는
     가장자리에 걸쳐 보이되 배율을 지배하지 못한다. */
  const span = (vals: number[]) => {
    const v = [...vals].sort((a, b) => a - b);
    const at = (q: number) => v[Math.min(v.length - 1, Math.max(0, Math.round((v.length - 1) * q)))];
    const lo = at(0.02), hi = at(0.98);
    return hi - lo < 1 ? [lo - 100, hi + 100] : [lo, hi];
  };
  const [loX, hiX] = span(s.nodes.map(n => n.x || 0));
  const [loY, hiY] = span(s.nodes.map(n => n.y || 0));
  const pad = 40;
  const minX = loX - pad, maxX = hiX + pad;
  const minY = loY - pad, maxY = hiY + pad;

  const r = (n: GNode) => (n.exists ? 4 + Math.sqrt(n.backlinks) * 2.4 : 3.5);
  const hub = [...s.nodes].filter(n => n.exists).sort((a, b) => b.backlinks - a.backlinks).slice(0, 10);
  const labelled = new Set(hub.map(n => n.id));

  return (
    <svg key={tick} viewBox={`${minX} ${minY} ${maxX - minX} ${maxY - minY}`}
      style={{ width: '100%', height: 560, display: 'block' }}>
      {s.links.map((l, i) => (
        <line key={i} x1={l.source.x} y1={l.source.y} x2={l.target.x} y2={l.target.y}
          stroke={l.resolved ? 'var(--outline-variant)' : 'var(--outline-variant)'}
          strokeWidth={0.6} strokeOpacity={l.resolved ? 0.45 : 0.25}
          strokeDasharray={l.resolved ? undefined : '3 3'} />
      ))}
      {s.nodes.map(n => {
        const isActive = active && n.path === active;
        const isHover = hover === n.id;
        return (
          <g key={n.id}
            onMouseEnter={() => setHover(n.id)} onMouseLeave={() => setHover(null)}
            onClick={() => n.path && onPick(n.path)}
            style={{ cursor: n.path ? 'pointer' : 'default' }}>
            <circle cx={n.x} cy={n.y} r={r(n)}
              fill={n.exists ? colorOf(n.folder) : 'transparent'}
              stroke={isActive ? 'var(--primary)' : n.exists ? 'none' : 'var(--outline-variant)'}
              strokeWidth={isActive ? 2.5 : 1}
              strokeDasharray={n.exists ? undefined : '2 2'}
              opacity={isHover || isActive ? 1 : 0.85} />
            {(labelled.has(n.id) || isHover || isActive) && (
              <text x={(n.x || 0) + r(n) + 3} y={(n.y || 0) + 3}
                style={{ fontSize: 14, fill: 'var(--on-surface-variant)', pointerEvents: 'none' }}>
                {n.name.length > 22 ? n.name.slice(0, 21) + '…' : n.name}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/* ── 화면 ── */
export default function Knowledge() {
  const [tree, setTree] = useState<Tree | null>(null);
  const [graph, setGraph] = useState<Graph | null>(null);
  const [note, setNote] = useState<NoteDetail | null>(null);
  const [view, setView] = useState<View>('graph');

  /* 그래프 필터 — 106개를 한 번에 그리면 읽을 수 없다. 기본값은 전부 켜 둔다:
     볼트 전체를 보는 도구라 처음부터 숨기면 "없는 줄" 알게 된다. 대신 끌 수
     있게 하고, 몇 개가 보이는지 숫자로 띄운다. */
  const [off, setOff] = useState<Set<string>>(new Set());
  const [hideStub, setHideStub] = useState(false);   // 미작성(링크만 있는) 노드
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<any[] | null>(null);
  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({});
  const [err, setErr] = useState('');

  const [params] = useSearchParams();

  useEffect(() => {
    fetchJSON('/vault/tree').then(setTree).catch(() => setErr('볼트 트리를 불러오지 못했습니다 — Flask 가 떠 있는지 확인하세요.'));
    fetchJSON('/vault/graph').then(setGraph).catch(() => {});
  }, []);

  // 메인 검색에서 넘어온 노트를 바로 연다
  useEffect(() => {
    const target = params.get('note');
    if (!target) return;
    setView('note');
    fetchJSON('/vault/note?path=' + encodeURIComponent(target)).then(setNote).catch(() => {});
  }, [params]);

  const openNote = (path: string) => {
    setView('note');
    fetchJSON('/vault/note?path=' + encodeURIComponent(path))
      .then(setNote)
      .catch(() => setNote(null));
  };

  const runSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (q.trim().length < 2) { setHits(null); return; }
    fetchJSON('/vault/search?q=' + encodeURIComponent(q.trim()))
      .then(d => setHits(d.hits || []))
      .catch(() => setHits([]));
  };

  /* 노트 본문의 [[링크]] 클릭 → 해석된 경로로 이동 */
  const linkMap = useMemo(() => {
    const m = new Map<string, string | null>();
    note?.outlinks.forEach(o => m.set(o.text, o.path));
    return m;
  }, [note]);

  const mdBody = useMemo(() => (note ? wikiToMarkdown(note.body) : ''), [note]);

  const allNotes = useMemo(
    () => (tree ? tree.folders.flatMap(f => f.notes.map(n => ({ ...n, folder: f.folder }))) : []),
    [tree],
  );

  /* 폴더별 노드 수 — 칩에 띄워서 "끄면 몇 개가 사라지는지" 를 먼저 보여 준다 */
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const n of graph?.nodes || []) m.set(groupOf(n.folder), (m.get(groupOf(n.folder)) || 0) + 1);
    return m;
  }, [graph]);

  /* 화면에 그릴 그래프. 끈 폴더의 노드를 빼고, 그 노드에 걸린 링크도 함께 뺀다 —
     한쪽 끝이 사라진 선을 남기면 허공으로 뻗은 선이 된다. */
  const shown = useMemo<Graph>(() => {
    const empty = { nodes: [], edges: [], stats: { notes: 0, missing: 0, edges: 0, resolved: 0, unresolved: 0 } };
    if (!graph) return empty;
    const nodes = graph.nodes.filter(n =>
      !off.has(groupOf(n.folder)) && !(hideStub && !n.exists));
    const ids = new Set(nodes.map(n => n.id));
    const edges = graph.edges.filter(e => ids.has(e.from) && ids.has(e.to));
    return { nodes, edges, stats: graph.stats };
  }, [graph, off, hideStub]);

  return (
    <div className="max-w-[1600px] mx-auto px-10 py-10 space-y-7">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-display" style={{ color: 'var(--primary)', fontSize: 28 }}>지식화</h1>
          <p className="mono-clock mt-1" style={{ color: 'var(--outline)', fontSize: 17 }}>
            {tree ? `노트 ${tree.total}` : '…'}
            {graph && ` · 링크 ${graph.stats.edges} (해석 ${graph.stats.resolved} · 미작성 ${graph.stats.missing})`}
          </p>
        </div>
        <div className="flex gap-0.5 p-1 rounded-xl" style={{ background: 'var(--surface-container)' }}>
          {VIEWS.map(v => (
            <button key={v.key} onClick={() => setView(v.key)}
              className="mono-label px-3 py-1.5 rounded-lg transition-all duration-200"
              style={{
                fontSize: 15,
                color: view === v.key ? 'var(--primary)' : 'var(--outline)',
                background: view === v.key ? 'var(--surface-container-lowest)' : 'transparent',
                border: view === v.key ? '1px solid var(--border)' : '1px solid transparent',
              }}>
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {err && <p className="mono-clock" style={{ color: 'var(--error)', fontSize: 17 }}>{err}</p>}

      <div className="grid grid-cols-12 gap-6">
        {/* ── 좌: 볼트 트리 ── */}
        <div className="col-span-12 lg:col-span-3 glass-card" style={{ padding: 16 }}>
          <form onSubmit={runSearch}>
            <input className="mc-input w-full" style={{ fontSize: 17 }}
              value={q} onChange={e => setQ(e.target.value)}
              placeholder="본문 검색 (2자 이상)" />
          </form>

          {hits && (
            <div className="mt-3">
              <span className="mono-label" style={{ fontSize: 15, color: 'var(--primary)' }}>검색 {hits.length}건</span>
              <button onClick={() => { setHits(null); setQ(''); }}
                className="mono-label ml-2" style={{ fontSize: 15, color: 'var(--outline)' }}>지우기</button>
              <div className="space-y-1 mt-2" style={{ maxHeight: 460, overflowY: 'auto' }}>
                {hits.map(h => (
                  <button key={h.path} onClick={() => openNote(h.path)}
                    className="w-full text-left p-2 rounded-lg"
                    style={{ background: 'var(--surface-container-low)', border: '1px solid var(--border)' }}>
                    <div className="mono-clock truncate" style={{ fontSize: 15, color: 'var(--on-surface)' }}>{h.title}</div>
                    <div className="mono-clock truncate" style={{ fontSize: 15, color: 'var(--outline)' }}>{h.folder} · {h.count}회</div>
                  </button>
                ))}
                {!hits.length && <p className="mono-clock" style={{ fontSize: 15, color: 'var(--outline)' }}>결과 없음</p>}
              </div>
            </div>
          )}

          {!hits && (
            <div className="mt-3 space-y-1" style={{ maxHeight: 520, overflowY: 'auto' }}>
              {tree?.folders.map(f => {
                const open = openFolders[f.folder] ?? f.count <= 8;
                return (
                  <div key={f.folder}>
                    <button onClick={() => setOpenFolders(s => ({ ...s, [f.folder]: !open }))}
                      className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg"
                      style={{ background: 'var(--surface-container-low)' }}>
                      <span className="mono-clock truncate" style={{ fontSize: 15, color: 'var(--on-surface)' }}>
                        <span style={{ color: colorOf(f.folder) }}>●</span> {f.folder}
                      </span>
                      <span className="mono-label" style={{ fontSize: 15, color: 'var(--outline)' }}>{f.count}</span>
                    </button>
                    {open && f.notes.map(n => (
                      <button key={n.path} onClick={() => openNote(n.path)}
                        className="w-full text-left pl-5 pr-2 py-1 rounded"
                        style={{ background: note?.path === n.path ? 'var(--primary-container)' : 'transparent' }}>
                        <span className="mono-clock block truncate" style={{ fontSize: 15, color: 'var(--on-surface-variant)' }}>
                          {n.name}
                        </span>
                      </button>
                    ))}
                  </div>
                );
              })}
              {tree && (
                <p className="mono-clock mt-3" style={{ fontSize: 15, color: 'var(--outline)', lineHeight: 1.6 }}>
                  제외: {tree.excluded.join(' · ')}
                </p>
              )}
            </div>
          )}
        </div>

        {/* ── 중앙: 그래프 / 노트 / 표 ── */}
        <div className="col-span-12 lg:col-span-6 glass-card" style={{ padding: 20, minHeight: 620 }}>
          {view === 'graph' && (graph ? (
            <>
              <div className="flex items-center justify-between mb-2">
                <span className="mono-label" style={{ color: 'var(--primary)', fontSize: 16 }}>지식 그래프</span>
                <span className="mono-clock" style={{ color: 'var(--outline)', fontSize: 15 }}>
                  크기 = 백링크 수 · 점선 = 아직 안 쓴 노트 · 클릭하면 열린다
                </span>
              </div>
              <ForceGraph graph={shown} active={note?.path ?? null} onPick={openNote} />

              {/* 범례가 곧 필터다. 색과 끄고 켜는 자리가 같아야 "이 색이 뭐였지" 가 없다. */}
              <div className="flex flex-wrap items-center gap-2 mt-2">
                {[...GROUPS, { key: ETC, label: ETC, re: /(?:)/ }].map(g => {
                  const n = counts.get(g.key) || 0;
                  const on = !off.has(g.key);
                  return (
                    <button key={g.key} className={'s-chip s-chip-sm' + (on ? ' s-chip-on' : '')}
                      aria-pressed={on} disabled={!n}
                      title={n ? `${g.label} ${n}개 — 눌러서 숨기기` : '이 폴더에 노트가 없습니다'}
                      onClick={() => setOff(s => {
                        const t = new Set(s);
                        t.has(g.key) ? t.delete(g.key) : t.add(g.key);
                        return t;
                      })}>
                      <span style={{ color: colorOf(g.key), opacity: on ? 1 : .35 }}>●</span>{' '}
                      {g.label} <span style={{ opacity: .6 }}>{n}</span>
                    </button>
                  );
                })}
                <button className={'s-chip s-chip-sm' + (hideStub ? ' s-chip-on' : '')}
                  aria-pressed={hideStub} onClick={() => setHideStub(v => !v)}
                  title="[[링크]]만 있고 아직 쓰지 않은 노트를 숨깁니다">
                  미작성 숨기기 <span style={{ opacity: .6 }}>{graph.stats.missing}</span>
                </button>
              </div>
              <p className="mono-clock mt-2" style={{ fontSize: 15, color: 'var(--outline)' }}>
                보이는 노트 {shown.nodes.length} / {graph.nodes.length} · 링크 {shown.edges.length} / {graph.edges.length}
                {shown.nodes.length === graph.nodes.length && graph.nodes.length > 60
                  && ' — 한 번에 다 그리면 겹쳐 보입니다. 위에서 폴더를 꺼 보세요.'}
              </p>
            </>
          ) : <p className="mono-clock" style={{ color: 'var(--outline)' }}>그래프를 불러오는 중...</p>)}

          {view === 'note' && (note ? (
            <>
              <span className="mono-label" style={{ color: 'var(--primary)', fontSize: 16 }}>{note.title}</span>
              <p className="mono-clock mt-0.5" style={{ color: 'var(--outline)', fontSize: 15 }}>{note.path}</p>

              <div className="knowledge-md mt-4" style={{ maxHeight: 520, overflowY: 'auto' }}>
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    a: ({ href, children }) => {
                      if (href?.startsWith('#wiki:')) {
                        const target = decodeURIComponent(href.slice(6));
                        const path = linkMap.get(target);
                        if (path) {
                          return (
                            <a onClick={e => { e.preventDefault(); openNote(path); }}
                              style={{ color: 'var(--primary)', cursor: 'pointer', textDecoration: 'none', borderBottom: '1px solid var(--primary)' }}>
                              {children}
                            </a>
                          );
                        }
                        return (
                          <span title="아직 없는 노트"
                            style={{ color: 'var(--outline-variant)', borderBottom: '1px dashed var(--outline-variant)' }}>
                            {children}
                          </span>
                        );
                      }
                      return <a href={href} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)' }}>{children}</a>;
                    },
                    // ▸ 사실 / ※ 해석 — 볼트의 표기 규칙을 화면에서도 구분한다
                    p: ({ children }) => <p className={markClass(children)}>{children}</p>,
                    li: ({ children }) => <li className={markClass(children)}>{children}</li>,
                  }}>
                  {mdBody}
                </ReactMarkdown>
              </div>
            </>
          ) : <p className="mono-clock" style={{ color: 'var(--outline)' }}>왼쪽 트리나 그래프에서 노트를 고르세요.</p>)}

          {view === 'table' && (
            <>
              <span className="mono-label" style={{ color: 'var(--primary)', fontSize: 16 }}>노트 표 — frontmatter 기준</span>
              <div style={{ maxHeight: 560, overflow: 'auto' }} className="mt-3">
                <table className="w-full" style={{ borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {['이름', '폴더', 'type', 'status', 'cite_key', '백링크'].map(h => (
                        <th key={h} className="mono-label text-left px-2 py-1"
                          style={{ fontSize: 15, color: 'var(--outline)', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, background: 'var(--surface-container-lowest)' }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {allNotes.sort((a, b) => b.backlinks - a.backlinks).map(n => (
                      <tr key={n.path} onClick={() => openNote(n.path)} style={{ cursor: 'pointer' }}>
                        <td className="mono-clock px-2 py-1 truncate" style={{ fontSize: 15, color: 'var(--on-surface)', maxWidth: 200, borderBottom: '1px solid var(--border)' }}>{n.name}</td>
                        <td className="mono-clock px-2 py-1 truncate" style={{ fontSize: 15, color: 'var(--outline)', maxWidth: 140, borderBottom: '1px solid var(--border)' }}>{n.folder}</td>
                        <td className="mono-clock px-2 py-1" style={{ fontSize: 15, color: 'var(--on-surface-variant)', borderBottom: '1px solid var(--border)' }}>{n.frontmatter?.type ?? '—'}</td>
                        <td className="mono-clock px-2 py-1" style={{ fontSize: 15, color: 'var(--on-surface-variant)', borderBottom: '1px solid var(--border)' }}>{n.frontmatter?.status ?? '—'}</td>
                        <td className="mono-clock px-2 py-1 truncate" style={{ fontSize: 15, color: 'var(--on-surface-variant)', maxWidth: 140, borderBottom: '1px solid var(--border)' }}>{n.frontmatter?.cite_key ?? '—'}</td>
                        <td className="mono-metric px-2 py-1" style={{ fontSize: 16, color: 'var(--primary)', borderBottom: '1px solid var(--border)' }}>{n.backlinks}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* ── 우: 백링크 · frontmatter ── */}
        <div className="col-span-12 lg:col-span-3 glass-card" style={{ padding: 16 }}>
          {note ? (
            <>
              <span className="mono-label" style={{ color: 'var(--primary)', fontSize: 16 }}>frontmatter</span>
              {Object.keys(note.frontmatter).length ? (
                <table className="w-full mt-2">
                  <tbody>
                    {Object.entries(note.frontmatter).map(([k, v]) => (
                      <tr key={k}>
                        <td className="mono-clock px-1 py-0.5 align-top" style={{ fontSize: 15, color: 'var(--outline)', whiteSpace: 'nowrap' }}>{k}</td>
                        <td className="mono-clock px-1 py-0.5" style={{ fontSize: 15, color: 'var(--on-surface-variant)', wordBreak: 'break-word' }}>
                          {Array.isArray(v) ? v.join(', ') : String(v)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="mono-clock mt-2" style={{ fontSize: 15, color: 'var(--outline)' }}>없음</p>
              )}

              <div className="mt-4">
                <span className="mono-label" style={{ color: 'var(--primary)', fontSize: 16 }}>
                  백링크 {note.backlinks.length}
                </span>
                <div className="space-y-1 mt-2" style={{ maxHeight: 200, overflowY: 'auto' }}>
                  {note.backlinks.map(b => (
                    <button key={b.path} onClick={() => openNote(b.path)}
                      className="w-full text-left px-2 py-1 rounded"
                      style={{ background: 'var(--surface-container-low)' }}>
                      <span className="mono-clock block truncate" style={{ fontSize: 15, color: 'var(--on-surface-variant)' }}>{b.title}</span>
                    </button>
                  ))}
                  {!note.backlinks.length && <p className="mono-clock" style={{ fontSize: 15, color: 'var(--outline)' }}>없음</p>}
                </div>
              </div>

              <div className="mt-4">
                <span className="mono-label" style={{ color: 'var(--primary)', fontSize: 16 }}>
                  아웃링크 {note.outlinks.length}
                </span>
                <div className="space-y-1 mt-2" style={{ maxHeight: 200, overflowY: 'auto' }}>
                  {note.outlinks.map((o, i) => (
                    <button key={i} disabled={!o.path} onClick={() => o.path && openNote(o.path)}
                      className="w-full text-left px-2 py-1 rounded"
                      style={{ background: 'var(--surface-container-low)', opacity: o.resolved ? 1 : 0.5 }}>
                      <span className="mono-clock block truncate"
                        style={{ fontSize: 15, color: o.resolved ? 'var(--on-surface-variant)' : 'var(--outline-variant)' }}>
                        {o.resolved ? '' : '⌀ '}{o.text}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <p className="mono-clock" style={{ fontSize: 16, color: 'var(--outline)', lineHeight: 1.8 }}>
              노트를 고르면 frontmatter · 백링크 · 아웃링크가 여기 표시됩니다.
              <br /><br />
              ⌀ 표시는 링크는 걸려 있는데 아직 그 노트가 없다는 뜻입니다.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
