import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../auth/auth.types';
import { UpsertWorkScheduleDto } from './dto/work-schedule.dto';
import { WorkScheduleService } from './work-schedule.service';

@ApiTags('work-schedules')
@ApiBearerAuth()
@Controller('work-schedules')
export class WorkSchedulesController {
  constructor(private readonly schedules: WorkScheduleService) {}

  @Get(':employeeId')
  @ApiOperation({ summary: 'Obter escala ativa do funcionário' })
  get(@CurrentUser() user: AuthUser, @Param('employeeId') employeeId: string) {
    return this.schedules.getForEmployee(user, employeeId);
  }

  @Put(':employeeId')
  @ApiOperation({ summary: 'Criar ou atualizar escala do funcionário' })
  upsert(
    @CurrentUser() user: AuthUser,
    @Param('employeeId') employeeId: string,
    @Body() dto: UpsertWorkScheduleDto,
  ) {
    return this.schedules.upsert(user, employeeId, dto);
  }
}
