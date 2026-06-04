import { Test, TestingModule } from '@nestjs/testing';
import { QuotationsService } from './quotations.service';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { QuotationEventBus } from './events/quotation-event-bus';
import { QuotationPdfService } from './services/quotation-pdf.service';
import { QuotationMailService } from './services/quotation-mail.service';

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
      ],
    }).compile();

    service = module.get<QuotationsService>(QuotationsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
