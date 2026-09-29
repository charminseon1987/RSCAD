/* 모듈 들여다보기 — model.py · op.py · runner.py 같은 파일을 눌렀을 때 뜬다.
   "데이터" 탭은 그 모듈이 실제로 들고 있는 값을 표로,
   "코드" 탭은 원본 소스를 그대로 보여준다. */
import { useEffect, useState } from 'react';
import { fetchJSON } from '../lib/api';

interface Source {
  path: string; name: string; lines: number; bytes: number;
  docstring: string; source: string;
}

/* 파일 이름 → 저장소 경로. 지금은 전부 Simulation/ 아래에 있다. */
const PATHS: Record<string, string> = {
  'model.py': 'Simulation/model.py',
  'op.py': 'Simulation/op.py',
  'runner.py': 'Simulation/runner.py',
  'metrics.py': 'Simulation/metrics.py',
  'xval.py': 'Simulation/xval.py',
  'pf_export.py': 'Simulation/pf_export.py',
  'sync_reduce.py': 'Simulation/sync_reduce.py',
  'quantize.py': 'Simulation/quantize.py',
  'experiment.py': 'agent/experiment.py',
};

export function modulePath(name: string): string | null {
  return PATHS[name] ?? null;
}

const fmt = (v: any): string => {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : v.toPrecision(6).replace(/0+$/, '');
  if (Array.isArray(v)) return v.join(', ');
  return String(v);
};

/* 이름/값 표 하나 */
function KV({ title, rows, cols = 2 }: { title: string; rows: [string, any][]; cols?: number }) {
  if (!rows.length) return null;
  return (
    <div className="mb-5">
      <span className="mono-label" style={{ fontSize: 15, color: 'var(--primary)' }}>{title}</span>
      <div className="grid gap-x-6 gap-y-1 mt-2" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` }}>
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-baseline justify-between gap-3 py-1"
            style={{ borderBottom: '1px solid var(--border)' }}>
            <span className="mono-clock truncate" style={{ fontSize: 15, color: 'var(--outline)' }}>{k}</span>
            <span className="mono-clock text-right" style={{ fontSize: 15, color: 'var(--on-surface)' }}>{fmt(v)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* 상태 이름들을 칩으로 — 22개를 표로 늘어놓는 것보다 읽기 쉽다 */
function Chips({ title, items, color }: { title: string; items: string[]; color: string }) {
  if (!items?.length) return null;
  return (
    <div className="mb-5">
      <span className="mono-label" style={{ fontSize: 15, color: 'var(--primary)' }}>
        {title} <span style={{ color: 'var(--outline)' }}>{items.length}개</span>
      </span>
      <div className="flex flex-wrap gap-1.5 mt-2">
        {items.map((s, i) => (
          <span key={s} className="mono-clock px-2 py-1 rounded"
            style={{ fontSize: 14, background: 'var(--surface-container-low)', border: `1px solid ${color}`, color: 'var(--on-surface)' }}>
            <span style={{ color: 'var(--outline)' }}>{i + 1}</span> {s}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function ModuleInspector({ name, onClose }: { name: string; onClose: () => void }) {
  const [tab, setTab] = useState<'data' | 'code'>('data');
  const [src, setSrc] = useState<Source | null>(null);
  const [info, setInfo] = useState<any>(null);
  const [err, setErr] = useState('');

  const path = modulePath(name);

  useEffect(() => {
    if (!path) { setErr(`경로를 모르는 모듈입니다: ${name}`); return; }
    fetchJSON('/source?path=' + encodeURIComponent(path))
      .then(setSrc)
      .catch(() => setErr('소스를 불러오지 못했습니다 — Flask 가 떠 있는지 확인하세요.'));
    fetchJSON('/model_info').then(setInfo).catch(() => {});
  }, [path, name]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  /* 모듈별 데이터 화면 */
  const dataView = () => {
    if (!info) return <p className="mono-clock" style={{ fontSize: 16, color: 'var(--outline)' }}>값을 불러오는 중...</p>;

    if (name === 'model.py') {
      const m = info.model;
      return (
        <>
          <KV title="모델 차수" rows={[
            ['전체 상태 수', m.n_states], ['DC 상태', m.n_dc], ['AC 상태', m.n_ac],
            ['입력', m.input_names.length], ['제어 파라미터', m.param_names.length], ['고정 파라미터', m.fixed_names.length],
          ]} cols={3} />
          <Chips title="DC 상태변수" items={m.dc_states} color="var(--primary)" />
          <Chips title="AC 상태변수" items={m.ac_states} color="var(--tertiary, var(--outline))" />
          <Chips title="입력" items={m.input_names} color="var(--outline)" />
          <Chips title="PSO 대상 제어 파라미터" items={m.param_names} color="var(--secondary, var(--outline))" />
        </>
      );
    }

    if (name === 'op.py') {
      const o = info.op;
      const cur = info.current_run;
      return (
        <>
          <KV title="기준" rows={[['Z_BASE', o.z_base + ' Ω'], ['현재 실행', cur.run_dir || '없음'], ['X/R', cur.XR], ['SCR', cur.SCR_list]]} cols={2} />
          <KV title="입력 (INP)" rows={Object.entries(o.inputs)} cols={3} />
          <KV title="제어 기본값 (CTRL)" rows={Object.entries(o.ctrl_defaults)} cols={3} />
          <KV title="고정 파라미터 (FIXED)" rows={Object.entries(o.fixed)} cols={3} />
          <Chips title="관측 대상" items={o.observable} color="var(--primary)" />
          <Chips title="적분기 상태" items={o.integrators} color="var(--outline)" />
        </>
      );
    }

    if (name === 'runner.py') {
      const r = info.runner;
      const cur = info.current_run;
      return (
        <>
          <KV title="판정 기준" rows={[
            ['모델 버전', r.model_version], ['ζ 목표', r.zeta_target],
            ['현재 실행', cur.run_dir || '없음'], ['X/R', cur.XR], ['SCR 목록', cur.SCR_list],
          ]} cols={2} />
          <div className="mb-5">
            <span className="mono-label" style={{ fontSize: 15, color: 'var(--primary)' }}>주파수 대역 분류</span>
            <div className="mt-2">
              {r.bands.map((b: any, i: number) => (
                <div key={i} className="flex items-baseline justify-between py-1.5"
                  style={{ borderBottom: '1px solid var(--border)' }}>
                  <span className="mono-clock" style={{ fontSize: 16, color: 'var(--on-surface)' }}>{b.name ?? b.raw}</span>
                  <span className="mono-clock" style={{ fontSize: 15, color: 'var(--outline)' }}>
                    {b.lo != null ? `${b.lo} – ${b.hi} Hz` : ''}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <KV title="현재 실행에 쓰인 제어 파라미터" rows={Object.entries(cur.ctrl_params || {})} cols={3} />
        </>
      );
    }

    return (
      <p className="mono-clock" style={{ fontSize: 16, color: 'var(--outline)', lineHeight: 1.8 }}>
        이 모듈은 아직 값 요약 화면이 없습니다. 오른쪽 위 <strong>코드</strong> 탭에서 원본을 볼 수 있습니다.
        <br />값 요약이 준비된 모듈: model.py · op.py · runner.py
      </p>
    );
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-6"
      style={{ background: 'rgba(0,0,0,.45)', backdropFilter: 'blur(3px)' }}
      onClick={onClose}>
      <div className="glass-card flex flex-col"
        style={{ width: 'min(1100px, 96vw)', height: 'min(80vh, 820px)', padding: 0, overflow: 'hidden' }}
        onClick={e => e.stopPropagation()}>

        {/* 머리 */}
        <div className="flex items-center justify-between px-5 py-3 shrink-0"
          style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="min-w-0">
            <span className="mono-label" style={{ fontSize: 18, color: 'var(--primary)' }}>{name}</span>
            <span className="mono-clock ml-3" style={{ fontSize: 15, color: 'var(--outline)' }}>
              {src ? `${src.path} · ${src.lines}줄` : path}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex gap-0.5 p-1 rounded-xl" style={{ background: 'var(--surface-container)' }}>
              {([['data', '데이터'], ['code', '코드']] as const).map(([k, label]) => (
                <button key={k} onClick={() => setTab(k)}
                  className="mono-label px-3 py-1.5 rounded-lg"
                  style={{
                    fontSize: 15,
                    color: tab === k ? 'var(--primary)' : 'var(--outline)',
                    background: tab === k ? 'var(--surface-container-lowest)' : 'transparent',
                    border: tab === k ? '1px solid var(--border)' : '1px solid transparent',
                  }}>
                  {label}
                </button>
              ))}
            </div>
            <button onClick={onClose} className="mono-label px-3 py-1.5 rounded-lg"
              style={{ fontSize: 15, color: 'var(--outline)' }}>닫기 (Esc)</button>
          </div>
        </div>

        {/* 몸 */}
        <div className="flex-1 overflow-y-auto" style={{ padding: 20 }}>
          {err && <p className="mono-clock" style={{ fontSize: 16, color: 'var(--error)' }}>{err}</p>}

          {tab === 'data' && !err && (
            <>
              {src?.docstring && (
                <p className="mono-clock mb-5 p-3 rounded-xl"
                  style={{
                    fontSize: 15, lineHeight: 1.8, color: 'var(--on-surface-variant)',
                    background: 'var(--surface-container-low)', border: '1px solid var(--border)',
                    whiteSpace: 'pre-wrap',
                  }}>{src.docstring}</p>
              )}
              {dataView()}
            </>
          )}

          {tab === 'code' && !err && (
            src ? (
              <pre className="mono-clock"
                style={{
                  fontSize: 14, lineHeight: 1.65, color: 'var(--on-surface-variant)',
                  whiteSpace: 'pre', overflowX: 'auto',
                }}>{src.source}</pre>
            ) : <p className="mono-clock" style={{ fontSize: 16, color: 'var(--outline)' }}>불러오는 중...</p>
          )}
        </div>
      </div>
    </div>
  );
}
