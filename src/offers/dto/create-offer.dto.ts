import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { CreateOfferConditionDto } from 'src/offers-conditions/dto/create-offer-condition.dto';

export class CreateOfferDto {
  @ApiProperty({
    description: 'Profit of offer',
    example: '10',
    required: true,
  })
  @IsNumber()
  @Transform(({ value }) => parseFloat(value))
  profit: number;

  @ApiProperty({
    description: 'Profit type of offer',
    example: 'static/from',
    required: true,
  })
  @IsIn(['static', 'from'], { message: 'profitType must be either "static" or "from"' })
  profitType: TProfit;

  @ApiProperty({
    description: 'Color of offer banner',
    example: 'green',
    required: true,
  })
  @IsString()
  banner_color: string;

  @ApiProperty({
    description: 'Start date of offer',
    example: '2024-09-03T08:18:18Z',
    required: true,
  })
  @IsDateString()
  date_from: string;

  @ApiProperty({
    description: 'End date of offer',
    example: '2024-09-03T08:18:18Z',
    required: true,
  })
  @IsDateString()
  date_to: string;

  @ApiProperty({
    description: 'Array of product Ids of offer',
    example: '[1, 2]',
    required: true,
  })
  @Transform(({ value }) => JSON.parse(value))
  @IsArray()
  productIds: number[];

  @ApiProperty({
    description: 'Banner image of offer. File to set/update, default - string name',
    example: 'file or string',
    required: true,
  })
  banner_image?: string;

  @ApiPropertyOptional({
    description: 'Condition for the offer',
    type: CreateOfferConditionDto,
  })
  @ValidateNested()
  @Transform(({ value }) => JSON.parse(value))
  @IsOptional()
  @Type(() => CreateOfferConditionDto)
  condition?: CreateOfferConditionDto;

  @ApiProperty({
    description: 'Promotion id of offer',
    example: 'r-pharm',
    required: true,
  })
  @IsString()
  promotionId: string;
}

type TProfit = 'static' | 'from';
