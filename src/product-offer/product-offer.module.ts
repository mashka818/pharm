import { Module } from '@nestjs/common';
import { ProductOfferService } from './product-offer.service';
import { PrismaService } from 'src/prisma.service';

@Module({
  providers: [ProductOfferService, PrismaService],
  exports: [ProductOfferService],
})
export class ProductOfferModule {}
