import { useEffect, useState } from 'react';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from 'recharts';
import { fetchJSON } from '../../lib/api';

const SCR_COLORS: Record<string, string> = {
  '1.0': '#ef4444', '1.3': '#ef4444', '1.4': '#f97316', '1.5': '#eab308',
  '1.6': '#22c55e', '1.7': '#3b82f6', '2.0': '#8b5cf6',
  '3.0': '#ec4899', '5.0': '#06b6d4',
};
function getColor(scr: number): string {
  return SCR_COLORS[scr.toFixed(1)] ?? '#94a3b8';
}

interface Props {
  computeResults?: Record<string, any> | null;
}

/** Build eigenvalue points from compute results format: {SCR_key: {modes: [...]}} */
function fromCompute(results: Record<string, any>): any[] {
  const pts: any[] = [];
  for (const [scr_k, r] of Object.entries(results)) {
    if (!r.modes) continue;
    const scr = parseFloat(scr_k);
    for (const m of r.modes) {
      pts.push({ SCR: scr, re: m.re, im: m.im, zeta: m.zeta, f_hz: m.f_hz, band: m.band });
      if (Math.abs(m.im) > 1e-6) {
        pts.push({ SCR: scr, re: m.re, im: -m.im, zeta: m.zeta, f_hz: m.f_hz, band: m.band });
      }
    }
  }
  return pts;
}

export default function EigenvalueLocus({ computeResults }: Props) {
  const [stored, setStored] = useState<any>(null);

  useEffect(() => {
    if (!computeResults) fetchJSON('/eigenvalue_locus').then(setStored).catch(() => {});
  }, [computeResults]);

  const points = computeResults ? fromCompute(computeResults) : stored?.points;
  if (!points?.length) {
    return <div className="text-gray-500 text-sm p-4">Eigenvalue data loading...</div>;
  }

  const grouped = new Map<number, any[]>();
  points.forEach((p: any) => {
    if (!grouped.has(p.SCR)) grouped.set(p.SCR, []);
    grouped.get(p.SCR)!.push(p);
  });

  return (
    <div>
      <h3 className="text-sm font-semibold text-cyan-400 mb-1">Eigenvalue Locus</h3>
      <p className="text-sm text-gray-500 mb-3">Complex plane / SCR color-coded</p>
      <ResponsiveContainer width="100%" height={340}>
        <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis type="number" dataKey="re" name="Re(λ)" stroke="#9ca3af"
            label={{ value: 'Re(λ) [1/s]', position: 'bottom', offset: 5, fill: '#9ca3af', fontSize: 14 }} />
          <YAxis type="number" dataKey="im" name="Im(λ)" stroke="#9ca3af"
            label={{ value: 'Im(λ) [rad/s]', angle: -90, position: 'insideLeft', fill: '#9ca3af', fontSize: 14 }} />
          <ReferenceLine x={0} stroke="#ef4444" strokeDasharray="4 4" strokeWidth={1.5} />
          <ReferenceLine y={0} stroke="#4b5563" strokeDasharray="2 2" />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
            labelStyle={{ color: '#9ca3af' }}
            formatter={(val: any, name: any) => [Number(val).toFixed(2), name]}
            labelFormatter={(_, payload) => {
              const p = payload?.[0]?.payload;
              return p ? `SCR=${p.SCR} | ${p.band} | ζ=${p.zeta?.toFixed(3)} | f=${p.f_hz?.toFixed(1)}Hz` : '';
            }}
          />
          <Legend />
          {Array.from(grouped.entries())
            .sort(([a], [b]) => b - a)
            .map(([scr, pts]) => (
              <Scatter key={scr} name={`SCR ${scr}`} data={pts} fill={getColor(scr)} opacity={0.85} r={4} />
            ))}
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
