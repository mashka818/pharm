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
    description: 'Массив идентификаторов продуктов (можно передавать как JSON массив "[1,2]" или строку с числами через запятую "1,2")',
    example: '1,2',
    required: true,
  })
  @Transform(({ value }) => {
    try {
      if (typeof value === 'string') {
        // Проверяем, является ли это JSON строкой
        if (value.startsWith('[') && value.endsWith(']')) {
          return JSON.parse(value);
        }
        // Если это строка с числами, разделенными запятыми
        if (value.includes(',')) {
          return value.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
        }
        // Если это одно число
        const singleId = parseInt(value);
        if (!isNaN(singleId)) {
          return [singleId];
        }
      }
      if (Array.isArray(value)) {
        return value;
      }
      return value;
    } catch (error) {
      console.error('Error parsing productIds:', error, 'Value:', value);
      return value;
    }
  })
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
  @Transform(({ value }) => {
    try {
      if (typeof value === 'string') {
        return JSON.parse(value);
      }
      if (typeof value === 'object' && value !== null) {
        return value;
      }
      return value;
    } catch (error) {
      return value;
    }
  })
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
