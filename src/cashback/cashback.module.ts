import { Module } from '@nestjs/common';
import { CashbackService } from './cashback.service';
import { CashbackTicketsService } from './cashback-tickets.service';
import { CashbackController } from './cashback.controller';
import { PrismaService } from '../prisma.service';

@Module({
  providers: [CashbackService, CashbackTicketsService, PrismaService],
  controllers: [CashbackController],
  exports: [CashbackService, CashbackTicketsService],
})
export class CashbackModule {}