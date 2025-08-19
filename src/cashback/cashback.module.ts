import { Module } from '@nestjs/common';
import { CashbackService } from './cashback.service';
import { CashbackController } from './cashback.controller';
import { PrismaService } from '../prisma.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  providers: [CashbackService, PrismaService],
  controllers: [CashbackController],
  exports: [CashbackService],
})
export class CashbackModule {}