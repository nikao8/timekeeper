'use client';

import {
  Bell,
  CalendarClock,
  ClipboardCheck,
  FileSpreadsheet,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  Timer,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { apiGet } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useAuth } from '@/providers/auth-provider';

const employeeNav = [
  { href: '/ponto', label: 'Jornada', icon: Timer },
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/banco-de-horas', label: 'Banco de horas', icon: Wallet },
  { href: '/historico', label: 'Histórico', icon: History },
  { href: '/solicitacoes', label: 'Solicitações', icon: CalendarClock },
  { href: '/notificacoes', label: 'Notificações', icon: Bell },
];

const managerNav = [
  { href: '/funcionarios', label: 'Funcionários', icon: Users },
  { href: '/equipe', label: 'Equipe', icon: LayoutDashboard },
  { href: '/aprovacoes', label: 'Aprovações', icon: ClipboardCheck },
  { href: '/relatorios', label: 'Relatórios', icon: FileSpreadsheet },
  { href: '/configuracoes', label: 'Configurações', icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, isLoading, isManager, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { data: unread } = useQuery({
    queryKey: ['notifications-count'],
    queryFn: () => apiGet<{ count: number }>('/notifications/unread-count'),
    enabled: Boolean(user),
  });
  const { data: pendingApprovals } = useQuery({
    queryKey: ['approvals-count'],
    queryFn: () => apiGet<{ count: number }>('/time-off/pending-count'),
    enabled: Boolean(user) && isManager,
  });

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/login');
    }
  }, [isLoading, user, router]);

  if (isLoading || !user) {
    return (
      <div className="grid min-h-screen place-items-center text-muted-foreground">Carregando…</div>
    );
  }

  const sidebar = (
    <aside className="flex h-full w-72 flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-3 px-5 py-6">
        <Link href="/ponto" className="flex items-center gap-3" onClick={() => setOpen(false)}>
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-teal-400/20 font-bold">TK</div>
          <div>
            <p className="font-semibold">Timekeeper</p>
            <p className="text-xs text-teal-100/70">Controle de jornada</p>
          </div>
        </Link>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3">
        {isManager && (
          <p className="px-3 pb-1 pt-3 text-[11px] uppercase tracking-wider text-teal-100/50">Pessoal</p>
        )}
        {employeeNav.map((item) => (
          <NavLink
            key={item.href}
            {...item}
            active={pathname === item.href}
            badge={item.href === '/notificacoes' ? unread?.count : undefined}
            onClick={() => setOpen(false)}
          />
        ))}
        {isManager && (
          <>
            <p className="px-3 pb-1 pt-4 text-[11px] uppercase tracking-wider text-teal-100/50">Gestão</p>
            {managerNav.map((item) => (
              <NavLink
                key={item.href}
                {...item}
                active={pathname === item.href || pathname.startsWith(`${item.href}/`)}
                badge={item.href === '/aprovacoes' ? pendingApprovals?.count : undefined}
                onClick={() => setOpen(false)}
              />
            ))}
          </>
        )}
      </nav>
      <div className="border-t border-white/10 p-4">
        <p className="truncate text-sm font-medium">{user.employee?.fullName}</p>
        <p className="truncate text-xs text-teal-100/70">{user.email}</p>
        <Button variant="ghost" className="mt-3 w-full justify-start text-sidebar-foreground" onClick={() => void logout()}>
          <LogOut className="h-4 w-4" />
          Sair
        </Button>
      </div>
    </aside>
  );

  return (
    <div className="flex min-h-screen">
      <div className="hidden md:block">{sidebar}</div>
      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} aria-label="Fechar menu" />
          <div className="relative z-50 h-full">{sidebar}</div>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b bg-card px-4 py-3 md:px-8">
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setOpen((v) => !v)}>
            {open ? <X /> : <Menu />}
          </Button>
          <div className="ml-auto text-sm text-muted-foreground">
            {user.role === 'GESTOR' ? 'Gestor' : 'Funcionário'}
          </div>
        </header>
        <main className="flex-1 p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}

function NavLink({
  href,
  label,
  icon: Icon,
  active,
  badge,
  onClick,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
  badge?: number;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
        active ? 'bg-white/15 text-white' : 'text-teal-50/80 hover:bg-white/10',
      )}
    >
      <Icon className="h-4 w-4" />
      <span className="flex-1">{label}</span>
      {badge ? (
        <span className="rounded-full bg-amber-400 px-1.5 text-[11px] font-semibold text-teal-950">{badge}</span>
      ) : null}
    </Link>
  );
}
