/* GFM 제어루프 — 실시간 신호 흐름 뷰어 (gfm-viewer/)

   뷰어(gfm-live-flow.html)는 spec JSON 하나를 받아 브라우저에서 RK4(20 µs)로 적분한다.
   spec 은 export_spec.py 가 Simulation/model.py 의 sympy 식에서 만들기 때문에,
   화면에서 움직이는 식과 소신호 해석이 쓰는 식이 같다 — 여기가 이 화면의 요점이다.

   주의(논문에 쓸 때): 뷰어는 비선형 시간영역 적분이고, σ=−Re(λ) 판정은 선형화 모델이다.
   같은 식이라도 두 결과는 같은 것이 아니다. */
import { useEffect, useRef, useState } from 'react';
import { fetchJSON } from '../lib/api';

interface Spec {
  file: string; url: string; name: string;
  states: number; params: number; signals: number;
  inputs: Record<string, number>; sliders: string[];
  exported_at: string | null; mtime: number;
}

const VIEWER = '/gfm-viewer/gfm-live-flow.html';

/* 기본 모델(14차 교육용)은 뷰어에 내장돼 있다 — 목록의 첫 칸으로 둔다 */
const BUILTIN: Spec = {
  file: '', url: '', name: '기본 (14차 교육용)', states: 14, params: 16, signals: 32,
  inputs: { Pref: 0.5, Qref: 0, Vg: 1, SCR: 3, XR: 5 }, sliders: ['H', 'D'],
  exported_at: null, mtime: 0,
};

export default function ControlLoop() {
  const [specs, setSpecs] = useState<Spec[]>([]);
  const [sel, setSel] = useState<Spec>(BUILTIN);
  const [ready, setReady] = useState(false);
  const [err, setErr] = useState('');
  const frame = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    fetchJSON('/gfm_viewer/specs')
      .then(d => {
        const list: Spec[] = d.specs || [];
        setSpecs(list);
        /* 연구 모델이 있으면 그것을 먼저 보여준다 — 교육용 예시가 기본으로 남아 있으면
           화면의 숫자를 연구 결과로 착각하기 쉽다 */
        const research = list.find(s => s.states >= 22) || list[0];
        if (research) setSel(research);
      })
      .catch(() => setErr('모델 목록을 불러오지 못했습니다 — Flask 가 떠 있는지 확인하세요.'));
  }, []);

  /* 뷰어가 준비됐다고 알려오면 그때 spec 을 밀어 넣는다 (로드 순서 경쟁 방지) */
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if ((e.data || {}).type === 'gfm-viewer-ready') setReady(true);
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, []);

  useEffect(() => {
    if (!ready || !sel.url) return;
    frame.current?.contentWindow?.postMessage(
      { type: 'gfm-spec-url', url: sel.url }, '*');
  }, [ready, sel]);

  const all = [BUILTIN, ...specs];

  return (
    <div className="max-w-[1600px] mx-auto px-8 py-8 space-y-4">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700 }}>GFM 제어루프 — 실시간 신호 흐름</h1>
          <p style={{ fontSize: 14.5, color: 'var(--ink-3, #7A8397)', marginTop: 4, lineHeight: 1.7 }}>
            블록도 위에서 신호가 실제로 흐릅니다. 계통을 약하게(SCR↓) 만들거나 관성·댐핑을 바꾸면
            동기화 루프가 어떻게 반응하는지 그 자리에서 보입니다.
          </p>
        </div>
        <a className="glass-badge" href={sel.url ? `${VIEWER}?spec=${encodeURIComponent(sel.url)}` : VIEWER}
          target="_blank" rel="noreferrer" style={{ textDecoration: 'none', padding: '6px 12px' }}>
          새 창으로 열기 ↗
        </a>
      </div>

      {err && <p style={{ color: 'var(--error, #c00)', fontSize: 15 }}>{err}</p>}

      {/* ── 모델 고르기 ── */}
      <div className="flex flex-wrap items-center gap-2">
        <span style={{ fontSize: 13.5, color: 'var(--ink-3, #7A8397)' }}>모델</span>
        {all.map(s => (
          <button key={s.file || 'builtin'} onClick={() => setSel(s)}
            aria-pressed={sel.file === s.file}
            style={{
              fontSize: 14, padding: '6px 13px', borderRadius: 999, cursor: 'pointer',
              border: `1px solid ${sel.file === s.file ? '#7C8CF8' : 'rgba(128,140,180,.35)'}`,
              background: sel.file === s.file ? 'rgba(124,140,248,.16)' : 'transparent',
              color: 'inherit', fontWeight: sel.file === s.file ? 600 : 400,
            }}>
            {s.name} · {s.states}차
          </button>
        ))}
        {!specs.length && (
          <span style={{ fontSize: 13.5, color: 'var(--ink-3, #7A8397)' }}>
            — 연구 모델 spec 이 없습니다:{' '}
            <code>PYTHONPATH=Simulation python gfm-viewer/export_spec.py --module model --out gfm-viewer/gfm_spec_22.json</code>
          </span>
        )}
      </div>

      {/* ── 뷰어 ── */}
      <iframe ref={frame} src={VIEWER} title="GFM 제어루프 실시간 신호 흐름"
        style={{
          width: '100%', height: 'min(1100px, calc(100vh - 210px))', minHeight: 620,
          border: '1px solid rgba(128,140,180,.3)', borderRadius: 14, background: '#0E1220',
        }} />

      {/* ── 지금 보고 있는 모델 ── */}
      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px,1fr))' }}>
        <div className="glass-panel" style={{ padding: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>지금 보고 있는 모델</div>
          <div style={{ fontSize: 14, lineHeight: 1.9, marginTop: 6 }}>
            <div><strong>{sel.name}</strong> — 상태 {sel.states} · 파라미터 {sel.params} · 신호 {sel.signals}</div>
            {sel.file && <div style={{ color: 'var(--ink-3, #7A8397)' }}>{sel.file}
              {sel.exported_at && ` · 내보낸 시각 ${sel.exported_at.replace('T', ' ')}`}</div>}
            <div>슬라이더: {sel.sliders.join(', ') || '없음'}</div>
            <div>기본 입력: {Object.entries(sel.inputs).map(([k, v]) => `${k}=${v}`).join(' · ')}</div>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>읽을 때 지킬 것</div>
          <ul style={{ fontSize: 14, lineHeight: 1.9, marginTop: 6, paddingLeft: 18, listStyle: 'disc' }}>
            <li>뷰어 상단의 <strong>검증 ✓</strong> 는 spec 의 식이 Python 계산과 같다는 뜻입니다. ✗ 면 그 화면은 믿지 마세요.</li>
            <li>여기는 <strong>비선형 시간영역</strong> 적분입니다. σ=−Re(λ) 안정도 판정은 선형화 모델이므로, 같은 식이라도 결과를 섞어 쓰지 마세요.</li>
            <li>22차 모델은 SI 단위로 적분하고 <strong>표시만 pu</strong> 로 환산합니다 (정격 10 kVA · 325 V<sub>peak</sub> · 800 V<sub>dc</sub>).</li>
            <li>계통 임피던스는 <code>Zg=Z_base/SCR</code>, <code>Rg=Zg/√(1+(X/R)²)</code> — op.py 와 같은 식입니다.</li>
          </ul>
        </div>

        <div className="glass-panel" style={{ padding: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>모델을 다시 내보내려면</div>
          <p style={{ fontSize: 13.5, color: 'var(--ink-3, #7A8397)', marginTop: 6, lineHeight: 1.8 }}>
            model.py 를 고쳤을 때만 하면 됩니다. 두 번째 명령이 고유값을 대조해 뷰어 식이
            연구 모델과 같은지 확인합니다.
          </p>
          <pre style={{
            fontSize: 12.5, lineHeight: 1.7, marginTop: 8, padding: 10, borderRadius: 10,
            background: 'rgba(128,140,180,.10)', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
          }}>{`cd gfm-viewer
PYTHONPATH=../Simulation python export_spec.py --module model --out gfm_spec_22.json
PYTHONPATH=../Simulation python xcheck_spec.py`}</pre>
        </div>
      </div>
    </div>
  );
}
