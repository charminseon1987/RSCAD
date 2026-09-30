/* GFM 소신호 안정도 — 통합 화면.

   Downloads/GFM Stability 목업의 레이아웃에 실제 데이터를 연결하고, 기존
   Verification 화면의 기능(운전점별 여유 게이지 · 최약 운전점 · 연구 도우미 · 파일
   업로드)을 그대로 흡수했다. Verification.tsx 는 이 파일로 대체됐다.

   고유값 복소평면과 시간영역 응답은 /lab/gfm 에 이미 있는 컴포넌트를 재사용한다
   (props 없이 각자 /api/eigenvalue_locus · /api/trajectory 를 조회한다).

   ⚠ 목업과 데이터 범위가 다르다 — 목업은 SCR 22 × X/R 4(88점)를 전제하지만 실제
   /api/grid2d 는 계산된 점만 준다. 목업 문구를 그대로 쓰면 없는 데이터를 있는 것처럼
   보이게 되므로, KPI 부제에 실제 개수와 커버리지를 적는다. */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import EigenvalueLocus from '../components/charts/EigenvalueLocus';
import TimeDomain from '../components/charts/TimeDomain';
import { ComboChart, GaugeBar, KpiCard, MapCell, Ring } from '../components/stability/primitives';
import {
  DEFAULT, TS_COEF, aiAnswer, ff, getChartCfg, gridStats, parseJSON, score, sigRef, S, weakMode,
  type ChartView, type DashData,
} from '../lib/stabilityData';

const MAX_GAUGE = 1.3;

interface Selected { xr: number; scr: number; sigma: number }

export default function Stability() {
  const [d, setD] = useState<DashData>({ ...DEFAULT });
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  const [view, setView] = useState<ChartView>('stab');
  const [sel, setSel] = useState<Selected | null>(null);
  const [chatLog, setChatLog] = useState<{ me: string; bot: string }[]>([]);
  const [chatInput, setChatInput] = useState('');
  const logRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  /* ── 자동 로드 ── */
  useEffect(() => {
    (async () => {
      const nd: DashData = { ...DEFAULT, grid: {}, gridXR: [], gridSCR: [] };
      const got: string[] = [];
      const missing: string[] = [];

      let runName = '';
      try {
        const latest = await fetch('/results/LATEST.json').then(r => { if (!r.ok) throw r; return r.json(); });
        runName = latest.run_name;
      } catch {
        setToast('LATEST.json 을 읽지 못했습니다. Flask 가 떠 있는지 확인하세요.');
        setLoading(false);
        return;
      }

      const base = `/results/${runName}`;
      try {
        const meta = await fetch(`${base}/meta.json`).then(r => { if (!r.ok) throw r; return r.json(); });
        parseJSON(meta, nd);
      } catch { missing.push('meta.json'); }

      const FILES = ['eigenvalue_results.json', 'participation_factors.json',
                     'linearization_validity_Pref.json', 'sync_reduction.json'];
      for (const name of FILES) {
        try {
          const j = await fetch(`${base}/${name}`).then(r => { if (!r.ok) throw new Error(String(r.status)); return r.json(); });
          const label = parseJSON(j, nd);
          if (label) got.push(label);
        } catch { missing.push(name); }
      }

      try {
        const g = await fetch('/api/grid2d').then(r => { if (!r.ok) throw r; return r.json(); });
        if (g.grid) nd.grid = g.grid;
        if (g.gridXR?.length) nd.gridXR = g.gridXR;
        if (g.gridSCR?.length) nd.gridSCR = g.gridSCR;
        got.push('2D grid');
      } catch { missing.push('grid2d'); }

      let msg = '';
      if (got.length) msg += `${runName}: ${got.join(', ')} 반영.`;
      if (missing.length) msg += ` 누락: ${missing.join(', ')} → 기본값.`;
      setToast(msg);
      setD(nd);
      setLoading(false);
    })();
  }, []);

  /* ── 파일 업로드 ── */
  const handleFiles = useCallback(async (files: FileList) => {
    const nd = { ...d };
    const got: string[] = [];
    for (const file of Array.from(files)) {
      try {
        const j = JSON.parse(await file.text());
        const label = parseJSON(j, nd);
        if (label) got.push(label);
      } catch { /* 읽을 수 없는 파일은 건너뛴다 */ }
    }
    if (got.length) {
      setD({ ...nd });
      setToast(`${got.join(', ')} 결과를 반영했습니다.`);
    } else {
      setToast('읽을 수 있는 결과가 없습니다.');
    }
  }, [d]);

  /* ── 연구 도우미 ── */
  const ask = useCallback((q: string) => {
    if (!q.trim()) return;
    setChatLog(prev => [...prev, { me: q, bot: aiAnswer(q, d) }]);
    setChatInput('');
    setTimeout(() => logRef.current?.scrollTo(0, logRef.current.scrollHeight), 50);
  }, [d]);

  /* ── 파생값 ── */
  const rows = d.stab.map(r => ({ ...r, sc: score(r.sigma, d) }));
  const okRows = rows.filter(r => r.sc >= 1);
  const worst = rows.length ? rows.reduce((a, b) => (a.sc < b.sc ? a : b)) : null;
  const sr = sigRef(d);

  const pw = d.part.length ? d.part.reduce((a, b) => (a.scr < b.scr ? a : b)) : null;
  const lw = d.lin.rows.length ? d.lin.rows.reduce((a, b) => (a.scr < b.scr ? a : b)) : null;

  const gs = useMemo(() => gridStats(d), [d]);
  const wm = useMemo(() => weakMode(d), [d]);

  const hasChart = view === 'stab' ? d.stab.length > 0 : view === 'lin' ? d.lin.rows.length > 0 : d.pair.length > 0;
  const chartCfg = hasChart ? getChartCfg(view, d) : null;

  if (loading) return (
    <div className="max-w-[1600px] mx-auto px-8 py-20 text-center">
      <span className="mono-label" style={{ color: 'var(--outline)' }}>LOADING RESULTS...</span>
    </div>
  );

  return (
    <div className="max-w-[1600px] mx-auto px-10 py-10 space-y-7">

      {/* ── 헤더 ── */}
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-display" style={{ color: 'var(--primary)', fontSize: 28 }}>
            GFM 소신호 안정도
          </h1>
          <p className="mono-clock mt-1" style={{ color: 'var(--outline)', fontSize: 15 }}>
            {d.run}, X/R {ff(d.xr, 1)}, 목표 σ {ff(sr, 1)} /s
          </p>
        </div>
        <div className="flex gap-2">
          <div className="flex gap-0.5 p-1 rounded-xl" style={{ background: 'var(--surface-container)' }}>
            {(['stab', 'lin', 'pair'] as const).map(v => (
              <button key={v} onClick={() => setView(v)}
                className="mono-label px-3 py-1.5 rounded-lg transition-all duration-200"
                style={{
                  fontSize: 14,
                  color: view === v ? 'var(--primary)' : 'var(--outline)',
                  background: view === v ? 'var(--surface-container-lowest)' : 'transparent',
                  border: view === v ? '1px solid var(--border)' : '1px solid transparent',
                  boxShadow: view === v ? 'var(--shadow-ambient)' : 'none',
                }}>
                {v === 'stab' ? '안정도' : v === 'lin' ? '선형화' : '스윙쌍'}
              </button>
            ))}
          </div>
          <input ref={fileRef} type="file" multiple accept=".json" className="hidden"
            onChange={e => e.target.files && handleFiles(e.target.files)} />
          <button onClick={() => fileRef.current?.click()}
            className="mc-btn-secondary mono-label" style={{ fontSize: 14, padding: '6px 14px' }}>
            결과 불러오기
          </button>
        </div>
      </div>

      {toast && <p className="mono-clock" style={{ color: 'var(--outline)', fontSize: 15 }}>{toast}</p>}

      {/* ── KPI 7종 ── */}
      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))' }}>
        <KpiCard
          label="최소 안정 여유 σ_min"
          value={gs.worst ? ff(gs.worst.sigma) : '—'}
          sub={gs.worst ? `SCR ${S(gs.worst.scr)}, X/R ${ff(gs.worst.xr, 1)} · 실험 이력 전체` : '격자 데이터 없음'}
          accent={!!gs.worst && gs.worst.sigma < sr}
        />
        <KpiCard
          label="안정 운전점"
          value={gs.filled ? `${gs.stable} / ${gs.filled}` : '—'}
          sub={gs.filled ? `계산된 ${gs.filled}점 기준 (격자 ${d.gridSCR.length}×${d.gridXR.length} 중)` : undefined}
        />
        <KpiCard
          label="선택한 운전점 σ"
          value={sel ? ff(sel.sigma) : '—'}
          sub={sel ? `SCR ${S(sel.scr)}, X/R ${ff(sel.xr, 1)} · 여유 ${ff(score(sel.sigma, d), 3)}`
                   : '아래 2D 격자에서 칸을 누르세요'}
          selected={!!sel}
        />
        <KpiCard
          label="약계통 지배 모드"
          value={wm ? wm.label : '—'}
          sub={wm ? `SCR ${S(wm.weakest.scr)} 참여도 ${ff(wm.weakest.pd + wm.weakest.pw, 3)} · 참여계수 있는 ${wm.total}개 운전점 중 ${wm.deltaDom}곳에서 δ 지배`
                  : 'participation_factors.json 이 없습니다'}
        />
        <KpiCard
          label="동기화 참여도"
          value={pw ? ff(pw.pd + pw.pw, 3) : '—'}
          sub={pw ? `SCR ${S(pw.scr)}, δ가 지배` : undefined}
        />
        <KpiCard
          label="선형화 유효 범위"
          value={lw ? `${ff(lw.thr * 100, 1)}%` : '—'}
          sub={lw ? `SCR ${S(lw.scr)}, 허용 ${ff(d.lin.tol * 100, 1)}%` : undefined}
        />
        <KpiCard
          label="충족 비율"
          value={rows.length ? `${okRows.length} / ${rows.length}` : '—'}
          sub={`목표 정착 ${d.tsSpec} s 기준`}
        />
      </div>

      {/* ── 운전점별 여유 · 최약 운전점 · 2D 격자 ── */}
      <div className="grid gap-5" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gridTemplateAreas: '"hero hero hero side" "map map map side2"' }}>

        {/* 운전점별 여유 */}
        <div className="glass-card" style={{ gridArea: 'hero', padding: 20 }}>
          <div className="flex items-center justify-between mb-3">
            <span className="mono-label" style={{ color: 'var(--primary)', fontSize: 15 }}>운전점별 여유</span>
            <span className="mono-clock" style={{ color: 'var(--outline)', fontSize: 15 }}>흰 눈금이 목표 1.0</span>
          </div>
          <div className="grid gap-6 items-center" style={{ gridTemplateColumns: 'minmax(140px, 200px) 1fr' }}>
            <div>
              <span className="mono-label" style={{ color: 'var(--outline)', fontSize: 14 }}>요구 충족</span>
              <div className="mono-metric mt-1" style={{ color: 'var(--primary)', fontSize: 32 }}>
                {okRows.length}
                <span className="text-body-sm ml-1" style={{ color: 'var(--outline)', fontWeight: 400 }}>/ {rows.length} 운전점</span>
              </div>
              <p className="mono-clock mt-2" style={{ color: 'var(--outline)', fontSize: 15 }}>
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

        {/* 최약 운전점 */}
        <div className="glass-card" style={{ gridArea: 'side', padding: 20 }}>
          <span className="mono-label" style={{ color: 'var(--primary)', fontSize: 15 }}>최약 운전점</span>
          {worst ? (
            <div className="mt-3 flex justify-between items-end h-full" style={{ paddingBottom: 4 }}>
              <div>
                <div className="mono-metric" style={{ color: 'var(--on-surface)', fontSize: 28 }}>
                  {ff(worst.sigma)}
                  <span className="text-body-sm ml-1" style={{ color: 'var(--outline)', fontWeight: 400 }}>/ {ff(sr, 1)}</span>
                </div>
                <p className="mono-clock mt-1" style={{ color: 'var(--outline)', fontSize: 15 }}>
                  SCR {S(worst.scr)}, 정착 {ff(TS_COEF / worst.sigma)} s
                </p>
                <span className="mono-label inline-block mt-1 px-2 py-0.5 rounded" style={{
                  fontSize: 14,
                  background: worst.sc >= 1 ? 'rgba(5,21,43,0.06)' : 'rgba(129,85,0,0.08)',
                  color: worst.sc >= 1 ? 'var(--primary)' : 'var(--secondary)',
                }}>{worst.sc >= 1 ? '충족' : `${Math.round((1 - worst.sc) * 100)}% 부족`}</span>
              </div>
              <div className="w-12 h-20 rounded-xl relative overflow-hidden"
                style={{ background: 'var(--surface-container-high)', border: '1px solid var(--border)' }}>
                <div className="absolute left-0 right-0 bottom-0 transition-all duration-500"
                  style={{ height: `${Math.min(worst.sc, 1) * 100}%`, background: 'var(--secondary-container)' }} />
                <div className="absolute left-[-2px] right-[-2px] h-0.5"
                  style={{ bottom: 'calc(100% - 1px)', background: 'var(--on-surface)' }} />
              </div>
            </div>
          ) : (
            <p className="mono-clock mt-4" style={{ color: 'var(--outline)' }}>데이터 없음</p>
          )}
        </div>

        {/* SCR × X/R 스윕 — 칸을 누르면 '선택한 운전점 σ' 가 바뀐다 */}
        <div className="glass-card" style={{ gridArea: 'map', padding: 20 }}>
          <div className="flex items-center justify-between mb-3">
            <span className="mono-label" style={{ color: 'var(--primary)', fontSize: 15 }}>SCR × X/R 스윕</span>
            <span className="mono-clock" style={{ color: 'var(--outline)', fontSize: 14 }}>
              {gs.filled} / {gs.cells} 계산 · 칸을 누르면 선택
            </span>
          </div>
          <div className="space-y-1.5">
            {d.gridXR.map(xr => {
              const row = d.grid[ff(xr, 1)] || {};
              return (
                <div key={xr} className="grid items-center gap-1.5"
                  style={{ gridTemplateColumns: `36px repeat(${d.gridSCR.length}, 1fr)` }}>
                  <span className="mono-clock" style={{ color: 'var(--outline)', fontSize: 14 }}>{ff(xr, 1)}</span>
                  {d.gridSCR.map(s => (
                    <MapCell key={s} sigma={row[s]} xr={xr} scr={s} d={d}
                      selected={!!sel && sel.xr === xr && sel.scr === s}
                      onSelect={(x, c, sg) => setSel({ xr: x, scr: c, sigma: sg })} />
                  ))}
                </div>
              );
            })}
            <div className="grid gap-1.5" style={{ gridTemplateColumns: `36px repeat(${d.gridSCR.length}, 1fr)` }}>
              <span />
              {d.gridSCR.map(s => (
                <span key={s} className="mono-clock text-center"
                  style={{ color: 'var(--outline-variant)', fontSize: 14 }}>{S(s)}</span>
              ))}
            </div>
          </div>
          <div className="flex gap-4 mt-3 mono-clock" style={{ fontSize: 14, color: 'var(--outline)' }}>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded" style={{ background: 'var(--primary)' }} />충족</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded" style={{ background: 'var(--secondary-container)' }} />미달</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded" style={{ background: 'var(--surface-container)', border: '1px solid var(--border)' }} />미계산</span>
          </div>
        </div>

        {/* 지배 모드 참여인자 */}
        <div className="glass-card flex flex-col" style={{ gridArea: 'side2', padding: 20 }}>
          <span className="mono-label mb-3" style={{ color: 'var(--primary)', fontSize: 15 }}>지배 모드 참여인자</span>
          {d.part.length ? (
            <>
              <div className="flex items-center justify-center mb-3">
                <Ring pct={pw ? pw.pd + pw.pw : 0} color="var(--primary)" size={92} />
              </div>
              <div className="space-y-2">
                {d.part.map(p => (
                  <GaugeBar key={p.scr} label={`SCR ${S(p.scr)}`} value={p.pd + p.pw} max={1} ok={p.pd + p.pw >= 0.9} />
                ))}
              </div>
              <p className="mono-clock mt-3" style={{ color: 'var(--outline)', fontSize: 13.5, lineHeight: 1.6 }}>
                δ + ω 가 모드의 얼마를 차지하는지. 1 에 가까우면 순수한 동기화 모드입니다.
              </p>
            </>
          ) : (
            <p className="mono-clock mt-2" style={{ color: 'var(--outline)', fontSize: 15, lineHeight: 1.7 }}>
              participation_factors.json 이 없습니다.
              <br />
              <code>python Simulation/pf_export.py</code>
            </p>
          )}
        </div>
      </div>

      {/* ── 고유값 분포 · 시간영역 응답 ── */}
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-7 glass-card" style={{ padding: 20 }}>
          <div className="flex items-center justify-between mb-3">
            <span className="mono-label" style={{ color: 'var(--primary)', fontSize: 15 }}>고유값 분포</span>
            <span className="mono-clock" style={{ color: 'var(--outline)', fontSize: 14 }}>복소평면 · SCR별 색</span>
          </div>
          <EigenvalueLocus />
        </div>
        <div className="col-span-12 lg:col-span-5 glass-card" style={{ padding: 20 }}>
          <div className="flex items-center justify-between mb-3">
            <span className="mono-label" style={{ color: 'var(--primary)', fontSize: 15 }}>시간영역 응답</span>
            <span className="mono-clock" style={{ color: 'var(--outline)', fontSize: 14 }}>비선형 vs 선형</span>
          </div>
          <TimeDomain />
        </div>
      </div>

      {/* ── 차트 + 연구 도우미 ── */}
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-7 glass-card" style={{ padding: 20 }}>
          {chartCfg ? (
            <>
              <div className="flex items-center justify-between mb-3">
                <span className="mono-label" style={{ color: 'var(--primary)', fontSize: 15 }}>{chartCfg.title}</span>
              </div>
              <div className="flex flex-wrap gap-6 mb-4">
                {chartCfg.stats.map(([k, v]) => (
                  <div key={k}>
                    <span className="mono-clock" style={{ color: 'var(--outline)', fontSize: 15 }}>{k}</span>
                    <div className="mono-metric mt-0.5" style={{ color: 'var(--on-surface)', fontSize: 18 }}>{v}</div>
                  </div>
                ))}
              </div>
              <ComboChart cfg={chartCfg} />
              <p className="mono-clock mt-3" style={{ color: 'var(--outline)', fontSize: 15 }}>{chartCfg.note}</p>
            </>
          ) : (
            <p className="mono-clock" style={{ color: 'var(--outline)' }}>데이터 없음</p>
          )}
        </div>

        <div className="col-span-12 lg:col-span-5 glass-card flex flex-col" style={{ padding: 20, minHeight: 380 }}>
          <div className="flex items-center justify-between mb-3">
            <span className="mono-label" style={{ color: 'var(--primary)', fontSize: 15 }}>연구 도우미</span>
            <span className="mono-clock" style={{ color: 'var(--outline)', fontSize: 14 }}>현재 결과로 답합니다</span>
          </div>

          <div ref={logRef} className="flex-1 overflow-y-auto space-y-2 mb-3" style={{ maxHeight: 220 }}>
            {chatLog.map((c, i) => (
              <div key={i} className="space-y-1.5">
                <div className="text-right">
                  <span className="inline-block px-3 py-2 rounded-xl text-body-sm text-right"
                    style={{ background: 'var(--primary)', color: 'var(--on-primary)', fontSize: 16, maxWidth: '85%' }}>{c.me}</span>
                </div>
                <div>
                  <span className="inline-block px-3 py-2 rounded-xl text-body-sm whitespace-pre-line"
                    style={{ background: 'var(--surface-container)', color: 'var(--on-surface)', fontSize: 16, maxWidth: '85%', border: '1px solid var(--border)' }}>{c.bot}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-1.5 mb-3">
            {[['결과 요약', '요약'], ['어디가 미달이야?', '미달'], ['다음에 돌릴 조건', '다음']].map(([label, q]) => (
              <button key={q} onClick={() => ask(q)}
                className="mono-label px-3 py-1.5 rounded-full transition-colors"
                style={{ fontSize: 14, border: '1px solid var(--border)', color: 'var(--on-surface-variant)', background: 'var(--surface-container-low)' }}>
                {label}
              </button>
            ))}
          </div>

          <form onSubmit={e => { e.preventDefault(); ask(chatInput); }}
            className="flex gap-2 items-center px-3 py-2 rounded-full"
            style={{ background: 'var(--surface-container)', border: '1px solid var(--border)' }}>
            <input value={chatInput} onChange={e => setChatInput(e.target.value)}
              placeholder="결과에 대해 물어보세요"
              className="flex-1 bg-transparent border-0 outline-none text-body-sm"
              style={{ color: 'var(--on-surface)', fontSize: 16 }} />
            <button type="submit" className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{ background: 'var(--primary)', color: 'var(--on-primary)' }}>
              <svg width="14" height="14" viewBox="0 0 24 24"><path d="M3 11 21 3l-8 18-2-8-8-2z" fill="currentColor" /></svg>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
