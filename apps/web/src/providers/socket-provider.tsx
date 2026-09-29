'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { io } from 'socket.io-client';
import { getAccessToken } from '@/lib/auth';
import { useAuth } from './auth-provider';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    const token = getAccessToken();
    if (!user || !token) {
      return;
    }
    const socket = io(`${API_URL}/events`, {
      auth: { token },
      withCredentials: true,
      transports: ['websocket', 'polling'],
    });
    socket.on('connect', () => {
      if (user.role === 'GESTOR' && user.employee?.id) {
        socket.emit('join-team', user.employee.id);
      }
    });
    socket.on('notification', (payload: { type?: string }) => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
      void queryClient.invalidateQueries({ queryKey: ['notifications-count'] });
      if (payload?.type === 'TIME_BANK_ADJUSTMENT') {
        void queryClient.invalidateQueries({ queryKey: ['time-bank'] });
      }
    });
    socket.on('team-event', () => {
      void queryClient.invalidateQueries({ queryKey: ['dashboard-team'] });
      void queryClient.invalidateQueries({ queryKey: ['time-clock'] });
      void queryClient.invalidateQueries({ queryKey: ['approvals'] });
      void queryClient.invalidateQueries({ queryKey: ['approvals-count'] });
      void queryClient.invalidateQueries({ queryKey: ['vacations'] });
    });
    socket.on('time-clock', () => {
      void queryClient.invalidateQueries({ queryKey: ['time-clock'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard-me'] });
    });
    return () => {
      socket.disconnect();
    };
  }, [user, queryClient]);

  return children;
}
