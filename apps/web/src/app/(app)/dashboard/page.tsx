'use client';

import { translateTimeEntryType, translateWorkStatus, type WorkStatus } from '@timekeeper/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiGet, apiPost, ApiError } from '@/lib/api';
import { formatTimeBR, hourInBrazil } from '@/lib/datetime';
import { useAuth } from '@/providers/auth-provider';

type Snapshot = {
  status: WorkStatus;
  allowedActions: string[];
  journey: { entrada: string | null; saidaAlmoco: string | null; retornoAlmoco: string | null; saida: string | null };
  workedFormatted: string;
  dayBalanceFormatted: string;
  timeBankFormatted: string;
  expectedFormatted: string;
  extraMinutes: number;
  delayMinutes: number;
};

type TeamDash = {
  summary: {
    activeEmployees: number;
    working: number;
    atLunch: number;
    away: number;
    pendingTimeOff: number;
    pendingVacations: number;
    onVacation: number;
  };
  ranking: Array<{ employeeId: string; fullName: string; balanceFormatted: string; balanceMinutes: number }>;
  activity: Array<{ id: string; time: string; employeeName: string; type: string }>;
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

export default function DashboardPage() {
  const { user, isManager } = useAuth();
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: ['dashboard-me'],
    queryFn: () => apiGet<Snapshot>('/dashboard/me'),
  });
  const { data: team } = useQuery({
    queryKey: ['dashboard-team'],
    queryFn: () => apiGet<TeamDash>('/dashboard/team'),
    enabled: isManager,
  });
  const clock = useMutation({
    mutationFn: (type: string) => apiPost('/time-clock', { type }),
    onSuccess: () => {
      void queryClient.invalidateQueries();
      toast.success('Ponto registrado');
    },
    onError: (error: unknown) => toast.error(error instanceof ApiError ? error.message : 'Erro ao registrar'),
  });

  const greeting = greetingForNow();
  const firstName = user?.employee?.firstName ?? '';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">
          {greeting}, {firstName}
        </h1>
        {data && (
          <div className="mt-2">
            <Badge tone={statusTone(data.status)}>{translateWorkStatus(data.status)}</Badge>
          </div>
        )}
      </div>

      {data && (
        <div className="grid gap-4 md:grid-cols-4">
          <Stat label="Entrada" value={formatTimeBR(data.journey.entrada)} />
          <Stat
            label="Almoço"
            value={
              data.journey.saidaAlmoco
                ? `${formatTimeBR(data.journey.saidaAlmoco)} → ${formatTimeBR(data.journey.retornoAlmoco)}`
                : '—'
            }
          />
          <Stat label="Tempo trabalhado" value={data.workedFormatted} />
          <Stat label="Saldo de hoje" value={data.dayBalanceFormatted} />
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Registrar ponto</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          {data?.allowedActions.map((action) => (
            <Button key={action} size="xl" onClick={() => clock.mutate(action)} disabled={clock.isPending}>
              {actionLabel[action]}
            </Button>
          ))}
          {data && data.allowedActions.length === 0 && (
            <p className="text-sm text-muted-foreground">Jornada de hoje finalizada.</p>
          )}
        </CardContent>
      </Card>

      {data && (
        <div className="grid gap-4 md:grid-cols-3">
          <Stat label="Banco de horas" value={data.timeBankFormatted} />
          <Stat label="Horas previstas" value={data.expectedFormatted} />
          <Stat label="Atraso (min)" value={String(data.delayMinutes)} />
        </div>
      )}

      {isManager && team && (
        <>
          <h2 className="text-xl font-semibold">Equipe</h2>
          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
            <Stat label="Ativos" value={String(team.summary.activeEmployees)} />
            <Stat label="Trabalhando agora" value={String(team.summary.working)} />
            <Stat label="Em almoço" value={String(team.summary.atLunch)} />
            <Stat label="Ausentes" value={String(team.summary.away)} />
            <Stat label="Em férias hoje" value={String(team.summary.onVacation)} />
            <Stat label="Folgas pendentes" value={String(team.summary.pendingTimeOff)} />
            <Stat label="Férias pendentes" value={String(team.summary.pendingVacations)} />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Ranking de banco de horas</CardTitle>
              </CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={team.ranking}>
                    <XAxis dataKey="fullName" hide />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="balanceMinutes" fill="#0f766e" radius={6} />
                  </BarChart>
                </ResponsiveContainer>
                <ul className="mt-4 space-y-2 text-sm">
                  {team.ranking.map((item) => (
                    <li key={item.employeeId} className="flex justify-between">
                      <span>{item.fullName}</span>
                      <span className="font-medium">{item.balanceFormatted}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Atividade recente</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {team.activity.map((item) => (
                  <p key={item.id}>
                    <span className="font-medium">{formatTimeBR(item.time)}</span> {item.employeeName} —{' '}
                    {translateTimeEntryType(item.type)}
                  </p>
                ))}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}

function greetingForNow() {
  const hour = hourInBrazil();
  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';
  return 'Boa noite';
}
