/* 내논문 — IEEE Access 집필 진행 관리.
   구 Paper.tsx 에서 "쓰는 쪽"만 떼어냈다. "찾는 쪽"은 Papers.tsx 로 갔다.

   인용 자료는 노트북(/research/notebook)에서 담은 발췌를 그대로 가져온다 —
   같은 보관함(Server/paper_clips.json)을 두 화면이 본다. */
import { useEffect, useState } from 'react';
import { fetchJSON, postJSON } from '../lib/api';

const SECTIONS = [
  { id: 'I', title: 'Introduction', desc: 'GFM 필요성, 기존 한계, 차별화 4축', deps: ['claims/', 'literature/'], icon: '📖' },
  { id: 'II', title: 'System Model', desc: '22차 ODE, DC-AC 양방향 커플링, 상태변수 정의', deps: ['model.py', 'pf_export.py'], icon: '⚙️' },
  { id: 'III', title: 'Methodology', desc: 'PSO 다중운전점 + σ 기반 통합 지표', deps: ['metrics.py', 'pso.py'], icon: '🧮' },
  { id: 'IV', title: 'Results', desc: '2D 경계, EMT/SIL 검증, 가설 검정', deps: ['results/', 'P5 데이터'], icon: '📊' },
  { id: 'V', title: 'Conclusion', desc: '기여 요약, 한계, 향후 연구', deps: ['전체 완료'], icon: '🎯' },
];

const SKILLS = [
  { name: 'terminology-consistency', desc: '기호/용어 일관성 검사' },
  { name: 'ieee-access-format-check', desc: 'IEEE Access 35항목 형식' },
  { name: 'citation-management', desc: '참고문헌 정확성' },
  { name: 'academic-paper-reviewer', desc: '모의 심사' },
  { name: 'obsidian-note-template', desc: '▸/※ 분리 검증' },
];

const METHODS = [
  { step: '①', title: '22차 소신호 모델 구축', status: 'done' },
  { step: '②', title: '다중 운전점 PSO 파라미터 최적화', status: 'active' },
  { step: '③', title: 'GFM 제어 전략 3종 통합 구현', status: 'pending' },
  { step: '④', title: 'RTDS Controller HIL / EMT SIL 검증', status: 'pending' },
];

const CHECKLIST = [
  'Abstract ≤ 250 words',
  'Index Terms 4~6개',
  'Fig. 번호 연속',
  'Ref ≥ 20개 (IEEE 형식)',
  'Author Bio + ORCID',
  'Data Availability',
  'CC BY 4.0 명시',
];

const statusLabel = (s: string) => (s === 'done' ? '완료' : s === 'active' ? '진행 중' : '대기');


/* ── 인용 자료 — 노트북에서 담은 발췌를 절별로 가져온다 ──
   ▸ 는 원문 그대로다. 여기서 고쳐 쓰지 않는다 — 고쳐 쓴 문장은 ※(내 메모)로 간다.
   원문 대조는 쪽 앵커로 한다. 대조 전에는 인용하지 않는다. */
interface Clip {
  id: string; cite_key: string; doc: string; page: string; text: string; note: string;
  section: string; kind: string; source: string; used: boolean; created: string;
}
interface ClipSection { id: string; title: string }

function CitationClips() {
  const [clips, setClips] = useState<Clip[]>([]);
  const [sections, setSections] = useState<ClipSection[]>([]);
  const [kinds, setKinds] = useState<Record<string, string>>({});
  const [sec, setSec] = useState('');
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => fetchJSON('/notebook/clips')
    .then(d => { setClips(d.clips || []); setSections(d.sections || []); setKinds(d.kinds || {}); })
    .catch(e => setErr(String(e?.message || e).slice(0, 200)));
  useEffect(() => { load(); }, []);

  const shown = sec ? clips.filter(c => (c.section || '?') === sec) : clips;
  const chosen = shown.filter(c => picked[c.id]);
  const countOf = (id: string) => clips.filter(c => (c.section || '?') === id).length;

  const move = (c: Clip, to: string) =>
    fetchJSON(`/notebook/clips/${c.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ section: to }),
    }).then(d => setClips(d.clips)).catch(e => setErr(String(e?.message || e).slice(0, 200)));

  const drop = (c: Clip) =>
    fetchJSON(`/notebook/clips/${c.id}`, { method: 'DELETE' })
      .then(d => setClips(d.clips)).catch(e => setErr(String(e?.message || e).slice(0, 200)));

  const toDraft = () => {
    if (!chosen.length) { setMsg('넣을 발췌를 고르세요'); return; }
    setBusy(true); setErr('');
    postJSON('/notebook/clips/to-draft', { ids: chosen.map(c => c.id) })
      .then(d => { setClips(d.clips); setPicked({}); setMsg(`초안에 넣었습니다 — ${d.path} (${d.n}건)`); })
      .catch(e => setErr(String(e?.message || e).replace(/^HTTP \d+: /, '').slice(0, 250)))
      .finally(() => setBusy(false));
  };

  const copyExport = () => {
    fetchJSON(`/notebook/clips/export?format=md${sec ? `&section=${sec}` : ''}`)
      .then(d => navigator.clipboard.writeText(d.text)
        .then(() => setMsg(`${d.n}건을 마크다운으로 복사했습니다`))
        .catch(() => setMsg('복사하지 못했습니다 — 브라우저가 막았습니다')))
      .catch(e => setErr(String(e?.message || e).slice(0, 200)));
  };

  return (
    <div className="glass-card" style={{ padding: 20 }}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <span className="mono-label" style={{ color: 'var(--primary)', fontSize: 16 }}>
          인용 자료 {clips.length}건 — 노트북에서 담은 발췌
        </span>
        <div className="flex gap-2">
          <button className="s-chip" style={{ fontSize: 13 }} onClick={copyExport}>마크다운 복사</button>
          <button className="s-chip" style={{ fontSize: 13 }} disabled={busy || !chosen.length}
            onClick={toDraft}>고른 {chosen.length}건 초안에 넣기</button>
        </div>
      </div>
      <p className="mono-clock mt-2" style={{ color: 'var(--outline)', fontSize: 15, lineHeight: 1.7 }}>
        ▸ 는 원문 그대로입니다. 쪽 앵커로 원문을 대조한 뒤에만 인용하세요 —
        ※ 는 내가 적은 판단이라 그대로 논문에 들어가지 않습니다.
      </p>

      {err && <p style={{ color: 'var(--error)', fontSize: 15, marginTop: 8 }}>{err}</p>}
      {msg && <p style={{ color: 'var(--primary)', fontSize: 15, marginTop: 8 }}>{msg}</p>}

      <div className="flex gap-2 flex-wrap mt-3">
        <button className="s-chip" aria-pressed={!sec} style={{ fontSize: 13 }}
          onClick={() => setSec('')}>전체 {clips.length}</button>
        {sections.map(s => (
          <button key={s.id} className="s-chip" aria-pressed={sec === s.id} style={{ fontSize: 13 }}
            onClick={() => setSec(sec === s.id ? '' : s.id)}>
            {s.id}. {s.title} {countOf(s.id)}
          </button>
        ))}
      </div>

      <div className="space-y-2 mt-4">
        {!clips.length && (
          <p className="mono-clock" style={{ color: 'var(--outline)', fontSize: 16, lineHeight: 1.8 }}>
            아직 없습니다. <strong>연구 → 노트북</strong> 에서 소스에게 묻고,
            ‘근거로 쓰인 대목’ 에서 <strong>＋ 내 논문 자료로</strong> 를 누르면 여기 쌓입니다.
          </p>
        )}
        {!!clips.length && !shown.length && (
          <p className="mono-clock" style={{ color: 'var(--outline)', fontSize: 16 }}>
            이 절에 담긴 발췌가 없습니다.
          </p>
        )}
        {shown.map(c => (
          <div key={c.id} className="p-3 rounded-xl"
            style={{
              background: 'var(--surface-container-low)', border: '1px solid var(--border)',
              opacity: c.used ? 0.72 : 1,
            }}>
            <div className="flex items-start gap-2">
              <input type="checkbox" style={{ marginTop: 5 }} checked={!!picked[c.id]}
                onChange={() => setPicked(p => ({ ...p, [c.id]: !p[c.id] }))} />
              <div className="min-w-0 flex-1">
                <div className="mono-clock" style={{ fontSize: 15, color: 'var(--outline)' }}>
                  [[{c.cite_key}]]{c.page ? ` p.${c.page}` : ' · 쪽 모름'} · {kinds[c.kind] || c.kind}
                  {c.used && <span style={{ color: 'var(--primary)' }}> · 초안에 넣음</span>}
                </div>
                <div style={{ fontSize: 16, lineHeight: 1.8, marginTop: 4, color: 'var(--on-surface)' }}>
                  ▸ {c.text}
                </div>
                {c.note && (
                  <div style={{ fontSize: 15, lineHeight: 1.7, marginTop: 4, color: 'var(--outline)' }}>
                    ※ {c.note}
                  </div>
                )}
                <div className="flex gap-2 items-center flex-wrap mt-2">
                  <select className="s-chip" style={{ fontSize: 13 }} value={c.section || '?'}
                    title="내 논문 어느 절에 쓸지" onChange={e => move(c, e.target.value)}>
                    {sections.map(s => <option key={s.id} value={s.id}>{s.id}. {s.title}</option>)}
                  </select>
                  <span className="mono-clock" style={{ fontSize: 13, color: 'var(--outline)' }}>
                    {c.doc ? `[[${c.doc}.pdf#page=${c.page}]]` : '원문 앵커 없음'}
                  </span>
                  <button className="s-chip" style={{ fontSize: 13, color: 'var(--error)' }}
                    onClick={() => drop(c)}>빼기</button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function MyPaper() {
  const stepStyle = (s: string) =>
    s === 'done'
      ? { borderColor: 'var(--primary)', background: 'var(--primary-container)' }
      : s === 'active'
      ? { borderColor: 'var(--tertiary)', background: 'var(--tertiary-container)' }
      : { borderColor: 'var(--border)', background: 'var(--surface-container-low)' };

  return (
    <div className="max-w-[1600px] mx-auto px-10 py-10 space-y-7">
      <div>
        <h1 className="text-display" style={{ color: 'var(--primary)', fontSize: 28 }}>내논문 — IEEE Access</h1>
        <p className="mono-clock mt-1" style={{ color: 'var(--outline)', fontSize: 17 }}>
          Grid-Forming 인버터 소신호 안정도 최적화: 다중 운전점 PSO와 DC-AC 커플링 모델링
        </p>
      </div>

      <CitationClips />

      {/* 방법론 4단계 */}
      <div className="glass-card" style={{ padding: 20 }}>
        <span className="mono-label" style={{ color: 'var(--primary)', fontSize: 16 }}>방법론 4단계 + 3계층 검증</span>
        <div className="grid gap-4 mt-4" style={{ gridTemplateColumns: 'repeat(4, minmax(0,1fr))' }}>
          {METHODS.map(m => (
            <div key={m.step} className="p-4 rounded-xl" style={{ border: '2px solid', ...stepStyle(m.status) }}>
              <div className="mono-metric" style={{ fontSize: 22, color: 'var(--on-surface)' }}>{m.step}</div>
              <div className="text-body-sm mt-2" style={{ color: 'var(--on-surface)' }}>{m.title}</div>
              <div className="mono-label mt-2 inline-block px-2 py-0.5 rounded-full"
                style={{ fontSize: 15, background: 'var(--surface-container)', color: 'var(--on-surface-variant)' }}>
                {statusLabel(m.status)}
              </div>
            </div>
          ))}
        </div>
        <p className="mono-clock mt-3" style={{ color: 'var(--outline)', fontSize: 16 }}>
          3계층 검증: Layer 1 소신호 → Layer 2 EMT 교차 → Layer 3 CHIL/SIL
        </p>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* 섹션 진행 */}
        <div className="col-span-12 lg:col-span-8 space-y-4">
          <span className="mono-label" style={{ color: 'var(--outline)', fontSize: 16 }}>논문 섹션 진행 상황</span>
          {SECTIONS.map(s => (
            <div key={s.id} className="glass-card glass-card-hover" style={{ padding: 20 }}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span style={{ fontSize: 22 }}>{s.icon}</span>
                  <div>
                    <h3 className="text-body-sm" style={{ color: 'var(--on-surface)', fontWeight: 600 }}>§{s.id}. {s.title}</h3>
                    <p className="mono-clock mt-0.5" style={{ color: 'var(--outline)', fontSize: 16 }}>{s.desc}</p>
                  </div>
                </div>
                <span className="mono-label px-2 py-0.5 rounded-full"
                  style={{ fontSize: 15, background: 'var(--surface-container)', color: 'var(--outline)' }}>pending</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {s.deps.map(dep => (
                  <span key={dep} className="mono-clock px-2 py-0.5 rounded"
                    style={{ fontSize: 15, background: 'var(--surface-container)', color: 'var(--on-surface-variant)' }}>{dep}</span>
                ))}
              </div>
            </div>
          ))}
          <p className="mono-clock" style={{ color: 'var(--outline)', fontSize: 16 }}>
            섹션 상태는 아직 고정값입니다 — 영속화하려면 <code>GET/POST /api/paper/sections</code> 가 필요합니다.
          </p>
        </div>

        {/* 품질 검사 + 체크리스트 */}
        <div className="col-span-12 lg:col-span-4 space-y-5">
          <div className="glass-card" style={{ padding: 20 }}>
            <span className="mono-label" style={{ color: 'var(--primary)', fontSize: 16 }}>품질 검사 도구</span>
            <div className="space-y-2 mt-3">
              {SKILLS.map(s => (
                <div key={s.name} className="p-3 rounded-xl"
                  style={{ background: 'var(--surface-container-low)', border: '1px solid var(--border)' }}>
                  <div className="mono-clock" style={{ fontSize: 16, color: 'var(--on-surface)' }}>{s.name}</div>
                  <div className="mono-clock mt-0.5" style={{ fontSize: 15, color: 'var(--outline)' }}>{s.desc}</div>
                </div>
              ))}
            </div>
            <p className="mono-clock mt-3" style={{ color: 'var(--outline)', fontSize: 15 }}>
              Claude Code 스킬입니다 — 이 화면에서 실행되지 않습니다.
            </p>
          </div>

          <div className="glass-card" style={{ padding: 20 }}>
            <span className="mono-label" style={{ color: 'var(--primary)', fontSize: 16 }}>투고 체크리스트</span>
            <div className="space-y-1.5 mt-3">
              {CHECKLIST.map((item, i) => (
                <label key={i} className="flex items-center gap-2 text-body-sm cursor-pointer"
                  style={{ color: 'var(--on-surface-variant)', fontSize: 17 }}>
                  <input type="checkbox" />
                  {item}
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
