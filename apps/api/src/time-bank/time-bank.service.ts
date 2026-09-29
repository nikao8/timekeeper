import { Injectable, Logger } from '@nestjs/common';
import { TimeBankTransactionType, TimeOffStatus } from '@prisma/client';
import { computeDailyBalance, computeWorkedMinutes } from '../time-clock/time-clock.rules';
import type { AuthUser } from '../auth/auth.types';
import { DateTimeService } from '../common/datetime/datetime.service';
import { EmployeeAccessService } from '../employees/employee-access.service';
import { PrismaService } from '../prisma/prisma.service';
import { WorkScheduleService } from '../work-schedules/work-schedule.service';

@Injectable()
export class TimeBankService {
  private readonly logger = new Logger(TimeBankService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: EmployeeAccessService,
    private readonly datetime: DateTimeService,
    private readonly schedules: WorkScheduleService,
  ) {}

  async getBalance(user: AuthUser, employeeId: string) {
    await this.access.assertCanAccess(user, employeeId);
    const bank = await this.ensureBank(employeeId);
    const transactions = await this.prisma.timeBankTransaction.findMany({
      where: { employeeId },
      orderBy: { workDate: 'desc' },
      take: 60,
    });
    return {
      balanceMinutes: bank.balanceMinutes,
      balanceFormatted: this.datetime.formatDuration(bank.balanceMinutes),
      transactions: transactions.map((tx) => ({
        ...tx,
        deltaFormatted: this.datetime.formatDuration(tx.deltaMinutes),
        expectedFormatted: this.datetime.formatDuration(tx.expectedMinutes, false),
        workedFormatted: this.datetime.formatDuration(tx.workedMinutes, false),
      })),
    };
  }

  async teamBalances(user: AuthUser) {
    const employees = await this.prisma.employee.findMany({
      where: { managerId: user.employeeId, isActive: true },
      include: { timeBank: true },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });
    return employees.map((employee) => {
      const minutes = employee.timeBank?.balanceMinutes ?? 0;
      return {
        employeeId: employee.id,
        fullName: `${employee.firstName} ${employee.lastName}`,
        balanceMinutes: minutes,
        balanceFormatted: this.datetime.formatDuration(minutes),
        extraMinutes: Math.max(0, minutes),
        negativeMinutes: Math.max(0, -minutes),
      };
    });
  }

  async settleDay(employeeId: string, isoDate: string): Promise<void> {
    const employee = await this.prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee) {
      return;
    }
    const timezone = employee.timezone;
    const from = this.datetime.startOfDayUtc(isoDate, timezone);
    const to = this.datetime.endOfDayUtc(isoDate, timezone);

    const [entries, holiday, timeOff, vacation] = await Promise.all([
      this.prisma.timeEntry.findMany({
        where: { employeeId, isActive: true, occurredAt: { gte: from, lte: to } },
        orderBy: { occurredAt: 'asc' },
      }),
      this.prisma.holiday.findFirst({ where: { date: this.datetime.dateOnly(isoDate) } }),
      this.prisma.timeOffRequest.findFirst({
        where: {
          employeeId,
          date: this.datetime.dateOnly(isoDate),
          status: TimeOffStatus.APROVADA,
        },
      }),
      this.prisma.vacationRequest.findFirst({
        where: {
          employeeId,
          status: TimeOffStatus.APROVADA,
          startDate: { lte: this.datetime.dateOnly(isoDate) },
          endDate: { gte: this.datetime.dateOnly(isoDate) },
        },
      }),
    ]);

    const { day } = await this.safeDay(employeeId, isoDate, timezone);
    const isExempt = Boolean(holiday || timeOff || vacation || !day?.isWorkDay);
    const expectedMinutes = isExempt ? 0 : (day?.expectedMinutes ?? 0);
    const workedMinutes = computeWorkedMinutes(entries, this.datetime.nowUtc());
    const balance = computeDailyBalance(workedMinutes, expectedMinutes);

    const bank = await this.ensureBank(employeeId);
    const existing = await this.prisma.timeBankTransaction.findFirst({
      where: {
        employeeId,
        workDate: this.datetime.dateOnly(isoDate),
        type: TimeBankTransactionType.DAILY_BALANCE,
      },
    });

    const previousDelta = existing?.deltaMinutes ?? 0;
    const nextBalance = bank.balanceMinutes - previousDelta + balance.deltaMinutes;

    await this.prisma.$transaction(async (tx) => {
      if (existing) {
        await tx.timeBankTransaction.update({
          where: { id: existing.id },
          data: {
            expectedMinutes: balance.expectedMinutes,
            workedMinutes: balance.workedMinutes,
            extraMinutes: balance.extraMinutes,
            negativeMinutes: balance.negativeMinutes,
            deltaMinutes: balance.deltaMinutes,
            balanceAfter: nextBalance,
            metadata: {
              holidayId: holiday?.id ?? null,
              timeOffId: timeOff?.id ?? null,
              vacationId: vacation?.id ?? null,
              exempt: isExempt,
            },
          },
        });
      } else {
        await tx.timeBankTransaction.create({
          data: {
            timeBankId: bank.id,
            employeeId,
            type: TimeBankTransactionType.DAILY_BALANCE,
            workDate: this.datetime.dateOnly(isoDate),
            expectedMinutes: balance.expectedMinutes,
            workedMinutes: balance.workedMinutes,
            extraMinutes: balance.extraMinutes,
            negativeMinutes: balance.negativeMinutes,
            deltaMinutes: balance.deltaMinutes,
            balanceAfter: nextBalance,
            metadata: {
              holidayId: holiday?.id ?? null,
              timeOffId: timeOff?.id ?? null,
              vacationId: vacation?.id ?? null,
              exempt: isExempt,
            },
          },
        });
      }
      await tx.timeBank.update({
        where: { id: bank.id },
        data: { balanceMinutes: nextBalance },
      });
    });

    this.logger.log(
      `Settled ${isoDate} for ${employeeId}: worked=${balance.workedMinutes} expected=${balance.expectedMinutes} delta=${balance.deltaMinutes}`,
    );
  }

  async summarizeRange(employeeId: string, from: string, to: string) {
    const txs = await this.prisma.timeBankTransaction.findMany({
      where: {
        employeeId,
        type: TimeBankTransactionType.DAILY_BALANCE,
        workDate: {
          gte: this.datetime.dateOnly(from),
          lte: this.datetime.dateOnly(to),
        },
      },
      orderBy: { workDate: 'asc' },
    });
    const expectedMinutes = txs.reduce((sum, tx) => sum + tx.expectedMinutes, 0);
    const workedMinutes = txs.reduce((sum, tx) => sum + tx.workedMinutes, 0);
    const extraMinutes = txs.reduce((sum, tx) => sum + tx.extraMinutes, 0);
    const negativeMinutes = txs.reduce((sum, tx) => sum + tx.negativeMinutes, 0);
    return { expectedMinutes, workedMinutes, extraMinutes, negativeMinutes, days: txs };
  }

  private async ensureBank(employeeId: string) {
    const existing = await this.prisma.timeBank.findUnique({ where: { employeeId } });
    if (existing) {
      return existing;
    }
    return this.prisma.timeBank.create({ data: { employeeId, balanceMinutes: 0 } });
  }

  private async safeDay(employeeId: string, isoDate: string, timezone: string) {
    try {
      return await this.schedules.dayFor(employeeId, isoDate, timezone);
    } catch {
      return { day: null, weekday: this.datetime.weekday(isoDate, timezone) };
    }
  }
}
