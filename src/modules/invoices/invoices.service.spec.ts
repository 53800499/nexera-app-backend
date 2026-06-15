import { Test, TestingModule } from '@nestjs/testing';
import { InvoicesService } from './invoices.service';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { InvoiceEventBus } from './events/invoice-event-bus';
import { DocumentNumberingService } from '../settings/services/document-numbering.service';
import { SettingsService } from '../settings/settings.service';
import { EmailTemplateService } from '../settings/services/email-template.service';
import { InvoicePdfService } from './services/invoice-pdf.service';
import { InvoiceMailService } from './services/invoice-mail.service';
import { DocumentAccessService } from '../documents/services/document-access.service';
import { EmailTrackingService } from '../documents/services/email-tracking.service';
import { AuditService } from '../audit/audit.service';

describe('InvoicesService', () => {
  let service: InvoicesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvoicesService,
        { provide: PrismaService, useValue: {} },
        { provide: InvoiceEventBus, useValue: { publish: jest.fn() } },
        {
          provide: DocumentNumberingService,
          useValue: { generateNext: jest.fn() },
        },
        {
          provide: SettingsService,
          useValue: { getTenantSettings: jest.fn() },
        },
        {
          provide: EmailTemplateService,
          useValue: { render: jest.fn() },
        },
        {
          provide: InvoicePdfService,
          useValue: {
            ensureGenerated: jest.fn(),
            read: jest.fn(),
            getPublicUrl: jest.fn(),
          },
        },
        { provide: InvoiceMailService, useValue: { send: jest.fn() } },
        {
          provide: DocumentAccessService,
          useValue: { createToken: jest.fn() },
        },
        {
          provide: EmailTrackingService,
          useValue: { create: jest.fn() },
        },
        {
          provide: AuditService,
          useValue: { record: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<InvoicesService>(InvoicesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
