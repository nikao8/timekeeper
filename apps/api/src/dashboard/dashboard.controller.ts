import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import type { AuthUser } from '../auth/auth.types';
import { DashboardService } from './dashboard.service';

@ApiTags('dashboard')
@ApiBearerAuth()
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('me')
  @ApiOperation({ summary: 'Dashboard do funcionário (gestor inclusive)' })
  me(@CurrentUser() user: AuthUser) {
    return this.dashboard.employee(user);
  }

  @Get('team')
  @UseGuards(RolesGuard)
  @Roles(Role.GESTOR)
  @ApiOperation({ summary: 'Dashboard gerencial da equipe' })
  team(@CurrentUser() user: AuthUser) {
    return this.dashboard.manager(user);
  }
}
