import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role, TimeOffStatus } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import type { AuthUser } from '../auth/auth.types';
import { CreateTimeOffDto, ReviewTimeOffDto } from './dto/time-off.dto';
import { TimeOffService } from './time-off.service';

@ApiTags('time-off')
@ApiBearerAuth()
@Controller('time-off')
export class TimeOffController {
  constructor(private readonly timeOff: TimeOffService) {}

  @Post()
  @ApiOperation({ summary: 'Solicitar folga' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateTimeOffDto) {
    return this.timeOff.create(user, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Minhas solicitações de folga' })
  mine(@CurrentUser() user: AuthUser) {
    return this.timeOff.listMine(user);
  }

  @Get('team')
  @UseGuards(RolesGuard)
  @Roles(Role.GESTOR)
  @ApiOperation({ summary: 'Solicitações da equipe' })
  team(@CurrentUser() user: AuthUser, @Query('status') status?: TimeOffStatus) {
    return this.timeOff.listTeam(user, status);
  }

  @Get('pending-count')
  @UseGuards(RolesGuard)
  @Roles(Role.GESTOR)
  @ApiOperation({ summary: 'Quantidade de solicitações pendentes da equipe' })
  pendingCount(@CurrentUser() user: AuthUser) {
    return this.timeOff.pendingCount(user);
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancelar solicitação pendente' })
  cancel(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.timeOff.cancel(user, id);
  }

  @Post(':id/approve')
  @UseGuards(RolesGuard)
  @Roles(Role.GESTOR)
  @ApiOperation({ summary: 'Aprovar folga' })
  approve(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: ReviewTimeOffDto) {
    return this.timeOff.approve(user, id, dto.reviewNotes);
  }

  @Post(':id/reject')
  @UseGuards(RolesGuard)
  @Roles(Role.GESTOR)
  @ApiOperation({ summary: 'Rejeitar folga (motivo obrigatório)' })
  reject(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: ReviewTimeOffDto) {
    return this.timeOff.reject(user, id, dto.reviewNotes);
  }
}
