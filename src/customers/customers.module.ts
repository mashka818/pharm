import { forwardRef, Module } from '@nestjs/common';
import { CustomersService } from './customers.service';
import { CustomersController } from './customers.controller';
import { PrismaService } from 'src/prisma.service';
import { UnconfirmedCustomersService } from './unconfirmed-customers.service';
import { AuthModule } from 'src/auth/auth.module';
import { WithdrawalVariantsModule } from 'src/withdrawal-variants/withdrawal-variants.module';
import { CustomersUpdateService } from './customers-update.service';
import { MailerModule } from 'src/mailer/mailer.module';

@Module({
  controllers: [CustomersController],
  providers: [CustomersService, PrismaService, UnconfirmedCustomersService, CustomersUpdateService],
  imports: [forwardRef(() => AuthModule), WithdrawalVariantsModule, MailerModule],
  exports: [CustomersService, UnconfirmedCustomersService],
})
export class CustomersModule {}
