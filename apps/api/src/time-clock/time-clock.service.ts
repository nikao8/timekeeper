import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { NotificationType, TimeEntrySource, TimeEntryType } from '@prisma/client';
import { ErrorCode, TIME_ENTRY_LABELS_PT } from '@timekeeper/shared';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../auth/auth.types';
import { DateTimeService } from '../common/datetime/datetime.service';
import { AppException } from '../common/errors/app.exception';
import { EmployeeAccessService } from '../employees/employee-access.service';
import { EventsGateway } from '../events/events.gateway';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { TimeBankService } from '../time-bank/time-bank.service';
import { WorkScheduleService } from '../work-schedules/work-schedule.service';
import {
  AdjustTimeEntryDto,
  ClockDto,
  HistoryQueryDto,
} from '../work-schedules/dto/work-schedule.dto';
import {
  allowedTypes,
  computeDailyBalance,
  computeWorkedMinutes,
  delayMinutes,
  deriveWorkStatus,
  findByType,
  isLate,
} from './time-clock.rules';
import { INVALID_SEQUENCE_MESSAGES } from './time-clock.messages';

@Injectable()
export class TimeClockService {
  private readonly logger = new Logger(TimeClockService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: EmployeeAccessService,
    private readonly datetime: DateTimeService,
    private readonly schedules: WorkScheduleService,
    private readonly timeBank: TimeBankService,
    private readonly notifications: NotificationsService,
    private readonly events: EventsGateway,
    private readonly audit: AuditService,
  ) {}

  async clock(user: AuthUser, dto: ClockDto) {
    const employeeId = dto.employeeId ?? user.employeeId;
    if (employeeId !== user.employeeId) {
      throw new AppException(
        ErrorCode.FORBIDDEN,
        'Registros de ponto próprios não podem ser feitos em nome de outra pessoa. Use o ajuste gerencial.',
        HttpStatus.FORBIDDEN,
      );
    }
    const employee = await this.access.requireEmployee(employeeId);
    const occurredAt = dto.occurredAt ? new Date(dto.occurredAt) : this.datetime.nowUtc();
    const isoDate = this.datetime.calendarDate(occurredAt, employee.timezone);
    const dayEntries = await this.dayEntries(employeeId, isoDate, employee.timezone);
    const status = deriveWorkStatus(dayEntries);

    if (!allowedTypes(status).includes(dto.type)) {
      throw new AppException(ErrorCode.INVALID_TIME_ENTRY, INVALID_SEQUENCE_MESSAGES[dto.type]);
    }

    const created = await this.prisma.timeEntry.create({
      data: {
        employeeId,
        type: dto.type,
        occurredAt,
        source: TimeEntrySource.CLOCK,
      },
    });

    this.logger.log(`Clock ${dto.type} for ${employeeId} at ${occurredAt.toISOString()}`);
    await this.audit.record({
      actorId: user.id,
      action: 'TIME_ENTRY_CLOCK',
      entity: 'TimeEntry',
      entityId: created.id,
      after: { type: dto.type, occurredAt: occurredAt.toISOString() },
    });

    await this.timeBank.settleDay(employeeId, isoDate);
    const snapshot = await this.snapshot(user, employeeId);
    this.events.emitEmployeeUpdate(employeeId, snapshot);
    await this.notifyClock(employee, dto.type, occurredAt);

    return snapshot;
  }

  async snapshot(user: AuthUser, employeeId?: string) {
    const id = employeeId ?? user.employeeId;
    const employee = await this.access.assertCanAccess(user, id);
    const isoDate = this.datetime.today(employee.timezone);
    const entries = await this.dayEntries(id, isoDate, employee.timezone);
    const status = deriveWorkStatus(entries);
    const { day } = await this.safeScheduleDay(id, isoDate, employee.timezone);
    const expectedMinutes = day?.isWorkDay ? (day.expectedMinutes ?? 0) : 0;
    const workedMinutes = computeWorkedMinutes(entries, this.datetime.nowUtc());
    const balance = computeDailyBalance(workedMinutes, expectedMinutes);
    const entrada = findByType(entries, TimeEntryType.ENTRADA);
    const saidaAlmoco = findByType(entries, TimeEntryType.SAIDA_ALMOCO);
    const retorno = findByType(entries, TimeEntryType.RETORNO_ALMOCO);
    const saida = findByType(entries, TimeEntryType.SAIDA);
    const bank = await this.prisma.timeBank.findUnique({ where: { employeeId: id } });

    let delay = 0;
    if (entrada && day?.expectedStart) {
      const expectedStart = this.datetime.combine(isoDate, day.expectedStart, employee.timezone);
      delay = delayMinutes(entrada.occurredAt, expectedStart, day.clockInToleranceMinutes);
    }

    const pendingTimeOff = await this.prisma.timeOffRequest.count({
      where: { employeeId: id, status: 'PENDENTE' },
    });
    const upcoming = await this.prisma.timeOffRequest.findMany({
      where: {
        employeeId: id,
        status: { in: ['PENDENTE', 'APROVADA'] },
        date: { gte: this.datetime.dateOnly(isoDate) },
      },
      orderBy: { date: 'asc' },
      take: 5,
    });

    return {
      employeeId: id,
      date: isoDate,
      status,
      allowedActions: allowedTypes(status),
      entries: this.serializeEntries(entries, employee.timezone),
      journey: {
        entrada: this.fmt(entrada?.occurredAt, employee.timezone),
        saidaAlmoco: this.fmt(saidaAlmoco?.occurredAt, employee.timezone),
        retornoAlmoco: this.fmt(retorno?.occurredAt, employee.timezone),
        saida: this.fmt(saida?.occurredAt, employee.timezone),
      },
      expectedMinutes,
      workedMinutes,
      extraMinutes: balance.extraMinutes,
      negativeMinutes: balance.negativeMinutes,
      dayBalanceMinutes: balance.deltaMinutes,
      dayBalanceFormatted: this.datetime.formatDuration(balance.deltaMinutes),
      workedFormatted: this.datetime.formatDuration(workedMinutes, false),
      expectedFormatted: this.datetime.formatDuration(expectedMinutes, false),
      delayMinutes: delay,
      isLate: Boolean(
        entrada && day?.expectedStart && day.isWorkDay
          ? isLate(
              entrada.occurredAt,
              this.datetime.combine(isoDate, day.expectedStart, employee.timezone),
              day.clockInToleranceMinutes,
            )
          : false,
      ),
      timeBankMinutes: bank?.balanceMinutes ?? 0,
      timeBankFormatted: this.datetime.formatDuration(bank?.balanceMinutes ?? 0),
      pendingTimeOff,
      upcomingTimeOff: upcoming,
      scheduleDay: day,
    };
  }

  async history(user: AuthUser, query: HistoryQueryDto) {
    const employeeId = query.employeeId ?? user.employeeId;
    const employee = await this.access.assertCanAccess(user, employeeId);
    const { from, to } = this.resolveRange(query, employee.timezone);
    const days: Array<Record<string, unknown>> = [];
    let cursor = from;
    while (cursor <= to) {
      const entries = await this.dayEntries(employeeId, cursor, employee.timezone);
      if (entries.length > 0 || query.status) {
        const status = deriveWorkStatus(entries);
        if (!query.status || query.status === status) {
          const { day } = await this.safeScheduleDay(employeeId, cursor, employee.timezone);
          const expectedMinutes = day?.isWorkDay ? (day.expectedMinutes ?? 0) : 0;
          const workedMinutes = computeWorkedMinutes(
            entries,
            this.datetime.endOfDayUtc(cursor, employee.timezone),
          );
          const balance = computeDailyBalance(workedMinutes, expectedMinutes);
          days.push({
            date: cursor,
            status,
            entrada: this.fmt(
              findByType(entries, TimeEntryType.ENTRADA)?.occurredAt,
              employee.timezone,
            ),
            saidaAlmoco: this.fmt(
              findByType(entries, TimeEntryType.SAIDA_ALMOCO)?.occurredAt,
              employee.timezone,
            ),
            retornoAlmoco: this.fmt(
              findByType(entries, TimeEntryType.RETORNO_ALMOCO)?.occurredAt,
              employee.timezone,
            ),
            saida: this.fmt(
              findByType(entries, TimeEntryType.SAIDA)?.occurredAt,
              employee.timezone,
            ),
            expectedMinutes,
            workedMinutes,
            dayBalanceMinutes: balance.deltaMinutes,
            expectedFormatted: this.datetime.formatDuration(expectedMinutes, false),
            workedFormatted: this.datetime.formatDuration(workedMinutes, false),
            dayBalanceFormatted: this.datetime.formatDuration(balance.deltaMinutes),
            entries: this.serializeEntries(entries, employee.timezone),
          });
        }
      }
      cursor = this.datetime.addDays(cursor, 1);
    }
    return { from, to, employeeId, days };
  }

  async adjust(user: AuthUser, employeeId: string, dto: AdjustTimeEntryDto) {
    const employee = await this.access.assertCanManage(user, employeeId);
    const occurredAt = new Date(dto.occurredAt);
    const isoDate = this.datetime.calendarDate(occurredAt, employee.timezone);

    const created = await this.prisma.$transaction(async (tx) => {
      let replaced: {
        id: string;
        type: TimeEntryType;
        occurredAt: Date;
        isActive: boolean;
      } | null = null;
      if (dto.replaceEntryId) {
        replaced = await tx.timeEntry.findFirst({
          where: { id: dto.replaceEntryId, employeeId },
        });
        if (replaced) {
          await tx.timeEntry.update({ where: { id: replaced.id }, data: { isActive: false } });
        }
      }
      const entry = await tx.timeEntry.create({
        data: {
          employeeId,
          type: dto.type,
          occurredAt,
          source: TimeEntrySource.ADJUSTMENT,
          notes: dto.reason,
          adjustedById: user.employeeId,
        },
      });
      if (replaced) {
        await tx.timeEntry.update({
          where: { id: replaced.id },
          data: { replacedById: entry.id, isActive: false },
        });
      }
      return { entry, replaced };
    });

    await this.audit.record({
      actorId: user.id,
      action: 'TIME_ENTRY_ADJUST',
      entity: 'TimeEntry',
      entityId: created.entry.id,
      before: created.replaced
        ? {
            id: created.replaced.id,
            type: created.replaced.type,
            occurredAt: created.replaced.occurredAt,
          }
        : null,
      after: { type: dto.type, occurredAt: occurredAt.toISOString() },
      reason: dto.reason,
    });

    const dayEntries = await this.dayEntries(employeeId, isoDate, employee.timezone);
    const status = deriveWorkStatus(dayEntries);
    if (status === 'FORA_DO_TRABALHO' && dayEntries.length > 0) {
      throw new AppException(
        ErrorCode.TIME_ENTRY_OUT_OF_SEQUENCE,
        'O ajuste resultaria em uma sequência de ponto inválida.',
      );
    }

    await this.timeBank.settleDay(employeeId, isoDate);
    this.logger.log(`Time entry adjusted for ${employeeId} by ${user.id}`);
    return this.snapshot(user, employeeId);
  }

  async dayDetail(user: AuthUser, employeeId: string, isoDate: string) {
    const employee = await this.access.assertCanAccess(user, employeeId);
    const entries = await this.prisma.timeEntry.findMany({
      where: {
        employeeId,
        occurredAt: {
          gte: this.datetime.startOfDayUtc(isoDate, employee.timezone),
          lte: this.datetime.endOfDayUtc(isoDate, employee.timezone),
        },
      },
      orderBy: { occurredAt: 'asc' },
      include: { adjustedBy: { select: { firstName: true, lastName: true } } },
    });
    return {
      date: isoDate,
      entries: entries.map((entry) => ({
        ...this.serializeEntry(entry, employee.timezone),
        isActive: entry.isActive,
        source: entry.source,
        notes: entry.notes,
        adjustedBy: entry.adjustedBy
          ? `${entry.adjustedBy.firstName} ${entry.adjustedBy.lastName}`
          : null,
      })),
    };
  }

  private async dayEntries(employeeId: string, isoDate: string, timezone: string) {
    return this.prisma.timeEntry.findMany({
      where: {
        employeeId,
        isActive: true,
        occurredAt: {
          gte: this.datetime.startOfDayUtc(isoDate, timezone),
          lte: this.datetime.endOfDayUtc(isoDate, timezone),
        },
      },
      orderBy: { occurredAt: 'asc' },
    });
  }

  private async safeScheduleDay(employeeId: string, isoDate: string, timezone: string) {
    try {
      return await this.schedules.dayFor(employeeId, isoDate, timezone);
    } catch {
      return { day: null };
    }
  }

  private resolveRange(query: HistoryQueryDto, timezone: string): { from: string; to: string } {
    if (query.month) {
      const monthDate = query.month.length === 7 ? `${query.month}-01` : query.month;
      return {
        from: this.datetime.startOfMonth(monthDate),
        to: this.datetime.endOfMonth(monthDate),
      };
    }
    const to = query.to ?? this.datetime.today(timezone);
    const from = query.from ?? this.datetime.startOfMonth(to);
    return { from, to };
  }

  private serializeEntries(
    entries: Array<{ id: string; type: TimeEntryType; occurredAt: Date; source: string }>,
    tz: string,
  ) {
    return entries.map((entry) => this.serializeEntry(entry, tz));
  }

  private serializeEntry(
    entry: { id: string; type: TimeEntryType; occurredAt: Date; source: string },
    tz: string,
  ) {
    return {
      id: entry.id,
      type: entry.type,
      occurredAt: entry.occurredAt,
      time: this.fmt(entry.occurredAt, tz),
      source: entry.source,
    };
  }

  private fmt(date: Date | undefined, tz: string): string | null {
    if (!date) {
      return null;
    }
    return this.datetime.fromUtc(date, tz).toFormat('HH:mm');
  }

  private async notifyClock(
    employee: { id: string; firstName: string; lastName: string },
    type: TimeEntryType,
    occurredAt: Date,
  ) {
    const time = this.datetime.fromUtc(occurredAt).toFormat('HH:mm');
    const name = `${employee.firstName} ${employee.lastName}`;
    const verb: Record<TimeEntryType, string> = {
      ENTRADA: `iniciou a jornada às ${time}`,
      SAIDA_ALMOCO: `iniciou o almoço às ${time}`,
      RETORNO_ALMOCO: `retornou do almoço às ${time}`,
      SAIDA: `finalizou a jornada às ${time}`,
    };
    await this.notifications.notifyManagerOfEmployee(employee.id, {
      type: NotificationType.TIME_ENTRY,
      title: TIME_ENTRY_LABELS_PT[type] ?? type,
      message: `${name} ${verb[type]}`,
      metadata: { employeeId: employee.id, type, occurredAt: occurredAt.toISOString() },
    });
  }
}
