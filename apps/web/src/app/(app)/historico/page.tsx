'use client';

import { translateWorkStatus } from '@timekeeper/shared';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { apiGet } from '@/lib/api';
import { currentYearMonthBR, formatDateBR, formatTimeBR } from '@/lib/datetime';
import { useAuth } from '@/providers/auth-provider';

type History = {
  days: Array<{
    date: string;
    status: string;
    entrada: string | null;
    saidaAlmoco: string | null;
    retornoAlmoco: string | null;
    saida: string | null;
    workedFormatted: string;
    expectedFormatted: string;
    dayBalanceFormatted: string;
  }>;
};

export default function HistoryPage() {
  const { isManager } = useAuth();
  const [month, setMonth] = useState(() => currentYearMonthBR());
  const [employeeId, setEmployeeId] = useState('');
  const { data: employees } = useQuery({
    queryKey: ['employees'],
    queryFn: () => apiGet<Array<{ id: string; fullName: string }>>('/employees'),
    enabled: isManager,
  });
  const { data } = useQuery({
    queryKey: ['history', month, employeeId],
    queryFn: () => {
      const params = new URLSearchParams({ month });
      if (employeeId) params.set('employeeId', employeeId);
      return apiGet<History>(`/time-clock/history?${params}`);
    },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Histórico</h1>
      <div className="flex flex-wrap gap-3">
        <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-48" />
        {isManager && (
          <select
            className="h-10 rounded-lg border bg-card px-3 text-sm"
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
          >
            <option value="">Meu histórico</option>
            {employees?.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.fullName}
              </option>
            ))}
          </select>
        )}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Registros</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="py-2">Data</th>
                <th>Entrada</th>
                <th>Saída almoço</th>
                <th>Retorno</th>
                <th>Saída</th>
                <th>Trabalhado</th>
                <th>Previsto</th>
                <th>Saldo</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data?.days.map((day) => (
                <tr key={day.date} className="border-b last:border-0">
                  <td className="py-2">{formatDateBR(day.date)}</td>
                  <td>{formatTimeBR(day.entrada)}</td>
                  <td>{formatTimeBR(day.saidaAlmoco)}</td>
                  <td>{formatTimeBR(day.retornoAlmoco)}</td>
                  <td>{formatTimeBR(day.saida)}</td>
                  <td>{day.workedFormatted}</td>
                  <td>{day.expectedFormatted}</td>
                  <td className="tabular-nums font-medium">{day.dayBalanceFormatted}</td>
                  <td>{translateWorkStatus(day.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
