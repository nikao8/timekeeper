'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input, Label } from '@/components/ui/input';
import { apiPost, ApiError } from '@/lib/api';

const schema = z.object({ email: z.string().email() });

export default function ForgotPasswordPage() {
  const form = useForm({ resolver: zodResolver(schema), defaultValues: { email: '' } });
  return (
    <div className="grid min-h-screen place-items-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Recuperar senha</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={form.handleSubmit(async (values) => {
              try {
                await apiPost('/auth/forgot-password', values);
                toast.success('Se o e-mail existir, enviaremos as instruções.');
              } catch (error) {
                toast.error(error instanceof ApiError ? error.message : 'Erro');
              }
            })}
          >
            <div className="space-y-1">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" {...form.register('email')} />
            </div>
            <Button className="w-full" type="submit">
              Enviar
            </Button>
            <Link className="block text-center text-sm text-primary underline" href="/login">
              Voltar ao login
            </Link>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
