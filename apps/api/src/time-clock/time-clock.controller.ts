import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../auth/auth.types';
import {
  AdjustTimeEntryDto,
  ClockDto,
  HistoryQueryDto,
} from '../work-schedules/dto/work-schedule.dto';
import { TimeClockService } from './time-clock.service';

@ApiTags('time-clock')
@ApiBearerAuth()
@Controller('time-clock')
export class TimeClockController {
  constructor(private readonly clock: TimeClockService) {}

  @Get('today')
  @ApiOperation({ summary: 'Jornada de hoje do usuário autenticado' })
  today(@CurrentUser() user: AuthUser) {
    return this.clock.snapshot(user);
  }

  @Get('today/:employeeId')
  @ApiOperation({ summary: 'Jornada de hoje de um funcionário' })
  todayOf(@CurrentUser() user: AuthUser, @Param('employeeId') employeeId: string) {
    return this.clock.snapshot(user, employeeId);
  }

  @Post()
  @ApiOperation({ summary: 'Registrar ponto' })
  punch(@CurrentUser() user: AuthUser, @Body() dto: ClockDto) {
    return this.clock.clock(user, dto);
  }

  @Get('history')
  @ApiOperation({ summary: 'Histórico de ponto' })
  history(@CurrentUser() user: AuthUser, @Query() query: HistoryQueryDto) {
    return this.clock.history(user, query);
  }

  @Get(':employeeId/days/:date')
  @ApiOperation({ summary: 'Detalhe de um dia, incluindo registros inativos (auditoria)' })
  day(
    @CurrentUser() user: AuthUser,
    @Param('employeeId') employeeId: string,
    @Param('date') date: string,
  ) {
    return this.clock.dayDetail(user, employeeId, date);
  }

  @Post(':employeeId/adjustments')
  @ApiOperation({ summary: 'Ajuste gerencial de ponto (não sobrescreve o original)' })
  adjust(
    @CurrentUser() user: AuthUser,
    @Param('employeeId') employeeId: string,
    @Body() dto: AdjustTimeEntryDto,
  ) {
    return this.clock.adjust(user, employeeId, dto);
  }
}
