import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserProfile, UserRole, AuthContextType } from '../types/auth';
import api from '../services/api';

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(() => api.getToken());
  const [isLoading, setIsLoading] = useState<boolean>(true);

  let navigate: ReturnType<typeof useNavigate> | null = null;
  try {
    navigate = useNavigate();
  } catch {
    // Router context might not be available in standalone tests
    navigate = null;
  }

  // Session rehydration on mount
  useEffect(() => {
    let isMounted = true;

    const rehydrate = async () => {
      setIsLoading(true);
      try {
        const response = await api.getMe();
        if (isMounted && response?.user) {
          setUser(response.user);
          setToken(api.getToken());
        }
      } catch (_err) {
        if (isMounted) {
          setUser(null);
          setToken(null);
          api.setToken(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    rehydrate();

    return () => {
      isMounted = false;
    };
  }, []);

  const login = useCallback(
    async (username: string, password: string): Promise<void> => {
      const response = await api.login(username, password);
      setUser(response.user);
      setToken(response.token);
      if (navigate) {
        navigate('/dashboard');
      }
    },
    [navigate]
  );

  const logout = useCallback(async (): Promise<void> => {
    try {
      await api.logout();
    } catch (_err) {
      // Even if API logout fails, clear local credentials
    } finally {
      setUser(null);
      setToken(null);
      api.setToken(null);
      if (navigate) {
        navigate('/login');
      }
    }
  }, [navigate]);

  const role: UserRole | null = user?.role || null;
  const isAuthenticated = !!user;

  const value: AuthContextType = {
    user,
    token,
    role,
    isAuthenticated,
    isLoading,
    login,
    logout
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
