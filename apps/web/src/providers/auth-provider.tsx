'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { createContext, useContext, useMemo } from 'react';
import { apiGet, apiPost } from '@/lib/api';
import { getAccessToken, setAccessToken, type AuthUser } from '@/lib/auth';

type AuthContextValue = {
  user: AuthUser | null;
  isLoading: boolean;
  isManager: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: user, isLoading } = useQuery({
    queryKey: ['me'],
    queryFn: () => apiGet<AuthUser>('/auth/me'),
    enabled: Boolean(getAccessToken()),
    retry: false,
  });

  const value = useMemo<AuthContextValue>(
    () => ({
      user: user ?? null,
      isLoading,
      isManager: user?.role === 'GESTOR',
      login: async (email, password) => {
        const result = await apiPost<{ accessToken: string; user: AuthUser }>('/auth/login', {
          email,
          password,
        });
        setAccessToken(result.accessToken);
        queryClient.setQueryData(['me'], result.user);
        router.push('/ponto');
      },
      logout: async () => {
        try {
          await apiPost('/auth/logout');
        } finally {
          setAccessToken(null);
          queryClient.clear();
          router.push('/login');
        }
      },
    }),
    [user, isLoading, queryClient, router],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
