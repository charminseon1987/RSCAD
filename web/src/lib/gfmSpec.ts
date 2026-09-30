/* GFM 뷰어 시뮬레이션 코어 — spec(JSON) 컴파일 + RK4 적분.
   UI 와 분리해 둔다. 여기 들어오는 식은 export_spec.py 가 Simulation/model.py 의
   sympy 식에서 뽑은 것이고, spec.check 로 Python 계산과 대조된다.

   주의: 이 모듈은 비선형 시간영역 적분이다. σ=−Re(λ) 안정도 판정은 선형화 모델이므로
   같은 식에서 나왔더라도 두 결과를 섞어 쓰면 안 된다. */

export interface SpecState { name: string; label: string; unit: string }
export interface SpecSlider { label: string; unit: string; min: number; max: number }

export interface Spec {
  format: string;
  name: string;
  exported_at?: string | null;
  states: SpecState[];
  inputs: Record<string, number>;
  params: Record<string, number>;
  sliders?: Record<string, SpecSlider>;
  rhs: string[];
  signals: Record<string, string>;
  x0: number[];
  check: { x: number[]; inputs: Record<string, number>; f: number[]; tol?: number };
}

/** 뷰어에 올릴 수 있는 spec 목록의 한 줄 (GET /api/gfm_viewer/specs) */
export interface SpecMeta {
  file: string; url: string; name: string;
  states: number; params: number; signals: number;
  inputs: Record<string, number>; sliders: string[];
  exported_at: string | null; mtime: number;
}

export type Inputs = Record<string, number>;
export type Params = Record<string, number>;
export type Signals = Record<string, number>;

export const DT = 2e-5;              // 적분 스텝 20 µs
export const WB = 2 * Math.PI * 60;  // 기저 각주파수

const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;

type RhsFn = (x: number[], u: Inputs, p: Params) => number[];
type SigFn = (x: number[], u: Inputs, p: Params) => Signals;

export interface Compiled {
  names: string[];
  rf: RhsFn;
  sf: SigFn;
  /** spec.check 대조 최대 상대오차 */
  err: number;
  /** err 가 spec.check.tol 이내인가 — ✗ 면 화면의 숫자를 믿으면 안 된다 */
  ok: boolean;
}

export function compileSpec(spec: Spec): Compiled {
  if (spec.format !== 'gfm-live-flow/spec@1') throw new Error('지원하지 않는 형식: ' + spec.format);
  const names = spec.states.map(s => s.name);
  for (const n of [...names, ...Object.keys(spec.inputs), ...Object.keys(spec.params)]) {
    if (!IDENT.test(n)) throw new Error('잘못된 이름: ' + n);
  }
  if (!names.includes('w') || !names.includes('dl')) throw new Error("상태 'w'(ω), 'dl'(δ)가 필요합니다");
  if (spec.rhs.length !== names.length) throw new Error('rhs 개수가 상태 개수와 다릅니다');

  const decl = names.map((n, i) => `const ${n}=x[${i}];`).join('')
    + Object.keys(spec.inputs).map(k => `const ${k}=u.${k};`).join('')
    + Object.keys(spec.params).map(k => `const ${k}=p.${k};`).join('');

  /* spec 의 rhs/signals 는 export_spec.py 가 만든 JS 식 문자열이다 (Math.cos 등 포함).
     식을 그대로 평가해야 화면과 해석이 같은 식을 쓴다는 보장이 성립한다. */
  const rf = new Function('x', 'u', 'p', decl + `return [${spec.rhs.join(',')}];`) as RhsFn;
  const sf = new Function('x', 'u', 'p',
    decl + `return {${Object.entries(spec.signals).map(([k, v]) => `${k}:(${v})`).join(',')}};`) as SigFn;

  // 자체 검증 — Python 에서 계산한 f(x_check) 와 대조
  const c = spec.check;
  const fx = rf(c.x, c.inputs, spec.params);
  let err = 0;
  fx.forEach((v, i) => { err = Math.max(err, Math.abs(v - c.f[i]) / Math.max(1, Math.abs(c.f[i]))); });
  return { names, rf, sf, err, ok: err <= (c.tol ?? 1e-8) };
}

/** 없는 신호를 읽으면 NaN — 블록도 배선이 spec 에 없는 신호를 가리켜도 화면이 죽지 않게 */
const NAN_GUARD: ProxyHandler<Signals> = {
  get: (o, k) => (k in o ? (o as any)[k] : NaN),
};

export class Sim {
  readonly spec: Spec;
  readonly names: string[];
  readonly N: number;
  readonly verify: { ok: boolean; err: number };

  private readonly rf: RhsFn;
  private readonly sf: SigFn;
  private readonly iw: number;
  private readonly idl: number;

  U: Inputs;
  P: Params;

  x: number[] = [];
  theta = 0;
  t = 0;
  diverged = false;
  sagUntil = -1;

  private k1: number[] = [];
  private k2: number[] = [];
  private k3: number[] = [];
  private tmp: number[] = [];

  /* 발산 판정 기준 — 상태마다 스케일이 다르다. 22차 연구 모델은 SI 단위라
     정상상태에서 Pf=10 kW, Qf=-1.29 kvar 이고, pu 를 전제한 절대 임계값(1e3)으로는
     정상 동작을 발산으로 오판한다. x0 크기를 기준으로 상대 판정한다. */
  private readonly scale: number[];

  /** spec 이 정한 정격 계통전압 — 전압강하를 배수로 걸기 위해 보존한다 (pu 1.0 / SI 325 V) */
  readonly vg0: number;

  constructor(spec: Spec) {
    const c = compileSpec(spec);
    this.spec = spec;
    this.names = c.names;
    this.N = c.names.length;
    this.rf = c.rf;
    this.sf = c.sf;
    this.iw = c.names.indexOf('w');
    this.idl = c.names.indexOf('dl');
    this.verify = { ok: c.ok, err: c.err };
    this.U = { ...spec.inputs };
    this.P = { ...spec.params };
    this.vg0 = spec.inputs.Vg ?? 1;
    this.scale = spec.x0.map(v => Math.max(Math.abs(v), 1));
    this.reset();
  }

  get delta(): number { return this.x[this.idl]; }
  get omega(): number { return this.x[this.iw]; }

  /** x0 에서 시작해 현재 입력에서 정상상태까지 미리 적분한다 */
  reset(): void {
    this.k1 = new Array(this.N);
    this.k2 = new Array(this.N);
    this.k3 = new Array(this.N);
    this.tmp = new Array(this.N);
    this.x = this.spec.x0.slice();
    this.theta = 0;
    this.t = 0;
    this.diverged = false;
    this.sagUntil = -1;
    this.U.Vg = this.vg0;
    const settle = Math.round(1.5 / DT);
    for (let i = 0; i < settle; i++) this.step();
    this.t = 0;
  }

  step(): void {
    const { x, k1, k2, k3, tmp, N, U, P } = this;
    const a = this.rf(x, U, P);
    for (let i = 0; i < N; i++) { k1[i] = a[i]; tmp[i] = x[i] + DT / 2 * a[i]; }
    const b = this.rf(tmp, U, P);
    for (let i = 0; i < N; i++) { k2[i] = b[i]; tmp[i] = x[i] + DT / 2 * b[i]; }
    const c = this.rf(tmp, U, P);
    for (let i = 0; i < N; i++) { k3[i] = c[i]; tmp[i] = x[i] + DT * c[i]; }
    const d = this.rf(tmp, U, P);
    for (let i = 0; i < N; i++) x[i] += DT / 6 * (k1[i] + 2 * k2[i] + 2 * k3[i] + d[i]);
    this.theta += WB * x[this.iw] * DT;
    if (this.theta > 1e6) this.theta %= 2 * Math.PI;
    this.t += DT;
  }

  signals(): Signals {
    const s = this.sf(this.x, this.U, this.P);
    s.w = this.x[this.iw];
    s.dl = this.x[this.idl];
    if (s.dw === undefined) s.dw = this.x[this.iw] - 1;
    return new Proxy(s, NAN_GUARD);
  }

  /** 전압강하 적용 — 정격의 배수로 건다 (sagUntil 이전이면 0.8배) */
  applyGridVoltage(): void {
    this.U.Vg = this.t < this.sagUntil ? this.vg0 * 0.8 : this.vg0;
  }

  /** 발산 판정 — true 가 되면 그 화면의 숫자는 물리적 의미가 없다.
      임계값은 x0 스케일의 1000배 (단위계에 무관하게 같은 뜻이 되도록) */
  checkDiverged(): boolean {
    const x = this.x;
    if (!x.every(Number.isFinite)) { this.diverged = true; return true; }
    for (let i = 0; i < x.length; i++) {
      if (Math.abs(x[i]) > 1e3 * this.scale[i]) { this.diverged = true; return true; }
    }
    // ω 는 두 모델 모두 pu — 정격에서 ±20% 넘으면 동기 이탈로 본다
    if (Math.abs(x[this.iw] - 1) > 0.2) this.diverged = true;
    return this.diverged;
  }
}
