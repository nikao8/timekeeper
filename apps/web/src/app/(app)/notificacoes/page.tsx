'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiGet, apiPatch } from '@/lib/api';
import { formatDateTimeBR } from '@/lib/datetime';

type Notification = {
  id: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
};

export default function NotificationsPage() {
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => apiGet<Notification[]>('/notifications'),
  });
  const markAll = useMutation({
    mutationFn: () => apiPatch('/notifications/read-all'),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
      void queryClient.invalidateQueries({ queryKey: ['notifications-count'] });
    },
  });
  const markOne = useMutation({
    mutationFn: (id: string) => apiPatch(`/notifications/${id}/read`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
      void queryClient.invalidateQueries({ queryKey: ['notifications-count'] });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Notificações</h1>
        <Button variant="outline" onClick={() => markAll.mutate()}>
          Marcar todas como lidas
        </Button>
      </div>
      {data?.map((item) => (
        <Card key={item.id} className={item.read ? 'opacity-70' : ''}>
          <CardHeader>
            <CardTitle className="text-base">{item.title}</CardTitle>
          </CardHeader>
          <CardContent className="flex items-start justify-between gap-4 text-sm">
            <div>
              <p>{item.message}</p>
              <p className="mt-1 text-xs text-muted-foreground">{formatDateTimeBR(item.createdAt)}</p>
            </div>
            {!item.read && (
              <Button size="sm" variant="secondary" onClick={() => markOne.mutate(item.id)}>
                Lida
              </Button>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
