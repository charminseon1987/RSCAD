import { useEffect, useState } from 'react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, ReferenceLine,
} from 'recharts';
import { fetchJSON } from '../../lib/api';

interface Props {
  computeResults?: Record<string, any> | null;
}

function fromCompute(results: Record<string, any>) {
  return Object.entries(results)
    .filter(([, r]) => r.converged !== false)
    .map(([k, r]) => ({
      SCR: parseFloat(k),
      delta_deg: r.delta_deg,
      delta_margin_deg: r.delta_margin_deg,
      v_od: r.v_od,
      v_dc: r.v_dc,
    }))
    .sort((a, b) => b.SCR - a.SCR);
}

export default function OperatingPoints({ computeResults }: Props) {
  const [stored, setStored] = useState<any>(null);

  useEffect(() => {
    if (!computeResults) fetchJSON('/operating_points').then(setStored).catch(() => {});
  }, [computeResults]);

  const chartData = computeResults
    ? fromCompute(computeResults)
    : stored?.points
        ?.filter((p: any) => p.converged)
        .map((p: any) => ({ SCR: p.SCR, delta_deg: p.delta_deg, delta_margin_deg: p.delta_margin_deg, v_od: p.v_od, v_dc: p.v_dc }))
        .sort((a: any, b: any) => b.SCR - a.SCR);

  if (!chartData?.length) {
    return <div className="text-gray-500 text-sm p-4">Loading...</div>;
  }

  return (
    <div>
      <h3 className="text-sm font-semibold text-purple-400 mb-1">Operating Points</h3>
      <p className="text-xs text-gray-500 mb-3">δ, margin, V_dc, V_od by SCR</p>
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={chartData} margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="SCR" stroke="#9ca3af" reversed
            label={{ value: 'SCR', position: 'bottom', offset: 5, fill: '#9ca3af', fontSize: 11 }} />
          <YAxis yAxisId="deg" stroke="#f59e0b" domain={[0, 90]}
            label={{ value: 'δ [deg]', angle: -90, position: 'insideLeft', fill: '#f59e0b', fontSize: 11 }} />
          <YAxis yAxisId="volt" orientation="right" stroke="#06b6d4"
            label={{ value: 'V [V]', angle: 90, position: 'insideRight', fill: '#06b6d4', fontSize: 11 }} />
          <ReferenceLine yAxisId="deg" y={90} stroke="#ef4444" strokeDasharray="6 3" />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
            formatter={(val: any, name: any) => [val != null ? Number(val).toFixed(2) : '—', name]}
          />
          <Legend />
          <Bar yAxisId="deg" dataKey="delta_deg" name="δ [deg]" fill="#f59e0b" opacity={0.6} barSize={18} />
          <Bar yAxisId="deg" dataKey="delta_margin_deg" name="margin [deg]" fill="#22c55e" opacity={0.4} barSize={18} />
          <Line yAxisId="volt" type="monotone" dataKey="v_dc" name="V_dc" stroke="#06b6d4" strokeWidth={2} dot={{ fill: '#06b6d4', r: 4 }} />
          <Line yAxisId="volt" type="monotone" dataKey="v_od" name="V_od" stroke="#a855f7" strokeWidth={2} dot={{ fill: '#a855f7', r: 4 }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
