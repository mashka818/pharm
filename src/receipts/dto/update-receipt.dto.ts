import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { CreateReceiptProductDto } from './create-receipt-product.dto';

export class UpdateReceiptDto {
  @ApiProperty({
    description: 'ID чека для обновления',
    example: 1,
    required: true,
  })
  @IsNumber()
  id: number;

  @ApiPropertyOptional({
    description: 'Дата чека',
    example: '2024-08-11T14:30:00Z',
  })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiPropertyOptional({
    description: 'Номер чека',
    example: 12345,
  })
  @IsOptional()
  @IsNumber()
  number?: number;

  @ApiPropertyOptional({
    description: 'Общая сумма чека в копейках',
    example: 150000,
  })
  @IsOptional()
  @IsNumber()
  price?: number;

  @ApiPropertyOptional({
    description: 'Общая сумма кэшбека в копейках',
    example: 1500,
  })
  @IsOptional()
  @IsNumber()
  cashback?: number;

  @ApiPropertyOptional({
    description: 'Статус чека',
    example: 'success',
    enum: ['pending', 'success', 'rejected', 'processing', 'failed'],
  })
  @IsOptional()
  @IsIn(['pending', 'success', 'rejected', 'processing', 'failed'])
  status?: 'pending' | 'success' | 'rejected' | 'processing' | 'failed';

  @ApiPropertyOptional({
    description: 'Адрес магазина',
    example: 'ул. Пушкина, д. 10',
  })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({
    description: 'ID клиента (если известен)',
    example: 1,
  })
  @IsOptional()
  @IsNumber()
  customerId?: number;

  @ApiPropertyOptional({
    description: 'ID промоакции',
    example: 'r-pharm',
  })
  @IsOptional()
  @IsString()
  promotionId?: string;

  @ApiPropertyOptional({
    description: 'Список продуктов в чеке',
    type: [CreateReceiptProductDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateReceiptProductDto)
  products?: CreateReceiptProductDto[];
}
