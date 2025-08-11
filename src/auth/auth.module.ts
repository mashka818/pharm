import { forwardRef, Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { AdminsModule } from 'src/admins/admins.module';
import { JwtModule } from '@nestjs/jwt';
import { PrismaService } from 'src/prisma.service';
import { AuthGuard } from './guards/auth.guard';
import { AdminGuard } from './guards/admin.guard';
import { CompaniesModule } from 'src/companies/companies.module';
import { MailerModule } from 'src/mailer/mailer.module';
import { PromotionsModule } from 'src/promotions/promotions.module';
import { CustomersModule } from 'src/customers/customers.module';
import { AuthCustomerService } from './auth-customer.service';

@Module({
  controllers: [AuthController],
  providers: [AuthService, PrismaService, AuthGuard, AdminGuard, AuthCustomerService],
  imports: [
    AdminsModule,
    CompaniesModule,
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '1d' },
    }),
    MailerModule,
    forwardRef(() => PromotionsModule),
    CustomersModule,
  ],
  exports: [AuthGuard, AuthService],
})
export class AuthModule {}
