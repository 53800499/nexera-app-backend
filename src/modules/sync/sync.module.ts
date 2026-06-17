import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { ClientsModule } from '../clients/clients.module';
import { QuotationsModule } from '../quotations/quotations.module';
import { OrdersModule } from '../orders/orders.module';
import { InvoicesModule } from '../invoices/invoices.module';
import { PaymentsModule } from '../payments/payments.module';
import { CatalogueModule } from '../catalogue/catalogue.module';
import { SyncController } from './sync.controller';
import { SyncPullService } from './sync-pull.service';
import { SyncPushService } from './sync-push.service';
import { SyncService } from './sync.service';

@Module({
  imports: [
    DatabaseModule,
    ClientsModule,
    QuotationsModule,
    OrdersModule,
    InvoicesModule,
    PaymentsModule,
    CatalogueModule,
  ],
  controllers: [SyncController],
  providers: [SyncService, SyncPullService, SyncPushService],
  exports: [SyncService],
})
export class SyncModule {}
