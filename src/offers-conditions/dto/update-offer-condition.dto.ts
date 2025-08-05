import { UpdateOfferDto } from 'src/offers/dto/update-offer.dto';
import { CreateOfferConditionDto } from './create-offer-condition.dto';
import { ApiProperty } from '@nestjs/swagger';
import { IsNumber } from 'class-validator';

export class UpdateOfferConditionDto extends CreateOfferConditionDto {
  @ApiProperty({
    description: 'Id of offer condition',
    example: 1,
    required: true,
  })
  @IsNumber()
  id: number;
  offer?: UpdateOfferDto;
}
