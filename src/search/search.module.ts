import { Module } from '@nestjs/common';
import { SearchService } from './search.service';
import { ProductsModule } from 'src/products/products.module';
import { BrandsModule } from 'src/brands/brands.module';
import { PrismaService } from 'src/prisma.service';

@Module({
  providers: [SearchService, PrismaService],
  imports: [ProductsModule, BrandsModule],
  exports: [SearchService],
})
export class SearchModule {}
