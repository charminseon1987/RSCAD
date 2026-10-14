import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { fetchJSON } from '../../lib/api';

const SCR_COLORS = ['#3b82f6', '#22c55e', '#eab308', '#f97316', '#ef4444'];

const STATE_LABELS: Record<string, string> = {
  delta: 'delta [deg]', dw: 'delta_f [Hz]', Pf: 'P [kW]', Qf: 'Q [kvar]',
  i_od: 'i_od [A]', v_od: 'v_od [V]', v_dc: 'v_dc [V]',
};

// 모델이 쓰는 단위 → 위 라벨의 단위로 환산한다. 라벨만 붙이고 원값을 그대로
// 그리면 1000배·57배 틀린 수를 보여주게 된다. 실제로 그랬다.
//   delta  모델 rad          → deg    (0.7404 rad = 42.42° 이고 meta.delta_max_deg = 42.423 이다)
//   dw     모델 rad/s        → Hz     (f[8] = dw 이고 delta 가 rad 이므로 dw 는 rad/s)
//   Pf·Qf  모델 W·var        → kW·kvar (op.INP 의 Pref = 10e3 [W], 궤적 시작값이 정확히 10000)
//   i_od·v_od·v_dc 는 이미 A·V 다 — 1.5 × 330 V × 20 A ≈ 10 kW 로 정격과 맞는다.
const STATE_SCALE: Record<string, number> = {
  delta: 180 / Math.PI,
  dw: 1 / (2 * Math.PI),
  Pf: 1e-3,
  Qf: 1e-3,
};

export default function TimeDomain() {
  const [data, setData] = useState<any>(null);
  const [selectedState, setSelectedState] = useState(0);

  useEffect(() => {
    fetchJSON('/trajectory').then(setData).catch(() => {});
  }, []);

  if (!data?.traces?.length) {
    return <div className="text-gray-500 text-sm p-4">시간영역 궤적 데이터 없음 (xval.py --traj-at 실행 필요)</div>;
  }

  const stateNames = data.state_names?.slice(0, 7) || [];
  const t = data.t || [];
  const scrs = data.SCR_list || [];

  const stateName = stateNames[selectedState] || `x${selectedState}`;
  const label = STATE_LABELS[stateName] || stateName;
  const scale = STATE_SCALE[stateName] ?? 1;

  // Build chart data for selected state
  // Downsample if too many time points
  const step = Math.max(1, Math.floor(t.length / 300));
  const chartData: any[] = [];
  for (let i = 0; i < t.length; i += step) {
    const row: any = { t: t[i] };
    scrs.forEach((scr: number) => {
      // 이름으로 찾는다. 예전에는 tr.state_idx === selectedState 로 맞췄는데,
      // selectedState 는 버튼 인덱스(0~6)이고 API 의 state_idx 는 22차 상태벡터
      // 안의 위치(delta=8 · dw=9 · Pf=10 · Qf=11 · v_dc=4 · v_od=18 · i_od=20)다.
      // 거의 모든 탭이 아무것도 못 찾아 빈 그래프가 됐고, 하필 v_dc(4)만 버튼 4번
      // (i_od [A])에 걸려 **DC 링크 전압을 전류 라벨·단위로** 그렸다.
      const trace = data.traces.find((tr: any) => tr.SCR === scr && tr.state === stateName);
      if (trace) {
        row[`nl_${scr}`] = trace.nl[i] * scale;
        if (trace.lin?.length) row[`lin_${scr}`] = trace.lin[i] * scale;
      }
    });
    chartData.push(row);
  }

  return (
    <div className="glass p-5">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-sm font-semibold text-rose-400">Time-Domain Response</h2>
        <div className="text-sm text-gray-500">
          Input: {data.input} / Step: {(data.ratio * 100).toFixed(0)}%
        </div>
      </div>
      {/* State selector */}
      <div className="flex gap-1.5 mb-4 flex-wrap">
        {stateNames.map((name: string, i: number) => (
          <button key={i} onClick={() => setSelectedState(i)}
            className={`text-sm px-2.5 py-1 rounded-lg transition ${
              selectedState === i
                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                : 'bg-gray-800 text-gray-500 hover:text-gray-300'
            }`}>
            {STATE_LABELS[name] || name}
          </button>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData} margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="t" stroke="#9ca3af" type="number" domain={['auto', 'auto']}
            tickFormatter={(v) => v.toFixed(2)}
            label={{ value: 'Time [s]', position: 'bottom', offset: 5, fill: '#9ca3af', fontSize: 14 }} />
          <YAxis stroke="#9ca3af"
            label={{ value: label, angle: -90, position: 'insideLeft', fill: '#9ca3af', fontSize: 14 }} />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
            formatter={(val: any, name: any) => [val != null ? Number(val).toFixed(4) : '—', name]}
            labelFormatter={(v) => `t = ${Number(v).toFixed(4)} s`}
          />
          <Legend />
          {scrs.map((scr: number, i: number) => (
            <Line key={`nl_${scr}`} type="monotone" dataKey={`nl_${scr}`}
              name={`SCR ${scr} (NL)`} stroke={SCR_COLORS[i % SCR_COLORS.length]}
              strokeWidth={2} dot={false} />
          ))}
          {scrs.map((scr: number, i: number) => (
            <Line key={`lin_${scr}`} type="monotone" dataKey={`lin_${scr}`}
              name={`SCR ${scr} (Lin)`} stroke={SCR_COLORS[i % SCR_COLORS.length]}
              strokeWidth={1.5} strokeDasharray="5 3" dot={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
