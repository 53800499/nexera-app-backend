import { Test, TestingModule } from '@nestjs/testing';
import { QuotationsService } from './quotations.service';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { QuotationEventBus } from './events/quotation-event-bus';
import { QuotationPdfService } from './services/quotation-pdf.service';
import { QuotationMailService } from './services/quotation-mail.service';
import { OrdersService } from '../orders/orders.service';
import { DocumentNumberingService } from '../settings/services/document-numbering.service';
import { EmailTemplateService } from '../settings/services/email-template.service';
import { DocumentAccessService } from '../documents/services/document-access.service';
import { EmailTrackingService } from '../documents/services/email-tracking.service';

describe('QuotationsService', () => {
  let service: QuotationsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QuotationsService,
        { provide: PrismaService, useValue: {} },
        { provide: QuotationEventBus, useValue: { publish: jest.fn() } },
        {
          provide: QuotationPdfService,
          useValue: {
            getPublicUrl: jest.fn(),
            generate: jest.fn(),
            save: jest.fn(),
            read: jest.fn(),
          },
        },
        {
          provide: QuotationMailService,
          useValue: { send: jest.fn(), isEnabled: jest.fn() },
        },
        {
          provide: OrdersService,
          useValue: { createFromQuotation: jest.fn() },
        },
        {
          provide: DocumentNumberingService,
          useValue: { generateNext: jest.fn() },
        },
        {
          provide: EmailTemplateService,
          useValue: { render: jest.fn() },
        },
        {
          provide: DocumentAccessService,
          useValue: { createToken: jest.fn() },
        },
        {
          provide: EmailTrackingService,
          useValue: { isEnabled: jest.fn(), createTracking: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<QuotationsService>(QuotationsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
