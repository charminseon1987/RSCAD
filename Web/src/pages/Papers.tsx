/* 논문-리서치 — lab-scholar 화면 시안(docs/design/scholar-prototype.html) 구조를 그대로 옮긴 것.
   좌측 레일 + 화면 4개: 검색·답변 / 비교표 / 라이브러리 / 수집 워크플로

   시안의 핵심 규칙을 지킨다:
     ▸ fact  — 논문 근거. 출처 번호가 반드시 붙는다.
     ※ interp — AI 종합 해석. 출처가 없다는 것을 색과 점선으로 알린다.
   지금은 볼트의 실제 노트(/api/notes · /api/vault/search)로 채운다. */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { fetchJSON } from '../lib/api';

interface Note { name: string; title: string; category: string; path: string; size: number; mtime: number }
interface Hit { path: string; title: string; folder: string; count: number; snippet: string }
interface Scholar { root: string; stages: { stage: string; title: string }[]; prototype: string | null; files: string[] }

const RAIL = [
  { key: 'search', label: '검색·답변' },
  { key: 'compare', label: '비교표' },
  { key: 'library', label: '라이브러리' },
  { key: 'flow', label: '수집 워크플로' },
] as const;
type Screen = typeof RAIL[number]['key'];

const FILTERS = ['최근 5년', 'Q1 저널만', 'IEEE Trans.', '오픈액세스만', '프리프린트 제외'];

/* 시안의 폴더 구성. 석사·박사는 category 로 갈리지 않으므로 제목·경로 키워드로 판별한다. */
const MASTER_RE = /ZEB|BIPV|nZEB|자립률|건물일체|경제성|LCOE|NPV/i;
const PHD_RE = /GFM|grid.?forming|VSG|SCR|야코비안|고유값|안정도|인버터|커플링|PSO/i;

const FOLDERS = [
  { key: 'all', label: '전체', hint: '볼트에 잡히는 모든 노트' },
  { key: 'phd', label: '박사 · GFM 안정도', hint: '문헌 노트 + GFM 키워드' },
  { key: 'master', label: '석사 · ZEB PV/BIPV', hint: 'ZEB · BIPV · 자립률 · 경제성' },
  { key: 'claim', label: '주장 · 근거', hint: '00_Knowledge/claims' },
  { key: 'inbox', label: '수집 인박스', hint: 'Phase 노트 — 아직 정리 전' },
] as const;

const inFolder = (n: { title: string; path: string; category: string }, key: string) => {
  const hay = `${n.title} ${n.path}`;
  switch (key) {
    case 'all': return true;
    case 'phd': return n.category === 'literature' || PHD_RE.test(hay);
    case 'master': return MASTER_RE.test(hay);
    case 'claim': return n.category === 'claim';
    case 'inbox': return n.category === 'phase';
    default: return true;
  }
};

/* 비교표 — 시안의 두 묶음 */
const COMPARE_SETS = [
  { key: 'gfm', label: 'GFM · 계통 안정도 항목', cols: ['시스템 구성', '계통 조건', '제어 구조', '안정도 해석', '검증'] },
  { key: 'zeb', label: 'PV/BIPV · ZEB 항목', cols: ['입지 · 기상', '용량 산정', '경제성 지표', '계통 영향'] },
] as const;

const HIGHLIGHT = [
  { color: '#e03131', callout: 'danger', mean: '핵심 · 논쟁 지점' },
  { color: '#f59f00', callout: 'warning', mean: '인용 후보' },
  { color: '#1c7ed6', callout: 'tip', mean: '방법 · 수식' },
  { color: '#ae3ec9', callout: 'question', mean: '내 의문' },
  { color: '#868e96', callout: 'note', mean: '배경' },
];

const STEPS = [
  { n: '①', title: 'Zotero 수집', tool: 'Connector · Zotmoov · Better BibTeX' },
  { n: '②', title: '읽고 색으로 표시', tool: '5색 규칙 = 분류' },
  { n: '③', title: 'Obsidian 가져오기', tool: 'Zotero Integration → 06_문헌/@citekey.md' },
  { n: '④', title: '연결하고 초안', tool: 'Pandoc Reference List · Copy Block Link' },
  { n: '⑤', title: 'DOCX 내보내기', tool: 'pandoc + zotero.lua + Better CSL YAML' },
];

const PANDOC_CMD =
  'pandoc --lua-filter=zotero.lua \\\n  --bibliography=library.yaml --citeproc \\\n  -o manuscript.docx manuscript.md';

export default function Papers() {
  const { screen: raw } = useParams();
  const screen: Screen = (RAIL.some(r => r.key === raw) ? raw : 'search') as Screen;
  const [notes, setNotes] = useState<Note[]>([]);
  const [scholar, setScholar] = useState<Scholar | null>(null);
  const [tpl, setTpl] = useState('');
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState('');

  // 검색·답변
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [hot, setHot] = useState<number | null>(null);

  // 원본 노트 드로어 — 출처나 답변을 누르면 그 자리에서 원문을 편다
  const [drawer, setDrawer] = useState<{ path: string; title: string } | null>(null);
  const [drawerBody, setDrawerBody] = useState('');
  const navigate = useNavigate();

  // 라이브러리
  const [folder, setFolder] = useState<string>('all');
  const [openNote, setOpenNote] = useState<Note | null>(null);
  const [body, setBody] = useState('');

  // 비교표
  const [cset, setCset] = useState<string>('gfm');
  const [cells, setCells] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchJSON('/notes').then(d => setNotes(d.notes || []))
      .catch(() => setErr('노트를 불러오지 못했습니다 — Flask 가 떠 있는지 확인하세요.'));
    fetchJSON('/scholar').then(setScholar).catch(() => {});
    fetchJSON('/note?path=' + encodeURIComponent('RSCAD/05_템플릿/Zotero 문헌노트.md'))
      .then(d => setTpl(d.content || '')).catch(() => {});
  }, []);

  const ask = (e: React.FormEvent) => {
    e.preventDefault();
    if (q.trim().length < 2) return;
    setBusy(true); setHot(null);
    fetchJSON('/vault/search?q=' + encodeURIComponent(q.trim()))
      .then(d => setHits(d.hits || []))
      .catch(() => setHits([]))
      .finally(() => setBusy(false));
  };

  const openOriginal = (path: string, title: string) => {
    setDrawer({ path, title });
    setDrawerBody('불러오는 중...');
    fetchJSON('/note?path=' + encodeURIComponent(path))
      .then(d => setDrawerBody(d.content || ''))
      .catch(() => setDrawerBody('원본을 불러오지 못했습니다.'));
  };

  useEffect(() => {
    if (!drawer) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setDrawer(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawer]);

  const loadNote = (n: Note) => {
    setOpenNote(n); setBody('불러오는 중...');
    fetchJSON('/note?path=' + encodeURIComponent(n.path))
      .then(d => setBody(d.content || '')).catch(() => setBody('불러오지 못했습니다.'));
  };

  const libRows = useMemo(() => notes.filter(n => inFolder(n, folder)), [notes, folder]);
  const folderCount = (k: string) => notes.filter(n => inFolder(n, k)).length;
  const phd = useMemo(() => notes.filter(n => inFolder(n, 'phd')), [notes]);
  const master = useMemo(() => notes.filter(n => inFolder(n, 'master')), [notes]);
  const lit = useMemo(() => notes.filter(n => n.category === 'literature'), [notes]);
  // 비교표 행은 묶음에 맞춰 바뀐다 — ZEB 묶음에 GFM 논문을 늘어놓으면 표가 거짓이 된다
  const cmpRows = cset === 'zeb' ? master : phd;
  const activeSet = COMPARE_SETS.find(s => s.key === cset)!;

  const cell = (row: string, col: string) => cells[`${cset}|${row}|${col}`] ?? '';
  const setCell = (row: string, col: string, v: string) =>
    setCells(s => ({ ...s, [`${cset}|${row}|${col}`]: v }));

  const exportCsv = () => {
    const head = ['논문', ...activeSet.cols];
    const lines = [head.join(',')];
    cmpRows.forEach(n => lines.push([n.name, ...activeSet.cols.map(c => `"${cell(n.name, c).replace(/"/g, '""')}"`)].join(',')));
    const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `비교표_${activeSet.key}.csv`;
    a.click();
  };

  return (
    <div className="scholar max-w-[1600px] mx-auto px-10 py-10">
      <div className="flex items-end justify-between flex-wrap gap-4" style={{ marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--s-accent-ink)' }}>연구실 스콜라</h1>
          <p style={{ fontSize: 15, color: 'var(--ink-3)', marginTop: 4 }}>
            {RAIL.find(r => r.key === screen)?.label} · 박사 {phd.length} · 석사 {master.length} · 주장{' '}
            {notes.filter(n => n.category === 'claim').length} — 볼트의 실제 노트로 채웁니다
          </p>
        </div>
        {scholar?.prototype && (
          <a href={`/scholar/${scholar.prototype}`} target="_blank" rel="noreferrer"
            className="s-chip" style={{ textDecoration: 'none' }}>원본 시안 ↗</a>
        )}
      </div>

      <div className="grid grid-cols-12 gap-6 items-start">

        {/* ── 본문 ── */}
        <main className="col-span-12 space-y-5">
          {err && <p style={{ color: 'var(--error)', fontSize: 15 }}>{err}</p>}

          {/* ═══ 검색 · 답변 ═══ */}
          {screen === 'search' && (
            <>
              <form onSubmit={ask} className="s-panel flex gap-2" style={{ padding: 14 }}>
                <input value={q} onChange={e => setQ(e.target.value)}
                  placeholder="무엇을 알고 싶나요? — 볼트 노트 본문에서 근거를 찾습니다"
                  style={{
                    flex: 1, fontSize: 16, padding: '11px 14px', borderRadius: 10,
                    border: '1px solid var(--s-line)', background: 'var(--s-bg)', color: 'var(--ink)',
                  }} />
                <button type="submit" style={{
                  fontSize: 15, fontWeight: 600, padding: '11px 22px', borderRadius: 10,
                  background: 'var(--s-accent)', color: '#fff', border: 'none', cursor: 'pointer',
                }}>{busy ? '찾는 중' : '질문하기'}</button>
              </form>

              <div className="flex flex-wrap gap-2">
                {FILTERS.map(f => (
                  <button key={f} className="s-chip" aria-pressed={false}
                    title="시안의 필터입니다 — 볼트 검색에는 아직 적용되지 않습니다">{f}</button>
                ))}
              </div>

              <div className="grid grid-cols-12 gap-5">
                <div className="col-span-12 lg:col-span-7 s-panel" style={{ padding: 20 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 10 }}>답변</div>

                  {hits === null ? (
                    <p style={{ fontSize: 15, color: 'var(--ink-3)', lineHeight: 1.9 }}>
                      질문을 입력하면 볼트 노트에서 근거를 찾아 아래에 번호로 붙입니다.
                      <br />▸ 는 노트에서 찾은 근거, ※ 는 종합 해석입니다.
                    </p>
                  ) : hits.length === 0 ? (
                    <p style={{ fontSize: 15, color: 'var(--ink-3)' }}>근거를 찾지 못했습니다.</p>
                  ) : (
                    <>
                      <div className="s-fact">
                        ▸ 볼트에서 <strong>{hits.length}</strong>개 노트가 이 질문과 닿아 있습니다. 가장 많이 언급한 곳은{' '}
                        {hits.slice(0, 3).map((h, i) => (
                          <span key={h.path} className="s-cite" data-hot={hot === i}
                            onMouseEnter={() => setHot(i)} onMouseLeave={() => setHot(null)}>{i + 1}</span>
                        ))}
                        {' '}입니다.
                      </div>
                      {hits.slice(0, 3).map((h, i) => (
                        <div key={h.path} className="s-fact" data-hot={hot === i}
                          onMouseEnter={() => setHot(i)} onMouseLeave={() => setHot(null)}
                          onClick={() => openOriginal(h.path, h.title)}
                          title="클릭하면 원본 노트를 엽니다"
                          style={{ cursor: 'pointer' }}>
                          ▸ {h.snippet ? `…${h.snippet}…` : h.title}
                          <span className="s-cite" data-hot={hot === i}>{i + 1}</span>
                        </div>
                      ))}
                      <div className="s-interp">
                        ※ 위 근거는 <strong>내 볼트 안에서만</strong> 찾은 것입니다. 외부 문헌 검색과 인용 검증은
                        lab-scholar 의 Stage 1(검색 엔진 이식) 이후에 붙습니다 — 지금 답변을 논문 근거로 바로 쓰지 마세요.
                      </div>
                    </>
                  )}
                </div>

                <div className="col-span-12 lg:col-span-5 space-y-3">
                  <div style={{ fontSize: 16, fontWeight: 700 }}>
                    출처 노트 <span style={{ fontSize: 14, color: 'var(--ink-3)', fontWeight: 400 }}>
                      번호에 마우스를 올리면 강조됩니다
                    </span>
                  </div>
                  {(hits ?? []).slice(0, 8).map((h, i) => (
                    <div key={h.path} className="s-src" data-hot={hot === i}
                      onMouseEnter={() => setHot(i)} onMouseLeave={() => setHot(null)}
                      onClick={() => openOriginal(h.path, h.title)}
                      title="클릭하면 원본 노트를 엽니다"
                      style={{ cursor: 'pointer' }}>
                      <div className="flex items-start gap-2">
                        <span className="s-cite" data-hot={hot === i}>{i + 1}</span>
                        <div className="min-w-0 flex-1">
                          <div style={{ fontSize: 15, fontWeight: 600 }}>{h.title}</div>
                          <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 2 }}>
                            {h.folder} · {h.count}회 언급
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  {hits === null && (
                    <div className="s-src" style={{ color: 'var(--ink-3)', fontSize: 14 }}>
                      아직 검색하지 않았습니다.
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* ═══ 비교표 ═══ */}
          {screen === 'compare' && (
            <>
              <div className="s-panel" style={{ padding: 18 }}>
                <div style={{ fontSize: 18, fontWeight: 700 }}>선행연구 비교표</div>
                <p style={{ fontSize: 15, color: 'var(--ink-2)', marginTop: 4, lineHeight: 1.8 }}>
                  셀을 클릭해 직접 고칠 수 있습니다. 비어 있는 칸은 아직 논문에서 찾지 못한 항목입니다.
                </p>
                <div className="flex flex-wrap items-center gap-2 mt-3">
                  {COMPARE_SETS.map(s => (
                    <button key={s.key} className="s-chip" aria-pressed={cset === s.key}
                      onClick={() => setCset(s.key)}>{s.label}</button>
                  ))}
                  <div className="flex-1" />
                  <button className="s-chip" onClick={exportCsv}>CSV로 내보내기</button>
                </div>
              </div>

              <div className="s-panel" style={{ padding: 0, overflow: 'auto' }}>
                <table className="s-tbl">
                  <thead>
                    <tr>
                      <th style={{ minWidth: 220 }}>논문</th>
                      {activeSet.cols.map(c => <th key={c} style={{ minWidth: 150 }}>{c}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {cmpRows.map(n => (
                      <tr key={n.path}>
                        <td style={{ fontWeight: 600 }}>{n.name}</td>
                        {activeSet.cols.map(c => (
                          <td key={c} contentEditable suppressContentEditableWarning
                            onBlur={e => setCell(n.name, c, e.currentTarget.textContent || '')}>
                            {cell(n.name, c)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p style={{ fontSize: 14, color: 'var(--ink-3)', lineHeight: 1.8 }}>
                {cmpRows.length}편 · 고친 내용은 지금 <strong>브라우저에만</strong> 남습니다 —
                영속화는 lab-scholar Stage 4(비교표 양방향 편집)에서 백엔드가 맡습니다.
                {cset === 'zeb' && cmpRows.length === 0 && (
                  <><br /><strong>석사(ZEB · PV/BIPV) 노트가 아직 볼트에 없어 표가 비어 있습니다.</strong>{' '}
                  문헌을 모으면 여기 자동으로 채워집니다.</>
                )}
              </p>
            </>
          )}

          {/* ═══ 라이브러리 ═══ */}
          {screen === 'library' && (
            <>
              <div className="s-panel" style={{ padding: 18 }}>
                <div style={{ fontSize: 18, fontWeight: 700 }}>라이브러리</div>
                <p style={{ fontSize: 15, color: 'var(--ink-2)', marginTop: 4, lineHeight: 1.8 }}>
                  볼트에 저장된 노트를 폴더로 봅니다. 읽기 상태는 Obsidian 노트와 함께 바뀝니다.
                </p>
                <div className="flex flex-wrap items-center gap-2 mt-3">
                  {FOLDERS.map(f => (
                    <button key={f.key} className="s-chip" aria-pressed={folder === f.key}
                      onClick={() => { setFolder(f.key); setOpenNote(null); }} title={f.hint}>
                      {f.label} {folderCount(f.key)}
                    </button>
                  ))}
                  <div className="flex-1" />
                  <button className="s-chip" onClick={() => navigate('/research/scholar/flow')}>Zotero에서 가져오기</button>
                </div>
              </div>

              <div className="grid grid-cols-12 gap-5">
                <div className="col-span-12 lg:col-span-5 space-y-2" style={{ maxHeight: 620, overflowY: 'auto' }}>
                  {libRows.map(n => (
                    <button key={n.path} onClick={() => loadNote(n)}
                      className="s-src w-full text-left"
                      data-hot={openNote?.path === n.path}>
                      <div style={{ fontSize: 15, fontWeight: 600 }}>{n.title}</div>
                      <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 3 }}>{n.path}</div>
                      <div className="flex gap-2 mt-2">
                        <span className="s-badge">{n.category}</span>
                        <span style={{ fontSize: 13, color: 'var(--ink-3)' }}>
                          {new Date(n.mtime * 1000).toLocaleDateString('ko-KR')}
                        </span>
                      </div>
                    </button>
                  ))}
                  {!libRows.length && (
                    <div className="s-src" style={{ borderStyle: 'dashed' }}>
                      <div style={{ fontSize: 15, fontWeight: 600 }}>이 폴더에 노트가 없습니다</div>
                      {folder === 'master' ? (
                        <p style={{ fontSize: 14, color: 'var(--ink-2)', marginTop: 6, lineHeight: 1.8 }}>
                          석사 주제(공공건축물 ZEB 등급 · PV/BIPV 최적용량 · 경제성)는 연구 계획에는 있지만
                          <strong> 아직 볼트에 노트가 없습니다.</strong> ZEB · BIPV · 자립률 · 경제성 검색 결과가
                          전부 lab-scholar 기획 문서 안의 언급뿐입니다.
                          <br />문헌을 모으기 시작하면 <strong>수집 워크플로</strong>대로 Zotero → Obsidian 으로
                          넣어 주세요. 제목이나 경로에 ZEB · BIPV 가 들어가면 여기 자동으로 잡힙니다.
                        </p>
                      ) : (
                        <p style={{ fontSize: 14, color: 'var(--ink-3)', marginTop: 6 }}>
                          다른 폴더를 골라 보세요.
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <div className="col-span-12 lg:col-span-7 s-panel" style={{ padding: 20 }}>
                  {openNote ? (
                    <>
                      <div style={{ fontSize: 16, fontWeight: 700 }}>{openNote.title}</div>
                      <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 2 }}>{openNote.path}</div>
                      <pre style={{
                        marginTop: 12, fontSize: 15, lineHeight: 1.8, color: 'var(--ink-2)',
                        whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 540, overflowY: 'auto',
                      }}>{body}</pre>
                    </>
                  ) : (
                    <p style={{ fontSize: 15, color: 'var(--ink-3)' }}>왼쪽에서 노트를 고르세요.</p>
                  )}
                </div>
              </div>
            </>
          )}

          {/* ═══ 수집 워크플로 ═══ */}
          {screen === 'flow' && (
            <>
              <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(5, minmax(0,1fr))' }}>
                {STEPS.map(s => (
                  <div key={s.n} className="s-panel" style={{ padding: 16 }}>
                    <div style={{ fontSize: 20, color: 'var(--s-accent-ink)', fontWeight: 700 }}>{s.n}</div>
                    <div style={{ fontSize: 15, fontWeight: 600, marginTop: 4 }}>{s.title}</div>
                    <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 6, lineHeight: 1.7 }}>{s.tool}</div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-12 gap-5">
                <div className="col-span-12 lg:col-span-4 s-panel" style={{ padding: 18 }}>
                  <div style={{ fontSize: 16, fontWeight: 700 }}>하이라이트 색 규칙</div>
                  <p style={{ fontSize: 14, color: 'var(--ink-3)', marginTop: 4 }}>
                    색이 곧 분류 — 템플릿이 콜아웃으로 바꿉니다
                  </p>
                  <div className="space-y-2 mt-3">
                    {HIGHLIGHT.map(h => (
                      <div key={h.callout} className="flex items-center justify-between gap-2"
                        style={{ padding: '9px 12px', borderRadius: 10, background: 'var(--s-bg)', borderLeft: `4px solid ${h.color}` }}>
                        <span style={{ fontSize: 15 }}>{h.mean}</span>
                        <span style={{ fontSize: 13, color: h.color, border: `1px solid ${h.color}`, borderRadius: 999, padding: '1px 8px' }}>
                          {h.callout}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="col-span-12 lg:col-span-8 s-panel" style={{ padding: 18 }}>
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 700 }}>문헌 노트 템플릿</div>
                      <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 2 }}>
                        RSCAD/05_템플릿/Zotero 문헌노트.md
                      </div>
                    </div>
                    <button className="s-chip" disabled={!tpl}
                      onClick={() => navigator.clipboard.writeText(tpl).then(() => {
                        setCopied(true); setTimeout(() => setCopied(false), 1800);
                      }).catch(() => {})}>
                      {copied ? '복사했습니다' : '템플릿 복사'}
                    </button>
                  </div>
                  <pre style={{
                    marginTop: 12, fontSize: 14, lineHeight: 1.7, color: 'var(--ink-2)',
                    background: 'var(--s-bg)', border: '1px solid var(--s-line)', borderRadius: 10, padding: 12,
                    whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 300, overflowY: 'auto',
                  }}>{tpl || '템플릿을 불러오는 중...'}</pre>
                </div>
              </div>

              <div className="s-panel" style={{ padding: 18 }}>
                <div style={{ fontSize: 16, fontWeight: 700 }}>DOCX 내보내기</div>
                <p style={{ fontSize: 14, color: 'var(--ink-3)', marginTop: 4 }}>
                  초안에서는 <code>[[@citekey]]</code> 가 아니라 <code>[@citekey]</code> — 이중 대괄호는 Pandoc 이 인용으로 읽지 않습니다.
                </p>
                <pre style={{
                  marginTop: 10, fontSize: 14, lineHeight: 1.8, color: 'var(--ink-2)',
                  background: 'var(--s-bg)', border: '1px solid var(--s-line)', borderRadius: 10, padding: 12,
                  whiteSpace: 'pre-wrap',
                }}>{PANDOC_CMD}</pre>
              </div>

              {scholar && (
                <div className="s-panel" style={{ padding: 18 }}>
                  <div style={{ fontSize: 16, fontWeight: 700 }}>lab-scholar 단계 {scholar.stages.length}개</div>
                  <div className="grid gap-2 mt-3" style={{ gridTemplateColumns: 'repeat(4, minmax(0,1fr))' }}>
                    {scholar.stages.map(s => (
                      <div key={s.stage} style={{ padding: 11, borderRadius: 10, background: 'var(--s-bg)', border: '1px solid var(--s-line)' }}>
                        <span style={{ fontSize: 13, color: 'var(--s-accent-ink)', fontWeight: 700 }}>Stage {s.stage}</span>
                        <div style={{ fontSize: 14, marginTop: 3, lineHeight: 1.5 }}>{s.title}</div>
                      </div>
                    ))}
                  </div>
                  <p style={{ fontSize: 14, color: 'var(--ink-3)', marginTop: 10 }}>
                    이 화면은 시안 구조를 옮긴 것이고, 실제 검색 엔진·DB 는 Stage 1 부터 붙습니다.
                  </p>
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* ── 원본 노트 드로어 — 출처·답변을 누르면 열린다 ── */}
      {drawer && (
        <>
          <div className="s-scrim" onClick={() => setDrawer(null)} />
          <div className="s-drawer">
            <div className="s-drawer-head">
              <div className="min-w-0">
                <div style={{ fontSize: 17, fontWeight: 700 }}>{drawer.title}</div>
                <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 3 }}>{drawer.path}</div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button className="s-chip"
                  onClick={() => navigate('/research/knowledge?note=' + encodeURIComponent(drawer.path))}
                  title="그래프·백링크와 함께 봅니다">
                  지식화에서 열기 ↗
                </button>
                <button className="s-chip" onClick={() => setDrawer(null)}>닫기 (Esc)</button>
              </div>
            </div>
            <div className="s-drawer-body">{drawerBody}</div>
          </div>
        </>
      )}
    </div>
  );
}
