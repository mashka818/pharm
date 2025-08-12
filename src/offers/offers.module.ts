import { forwardRef, Module } from '@nestjs/common';
import { OffersService } from './offers.service';
import { OffersController } from './offers.controller';
import { PrismaService } from 'src/prisma.service';
import { OffersConditionsModule } from 'src/offers-conditions/offers-conditions.module';
import { ProductOfferModule } from 'src/product-offer/product-offer.module';
import { FilesModule } from 'src/files/files.module';
import { PromotionsModule } from 'src/promotions/promotions.module';
import { CreateOfferService } from './create-offer.service';
import { GetOneOfferService } from './get-one-offer.service';
import { UpdateOfferService } from './update-offer.service';

@Module({
  controllers: [OffersController],
  providers: [
    OffersService,
    PrismaService,
    CreateOfferService,
    GetOneOfferService,
    UpdateOfferService,
  ],
  exports: [OffersService],
  imports: [
    OffersConditionsModule,
    ProductOfferModule,
    FilesModule,
    forwardRef(() => PromotionsModule),
  ],
})
export class OffersModule {}
