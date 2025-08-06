import { Module } from '@nestjs/common';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { BrandsModule } from 'src/brands/brands.module';
import { PrismaService } from 'src/prisma.service';

@Module({
  controllers: [ProductsController],
  providers: [ProductsService, PrismaService],
  imports: [BrandsModule],
  exports: [ProductsService],
})
export class ProductsModule {}
