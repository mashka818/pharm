import { Module } from '@nestjs/common';
import { WithdrawalVariantsService } from './withdrawal-variants.service';
import { WithdrawalVariantsController } from './withdrawal-variants.controller';
import { PrismaService } from 'src/prisma.service';

@Module({
  controllers: [WithdrawalVariantsController],
  providers: [WithdrawalVariantsService, PrismaService],
  exports: [WithdrawalVariantsService],
})
export class WithdrawalVariantsModule {}
