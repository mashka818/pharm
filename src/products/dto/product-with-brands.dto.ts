import { UpdateProductDto } from './update-product.dto';
import { ApiProperty } from '@nestjs/swagger';
import { UpdateBrandDto } from 'src/brands/dto/update-brand.dto';

export class ProductDtoWithBrand extends UpdateProductDto {
  @ApiProperty({
    description: 'Brand of product',
    type: UpdateBrandDto,
  })
  brand: UpdateBrandDto;
}
