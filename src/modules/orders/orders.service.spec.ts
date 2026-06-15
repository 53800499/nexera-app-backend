import { Test, TestingModule } from '@nestjs/testing';
import { OrdersService } from './orders.service';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { OrderEventBus } from './events/order-event-bus';
import { InvoicesService } from '../invoices/invoices.service';
import { DocumentNumberingService } from '../settings/services/document-numbering.service';

describe('OrdersService', () => {
  let service: OrdersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: PrismaService, useValue: {} },
        { provide: OrderEventBus, useValue: { publish: jest.fn() } },
        {
          provide: InvoicesService,
          useValue: { createFromOrder: jest.fn() },
        },
        {
          provide: DocumentNumberingService,
          useValue: { generateNext: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
