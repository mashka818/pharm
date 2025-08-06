import { CreateOfferDto } from './create-offer.dto';
import { ApiProperty, ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { IsNumber, IsOptional, ValidateNested } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { UpdateOfferConditionDto } from 'src/offers-conditions/dto/update-offer-condition.dto';

export class UpdateOfferDto extends PartialType(OmitType(CreateOfferDto, ['condition'])) {
  @ApiProperty({
    description: 'Id of offer',
    example: 1,
    required: true,
  })
  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  @IsOptional()
  id?: number;

  @ApiProperty({
    description: 'Banner image of offer. File to set/update, default - string name',
    example: 'file or string',
  })
  @IsOptional()
  banner_image?: string;

  @ApiProperty({
    description: 'Id of condition',
    example: 'id as number/send empty field to delete condition',
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
    description: 'Condition for the offer',
    type: UpdateOfferConditionDto,
  })
  @IsOptional()
  @ValidateNested()
  @Transform(({ value }) => JSON.parse(value))
  @Type(() => UpdateOfferConditionDto)
  condition?: UpdateOfferConditionDto;
}
