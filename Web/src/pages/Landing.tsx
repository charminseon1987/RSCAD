import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Cpu, Grid3x3, Crosshair, Zap, Bot, Activity,
  ArrowRight, ExternalLink, ChevronRight, X, Save, RotateCcw,
} from 'lucide-react';
import { fetchJSON, postJSON } from '../lib/api';

/* ------------------------------------------------------------------ */
/*  Feature card param definitions                                     */
/* ------------------------------------------------------------------ */
interface Param {
  key: string;
  label: string;
  type: 'number' | 'select' | 'text' | 'range' | 'toggle';
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  options?: string[];
  defaultValue: string | number | boolean;
  help?: string;
}

interface Feature {
  icon: typeof Cpu;
  title: string;
  desc: string;
  params: Param[];
}

const FEATURES: Feature[] = [
  {
    icon: Cpu,
    title: '22-State Model',
    desc: 'DC-AC 양방향 커플링을 포착하는 소신호 상태공간 모델',
    params: [
      { key: 'n_states',   label: '상태 변수 수',    type: 'select', options: ['14', '18', '22'], defaultValue: '22', help: '모델 차수 (14: 간략, 22: 풀모델)' },
      { key: 'Vdc',        label: 'DC 링크 전압',    type: 'number', unit: 'V',   min: 400, max: 1500, step: 10, defaultValue: 800 },
      { key: 'Vac',        label: 'AC 정격 전압',    type: 'number', unit: 'V',   min: 100, max: 690,  step: 10, defaultValue: 380 },
      { key: 'Prated',     label: '정격 출력',       type: 'number', unit: 'kW',  min: 10,  max: 5000, step: 10, defaultValue: 500 },
      { key: 'fsw',        label: '스위칭 주파수',   type: 'number', unit: 'kHz', min: 1,   max: 50,   step: 0.5, defaultValue: 10 },
      { key: 'coupling',   label: 'DC-AC 커플링',    type: 'toggle', defaultValue: true, help: 'DC-AC 양방향 커플링 포함 여부' },
    ],
  },
  {
    icon: Grid3x3,
    title: 'SCR\u2013X/R 2D Boundary',
    desc: '단조/비단조 안정 경계를 실측 데이터로 매핑',
    params: [
      { key: 'scr_min',    label: 'SCR 최소',        type: 'number', min: 1,   max: 5,   step: 0.1,  defaultValue: 1.5 },
      { key: 'scr_max',    label: 'SCR 최대',        type: 'number', min: 5,   max: 20,  step: 0.5,  defaultValue: 10 },
      { key: 'scr_step',   label: 'SCR 스텝',        type: 'number', min: 0.1, max: 2,   step: 0.1,  defaultValue: 0.5 },
      { key: 'xr_min',     label: 'X/R 최소',        type: 'number', min: 0.5, max: 3,   step: 0.1,  defaultValue: 1.0 },
      { key: 'xr_max',     label: 'X/R 최대',        type: 'number', min: 3,   max: 20,  step: 0.5,  defaultValue: 10 },
      { key: 'xr_step',    label: 'X/R 스텝',        type: 'number', min: 0.1, max: 2,   step: 0.1,  defaultValue: 0.5 },
      { key: 'boundary',   label: '경계 유형',       type: 'select', options: ['monotonic', 'non-monotonic', 'both'], defaultValue: 'both' },
    ],
  },
  {
    icon: Crosshair,
    title: 'Eigenvalue Locus',
    desc: '복소평면 위 고유값 궤적으로 감쇠비·주파수 분석',
    params: [
      { key: 'sweep_var',  label: '스윕 변수',       type: 'select', options: ['SCR', 'X/R', 'Kp_pll', 'Ki_pll', 'Kp_cc', 'droop'], defaultValue: 'SCR' },
      { key: 'sweep_min',  label: '스윕 시작',       type: 'number', min: 0, max: 100, step: 0.1, defaultValue: 1.0 },
      { key: 'sweep_max',  label: '스윕 끝',         type: 'number', min: 0, max: 100, step: 0.1, defaultValue: 10.0 },
      { key: 'sweep_pts',  label: '스윕 포인트 수',  type: 'number', min: 10, max: 500, step: 10, defaultValue: 50 },
      { key: 'real_range',  label: 'Re(\u03bb) 범위',     type: 'range', min: -500, max: 100, step: 10, defaultValue: -200, help: '실수부 표시 범위' },
      { key: 'imag_range',  label: 'Im(\u03bb) 범위',     type: 'range', min: 0, max: 5000, step: 100, defaultValue: 2000, help: '허수부 표시 범위' },
    ],
  },
  {
    icon: Zap,
    title: 'PSO Optimization',
    desc: '다중 운전점 목적함수로 14-파라미터 최적화 (Phase 4)',
    params: [
      { key: 'n_particles', label: '파티클 수',       type: 'number', min: 10, max: 200, step: 10, defaultValue: 50 },
      { key: 'n_iter',      label: '반복 횟수',       type: 'number', min: 50, max: 2000, step: 50, defaultValue: 500 },
      { key: 'w',           label: '관성 계수 (w)',   type: 'number', min: 0.1, max: 1.5, step: 0.05, defaultValue: 0.7 },
      { key: 'c1',          label: '인지 계수 (c1)',  type: 'number', min: 0.5, max: 3,   step: 0.1, defaultValue: 1.5 },
      { key: 'c2',          label: '사회 계수 (c2)',  type: 'number', min: 0.5, max: 3,   step: 0.1, defaultValue: 1.5 },
      { key: 'obj_func',    label: '목적 함수',       type: 'select', options: ['min_sigma', 'max_damping', 'weighted_sum', 'pareto'], defaultValue: 'weighted_sum' },
      { key: 'multi_op',    label: '다중 운전점',     type: 'toggle', defaultValue: true, help: '여러 SCR/X/R 조합에서 동시 최적화' },
    ],
  },
  {
    icon: Bot,
    title: 'AI Agent Team',
    desc: '8인 에이전트 팀이 시뮬레이션·검증·논문 작성 자동화',
    params: [
      { key: 'llm_model',   label: 'LLM 모델',       type: 'select', options: ['claude-opus-4-6', 'claude-sonnet-4-6', 'gpt-4o', 'gemini-2.5-pro'], defaultValue: 'claude-opus-4-6' },
      { key: 'temperature', label: 'Temperature',     type: 'number', min: 0, max: 1, step: 0.05, defaultValue: 0.3 },
      { key: 'max_tokens',  label: 'Max Tokens',      type: 'number', min: 1000, max: 32000, step: 1000, defaultValue: 8000 },
      { key: 'auto_verify', label: '자동 검증',       type: 'toggle', defaultValue: true, help: '시뮬레이션 결과 자동 검증 활성화' },
      { key: 'auto_paper',  label: '자동 논문 작성',  type: 'toggle', defaultValue: false, help: '결과 확정 시 자동으로 논문 섹션 생성' },
      { key: 'rag_enabled', label: 'RAG 활성화',      type: 'toggle', defaultValue: true, help: '문헌 기반 RAG 검색 활성화' },
    ],
  },
  {
    icon: Activity,
    title: 'Disturbance Response',
    desc: '외란 후 시간영역 궤적과 선형화 유효범위 검증',
    params: [
      { key: 'dist_type',   label: '외란 유형',       type: 'select', options: ['voltage_sag', 'load_step', 'freq_step', 'fault_3ph', 'fault_1ph'], defaultValue: 'voltage_sag' },
      { key: 'dist_mag',    label: '외란 크기',       type: 'number', unit: '%', min: 1, max: 100, step: 1, defaultValue: 20, help: '정격 대비 백분율' },
      { key: 'dist_dur',    label: '외란 지속시간',   type: 'number', unit: 'ms', min: 10, max: 5000, step: 10, defaultValue: 200 },
      { key: 'sim_time',    label: '시뮬레이션 시간', type: 'number', unit: 's', min: 0.1, max: 30, step: 0.1, defaultValue: 5.0 },
      { key: 'dt',          label: '시간 스텝',       type: 'number', unit: '\u03bcs', min: 1, max: 100, step: 1, defaultValue: 50 },
      { key: 'lin_check',   label: '선형화 유효범위', type: 'toggle', defaultValue: true, help: '비선형-선형 응답 비교 검증' },
    ],
  },
];

const AGENTS = [
  { key: 'ceo',         emoji: '\uD83E\uDDED', name: 'CEO',        role: '연구소장' },
  { key: 'developer',   emoji: '\uD83D\uDCBB', name: 'Developer',  role: '시뮬엔지니어' },
  { key: 'business',    emoji: '\u2696\uFE0F',  name: 'Business',   role: '검증판정자' },
  { key: 'secretary',   emoji: '\uD83D\uDCCB', name: 'Secretary',  role: '실험노트관리자' },
  { key: 'researcher',  emoji: '\uD83D\uDCDA', name: 'Researcher', role: '문헌추적자' },
  { key: 'writer',      emoji: '\u270D\uFE0F',  name: 'Writer',     role: '논문작가' },
  { key: 'designer',    emoji: '\uD83D\uDCCA', name: 'Designer',   role: '그림담당' },
  { key: 'rag_manager', emoji: '\uD83D\uDD0E', name: 'RAG Manager', role: 'RAG관리자' },
];

const PHASES = [
  { id: 1, label: 'Model',    short: '모델' },
  { id: 2, label: 'Sweep',    short: '스윕' },
  { id: 3, label: 'Boundary', short: '경계' },
  { id: 4, label: 'PSO',      short: '최적화' },
  { id: 5, label: 'EMT',      short: '검증' },
  { id: 6, label: 'Paper',    short: '논문' },
];

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
interface HealthData {
  model_version?: string;
  n_states?: number;
  loaded_SCR?: number[];
  all_stable?: boolean;
}

interface PhaseData { id: string; status: string; }
interface ScheduleData { phases?: PhaseData[]; }

/* ------------------------------------------------------------------ */
/*  Feature Config Slide Panel                                         */
/* ------------------------------------------------------------------ */
function FeatureConfigPanel({
  feature,
  onClose,
}: {
  feature: Feature;
  onClose: () => void;
}) {
  const defaults = Object.fromEntries(
    feature.params.map(p => [p.key, p.defaultValue]),
  );
  const [values, setValues] = useState<Record<string, string | number | boolean>>(defaults);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const set = (key: string, v: string | number | boolean) =>
    setValues(prev => ({ ...prev, [key]: v }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await postJSON('/config/' + feature.title.toLowerCase().replace(/[^a-z0-9]+/g, '_'), values);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      localStorage.setItem(`gfm_config_${feature.title}`, JSON.stringify(values));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => setValues(defaults);
  const Icon = feature.icon;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[100]"
        style={{ background: 'rgba(24,29,25,0.3)', animation: 'fade-in-up 0.15s ease-out both' }}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className="fixed top-0 right-0 z-[101] h-full w-full max-w-md glass-panel flex flex-col overflow-hidden"
        style={{
          animation: 'slide-in-right 0.25s ease-out both',
        }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-5" style={{ borderBottom: '1px solid var(--border)' }}>
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: 'var(--primary)' }}
          >
            <Icon size={16} style={{ color: 'var(--on-primary)' }} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm truncate" style={{ color: 'var(--on-surface)' }}>{feature.title}</h3>
            <p className="text-body-sm truncate" style={{ color: 'var(--outline)', fontSize: 11 }}>{feature.desc}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-md flex items-center justify-center transition-colors"
            style={{ color: 'var(--outline)' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Params */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {feature.params.map(p => (
            <div key={p.key}>
              <label className="flex items-baseline gap-2 mb-1.5">
                <span className="text-body-sm font-medium" style={{ color: 'var(--on-surface)', fontSize: 13 }}>{p.label}</span>
                {p.unit && <span className="mono-label" style={{ color: 'var(--outline)', fontSize: 10 }}>({p.unit})</span>}
              </label>

              {p.help && (
                <p style={{ color: 'var(--outline)', fontSize: 11 }} className="mb-1.5 leading-relaxed">{p.help}</p>
              )}

              {p.type === 'number' && (
                <div className="flex items-center gap-2">
                  <input
                    type="number" min={p.min} max={p.max} step={p.step}
                    value={values[p.key] as number}
                    onChange={e => set(p.key, Number(e.target.value))}
                    className="mc-input"
                  />
                  {p.min != null && p.max != null && (
                    <span className="mono-label whitespace-nowrap" style={{ color: 'var(--outline-variant)', fontSize: 10 }}>
                      {p.min}–{p.max}
                    </span>
                  )}
                </div>
              )}

              {p.type === 'range' && (
                <div className="flex items-center gap-3">
                  <input
                    type="range" min={p.min} max={p.max} step={p.step}
                    value={values[p.key] as number}
                    onChange={e => set(p.key, Number(e.target.value))}
                    className="flex-1"
                    style={{ accentColor: 'var(--primary)' }}
                  />
                  <span className="font-mono text-sm w-14 text-right" style={{ color: 'var(--on-surface-variant)' }}>
                    {values[p.key]}
                  </span>
                </div>
              )}

              {p.type === 'select' && (
                <select
                  value={values[p.key] as string}
                  onChange={e => set(p.key, e.target.value)}
                  className="mc-input cursor-pointer"
                >
                  {p.options!.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              )}

              {p.type === 'text' && (
                <input
                  type="text"
                  value={values[p.key] as string}
                  onChange={e => set(p.key, e.target.value)}
                  className="mc-input"
                  style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}
                />
              )}

              {p.type === 'toggle' && (
                <button
                  onClick={() => set(p.key, !values[p.key])}
                  className="relative w-11 h-6 rounded-full transition-colors duration-200"
                  style={{ background: values[p.key] ? 'var(--primary)' : 'var(--outline-variant)' }}
                >
                  <span
                    className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200"
                    style={{ transform: values[p.key] ? 'translateX(20px)' : 'none' }}
                  />
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 flex items-center gap-3" style={{ borderTop: '1px solid var(--border)' }}>
          <button onClick={handleReset} className="mc-btn-secondary flex items-center gap-1.5" style={{ fontSize: 12 }}>
            <RotateCcw size={13} />
            Reset
          </button>
          <div className="flex-1" />
          <button
            onClick={handleSave}
            disabled={saving}
            className="mc-btn-primary flex items-center gap-1.5"
            style={saved ? { background: '#16a34a' } : {}}
          >
            <Save size={13} />
            {saving ? 'Saving...' : saved ? 'Saved!' : 'Save'}
          </button>
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Landing Component                                             */
/* ------------------------------------------------------------------ */
export default function Landing() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [healthError, setHealthError] = useState(false);
  const [phaseStatuses, setPhaseStatuses] = useState<Record<string, string>>({});
  const [scheduleError, setScheduleError] = useState(false);
  const [selectedFeature, setSelectedFeature] = useState<Feature | null>(null);

  useEffect(() => {
    fetchJSON<any>('/health')
      .then(d => setHealth({
        model_version: d.model_version,
        n_states: d.n_states,
        loaded_SCR: d.loaded_SCR,
        all_stable: d.all_stable,
      }))
      .catch(() => setHealthError(true));

    fetchJSON<ScheduleData>('/schedule_status')
      .then(d => {
        if (d.phases) {
          const map: Record<string, string> = {};
          for (const p of d.phases) map[p.id] = p.status;
          setPhaseStatuses(map);
        }
      })
      .catch(() => setScheduleError(true));
  }, []);

  const getPhaseStatus = (id: number): string => {
    if (scheduleError) return 'pending';
    return phaseStatuses[`P${id}`] ?? phaseStatuses[String(id)] ?? 'pending';
  };

  return (
    <div className="min-h-screen overflow-x-hidden" style={{ background: 'var(--surface)' }}>

      {/* ============================================================ */}
      {/*  HERO                                                        */}
      {/* ============================================================ */}
      <section
        className="relative flex items-center px-8"
        style={{ minHeight: 'calc(100vh - 56px)' }}
      >
        {/* Background: dot grid + floating orbs */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {/* Dot grid */}
          <svg className="absolute inset-0 w-full h-full" style={{ opacity: 0.4 }} xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="mc-dots" width="40" height="40" patternUnits="userSpaceOnUse">
                <circle cx="20" cy="20" r="0.6" fill="var(--outline-variant)" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#mc-dots)" />
          </svg>

          {/* Floating gradient orbs */}
          <div
            className="absolute rounded-full"
            style={{
              width: 600, height: 600,
              background: 'radial-gradient(circle, rgba(5,21,43,0.04), transparent 70%)',
              top: '-15%', left: '-8%',
              animation: 'orb-drift-1 16s ease-in-out infinite',
            }}
          />
          <div
            className="absolute rounded-full"
            style={{
              width: 500, height: 500,
              background: 'radial-gradient(circle, rgba(129,85,0,0.035), transparent 70%)',
              top: '30%', right: '-12%',
              animation: 'orb-drift-2 20s ease-in-out infinite',
            }}
          />
          <div
            className="absolute rounded-full"
            style={{
              width: 400, height: 400,
              background: 'radial-gradient(circle, rgba(184,199,229,0.06), transparent 70%)',
              bottom: '-5%', left: '35%',
              animation: 'orb-drift-3 14s ease-in-out infinite',
            }}
          />
        </div>

        <div className="relative z-10 max-w-[1600px] mx-auto w-full grid lg:grid-cols-[1fr_auto] gap-20 items-center py-20">
          {/* Left: Text */}
          <div style={{ animation: 'fade-in-up 0.7s ease-out both' }}>
            {/* Badge */}
            <div
              className="glass-badge mono-label inline-flex items-center gap-2 px-4 py-1.5 mb-8"
              style={{ color: 'var(--outline)', fontSize: 11 }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: '#16a34a', animation: 'online-blink 2s ease-in-out infinite' }}
              />
              SYSTEM ONLINE
            </div>

            <h1 className="text-display mb-4" style={{ color: 'var(--primary)', fontSize: 48, lineHeight: '52px' }}>
              Grid-Forming Inverter
              <br />
              <span style={{ color: 'var(--on-surface)' }}>Stability Research</span>
            </h1>

            <p className="text-body mb-2" style={{ color: 'var(--on-surface-variant)', maxWidth: 560 }}>
              22-state small-signal model with DC-AC bidirectional coupling.
              Systematic eigenvalue analysis across SCR{'\u2013'}X/R parameter space.
            </p>
            <p className="mono-clock mb-10" style={{ color: 'var(--outline)' }}>
              Yonsei Smart Grid Lab &middot; IEEE Access Target
            </p>

            {/* CTAs */}
            <div className="flex flex-wrap gap-3">
              <Link to="/dashboard" className="mc-btn-primary group inline-flex items-center gap-2">
                Open Dashboard
                <ArrowRight size={15} className="group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link
                to="/lab"
                className="group inline-flex items-center gap-2 glass-badge px-6 py-2.5 font-medium text-sm transition-all duration-200 hover:scale-[1.02]"
                style={{ color: 'var(--on-surface)', borderRadius: 'var(--radius-lg)' }}
              >
                Experiment Lab
                <ChevronRight size={15} style={{ color: 'var(--outline)' }} className="group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>
          </div>

          {/* Right: Metric Cards */}
          <div
            className="hidden lg:grid grid-cols-2 gap-4"
            style={{ width: 340, animation: 'fade-in-up 0.7s ease-out 0.2s both' }}
          >
            {[
              { label: 'STATES', value: '22', sub: 'Full Model' },
              { label: 'PHASES', value: '6', sub: 'Pipeline' },
              { label: 'AGENTS', value: '8', sub: 'Autonomous' },
              { label: 'TARGET', value: 'IEEE', sub: 'Access' },
            ].map((m, i) => (
              <div
                key={m.label}
                className="glass-card glass-card-hover flex flex-col gap-1 cursor-default"
                style={{ animation: `fade-in-up 0.5s ease-out ${0.3 + i * 0.1}s both` }}
              >
                <span className="mono-label" style={{ color: 'var(--outline)', fontSize: 10 }}>{m.label}</span>
                <span className="mono-metric" style={{ color: 'var(--primary)' }}>{m.value}</span>
                <span className="mono-clock" style={{ color: 'var(--outline)', fontSize: 12 }}>{m.sub}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Scroll */}
        <div
          className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
          style={{ animation: 'fade-in-up 0.8s ease-out 0.8s both' }}
        >
          <span className="mono-label" style={{ color: 'var(--outline-variant)', fontSize: 10 }}>SCROLL</span>
          <div className="w-px h-6" style={{ background: 'linear-gradient(var(--outline-variant), transparent)' }} />
        </div>
      </section>

      {/* ============================================================ */}
      {/*  LIVE STATUS BAR                                              */}
      {/* ============================================================ */}
      <section className="px-8 pb-4">
        <div
          className="max-w-[1600px] mx-auto glass-status flex flex-wrap items-center gap-x-8 gap-y-3 mono-clock"
          style={{ padding: '12px 24px' }}
        >
          {healthError ? (
            <span className="flex items-center gap-2" style={{ color: 'var(--error)' }}>
              <span className="w-2 h-2 rounded-full inline-block" style={{ background: 'var(--error)' }} />
              SERVER OFFLINE
            </span>
          ) : !health ? (
            <span style={{ color: 'var(--outline)' }}>connecting...</span>
          ) : (
            <>
              <span style={{ color: 'var(--on-surface-variant)' }}>
                <span style={{ color: 'var(--outline)' }}>model </span>
                {health.model_version ?? 'v3'}
              </span>
              <span style={{ color: 'var(--on-surface-variant)' }}>
                <span style={{ color: 'var(--outline)' }}>states </span>
                {health.n_states ?? 22}
              </span>
              <span style={{ color: 'var(--on-surface-variant)' }}>
                <span style={{ color: 'var(--outline)' }}>SCR </span>
                {health.loaded_SCR ? `[${health.loaded_SCR.join(', ')}]` : '--'}
              </span>
              <span className="flex items-center gap-2">
                <span
                  className="w-2 h-2 rounded-full inline-block"
                  style={{
                    background: health.all_stable ? '#16a34a' : 'var(--error)',
                    animation: 'online-blink 2s ease-in-out infinite',
                  }}
                />
                <span style={{ color: health.all_stable ? '#16a34a' : 'var(--error)' }}>
                  {health.all_stable ? 'all stable' : 'unstable'}
                </span>
              </span>
            </>
          )}
        </div>
      </section>

      {/* ============================================================ */}
      {/*  FEATURE CARDS                                                */}
      {/* ============================================================ */}
      <section className="py-24 px-8">
        <div className="max-w-[1600px] mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-headline font-semibold mb-2" style={{ color: 'var(--on-surface)' }}>
              Core Capabilities
            </h2>
            <p className="mono-clock" style={{ color: 'var(--outline)' }}>
              22-state GFM model &middot; stability analysis toolkit
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((f, i) => {
              const Icon = f.icon;
              return (
                <div
                  key={f.title}
                  onClick={() => setSelectedFeature(f)}
                  className="glass-card glass-card-hover cursor-pointer group"
                  style={{ animation: `fade-in-up 0.5s ease-out ${0.08 * i}s both` }}
                >
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center mb-5
                      group-hover:scale-105 transition-transform duration-200"
                    style={{
                      background: 'rgba(255,255,255,0.6)',
                      border: '1px solid rgba(221,225,218,0.5)',
                      backdropFilter: 'blur(8px)',
                    }}
                  >
                    <Icon size={18} style={{ color: 'var(--primary)' }} />
                  </div>
                  <h3 className="font-semibold text-sm mb-2" style={{ color: 'var(--on-surface)' }}>{f.title}</h3>
                  <p className="text-body-sm leading-relaxed mb-3" style={{ color: 'var(--on-surface-variant)', fontSize: 13 }}>
                    {f.desc}
                  </p>
                  <span
                    className="mono-label inline-flex items-center gap-1.5 group-hover:gap-2 transition-all"
                    style={{ color: 'var(--outline)', fontSize: 10 }}
                  >
                    <span className="w-1 h-1 rounded-full" style={{ background: 'var(--secondary-container)' }} />
                    {f.params.length} PARAMS
                    <ChevronRight size={10} className="group-hover:translate-x-0.5 transition-transform" />
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  RESEARCH PIPELINE                                            */}
      {/* ============================================================ */}
      <section className="py-24 px-8" style={{ background: 'var(--surface-container-low)' }}>
        <div className="max-w-[1200px] mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-headline font-semibold mb-2" style={{ color: 'var(--on-surface)' }}>
              Research Pipeline
            </h2>
            <p className="mono-clock" style={{ color: 'var(--outline)' }}>
              6-phase systematic approach
            </p>
          </div>

          {/* Desktop Pipeline Rail */}
          <div className="hidden md:flex items-center justify-center gap-0">
            {PHASES.map((p, i) => {
              const s = getPhaseStatus(p.id);
              const isComplete = s === 'complete';
              const isActive = s === 'active' || s === 'in_progress';
              return (
                <div key={p.id} className="flex items-center" style={{ animation: `slide-right 0.4s ease-out ${i * 0.1}s both` }}>
                  <div className="flex flex-col items-center">
                    <div
                      className="glass-station"
                      style={{
                        borderColor: isComplete ? 'var(--primary)' : isActive ? 'var(--secondary-container)' : 'var(--border)',
                        background: isComplete ? 'var(--primary)' : 'var(--surface-container-lowest)',
                      }}
                    >
                      {isComplete ? (
                        <div className="w-3 h-3 rounded-full" style={{ background: 'var(--on-primary)' }} />
                      ) : (
                        <div
                          className="w-3 h-3 rounded"
                          style={{
                            background: isActive ? 'var(--secondary-container)' : 'var(--outline-variant)',
                            borderRadius: 3,
                            ...(isActive ? { animation: 'pulse-dot 1.5s ease-in-out infinite' } : {}),
                          }}
                        />
                      )}
                    </div>
                    <span
                      className="mono-label mt-2.5"
                      style={{
                        fontSize: 11,
                        color: isComplete ? 'var(--primary)' : isActive ? 'var(--secondary)' : 'var(--outline)',
                      }}
                    >
                      {p.label}
                    </span>
                    <span className="mono-clock" style={{ color: 'var(--outline-variant)', fontSize: 10 }}>{p.short}</span>
                  </div>
                  {i < PHASES.length - 1 && (
                    <div
                      className="mx-2 mt-[-20px]"
                      style={{
                        width: 48, height: 2,
                        background: isComplete ? 'var(--primary)' : 'var(--border)',
                        borderRadius: 1,
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* Mobile */}
          <div className="md:hidden space-y-3">
            {PHASES.map((p, i) => {
              const s = getPhaseStatus(p.id);
              const isComplete = s === 'complete';
              const isActive = s === 'active' || s === 'in_progress';
              return (
                <div
                  key={p.id}
                  className="flex items-center gap-4"
                  style={{ animation: `fade-in-up 0.4s ease-out ${i * 0.08}s both` }}
                >
                  <div
                    className="glass-station"
                    style={{
                      width: 40, height: 40,
                      borderColor: isComplete ? 'var(--primary)' : isActive ? 'var(--secondary-container)' : 'var(--border)',
                      background: isComplete ? 'var(--primary)' : 'var(--surface-container-lowest)',
                    }}
                  >
                    <div
                      className="w-2.5 h-2.5 rounded"
                      style={{
                        background: isComplete ? 'var(--on-primary)' : isActive ? 'var(--secondary-container)' : 'var(--outline-variant)',
                        borderRadius: isComplete ? '50%' : 3,
                        ...(isActive ? { animation: 'pulse-dot 1.5s ease-in-out infinite' } : {}),
                      }}
                    />
                  </div>
                  <div>
                    <span
                      className="mono-label"
                      style={{
                        fontSize: 11,
                        color: isComplete ? 'var(--primary)' : isActive ? 'var(--secondary)' : 'var(--outline)',
                      }}
                    >
                      PHASE {p.id}: {p.label}
                    </span>
                    <span className="mono-clock ml-2" style={{ color: 'var(--outline-variant)', fontSize: 10 }}>{p.short}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  AGENT SHOWCASE                                               */}
      {/* ============================================================ */}
      <section className="py-24 px-8">
        <div className="max-w-[1200px] mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-headline font-semibold mb-2" style={{ color: 'var(--on-surface)' }}>
              Agent Team
            </h2>
            <p className="mono-clock" style={{ color: 'var(--outline)' }}>
              8 autonomous agents driving the research pipeline
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {AGENTS.map((a, i) => (
              <div
                key={a.key}
                className="glass-card glass-card-hover text-center"
                style={{ animation: `fade-in-up 0.4s ease-out ${0.06 * i}s both` }}
              >
                <div className="text-3xl mb-3">{a.emoji}</div>
                <div className="font-semibold text-sm mb-0.5" style={{ color: 'var(--on-surface)' }}>{a.name}</div>
                <div className="mono-clock mb-3" style={{ color: 'var(--outline)', fontSize: 11 }}>{a.role}</div>
                <div className="flex items-center justify-center gap-1.5">
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ background: '#16a34a', animation: 'online-blink 2.5s ease-in-out infinite' }}
                  />
                  <span className="mono-label" style={{ color: '#16a34a', fontSize: 10 }}>ONLINE</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  FOOTER                                                       */}
      {/* ============================================================ */}
      <footer className="py-10 px-8" style={{ borderTop: '1px solid var(--border)' }}>
        <div className="max-w-[1600px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row items-center gap-3 text-body-sm" style={{ color: 'var(--outline)' }}>
            <span className="font-semibold" style={{ color: 'var(--primary)' }}>GFM Labs</span>
            <span className="hidden sm:inline" style={{ color: 'var(--outline-variant)' }}>&middot;</span>
            <span>Yonsei Smart Grid Lab</span>
            <span className="hidden sm:inline" style={{ color: 'var(--outline-variant)' }}>&middot;</span>
            <span>IEEE Access Target</span>
          </div>
          <div className="flex items-center gap-4 mono-clock" style={{ color: 'var(--outline-variant)', fontSize: 12 }}>
            <span>React + Flask + Firebase</span>
            <a href="#" className="flex items-center gap-1 transition-colors" style={{ color: 'var(--outline)' }}>
              GitHub <ExternalLink size={12} />
            </a>
          </div>
        </div>
      </footer>

      {/* Feature Config Panel */}
      {selectedFeature && (
        <FeatureConfigPanel
          feature={selectedFeature}
          onClose={() => setSelectedFeature(null)}
        />
      )}
    </div>
  );
}
