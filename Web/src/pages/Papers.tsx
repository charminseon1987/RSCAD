/* 논문-리서치 — lab-scholar 화면 시안(docs/design/scholar-prototype.html) 구조를 옮긴 것.
   화면 3개: 수집 워크플로(7단계) / 비교표 / 라이브러리

   검색·답변은 따로 두지 않는다 — 찾는 일과 모으는 일이 갈라지면 "찾은 논문"과
   "가진 논문"이 어긋나기 때문이다. 검색은 7단계의 ①이고, 그대로 ②~⑦로 이어진다.

   시안의 핵심 규칙을 지킨다:
     ▸ fact  — 논문 근거. 출처 번호가 반드시 붙는다.
     ※ interp — AI 종합 해석. 출처가 없다는 것을 색과 점선으로 알린다.
   지금은 볼트의 실제 노트(/api/notes · /api/vault/search)로 채운다. */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { fetchJSON } from '../lib/api';
import ScholarFlow from './ScholarFlow';

interface Note { name: string; title: string; category: string; path: string; size: number; mtime: number }
interface Scholar { root: string; stages: { stage: string; title: string }[]; prototype: string | null; files: string[] }

const RAIL = [
  { key: 'flow', label: '수집 워크플로 (7단계)' },
  { key: 'compare', label: '비교표' },
  { key: 'library', label: '라이브러리' },
] as const;
type Screen = typeof RAIL[number]['key'];

/* 라이브러리 폴더 — 규칙은 서버(Server/scholar_folders.json)에 저장되고 사용자가 화면에서 고친다.
   category 만으로는 석사/박사가 갈리지 않아 제목·경로 키워드를 함께 본다. */
interface Folder { key: string; label: string; categories: string[]; keywords: string[] }

const matchFolder = (n: { title: string; path: string; category: string }, f: Folder) => {
  if (f.categories.includes(n.category)) return true;
  if (!f.keywords.length) return false;
  const hay = `${n.title} ${n.path}`.toLowerCase();
  return f.keywords.some(k => k && hay.includes(k.toLowerCase()));
};

/* 비교표 — 시안의 두 묶음 */
const COMPARE_SETS = [
  { key: 'gfm', label: 'GFM · 계통 안정도 항목', cols: ['시스템 구성', '계통 조건', '제어 구조', '안정도 해석', '검증'] },
  { key: 'zeb', label: 'PV/BIPV · ZEB 항목', cols: ['입지 · 기상', '용량 산정', '경제성 지표', '계통 영향'] },
] as const;

export default function Papers() {
  const { screen: raw } = useParams();
  const screen: Screen = (RAIL.some(r => r.key === raw) ? raw : 'flow') as Screen;
  const [notes, setNotes] = useState<Note[]>([]);
  const [scholar, setScholar] = useState<Scholar | null>(null);
  const [err, setErr] = useState('');
  const navigate = useNavigate();

  // 라이브러리
  const [folder, setFolder] = useState<string>('all');
  const [folders, setFolders] = useState<Folder[]>([]);
  const [cfgOpen, setCfgOpen] = useState(false);
  const [cfgMsg, setCfgMsg] = useState('');
  const [openNote, setOpenNote] = useState<Note | null>(null);
  const [body, setBody] = useState('');

  // 비교표
  const [cset, setCset] = useState<string>('gfm');
  const [cells, setCells] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchJSON('/notes').then(d => setNotes(d.notes || []))
      .catch(() => setErr('노트를 불러오지 못했습니다 — Flask 가 떠 있는지 확인하세요.'));
    fetchJSON('/scholar').then(setScholar).catch(() => {});
    fetchJSON('/scholar/folders').then(d => setFolders(d.folders || [])).catch(() => {});
  }, []);

  const loadNote = (n: Note) => {
    setOpenNote(n); setBody('불러오는 중...');
    fetchJSON('/note?path=' + encodeURIComponent(n.path))
      .then(d => setBody(d.content || '')).catch(() => setBody('불러오지 못했습니다.'));
  };

  const folderCount = (k: string) => {
    if (k === 'all') return notes.length;
    const f = folders.find(x => x.key === k);
    return f ? notes.filter(n => matchFolder(n, f)).length : 0;
  };
  const libRows = useMemo(() => {
    if (folder === 'all') return notes;
    const f = folders.find(x => x.key === folder);
    return f ? notes.filter(n => matchFolder(n, f)) : [];
  }, [notes, folder, folders]);
  const byKey = (k: string) => {
    const f = folders.find(x => x.key === k);
    return f ? notes.filter(n => matchFolder(n, f)) : [];
  };
  const phd = useMemo(() => byKey('phd'), [notes, folders]);
  const master = useMemo(() => byKey('master'), [notes, folders]);
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
                  <button className="s-chip" aria-pressed={folder === 'all'}
                    onClick={() => { setFolder('all'); setOpenNote(null); }}>
                    전체 {notes.length}
                  </button>
                  {folders.map(f => (
                    <button key={f.key} className="s-chip" aria-pressed={folder === f.key}
                      onClick={() => { setFolder(f.key); setOpenNote(null); }}
                      title={[
                        f.categories.length ? `분류: ${f.categories.join(', ')}` : '',
                        f.keywords.length ? `키워드: ${f.keywords.join(', ')}` : '',
                      ].filter(Boolean).join(' · ') || '규칙 없음'}>
                      {f.label} {folderCount(f.key)}
                    </button>
                  ))}
                  <button className="s-chip" onClick={() => setCfgOpen(v => !v)}
                    style={{ borderStyle: 'dashed' }}>
                    {cfgOpen ? '폴더 설정 닫기' : '＋ 폴더 설정'}
                  </button>
                  <div className="flex-1" />
                  <button className="s-chip" onClick={() => navigate('/research/scholar/flow')}>＋ 7단계로 새 논문 담기</button>
                </div>
              </div>

              {/* ── 폴더 설정 — 사용자가 직접 규칙을 만든다 ── */}
              {cfgOpen && (
                <div className="s-panel" style={{ padding: 18 }}>
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 700 }}>폴더 설정</div>
                      <p style={{ fontSize: 14, color: 'var(--ink-2)', marginTop: 4, lineHeight: 1.8 }}>
                        <strong>분류</strong>(노트 category) 또는 <strong>키워드</strong>(제목·경로에 포함)가 하나라도 맞으면 그 폴더에 들어갑니다.
                        <br />키워드는 쉼표로 구분하고 대소문자는 구분하지 않습니다. 저장하면 <code>Server/scholar_folders.json</code> 에 남습니다.
                      </p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button className="s-chip"
                        onClick={() => setFolders(fs => [...fs, {
                          key: 'f' + Date.now().toString(36), label: '새 폴더', categories: [], keywords: [],
                        }])}>＋ 폴더 추가</button>
                      <button className="s-chip"
                        onClick={() => fetchJSON('/scholar/folders/reset', { method: 'POST' })
                          .then(d => { setFolders(d.folders || []); setFolder('all'); setCfgMsg('기본값으로 되돌렸습니다'); })
                          .catch(() => setCfgMsg('되돌리지 못했습니다'))}>기본값</button>
                      <button className="s-chip"
                        style={{ background: 'var(--s-accent)', color: '#fff', borderColor: 'var(--s-accent-ink)', fontWeight: 600 }}
                        onClick={() => fetch('/api/scholar/folders', {
                          method: 'POST', headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ folders }),
                        }).then(r => r.json())
                          .then(d => {
                            if (d.status === 'ok') { setCfgMsg(''); setCfgOpen(false); }   /* 저장되면 설정 패널을 닫는다 */
                            else setCfgMsg(d.error || '저장 실패');
                          })
                          .catch(() => setCfgMsg('저장하지 못했습니다'))}>저장</button>
                    </div>
                  </div>
                  {cfgMsg && <p style={{ fontSize: 14, color: 'var(--s-accent-ink)', marginTop: 8 }}>{cfgMsg}</p>}

                  <div className="space-y-2 mt-4">
                    {folders.map((f, i) => {
                      const hit = notes.filter(n => matchFolder(n, f)).length;
                      return (
                        <div key={f.key} style={{
                          display: 'grid', gridTemplateColumns: '1.1fr 0.9fr 2fr auto auto', gap: 10,
                          alignItems: 'center', padding: 10, borderRadius: 10,
                          background: 'var(--s-bg)', border: '1px solid var(--s-line)',
                        }}>
                          <input value={f.label} placeholder="폴더 이름"
                            onChange={e => setFolders(fs => fs.map((x, j) => j === i ? { ...x, label: e.target.value } : x))}
                            style={{ fontSize: 15, padding: '7px 10px', borderRadius: 8, border: '1px solid var(--s-line)', background: 'var(--s-bg)', color: 'var(--ink)' }} />
                          <input value={f.categories.join(', ')} placeholder="분류 (literature, claim, phase)"
                            onChange={e => setFolders(fs => fs.map((x, j) => j === i
                              ? { ...x, categories: e.target.value.split(',').map(s => s.trim()).filter(Boolean) } : x))}
                            style={{ fontSize: 14, padding: '7px 10px', borderRadius: 8, border: '1px solid var(--s-line)', background: 'var(--s-bg)', color: 'var(--ink-2)' }} />
                          <input value={f.keywords.join(', ')} placeholder="키워드 — 쉼표로 구분 (ZEB, BIPV, 자립률)"
                            onChange={e => setFolders(fs => fs.map((x, j) => j === i
                              ? { ...x, keywords: e.target.value.split(',').map(s => s.trim()).filter(Boolean) } : x))}
                            style={{ fontSize: 14, padding: '7px 10px', borderRadius: 8, border: '1px solid var(--s-line)', background: 'var(--s-bg)', color: 'var(--ink-2)' }} />
                          <span style={{
                            fontSize: 14, fontWeight: 700, minWidth: 54, textAlign: 'center',
                            color: hit ? 'var(--s-ok)' : 'var(--ink-3)',
                            background: hit ? 'var(--s-ok-soft)' : 'transparent',
                            border: `1px solid ${hit ? 'var(--s-ok)' : 'var(--s-line)'}`,
                            borderRadius: 999, padding: '3px 8px',
                          }} title="지금 이 규칙에 걸리는 노트 수">{hit}건</span>
                          <button className="s-chip" style={{ color: 'var(--error)' }}
                            onClick={() => { setFolders(fs => fs.filter((_, j) => j !== i)); if (folder === f.key) setFolder('all'); }}>
                            삭제
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  <p style={{ fontSize: 14, color: 'var(--ink-3)', marginTop: 10 }}>
                    오른쪽 건수는 <strong>타이핑하는 즉시</strong> 다시 셉니다 — 저장 전에 규칙이 맞는지 확인할 수 있습니다.
                  </p>
                </div>
              )}

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

          {/* ═══ 수집 워크플로 7단계 — 검색·답변과 한 화면 ═══ */}
          {screen === 'flow' && (
            <>
              <ScholarFlow />

              {scholar && (
                <div className="s-panel" style={{ padding: 18 }}>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>
                    lab-scholar SPEC 단계 {scholar.stages.length}개 — 백엔드 이식 로드맵
                  </div>
                  <p style={{ fontSize: 13.5, color: 'var(--ink-3)', marginTop: 4, lineHeight: 1.7 }}>
                    위 7단계는 지금 쓰는 작업 흐름이고, 아래는 lab-scholar 프로젝트(별도 FastAPI·MCP)로 옮겨 갈 개발 단계입니다.
                  </p>
                  <div className="grid gap-2 mt-3" style={{ gridTemplateColumns: 'repeat(4, minmax(0,1fr))' }}>
                    {scholar.stages.map(s => (
                      <div key={s.stage} style={{ padding: 10, borderRadius: 10, background: 'var(--s-bg)', border: '1px solid var(--s-line)' }}>
                        <span style={{ fontSize: 12.5, color: 'var(--s-accent-ink)', fontWeight: 700 }}>Stage {s.stage}</span>
                        <div style={{ fontSize: 13.5, marginTop: 3, lineHeight: 1.5 }}>{s.title}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>

    </div>
  );
}
