import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateReceiptProductDto {
  @ApiProperty({
    description: 'ID продукта',
    example: 1,
    required: true,
  })
  @IsNumber()
  productId: number;

  @ApiPropertyOptional({
    description: 'ID акции (если применима)',
    example: 1,
  })
  @IsOptional()
  @IsNumber()
  offerId?: number;

  @ApiPropertyOptional({
    description: 'Сумма кэшбека за этот продукт в копейках (рассчитывается автоматически, можно не указывать)',
    example: 100,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  cashback?: number;
}
