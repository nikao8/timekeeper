import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type AuditPayload = {
  actorId?: string | null;
  action: string;
  entity: string;
  entityId: string;
  before?: Prisma.InputJsonValue | null;
  after?: Prisma.InputJsonValue | null;
  reason?: string | null;
  ipAddress?: string | null;
};

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(payload: AuditPayload): Promise<void> {
    this.logger.log(
      `${payload.action} ${payload.entity}:${payload.entityId} by ${payload.actorId ?? 'system'}`,
    );
    await this.prisma.auditLog.create({
      data: {
        actorId: payload.actorId ?? null,
        action: payload.action,
        entity: payload.entity,
        entityId: payload.entityId,
        before: payload.before ?? Prisma.JsonNull,
        after: payload.after ?? Prisma.JsonNull,
        reason: payload.reason ?? null,
        ipAddress: payload.ipAddress ?? null,
      },
    });
  }
}
