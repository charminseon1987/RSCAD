import { useRef, useMemo, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, Text, MeshTransmissionMaterial, Environment, Stars } from '@react-three/drei';
import * as THREE from 'three';
import { Link } from 'react-router-dom';
import { ArrowRight, Cpu, Zap, RefreshCw, Layers, Monitor, GitBranch } from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Z-Anime 3D Style Keyframes                                        */
/* ------------------------------------------------------------------ */
const KEYFRAMES = `
@keyframes glow-pulse {
  0%, 100% { opacity: 0.6; filter: blur(20px); }
  50% { opacity: 1; filter: blur(30px); }
}
@keyframes fade-in-up {
  from { opacity: 0; transform: translateY(32px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes slide-in-left {
  from { opacity: 0; transform: translateX(-40px); }
  to { opacity: 1; transform: translateX(0); }
}
@keyframes slide-in-right {
  from { opacity: 0; transform: translateX(40px); }
  to { opacity: 1; transform: translateX(0); }
}
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
@keyframes energy-flow {
  0% { stroke-dashoffset: 40; }
  100% { stroke-dashoffset: 0; }
}
@keyframes float-slow {
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-10px); }
}
@keyframes rotate-glow {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
@keyframes border-glow {
  0%, 100% { border-color: rgba(99, 102, 241, 0.3); }
  50% { border-color: rgba(99, 102, 241, 0.7); }
}
`;

/* ------------------------------------------------------------------ */
/*  3D Scene Components                                                */
/* ------------------------------------------------------------------ */

/** Animated wireframe cube representing RSCAD legacy model */
function LegacyCube({ position }: { position: [number, number, number] }) {
  const ref = useRef<THREE.Mesh>(null!);
  useFrame((_, delta) => {
    ref.current.rotation.x += delta * 0.3;
    ref.current.rotation.y += delta * 0.2;
  });
  return (
    <mesh ref={ref} position={position}>
      <boxGeometry args={[1.2, 1.2, 1.2]} />
      <meshStandardMaterial color="#6366f1" wireframe opacity={0.8} transparent />
    </mesh>
  );
}

/** Glowing sphere representing RSCAD FX new model */
function FXSphere({ position }: { position: [number, number, number] }) {
  const ref = useRef<THREE.Mesh>(null!);
  useFrame((state) => {
    ref.current.scale.setScalar(1 + Math.sin(state.clock.elapsedTime * 2) * 0.08);
  });
  return (
    <Float speed={2} rotationIntensity={0.5} floatIntensity={0.5}>
      <mesh ref={ref} position={position}>
        <icosahedronGeometry args={[0.9, 3]} />
        <MeshTransmissionMaterial
          color="#06b6d4"
          thickness={0.5}
          roughness={0.1}
          transmission={0.9}
          ior={1.5}
          chromaticAberration={0.06}
          backside
        />
      </mesh>
    </Float>
  );
}

/** Animated particle ring — conversion energy flow */
function ConversionRing() {
  const ref = useRef<THREE.Points>(null!);
  const count = 200;

  const positions = useMemo(() => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const r = 2.5 + Math.random() * 0.3;
      pos[i * 3] = Math.cos(angle) * r;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 0.5;
      pos[i * 3 + 2] = Math.sin(angle) * r;
    }
    return pos;
  }, []);

  const colors = useMemo(() => {
    const col = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const t = i / count;
      // Gradient from indigo to cyan
      col[i * 3] = 0.39 + t * (-0.39 + 0.02);     // R
      col[i * 3 + 1] = 0.40 + t * (-0.40 + 0.71);  // G
      col[i * 3 + 2] = 0.95 + t * (-0.95 + 0.83);  // B
    }
    return col;
  }, []);

  useFrame((_, delta) => {
    ref.current.rotation.y += delta * 0.4;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.06} vertexColors transparent opacity={0.9} sizeAttenuation />
    </points>
  );
}

/** Arrow beam — data conversion flow from legacy to FX */
function ConversionBeam() {
  const ref = useRef<THREE.Mesh>(null!);
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    ref.current.material = ref.current.material as THREE.MeshStandardMaterial;
    (ref.current.material as THREE.MeshStandardMaterial).emissiveIntensity =
      0.5 + Math.sin(t * 3) * 0.3;
  });
  return (
    <mesh ref={ref} position={[0, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
      <cylinderGeometry args={[0.02, 0.02, 3.5, 8]} />
      <meshStandardMaterial color="#a78bfa" emissive="#a78bfa" emissiveIntensity={0.5} transparent opacity={0.7} />
    </mesh>
  );
}

/** 3D Labels */
function SceneLabels() {
  return (
    <>
      <Text position={[-2.2, 1.5, 0]} fontSize={0.28} color="#a5b4fc" anchorX="center" font="/fonts/Inter-Bold.woff">
        RSCAD Legacy
      </Text>
      <Text position={[2.2, 1.5, 0]} fontSize={0.28} color="#67e8f9" anchorX="center" font="/fonts/Inter-Bold.woff">
        RSCAD FX
      </Text>
      <Text position={[0, -1.8, 0]} fontSize={0.18} color="#94a3b8" anchorX="center" font="/fonts/Inter-Bold.woff">
        Conversion Pipeline
      </Text>
    </>
  );
}

/** Main 3D Scene */
function ConversionScene3D() {
  return (
    <Canvas
      camera={{ position: [0, 2, 6], fov: 45 }}
      style={{ height: '100%', width: '100%' }}
      gl={{ antialias: true, alpha: true }}
    >
      <color attach="background" args={['#0a0a1a']} />
      <ambientLight intensity={0.3} />
      <pointLight position={[-3, 3, 3]} intensity={1.5} color="#6366f1" />
      <pointLight position={[3, 3, 3]} intensity={1.5} color="#06b6d4" />
      <pointLight position={[0, -2, 2]} intensity={0.5} color="#a78bfa" />

      <Stars radius={50} depth={30} count={1500} factor={3} saturation={0.5} fade speed={1} />

      <LegacyCube position={[-2.2, 0, 0]} />
      <FXSphere position={[2.2, 0, 0]} />
      <ConversionBeam />
      <ConversionRing />
      <SceneLabels />

      <Environment preset="night" />
    </Canvas>
  );
}

/* ------------------------------------------------------------------ */
/*  Conversion Steps Data                                              */
/* ------------------------------------------------------------------ */
const STEPS = [
  {
    icon: Layers,
    title: 'Model Parsing',
    titleKr: '모델 파싱',
    desc: 'RSCAD Legacy .dft 파일에서 컴포넌트·와이어·파라미터 추출',
    color: 'from-indigo-500 to-indigo-600',
    glow: 'rgba(99,102,241,0.3)',
  },
  {
    icon: GitBranch,
    title: 'Topology Mapping',
    titleKr: '토폴로지 매핑',
    desc: '노드·브랜치 연결 구조를 FX 그래프 모델로 변환',
    color: 'from-violet-500 to-purple-600',
    glow: 'rgba(139,92,246,0.3)',
  },
  {
    icon: RefreshCw,
    title: 'Component Convert',
    titleKr: '컴포넌트 변환',
    desc: 'Legacy 블록을 FX 라이브러리 컴포넌트로 1:1 매핑',
    color: 'from-purple-500 to-fuchsia-600',
    glow: 'rgba(168,85,247,0.3)',
  },
  {
    icon: Cpu,
    title: 'Parameter Sync',
    titleKr: '파라미터 동기화',
    desc: '제어기 게인·필터 상수·정격값 자동 이전 + 검증',
    color: 'from-fuchsia-500 to-pink-600',
    glow: 'rgba(217,70,239,0.3)',
  },
  {
    icon: Zap,
    title: 'Simulation Test',
    titleKr: '시뮬레이션 검증',
    desc: 'FX 환경에서 CHIL/EMT 시뮬레이션 결과 비교 검증',
    color: 'from-cyan-500 to-blue-600',
    glow: 'rgba(6,182,212,0.3)',
  },
  {
    icon: Monitor,
    title: 'Dashboard Export',
    titleKr: '대시보드 연동',
    desc: '변환된 모델의 실시간 모니터링 대시보드 자동 생성',
    color: 'from-blue-500 to-indigo-600',
    glow: 'rgba(59,130,246,0.3)',
  },
];

/* ------------------------------------------------------------------ */
/*  Architecture Comparison                                            */
/* ------------------------------------------------------------------ */
const COMPARE = [
  { feature: 'GUI Framework', legacy: 'X11 / Motif', fx: 'Qt-based Modern UI' },
  { feature: 'Scripting', legacy: 'CScript', fx: 'Python / GFORTRAN' },
  { feature: 'Simulation', legacy: 'Single-rack', fx: 'Multi-rack Scalable' },
  { feature: 'Component Model', legacy: '.dft flat file', fx: 'Hierarchical .json' },
  { feature: 'Control System', legacy: 'Separate TSAT', fx: 'Integrated CBuilder FX' },
  { feature: 'Real-Time Link', legacy: 'GTAO / GTAI', fx: 'Aurora Protocol' },
];

/* ------------------------------------------------------------------ */
/*  Main Page Component                                                */
/* ------------------------------------------------------------------ */
export default function RscadFX() {
  const [hoveredStep, setHoveredStep] = useState<number | null>(null);

  return (
    <>
      <style>{KEYFRAMES}</style>
      <div className="min-h-screen bg-[#0a0a1a] text-white overflow-x-hidden">

        {/* ============================================================ */}
        {/*  HERO — 3D Scene                                             */}
        {/* ============================================================ */}
        <section className="relative h-screen">
          {/* 3D Canvas */}
          <div className="absolute inset-0">
            <ConversionScene3D />
          </div>

          {/* Gradient overlays */}
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#0a0a1a] pointer-events-none" />
          <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-[#0a0a1a]/60 to-transparent pointer-events-none" />

          {/* Glow orbs (Z-Anime style) */}
          <div
            className="absolute top-1/4 left-1/4 w-64 h-64 rounded-full bg-indigo-500/20 pointer-events-none"
            style={{ animation: 'glow-pulse 4s ease-in-out infinite', filter: 'blur(60px)' }}
          />
          <div
            className="absolute top-1/3 right-1/4 w-48 h-48 rounded-full bg-cyan-400/20 pointer-events-none"
            style={{ animation: 'glow-pulse 5s ease-in-out 1s infinite', filter: 'blur(50px)' }}
          />

          {/* Hero text overlay */}
          <div className="absolute inset-0 flex items-end justify-center pb-24 pointer-events-none">
            <div className="text-center pointer-events-auto" style={{ animation: 'fade-in-up 1s ease-out both' }}>
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-sm text-indigo-300 font-mono mb-6 backdrop-blur-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                Z-Anime 3D &middot; RTDS Technologies
              </div>
              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black tracking-tight leading-[0.9] mb-4">
                <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent">
                  RSCAD FX
                </span>
                <br />
                <span className="text-white/90 text-3xl sm:text-4xl lg:text-5xl font-bold">
                  Conversion R&D
                </span>
              </h1>
              <p className="text-sm sm:text-base text-gray-400 max-w-lg mx-auto mb-8">
                Legacy RSCAD 모델을 차세대 RSCAD FX 환경으로
                <br />
                자동 변환하는 연구개발 파이프라인
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <Link
                  to="/dashboard"
                  className="group inline-flex items-center gap-2 px-7 py-3.5 rounded-xl
                    bg-gradient-to-r from-indigo-600 to-cyan-600 text-white text-sm font-medium
                    hover:from-indigo-500 hover:to-cyan-500 transition-all duration-300
                    shadow-lg shadow-indigo-500/25"
                >
                  대시보드 열기
                  <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                </Link>
                <a
                  href="#pipeline"
                  className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl
                    bg-white/5 text-white/80 text-sm font-medium border border-white/10
                    hover:bg-white/10 hover:border-white/20 transition-all duration-300 backdrop-blur-sm"
                >
                  변환 파이프라인
                </a>
              </div>
            </div>
          </div>

          {/* Scroll indicator */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-gray-500">
            <span className="text-sm font-mono">scroll</span>
            <div className="w-px h-8 bg-gradient-to-b from-indigo-400/50 to-transparent" />
          </div>
        </section>

        {/* ============================================================ */}
        {/*  CONVERSION PIPELINE STEPS                                   */}
        {/* ============================================================ */}
        <section id="pipeline" className="py-28 px-6 relative">
          {/* Background glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-indigo-500/5 pointer-events-none" style={{ filter: 'blur(100px)' }} />

          <div className="max-w-6xl mx-auto relative z-10">
            <h2
              className="text-3xl font-bold mb-2 text-center bg-gradient-to-r from-indigo-300 to-cyan-300 bg-clip-text text-transparent"
              style={{ animation: 'fade-in-up 0.6s ease-out both' }}
            >
              Conversion Pipeline
            </h2>
            <p className="text-gray-500 text-center mb-16 text-sm font-mono">
              6-step RSCAD → RSCAD FX automated conversion
            </p>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {STEPS.map((step, i) => {
                const Icon = step.icon;
                const isHovered = hoveredStep === i;
                return (
                  <div
                    key={step.title}
                    className="group relative rounded-2xl border border-white/[0.06] bg-white/[0.02] p-7
                      hover:border-white/[0.15] hover:bg-white/[0.04]
                      transition-all duration-500 backdrop-blur-sm cursor-default"
                    style={{
                      animation: `fade-in-up 0.5s ease-out ${0.1 * i}s both`,
                      boxShadow: isHovered ? `0 0 40px ${step.glow}` : 'none',
                    }}
                    onMouseEnter={() => setHoveredStep(i)}
                    onMouseLeave={() => setHoveredStep(null)}
                  >
                    {/* Step number */}
                    <div className="absolute top-4 right-4 text-sm font-mono text-white/10 group-hover:text-white/20 transition-colors">
                      {String(i + 1).padStart(2, '0')}
                    </div>

                    {/* Icon */}
                    <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${step.color} flex items-center justify-center mb-5
                      shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                      <Icon size={18} className="text-white" />
                    </div>

                    <h3 className="font-semibold text-sm mb-0.5 text-white/90">{step.title}</h3>
                    <p className="text-sm text-indigo-300/60 mb-2 font-mono">{step.titleKr}</p>
                    <p className="text-sm text-gray-500 leading-relaxed">{step.desc}</p>

                    {/* Connection line to next step */}
                    {i < STEPS.length - 1 && i % 3 !== 2 && (
                      <div className="hidden lg:block absolute top-1/2 -right-3 w-6 h-px">
                        <svg width="24" height="2" viewBox="0 0 24 2">
                          <line x1="0" y1="1" x2="24" y2="1" stroke="rgba(99,102,241,0.2)" strokeWidth="1"
                            strokeDasharray="4 3" style={{ animation: 'energy-flow 1.5s linear infinite' }} />
                        </svg>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ============================================================ */}
        {/*  ARCHITECTURE COMPARISON                                     */}
        {/* ============================================================ */}
        <section className="py-24 px-6 relative">
          <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full bg-cyan-500/5 pointer-events-none" style={{ filter: 'blur(80px)' }} />

          <div className="max-w-4xl mx-auto relative z-10">
            <h2
              className="text-2xl font-bold mb-2 text-center bg-gradient-to-r from-purple-300 to-pink-300 bg-clip-text text-transparent"
            >
              Architecture Comparison
            </h2>
            <p className="text-gray-500 text-center mb-14 text-sm font-mono">
              RSCAD Legacy vs RSCAD FX
            </p>

            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm overflow-hidden">
              {/* Header */}
              <div className="grid grid-cols-3 gap-0 text-sm font-mono border-b border-white/[0.06]">
                <div className="px-6 py-4 text-gray-500">Feature</div>
                <div className="px-6 py-4 text-indigo-400 border-l border-white/[0.06]">RSCAD Legacy</div>
                <div className="px-6 py-4 text-cyan-400 border-l border-white/[0.06]">RSCAD FX</div>
              </div>

              {/* Rows */}
              {COMPARE.map((row, i) => (
                <div
                  key={row.feature}
                  className="grid grid-cols-3 gap-0 text-sm border-b border-white/[0.03] last:border-0
                    hover:bg-white/[0.02] transition-colors"
                  style={{ animation: `fade-in-up 0.4s ease-out ${0.06 * i}s both` }}
                >
                  <div className="px-6 py-3.5 text-gray-400 font-medium text-sm">{row.feature}</div>
                  <div className="px-6 py-3.5 text-gray-500 text-sm border-l border-white/[0.06] font-mono">
                    {row.legacy}
                  </div>
                  <div className="px-6 py-3.5 text-cyan-300/80 text-sm border-l border-white/[0.06] font-mono flex items-center gap-2">
                    <span className="w-1 h-1 rounded-full bg-cyan-400 flex-shrink-0" />
                    {row.fx}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ============================================================ */}
        {/*  RSCAD FX FEATURES — 3D Card Grid                           */}
        {/* ============================================================ */}
        <section className="py-24 px-6 relative">
          <div className="absolute top-1/2 left-0 w-[500px] h-[500px] rounded-full bg-purple-500/5 pointer-events-none" style={{ filter: 'blur(100px)' }} />

          <div className="max-w-5xl mx-auto relative z-10">
            <h2 className="text-2xl font-bold mb-2 text-center bg-gradient-to-r from-indigo-300 to-cyan-300 bg-clip-text text-transparent">
              RSCAD FX Key Features
            </h2>
            <p className="text-gray-500 text-center mb-14 text-sm font-mono">
              Next-generation real-time simulation platform
            </p>

            <div className="grid md:grid-cols-2 gap-5">
              {[
                {
                  title: 'Hierarchical Modeling',
                  desc: '서브시스템 단위 계층적 모델링으로 대규모 전력계통 구현. 재사용 가능한 컴포넌트 라이브러리 지원.',
                  gradient: 'from-indigo-500/10 to-purple-500/10',
                  border: 'hover:border-indigo-500/30',
                  icon: '🏗️',
                },
                {
                  title: 'Python Scripting',
                  desc: 'CScript 대신 Python 기반 자동화. 배치 시뮬레이션·파라미터 스윕·결과 분석 스크립트 작성.',
                  gradient: 'from-cyan-500/10 to-blue-500/10',
                  border: 'hover:border-cyan-500/30',
                  icon: '🐍',
                },
                {
                  title: 'Multi-Rack Scalability',
                  desc: '여러 RTDS 랙에 걸친 대규모 시뮬레이션. NovaCor 프로세서 카드와 Aurora 고속 링크 지원.',
                  gradient: 'from-purple-500/10 to-pink-500/10',
                  border: 'hover:border-purple-500/30',
                  icon: '🔗',
                },
                {
                  title: 'CHIL Integration',
                  desc: 'Controller-Hardware-in-the-Loop 실시간 연동. GFM 인버터 제어기 검증 및 최적화.',
                  gradient: 'from-emerald-500/10 to-cyan-500/10',
                  border: 'hover:border-emerald-500/30',
                  icon: '⚡',
                },
              ].map((card, i) => (
                <div
                  key={card.title}
                  className={`rounded-2xl border border-white/[0.06] bg-gradient-to-br ${card.gradient}
                    p-8 ${card.border} transition-all duration-500 backdrop-blur-sm
                    hover:shadow-xl group`}
                  style={{ animation: `fade-in-up 0.5s ease-out ${0.12 * i}s both` }}
                >
                  <span className="text-3xl mb-4 block" style={{ animation: 'float-slow 3s ease-in-out infinite' }}>
                    {card.icon}
                  </span>
                  <h3 className="font-bold text-lg mb-2 text-white/90 group-hover:text-white transition-colors">
                    {card.title}
                  </h3>
                  <p className="text-sm text-gray-400 leading-relaxed">{card.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ============================================================ */}
        {/*  CTA                                                         */}
        {/* ============================================================ */}
        <section className="py-20 px-6">
          <div className="max-w-3xl mx-auto text-center">
            <div className="rounded-3xl border border-white/[0.06] bg-gradient-to-br from-indigo-500/5 to-cyan-500/5 p-12 backdrop-blur-sm relative overflow-hidden">
              {/* Rotating glow */}
              <div
                className="absolute -top-20 -right-20 w-40 h-40 rounded-full bg-indigo-500/10 pointer-events-none"
                style={{ animation: 'rotate-glow 8s linear infinite', filter: 'blur(40px)' }}
              />
              <h2 className="text-2xl font-bold mb-3 text-white/90">
                GFM Labs와 함께 RSCAD FX 전환
              </h2>
              <p className="text-sm text-gray-400 mb-8 max-w-md mx-auto">
                22-state 소신호 모델 기반 GFM 인버터 안정도 분석을
                <br />
                RSCAD FX 환경에서 실시간으로 검증하세요
              </p>
              <Link
                to="/lab"
                className="group inline-flex items-center gap-2 px-8 py-4 rounded-xl
                  bg-gradient-to-r from-indigo-600 to-cyan-600 text-white text-sm font-medium
                  hover:from-indigo-500 hover:to-cyan-500 transition-all duration-300
                  shadow-lg shadow-indigo-500/25"
              >
                실험실에서 시작하기
                <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </div>
        </section>

        {/* ============================================================ */}
        {/*  FOOTER                                                       */}
        {/* ============================================================ */}
        <footer className="border-t border-white/[0.06] py-10 px-6">
          <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-500">
            <div className="flex items-center gap-2">
              <span className="font-bold bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
                GFM Labs
              </span>
              <span className="text-gray-700">&middot;</span>
              <span>RSCAD FX Conversion R&D</span>
            </div>
            <div className="flex items-center gap-4 text-gray-600">
              <span>RTDS Technologies</span>
              <span className="text-gray-700">&middot;</span>
              <span>Yonsei Smart Grid Lab</span>
            </div>
          </div>
        </footer>

        {/* 발표 순서 — 앞은 Landing. 발표 중 되돌아갈 수 있게 */}
        <Link to="/present/landing"
          className="fixed bottom-6 right-6 z-[90] flex items-center gap-2 px-4 py-2.5 rounded-full text-[14px] font-medium tracking-wide transition-all duration-200
                     bg-white/10 text-white border border-white/20 backdrop-blur hover:bg-white/20">
          ← 이전 — Landing
        </Link>
      </div>
    </>
  );
}
