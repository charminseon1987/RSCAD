# web/ — GMF Labs 웹

```bash
npm install
copy .env.example .env      # Windows (mac: cp)
npm run dev                 # http://localhost:5173
```

| 경로 | 역할 | 의존 |
|---|---|---|
| `/store` | 지식 팩 → 로컬 두뇌 주입 | connect-ai Bridge `:4825` (익스텐션/데스크톱 앱 실행 중) |
| `/plaza` | 연구소 간 광장 (입장 목록 + 회의록) | Firebase RTDB `VITE_PLAZA_DB_URL` |
| `/download` | 포크한 익스텐션 릴리즈 링크 | `VITE_RELEASES_URL` |

배포: `npm run build` → `dist/` → Firebase Hosting(`firebase init hosting` → public=dist) 또는 GitHub Pages.

주의: `/store`는 브라우저 → `http://127.0.0.1:4825` 로컬 호출입니다. HTTPS 사이트에서 HTTP 로컬 호출은
브라우저가 Mixed Content로 막을 수 있으니, 배포 후 문제가 되면 Bridge에 `localhost` 예외를 두거나
`http://` 로 서비스하세요. (EZER가 같은 구조로 동작하므로 Chrome은 127.0.0.1 을 허용합니다.)
