import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import type { AuthUser } from '../auth/auth.types';
import { AdjustTimeBankDto } from './dto/adjust-time-bank.dto';
import { TimeBankService } from './time-bank.service';

@ApiTags('time-bank')
@ApiBearerAuth()
@Controller('time-bank')
export class TimeBankController {
  constructor(private readonly timeBank: TimeBankService) {}

  @Get('me')
  @ApiOperation({ summary: 'Banco de horas do usuário autenticado' })
  me(@CurrentUser() user: AuthUser) {
    return this.timeBank.getBalance(user, user.employeeId);
  }

  @Get('team')
  @UseGuards(RolesGuard)
  @Roles(Role.GESTOR)
  @ApiOperation({ summary: 'Saldos da equipe' })
  team(@CurrentUser() user: AuthUser) {
    return this.timeBank.teamBalances(user);
  }

  @Post(':employeeId/adjustments')
  @UseGuards(RolesGuard)
  @Roles(Role.GESTOR)
  @ApiOperation({ summary: 'Lançar crédito ou débito no banco de horas' })
  adjust(
    @CurrentUser() user: AuthUser,
    @Param('employeeId') employeeId: string,
    @Body() dto: AdjustTimeBankDto,
  ) {
    return this.timeBank.adjust(user, employeeId, dto);
  }

  @Get(':employeeId')
  @ApiOperation({ summary: 'Banco de horas de um funcionário' })
  byEmployee(@CurrentUser() user: AuthUser, @Param('employeeId') employeeId: string) {
    return this.timeBank.getBalance(user, employeeId);
  }

  @Get(':employeeId/summary')
  @ApiOperation({ summary: 'Resumo do banco em um período' })
  summary(
    @CurrentUser() user: AuthUser,
    @Param('employeeId') employeeId: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.timeBank.getBalance(user, employeeId).then(async (balance) => {
      const range = await this.timeBank.summarizeRange(
        employeeId,
        from ?? this.startOfMonthFallback(),
        to ?? this.todayFallback(),
      );
      return { ...balance, range };
    });
  }

  private startOfMonthFallback(): string {
    const now = new Date();
    return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-01`;
  }

  private todayFallback(): string {
    return new Date().toISOString().slice(0, 10);
  }
}
