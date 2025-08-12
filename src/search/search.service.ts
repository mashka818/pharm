import { Injectable } from '@nestjs/common';
import { BrandsService } from 'src/brands/brands.service';
import { ProductsService } from 'src/products/products.service';
import { SearchProductsAndBrandsDto } from './dto/search-products-and-brands-dto';

@Injectable()
export class SearchService {
  constructor(
    private readonly productsService: ProductsService,
    private readonly brandsService: BrandsService,
  ) {}

  async searchProductsAndBrandsByString(
    searchString: string,
    promotionId: string,
  ): Promise<SearchProductsAndBrandsDto> {
    const products = await this.productsService.searchProductsByStringAndPromotionId(
      searchString,
      promotionId,
    );
    const brands = await this.brandsService.searchBrandsByStringAndPromotionId(
      searchString,
      promotionId,
    );
    return { products, brands };
  }
}
