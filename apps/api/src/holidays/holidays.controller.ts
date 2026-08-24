import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { HolidayScope, Role } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { DateTimeService } from '../common/datetime/datetime.service';
import type { AuthUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';

class CreateHolidayDto {
  @ApiProperty({ example: '2026-09-07' })
  @IsDateString()
  date!: string;

  @ApiProperty({ example: 'Independência do Brasil' })
  @IsString()
  name!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: HolidayScope, required: false })
  @IsOptional()
  @IsEnum(HolidayScope)
  scope?: HolidayScope;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  stateCode?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  cityCode?: string;
}

@ApiTags('holidays')
@ApiBearerAuth()
@Controller('holidays')
export class HolidaysController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly datetime: DateTimeService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Listar feriados' })
  list() {
    return this.prisma.holiday.findMany({ orderBy: { date: 'asc' } });
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.GESTOR)
  @ApiOperation({ summary: 'Cadastrar feriado' })
  create(@CurrentUser() _user: AuthUser, @Body() dto: CreateHolidayDto) {
    return this.prisma.holiday.create({
      data: {
        date: this.datetime.dateOnly(dto.date),
        name: dto.name,
        description: dto.description,
        scope: dto.scope ?? HolidayScope.NATIONAL,
        stateCode: dto.stateCode,
        cityCode: dto.cityCode,
      },
    });
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.GESTOR)
  @ApiOperation({ summary: 'Remover feriado' })
  async remove(@Param('id') id: string) {
    await this.prisma.holiday.delete({ where: { id } });
    return { deleted: true };
  }
}
