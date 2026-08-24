'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input, Label } from '@/components/ui/input';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/providers/auth-provider';

const schema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(1, 'Informe a senha'),
});

type FormValues = z.infer<typeof schema>;

export default function LoginPage() {
  const { login, user, isLoading } = useAuth();
  const router = useRouter();
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { email: '', password: '' } });

  useEffect(() => {
    if (!isLoading && user) {
      router.replace('/ponto');
    }
  }, [isLoading, user, router]);

  return (
    <div className="grid min-h-screen place-items-center bg-gradient-to-br from-teal-50 to-slate-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Timekeeper</CardTitle>
          <CardDescription>Entre para registrar seu ponto e acompanhar sua jornada.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={form.handleSubmit(async (values) => {
              try {
                await login(values.email, values.password);
              } catch (error) {
                toast.error(error instanceof ApiError ? error.message : 'Falha no login');
              }
            })}
          >
            <div className="space-y-1">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" autoComplete="email" {...form.register('email')} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="password">Senha</Label>
              <Input id="password" type="password" autoComplete="current-password" {...form.register('password')} />
            </div>
            <Button className="w-full" type="submit" disabled={form.formState.isSubmitting}>
              Entrar
            </Button>
            <p className="text-center text-sm">
              <Link className="text-primary underline" href="/forgot-password">
                Esqueci minha senha
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
