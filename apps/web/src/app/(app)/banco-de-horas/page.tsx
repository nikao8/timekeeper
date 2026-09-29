'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiGet } from '@/lib/api';
import { formatDateBR } from '@/lib/datetime';

type Bank = {
  balanceFormatted: string;
  transactions: Array<{
    id: string;
    type: string;
    workDate: string;
    note: string | null;
    expectedFormatted: string;
    workedFormatted: string;
    deltaFormatted: string;
  }>;
};

const typeLabel: Record<string, string> = {
  DAILY_BALANCE: 'Apuração',
  ADJUSTMENT: 'Ajuste',
  TIME_OFF: 'Folga',
  RECALCULATION: 'Recálculo',
};

export default function TimeBankPage() {
  const { data } = useQuery({
    queryKey: ['time-bank'],
    queryFn: () => apiGet<Bank>('/time-bank/me'),
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Banco de horas</h1>
      <Card>
        <CardHeader>
          <CardTitle>Saldo atual</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-4xl font-semibold tabular-nums">{data?.balanceFormatted ?? '—'}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Histórico de apuração</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="py-2">Data</th>
                <th>Tipo</th>
                <th>Previsto</th>
                <th>Trabalhado</th>
                <th>Saldo</th>
                <th>Observação</th>
              </tr>
            </thead>
            <tbody>
              {data?.transactions.map((tx) => (
                <tr key={tx.id} className="border-b last:border-0">
                  <td className="py-2">{formatDateBR(tx.workDate)}</td>
                  <td>{typeLabel[tx.type] ?? tx.type}</td>
                  <td>{tx.expectedFormatted}</td>
                  <td>{tx.workedFormatted}</td>
                  <td className="font-medium tabular-nums">{tx.deltaFormatted}</td>
                  <td>{tx.note ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
