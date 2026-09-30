/* 안정도 화면 차트 프리미티브 — Verification.tsx 에서 옮겼다.

   MapCell 만 바뀌었다: 셀을 고를 수 있게 onSelect·selected 를 받는다
   ('선택한 운전점 σ' KPI 가 이 선택을 읽는다). 나머지는 원본 그대로다. */

import { useState } from 'react';
import { ff, S, score, type ChartCfg, type DashData } from '../../lib/stabilityData';

/* ── 도넛 게이지 ── */
export function Ring({ pct, color, size = 80 }: { pct: number; color: string; size?: number }) {
  const r = size * 0.4, c = 2 * Math.PI * r, v = Math.max(0, Math.min(1, pct));
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-container-high)" strokeWidth={size * 0.1} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={size * 0.1} strokeLinecap="round"
        strokeDasharray={`${c * v} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dasharray 0.6s ease' }} />
      <text x={size / 2} y={size / 2 + 5} textAnchor="middle" className="mono-metric"
        style={{ fontSize: size * 0.19, fill: 'var(--on-surface)', fontWeight: 700 }}>
        {Math.round(v * 100)}%
      </text>
    </svg>
  );
}

/* ── 가로 게이지 바 (운전점별 여유) ── */
export function GaugeBar({ label, value, max, ok }: { label: string; value: number; max: number; ok: boolean }) {
  const pct = Math.min(value / max, 1) * 100;
  const refPct = (1 / max) * 100;
  return (
    <div className="flex items-center gap-3" style={{ fontSize: 16 }}>
      <span className="mono-clock w-16 shrink-0" style={{ color: 'var(--outline)', fontSize: 15 }}>{label}</span>
      <div className="flex-1 relative h-3.5 rounded-lg overflow-visible" style={{ background: 'var(--surface-container-high)' }}>
        <div className="absolute left-0 top-0 bottom-0 rounded-lg transition-all duration-500"
          style={{ width: `${pct}%`, background: ok ? 'var(--primary)' : 'var(--secondary-container)' }} />
        <div className="absolute top-[-3px] bottom-[-3px] w-0.5 rounded bg-white"
          style={{ left: `calc(${refPct}% - 1px)`, boxShadow: '0 0 0 2px var(--outline-variant)' }} />
      </div>
      <span className="mono-clock w-12 text-right font-semibold"
        style={{ color: ok ? 'var(--primary)' : 'var(--secondary)', fontSize: 15 }}>
        {ff(value, 3)}
      </span>
    </div>
  );
}

/* ── 2D 격자 셀 — 클릭으로 운전점 선택 ── */
export function MapCell({ sigma, xr, scr, d, selected, onSelect }: {
  sigma?: number; xr: number; scr: number; d: DashData;
  selected?: boolean; onSelect?: (xr: number, scr: number, sigma: number) => void;
}) {
  if (sigma === undefined) return (
    <div className="aspect-square rounded-md" title={`X/R ${ff(xr, 1)}, SCR ${S(scr)}: 미계산`}
      style={{ background: 'var(--surface-container)', border: '1px solid var(--border)' }} />
  );
  const sc = score(sigma, d), ok = sc >= 1;
  return (
    <button type="button"
      onClick={() => onSelect?.(xr, scr, sigma)}
      aria-pressed={!!selected}
      className="aspect-square rounded-md transition-transform hover:scale-110 cursor-pointer p-0"
      title={`X/R ${ff(xr, 1)}, SCR ${S(scr)}: σ ${ff(sigma)}, score ${ff(sc, 3)}`}
      style={{
        background: ok ? 'var(--primary)' : 'var(--secondary-container)',
        border: selected ? '2px solid var(--on-surface)' : '1px solid transparent',
        boxShadow: selected ? '0 0 0 2px var(--surface-container-lowest)' : 'inset 0 1px 0 rgba(255,255,255,0.3)',
      }} />
  );
}

/* ── 막대 + 선 콤보 차트 ── */
export function ComboChart({ cfg }: { cfg: ChartCfg }) {
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
        {cfg.yL.ticks.map(t => (
          <g key={`gl${t}`}>
            <line x1={m.l} x2={W - m.r} y1={YL(t)} y2={YL(t)} stroke="var(--border)" />
            <text x={m.l - 8} y={YL(t) + 4} textAnchor="end" style={{ fontSize: 15, fill: 'var(--outline)' }}>{cfg.yL.fmt(t)}</text>
          </g>
        ))}
        {cfg.yR.ticks.map(t => (
          <text key={`gr${t}`} x={W - m.r + 8} y={YR(t) + 4} style={{ fontSize: 15, fill: 'var(--outline)' }}>{cfg.yR.fmt(t)}</text>
        ))}
        {cfg.labels.map((l, i) => (
          <text key={`lbl${i}`} x={X(i)} y={H - 8} textAnchor="middle" className="mono-label"
            style={{ fontSize: 14, fill: 'var(--outline)' }}>{l}</text>
        ))}

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

        {cfg.ref && (() => {
          const y = cfg.ref.axis === 'L' ? YL(cfg.ref.v) : YR(cfg.ref.v);
          return <>
            <line x1={m.l} x2={W - m.r} y1={y} y2={y} stroke="var(--secondary-container)" strokeWidth={1.5} strokeDasharray="5 5" />
            <text x={W - m.r - 4} y={y - 7} textAnchor="end"
              style={{ fontSize: 15, fontWeight: 600, fill: 'var(--secondary)' }}>{cfg.ref.label}</text>
          </>;
        })()}

        <path d={`M${pts}`} fill="none" stroke="var(--secondary-container)" strokeWidth={2.4} strokeLinejoin="round" />
        {cfg.line.map((v, i) => (
          <circle key={`dot${i}`} cx={X(i)} cy={YR(v)} r={5}
            fill="var(--surface-container-lowest)" stroke="var(--secondary-container)" strokeWidth={2.4} />
        ))}
      </svg>

      {hov !== null && (
        <div className="absolute pointer-events-none px-3 py-2 rounded-xl text-sm"
          style={{
            left: `${X(hov) / W * 100}%`,
            top: `${Math.min(YL(cfg.bars[hov]), YR(cfg.line[hov])) / H * 100}%`,
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

/* ── KPI 카드 — 값 하나 + 부제 (+ 선택 강조) ── */
export function KpiCard({ label, value, sub, accent, selected }: {
  label: string; value: string; sub?: string; accent?: boolean; selected?: boolean;
}) {
  return (
    <div className="glass-card flex flex-col justify-between" style={{
      padding: 16,
      border: selected ? '2px solid var(--primary)' : '1px solid var(--border)',
    }}>
      <span className="mono-label" style={{ color: 'var(--outline)', fontSize: 14 }}>{label}</span>
      <div className="mono-metric mt-1" style={{
        color: accent ? 'var(--secondary)' : 'var(--on-surface)', fontSize: 24, lineHeight: 1.15,
      }}>{value}</div>
      {sub && <p className="mono-clock mt-1" style={{ color: 'var(--outline)', fontSize: 13.5, lineHeight: 1.5 }}>{sub}</p>}
    </div>
  );
}
