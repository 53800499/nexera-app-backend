import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { ValidationDecisionDto, ValidationLotDto } from '../dto/compta.dto';
import { ValidationService } from './validation.service';
import { PrismaService } from '../../../infrastructure/database/prisma.service';

@ApiTags('compta-validation')
@ApiBearerAuth('access-token')
@Controller('compta/validation')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ValidationController {
  constructor(
    private readonly validationService: ValidationService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('attente')
  @Permissions('compta.ecritures.validate')
  async getEnAttente(
    @Request() req: any,
    @Query('journalId') journalId?: string,
    @Query('exerciceId') exerciceId?: string,
  ) {
    const tenantId = req.user?.tenantId || req.tenantId;
    const where: any = {
      tenantId,
      statut: { in: ['EN_ATTENTE_VALIDATION', 'BROUILLON'] },
    };
    if (journalId) where.journalId = journalId;
    if (exerciceId) where.exerciceId = exerciceId;

    return (this.prisma as any).comptaEcriture.findMany({
      where,
      include: {
        journal: true,
        exercice: true,
        lignes: {
          include: {
            compte: true,
            compteAuxiliaire: true,
          },
        },
      },
      orderBy: { dateEcriture: 'asc' },
    });
  }

  @Post(':id/decider')
  @Permissions('compta.ecritures.validate')
  async deciderEcriture(
    @Request() req: any,
    @Param('id') ecritureId: string,
    @Body() dto: ValidationDecisionDto,
  ) {
    const tenantId = req.user?.tenantId || req.tenantId;
    const userId = req.user?.id || req.user?.userId || req.user?.sub;
    const userRoles = Array.isArray(req.user?.roles)
      ? req.user.roles
      : req.user?.role
        ? [req.user.role]
        : [];
    const isSuperviseurOrAdmin = userRoles.some((r: string) =>
      ['ADMIN', 'CEO', 'SUPER_ADMIN', 'admin', 'dirigeant', 'CABINET_ADMIN'].includes(r),
    );
    return this.validationService.deciderEcriture(
      tenantId,
      ecritureId,
      dto,
      userId,
      undefined,
      isSuperviseurOrAdmin,
    );
  }

  @Post('lot')
  @Permissions('compta.ecritures.validate')
  async validerLot(
    @Request() req: any,
    @Body() dto: ValidationLotDto,
  ) {
    const tenantId = req.user?.tenantId || req.tenantId;
    const userId = req.user?.id || req.user?.userId || req.user?.sub;
    return this.validationService.validerLot(tenantId, dto, userId);
  }
}
