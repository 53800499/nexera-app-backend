import { Test, TestingModule } from '@nestjs/testing';
import { RecurringInvoicesService } from './recurring-invoices.service';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { InvoicesService } from './invoices.service';
import { RecurringInvoiceNotificationService } from './services/recurring-invoice-notification.service';

describe('RecurringInvoicesService', () => {
  let service: RecurringInvoicesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecurringInvoicesService,
        { provide: PrismaService, useValue: {} },
        {
          provide: InvoicesService,
          useValue: { cloneAsDraftFromTemplate: jest.fn() },
        },
        {
          provide: RecurringInvoiceNotificationService,
          useValue: { notifyDraftReady: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<RecurringInvoicesService>(RecurringInvoicesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
