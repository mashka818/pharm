import { Module } from '@nestjs/common';
import { FnsController } from './fns.controller';
import { FnsService } from './fns.service';
import { FnsAuthService } from './fns-auth.service';
import { FnsCheckService } from './fns-check.service';
import { FnsQueueService } from './fns-queue.service';
import { FnsCashbackService } from './fns-cashback.service';
import { PrismaService } from '../prisma.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
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