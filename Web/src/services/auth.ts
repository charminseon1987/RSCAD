/**
 * Authentication Service
 * Handles Firebase Auth + Flask backend integration
 */

import type { User, AuthCredentials, AuthResult } from '../types/auth';

// Firebase configuration (to be set up)
// import { initializeApp } from 'firebase/app';
// import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';

const API_BASE = '/api';

/**
 * Flask backend authentication
 */
export async function flaskLogin(credentials: AuthCredentials): Promise<AuthResult> {
  try {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        email: credentials.email,
        password: credentials.password,
        remember_me: credentials.rememberMe,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error || '로그인에 실패했습니다.',
      };
    }

    return {
      success: true,
      user: data.user,
      token: data.token,
    };
  } catch (error) {
    console.error('Flask login error:', error);
    return {
      success: false,
      error: '서버에 연결할 수 없습니다.',
    };
  }
}

/**
 * Validate existing session/token
 */
export async function flaskValidateToken(): Promise<AuthResult> {
  try {
    const response = await fetch(`${API_BASE}/auth/me`, {
      method: 'GET',
      credentials: 'include',
    });

    if (!response.ok) {
      return { success: false };
    }

    const data = await response.json();
    return {
      success: true,
      user: data.user,
    };
  } catch {
    return { success: false };
  }
}

/**
 * Logout from Flask backend
 */
export async function flaskLogout(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Register new user
 */
export async function flaskRegister(credentials: AuthCredentials): Promise<AuthResult> {
  try {
    const response = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: credentials.email,
        password: credentials.password,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error || '회원가입에 실패했습니다.',
      };
    }

    return {
      success: true,
      user: data.user,
    };
  } catch (error) {
    console.error('Flask register error:', error);
    return {
      success: false,
      error: '서버에 연결할 수 없습니다.',
    };
  }
}

/**
 * Request password reset
 */
export async function flaskRequestPasswordReset(email: string): Promise<AuthResult> {
  try {
    const response = await fetch(`${API_BASE}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error || '비밀번호 재설정 요청에 실패했습니다.',
      };
    }

    return { success: true };
  } catch {
    return {
      success: false,
      error: '서버에 연결할 수 없습니다.',
    };
  }
}

// Firebase Auth functions (placeholder - to be implemented when Firebase is configured)
/*
export async function firebaseLogin(credentials: AuthCredentials): Promise<AuthResult> {
  const auth = getAuth();
  try {
    const userCredential = await signInWithEmailAndPassword(
      auth,
      credentials.email,
      credentials.password
    );
    const token = await userCredential.user.getIdToken();

    // Validate with Flask backend
    const flaskResult = await flaskLogin({ ...credentials, token });

    return {
      success: true,
      user: {
        uid: userCredential.user.uid,
        email: userCredential.user.email || '',
        displayName: userCredential.user.displayName || undefined,
        photoURL: userCredential.user.photoURL || undefined,
      },
      token,
    };
  } catch (error: any) {
    return {
      success: false,
      error: getFirebaseErrorMessage(error.code),
    };
  }
}

function getFirebaseErrorMessage(code: string): string {
  switch (code) {
    case 'auth/user-not-found':
    case 'auth/wrong-password':
      return '이메일 또는 비밀번호가 올바르지 않습니다.';
    case 'auth/too-many-requests':
      return '너무 많은 시도가 있었습니다. 잠시 후 다시 시도해주세요.';
    case 'auth/user-disabled':
      return '이 계정은 비활성화되었습니다.';
    default:
      return '로그인에 실패했습니다.';
  }
}
*/

// Export unified auth interface
export const authService = {
  login: flaskLogin,
  logout: flaskLogout,
  register: flaskRegister,
  validateToken: flaskValidateToken,
  requestPasswordReset: flaskRequestPasswordReset,
};

export type { User, AuthCredentials, AuthResult };
