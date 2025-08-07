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
  @Transform(({ value }) => JSON.parse(value))
  @Type(() => UpdateOfferConditionDto)
  condition?: UpdateOfferConditionDto;
}
