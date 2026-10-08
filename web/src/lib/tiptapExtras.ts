/* Google Docs 툴바가 요구하지만 TipTap 공식 패키지에 없는 서식들.

   글꼴·글자크기는 textStyle 마크의 전역 속성으로, 줄간격·들여쓰기는 문단/제목 노드의
   전역 속성으로 붙인다. 전부 style 속성으로 직렬화되므로 editor.getJSON() 저장본에
   그대로 남고 다시 열면 복원된다 — Docs 화면은 마크다운이 아니라 문서 구조(JSON)를
   저장하기 때문에 이게 성립한다 (Docs.tsx:475).

   주의: 서버의 /docs/<id>/markdown 내보내기를 타면 이 네 가지는 떨어진다.
   Google Docs 를 마크다운으로 내보낼 때와 같고, 의도된 동작이다 — 마크다운에
   글꼴·색·줄간격을 담을 자리가 없다. */
import { Extension } from '@tiptap/core';

const px = (v: string) => (/^\d+(\.\d+)?$/.test(v) ? `${v}px` : v);

/* textStyle 마크에 글꼴·글자크기를 얹는다. TextStyle 확장이 먼저 로드돼 있어야 한다. */
export const TextFormat = Extension.create({
  name: 'textFormat',
  addOptions() {
    return { types: ['textStyle'] };
  },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (el: HTMLElement) => el.style.fontSize || null,
            renderHTML: (attrs: Record<string, any>) =>
              attrs.fontSize ? { style: `font-size: ${attrs.fontSize}` } : {},
          },
          fontFamily: {
            default: null,
            // 따옴표를 벗긴다 — 브라우저가 style 로 되돌려줄 때 "Noto Serif KR" 꼴이 된다
            parseHTML: (el: HTMLElement) => el.style.fontFamily?.replace(/['"]/g, '') || null,
            renderHTML: (attrs: Record<string, any>) =>
              attrs.fontFamily ? { style: `font-family: ${attrs.fontFamily}` } : {},
          },
        },
      },
    ];
  },
  addCommands(): any {
    return {
      setFontSize:
        (size: string) =>
        ({ chain }: any) =>
          chain().setMark('textStyle', { fontSize: size ? px(size) : null }).run(),
      setFontFamily:
        (family: string) =>
        ({ chain }: any) =>
          chain().setMark('textStyle', { fontFamily: family || null }).run(),
      unsetTextFormat:
        () =>
        ({ chain }: any) =>
          chain()
            .setMark('textStyle', { fontSize: null, fontFamily: null })
            .removeEmptyTextStyle()
            .run(),
    };
  },
});

/* 문단·제목에 줄간격과 들여쓰기를 얹는다. 들여쓰기는 단계(0~8)로 세고
   한 단계를 40px 로 그린다 — Google Docs 의 기본 탭 간격과 같다. */
export const INDENT_STEP = 40;
export const MAX_INDENT = 8;

export const BlockFormat = Extension.create({
  name: 'blockFormat',
  addOptions() {
    return { types: ['paragraph', 'heading'] };
  },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          lineHeight: {
            default: null,
            parseHTML: (el: HTMLElement) => el.style.lineHeight || null,
            renderHTML: (attrs: Record<string, any>) =>
              attrs.lineHeight ? { style: `line-height: ${attrs.lineHeight}` } : {},
          },
          indent: {
            default: 0,
            parseHTML: (el: HTMLElement) => {
              const m = parseInt(el.style.marginLeft || '0', 10);
              return m ? Math.round(m / INDENT_STEP) : 0;
            },
            renderHTML: (attrs: Record<string, any>) =>
              attrs.indent ? { style: `margin-left: ${attrs.indent * INDENT_STEP}px` } : {},
          },
        },
      },
    ];
  },
  addCommands(): any {
    /* 고른 범위 안의 문단·제목 전부에 같은 변화를 준다. 한 번에 한 노드만 바꾸면
       여러 문단을 긁어 놓고 눌렀을 때 첫 문단만 움직여 고장난 것처럼 보인다. */
    const each =
      (fn: (cur: number) => number | null, key: 'indent' | 'lineHeight') =>
      () =>
      ({ state, tr, dispatch }: any) => {
        const { from, to } = state.selection;
        let touched = false;
        state.doc.nodesBetween(from, to, (node: any, pos: number) => {
          if (!this.options.types.includes(node.type.name)) return;
          const next = fn(node.attrs[key] ?? 0);
          if (next === null) return;
          tr.setNodeMarkup(pos, undefined, { ...node.attrs, [key]: next });
          touched = true;
        });
        if (touched && dispatch) dispatch(tr);
        return touched;
      };

    return {
      indentBlock: each(
        (c: number) => (c >= MAX_INDENT ? null : c + 1),
        'indent'
      ),
      outdentBlock: each((c: number) => (c <= 0 ? null : c - 1), 'indent'),
      setLineHeight:
        (h: string) =>
        ({ state, tr, dispatch }: any) => {
          const { from, to } = state.selection;
          let touched = false;
          state.doc.nodesBetween(from, to, (node: any, pos: number) => {
            if (!this.options.types.includes(node.type.name)) return;
            tr.setNodeMarkup(pos, undefined, { ...node.attrs, lineHeight: h || null });
            touched = true;
          });
          if (touched && dispatch) dispatch(tr);
          return touched;
        },
    };
  },
});

/* ── 제안 모드 ──────────────────────────────────────────────────────────
   Google Docs 의 '제안' 에 해당한다. 켜 두면 글이 바로 바뀌지 않고 자국만 남는다:
   새로 친 글자는 <ins> 로, 지운 글자는 지우지 않고 <del> 로 표시한다. 그 뒤에
   모두 수락 / 모두 취소로 한 번에 정리한다.

   낱개 수락·거절은 아직 없다 — 자국 단위로 끊어 세는 UI 가 더 필요하다.
   지금은 문서 전체 단위로만 정리된다. */
import { Mark } from '@tiptap/core';
import { Plugin, TextSelection } from '@tiptap/pm/state';

export const SuggestInsert = Mark.create({
  name: 'suggestInsert',
  inclusive: true,
  parseHTML() { return [{ tag: 'ins[data-suggest]' }]; },
  renderHTML({ HTMLAttributes }) {
    return ['ins', { ...HTMLAttributes, 'data-suggest': 'insert' }, 0];
  },
});

export const SuggestDelete = Mark.create({
  name: 'suggestDelete',
  inclusive: false,
  parseHTML() { return [{ tag: 'del[data-suggest]' }]; },
  renderHTML({ HTMLAttributes }) {
    return ['del', { ...HTMLAttributes, 'data-suggest': 'delete' }, 0];
  },
});

/* 표시된 자국의 범위를 모아 준다. 뒤에서부터 지워야 앞쪽 위치가 밀리지 않는다. */
const ranges = (doc: any, markName: string) => {
  const out: { from: number; to: number }[] = [];
  doc.descendants((node: any, pos: number) => {
    if (!node.isText) return;
    if (node.marks.some((m: any) => m.type.name === markName)) {
      const last = out[out.length - 1];
      if (last && last.to === pos) last.to = pos + node.nodeSize;
      else out.push({ from: pos, to: pos + node.nodeSize });
    }
  });
  return out;
};

export const SuggestMode = Extension.create({
  name: 'suggestMode',
  addStorage() {
    return { on: false };
  },
  addCommands(): any {
    return {
      setSuggesting:
        (on: boolean) =>
        ({ editor }: any) => {
          editor.storage.suggestMode.on = on;
          return true;
        },
      /* 수락 — 새로 친 글자는 그대로 두고 자국만 떼고, 지운다고 표시한 글자는 진짜 지운다 */
      acceptSuggestions:
        () =>
        ({ state, tr, dispatch }: any) => {
          const del = ranges(state.doc, 'suggestDelete');
          const ins = ranges(state.doc, 'suggestInsert');
          ins.forEach(r => tr.removeMark(r.from, r.to, state.schema.marks.suggestInsert));
          del.slice().reverse().forEach(r => tr.delete(tr.mapping.map(r.from), tr.mapping.map(r.to)));
          if (dispatch) dispatch(tr);
          return true;
        },
      /* 취소 — 새로 친 글자를 지우고, 지운다고 표시했던 글자는 되살린다 */
      rejectSuggestions:
        () =>
        ({ state, tr, dispatch }: any) => {
          const del = ranges(state.doc, 'suggestDelete');
          const ins = ranges(state.doc, 'suggestInsert');
          del.forEach(r => tr.removeMark(r.from, r.to, state.schema.marks.suggestDelete));
          ins.slice().reverse().forEach(r => tr.delete(tr.mapping.map(r.from), tr.mapping.map(r.to)));
          if (dispatch) dispatch(tr);
          return true;
        },
    };
  },
  addProseMirrorPlugins() {
    const ext = this;
    return [
      new Plugin({
        props: {
          /* 친 글자에 ins 자국을 달아 넣는다 */
          handleTextInput(view, from, to, text) {
            if (!ext.storage.on) return false;
            const m = view.state.schema.marks.suggestInsert.create();
            const tr = view.state.tr.insertText(text, from, to);
            tr.addMark(from, from + text.length, m);
            view.dispatch(tr);
            return true;
          },
          /* 지우는 대신 del 자국만 남긴다. 이미 ins 자국인 글자는 내가 방금 친
             것이므로 그냥 지운다 — 제안 안에서 오타를 고칠 수 있어야 한다. */
          handleKeyDown(view, ev) {
            if (!ext.storage.on) return false;
            if (ev.key !== 'Backspace' && ev.key !== 'Delete') return false;
            const { state } = view;
            let { from, to } = state.selection;
            if (from === to) {
              if (ev.key === 'Backspace') from = Math.max(0, from - 1);
              else to = Math.min(state.doc.content.size, to + 1);
            }
            if (from >= to) return true;

            const insMark = state.schema.marks.suggestInsert;
            const onlyMine = state.doc.rangeHasMark(from, to, insMark);
            const tr = state.tr;
            if (onlyMine) {
              tr.delete(from, to);
            } else {
              tr.addMark(from, to, state.schema.marks.suggestDelete.create());
              const at = ev.key === 'Backspace' ? from : to;
              tr.setSelection(TextSelection.create(tr.doc, Math.min(at, tr.doc.content.size)));
            }
            view.dispatch(tr);
            return true;
          },
        },
      }),
    ];
  },
});

/* addCommands() 로 만든 명령은 런타임에만 생긴다 — TypeScript 는 모른다.
   선언을 붙이지 않으면 editor.chain().setFontSize(...) 가 타입 오류로 막혀
   `npm run build`(tsc -b && vite build) 가 깨진다. 실제로 깨져 있었다. */
declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    textFormat: {
      setFontSize: (size: string) => ReturnType;
      setFontFamily: (family: string) => ReturnType;
      unsetTextFormat: () => ReturnType;
    };
    blockFormat: {
      indentBlock: () => ReturnType;
      outdentBlock: () => ReturnType;
      setLineHeight: (height: string) => ReturnType;
    };
    suggestMode: {
      setSuggesting: (on: boolean) => ReturnType;
      acceptSuggestions: () => ReturnType;
      rejectSuggestions: () => ReturnType;
    };
  }
}
