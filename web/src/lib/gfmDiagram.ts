/* GFM 제어 블록도 — 구조를 데이터로 선언한다 (좌표·배선은 gfm-control-loop.html 원본 그대로).
   렌더링은 BlockDiagram.tsx 가 이 배열에서 JSX 를 만든다. 점 애니메이션만 ref 로 직접 갱신한다. */

import type { Inputs, Signals } from './gfmSpec';

/** 아래첨자를 섞은 라벨 — <tspan> 으로 렌더된다 (dangerouslySetInnerHTML 을 쓰지 않기 위해) */
export interface Run { t: string; sub?: boolean }
export type Label = string | Run[];

/** 아래첨자 한 칸: sub('v','od') → v_od */
export const sub = (base: string, s: string): Run[] => [{ t: base }, { t: s, sub: true }];

export interface SigCtx { S: Signals; U: Inputs; theta: number; vg0: number }
export type Getter = (c: SigCtx) => number;

export interface Tier { x: number; y: number; w: number; h: number; label: Label; accent?: boolean }
export interface Block { x: number; y: number; w: number; h: number; label: Label; sub?: string; accent?: boolean }
export interface Sum { cx: number; cy: number; signs: { l?: string; t?: string; b?: string } }
export interface Sym { x: number; y: number; label: Label; anchor?: 'start' | 'middle' | 'end' }

export interface Wire {
  pts: [number, number][];
  get: Getter;
  /** 점 속도를 정규화하는 기준 크기 */
  nom: number;
  /** 칩에 표시할 문자열 — ctx 를 받는다 (위상각처럼 상태가 필요한 칩이 있다) */
  fmt: (v: number, c: SigCtx) => string;
  chipAt: number;
  noChip: boolean;
}

export interface Diagram {
  viewBox: string;
  tiers: Tier[];
  blocks: Block[];
  sums: Sum[];
  syms: Sym[];
  wires: Wire[];
}

const f3 = (v: number) => v.toFixed(3);

function wire(
  pts: [number, number][],
  get: Getter,
  o: { nom?: number; fmt?: (v: number, c: SigCtx) => string; chipAt?: number; noChip?: boolean } = {},
): Wire {
  return { pts, get, nom: o.nom ?? 1, fmt: o.fmt ?? f3, chipAt: o.chipAt ?? 0.5, noChip: o.noChip ?? false };
}

interface ChannelCfg {
  fb: Getter; fbL: Label;
  err: Getter;
  piL: string;
  pi: Getter;
  ff: Getter; ffL: Label;
  cs: string;
  crossL: Label;
  crossIn: Getter; crossInL: Label;
  cross: Getter;
}

interface Group { blocks: Block[]; sums: Sum[]; syms: Sym[]; wires: Wire[] }

/** 전압/전류 루프 한 채널 (d 또는 q) — 원본 channel() 과 같은 좌표 */
function channel(x0: number, y: number, cfg: ChannelCfg): Group {
  return {
    blocks: [
      { x: x0 + 120, y: y - 18, w: 86, h: 36, label: 'PI', sub: cfg.piL },
      { x: x0 + 196, y: y + 26, w: 56, h: 26, label: cfg.crossL },
    ],
    sums: [
      { cx: x0 + 80, cy: y, signs: { l: '+', b: '−' } },
      { cx: x0 + 276, cy: y, signs: { l: '+', t: '+', b: cfg.cs } },
    ],
    syms: [
      { x: x0 + 80, y: y + 62, label: cfg.fbL },
      { x: x0 + 312, y: y - 34, label: cfg.ffL, anchor: 'start' },
      { x: x0 + 146, y: y + 44, label: cfg.crossInL, anchor: 'end' },
    ],
    wires: [
      wire([[x0 + 80, y + 46], [x0 + 80, y + 14]], cfg.fb, { chipAt: 0.2 }),
      wire([[x0 + 93, y], [x0 + 120, y]], cfg.err, { noChip: true }),
      wire([[x0 + 206, y], [x0 + 262, y]], cfg.pi, { chipAt: 0.5 }),
      wire([[x0 + 276, y - 44], [x0 + 276, y - 14]], cfg.ff, { chipAt: 0.25 }),
      wire([[x0 + 150, y + 39], [x0 + 196, y + 39]], cfg.crossIn, { noChip: true }),
      wire([[x0 + 252, y + 39], [x0 + 276, y + 39], [x0 + 276, y + 14]], cfg.cross, { chipAt: 0.2 }),
    ],
  };
}

/** ω_c / (s+ω_c) — 전력 측정 저역통과 */
const wcLabel = (): Label => [
  { t: 'ω' }, { t: 'c', sub: true }, { t: ' / (s+ω' }, { t: 'c', sub: true }, { t: ')' },
];

export function buildDiagram(): Diagram {
  const tiers: Tier[] = [];
  const blocks: Block[] = [];
  const sums: Sum[] = [];
  const syms: Sym[] = [];
  const wires: Wire[] = [];
  const push = (g: Group) => {
    blocks.push(...g.blocks); sums.push(...g.sums); syms.push(...g.syms); wires.push(...g.wires);
  };

  /* ── ① 전력 동기화 — VSG ── */
  tiers.push({ x: 8, y: 8, w: 984, h: 168, label: '① 전력 동기화 — VSG · Q–V droop', accent: true });
  syms.push({ x: 34, y: 76, label: sub('P', 'ref') });
  wires.push(wire([[56, 70], [118, 70]], c => c.U.Pref, { chipAt: 0.45 }));
  sums.push({ cx: 132, cy: 70, signs: { l: '+', b: '−' } });
  wires.push(wire([[145, 70], [178, 70]], c => c.S.eP, { noChip: true }));
  blocks.push({ x: 178, y: 50, w: 104, h: 40, label: '1 / (2Hs + D)', sub: 'VSG 스윙', accent: true });
  wires.push(wire([[282, 70], [334, 70]], c => c.S.dw * 60,
    { nom: 0.5, fmt: v => (v >= 0 ? '+' : '') + v.toFixed(3) + ' Hz' }));
  sums.push({ cx: 348, cy: 70, signs: { l: '+', t: '+' } });
  wires.push(wire([[348, 32], [348, 56]], () => 1, { noChip: true }));
  syms.push({ x: 348, y: 27, label: sub('ω', '0') });
  wires.push(wire([[361, 70], [400, 70]], c => c.S.w * 60, { nom: 60, fmt: v => v.toFixed(3) + ' Hz' }));
  blocks.push({ x: 400, y: 52, w: 56, h: 36, label: [{ t: 'ω' }, { t: 'b', sub: true }, { t: ' / s' }], accent: true });
  /* θ 칩 — 적분된 위상각. 신호값이 아니라 ctx.theta 를 보여준다 */
  wires.push(wire([[456, 70], [520, 70]], () => 1,
    { fmt: (_v, c) => ((c.theta * 180 / Math.PI) % 360).toFixed(0) + '°' }));
  syms.push({ x: 530, y: 74, label: 'θ → dq↔abc', anchor: 'start' });
  blocks.push({ x: 178, y: 112, w: 104, h: 34, label: wcLabel(), accent: true });
  wires.push(wire([[330, 129], [282, 129]], c => c.S.pe, { chipAt: 0.5 }));
  syms.push({ x: 338, y: 133, label: 'p', anchor: 'start' });
  wires.push(wire([[178, 129], [132, 129], [132, 83]], c => c.S.Pf, { chipAt: 0.25 }));

  /* ── ① Q–V droop ── */
  syms.push({ x: 620, y: 76, label: sub('Q', 'ref') });
  wires.push(wire([[642, 70], [690, 70]], c => c.U.Qref, { chipAt: 0.5 }));
  sums.push({ cx: 704, cy: 70, signs: { l: '+', b: '−' } });
  wires.push(wire([[717, 70], [744, 70]], c => c.S.eQ, { noChip: true }));
  blocks.push({ x: 744, y: 52, w: 46, h: 36, label: sub('n', 'q'), accent: true });
  wires.push(wire([[790, 70], [836, 70]], c => c.S.dV, { nom: 0.05, chipAt: 0.5 }));
  sums.push({ cx: 850, cy: 70, signs: { l: '+', t: '+' } });
  wires.push(wire([[850, 32], [850, 56]], () => 1, { noChip: true }));
  syms.push({ x: 850, y: 27, label: sub('V', '0') });
  blocks.push({ x: 744, y: 112, w: 104, h: 34, label: wcLabel(), accent: true });
  wires.push(wire([[900, 129], [848, 129]], c => c.S.qe, { chipAt: 0.5 }));
  syms.push({ x: 906, y: 133, label: 'q', anchor: 'start' });
  wires.push(wire([[744, 129], [704, 129], [704, 83]], c => c.S.Qf, { chipAt: 0.25 }));

  /* ── ② 전압 루프 · ③ 전류 루프 ── */
  tiers.push({
    x: 8, y: 186, w: 984, h: 170,
    label: [{ t: '② 전압 제어 루프 — 커패시터 전압 v' }, { t: 'o', sub: true }],
  });
  tiers.push({
    x: 8, y: 366, w: 984, h: 170,
    label: [{ t: '③ 전류 제어 루프 — 인버터측 전류 i' }, { t: 'l', sub: true }],
  });

  // Vref → d-ref (① → ② 긴 배선)
  wires.push(wire([[863, 70], [970, 70], [970, 176], [20, 176], [20, 250], [64, 250]],
    c => c.S.Vref, { chipAt: 0.08 }));
  push(channel(20, 250, {
    fb: c => c.S.vod, fbL: sub('v', 'od'), err: c => c.S.evd, piL: 'k_pv, k_iv', pi: c => c.S.pvd,
    ff: c => c.S.iod, ffL: sub('i', 'od'), cs: '−',
    crossL: [{ t: '×ωC' }, { t: 'f', sub: true }],
    crossIn: c => c.S.voq, crossInL: sub('v', 'oq'), cross: c => c.S.cvd,
  }));
  syms.push({ x: 20, y: 238, label: sub('v', 'od,ref'), anchor: 'start' });
  wires.push(wire([[522, 250], [564, 250]], () => 0, { noChip: true }));
  syms.push({ x: 505, y: 254, label: '0', anchor: 'end' });
  syms.push({ x: 522, y: 238, label: sub('v', 'oq,ref'), anchor: 'start' });
  push(channel(500, 250, {
    fb: c => c.S.voq, fbL: sub('v', 'oq'), err: c => c.S.evq, piL: 'k_pv, k_iv', pi: c => c.S.pvq,
    ff: c => c.S.ioq, ffL: sub('i', 'oq'), cs: '+',
    crossL: [{ t: '×ωC' }, { t: 'f', sub: true }],
    crossIn: c => c.S.vod, crossInL: sub('v', 'od'), cross: c => c.S.cvq,
  }));

  // ② 출력 → ③ 기준
  wires.push(wire([[310, 250], [450, 250], [450, 342], [14, 342], [14, 430], [64, 430]],
    c => c.S.ildr, { chipAt: 0.12 }));
  wires.push(wire([[790, 250], [960, 250], [960, 350], [494, 350], [494, 430], [564, 430]],
    c => c.S.ilqr, { chipAt: 0.1 }));
  push(channel(20, 430, {
    fb: c => c.S.ild, fbL: sub('i', 'ld'), err: c => c.S.ecd, piL: 'k_pc, k_ic', pi: c => c.S.pcd,
    ff: c => c.S.vod, ffL: sub('v', 'od'), cs: '−',
    crossL: [{ t: '×ωL' }, { t: 'f', sub: true }],
    crossIn: c => c.S.ilq, crossInL: sub('i', 'lq'), cross: c => c.S.ccd,
  }));
  push(channel(500, 430, {
    fb: c => c.S.ilq, fbL: sub('i', 'lq'), err: c => c.S.ecq, piL: 'k_pc, k_ic', pi: c => c.S.pcq,
    ff: c => c.S.voq, ffL: sub('v', 'oq'), cs: '+',
    crossL: [{ t: '×ωL' }, { t: 'f', sub: true }],
    crossIn: c => c.S.ild, crossInL: sub('i', 'ld'), cross: c => c.S.ccq,
  }));

  /* ── ④ 전력단 ── */
  tiers.push({ x: 8, y: 546, w: 984, h: 86, label: '④ 전력단' });
  wires.push(wire([[310, 430], [440, 430], [440, 520], [70, 520], [70, 566]], c => c.S.vid, { chipAt: 0.3 }));
  wires.push(wire([[790, 430], [972, 430], [972, 528], [110, 528], [110, 566]], c => c.S.viq, { chipAt: 0.2 }));
  blocks.push({ x: 40, y: 566, w: 110, h: 40, label: 'dq → abc', sub: 'θ' });
  wires.push(wire([[150, 586], [196, 586]], c => Math.hypot(c.S.vid, c.S.viq),
    { chipAt: 0.5, fmt: v => '|v|' + v.toFixed(2) }));
  blocks.push({ x: 196, y: 566, w: 110, h: 40, label: 'PWM · VSI' });
  wires.push(wire([[306, 586], [356, 586]], c => Math.hypot(c.S.ild, c.S.ilq),
    { chipAt: 0.5, fmt: v => '|i|' + v.toFixed(2) }));
  blocks.push({
    x: 356, y: 562, w: 150, h: 48,
    label: [{ t: 'L' }, { t: 'f', sub: true }, { t: ' · C' }, { t: 'f', sub: true }, { t: ' · L' }, { t: 'c', sub: true }],
    sub: 'LCL 필터',
  });
  wires.push(wire([[506, 586], [560, 586]], c => c.S.pe, { chipAt: 0.5, fmt: v => 'P ' + v.toFixed(2) }));
  blocks.push({
    x: 560, y: 566, w: 150, h: 40,
    label: [{ t: 'R' }, { t: 'g', sub: true }, { t: ' + jX' }, { t: 'g', sub: true }],
    sub: '계통 임피던스',
  });
  wires.push(wire([[710, 586], [760, 586]], c => c.S.pe, { noChip: true }));

  return { viewBox: '0 0 1000 640', tiers, blocks, sums, syms, wires };
}
