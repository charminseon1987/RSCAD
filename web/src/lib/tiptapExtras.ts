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
  }
}
