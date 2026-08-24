'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { apiGet, apiPost, ApiError } from '@/lib/api';
import { formatDateBR } from '@/lib/datetime';
import { useAuth } from '@/providers/auth-provider';

type Item = {
  id: string;
  date: string;
  reason: string;
  status: string;
  employee: { id: string; firstName: string; lastName: string };
};

export default function ApprovalsPage() {
  const { isManager } = useAuth();
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const { data } = useQuery({
    queryKey: ['approvals'],
    queryFn: () => apiGet<Item[]>('/time-off/team?status=PENDENTE'),
    enabled: isManager,
  });
  const approve = useMutation({
    mutationFn: (id: string) => apiPost(`/time-off/${id}/approve`, { reviewNotes: notes[id] }),
    onSuccess: () => {
      toast.success('Aprovada');
      void queryClient.invalidateQueries({ queryKey: ['approvals'] });
      void queryClient.invalidateQueries({ queryKey: ['approvals-count'] });
    },
  });
  const reject = useMutation({
    mutationFn: (id: string) => apiPost(`/time-off/${id}/reject`, { reviewNotes: notes[id] }),
    onSuccess: () => {
      toast.success('Rejeitada');
      void queryClient.invalidateQueries({ queryKey: ['approvals'] });
      void queryClient.invalidateQueries({ queryKey: ['approvals-count'] });
    },
    onError: (error: unknown) => toast.error(error instanceof ApiError ? error.message : 'Informe o motivo'),
  });

  if (!isManager) return <p>Acesso restrito a gestores.</p>;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Aprovações</h1>
      {data?.map((item) => (
        <Card key={item.id}>
          <CardHeader>
            <CardTitle className="text-base">
              {item.employee.firstName} {item.employee.lastName} — {formatDateBR(item.date)}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>{item.reason}</p>
            <Input
              placeholder="Motivo (obrigatório para rejeitar)"
              value={notes[item.id] ?? ''}
              onChange={(e) => setNotes((cur) => ({ ...cur, [item.id]: e.target.value }))}
            />
            <div className="flex gap-2">
              <Button onClick={() => approve.mutate(item.id)}>Aprovar</Button>
              <Button variant="destructive" onClick={() => reject.mutate(item.id)}>
                Rejeitar
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
      {data?.length === 0 && <p className="text-muted-foreground">Nenhuma solicitação pendente.</p>}
    </div>
  );
}
