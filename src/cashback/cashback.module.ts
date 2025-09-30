import { Module } from '@nestjs/common';
import { CashbackService } from './cashback.service';
import { CashbackController } from './cashback.controller';
import { PrismaService } from '../prisma.service';

@Module({
  providers: [CashbackService, PrismaService],
  controllers: [CashbackController],
  exports: [CashbackService],
})
export class CashbackModule {}