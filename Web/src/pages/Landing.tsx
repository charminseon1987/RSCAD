import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Cpu, Grid3x3, Crosshair, Zap, Bot, Activity,
  ArrowRight, ExternalLink, ChevronRight, X, Save, RotateCcw,
} from 'lucide-react';
import { fetchJSON, postJSON } from '../lib/api';

/* ------------------------------------------------------------------ */
/*  CSS-only animations                                                */
/* ------------------------------------------------------------------ */
const KEYFRAMES = `
@keyframes float {
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-20px); }
}
@keyframes float-slow {
  0%, 100% { transform: translateY(0px) translateX(0px); }
  33% { transform: translateY(-12px) translateX(6px); }
  66% { transform: translateY(4px) translateX(-8px); }
}
@keyframes pulse-dot {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 1; }
}
@keyframes fade-in-up {
  from { opacity: 0; transform: translateY(32px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes online-blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
@keyframes slide-right {
  from { transform: translateX(-8px); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}
@keyframes slide-in-right {
  from { transform: translateX(100%); }
  to { transform: translateX(0); }
}
@keyframes scene-rotate {
  0% { transform: rotateX(55deg) rotateZ(-10deg); }
  50% { transform: rotateX(55deg) rotateZ(10deg); }
  100% { transform: rotateX(55deg) rotateZ(-10deg); }
}
@keyframes sine-wave {
  0% { stroke-dashoffset: 0; }
  100% { stroke-dashoffset: -160; }
}
@keyframes energy-pulse {
  0%, 100% { opacity: 0.15; transform: scale(1); }
  50% { opacity: 0.4; transform: scale(1.15); }
}
@keyframes node-glow {
  0%, 100% { box-shadow: 0 0 8px rgba(16,185,129,0.3); }
  50% { box-shadow: 0 0 20px rgba(16,185,129,0.6); }
}
@keyframes grid-line-flow {
  0% { stroke-dashoffset: 40; }
  100% { stroke-dashoffset: 0; }
}
`;

/* ------------------------------------------------------------------ */
/*  Static data                                                        */
/* ------------------------------------------------------------------ */
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
      { key: 'real_range',  label: 'Re(λ) 범위',     type: 'range', min: -500, max: 100, step: 10, defaultValue: -200, help: '실수부 표시 범위' },
      { key: 'imag_range',  label: 'Im(λ) 범위',     type: 'range', min: 0, max: 5000, step: 100, defaultValue: 2000, help: '허수부 표시 범위' },
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
      { key: 'dt',          label: '시간 스텝',       type: 'number', unit: 'μs', min: 1, max: 100, step: 1, defaultValue: 50 },
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
/*  3D GFM Inverter Scene (CSS 3D + SVG)                               */
/*  GFM: 외부 전력망에 의존하지 않고 스스로 전압/주파수를 생성하는       */
/*  차세대 인버터 — 중앙 인버터에서 사인파가 방사되는 모습              */
/* ------------------------------------------------------------------ */
function GFMScene() {
  // 사인파 경로 생성 (SVG path)
  const sinePath = (amp: number, freq: number, phase: number, len: number) => {
    const pts: string[] = [];
    for (let x = 0; x <= len; x += 2) {
      const y = amp * Math.sin((x / len) * Math.PI * 2 * freq + phase);
      pts.push(`${x === 0 ? 'M' : 'L'}${x},${50 + y}`);
    }
    return pts.join(' ');
  };

  // 전력선 — 인버터에서 그리드 노드로 뻗어나가는 선
  const GRID_LINES = [
    { x2: 180, y2: 30 },
    { x2: 200, y2: 120 },
    { x2: 170, y2: 210 },
    { x2: -40, y2: 20 },
    { x2: -60, y2: 130 },
    { x2: -30, y2: 220 },
  ];

  return (
    <div className="relative w-full" style={{ height: 380, perspective: '900px' }}>
      {/* 3D 회전 무대 */}
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{
          transformStyle: 'preserve-3d',
          animation: 'scene-rotate 20s ease-in-out infinite',
        }}
      >
        {/* 바닥 그리드 */}
        <div
          className="absolute"
          style={{
            width: 320, height: 320,
            transform: 'translateZ(-60px)',
          }}
        >
          <svg width="320" height="320" viewBox="0 0 320 320">
            {Array.from({ length: 9 }, (_, i) => (
              <line key={`gh${i}`} x1="0" y1={i * 40} x2="320" y2={i * 40}
                stroke="rgba(0,0,0,0.06)" strokeWidth="0.5"
                strokeDasharray="4 4"
                style={{ animation: `grid-line-flow 3s linear ${i * 0.2}s infinite` }} />
            ))}
            {Array.from({ length: 9 }, (_, i) => (
              <line key={`gv${i}`} x1={i * 40} y1="0" x2={i * 40} y2="320"
                stroke="rgba(0,0,0,0.06)" strokeWidth="0.5"
                strokeDasharray="4 4" />
            ))}
          </svg>
        </div>

        {/* 중앙 인버터 본체 */}
        <div
          className="absolute rounded-2xl bg-gray-900 border border-gray-200"
          style={{
            width: 72, height: 72,
            left: 'calc(50% - 36px)', top: 'calc(50% - 36px)',
            transform: 'translateZ(20px)',
            boxShadow: '0 8px 40px rgba(0,0,0,0.15)',
          }}
        >
          <div className="w-full h-full flex flex-col items-center justify-center">
            <span className="text-white text-lg font-black leading-none">GFM</span>
            <span className="text-gray-400 text-[8px] font-mono mt-1">inverter</span>
          </div>
        </div>

        {/* 에너지 방사 링 */}
        {[1, 2, 3].map(ring => (
          <div
            key={ring}
            className="absolute rounded-full border border-emerald-400"
            style={{
              width: 72 + ring * 60, height: 72 + ring * 60,
              left: `calc(50% - ${(72 + ring * 60) / 2}px)`,
              top: `calc(50% - ${(72 + ring * 60) / 2}px)`,
              transform: 'translateZ(10px)',
              animation: `energy-pulse ${2 + ring * 0.5}s ease-in-out ${ring * 0.4}s infinite`,
            }}
          />
        ))}

        {/* 전력선 + 그리드 노드 */}
        <svg
          className="absolute"
          width="320" height="260"
          viewBox="-80 -10 320 260"
          style={{
            left: 'calc(50% - 160px)', top: 'calc(50% - 130px)',
            transform: 'translateZ(15px)',
          }}
        >
          {GRID_LINES.map((g, i) => (
            <line key={i} x1="80" y1="120" x2={80 + g.x2} y2={g.y2}
              stroke="rgba(16,185,129,0.25)" strokeWidth="1.5"
              strokeDasharray="6 4"
              style={{ animation: `grid-line-flow 2s linear ${i * 0.3}s infinite` }}
            />
          ))}
          {/* 노드 점 */}
          {GRID_LINES.map((g, i) => (
            <circle key={`n${i}`} cx={80 + g.x2} cy={g.y2} r="5"
              fill="white" stroke="rgba(16,185,129,0.6)" strokeWidth="2">
              <animate attributeName="r" values="4;6;4" dur={`${2 + i * 0.3}s`} repeatCount="indefinite" />
            </circle>
          ))}
          {/* 중앙 점 */}
          <circle cx="80" cy="120" r="7" fill="rgba(16,185,129,0.9)">
            <animate attributeName="r" values="6;9;6" dur="2s" repeatCount="indefinite" />
          </circle>
        </svg>
      </div>

      {/* 전경: 사인파 오버레이 (2D, 3D 회전 밖) */}
      <div className="absolute bottom-0 left-0 right-0 h-28 pointer-events-none overflow-hidden">
        <svg width="100%" height="100" viewBox="0 0 400 100" preserveAspectRatio="none" className="opacity-40">
          {/* 전압 파형 — V */}
          <path d={sinePath(20, 3, 0, 400)} fill="none" stroke="#0f172a" strokeWidth="1.5"
            strokeDasharray="160" style={{ animation: 'sine-wave 3s linear infinite' }} />
          {/* 주파수 파형 — f */}
          <path d={sinePath(14, 5, 1.2, 400)} fill="none" stroke="rgba(16,185,129,0.6)" strokeWidth="1"
            strokeDasharray="160" style={{ animation: 'sine-wave 2.4s linear infinite' }} />
        </svg>
        <div className="absolute bottom-2 left-4 flex gap-4 text-[10px] font-mono text-gray-400">
          <span><span className="inline-block w-3 h-px bg-gray-900 mr-1 align-middle" />V(t)</span>
          <span><span className="inline-block w-3 h-px bg-emerald-500 mr-1 align-middle" />f(t) = 60 Hz</span>
        </div>
      </div>

      {/* 레이블 */}
      <div className="absolute top-3 right-4 text-[10px] font-mono text-gray-300 text-right leading-relaxed">
        <div>Standalone V &amp; f Generation</div>
        <div className="text-emerald-500">No Grid Reference Needed</div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Dot background pattern (light)                                     */
/* ------------------------------------------------------------------ */
function GridBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="grid-dots" width="40" height="40" patternUnits="userSpaceOnUse">
            <circle cx="20" cy="20" r="0.8" fill="rgba(0,0,0,0.08)" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid-dots)" />
      </svg>
      <div
        className="absolute w-[600px] h-[600px] rounded-full opacity-[0.04]"
        style={{
          background: 'radial-gradient(circle, rgba(59,130,246,0.6), transparent 70%)',
          top: '-10%', left: '-10%',
          animation: 'float 8s ease-in-out infinite',
        }}
      />
      <div
        className="absolute w-[500px] h-[500px] rounded-full opacity-[0.03]"
        style={{
          background: 'radial-gradient(circle, rgba(15,23,42,0.4), transparent 70%)',
          bottom: '-15%', right: '-5%',
          animation: 'float 10s ease-in-out 2s infinite',
        }}
      />
    </div>
  );
}

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
  // initialise form values from defaults
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
      // server may be offline — persist locally
      localStorage.setItem(
        `gfm_config_${feature.title}`,
        JSON.stringify(values),
      );
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
        className="fixed inset-0 z-[100] bg-black/30 backdrop-blur-sm"
        style={{ animation: 'fade-in-up 0.2s ease-out both' }}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className="fixed top-0 right-0 z-[101] h-full w-full max-w-md bg-white shadow-2xl
          flex flex-col overflow-hidden"
        style={{ animation: 'slide-in-right 0.3s ease-out both' }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-gray-100">
          <div className="w-9 h-9 rounded-xl bg-gray-900 flex items-center justify-center flex-shrink-0">
            <Icon size={16} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-sm text-gray-900 truncate">{feature.title}</h3>
            <p className="text-[11px] text-gray-400 truncate">{feature.desc}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400
              hover:bg-gray-100 hover:text-gray-600 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Params */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {feature.params.map(p => (
            <div key={p.key}>
              <label className="flex items-baseline gap-2 mb-1.5">
                <span className="text-xs font-medium text-gray-700">{p.label}</span>
                {p.unit && <span className="text-[10px] text-gray-400 font-mono">({p.unit})</span>}
              </label>

              {p.help && (
                <p className="text-[10px] text-gray-400 mb-1.5 leading-relaxed">{p.help}</p>
              )}

              {/* Number input */}
              {p.type === 'number' && (
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={p.min}
                    max={p.max}
                    step={p.step}
                    value={values[p.key] as number}
                    onChange={e => set(p.key, Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50
                      text-sm font-mono text-gray-900
                      focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-300
                      transition-all"
                  />
                  {p.min != null && p.max != null && (
                    <span className="text-[10px] text-gray-300 font-mono whitespace-nowrap">
                      {p.min}–{p.max}
                    </span>
                  )}
                </div>
              )}

              {/* Range slider */}
              {p.type === 'range' && (
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={p.min}
                    max={p.max}
                    step={p.step}
                    value={values[p.key] as number}
                    onChange={e => set(p.key, Number(e.target.value))}
                    className="flex-1 accent-gray-900"
                  />
                  <span className="text-xs font-mono text-gray-600 w-14 text-right">
                    {values[p.key]}
                  </span>
                </div>
              )}

              {/* Select dropdown */}
              {p.type === 'select' && (
                <select
                  value={values[p.key] as string}
                  onChange={e => set(p.key, e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50
                    text-sm font-mono text-gray-900
                    focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-300
                    transition-all appearance-none cursor-pointer"
                >
                  {p.options!.map(o => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              )}

              {/* Text input */}
              {p.type === 'text' && (
                <input
                  type="text"
                  value={values[p.key] as string}
                  onChange={e => set(p.key, e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50
                    text-sm text-gray-900
                    focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-300
                    transition-all"
                />
              )}

              {/* Toggle switch */}
              {p.type === 'toggle' && (
                <button
                  onClick={() => set(p.key, !values[p.key])}
                  className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${
                    values[p.key] ? 'bg-emerald-500' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow
                      transition-transform duration-200 ${values[p.key] ? 'translate-x-5' : ''}`}
                  />
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Footer actions */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center gap-3">
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-medium
              text-gray-500 hover:bg-gray-100 transition-colors"
          >
            <RotateCcw size={13} />
            초기화
          </button>
          <div className="flex-1" />
          <button
            onClick={handleSave}
            disabled={saving}
            className={`flex items-center gap-1.5 px-6 py-2.5 rounded-xl text-xs font-medium
              transition-all duration-200 ${
                saved
                  ? 'bg-emerald-500 text-white'
                  : 'bg-gray-900 text-white hover:bg-gray-800'
              }`}
          >
            <Save size={13} />
            {saving ? '저장 중...' : saved ? '저장 완료!' : '저장'}
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

  const statusDot = (s: string) =>
    s === 'complete' ? 'bg-emerald-500' : s === 'active' || s === 'in_progress' ? 'bg-amber-500' : 'bg-gray-300';
  const statusRing = (s: string) =>
    s === 'complete' ? 'ring-emerald-200' : s === 'active' || s === 'in_progress' ? 'ring-amber-200' : 'ring-gray-200';
  const statusLabel = (s: string) =>
    s === 'complete' ? 'text-emerald-600' : s === 'active' || s === 'in_progress' ? 'text-amber-600' : 'text-gray-400';

  return (
    <>
      <style>{KEYFRAMES}</style>
      <div className="relative min-h-screen bg-white text-gray-900 overflow-x-hidden">

        {/* ============================================================ */}
        {/*  HERO                                                        */}
        {/* ============================================================ */}
        <section className="relative min-h-screen flex items-center justify-center px-6">
          <GridBackground />

          <div className="relative z-10 max-w-6xl mx-auto w-full grid lg:grid-cols-2 gap-16 items-center">
            {/* Left */}
            <div style={{ animation: 'fade-in-up 0.8s ease-out both' }}>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gray-100 text-xs text-gray-500 font-mono mb-8">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" style={{ animation: 'online-blink 2s ease-in-out infinite' }} />
                22-state small-signal model
              </div>

              <h1 className="text-6xl sm:text-7xl lg:text-8xl font-black tracking-tight leading-[0.9] mb-6">
                <span className="text-gray-900">GFM</span>
                <br />
                <span className="text-gray-900">Labs</span>
              </h1>

              <p className="text-lg text-gray-500 mb-1 tracking-wide">
                Grid-Forming Inverter Stability
              </p>
              <p className="text-sm text-gray-400 mb-10 font-mono">
                Small-Signal Analysis &middot; 22-State &middot; SCR\u2013X/R Boundary
              </p>

              <div className="flex flex-wrap gap-3">
                <Link
                  to="/dashboard"
                  className="group inline-flex items-center gap-2 px-7 py-3.5 rounded-xl
                    bg-gray-900 text-white text-sm font-medium
                    hover:bg-gray-800 transition-colors duration-200"
                >
                  대시보드 열기
                  <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                </Link>
                <Link
                  to="/lab"
                  className="group inline-flex items-center gap-2 px-7 py-3.5 rounded-xl
                    bg-white text-gray-900 text-sm font-medium
                    border border-gray-200 hover:border-gray-400 transition-colors duration-200"
                >
                  실험실
                  <ChevronRight size={16} className="text-gray-400 group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>
            </div>

            {/* Right: 3D GFM Inverter */}
            <div
              className="hidden lg:block max-w-md mx-auto w-full"
              style={{ animation: 'fade-in-up 1s ease-out 0.3s both' }}
            >
              <div className="rounded-2xl border border-gray-100 bg-gray-50/60 p-4 overflow-hidden">
                <GFMScene />
              </div>
            </div>
          </div>

          {/* Scroll indicator */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-gray-300">
            <span className="text-xs font-mono">scroll</span>
            <div className="w-px h-8 bg-gradient-to-b from-gray-300 to-transparent" />
          </div>
        </section>

        {/* ============================================================ */}
        {/*  FEATURE CARDS                                                */}
        {/* ============================================================ */}
        <section className="relative py-28 px-6 bg-gray-50">
          <div className="max-w-6xl mx-auto">
            <h2
              className="text-3xl font-bold mb-2 text-center text-gray-900"
              style={{ animation: 'fade-in-up 0.6s ease-out both' }}
            >
              Core Capabilities
            </h2>
            <p className="text-gray-400 text-center mb-16 text-sm font-mono">
              22-state GFM model &middot; stability analysis toolkit
            </p>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {FEATURES.map((f, i) => {
                const Icon = f.icon;
                return (
                  <div
                    key={f.title}
                    onClick={() => setSelectedFeature(f)}
                    className="group bg-white rounded-2xl border border-gray-100 p-7
                      hover:border-gray-300 hover:shadow-lg
                      transition-all duration-300 cursor-pointer"
                    style={{ animation: `fade-in-up 0.5s ease-out ${0.1 * i}s both` }}
                  >
                    <div className="w-10 h-10 rounded-xl bg-gray-900 flex items-center justify-center mb-5
                      group-hover:scale-110 transition-transform duration-300">
                      <Icon size={18} className="text-white" />
                    </div>
                    <h3 className="font-semibold text-sm mb-2 text-gray-900">{f.title}</h3>
                    <p className="text-xs text-gray-500 leading-relaxed mb-3">{f.desc}</p>
                    <span className="inline-flex items-center gap-1 text-[10px] font-mono text-gray-300
                      group-hover:text-gray-500 transition-colors">
                      <span className="w-1 h-1 rounded-full bg-emerald-400" />
                      {f.params.length}개 파라미터 설정
                      <ChevronRight size={10} className="group-hover:translate-x-0.5 transition-transform" />
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ============================================================ */}
        {/*  LIVE STATUS BAR                                              */}
        {/* ============================================================ */}
        <section className="py-6 px-6 bg-white">
          <div className="max-w-4xl mx-auto rounded-2xl border border-gray-100 bg-gray-50 px-6 py-4
            flex flex-wrap items-center gap-x-8 gap-y-3 text-xs font-mono">
            {healthError ? (
              <span className="text-gray-400 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-400 inline-block" />
                서버 오프라인
              </span>
            ) : !health ? (
              <span className="text-gray-300">connecting...</span>
            ) : (
              <>
                <span className="text-gray-500">
                  <span className="text-gray-300">model </span>
                  {health.model_version ?? 'v3'}
                </span>
                <span className="text-gray-500">
                  <span className="text-gray-300">states </span>
                  {health.n_states ?? 22}
                </span>
                <span className="text-gray-500">
                  <span className="text-gray-300">SCR </span>
                  {health.loaded_SCR ? `[${health.loaded_SCR.join(', ')}]` : '--'}
                </span>
                <span className="flex items-center gap-2">
                  <span
                    className={`w-2 h-2 rounded-full inline-block ${health.all_stable ? 'bg-emerald-500' : 'bg-red-400'}`}
                    style={{ animation: 'online-blink 2s ease-in-out infinite' }}
                  />
                  <span className={health.all_stable ? 'text-emerald-600' : 'text-red-500'}>
                    {health.all_stable ? 'all stable' : 'unstable'}
                  </span>
                </span>
              </>
            )}
          </div>
        </section>

        {/* ============================================================ */}
        {/*  RESEARCH PIPELINE                                            */}
        {/* ============================================================ */}
        <section className="py-24 px-6 bg-white">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-2xl font-bold mb-2 text-center text-gray-900">Research Pipeline</h2>
            <p className="text-gray-400 text-center mb-14 text-sm font-mono">
              6-phase systematic approach
            </p>

            {/* Desktop */}
            <div className="hidden md:flex items-center justify-center gap-0">
              {PHASES.map((p, i) => {
                const s = getPhaseStatus(p.id);
                return (
                  <div key={p.id} className="flex items-center" style={{ animation: `slide-right 0.4s ease-out ${i * 0.1}s both` }}>
                    <div className="flex flex-col items-center">
                      <div
                        className={`w-14 h-14 rounded-2xl flex items-center justify-center
                          ring-2 ${statusRing(s)} bg-white border border-gray-100 transition-all`}
                      >
                        <div className={`w-3 h-3 rounded-full ${statusDot(s)}`}
                          style={s === 'active' || s === 'in_progress' ? { animation: 'pulse-dot 1.5s ease-in-out infinite' } : {}}
                        />
                      </div>
                      <span className={`mt-2.5 text-[11px] font-mono font-semibold ${statusLabel(s)}`}>
                        {p.label}
                      </span>
                      <span className="text-[10px] text-gray-300">{p.short}</span>
                    </div>
                    {i < PHASES.length - 1 && (
                      <div className="w-12 h-px bg-gray-200 mx-1 mt-[-20px]" />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Mobile */}
            <div className="md:hidden space-y-3">
              {PHASES.map((p, i) => {
                const s = getPhaseStatus(p.id);
                return (
                  <div
                    key={p.id}
                    className="flex items-center gap-4"
                    style={{ animation: `fade-in-up 0.4s ease-out ${i * 0.08}s both` }}
                  >
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0
                        ring-2 ${statusRing(s)} bg-white border border-gray-100`}
                    >
                      <div className={`w-2.5 h-2.5 rounded-full ${statusDot(s)}`}
                        style={s === 'active' || s === 'in_progress' ? { animation: 'pulse-dot 1.5s ease-in-out infinite' } : {}}
                      />
                    </div>
                    <div>
                      <span className={`text-xs font-mono font-semibold ${statusLabel(s)}`}>
                        Phase {p.id}: {p.label}
                      </span>
                      <span className="text-[10px] text-gray-300 ml-2">{p.short}</span>
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
        <section className="py-24 px-6 bg-gray-50">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-2xl font-bold mb-2 text-center text-gray-900">Agent Team</h2>
            <p className="text-gray-400 text-center mb-14 text-sm font-mono">
              8 autonomous agents driving the research pipeline
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {AGENTS.map((a, i) => (
                <div
                  key={a.key}
                  className="bg-white rounded-2xl border border-gray-100 p-6 text-center
                    hover:border-gray-300 hover:shadow-md transition-all duration-300"
                  style={{ animation: `fade-in-up 0.4s ease-out ${0.06 * i}s both` }}
                >
                  <div className="text-3xl mb-3">{a.emoji}</div>
                  <div className="font-semibold text-sm text-gray-900 mb-0.5">{a.name}</div>
                  <div className="text-[11px] text-gray-400 mb-3">{a.role}</div>
                  <div className="flex items-center justify-center gap-1.5">
                    <span
                      className="w-1.5 h-1.5 rounded-full bg-emerald-500"
                      style={{ animation: 'online-blink 2.5s ease-in-out infinite' }}
                    />
                    <span className="text-[10px] text-emerald-500 font-mono">online</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ============================================================ */}
        {/*  FOOTER                                                       */}
        {/* ============================================================ */}
        <footer className="border-t border-gray-100 py-10 px-6 bg-white">
          <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-gray-400">
            <div className="flex flex-col sm:flex-row items-center gap-2">
              <span className="font-bold text-gray-900">GFM Labs</span>
              <span className="hidden sm:inline text-gray-200">&middot;</span>
              <span>Yonsei Smart Grid Lab</span>
              <span className="hidden sm:inline text-gray-200">&middot;</span>
              <span>IEEE Access Target</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-gray-300">React + Flask + Firebase</span>
              <a
                href="#"
                className="flex items-center gap-1 text-gray-400 hover:text-gray-900 transition-colors"
              >
                GitHub <ExternalLink size={12} />
              </a>
            </div>
          </div>
        </footer>
      </div>

      {/* Feature Config Panel */}
      {selectedFeature && (
        <FeatureConfigPanel
          feature={selectedFeature}
          onClose={() => setSelectedFeature(null)}
        />
      )}
    </>
  );
}
