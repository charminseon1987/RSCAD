/* 블록도 렌더러 — 구조는 React(JSX), 프레임 갱신은 ref 로 직접 쓴다.

   60 fps 로 setState 를 돌리지 않는 것이 요점이다. 점 좌표·칩 숫자는 프레임마다
   수백 번 바뀌므로 리렌더 대상이 아니라 DOM 속성으로 써야 한다. React 는 SVG
   구조(티어·블록·배선·칩)를 소유하고, update() 가 그 안의 노드만 갱신한다. */

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { buildDiagramFor, type Diagram, type Label, type SigCtx } from '../../lib/gfmDiagram';

/** 점 간격 (px, viewBox 기준) — 원본과 같은 34 */
const GAP = 34;

export interface DiagramHandle {
  /** 프레임마다 호출 — 점을 흘리고 칩 숫자를 갱신한다 */
  update(ctx: SigCtx, dtReal: number): void;
  /** 칩·라벨만 갱신 (0.1 s 주기) */
  updateChips(ctx: SigCtx): void;
}

/** 라벨을 <tspan> 으로 — 아래첨자는 dy 로 내리고 곧바로 되돌린다 */
function renderLabel(label: Label) {
  if (typeof label === 'string') return label;
  return label.map((r, i) =>
    r.sub
      ? (
        <tspan key={i}>
          <tspan fontSize={10} dy={3}>{r.t}</tspan>
          <tspan dy={-3} />
        </tspan>
      )
      : <tspan key={i}>{r.t}</tspan>,
  );
}

interface Props {
  className?: string;
  /** 모델의 상태 개수 — 22차에는 DC단이 있어 블록도 구조가 다르다 */
  nStates?: number;
}

const BlockDiagram = forwardRef<DiagramHandle, Props>(function BlockDiagram({ className, nStates = 14 }, ref) {
  const dg: Diagram = useMemo(() => buildDiagramFor(nStates), [nStates]);

  const svgRef = useRef<SVGSVGElement>(null);
  const pathRefs = useRef<(SVGPathElement | null)[]>([]);
  const dotGroupRefs = useRef<(SVGGElement | null)[]>([]);
  const chipTextRefs = useRef<(SVGTextElement | null)[]>([]);
  const dcRef = useRef<SVGTextElement>(null);
  const vgRef = useRef<SVGTextElement>(null);

  /* 배선별 런타임 상태 — 길이는 마운트 후 실제 path 에서 재야 한다 */
  const rt = useRef<{ len: number; phase: number; dots: SVGCircleElement[] }[]>([]);
  const colors = useRef({ pos: '#5563D6', neg: '#D9822B' });   // 라이트 기본값 fallback

  const readColors = () => {
    const el = svgRef.current;
    if (!el) return;
    const cs = getComputedStyle(el);
    const pos = cs.getPropertyValue('--pos').trim();
    const neg = cs.getPropertyValue('--neg').trim();
    if (pos) colors.current.pos = pos;
    if (neg) colors.current.neg = neg;
  };

  /* 마운트 후: path 길이를 재고 점을 필요한 개수만큼 만든다.
     getTotalLength() 는 실제 DOM 이 있어야 하므로 여기서만 할 수 있다. */
  useEffect(() => {
    rt.current = dg.wires.map((_, i) => {
      const path = pathRefs.current[i];
      const group = dotGroupRefs.current[i];
      const len = path?.getTotalLength() ?? 0;
      const dots: SVGCircleElement[] = [];
      if (group) {
        while (group.firstChild) group.removeChild(group.firstChild);
        const n = Math.max(2, Math.round(len / GAP));
        for (let k = 0; k < n; k++) {
          const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
          c.setAttribute('r', '2.6');
          c.setAttribute('class', 'cl-dot');
          group.appendChild(c);
          dots.push(c);
        }
      }
      return { len, phase: Math.random() * GAP, dots };
    });
    readColors();

    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onScheme = () => readColors();
    mq.addEventListener('change', onScheme);
    return () => mq.removeEventListener('change', onScheme);
  }, [dg]);

  useImperativeHandle(ref, () => ({
    update(ctx, dtReal) {
      const { pos, neg } = colors.current;
      dg.wires.forEach((w, i) => {
        const st = rt.current[i];
        const path = pathRefs.current[i];
        if (!st || !path || !st.len) return;

        let v = 0;
        try { v = w.get(ctx); } catch { v = 0; }
        if (!Number.isFinite(v)) v = 0;

        const mag = Math.min(Math.abs(v) / w.nom, 2);
        const speed = mag < 0.01 ? 0 : (18 + 95 * mag);
        st.phase = (st.phase + speed * dtReal) % GAP;

        const col = v < 0 ? neg : pos;
        const op = mag < 0.01 ? 0.12 : Math.min(0.35 + 0.5 * mag, 1);
        const r = String(2 + 1.3 * mag);

        for (let k = 0; k < st.dots.length; k++) {
          const L = (k * GAP + st.phase) % st.len;
          const p = path.getPointAtLength(L);
          const d = st.dots[k];
          d.setAttribute('cx', String(p.x));
          d.setAttribute('cy', String(p.y));
          d.setAttribute('fill', col);
          d.setAttribute('opacity', String(op));
          d.setAttribute('r', r);
        }
      });
    },

    updateChips(ctx) {
      const { neg } = colors.current;
      dg.wires.forEach((w, i) => {
        const t = chipTextRefs.current[i];
        if (!t) return;
        let v = 0;
        try { v = w.get(ctx); } catch { v = 0; }
        t.textContent = w.fmt(v, ctx);
        t.style.fill = v < 0 ? neg : '';
      });

      /* DC 링크 — spec 에 vdc 상태가 없으면 (14차 교육용) 일정으로 표시한다 */
      if (dcRef.current) {
        const vdc = ctx.S.vdc;
        dcRef.current.textContent = Number.isFinite(vdc)
          ? 'v_dc ' + vdc.toFixed(3)
          : 'v_dc 일정 (DC 단 미포함)';
      }
      /* 계통전압 — 정격 대비 배수로 쓴다. spec 에 따라 단위가 pu(1.0)거나 SI(325 V)여서
         'pu' 로 못박으면 22차 연구 모델에서 틀린 표시가 된다. */
      if (vgRef.current) {
        const ratio = ctx.vg0 ? ctx.U.Vg / ctx.vg0 : ctx.U.Vg;
        vgRef.current.textContent = `v_g = ${ratio.toFixed(2)} ×정격`;
      }
    },
  }), [dg]);

  /* 칩 위치는 path 위 chipAt 비율 지점 — 정적이므로 직선 보간으로 미리 계산한다
     (getPointAtLength 와 달리 렌더 전에 구할 수 있다) */
  const chipPos = useMemo(() => dg.wires.map(w => {
    const segs: number[] = [];
    let total = 0;
    for (let i = 1; i < w.pts.length; i++) {
      const d = Math.hypot(w.pts[i][0] - w.pts[i - 1][0], w.pts[i][1] - w.pts[i - 1][1]);
      segs.push(d); total += d;
    }
    let want = total * w.chipAt;
    for (let i = 0; i < segs.length; i++) {
      if (want <= segs[i] || i === segs.length - 1) {
        const f = segs[i] ? Math.min(want / segs[i], 1) : 0;
        return {
          x: w.pts[i][0] + (w.pts[i + 1][0] - w.pts[i][0]) * f,
          y: w.pts[i][1] + (w.pts[i + 1][1] - w.pts[i][1]) * f,
        };
      }
      want -= segs[i];
    }
    return { x: w.pts[0][0], y: w.pts[0][1] };
  }), [dg]);

  return (
    <svg
      ref={svgRef}
      className={className}
      viewBox={dg.viewBox}
      role="img"
      aria-label="GFM 제어 블록도, 신호 흐름 애니메이션"
    >
      <defs>
        <marker id="cl-ar" viewBox="0 0 10 10" refX={9} refY={5} markerWidth={6} markerHeight={6} orient="auto">
          <path d="M0,0 L10,5 L0,10 z" className="cl-arrow" />
        </marker>
      </defs>

      {/* 배선 + 티어 */}
      <g>
        {dg.tiers.map((t, i) => (
          <g key={`tier${i}`}>
            <rect x={t.x} y={t.y} width={t.w} height={t.h} rx={10}
              className={'cl-tier' + (t.accent ? ' cl-t1' : '')} />
            <text x={t.x + 12} y={t.y + 18} className={'cl-tt' + (t.accent ? ' cl-t1' : '')}>
              {renderLabel(t.label)}
            </text>
          </g>
        ))}
        {dg.wires.map((w, i) => (
          <path
            key={`wire${i}`}
            ref={el => { pathRefs.current[i] = el; }}
            d={'M' + w.pts.map(p => p.join(',')).join(' L')}
            className="cl-wire"
            markerEnd="url(#cl-ar)"
          />
        ))}
      </g>

      {/* 블록 · 합산점 · 기호 */}
      <g>
        {dg.blocks.map((b, i) => (
          <g key={`blk${i}`}>
            <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={4}
              className={'cl-blk' + (b.accent ? ' cl-t1' : '')} />
            <text x={b.x + b.w / 2} y={b.y + b.h / 2 + (b.sub ? -2 : 5)} className="cl-bl">
              {renderLabel(b.label)}
            </text>
            {b.sub && (
              <text x={b.x + b.w / 2} y={b.y + b.h / 2 + 14} className="cl-bs">{b.sub}</text>
            )}
          </g>
        ))}
        {dg.sums.map((s, i) => (
          <g key={`sum${i}`}>
            <circle cx={s.cx} cy={s.cy} r={13} className="cl-sj" />
            {s.signs.l && <text x={s.cx - 10} y={s.cy + 4} className="cl-sg">{s.signs.l}</text>}
            {s.signs.t && <text x={s.cx + 3} y={s.cy - 4} className="cl-sg">{s.signs.t}</text>}
            {s.signs.b && <text x={s.cx + 3} y={s.cy + 10} className="cl-sg">{s.signs.b}</text>}
          </g>
        ))}
        {dg.syms.map((s, i) => (
          <text key={`sym${i}`} x={s.x} y={s.y} className="cl-sym" textAnchor={s.anchor ?? 'middle'}>
            {renderLabel(s.label)}
          </text>
        ))}

        {/* 계통 전압원 — 원 + 사인 기호 */}
        <circle cx={780} cy={586} r={18} className="cl-src" />
        <path d="M769,586 q5.5,-9 11,0 t11,0" className="cl-sine" />

        {/* 프레임마다 갱신되는 라벨 — DC 링크 · 계통전압 */}
        <text ref={dcRef} x={251} y={624} className="cl-bs" />
        <text ref={vgRef} x={806} y={590} className="cl-sym" textAnchor="start" />
      </g>

      {/* 흐르는 점 — 마운트 후 여기에 채운다 */}
      <g>
        {dg.wires.map((_, i) => (
          <g key={`dots${i}`} ref={el => { dotGroupRefs.current[i] = el; }} className="cl-dots" />
        ))}
      </g>

      {/* 값 칩 */}
      <g>
        {dg.wires.map((w, i) => w.noChip ? null : (
          <g key={`chip${i}`} className="cl-chip">
            <rect x={chipPos[i].x - 31} y={chipPos[i].y - 19} width={62} height={15} rx={7} />
            <text ref={el => { chipTextRefs.current[i] = el; }} x={chipPos[i].x} y={chipPos[i].y - 8} />
          </g>
        ))}
      </g>
    </svg>
  );
});

export default BlockDiagram;
