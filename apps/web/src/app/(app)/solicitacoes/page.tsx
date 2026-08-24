'use client';

import { translateTimeOffStatus } from '@timekeeper/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input, Label, Textarea } from '@/components/ui/input';
import { apiGet, apiPost, ApiError } from '@/lib/api';
import { formatDateBR } from '@/lib/datetime';

type RequestItem = {
  id: string;
  date: string;
  reason: string;
  notes: string | null;
  status: string;
};

export default function TimeOffPage() {
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: ['time-off'],
    queryFn: () => apiGet<RequestItem[]>('/time-off'),
  });
  const form = useForm({ defaultValues: { date: '', reason: '', notes: '' } });
  const create = useMutation({
    mutationFn: (body: { date: string; reason: string; notes?: string }) => apiPost('/time-off', body),
    onSuccess: () => {
      toast.success('Solicitação enviada');
      form.reset();
      void queryClient.invalidateQueries({ queryKey: ['time-off'] });
    },
    onError: (error: unknown) => toast.error(error instanceof ApiError ? error.message : 'Erro'),
  });
  const cancel = useMutation({
    mutationFn: (id: string) => apiPost(`/time-off/${id}/cancel`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['time-off'] });
    },
  });

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Nova folga</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={form.handleSubmit((values) => create.mutate(values))}
          >
            <div className="space-y-1">
              <Label htmlFor="date">Data</Label>
              <Input id="date" type="date" {...form.register('date', { required: true })} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="reason">Motivo</Label>
              <Input id="reason" {...form.register('reason', { required: true, minLength: 3 })} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="notes">Observação</Label>
              <Textarea id="notes" {...form.register('notes')} />
            </div>
            <Button type="submit" disabled={create.isPending}>
              Solicitar
            </Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Minhas solicitações</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {data?.map((item) => (
            <div key={item.id} className="rounded-lg border p-3 text-sm">
              <div className="flex justify-between">
                <span className="font-medium">{formatDateBR(item.date)}</span>
                <span>{translateTimeOffStatus(item.status)}</span>
              </div>
              <p className="mt-1 text-muted-foreground">{item.reason}</p>
              {item.status === 'PENDENTE' && (
                <Button size="sm" variant="outline" className="mt-2" onClick={() => cancel.mutate(item.id)}>
                  Cancelar
                </Button>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
