import { forwardRef, Module } from '@nestjs/common';
import { CompaniesService } from './companies.service';
import { CompaniesController } from './companies.controller';
import { PromotionsModule } from 'src/promotions/promotions.module';
import { PrismaService } from 'src/prisma.service';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  controllers: [CompaniesController],
  providers: [CompaniesService, PrismaService],
  imports: [forwardRef(() => PromotionsModule), forwardRef(() => AuthModule)],
  exports: [CompaniesService],
})
export class CompaniesModule {}
