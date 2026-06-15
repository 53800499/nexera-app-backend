import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsService } from './payments.service';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { PaymentEventBus } from './events/payment-event-bus';
import { RemindersService } from '../reminders/reminders.service';
import { AuditService } from '../audit/audit.service';

describe('PaymentsService', () => {
  let service: PaymentsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: {} },
        { provide: PaymentEventBus, useValue: { publish: jest.fn() } },
        {
          provide: RemindersService,
          useValue: { syncClientBlockStatus: jest.fn() },
        },
        {
          provide: AuditService,
          useValue: { record: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
