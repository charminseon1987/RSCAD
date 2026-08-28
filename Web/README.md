# GFM Dashboard — 파일 구조

```
gfm_dashboard.html      마크업만. 로직·스타일 없음
css/dashboard.css       GFM Tokens 팔레트 + 컴포넌트
js/config.js            API 주소, 임계값(ZETA_TH·DUPV_TH), 색 상수 C, 기본 파라미터
js/util.js              isNum / fmt / set / addLog / sv / syncSliders
js/charts.js            drawEig · draw2D · drawMini · drawZeta · drawDupv
js/render.js            drawModes · updateOP
js/api.js               checkAPI · runJacobian · runScrSweep · runSweep · runPSO
                        · loadLatest · renderCli · applyPreset · resetAll
js/main.js              load / resize / 폴링 진입점
```

## 로드 순서

`config → util → charts → render → api → main`.
전부 클래식 스크립트라 전역 스코프를 공유합니다. `type="module"` 을 쓰지 않은 이유는
`file://` 로 직접 열 때 모듈이 CORS 로 차단되기 때문입니다. 더블클릭으로 열려면 이대로 두세요.

순서를 바꾸면 `config.js` 의 `C` / `ZETA_TH` 를 참조하는 파일이 깨집니다.

## 자주 만질 곳

| 하고 싶은 것 | 파일 |
|---|---|
| 임계값 변경 (0.64, 5%) | `js/config.js` |
| SCR 스윕 격자 변경 | `js/config.js` 의 `SCR_GRID` |
| 색 변경 | `css/dashboard.css` 의 `:root` **와** `js/config.js` 의 `C` (둘 다) |
| 차트 모양 | `js/charts.js` |
| 엔드포인트 추가 | `js/api.js` |

색이 두 곳에 있는 건 D3 가 SVG 속성에 실제 색 문자열을 요구하기 때문입니다.
`getComputedStyle` 로 CSS 변수를 읽어오게 바꿀 수 있지만 렌더마다 리플로가 생겨
지금은 상수로 두었습니다. 바꾸실 때 두 곳을 같이 고치세요.

## 백엔드 없이 테스트

```
python mock_api.py          # :5000 에 22차 런 데이터를 그대로 내주는 스텁
```
