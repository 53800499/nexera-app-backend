import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { OrdersModule } from '../orders/orders.module';
import { SettingsModule } from '../settings/settings.module';
import { DocumentsModule } from '../documents/documents.module';
import { QuotationsController } from './quotations.controller';
import { QuotationsService } from './quotations.service';
import { QuotationEventBus } from './events/quotation-event-bus';
import { QuotationDomainEventHandler } from './handlers/quotation-domain-event.handler';
import { QuotationPdfService } from './services/quotation-pdf.service';
import { QuotationMailService } from './services/quotation-mail.service';

@Module({
  imports: [DatabaseModule, OrdersModule, SettingsModule, DocumentsModule],
  controllers: [QuotationsController],
  providers: [
    QuotationsService,
    QuotationPdfService,
    QuotationMailService,
    QuotationDomainEventHandler,
    {
      provide: QuotationEventBus,
      useFactory: (handler: QuotationDomainEventHandler) => {
        const bus = new QuotationEventBus();
        bus.register(handler);
        return bus;
      },
      inject: [QuotationDomainEventHandler],
    },
  ],
  exports: [QuotationsService, QuotationPdfService],
})
export class QuotationsModule {}
