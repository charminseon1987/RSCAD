/* 고유값 표 — 산점도(EigenvalueLocus)가 빠뜨리는 것을 메운다.

   산점도는 진동 모드만 그린다. runner.analyze() 가 Im(λ) > IMAG_TOL(1e-4) 인 것만
   modes 에 모으기 때문이다. 그런데 22차 모델에서는 σ_min 이 실수극에서 나오는 경우가
   있다 — 예: SCR 3.0 에서 σ_min = 3.5237 이 실수극 −3.5237 에서 나온다.
   그러면 가장 위험한 모드가 산점도에 보이지 않는다. 표는 실수극까지 전부 보여준다.

   값은 전부 서버가 준 것이다. 분류(진동/실수)와 정렬만 여기서 한다.
   band 는 주파수 기반 '대용' 분류다 — runner.py 주석대로 물리적 모드 귀속을
   확정하려면 참여계수가 필요하고, 논문에는 참여계수 근거를 써야 한다. */

import { useEffect, useMemo, useState } from 'react';
import { fetchJSON } from '../../lib/api';
import { CHART } from '../../lib/chartColors';

interface Eig { re: number; im: number }
interface Mode { zeta: number; f_hz: number; band: string; re: number; im: number }
interface PerSCR {
  eigenvalues?: Eig[];
  sigma_min?: number | null;
  zeta_min?: number | null;
  zeta_band?: string | null;
  n_osc_modes?: number | null;
  modes?: Mode[];
}

interface Props {
  /** 실행 결과 — 있으면 이것을 쓴다. 없으면 저장본을 조회한다. */
  computeResults?: Record<string, PerSCR> | null;
}

type Row = {
  kind: '진동' | '실수';
  re: number;
  im: number;
  zeta: number | null;
  f_hz: number | null;
  band: string | null;
  critical: boolean;
};

/** 고유값 목록 → 표 행. 진동쌍은 Im>0 하나로 접고, |Re| 가 가장 작은 것을 임계로 표시 */
function toRows(p: PerSCR): Row[] {
  const ev = p.eigenvalues ?? [];
  const modes = p.modes ?? [];
  const rows: Row[] = [];

  if (ev.length) {
    // 진동쌍은 Im > 0 쪽만 남긴다 (공액은 같은 모드다)
    for (const e of ev) {
      if (Math.abs(e.im) < 1e-4) {
        rows.push({ kind: '실수', re: e.re, im: 0, zeta: null, f_hz: null, band: null, critical: false });
      } else if (e.im > 0) {
        // 같은 고유값의 모드 정보를 붙인다 (zeta·f_hz·band 는 서버가 계산한 값)
        const m = modes.find(x => Math.abs(x.re - e.re) < 1e-6 && Math.abs(x.im - e.im) < 1e-6);
        rows.push({
          kind: '진동', re: e.re, im: e.im,
          zeta: m?.zeta ?? null, f_hz: m?.f_hz ?? null, band: m?.band ?? null,
          critical: false,
        });
      }
    }
  } else {
    // 전체 고유값이 없으면 진동 모드만이라도 보여준다 (실수극은 알 수 없다)
    for (const m of modes) {
      rows.push({ kind: '진동', re: m.re, im: m.im, zeta: m.zeta, f_hz: m.f_hz, band: m.band, critical: false });
    }
  }

  // 임계 = |Re| 최소 → σ_min 의 출처
  if (rows.length) {
    let k = 0;
    rows.forEach((r, i) => { if (Math.abs(r.re) < Math.abs(rows[k].re)) k = i; });
    rows[k].critical = true;
  }
  // 허수축에 가까운 순 (위험한 것부터)
  return rows.sort((a, b) => Math.abs(a.re) - Math.abs(b.re));
}

const BAND_COLOR: Record<string, string> = {
  sync: CHART.indigo, control: CHART.teal, lcl: CHART.amber,
};

export default function EigenvalueTable({ computeResults }: Props) {
  const [stored, setStored] = useState<Record<string, PerSCR> | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (computeResults) return;
    fetchJSON<{ by_SCR?: Record<string, PerSCR> }>('/eigenvalue_locus')
      .then(d => setStored(d.by_SCR ?? null))
      .catch(() => setErr('고유값을 불러오지 못했습니다 — Flask 가 떠 있는지 확인하세요.'));
  }, [computeResults]);

  const src = computeResults ?? stored;

  const perScr = useMemo(() => {
    if (!src) return [];
    return Object.entries(src)
      .map(([scr, p]) => ({ scr: parseFloat(scr), p, rows: toRows(p) }))
      .filter(x => Number.isFinite(x.scr) && x.rows.length)
      .sort((a, b) => b.scr - a.scr);
  }, [src]);

  const [openScr, setOpenScr] = useState<number | null>(null);
  const cur = perScr.find(x => x.scr === openScr) ?? perScr[0];

  if (err) return <p className="mono-clock" style={{ color: 'var(--error)', fontSize: 15 }}>{err}</p>;
  if (!perScr.length) return <p className="mono-clock" style={{ color: 'var(--outline)' }}>고유값 데이터 없음</p>;

  const nOsc = cur.rows.filter(r => r.kind === '진동').length;
  const nReal = cur.rows.filter(r => r.kind === '실수').length;
  const hasFull = (cur.p.eigenvalues?.length ?? 0) > 0;

  return (
    <div className="space-y-3">
      {/* SCR 고르기 */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="mono-clock" style={{ color: 'var(--outline)', fontSize: 14 }}>SCR</span>
        {perScr.map(x => {
          const on = x.scr === cur.scr;
          return (
            <button key={x.scr} onClick={() => setOpenScr(x.scr)}
              className="mono-label px-3 py-1 rounded-full"
              style={{
                fontSize: 13.5, cursor: 'pointer',
                border: `1px solid ${on ? 'var(--primary)' : 'var(--border)'}`,
                background: on ? 'var(--primary-container)' : 'transparent',
                color: on ? 'var(--primary)' : 'var(--outline)',
                fontWeight: on ? 600 : 400,
              }}>
              {x.scr.toFixed(1)}
            </button>
          );
        })}
        <span className="mono-clock" style={{ color: 'var(--outline)', fontSize: 13.5, marginLeft: 6 }}>
          진동 {nOsc} · 실수 {nReal}
          {cur.p.sigma_min != null && ` · σ_min ${cur.p.sigma_min.toFixed(4)}`}
          {cur.p.zeta_min != null && ` · ζ_min ${cur.p.zeta_min.toFixed(4)}`}
          {cur.p.zeta_band && ` (${cur.p.zeta_band})`}
        </span>
      </div>

      {!hasFull && (
        <p className="mono-clock" style={{ color: 'var(--secondary)', fontSize: 13.5, lineHeight: 1.6 }}>
          전체 고유값이 응답에 없어 <b>진동 모드만</b> 표시합니다. 실수극은 알 수 없습니다
          — σ_min 이 실수극에서 나오는 경우 임계 모드가 이 표에 없습니다.
        </p>
      )}

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['', '유형', 'Re(λ) [1/s]', 'Im(λ) [rad/s]', 'ζ', 'f [Hz]', '대역'].map((h, i) => (
                <th key={i} className="mono-label"
                  style={{
                    textAlign: i >= 2 && i <= 5 ? 'right' : 'left',
                    padding: '7px 10px', fontSize: 13, color: 'var(--outline)', whiteSpace: 'nowrap',
                  }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cur.rows.map((r, i) => (
              <tr key={i} style={{
                borderBottom: '1px solid var(--border)',
                background: r.critical ? 'var(--error-container)' : 'transparent',
              }}>
                <td style={{ padding: '6px 10px', width: 28 }}>
                  {r.critical && (
                    <span className="mono-label" title="|Re(λ)| 최소 — σ_min 의 출처"
                      style={{ fontSize: 12, color: 'var(--error)', fontWeight: 700 }}>▲</span>
                  )}
                </td>
                <td className="mono-clock" style={{ padding: '6px 10px', color: 'var(--on-surface-variant)' }}>
                  {r.kind}
                </td>
                <td className="mono-clock" style={{ padding: '6px 10px', textAlign: 'right', color: r.re > 0 ? 'var(--error)' : 'var(--on-surface)' }}>
                  {r.re.toFixed(3)}
                </td>
                <td className="mono-clock" style={{ padding: '6px 10px', textAlign: 'right', color: 'var(--on-surface)' }}>
                  {r.kind === '실수' ? '—' : `±${r.im.toFixed(2)}`}
                </td>
                <td className="mono-clock" style={{ padding: '6px 10px', textAlign: 'right', color: 'var(--on-surface)' }}>
                  {r.zeta == null ? '—' : r.zeta.toFixed(4)}
                </td>
                <td className="mono-clock" style={{ padding: '6px 10px', textAlign: 'right', color: 'var(--on-surface)' }}>
                  {r.f_hz == null ? '—' : r.f_hz.toFixed(2)}
                </td>
                <td style={{ padding: '6px 10px' }}>
                  {r.band && (
                    <span className="mono-label" style={{
                      fontSize: 12, padding: '2px 8px', borderRadius: 999,
                      border: `1px solid ${BAND_COLOR[r.band] ?? 'var(--border)'}`,
                      color: BAND_COLOR[r.band] ?? 'var(--outline)',
                    }}>{r.band}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mono-clock" style={{ color: 'var(--outline)', fontSize: 13, lineHeight: 1.7 }}>
        ▲ = |Re(λ)| 최소, σ_min 의 출처입니다. 진동 행의 Im 은 공액쌍이라 ±로 적었습니다
        (22차 고유값 {cur.p.eigenvalues?.length ?? '?'}개 = 진동 {nOsc}쌍 × 2 + 실수 {nReal}).
        <br />
        <b>대역은 주파수 기반 '대용' 분류입니다</b> — 물리적 모드 귀속을 확정하려면 참여계수가
        필요하고, 논문에는 참여계수 근거를 써야 합니다 (Simulation/runner.py 주석).
      </p>
    </div>
  );
}
