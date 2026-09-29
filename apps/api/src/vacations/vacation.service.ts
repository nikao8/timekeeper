import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { NotificationType, TimeOffStatus } from '@prisma/client';
import { ErrorCode } from '@timekeeper/shared';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../auth/auth.types';
import { DateTimeService } from '../common/datetime/datetime.service';
import { AppException } from '../common/errors/app.exception';
import { EmployeeAccessService } from '../employees/employee-access.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { TimeBankService } from '../time-bank/time-bank.service';
import { CreateVacationDto } from './dto/vacation.dto';

const ACTIVE = [TimeOffStatus.PENDENTE, TimeOffStatus.APROVADA];

@Injectable()
export class VacationService {
  private readonly logger = new Logger(VacationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: EmployeeAccessService,
    private readonly datetime: DateTimeService,
    private readonly notifications: NotificationsService,
    private readonly timeBank: TimeBankService,
    private readonly audit: AuditService,
  ) {}

  async mine(user: AuthUser) {
    const employee = await this.access.requireEmployee(user.employeeId);
    const year = Number(this.datetime.today(employee.timezone).slice(0, 4));
    const balance = await this.ensureBalance(user.employeeId, year);
    const requests = await this.prisma.vacationRequest.findMany({
      where: { employeeId: user.employeeId },
      orderBy: { startDate: 'desc' },
    });
    return {
      balance: this.presentBalance(balance),
      requests,
    };
  }

  async create(user: AuthUser, dto: CreateVacationDto) {
    const employee = await this.access.requireEmployee(user.employeeId);
    const startIso = dto.startDate.slice(0, 10);
    const endIso = dto.endDate.slice(0, 10);
    if (endIso < startIso) {
      throw new AppException(
        ErrorCode.VACATION_INVALID_RANGE,
        'A data final precisa ser igual ou posterior à data inicial.',
      );
    }
    if (startIso < this.datetime.today(employee.timezone)) {
      throw new AppException(
        ErrorCode.VACATION_INVALID_RANGE,
        'Não é possível solicitar férias com início no passado.',
      );
    }
    const days = this.countDays(startIso, endIso);
    if (days < 1 || days > 30) {
      throw new AppException(
        ErrorCode.VACATION_INVALID_RANGE,
        'Um período de férias deve ter entre 1 e 30 dias corridos.',
      );
    }

    const start = this.datetime.dateOnly(startIso);
    const end = this.datetime.dateOnly(endIso);
    const overlap = await this.prisma.vacationRequest.findFirst({
      where: {
        employeeId: user.employeeId,
        status: { in: ACTIVE },
        startDate: { lte: end },
        endDate: { gte: start },
      },
    });
    if (overlap) {
      throw new AppException(
        ErrorCode.VACATION_OVERLAP,
        'Já existe férias pendentes ou aprovadas nesse período.',
        HttpStatus.CONFLICT,
      );
    }

    const year = Number(startIso.slice(0, 4));
    const balance = await this.ensureBalance(user.employeeId, year);
    if (balance.entitledDays - balance.usedDays < days) {
      throw new AppException(
        ErrorCode.VACATION_INSUFFICIENT_BALANCE,
        `Saldo insuficiente. Disponível: ${balance.entitledDays - balance.usedDays} dia(s).`,
      );
    }

    const request = await this.prisma.vacationRequest.create({
      data: {
        employeeId: user.employeeId,
        startDate: start,
        endDate: end,
        days,
        reason: dto.reason,
      },
    });

    const formatted = `${this.formatBr(startIso)} a ${this.formatBr(endIso)}`;
    await this.notifications.notifyManagerOfEmployee(user.employeeId, {
      type: NotificationType.VACATION_REQUEST,
      title: 'Solicitação de férias',
      message: `${employee.firstName} ${employee.lastName} solicitou ${days} dia(s) de férias (${formatted}).`,
      metadata: { requestId: request.id, startDate: startIso, endDate: endIso },
    });
    await this.audit.record({
      actorId: user.id,
      action: 'VACATION_CREATE',
      entity: 'VacationRequest',
      entityId: request.id,
      after: { startDate: startIso, endDate: endIso, days },
    });
    this.logger.log(`Vacation ${request.id} requested by ${user.employeeId}`);
    return request;
  }

  async cancel(user: AuthUser, id: string) {
    const request = await this.requireOwned(user, id);
    if (request.status !== TimeOffStatus.PENDENTE) {
      throw new AppException(
        ErrorCode.VACATION_NOT_PENDING,
        'Somente solicitações pendentes podem ser canceladas.',
      );
    }
    const updated = await this.prisma.vacationRequest.update({
      where: { id },
      data: { status: TimeOffStatus.CANCELADA },
    });
    await this.audit.record({
      actorId: user.id,
      action: 'VACATION_CANCEL',
      entity: 'VacationRequest',
      entityId: id,
    });
    return updated;
  }

  async team(user: AuthUser) {
    const today = this.datetime.dateOnly(this.datetime.today());
    const requests = await this.prisma.vacationRequest.findMany({
      where: {
        employee: { managerId: user.employeeId },
        OR: [{ status: TimeOffStatus.PENDENTE }, { status: TimeOffStatus.APROVADA, endDate: { gte: today } }],
      },
      include: { employee: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { startDate: 'asc' },
    });
    const withCoverage = await Promise.all(
      requests.map(async (request) => ({
        ...request,
        overlapCount: await this.overlapCount(user.employeeId, request),
      })),
    );
    return {
      pending: withCoverage.filter((item) => item.status === TimeOffStatus.PENDENTE),
      upcoming: withCoverage.filter((item) => item.status === TimeOffStatus.APROVADA),
    };
  }

  async pendingCount(user: AuthUser) {
    const count = await this.prisma.vacationRequest.count({
      where: {
        employee: { managerId: user.employeeId },
        status: TimeOffStatus.PENDENTE,
      },
    });
    return { count };
  }

  async approve(user: AuthUser, id: string, notes?: string) {
    const request = await this.requireTeamRequest(user, id);
    if (request.status !== TimeOffStatus.PENDENTE) {
      throw new AppException(
        ErrorCode.VACATION_NOT_PENDING,
        'Somente solicitações pendentes podem ser aprovadas.',
      );
    }
    const year = request.startDate.getUTCFullYear();
    const balance = await this.ensureBalance(request.employeeId, year);
    if (balance.entitledDays - balance.usedDays < request.days) {
      throw new AppException(
        ErrorCode.VACATION_INSUFFICIENT_BALANCE,
        'O funcionário não tem saldo de férias para este período.',
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.vacationRequest.update({
        where: { id },
        data: {
          status: TimeOffStatus.APROVADA,
          reviewedById: user.employeeId,
          reviewNotes: notes,
          reviewedAt: this.datetime.nowUtc(),
        },
        include: { employee: true },
      });
      await tx.vacationBalance.update({
        where: { employeeId_year: { employeeId: request.employeeId, year } },
        data: { usedDays: { increment: request.days } },
      });
      return saved;
    });

    await this.settleRange(updated.employeeId, updated.startDate, updated.endDate);
    await this.notifications.create({
      userId: updated.employee.userId,
      type: NotificationType.VACATION_DECISION,
      title: 'Férias aprovadas',
      message: `Suas férias de ${request.days} dia(s) foram aprovadas.`,
    });
    await this.audit.record({
      actorId: user.id,
      action: 'VACATION_APPROVE',
      entity: 'VacationRequest',
      entityId: id,
      reason: notes,
    });
    return updated;
  }

  async reject(user: AuthUser, id: string, notes?: string) {
    if (!notes?.trim()) {
      throw new AppException(
        ErrorCode.VACATION_REJECTION_REASON_REQUIRED,
        'Informe o motivo da rejeição.',
      );
    }
    const request = await this.requireTeamRequest(user, id);
    if (request.status !== TimeOffStatus.PENDENTE) {
      throw new AppException(
        ErrorCode.VACATION_NOT_PENDING,
        'Somente solicitações pendentes podem ser rejeitadas.',
      );
    }
    const updated = await this.prisma.vacationRequest.update({
      where: { id },
      data: {
        status: TimeOffStatus.REJEITADA,
        reviewedById: user.employeeId,
        reviewNotes: notes,
        reviewedAt: this.datetime.nowUtc(),
      },
      include: { employee: true },
    });
    await this.notifications.create({
      userId: updated.employee.userId,
      type: NotificationType.VACATION_DECISION,
      title: 'Férias rejeitadas',
      message: `Suas férias foram rejeitadas. Motivo: ${notes}`,
    });
    await this.audit.record({
      actorId: user.id,
      action: 'VACATION_REJECT',
      entity: 'VacationRequest',
      entityId: id,
      reason: notes,
    });
    return updated;
  }

  private presentBalance(balance: { year: number; entitledDays: number; usedDays: number }) {
    return {
      year: balance.year,
      entitledDays: balance.entitledDays,
      usedDays: balance.usedDays,
      availableDays: balance.entitledDays - balance.usedDays,
    };
  }

  private async ensureBalance(employeeId: string, year: number) {
    const existing = await this.prisma.vacationBalance.findUnique({
      where: { employeeId_year: { employeeId, year } },
    });
    if (existing) {
      return existing;
    }
    return this.prisma.vacationBalance.create({
      data: { employeeId, year, entitledDays: 30, usedDays: 0 },
    });
  }

  private countDays(startIso: string, endIso: string): number {
    let count = 0;
    let cursor = startIso;
    while (cursor <= endIso) {
      count += 1;
      cursor = this.datetime.addDays(cursor, 1);
    }
    return count;
  }

  private formatBr(isoDate: string): string {
    const [year, month, day] = isoDate.split('-');
    return `${day}/${month}/${year}`;
  }

  private async overlapCount(
    managerId: string,
    request: { employeeId: string; startDate: Date; endDate: Date },
  ) {
    return this.prisma.vacationRequest.count({
      where: {
        status: TimeOffStatus.APROVADA,
        employeeId: { not: request.employeeId },
        employee: { managerId },
        startDate: { lte: request.endDate },
        endDate: { gte: request.startDate },
      },
    });
  }

  private async settleRange(employeeId: string, start: Date, end: Date) {
    let cursor = this.datetime.calendarDate(start, 'utc');
    const last = this.datetime.calendarDate(end, 'utc');
    while (cursor <= last) {
      await this.timeBank.settleDay(employeeId, cursor);
      cursor = this.datetime.addDays(cursor, 1);
    }
  }

  private async requireOwned(user: AuthUser, id: string) {
    const request = await this.prisma.vacationRequest.findUnique({ where: { id } });
    if (!request) {
      throw new AppException(ErrorCode.VACATION_NOT_FOUND, 'Solicitação de férias não encontrada.', HttpStatus.NOT_FOUND);
    }
    if (request.employeeId !== user.employeeId) {
      throw new AppException(ErrorCode.FORBIDDEN, 'Você não pode alterar esta solicitação.', HttpStatus.FORBIDDEN);
    }
    return request;
  }

  private async requireTeamRequest(user: AuthUser, id: string) {
    const request = await this.prisma.vacationRequest.findUnique({
      where: { id },
      include: { employee: true },
    });
    if (!request) {
      throw new AppException(ErrorCode.VACATION_NOT_FOUND, 'Solicitação de férias não encontrada.', HttpStatus.NOT_FOUND);
    }
    await this.access.assertCanManage(user, request.employeeId);
    return request;
  }
}
