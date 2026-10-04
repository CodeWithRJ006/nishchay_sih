import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { get, post } from './lib/api';

type User = { id: string, role: string, email: string, name?: string };

type AuthContextType = {
  user: User | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    try {
      const data = await get<User | null>('/api/auth/me').catch(() => null);
      if (data && typeof data === 'object' && 'id' in data && 'role' in data && data.role) {
        setUser(data as User);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    await post('/api/auth/logout', {});
    setUser(null);
  };

  useEffect(() => {
    refresh();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, refresh, logout }}>
      {children}
    </AuthContext.Provider>
  );
}


export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be within AuthProvider');
  return context;
}
