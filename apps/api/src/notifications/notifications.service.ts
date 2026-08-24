import { Injectable } from '@nestjs/common';
import { Prisma, type NotificationType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EventsGateway } from '../events/events.gateway';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsGateway,
  ) {}

  async list(userId: string, unreadOnly = false) {
    return this.prisma.notification.findMany({
      where: { userId, ...(unreadOnly ? { read: false } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async unreadCount(userId: string) {
    const count = await this.prisma.notification.count({ where: { userId, read: false } });
    return { count };
  }

  async markRead(userId: string, id: string) {
    await this.prisma.notification.updateMany({ where: { id, userId }, data: { read: true } });
    return { read: true };
  }

  async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });
    return { read: true };
  }

  async create(params: {
    userId: string;
    type: NotificationType;
    title: string;
    message: string;
    metadata?: Record<string, unknown>;
  }) {
    const notification = await this.prisma.notification.create({
      data: {
        userId: params.userId,
        type: params.type,
        title: params.title,
        message: params.message,
        metadata: params.metadata as Prisma.InputJsonValue | undefined,
      },
    });
    this.events.emitNotification(params.userId, notification);
    return notification;
  }

  async notifyManagerOfEmployee(
    employeeId: string,
    payload: {
      type: NotificationType;
      title: string;
      message: string;
      metadata?: Record<string, unknown>;
    },
  ) {
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      include: { manager: { include: { user: true } } },
    });
    if (!employee?.manager) {
      return null;
    }
    const notification = await this.create({
      userId: employee.manager.userId,
      ...payload,
    });
    this.events.emitTeamEvent(employee.manager.id, {
      type: payload.type,
      employeeId,
      message: payload.message,
    });
    return notification;
  }
}
