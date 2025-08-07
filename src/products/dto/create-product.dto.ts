import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateProductDto {
  @ApiProperty({
    description: 'Название продукта',
    example: 'Терафлю в пак. 6 шт.',
    required: true,
  })
  @IsString()
  name: string;
  @ApiProperty({
    description: 'SKU продукта',
    example: '21nSq1n',
    required: true,
  })
  @IsString()
  sku: string;

  @ApiProperty({
    description: 'Фиксированный кешбэк продукта',
    example: '30',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  fixCashback?: number;

  @ApiProperty({
    description: 'Тип кешбэка продукта',
    example: 'percent/amount',
    required: false,
  })
  @IsOptional()
  @IsIn(['percent', 'amount'])
  cashbackType?: TCashbackType;

  @ApiProperty({
    description: 'Идентификатор бренда продукта (нельзя изменить)',
    example: 1,
    required: true,
  })
  @IsNumber()
  brandId: number;
}

type TCashbackType = 'percent' | 'amount';
