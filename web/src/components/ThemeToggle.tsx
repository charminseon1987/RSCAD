/* 테마 토글 — docs/DESIGN_PROMPT.md §5-2 (38px 원형)

   아이콘 전용 버튼이므로 .btn.theme 복합 선택자로 padding 0 을 받는다.
   단일 클래스만 쓰면 .btn 의 padding 에 밀려 아이콘 폭이 0 이 된다(스펙 §5-3 경고). */

import { useEffect, useState } from 'react';
import { applyTheme, getTheme, toggleTheme, type Theme } from '../lib/theme';

export default function ThemeToggle({ className = '' }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>('light');

  useEffect(() => {
    // index.html 의 인라인 스크립트가 이미 정한 값을 읽어 온다
    const t = getTheme();
    setTheme(t);
    applyTheme(t, false);          // 유체 배율·BACK_COLOR 를 현재 테마에 맞춘다
  }, []);

  return (
    <button
      type="button"
      className={`btn theme ${className}`}
      onClick={() => setTheme(toggleTheme())}
      aria-label={theme === 'light' ? '다크 테마로 전환' : '라이트 테마로 전환'}
      title={theme === 'light' ? '다크 테마' : '라이트 테마'}
    >
      {theme === 'light' ? (
        /* 달 — 누르면 다크로 */
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"
            stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        </svg>
      ) : (
        /* 해 — 누르면 라이트로 */
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="4.2" stroke="currentColor" strokeWidth="1.8" />
          <path d="M12 2v2.4M12 19.6V22M4.2 4.2l1.7 1.7M18.1 18.1l1.7 1.7M2 12h2.4M19.6 12H22M4.2 19.8l1.7-1.7M18.1 5.9l1.7-1.7"
            stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      )}
    </button>
  );
}
