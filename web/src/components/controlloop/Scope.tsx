/* 오실로스코프 한 채널 — canvas 는 React 로 리렌더하지 않는다.
   부모의 RAF 루프가 draw(data, win) 를 직접 호출한다. */

import { forwardRef, useImperativeHandle, useRef } from 'react';

export interface Sample { t: number; [k: string]: number }

export interface ScopeHandle {
  draw(data: Sample[], win: number): void;
  /** 헤더 우측의 현재값 표시 */
  setReadout(text: string): void;
}

interface Props {
  title: React.ReactNode;
  /** 그릴 키 (Sample 의 필드명) */
  keys: string[];
  /** 키별 CSS 변수명 */
  cols: string[];
  /** 자동 스케일 최소 여유 — 주파수처럼 변화가 작은 신호는 더 좁게 */
  minPad?: number;
}

const Scope = forwardRef<ScopeHandle, Props>(function Scope({ title, keys, cols, minPad = 0.05 }, ref) {
  const cvRef = useRef<HTMLCanvasElement>(null);
  const outRef = useRef<HTMLSpanElement>(null);

  useImperativeHandle(ref, () => ({
    setReadout(text) {
      if (outRef.current) outRef.current.textContent = text;
    },

    draw(data, win) {
      const cv = cvRef.current;
      if (!cv) return;
      const dpr = window.devicePixelRatio || 1;
      const W = cv.clientWidth;
      const H = cv.clientHeight;
      if (!W || !H) return;
      if (cv.width !== Math.round(W * dpr)) {
        cv.width = Math.round(W * dpr);
        cv.height = Math.round(H * dpr);
      }
      const g = cv.getContext('2d');
      if (!g) return;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, W, H);
      if (data.length < 2) return;

      const cs = getComputedStyle(cv);
      const css = (v: string) => cs.getPropertyValue(v).trim() || '#888';

      let lo = Infinity, hi = -Infinity;
      for (const d of data) {
        for (const k of keys) {
          const v = d[k];
          if (Number.isFinite(v)) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
        }
      }
      if (!Number.isFinite(lo) || !Number.isFinite(hi)) return;
      const pad = Math.max((hi - lo) * 0.15, minPad);
      lo -= pad; hi += pad;
      const span = hi - lo || 1;

      const t0 = data[data.length - 1].t - win;
      const X = (tt: number) => (tt - t0) / win * (W - 38) + 34;
      const Y = (v: number) => H - 6 - (v - lo) / span * (H - 14);

      g.strokeStyle = css('--line');
      g.lineWidth = 1;
      g.font = '10px IBM Plex Mono, ui-monospace, monospace';
      g.fillStyle = css('--ink-3');
      for (let k = 0; k <= 2; k++) {
        const v = lo + span * k / 2;
        const y = Y(v);
        g.beginPath(); g.moveTo(34, y); g.lineTo(W, y); g.stroke();
        g.fillText(v.toFixed(Math.abs(v) > 10 ? 2 : 3), 2, y + 3);
      }

      keys.forEach((k, j) => {
        g.strokeStyle = css(cols[j]);
        g.lineWidth = k === 'Pref' ? 1 : 1.6;
        g.setLineDash(k === 'Pref' ? [4, 3] : []);
        g.beginPath();
        data.forEach((d, i) => {
          const px = X(d.t), py = Y(d[k]);
          if (i) g.lineTo(px, py); else g.moveTo(px, py);
        });
        g.stroke();
      });
      g.setLineDash([]);
    },
  }), [keys, cols, minPad]);

  return (
    <div className="cl-scope">
      <h3>
        <span>{title}</span>
        <span ref={outRef} className="cl-readout">—</span>
      </h3>
      <canvas ref={cvRef} />
    </div>
  );
});

export default Scope;
