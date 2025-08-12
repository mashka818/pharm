import { ApiProperty } from '@nestjs/swagger';
import { UpdateBrandDto } from 'src/brands/dto/update-brand.dto';
import { ProductDtoWithBrand } from 'src/products/dto/product-with-brands.dto';

export class SearchProductsAndBrandsDto {
  @ApiProperty({
    description: 'Products list of search',
    type: [ProductDtoWithBrand],
  })
  products: ProductDtoWithBrand[];
  @ApiProperty({
    description: 'Brands list of search',
    type: [UpdateBrandDto],
  })
  brands: UpdateBrandDto[];
}
