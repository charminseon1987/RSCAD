import { useEffect, useState } from 'react';
import { fetchJSON } from '../lib/api';

export default function Lab() {
  const [health, setHealth] = useState<any>(null);
  const [sweepData, setSweepData] = useState<any>(null);

  useEffect(() => {
    fetchJSON('/health').then(setHealth).catch(() => {});
    fetchJSON('/sweep2d').then(setSweepData).catch(() => {});
  }, []);

  const points = sweepData?.points?.filter((p: any) => p.converged) || [];
  const xrGroups = new Map<number, any[]>();
  points.forEach((p: any) => {
    if (!xrGroups.has(p.XR)) xrGroups.set(p.XR, []);
    xrGroups.get(p.XR)!.push(p);
  });

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
            🔬 실험 대시보드
          </h1>
          <p className="text-sm text-gray-500 mt-1">22차 GFM 소신호 안정도 분석 — 고유값, 참여계수, 2D 경계</p>
        </div>
        {health && (
          <div className="glass px-4 py-2 text-xs text-gray-400">
            {health.model_version} · {health.n_states}차 · X/R={health.XR} · {health.all_stable ? '✅ 전 SCR 안정' : '❌ 불안정 존재'}
          </div>
        )}
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Eigenvalue Table */}
        <div className="col-span-12 lg:col-span-8 glass p-5">
          <h2 className="text-sm font-semibold text-cyan-400 mb-4">고유값 분석 결과</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 border-b border-gray-800">
                  <th className="text-left py-2 px-3">SCR</th>
                  <th className="text-left py-2 px-3">X/R</th>
                  <th className="text-left py-2 px-3">안정</th>
                  <th className="text-left py-2 px-3">ζ_min</th>
                  <th className="text-left py-2 px-3">대역</th>
                  <th className="text-left py-2 px-3">f_dom (Hz)</th>
                  <th className="text-left py-2 px-3">δ (°)</th>
                </tr>
              </thead>
              <tbody>
                {points.sort((a: any, b: any) => b.SCR - a.SCR || a.XR - b.XR).map((p: any, i: number) => (
                  <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition">
                    <td className="py-2 px-3 font-mono text-gray-300">{p.SCR.toFixed(1)}</td>
                    <td className="py-2 px-3 font-mono text-gray-400">{p.XR.toFixed(1)}</td>
                    <td className="py-2 px-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${p.stable ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                        {p.stable ? 'stable' : 'unstable'}
                      </span>
                    </td>
                    <td className="py-2 px-3 font-mono text-gray-300">{p.zeta_min?.toFixed(4) ?? '—'}</td>
                    <td className="py-2 px-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        p.zeta_band === 'sync' ? 'bg-blue-500/20 text-blue-400' :
                        p.zeta_band === 'control' ? 'bg-cyan-500/20 text-cyan-400' :
                        'bg-purple-500/20 text-purple-400'
                      }`}>{p.zeta_band}</span>
                    </td>
                    <td className="py-2 px-3 font-mono text-gray-400">{p.f_dom_hz?.toFixed(1) ?? '—'}</td>
                    <td className="py-2 px-3 font-mono text-gray-400">{p.delta_deg?.toFixed(1)}°</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="col-span-12 lg:col-span-4 space-y-4">
          <div className="glass p-5 glow-green">
            <div className="text-xs text-green-400 mb-1">σ_min (전체)</div>
            <div className="text-3xl font-bold text-white font-mono">
              {health?.zeta_min?.toFixed(4) ?? '—'}
            </div>
            <div className="text-xs text-gray-500 mt-1">목표: ≥ 4.0 [1/s] (t_s ≤ 1s)</div>
          </div>

          <div className="glass p-5">
            <div className="text-xs text-gray-400 mb-1">데이터 포인트</div>
            <div className="text-3xl font-bold text-white font-mono">{sweepData?.total_points ?? 0}</div>
            <div className="text-xs text-gray-500 mt-1">{sweepData?.runs_used?.length ?? 0}개 실행에서 집계</div>
          </div>

          <div className="glass p-5">
            <div className="text-xs text-gray-400 mb-2">X/R 조건별</div>
            {Array.from(xrGroups.entries()).sort().map(([xr, pts]) => (
              <div key={xr} className="flex justify-between text-sm py-1.5 border-b border-gray-800/50">
                <span className="text-gray-400">X/R = {xr}</span>
                <span className="text-gray-300 font-mono">{pts.length}개</span>
              </div>
            ))}
          </div>

          <div className="glass p-5">
            <div className="text-xs text-gray-400 mb-2">기존 D3 대시보드</div>
            <a href="/gfm_dashboard.html" target="_blank"
              className="block text-center py-2 px-4 bg-gray-800 hover:bg-gray-700 rounded-xl text-sm text-gray-300 transition">
              📊 D3 대시보드 열기 →
            </a>
          </div>
        </div>
      </div>

      {/* 2D Boundary Summary */}
      {sweepData?.boundaries && (
        <div className="glass p-5">
          <h2 className="text-sm font-semibold text-amber-400 mb-3">2D 경계 요약</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Object.entries(sweepData.boundaries).map(([xr, b]: [string, any]) => (
              <div key={xr} className="p-3 rounded-xl bg-gray-900/50 border border-gray-800">
                <div className="text-xs text-gray-500">X/R = {xr}</div>
                <div className="mt-1 text-sm">
                  <span className="text-gray-400">감쇠 경계: </span>
                  <span className="font-mono text-amber-400">{b.damping_SCR ?? '—'}</span>
                </div>
                <div className="text-sm">
                  <span className="text-gray-400">부하 한계: </span>
                  <span className="font-mono text-red-400">{b.loadability_SCR ?? '—'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
