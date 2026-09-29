import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreateVacationDto, ReviewVacationDto } from './dto/vacation.dto';
import { VacationService } from './vacation.service';

@ApiTags('vacations')
@ApiBearerAuth()
@Controller('vacations')
export class VacationController {
  constructor(private readonly vacations: VacationService) {}

  @Get('me')
  @ApiOperation({ summary: 'Saldo e solicitações de férias' })
  mine(@CurrentUser() user: AuthUser) {
    return this.vacations.mine(user);
  }

  @Post()
  @ApiOperation({ summary: 'Solicitar férias' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateVacationDto) {
    return this.vacations.create(user, dto);
  }

  @Get('team')
  @UseGuards(RolesGuard)
  @Roles(Role.GESTOR)
  @ApiOperation({ summary: 'Férias da equipe e cobertura' })
  team(@CurrentUser() user: AuthUser) {
    return this.vacations.team(user);
  }

  @Get('pending-count')
  @UseGuards(RolesGuard)
  @Roles(Role.GESTOR)
  @ApiOperation({ summary: 'Quantidade de férias pendentes da equipe' })
  pendingCount(@CurrentUser() user: AuthUser) {
    return this.vacations.pendingCount(user);
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancelar férias pendentes' })
  cancel(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.vacations.cancel(user, id);
  }

  @Post(':id/approve')
  @UseGuards(RolesGuard)
  @Roles(Role.GESTOR)
  @ApiOperation({ summary: 'Aprovar férias' })
  approve(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: ReviewVacationDto) {
    return this.vacations.approve(user, id, dto.reviewNotes);
  }

  @Post(':id/reject')
  @UseGuards(RolesGuard)
  @Roles(Role.GESTOR)
  @ApiOperation({ summary: 'Rejeitar férias (motivo obrigatório)' })
  reject(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: ReviewVacationDto) {
    return this.vacations.reject(user, id, dto.reviewNotes);
  }
}
