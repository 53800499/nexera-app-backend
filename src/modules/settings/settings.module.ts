import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';
import { DocumentNumberingService } from './services/document-numbering.service';
import { EmailTemplateService } from './services/email-template.service';
import { SettingsBootstrapService } from './services/settings-bootstrap.service';
import { MailDeliveryService } from '../../shared/services/mail-delivery.service';

@Module({
  imports: [DatabaseModule],
  controllers: [SettingsController],
  providers: [
    SettingsService,
    DocumentNumberingService,
    EmailTemplateService,
    SettingsBootstrapService,
    MailDeliveryService,
  ],
  exports: [
    SettingsService,
    DocumentNumberingService,
    EmailTemplateService,
    SettingsBootstrapService,
    MailDeliveryService,
  ],
})
export class SettingsModule {}

