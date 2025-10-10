import { Module } from '@nestjs/common';
import { CashbackService } from './cashback.service';
import { CashbackTicketsService } from './cashback-tickets.service';
import { CashbackController } from './cashback.controller';
import { PrismaService } from '../prisma.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  providers: [CashbackService, CashbackTicketsService, PrismaService],
  controllers: [CashbackController],
  exports: [CashbackService, CashbackTicketsService],
})
export class CashbackModule {}