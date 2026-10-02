import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useState,
} from 'react';

import { authApi, setAuthToken } from '@/services/api';
import { User } from '@/types';

const TOKEN_KEY = '@donrashi_token';
const USER_KEY = '@donrashi_user';

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isReady: boolean; // true once AsyncStorage has been checked
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    token: null,
    isLoading: false,
    isReady: false,
  });

  // ── Restore session from storage on cold start ──────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const [storedToken, storedUser] = await Promise.all([
          AsyncStorage.getItem(TOKEN_KEY),
          AsyncStorage.getItem(USER_KEY),
        ]);

        if (storedToken) {
          setAuthToken(storedToken);
          const user: User | null = storedUser ? JSON.parse(storedUser) : null;
          setState({ user, token: storedToken, isLoading: false, isReady: true });

          // Silently refresh user data in background
          authApi.me().then(res => {
            const freshUser = res.user ?? (res as unknown as User);
            setState(s => ({ ...s, user: freshUser }));
            AsyncStorage.setItem(USER_KEY, JSON.stringify(freshUser));
          }).catch(() => {/* token may be expired — leave as is */});
        } else {
          setState(s => ({ ...s, isReady: true }));
        }
      } catch {
        setState(s => ({ ...s, isReady: true }));
      }
    })();
  }, []);

  // ── Persist helpers ─────────────────────────────────────────────────────────
  async function persistSession(token: string, user: User) {
    setAuthToken(token);
    await Promise.all([
      AsyncStorage.setItem(TOKEN_KEY, token),
      AsyncStorage.setItem(USER_KEY, JSON.stringify(user)),
    ]);
  }

  async function clearSession() {
    setAuthToken(null);
    await Promise.all([
      AsyncStorage.removeItem(TOKEN_KEY),
      AsyncStorage.removeItem(USER_KEY),
    ]);
  }

  // ── Actions ─────────────────────────────────────────────────────────────────
  const login = useCallback(async (email: string, password: string) => {
    setState(s => ({ ...s, isLoading: true }));
    try {
      const res = await authApi.login({ email, password });
      // Normalise: some backends return user inside the response, some don't
      let user: User = res.user;
      if (!user) {
        // fetch separately
        const meRes = await authApi.me();
        user = meRes.user ?? (meRes as unknown as User);
      }
      await persistSession(res.access_token, user);
      setState({ user, token: res.access_token, isLoading: false, isReady: true });
    } catch (e) {
      setState(s => ({ ...s, isLoading: false }));
      throw e;
    }
  }, []);

  const register = useCallback(async (name: string, email: string, password: string) => {
    setState(s => ({ ...s, isLoading: true }));
    try {
      const res = await authApi.register({
        name, email, password, password_confirmation: password,
      });
      let user: User = res.user;
      if (!user) {
        const meRes = await authApi.me();
        user = meRes.user ?? (meRes as unknown as User);
      }
      await persistSession(res.access_token, user);
      setState({ user, token: res.access_token, isLoading: false, isReady: true });
    } catch (e) {
      setState(s => ({ ...s, isLoading: false }));
      throw e;
    }
  }, []);

  const logout = useCallback(async () => {
    try { await authApi.logout(); } catch { /* ignore */ }
    await clearSession();
    setState({ user: null, token: null, isLoading: false, isReady: true });
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const res = await authApi.me();
      const user = res.user ?? (res as unknown as User);
      setState(s => ({ ...s, user }));
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
    } catch { /* silently ignore */ }
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
