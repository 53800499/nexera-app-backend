import { Test, TestingModule } from '@nestjs/testing';
import { RemindersService } from './reminders.service';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { ReminderNotificationService } from './services/reminder-notification.service';
import { ReminderEventBus } from './events/reminder-event-bus';

describe('RemindersService', () => {
  let service: RemindersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RemindersService,
        { provide: PrismaService, useValue: {} },
        {
          provide: ReminderNotificationService,
          useValue: { sendEmail: jest.fn(), buildAutoEmail: jest.fn() },
        },
        { provide: ReminderEventBus, useValue: { publish: jest.fn() } },
      ],
    }).compile();

    service = module.get<RemindersService>(RemindersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
