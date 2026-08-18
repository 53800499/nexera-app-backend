import { Test, TestingModule } from '@nestjs/testing';
import { EmployesService } from './employes.service';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { RhAuditService } from '../audit/rh-audit.service';

describe('EmployesService', () => {
  let service: EmployesService;
  let prisma: any;
  let audit: any;

  const mockPrismaService = {
    rhEmploye: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
  };

  const mockAuditService = {
    log: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmployesService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: RhAuditService, useValue: mockAuditService },
      ],
    }).compile();

    service = module.get<EmployesService>(EmployesService);
    prisma = module.get(PrismaService);
    audit = module.get(RhAuditService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return a paginated list of employees for tenant', async () => {
      const mockList = [
        { id: 'emp-1', matricule: 'EMP-000001', nom: 'DOSSOU', prenoms: 'Kofi', tenantId: 'tenant-1' },
      ];
      mockPrismaService.rhEmploye.findMany.mockResolvedValue(mockList);
      mockPrismaService.rhEmploye.count.mockResolvedValue(1);

      const result = await service.findAll('tenant-1', 1, 50);
      expect(result.data).toEqual(mockList);
      expect(result.meta.total).toBe(1);
      expect(result.meta.page).toBe(1);
      expect(mockPrismaService.rhEmploye.findMany).toHaveBeenCalled();
    });
  });
});
