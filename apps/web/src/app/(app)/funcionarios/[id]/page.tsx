'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input, Label } from '@/components/ui/input';
import { apiGet, apiPost, apiPut, ApiError } from '@/lib/api';
import { formatTimeBR } from '@/lib/datetime';

type Employee = {
  id: string;
  fullName: string;
  user: { email: string };
  jobTitle: string | null;
  timeBankMinutes: number;
};

type Schedule = {
  id: string;
  days: Array<{
    weekday: number;
    isWorkDay: boolean;
    expectedStart: string | null;
    expectedEnd: string | null;
    lunchStart: string | null;
    lunchEnd: string | null;
    expectedMinutes: number;
  }>;
};

const labels = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export default function EmployeeDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const queryClient = useQueryClient();
  const { data: employee } = useQuery({
    queryKey: ['employee', id],
    queryFn: () => apiGet<Employee>(`/employees/${id}`),
  });
  const { data: schedule } = useQuery({
    queryKey: ['schedule', id],
    queryFn: () => apiGet<Schedule | null>(`/work-schedules/${id}`),
  });
  const [reason, setReason] = useState('');
  const [occurredAt, setOccurredAt] = useState('');
  const adjust = useMutation({
    mutationFn: () =>
      apiPost(`/time-clock/${id}/adjustments`, {
        type: 'SAIDA',
        occurredAt: new Date(occurredAt).toISOString(),
        reason,
      }),
    onSuccess: () => toast.success('Ajuste registrado'),
    onError: (error: unknown) => toast.error(error instanceof ApiError ? error.message : 'Erro'),
  });
  const saveSchedule = useMutation({
    mutationFn: () =>
      apiPut(`/work-schedules/${id}`, {
        days: (schedule?.days ?? []).map((day) => ({ ...day })),
      }),
    onSuccess: () => {
      toast.success('Escala atualizada');
      void queryClient.invalidateQueries({ queryKey: ['schedule', id] });
    },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{employee?.fullName ?? 'Funcionário'}</h1>
      <p className="text-muted-foreground">{employee?.user.email}</p>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Ajuste de ponto</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label>Data e hora (saída)</Label>
              <Input type="datetime-local" value={occurredAt} onChange={(e) => setOccurredAt(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Motivo</Label>
              <Input value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
            <Button onClick={() => adjust.mutate()} disabled={!reason || !occurredAt}>
              Registrar ajuste
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Escala</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {schedule?.days.map((day) => (
              <p key={day.weekday}>
                {labels[day.weekday]}:{' '}
                {day.isWorkDay
                  ? `${formatTimeBR(day.expectedStart)} → ${formatTimeBR(day.expectedEnd)} (almoço ${formatTimeBR(day.lunchStart)}–${formatTimeBR(day.lunchEnd)})`
                  : 'Folga'}
              </p>
            ))}
            <Button variant="outline" onClick={() => saveSchedule.mutate()}>
              Salvar escala padrão
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
