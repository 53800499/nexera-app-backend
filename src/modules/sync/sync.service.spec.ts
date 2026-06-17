import { Test, TestingModule } from '@nestjs/testing';
import { SyncService } from './sync.service';
import { SyncPullService } from './sync-pull.service';
import { SyncPushService } from './sync-push.service';
import { PrismaService } from '../../infrastructure/database/prisma.service';

describe('SyncService', () => {
  let service: SyncService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SyncService,
        {
          provide: SyncPullService,
          useValue: { bootstrap: jest.fn(), pull: jest.fn() },
        },
        {
          provide: SyncPushService,
          useValue: { push: jest.fn() },
        },
        {
          provide: PrismaService,
          useValue: { syncDevice: { upsert: jest.fn() } },
        },
      ],
    }).compile();

    service = module.get<SyncService>(SyncService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
