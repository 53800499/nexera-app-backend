import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { JwtModule } from '@nestjs/jwt';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './infrastructure/database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { RolesModule } from './modules/roles/roles.module';
import { PermissionsModule } from './modules/permissions/permissions.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { UsersModule } from './modules/users/users.module';
import { ClientsModule } from './modules/clients/clients.module';
import { CatalogueModule } from './modules/catalogue/catalogue.module';
import { TenantUserMiddleware } from './common/middleware/tenant-user.middleware';
import { QuotationsModule } from './modules/quotations/quotations.module';
import { OrdersModule } from './modules/orders/orders.module';
import { InvoicesModule } from './modules/invoices/invoices.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { RemindersModule } from './modules/reminders/reminders.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { SettingsModule } from './modules/settings/settings.module';
import { IntegrationEventsModule } from './shared/events/integration-events.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { StockModule } from './modules/stock/stock.module';

@Module({
  imports: [
    IntegrationEventsModule,
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    JwtModule.register({}),
    ScheduleModule.forRoot(),
    DatabaseModule,
    AuthModule,
    RolesModule,
    PermissionsModule,
    TenantsModule,
    UsersModule,
    ClientsModule,
    CatalogueModule,
    QuotationsModule,
    OrdersModule,
    InvoicesModule,
    PaymentsModule,
    RemindersModule,
    DashboardModule,
    SettingsModule,
    DocumentsModule,
    StockModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantUserMiddleware).forRoutes('*');
  }
}
