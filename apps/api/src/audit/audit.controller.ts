import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import type { AuthUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('audit')
@ApiBearerAuth()
@Controller('audit')
@UseGuards(RolesGuard)
@Roles(Role.GESTOR)
export class AuditController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'Listar logs de auditoria da equipe do gestor' })
  async list(
    @CurrentUser() user: AuthUser,
    @Query('entity') entity?: string,
    @Query('entityId') entityId?: string,
  ) {
    return this.prisma.auditLog.findMany({
      where: {
        ...(entity ? { entity } : {}),
        ...(entityId ? { entityId } : {}),
        actor: {
          OR: [
            { id: user.id },
            { employee: { managerId: user.employeeId } },
            { employee: { id: user.employeeId } },
          ],
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        actor: {
          select: {
            id: true,
            email: true,
            employee: { select: { firstName: true, lastName: true } },
          },
        },
      },
    });
  }
}
