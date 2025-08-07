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
    description: 'Выгода по предложению',
    example: '10',
    required: true,
  })
  @IsNumber()
  @Transform(({ value }) => parseFloat(value))
  profit: number;

  @ApiProperty({
    description: 'Тип выгоды (static/from)',
    example: 'static/from',
    required: true,
  })
  @IsIn(['static', 'from'], { message: 'profitType must be either "static" or "from"' })
  profitType: TProfit;

  @ApiProperty({
    description: 'Цвет баннера предложения',
    example: 'green',
    required: true,
  })
  @IsString()
  banner_color: string;

  @ApiProperty({
    description: 'Дата начала действия предложения',
    example: '2024-09-03T08:18:18Z',
    required: true,
  })
  @IsDateString()
  date_from: string;

  @ApiProperty({
    description: 'Дата окончания действия предложения',
    example: '2024-09-03T08:18:18Z',
    required: true,
  })
  @IsDateString()
  date_to: string;

  @ApiProperty({
    description: 'Массив идентификаторов продуктов',
    example: '[1, 2]',
    required: true,
  })
  @Transform(({ value }) => JSON.parse(value))
  @IsArray()
  productIds: number[];

  @ApiProperty({
    description: 'Баннер предложения (файл или строка)',
    example: 'file or string',
    required: true,
  })
  banner_image?: string;

  @ApiPropertyOptional({
    description: 'Условие для предложения',
    type: CreateOfferConditionDto,
  })
  @ValidateNested()
  @Transform(({ value }) => JSON.parse(value))
  @IsOptional()
  @Type(() => CreateOfferConditionDto)
  condition?: CreateOfferConditionDto;

  @ApiProperty({
    description: 'Идентификатор промоакции',
    example: 'r-pharm',
    required: true,
  })
  @IsString()
  promotionId: string;
}

type TProfit = 'static' | 'from';
