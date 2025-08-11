import { forwardRef, Module } from '@nestjs/common';
import { AdminsService } from './admins.service';
import { AdminsController } from './admins.controller';
import { PrismaService } from 'src/prisma.service';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  controllers: [AdminsController],
  providers: [AdminsService, PrismaService],
  exports: [AdminsService],
  imports: [forwardRef(() => AuthModule)],
})
export class AdminsModule {}
