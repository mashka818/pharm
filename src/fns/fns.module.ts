import { Module } from '@nestjs/common';
import { FnsController } from './fns.controller';
import { AdminNotificationController } from './admin-notification.controller';
import { AdminFnsController } from './admin-fns.controller';
import { FnsService } from './fns.service';
import { FnsAuthService } from './fns-auth.service';
import { FnsCheckService } from './fns-check.service';
import { FnsQueueService } from './fns-queue.service';
import { FnsCashbackService } from './fns-cashback.service';
import { AdminNotificationService } from './admin-notification.service';
import { CashbackModule } from '../cashback/cashback.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PrismaService } from '../prisma.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule, CashbackModule, NotificationsModule],
  controllers: [FnsController, AdminNotificationController, AdminFnsController],
  providers: [
    FnsService,
    FnsAuthService,
    FnsCheckService,
    FnsQueueService,
    FnsCashbackService,
    AdminNotificationService,
    PrismaService,
  ],
  exports: [FnsService, AdminNotificationService],
})
export class FnsModule {} 