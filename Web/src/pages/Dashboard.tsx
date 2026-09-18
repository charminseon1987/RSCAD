import { useEffect, useState } from 'react';
import { fetchJSON, postJSON } from '../lib/api';

// ── Types ──
interface Phase { id: string; name: string; status: string; artifacts: { id: string; name: string; state: string }[] }
interface Run { run_name: string; timestamp: string; XR: number; SCR_list: number[]; all_stable: boolean; zeta_min: number | null; is_active: boolean }
interface Note { name: string; title: string; category: string; path: string; mtime: number }
interface PlazaMsg { emoji: string; name: string; text: string; color: string; time: string }

const AGENTS = [
  { id: 'ceo', name: '연구소장', emoji: '🧭', role: 'Research Director', color: 'text-gray-100' },
  { id: 'developer', name: '시뮬엔지니어', emoji: '💻', role: 'Simulation', color: 'text-cyan-400' },
  { id: 'business', name: '검증판정자', emoji: '⚖️', role: 'Judge', color: 'text-yellow-400' },
  { id: 'secretary', name: '실험노트관리자', emoji: '📋', role: 'Notes', color: 'text-green-400' },
  { id: 'researcher', name: '문헌추적자', emoji: '📚', role: 'Literature', color: 'text-blue-400' },
  { id: 'writer', name: '논문작가', emoji: '✍️', role: 'Writer', color: 'text-amber-400' },
  { id: 'designer', name: '그림담당', emoji: '📊', role: 'Figures', color: 'text-purple-400' },
];

const RQS = [
  { id: 'RQ1', q: 'DC-AC 커플링이 약계통에서 어떤 지배 모드를 형성하며, 22차 모델은 12차 대비 유의하게 다르게 포착하는가?', status: 'active' },
  { id: 'RQ2', q: '다중 운전점 PSO는 단일 운전점 대비 더 낮은 임계 SCR*을 달성하는가?', status: 'pending' },
  { id: 'RQ3', q: 'SCR–X/R 2D 안정 경계는 단조적인가, 비단조적인가?', status: 'pending' },
];

const TODOS = [
  { text: 'P4-A1: PSO 14개 파라미터 탐색 범위 확정', done: false },
  { text: 'P5-A1: EMT 환경 선택 (PLECS/Simulink/DPsim)', done: false },
  { text: 'IEEE 2800 Clause 7.3 원문 대조', done: false },
  { text: 'P3-A6: ζ=0.64 출처 규명', done: true },
  { text: 'metrics.py objective_multi() 구현', done: true },
  { text: '에이전트 페르소나 7인 전환', done: true },
];

export default function Dashboard() {
  const [phases, setPhases] = useState<Phase[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [msgs, setMsgs] = useState<PlazaMsg[]>([
    { emoji: '🧭', name: '연구소장', text: 'GFM Labs에 오신 것을 환영합니다. 명령을 입력하세요.', color: 'text-gray-100', time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [health, setHealth] = useState<any>(null);

  useEffect(() => {
    fetchJSON('/health').then(setHealth).catch(() => {});
    fetchJSON('/schedule_status').then(d => d.phases && setPhases(d.phases)).catch(() => {});
    fetchJSON('/runs').then(d => d.runs && setRuns(d.runs.slice(-6).reverse())).catch(() => {});
    fetchJSON('/notes').then(d => d.notes && setNotes(d.notes.slice(0, 8))).catch(() => {});
  }, []);

  const sendCommand = async () => {
    if (!input.trim() || loading) return;
    const cmd = input.trim();
    setInput('');
    const now = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
    setMsgs(p => [...p, { emoji: '👤', name: '연구자', text: cmd, color: 'text-gray-300', time: now }]);
    setMsgs(p => [...p, { emoji: '🧭', name: '연구소장', text: '에이전트에 배분합니다...', color: 'text-gray-400', time: now }]);
    setLoading(true);
    try {
      const d = await postJSON('/command', { command: cmd });
      const t = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
      if (d.status === 'ok') {
        setMsgs(p => [...p, { emoji: d.agent_emoji || '💻', name: d.agent_name || '에이전트', text: d.conclusion || '완료', color: 'text-cyan-400', time: t }]);
        if (d.note_path) {
          setMsgs(p => [...p, { emoji: '📋', name: '실험노트관리자', text: `일지 생성: ${d.note_path}`, color: 'text-green-400', time: t }]);
        }
      } else {
        setMsgs(p => [...p, { emoji: '⚠️', name: '오류', text: d.error || '알 수 없는 오류', color: 'text-red-400', time: t }]);
      }
    } catch (e: any) {
      setMsgs(p => [...p, { emoji: '⚠️', name: '오류', text: e.message, color: 'text-red-400', time: now }]);
    }
    setLoading(false);
  };

  const phaseColor = (s: string) => s === 'complete' ? 'bg-green-500' : s === 'active' || s === 'in_progress' ? 'bg-amber-500' : 'bg-gray-700';

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Phase Strip */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {phases.map(p => (
          <div key={p.id} className={`${phaseColor(p.status)} px-3 py-1 rounded-full text-xs font-medium text-white whitespace-nowrap`}>
            {p.id}
          </div>
        ))}
        {health && (
          <div className="ml-auto flex items-center gap-2 text-xs text-gray-500">
            <div className={`w-2 h-2 rounded-full ${health.all_stable ? 'bg-green-500' : 'bg-red-500'}`} />
            {health.model_version} · {health.n_states}차 · SCR {health.loaded_SCR?.join(', ')}
          </div>
        )}
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-12 gap-6">

        {/* LEFT: News + TODO + RQ */}
        <div className="col-span-12 lg:col-span-3 space-y-6">

          {/* Research Briefing */}
          <div className="glass p-5 glow-blue">
            <h2 className="text-sm font-semibold text-blue-400 mb-3">📡 연구 브리핑</h2>
            <div className="space-y-3 text-sm">
              <div className="p-3 bg-blue-500/10 rounded-xl border border-blue-500/20">
                <div className="text-xs text-blue-400 mb-1">방법론</div>
                <div className="text-gray-300">σ 기반 통합 지표로 전환 완료. t_s ≤ 1s 공학적 판단 근거 확보</div>
              </div>
              <div className="p-3 bg-green-500/10 rounded-xl border border-green-500/20">
                <div className="text-xs text-green-400 mb-1">모델</div>
                <div className="text-gray-300">22차 소신호 모델 FD 오차 1.2e-9, DC-AC 양방향 커플링 확인</div>
              </div>
              <div className="p-3 bg-amber-500/10 rounded-xl border border-amber-500/20">
                <div className="text-xs text-amber-400 mb-1">다음 단계</div>
                <div className="text-gray-300">P4 PSO 범위 확정 → P5 EMT 환경 선택 (크리티컬 패스)</div>
              </div>
            </div>
          </div>

          {/* TODO */}
          <div className="glass p-5">
            <h2 className="text-sm font-semibold text-gray-400 mb-3">📝 오늘 할 일</h2>
            <div className="space-y-2">
              {TODOS.map((t, i) => (
                <label key={i} className="flex items-start gap-3 text-sm cursor-pointer group">
                  <input type="checkbox" defaultChecked={t.done}
                    className="mt-0.5 rounded border-gray-600 bg-gray-800 text-blue-500 focus:ring-blue-500/30" />
                  <span className={`${t.done ? 'text-gray-600 line-through' : 'text-gray-300'} group-hover:text-white transition`}>
                    {t.text}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Research Questions */}
          <div className="glass p-5">
            <h2 className="text-sm font-semibold text-purple-400 mb-3">🔬 Research Questions</h2>
            <div className="space-y-3">
              {RQS.map(rq => (
                <div key={rq.id} className="text-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs font-bold ${rq.status === 'active' ? 'text-green-400' : 'text-gray-500'}`}>{rq.id}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${rq.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-gray-800 text-gray-500'}`}>
                      {rq.status}
                    </span>
                  </div>
                  <p className="text-gray-400 text-xs leading-relaxed">{rq.q}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* CENTER: Agent Chat + Experiment Graph */}
        <div className="col-span-12 lg:col-span-6 space-y-6">

          {/* Agent Chat */}
          <div className="glass p-5 glow-blue" style={{ minHeight: 400 }}>
            <h2 className="text-sm font-semibold text-cyan-400 mb-3">💬 에이전트 대화</h2>
            <div className="space-y-3 max-h-72 overflow-y-auto mb-4 pr-2">
              {msgs.map((m, i) => (
                <div key={i} className="flex gap-3">
                  <span className="text-xl shrink-0">{m.emoji}</span>
                  <div className="min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className={`text-xs font-semibold ${m.color}`}>{m.name}</span>
                      <span className="text-[10px] text-gray-600">{m.time}</span>
                    </div>
                    <p className="text-sm text-gray-300 mt-0.5 whitespace-pre-wrap break-words">{m.text}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendCommand()}
                placeholder="에이전트에게 명령... (예: SCR 1.5에서 안정도 분석해줘)"
                disabled={loading}
                className="flex-1 bg-gray-800/50 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 disabled:opacity-50" />
              <button onClick={sendCommand} disabled={loading}
                className="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors">
                {loading ? '⏳' : '전송'}
              </button>
            </div>
          </div>

          {/* Experiment Results */}
          <div className="glass p-5">
            <h2 className="text-sm font-semibold text-green-400 mb-3">📊 실험 결과</h2>
            <div className="grid grid-cols-2 gap-3">
              {runs.map(r => (
                <div key={r.run_name} className={`p-3 rounded-xl border transition-colors cursor-pointer ${r.is_active ? 'border-blue-500/50 bg-blue-500/10' : 'border-gray-800 bg-gray-900/50 hover:border-gray-700'}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-500 font-mono">X/R={r.XR}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${r.all_stable ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                      {r.all_stable ? 'stable' : 'unstable'}
                    </span>
                  </div>
                  <div className="text-xs text-gray-400">SCR {r.SCR_list?.join(', ')}</div>
                  <div className="text-xs text-gray-600 mt-1">{r.timestamp?.split(' ')[0]}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT: Agent Plaza + Notes */}
        <div className="col-span-12 lg:col-span-3 space-y-6">

          {/* Agent Plaza */}
          <div className="glass p-5 glow-amber">
            <h2 className="text-sm font-semibold text-amber-400 mb-3">🏛️ 에이전트 광장</h2>
            <div className="space-y-2">
              {AGENTS.map(a => (
                <div key={a.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-gray-800/50 transition cursor-pointer">
                  <span className="text-2xl">{a.emoji}</span>
                  <div>
                    <div className={`text-sm font-medium ${a.color}`}>{a.name}</div>
                    <div className="text-[10px] text-gray-600">{a.role}</div>
                  </div>
                  <div className="ml-auto w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                </div>
              ))}
            </div>
          </div>

          {/* Research Notes */}
          <div className="glass p-5">
            <h2 className="text-sm font-semibold text-gray-400 mb-3">📋 최근 연구 일지</h2>
            <div className="space-y-2">
              {notes.map(n => (
                <div key={n.path} className="p-2.5 rounded-xl bg-gray-900/50 border border-gray-800 hover:border-gray-700 transition cursor-pointer">
                  <div className="text-xs text-gray-300 truncate">{n.title}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${n.category === 'phase' ? 'bg-blue-500/20 text-blue-400' : n.category === 'literature' ? 'bg-purple-500/20 text-purple-400' : 'bg-green-500/20 text-green-400'}`}>
                      {n.category}
                    </span>
                    <span className="text-[10px] text-gray-600">{new Date(n.mtime * 1000).toLocaleDateString('ko-KR')}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
