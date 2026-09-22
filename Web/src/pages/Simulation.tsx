import { useEffect, useState, useCallback } from 'react';
import { fetchJSON, postJSON } from '../lib/api';

// ── Simulation File Definitions ──
const SIM_FILES = [
  {
    name: 'model.py',
    role: '22-state 심볼릭 정의',
    desc: '상태벡터·상태방정식 f(x,u) 구성 → SymPy jacobian()으로 A_sym·B_sym 유도 → lambdify로 수치 함수화',
    type: 'library' as const,
    runLabel: '구조 자가검사 (양방향 커플링 assert)',
    command: 'python Simulation/model.py',
    apiEndpoint: null,
  },
  {
    name: 'runner.py',
    role: '메인 진입점',
    desc: '스윕 실행 → 유한차분 검산 → 대역별 ζ → 커플링 효과 → results/{run}/ 저장 + LATEST.json 갱신',
    type: 'main' as const,
    runLabel: '전체 파이프라인 실행',
    command: 'python Simulation/runner.py',
    apiEndpoint: '/compute',
  },
  {
    name: 'pf.py',
    role: '참여계수(Participation Factor)',
    desc: '참여계수로 모드 귀속 확정. 주파수 대역 분류의 검증 수단',
    type: 'analysis' as const,
    runLabel: '참여계수 분석 (runner 이후)',
    command: 'python Simulation/pf.py',
    apiEndpoint: null,
  },
  {
    name: 'xval.py',
    role: '선형화 유효성',
    desc: '선형화 유효성 임계값 산출 + MATLAB .mat export',
    type: 'validation' as const,
    runLabel: '선형화 유효성 (runner 이후)',
    command: 'python Simulation/xval.py',
    apiEndpoint: '/run_xval',
  },
  {
    name: 'op.py',
    role: '동작점 계산',
    desc: 'SCR·X/R 입력 → scipy.fsolve로 f(x,u)=0 풀어 x₀ 반환. δ가 SCR 따라 22°→62° 움직이는 걸 뽑는 부분',
    type: 'library' as const,
    runLabel: null,
    command: null,
    apiEndpoint: null,
  },
];

// ── Runner CLI Examples ──
const RUNNER_EXAMPLES = [
  { label: '기본', cmd: 'python Simulation/runner.py', desc: 'SCR 3.0 2.0 1.5 1.0, X/R 1.0' },
  { label: 'X/R=3.0 스윕', cmd: 'python Simulation/runner.py --XR 3.0 --SCR 3.0 2.0 1.5 1.0 0.8 --tag xr30', desc: 'X/R=3.0 조건 5개 SCR' },
  { label: '제어파라미터 변경', cmd: 'python Simulation/runner.py --J 0.62 --Dp 28', desc: 'J, Dp 수동 지정' },
  { label: '미리보기 (저장 안함)', cmd: 'python Simulation/runner.py --no-persist', desc: '화면 출력만 (디스크 쓰기 없음)' },
  { label: 'LATEST 갱신 생략', cmd: 'python Simulation/runner.py --no-latest', desc: 'LATEST.json 갱신 생략' },
];

type StepStatus = 'idle' | 'running' | 'done' | 'error' | 'skipped';

interface PipelineStep {
  id: string;
  label: string;
  status: StepStatus;
  message?: string;
  elapsed?: number;
}

interface RunResult {
  meta: any;
  results: Record<string, any>;
  run_name: string;
  persisted: boolean;
  artifacts?: any;
}

export default function Simulation() {
  // Pipeline state
  const [steps, setSteps] = useState<PipelineStep[]>([
    { id: 'model', label: '1. model.py — 구조 자가검사', status: 'idle' },
    { id: 'runner', label: '2. runner.py — OP + Jacobian + Eigenvalue', status: 'idle' },
    { id: 'pf', label: '3. pf.py — 참여계수 분석', status: 'idle' },
    { id: 'xval', label: '4. xval.py — 선형화 유효성', status: 'idle' },
    { id: 'server', label: '5. Server/app.py — 대시보드 reload', status: 'idle' },
  ]);

  // Runner params
  const [scrInput, setScrInput] = useState('3.0, 2.0, 1.5, 1.0');
  const [xr, setXr] = useState(1.0);
  const [tag, setTag] = useState('');
  const [persist, setPersist] = useState(true);
  const [pipelineRunning, setPipelineRunning] = useState(false);

  // Results
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [health, setHealth] = useState<any>(null);
  const [runs, setRuns] = useState<any[]>([]);

  // Save experiment
  const [saveTitle, setSaveTitle] = useState('');
  const [saveMemo, setSaveMemo] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedPath, setSavedPath] = useState('');

  // Expanded CLI
  const [showCLI, setShowCLI] = useState(false);

  // ── Init ──
  useEffect(() => {
    fetchJSON('/health').then(setHealth).catch(() => {});
    fetchJSON('/runs').then(d => d.runs && setRuns(d.runs.reverse())).catch(() => {});
  }, []);

  const addLog = (msg: string) => setLogs(p => [...p, `[${new Date().toLocaleTimeString('ko-KR')}] ${msg}`]);

  const updateStep = (id: string, update: Partial<PipelineStep>) => {
    setSteps(prev => prev.map(s => s.id === id ? { ...s, ...update } : s));
  };

  // ── Full Pipeline ──
  const runPipeline = useCallback(async () => {
    setPipelineRunning(true);
    setRunResult(null);
    setLogs([]);
    setSavedPath('');
    setSteps(prev => prev.map(s => ({ ...s, status: 'idle' as StepStatus, message: undefined, elapsed: undefined })));

    const scrList = scrInput.split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n));
    if (!scrList.length) {
      addLog('ERROR: SCR list is empty');
      setPipelineRunning(false);
      return;
    }

    // Step 1: model.py — self-check (skipped in web, just log)
    updateStep('model', { status: 'done', message: '모델 검증은 runner.py 내부에서 수행' });
    addLog('Step 1: model.py 자가검사 — runner.py 내부에서 자동 수행');

    // Step 2: runner.py — compute
    updateStep('runner', { status: 'running', message: 'OP 해석 + 야코비안 + 고유값 분석...' });
    addLog(`Step 2: runner.py 시작 — SCR=[${scrList.join(', ')}] X/R=${xr}${tag ? ` tag=${tag}` : ''}`);
    const t0 = performance.now();

    try {
      const d = await postJSON('/compute', {
        SCR: scrList, XR: xr, persist, tag,
      });
      const dt = Math.round(performance.now() - t0);

      if (d.status !== 'ok') {
        updateStep('runner', { status: 'error', message: d.error || 'Compute failed', elapsed: dt });
        addLog(`ERROR: ${d.error}`);
        setPipelineRunning(false);
        return;
      }

      setRunResult(d);
      updateStep('runner', { status: 'done', message: `${d.persisted ? 'SAVED' : 'preview'} — ${dt}ms`, elapsed: dt });
      addLog(`Step 2 완료: ${dt}ms — ${d.run_name}`);
      if (d.artifacts) addLog(`  Artifacts: ${d.artifacts.npy_count} .npy, results.md=${d.artifacts.results_md}`);

      // Auto-fill save title
      const zMin = d.meta?.zeta_min_all;
      setSaveTitle(`SCR=[${scrList.join(',')}] XR=${xr} — ζ_min=${zMin?.toFixed(4) ?? '?'}`);

    } catch (e: any) {
      updateStep('runner', { status: 'error', message: e.message });
      addLog(`PIPELINE ERROR: ${e.message}`);
      setPipelineRunning(false);
      return;
    }

    // Step 3: pf.py — participation factor (skipped via API for now)
    updateStep('pf', { status: 'skipped', message: 'CLI에서 별도 실행 (python Simulation/pf.py)' });
    addLog('Step 3: pf.py — 별도 CLI 실행 필요');

    // Step 4: xval.py — linearization validity
    updateStep('xval', { status: 'running', message: '선형화 유효범위 검증...' });
    addLog('Step 4: xval.py 시작...');
    try {
      const xd = await postJSON('/run_xval', { input: 'Pref', traj_at: 0.1 });
      if (xd.status === 'ok') {
        updateStep('xval', { status: 'done', message: `${xd.artifacts?.length ?? 0} artifacts` });
        addLog(`Step 4 완료: ${xd.artifacts?.join(', ')}`);
      } else {
        updateStep('xval', { status: 'error', message: xd.error });
        addLog(`Step 4 오류: ${xd.error}`);
      }
    } catch (e: any) {
      updateStep('xval', { status: 'error', message: e.message });
      addLog(`Step 4 건너뜀: ${e.message}`);
    }

    // Step 5: reload
    updateStep('server', { status: 'running', message: 'Charts reloading...' });
    addLog('Step 5: 대시보드 reload...');
    try {
      const [h, r] = await Promise.all([
        fetchJSON('/health'),
        fetchJSON('/runs'),
      ]);
      setHealth(h);
      if (r.runs) setRuns(r.runs.reverse());
      updateStep('server', { status: 'done', message: 'Reload 완료' });
      addLog('Step 5 완료: 대시보드 갱신됨');
    } catch {
      updateStep('server', { status: 'error', message: 'Reload 실패' });
    }

    addLog('파이프라인 완료.');
    setPipelineRunning(false);
  }, [scrInput, xr, tag, persist]);

  // ── Save Experiment ──
  const saveExperiment = useCallback(async () => {
    if (!runResult || !saveTitle.trim()) return;
    setSaving(true);
    try {
      const d = await postJSON('/save_note', {
        title: saveTitle,
        ctrl: runResult.meta?.ctrl_params || {},
        XR: xr,
        results: runResult.results,
        memo: saveMemo,
      });
      setSavedPath(d.path || 'saved');
      addLog(`실험 저장됨: ${d.path}`);
    } catch (e: any) {
      setSavedPath(`Error: ${e.message}`);
    }
    setSaving(false);
  }, [runResult, saveTitle, saveMemo, xr]);

  // ── Helpers ──
  const meta = runResult?.meta;
  const results = runResult?.results;
  const resultEntries = results ? Object.entries(results).sort(([a], [b]) => parseFloat(b) - parseFloat(a)) : [];

  const statusIcon = (s: StepStatus) =>
    s === 'done' ? '✅' : s === 'error' ? '❌' : s === 'running' ? '⏳' : s === 'skipped' ? '⏭️' : '○';
  const statusColor = (s: StepStatus) =>
    s === 'done' ? 'text-green-400' : s === 'error' ? 'text-red-400' : s === 'running' ? 'text-amber-400' : s === 'skipped' ? 'text-gray-500' : 'text-gray-600';

  const fileTypeColor = (t: string) =>
    t === 'main' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' :
    t === 'library' ? 'bg-gray-700/50 text-gray-400 border-gray-600/30' :
    t === 'analysis' ? 'bg-purple-500/20 text-purple-400 border-purple-500/30' :
    'bg-green-500/20 text-green-400 border-green-500/30';

  const fileTypeLabel = (t: string) =>
    t === 'main' ? '메인 진입점' : t === 'library' ? '라이브러리' : t === 'analysis' ? '분석' : '검증';

  return (
    <div className="max-w-[1400px] mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
            Simulation Agent
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            model.py → runner.py → pf.py → xval.py → Server reload
          </p>
        </div>
        {health && (
          <div className="glass px-4 py-2 text-xs text-gray-400 flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${health.all_stable ? 'bg-green-500' : 'bg-red-500'}`} />
            {health.model_version} · {health.n_states}-state · X/R={health.XR}
          </div>
        )}
      </div>

      {/* ═══ SIMULATION FILES ═══ */}
      <div className="glass p-5">
        <h2 className="text-sm font-semibold text-cyan-400 mb-4">Simulation 파일 구조</h2>
        <div className="space-y-3">
          {SIM_FILES.map((f, i) => (
            <div key={f.name} className="flex items-start gap-4 p-3 rounded-xl bg-gray-900/50 border border-gray-800 hover:border-gray-700 transition">
              <div className="shrink-0 mt-0.5">
                <span className="text-lg font-mono text-gray-500">{i + 1}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <code className="text-sm font-semibold text-gray-200">{f.name}</code>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border ${fileTypeColor(f.type)}`}>
                    {fileTypeLabel(f.type)}
                  </span>
                </div>
                <div className="text-xs text-gray-400 mb-1">{f.role}</div>
                <div className="text-xs text-gray-500 leading-relaxed">{f.desc}</div>
              </div>
              {f.command && (
                <div className="shrink-0">
                  <code className="text-[10px] text-gray-600 bg-gray-800 px-2 py-1 rounded font-mono">
                    {f.command}
                  </code>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ═══ EXECUTION ORDER + PIPELINE ═══ */}
      <div className="grid grid-cols-12 gap-5">
        {/* Left: Pipeline Control */}
        <div className="col-span-12 lg:col-span-5 space-y-5">
          {/* Pipeline Steps */}
          <div className="glass p-5">
            <h2 className="text-sm font-semibold text-emerald-400 mb-4">실행 순서</h2>
            <div className="space-y-2">
              {steps.map(s => (
                <div key={s.id} className={`flex items-center gap-3 p-2.5 rounded-lg transition ${
                  s.status === 'running' ? 'bg-amber-500/10 border border-amber-500/20' :
                  s.status === 'done' ? 'bg-green-500/5 border border-green-500/10' :
                  s.status === 'error' ? 'bg-red-500/5 border border-red-500/10' :
                  'bg-gray-900/30 border border-transparent'
                }`}>
                  <span className="text-base">{statusIcon(s.status)}</span>
                  <div className="flex-1 min-w-0">
                    <div className={`text-xs font-medium ${statusColor(s.status)}`}>{s.label}</div>
                    {s.message && (
                      <div className="text-[10px] text-gray-500 truncate">{s.message}</div>
                    )}
                  </div>
                  {s.elapsed != null && (
                    <span className="text-[10px] text-gray-600 font-mono">{(s.elapsed / 1000).toFixed(1)}s</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Params */}
          <div className="glass p-5">
            <h2 className="text-sm font-semibold text-blue-400 mb-3">파라미터</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">SCR List (comma separated)</label>
                <input value={scrInput} onChange={e => setScrInput(e.target.value)}
                  className="w-full text-sm font-mono bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-200" />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs text-gray-500 mb-1 block">X/R</label>
                  <input type="number" step="0.5" min="0.1" max="10"
                    value={xr} onChange={e => setXr(parseFloat(e.target.value) || 1)}
                    className="w-full text-sm font-mono bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-200" />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-gray-500 mb-1 block">Tag (optional)</label>
                  <input value={tag} onChange={e => setTag(e.target.value)}
                    placeholder="e.g. xr30"
                    className="w-full text-sm font-mono bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-200" />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={persist} onChange={e => setPersist(e.target.checked)}
                    className="rounded border-gray-600 bg-gray-800 text-blue-500 focus:ring-blue-500/30" />
                  <span className="text-xs text-gray-400">결과 저장 (persist)</span>
                </label>
              </div>
              <button onClick={runPipeline} disabled={pipelineRunning}
                className="w-full text-sm px-5 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 text-white font-semibold rounded-lg transition flex items-center justify-center gap-2">
                {pipelineRunning ? (
                  <><span className="animate-spin">&#9881;</span> 파이프라인 실행 중...</>
                ) : '전체 파이프라인 실행'}
              </button>
            </div>
          </div>
        </div>

        {/* Right: Log + CLI Examples */}
        <div className="col-span-12 lg:col-span-7 space-y-5">
          {/* CLI Examples */}
          <div className="glass p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-amber-400">CLI 명령어 예시</h2>
              <button onClick={() => setShowCLI(!showCLI)}
                className="text-xs text-gray-500 hover:text-gray-300 transition">
                {showCLI ? '접기' : '펼치기'}
              </button>
            </div>
            {showCLI && (
              <div className="space-y-2">
                {RUNNER_EXAMPLES.map((ex, i) => (
                  <div key={i} className="p-3 rounded-lg bg-gray-900/50 border border-gray-800">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-amber-400">{ex.label}</span>
                      <span className="text-[10px] text-gray-600">{ex.desc}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-xs font-mono text-gray-300 bg-gray-800 px-3 py-1.5 rounded">{ex.cmd}</code>
                      <button
                        onClick={() => navigator.clipboard.writeText(ex.cmd)}
                        className="text-[10px] px-2 py-1 bg-gray-700 hover:bg-gray-600 text-gray-400 rounded transition">
                        Copy
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {!showCLI && (
              <code className="text-xs font-mono text-gray-500 block">
                python Simulation/runner.py [--SCR ...] [--XR ...] [--tag ...]
              </code>
            )}
          </div>

          {/* Execution Log */}
          <div className="glass p-5">
            <h2 className="text-sm font-semibold text-gray-400 mb-3">실행 로그</h2>
            <div className="bg-gray-900/80 rounded-lg border border-gray-800 p-3 min-h-[200px] max-h-[400px] overflow-y-auto font-mono">
              {logs.length === 0 ? (
                <div className="text-xs text-gray-600">파이프라인을 실행하면 로그가 여기에 표시됩니다.</div>
              ) : (
                logs.map((l, i) => (
                  <div key={i} className={`text-[11px] leading-relaxed ${
                    l.includes('ERROR') || l.includes('오류') ? 'text-red-400' :
                    l.includes('완료') || l.includes('complete') ? 'text-green-400' :
                    l.includes('Step') ? 'text-cyan-400' :
                    'text-gray-500'
                  }`}>{l}</div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ═══ RESULTS ═══ */}
      {runResult && (
        <>
          {/* Summary Cards */}
          <div className="flex gap-3 flex-wrap">
            <div className={`glass px-4 py-3 flex-1 min-w-[130px] ${meta?.all_stable ? 'border-green-500/30' : 'border-red-500/30'}`}>
              <div className="text-xs text-gray-500">Status</div>
              <div className={`text-lg font-bold font-mono ${meta?.all_stable ? 'text-green-400' : 'text-red-400'}`}>
                {meta?.all_stable ? 'ALL STABLE' : 'UNSTABLE'}
              </div>
            </div>
            <div className="glass px-4 py-3 flex-1 min-w-[130px]">
              <div className="text-xs text-gray-500">zeta_min</div>
              <div className="text-lg font-bold font-mono text-amber-400">
                {meta?.zeta_min_all?.toFixed(4) ?? '—'}
              </div>
              <div className="text-[10px] text-gray-600">{meta?.zeta_min_band} band</div>
            </div>
            <div className="glass px-4 py-3 flex-1 min-w-[130px]">
              <div className="text-xs text-gray-500">sigma_min</div>
              <div className="text-lg font-bold font-mono text-cyan-400">
                {meta?.sigma_min_all?.toFixed(4) ?? '—'}
              </div>
              <div className="text-[10px] text-gray-600">score={meta?.score_min_all?.toFixed(3)}</div>
            </div>
            <div className="glass px-4 py-3 flex-1 min-w-[130px]">
              <div className="text-xs text-gray-500">delta_max</div>
              <div className="text-lg font-bold font-mono text-gray-300">
                {meta?.delta_max_deg?.toFixed(1) ?? '—'}°
              </div>
            </div>
            {runResult.persisted && (
              <div className="glass px-4 py-3 flex-1 min-w-[130px] border-green-500/20">
                <div className="text-xs text-green-400">Run</div>
                <div className="text-xs font-mono text-gray-300 truncate" title={runResult.run_name}>
                  {runResult.run_name?.slice(0, 35)}
                </div>
              </div>
            )}
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

          {/* ═══ SAVE EXPERIMENT ═══ */}
          <div className="glass p-5 border-emerald-500/20">
            <h3 className="text-sm font-semibold text-emerald-400 mb-3 flex items-center gap-2">
              이 실험 저장
              {savedPath && !savedPath.startsWith('Error') && (
                <span className="text-xs text-green-400 font-normal">저장 완료</span>
              )}
            </h3>
            <div className="grid grid-cols-12 gap-4">
              <div className="col-span-12 lg:col-span-8 space-y-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">실험 제목</label>
                  <input value={saveTitle} onChange={e => setSaveTitle(e.target.value)}
                    className="w-full text-sm bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-200" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">관찰 메모</label>
                  <textarea value={saveMemo} onChange={e => setSaveMemo(e.target.value)} rows={3}
                    placeholder="대역 교차 관찰, δ 마진 변화, 커플링 효과 등..."
                    className="w-full text-sm bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-200 resize-none" />
                </div>
              </div>
              <div className="col-span-12 lg:col-span-4 flex flex-col gap-3 justify-end">
                <button onClick={saveExperiment} disabled={saving || !saveTitle.trim()}
                  className="w-full text-sm px-5 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 text-white font-semibold rounded-lg transition flex items-center justify-center gap-2">
                  {saving ? (
                    <><span className="animate-spin">&#9881;</span> 저장 중...</>
                  ) : '실험 저장'}
                </button>
                {savedPath && (
                  <div className={`text-xs p-2 rounded-lg ${
                    savedPath.startsWith('Error') ? 'text-red-400 bg-red-500/10' : 'text-green-400 bg-green-500/10'
                  }`}>
                    {savedPath}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ═══ RESULTS STORAGE STRUCTURE ═══ */}
      <div className="glass p-5">
        <h2 className="text-sm font-semibold text-purple-400 mb-4">결과 저장 구조</h2>
        <div className="grid grid-cols-12 gap-5">
          {/* Tree View */}
          <div className="col-span-12 lg:col-span-5">
            <div className="bg-gray-900/80 rounded-lg border border-gray-800 p-4 font-mono text-xs leading-relaxed">
              <div className="text-gray-400">results/</div>
              <div className="text-amber-400 ml-4">LATEST.json <span className="text-gray-600">← 최신 실행 포인터</span></div>
              <div className="text-gray-400 ml-4">{'J0.50_Dp20.0_..._{hash}/'}</div>
              <div className="text-blue-400 ml-8">A_num_SCR3.00.npy <span className="text-gray-600">22x22 야코비안</span></div>
              <div className="text-blue-400 ml-8">x0_SCR3.00.npy <span className="text-gray-600">동작점 22x1</span></div>
              <div className="text-green-400 ml-8">eigenvalue_results.json <span className="text-gray-600">전 진동모드</span></div>
              <div className="text-green-400 ml-8">meta.json <span className="text-gray-600">파라미터·검산·교차</span></div>
              <div className="text-purple-400 ml-8">results.md <span className="text-gray-600">Obsidian 요약</span></div>
            </div>
            <div className="mt-3 text-[10px] text-gray-600 space-y-1">
              <div><strong>폴더명</strong> = 공통 조건 (제어 파라미터, X/R, SCR 목록의 md5 앞 6자리)</div>
              <div><strong>파일명</strong> = 점 조건 (SCR). 스윕 축을 파일명에 둔다.</div>
              <div><code>latest/</code> 폴더는 폐기됨 → <code>LATEST.json</code> 포인터로 대체</div>
            </div>
          </div>

          {/* Run History */}
          <div className="col-span-12 lg:col-span-7">
            <h3 className="text-xs text-gray-500 font-semibold mb-2">실행 히스토리 ({runs.length}개)</h3>
            <div className="space-y-1.5 max-h-[350px] overflow-y-auto pr-1">
              {runs.map(r => (
                <div key={r.run_name} className={`flex items-center gap-3 p-2.5 rounded-lg border transition ${
                  r.is_active ? 'border-blue-500/50 bg-blue-500/10' :
                  r.is_latest ? 'border-amber-500/30 bg-amber-500/5' :
                  'border-gray-800 bg-gray-900/50 hover:border-gray-700'
                }`}>
                  <div className={`w-2 h-2 rounded-full shrink-0 ${r.all_stable ? 'bg-green-500' : 'bg-red-500'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-mono text-gray-300 truncate">{r.run_name}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-gray-500">X/R={r.XR}</span>
                      <span className="text-[10px] text-gray-500">SCR [{r.SCR_list?.join(', ')}]</span>
                      {r.zeta_min != null && (
                        <span className="text-[10px] text-amber-400">zeta={r.zeta_min.toFixed(4)}</span>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 flex items-center gap-1.5">
                    {r.is_active && <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400">active</span>}
                    {r.is_latest && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400">latest</span>}
                    <span className="text-[10px] text-gray-600">{r.timestamp?.split(' ')[0]}</span>
                  </div>
                </div>
              ))}
              {runs.length === 0 && (
                <div className="text-xs text-gray-600 p-3 text-center">
                  실행 기록이 없습니다. 파이프라인을 실행하세요.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
