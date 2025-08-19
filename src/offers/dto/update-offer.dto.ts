import { CreateOfferDto } from './create-offer.dto';
import { ApiProperty, ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { IsNumber, IsOptional, ValidateNested } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { UpdateOfferConditionDto } from 'src/offers-conditions/dto/update-offer-condition.dto';

export class UpdateOfferDto extends PartialType(OmitType(CreateOfferDto, ['condition'])) {
  @ApiProperty({
    description: 'Идентификатор предложения',
    example: 1,
    required: true,
  })
  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  @IsOptional()
  id?: number;

  @ApiProperty({
    description: 'Баннер предложения (файл или строка)',
    example: 'file or string',
  })
  @IsOptional()
  banner_image?: string;

  @ApiProperty({
    description: 'Идентификатор условия',
    example: 'id как число/пустое поле для удаления условия',
  })
  @Transform(({ value }) => {
    if (value) {
      return parseInt(value);
    }
    return 0;
  })
  @IsNumber()
  @IsOptional()
  conditionId?: number;

  @ApiPropertyOptional({
    description: 'Условие для предложения',
    type: UpdateOfferConditionDto,
  })
  @IsOptional()
  @ValidateNested()
  @Transform(({ value }) => {
    try {
      if (typeof value === 'string') {
        // Проверяем, является ли это JSON строкой
        if (value.startsWith('{') && value.endsWith('}')) {
          return JSON.parse(value);
        }
        // Если это не JSON, возвращаем как есть
        return value;
      }
      if (typeof value === 'object' && value !== null) {
        return value;
      }
      return value;
    } catch (error) {
      return value;
    }
  })
  @Type(() => UpdateOfferConditionDto)
  condition?: UpdateOfferConditionDto;
}
