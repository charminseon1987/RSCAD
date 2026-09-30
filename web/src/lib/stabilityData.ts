/* 안정도 화면 데이터 계층 — 타입 · 파싱 · 파생값.

   Verification.tsx 에 있던 것을 그대로 옮겼다. 페이지가 조립만 하도록 계산을 분리한다.
   파싱 규칙(어떤 JSON 이 어떤 필드를 갖는지)은 건드리지 않았다 — 자동 로드와
   파일 업로드가 같은 함수를 쓰기 때문이다. */

export const TS_COEF = 4.0;

export interface StabRow { scr: number; sigma: number }
export interface PartRow { scr: number; pd: number; pw: number }
export interface LinRow { scr: number; thr: number; n: number }
export interface PairRow { scr: number; slow: number; fast: number; ppf: number; sep: number }

export interface DashData {
  run: string; xr: number; tsSpec: number;
  stab: StabRow[]; part: PartRow[];
  lin: { input: string; tol: number; rows: LinRow[] };
  pair: PairRow[]; dpj: number;
  grid: Record<string, Record<number, number>>;
  gridXR: number[]; gridSCR: number[];
}

export const DEFAULT: DashData = {
  run: '(no data)', xr: 1.0, tsSpec: 1.0,
  stab: [], part: [], lin: { input: 'Pref', tol: 0.05, rows: [] }, pair: [], dpj: 40,
  grid: {}, gridXR: [], gridSCR: [],
};

export const sigRef = (d: DashData) => TS_COEF / d.tsSpec;
export const score = (sigma: number, d: DashData) => sigma / sigRef(d);
export const ff = (v: number, n = 2) => Number(v).toFixed(n);
export const S = (v: number) => Number(v).toFixed(1);

/** JSON 한 건을 DashData 에 반영하고 무엇이었는지 라벨로 돌려준다 (자동 로드·업로드 공용) */
export function parseJSON(j: any, d: DashData): string | null {
  if (j.ctrl_params && j.SCR_list) {
    d.run = j.run_name ?? d.run; d.xr = j.XR ?? d.xr;
    if (j.t_s_spec) d.tsSpec = j.t_s_spec;
    return 'meta';
  }
  if (j.by_SCR && j.input) {
    d.lin = { input: j.input, tol: j.tol, rows: Object.entries(j.by_SCR).map(([k, v]: any) =>
      ({ scr: +k, thr: v.threshold_fit ?? v.threshold_ratio, n: v.fit?.exponent ?? 2 })).sort((a, b) => b.scr - a.scr) };
    return 'linearization';
  }
  if (j.by_SCR && j.delta_state) {
    d.part = Object.entries(j.by_SCR).map(([k, v]: any) =>
      ({ scr: +k, pd: v.p_delta, pw: v.p_omega })).sort((a, b) => b.scr - a.scr);
    return 'participation';
  }
  if (j.by_SCR && j.sep_min !== undefined) {
    d.pair = Object.entries(j.by_SCR).map(([k, v]: any) =>
      ({ scr: +k, slow: v.lambda_slow, fast: v.lambda_fast, ppf: v.p_Pf_fast, sep: v.sep_ratio })).sort((a, b) => b.scr - a.scr);
    if (j.J && j.Dp) d.dpj = j.Dp / j.J;
    return 'sync_reduction';
  }
  const rows = Object.entries(j)
    .filter(([, v]: any) => v && (v.sigma_min !== undefined || v.min_abs_real !== undefined))
    .map(([k, v]: any) => ({ scr: +k, sigma: v.sigma_min ?? v.min_abs_real }))
    .sort((a, b) => b.scr - a.scr);
  if (rows.length) {
    d.stab = rows;
    const key = ff(d.xr, 1);
    if (!d.grid[key]) d.grid[key] = {};
    rows.forEach(r => { d.grid[key][r.scr] = r.sigma; if (!d.gridSCR.includes(r.scr)) d.gridSCR.push(r.scr); });
    if (!d.gridXR.includes(+key)) d.gridXR.push(+key);
    d.gridSCR.sort((a, b) => b - a); d.gridXR.sort((a, b) => a - b);
    return 'eigenvalues';
  }
  return null;
}

/* ═══════════════════════════════════════════════
   격자 파생값 — KPI 용

   주의: d.grid 는 /api/grid2d 가 results/ 전체를 훑어 만든 {XR: {SCR: sigma_min}} 이다
   (Server/app.py:1390). 즉 아래 값들은 현재 run 이 아니라 실험 이력 전체를 대표한다.
   격자는 꽉 찬 사각형이 아니다 — X/R 마다 계산된 SCR 개수가 다르다.
   ═══════════════════════════════════════════════ */

export interface GridPoint { xr: number; scr: number; sigma: number }

/** 실제로 값이 있는 점만 (미계산 칸 제외) */
export function gridPoints(d: DashData): GridPoint[] {
  const out: GridPoint[] = [];
  d.gridXR.forEach(xr => {
    const row = d.grid[ff(xr, 1)] || {};
    d.gridSCR.forEach(scr => {
      const sigma = row[scr];
      if (sigma !== undefined) out.push({ xr, scr, sigma });
    });
  });
  return out;
}

export interface GridStats {
  points: GridPoint[];
  /** σ 가 가장 작은 점 = 최소 안정 여유 */
  worst: GridPoint | null;
  /** σ > 0 인 점 개수 */
  stable: number;
  /** 값이 있는 점 개수 (사각형 전체가 아니다) */
  filled: number;
  /** 사각형 칸 수 — filled 와 다르면 격자가 비어 있다는 뜻 */
  cells: number;
}

export function gridStats(d: DashData): GridStats {
  const points = gridPoints(d);
  const worst = points.length ? points.reduce((a, b) => (a.sigma < b.sigma ? a : b)) : null;
  return {
    points,
    worst,
    stable: points.filter(p => p.sigma > 0).length,
    filled: points.length,
    cells: d.gridXR.length * d.gridSCR.length,
  };
}

/** 약계통 지배 모드 — 참여계수가 있는 run 에서만 판단할 수 있다 */
export function weakMode(d: DashData) {
  if (!d.part.length) return null;
  const weakest = d.part.reduce((a, b) => (a.scr < b.scr ? a : b));
  return {
    /** δ 가 ω 보다 크면 δ–ω 스윙 모드로 읽는다 */
    label: weakest.pd >= weakest.pw ? 'δ–ω' : 'ω–δ',
    weakest,
    deltaDom: d.part.filter(p => p.pd >= p.pw).length,
    total: d.part.length,
  };
}

/* ═══════════════════════════════════════════════
   규칙 기반 답변 (연구 도우미)
   ═══════════════════════════════════════════════ */

export function aiAnswer(q: string, d: DashData): string {
  const rows = d.stab.map(r => ({ ...r, sc: score(r.sigma, d) }));
  const ok = rows.filter(r => r.sc >= 1), ng = rows.filter(r => r.sc < 1);

  if (/요약|정리|summary/i.test(q)) {
    if (!rows.length) return '데이터가 없습니다. Flask 를 실행한 뒤 새로고침하세요.';
    const pw = d.part.length ? d.part.reduce((a, b) => (a.scr < b.scr ? a : b)) : null;
    const lw = d.lin.rows.length ? d.lin.rows.reduce((a, b) => (a.scr < b.scr ? a : b)) : null;
    let out = `운전점 ${rows.length}곳 중 ${ok.length}곳이 정착시간 ${d.tsSpec}초 요구를 충족합니다.\n`;
    out += `여유는 ${ff(Math.max(...rows.map(r => r.sc)), 3)}에서 ${ff(Math.min(...rows.map(r => r.sc)), 3)}까지 떨어집니다.\n`;
    if (pw) out += `임계 모드는 δ가 지배하는 실수극이며 SCR ${S(pw.scr)}에서 참여도 ${ff(pw.pd + pw.pw, 3)}입니다.\n`;
    if (lw) out += `선형화 유효 범위는 SCR ${S(lw.scr)}에서 ${ff(lw.thr * 100, 1)}%로 가장 좁습니다.`;
    return out;
  }
  if (/미달|부족|fail/i.test(q)) {
    if (!ng.length) return '모든 운전점이 요구를 충족합니다.';
    return '요구에 못 미치는 운전점:\n' + ng.map(r =>
      `SCR ${S(r.scr)}: 여유 ${ff(r.sc, 3)}, ${Math.round((1 - r.sc) * 100)}% 부족`).join('\n');
  }
  if (/다음|추천|next/i.test(q)) {
    const empty: [number, number[]][] = [];
    d.gridXR.forEach(xr => {
      const row = d.grid[ff(xr, 1)] || {};
      const miss = d.gridSCR.filter(s => row[s] === undefined);
      if (miss.length) empty.push([xr, miss]);
    });
    if (empty.length) {
      const [xr, miss] = empty.sort((a, b) => b[1].length - a[1].length)[0];
      return `X/R ${ff(xr, 1)} 행이 가장 많이 비어 있습니다.\npython Simulation/runner.py --XR ${ff(xr, 1)} --SCR ${miss.map(S).join(' ')}`;
    }
    return '비어 있는 조건이 없습니다.';
  }
  return '결과 요약, 미달 운전점, 다음 조건을 물어보세요.';
}

/* ═══════════════════════════════════════════════
   차트 뷰 설정
   ═══════════════════════════════════════════════ */

export interface ChartCfg {
  title: string;
  stats: [string, string][];
  labels: string[];
  bars: number[];
  line: number[];
  ok: (i: number) => boolean;
  yL: { max: number; ticks: number[]; fmt: (t: number) => string };
  yR: { min: number; max: number; ticks: number[]; fmt: (t: number) => string };
  ref?: { v: number; axis: 'L' | 'R'; label: string };
  tip: (i: number) => string;
  note: string;
}

export type ChartView = 'stab' | 'lin' | 'pair';

export function getChartCfg(view: ChartView, d: DashData): ChartCfg {
  const sr = sigRef(d);
  if (view === 'stab') {
    const ts = d.stab.map(r => TS_COEF / r.sigma);
    const mx = Math.ceil(Math.max(...d.stab.map(r => r.sigma), sr) * 1.2);
    const rMax = Math.ceil(Math.max(...ts) * 1.25);
    return {
      title: '감쇠율과 정착시간',
      stats: [['목표 감쇠율', `${ff(sr, 1)} /s`], ['최장 정착시간', `${ff(Math.max(...ts))} s`]],
      labels: d.stab.map(r => S(r.scr)), bars: d.stab.map(r => r.sigma), line: ts,
      ok: (i: number) => score(d.stab[i].sigma, d) >= 1,
      yL: { max: mx, ticks: [...Array(mx + 1).keys()].filter(t => t % 2 === 0 || mx <= 5), fmt: (t: number) => String(t) },
      yR: { min: 0, max: rMax, ticks: [0, 1, 2, 3, 4].filter(t => t <= rMax), fmt: (t: number) => t + 's' },
      ref: { v: sr, axis: 'L', label: `목표 σ ${ff(sr, 1)}` },
      tip: (i: number) => `<b>SCR ${S(d.stab[i].scr)}</b><br>σ ${ff(d.stab[i].sigma, 4)} /s, t<sub>s</sub> ${ff(ts[i])} s`,
      note: '밝은 막대가 목표를 넘은 운전점입니다.',
    };
  }
  if (view === 'lin') {
    const R = d.lin.rows, top = Math.ceil(Math.max(...R.map(r => r.thr * 100)) / 10 + 1) * 10;
    return {
      title: `선형화 유효 범위 (${d.lin.input})`,
      stats: [['허용 오차', `${ff(d.lin.tol * 100, 1)}%`],
              ['회귀 지수', `${ff(Math.min(...R.map(r => r.n)))} ~ ${ff(Math.max(...R.map(r => r.n)))}`]],
      labels: R.map(r => S(r.scr)), bars: R.map(r => r.thr * 100), line: R.map(r => r.n), ok: () => true,
      yL: { max: top, ticks: [0, 20, 40, 60].filter(t => t <= top), fmt: (t: number) => t + '%' },
      yR: { min: 1.5, max: 2.3, ticks: [1.6, 1.8, 2.0, 2.2], fmt: (t: number) => ff(t, 1) },
      ref: { v: 2.0, axis: 'R', label: 'n = 2' },
      tip: (i: number) => `<b>SCR ${S(R[i].scr)}</b><br>유효 ${ff(R[i].thr * 100, 1)}%, n ${ff(R[i].n)}`,
      note: '지수가 2에 가까우면 오차가 섭동의 제곱에 비례합니다.',
    };
  }
  const P = d.pair, sums = P.map(r => -(r.slow + r.fast));
  return {
    title: '스윙극쌍의 합과 필터 혼합',
    stats: [['순수 2차계 기준', String(d.dpj)],
            ['필터 참여도', `${ff(P[0]?.ppf, 3)} → ${ff(P[P.length - 1]?.ppf ?? 0, 3)}`]],
    labels: P.map(r => S(r.scr)), bars: sums, line: P.map(r => r.ppf),
    ok: (i: number) => Math.abs(sums[i] - d.dpj) / d.dpj < 0.1,
    yL: { max: 50, ticks: [0, 10, 20, 30, 40, 50], fmt: (t: number) => String(t) },
    yR: { min: 0, max: 0.16, ticks: [0, 0.05, 0.1, 0.15], fmt: (t: number) => ff(t, 2) },
    ref: { v: d.dpj, axis: 'L', label: `Dp/J ${d.dpj}` },
    tip: (i: number) => `<b>SCR ${S(P[i].scr)}</b><br>합 ${ff(-sums[i])}, p(Pf) ${ff(P[i].ppf, 4)}`,
    note: '밝은 막대만 순수한 2차계입니다.',
  };
}
