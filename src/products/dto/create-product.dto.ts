import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateProductDto {
  @ApiProperty({
    description: 'Name of product',
    example: 'Терафлю в пак. 6 шт.',
    required: true,
  })
  @IsString()
  name: string;
  @ApiProperty({
    description: 'Sku of product',
    example: '21nSq1n',
    required: true,
  })
  @IsString()
  sku: string;

  @ApiProperty({
    description: 'Fix cashback of product',
    example: '30',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  fixCashback?: number;

  @ApiProperty({
    description: 'Cashback type of product',
    example: 'percent/amount',
    required: false,
  })
  @IsOptional()
  @IsIn(['percent', 'amount'])
  cashbackType?: TCashbackType;

  @ApiProperty({
    description: 'Brand id of product(Not available to change)',
    example: 1,
    required: true,
  })
  @IsNumber()
  brandId: number;
}

type TCashbackType = 'percent' | 'amount';
