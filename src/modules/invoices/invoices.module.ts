import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { PaymentsModule } from '../payments/payments.module';
import { SettingsModule } from '../settings/settings.module';
import { DocumentsModule } from '../documents/documents.module';
import { InvoicesController } from './invoices.controller';
import { RecurringInvoicesController } from './recurring-invoices.controller';
import { InvoicesService } from './invoices.service';
import { RecurringInvoicesService } from './recurring-invoices.service';
import { RecurringInvoicesScheduler } from './recurring-invoices.scheduler';
import { RecurringInvoiceNotificationService } from './services/recurring-invoice-notification.service';
import { InvoicePdfService } from './services/invoice-pdf.service';
import { InvoiceMailService } from './services/invoice-mail.service';
import { InvoiceEventBus } from './events/invoice-event-bus';
import { InvoiceDomainEventHandler } from './handlers/invoice-domain-event.handler';

@Module({
  imports: [DatabaseModule, PaymentsModule, SettingsModule, DocumentsModule],
  controllers: [InvoicesController, RecurringInvoicesController],
  providers: [
    InvoicesService,
    RecurringInvoicesService,
    RecurringInvoicesScheduler,
    RecurringInvoiceNotificationService,
    InvoicePdfService,
    InvoiceMailService,
    InvoiceDomainEventHandler,
    {
      provide: InvoiceEventBus,
      useFactory: (handler: InvoiceDomainEventHandler) => {
        const bus = new InvoiceEventBus();
        bus.register(handler);
        return bus;
      },
      inject: [InvoiceDomainEventHandler],
    },
  ],
  exports: [InvoicesService, InvoicePdfService],
})
export class InvoicesModule {}
