'use client';

import { translateTimeOffStatus } from '@timekeeper/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input, Label } from '@/components/ui/input';
import { apiGet, apiPost, ApiError } from '@/lib/api';
import { formatDateBR } from '@/lib/datetime';
import { useAuth } from '@/providers/auth-provider';

type Balance = { year: number; entitledDays: number; usedDays: number; availableDays: number };
type RequestItem = {
  id: string;
  startDate: string;
  endDate: string;
  days: number;
  reason: string | null;
  status: string;
};
type Mine = { balance: Balance; requests: RequestItem[] };
type TeamRequest = RequestItem & {
  overlapCount: number;
  employee: { id: string; firstName: string; lastName: string };
};
type Team = { pending: TeamRequest[]; upcoming: TeamRequest[] };

export default function VacationPage() {
  const { isManager } = useAuth();
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: ['vacations', 'me'],
    queryFn: () => apiGet<Mine>('/vacations/me'),
  });
  const { data: team } = useQuery({
    queryKey: ['vacations', 'team'],
    queryFn: () => apiGet<Team>('/vacations/team'),
    enabled: isManager,
  });
  const form = useForm({ defaultValues: { startDate: '', endDate: '', reason: '' } });
  const create = useMutation({
    mutationFn: (body: { startDate: string; endDate: string; reason?: string }) => apiPost('/vacations', body),
    onSuccess: () => {
      toast.success('Férias solicitadas');
      form.reset();
      void queryClient.invalidateQueries({ queryKey: ['vacations'] });
    },
    onError: (error: unknown) => toast.error(error instanceof ApiError ? error.message : 'Erro ao solicitar'),
  });
  const cancel = useMutation({
    mutationFn: (id: string) => apiPost(`/vacations/${id}/cancel`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['vacations'] });
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Férias</h1>
        <p className="text-muted-foreground">Saldo em dias corridos. Períodos aprovados não descontam o banco de horas.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Disponível em {data?.balance.year ?? '—'}</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums">{data?.balance.availableDays ?? '—'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Usados</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums">{data?.balance.usedDays ?? '—'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Direito</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums">{data?.balance.entitledDays ?? '—'}</p>
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Solicitar período</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-4"
              onSubmit={form.handleSubmit((values) => create.mutate(values))}
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="startDate">Início</Label>
                  <Input id="startDate" type="date" {...form.register('startDate', { required: true })} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="endDate">Fim</Label>
                  <Input id="endDate" type="date" {...form.register('endDate', { required: true })} />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="reason">Motivo</Label>
                <Input id="reason" {...form.register('reason')} />
              </div>
              <Button type="submit" disabled={create.isPending}>
                Solicitar
              </Button>
            </form>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Minhas férias</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data?.requests.map((item) => (
              <div key={item.id} className="rounded-lg border p-3 text-sm">
                <div className="flex justify-between gap-3">
                  <span className="font-medium">
                    {formatDateBR(item.startDate)} — {formatDateBR(item.endDate)} ({item.days} dias)
                  </span>
                  <span>{translateTimeOffStatus(item.status)}</span>
                </div>
                {item.reason && <p className="mt-1 text-muted-foreground">{item.reason}</p>}
                {item.status === 'PENDENTE' && (
                  <Button size="sm" variant="outline" className="mt-2" onClick={() => cancel.mutate(item.id)}>
                    Cancelar
                  </Button>
                )}
              </div>
            ))}
            {data?.requests.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma solicitação.</p>}
          </CardContent>
        </Card>
      </div>
      {isManager && team && (
        <Card>
          <CardHeader>
            <CardTitle>Cobertura da equipe</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {team.upcoming.length === 0 && <p className="text-muted-foreground">Ninguém da equipe com férias aprovadas à frente.</p>}
            {team.upcoming.map((item) => (
              <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 border-b py-2">
                <span>
                  {item.employee.firstName} {item.employee.lastName} · {formatDateBR(item.startDate)} —{' '}
                  {formatDateBR(item.endDate)}
                </span>
                <span className="text-muted-foreground">
                  {item.overlapCount > 0
                    ? `${item.overlapCount} colega(s) no mesmo período`
                    : 'Sem sobreposição'}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
