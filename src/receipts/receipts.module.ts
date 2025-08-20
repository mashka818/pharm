import { Module } from '@nestjs/common';
import { ReceiptsService } from './receipts.service';
import { ReceiptsController } from './receipts.controller';
import { PrismaService } from '../prisma.service';
import { AuthModule } from '../auth/auth.module';
import { CashbackModule } from '../cashback/cashback.module';

@Module({
  imports: [AuthModule, CashbackModule],
  controllers: [ReceiptsController],
  providers: [ReceiptsService, PrismaService],
  exports: [ReceiptsService],
})
export class ReceiptsModule {}
