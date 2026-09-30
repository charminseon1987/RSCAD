/* archify 아키텍처 다이어그램 — React 렌더러 (iframe 아님).

   좌표는 전부 데이터에 있다. 노드 pos/size 는 spec 에서, 간선 폴리라인과 경계
   사각형은 archify 가 렌더한 HTML 에서 뽑아 tools/extract_arch_geometry.py 가
   합쳐 둔다. 여기서는 레이아웃 계산을 하지 않는다 — 원본 렌더와 어긋날 여지를 없앤다.

   뷰(views)를 고르면 focus 에 든 노드만 살리고 나머지를 흐린다. 간선은 양 끝이
   모두 focus 에 있을 때만 살린다. */

import { useMemo, useState } from 'react';
import './arch.css';

export interface ArchComponent {
  id: string; type: string; label: string;
  sublabel?: string; tag?: string;
  pos: [number, number]; size: [number, number];
}
export interface ArchBoundary {
  kind: string; label: string; wraps: string[];
  x: number; y: number; w: number; h: number;
}
export interface ArchConnection {
  id: string; from: string; to: string; label: string;
  variant: string; labelDy?: number | null; labelSegment?: number | null;
  points: [number, number][];
}
export interface ArchView { id: string; label: string; focus: string[]; note?: string }
export interface ArchCard { dot: string; title: string; items: string[] }

export interface ArchSpec {
  title: string;
  viewBox: [number, number];
  views: ArchView[];
  components: ArchComponent[];
  boundaries: ArchBoundary[];
  connections: ArchConnection[];
  cards: ArchCard[];
}

/** 폴리라인을 둥근 모서리 path 로 — 꺾이는 지점마다 반경 8 로 깎는다 */
function roundedPath(pts: [number, number][], r = 8): string {
  if (pts.length < 2) return '';
  if (pts.length === 2) return `M ${pts[0][0]} ${pts[0][1]} L ${pts[1][0]} ${pts[1][1]}`;
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [px, py] = pts[i - 1];
    const [cx, cy] = pts[i];
    const [nx, ny] = pts[i + 1];
    const inLen = Math.hypot(cx - px, cy - py);
    const outLen = Math.hypot(nx - cx, ny - cy);
    const ri = Math.min(r, inLen / 2, outLen / 2);
    const i1 = [cx - (cx - px) / (inLen || 1) * ri, cy - (cy - py) / (inLen || 1) * ri];
    const o1 = [cx + (nx - cx) / (outLen || 1) * ri, cy + (ny - cy) / (outLen || 1) * ri];
    d += ` L ${i1[0].toFixed(2)} ${i1[1].toFixed(2)} Q ${cx} ${cy} ${o1[0].toFixed(2)} ${o1[1].toFixed(2)}`;
  }
  const last = pts[pts.length - 1];
  d += ` L ${last[0]} ${last[1]}`;
  return d;
}

/** 간선 라벨 위치 — labelSegment 가 가리키는 구간(기본: 가장 긴 구간)의 중점 */
function labelPos(c: ArchConnection): { x: number; y: number; vertical: boolean } | null {
  const p = c.points;
  if (p.length < 2) return null;
  let idx = 0;
  if (c.labelSegment != null && c.labelSegment < p.length - 1) {
    idx = c.labelSegment;
  } else {
    let best = -1;
    for (let i = 0; i < p.length - 1; i++) {
      const L = Math.hypot(p[i + 1][0] - p[i][0], p[i + 1][1] - p[i][1]);
      if (L > best) { best = L; idx = i; }
    }
  }
  const a = p[idx], b = p[idx + 1];
  const vertical = Math.abs(b[0] - a[0]) < Math.abs(b[1] - a[1]);
  const x = (a[0] + b[0]) / 2;
  let y = (a[1] + b[1]) / 2;
  // 세로 구간은 라벨이 선을 덮으므로 위로 올린다. labelDy 가 있으면 시작점 기준으로 둔다.
  if (c.labelDy != null) y = a[1] + (b[1] >= a[1] ? c.labelDy : -c.labelDy);
  return { x, y: vertical ? y : y - 7, vertical };
}

interface Props { spec: ArchSpec }

export default function ArchDiagram({ spec }: Props) {
  const [viewId, setViewId] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);

  const view = spec.views.find(v => v.id === viewId) ?? null;

  /** focus 집합 — 뷰가 없으면 전부, 노드에 마우스를 올리면 그 노드와 이웃 */
  const focus = useMemo(() => {
    if (hover) {
      const s = new Set<string>([hover]);
      spec.connections.forEach(c => {
        if (c.from === hover) s.add(c.to);
        if (c.to === hover) s.add(c.from);
      });
      return s;
    }
    if (view) return new Set(view.focus);
    return null;   // null = 전부 살림
  }, [hover, view, spec.connections]);

  const on = (id: string) => !focus || focus.has(id);
  const connOn = (c: ArchConnection) => !focus || (focus.has(c.from) && focus.has(c.to));

  const byId = useMemo(
    () => new Map(spec.components.map(c => [c.id, c])), [spec.components]);

  return (
    <div className="arch">
      {spec.views.length > 0 && (
        <div className="arch-views">
          <button className={!viewId ? 'arch-on' : ''} onClick={() => setViewId(null)}>전체</button>
          {spec.views.map(v => (
            <button key={v.id} className={viewId === v.id ? 'arch-on' : ''}
              onClick={() => setViewId(viewId === v.id ? null : v.id)}>{v.label}</button>
          ))}
          {view?.note && <span className="arch-note">{view.note}</span>}
        </div>
      )}

      <svg viewBox={`0 0 ${spec.viewBox[0]} ${spec.viewBox[1]}`} role="img" aria-label={spec.title}>
        <defs>
          {['default', 'emphasis', 'dashed'].map(v => (
            <marker key={v} id={`arch-ar-${v}`} viewBox="0 0 10 10" refX={9} refY={5}
              markerWidth={6} markerHeight={6} orient="auto">
              <path d="M0,0 L10,5 L0,10 z" className={`arch-ah arch-ah-${v}`} />
            </marker>
          ))}
        </defs>

        {/* 경계 — 좌표는 추출된 것 그대로 */}
        <g>
          {spec.boundaries.map((b, i) => {
            const dim = focus != null && !b.wraps.some(w => focus.has(w));
            return (
              <g key={`b${i}`} className={'arch-region' + (dim ? ' arch-dim' : '')}>
                <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={12} />
                <text x={b.x + 14} y={b.y + 4}>{b.label}</text>
              </g>
            );
          })}
        </g>

        {/* 간선 */}
        <g>
          {spec.connections.map(c => {
            if (c.points.length < 2) return null;
            const dim = !connOn(c);
            const lp = labelPos(c);
            return (
              <g key={c.id} className={'arch-edge arch-e-' + c.variant + (dim ? ' arch-dim' : '')}>
                <path d={roundedPath(c.points)} markerEnd={`url(#arch-ar-${c.variant})`} />
                {c.label && lp && (
                  <text x={lp.x} y={lp.y} textAnchor="middle">{c.label}</text>
                )}
              </g>
            );
          })}
        </g>

        {/* 노드 */}
        <g>
          {spec.components.map(c => {
            const [x, y] = c.pos;
            const [w, h] = c.size;
            const dim = !on(c.id);
            return (
              <g key={c.id}
                className={`arch-node arch-n-${c.type}` + (dim ? ' arch-dim' : '')}
                tabIndex={0} role="button"
                aria-label={`${c.label}${c.sublabel ? ', ' + c.sublabel : ''}`}
                onMouseEnter={() => setHover(c.id)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(c.id)}
                onBlur={() => setHover(null)}
              >
                <rect x={x} y={y} width={w} height={h} rx={10} />
                <text className="arch-label" x={x + w / 2} y={y + (c.sublabel ? 28 : h / 2 + 5)}
                  textAnchor="middle">{c.label}</text>
                {c.sublabel && (
                  <text className="arch-sub" x={x + w / 2} y={y + 46} textAnchor="middle">
                    {c.sublabel}
                  </text>
                )}
                {c.tag && (
                  <>
                    <rect className="arch-tagbox" x={x + w - 8 - c.tag.length * 7.2} y={y - 9}
                      width={c.tag.length * 7.2 + 1} height={18} rx={9} />
                    <text className="arch-tag" x={x + w - 7 - c.tag.length * 7.2 / 2} y={y + 3}
                      textAnchor="middle">{c.tag}</text>
                  </>
                )}
              </g>
            );
          })}
        </g>
      </svg>

      {spec.cards.length > 0 && (
        <div className="arch-cards">
          {spec.cards.map((k, i) => (
            <div className="arch-card" key={i}>
              <div className="arch-card-h">
                <span className={'arch-dot arch-dot-' + k.dot} />
                {k.title}
              </div>
              <ul>{k.items.map((it, j) => <li key={j}>{it}</li>)}</ul>
            </div>
          ))}
        </div>
      )}

      {/* 범례 */}
      <div className="arch-legend">
        {(['frontend', 'backend', 'database', 'external'] as const)
          .filter(t => spec.components.some(c => c.type === t))
          .map(t => (
            <span key={t} className="arch-leg">
              <span className={'arch-swatch arch-n-' + t} />
              {{ frontend: '프론트엔드', backend: '백엔드', database: '저장소', external: '외부' }[t]}
            </span>
          ))}
        {spec.connections.some(c => c.variant === 'dashed') && (
          <span className="arch-leg"><span className="arch-swatch arch-swatch-dashed" />미구축 경로</span>
        )}
        <span className="arch-note">
          노드에 마우스를 올리면 그 노드와 직접 연결된 것만 남습니다 · 총 {byId.size}개
        </span>
      </div>
    </div>
  );
}
