import { useState, FormEvent, useRef, useEffect } from 'react';
import type { LoginFormState, ValidationResult } from '../../types/auth';

interface LoginFormProps {
  onLogin?: (email: string, password: string, rememberMe: boolean) => Promise<void>;
  onSSO?: () => void;
  onForgotPassword?: () => void;
  onSignUp?: () => void;
}

const validators = {
  email: (value: string): ValidationResult => {
    const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!value.trim()) {
      return { valid: false, error: '이메일을 입력하세요.' };
    }
    if (!pattern.test(value.trim())) {
      return { valid: false, error: '올바른 이메일 주소를 입력하세요.' };
    }
    return { valid: true };
  },
  password: (value: string): ValidationResult => {
    if (!value) {
      return { valid: false, error: '비밀번호를 입력하세요.' };
    }
    if (value.length < 8) {
      return { valid: false, error: '비밀번호는 8자 이상입니다.' };
    }
    return { valid: true };
  },
};

export default function LoginForm({
  onLogin,
  onSSO,
  onForgotPassword,
  onSignUp,
}: LoginFormProps) {
  const [state, setState] = useState<LoginFormState>({
    email: '',
    password: '',
    rememberMe: false,
    showPassword: false,
    errors: {},
    isSubmitting: false,
    submitSuccess: false,
  });

  const [alert, setAlert] = useState<{ message: string; type: 'error' | 'success' } | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);

  // Flash animation on mount
  useEffect(() => {
    if (cardRef.current) {
      cardRef.current.classList.add('flash');
      const timeout = setTimeout(() => {
        cardRef.current?.classList.remove('flash');
      }, 1100);
      return () => clearTimeout(timeout);
    }
  }, []);

  const handleInputChange = (field: 'email' | 'password') => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setState(prev => ({
      ...prev,
      [field]: e.target.value,
      errors: { ...prev.errors, [field]: undefined },
    }));
    setAlert(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setAlert(null);

    // Validate
    const emailResult = validators.email(state.email);
    const passwordResult = validators.password(state.password);

    if (!emailResult.valid || !passwordResult.valid) {
      setState(prev => ({
        ...prev,
        errors: {
          email: emailResult.error,
          password: passwordResult.error,
        },
      }));

      if (!emailResult.valid) {
        emailRef.current?.focus();
      }
      return;
    }

    setState(prev => ({ ...prev, isSubmitting: true }));

    try {
      if (onLogin) {
        await onLogin(state.email, state.password, state.rememberMe);
      } else {
        // Demo mode - show success message
        await new Promise(resolve => setTimeout(resolve, 900));
        setAlert({
          message: '시안 모드 — 인증 서버가 아직 연결되지 않았습니다.',
          type: 'success',
        });
      }
      setState(prev => ({ ...prev, submitSuccess: true }));
    } catch (error) {
      setAlert({
        message: error instanceof Error ? error.message : '로그인에 실패했습니다.',
        type: 'error',
      });
    } finally {
      setState(prev => ({ ...prev, isSubmitting: false }));
    }
  };

  const handleSSO = () => {
    if (onSSO) {
      onSSO();
    } else {
      setAlert({
        message: 'SSO는 인증 서버 연결 후 활성화됩니다.',
        type: 'error',
      });
    }
  };

  const handleForgotPassword = (e: React.MouseEvent) => {
    e.preventDefault();
    if (onForgotPassword) {
      onForgotPassword();
    } else {
      setAlert({
        message: '비밀번호 재설정은 연결 예정입니다.',
        type: 'success',
      });
    }
  };

  const handleSignUp = (e: React.MouseEvent) => {
    e.preventDefault();
    if (onSignUp) {
      onSignUp();
    } else {
      setAlert({
        message: '접근 요청은 연결 예정입니다.',
        type: 'success',
      });
    }
  };

  return (
    <div ref={cardRef} className="login-glass-card">
      <h2 style={{ margin: '0 0 4px', fontSize: 22, letterSpacing: '-0.01em', lineHeight: 1.3 }}>
        로그인
      </h2>
      <p style={{ margin: '0 0 20px', color: 'var(--login-ink-3)', fontSize: 14 }}>
        연구 워크스페이스에 접속합니다
      </p>

      {/* Alert */}
      {alert && (
        <div className={`login-alert visible ${alert.type}`} role="alert">
          {alert.message}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        {/* Email field */}
        <div className={`login-field ${state.errors.email ? 'has-error' : ''}`}>
          <label htmlFor="login-email">이메일</label>
          <div className={`login-input-wrapper ${state.errors.email ? 'error' : ''}`}>
            <input
              ref={emailRef}
              id="login-email"
              type="email"
              autoComplete="username"
              placeholder="name@example.com"
              value={state.email}
              onChange={handleInputChange('email')}
              required
            />
          </div>
          <div className="login-field-error">{state.errors.email}</div>
        </div>

        {/* Password field */}
        <div className={`login-field ${state.errors.password ? 'has-error' : ''}`}>
          <label htmlFor="login-password">비밀번호</label>
          <div className={`login-input-wrapper ${state.errors.password ? 'error' : ''}`}>
            <input
              id="login-password"
              type={state.showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="비밀번호"
              value={state.password}
              onChange={handleInputChange('password')}
              required
              minLength={8}
            />
            <button
              type="button"
              className="login-eye-btn"
              onClick={() => setState(prev => ({ ...prev, showPassword: !prev.showPassword }))}
              aria-label={state.showPassword ? '비밀번호 숨기기' : '비밀번호 보기'}
            >
              {state.showPassword ? '숨기기' : '보기'}
            </button>
          </div>
          <div className="login-field-error">{state.errors.password}</div>
        </div>

        {/* Remember me / Forgot password */}
        <div className="login-row">
          <label>
            <input
              type="checkbox"
              checked={state.rememberMe}
              onChange={e => setState(prev => ({ ...prev, rememberMe: e.target.checked }))}
            />
            로그인 유지
          </label>
          <a href="#" onClick={handleForgotPassword}>
            비밀번호 찾기
          </a>
        </div>

        {/* Submit button */}
        <button
          type="submit"
          className="login-btn-primary"
          disabled={state.isSubmitting}
        >
          {state.isSubmitting && <span className="login-spinner" />}
          <span>{state.isSubmitting ? '확인 중…' : '로그인'}</span>
        </button>
      </form>

      {/* Divider */}
      <div className="login-divider">또는</div>

      {/* SSO button */}
      <button type="button" className="login-btn-secondary" onClick={handleSSO}>
        기관 계정으로 계속 (SSO)
      </button>

      {/* Sign up link */}
      <p className="login-footer">
        계정이 없나요?{' '}
        <a href="#" onClick={handleSignUp}>
          접근 요청
        </a>
      </p>
    </div>
  );
}
