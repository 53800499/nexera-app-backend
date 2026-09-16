import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { InvoicePdfService } from './invoice-pdf.service';
import { InvoiceEventBus } from '../events/invoice-event-bus';
import { InvoiceNormalizedEvent } from '../events/invoice-normalized.event';
import { InvoiceEntity } from '../entities/invoice.entity';
import { AuditService } from '../../audit/audit.service';
import { AuditAction, AuditEntityType } from '../../audit/enums/audit.enum';
import {
  InvoiceNormalizationStatus,
  MECEF_AIB_RATES,
  MecefAibType,
  MecefEnvironment,
  MecefTaxGroup,
} from '../enums/mecef.enum';
import { InvoiceType } from '../enums/invoice-type.enum';
import { InvoiceStatus } from '../enums/invoice-status.enum';
import {
  MecefConfigResponseDto,
  MecefTaxGroupBreakdownDto,
  NormalizeInvoiceDto,
  UpdateMecefConfigDto,
} from '../dto/mecef.dto';

@Injectable()
export class MecefClientService {
  private readonly logger = new Logger(MecefClientService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly invoicePdfService: InvoicePdfService,
    private readonly invoiceEventBus: InvoiceEventBus,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Récupère les paramètres de configuration e-MECeF pour le tenant.
   */
  async getConfig(tenantId: string): Promise<MecefConfigResponseDto> {
    const settings = await this.prisma.tenantSettings.upsert({
      where: { tenantId },
      create: { tenantId },
      update: {},
    });

    const isConfigured = Boolean(
      (settings.mecefApiUrl && settings.mecefApiKey) ||
        (settings.mecefEnvironment === MecefEnvironment.SANDBOX && settings.mecefNim),
    );

    return {
      mecefApiUrl: settings.mecefApiUrl,
      mecefApiKeyMasked: settings.mecefApiKey
        ? this.maskApiKey(settings.mecefApiKey)
        : null,
      mecefNim: settings.mecefNim,
      mecefEnvironment:
        (settings.mecefEnvironment as MecefEnvironment) ??
        MecefEnvironment.SANDBOX,
      mecefAutoNormalize: Boolean(settings.mecefAutoNormalize),
      isConfigured,
    };
  }

  /**
   * Met à jour les paramètres de configuration e-MECeF pour le tenant.
   */
  async updateConfig(
    tenantId: string,
    dto: UpdateMecefConfigDto,
  ): Promise<MecefConfigResponseDto> {
    const data: Record<string, any> = {};

    if (dto.mecefApiUrl !== undefined) data.mecefApiUrl = dto.mecefApiUrl;
    if (dto.mecefApiKey !== undefined && dto.mecefApiKey.trim() !== '') {
      data.mecefApiKey = dto.mecefApiKey.trim();
    }
    if (dto.mecefNim !== undefined) data.mecefNim = dto.mecefNim.trim();
    if (dto.mecefEnvironment !== undefined) {
      data.mecefEnvironment = dto.mecefEnvironment;
    }
    if (dto.mecefAutoNormalize !== undefined) {
      data.mecefAutoNormalize = dto.mecefAutoNormalize;
    }

    await this.prisma.tenantSettings.upsert({
      where: { tenantId },
      create: { tenantId, ...data },
      update: data,
    });

    return this.getConfig(tenantId);
  }

  /**
   * Déclenche la normalisation fiscale d'une facture auprès de la DGI (e-MECeF).
   */
  async normalizeInvoice(
    tenantId: string,
    invoiceId: string,
    dto?: NormalizeInvoiceDto,
    userId?: string,
  ) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, tenantId },
      include: {
        client: true,
        contact: true,
        originalInvoice: true,
        lines: {
          orderBy: { position: 'asc' },
          include: { taxRate: true },
        },
      },
    });

    if (!invoice) {
      throw new NotFoundException('Facture introuvable.');
    }

    if (invoice.invoiceType === InvoiceType.PROFORMA) {
      throw new BadRequestException(
        'Une facture proforma ne peut pas faire l’objet d’une normalisation fiscale (document non comptable).',
      );
    }

    if (invoice.status === InvoiceStatus.DRAFT) {
      throw new BadRequestException(
        'La facture doit être préalablement émise (statut issued) avec son numéro définitif avant normalisation.',
      );
    }

    if (invoice.normalizationStatus === InvoiceNormalizationStatus.NORMALIZED) {
      return invoice;
    }

    // Si Avoir (credit_note) : vérification de la référence au code MECeF d'origine
    let originalMecefCode = invoice.originalMecefCode;
    if (invoice.invoiceType === InvoiceType.CREDIT_NOTE && !originalMecefCode) {
      originalMecefCode = invoice.originalInvoice?.mecefCode ?? null;
      if (!originalMecefCode) {
        this.logger.warn(
          `Facture d’avoir ${invoice.number} normalisée sans code MECeF d’origine rattaché.`,
        );
      }
    }

    // 1. Calcul de la ventilation des groupes de taxation (Groupes A à F)
    const taxGroupTotals = this.computeTaxGroupTotals(invoice.lines);

    // 2. Détermination de l'AIB
    const aibType =
      dto?.aibType ?? (invoice.mecefAibType as MecefAibType) ?? MecefAibType.NONE;
    const aibRate = MECEF_AIB_RATES[aibType] ?? 0;
    const aibAmount = Math.round(invoice.baseHt * (aibRate / 100) * 100) / 100;

    // 3. Récupération de la configuration e-MECeF
    const settings = await this.prisma.tenantSettings.findUnique({
      where: { tenantId },
    });

    // Résolution de l'IFU de l'émetteur
    const emitterIfu = await this.resolveEmitterIfu(tenantId, settings);

    // Type de facture officiel e-MECeF
    const mecefType =
      invoice.invoiceType === InvoiceType.CREDIT_NOTE ? 'FA' : 'FV';

    // 4. Appel à l'API e-MECeF ou certification simulée
    let certificationResult: {
      nim: string;
      counters: string;
      codeMECeF: string;
      qrCodeData: string;
      normalizedAt: Date;
    };

    try {
      if (settings?.mecefApiUrl && settings?.mecefApiKey) {
        certificationResult = await this.callExternalMecefApi({
          apiUrl: settings.mecefApiUrl,
          apiKey: settings.mecefApiKey,
          nim: settings.mecefNim || 'TEST01000001',
          type: mecefType,
          reference: invoice.number,
          emitterIfu,
          clientIfu: invoice.client.taxId || invoice.client.siret || null,
          clientName: invoice.client.companyName,
          lines: invoice.lines,
          totalTtc: invoice.totalTtc,
          aibType,
          aibAmount,
          originalCode: originalMecefCode,
        });
      } else {
        certificationResult = await this.simulateMecefCertification({
          tenantId,
          nim: settings?.mecefNim || 'TEST01000001',
          type: mecefType,
          invoiceNumber: invoice.number,
          totalTtc: invoice.totalTtc,
          issueDate: invoice.issueDate,
        });
      }
    } catch (error: any) {
      const errorMessage =
        error instanceof Error ? error.message : 'Erreur de communication e-MECeF';
      this.logger.error(
        `Échec normalisation facture ${invoice.number}: ${errorMessage}`,
      );

      await this.prisma.invoice.update({
        where: { id: invoiceId },
        data: {
          normalizationStatus: InvoiceNormalizationStatus.FAILED,
          mecefErrorMessage: errorMessage,
        },
      });

      throw new BadRequestException(
        `Échec de la certification e-MECeF : ${errorMessage}`,
      );
    }

    // 5. Enregistrement des données fiscales de normalisation
    const updatedInvoice = await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        normalizationStatus: InvoiceNormalizationStatus.NORMALIZED,
        mecefNim: certificationResult.nim,
        mecefCounters: certificationResult.counters,
        mecefCode: certificationResult.codeMECeF,
        mecefQrCodeData: certificationResult.qrCodeData,
        mecefTaxGroupTotals: taxGroupTotals as any,
        mecefAibType: aibType,
        mecefAibAmount: aibAmount,
        mecefNormalizedAt: certificationResult.normalizedAt,
        mecefErrorMessage: null,
        originalMecefCode,
      },
      include: {
        client: true,
        contact: true,
        paymentTerm: true,
        lines: {
          orderBy: { position: 'asc' },
          include: { taxRate: true },
        },
      },
    });

    // 6. Invalidation du cache PDF pour forcer la régénération avec le QR code officiel
    await this.invoicePdfService.removeCached(tenantId, invoiceId);

    // 7. Événement et Audit
    this.invoiceEventBus.publish(
      new InvoiceNormalizedEvent(
        InvoiceEntity.fromPrisma(updatedInvoice),
        certificationResult.codeMECeF,
        certificationResult.nim,
        certificationResult.counters,
        certificationResult.normalizedAt,
      ),
    );

    await this.auditService.record({
      tenantId,
      userId,
      entityType: AuditEntityType.INVOICE,
      entityId: invoiceId,
      action: AuditAction.UPDATE,
      changes: {
        actionType: 'normalize_mecef',
        normalizationStatus: InvoiceNormalizationStatus.NORMALIZED,
        mecefCode: certificationResult.codeMECeF,
        mecefCounters: certificationResult.counters,
      },
    });

    return updatedInvoice;
  }

  /**
   * Calcule la ventilation des bases et montants par groupe de taxation officiel.
   */
  private computeTaxGroupTotals(
    lines: Array<{
      lineTotalHt: number;
      taxAmount: number;
      taxGroup?: string | null;
      taxRate?: { rate: number; taxGroup?: string | null } | null;
    }>,
  ): Record<string, MecefTaxGroupBreakdownDto> {
    const groups: Record<string, MecefTaxGroupBreakdownDto> = {};

    for (const line of lines) {
      const groupKey =
        line.taxGroup || line.taxRate?.taxGroup || MecefTaxGroup.B;
      const rate = line.taxRate?.rate ?? 0;

      if (!groups[groupKey]) {
        groups[groupKey] = {
          baseHt: 0,
          taxAmount: 0,
          rate,
        };
      }

      groups[groupKey].baseHt =
        Math.round((groups[groupKey].baseHt + line.lineTotalHt) * 100) / 100;
      groups[groupKey].taxAmount =
        Math.round((groups[groupKey].taxAmount + line.taxAmount) * 100) / 100;
    }

    return groups;
  }

  /**
   * Résout l'Identifiant Fiscal Unique (IFU) du vendeur.
   */
  private async resolveEmitterIfu(
    tenantId: string,
    settings: any,
  ): Promise<string> {
    try {
      const contribuable = await (this.prisma as any).taxContribuable?.findFirst({
        where: { tenantId, isDeleted: false },
      });
      if (contribuable?.identifiantFiscalUnique) {
        return contribuable.identifiantFiscalUnique;
      }
    } catch {
      // ignore
    }

    if (settings?.vatNumber) return settings.vatNumber;
    if (settings?.siret) return settings.siret;

    return '3201912345678'; // IFU de repli pour environnement de test
  }

  /**
   * Appel HTTP réel vers l'API e-MECeF DGI.
   */
  private async callExternalMecefApi(payload: {
    apiUrl: string;
    apiKey: string;
    nim: string;
    type: string;
    reference: string;
    emitterIfu: string;
    clientIfu: string | null;
    clientName: string;
    lines: any[];
    totalTtc: number;
    aibType: MecefAibType;
    aibAmount: number;
    originalCode: string | null;
  }) {
    const cleanUrl = payload.apiUrl.replace(/\/+$/, '');
    const endpoint = `${cleanUrl}/invoice`;

    const requestBody = {
      ifu: payload.emitterIfu,
      type: payload.type,
      reference: payload.reference,
      items: payload.lines.map((l) => ({
        name: l.description,
        price: l.unitPriceHt,
        quantity: l.quantity,
        taxGroup: l.taxGroup || l.taxRate?.taxGroup || 'B',
        taxSpecific: 0,
        originalPrice: l.unitPriceHt,
        priceModification: 0,
      })),
      client: {
        ifu: payload.clientIfu,
        name: payload.clientName,
      },
      aib: payload.aibType === MecefAibType.NONE ? null : payload.aibType,
      originalCode: payload.originalCode,
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${payload.apiKey}`,
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Erreur API DGI [${response.status}]: ${errorText || response.statusText}`,
        );
      }

      const data = (await response.json()) as any;

      return {
        nim: data.nim || payload.nim,
        counters: data.counters || '1/1 FV',
        codeMECeF: data.codeMECeF || data.codeMecef,
        qrCodeData: data.qrCode || data.qrCodeUrl || data.codeMECeF,
        normalizedAt: data.dateTime ? new Date(data.dateTime) : new Date(),
      };
    } catch (err: any) {
      clearTimeout(timeoutId);
      throw err;
    }
  }

  /**
   * Simulation locale conforme au format e-MECeF pour environnement de développement / sandbox.
   */
  private async simulateMecefCertification(input: {
    tenantId: string;
    nim: string;
    type: string;
    invoiceNumber: string;
    totalTtc: number;
    issueDate: Date;
  }) {
    const normalizedCount = await this.prisma.invoice.count({
      where: {
        tenantId: input.tenantId,
        normalizationStatus: InvoiceNormalizationStatus.NORMALIZED,
      },
    });

    const mc = normalizedCount + 1;
    const tc = normalizedCount + 1;
    const counters = `${mc}/${tc} ${input.type}`;

    // Génération d'un hash cryptographique sécurisé simulant la signature DGI
    const hashSource = `${input.nim}-${input.invoiceNumber}-${input.totalTtc}-${input.issueDate.toISOString()}-${mc}`;
    const hash = crypto
      .createHash('sha256')
      .update(hashSource)
      .digest('hex')
      .toUpperCase();

    // Formatage 4 blocs (ex: BJ01-ABCD-1234-EF56-7890)
    const p1 = hash.substring(0, 4);
    const p2 = hash.substring(4, 8);
    const p3 = hash.substring(8, 12);
    const p4 = hash.substring(12, 16);
    const codeMECeF = `BJ01-${p1}-${p2}-${p3}-${p4}`;

    const normalizedAt = new Date();
    const qrCodeData = `https://mecef.impots.bj/verify/${input.nim}/${codeMECeF}`;

    return {
      nim: input.nim,
      counters,
      codeMECeF,
      qrCodeData,
      normalizedAt,
    };
  }

  private maskApiKey(key: string): string {
    if (key.length <= 8) return '****';
    return `${key.slice(0, 4)}...${key.slice(-4)}`;
  }
}
