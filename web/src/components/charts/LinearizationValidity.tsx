import { useEffect, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, ReferenceLine,
} from 'recharts';
import { fetchJSON } from '../../lib/api';

const SCR_COLORS = ['#3b82f6', '#22c55e', '#eab308', '#f97316', '#ef4444', '#8b5cf6', '#ec4899'];

export default function LinearizationValidity() {
  const [data, setData] = useState<any>(null);
  const [selectedInput, setSelectedInput] = useState('Pref');

  useEffect(() => {
    fetchJSON('/linearization_validity').then(setData).catch(() => {});
  }, []);

  if (!data?.inputs) {
    return <div className="text-gray-500 text-sm p-4">Linearization validity 데이터 로딩 중...</div>;
  }

  const availableInputs = Object.keys(data.inputs);
  const current = data.inputs[selectedInput] || data.inputs[availableInputs[0]];
  if (!current) return null;

  const scrs = Object.keys(current.by_SCR).sort((a, b) => parseFloat(b) - parseFloat(a));

  // Build chart data: x = ratio (log), y = max_rel_error (log) per SCR
  // Find union of all ratios
  const allRatios = new Set<number>();
  scrs.forEach(scr => {
    current.by_SCR[scr].sweep?.forEach((s: any) => allRatios.add(s.ratio));
  });
  const ratios = Array.from(allRatios).sort((a, b) => a - b);

  const chartData = ratios.map(r => {
    const row: any = { ratio: r, ratio_pct: (r * 100).toFixed(1) };
    scrs.forEach(scr => {
      const sweep = current.by_SCR[scr].sweep;
      const pt = sweep?.find((s: any) => s.ratio === r);
      if (pt) row[`err_${scr}`] = pt.max_rel_error > 0 ? pt.max_rel_error * 100 : 0.001;
    });
    return row;
  });

  const tol = (current.tol ?? 0.05) * 100;

  return (
    <div className="glass p-5">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-sm font-semibold text-green-400">Linearization Validity</h2>
        <div className="flex gap-2">
          {availableInputs.map(inp => (
            <button key={inp} onClick={() => setSelectedInput(inp)}
              className={`text-sm px-3 py-1 rounded-lg transition ${
                selectedInput === inp
                  ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                  : 'bg-gray-800 text-gray-500 hover:text-gray-300'
              }`}>
              {inp}
            </button>
          ))}
        </div>
      </div>
      <p className="text-sm text-gray-500 mb-4">
        섭동 크기 vs 정규화 오차 / threshold = {tol}%
        {current.threshold_common_fit && ` / common fit = ${(current.threshold_common_fit * 100).toFixed(1)}%`}
      </p>
      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={chartData} margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="ratio_pct" stroke="#9ca3af"
            label={{ value: 'Perturbation [%]', position: 'bottom', offset: 5, fill: '#9ca3af', fontSize: 14 }} />
          <YAxis stroke="#9ca3af" scale="log" domain={['auto', 'auto']}
            label={{ value: 'Normalized Error [%]', angle: -90, position: 'insideLeft', fill: '#9ca3af', fontSize: 14 }} />
          <ReferenceLine y={tol} stroke="#ef4444" strokeDasharray="6 3" strokeWidth={1.5}
            label={{ value: `${tol}% tol`, fill: '#ef4444', fontSize: 14, position: 'right' }} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
            formatter={(val: any, name: any) => [`${Number(val).toFixed(4)}%`, String(name).replace('err_', 'SCR ')]}
            labelFormatter={(label) => `Perturbation: ${label}%`}
          />
          <Legend formatter={(val) => val.replace('err_', 'SCR ')} />
          {scrs.map((scr, i) => (
            <Line key={scr} type="monotone" dataKey={`err_${scr}`}
              name={`err_${scr}`}
              stroke={SCR_COLORS[i % SCR_COLORS.length]}
              strokeWidth={2} dot={{ r: 3 }} connectNulls />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
