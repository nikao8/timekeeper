# Timekeeper

Aplicação de controle de ponto, jornada de trabalho, banco de horas, folgas, férias e gestão de funcionários.

Um **gestor também é funcionário**: possui todos os recursos de ponto e, adicionalmente, administra apenas a própria equipe.

## Arquitetura

Monorepo `pnpm` com três pacotes:

```text
timekeeper/
├── apps/api          NestJS + Prisma + Turso (libSQL)
├── apps/web          Next.js (App Router) + Tailwind + shadcn/ui
└── packages/shared   Enums, códigos de erro e constantes
```

### Decisões

| Tema | Decisão |
| --- | --- |
| Identidade | `User` (auth/RBAC) + `Employee` (jornada). Não há tabela `Manager`. Gestor = `User.role = GESTOR` com `Employee` próprio. Equipe = `Employee.managerId`. |
| Autorização | Sempre no backend (`JwtAuthGuard`, `RolesGuard`, `EmployeeAccessService`). Gestor A não acessa a equipe do gestor B. |
| Ponto | `TimeEntry` imutável. Ajustes desativam o original (`isActive=false`) e criam um novo registro + `AuditLog`. |
| Banco de horas | Recalculado a partir dos pontos (`TimeBank` + `TimeBankTransaction`). Feriado e folga aprovada zeram a carga do dia (sem horas negativas automáticas). |
| Timezone | Persistência em UTC. Exibição e recortes de dia via `DateTimeService` (Luxon), padrão `America/Sao_Paulo`. |
| Banco | Turso (libSQL). O Prisma Migrate gera o SQL em um SQLite local (`DATABASE_URL=file:./dev.db`) e `prisma/apply-turso.ts` aplica no banco remoto quando `TURSO_DATABASE_URL` e `TURSO_AUTH_TOKEN` estão definidos. |
| Férias | Saldo anual em dias corridos (padrão 30). Período aprovado zera a carga do dia no banco de horas, como feriado e folga. |
| Tokens | Access JWT curto. Refresh opaco em cookie httpOnly, hash Argon2 no banco, rotação no `/auth/refresh`. |

### Modelo de dados (simplificado)

`User` 1–1 `Employee` N–1 `Employee` (gestor)  
`Employee` 1–N `WorkSchedule` 1–N `WorkScheduleDay`  
`Employee` 1–N `TimeEntry`  
`Employee` 1–1 `TimeBank` 1–N `TimeBankTransaction`  
`Holiday`, `TimeOffRequest`, `VacationRequest`, `VacationBalance`, `Notification`, `AuditLog`, `RefreshToken`, `PasswordResetToken`

## Stack

**API:** Node.js, TypeScript, NestJS, Turso (libSQL), Prisma, JWT, Argon2, Swagger, ExcelJS, Socket.IO, Jest  
**Web:** Next.js, React, TypeScript, Tailwind CSS, TanStack Query, React Hook Form, Zod, Recharts  
**Infra:** `.env` (`TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`)

## Requisitos

- Node.js 20+
- pnpm 10+ (`corepack` ou `npm i -g pnpm`)
- Banco Turso ([turso db create](https://docs.turso.tech/cli/db/create)) — sem credenciais, a API usa o SQLite local

## Instalação

```bash
cp .env.example .env
# Preencha TURSO_DATABASE_URL e TURSO_AUTH_TOKEN
pnpm install
```

## Migrations e seed

```bash
pnpm db:generate
pnpm db:migrate
pnpm db:seed
```

Usuários de desenvolvimento (senha `Timekeeper@123`):

| Papel | E-mail |
| --- | --- |
| Gestor | `gestor@example.com` |
| Funcionário | `funcionario@example.com` |

Há também `maria@example.com`, `carlos@example.com` (equipe da Ana) e `gestor.b@example.com` / `outro@example.com` (outra equipe, para testar isolamento).

## Execução local

```bash
pnpm dev
```

- Web: http://localhost:3000
- API: http://localhost:3001
- Swagger: http://localhost:3001/docs

Serviços isolados:

```bash
pnpm dev:api
pnpm dev:web
```

## Testes

```bash
pnpm test
pnpm lint
pnpm build
```

Os testes unitários cobrem:

- saldo do banco de horas (`08:00/08:00`, `+01:00`, `-00:30`)
- sequência de ponto válida e inválida
- isolamento gestor/funcionário (403)
- transições de folga e motivo obrigatório na rejeição

## Variáveis de ambiente

Ver `.env.example`. Principais:

```text
DATABASE_URL=file:./dev.db
TURSO_DATABASE_URL=
TURSO_AUTH_TOKEN=
JWT_SECRET=
JWT_REFRESH_SECRET=
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
APP_URL=http://localhost:3000
API_URL=http://localhost:3001
DEFAULT_TIMEZONE=America/Sao_Paulo
SMTP_HOST=
```

Sem SMTP, o link de recuperação de senha é gravado no log da API.

## API REST

```text
POST /auth/login
POST /auth/logout
POST /auth/refresh
POST /auth/forgot-password
POST /auth/reset-password
GET  /auth/me
GET  /time-clock/today
POST /time-clock
GET  /time-clock/history
GET  /time-bank/me
GET  /reports/time-bank.xlsx
GET  /dashboard/me
GET  /dashboard/team
GET  /vacations/me
POST /vacations
GET  /vacations/team
```

Erros seguem:

```json
{
  "success": false,
  "error": {
    "code": "INVALID_TIME_ENTRY",
    "message": "Não é possível registrar uma saída sem uma entrada ativa."
  }
}
```

## Estrutura de diretórios

```text
apps/api/src
  auth/           login, refresh, recuperação
  employees/      CRUD + autorização de equipe
  work-schedules/ escala por dia da semana
  time-clock/     ponto + regras + ajustes
  time-bank/      apuração e saldo
  time-off/       folgas
  vacations/      férias (saldo, período, cobertura)
  notifications/  in-app
  events/         WebSocket / Socket.IO
  reports/        Excel
  dashboard/
  audit/
  common/         timezone, filters, guards
apps/web/src
  app/(app)/      área autenticada (sidebar)
  app/login
  components/     shadcn/ui + layout
  lib/            cliente HTTP
  providers/      React Query, auth, socket
```
