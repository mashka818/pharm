import { Module } from '@nestjs/common';
import { OffersConditionsService } from './offers-conditions.service';
import { PrismaService } from 'src/prisma.service';

@Module({
  providers: [OffersConditionsService, PrismaService],
  exports: [OffersConditionsService],
})
export class OffersConditionsModule {}
