import { useEffect, useState, useRef, useCallback } from 'react';

/* ================================================================
   GFM Stability Dashboard — React 구현
   score = σ / σ_ref  (σ_ref = TS_COEF / t_s_spec)
   TS_COEF = 4  (2% 기준, metrics.py 와 동일)
   zeta_min 기반 지표는 사용하지 않음 — 임계 모드가 실수극
================================================================ */

const TS_COEF = 4.0;

// ── Data shape ──
interface StabRow  { scr: number; sigma: number }
interface PartRow  { scr: number; pd: number; pw: number }
interface LinRow   { scr: number; thr: number; n: number }
interface PairRow  { scr: number; slow: number; fast: number; ppf: number; sep: number }
interface DashData {
  run: string; xr: number; tsSpec: number;
  stab: StabRow[]; part: PartRow[];
  lin: { input: string; tol: number; rows: LinRow[] };
  pair: PairRow[]; dpj: number;
  grid: Record<string, Record<number, number>>;
  gridXR: number[]; gridSCR: number[];
}

const DEFAULT: DashData = {
  run:'(no data)', xr:1.0, tsSpec:1.0,
  stab:[], part:[], lin:{input:'Pref',tol:0.05,rows:[]}, pair:[], dpj:40,
  grid:{}, gridXR:[], gridSCR:[],
};

const sigRef = (d: DashData) => TS_COEF / d.tsSpec;
const score  = (sigma: number, d: DashData) => sigma / sigRef(d);
const ff = (v: number, n=2) => Number(v).toFixed(n);
const S  = (v: number) => Number(v).toFixed(1);

/* ── Parse one JSON (shared by auto-load & file upload) ── */
function parseJSON(j: any, d: DashData): string | null {
  if (j.ctrl_params && j.SCR_list) {
    d.run = j.run_name ?? d.run; d.xr = j.XR ?? d.xr;
    if (j.t_s_spec) d.tsSpec = j.t_s_spec;
    return 'meta';
  }
  if (j.by_SCR && j.input) {
    d.lin = { input: j.input, tol: j.tol, rows: Object.entries(j.by_SCR).map(([k, v]: any) =>
      ({ scr: +k, thr: v.threshold_fit ?? v.threshold_ratio, n: v.fit?.exponent ?? 2 })).sort((a,b)=>b.scr-a.scr) };
    return 'linearization';
  }
  if (j.by_SCR && j.delta_state) {
    d.part = Object.entries(j.by_SCR).map(([k, v]: any) =>
      ({ scr: +k, pd: v.p_delta, pw: v.p_omega })).sort((a,b)=>b.scr-a.scr);
    return 'participation';
  }
  if (j.by_SCR && j.sep_min !== undefined) {
    d.pair = Object.entries(j.by_SCR).map(([k, v]: any) =>
      ({ scr: +k, slow: v.lambda_slow, fast: v.lambda_fast, ppf: v.p_Pf_fast, sep: v.sep_ratio })).sort((a,b)=>b.scr-a.scr);
    if (j.J && j.Dp) d.dpj = j.Dp / j.J;
    return 'sync_reduction';
  }
  const rows = Object.entries(j)
    .filter(([, v]: any) => v && (v.sigma_min !== undefined || v.min_abs_real !== undefined))
    .map(([k, v]: any) => ({ scr: +k, sigma: v.sigma_min ?? v.min_abs_real }))
    .sort((a,b) => b.scr - a.scr);
  if (rows.length) {
    d.stab = rows;
    const key = ff(d.xr, 1);
    if (!d.grid[key]) d.grid[key] = {};
    rows.forEach(r => { d.grid[key][r.scr] = r.sigma; if (!d.gridSCR.includes(r.scr)) d.gridSCR.push(r.scr); });
    if (!d.gridXR.includes(+key)) d.gridXR.push(+key);
    d.gridSCR.sort((a,b) => b - a); d.gridXR.sort((a,b) => a - b);
    return 'eigenvalues';
  }
  return null;
}

/* ── Ring SVG ── */
function Ring({ pct, color, size = 80 }: { pct: number; color: string; size?: number }) {
  const r = size * 0.4, c = 2 * Math.PI * r, v = Math.max(0, Math.min(1, pct));
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--surface-container-high)" strokeWidth={size*0.1}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={size*0.1} strokeLinecap="round"
        strokeDasharray={`${c*v} ${c}`} transform={`rotate(-90 ${size/2} ${size/2})`}
        style={{ transition: 'stroke-dasharray 0.6s ease' }}/>
      <text x={size/2} y={size/2+5} textAnchor="middle" className="mono-metric"
        style={{ fontSize: size*0.19, fill: 'var(--on-surface)', fontWeight: 700 }}>
        {Math.round(v * 100)}%
      </text>
    </svg>
  );
}

/* ── Gauge Bar ── */
function GaugeBar({ label, value, max, ok }: { label: string; value: number; max: number; ok: boolean }) {
  const pct = Math.min(value / max, 1) * 100;
  const refPct = (1 / max) * 100;
  return (
    <div className="flex items-center gap-3" style={{ fontSize: 13 }}>
      <span className="mono-clock w-16 shrink-0" style={{ color: 'var(--outline)', fontSize: 12 }}>{label}</span>
      <div className="flex-1 relative h-3.5 rounded-lg overflow-visible" style={{ background: 'var(--surface-container-high)' }}>
        <div className="absolute left-0 top-0 bottom-0 rounded-lg transition-all duration-500"
          style={{ width: `${pct}%`, background: ok ? 'var(--primary)' : 'var(--secondary-container)' }} />
        <div className="absolute top-[-3px] bottom-[-3px] w-0.5 rounded bg-white"
          style={{ left: `calc(${refPct}% - 1px)`, boxShadow: '0 0 0 2px var(--outline-variant)' }} />
      </div>
      <span className="mono-clock w-12 text-right font-semibold" style={{ color: ok ? 'var(--primary)' : 'var(--secondary)', fontSize: 12 }}>
        {ff(value, 3)}
      </span>
    </div>
  );
}

/* ── 2D Map Cell ── */
function MapCell({ sigma, xr, scr, d }: { sigma?: number; xr: number; scr: number; d: DashData }) {
  if (sigma === undefined) return (
    <div className="aspect-square rounded-md" title={`X/R ${ff(xr,1)}, SCR ${S(scr)}: 미계산`}
      style={{ background: 'var(--surface-container)', border: '1px solid var(--border)' }} />
  );
  const sc = score(sigma, d), ok = sc >= 1;
  return (
    <div className="aspect-square rounded-md transition-transform hover:scale-110 cursor-default"
      title={`X/R ${ff(xr,1)}, SCR ${S(scr)}: σ ${ff(sigma)}, score ${ff(sc,3)}`}
      style={{
        background: ok ? 'var(--primary)' : 'var(--secondary-container)',
        border: '1px solid transparent',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3)',
      }} />
  );
}

/* ── Combo Chart (SVG) ── */
function ComboChart({ cfg }: { cfg: {
  labels: string[]; bars: number[]; line: number[];
  yL: { max: number; ticks: number[]; fmt: (t: number) => string };
  yR: { min: number; max: number; ticks: number[]; fmt: (t: number) => string };
  ok: (i: number) => boolean;
  ref?: { v: number; axis: 'L' | 'R'; label: string };
  tip: (i: number) => string;
}}) {
  const W = 600, H = 280;
  const m = { l: 48, r: 52, t: 16, b: 32 }, iw = W - m.l - m.r, ih = H - m.t - m.b;
  const n = cfg.labels.length, bw = Math.min(50, iw / n * 0.44);
  const X = (i: number) => m.l + iw * (i + 0.5) / n;
  const YL = (v: number) => m.t + ih * (1 - v / cfg.yL.max);
  const YR = (v: number) => m.t + ih * (1 - (v - cfg.yR.min) / (cfg.yR.max - cfg.yR.min));
  const [hov, setHov] = useState<number | null>(null);

  const pts = cfg.line.map((v, i) => `${X(i)},${YR(v)}`).join(' L');

  return (
    <div className="relative w-full">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ overflow: 'visible' }}>
        {/* Grid lines */}
        {cfg.yL.ticks.map(t => (
          <g key={`gl${t}`}>
            <line x1={m.l} x2={W - m.r} y1={YL(t)} y2={YL(t)} stroke="var(--border)" />
            <text x={m.l - 8} y={YL(t) + 4} textAnchor="end" style={{ fontSize: 11, fill: 'var(--outline)' }}>{cfg.yL.fmt(t)}</text>
          </g>
        ))}
        {cfg.yR.ticks.map(t => (
          <text key={`gr${t}`} x={W - m.r + 8} y={YR(t) + 4} style={{ fontSize: 11, fill: 'var(--outline)' }}>{cfg.yR.fmt(t)}</text>
        ))}
        {cfg.labels.map((l, i) => (
          <text key={`lbl${i}`} x={X(i)} y={H - 8} textAnchor="middle" className="mono-label" style={{ fontSize: 10, fill: 'var(--outline)' }}>{l}</text>
        ))}

        {/* Bars */}
        {cfg.bars.map((v, i) => {
          const y = YL(v), h = m.t + ih - y, ok = cfg.ok(i);
          return (
            <g key={`bar${i}`} onMouseEnter={() => setHov(i)} onMouseLeave={() => setHov(null)} style={{ cursor: 'pointer' }}>
              <rect x={X(i) - bw / 2} y={y} width={bw} height={Math.max(0, h)} rx={8}
                fill={ok ? 'var(--primary)' : 'var(--surface-container-high)'}
                stroke={ok ? 'none' : 'var(--border)'}
                style={{ transition: 'height 0.4s ease, y 0.4s ease' }} />
              <rect x={X(i) - iw / n / 2} y={m.t} width={iw / n} height={ih} fill="transparent" />
            </g>
          );
        })}

        {/* Reference line */}
        {cfg.ref && (() => {
          const y = cfg.ref.axis === 'L' ? YL(cfg.ref.v) : YR(cfg.ref.v);
          return <>
            <line x1={m.l} x2={W - m.r} y1={y} y2={y} stroke="var(--secondary-container)" strokeWidth={1.5} strokeDasharray="5 5" />
            <text x={W - m.r - 4} y={y - 7} textAnchor="end" style={{ fontSize: 11, fontWeight: 600, fill: 'var(--secondary)' }}>{cfg.ref.label}</text>
          </>;
        })()}

        {/* Line */}
        <path d={`M${pts}`} fill="none" stroke="var(--secondary-container)" strokeWidth={2.4} strokeLinejoin="round" />
        {cfg.line.map((v, i) => (
          <circle key={`dot${i}`} cx={X(i)} cy={YR(v)} r={5}
            fill="var(--surface-container-lowest)" stroke="var(--secondary-container)" strokeWidth={2.4} />
        ))}
      </svg>

      {/* Tooltip */}
      {hov !== null && (
        <div className="absolute pointer-events-none px-3 py-2 rounded-xl text-xs"
          style={{
            left: `${X(hov) / W * 100}%`, top: `${Math.min(YL(cfg.bars[hov]), YR(cfg.line[hov])) / H * 100}%`,
            transform: 'translate(-50%, calc(-100% - 12px))',
            background: 'var(--surface-container-lowest)', border: '1px solid var(--border)',
            boxShadow: 'var(--shadow-ambient)', color: 'var(--on-surface)',
          }}
          dangerouslySetInnerHTML={{ __html: cfg.tip(hov) }}
        />
      )}
    </div>
  );
}

/* ── AI Answer (rule-based) ── */
function aiAnswer(q: string, d: DashData): string {
  const rows = d.stab.map(r => ({ ...r, sc: score(r.sigma, d) }));
  const ok = rows.filter(r => r.sc >= 1), ng = rows.filter(r => r.sc < 1);
  const sr = sigRef(d);

  if (/요약|정리|summary/i.test(q)) {
    if (!rows.length) return '데이터가 없습니다. serve_dashboard.py 실행 후 새로고침하세요.';
    const pw = d.part.length ? d.part.reduce((a, b) => a.scr < b.scr ? a : b) : null;
    const lw = d.lin.rows.length ? d.lin.rows.reduce((a, b) => a.scr < b.scr ? a : b) : null;
    let out = `운전점 ${rows.length}곳 중 ${ok.length}곳이 정착시간 ${d.tsSpec}초 요구를 충족합니다.\n`;
    out += `여유는 ${ff(Math.max(...rows.map(r => r.sc)), 3)}에서 ${ff(Math.min(...rows.map(r => r.sc)), 3)}까지 떨어집니다.\n`;
    if (pw) out += `임계 모드는 δ가 지배하는 실수극이며 SCR ${S(pw.scr)}에서 참여도 ${ff(pw.pd + pw.pw, 3)}입니다.\n`;
    if (lw) out += `선형화 유효 범위는 SCR ${S(lw.scr)}에서 ${ff(lw.thr * 100, 1)}%로 가장 좁습니다.`;
    return out;
  }
  if (/미달|부족|fail/i.test(q)) {
    if (!ng.length) return '모든 운전점이 요구를 충족합니다.';
    return '요구에 못 미치는 운전점:\n' + ng.map(r =>
      `SCR ${S(r.scr)}: 여유 ${ff(r.sc, 3)}, ${Math.round((1 - r.sc) * 100)}% 부족`).join('\n');
  }
  if (/다음|추천|next/i.test(q)) {
    const empty: [number, number[]][] = [];
    d.gridXR.forEach(xr => { const row = d.grid[ff(xr, 1)] || {};
      const miss = d.gridSCR.filter(s => row[s] === undefined);
      if (miss.length) empty.push([xr, miss]); });
    if (empty.length) {
      const [xr, miss] = empty.sort((a, b) => b[1].length - a[1].length)[0];
      return `X/R ${ff(xr, 1)} 행이 가장 많이 비어 있습니다.\npython Simulation/runner.py --XR ${ff(xr, 1)} --SCR ${miss.map(S).join(' ')}`;
    }
    return '비어 있는 조건이 없습니다.';
  }
  return '결과 요약, 미달 운전점, 다음 조건을 물어보세요.';
}

/* ── Chart view configs ── */
function getChartCfg(view: string, d: DashData) {
  const sr = sigRef(d);
  if (view === 'stab') {
    const ts = d.stab.map(r => TS_COEF / r.sigma);
    const mx = Math.ceil(Math.max(...d.stab.map(r => r.sigma), sr) * 1.2);
    return {
      title: '감쇠율과 정착시간',
      stats: [['목표 감쇠율', `${ff(sr, 1)} /s`], ['최장 정착시간', `${ff(Math.max(...ts))} s`]],
      labels: d.stab.map(r => S(r.scr)), bars: d.stab.map(r => r.sigma), line: ts,
      ok: (i: number) => score(d.stab[i].sigma, d) >= 1,
      yL: { max: mx, ticks: [...Array(mx + 1).keys()].filter(t => t % 2 === 0 || mx <= 5), fmt: (t: number) => String(t) },
      yR: { min: 0, max: Math.ceil(Math.max(...ts) * 1.25), ticks: [0, 1, 2, 3, 4].filter(t => t <= Math.ceil(Math.max(...ts) * 1.25)), fmt: (t: number) => t + 's' },
      ref: { v: sr, axis: 'L' as const, label: `목표 σ ${ff(sr, 1)}` },
      tip: (i: number) => `<b>SCR ${S(d.stab[i].scr)}</b><br>σ ${ff(d.stab[i].sigma, 4)} /s, t<sub>s</sub> ${ff(ts[i])} s`,
      note: '밝은 막대가 목표를 넘은 운전점입니다.',
    };
  }
  if (view === 'lin') {
    const R = d.lin.rows, top = Math.ceil(Math.max(...R.map(r => r.thr * 100)) / 10 + 1) * 10;
    return {
      title: `선형화 유효 범위 (${d.lin.input})`,
      stats: [['허용 오차', `${ff(d.lin.tol * 100, 1)}%`], ['회귀 지수', `${ff(Math.min(...R.map(r => r.n)))} ~ ${ff(Math.max(...R.map(r => r.n)))}`]],
      labels: R.map(r => S(r.scr)), bars: R.map(r => r.thr * 100), line: R.map(r => r.n), ok: () => true,
      yL: { max: top, ticks: [0, 20, 40, 60].filter(t => t <= top), fmt: (t: number) => t + '%' },
      yR: { min: 1.5, max: 2.3, ticks: [1.6, 1.8, 2.0, 2.2], fmt: (t: number) => ff(t, 1) },
      ref: { v: 2.0, axis: 'R' as const, label: 'n = 2' },
      tip: (i: number) => `<b>SCR ${S(R[i].scr)}</b><br>유효 ${ff(R[i].thr * 100, 1)}%, n ${ff(R[i].n)}`,
      note: '지수가 2에 가까우면 오차가 섭동의 제곱에 비례합니다.',
    };
  }
  // pair
  const P = d.pair, sums = P.map(r => -(r.slow + r.fast));
  return {
    title: '스윙극쌍의 합과 필터 혼합',
    stats: [['순수 2차계 기준', String(d.dpj)], ['필터 참여도', `${ff(P[0]?.ppf, 3)} → ${ff(P[P.length-1]?.ppf ?? 0, 3)}`]],
    labels: P.map(r => S(r.scr)), bars: sums, line: P.map(r => r.ppf),
    ok: (i: number) => Math.abs(sums[i] - d.dpj) / d.dpj < 0.1,
    yL: { max: 50, ticks: [0, 10, 20, 30, 40, 50], fmt: (t: number) => String(t) },
    yR: { min: 0, max: 0.16, ticks: [0, 0.05, 0.1, 0.15], fmt: (t: number) => ff(t, 2) },
    ref: { v: d.dpj, axis: 'L' as const, label: `Dp/J ${d.dpj}` },
    tip: (i: number) => `<b>SCR ${S(P[i].scr)}</b><br>합 ${ff(-sums[i])}, p(Pf) ${ff(P[i].ppf, 4)}`,
    note: '밝은 막대만 순수한 2차계입니다.',
  };
}

/* ================================================================
   Main Lab Component
================================================================ */
export default function Lab() {
  const [d, setD] = useState<DashData>({ ...DEFAULT });
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  const [view, setView] = useState<'stab' | 'lin' | 'pair'>('stab');
  const [chatLog, setChatLog] = useState<{ me: string; bot: string }[]>([]);
  const [chatInput, setChatInput] = useState('');
  const logRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // ── Auto-load ──
  useEffect(() => {
    (async () => {
      const nd = { ...DEFAULT, grid: {}, gridXR: [], gridSCR: [] };
      const got: string[] = [], missing: string[] = [];

      // 1) LATEST.json
      let runName: string | null = null;
      try {
        const latest = await fetch('/api/latest').then(r => { if (!r.ok) throw r; return r.json(); });
        runName = latest.run_name;
      } catch {
        setToast('LATEST.json 을 읽지 못했습니다. serve_dashboard.py 를 실행하세요.');
        setLoading(false);
        return;
      }

      // 2) meta.json
      const base = `/results/${runName}`;
      try {
        const meta = await fetch(`${base}/meta.json`).then(r => { if (!r.ok) throw r; return r.json(); });
        parseJSON(meta, nd);
      } catch { missing.push('meta.json'); }

      // 3) Four result files
      const FILES = ['eigenvalue_results.json', 'participation_factors.json', 'linearization_validity_Pref.json', 'sync_reduction.json'];
      for (const name of FILES) {
        try {
          const j = await fetch(`${base}/${name}`).then(r => { if (!r.ok) throw new Error(String(r.status)); return r.json(); });
          const label = parseJSON(j, nd);
          if (label) got.push(label);
        } catch { missing.push(name); }
      }

      // 4) 2D grid
      try {
        const g = await fetch('/api/grid2d').then(r => { if (!r.ok) throw r; return r.json(); });
        if (g.grid) nd.grid = g.grid;
        if (g.gridXR?.length) nd.gridXR = g.gridXR;
        if (g.gridSCR?.length) nd.gridSCR = g.gridSCR;
        got.push('2D grid');
      } catch {}

      let msg = '';
      if (got.length) msg += `${runName}: ${got.join(', ')} 반영.`;
      if (missing.length) msg += ` 누락: ${missing.join(', ')} → 기본값.`;
      setToast(msg);
      setD(nd);
      setLoading(false);
    })();
  }, []);

  // ── File upload handler ──
  const handleFiles = useCallback(async (files: FileList) => {
    const nd = { ...d };
    const got: string[] = [];
    for (const file of Array.from(files)) {
      try {
        const j = JSON.parse(await file.text());
        const label = parseJSON(j, nd);
        if (label) got.push(label);
      } catch { /* skip */ }
    }
    if (got.length) {
      setD({ ...nd });
      setToast(`${got.join(', ')} 결과를 반영했습니다.`);
    } else {
      setToast('읽을 수 있는 결과가 없습니다.');
    }
  }, [d]);

  // ── Chat ──
  const ask = useCallback((q: string) => {
    if (!q.trim()) return;
    setChatLog(prev => [...prev, { me: q, bot: aiAnswer(q, d) }]);
    setChatInput('');
    setTimeout(() => logRef.current?.scrollTo(0, logRef.current.scrollHeight), 50);
  }, [d]);

  // ── Derived values ──
  const rows = d.stab.map(r => ({ ...r, sc: score(r.sigma, d) }));
  const okRows = rows.filter(r => r.sc >= 1);
  const worst = rows.length ? rows.reduce((a, b) => a.sc < b.sc ? a : b) : null;
  const sr = sigRef(d);
  const MAX_GAUGE = 1.3;

  const pw = d.part.length ? d.part.reduce((a, b) => a.scr < b.scr ? a : b) : null;
  const lw = d.lin.rows.length ? d.lin.rows.reduce((a, b) => a.scr < b.scr ? a : b) : null;

  const hasChart = view === 'stab' ? d.stab.length > 0 : view === 'lin' ? d.lin.rows.length > 0 : d.pair.length > 0;
  const chartCfg = hasChart ? getChartCfg(view, d) : null;

  // 2D grid stats
  let gridDone = 0, gridTotal = d.gridXR.length * d.gridSCR.length;
  d.gridXR.forEach(xr => { const row = d.grid[ff(xr, 1)] || {};
    d.gridSCR.forEach(s => { if (row[s] !== undefined) gridDone++; }); });

  if (loading) return (
    <div className="max-w-[1600px] mx-auto px-8 py-20 text-center">
      <span className="mono-label" style={{ color: 'var(--outline)' }}>LOADING RESULTS...</span>
    </div>
  );

  return (
    <div className="max-w-[1600px] mx-auto px-8 py-8 space-y-5">

      {/* ── Header ── */}
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-display" style={{ color: 'var(--primary)', fontSize: 28 }}>
            GFM 소신호 안정도
          </h1>
          <p className="mono-clock mt-1" style={{ color: 'var(--outline)', fontSize: 12 }}>
            {d.run}, X/R {ff(d.xr, 1)}, 목표 σ {ff(sr, 1)} /s
          </p>
        </div>
        <div className="flex gap-2">
          {/* View tabs */}
          <div className="flex gap-0.5 p-1 rounded-xl" style={{ background: 'var(--surface-container)' }}>
            {(['stab', 'lin', 'pair'] as const).map(v => (
              <button key={v} onClick={() => setView(v)}
                className="mono-label px-3 py-1.5 rounded-lg transition-all duration-200"
                style={{
                  fontSize: 10,
                  color: view === v ? 'var(--primary)' : 'var(--outline)',
                  background: view === v ? 'var(--surface-container-lowest)' : 'transparent',
                  border: view === v ? '1px solid var(--border)' : '1px solid transparent',
                  boxShadow: view === v ? 'var(--shadow-ambient)' : 'none',
                }}>
                {v === 'stab' ? '안정도' : v === 'lin' ? '선형화' : '스윙쌍'}
              </button>
            ))}
          </div>
          {/* File upload */}
          <input ref={fileRef} type="file" multiple accept=".json" className="hidden"
            onChange={e => e.target.files && handleFiles(e.target.files)} />
          <button onClick={() => fileRef.current?.click()}
            className="mc-btn-secondary mono-label" style={{ fontSize: 10, padding: '6px 14px' }}>
            결과 불러오기
          </button>
        </div>
      </div>

      {/* ── Toast ── */}
      {toast && (
        <p className="mono-clock" style={{ color: 'var(--outline)', fontSize: 12 }}>{toast}</p>
      )}

      {/* ── Top Cards Grid ── */}
      <div className="grid gap-5" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gridTemplateAreas: '"hero hero hero side" "k1 k2 k3 map"' }}>

        {/* Hero — 운전점별 여유 */}
        <div className="glass-card" style={{ gridArea: 'hero', padding: 20 }}>
          <div className="flex items-center justify-between mb-3">
            <span className="mono-label" style={{ color: 'var(--primary)', fontSize: 11 }}>운전점별 여유</span>
            <span className="mono-clock" style={{ color: 'var(--outline)', fontSize: 11 }}>흰 눈금이 목표 1.0</span>
          </div>
          <div className="grid gap-6 items-center" style={{ gridTemplateColumns: 'minmax(140px, 200px) 1fr' }}>
            <div>
              <span className="mono-label" style={{ color: 'var(--outline)', fontSize: 10 }}>요구 충족</span>
              <div className="mono-metric mt-1" style={{ color: 'var(--primary)', fontSize: 32 }}>
                {okRows.length}<span className="text-body-sm ml-1" style={{ color: 'var(--outline)', fontWeight: 400 }}>/ {rows.length} 운전점</span>
              </div>
              <p className="mono-clock mt-2" style={{ color: 'var(--outline)', fontSize: 11 }}>
                {okRows.length ? `충족 SCR ${okRows.map(r => S(r.scr)).join(', ')}` : '충족하는 운전점이 없습니다'}
              </p>
            </div>
            <div className="space-y-2">
              {rows.map(r => (
                <GaugeBar key={r.scr} label={`SCR ${S(r.scr)}`} value={r.sc} max={MAX_GAUGE} ok={r.sc >= 1} />
              ))}
            </div>
          </div>
        </div>

        {/* Side — 최약 운전점 */}
        <div className="glass-card" style={{ gridArea: 'side', padding: 20 }}>
          <span className="mono-label" style={{ color: 'var(--primary)', fontSize: 11 }}>최약 운전점</span>
          {worst ? (
            <div className="mt-3 flex justify-between items-end h-full" style={{ paddingBottom: 4 }}>
              <div>
                <div className="mono-metric" style={{ color: 'var(--on-surface)', fontSize: 28 }}>
                  {ff(worst.sigma)}<span className="text-body-sm ml-1" style={{ color: 'var(--outline)', fontWeight: 400 }}>/ {ff(sr, 1)}</span>
                </div>
                <p className="mono-clock mt-1" style={{ color: 'var(--outline)', fontSize: 11 }}>
                  SCR {S(worst.scr)}, 정착 {ff(TS_COEF / worst.sigma)} s
                </p>
                <span className="mono-label inline-block mt-1 px-2 py-0.5 rounded" style={{
                  fontSize: 10,
                  background: worst.sc >= 1 ? 'rgba(5,21,43,0.06)' : 'rgba(129,85,0,0.08)',
                  color: worst.sc >= 1 ? 'var(--primary)' : 'var(--secondary)',
                }}>{worst.sc >= 1 ? '충족' : `${Math.round((1 - worst.sc) * 100)}% 부족`}</span>
              </div>
              {/* Meter */}
              <div className="w-12 h-20 rounded-xl relative overflow-hidden" style={{ background: 'var(--surface-container-high)', border: '1px solid var(--border)' }}>
                <div className="absolute left-0 right-0 bottom-0 transition-all duration-500"
                  style={{ height: `${Math.min(worst.sc, 1) * 100}%`, background: 'linear-gradient(0deg, var(--secondary-container), var(--secondary-container))' }} />
                <div className="absolute left-[-2px] right-[-2px] h-0.5" style={{ bottom: 'calc(100% - 1px)', background: 'var(--on-surface)' }} />
              </div>
            </div>
          ) : (
            <p className="mono-clock mt-4" style={{ color: 'var(--outline)' }}>데이터 없음</p>
          )}
        </div>

        {/* K1 — 동기화 참여도 */}
        <div className="glass-card flex flex-col" style={{ gridArea: 'k1', padding: 20 }}>
          <span className="mono-label mb-3" style={{ color: 'var(--primary)', fontSize: 11 }}>동기화 참여도</span>
          <div className="flex items-center justify-between flex-1">
            <div>
              <div className="mono-metric" style={{ color: 'var(--on-surface)', fontSize: 22 }}>
                {pw ? ff(pw.pd + pw.pw, 3) : '—'}
              </div>
              <p className="mono-clock mt-1" style={{ color: 'var(--outline)', fontSize: 10 }}>
                {pw ? `SCR ${S(pw.scr)}, δ가 지배` : ''}
              </p>
            </div>
            <Ring pct={pw ? pw.pd + pw.pw : 0} color="var(--primary)" size={76} />
          </div>
        </div>

        {/* K2 — 선형화 유효 범위 */}
        <div className="glass-card flex flex-col" style={{ gridArea: 'k2', padding: 20 }}>
          <span className="mono-label mb-3" style={{ color: 'var(--primary)', fontSize: 11 }}>선형화 유효 범위</span>
          <div className="flex items-center justify-between flex-1">
            <div>
              <div className="mono-metric" style={{ color: 'var(--on-surface)', fontSize: 22 }}>
                {lw ? `${ff(lw.thr * 100, 1)}%` : '—'}
              </div>
              <p className="mono-clock mt-1" style={{ color: 'var(--outline)', fontSize: 10 }}>
                {lw ? `SCR ${S(lw.scr)}, 허용 ${ff(d.lin.tol * 100, 1)}%` : ''}
              </p>
            </div>
            <Ring pct={lw ? lw.thr : 0} color="var(--secondary-container)" size={76} />
          </div>
        </div>

        {/* K3 — 충족 비율 */}
        <div className="glass-card flex flex-col" style={{ gridArea: 'k3', padding: 20 }}>
          <span className="mono-label mb-3" style={{ color: 'var(--primary)', fontSize: 11 }}>충족 비율</span>
          <div className="flex items-center justify-between flex-1">
            <div>
              <div className="mono-metric" style={{ color: 'var(--on-surface)', fontSize: 22 }}>
                {okRows.length}<span className="text-body-sm ml-1" style={{ color: 'var(--outline)', fontWeight: 400 }}>/ {rows.length}</span>
              </div>
              <p className="mono-clock mt-1" style={{ color: 'var(--outline)', fontSize: 10 }}>
                목표 정착 {d.tsSpec} s 기준
              </p>
            </div>
            <Ring pct={rows.length ? okRows.length / rows.length : 0} color="var(--secondary)" size={76} />
          </div>
        </div>

        {/* Map — 2D 스윕 */}
        <div className="glass-card" style={{ gridArea: 'map', padding: 20 }}>
          <div className="flex items-center justify-between mb-3">
            <span className="mono-label" style={{ color: 'var(--primary)', fontSize: 11 }}>2D 스윕 진행</span>
            <span className="mono-clock" style={{ color: 'var(--outline)', fontSize: 10 }}>{gridDone} / {gridTotal} 계산</span>
          </div>
          <div className="space-y-1.5">
            {d.gridXR.map(xr => {
              const row = d.grid[ff(xr, 1)] || {};
              return (
                <div key={xr} className="grid items-center gap-1.5" style={{ gridTemplateColumns: `36px repeat(${d.gridSCR.length}, 1fr)` }}>
                  <span className="mono-clock" style={{ color: 'var(--outline)', fontSize: 10 }}>{ff(xr, 1)}</span>
                  {d.gridSCR.map(s => <MapCell key={s} sigma={row[s]} xr={xr} scr={s} d={d} />)}
                </div>
              );
            })}
            {/* Column labels */}
            <div className="grid gap-1.5" style={{ gridTemplateColumns: `36px repeat(${d.gridSCR.length}, 1fr)` }}>
              <span />
              {d.gridSCR.map(s => (
                <span key={s} className="mono-clock text-center" style={{ color: 'var(--outline-variant)', fontSize: 9 }}>{S(s)}</span>
              ))}
            </div>
          </div>
          {/* Legend */}
          <div className="flex gap-4 mt-3 mono-clock" style={{ fontSize: 10, color: 'var(--outline)' }}>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded" style={{ background: 'var(--primary)' }} />충족</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded" style={{ background: 'var(--secondary-container)' }} />미달</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded" style={{ background: 'var(--surface-container)', border: '1px solid var(--border)' }} />미계산</span>
          </div>
        </div>
      </div>

      {/* ── Chart + AI ── */}
      <div className="grid grid-cols-12 gap-5">
        {/* Chart */}
        <div className="col-span-12 lg:col-span-7 glass-card" style={{ padding: 20 }}>
          {chartCfg ? (
            <>
              <div className="flex items-center justify-between mb-3">
                <span className="mono-label" style={{ color: 'var(--primary)', fontSize: 11 }}>{chartCfg.title}</span>
              </div>
              <div className="flex flex-wrap gap-6 mb-4">
                {chartCfg.stats.map(([k, v]) => (
                  <div key={k}>
                    <span className="mono-clock" style={{ color: 'var(--outline)', fontSize: 11 }}>{k}</span>
                    <div className="mono-metric mt-0.5" style={{ color: 'var(--on-surface)', fontSize: 18 }}>{v}</div>
                  </div>
                ))}
              </div>
              <ComboChart cfg={chartCfg} />
              <p className="mono-clock mt-3" style={{ color: 'var(--outline)', fontSize: 11 }}>{chartCfg.note}</p>
            </>
          ) : (
            <p className="mono-clock" style={{ color: 'var(--outline)' }}>데이터 없음</p>
          )}
        </div>

        {/* AI Assistant */}
        <div className="col-span-12 lg:col-span-5 glass-card flex flex-col" style={{ padding: 20, minHeight: 380 }}>
          <div className="flex items-center justify-between mb-3">
            <span className="mono-label" style={{ color: 'var(--primary)', fontSize: 11 }}>연구 도우미</span>
            <span className="mono-clock" style={{ color: 'var(--outline)', fontSize: 10 }}>현재 결과로 답합니다</span>
          </div>

          {/* Log */}
          <div ref={logRef} className="flex-1 overflow-y-auto space-y-2 mb-3" style={{ maxHeight: 220 }}>
            {chatLog.map((c, i) => (
              <div key={i} className="space-y-1.5">
                <div className="text-right">
                  <span className="inline-block px-3 py-2 rounded-xl text-body-sm text-right"
                    style={{ background: 'var(--primary)', color: 'var(--on-primary)', fontSize: 13, maxWidth: '85%' }}>{c.me}</span>
                </div>
                <div>
                  <span className="inline-block px-3 py-2 rounded-xl text-body-sm whitespace-pre-line"
                    style={{ background: 'var(--surface-container)', color: 'var(--on-surface)', fontSize: 13, maxWidth: '85%', border: '1px solid var(--border)' }}>{c.bot}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Quick buttons */}
          <div className="flex flex-wrap gap-1.5 mb-3">
            {[['결과 요약', '요약'], ['어디가 미달이야?', '미달'], ['다음에 돌릴 조건', '다음']].map(([label, q]) => (
              <button key={q} onClick={() => ask(q)}
                className="mono-label px-3 py-1.5 rounded-full transition-colors"
                style={{ fontSize: 10, border: '1px solid var(--border)', color: 'var(--on-surface-variant)', background: 'var(--surface-container-low)' }}>
                {label}
              </button>
            ))}
          </div>

          {/* Input */}
          <form onSubmit={e => { e.preventDefault(); ask(chatInput); }}
            className="flex gap-2 items-center px-3 py-2 rounded-full"
            style={{ background: 'var(--surface-container)', border: '1px solid var(--border)' }}>
            <input value={chatInput} onChange={e => setChatInput(e.target.value)}
              placeholder="결과에 대해 물어보세요"
              className="flex-1 bg-transparent border-0 outline-none text-body-sm"
              style={{ color: 'var(--on-surface)', fontSize: 13 }} />
            <button type="submit" className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{ background: 'var(--primary)', color: 'var(--on-primary)' }}>
              <svg width="14" height="14" viewBox="0 0 24 24"><path d="M3 11 21 3l-8 18-2-8-8-2z" fill="currentColor"/></svg>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
