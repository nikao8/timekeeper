import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class AdjustTimeBankDto {
  @ApiProperty({ enum: ['CREDITO', 'DEBITO'], example: 'CREDITO' })
  @IsIn(['CREDITO', 'DEBITO'])
  direction!: 'CREDITO' | 'DEBITO';

  @ApiProperty({ example: 2, description: 'Horas inteiras do lançamento' })
  @IsInt()
  @Min(0)
  @Max(200)
  hours!: number;

  @ApiProperty({ example: 30, description: 'Minutos adicionais, de 0 a 59' })
  @IsInt()
  @Min(0)
  @Max(59)
  minutes!: number;

  @ApiProperty({ example: 'Compensação de plantão no sábado' })
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  note!: string;
}
