import { Test, TestingModule } from '@nestjs/testing';
import { ContratsService } from './contrats.service';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { RhAuditService } from '../audit/rh-audit.service';

describe('ContratsService', () => {
  let service: ContratsService;
  let prisma: any;
  let audit: any;

  const mockPrismaService = {
    rhContrat: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    rhEmploye: {
      update: jest.fn(),
    },
  };

  const mockAuditService = {
    log: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContratsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: RhAuditService, useValue: mockAuditService },
      ],
    }).compile();

    service = module.get<ContratsService>(ContratsService);
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
    it('should return all contracts for a tenant', async () => {
      const mockContracts = [
        { id: 'ctr-1', typeContrat: 'CDI', salaireBase: 350000, tenantId: 'tenant-1' },
      ];
      mockPrismaService.rhContrat.findMany.mockResolvedValue(mockContracts);

      const result = await service.findAll('tenant-1');
      expect(result).toEqual(mockContracts);
    });
  });

  describe('calculateEstimatedSeverance', () => {
    it('should calculate legal severance based on CCGT Bénin rules', () => {
      // Pour un salaire moyen de 200 000 FCFA et 5 ans d'ancienneté
      // Tranche 1 à 5 ans : 30% du salaire mensuel moyen par an
      // 5 ans * (200 000 * 30%) = 5 * 60 000 = 300 000 FCFA
      const res = service.calculateEstimatedSeverance(5, 200000);

      expect(res.indemniteLicenciementEstimee).toBe(300000);
      expect(res.tranches).toHaveLength(1);
      expect(res.tranches?.[0].taux).toBe('30 %');
    });

    it('should calculate multiple tranches for 8 years of seniority', () => {
      // 5 ans * (200 000 * 30%) = 300 000
      // 3 ans * (200 000 * 35%) = 210 000
      // Total = 510 000 FCFA
      const res = service.calculateEstimatedSeverance(8, 200000);

      expect(res.indemniteLicenciementEstimee).toBe(510000);
      expect(res.tranches).toHaveLength(2);
    });
  });
});
