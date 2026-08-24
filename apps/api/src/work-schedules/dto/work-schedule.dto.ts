import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TimeEntryType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class WorkScheduleDayDto {
  @ApiProperty({ example: 1, description: '0=Domingo ... 6=Sábado' })
  @IsInt()
  @Min(0)
  @Max(6)
  weekday!: number;

  @ApiProperty()
  @IsBoolean()
  isWorkDay!: boolean;

  @ApiPropertyOptional({ example: '08:00' })
  @IsOptional()
  @IsString()
  expectedStart?: string | null;

  @ApiPropertyOptional({ example: '18:00' })
  @IsOptional()
  @IsString()
  expectedEnd?: string | null;

  @ApiPropertyOptional({ example: '12:00' })
  @IsOptional()
  @IsString()
  lunchStart?: string | null;

  @ApiPropertyOptional({ example: '13:00' })
  @IsOptional()
  @IsString()
  lunchEnd?: string | null;

  @ApiPropertyOptional({ example: 480 })
  @IsOptional()
  @IsInt()
  expectedMinutes?: number;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @IsInt()
  clockInToleranceMinutes?: number;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @IsInt()
  clockOutToleranceMinutes?: number;
}

export class UpsertWorkScheduleDto {
  @ApiPropertyOptional({ example: 'Padrão' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: '2026-01-01' })
  @IsOptional()
  @IsDateString()
  effectiveFrom?: string;

  @ApiProperty({ type: [WorkScheduleDayDto] })
  @ValidateNested({ each: true })
  @Type(() => WorkScheduleDayDto)
  days!: WorkScheduleDayDto[];
}

export class ClockDto {
  @ApiProperty({ enum: TimeEntryType, example: TimeEntryType.ENTRADA })
  @IsEnum(TimeEntryType)
  type!: TimeEntryType;

  @ApiPropertyOptional({ description: 'ISO datetime; omit for now' })
  @IsOptional()
  @IsDateString()
  occurredAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  employeeId?: string;
}

export class AdjustTimeEntryDto {
  @ApiProperty({ enum: TimeEntryType })
  @IsEnum(TimeEntryType)
  type!: TimeEntryType;

  @ApiProperty({ example: '2026-08-24T11:02:00.000Z' })
  @IsDateString()
  occurredAt!: string;

  @ApiProperty({ example: 'Esqueceu de registrar a saída' })
  @IsString()
  reason!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  replaceEntryId?: string;
}

export class HistoryQueryDto {
  @ApiPropertyOptional({ example: '2026-08-01' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ example: '2026-08-31' })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({ example: '2026-08' })
  @IsOptional()
  @IsString()
  month?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  employeeId?: string;
}
