import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { authService, type User, type AuthCredentials, type AuthResult } from '../services/auth';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  error: string | null;
  login: (credentials: AuthCredentials) => Promise<AuthResult>;
  logout: () => Promise<void>;
  register: (credentials: AuthCredentials) => Promise<AuthResult>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check for existing session on mount
  useEffect(() => {
    const checkSession = async () => {
      try {
        const result = await authService.validateToken();
        if (result.success && result.user) {
          setUser(result.user);
        }
      } catch {
        // No valid session, that's fine
      } finally {
        setLoading(false);
      }
    };

    checkSession();
  }, []);

  const login = useCallback(async (credentials: AuthCredentials): Promise<AuthResult> => {
    setError(null);
    setLoading(true);

    try {
      const result = await authService.login(credentials);

      if (result.success && result.user) {
        setUser(result.user);
      } else if (result.error) {
        setError(result.error);
      }

      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '로그인에 실패했습니다.';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setLoading(true);
    try {
      await authService.logout();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const register = useCallback(async (credentials: AuthCredentials): Promise<AuthResult> => {
    setError(null);
    setLoading(true);

    try {
      const result = await authService.register(credentials);

      if (result.success && result.user) {
        setUser(result.user);
      } else if (result.error) {
        setError(result.error);
      }

      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '회원가입에 실패했습니다.';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const value: AuthContextValue = {
    user,
    loading,
    error,
    login,
    logout,
    register,
    clearError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export { AuthContext };
