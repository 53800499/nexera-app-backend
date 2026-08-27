import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { OcrExtractionService } from './ocr-extraction.service';
import { AnomaliesEngineService } from './anomalies-engine.service';
import { ScanJustificatifDto, TraiterAnomalieDto } from '../dto/ia-scan.dto';

@Injectable()
export class IaNdfService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ocrService: OcrExtractionService,
    private readonly anomaliesEngine: AnomaliesEngineService,
  ) {}

  async scannerJustificatif(dto: ScanJustificatifDto) {
    return this.ocrService.extraireJustificatif(dto.fichierUrl, dto.typeFichier);
  }

  async auditerRapportFrais(tenantId: string, rapportId: string) {
    return this.anomaliesEngine.analyserRapportFrais(tenantId, rapportId);
  }

  async getAnomalies(tenantId: string, rapportId?: string) {
    const where: any = { tenantId, isDeleted: false };
    if (rapportId) where.ndfRapportFraisId = rapportId;

    return this.prisma.ndfAnomalieDetectee.findMany({
      where,
      include: {
        regleDetection: true,
        depense: {
          include: { categorieDepense: true },
        },
        rapportFrais: {
          include: { employe: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async traiterAnomalie(
    tenantId: string,
    anomalieId: string,
    utilisateurId: string,
    dto: TraiterAnomalieDto,
  ) {
    const anomalie = await this.prisma.ndfAnomalieDetectee.findFirst({
      where: { id: anomalieId, tenantId, isDeleted: false },
    });

    if (!anomalie) {
      throw new NotFoundException(`Anomalie #${anomalieId} introuvable`);
    }

    return this.prisma.ndfAnomalieDetectee.update({
      where: { id: anomalie.id },
      data: {
        statut: dto.statut,
        traiteParUtilisateurId: utilisateurId,
      },
    });
  }
}
