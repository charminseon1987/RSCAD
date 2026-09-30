# Lab Scholar 디자인 프롬프트 — Liquid Glass × WebGL Fluid (Dark / Light)

> **사용법**: 이 폴더를 `lab-scholar/docs/design/` 아래에 두고, Cursor(Claude Code / Agent)에 아래 **[프롬프트 본문]**을 그대로 붙여넣으세요.
> 참고 자료는 같은 폴더의 `styles/lab-scholar.css`(정답 CSS), `lib/fluid.js`(수정된 유체 라이브러리), `reference/landing.html`(완성 화면)입니다.
> `.cursor/rules/lab-scholar-design.mdc`를 저장소 루트의 `.cursor/rules/`에 복사하면, 이후 모든 UI 작업에 이 규칙이 자동 적용됩니다.

---

## [프롬프트 본문]

너는 lab-scholar 웹(Stage 2, Next.js App Router + TypeScript)의 UI를 구현한다.
디자인의 정답은 `docs/design/lab-scholar-design/reference/landing.html`이고, CSS 정답은 `styles/lab-scholar.css`다.
**새로 디자인하지 말고, 이 디자인 시스템을 그대로 옮겨라.** 값(색·그림자·블러·반경·간격)을 임의로 바꾸지 않는다.

### 1. 디자인 방향 (한 줄)
어두운 심연(또는 밝은 안개) 위에 연구 팔레트의 유체가 흐르고, 그 위에 **얇은 유리 패널**이 떠 있는 화면. 장식은 유체 하나뿐이고, 나머지는 절제된 타이포와 유리.

### 2. 테마 구조
- `<html data-theme="dark|light">` 속성 하나로 전환. **다크가 기본.**
- 첫 방문: `prefers-color-scheme` 따름 → 사용자가 바꾸면 `localStorage["ls-theme"]`에 저장.
- **깜빡임 방지**: `<head>` 최상단 인라인 스크립트에서 렌더 전에 `data-theme`을 설정 (Next.js에서는 `app/layout.tsx`의 `<head>`에 `dangerouslySetInnerHTML` 스크립트, 또는 `next-themes`의 `attribute="data-theme"`).
- 모든 색은 CSS 변수로만 쓴다. 컴포넌트 안에 hex/rgba 직접 기입 금지 (예외: `lab-scholar.css`에 이미 있는 값).

### 3. 디자인 토큰

| 토큰 | Dark | Light | 용도 |
|---|---|---|---|
| `--bg` | `#070912` | `#F2F4FA` | 페이지 배경, 유체 BACK_COLOR |
| `--ink` | `#F1F3FA` | `#141A2E` | 본문·제목 |
| `--ink-2` | `#BCC3D8` | `#434C66` | 보조 문장 |
| `--ink-3` | `#8089A3` | `#6E7690` | 캡션·라벨 |
| `--accent` | `#9AA6FF` | `#5566E8` | 인디고 — 링크, 포커스 |
| `--teal` | `#5ED3CF` | `#138C89` | 킥커, 상태점, ▸ 표기 |
| `--amber` | `#F1B86A` | `#C27513` | ※ 표기, 그라데이션 끝 |
| `--violet` | `#B69CFF` | `#7B5CE0` | 보조 |
| `--glass` | 흰색 10%→3.5% | 흰색 62%→34% | 기본 유리 |
| `--glass-strong` | 흰색 16%→6% | 흰색 82%→58% | 로그인 카드, hover |
| `--edge` / `--edge-soft` | 흰 22% / 흰 8% | 흰 95% / 남색 8% | 림 하이라이트 / 테두리 |
| `--shadow` | `0 24px 60px rgba(0,0,0,.45)` | `0 20px 50px rgba(40,50,100,.14), 0 2px 6px …` | 떠 있는 느낌 |
| `--blur` | `blur(22px) saturate(160%)` | 동일 | backdrop-filter |
| `--on-solid` | `#0B0E19` | `#FFFFFF` | 주 버튼 글자 |
| `--field` | 남색 40% | 흰 70% | 입력칸 배경 |

**그라데이션 제목**: `linear-gradient(95deg, var(--accent), var(--teal) 55%, var(--amber))` + `background-clip:text`.
**유체 팔레트(색상 H)**: 0.64 인디고 · 0.72 바이올렛 · 0.49 틸 · 0.08 앰버. 이 4색 외 사용 금지.

### 4. 타이포그래피
- 본문: `IBM Plex Sans KR` 400/500/600/700, 대체 `Apple SD Gothic Neo, Malgun Gothic, system-ui`
- 숫자·코드·킥커: `IBM Plex Mono` 400/500
- 한글 줄바꿈: `word-break: keep-all` 전역 적용 (단어 중간에서 끊기지 않게)
- 크기: H1 `clamp(32px, 4vw, 54px)`, letter-spacing `-.045em`, line-height 1.04 · H2 `clamp(28px, 3.6vw, 42px)` · 본문 16px/1.65 · 캡션 12.5–13.5px
- 킥커: Mono 12.5px, `letter-spacing .12em`, 대문자, `--teal`

### 5. 컴포넌트 (클래스명은 CSS 정답과 동일하게)
1. **`.glass`** — 모든 패널의 기반. `--glass` 배경 + `--blur` + 1px `--edge-soft` 테두리 + 반경 24px + 안쪽 상단 하이라이트 + `--shadow`.
   `::before`로 **145° 림 하이라이트**(마스크로 1px 테두리만 남김) — 이게 "유리 느낌"의 핵심. 빼지 말 것.
   ⚠️ `::before`가 `position:absolute`이므로 `.glass` 요소는 반드시 `position:relative`. `all:unset` 쓰는 버튼에 `.glass`를 붙이면 림이 부모로 튀어나가는 버그가 있었음.
2. **내비** — `sticky` 캡슐(`border-radius:999px`), 좌측 브랜드(∿ 마크 26px, 인디고→틸 그라데이션), 우측 링크 · 테마 토글(38px 원형) · 주 버튼.
3. **버튼 `.btn`** — 캡슐, 600 15px. 기본은 유리. `.btn.solid` = `--ink` 배경 + `--on-solid` 글자(다크에선 흰 버튼, 라이트에선 남색 버튼). hover `translateY(-1px)`, active `scale(.98)`.
   ⚠️ 아이콘 전용 버튼은 `.btn.theme`처럼 **복합 선택자로 padding 0**을 줘야 함 (단일 클래스면 `.btn` padding에 밀려 아이콘 폭이 0이 됨). svg에 `flex:none`.
4. **태그 `.tag`** — 작은 유리 캡슐 + 빛나는 틸 점(6px, glow).
5. **로그인 카드 `.login`** — `--glass-strong`, 반경 30px, 패딩 30/28. 이메일 · 비밀번호(보기/숨기기) · 로그인 유지 · 비밀번호 찾기 · 주 버튼 · "또는" 구분선 · SSO · 접근 요청.
   입력칸 `.inp`: 반경 14px, `--field` 배경, 포커스 시 `--accent` 테두리 + 4px 링. 오류 시 테두리 `#F2839A` + 아래 안내문.
   "워크스페이스 열기" 등 로그인 유도 버튼 → 카드로 스크롤 + `flash` 애니메이션(1.1s, 인디고 링) + 이메일 포커스.
6. **기능 카드 `.card`** — 번호(Mono) · 제목 18px · 설명 14.5px. 예시 박스 `.ex`에 **▸(틸) = 논문 사실 / ※(앰버) = 연구자 해석 / [n] 출처(인디고 Mono)** 표기 체계를 그대로 사용.
7. **링크 카드 `.link`** — hover 시 `translateY(-3px)` + `--glass-strong`.

### 6. 레이아웃
- 컨테이너 `min(1120px, 100% - 40px)`.
- 히어로: `grid-template-columns: 1fr minmax(330px, 390px)`, gap 48px, 높이 `100svh - 70px`, 왼쪽 문구 · 오른쪽 로그인 카드. 980px 이하 1열.
- 섹션 상하 90px(모바일 64px). 기능 카드 4열 → 2열(980) → 1열(560).
- 히어로 문구 뒤에 **radial scrim**(`--scrim`)을 깔아 유체 위에서도 글자가 읽히게.
- 스크롤 시 `.veil`(아래쪽 그라데이션) 불투명도를 `scrollY / (0.9 × innerHeight)`로 올려 본문 가독성 확보.
- `env(safe-area-inset-*)` 패딩 유지 (모바일 노치 대응).

### 7. WebGL 유체 배경 (`lib/fluid.js`)
원본: PavelDoGreat/WebGL-Fluid-Simulation (MIT) — **저작권 표기를 푸터에 반드시 유지**.
이미 적용된 수정 (다시 원본으로 바꾸지 말 것):
- `<canvas id="fluid">` 고정 전체화면, `pointer-events:none`, z-index 0. 이벤트는 `window`에서 받음 → **클릭 없이 마우스 이동만으로** 흐름 생성. 터치는 `passive:true`로 스크롤을 막지 않음.
- dat.GUI · 홍보 배너 · 분석(ga) 코드 제거, 디더링 텍스처는 data URI로 인라인.
- 설정: `DENSITY_DISSIPATION 2.2`, `CURL 22`, `SPLAT_RADIUS 0.2`, `SPLAT_FORCE 4500`, `BLOOM_INTENSITY 0.25`, `BLOOM_THRESHOLD 0.75`, `SUNRAYS_WEIGHT 0.45`, 초기 splat 4개.
- 색 배율 `window.__dyeScale` — **다크 0.07 / 라이트 0.11** (유체 스크립트 실행 전에 설정).
- 외부 훅 `window.fluid = { config, splat(x, y, dx, dy, color?), burst(n) }` — 좌표는 0–1, y는 아래→위.

**테마 전환 시** (`applyTheme`):
```js
fluid.config.BACK_COLOR = light ? {r:242,g:244,b:250} : {r:7,g:9,b:18};
fluid.config.BLOOM = !light;     // 밝은 배경에선 빛번짐이 화면을 하얗게 만듦
fluid.config.SUNRAYS = !light;
window.__dyeScale = light ? 0.11 : 0.07;
```
상호작용: 버튼·카드 `mouseenter` 시 해당 요소 위치에서 작은 splat, 3.6초마다 화면 아래에서 위로 올라오는 splat 1개(`document.hidden`이면 생략), `Space` = 무작위 폭발.

**Next.js 이식**: `components/FluidBackground.tsx`를 `"use client"`로 만들고, `useEffect`에서 `lib/fluid.js`를 한 번만 실행(개발 모드 StrictMode 이중 실행 방지 가드 필요). `next/dynamic`으로 `ssr:false`. WebGL 초기화 실패 시 `<html class="no-webgl">` → `.fallback` 정적 그라데이션 표시.

### 8. 접근성 · 성능 (필수)
- `prefers-reduced-motion: reduce` → 등장 애니메이션·자동 splat 끔, 전환 없음.
- `prefers-reduced-transparency: reduce` → 유리를 불투명 `--opaque`로, 블러 제거.
- `backdrop-filter` 미지원 → `.glass` 배경을 `--glass-strong`으로.
- 포커스 링 `2px solid var(--accent)`, offset 3px. 모든 아이콘 버튼에 `aria-label`.
- 본문 대비: 유체 위 텍스트는 scrim 위에서만. 라이트에서 `text-shadow`는 흰색 계열.
- 탭이 숨겨지면 시뮬레이션 step 생략 (`document.hidden`).

### 9. 하지 말 것
- 보라-분홍 네온 그라데이션, 무지개 유체, 과한 글로우, 이모지 아이콘
- 유리 패널 중첩 3단 이상 (유리 위 유리 위 유리)
- 순수 `#000` / `#FFF` 배경
- 카드마다 다른 반경 (24 / 30 / 999만 사용, 입력칸 14)
- 유체 BLOOM을 라이트 테마에서 켜기

### 10. 완료 기준 (직접 확인 후 보고)
- [ ] 다크/라이트 전환 시 깜빡임 없음, 새로고침 후에도 선택 유지
- [ ] `reference/landing.html`과 나란히 놓고 색·반경·그림자·간격이 육안상 동일
- [ ] 테마 토글 아이콘이 두 테마 모두에서 보임 (폭 17px 확인)
- [ ] 마우스 이동만으로 유체가 생기고, 스크롤·클릭·입력이 막히지 않음
- [ ] 모바일(390px)에서 문구 → 로그인 카드 순서, 가로 스크롤 없음
- [ ] reduced-motion / reduced-transparency 설정에서 정상 표시
- [ ] 푸터에 WebGL-Fluid-Simulation MIT 표기

---

## 부록: 다른 화면에 적용할 때
대시보드·검색·비교표·라이브러리 화면도 같은 토큰과 `.glass`를 쓴다. 단, **유체 배경은 랜딩/로그인에만** 쓰고, 작업 화면에서는 유체 대신 정적 블롭 3개(인디고·틸·앰버, `filter: blur(80px)`, 40초 drift)로 바꿔 집중을 해치지 않게 한다. 차트 색은 인디고(주) · 틸 · 앰버 · 로즈(`#F2839A`, 경고/불안정) 순서.
