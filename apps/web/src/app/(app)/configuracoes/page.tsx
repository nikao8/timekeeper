'use client';

import { translateHolidayScope } from '@timekeeper/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input, Label } from '@/components/ui/input';
import { apiGet, apiPost, ApiError } from '@/lib/api';
import { formatDateBR } from '@/lib/datetime';
import { useAuth } from '@/providers/auth-provider';

type Holiday = { id: string; date: string; name: string; scope: string };

export default function SettingsPage() {
  const { isManager } = useAuth();
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: ['holidays'],
    queryFn: () => apiGet<Holiday[]>('/holidays'),
  });
  const form = useForm({ defaultValues: { date: '', name: '' } });
  const create = useMutation({
    mutationFn: (body: { date: string; name: string }) => apiPost('/holidays', body),
    onSuccess: () => {
      toast.success('Feriado cadastrado');
      void queryClient.invalidateQueries({ queryKey: ['holidays'] });
      form.reset();
    },
  });
  const passwordForm = useForm({ defaultValues: { currentPassword: '', newPassword: '' } });
  const changePassword = useMutation({
    mutationFn: (body: { currentPassword: string; newPassword: string }) =>
      apiPost('/auth/change-password', body),
    onSuccess: () => toast.success('Senha alterada'),
    onError: (error: unknown) => toast.error(error instanceof ApiError ? error.message : 'Erro'),
  });

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Alterar senha</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-3"
            onSubmit={passwordForm.handleSubmit((values) => changePassword.mutate(values))}
          >
            <div className="space-y-1">
              <Label>Senha atual</Label>
              <Input type="password" {...passwordForm.register('currentPassword', { required: true })} />
            </div>
            <div className="space-y-1">
              <Label>Nova senha</Label>
              <Input type="password" {...passwordForm.register('newPassword', { required: true, minLength: 8 })} />
            </div>
            <Button type="submit">Salvar</Button>
          </form>
        </CardContent>
      </Card>
      {isManager && (
        <Card>
          <CardHeader>
            <CardTitle>Feriados</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <form className="flex gap-2" onSubmit={form.handleSubmit((values) => create.mutate(values))}>
              <Input type="date" {...form.register('date', { required: true })} />
              <Input placeholder="Nome" {...form.register('name', { required: true })} />
              <Button type="submit">Adicionar</Button>
            </form>
            <ul className="space-y-2 text-sm">
              {data?.map((holiday) => (
                <li key={holiday.id} className="flex justify-between border-b py-2">
                  <span>{formatDateBR(holiday.date)}</span>
                  <span>
                    {holiday.name} ({translateHolidayScope(holiday.scope)})
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
