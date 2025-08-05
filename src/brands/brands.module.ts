import { forwardRef, Module } from '@nestjs/common';
import { BrandsService } from './brands.service';
import { BrandsController } from './brands.controller';
import { PrismaService } from 'src/prisma.service';
import { AuthModule } from 'src/auth/auth.module';
import { FilesModule } from 'src/files/files.module';
import { PromotionsModule } from 'src/promotions/promotions.module';

@Module({
  controllers: [BrandsController],
  providers: [BrandsService, PrismaService],
  imports: [AuthModule, FilesModule, forwardRef(() => PromotionsModule)],
  exports: [BrandsService],
})
export class BrandsModule {}
