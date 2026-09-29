/** Authentication type definitions */

export interface User {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
}

export interface AuthCredentials {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface AuthResult {
  success: boolean;
  user?: User;
  token?: string;
  error?: string;
}

export interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
}

export interface AuthContextType extends AuthState {
  login: (credentials: AuthCredentials) => Promise<AuthResult>;
  register: (credentials: AuthCredentials) => Promise<AuthResult>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export interface LoginFormState {
  email: string;
  password: string;
  rememberMe: boolean;
  showPassword: boolean;
  errors: {
    email?: string;
    password?: string;
    general?: string;
  };
  isSubmitting: boolean;
  submitSuccess: boolean;
}
