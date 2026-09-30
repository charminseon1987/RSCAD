import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import WebGLFluidCanvas from '../components/auth/WebGLFluidCanvas';
import LoginForm from '../components/auth/LoginForm';

export default function Login() {
  const navigate = useNavigate();

  // Handle successful login - redirect to home
  const handleLogin = async (email: string, password: string, rememberMe: boolean) => {
    // TODO: Implement actual Firebase + Flask authentication
    console.log('Login attempt:', { email, rememberMe });

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));

    // For now, just navigate to home after "successful" login
    // In production, this would be handled by auth context
    navigate('/');
  };

  // Handle SSO login
  const handleSSO = () => {
    // TODO: Implement SSO authentication
    console.log('SSO login requested');
  };

  // Keyboard shortcut: Escape to go back
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        navigate('/');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);

  return (
    <div
      className="theme-login min-h-screen relative overflow-hidden"
      style={{
        background: 'var(--login-bg)',
        color: 'var(--login-ink)',
        fontFamily: 'var(--login-sans)',
      }}
    >
      {/* WebGL Fluid Background */}
      <WebGLFluidCanvas />

      {/* Fallback gradient for no WebGL (handled in component) */}

      {/* Veil overlay - darkens toward bottom */}
      <div className="login-veil" aria-hidden="true" />

      {/* Content - Two Column Layout */}
      <div className="relative z-10 min-h-screen flex items-center justify-center px-8 lg:px-20 py-10">
        <div className="w-full flex flex-col lg:flex-row items-center lg:items-stretch gap-10 lg:gap-28" style={{ maxWidth: 1280 }}>

          {/* Left: Hero section */}
          <div className="flex-1 flex flex-col justify-center lg:pr-12 lg:max-w-2xl">
            {/* Tag */}
            <span className="login-tag">
              <span className="login-tag-dot" />
              GFM 인버터 연구를 위한 개인 논문 워크스페이스
            </span>

            {/* Title */}
            <h1 className="login-title">
              논문의 흐름을 따라,
              <br />
              <span className="login-title-gradient">연구의 공백까지.</span>
            </h1>

            {/* Lead */}
            <p className="login-lead">
              찾고, 읽고, 비교하고, 인용하기까지. 출처가 달린 답변과 비교표로 선행연구를 정리하고,
              그 결과를 GFM 안정도 연구로 바로 이어갑니다.
            </p>

            {/* How it works button */}
            <button
              type="button"
              className="login-btn-ghost"
              onClick={() => navigate('/lab/control-loop')}
            >
              어떻게 동작하나요? →
            </button>

            {/* Hint - desktop only */}
            <p
              className="mt-8 text-sm hidden lg:flex items-center gap-2"
              style={{ color: 'var(--login-ink-3)' }}
            >
              마우스를 움직이면 흐름이 생깁니다
              <kbd
                style={{
                  fontFamily: 'var(--login-mono)',
                  fontSize: 12,
                  padding: '2px 8px',
                  borderRadius: 6,
                  border: '1px solid var(--login-edge-soft)',
                  background: 'rgba(255,255,255,.05)',
                }}
              >
                Space
              </kbd>
              더 많이
            </p>
          </div>

          {/* Right: Login Form */}
          <div className="w-full lg:w-auto shrink-0" style={{ maxWidth: 440, minWidth: 380 }}>
            <LoginForm
              onLogin={handleLogin}
              onSSO={handleSSO}
            />
          </div>

        </div>
      </div>

      {/* Back button */}
      <button
        onClick={() => navigate('/')}
        className="fixed top-4 left-4 z-20 opacity-40 hover:opacity-100 transition-opacity duration-200"
        style={{
          fontSize: 14,
          background: 'rgba(0,0,0,.55)',
          color: '#fff',
          border: '1px solid rgba(255,255,255,.25)',
          padding: '8px 16px',
          borderRadius: 8,
          fontFamily: 'var(--login-mono)',
        }}
      >
        ← 나가기 (Esc)
      </button>
    </div>
  );
}
