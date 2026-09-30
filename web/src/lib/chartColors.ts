/* 차트 색 — docs/DESIGN_PROMPT.md 부록
   "차트 색은 인디고(주) · 틸 · 앰버 · 로즈(#F2839A, 경고/불안정) 순서."
   §9 는 무지개 팔레트를 금지한다.

   여기 값은 CSS 변수가 아니라 고정 hex 다. recharts 가 fill/stroke 를 SVG 속성으로
   내보내는 경로가 있어 var() 해석을 보장할 수 없기 때문이다. 대신 두 테마에서 모두
   읽히는 중간 톤을 골랐다. 축·툴팁처럼 CSS 로 들어가는 곳은 var() 를 쓴다. */

/** 기본 4색 — 순서가 의미를 갖는다 (주 → 보조 → 주의 → 경고) */
export const CHART = {
  indigo: '#7C8CF8',
  teal: '#3FBDB9',
  amber: '#E0A24F',
  rose: '#F2839A',
  violet: '#A48CF0',
} as const;

/** SCR 계열 — 계통이 강한 쪽(인디고)에서 약한 쪽(로즈)으로 간다.
    SCR 은 순서가 있는 값이라 범주형 무지개가 아니라 순차 스케일이 맞다. */
const SCR_SCALE = [CHART.indigo, CHART.violet, CHART.teal, CHART.amber, CHART.rose];

/** SCR 이 낮을수록(약계통) 경고색에 가까워진다 */
export function scrColor(scr: number): string {
  if (scr >= 3.0) return CHART.indigo;
  if (scr >= 2.0) return CHART.violet;
  if (scr >= 1.6) return CHART.teal;
  if (scr >= 1.3) return CHART.amber;
  return CHART.rose;
}

/** 순서만 필요한 계열용 */
export function seriesColor(i: number): string {
  return SCR_SCALE[i % SCR_SCALE.length];
}

/** 축 라벨·격자·툴팁 — 테마를 따라야 하므로 CSS 변수 */
export const AXIS = {
  label: 'var(--ink-3)',
  grid: 'var(--edge-soft)',
  tooltipBg: 'var(--opaque)',
  tooltipBorder: 'var(--edge-soft)',
  tooltipInk: 'var(--ink)',
} as const;
