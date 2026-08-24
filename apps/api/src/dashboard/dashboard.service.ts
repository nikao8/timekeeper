import { Injectable } from '@nestjs/common';
import { TimeOffStatus } from '@prisma/client';
import type { AuthUser } from '../auth/auth.types';
import { DateTimeService } from '../common/datetime/datetime.service';
import { PrismaService } from '../prisma/prisma.service';
import { TimeClockService } from '../time-clock/time-clock.service';
import { deriveWorkStatus } from '../time-clock/time-clock.rules';
import { WorkStatus } from '@timekeeper/shared';

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly datetime: DateTimeService,
    private readonly clock: TimeClockService,
  ) {}

  employee(user: AuthUser) {
    return this.clock.snapshot(user);
  }

  async manager(user: AuthUser) {
    const team = await this.prisma.employee.findMany({
      where: { managerId: user.employeeId, isActive: true },
      include: { timeBank: true, user: { select: { email: true } } },
    });

    const statuses = await Promise.all(
      team.map(async (employee) => {
        const isoDate = this.datetime.today(employee.timezone);
        const entries = await this.prisma.timeEntry.findMany({
          where: {
            employeeId: employee.id,
            isActive: true,
            occurredAt: {
              gte: this.datetime.startOfDayUtc(isoDate, employee.timezone),
              lte: this.datetime.endOfDayUtc(isoDate, employee.timezone),
            },
          },
        });
        return { employee, status: deriveWorkStatus(entries) };
      }),
    );

    const pending = await this.prisma.timeOffRequest.count({
      where: { status: TimeOffStatus.PENDENTE, employee: { managerId: user.employeeId } },
    });

    const ranking = [...team]
      .map((employee) => ({
        employeeId: employee.id,
        fullName: `${employee.firstName} ${employee.lastName}`,
        balanceMinutes: employee.timeBank?.balanceMinutes ?? 0,
      }))
      .sort((a, b) => b.balanceMinutes - a.balanceMinutes);

    const recent = await this.prisma.timeEntry.findMany({
      where: { employee: { managerId: user.employeeId }, isActive: true },
      include: { employee: { select: { firstName: true, lastName: true } } },
      orderBy: { occurredAt: 'desc' },
      take: 20,
    });

    return {
      summary: {
        activeEmployees: team.length,
        working: statuses.filter((item) => item.status === WorkStatus.EM_JORNADA).length,
        atLunch: statuses.filter((item) => item.status === WorkStatus.EM_ALMOCO).length,
        away: statuses.filter(
          (item) =>
            item.status === WorkStatus.FORA_DO_TRABALHO ||
            item.status === WorkStatus.JORNADA_FINALIZADA,
        ).length,
        pendingTimeOff: pending,
      },
      ranking: ranking.map((item) => ({
        ...item,
        balanceFormatted: this.datetime.formatDuration(item.balanceMinutes),
      })),
      team: statuses.map(({ employee, status }) => ({
        id: employee.id,
        fullName: `${employee.firstName} ${employee.lastName}`,
        status,
        balanceMinutes: employee.timeBank?.balanceMinutes ?? 0,
        balanceFormatted: this.datetime.formatDuration(employee.timeBank?.balanceMinutes ?? 0),
      })),
      activity: recent.map((entry) => ({
        id: entry.id,
        type: entry.type,
        occurredAt: entry.occurredAt,
        time: this.datetime.fromUtc(entry.occurredAt).toFormat('HH:mm'),
        employeeName: `${entry.employee.firstName} ${entry.employee.lastName}`,
      })),
    };
  }
}
