/* 실험기록 — 무엇을 언제 돌렸는지의 연대기.
   구 Main(Dashboard) 의 실험 결과 그리드와 연구 일지를 여기로 모았다.
   "맞는지 분석"은 안정도 화면(Stability.tsx)이 맡는다. */
import { useEffect, useState } from 'react';
import { fetchJSON } from '../lib/api';

interface Run {
  run_name: string; timestamp?: string; XR?: number; SCR_list?: number[];
  all_stable?: boolean; zeta_min?: number | null; is_active?: boolean; compatible?: boolean;
}
interface Note { name: string; title: string; category: string; path: string; mtime: number }

const fmtTime = (ms: number) => new Date(ms * 1000).toLocaleString('ko-KR', {
  year: '2-digit', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
});

export default function ExperimentLog() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [latest, setLatest] = useState<string>('');
  const [err, setErr] = useState('');

  useEffect(() => {
    fetchJSON('/runs')
      .then(d => setRuns((d.runs || []).slice().reverse()))
      .catch(() => setErr('실행 목록을 불러오지 못했습니다 — Flask 가 떠 있는지 확인하세요.'));
    fetchJSON('/notes')
      .then(d => setNotes((d.notes || []).filter((n: Note) => n.category === 'phase')))
      .catch(() => {});
    fetchJSON('/latest').then(d => setLatest(d.run_name || '')).catch(() => {});
  }, []);

  return (
    <div className="max-w-[1600px] mx-auto px-10 py-10 space-y-7">
      <div>
        <h1 className="text-display" style={{ color: 'var(--primary)', fontSize: 28 }}>실험기록</h1>
        <p className="mono-clock mt-1" style={{ color: 'var(--outline)', fontSize: 17 }}>
          실행 {runs.length}건 · 연구 일지 {notes.length}건{latest && ` · 활성 ${latest}`}
        </p>
      </div>

      {err && <p className="mono-clock" style={{ color: 'var(--error)', fontSize: 17 }}>{err}</p>}

      <div className="grid grid-cols-12 gap-6">
        {/* 실행 연대기 */}
        <div className="col-span-12 lg:col-span-7 glass-card" style={{ padding: 20 }}>
          <span className="mono-label" style={{ color: 'var(--primary)', fontSize: 16 }}>실행 연대기</span>
          <p className="mono-clock mt-1" style={{ color: 'var(--outline)', fontSize: 15 }}>
            results/ 의 run 폴더 — LATEST.json 이 가리키는 것이 활성
          </p>
          <div className="space-y-1.5 mt-3" style={{ maxHeight: 560, overflowY: 'auto' }}>
            {runs.map(r => (
              <div key={r.run_name} className="p-3 rounded-xl"
                style={{
                  background: r.run_name === latest ? 'var(--primary-container)' : 'var(--surface-container-low)',
                  border: '1px solid var(--border)',
                }}>
                <div className="flex items-center justify-between gap-3">
                  <span className="mono-clock truncate" style={{ fontSize: 16, color: 'var(--on-surface)' }}>{r.run_name}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    {r.run_name === latest && (
                      <span className="mono-label px-2 py-0.5 rounded-full"
                        style={{ fontSize: 15, background: 'var(--primary)', color: 'var(--on-primary)' }}>활성</span>
                    )}
                    {r.compatible === false && (
                      <span className="mono-label px-2 py-0.5 rounded-full"
                        style={{ fontSize: 15, background: 'var(--surface-container)', color: 'var(--error)' }}>구버전</span>
                    )}
                    <span className="mono-label px-2 py-0.5 rounded-full"
                      style={{
                        fontSize: 15, background: 'var(--surface-container)',
                        color: r.all_stable ? 'var(--primary)' : 'var(--error)',
                      }}>
                      {r.all_stable ? '전 구간 안정' : '불안정 구간 있음'}
                    </span>
                  </div>
                </div>
                <div className="mono-clock mt-1" style={{ fontSize: 15, color: 'var(--outline)' }}>
                  X/R {r.XR ?? '—'} · SCR {(r.SCR_list || []).join(', ') || '—'}
                  {r.zeta_min != null && ` · ζ_min ${Number(r.zeta_min).toFixed(4)}`}
                </div>
              </div>
            ))}
            {!runs.length && !err && (
              <p className="mono-clock" style={{ color: 'var(--outline)', fontSize: 16 }}>
                실행 기록이 없습니다. <code>python Simulation/runner.py</code> 를 돌리세요.
              </p>
            )}
          </div>
        </div>

        {/* 연구 일지 */}
        <div className="col-span-12 lg:col-span-5 glass-card" style={{ padding: 20 }}>
          <span className="mono-label" style={{ color: 'var(--primary)', fontSize: 16 }}>연구 일지</span>
          <p className="mono-clock mt-1" style={{ color: 'var(--outline)', fontSize: 15 }}>
            GFM_Research/RSCAD/Phase* — 에이전트와 대시보드가 남긴 노트
          </p>
          <div className="space-y-1.5 mt-3" style={{ maxHeight: 560, overflowY: 'auto' }}>
            {notes.map(n => (
              <div key={n.path} className="p-3 rounded-xl"
                style={{ background: 'var(--surface-container-low)', border: '1px solid var(--border)' }}>
                <div className="text-body-sm truncate" style={{ color: 'var(--on-surface)', fontSize: 17 }}>{n.title}</div>
                <div className="mono-clock truncate mt-0.5" style={{ color: 'var(--outline)', fontSize: 15 }}>
                  {fmtTime(n.mtime)} · {n.path}
                </div>
              </div>
            ))}
            {!notes.length && (
              <p className="mono-clock" style={{ color: 'var(--outline)', fontSize: 16 }}>일지 노트가 없습니다.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
