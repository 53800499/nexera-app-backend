import { Test, TestingModule } from '@nestjs/testing';
import { SettingsService } from './settings.service';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { DocumentNumberingService } from './services/document-numbering.service';
import { EmailTemplateService } from './services/email-template.service';

describe('SettingsService', () => {
  let service: SettingsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SettingsService,
        { provide: PrismaService, useValue: {} },
        { provide: DocumentNumberingService, useValue: {} },
        { provide: EmailTemplateService, useValue: {} },
      ],
    }).compile();

    service = module.get<SettingsService>(SettingsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
