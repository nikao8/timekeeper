import {
  HolidayScope,
  NotificationType,
  Role,
  TimeBankTransactionType,
  TimeEntryType,
  TimeOffStatus,
} from '@prisma/client';
import * as argon2 from 'argon2';
import { DateTime } from 'luxon';
import { createPrismaClient } from '../src/prisma/create-client';

const prisma = createPrismaClient();
const TZ = 'America/Sao_Paulo';
const PASSWORD = process.env.SEED_PASSWORD ?? 'Timekeeper@123';

const weekdayDays = [0, 1, 2, 3, 4, 5, 6].map((weekday) => {
  const isWorkDay = weekday >= 1 && weekday <= 5;
  return {
    weekday,
    isWorkDay,
    expectedStart: isWorkDay ? '08:00' : null,
    expectedEnd: isWorkDay ? '18:00' : null,
    lunchStart: isWorkDay ? '12:00' : null,
    lunchEnd: isWorkDay ? '13:00' : null,
    expectedMinutes: isWorkDay ? 480 : 0,
    clockInToleranceMinutes: 10,
    clockOutToleranceMinutes: 10,
  };
});

async function main() {
  await prisma.vacationRequest.deleteMany();
  await prisma.vacationBalance.deleteMany();
  await prisma.timeBankTransaction.deleteMany();
  await prisma.timeBank.deleteMany();
  await prisma.timeEntry.deleteMany();
  await prisma.timeOffRequest.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.workScheduleDay.deleteMany();
  await prisma.workSchedule.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.passwordResetToken.deleteMany();
  await prisma.holiday.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await argon2.hash(PASSWORD);

  const anaUser = await prisma.user.create({
    data: { email: 'gestor@example.com', passwordHash, role: Role.GESTOR },
  });
  const ana = await prisma.employee.create({
    data: {
      userId: anaUser.id,
      firstName: 'Ana',
      lastName: 'Gestora',
      jobTitle: 'Gestora de pessoas',
      hireDate: new Date('2020-03-01'),
      timezone: TZ,
    },
  });

  const joaoUser = await prisma.user.create({
    data: { email: 'funcionario@example.com', passwordHash, role: Role.FUNCIONARIO },
  });
  const joao = await prisma.employee.create({
    data: {
      userId: joaoUser.id,
      firstName: 'João',
      lastName: 'Silva',
      jobTitle: 'Analista',
      hireDate: new Date('2022-06-15'),
      managerId: ana.id,
      timezone: TZ,
    },
  });

  const mariaUser = await prisma.user.create({
    data: { email: 'maria@example.com', passwordHash, role: Role.FUNCIONARIO },
  });
  const maria = await prisma.employee.create({
    data: {
      userId: mariaUser.id,
      firstName: 'Maria',
      lastName: 'Souza',
      jobTitle: 'Desenvolvedora',
      hireDate: new Date('2023-01-10'),
      managerId: ana.id,
      timezone: TZ,
    },
  });

  const carlosUser = await prisma.user.create({
    data: { email: 'carlos@example.com', passwordHash, role: Role.FUNCIONARIO },
  });
  const carlos = await prisma.employee.create({
    data: {
      userId: carlosUser.id,
      firstName: 'Carlos',
      lastName: 'Lima',
      jobTitle: 'Suporte',
      hireDate: new Date('2024-02-01'),
      managerId: ana.id,
      timezone: TZ,
    },
  });

  const otherManagerUser = await prisma.user.create({
    data: { email: 'gestor.b@example.com', passwordHash, role: Role.GESTOR },
  });
  const gestorB = await prisma.employee.create({
    data: {
      userId: otherManagerUser.id,
      firstName: 'Bruno',
      lastName: 'Gestor',
      jobTitle: 'Gestor B',
      managerId: null,
      timezone: TZ,
    },
  });
  const otherEmpUser = await prisma.user.create({
    data: { email: 'outro@example.com', passwordHash, role: Role.FUNCIONARIO },
  });
  const outro = await prisma.employee.create({
    data: {
      userId: otherEmpUser.id,
      firstName: 'Paula',
      lastName: 'Nunes',
      jobTitle: 'Financeiro',
      managerId: gestorB.id,
      timezone: TZ,
    },
  });

  for (const employee of [ana, joao, maria, carlos, gestorB, outro]) {
    await prisma.workSchedule.create({
      data: {
        employeeId: employee.id,
        name: 'Padrão',
        effectiveFrom: new Date('2026-01-01'),
        days: { create: weekdayDays },
      },
    });
    await prisma.timeBank.create({ data: { employeeId: employee.id, balanceMinutes: 0 } });
    await prisma.vacationBalance.create({
      data: { employeeId: employee.id, year: DateTime.now().setZone(TZ).year, entitledDays: 30, usedDays: 0 },
    });
  }

  await prisma.holiday.createMany({
    data: [
      { date: new Date('2026-01-01'), name: 'Confraternização Universal', scope: HolidayScope.NATIONAL },
      { date: new Date('2026-04-21'), name: 'Tiradentes', scope: HolidayScope.NATIONAL },
      { date: new Date('2026-09-07'), name: 'Independência do Brasil', scope: HolidayScope.NATIONAL },
      { date: new Date('2026-12-25'), name: 'Natal', scope: HolidayScope.NATIONAL },
    ],
  });

  const workdays = lastWorkdays(5);
  let joaoBalance = 0;
  for (const [index, iso] of workdays.entries()) {
    const extra = index === 0 ? 60 : index === 1 ? 30 : index === 2 ? -45 : 15;
    joaoBalance += extra;
    await seedDay(joao.id, iso, extra);
    await seedDay(maria.id, iso, index % 2 === 0 ? -15 : 20);
    await seedDay(carlos.id, iso, 10);
    await seedDay(ana.id, iso, 0);
  }

  await prisma.timeOffRequest.createMany({
    data: [
      {
        employeeId: joao.id,
        date: DateTime.now().setZone(TZ).plus({ days: 3 }).startOf('day').toJSDate(),
        reason: 'Consulta médica',
        notes: 'Retorno às 14h',
        status: TimeOffStatus.PENDENTE,
      },
      {
        employeeId: maria.id,
        date: DateTime.now().setZone(TZ).plus({ days: 10 }).startOf('day').toJSDate(),
        reason: 'Assuntos pessoais',
        status: TimeOffStatus.APROVADA,
        reviewedById: ana.id,
        reviewedAt: new Date(),
      },
    ],
  });

  const year = DateTime.now().setZone(TZ).year;
  const vacationStart = DateTime.now().setZone(TZ).plus({ days: 20 }).startOf('day');
  const vacationEnd = vacationStart.plus({ days: 4 });
  await prisma.vacationRequest.create({
    data: {
      employeeId: carlos.id,
      startDate: vacationStart.toJSDate(),
      endDate: vacationEnd.toJSDate(),
      days: 5,
      reason: 'Férias de fim de ano',
      status: TimeOffStatus.APROVADA,
      reviewedById: ana.id,
      reviewedAt: new Date(),
    },
  });
  await prisma.vacationBalance.update({
    where: { employeeId_year: { employeeId: carlos.id, year } },
    data: { usedDays: 5 },
  });
  const pendingStart = DateTime.now().setZone(TZ).plus({ days: 40 }).startOf('day');
  await prisma.vacationRequest.create({
    data: {
      employeeId: joao.id,
      startDate: pendingStart.toJSDate(),
      endDate: pendingStart.plus({ days: 9 }).toJSDate(),
      days: 10,
      reason: 'Viagem em família',
      status: TimeOffStatus.PENDENTE,
    },
  });

  await prisma.notification.createMany({
    data: [
      {
        userId: anaUser.id,
        type: NotificationType.TIME_ENTRY,
        title: 'Entrada',
        message: 'João Silva iniciou a jornada às 08:01',
      },
      {
        userId: anaUser.id,
        type: NotificationType.TIME_OFF_REQUEST,
        title: 'Solicitação de folga',
        message: 'João Silva solicitou folga para os próximos dias',
        read: false,
      },
      {
        userId: joaoUser.id,
        type: NotificationType.TIME_OFF_DECISION,
        title: 'Folga aprovada',
        message: 'Sua folga foi aprovada em um pedido anterior.',
        read: true,
      },
    ],
  });

  console.log('Seed complete.');
  console.log(`  Gestor:       gestor@example.com / ${PASSWORD}`);
  console.log(`  Funcionário:  funcionario@example.com / ${PASSWORD}`);
  console.log(`  João bank:    ${joaoBalance} minutes (approx last days)`);
}

function lastWorkdays(count: number): string[] {
  const days: string[] = [];
  let cursor = DateTime.now().setZone(TZ).minus({ days: 1 }).startOf('day');
  while (days.length < count) {
    if (cursor.weekday >= 1 && cursor.weekday <= 5) {
      days.push(cursor.toISODate()!);
    }
    cursor = cursor.minus({ days: 1 });
  }
  return days.reverse();
}

async function seedDay(employeeId: string, iso: string, extraMinutes: number) {
  const start = DateTime.fromISO(iso, { zone: TZ }).set({ hour: 8, minute: extraMinutes >= 0 ? 0 : 15 });
  const lunchOut = start.set({ hour: 12, minute: 0 });
  const lunchIn = start.set({ hour: 13, minute: 0 });
  const end = start.set({ hour: 17, minute: extraMinutes > 0 ? extraMinutes : 0 });

  await prisma.timeEntry.createMany({
    data: [
      { employeeId, type: TimeEntryType.ENTRADA, occurredAt: start.toUTC().toJSDate() },
      { employeeId, type: TimeEntryType.SAIDA_ALMOCO, occurredAt: lunchOut.toUTC().toJSDate() },
      { employeeId, type: TimeEntryType.RETORNO_ALMOCO, occurredAt: lunchIn.toUTC().toJSDate() },
      { employeeId, type: TimeEntryType.SAIDA, occurredAt: end.toUTC().toJSDate() },
    ],
  });

  const bank = await prisma.timeBank.findUniqueOrThrow({ where: { employeeId } });
  const next = bank.balanceMinutes + extraMinutes;
  await prisma.timeBankTransaction.create({
    data: {
      timeBankId: bank.id,
      employeeId,
      type: TimeBankTransactionType.DAILY_BALANCE,
      workDate: DateTime.fromISO(iso, { zone: 'utc' }).toJSDate(),
      expectedMinutes: 480,
      workedMinutes: 480 + extraMinutes,
      extraMinutes: Math.max(0, extraMinutes),
      negativeMinutes: Math.max(0, -extraMinutes),
      deltaMinutes: extraMinutes,
      balanceAfter: next,
    },
  });
  await prisma.timeBank.update({ where: { id: bank.id }, data: { balanceMinutes: next } });
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
