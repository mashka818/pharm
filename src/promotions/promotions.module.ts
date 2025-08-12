import { forwardRef, Module } from '@nestjs/common';
import { PromotionsService } from './promotions.service';
import { PromotionsController } from './promotions.controller';
import { PrismaService } from 'src/prisma.service';
import { FilesModule } from 'src/files/files.module';
import { AuthModule } from 'src/auth/auth.module';
import { ProductsModule } from 'src/products/products.module';
import { OffersModule } from 'src/offers/offers.module';
import { BrandsModule } from 'src/brands/brands.module';
import { UpdatePromotionService } from './update-promotion.service';
import { SearchModule } from 'src/search/search.module';

@Module({
  controllers: [PromotionsController],
  providers: [PromotionsService, PrismaService, UpdatePromotionService],
  exports: [PromotionsService],
  imports: [
    FilesModule,
    AuthModule,
    ProductsModule,
    forwardRef(() => OffersModule),
    BrandsModule,
    SearchModule,
  ],
})
export class PromotionsModule {}
