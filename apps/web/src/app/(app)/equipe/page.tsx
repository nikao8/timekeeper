'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiGet } from '@/lib/api';
import { useAuth } from '@/providers/auth-provider';

type Row = {
  employeeId: string;
  fullName: string;
  balanceFormatted: string;
  extraMinutes: number;
  negativeMinutes: number;
};

export default function TeamPage() {
  const { isManager } = useAuth();
  const { data } = useQuery({
    queryKey: ['team-bank'],
    queryFn: () => apiGet<Row[]>('/time-bank/team'),
    enabled: isManager,
  });
  if (!isManager) return <p>Acesso restrito a gestores.</p>;
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Equipe</h1>
      <Card>
        <CardHeader>
          <CardTitle>Banco de horas</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="py-2">Funcionário</th>
                <th>Extras</th>
                <th>Negativas</th>
                <th>Saldo atual</th>
              </tr>
            </thead>
            <tbody>
              {data?.map((row) => (
                <tr key={row.employeeId} className="border-b last:border-0">
                  <td className="py-2">
                    <Link className="text-primary underline" href={`/funcionarios/${row.employeeId}`}>
                      {row.fullName}
                    </Link>
                  </td>
                  <td>{row.extraMinutes}</td>
                  <td>{row.negativeMinutes}</td>
                  <td className="font-medium tabular-nums">{row.balanceFormatted}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
