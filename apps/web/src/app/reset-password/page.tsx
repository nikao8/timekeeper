'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input, Label } from '@/components/ui/input';
import { apiPost, ApiError } from '@/lib/api';

const schema = z.object({ password: z.string().min(8, 'Mínimo 8 caracteres') });

function ResetForm() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get('token') ?? '';
  const form = useForm({ resolver: zodResolver(schema), defaultValues: { password: '' } });
  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Nova senha</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={form.handleSubmit(async (values) => {
            try {
              await apiPost('/auth/reset-password', { token, password: values.password });
              toast.success('Senha redefinida. Faça login.');
              router.push('/login');
            } catch (error) {
              toast.error(error instanceof ApiError ? error.message : 'Token inválido');
            }
          })}
        >
          <div className="space-y-1">
            <Label htmlFor="password">Nova senha</Label>
            <Input id="password" type="password" {...form.register('password')} />
          </div>
          <Button className="w-full" type="submit" disabled={!token}>
            Redefinir
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="grid min-h-screen place-items-center p-4">
      <Suspense>
        <ResetForm />
      </Suspense>
    </div>
  );
}
