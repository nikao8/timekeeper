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
import { CreateTimeOffDto } from './dto/time-off.dto';

@Injectable()
export class TimeOffService {
  private readonly logger = new Logger(TimeOffService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: EmployeeAccessService,
    private readonly datetime: DateTimeService,
    private readonly notifications: NotificationsService,
    private readonly timeBank: TimeBankService,
    private readonly audit: AuditService,
  ) {}

  async create(user: AuthUser, dto: CreateTimeOffDto) {
    const date = this.datetime.dateOnly(dto.date);
    const existing = await this.prisma.timeOffRequest.findFirst({
      where: {
        employeeId: user.employeeId,
        date,
        status: { in: [TimeOffStatus.PENDENTE, TimeOffStatus.APROVADA] },
      },
    });
    if (existing) {
      throw new AppException(
        ErrorCode.TIME_OFF_ALREADY_EXISTS,
        'Já existe uma solicitação pendente ou aprovada para esta data.',
        HttpStatus.CONFLICT,
      );
    }

    const request = await this.prisma.timeOffRequest.create({
      data: {
        employeeId: user.employeeId,
        date,
        reason: dto.reason,
        notes: dto.notes,
      },
    });

    const employee = await this.access.requireEmployee(user.employeeId);
    const formatted = this.datetime.fromUtc(date, employee.timezone).toFormat('dd/MM');
    await this.notifications.notifyManagerOfEmployee(user.employeeId, {
      type: NotificationType.TIME_OFF_REQUEST,
      title: 'Solicitação de folga',
      message: `${employee.firstName} ${employee.lastName} solicitou folga para ${formatted}`,
      metadata: { requestId: request.id, date: dto.date },
    });
    this.logger.log(`Time off requested ${request.id} by ${user.employeeId}`);
    await this.audit.record({
      actorId: user.id,
      action: 'TIME_OFF_CREATE',
      entity: 'TimeOffRequest',
      entityId: request.id,
      after: { date: dto.date, reason: dto.reason },
    });
    return request;
  }

  async listMine(user: AuthUser) {
    return this.prisma.timeOffRequest.findMany({
      where: { employeeId: user.employeeId },
      orderBy: { date: 'desc' },
    });
  }

  async listTeam(user: AuthUser, status?: TimeOffStatus) {
    return this.prisma.timeOffRequest.findMany({
      where: {
        employee: { managerId: user.employeeId },
        ...(status ? { status } : {}),
      },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: [{ status: 'asc' }, { date: 'asc' }],
    });
  }

  async pendingCount(user: AuthUser) {
    const count = await this.prisma.timeOffRequest.count({
      where: {
        employee: { managerId: user.employeeId },
        status: TimeOffStatus.PENDENTE,
      },
    });
    return { count };
  }

  async cancel(user: AuthUser, id: string) {
    const request = await this.requireOwned(user, id);
    if (request.status !== TimeOffStatus.PENDENTE) {
      throw new AppException(
        ErrorCode.TIME_OFF_NOT_PENDING,
        'Somente solicitações pendentes podem ser canceladas.',
      );
    }
    const updated = await this.prisma.timeOffRequest.update({
      where: { id },
      data: { status: TimeOffStatus.CANCELADA },
    });
    await this.audit.record({
      actorId: user.id,
      action: 'TIME_OFF_CANCEL',
      entity: 'TimeOffRequest',
      entityId: id,
    });
    return updated;
  }

  async approve(user: AuthUser, id: string, notes?: string) {
    const request = await this.requireTeamRequest(user, id);
    if (request.status !== TimeOffStatus.PENDENTE) {
      throw new AppException(
        ErrorCode.TIME_OFF_NOT_PENDING,
        'Somente solicitações pendentes podem ser aprovadas.',
      );
    }
    const updated = await this.prisma.timeOffRequest.update({
      where: { id },
      data: {
        status: TimeOffStatus.APROVADA,
        reviewedById: user.employeeId,
        reviewNotes: notes,
        reviewedAt: this.datetime.nowUtc(),
      },
      include: { employee: { include: { user: true } } },
    });
    await this.timeBank.settleDay(
      updated.employeeId,
      this.datetime.calendarDate(updated.date, updated.employee.timezone),
    );
    await this.notifications.create({
      userId: updated.employee.userId,
      type: NotificationType.TIME_OFF_DECISION,
      title: 'Folga aprovada',
      message: `Sua folga em ${this.datetime.fromUtc(updated.date).toFormat('dd/MM')} foi aprovada.`,
    });
    await this.audit.record({
      actorId: user.id,
      action: 'TIME_OFF_APPROVE',
      entity: 'TimeOffRequest',
      entityId: id,
      reason: notes,
    });
    this.logger.log(`Time off ${id} approved by ${user.id}`);
    return updated;
  }

  async reject(user: AuthUser, id: string, notes?: string) {
    if (!notes?.trim()) {
      throw new AppException(
        ErrorCode.TIME_OFF_REJECTION_REASON_REQUIRED,
        'Informe o motivo da rejeição.',
      );
    }
    const request = await this.requireTeamRequest(user, id);
    if (request.status !== TimeOffStatus.PENDENTE) {
      throw new AppException(
        ErrorCode.TIME_OFF_NOT_PENDING,
        'Somente solicitações pendentes podem ser rejeitadas.',
      );
    }
    const updated = await this.prisma.timeOffRequest.update({
      where: { id },
      data: {
        status: TimeOffStatus.REJEITADA,
        reviewedById: user.employeeId,
        reviewNotes: notes,
        reviewedAt: this.datetime.nowUtc(),
      },
      include: { employee: { include: { user: true } } },
    });
    await this.notifications.create({
      userId: updated.employee.userId,
      type: NotificationType.TIME_OFF_DECISION,
      title: 'Folga rejeitada',
      message: `Sua folga em ${this.datetime.fromUtc(updated.date).toFormat('dd/MM')} foi rejeitada. Motivo: ${notes}`,
    });
    await this.audit.record({
      actorId: user.id,
      action: 'TIME_OFF_REJECT',
      entity: 'TimeOffRequest',
      entityId: id,
      reason: notes,
    });
    this.logger.log(`Time off ${id} rejected by ${user.id}`);
    return updated;
  }

  private async requireOwned(user: AuthUser, id: string) {
    const request = await this.prisma.timeOffRequest.findUnique({ where: { id } });
    if (!request) {
      throw new AppException(
        ErrorCode.TIME_OFF_NOT_FOUND,
        'Solicitação não encontrada.',
        HttpStatus.NOT_FOUND,
      );
    }
    if (request.employeeId !== user.employeeId) {
      throw new AppException(
        ErrorCode.FORBIDDEN,
        'Você não pode alterar esta solicitação.',
        HttpStatus.FORBIDDEN,
      );
    }
    return request;
  }

  private async requireTeamRequest(user: AuthUser, id: string) {
    const request = await this.prisma.timeOffRequest.findUnique({
      where: { id },
      include: { employee: true },
    });
    if (!request) {
      throw new AppException(
        ErrorCode.TIME_OFF_NOT_FOUND,
        'Solicitação não encontrada.',
        HttpStatus.NOT_FOUND,
      );
    }
    await this.access.assertCanManage(user, request.employeeId);
    return request;
  }
}
