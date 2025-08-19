import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString } from 'class-validator';

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

  @ApiProperty({
    description: 'Сумма кэшбека за этот продукт в копейках',
    example: 100,
    required: true,
  })
  @IsNumber()
  cashback: number;
}
