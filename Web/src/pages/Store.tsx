import { useEffect, useState } from 'react';
import { injectKnowledge, ping, type BridgeStatus } from '../services/bridge';

/* 지식 팩 = 마크다운 한 덩어리. 처음엔 여기 하드코딩, 나중에 Vault 폴더를 빌드 타임에 읽어 생성.
   ▸ = 논문·실험 사실, ※ = 판단 — Vault 규칙 그대로. */
const PACKS: { id: string; title: string; folder: string; summary: string; markdown: string }[] = [
  {
    id: 'ak96', title: 'DC-AC 커플링 — A_k(9,6) 이론값', folder: '01_개념',
    summary: 'idc0/(J·ω₀) 유도, SCR별 이론값, Zhao(2023) 근거',
    markdown: `---
type: concept
tags: [GFM, coupling, jacobian]
---
# DC-AC 커플링 — A_k(9,6)

▸ A_k(9,6) = ∂(dΔω/dt)/∂u_dc = idc0/(J·ω₀)  — [7] Zhao 2023
▸ SCR=3.0: 0.001592 · SCR=2.0: 0.002387 · SCR=1.5: 0.003183 · SCR=1.0: 0.004775
▸ Dong et al.[2] 12차 모델에는 이 원소가 없음 (이상적 DC 버스 가정)
※ 이 원소가 "모델 차수" 차별화 축의 정량 근거
`,
  },
  {
    id: 'zeta', title: 'ζ_threshold = 0.64 유도', folder: '01_개념',
    summary: 'UNIFI V3 t_s ≤ 1s 역산, PSO 목표 ζ* = 0.707',
    markdown: `---
type: concept
tags: [GFM, damping, PSO]
---
# 감쇠비 기준

▸ ζ_threshold = 4/(2π·1.0·1.0) = 0.6366 → 0.64 (UNIFI V3 Category 3, t_s ≤ 1 s)
▸ ζ* (PSO 목표) = 0.707
▸ DC PI 임계감쇠 Dp = 2√(J·wc) = 2√(0.5×31.4) = 7.92 — 현재 Dp=20 → 과감쇠
※ 실수극(과감쇠 동기화 모드)에는 ζ 지표가 무의미 → t_s 로 판정 (모드교차_최소감쇠비_함정)
`,
  },
  {
    id: 'refs', title: '핵심 참고문헌 6편 연결표', folder: '04_문헌',
    summary: '[1]Chen [2]Dong [3]Ganguly [7]Zhao [9]IEEE 2004-2025 [15]Villalva',
    markdown: `---
type: reference-map
---
# 핵심 참고문헌

▸ [1] Chen 2024 Electronics — 21차 모델·PSO 14개 파라미터 (방법론 베이스) DOI 10.3390/electronics13071343
▸ [2] Dong 2026 Front. Energy Res. — 12차·PSO=SVR 3개 (선점 논문) DOI 10.3389/fenrg.2025.1738311
▸ [3] Ganguly 2025 preprint — X/R=0.5,1.0 트립, 1D 불완전성 DOI 10.20944/preprints202504.1145.v1
▸ [7] Zhao 2023 Aalborg PhD — DC-AC 커플링 누락 시 불안정 모드 미포착 DOI 10.54337/aau679677176
▸ [9] IEEE Std. 2004-2025 — HIL 검증 표준 (2025.08.29)
▸ [15] Villalva 2009 — PV P-V 비선형 모델
`,
  },
];

export default function Store() {
  const [bridge, setBridge] = useState<BridgeStatus>({ ok: false });
  const [log, setLog] = useState<string[]>([]);
  const [custom, setCustom] = useState({ title: '', markdown: '' });

  useEffect(() => {
    const tick = () => ping().then(setBridge);
    tick(); const t = setInterval(tick, 5000); return () => clearInterval(t);
  }, []);

  const inject = async (title: string, md: string) => {
    try {
      const r = await injectKnowledge(title, md);
      setLog(l => [`주입됨 · ${title} → ${r.filePath}`, ...l]);
    } catch (e) {
      setLog(l => [`실패 · ${title} — ${(e as Error).message}`, ...l]);
    }
  };

  return (
    <div className="grid">
      <section className="sheet">
        <h2>지식 팩</h2>
        <p className="status" style={{ marginBottom: 12 }}>
          <span className={`status ${bridge.ok ? 'on' : ''}`} />
          {bridge.ok
            ? <>로컬 에이전트 연결됨 <span className="num">v{bridge.version}</span> · 두뇌 <span className="num">{bridge.brainFiles}</span>개 노트</>
            : <>로컬 에이전트가 꺼져 있습니다. connect-ai(익스텐션 또는 데스크톱 앱)를 켜면 주입 버튼이 활성화됩니다.</>}
        </p>
        {PACKS.map(p => (
          <div className="pack" key={p.id}>
            <div>
              <div>{p.title}</div>
              <div className="meta"><span className="num">{p.folder}</span>{p.summary}</div>
            </div>
            <button className="btn" disabled={!bridge.ok} onClick={() => inject(p.title, p.markdown)}>두뇌에 주입</button>
          </div>
        ))}
      </section>

      <section>
        <div className="sheet">
          <h2>직접 주입</h2>
          <p style={{ color: 'var(--ink-2)', marginBottom: 12 }}>Vault 노트를 붙여 넣으면 <span className="num">00_Raw/오늘날짜/</span>에 저장되고 관련 에이전트 메모리에 기록됩니다.</p>
          <input placeholder="노트 제목" value={custom.title} onChange={e => setCustom({ ...custom, title: e.target.value })} />
          <div style={{ height: 8 }} />
          <textarea placeholder={'---\ntype: experiment\n---\n# EXP: ...\n▸ 관찰\n※ 해석'} value={custom.markdown} onChange={e => setCustom({ ...custom, markdown: e.target.value })} />
          <div style={{ marginTop: 8 }}>
            <button className="btn" disabled={!bridge.ok || !custom.title || !custom.markdown} onClick={() => inject(custom.title, custom.markdown)}>두뇌에 주입</button>
          </div>
        </div>
        <div className="sheet">
          <h2>기록</h2>
          {log.length === 0 ? <p className="empty">아직 주입한 것이 없습니다.</p> : log.map((l, i) => <div key={i} className="line num" style={{ fontSize: 13 }}>{l}</div>)}
        </div>
      </section>
    </div>
  );
}
