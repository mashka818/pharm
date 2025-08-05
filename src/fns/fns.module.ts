import { Module } from '@nestjs/common';
import { FnsController } from './fns.controller';
import { FnsQrController } from './fns-qr.controller';
import { FnsService } from './fns.service';
import { FnsAuthService } from './fns-auth.service';
import { FnsCheckService } from './fns-check.service';
import { FnsQueueService } from './fns-queue.service';
import { FnsCashbackService } from './fns-cashback.service';
import { FnsQrParserService } from './fns-qr-parser.service';
import { FnsNetworkService } from './fns-network.service';
import { PrismaService } from '../prisma.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [FnsController, FnsQrController],
  providers: [
    FnsService,
    FnsAuthService,
    FnsCheckService,
    FnsQueueService,
    FnsCashbackService,
    FnsQrParserService,
    FnsNetworkService,
    PrismaService,
  ],
  exports: [FnsService],
})
export class FnsModule {} 