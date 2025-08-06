import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNumber } from 'class-validator';

export class CreateOfferConditionDto {
  @ApiProperty({
    description: 'Variant of offer condition',
    example: 'price/amount',
    required: true,
  })
  @IsIn(['price', 'amount'], { message: 'variant must be either "price" or "amount"' })
  variant: TOfferConditionVariant;

  @ApiProperty({
    description: 'Variant of offer condition',
    example: 'from/to/from_to',
    required: true,
  })
  @IsIn(['from', 'to', 'from_to'], { message: 'type must be either "from, "to" or "from_to"' })
  type: TOfferType;

  @ApiProperty({
    description: 'Start value of offer condition',
    example: 1000,
    required: false,
  })
  @IsNumber()
  from_value?: number;

  @ApiProperty({
    description: 'End value of offer condition',
    example: 2000,
    required: false,
  })
  @IsNumber()
  to_value?: number;
}

type TOfferConditionVariant = 'price' | 'amount';
type TOfferType = 'from' | 'to' | 'from_to';
