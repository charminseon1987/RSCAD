import { useEffect, useState, useCallback } from 'react';
import { fetchJSON, postJSON } from '../lib/api';
import EigenvalueLocus from '../components/charts/EigenvalueLocus';
import StabilityBoundary from '../components/charts/StabilityBoundary';
import LinearizationValidity from '../components/charts/LinearizationValidity';
import OperatingPoints from '../components/charts/OperatingPoints';
import TimeDomain from '../components/charts/TimeDomain';

// ── Parameter definitions ──
const PARAM_GROUPS = [
  {
    label: 'VSG Core',
    params: [
      { key: 'J', name: 'J (Inertia)', min: 0.1, max: 5, step: 0.1 },
      { key: 'Dp', name: 'Dp (Damping)', min: 1, max: 100, step: 1 },
      { key: 'wc', name: 'wc (Power LPF)', min: 10, max: 200, step: 1 },
      { key: 'nq', name: 'nq (Q droop)', min: 0.0001, max: 0.1, step: 0.001 },
    ],
  },
  {
    label: 'Voltage Loop',
    params: [
      { key: 'Kpv', name: 'Kpv', min: 0.01, max: 2, step: 0.01 },
      { key: 'Kiv', name: 'Kiv', min: 1, max: 100, step: 1 },
    ],
  },
  {
    label: 'DC-side PI',
    params: [
      { key: 'Kp_vdc', name: 'Kp_vdc', min: 0.01, max: 5, step: 0.01 },
      { key: 'Ki_vdc', name: 'Ki_vdc', min: 1, max: 100, step: 1 },
      { key: 'Kp_vpv', name: 'Kp_vpv', min: 0.01, max: 2, step: 0.01 },
      { key: 'Ki_vpv', name: 'Ki_vpv', min: 1, max: 100, step: 1 },
    ],
  },
];

const DEFAULT_SCR = '3.0, 2.0, 1.5, 1.0';

// ── Pipeline step type ──
type PipelineStep = 'idle' | 'running' | 'xval' | 'done' | 'error';

export default function Lab() {
  // ── State ──
  const [health, setHealth] = useState<any>(null);
  const [baseCtrl, setBaseCtrl] = useState<Record<string, number>>({});
  const [ctrl, setCtrl] = useState<Record<string, number>>({});
  const [xr, setXr] = useState(1.0);
  const [scrInput, setScrInput] = useState(DEFAULT_SCR);

  // Pipeline
  const [step, setStep] = useState<PipelineStep>('idle');
  const [stepMsg, setStepMsg] = useState('');
  const [computeResult, setComputeResult] = useState<any>(null);
  const [computeError, setComputeError] = useState('');
  const [elapsed, setElapsed] = useState<number | null>(null);
  const [pipelineLog, setPipelineLog] = useState<string[]>([]);

  // xval
  const [xvalRunning, setXvalRunning] = useState(false);
  const [xvalResult, setXvalResult] = useState<any>(null);

  // Note saving
  const [noteTitle, setNoteTitle] = useState('');
  const [noteMemo, setNoteMemo] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteSaved, setNoteSaved] = useState('');

  // Paper export
  const [latexOutput, setLatexOutput] = useState('');
  const [showLatex, setShowLatex] = useState(false);

  // Stored data
  const [sweepData, setSweepData] = useState<any>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // ── Init ──
  useEffect(() => {
    fetchJSON('/health').then(d => {
      setHealth(d);
      fetchJSON('/runs').then(r => {
        const active = r.runs?.find((run: any) => run.is_active);
        if (active?.ctrl) {
          setBaseCtrl(active.ctrl);
          setCtrl(active.ctrl);
          if (active.XR != null) setXr(active.XR);
          if (active.SCR_list) setScrInput(active.SCR_list.join(', '));
        }
      }).catch(() => {});
    }).catch(() => {});
    fetchJSON('/sweep2d').then(setSweepData).catch(() => {});
  }, []);

  const addLog = (msg: string) => setPipelineLog(p => [...p, `[${new Date().toLocaleTimeString('ko-KR')}] ${msg}`]);

  // ── Full Pipeline ──
  const runFullPipeline = useCallback(async () => {
    setStep('running');
    setComputeError('');
    setComputeResult(null);
    setXvalResult(null);
    setElapsed(null);
    setNoteSaved('');
    setShowLatex(false);
    setPipelineLog([]);

    const scrList = scrInput.split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n));
    if (!scrList.length) { setComputeError('SCR list is empty'); setStep('error'); return; }

    // Step 1: runner.run (persist=True)
    addLog('Step 1/3: runner.run() — OP solve + Jacobian + eigenvalue + metrics...');
    setStepMsg('model.py → op.py → runner.py → metrics.py (persist=True)');
    const t0 = performance.now();

    try {
      const d = await postJSON('/compute', { ...ctrl, SCR: scrList, XR: xr, persist: true });
      if (d.status !== 'ok') {
        setComputeError(d.error || 'Compute failed');
        setStep('error');
        addLog(`ERROR: ${d.error}`);
        return;
      }

      const dt = Math.round(performance.now() - t0);
      setComputeResult(d);
      setElapsed(dt);
      addLog(`Step 1 complete: ${dt}ms — ${d.persisted ? 'SAVED' : 'preview only'}`);
      if (d.run_name) addLog(`  results/${d.run_name}/`);
      if (d.artifacts) {
        addLog(`  Artifacts: ${d.artifacts.npy_count} .npy, results.md=${d.artifacts.results_md}`);
      }

      // Auto-generate note title
      const zMin = d.meta?.zeta_min_all;
      setNoteTitle(`Lab J=${ctrl.J} Dp=${ctrl.Dp} XR=${xr} — zeta_min=${zMin?.toFixed(4) ?? '?'}`);

      // Step 2: xval (linearization validity)
      setStep('xval');
      setStepMsg('xval.py — linearization validity + trajectory...');
      addLog('Step 2/3: xval.py — linearization validity check...');

      try {
        const xd = await postJSON('/run_xval', { input: 'Pref', traj_at: 0.1 });
        if (xd.status === 'ok') {
          setXvalResult(xd);
          addLog(`Step 2 complete: ${xd.artifacts?.length ?? 0} artifacts generated`);
          if (xd.artifacts) addLog(`  Files: ${xd.artifacts.join(', ')}`);
        } else {
          addLog(`Step 2 warning: ${xd.error || 'xval failed'}`);
        }
      } catch (e: any) {
        addLog(`Step 2 skipped: ${e.message} (xval can be run separately)`);
      }

      // Step 3: Reload reference data
      addLog('Step 3/3: Reload reference data...');
      setStepMsg('Reloading charts...');
      try {
        const [h, sw] = await Promise.all([
          fetchJSON('/health'),
          fetchJSON('/sweep2d'),
        ]);
        setHealth(h);
        setSweepData(sw);
        setRefreshKey(k => k + 1);
      } catch {} // eslint-disable-line no-empty

      setStep('done');
      setStepMsg('');
      addLog('Pipeline complete.');

    } catch (e: any) {
      setComputeError(e.message);
      setStep('error');
      addLog(`PIPELINE ERROR: ${e.message}`);
    }
  }, [ctrl, scrInput, xr]);

  // ── Run xval separately ──
  const runXval = useCallback(async (input: string = 'Pref') => {
    setXvalRunning(true);
    addLog(`Running xval.py --input ${input}...`);
    try {
      const d = await postJSON('/run_xval', { input, traj_at: 0.1 });
      setXvalResult(d);
      setRefreshKey(k => k + 1);
      addLog(d.status === 'ok' ? `xval complete: ${d.artifacts?.join(', ')}` : `xval error: ${d.error}`);
    } catch (e: any) {
      addLog(`xval error: ${e.message}`);
    }
    setXvalRunning(false);
  }, []);

  // ── Save Note ──
  const saveNote = useCallback(async () => {
    if (!computeResult || !noteTitle.trim()) return;
    setNoteSaving(true);
    try {
      const d = await postJSON('/save_note', {
        title: noteTitle,
        ctrl: computeResult.ctrl,
        XR: computeResult.XR,
        results: computeResult.results,
        memo: noteMemo,
      });
      setNoteSaved(d.path || 'saved');
      addLog(`Note saved: ${d.path}`);
    } catch (e: any) {
      setNoteSaved(`Error: ${e.message}`);
    }
    setNoteSaving(false);
  }, [computeResult, noteTitle, noteMemo]);

  // ── Export LaTeX ──
  const exportPaper = useCallback(async () => {
    if (!computeResult) return;
    try {
      const d = await postJSON('/export_paper', {
        results: computeResult.results,
        ctrl: computeResult.ctrl,
        XR: computeResult.XR,
        caption: noteTitle || 'Eigenvalue analysis results',
      });
      setLatexOutput(d.latex || '');
      setShowLatex(true);
    } catch (e: any) {
      setLatexOutput(`% Error: ${e.message}`);
      setShowLatex(true);
    }
  }, [computeResult, noteTitle]);

  // ── Helpers ──
  const setParam = (key: string, val: number) => setCtrl(prev => ({ ...prev, [key]: val }));
  const resetParams = () => { setCtrl(baseCtrl); setXr(health?.XR ?? 1.0); };
  const meta = computeResult?.meta;
  const results = computeResult?.results;
  const resultEntries = results ? Object.entries(results).sort(([a], [b]) => parseFloat(b) - parseFloat(a)) : [];

  const stepColor = (s: PipelineStep) =>
    s === 'done' ? 'text-green-400' : s === 'error' ? 'text-red-400' : s === 'idle' ? 'text-gray-500' : 'text-amber-400';

  return (
    <div className="max-w-[1400px] mx-auto p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
            Experiment Lab
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Parameters → runner.py (persist) → xval.py → Obsidian Note → Paper Export
          </p>
        </div>
        {health && (
          <div className="glass px-4 py-2 text-xs text-gray-400">
            {health.model_version} · {health.n_states}-state · Active: {health.run?.slice(0, 35)}
          </div>
        )}
      </div>

      {/* ═══ CONTROL PANEL ═══ */}
      <div className="glass p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-cyan-400">Control Parameters (14)</h2>
          <div className="flex gap-2 items-center">
            {step !== 'idle' && (
              <span className={`text-xs ${stepColor(step)}`}>
                {step === 'running' ? '1/3 Eigenvalue...' :
                 step === 'xval' ? '2/3 Linearization...' :
                 step === 'done' ? 'Pipeline Complete' :
                 'Error'}
              </span>
            )}
            <button onClick={resetParams}
              className="text-xs px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-400 rounded-lg transition">
              Reset
            </button>
            <button onClick={runFullPipeline}
              disabled={step === 'running' || step === 'xval'}
              className="text-xs px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 text-white font-semibold rounded-lg transition flex items-center gap-2">
              {step === 'running' || step === 'xval' ? (
                <><span className="animate-spin">&#9881;</span> Running...</>
              ) : 'Run Full Pipeline'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {PARAM_GROUPS.map(g => (
            <div key={g.label}>
              <div className="text-xs text-gray-500 font-semibold mb-2">{g.label}</div>
              <div className="space-y-2">
                {g.params.map(p => (
                  <div key={p.key} className="flex items-center gap-2">
                    <label className="text-xs text-gray-400 w-20 shrink-0">{p.name}</label>
                    <input type="range" min={p.min} max={p.max} step={p.step}
                      value={ctrl[p.key] ?? p.min}
                      onChange={e => setParam(p.key, parseFloat(e.target.value))}
                      className="flex-1 h-1.5 appearance-none bg-gray-700 rounded-full accent-blue-500 cursor-pointer" />
                    <input type="number" step={p.step}
                      value={ctrl[p.key] ?? ''}
                      onChange={e => setParam(p.key, parseFloat(e.target.value) || 0)}
                      className="w-20 text-xs font-mono bg-gray-800 border border-gray-700 rounded px-2 py-1 text-gray-200 text-right" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* SCR / XR */}
        <div className="flex gap-4 mt-4 pt-4 border-t border-gray-800">
          <div className="flex-1">
            <label className="text-xs text-gray-500 mb-1 block">SCR List (comma separated)</label>
            <input value={scrInput} onChange={e => setScrInput(e.target.value)}
              className="w-full text-sm font-mono bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-200" />
          </div>
          <div className="w-32">
            <label className="text-xs text-gray-500 mb-1 block">X/R</label>
            <input type="number" step="0.5" min="0.1" max="10"
              value={xr} onChange={e => setXr(parseFloat(e.target.value) || 1)}
              className="w-full text-sm font-mono bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-200" />
          </div>
        </div>

        {computeError && (
          <div className="mt-3 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            {computeError}
          </div>
        )}

        {/* Pipeline progress */}
        {step !== 'idle' && (
          <div className="mt-3 p-3 bg-gray-900/80 rounded-lg border border-gray-800">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex gap-1">
                {['running', 'xval', 'done'].map((s, i) => (
                  <div key={s} className={`w-2.5 h-2.5 rounded-full transition ${
                    step === 'error' ? 'bg-red-500' :
                    step === s ? 'bg-amber-400 animate-pulse' :
                    (['running','xval','done'].indexOf(step) > i || step === 'done') ? 'bg-green-500' : 'bg-gray-700'
                  }`} />
                ))}
              </div>
              <span className="text-xs text-gray-400">{stepMsg}</span>
            </div>
            <div className="max-h-32 overflow-y-auto">
              {pipelineLog.map((l, i) => (
                <div key={i} className="text-[11px] font-mono text-gray-500">{l}</div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ═══ RESULTS ═══ */}
      {computeResult && (
        <>
          {/* Summary Bar */}
          <div className="flex gap-3 flex-wrap">
            <div className={`glass px-4 py-3 flex-1 min-w-[120px] ${meta?.all_stable ? 'glow-green' : 'border-red-500/30'}`}>
              <div className="text-xs text-gray-500">Status</div>
              <div className={`text-lg font-bold font-mono ${meta?.all_stable ? 'text-green-400' : 'text-red-400'}`}>
                {meta?.all_stable ? 'ALL STABLE' : 'UNSTABLE'}
              </div>
            </div>
            <div className="glass px-4 py-3 flex-1 min-w-[120px]">
              <div className="text-xs text-gray-500">zeta_min</div>
              <div className="text-lg font-bold font-mono text-amber-400">
                {meta?.zeta_min_all?.toFixed(4) ?? '—'}
              </div>
              <div className="text-[10px] text-gray-600">{meta?.zeta_min_band} band</div>
            </div>
            <div className="glass px-4 py-3 flex-1 min-w-[120px]">
              <div className="text-xs text-gray-500">sigma_min</div>
              <div className="text-lg font-bold font-mono text-cyan-400">
                {meta?.sigma_min_all?.toFixed(4) ?? '—'}
              </div>
              <div className="text-[10px] text-gray-600">score={meta?.score_min_all?.toFixed(3)}</div>
            </div>
            <div className="glass px-4 py-3 flex-1 min-w-[120px]">
              <div className="text-xs text-gray-500">Compute</div>
              <div className="text-lg font-bold font-mono text-gray-300">{elapsed ? `${(elapsed / 1000).toFixed(1)}s` : '—'}</div>
            </div>
            {computeResult.persisted && (
              <div className="glass px-4 py-3 flex-1 min-w-[120px] border-green-500/20">
                <div className="text-xs text-green-400">Saved</div>
                <div className="text-xs font-mono text-gray-300 truncate" title={computeResult.run_name}>
                  {computeResult.run_name?.slice(0, 30)}
                </div>
                <div className="text-[10px] text-gray-600">
                  results.md + {computeResult.artifacts?.npy_count ?? 0} .npy
                </div>
              </div>
            )}
          </div>

          {/* Charts Row 1 */}
          <div className="grid grid-cols-12 gap-5">
            <div className="col-span-12 lg:col-span-7 glass p-5">
              <EigenvalueLocus computeResults={results} />
            </div>
            <div className="col-span-12 lg:col-span-5 glass p-5">
              <StabilityBoundary computeResults={results} />
            </div>
          </div>

          {/* Charts Row 2: Operating Points + Linearization + Time Domain */}
          <div className="grid grid-cols-12 gap-5">
            <div className="col-span-12 lg:col-span-5 glass p-5">
              <OperatingPoints computeResults={results} />
            </div>
            <div className="col-span-12 lg:col-span-7 glass p-5">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-green-400">Linearization Validity</h3>
                <button onClick={() => runXval('Pref')} disabled={xvalRunning}
                  className="text-xs px-3 py-1 bg-green-600/20 hover:bg-green-600/30 text-green-400 border border-green-600/30 rounded-lg transition disabled:opacity-50">
                  {xvalRunning ? 'Running xval...' : 'Re-run xval.py'}
                </button>
              </div>
              <LinearizationValidity key={`lv-${refreshKey}`} />
            </div>
          </div>

          {/* Time Domain (after xval generates trajectory) */}
          <div className="glass p-5">
            <TimeDomain key={`td-${refreshKey}`} />
          </div>

          {/* Result Table */}
          <div className="glass p-5">
            <h3 className="text-sm font-semibold text-cyan-400 mb-3">Eigenvalue Analysis Table</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-500 border-b border-gray-800">
                    <th className="text-left py-2 px-3">SCR</th>
                    <th className="text-left py-2 px-3">Status</th>
                    <th className="text-left py-2 px-3">zeta_min</th>
                    <th className="text-left py-2 px-3">Band</th>
                    <th className="text-left py-2 px-3">sigma_min</th>
                    <th className="text-left py-2 px-3">t_s [s]</th>
                    <th className="text-left py-2 px-3">score</th>
                    <th className="text-left py-2 px-3">f_dom [Hz]</th>
                    <th className="text-left py-2 px-3">delta [deg]</th>
                    <th className="text-left py-2 px-3">FD check</th>
                  </tr>
                </thead>
                <tbody>
                  {resultEntries.map(([scr_k, r]: [string, any]) => (
                    <tr key={scr_k} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition">
                      <td className="py-2 px-3 font-mono text-gray-300">{scr_k}</td>
                      <td className="py-2 px-3">
                        {r.converged === false ? (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-700 text-gray-400">{r.fail_reason ?? 'failed'}</span>
                        ) : (
                          <span className={`text-xs px-2 py-0.5 rounded-full ${r.stable ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                            {r.stable ? 'stable' : 'unstable'}
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3 font-mono text-gray-300">{r.zeta_min?.toFixed(4) ?? '—'}</td>
                      <td className="py-2 px-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          r.zeta_band === 'sync' ? 'bg-blue-500/20 text-blue-400' :
                          r.zeta_band === 'control' ? 'bg-cyan-500/20 text-cyan-400' :
                          'bg-purple-500/20 text-purple-400'
                        }`}>{r.zeta_band ?? '—'}</span>
                      </td>
                      <td className="py-2 px-3 font-mono text-cyan-400">{r.sigma_min?.toFixed(4) ?? '—'}</td>
                      <td className="py-2 px-3 font-mono text-gray-400">{r.t_s_max?.toFixed(2) ?? '—'}</td>
                      <td className="py-2 px-3 font-mono text-gray-400">{r.score?.toFixed(3) ?? '—'}</td>
                      <td className="py-2 px-3 font-mono text-gray-400">{r.f_dom_hz?.toFixed(1) ?? '—'}</td>
                      <td className="py-2 px-3 font-mono text-gray-400">{r.delta_deg?.toFixed(1) ?? '—'}</td>
                      <td className="py-2 px-3">
                        {r.fd_exceeds_tol ? (
                          <span className="text-xs text-amber-400">{r.fd_entry_rel_error?.toExponential(1)}</span>
                        ) : (
                          <span className="text-xs text-green-400">OK</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ═══ ACTION BAR ═══ */}
          <div className="grid grid-cols-12 gap-5">
            {/* Save Research Note */}
            <div className="col-span-12 lg:col-span-6 glass p-5">
              <h3 className="text-sm font-semibold text-green-400 mb-3">
                Save as Research Note
                {computeResult.persisted && (
                  <span className="text-xs text-gray-500 font-normal ml-2">
                    (results.md already auto-generated in Obsidian vault)
                  </span>
                )}
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Title</label>
                  <input value={noteTitle} onChange={e => setNoteTitle(e.target.value)}
                    className="w-full text-sm bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-200" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Memo / Observations</label>
                  <textarea value={noteMemo} onChange={e => setNoteMemo(e.target.value)} rows={3}
                    placeholder="What did you observe? Band crossover? Delta margin? Coupling effect?"
                    className="w-full text-sm bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-200 resize-none" />
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={saveNote} disabled={noteSaving || !noteTitle.trim()}
                    className="text-xs px-5 py-2 bg-green-600 hover:bg-green-500 disabled:bg-gray-700 text-white font-semibold rounded-lg transition">
                    {noteSaving ? 'Saving...' : 'Save Additional Note'}
                  </button>
                  {noteSaved && <span className="text-xs text-green-400">{noteSaved}</span>}
                </div>
              </div>
            </div>

            {/* Export for Paper */}
            <div className="col-span-12 lg:col-span-6 glass p-5">
              <h3 className="text-sm font-semibold text-amber-400 mb-3">Export for Paper (IEEE)</h3>
              <div className="space-y-3">
                <p className="text-xs text-gray-500">Generate LaTeX table from current results.</p>
                <button onClick={exportPaper}
                  className="text-xs px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white font-semibold rounded-lg transition">
                  Generate LaTeX Table
                </button>
                {showLatex && (
                  <div className="relative">
                    <button onClick={() => navigator.clipboard.writeText(latexOutput)}
                      className="absolute top-2 right-2 text-[10px] px-2 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition">
                      Copy
                    </button>
                    <pre className="text-xs font-mono text-gray-300 bg-gray-900 rounded-lg p-3 overflow-x-auto max-h-60 whitespace-pre">
                      {latexOutput}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ═══ REFERENCE DATA ═══ */}
      {!computeResult && (
        <div className="glass p-5">
          <h2 className="text-sm font-semibold text-gray-400 mb-4">Stored Results (Read-only)</h2>
          <div className="grid grid-cols-12 gap-5">
            <div className="col-span-12 lg:col-span-7">
              <EigenvalueLocus />
            </div>
            <div className="col-span-12 lg:col-span-5">
              <StabilityBoundary />
            </div>
          </div>
          <div className="grid grid-cols-12 gap-5 mt-5">
            <div className="col-span-12 lg:col-span-7">
              <LinearizationValidity />
            </div>
            <div className="col-span-12 lg:col-span-5">
              <OperatingPoints />
            </div>
          </div>
          <div className="mt-5">
            <TimeDomain />
          </div>
        </div>
      )}

      {/* 2D Boundary */}
      {sweepData?.boundaries && (
        <div className="glass p-5">
          <h2 className="text-sm font-semibold text-amber-400 mb-3">2D Boundary Summary (All Runs)</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Object.entries(sweepData.boundaries).map(([xr_k, b]: [string, any]) => (
              <div key={xr_k} className="p-3 rounded-xl bg-gray-900/50 border border-gray-800">
                <div className="text-xs text-gray-500">X/R = {xr_k}</div>
                <div className="mt-1 text-sm">
                  <span className="text-gray-400">Damping: </span>
                  <span className="font-mono text-amber-400">{b.damping_SCR ?? '—'}</span>
                </div>
                <div className="text-sm">
                  <span className="text-gray-400">Loadability: </span>
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
