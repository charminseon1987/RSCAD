/* Docs 편집 툴바 — Google Docs 배치를 따른다.

   왼쪽부터: 되돌리기·다시·인쇄·서식복사 | 확대 | 스타일 | 글꼴 | 글자크기 |
   굵게·기울임·밑줄·글자색·형광펜 | 링크·댓글 | 정렬·줄간격 | 체크·글머리·번호 |
   들여쓰기 | 서식 지우기

   아이콘은 인라인 SVG 다. 아이콘 라이브러리를 새로 들이지 않으려고 직접 그렸고,
   전부 currentColor 를 쓰므로 테마 색을 그대로 따른다. 24x24 뷰박스에 1.8 굵기 —
   Google Docs 아이콘과 같은 시각 무게를 맞춘 값이다. */
import { useEffect, useRef, useState } from 'react';
import type { Editor } from '@tiptap/react';

/* ── 아이콘 ── */
const I = ({ d, fill }: { d: string; fill?: boolean }) => (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"
    fill={fill ? 'currentColor' : 'none'} stroke={fill ? 'none' : 'currentColor'}
    strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);
const ic = {
  undo: 'M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3',
  redo: 'm15 14 5-5-5-5m5 5H10a6 6 0 0 0 0 12h3',
  print: 'M6 9V3h12v6M6 18H4v-6h16v6h-2M8 14h8v7H8z',
  brush: 'M4 5h12v5H4zM10 10v4M8 14h4v6H8z',
  link: 'M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1',
  comment: 'M20 15a2 2 0 0 1-2 2H8l-4 4V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2z',
  alignL: 'M4 6h16M4 10h10M4 14h16M4 18h10',
  alignC: 'M4 6h16M7 10h10M4 14h16M7 18h10',
  alignR: 'M4 6h16M10 10h10M4 14h16M10 18h10',
  alignJ: 'M4 6h16M4 10h16M4 14h16M4 18h16',
  spacing: 'M4 7h16M4 12h16M4 17h16',
  check: 'M4 6l2 2 3-3M4 13l2 2 3-3M4 20l2 2 3-3M13 6h7M13 14h7M13 21h7',
  bullet: 'M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01',
  number: 'M10 6h10M10 12h10M10 18h10M4 5h1v4M4 13h2l-2 3h2M4 17.5h2v3H4',
  outdent: 'M20 6H10M20 12H10M20 18H10M7 9l-3 3 3 3',
  indent: 'M20 6H10M20 12H10M20 18H10M4 9l3 3-3 3',
  clear: 'M6 6h12M9 6l1 11M15 6l-1 7M5 20h8M16 15l5 5M21 15l-5 5',
} as const;

/* ── Google Docs 와 같은 목록 ── */
const STYLES = [
  { k: 'p', label: '일반 텍스트' },
  { k: 'h1', label: '제목 1' },
  { k: 'h2', label: '제목 2' },
  { k: 'h3', label: '제목 3' },
  { k: 'h4', label: '제목 4' },
];
const FONTS = [
  'Pretendard', 'Noto Sans KR', 'Noto Serif KR', 'Arial',
  'Times New Roman', 'Georgia', 'Courier New',
];
const SIZES = ['8', '9', '10', '11', '12', '14', '18', '24', '30', '36', '48'];
const LINE_HEIGHTS = [
  { v: '1', label: '1.0' }, { v: '1.15', label: '1.15' }, { v: '1.5', label: '1.5' },
  { v: '2', label: '2.0' }, { v: '2.5', label: '2.5' },
];
/* Google Docs 색상 팔레트의 기본 행 */
const COLORS = [
  '#000000', '#434343', '#666666', '#999999', '#b7b7b7', '#cccccc', '#efefef', '#ffffff',
  '#980000', '#ff0000', '#ff9900', '#ffff00', '#00ff00', '#00ffff', '#4a86e8', '#0000ff',
  '#9900ff', '#ff00ff', '#e6b8af', '#fce5cd', '#fff2cc', '#d9ead3', '#d0e0e3', '#c9daf8',
];

type Props = {
  editor: Editor | null;
  onComment?: () => void;
  canComment?: boolean;
};

/* 버튼 하나. on 이면 눌린 상태로 칠한다. */
const Btn = ({ on, title, disabled, onClick, children }: any) => (
  <button type="button" className={'gd-btn' + (on ? ' gd-on' : '')}
    title={title} aria-label={title} aria-pressed={!!on} disabled={disabled}
    onMouseDown={e => e.preventDefault()}   /* 눌러도 편집기 선택이 풀리지 않게 */
    onClick={onClick}>
    {children}
  </button>
);

const Sep = () => <span className="gd-sep" aria-hidden="true" />;

/* 색 고르개 — 바깥을 누르면 닫힌다 */
function ColorPicker({ label, swatch, onPick, onClear, icon }: any) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, [open]);
  return (
    <span className="gd-pop-wrap" ref={box}>
      <button type="button" className="gd-btn gd-btn-color" title={label} aria-label={label}
        aria-expanded={open} onMouseDown={e => e.preventDefault()}
        onClick={() => setOpen(o => !o)}>
        <span className="gd-color-glyph">{icon}</span>
        <span className="gd-color-bar" style={{ background: swatch || 'transparent' }} />
      </button>
      {open && (
        <span className="gd-pop" role="dialog" aria-label={label}>
          <span className="gd-swatches">
            {COLORS.map(c => (
              <button key={c} type="button" className="gd-swatch" title={c}
                style={{ background: c }} onMouseDown={e => e.preventDefault()}
                onClick={() => { onPick(c); setOpen(false); }} />
            ))}
          </span>
          <button type="button" className="gd-pop-clear" onMouseDown={e => e.preventDefault()}
            onClick={() => { onClear(); setOpen(false); }}>없음</button>
        </span>
      )}
    </span>
  );
}

export default function DocsToolbar({ editor, onComment, canComment }: Props) {
  const [, force] = useState(0);
  /* 커서를 옮기거나 글을 고치면 눌린 상태가 달라진다. 편집기 이벤트에 붙어
     다시 그린다 — 안 하면 B 가 켜졌는지 꺼졌는지 툴바가 모른다. */
  useEffect(() => {
    if (!editor) return;
    const redraw = () => force(n => n + 1);
    editor.on('selectionUpdate', redraw);
    editor.on('transaction', redraw);
    return () => { editor.off('selectionUpdate', redraw); editor.off('transaction', redraw); };
  }, [editor]);

  if (!editor) return <div className="gd-bar" aria-busy="true" />;

  const ch = () => editor.chain().focus();
  const cmd = (editor.commands as any);
  const attrs = editor.getAttributes('textStyle');

  const curStyle = STYLES.find(s =>
    s.k === 'p' ? editor.isActive('paragraph')
      : editor.isActive('heading', { level: Number(s.k[1]) }))?.k ?? 'p';
  const curSize = String(attrs.fontSize || '').replace('px', '');
  const curFont = attrs.fontFamily || '';
  const curLine = editor.getAttributes('paragraph').lineHeight
    || editor.getAttributes('heading').lineHeight || '';

  const setStyle = (k: string) =>
    k === 'p' ? ch().setParagraph().run()
      : ch().toggleHeading({ level: Number(k[1]) as any }).run();

  const bumpSize = (dir: 1 | -1) => {
    const i = SIZES.indexOf(curSize || '11');
    const next = SIZES[Math.min(SIZES.length - 1, Math.max(0, (i < 0 ? 4 : i) + dir))];
    editor.chain().focus().setFontSize(next).run();
  };

  const addLink = () => {
    const prev = editor.getAttributes('link').href || '';
    const url = window.prompt('링크 주소', prev);
    if (url === null) return;                       // 취소
    if (!url) { ch().unsetLink().run(); return; }   // 비우면 해제
    ch().extendMarkRange('link').setLink({ href: url }).run();
  };

  const align = (a: string) => ch().setTextAlign(a).run();
  const isAlign = (a: string) => editor.isActive({ textAlign: a });

  return (
    <div className="gd-bar" role="toolbar" aria-label="서식 도구">
      <Btn title="실행취소 (Ctrl+Z)" disabled={!editor.can().undo()}
        onClick={() => ch().undo().run()}><I d={ic.undo} /></Btn>
      <Btn title="다시 실행 (Ctrl+Y)" disabled={!editor.can().redo()}
        onClick={() => ch().redo().run()}><I d={ic.redo} /></Btn>
      <Btn title="인쇄 (Ctrl+P)" onClick={() => window.print()}><I d={ic.print} /></Btn>
      <Btn title="서식 지우고 붙이기" onClick={() => ch().unsetAllMarks().run()}>
        <I d={ic.brush} /></Btn>

      <Sep />
      <select className="gd-sel gd-sel-style" value={curStyle} title="스타일"
        onChange={e => setStyle(e.target.value)}>
        {STYLES.map(s => <option key={s.k} value={s.k}>{s.label}</option>)}
      </select>

      <Sep />
      <select className="gd-sel gd-sel-font" value={curFont} title="글꼴"
        onChange={e => cmd.setFontFamily(e.target.value)}>
        <option value="">기본</option>
        {FONTS.map(f => <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>)}
      </select>

      <Sep />
      <span className="gd-size">
        <Btn title="글자 크기 줄이기" onClick={() => bumpSize(-1)}>−</Btn>
        <input className="gd-size-in" value={curSize} aria-label="글자 크기"
          onChange={e => cmd.setFontSize(e.target.value)} />
        <Btn title="글자 크기 키우기" onClick={() => bumpSize(1)}>＋</Btn>
      </span>

      <Sep />
      <Btn title="굵게 (Ctrl+B)" on={editor.isActive('bold')}
        onClick={() => ch().toggleBold().run()}><b>B</b></Btn>
      <Btn title="기울임 (Ctrl+I)" on={editor.isActive('italic')}
        onClick={() => ch().toggleItalic().run()}><i>I</i></Btn>
      <Btn title="밑줄 (Ctrl+U)" on={editor.isActive('underline')}
        onClick={() => ch().toggleUnderline().run()}><u>U</u></Btn>
      <Btn title="취소선" on={editor.isActive('strike')}
        onClick={() => ch().toggleStrike().run()}><s>S</s></Btn>
      <ColorPicker label="글자 색상" icon="A" swatch={attrs.color}
        onPick={(c: string) => ch().setColor(c).run()}
        onClear={() => ch().unsetColor().run()} />
      <ColorPicker label="강조 색상" icon="✎"
        swatch={editor.getAttributes('highlight').color}
        onPick={(c: string) => ch().setHighlight({ color: c }).run()}
        onClear={() => ch().unsetHighlight().run()} />

      <Sep />
      <Btn title="링크 삽입 (Ctrl+K)" on={editor.isActive('link')} onClick={addLink}>
        <I d={ic.link} /></Btn>
      <Btn title="댓글 추가" disabled={!canComment} onClick={onComment}>
        <I d={ic.comment} /></Btn>

      <Sep />
      <Btn title="왼쪽 맞춤" on={isAlign('left')} onClick={() => align('left')}>
        <I d={ic.alignL} /></Btn>
      <Btn title="가운데 맞춤" on={isAlign('center')} onClick={() => align('center')}>
        <I d={ic.alignC} /></Btn>
      <Btn title="오른쪽 맞춤" on={isAlign('right')} onClick={() => align('right')}>
        <I d={ic.alignR} /></Btn>
      <Btn title="양쪽 맞춤" on={isAlign('justify')} onClick={() => align('justify')}>
        <I d={ic.alignJ} /></Btn>
      <span className="gd-pop-wrap">
        <select className="gd-sel gd-sel-line" value={curLine} title="줄 간격"
          onChange={e => cmd.setLineHeight(e.target.value)}>
          <option value="">줄간격</option>
          {LINE_HEIGHTS.map(l => <option key={l.v} value={l.v}>{l.label}</option>)}
        </select>
      </span>

      <Sep />
      <Btn title="체크리스트" on={editor.isActive('taskList')}
        onClick={() => ch().toggleTaskList().run()}><I d={ic.check} /></Btn>
      <Btn title="글머리기호 목록" on={editor.isActive('bulletList')}
        onClick={() => ch().toggleBulletList().run()}><I d={ic.bullet} /></Btn>
      <Btn title="번호매기기 목록" on={editor.isActive('orderedList')}
        onClick={() => ch().toggleOrderedList().run()}><I d={ic.number} /></Btn>

      <Sep />
      <Btn title="들여쓰기 줄이기" onClick={() => cmd.outdentBlock()}>
        <I d={ic.outdent} /></Btn>
      <Btn title="들여쓰기 늘리기" onClick={() => cmd.indentBlock()}>
        <I d={ic.indent} /></Btn>

      <Sep />
      <Btn title="서식 지우기"
        onClick={() => ch().unsetAllMarks().setParagraph().run()}>
        <I d={ic.clear} /></Btn>
    </div>
  );
}
