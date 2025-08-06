import { UpdateProductDto } from 'src/products/dto/update-product.dto';
import { ApiProperty, OmitType } from '@nestjs/swagger';
import { UpdateOfferDto } from './update-offer.dto';
import { ProductDtoWithBrand } from 'src/products/dto/product-with-brands.dto';

export class ResponseOfferDto extends OmitType(UpdateOfferDto, ['productIds']) {
  products?: UpdateProductDto[];
}

export class ResponseOfferDtoWithProducts extends ResponseOfferDto {
  @ApiProperty({
    description: 'Products with brands of offer',
    type: [ProductDtoWithBrand],
  })
  products: ProductDtoWithBrand[];
}
