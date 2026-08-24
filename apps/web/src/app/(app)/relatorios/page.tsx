'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { getAccessToken } from '@/lib/auth';
import { currentYearMonthBR } from '@/lib/datetime';
import { useAuth } from '@/providers/auth-provider';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export default function ReportsPage() {
  const { isManager } = useAuth();
  const [month, setMonth] = useState(() => currentYearMonthBR());

  if (!isManager) return <p>Acesso restrito a gestores.</p>;

  async function download() {
    const token = getAccessToken();
    const res = await fetch(`${API_URL}/reports/time-bank.xlsx?month=${month}`, {
      credentials: 'include',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (!res.ok) {
      toast.error('Não foi possível gerar o relatório');
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `banco-de-horas-${month}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Card className="max-w-lg">
      <CardHeader>
        <CardTitle>Relatórios</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        <Button onClick={() => void download()}>Baixar Excel do banco de horas</Button>
      </CardContent>
    </Card>
  );
}
