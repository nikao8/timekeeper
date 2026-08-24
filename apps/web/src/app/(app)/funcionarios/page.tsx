'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input, Label } from '@/components/ui/input';
import { apiGet, apiPatch, apiPost, ApiError } from '@/lib/api';
import { formatMinutes } from '@/lib/utils';
import { useAuth } from '@/providers/auth-provider';

type Employee = {
  id: string;
  fullName: string;
  user: { email: string; role: string };
  isActive: boolean;
  jobTitle: string | null;
  timeBankMinutes: number;
};

export default function EmployeesPage() {
  const { isManager } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const { data } = useQuery({
    queryKey: ['employees', search],
    queryFn: () => apiGet<Employee[]>(`/employees${search ? `?search=${encodeURIComponent(search)}` : ''}`),
    enabled: isManager,
  });
  const form = useForm({
    defaultValues: {
      email: '',
      password: 'Timekeeper@123',
      firstName: '',
      lastName: '',
      jobTitle: '',
    },
  });
  const create = useMutation({
    mutationFn: (body: Record<string, string>) => apiPost('/employees', body),
    onSuccess: () => {
      toast.success('Funcionário criado');
      form.reset();
      void queryClient.invalidateQueries({ queryKey: ['employees'] });
    },
    onError: (error: unknown) => toast.error(error instanceof ApiError ? error.message : 'Erro'),
  });
  const toggle = useMutation({
    mutationFn: (employee: Employee) => apiPatch(`/employees/${employee.id}`, { isActive: !employee.isActive }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['employees'] }),
  });

  if (!isManager) {
    return <p>Acesso restrito a gestores.</p>;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Funcionários</h1>
        <Input placeholder="Pesquisar" value={search} onChange={(e) => setSearch(e.target.value)} />
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="p-3">Nome</th>
                  <th>E-mail</th>
                  <th>Cargo</th>
                  <th>Saldo</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {data?.map((employee) => (
                  <tr key={employee.id} className="border-b last:border-0">
                    <td className="p-3">
                      <Link className="text-primary underline" href={`/funcionarios/${employee.id}`}>
                        {employee.fullName}
                      </Link>
                    </td>
                    <td>{employee.user.email}</td>
                    <td>{employee.jobTitle ?? '—'}</td>
                    <td className="tabular-nums">{formatMinutes(employee.timeBankMinutes)}</td>
                    <td>
                      <Button size="sm" variant="outline" onClick={() => toggle.mutate(employee)}>
                        {employee.isActive ? 'Desativar' : 'Ativar'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Novo funcionário</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-3" onSubmit={form.handleSubmit((values) => create.mutate(values))}>
            <div className="space-y-1">
              <Label>Nome</Label>
              <Input {...form.register('firstName', { required: true })} />
            </div>
            <div className="space-y-1">
              <Label>Sobrenome</Label>
              <Input {...form.register('lastName', { required: true })} />
            </div>
            <div className="space-y-1">
              <Label>E-mail</Label>
              <Input type="email" {...form.register('email', { required: true })} />
            </div>
            <div className="space-y-1">
              <Label>Senha inicial</Label>
              <Input {...form.register('password', { required: true })} />
            </div>
            <div className="space-y-1">
              <Label>Cargo</Label>
              <Input {...form.register('jobTitle')} />
            </div>
            <Button type="submit">Criar</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
