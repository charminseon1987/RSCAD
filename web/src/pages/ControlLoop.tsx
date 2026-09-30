/* GFM 제어루프 — 실시간 신호 흐름 (React)

   gfm-control-loop.html 을 React 로 옮긴 화면이다. iframe 이 아니다.
   구조는 컴포넌트가 갖고, 매 프레임 갱신(점·칩·스코프)은 ref 로 직접 쓴다 —
   60 fps 로 setState 를 돌리면 값이 적분 결과와 어긋난다.

   주의(논문에 쓸 때): 여기는 비선형 시간영역 적분이고, σ=−Re(λ) 판정은 선형화 모델이다.
   같은 spec 에서 나온 식이라도 두 결과를 섞어 쓰면 안 된다. */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import BlockDiagram, { type DiagramHandle } from '../components/controlloop/BlockDiagram';
import Scope, { type Sample, type ScopeHandle } from '../components/controlloop/Scope';
import { DT, Sim, type Inputs, type Spec, type SpecMeta } from '../lib/gfmSpec';
import { fetchJSON } from '../lib/api';
import teachSpec from '../data/gfmSpecTeach.json';
import '../components/controlloop/controlloop.css';

const SPEEDS = [
  { v: 1, label: '실시간' },
  { v: 0.1, label: '1/10' },
  { v: 0.01, label: '1/100' },
];

interface InputSlider {
  id: string; label: string; min: number; max: number; step: number;
  fmt: (v: number) => string;
}

/* 입력 슬라이더 범위는 spec 에서 유도한다 — 하드코딩하면 안 된다.
   14차 교육용 모델은 pu(Pref=0.5), 22차 연구 모델은 SI(Pref=10000 W · Vg=325 V)로 적분한다.
   pu 를 전제한 0~1 범위를 22차에 쓰면 정격의 2만분의 1 을 넣게 된다. */
function inputSliders(u: Inputs): InputSlider[] {
  const p0 = Math.abs(u.Pref ?? 1) || 1;          // spec 의 기본 P 지령
  const pMax = 2 * p0;                            // pu: 0…1 (원본과 동일) · SI: 0…20 kW
  const qMax = 0.8 * p0;                          // pu: ±0.4 (원본과 동일) · SI: ±8 kvar
  const num = (v: number) => Math.abs(v) >= 100 ? v.toFixed(0)
    : Math.abs(v) >= 10 ? v.toFixed(1) : v.toFixed(2);
  return [
    { id: 'Pref', label: 'P_ref', min: 0, max: pMax, step: pMax / 200, fmt: num },
    { id: 'Qref', label: 'Q_ref', min: -qMax, max: qMax, step: qMax / 100, fmt: num },
    { id: 'SCR', label: 'SCR', min: 1, max: 10, step: 0.1, fmt: v => v.toFixed(1) },
    { id: 'XR', label: 'X/R', min: 0.5, max: 15, step: 0.5, fmt: v => v.toFixed(1) },
  ];
}

interface Verify { ok: boolean; err: number }

export default function ControlLoop() {
  const dgRef = useRef<DiagramHandle>(null);
  const scF = useRef<ScopeHandle>(null);
  const scP = useRef<ScopeHandle>(null);
  const scV = useRef<ScopeHandle>(null);
  const scI = useRef<ScopeHandle>(null);
  const statusRef = useRef<HTMLSpanElement>(null);

  const simRef = useRef<Sim | null>(null);
  const tr = useRef<Sample[]>([]);
  const tr3 = useRef<Sample[]>([]);
  const lastRec = useRef(0);
  const lastRec3 = useRef(0);
  const pausedRef = useRef(false);
  const speedRef = useRef(1);

  const [specList, setSpecList] = useState<SpecMeta[]>([]);
  const [specName, setSpecName] = useState('');
  const [nStates, setNStates] = useState(0);
  const [nParams, setNParams] = useState(0);
  const [verify, setVerify] = useState<Verify | null>(null);
  const [loadErr, setLoadErr] = useState('');
  const [listErr, setListErr] = useState('');
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [diverged, setDiverged] = useState(false);
  const [dark, setDark] = useState(false);   // 기본 라이트
  const [inputs, setInputs] = useState<Record<string, number>>({ Pref: 0.5, Qref: 0, SCR: 3, XR: 5 });
  const [sliders, setSliders] = useState<InputSlider[]>(() => inputSliders({ Pref: 0.5 }));
  const [paramSliders, setParamSliders] = useState<
    { key: string; label: string; unit: string; min: number; max: number; value: number }[]
  >([]);

  const clearTraces = useCallback(() => {
    tr.current = []; tr3.current = []; lastRec.current = 0; lastRec3.current = 0;
  }, []);

  /** spec 을 올린다 — 실패하면 화면을 바꾸지 않고 사유만 띄운다 */
  const loadSpec = useCallback((spec: Spec) => {
    try {
      const sim = new Sim(spec);
      simRef.current = sim;
      setSpecName(spec.name);
      setNStates(sim.N);
      setNParams(Object.keys(spec.params).length);
      setVerify({ ...sim.verify });
      setLoadErr('');
      setDiverged(false);
      setInputs({
        Pref: sim.U.Pref ?? 0.5, Qref: sim.U.Qref ?? 0,
        SCR: sim.U.SCR ?? 3, XR: sim.U.XR ?? 5,
      });
      setSliders(inputSliders(sim.U));
      setParamSliders(Object.entries(spec.sliders ?? {}).map(([key, cfg]) => ({
        key, label: cfg.label, unit: cfg.unit, min: cfg.min, max: cfg.max, value: spec.params[key],
      })));
      clearTraces();
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : String(e));
    }
  }, [clearTraces]);

  /* 처음: 번들된 14차 교육용 모델로 시작하고, 연구 모델 목록을 받아온다 */
  useEffect(() => {
    loadSpec(teachSpec as unknown as Spec);
    fetchJSON<{ specs: SpecMeta[] }>('/gfm_viewer/specs')
      .then(d => setSpecList(d.specs ?? []))
      .catch(() => setListErr('연구 모델 목록을 불러오지 못했습니다 — Flask 가 떠 있는지 확인하세요.'));
  }, [loadSpec]);

  /** 목록에서 고른 spec 을 받아 온다 (/gfm-viewer/*.json — Flask 가 서빙) */
  const pickSpec = useCallback(async (meta: SpecMeta) => {
    try {
      const r = await fetch(meta.url);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      loadSpec(await r.json() as Spec);
    } catch (e) {
      setLoadErr(`${meta.file} 를 불러오지 못했습니다 — ${e instanceof Error ? e.message : String(e)}`);
    }
  }, [loadSpec]);

  /* ── RAF 루프 ── */
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let chipTimer = 0;

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const sim = simRef.current;
      if (!sim) return;

      const dtReal = Math.min((now - last) / 1000, 0.05);
      last = now;

      if (!pausedRef.current && !sim.diverged) {
        const sp = speedRef.current;
        const win = Math.max(0.05, 3 * sp);
        const steps = Math.max(1, Math.round(dtReal * sp / DT));
        for (let i = 0; i < steps; i++) {
          sim.applyGridVoltage();
          sim.step();
          if (i % 10 === 0) record(sim, win);
          if (sim.checkDiverged()) { setDiverged(true); break; }
        }
      }

      const sim2 = simRef.current;
      if (!sim2) return;
      const S = sim2.signals();
      const ctx = { S, U: sim2.U, theta: sim2.theta, vg0: sim2.vg0 };

      if (!sim2.diverged) dgRef.current?.update(ctx, pausedRef.current ? 0 : dtReal);

      chipTimer += dtReal;
      if (chipTimer > 0.1) {
        chipTimer = 0;
        if (!sim2.diverged) dgRef.current?.updateChips(ctx);
        drawScopes();
      }
      if (statusRef.current) {
        statusRef.current.textContent =
          `t = ${sim2.t.toFixed(3)} s · δ = ${(sim2.delta * 180 / Math.PI).toFixed(1)}°`;
      }
    };

    const record = (sim: Sim, win: number) => {
      const S = sim.signals();
      if (sim.t - lastRec.current >= win / 500) {
        lastRec.current = sim.t;
        tr.current.push({
          t: sim.t, f: S.w * 60, P: S.pe, Q: S.qe, Pref: sim.U.Pref, v: S.vod,
          i: Math.hypot(S.iod, S.ioq),
        });
        while (tr.current.length && tr.current[0].t < sim.t - win) tr.current.shift();
      }
      if (sim.t - lastRec3.current >= 0.05 / 400) {
        lastRec3.current = sim.t;
        const a = sim.theta, id = S.iod, iq = S.ioq, ph = 2 * Math.PI / 3;
        tr3.current.push({
          t: sim.t,
          a: id * Math.cos(a) - iq * Math.sin(a),
          b: id * Math.cos(a - ph) - iq * Math.sin(a - ph),
          c: id * Math.cos(a + ph) - iq * Math.sin(a + ph),
        });
        while (tr3.current.length && tr3.current[0].t < sim.t - 0.05) tr3.current.shift();
      }
    };

    const drawScopes = () => {
      const win = Math.max(0.05, 3 * speedRef.current);
      scF.current?.draw(tr.current, win);
      scP.current?.draw(tr.current, win);
      scV.current?.draw(tr.current, win);
      scI.current?.draw(tr3.current, 0.05);

      const l = tr.current[tr.current.length - 1];
      const sim = simRef.current;
      if (!l || !sim) return;
      scF.current?.setReadout(l.f.toFixed(3) + ' Hz');
      scP.current?.setReadout(`P ${l.P.toFixed(3)} · Q ${l.Q.toFixed(3)}`);
      scV.current?.setReadout(`v ${l.v.toFixed(3)} · |i| ${l.i.toFixed(3)}`);
      scI.current?.setReadout('θ ' + ((sim.theta * 180 / Math.PI) % 360).toFixed(0) + '°');
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  /* ── 컨트롤 ── */
  const setInput = (id: string, v: number) => {
    setInputs(s => ({ ...s, [id]: v }));
    if (simRef.current) simRef.current.U[id] = v;
  };
  const setParam = (key: string, v: number) => {
    setParamSliders(s => s.map(p => p.key === key ? { ...p, value: v } : p));
    if (simRef.current) simRef.current.P[key] = v;
  };

  /* P 지령 스텝 — 슬라이더 상한(정격의 2배) 기준 상대값으로 건다 */
  const stepP = () => {
    const s0 = sliders.find(s => s.id === 'Pref');
    const top = s0?.max ?? 1;
    const cur = inputs.Pref ?? 0;
    const next = cur >= 0.8 * top ? 0.2 * top : cur + 0.3 * top;
    setInput('Pref', Math.min(top, next));
  };
  const sag = () => { if (simRef.current) simRef.current.sagUntil = simRef.current.t + 0.1; };
  const togglePause = () => { pausedRef.current = !pausedRef.current; setPaused(pausedRef.current); };
  const pickSpeed = (v: number) => { speedRef.current = v; setSpeed(v); clearTraces(); };
  const reset = () => { const s = simRef.current; if (!s) return; s.reset(); setDiverged(false); clearTraces(); };

  const onFile = (f: File | undefined) => {
    if (!f) return;
    f.text()
      .then(t => loadSpec(JSON.parse(t) as Spec))
      .catch(e => setLoadErr(e instanceof Error ? e.message : String(e)));
  };

  const fileInput = useRef<HTMLInputElement>(null);

  /* 연구 모델이 있으면 목록 맨 앞에 번들 모델을 둔다 */
  const listed = useMemo(() => specList.filter(s => s.states > 0), [specList]);

  return (
    <div
      className={'cl' + (dark ? ' cl--dark' : '')}
      onDragOver={e => e.preventDefault()}
      onDrop={e => { e.preventDefault(); onFile(e.dataTransfer.files[0]); }}
    >
      <header className="cl-header">
        <h1>GFM 제어 루프 — 실시간 신호 흐름</h1>
        <p>평균화 dq 모델을 브라우저에서 실시간 적분(RK4, 20 µs)하고, 선 위의 점은 실제 신호 크기로 흐릅니다</p>
      </header>

      <div className="cl-wrap">
        {diverged && (
          <div className="cl-banner">
            발산 — 이 조건에서 시스템이 불안정합니다. 파라미터를 되돌리거나 ‘초기화’를 누르세요.
          </div>
        )}
        {loadErr && <div className="cl-banner">모델 불러오기 실패: {loadErr}</div>}

        <div className="cl-card cl-diagram">
          <BlockDiagram ref={dgRef} />
        </div>

        <div className="cl-card cl-scopes">
          <Scope ref={scF} title="주파수 f" keys={['f']} cols={['--accent']} minPad={0.02} />
          <Scope ref={scP} title="유효·무효전력 P, Q (pu)" keys={['P', 'Q', 'Pref']}
            cols={['--accent', '--neg', '--ink-3']} />
          <Scope ref={scV} title={<>전압 v<sub>od</sub> · 계통측 전류 |i<sub>o</sub>| (pu)</>}
            keys={['v', 'i']} cols={['--accent', '--neg']} />
          <Scope ref={scI} title={<>3상 전류 i<sub>a</sub>, i<sub>b</sub>, i<sub>c</sub> (최근 50 ms)</>}
            keys={['a', 'b', 'c']} cols={['--accent', '--neg', '--ok']} />
        </div>

        <div className="cl-card cl-controls">
          {sliders.map(s => (
            <div className="cl-ctl" key={s.id}>
              <label>
                <span>{s.label}</span>
                <b>{s.fmt(inputs[s.id] ?? 0)}</b>
              </label>
              <input type="range" min={s.min} max={s.max} step={s.step}
                value={inputs[s.id] ?? 0}
                onChange={e => setInput(s.id, +e.target.value)} />
            </div>
          ))}
          {paramSliders.map(p => (
            <div className="cl-ctl" key={p.key}>
              <label>
                <span>{p.label} ({p.unit})</span>
                <b>{p.value.toPrecision(3)}</b>
              </label>
              <input type="range" min={p.min} max={p.max} step="any"
                value={p.value}
                onChange={e => setParam(p.key, +e.target.value)} />
            </div>
          ))}

          <div className="cl-btns">
            <button onClick={stepP}>P<sub>ref</sub> 스텝 +0.3</button>
            <button onClick={sag}>계통 전압 강하 0.8 pu · 100 ms</button>
            <span className="cl-seg" role="group" aria-label="재생 속도">
              {SPEEDS.map(s => (
                <button key={s.v} className={speed === s.v ? 'cl-on' : ''}
                  onClick={() => pickSpeed(s.v)}>{s.label}</button>
              ))}
            </span>
            <button className={paused ? 'cl-on' : ''} onClick={togglePause}>
              {paused ? '재생' : '일시정지'}
            </button>
            <button onClick={reset}>초기화</button>
            <button className={dark ? 'cl-on' : ''} onClick={() => setDark(v => !v)}>테마</button>
            <button onClick={() => fileInput.current?.click()}>모델 JSON 불러오기</button>
            <input ref={fileInput} type="file" accept=".json,application/json" hidden
              onChange={e => onFile(e.target.files?.[0])} />
            <button onClick={() => loadSpec(teachSpec as unknown as Spec)}>기본 모델</button>
            <span className="cl-status" ref={statusRef}>t = 0.000 s</span>
          </div>

          {listed.length > 0 && (
            <div className="cl-btns">
              <span style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>연구 모델</span>
              {listed.map(m => (
                <button key={m.file} className={specName === m.name ? 'cl-on' : ''}
                  onClick={() => pickSpec(m)}>
                  {m.name} · {m.states}차
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="cl-notes">
          모델 <b>{specName || '—'}</b> · 상태 {nStates}개 · 파라미터 {nParams}개
          {verify && (verify.ok
            ? <span className="cl-ok"> · 검증 ✓ (최대 상대오차 {verify.err.toExponential(1)})</span>
            : <span className="cl-bad"> · 검증 ✗ (오차 {verify.err.toExponential(1)}) — 이 화면의 숫자를 믿지 마세요</span>
          )}
          {listErr && <span className="cl-bad"> · {listErr}</span>}
        </div>

        <div className="cl-notes">
          <b>읽는 법</b> — 점의 속도 = 신호 크기, 색 = 부호(
          <span style={{ color: 'var(--pos)' }}>양</span> / <span style={{ color: 'var(--neg)' }}>음</span>
          ). 1/100 속도로 늦추면 전류 루프(수백 Hz)의 과도 응답까지 보입니다.{' '}
          <b>모델 교체</b> — ‘모델 JSON 불러오기’(또는 파일을 끌어다 놓기)로 export_spec.py 가 만든 연구 모델을
          올리면 같은 화면이 그 모델로 움직입니다. 기본 모델은 예시 파라미터의 14차 교육용 모델(DC 링크 일정)입니다.
          평균화 모델, 3상 3선식 평형 가정. H 를 키우거나 D 를 줄이면 동기화 모드(δ–ω)가 불안정해지는 것을
          직접 확인할 수 있습니다.
        </div>
      </div>
    </div>
  );
}
