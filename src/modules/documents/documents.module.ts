import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { DocumentAccessService } from './services/document-access.service';
import { EmailTrackingService } from './services/email-tracking.service';
import { PublicDocumentsController } from './public-documents.controller';
import { MailDeliveryService } from '../../shared/services/mail-delivery.service';

@Module({
  imports: [DatabaseModule],
  controllers: [PublicDocumentsController],
  providers: [DocumentAccessService, EmailTrackingService, MailDeliveryService],
  exports: [DocumentAccessService, EmailTrackingService, MailDeliveryService],
})
export class DocumentsModule {}
