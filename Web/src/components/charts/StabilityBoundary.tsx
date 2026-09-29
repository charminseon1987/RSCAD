import { useEffect, useState } from 'react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, ReferenceLine,
} from 'recharts';
import { fetchJSON } from '../../lib/api';

const BAND_COLORS: Record<string, string> = {
  sync: '#3b82f6', control: '#06b6d4', lcl: '#a855f7',
};

interface Props {
  computeResults?: Record<string, any> | null;
}

function fromCompute(results: Record<string, any>) {
  return Object.entries(results)
    .filter(([, r]) => r.converged !== false)
    .map(([scr_k, r]) => ({
      SCR: parseFloat(scr_k),
      zeta_min: r.zeta_min,
      zeta_band: r.zeta_band,
      sync: r.band_zeta?.sync ?? null,
      control: r.band_zeta?.control ?? null,
      lcl: r.band_zeta?.lcl ?? null,
    }))
    .sort((a, b) => b.SCR - a.SCR);
}

export default function StabilityBoundary({ computeResults }: Props) {
  const [stored, setStored] = useState<any>(null);

  useEffect(() => {
    if (!computeResults) fetchJSON('/sweep2d').then(setStored).catch(() => {});
  }, [computeResults]);

  const chartData = computeResults
    ? fromCompute(computeResults)
    : stored?.points
        ?.filter((p: any) => p.converged)
        .map((p: any) => ({
          SCR: p.SCR, zeta_min: p.zeta_min, zeta_band: p.zeta_band,
          sync: p.band_zeta?.sync, control: p.band_zeta?.control, lcl: p.band_zeta?.lcl,
        }))
        .sort((a: any, b: any) => b.SCR - a.SCR);

  const zetaTarget = stored?.zeta_target ?? 0.1;

  if (!chartData?.length) {
    return <div className="text-gray-500 text-sm p-4">Loading...</div>;
  }

  return (
    <div>
      <h3 className="text-sm font-semibold text-amber-400 mb-1">Damping by SCR</h3>
      <p className="text-sm text-gray-500 mb-3">Band-separated ζ / dashed = target</p>
      <ResponsiveContainer width="100%" height={340}>
        <ComposedChart data={chartData} margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="SCR" stroke="#9ca3af" reversed
            label={{ value: 'SCR', position: 'bottom', offset: 5, fill: '#9ca3af', fontSize: 14 }} />
          <YAxis stroke="#9ca3af" domain={[0, 'auto']}
            label={{ value: 'ζ', angle: -90, position: 'insideLeft', fill: '#9ca3af', fontSize: 14 }} />
          <ReferenceLine y={zetaTarget} stroke="#ef4444" strokeDasharray="6 3" strokeWidth={1.5} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
            formatter={(val: any, name: any) => [val != null ? Number(val).toFixed(4) : '—', name]}
          />
          <Legend />
          <Bar dataKey="sync" name="Sync (0-5Hz)" fill={BAND_COLORS.sync} opacity={0.7} barSize={14} />
          <Bar dataKey="control" name="Control (5-100Hz)" fill={BAND_COLORS.control} opacity={0.7} barSize={14} />
          <Bar dataKey="lcl" name="LCL (100Hz+)" fill={BAND_COLORS.lcl} opacity={0.7} barSize={14} />
          <Line type="monotone" dataKey="zeta_min" name="ζ_min" stroke="#f59e0b" strokeWidth={2.5}
            dot={{ fill: '#f59e0b', r: 5 }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
