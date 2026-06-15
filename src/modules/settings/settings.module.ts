import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';
import { DocumentNumberingService } from './services/document-numbering.service';
import { EmailTemplateService } from './services/email-template.service';
import { SettingsBootstrapService } from './services/settings-bootstrap.service';

@Module({
  imports: [DatabaseModule],
  controllers: [SettingsController],
  providers: [
    SettingsService,
    DocumentNumberingService,
    EmailTemplateService,
    SettingsBootstrapService,
  ],
  exports: [
    SettingsService,
    DocumentNumberingService,
    EmailTemplateService,
    SettingsBootstrapService,
  ],
})
export class SettingsModule {}
