/* 테마 — docs/DESIGN_PROMPT.md §2 · §7

   다크가 기본. 첫 방문은 prefers-color-scheme 을 따르고, 사용자가 바꾸면
   localStorage['ls-theme'] 에 저장한다. 렌더 전 초기화는 web/index.html 의
   인라인 스크립트가 맡는다 (깜빡임 방지) — 여기서는 그 뒤의 전환만 담당한다.

   테마를 바꾸면 유체 배경도 함께 바꿔야 한다. 밝은 배경에서 BLOOM 을 켜 두면
   빛번짐이 화면을 하얗게 만든다(§7). 유체가 떠 있지 않을 때는 조용히 넘어간다. */

export type Theme = 'dark' | 'light';

const KEY = 'ls-theme';

/** 유체 스크립트가 읽는 색 배율 — 다크 0.07 / 라이트 0.11 (§7) */
const DYE_SCALE: Record<Theme, number> = { dark: 0.07, light: 0.11 };
const BACK_COLOR: Record<Theme, { r: number; g: number; b: number }> = {
  dark: { r: 7, g: 9, b: 18 },        // #070912
  light: { r: 242, g: 244, b: 250 },  // #F2F4FA
};

interface FluidHook {
  config: Record<string, unknown>;
}

export function getTheme(): Theme {
  // 라이트가 기본 — index.html 의 인라인 스크립트가 렌더 전에 속성을 심는다
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

/** 저장된 선택이 있는가 — 없으면 시스템 설정을 따르는 상태다 */
export function hasStoredTheme(): boolean {
  try {
    const t = localStorage.getItem(KEY);
    return t === 'light' || t === 'dark';
  } catch { return false; }
}

export function applyTheme(theme: Theme, persist = true): void {
  // 항상 명시한다 — 속성을 지우면 :root 의 다크 값이 드러난다
  document.documentElement.setAttribute('data-theme', theme);

  if (persist) {
    try { localStorage.setItem(KEY, theme); } catch { /* 프라이빗 모드 */ }
  }

  // 유체 스크립트는 실행 전에 이 값을 읽는다 — 항상 먼저 세팅한다
  (window as unknown as { __dyeScale?: number }).__dyeScale = DYE_SCALE[theme];

  const fluid = (window as unknown as { fluid?: FluidHook }).fluid;
  if (fluid?.config) {
    const light = theme === 'light';
    fluid.config.BACK_COLOR = BACK_COLOR[theme];
    fluid.config.BLOOM = !light;     // 밝은 배경에선 빛번짐이 화면을 하얗게 만든다
    fluid.config.SUNRAYS = !light;
  }
}

export function toggleTheme(): Theme {
  const next: Theme = getTheme() === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  return next;
}
