import { UpdateProductDto } from 'src/products/dto/update-product.dto';
import { UpdateBrandDto } from './update-brand.dto';
import { ApiProperty } from '@nestjs/swagger';
import { ResponseOfferDto } from 'src/offers/dto/response-offer.dto';

export class FullBrandDto extends UpdateBrandDto {
  @ApiProperty({
    description: 'Список продуктов бренда',
    type: [UpdateProductDto],
  })
  products?: UpdateProductDto[];

  @ApiProperty({
    description: 'Список предложений бренда',
    type: [ResponseOfferDto],
  })
  offers?: ResponseOfferDto[];
}
