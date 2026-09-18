import { useEffect, useState } from 'react';
import { fetchJSON } from '../lib/api';

const SECTIONS = [
  { id: 'I', title: 'Introduction', desc: 'GFM 필요성, 기존 한계, 차별화 4축', deps: ['claims/', 'literature/'], icon: '📖' },
  { id: 'II', title: 'System Model', desc: '22차 ODE, DC-AC 양방향 커플링, 상태변수 정의', deps: ['model.py', 'pf_export.py'], icon: '⚙️' },
  { id: 'III', title: 'Methodology', desc: 'PSO 다중운전점 + σ 기반 통합 지표', deps: ['metrics.py', 'pso.py'], icon: '🧮' },
  { id: 'IV', title: 'Results', desc: '2D 경계, EMT/SIL 검증, 가설 검정', deps: ['results/', 'P5 데이터'], icon: '📊' },
  { id: 'V', title: 'Conclusion', desc: '기여 요약, 한계, 향후 연구', deps: ['전체 완료'], icon: '🎯' },
];

const SKILLS = [
  { name: 'terminology-consistency', desc: '기호/용어 일관성 검사', color: 'blue' },
  { name: 'ieee-access-format-check', desc: 'IEEE Access 35항목 형식', color: 'green' },
  { name: 'citation-management', desc: '참고문헌 정확성', color: 'amber' },
  { name: 'academic-paper-reviewer', desc: '모의 심사', color: 'purple' },
  { name: 'obsidian-note-template', desc: '▸/※ 분리 검증', color: 'cyan' },
];

const METHODS = [
  { step: '①', title: '22차 소신호 모델 구축', status: 'done' },
  { step: '②', title: '다중 운전점 PSO 파라미터 최적화', status: 'active' },
  { step: '③', title: 'GFM 제어 전략 3종 통합 구현', status: 'pending' },
  { step: '④', title: 'RTDS Controller HIL / EMT SIL 검증', status: 'pending' },
];

export default function Paper() {
  const [notes, setNotes] = useState<any[]>([]);
  useEffect(() => {
    fetchJSON('/notes').then(d => setNotes((d.notes || []).filter((n: any) => n.category === 'literature'))).catch(() => {});
  }, []);

  const stepColor = (s: string) => s === 'done' ? 'border-green-500 bg-green-500/10' : s === 'active' ? 'border-amber-500 bg-amber-500/10' : 'border-gray-700 bg-gray-900/50';

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">
          ✍️ 논문 작성 — IEEE Access
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Grid-Forming 인버터 소신호 안정도 최적화: 다중 운전점 PSO와 DC-AC 커플링 모델링
        </p>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Methodology Pipeline */}
        <div className="col-span-12 glass p-5">
          <h2 className="text-sm font-semibold text-cyan-400 mb-4">방법론 4단계 + 3계층 검증</h2>
          <div className="grid grid-cols-4 gap-4">
            {METHODS.map(m => (
              <div key={m.step} className={`p-4 rounded-xl border-2 ${stepColor(m.status)} transition-all`}>
                <div className="text-2xl mb-2">{m.step}</div>
                <div className="text-sm font-medium text-gray-200">{m.title}</div>
                <div className={`text-[10px] mt-2 px-2 py-0.5 rounded-full inline-block ${
                  m.status === 'done' ? 'bg-green-500/30 text-green-400' :
                  m.status === 'active' ? 'bg-amber-500/30 text-amber-400' :
                  'bg-gray-800 text-gray-500'
                }`}>{m.status === 'done' ? '완료' : m.status === 'active' ? '진행 중' : '대기'}</div>
              </div>
            ))}
          </div>
          <div className="mt-3 text-xs text-gray-500">
            3계층 검증: Layer 1 소신호 → Layer 2 EMT 교차 → Layer 3 CHIL/SIL
          </div>
        </div>

        {/* Sections */}
        <div className="col-span-12 lg:col-span-8 space-y-4">
          <h2 className="text-sm font-semibold text-gray-400">논문 섹션 진행 상황</h2>
          {SECTIONS.map(s => (
            <div key={s.id} className="glass p-5 hover:border-gray-700 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{s.icon}</span>
                  <div>
                    <h3 className="text-sm font-semibold text-gray-200">§{s.id}. {s.title}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">{s.desc}</p>
                  </div>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-800 text-gray-500">pending</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {s.deps.map(d => (
                  <span key={d} className="text-[10px] px-2 py-0.5 rounded bg-gray-800 text-gray-500 font-mono">{d}</span>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Right: Skills + Literature */}
        <div className="col-span-12 lg:col-span-4 space-y-6">
          <div className="glass p-5">
            <h2 className="text-sm font-semibold text-purple-400 mb-3">🔧 품질 검사 도구</h2>
            <div className="space-y-2">
              {SKILLS.map(s => (
                <div key={s.name} className="p-3 rounded-xl bg-gray-900/50 border border-gray-800 hover:border-gray-700 transition cursor-pointer">
                  <div className="text-xs font-medium text-gray-300">{s.name}</div>
                  <div className="text-[10px] text-gray-500 mt-0.5">{s.desc}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="glass p-5">
            <h2 className="text-sm font-semibold text-gray-400 mb-3">📚 참고문헌 ({notes.length})</h2>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {notes.map(n => (
                <div key={n.path} className="text-xs p-2 rounded-lg bg-gray-900/50 border border-gray-800">
                  <div className="text-gray-300 truncate">{n.title}</div>
                  <div className="text-gray-600 mt-0.5 truncate">{n.path}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="glass p-5">
            <h2 className="text-sm font-semibold text-gray-400 mb-3">🎯 투고 체크리스트</h2>
            <div className="space-y-1.5 text-xs">
              {['Abstract ≤ 250 words', 'Index Terms 4~6개', 'Fig. 번호 연속', 'Ref ≥ 20개 (IEEE 형식)', 'Author Bio + ORCID', 'Data Availability', 'CC BY 4.0 명시'].map((item, i) => (
                <label key={i} className="flex items-center gap-2 text-gray-400 cursor-pointer hover:text-gray-200 transition">
                  <input type="checkbox" className="rounded border-gray-600 bg-gray-800 text-blue-500 focus:ring-blue-500/30" />
                  {item}
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
