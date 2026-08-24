import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import type { AuthUser } from '../auth/auth.types';
import { CreateEmployeeDto, QueryEmployeesDto, UpdateEmployeeDto } from './dto/employee.dto';
import { EmployeesService } from './employees.service';

@ApiTags('employees')
@ApiBearerAuth()
@Controller('employees')
export class EmployeesController {
  constructor(private readonly employees: EmployeesService) {}

  @Get()
  @UseGuards(RolesGuard)
  @Roles(Role.GESTOR)
  @ApiOperation({ summary: 'Listar funcionários da equipe' })
  list(@CurrentUser() user: AuthUser, @Query() query: QueryEmployeesDto) {
    return this.employees.list(user, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalhes do funcionário' })
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.employees.get(user, id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.GESTOR)
  @ApiOperation({ summary: 'Criar funcionário' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateEmployeeDto) {
    return this.employees.create(user, dto);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.GESTOR)
  @ApiOperation({ summary: 'Atualizar funcionário' })
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateEmployeeDto) {
    return this.employees.update(user, id, dto);
  }
}
