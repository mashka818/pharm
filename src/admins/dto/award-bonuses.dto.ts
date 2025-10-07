import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString, IsOptional, Min } from 'class-validator';

export class AwardBonusesDto {
  @ApiProperty({
    description: 'ID клиента',
    example: 123,
  })
  @IsNumber()
  customerId: number;

  @ApiProperty({
    description: 'Сумма бонусов в копейках',
    example: 100000,
  })
  @IsNumber()
  @Min(1)
  amount: number;

  @ApiProperty({
    description: 'Причина начисления бонусов',
    example: 'Компенсация за технические проблемы',
    required: false,
  })
  @IsString()
  @IsOptional()
  reason?: string;
}
