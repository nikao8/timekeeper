'use client';

import { translateWorkStatus, type WorkStatus } from '@timekeeper/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiGet, apiPost, ApiError } from '@/lib/api';
import { formatClockBR, formatDateBR, formatLongDateBR, formatTimeBR } from '@/lib/datetime';
import { useAuth } from '@/providers/auth-provider';

type Snapshot = {
  status: WorkStatus;
  allowedActions: string[];
  journey: { entrada: string | null; saidaAlmoco: string | null; retornoAlmoco: string | null; saida: string | null };
  workedFormatted: string;
  dayBalanceFormatted: string;
  onVacation?: boolean;
  vacation?: { startDate: string; endDate: string } | null;
  entries: Array<{ id: string; type: string; time: string }>;
};

const actionLabel: Record<string, string> = {
  ENTRADA: 'Iniciar jornada',
  SAIDA_ALMOCO: 'Iniciar almoço',
  RETORNO_ALMOCO: 'Retornar do almoço',
  SAIDA: 'Finalizar jornada',
};

function statusTone(status: WorkStatus) {
  if (status === 'EM_JORNADA') return 'success' as const;
  if (status === 'EM_ALMOCO') return 'warning' as const;
  if (status === 'JORNADA_FINALIZADA') return 'info' as const;
  return 'neutral' as const;
}

export default function TimeClockPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [now, setNow] = useState(() => new Date());
  const { data } = useQuery({
    queryKey: ['time-clock'],
    queryFn: () => apiGet<Snapshot>('/time-clock/today'),
  });
  const clock = useMutation({
    mutationFn: (type: string) => apiPost('/time-clock', { type }),
    onSuccess: () => {
      void queryClient.invalidateQueries();
      toast.success('Ponto registrado');
    },
    onError: (error: unknown) => toast.error(error instanceof ApiError ? error.message : 'Erro ao registrar'),
  });

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const firstName = user?.employee?.firstName ?? '';

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <p className="text-sm capitalize text-muted-foreground">{formatLongDateBR(now)}</p>
        <p className="mt-1 font-mono text-4xl font-semibold tabular-nums">{formatClockBR(now)}</p>
        <h1 className="mt-4 text-2xl font-semibold">{firstName ? `${firstName}, acompanhe sua jornada` : 'Acompanhe sua jornada'}</h1>
      </div>
      {data && (
        <>
          <Badge tone={statusTone(data.status)}>{translateWorkStatus(data.status)}</Badge>
          {data.onVacation && data.vacation && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Você está de férias ({formatDateBR(data.vacation.startDate)} a {formatDateBR(data.vacation.endDate)}). O dia
              não gera saldo negativo no banco de horas.
            </p>
          )}
          <div className="grid gap-3">
            {data.allowedActions.map((action) => (
              <Button key={action} size="xl" className="h-16 w-full" onClick={() => clock.mutate(action)}>
                {actionLabel[action]}
              </Button>
            ))}
            {data.allowedActions.length === 0 && (
              <p className="text-sm text-muted-foreground">Jornada de hoje finalizada.</p>
            )}
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Hoje</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row label="Entrada" value={formatTimeBR(data.journey.entrada)} />
              <Row label="Saída almoço" value={formatTimeBR(data.journey.saidaAlmoco)} />
              <Row label="Retorno almoço" value={formatTimeBR(data.journey.retornoAlmoco)} />
              <Row label="Saída" value={formatTimeBR(data.journey.saida)} />
              <Row label="Trabalhado" value={data.workedFormatted} />
              <Row label="Saldo" value={data.dayBalanceFormatted} />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums font-medium">{value ?? '—'}</span>
    </div>
  );
}
