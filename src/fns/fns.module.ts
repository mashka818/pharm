import { Module } from '@nestjs/common';
import { FnsController } from './fns.controller';
import { FnsService } from './fns.service';
import { FnsAuthService } from './fns-auth.service';
import { FnsCheckService } from './fns-check.service';
import { FnsQueueService } from './fns-queue.service';
import { FnsCashbackService } from './fns-cashback.service';
import { CashbackModule } from '../cashback/cashback.module';
import { PrismaService } from '../prisma.service';
import { AuthModule } from '../auth/auth.module';
import { ReceiptsModule } from '../receipts/receipts.module';

@Module({
  imports: [AuthModule, CashbackModule, ReceiptsModule],
  controllers: [FnsController],
  providers: [
    FnsService,
    FnsAuthService,
    FnsCheckService,
    FnsQueueService,
    FnsCashbackService,
    PrismaService,
  ],
  exports: [FnsService],
})
export class FnsModule {} 