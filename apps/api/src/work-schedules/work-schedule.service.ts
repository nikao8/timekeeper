import { HttpStatus, Injectable } from '@nestjs/common';
import { ErrorCode } from '@timekeeper/shared';
import type { AuthUser } from '../auth/auth.types';
import { DateTimeService } from '../common/datetime/datetime.service';
import { AppException } from '../common/errors/app.exception';
import { EmployeeAccessService } from '../employees/employee-access.service';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertWorkScheduleDto } from './dto/work-schedule.dto';

const DEFAULT_DAYS = [1, 2, 3, 4, 5].map((weekday) => ({
  weekday,
  isWorkDay: true,
  expectedStart: '08:00',
  expectedEnd: '18:00',
  lunchStart: '12:00',
  lunchEnd: '13:00',
  expectedMinutes: 480,
  clockInToleranceMinutes: 10,
  clockOutToleranceMinutes: 10,
}));

@Injectable()
export class WorkScheduleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: EmployeeAccessService,
    private readonly datetime: DateTimeService,
  ) {}

  async getForEmployee(user: AuthUser, employeeId: string) {
    await this.access.assertCanAccess(user, employeeId);
    return this.prisma.workSchedule.findFirst({
      where: { employeeId, isActive: true },
      include: { days: { orderBy: { weekday: 'asc' } } },
      orderBy: { effectiveFrom: 'desc' },
    });
  }

  async upsert(user: AuthUser, employeeId: string, dto: UpsertWorkScheduleDto) {
    await this.access.assertCanManage(user, employeeId);
    const existing = await this.prisma.workSchedule.findFirst({
      where: { employeeId, isActive: true },
    });

    if (existing) {
      await this.prisma.workScheduleDay.deleteMany({ where: { scheduleId: existing.id } });
      return this.prisma.workSchedule.update({
        where: { id: existing.id },
        data: {
          name: dto.name ?? existing.name,
          effectiveFrom: dto.effectiveFrom
            ? this.datetime.dateOnly(dto.effectiveFrom)
            : existing.effectiveFrom,
          days: { create: this.normalizeDays(dto) },
        },
        include: { days: { orderBy: { weekday: 'asc' } } },
      });
    }

    return this.prisma.workSchedule.create({
      data: {
        employeeId,
        name: dto.name ?? 'Padrão',
        effectiveFrom: this.datetime.dateOnly(dto.effectiveFrom ?? this.datetime.today()),
        days: { create: this.normalizeDays(dto) },
      },
      include: { days: { orderBy: { weekday: 'asc' } } },
    });
  }

  async ensureDefault(employeeId: string) {
    const existing = await this.prisma.workSchedule.findFirst({
      where: { employeeId, isActive: true },
    });
    if (existing) {
      return existing;
    }
    return this.prisma.workSchedule.create({
      data: {
        employeeId,
        name: 'Padrão',
        effectiveFrom: this.datetime.dateOnly(this.datetime.today()),
        days: { create: DEFAULT_DAYS },
      },
      include: { days: true },
    });
  }

  async dayFor(employeeId: string, isoDate: string, timezone: string) {
    const weekday = this.datetime.weekday(isoDate, timezone);
    const schedule = await this.prisma.workSchedule.findFirst({
      where: {
        employeeId,
        isActive: true,
        effectiveFrom: { lte: this.datetime.dateOnly(isoDate) },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: this.datetime.dateOnly(isoDate) } }],
      },
      include: { days: true },
      orderBy: { effectiveFrom: 'desc' },
    });
    if (!schedule) {
      throw new AppException(
        ErrorCode.SCHEDULE_NOT_FOUND,
        'Funcionário sem escala ativa.',
        HttpStatus.NOT_FOUND,
      );
    }
    const day = schedule.days.find((item) => item.weekday === weekday);
    return { schedule, day, weekday };
  }

  private normalizeDays(dto: UpsertWorkScheduleDto) {
    const byWeekday = new Map(dto.days.map((day) => [day.weekday, day]));
    return Array.from({ length: 7 }, (_, weekday) => {
      const day = byWeekday.get(weekday);
      if (!day) {
        return {
          weekday,
          isWorkDay: false,
          expectedMinutes: 0,
          clockInToleranceMinutes: 10,
          clockOutToleranceMinutes: 10,
        };
      }
      return {
        weekday,
        isWorkDay: day.isWorkDay,
        expectedStart: day.expectedStart ?? null,
        expectedEnd: day.expectedEnd ?? null,
        lunchStart: day.lunchStart ?? null,
        lunchEnd: day.lunchEnd ?? null,
        expectedMinutes: day.expectedMinutes ?? (day.isWorkDay ? 480 : 0),
        clockInToleranceMinutes: day.clockInToleranceMinutes ?? 10,
        clockOutToleranceMinutes: day.clockOutToleranceMinutes ?? 10,
      };
    });
  }
}
