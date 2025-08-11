import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { PromotionsModule } from './promotions/promotions.module';
import { CompaniesModule } from './companies/companies.module';
import { CustomersModule } from './customers/customers.module';
import { FilesModule } from './files/files.module';
import { ServeStaticModule } from '@nestjs/serve-static';
import { AuthModule } from './auth/auth.module';
import { AdminsModule } from './admins/admins.module';
import * as path from 'path';
import { CommandModule } from 'nestjs-command';
import { BrandsModule } from './brands/brands.module';
import { ProductsModule } from './products/products.module';
import { OffersModule } from './offers/offers.module';
import { OffersConditionsModule } from './offers-conditions/offers-conditions.module';
import { ProductOfferModule } from './product-offer/product-offer.module';
import { MailerModule } from './mailer/mailer.module';
import { ScheduleModule } from '@nestjs/schedule';
import { ReceiptsModule } from './receipts/receipts.module';
import { WithdrawalVariantsModule } from './withdrawal-variants/withdrawal-variants.module';
import { SearchModule } from './search/search.module';
import { FnsModule } from './fns/fns.module';
import { CashbackModule } from './cashback/cashback.module';
import { TenantMiddleware } from './auth/middleware/tenant.middleware';

@Module({
  imports: [
    PromotionsModule,
    CompaniesModule,
    CustomersModule,
    FilesModule,
    ServeStaticModule.forRoot({
      rootPath: path.resolve(__dirname, 'static'),
    }),
    AuthModule,
    AdminsModule,
    CommandModule,
    BrandsModule,
    ProductsModule,
    OffersModule,
    OffersConditionsModule,
    ProductOfferModule,
    MailerModule,
    ScheduleModule.forRoot(),
    ReceiptsModule,
    WithdrawalVariantsModule,
    SearchModule,
    FnsModule,
    CashbackModule,
  ],
  providers: [PrismaService, TenantMiddleware],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(TenantMiddleware)
      .forRoutes('receipt/scan-qr'); 
  }
}
