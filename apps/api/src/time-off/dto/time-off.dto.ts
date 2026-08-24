import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateTimeOffDto {
  @ApiProperty({ example: '2026-08-25' })
  @IsDateString()
  date!: string;

  @ApiProperty({ example: 'Consulta médica' })
  @IsString()
  @MinLength(3)
  reason!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class ReviewTimeOffDto {
  @ApiPropertyOptional({ example: 'Equipe reduzida nesta data' })
  @IsOptional()
  @IsString()
  reviewNotes?: string;
}
