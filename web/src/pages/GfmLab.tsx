import { useEffect, useState, useCallback } from 'react';
import { fetchJSON, postJSON } from '../lib/api';
import EigenvalueLocus from '../components/charts/EigenvalueLocus';
import OperatingPoints from '../components/charts/OperatingPoints';
import StabilityBoundary from '../components/charts/StabilityBoundary';
import TimeDomain from '../components/charts/TimeDomain';
import LinearizationValidity from '../components/charts/LinearizationValidity';
import ModuleInspector, { modulePath } from '../components/ModuleInspector';

import {
  Play, RotateCcw, Save, Copy, Check, ChevronDown, ChevronRight,
  X, Zap, Activity, Cpu, Settings2, FolderOpen, Terminal,
  FlaskConical, BarChart3, Gauge, Layers, Radio, Monitor,
} from 'lucide-react';

/* 실행 결과를 코랩 셀 출력처럼 순서대로 쌓는다 */
const OUTPUTS = [
  { key: 'locus', label: '고유값 궤적', note: '복소평면 · SCR별 색' },
  { key: 'op',    label: '운전점',      note: 'δ · 여유각 · v_od · v_dc' },
  { key: 'band',  label: '안정 경계',   note: 'ζ_min · 대역별 분류' },
  { key: 'traj',  label: '시간영역',    note: '비선형 vs 선형 — 저장본 필요' },
  { key: 'xval',  label: '선형화 유효범위', note: '상대오차 vs 외란 크기 — 저장본 필요' },
] as const;

/* ================================================================
   Simulation Agent — Phase-based Pipeline Controller
   P2 Model → P3 Participation → P4 PSO → P5 EMT → P6 CHIL
================================================================ */

// ── 14 Control Parameters (model.py) ──
const PARAM_GROUPS = [
  { label: 'PV MPPT', icon: Zap, affects: ['control', 'lcl'],
    evidence: 'Kp_vpv 0.1→1.0 에서 control Δζ=0.42 · lcl Δζ=0.31, sync 는 거의 안 움직임', params: [
    { key: 'Kp_vpv', name: 'Kp_vpv', min: 0.01, max: 2, step: 0.01, default: 0.1 },
    { key: 'Ki_vpv', name: 'Ki_vpv', min: 1, max: 100, step: 1, default: 10 },
    { key: 'Kp_ipv', name: 'Kp_ipv', min: 0.0001, max: 0.1, step: 0.001, default: 0.001 },
    { key: 'Ki_ipv', name: 'Ki_ipv', min: 0.01, max: 10, step: 0.1, default: 0.1 },
  ]},
  { label: 'DC LINK', icon: Activity, affects: ['sync', 'control', 'lcl'],
    evidence: 'Kp_vdc 0.5→3.0 에서 sync Δζ=0.68 · control 0.67 · lcl 0.40 — 전 대역', params: [
    { key: 'Kp_vdc', name: 'Kp_vdc', min: 0.01, max: 5, step: 0.01, default: 0.5 },
    { key: 'Ki_vdc', name: 'Ki_vdc', min: 1, max: 100, step: 1, default: 20 },
    { key: 'Kp_iess', name: 'Kp_iess', min: 0.0001, max: 0.1, step: 0.001, default: 0.001 },
    { key: 'Ki_iess', name: 'Ki_iess', min: 0.01, max: 10, step: 0.1, default: 0.1 },
  ]},
  { label: 'VSG CORE', icon: Cpu, affects: ['sync'],
    evidence: 'J 0.5→3.0 은 sync 만 (σ_min 2.16→3.21). Dp 20→80 은 σ_min 을 0.50 까지 떨어뜨림', params: [
    { key: 'J', name: 'J (Inertia)', min: 0.1, max: 5, step: 0.1, default: 0.5 },
    { key: 'Dp', name: 'Dp (Damping)', min: 1, max: 100, step: 1, default: 20 },
    { key: 'wc', name: 'wc (LPF)', min: 10, max: 200, step: 1, default: 62.83 },
    { key: 'nq', name: 'nq (Q droop)', min: 0.0001, max: 0.1, step: 0.001, default: 0.001 },
  ]},
  { label: 'VOLTAGE LOOP', icon: Settings2, affects: ['sync', 'lcl'],
    evidence: 'Kpv 0.05→1.0 에서 sync Δζ=0.68 · lcl Δζ=0.40', params: [
    { key: 'Kpv', name: 'Kpv', min: 0.01, max: 2, step: 0.01, default: 0.05 },
    { key: 'Kiv', name: 'Kiv', min: 1, max: 100, step: 1, default: 10 },
  ]},
];

const BAND_COLOR: Record<string, string> = {
  sync: 'var(--primary)',
  control: 'var(--tertiary, #12b886)',
  lcl: 'var(--secondary, #e8590c)',
};

const ALL_DEFAULTS: Record<string, number> = {};
PARAM_GROUPS.forEach(g => g.params.forEach(p => { ALL_DEFAULTS[p.key] = p.default; }));

// ── Phase Definitions ──
interface Phase {
  id: string; label: string; sub: string; icon: typeof Cpu;
  status: 'done' | 'active' | 'pending' | 'blocked';
  agents: { id: string; name: string; role: string }[];
  checklist: { key: string; label: string; done: boolean }[];
}

const PHASES: Phase[] = [
  { id: 'P2', label: '22차 야코비안', sub: 'model.py → runner.py', icon: Cpu, status: 'done',
    agents: [
      { id: 'model', name: 'model.py', role: '22-state 심볼릭 f(x,u) + 야코비안' },
      { id: 'runner', name: 'runner.py', role: 'OP해석 + 유한차분 검산 + 고유값' },
      { id: 'op', name: 'op.py', role: 'SCR별 동작점 x₀ 계산' },
    ],
    checklist: [
      { key: 'P2-A1', label: '22차 심볼릭 f(x,u) 및 야코비안', done: true },
      { key: 'P2-A2', label: '야코비안 검산 — 심볼릭 vs 유한차분 (1.2e-09)', done: true },
      { key: 'P2-A3', label: '동작점 SCR 의존성 (δ 22.4°→62.3°)', done: true },
      { key: 'P2-A4', label: '양방향 DC-AC 커플링 유도 및 정량화', done: true },
      { key: 'P2-A5', label: '선형화 유효성 임계값 확정', done: true },
      { key: 'P2-A6', label: 'TABLE I — SCR별 A 행렬 (22차)', done: false },
      { key: 'P2-A7', label: '22개 상태변수 정의표', done: false },
    ],
  },
  { id: 'P3', label: '참여인자·지배 모드', sub: 'pf_export.py → sync_reduce.py', icon: BarChart3, status: 'done',
    agents: [
      { id: 'pf', name: 'pf_export.py', role: '참여계수 P[k,i] 산출 + δ+ω 지배 모드 식별' },
      { id: 'sync', name: 'sync_reduce.py', role: 'Schur 축소 K_eff + SEP 시간척도 분리' },
    ],
    checklist: [
      { key: 'P3-A1', label: '참여인자 행렬', done: true },
      { key: 'P3-A2', label: '지배 모드 식별 — δ 지배 동기화 모드 (p=0.92→0.98)', done: true },
      { key: 'P3-A3', label: '물리적 귀속 — 동기화/LCL/DC링크/제어', done: true },
      { key: 'P3-A4', label: 'Decision Gate — 22차 유지', done: true },
      { key: 'P3-A5', label: 'f_dom 실측 — Prony 예비 적용', done: false },
    ],
  },
  { id: 'P4', label: 'PSO 예비실험', sub: '14-파라미터 최적화', icon: Gauge, status: 'active',
    agents: [
      { id: 'metrics', name: 'metrics.py', role: 'score = σ/σ_ref (TS_COEF=4)' },
      { id: 'experiment', name: 'experiment.py', role: 'AI 실험 에이전트 (4 tools)' },
    ],
    checklist: [
      { key: 'P4-A0', label: '안정도 지표 재정의 (σ 기반, ζ 배제)', done: false },
      { key: 'P4-A1', label: 'TABLE II — 14개 파라미터 탐색범위 + 근거', done: false },
      { key: 'P4-A2', label: '다중 운전점 목적함수 정의', done: false },
      { key: 'P4-A3', label: '예비 100회 → N_particle/N_iter 결정', done: false },
      { key: 'P4-A4', label: '가중치 민감도 분석', done: false },
      { key: 'P4-A5', label: 'MC 30회 수렴 재현성 통계', done: false },
    ],
  },
  { id: 'P5', label: 'DSP·EMT 검증', sub: '오프라인 검증 → SIL', icon: Monitor, status: 'pending',
    agents: [
      { id: 'A6', name: 'A6 델피노', role: 'TMS320F28379D 펌웨어 (ISR+ePWM+ADC)' },
    ],
    checklist: [
      { key: 'P5-A1', label: '오프라인 EMT — 스위칭 vs 평균 모델 대조', done: false },
      { key: 'P5-A2', label: '원형 제한기 구현', done: false },
      { key: 'P5-A3', label: 'Anti-windup 설계', done: false },
      { key: 'P5-A5', label: 'SIL — DSP C 코드 + EMT 루프 연동', done: false },
      { key: 'P5-A6', label: 'TMS320F28379D 이식 + 실행시간 프로파일링', done: false },
    ],
  },
  { id: 'P6', label: 'CHIL 구축', sub: 'RSCAD FX + NovaCor + DSP', icon: Radio, status: 'blocked',
    agents: [
      { id: 'A1', name: 'A1 볼트', role: 'GFM 인버터 모델 → RTDS 사양' },
      { id: 'A3', name: 'A3 드래프트', role: 'Draft 회로 통합' },
      { id: 'A7', name: 'A7 브릿지', role: 'RTDS↔DSP I/O 인터페이스' },
      { id: 'A5', name: 'A5 런타임', role: 'RunTime 화면 + 스크립트' },
      { id: 'A4', name: 'A4 스윕', role: '88포인트 스윕 스크립트' },
    ],
    checklist: [
      { key: 'P6-A1', label: 'RSCAD FX 모델 구축 (Thevenin+가변 임피던스)', done: false },
      { key: 'P6-A2', label: 'GTAO/GTAI 인터페이스 + 루프 지연 보상', done: false },
      { key: 'P6-A3', label: 'SNR 사전 측정 → σ_Z 보정', done: false },
      { key: 'P6-A4', label: '측정 불확도 정량화', done: false },
      { key: 'P6-A5', label: '1포인트당 실측 소요시간 파일럿', done: false },
    ],
  },
];

type StepStatus = 'idle' | 'running' | 'done' | 'error' | 'skipped';

/* ── Modal Component ── */
function Modal({ open, onClose, title, children }: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <>
      <div className="fixed inset-0 z-[100]" style={{ background: 'rgba(24,29,25,0.35)' }} onClick={onClose} />
      <div className="fixed inset-4 sm:inset-y-8 sm:left-[10%] sm:right-[10%] z-[101] flex flex-col glass-panel rounded-2xl overflow-hidden"
        style={{ maxWidth: 900, margin: '0 auto', animation: 'fade-in-up 0.2s ease-out both' }}>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <span className="mono-label" style={{ color: 'var(--primary)', fontSize: 15 }}>{title}</span>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
            style={{ color: 'var(--outline)' }}><X size={16} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        <div className="px-6 py-3 flex justify-end gap-2" style={{ borderTop: '1px solid var(--border)' }}>
          <button onClick={onClose} className="mc-btn-secondary" style={{ fontSize: 15, padding: '6px 16px' }}>닫기</button>
        </div>
      </div>
    </>
  );
}

/* ── Main ── */
export default function GfmLab() {
  const [ctrl, setCtrl] = useState<Record<string, number>>({ ...ALL_DEFAULTS });
  const [scrInput, setScrInput] = useState('3.0, 2.0, 1.5, 1.0');
  const [xr, setXr] = useState(1.0);
  const [tag, setTag] = useState('');
  const [persist, setPersist] = useState(true);

  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [logOpen, setLogOpen] = useState(false);
  const [pipeSteps, setPipeSteps] = useState<{ id: string; label: string; status: StepStatus; msg?: string; ms?: number }[]>([
    { id: 'runner', label: 'runner.py', status: 'idle' },
    { id: 'pf', label: 'pf_export.py', status: 'idle' },
    { id: 'sync', label: 'sync_reduce.py', status: 'idle' },
    { id: 'xval', label: 'xval.py', status: 'idle' },
    { id: 'reload', label: 'Dashboard reload', status: 'idle' },
  ]);

  const [runResult, setRunResult] = useState<any>(null);
  const [inspect, setInspect] = useState<string | null>(null);
  const [prevRun, setPrevRun] = useState<any>(null);          // 직전 실행 — 변화량 비교용
  const [lastRunCtrl, setLastRunCtrl] = useState<Record<string, number> | null>(null);
  const [health, setHealth] = useState<any>(null);
  const [runs, setRuns] = useState<any[]>([]);

  const [saveTitle, setSaveTitle] = useState('');
  const [saveMemo, setSaveMemo] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedPath, setSavedPath] = useState('');

  // Modals
  const [modal, setModal] = useState<string | null>(null);
  const [expandedPhase, setExpandedPhase] = useState<string | null>('P2');
  const [copied, setCopied] = useState('');

  useEffect(() => {
    fetchJSON('/health').then(d => {
      setHealth(d);
      fetchJSON('/runs').then(r => {
        if (r.runs) setRuns(r.runs.reverse());
        const active = r.runs?.find((run: any) => run.is_active);
        if (active?.ctrl) { setCtrl(prev => ({ ...prev, ...active.ctrl })); if (active.XR != null) setXr(active.XR); if (active.SCR_list) setScrInput(active.SCR_list.join(', ')); }
      }).catch(() => {});
    }).catch(() => {});
  }, []);

  const addLog = (m: string) => setLogs(p => [...p, `[${new Date().toLocaleTimeString('ko-KR')}] ${m}`]);
  const upStep = (id: string, u: Partial<typeof pipeSteps[0]>) => setPipeSteps(p => p.map(s => s.id === id ? { ...s, ...u } : s));

  const runPipeline = useCallback(async () => {
    setRunning(true); setRunResult(null); setLogs([]); setSavedPath(''); setLogOpen(true);
    setPipeSteps(p => p.map(s => ({ ...s, status: 'idle' as StepStatus, msg: undefined, ms: undefined })));
    const scrList = scrInput.split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n));
    if (!scrList.length) { addLog('ERROR: SCR list empty'); setRunning(false); return; }

    upStep('runner', { status: 'running', msg: 'OP + Jacobian + eigenvalue...' });
    addLog(`runner.py — SCR=[${scrList.join(', ')}] X/R=${xr}`);
    const t0 = performance.now();
    try {
      const d = await postJSON('/compute', { ...ctrl, SCR: scrList, XR: xr, persist, tag });
      const dt = Math.round(performance.now() - t0);
      if (d.status !== 'ok') { upStep('runner', { status: 'error', msg: d.error, ms: dt }); addLog(`ERROR: ${d.error}`); setRunning(false); return; }
      setPrevRun(runResult);            // 이번 결과로 덮기 전에 직전 것을 보관
      setLastRunCtrl({ ...ctrl });
      setRunResult(d); upStep('runner', { status: 'done', msg: `${d.persisted ? 'SAVED' : 'preview'} — ${dt}ms`, ms: dt });
      addLog(`runner.py 완료: ${dt}ms`);
      setSaveTitle(`SCR=[${scrList.join(',')}] XR=${xr} — σ_min=${d.meta?.sigma_min_all?.toFixed(4) ?? '?'}`);
    } catch (e: any) { upStep('runner', { status: 'error', msg: e.message }); addLog(`ERROR: ${e.message}`); setRunning(false); return; }

    upStep('pf', { status: 'skipped', msg: 'CLI: python Simulation/pf_export.py' });
    upStep('sync', { status: 'skipped', msg: 'CLI: python Simulation/sync_reduce.py' });

    upStep('xval', { status: 'running', msg: '선형화 유효범위...' });
    try {
      const xd = await postJSON('/run_xval', { input: 'Pref', traj_at: 0.1 });
      upStep('xval', { status: xd.status === 'ok' ? 'done' : 'error', msg: xd.status === 'ok' ? `${xd.artifacts?.length ?? 0} artifacts` : xd.error });
    } catch (e: any) { upStep('xval', { status: 'error', msg: e.message }); }

    upStep('reload', { status: 'running' });
    try { const [h, r] = await Promise.all([fetchJSON('/health'), fetchJSON('/runs')]); setHealth(h); if (r.runs) setRuns(r.runs.reverse()); upStep('reload', { status: 'done' }); }
    catch { upStep('reload', { status: 'error' }); }
    addLog('파이프라인 완료.'); setRunning(false);
  }, [ctrl, scrInput, xr, tag, persist]);

  const saveExperiment = useCallback(async () => {
    if (!runResult || !saveTitle.trim()) return; setSaving(true);
    try { const d = await postJSON('/save_note', { title: saveTitle, ctrl: runResult.meta?.ctrl_params, XR: xr, results: runResult.results, memo: saveMemo }); setSavedPath(d.path || 'saved'); }
    catch (e: any) { setSavedPath(`Error: ${e.message}`); }
    setSaving(false);
  }, [runResult, saveTitle, saveMemo, xr]);

  const setParam = (k: string, v: number) => setCtrl(p => ({ ...p, [k]: v }));

  /* 결과에서 대역별 최소 감쇠비를 뽑는다 — 무엇이 나빠졌는지 보려면 최소값이 기준이다 */
  const bandMins = (res: any): Record<string, number> => {
    const out: Record<string, number> = {};
    Object.values(res || {}).forEach((r: any) => {
      (r?.modes || []).forEach((m: any) => {
        if (out[m.band] === undefined || m.zeta < out[m.band]) out[m.band] = m.zeta;
      });
    });
    return out;
  };
  const copyCmd = (c: string) => { navigator.clipboard.writeText(c); setCopied(c); setTimeout(() => setCopied(''), 2000); };
  const meta = runResult?.meta;
  const results = runResult?.results;
  const resultEntries = results ? Object.entries(results).sort(([a], [b]) => parseFloat(b) - parseFloat(a)) : [];

  const phaseColor = (s: string) => s === 'done' ? '#16a34a' : s === 'active' ? 'var(--secondary)' : s === 'blocked' ? 'var(--error)' : 'var(--outline-variant)';
  const phaseBg = (s: string) => s === 'done' ? 'rgba(22,163,106,0.06)' : s === 'active' ? 'rgba(129,85,0,0.06)' : 'transparent';
  const stepIcon = (s: StepStatus) => s === 'done' ? <Check size={13} style={{ color: '#16a34a' }} /> :
    s === 'error' ? <X size={13} style={{ color: 'var(--error)' }} /> :
    s === 'running' ? <span className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--secondary-container)', animation: 'pulse-dot 1.2s ease-in-out infinite' }} /> :
    s === 'skipped' ? <span className="mono-label" style={{ color: 'var(--outline-variant)', fontSize: 14 }}>CLI</span> :
    <span className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--surface-container-high)' }} />;

  return (
    <div className="max-w-[1600px] mx-auto px-10 py-10 space-y-7">

      {/* ── Header ── */}
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-display" style={{ color: 'var(--primary)', fontSize: 28 }}>Simulation Agent</h1>
          <p className="mono-clock mt-1" style={{ color: 'var(--outline)', fontSize: 15 }}>
            P2 Model → P3 Participation → P4 PSO → P5 EMT → P6 CHIL
          </p>
        </div>
        {health && (
          <div className="glass-badge px-4 py-2 mono-clock flex items-center gap-3" style={{ fontSize: 15 }}>
            <span className="w-2 h-2 rounded-full" style={{ background: health.all_stable ? '#16a34a' : 'var(--error)' }} />
            <span style={{ color: 'var(--outline)' }}>{health.model_version} · {health.n_states}-state</span>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════ */}
      {/*  PHASE CARDS — Research Pipeline               */}
      {/* ══════════════════════════════════════════════ */}
      <div className="space-y-3">
        {PHASES.map(ph => {
          const expanded = expandedPhase === ph.id;
          const Icon = ph.icon;
          return (
            <div key={ph.id} className="glass-card glass-card-hover" style={{ padding: 0, cursor: 'pointer' }}>
              {/* Phase Header */}
              <div className="flex items-center gap-4 px-5 py-4" onClick={() => setExpandedPhase(expanded ? null : ph.id)}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: phaseBg(ph.status), border: `2px solid ${phaseColor(ph.status)}` }}>
                  <Icon size={18} style={{ color: phaseColor(ph.status) }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="mono-label" style={{ color: phaseColor(ph.status), fontSize: 15 }}>{ph.id}</span>
                    <span className="font-semibold text-sm" style={{ color: 'var(--on-surface)' }}>{ph.label}</span>
                    <span className="mono-label px-2 py-0.5 rounded" style={{
                      fontSize: 14, background: phaseBg(ph.status), color: phaseColor(ph.status),
                    }}>{ph.status === 'done' ? 'COMPLETE' : ph.status === 'active' ? 'ACTIVE' : ph.status === 'blocked' ? 'BLOCKED' : 'PENDING'}</span>
                  </div>
                  <span className="mono-clock" style={{ color: 'var(--outline)', fontSize: 15 }}>{ph.sub}</span>
                </div>
                <div className="flex items-center gap-2">
                  {ph.id === 'P2' && <button onClick={e => { e.stopPropagation(); setModal('model'); }}
                    className="mc-btn-primary" style={{ fontSize: 14, padding: '5px 12px' }}>Model 설정</button>}
                  {ph.id === 'P3' && <button onClick={e => { e.stopPropagation(); setModal('pf'); }}
                    className="mc-btn-secondary" style={{ fontSize: 14, padding: '5px 12px' }}>참여인자</button>}
                  {ph.id === 'P4' && <button onClick={e => { e.stopPropagation(); setModal('pso'); }}
                    className="mc-btn-secondary" style={{ fontSize: 14, padding: '5px 12px' }}>PSO 설정</button>}
                  {ph.id === 'P5' && <button onClick={e => { e.stopPropagation(); setModal('emt'); }}
                    className="mc-btn-secondary" style={{ fontSize: 14, padding: '5px 12px' }}>EMT 검증</button>}
                  {ph.id === 'P6' && <button onClick={e => { e.stopPropagation(); setModal('chil'); }}
                    className="mc-btn-secondary" style={{ fontSize: 14, padding: '5px 12px' }}>CHIL 구성</button>}
                  <ChevronDown size={16} style={{ color: 'var(--outline)', transform: expanded ? 'rotate(180deg)' : 'none', transition: '0.2s' }} />
                </div>
              </div>

              {/* Expanded: Agents + Checklist */}
              {expanded && (
                <div className="px-5 pb-5" style={{ borderTop: '1px solid var(--border)' }}>
                  <div className="grid grid-cols-12 gap-5 mt-4">
                    {/* Agents */}
                    <div className="col-span-12 md:col-span-5">
                      <span className="mono-label block mb-2" style={{ color: 'var(--outline)', fontSize: 14 }}>AGENTS</span>
                      <div className="space-y-2">
                        {ph.agents.map(a => {
                          const openable = !!modulePath(a.name);
                          return (
                            <button key={a.id} onClick={() => openable && setInspect(a.name)}
                              disabled={!openable}
                              className="w-full text-left flex items-center gap-3 p-2.5 rounded-lg transition-colors"
                              style={{
                                background: 'var(--surface-container-low)',
                                border: openable ? '1px solid var(--primary)' : '1px solid var(--border)',
                                cursor: openable ? 'pointer' : 'default',
                              }}
                              title={openable ? '코드와 값 보기' : undefined}>
                              <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'var(--surface-container)', border: '1px solid var(--border)' }}>
                                <Layers size={12} style={{ color: 'var(--primary)' }} />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="mono-clock font-semibold" style={{ color: 'var(--on-surface)', fontSize: 15 }}>{a.name}</div>
                                <div className="mono-clock" style={{ color: 'var(--outline)', fontSize: 14 }}>{a.role}</div>
                              </div>
                              {openable && (
                                <span className="mono-label shrink-0" style={{ fontSize: 14, color: 'var(--primary)' }}>열기 ↗</span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    {/* Checklist */}
                    <div className="col-span-12 md:col-span-7">
                      <span className="mono-label block mb-2" style={{ color: 'var(--outline)', fontSize: 14 }}>CHECKLIST</span>
                      <div className="space-y-1">
                        {ph.checklist.map(c => (
                          <div key={c.key} className="flex items-center gap-2 py-1.5">
                            <span className="w-4 h-4 rounded flex items-center justify-center shrink-0" style={{
                              background: c.done ? '#16a34a' : 'var(--surface-container-high)',
                              border: c.done ? 'none' : '1px solid var(--border)',
                            }}>
                              {c.done && <Check size={10} style={{ color: 'white' }} />}
                            </span>
                            <span className="mono-label" style={{ color: 'var(--outline)', fontSize: 14 }}>{c.key}</span>
                            <span className="text-body-sm" style={{ color: c.done ? 'var(--on-surface)' : 'var(--outline)', fontSize: 15 }}>{c.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ══════════════════════════════════════════════ */}
      {/*  PIPELINE EXECUTION                            */}
      {/* ══════════════════════════════════════════════ */}
      {/* ══════════════════════════════════════════════ */}
      {/*  실행 — 좌: 설정(고정) · 우: 출력(스크롤)        */}
      {/* ══════════════════════════════════════════════ */}
      <div className="grid grid-cols-12 gap-6 items-start">

        {/* ── 좌: 설정 — 스크롤해도 따라온다 ── */}
        <div className="col-span-12 lg:col-span-4 space-y-4 lg:sticky"
          style={{ top: 16, maxHeight: 'calc(100vh - 32px)', overflowY: 'auto' }}>
        {/* Pipeline + Params */}
        <div className="glass-card" style={{ padding: 24 }}>
          <div className="flex items-center justify-between mb-5">
            <span className="mono-label" style={{ color: 'var(--primary)', fontSize: 15 }}>PIPELINE EXECUTION</span>
            <button onClick={() => { setCtrl({ ...ALL_DEFAULTS }); setXr(1.0); }}
              className="mc-btn-secondary flex items-center gap-1" style={{ fontSize: 14, padding: '4px 10px' }}>
              <RotateCcw size={11} /> RESET
            </button>
          </div>

          {/* Compact param grid */}
          <div className="grid grid-cols-1 gap-4 mb-5">
            {PARAM_GROUPS.map(g => (
              <div key={g.label}>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="mono-label flex items-center gap-1" style={{ color: 'var(--on-surface-variant)', fontSize: 14 }}>
                    <g.icon size={10} /> {g.label}
                  </div>
                  {/* 실측 기반 — 이 그룹이 주로 흔드는 주파수 대역 */}
                  <div className="flex gap-1" title={g.evidence}>
                    {g.affects.map(b => (
                      <span key={b} className="mono-label px-1.5 py-0.5 rounded"
                        style={{ fontSize: 14, color: BAND_COLOR[b], border: `1px solid ${BAND_COLOR[b]}`, lineHeight: 1.2 }}>
                        {b}
                      </span>
                    ))}
                  </div>
                </div>
                {g.params.map(p => {
                  const ran = lastRunCtrl?.[p.key];
                  const dirty = ran !== undefined && Math.abs((ctrl[p.key] ?? 0) - ran) > 1e-12;
                  return (
                    <div key={p.key} className="flex items-center gap-1.5 mb-1">
                      <span className="mono-clock flex-1 truncate" style={{ color: dirty ? 'var(--primary)' : 'var(--outline)', fontSize: 14 }}>
                        {p.name}
                      </span>
                      <input type="number" step={p.step} value={ctrl[p.key] ?? ''} onChange={e => setParam(p.key, parseFloat(e.target.value) || 0)}
                        className="mc-input" style={{
                          width: 78, fontSize: 14, textAlign: 'right', padding: '3px 6px',
                          border: dirty ? '1px solid var(--primary)' : undefined,
                        }} />
                      {/* 실행에 아직 반영 안 된 값 — 바꾸는 즉시 보인다 */}
                      {dirty && (
                        <span className="mono-clock shrink-0" style={{ fontSize: 14, color: 'var(--primary)' }}>
                          ←{ran}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {/* SCR / XR */}
          <div className="flex gap-3 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
            <div className="flex-1">
              <label className="mono-label block mb-1" style={{ color: 'var(--outline)', fontSize: 14 }}>SCR LIST</label>
              <input value={scrInput} onChange={e => setScrInput(e.target.value)} className="mc-input" style={{ fontSize: 15 }} />
            </div>
            <div style={{ width: 70 }}>
              <label className="mono-label block mb-1" style={{ color: 'var(--outline)', fontSize: 14 }}>X/R</label>
              <input type="number" step="0.5" value={xr} onChange={e => setXr(parseFloat(e.target.value) || 1)} className="mc-input" style={{ fontSize: 15 }} />
            </div>
            <div style={{ width: 70 }}>
              <label className="mono-label block mb-1" style={{ color: 'var(--outline)', fontSize: 14 }}>TAG</label>
              <input value={tag} onChange={e => setTag(e.target.value)} className="mc-input" style={{ fontSize: 15 }} />
            </div>
          </div>

          <div className="flex items-center gap-3 mt-3">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={persist} onChange={e => setPersist(e.target.checked)} style={{ accentColor: 'var(--primary)' }} />
              <span className="mono-clock" style={{ color: 'var(--outline)', fontSize: 15 }}>persist</span>
            </label>
            <div className="flex-1" />
            <button onClick={runPipeline} disabled={running} className="mc-btn-primary flex items-center gap-2" style={{ padding: '8px 20px', fontSize: 15 }}>
              {running ? <><span className="animate-spin">&#9881;</span> 실행 중...</> : <><Play size={13} /> 전체 실행</>}
            </button>
          </div>
        </div>

        {/* Steps + Log */}
        <div className="space-y-4">
          <div className="glass-card" style={{ padding: 16 }}>
            <span className="mono-label" style={{ color: 'var(--primary)', fontSize: 14 }}>STATUS</span>
            <div className="space-y-1.5 mt-2">
              {pipeSteps.map(s => (
                <div key={s.id} className="flex items-center gap-2.5 p-2 rounded-lg" style={{
                  background: s.status === 'running' ? 'rgba(129,85,0,0.04)' : s.status === 'done' ? 'rgba(22,163,106,0.02)' : 'transparent',
                  border: `1px solid ${s.status === 'running' ? 'rgba(129,85,0,0.12)' : 'var(--surface-container)'}`,
                }}>
                  <div className="w-4 flex justify-center">{stepIcon(s.status)}</div>
                  <span className="mono-clock flex-1" style={{ fontSize: 15, color: s.status === 'done' ? '#16a34a' : 'var(--on-surface-variant)' }}>{s.label}</span>
                  {s.ms != null && <span className="mono-clock" style={{ fontSize: 14, color: 'var(--outline-variant)' }}>{(s.ms / 1000).toFixed(1)}s</span>}
                </div>
              ))}
            </div>
          </div>

          <div className="glass-card" style={{ padding: 16 }}>
            <div className="flex items-center justify-between mb-1">
              <span className="mono-label" style={{ color: 'var(--outline)', fontSize: 14 }}>LOG</span>
              <button onClick={() => setLogOpen(!logOpen)} className="mono-label" style={{ color: 'var(--outline)', fontSize: 14 }}>
                {logOpen ? 'HIDE' : 'SHOW'} <ChevronDown size={10} style={{ display: 'inline', transform: logOpen ? 'rotate(180deg)' : 'none' }} />
              </button>
            </div>
            {logOpen && (
              <div className="rounded-lg p-2 max-h-48 overflow-y-auto font-mono" style={{ background: 'var(--surface-container-low)', border: '1px solid var(--border)' }}>
                {logs.length === 0 ? <span className="mono-clock" style={{ color: 'var(--outline-variant)', fontSize: 14 }}>대기 중</span>
                  : logs.map((l, i) => <div key={i} className="mono-clock" style={{ fontSize: 14, color: l.includes('ERROR') ? 'var(--error)' : l.includes('완료') ? '#16a34a' : 'var(--outline)' }}>{l}</div>)}
              </div>
            )}
          </div>
        </div>
              </div>

        {/* ── 우: 결과와 그래프 ── */}
        <div className="col-span-12 lg:col-span-8 space-y-6">
      {runResult && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { l: 'STATUS', v: meta?.all_stable ? 'STABLE' : 'UNSTABLE', c: meta?.all_stable ? '#16a34a' : 'var(--error)' },
              { l: 'SIGMA_MIN', v: meta?.sigma_min_all?.toFixed(4) ?? '\u2014', c: 'var(--primary)', sub: `score=${meta?.score_min_all?.toFixed(3)}` },
              { l: 'DELTA_MAX', v: `${meta?.delta_max_deg?.toFixed(1) ?? '\u2014'}\u00b0`, c: 'var(--on-surface)' },
              { l: 'RUN', v: runResult.run_name?.slice(0, 20) ?? '\u2014', c: 'var(--on-surface)', sub: runResult.persisted ? 'SAVED' : 'preview' },
            ].map(m => (
              <div key={m.l} className="glass-card glass-card-hover" style={{ padding: 16 }}>
                <span className="mono-label" style={{ color: 'var(--outline)', fontSize: 14 }}>{m.l}</span>
                <div className="mono-metric mt-0.5" style={{ color: m.c, fontSize: 18 }}>{m.v}</div>
                {m.sub && <span className="mono-clock" style={{ color: 'var(--outline)', fontSize: 14 }}>{m.sub}</span>}
              </div>
            ))}
          </div>

          {/* ── 변화량 — 직전 실행 대비 무엇이 얼마나 움직였나 ── */}
          {prevRun?.results && (() => {
            const now = bandMins(results);
            const before = bandMins(prevRun.results);
            const dSig = (meta?.sigma_min_all ?? 0) - (prevRun.meta?.sigma_min_all ?? 0);
            const changed = Object.entries(ctrl).filter(
              ([k, v]) => prevRun.meta?.ctrl_params?.[k] !== undefined
                && Math.abs(v - prevRun.meta.ctrl_params[k]) > 1e-12);
            const arrow = (d: number) => d > 0 ? '▲' : d < 0 ? '▼' : '=';
            const col = (d: number) => d > 0 ? '#16a34a' : d < 0 ? 'var(--error)' : 'var(--outline)';

            return (
              <div className="glass-card" style={{ padding: 20 }}>
                <span className="mono-label" style={{ color: 'var(--primary)', fontSize: 15 }}>
                  직전 실행 대비 변화
                </span>

                {/* 무엇을 바꿨나 */}
                <div className="flex flex-wrap gap-2 mt-3">
                  {changed.length ? changed.map(([k, v]) => (
                    <span key={k} className="mono-clock px-2 py-1 rounded" style={{
                      fontSize: 14, background: 'var(--surface-container-low)',
                      border: '1px solid var(--primary)', color: 'var(--on-surface)' }}>
                      {k} {prevRun.meta.ctrl_params[k]} → <strong style={{ color: 'var(--primary)' }}>{v}</strong>
                    </span>
                  )) : (
                    <span className="mono-clock" style={{ fontSize: 14, color: 'var(--outline)' }}>
                      제어 파라미터는 그대로 — SCR·X/R 만 달라졌습니다
                    </span>
                  )}
                </div>

                {/* 지표가 어떻게 움직였나 */}
                <div className="grid gap-4 mt-4" style={{ gridTemplateColumns: 'repeat(4, minmax(0,1fr))' }}>
                  <div className="p-3 rounded-xl" style={{ background: 'var(--surface-container-low)', border: '1px solid var(--border)' }}>
                    <span className="mono-label" style={{ fontSize: 14, color: 'var(--outline)' }}>σ_min</span>
                    <div className="mono-metric mt-1" style={{ fontSize: 20, color: col(dSig) }}>
                      {arrow(dSig)} {Math.abs(dSig).toFixed(4)}
                    </div>
                    <span className="mono-clock" style={{ fontSize: 14, color: 'var(--outline)' }}>
                      {prevRun.meta?.sigma_min_all?.toFixed(3)} → {meta?.sigma_min_all?.toFixed(3)}
                    </span>
                  </div>

                  {['sync', 'control', 'lcl'].map(b => {
                    const d = (now[b] ?? 0) - (before[b] ?? 0);
                    if (now[b] === undefined && before[b] === undefined) return null;
                    return (
                      <div key={b} className="p-3 rounded-xl" style={{ background: 'var(--surface-container-low)', border: `1px solid ${BAND_COLOR[b]}` }}>
                        <span className="mono-label" style={{ fontSize: 14, color: BAND_COLOR[b] }}>ζ_min · {b}</span>
                        <div className="mono-metric mt-1" style={{ fontSize: 20, color: col(d) }}>
                          {arrow(d)} {Math.abs(d).toFixed(4)}
                        </div>
                        <span className="mono-clock" style={{ fontSize: 14, color: 'var(--outline)' }}>
                          {before[b]?.toFixed(3) ?? '—'} → {now[b]?.toFixed(3) ?? '—'}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <p className="mono-clock mt-3" style={{ fontSize: 14, color: 'var(--outline)' }}>
                  ▲ 초록은 좋아진 것(감쇠 증가), ▼ 빨강은 나빠진 것. 아래 Out[1]~Out[5] 그래프가 이 변화를 그린 것입니다.
                </p>
              </div>
            );
          })()}

          {/* Table */}
          <div className="glass-card" style={{ padding: 16 }}>
            <span className="mono-label" style={{ color: 'var(--primary)', fontSize: 14 }}>EIGENVALUE TABLE</span>
            <div className="overflow-x-auto mt-2">
              <table className="w-full" style={{ fontSize: 15 }}>
                <thead><tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['SCR', 'Status', '\u03c3_min', 'Score', 't_s', 'f_dom', '\u03b4', 'FD'].map(h => (
                    <th key={h} className="mono-label text-left py-2 px-2" style={{ color: 'var(--outline)', fontSize: 14 }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>{resultEntries.map(([k, r]: [string, any]) => (
                  <tr key={k} style={{ borderBottom: '1px solid var(--surface-container)' }}>
                    <td className="py-1.5 px-2 font-mono" style={{ color: 'var(--on-surface)' }}>{k}</td>
                    <td className="py-1.5 px-2"><span className="mono-label px-1.5 py-0.5 rounded" style={{ fontSize: 14, background: r.stable ? 'rgba(22,163,106,0.08)' : 'rgba(186,26,26,0.08)', color: r.stable ? '#16a34a' : 'var(--error)' }}>{r.stable ? 'OK' : 'NG'}</span></td>
                    <td className="py-1.5 px-2 font-mono" style={{ color: 'var(--primary)' }}>{r.sigma_min?.toFixed(4)}</td>
                    <td className="py-1.5 px-2 font-mono" style={{ color: 'var(--on-surface-variant)' }}>{r.score?.toFixed(3)}</td>
                    <td className="py-1.5 px-2 font-mono" style={{ color: 'var(--on-surface-variant)' }}>{r.t_s_max?.toFixed(2)}</td>
                    <td className="py-1.5 px-2 font-mono" style={{ color: 'var(--on-surface-variant)' }}>{r.f_dom_hz?.toFixed(1)}</td>
                    <td className="py-1.5 px-2 font-mono" style={{ color: 'var(--on-surface-variant)' }}>{r.delta_deg?.toFixed(1)}</td>
                    <td className="py-1.5 px-2"><span className="mono-label" style={{ fontSize: 14, color: r.fd_exceeds_tol ? 'var(--secondary)' : '#16a34a' }}>{r.fd_exceeds_tol ? 'WARN' : 'OK'}</span></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </div>

          {/* Save */}
          <div className="glass-card" style={{ padding: 16 }}>
            <span className="mono-label" style={{ color: 'var(--primary)', fontSize: 14 }}>SAVE EXPERIMENT</span>
            <div className="flex gap-3 mt-3 items-end">
              <div className="flex-1">
                <input value={saveTitle} onChange={e => setSaveTitle(e.target.value)} className="mc-input" style={{ fontSize: 15 }} placeholder="Title" />
              </div>
              <button onClick={saveExperiment} disabled={saving || !saveTitle.trim()} className="mc-btn-primary flex items-center gap-1.5" style={{ fontSize: 15, padding: '7px 16px' }}>
                <Save size={12} /> {saving ? '...' : 'Save'}
              </button>
            </div>
            {savedPath && <p className="mono-clock mt-2" style={{ color: savedPath.startsWith('Error') ? 'var(--error)' : '#16a34a', fontSize: 14 }}>{savedPath}</p>}
          </div>
        </>
      )}

      {/* ── 출력 — 기본은 저장된 최신 실행, 실행하면 그 결과로 바뀐다 ── */}
      <div className="space-y-4">
        {OUTPUTS.map((o, i) => {
          const needsSaved = o.key === 'traj' || o.key === 'xval';
          return (
            <div key={o.key} className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
          {/* 셀 머리 — Out[n] */}
              <div className="flex items-center justify-between px-4 py-2"
                style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface-container-low)' }}>
                <div className="flex items-center gap-3">
                  <span className="mono-label" style={{ fontSize: 14, color: 'var(--primary)' }}>
                    Out[{i + 1}]
                  </span>
                  <span className="mono-label" style={{ fontSize: 16, color: 'var(--on-surface)' }}>{o.label}</span>
                </div>
                <span className="mono-clock" style={{ fontSize: 14, color: 'var(--outline)' }}>{o.note}</span>
              </div>

          {/* 셀 출력 */}
              <div style={{ padding: 16, minHeight: 320 }}>
                {o.key === 'locus' && <EigenvalueLocus computeResults={results} />}
                {o.key === 'op' && <OperatingPoints computeResults={results} />}
                {o.key === 'band' && <StabilityBoundary computeResults={results} />}
                {o.key === 'traj' && <TimeDomain />}
                {o.key === 'xval' && <LinearizationValidity />}
                {needsSaved && !runResult?.persisted && (
                  <p className="mono-clock mt-2" style={{ fontSize: 14, color: 'var(--secondary)' }}>
                    저장(persist)하지 않은 실행입니다 — 이 출력은 직전에 저장된 결과를 보여줍니다.
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>


        </div>
      </div>

      {/* ── Run History ── */}
      <div className="glass-card" style={{ padding: 16 }}>
        <div className="flex items-center gap-2 mb-2">
          <FolderOpen size={13} style={{ color: 'var(--outline)' }} />
          <span className="mono-label" style={{ color: 'var(--primary)', fontSize: 14 }}>RUN HISTORY ({runs.length})</span>
        </div>
        <div className="space-y-1 max-h-48 overflow-y-auto">
          {runs.map(r => (
            <div key={r.run_name} className="flex items-center gap-2 p-2 rounded-lg" style={{
              border: `1px solid ${r.is_latest ? 'rgba(129,85,0,0.15)' : 'var(--surface-container)'}`,
              background: r.is_latest ? 'rgba(129,85,0,0.02)' : 'transparent',
            }}>
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: r.all_stable ? '#16a34a' : 'var(--error)' }} />
              <span className="mono-clock truncate flex-1" style={{ fontSize: 15, color: 'var(--on-surface)' }}>{r.run_name}</span>
              {r.is_latest && <span className="mono-label px-1 py-0.5 rounded" style={{ fontSize: 14, background: 'rgba(129,85,0,0.06)', color: 'var(--secondary)' }}>LATEST</span>}
            </div>
          ))}
        </div>
      </div>

      {/* ══════════════════════════════════════════════ */}
      {/*  MODALS                                        */}
      {/* ══════════════════════════════════════════════ */}

      {/* P2: Model Configuration */}
      <Modal open={modal === 'model'} onClose={() => setModal(null)} title="P2 — 22차 모델 파라미터 (model.py)">
        <p className="text-body-sm mb-4" style={{ color: 'var(--outline)' }}>
          22-state 소신호 모델의 14개 제어 파라미터입니다. 값은 바로 반영되지만 <strong>계산은 실행해야</strong> 돌아갑니다 —
          runner.py 가 이 값으로 야코비안을 다시 세우고 고유값을 푸는 실계산이라, 값이 바뀔 때마다 자동으로 돌리지 않습니다.
        </p>
        <div className="grid grid-cols-2 gap-6">
          {PARAM_GROUPS.map(g => (
            <div key={g.label}>
              <div className="mono-label flex items-center gap-2 mb-3" style={{ color: 'var(--on-surface-variant)', fontSize: 14 }}>
                <g.icon size={12} /> {g.label}
              </div>
              {g.params.map(p => (
                <div key={p.key} className="flex items-center gap-2 mb-2">
                  <label className="mono-clock w-20" style={{ color: 'var(--outline)', fontSize: 15 }}>{p.name}</label>
                  <input type="range" min={p.min} max={p.max} step={p.step} value={ctrl[p.key] ?? p.default}
                    onChange={e => setParam(p.key, parseFloat(e.target.value))}
                    className="flex-1 h-1.5 appearance-none rounded-full cursor-pointer"
                    style={{ accentColor: 'var(--primary)', background: 'var(--surface-container-high)' }} />
                  <input type="number" step={p.step} value={ctrl[p.key] ?? ''} onChange={e => setParam(p.key, parseFloat(e.target.value) || 0)}
                    className="mc-input" style={{ width: 72, fontSize: 15, textAlign: 'right', padding: '3px 6px' }} />
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="flex gap-3 pt-4 mt-4" style={{ borderTop: '1px solid var(--border)' }}>
          <div className="flex-1"><label className="mono-label block mb-1" style={{ fontSize: 14, color: 'var(--outline)' }}>SCR LIST</label>
            <input value={scrInput} onChange={e => setScrInput(e.target.value)} className="mc-input" style={{ fontSize: 15 }} /></div>
          <div style={{ width: 80 }}><label className="mono-label block mb-1" style={{ fontSize: 14, color: 'var(--outline)' }}>X/R</label>
            <input type="number" step="0.5" value={xr} onChange={e => setXr(parseFloat(e.target.value) || 1)} className="mc-input" style={{ fontSize: 15 }} /></div>
        </div>

        {/* 값만 바꾸고 끝나지 않게 — 여기서 바로 돌린다 */}
        <div className="flex items-center justify-between gap-3 pt-4 mt-4" style={{ borderTop: '1px solid var(--border)' }}>
          <span className="mono-clock" style={{ fontSize: 14, color: 'var(--outline)' }}>
            실행하면 아래 Out[1]~Out[5] 그래프가 이 값으로 다시 그려집니다.
          </span>
          <div className="flex gap-2">
            <button onClick={() => { setCtrl({ ...ALL_DEFAULTS }); setXr(1.0); }}
              className="mc-btn-secondary mono-label" style={{ fontSize: 15, padding: '8px 14px' }}>
              기본값
            </button>
            <button onClick={() => { setModal(null); runPipeline(); }} disabled={running}
              className="mc-btn-primary mono-label flex items-center gap-1.5" style={{ fontSize: 15, padding: '8px 18px' }}>
              <Play size={13} /> {running ? '실행 중...' : '이 값으로 실행'}
            </button>
          </div>
        </div>
      </Modal>

      {/* P3: Participation Factors */}
      <Modal open={modal === 'pf'} onClose={() => setModal(null)} title="P3 — 참여인자·지배 모드 (pf_export.py + sync_reduce.py)">
        <div className="space-y-4">
          <div className="p-4 rounded-xl" style={{ background: 'var(--surface-container-low)', border: '1px solid var(--border)' }}>
            <span className="mono-label" style={{ color: 'var(--primary)', fontSize: 14 }}>지배 모드 식별 결과</span>
            <p className="text-body-sm mt-2" style={{ color: 'var(--on-surface-variant)' }}>
              임계 모드는 δ가 지배하는 <strong>실수극</strong> (동기화 모드). Dp/J=40 과감쇠로 진동이 아닌 실수극 분리.
              진동 모드만 보는 ζ_min 지표로는 포착 불가 → σ 기반 판정 사용.
            </p>
          </div>
          <table className="w-full" style={{ fontSize: 16 }}>
            <thead><tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['SCR', 'λ (sync)', 'δ (°)', 'p(δ+Δω)'].map(h => (
                <th key={h} className="mono-label text-left py-2 px-3" style={{ color: 'var(--outline)', fontSize: 14 }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {[{ scr: 3.0, l: -4.6445, d: 22.4, p: 0.924 }, { scr: 2.0, l: -2.9653, d: 32.6, p: 0.951 },
                { scr: 1.5, l: -2.1637, d: 42.4, p: 0.965 }, { scr: 1.0, l: -1.2965, d: 62.3, p: 0.978 }].map(r => (
                <tr key={r.scr} style={{ borderBottom: '1px solid var(--surface-container)' }}>
                  <td className="py-2 px-3 font-mono" style={{ color: 'var(--on-surface)' }}>{r.scr}</td>
                  <td className="py-2 px-3 font-mono" style={{ color: 'var(--primary)' }}>{r.l}</td>
                  <td className="py-2 px-3 font-mono" style={{ color: 'var(--on-surface-variant)' }}>{r.d}</td>
                  <td className="py-2 px-3 font-mono" style={{ color: 'var(--secondary)' }}>{r.p}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="p-3 rounded-lg" style={{ background: 'rgba(186,26,26,0.04)', border: '1px solid rgba(186,26,26,0.1)' }}>
            <span className="mono-label" style={{ color: 'var(--error)', fontSize: 14 }}>check_sync.py 사용 금지</span>
            <p className="text-body-sm mt-1" style={{ color: 'var(--on-surface-variant)', fontSize: 15 }}>
              A[Δω,δ]=0은 전차수 모델에서 정상. δ→i_od→Pf→Δω 경로로 되먹임됨.
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => copyCmd('python Simulation/pf_export.py')} className="mc-btn-secondary flex items-center gap-1" style={{ fontSize: 14, padding: '5px 12px' }}>
              <Terminal size={11} /> pf_export.py {copied === 'python Simulation/pf_export.py' && <Check size={10} style={{ color: '#16a34a' }} />}
            </button>
            <button onClick={() => copyCmd('python Simulation/sync_reduce.py')} className="mc-btn-secondary flex items-center gap-1" style={{ fontSize: 14, padding: '5px 12px' }}>
              <Terminal size={11} /> sync_reduce.py {copied === 'python Simulation/sync_reduce.py' && <Check size={10} style={{ color: '#16a34a' }} />}
            </button>
          </div>
        </div>
      </Modal>

      {/* P4: PSO */}
      <Modal open={modal === 'pso'} onClose={() => setModal(null)} title="P4 — PSO 예비실험 (14-파라미터 최적화)">
        <div className="space-y-4">
          <div className="p-4 rounded-xl" style={{ background: 'rgba(186,26,26,0.04)', border: '1px solid rgba(186,26,26,0.1)' }}>
            <span className="mono-label" style={{ color: 'var(--error)', fontSize: 14 }}>P4-A0 — 지표 미확정</span>
            <p className="text-body-sm mt-1" style={{ color: 'var(--on-surface-variant)', fontSize: 15 }}>
              현재 ζ_min은 진동 모드만 봄. 임계 모드(실수극)가 포착 안됨. score = σ/σ_ref 기반 지표로 전환 필요.
            </p>
          </div>
          <div className="mono-label" style={{ color: 'var(--outline)', fontSize: 14 }}>PSO CONFIGURATION (미구현)</div>
          <div className="grid grid-cols-2 gap-3">
            {[['N_particle', '50'], ['N_iter', '500'], ['w (inertia)', '0.7'], ['c1 (cognitive)', '1.5'], ['c2 (social)', '1.5'], ['Objective', 'weighted_sum']].map(([k, v]) => (
              <div key={k} className="flex items-center gap-2">
                <span className="mono-clock w-28" style={{ color: 'var(--outline)', fontSize: 15 }}>{k}</span>
                <input className="mc-input" defaultValue={v} style={{ fontSize: 15, padding: '3px 8px' }} />
              </div>
            ))}
          </div>
          <div className="mono-label mt-2" style={{ color: 'var(--outline)', fontSize: 14 }}>PENDING TASKS</div>
          <ul className="space-y-1">
            {['P4-A1: TABLE II — 14개 파라미터 탐색범위', 'P4-A2: 다중 운전점 목적함수', 'P4-A3: 예비 100회', 'P4-A5: MC 30회 재현성'].map(t => (
              <li key={t} className="text-body-sm flex items-center gap-2" style={{ color: 'var(--outline)', fontSize: 15 }}>
                <span className="w-3 h-3 rounded border flex items-center justify-center" style={{ borderColor: 'var(--border)' }} /> {t}
              </li>
            ))}
          </ul>
        </div>
      </Modal>

      {/* P5: EMT */}
      <Modal open={modal === 'emt'} onClose={() => setModal(null)} title="P5 — DSP·EMT 검증">
        <div className="space-y-4">
          <p className="text-body-sm" style={{ color: 'var(--on-surface-variant)' }}>
            RTDS 불확실성 해소 전까지 이 단계가 논문의 검증 축. 즉시 착수 가능.
          </p>
          <div className="mono-label" style={{ color: 'var(--outline)', fontSize: 14 }}>AGENTS</div>
          <div className="p-3 rounded-lg" style={{ background: 'var(--surface-container-low)', border: '1px solid var(--border)' }}>
            <span className="mono-clock font-semibold" style={{ fontSize: 15, color: 'var(--on-surface)' }}>A6 델피노 (Delfino)</span>
            <p className="mono-clock mt-1" style={{ fontSize: 15, color: 'var(--outline)' }}>TMS320F28379D 펌웨어 — ISR + ePWM + ADC, Ts 내 실행시간 보장</p>
          </div>
          <ul className="space-y-1">
            {['오프라인 EMT — 스위칭 vs 평균 모델', '원형 제한기 + Anti-windup', 'SIL — DSP C 코드 연동', 'TMS320F28379D 이식'].map(t => (
              <li key={t} className="text-body-sm flex items-center gap-2" style={{ color: 'var(--outline)', fontSize: 15 }}>
                <span className="w-3 h-3 rounded border" style={{ borderColor: 'var(--border)' }} /> {t}
              </li>
            ))}
          </ul>
        </div>
      </Modal>

      {/* P6: CHIL */}
      <Modal open={modal === 'chil'} onClose={() => setModal(null)} title="P6 — CHIL 구축 (RSCAD FX + NovaCor + DSP)">
        <div className="space-y-4">
          <div className="p-4 rounded-xl" style={{ background: 'rgba(129,85,0,0.04)', border: '1px solid rgba(129,85,0,0.1)' }}>
            <span className="mono-label" style={{ color: 'var(--secondary)', fontSize: 14 }}>P0-A3 조건부 — RTDS 접근 미확정</span>
          </div>

          <div className="mono-label" style={{ color: 'var(--outline)', fontSize: 14 }}>3-LAYER STRUCTURE</div>
          <div className="space-y-2">
            {[
              { l: 'Layer 1 — Software', d: 'RSCAD FX (Draft/Runtime) — LAN 경유 설계·모니터·제어', agents: 'A3 드래프트, A5 런타임' },
              { l: 'Layer 2 — Simulator', d: 'NovaCor 섀시 + I/O 카드 — 실시간 전력계통 연산', agents: 'A4 스윕' },
              { l: 'Layer 3 — Controller', d: 'TMS320F28379D + 신호 조정 — GFM 제어 + PWM', agents: 'A6 델피노, A7 브릿지' },
            ].map(lay => (
              <div key={lay.l} className="p-3 rounded-lg" style={{ background: 'var(--surface-container-low)', border: '1px solid var(--border)' }}>
                <span className="mono-clock font-semibold" style={{ fontSize: 15, color: 'var(--on-surface)' }}>{lay.l}</span>
                <p className="mono-clock mt-0.5" style={{ fontSize: 15, color: 'var(--outline)' }}>{lay.d}</p>
                <span className="mono-label mt-1 block" style={{ fontSize: 14, color: 'var(--secondary)' }}>AGENTS: {lay.agents}</span>
              </div>
            ))}
          </div>

          <div className="mono-label" style={{ color: 'var(--outline)', fontSize: 14 }}>RSCAD AGENTS (10)</div>
          <div className="grid grid-cols-2 gap-2">
            {[
              { id: 'A0', name: '허브', role: '총괄 라우팅' }, { id: 'A1', name: '볼트', role: 'GFM 인버터 모델' },
              { id: 'A2', name: 'LCL', role: 'LCL + 가변 계통' }, { id: 'A3', name: '드래프트', role: 'Draft 통합' },
              { id: 'A4', name: '스윕', role: '88pt 스윕 스크립트' }, { id: 'A5', name: '런타임', role: 'RunTime 화면' },
              { id: 'A6', name: '델피노', role: 'DSP 펌웨어' }, { id: 'A7', name: '브릿지', role: 'I/O 인터페이스' },
              { id: 'A8', name: '검토', role: 'DSP-RTDS I/O 검토' }, { id: 'A9', name: '교차검증', role: '검증 절차' },
            ].map(a => (
              <div key={a.id} className="flex items-center gap-2 p-2 rounded" style={{ border: '1px solid var(--border)' }}>
                <span className="mono-label" style={{ fontSize: 14, color: 'var(--primary)' }}>{a.id}</span>
                <span className="mono-clock" style={{ fontSize: 15, color: 'var(--on-surface)' }}>{a.name}</span>
                <span className="mono-clock" style={{ fontSize: 14, color: 'var(--outline)' }}>— {a.role}</span>
              </div>
            ))}
          </div>
        </div>
      </Modal>

      {inspect && <ModuleInspector name={inspect} onClose={() => setInspect(null)} />}
    </div>
  );
}
