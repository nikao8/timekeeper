import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateVacationDto {
  @ApiProperty({ example: '2026-12-01' })
  @IsDateString()
  startDate!: string;

  @ApiProperty({ example: '2026-12-10' })
  @IsDateString()
  endDate!: string;

  @ApiPropertyOptional({ example: 'Viagem em família' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  reason?: string;
}

export class ReviewVacationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reviewNotes?: string;
}
