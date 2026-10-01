/* 내장 PDF 리더 — Zotero 리더가 하던 일을 여기서 한다.

   끌어서 고른 글을 5색 중 하나로 칠하면 그 발췌가 수집함 highlights 로 간다.
   좌표(rects)는 페이지 크기로 나눈 0~1 로 저장한다 — 확대율이 달라도 같은 자리에 뜬다.

   칠한 자리는 보기 전용이다 (pointer-events: none). 글을 고르는 층(textLayer)이
   맨 위에 있어야 선택이 끊기지 않기 때문이다 — 고치기·지우기·페이지 이동은
   아래 발췌 목록에서 한다. */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import * as pdfjs from 'pdfjs-dist';
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist';

pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

export interface Rect { x: number; y: number; w: number; h: number }
export interface Annot {
  id?: string; section: string; text: string; page?: string;
  color?: string; rects?: Rect[]; note?: string; created?: string;
}
export interface HiRule { color: string; mean: string; section: string }

interface Props {
  src: string;                       // /api/scholar/pdf/<cite_key>
  page: number;                      // 1부터. 부모가 들고 있어 목록에서 이동할 수 있다
  onPage: (n: number) => void;
  annots: Annot[];
  rules: HiRule[];
  onAdd: (a: Omit<Annot, 'id' | 'created'>) => Promise<unknown>;
  height?: number;
}

/* pdf.js 의 textLayer 는 calc(var(--scale-factor)*Npx) 로 글자 자리를 잡는다.
   그래서 --scale-factor 를 컨테이너에 심어야 한다. 아래가 필요한 최소 규칙이다 —
   pdf_viewer.css 전체를 들이면 앱의 다른 클래스와 부딪힌다. */
const TEXT_CSS = `
.pdfr-text { position:absolute; inset:0; overflow:hidden; line-height:1;
  text-size-adjust:none; forced-color-adjust:none; transform-origin:0 0;
  caret-color:CanvasText; z-index:2; }
.pdfr-text span, .pdfr-text br { color:transparent; position:absolute;
  white-space:pre; cursor:text; transform-origin:0% 0%; }
.pdfr-text ::selection { background:rgba(28,126,214,.30); }
.pdfr-text .endOfContent { display:block; position:absolute; inset:100% 0 0;
  z-index:-1; cursor:default; user-select:none; }
`;

const chip: React.CSSProperties = {
  fontSize: 13, padding: '5px 10px', borderRadius: 8, cursor: 'pointer',
  border: '1px solid var(--s-line)', background: 'var(--s-bg)', color: 'var(--ink)',
};

export default function PdfReader({ src, page, onPage, annots, rules, onAdd, height = 620 }: Props) {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [pages, setPages] = useState(0);
  const [scale, setScale] = useState(1.25);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);
  const [sel, setSel] = useState<{ text: string; rects: Rect[]; top: number; left: number } | null>(null);
  const [saving, setSaving] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const taskRef = useRef<RenderTask | null>(null);
  /* 앞 렌더가 끝났는지 알려 주는 약속. 같은 캔버스에 두 렌더가 겹치면 pdf.js 가
     거부한다 — StrictMode 가 효과를 두 번 실행하므로 반드시 줄을 세워야 한다. */
  const chainRef = useRef<Promise<unknown>>(Promise.resolve());

  /* ── 문서 열기 ── */
  useEffect(() => {
    let dead = false;
    setLoading(true); setErr(''); setDoc(null); setPages(0);
    const task = pdfjs.getDocument({ url: src });
    task.promise.then(d => {
      if (dead) { d.destroy(); return; }
      setDoc(d); setPages(d.numPages);
    }).catch(e => {
      if (!dead) setErr(String(e?.message || e).slice(0, 200));
    }).finally(() => { if (!dead) setLoading(false); });
    return () => { dead = true; task.destroy().catch(() => {}); };
  }, [src]);

  /* ── 페이지 그리기 ── */
  useEffect(() => {
    if (!doc) return;
    let dead = false;
    const n = Math.min(Math.max(page, 1), doc.numPages);
    setSel(null);

    doc.getPage(n).then(async pg => {
      if (dead) return;
      const vp = pg.getViewport({ scale });
      const canvas = canvasRef.current;
      const text = textRef.current;
      if (!canvas || !text) return;

      taskRef.current?.cancel();
      await chainRef.current.catch(() => {});   // 앞 렌더가 실제로 끝난 뒤에 시작한다
      if (dead) return;

      /* 캔버스는 화면 배율만큼 크게 그리고 CSS 로 줄인다 — 안 그러면 글자가 흐리다.
         크기를 넣는 순간 캔버스가 지워지므로 그리기 직전에 한다. */
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(vp.width * dpr);
      canvas.height = Math.floor(vp.height * dpr);
      setSize({ w: vp.width, h: vp.height });

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      /* 글자 층은 그림과 따로 간다 — 뒤에 줄 세우면 안 된다.
         pdf.js 의 캔버스 렌더는 requestAnimationFrame 으로 쪼개져 있어 탭이 가려지면
         멈춘다. 거기 묶어 두면 그림이 멈춘 동안 글을 고를 수조차 없게 된다. */
      text.textContent = '';
      text.style.setProperty('--scale-factor', String(scale));
      const tl = new pdfjs.TextLayer({
        textContentSource: pg.streamTextContent(),
        container: text, viewport: vp,
      });
      const textDone = tl.render().catch((e: any) => {
        if (!dead) setErr(`글자 층을 못 그렸습니다 — ${String(e?.message || e).slice(0, 150)}`);
      });

      const task = pg.render({
        canvasContext: ctx, viewport: vp,
        transform: dpr === 1 ? undefined : [dpr, 0, 0, dpr, 0, 0],
      });
      taskRef.current = task;
      chainRef.current = task.promise.catch(() => {});
      await Promise.all([
        textDone,
        task.promise.catch((e: any) => {
          /* 페이지를 빨리 넘기면 취소된다 — 그건 정상이다. 나머지는 삼키지 않는다,
             조용히 비면 왜 안 보이는지 알 길이 없다. */
          if (!dead && e?.name !== 'RenderingCancelledException') {
            setErr(String(e?.message || e).slice(0, 200));
          }
        }),
      ]);
    }).catch(e => { if (!dead) setErr(String(e?.message || e).slice(0, 200)); });

    return () => { dead = true; taskRef.current?.cancel(); };
  }, [doc, page, scale]);

  /* 페이지가 바뀌면 위로 — 아래쪽을 보던 자리에 다음 쪽이 걸려 있으면 혼란스럽다 */
  useLayoutEffect(() => { scrollRef.current?.scrollTo({ top: 0 }); }, [page]);

  /* ── 글을 고르면 색 막대를 띄운다 ── */
  const grab = () => {
    const s = window.getSelection();
    const box = wrapRef.current?.getBoundingClientRect();
    if (!s || s.isCollapsed || !box || !box.width || !box.height) { setSel(null); return; }
    const raw = s.toString().replace(/\s+/g, ' ').trim();
    if (raw.length < 2) { setSel(null); return; }
    /* 고른 자리가 이 페이지 안인지 — 밖이면 다른 데서 고른 글이다 */
    if (!wrapRef.current!.contains(s.anchorNode) && !wrapRef.current!.contains(s.focusNode)) {
      setSel(null); return;
    }

    const rects: Rect[] = [];
    const range = s.getRangeAt(0);
    for (const r of Array.from(range.getClientRects())) {
      if (r.width < 1 || r.height < 1) continue;
      rects.push({
        x: (r.left - box.left) / box.width,
        y: (r.top - box.top) / box.height,
        w: r.width / box.width,
        h: r.height / box.height,
      });
    }
    if (!rects.length) { setSel(null); return; }
    const first = rects[0];
    setSel({
      text: raw, rects,
      top: Math.max(first.y * box.height - 44, 2),
      left: Math.min(first.x * box.width, Math.max(box.width - 330, 0)),
    });
  };

  const paint = (rule: HiRule) => {
    if (!sel || saving) return;
    setSaving(true);
    onAdd({
      section: rule.section, color: rule.color, text: sel.text,
      page: String(page), rects: sel.rects,
    }).then(() => {
      setSel(null);
      window.getSelection()?.removeAllRanges();
    }).finally(() => setSaving(false));
  };

  const mine = annots.filter(a => String(a.page || '') === String(page) && (a.rects || []).length);
  const colorOf = (a: Annot) =>
    a.color || rules.find(r => r.section === a.section)?.color || '#f59f00';

  const go = (n: number) => onPage(Math.min(Math.max(n, 1), pages || 1));

  return (
    <div>
      <style>{TEXT_CSS}</style>

      {/* ── 도구 막대 ── */}
      <div className="flex items-center gap-2 flex-wrap" style={{ marginBottom: 8 }}>
        <button style={chip} onClick={() => go(page - 1)} disabled={page <= 1}>◀ 이전</button>
        <span style={{ fontSize: 14, color: 'var(--ink-2)' }}>
          <input type="number" value={page} min={1} max={pages || 1}
            onChange={e => go(+e.target.value || 1)}
            style={{ ...chip, width: 68, textAlign: 'right', padding: '4px 6px' }} />
          {' '}/ {pages || '—'} 쪽
        </span>
        <button style={chip} onClick={() => go(page + 1)} disabled={!pages || page >= pages}>다음 ▶</button>
        <span style={{ width: 10 }} />
        <button style={chip} onClick={() => setScale(s => Math.max(0.5, +(s - 0.25).toFixed(2)))}>축소</button>
        <span style={{ fontSize: 13, color: 'var(--ink-3)', minWidth: 46, textAlign: 'center' }}>
          {Math.round(scale * 100)}%
        </span>
        <button style={chip} onClick={() => setScale(s => Math.min(3, +(s + 0.25).toFixed(2)))}>확대</button>
        <button style={chip} onClick={() => {
          const box = scrollRef.current?.clientWidth;
          if (box && size.w) setScale(s => +Math.max(0.5, Math.min(3, s * ((box - 24) / size.w))).toFixed(2));
        }}>너비 맞춤</button>
        <span style={{ fontSize: 13, color: 'var(--ink-3)', marginLeft: 'auto' }}>
          이 쪽에 칠한 발췌 {mine.length}개
        </span>
      </div>

      {err && (
        <p style={{ fontSize: 14, color: 'var(--error)' }}>
          PDF 를 열지 못했습니다 — {err}
        </p>
      )}
      {loading && !err && (
        <p style={{ fontSize: 14, color: 'var(--ink-3)' }}>PDF 를 읽고 있습니다…</p>
      )}

      {/* ── 지면 ── */}
      <div ref={scrollRef} style={{
        maxHeight: height, overflow: 'auto', background: 'var(--s-bg)',
        border: '1px solid var(--s-line)', borderRadius: 10, padding: 12,
      }}>
        <div ref={wrapRef} onMouseUp={grab} onTouchEnd={grab}
          style={{
            position: 'relative', width: size.w || 'auto', height: size.h || 'auto',
            margin: '0 auto', boxShadow: '0 1px 8px rgba(0,0,0,.18)', background: '#fff',
          }}>
          <canvas ref={canvasRef} style={{
            width: size.w || 0, height: size.h || 0, display: 'block', position: 'relative', zIndex: 0,
          }} />

          {/* 칠한 자리 — 보기 전용 */}
          {mine.map((a, i) => (
            <div key={a.id || i}>
              {(a.rects || []).map((r, j) => (
                <div key={j} title={a.text.slice(0, 160)} style={{
                  position: 'absolute', pointerEvents: 'none', zIndex: 1,
                  left: `${r.x * 100}%`, top: `${r.y * 100}%`,
                  width: `${r.w * 100}%`, height: `${r.h * 100}%`,
                  background: colorOf(a), opacity: 0.32, mixBlendMode: 'multiply',
                  borderRadius: 2,
                }} />
              ))}
            </div>
          ))}

          <div ref={textRef} className="pdfr-text" />

          {/* 색 막대 — 고른 자리 위에 뜬다 */}
          {sel && (
            <div style={{
              position: 'absolute', zIndex: 3, top: sel.top, left: sel.left,
              display: 'flex', gap: 4, alignItems: 'center', padding: 5,
              background: 'var(--s-panel, #fff)', border: '1px solid var(--s-line)',
              borderRadius: 9, boxShadow: '0 2px 12px rgba(0,0,0,.22)',
            }}>
              {rules.map(r => (
                <button key={r.section} title={r.mean} disabled={saving}
                  onClick={() => paint(r)}
                  style={{
                    width: 26, height: 26, borderRadius: 7, cursor: 'pointer',
                    background: r.color, border: '1px solid rgba(0,0,0,.25)',
                  }} />
              ))}
              <button style={{ ...chip, padding: '4px 8px' }} onClick={() => {
                setSel(null); window.getSelection()?.removeAllRanges();
              }}>취소</button>
            </div>
          )}
        </div>
      </div>

      <p style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 8, lineHeight: 1.7 }}>
        글을 끌어서 고른 뒤 색을 누르면 그 발췌가 아래 목록으로 들어갑니다. 색이 곧 노트의 들어갈 자리입니다.
        {sel && <> · 고른 글 <strong>{sel.text.length}</strong>자</>}
      </p>
    </div>
  );
}
