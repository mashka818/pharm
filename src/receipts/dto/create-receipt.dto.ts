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

export class CreateReceiptDto {
  @ApiProperty({
    description: 'Дата чека',
    example: '2024-08-11T14:30:00Z',
    required: true,
  })
  @IsDateString()
  date: string;

  @ApiProperty({
    description: 'Номер чека',
    example: 12345,
    required: true,
  })
  @IsNumber()
  number: number;

  @ApiProperty({
    description: 'Общая сумма чека в копейках',
    example: 150000,
    required: true,
  })
  @IsNumber()
  price: number;

  @ApiProperty({
    description: 'Общая сумма кэшбека в копейках',
    example: 1500,
    required: true,
  })
  @IsNumber()
  cashback: number;

  @ApiProperty({
    description: 'Статус чека',
    example: 'success',
    enum: ['pending', 'success', 'rejected', 'processing', 'failed'],
    required: true,
  })
  @IsIn(['pending', 'success', 'rejected', 'processing', 'failed'])
  status: 'pending' | 'success' | 'rejected' | 'processing' | 'failed';

  @ApiProperty({
    description: 'Адрес магазина',
    example: 'ул. Пушкина, д. 10',
    required: true,
  })
  @IsString()
  address: string;

  @ApiPropertyOptional({
    description: 'ID клиента (если известен)',
    example: 1,
  })
  @IsOptional()
  @IsNumber()
  customerId?: number;

  @ApiProperty({
    description: 'ID промоакции',
    example: 'r-pharm',
    required: true,
  })
  @IsString()
  promotionId: string;

  @ApiProperty({
    description: 'Список продуктов в чеке',
    type: [CreateReceiptProductDto],
    required: true,
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateReceiptProductDto)
  products: CreateReceiptProductDto[];
}
