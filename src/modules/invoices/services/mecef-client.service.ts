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

    const emitterIfu = await this.resolveEmitterIfu(tenantId, settings, false);

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
      emitterIfu: emitterIfu !== '3201912345678' ? emitterIfu : (settings.vatNumber || null),
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
    if (dto.emitterIfu !== undefined) {
      const cleanIfu = dto.emitterIfu.trim();
      data.vatNumber = cleanIfu;
      try {
        await (this.prisma as any).taxContribuable.updateMany({
          where: { tenantId },
          data: { identifiantFiscalUnique: cleanIfu },
        });
      } catch {
        // ignore
      }
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

    const isProduction =
      settings?.mecefEnvironment === MecefEnvironment.PRODUCTION;

    // Résolution de l'IFU de l'émetteur
    const emitterIfu = await this.resolveEmitterIfu(
      tenantId,
      settings,
      isProduction,
    );

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

    let operatorName = 'Opérateur';
    if (userId) {
      try {
        const opUser = await this.prisma.user.findUnique({
          where: { id: userId },
          select: { firstName: true, lastName: true },
        });
        if (opUser) {
          operatorName =
            [opUser.firstName, opUser.lastName].filter(Boolean).join(' ') ||
            'Opérateur';
        }
      } catch {
        // ignore
      }
    }

    const clientContact =
      invoice.contact?.phone ||
      invoice.contact?.email ||
      (invoice.client as any)?.phone ||
      (invoice.client as any)?.email ||
      null;

    const clientAddress = invoice.client.billingAddress
      ? typeof invoice.client.billingAddress === 'object'
        ? Object.values(invoice.client.billingAddress)
            .filter(Boolean)
            .join(', ')
        : String(invoice.client.billingAddress)
      : null;

    try {
      if (isProduction) {
        if (!settings?.mecefApiUrl || !settings?.mecefApiKey) {
          throw new BadRequestException(
            "Configuration e-MECeF incomplète en mode Production. Veuillez renseigner l'URL de l'API DGI et votre clé secrète dans Paramètres → Facturation e-MECeF.",
          );
        }

        certificationResult = await this.callExternalMecefApi({
          apiUrl: settings.mecefApiUrl,
          apiKey: settings.mecefApiKey,
          nim: settings.mecefNim || 'TEST01000001',
          type: mecefType,
          invoiceNumber: invoice.number,
          emitterIfu,
          clientIfu: invoice.client.taxId || invoice.client.siret || null,
          clientName: invoice.client.companyName,
          clientContact,
          clientAddress,
          operatorId: userId || '01',
          operatorName,
          lines: invoice.lines,
          totalTtc: invoice.totalTtc,
          aibType,
          aibAmount,
          originalCode: originalMecefCode,
        });
      } else {
        // En mode Sandbox : appel externe uniquement si URL de test explicitement configurée
        if (
          settings?.mecefApiUrl &&
          settings?.mecefApiKey &&
          (settings.mecefApiUrl.includes('test') ||
            settings.mecefApiUrl.includes('dev') ||
            settings.mecefApiUrl.includes('sandbox'))
        ) {
          certificationResult = await this.callExternalMecefApi({
            apiUrl: settings.mecefApiUrl,
            apiKey: settings.mecefApiKey,
            nim: settings.mecefNim || 'TEST01000001',
            type: mecefType,
            invoiceNumber: invoice.number,
            emitterIfu,
            clientIfu: invoice.client.taxId || invoice.client.siret || null,
            clientName: invoice.client.companyName,
            clientContact,
            clientAddress,
            operatorId: userId || '01',
            operatorName,
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

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new BadRequestException(errorMessage);
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
    isProduction = false,
  ): Promise<string> {
    try {
      const contribuable = await (this.prisma as any).taxContribuable?.findFirst({
        where: { tenantId, isDeleted: false },
      });
      if (contribuable?.identifiantFiscalUnique?.trim()) {
        return contribuable.identifiantFiscalUnique.trim();
      }
    } catch {
      // ignore
    }

    if (settings?.vatNumber?.trim()) return settings.vatNumber.trim();
    if (settings?.siret?.trim()) return settings.siret.trim();

    if (isProduction) {
      throw new BadRequestException(
        "L'Identifiant Fiscal Unique (IFU) de votre entreprise n'est pas renseigné. Veuillez configurer votre IFU dans Paramètres → Organisation avant de normaliser en production.",
      );
    }

    return '3201912345678'; // IFU de repli pour environnement de test
  }

  /**
   * Résout proprement les URLs de l'API e-MECeF DGI Bénin (Production ou Test).
   */
  private resolveMecefEndpoint(baseUrl: string): {
    invoiceUrl: string;
    baseApiUrl: string;
  } {
    let clean = baseUrl.trim().replace(/\/+$/, '');

    // Si l'utilisateur a renseigné l'URL directe se terminant par /invoice
    if (clean.endsWith('/invoice')) {
      const baseApi = clean.slice(0, -'/invoice'.length);
      return { invoiceUrl: clean, baseApiUrl: baseApi };
    }

    // Auto-correction pour l'environnement de Test / Développeur officiel DGI
    if (clean.includes('developper.impots.bj') && !clean.includes('/sygmef-emcf')) {
      clean = `${clean}/sygmef-emcf/api`;
    } else if (clean.includes('developper.impots.bj/sygmef-emcf') && !clean.includes('/api')) {
      clean = `${clean}/api`;
    }

    // Auto-correction pour les URLs officielles de la plateforme SyGMEF DGI Bénin
    if (clean.includes('sygmef.impots.bj') && !clean.includes('/emcf')) {
      clean = `${clean}/emcf/api`;
    } else if (clean.includes('sygmef.impots.bj/emcf') && !clean.includes('/api')) {
      clean = `${clean}/api`;
    }

    return {
      invoiceUrl: `${clean}/invoice`,
      baseApiUrl: clean,
    };
  }

  /**
   * Appel HTTP vers l'API e-MECeF DGI Bénin (SFE / e-MCF).
   * Conforme à la spécification officielle DGI Bénin (Version 1.0).
   */
  private async callExternalMecefApi(payload: {
    apiUrl: string;
    apiKey: string;
    nim: string;
    type: string;
    invoiceNumber: string;
    emitterIfu: string;
    clientIfu: string | null;
    clientName: string;
    clientContact?: string | null;
    clientAddress?: string | null;
    operatorId?: string;
    operatorName?: string;
    paymentMethod?: string;
    lines: any[];
    totalTtc: number;
    aibType: MecefAibType;
    aibAmount: number;
    originalCode: string | null;
  }) {
    const { invoiceUrl, baseApiUrl } = this.resolveMecefEndpoint(payload.apiUrl);

    const clientIfuClean =
      payload.clientIfu && payload.clientIfu.trim().length === 13
        ? payload.clientIfu.trim()
        : null;

    // 1. Articles (ItemDto - conforme spec DGI p.10)
    const items = payload.lines.map((l) => {
      const rate = l.taxRate?.rate ?? 0;
      const priceTtc = Math.round(Number(l.unitPriceHt) * (1 + rate / 100));
      const rawGroup = (l.taxGroup || l.taxRate?.taxGroup || 'B').toUpperCase().trim();
      const taxGroup = ['A', 'B', 'C', 'D', 'E', 'F'].includes(rawGroup)
        ? rawGroup
        : 'B';

      const item: Record<string, any> = {
        name: (l.description || l.name || 'Article').trim(),
        price: priceTtc > 0 ? priceTtc : Math.max(1, Math.round(Number(l.unitPriceHt))),
        quantity: Number(l.quantity) > 0 ? Number(l.quantity) : 1,
        taxGroup,
      };

      if (l.code || l.itemCode) {
        item.code = String(l.code || l.itemCode).trim();
      }

      return item;
    });

    // 2. Opérateur (OperatorDto - OBLIGATOIRE selon spec DGI p.10)
    const operator = {
      id: payload.operatorId ? String(payload.operatorId).slice(0, 10) : '01',
      name: (payload.operatorName || 'Opérateur').trim().slice(0, 50),
    };

    // 3. Corps de la requête InvoiceRequestDataDto (spec DGI p.9)
    const requestBody: Record<string, any> = {
      ifu: payload.emitterIfu.trim(),
      type: payload.type,
      items,
      operator,
    };

    // Client (ClientDto - optionnel)
    if (payload.clientName && payload.clientName.trim()) {
      const clientObj: Record<string, any> = {
        name: payload.clientName.trim(),
      };
      if (clientIfuClean) {
        clientObj.ifu = clientIfuClean;
      }
      if (payload.clientContact && payload.clientContact.trim()) {
        clientObj.contact = payload.clientContact.trim().slice(0, 100);
      }
      if (payload.clientAddress && payload.clientAddress.trim()) {
        clientObj.address = payload.clientAddress.trim().slice(0, 150);
      }
      requestBody.client = clientObj;
    }

    // AIB (AibGroupTypeEnum - optionnel "A" ou "B", NE PAS envoyer null)
    if (payload.aibType === MecefAibType.A || (payload.aibType as string) === 'A') {
      requestBody.aib = 'A';
    } else if (payload.aibType === MecefAibType.B || (payload.aibType as string) === 'B') {
      requestBody.aib = 'B';
    }

    // Référence pour facture d'avoir (FA ou EA - OBLIGATOIRE 24 carats de Code MECeF d'origine, spec DGI p.9)
    if (payload.type === 'FA' || payload.type === 'EA') {
      const cleanRef = (payload.originalCode || '').replace(/[^a-zA-Z0-9]/g, '');
      if (cleanRef.length !== 24) {
        throw new BadRequestException(
          `La référence de la facture originale pour une facture d'avoir doit comporter exactement 24 caractères (Code MECeF reçu: "${payload.originalCode || 'vide'}").`,
        );
      }
      requestBody.reference = cleanRef;
    }

    // Détail paiement (PaymentDto - spec DGI p.10)
    const paymentType = this.mapPaymentType(payload.paymentMethod);
    requestBody.payment = [
      {
        name: paymentType,
        amount: Math.round(payload.totalTtc),
      },
    ];

    const cleanToken = this.sanitizeToken(payload.apiKey);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      this.logger.log(
        `[MecefClient] Envoi demande de facture vers ${invoiceUrl} (IFU: ${requestBody.ifu}, Type: ${requestBody.type})`,
      );

      const response = await fetch(invoiceUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${cleanToken}`,
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        if (response.status === 401) {
          const jwt = this.parseJwtPayload(cleanToken);
          const now = Date.now();
          const isExpired = Boolean(jwt?.exp && jwt.exp * 1000 < now);
          const isNotYetValid = Boolean(jwt?.nbf && jwt.nbf * 1000 > now);
          const expFormatted = jwt?.exp
            ? new Date(jwt.exp * 1000).toLocaleString('fr-FR')
            : null;
          const nbfFormatted = jwt?.nbf
            ? new Date(jwt.nbf * 1000).toLocaleString('fr-FR')
            : null;

          if (isExpired) {
            throw new BadRequestException(
              `Le jeton API DGI e-MECeF a expiré le ${expFormatted}. Veuillez générer un nouveau token sur le portail SyGMEF (https://sygmef.impots.bj) puis le mettre à jour dans Paramètres → Facturation e-MECeF.`,
            );
          }
          if (isNotYetValid) {
            throw new BadRequestException(
              `Le jeton API DGI e-MECeF n'est pas encore actif (valide à partir du ${nbfFormatted}). Vérifiez la date et l'heure de votre machine ou régénérez le token sur SyGMEF.`,
            );
          }

          let mismatchHint = '';
          const tokenNim = jwt?.unique_name?.split('|')?.[1];
          const tokenIfu = jwt?.unique_name?.split('|')?.[0];
          if (
            tokenNim &&
            payload.nim &&
            tokenNim.toUpperCase() !== payload.nim.toUpperCase()
          ) {
            mismatchHint += ` [Incohérence NIM détectée : votre token est lié à la machine "${tokenNim}", mais le NIM configuré est "${payload.nim}"]`;
          }
          if (tokenIfu && String(tokenIfu).trim() !== payload.emitterIfu.trim()) {
            mismatchHint += ` [Incohérence IFU détectée : votre token est émis pour l'IFU "${tokenIfu}", mais l'IFU émetteur configuré est "${payload.emitterIfu}"]`;
          }

          const validityInfo = expFormatted
            ? ` (clé valide jusqu'au ${expFormatted})`
            : '';

          throw new BadRequestException(
            `Authentification DGI refusée (401 Non autorisé)${validityInfo}.${mismatchHint} Le serveur de la DGI rejette la clé secrète d'API pour l'IFU "${payload.emitterIfu}" et le NIM "${payload.nim}". Assurez-vous sur le portail SyGMEF (https://sygmef.impots.bj) que cette machine NIM est bien déclarée, active et rattachée à cet IFU.`,
          );
        }

        const readableError = this.extractDgiErrorMessage(
          response.status,
          errorText,
        );
        throw new BadRequestException(
          `Erreur DGI (${response.status}) : ${readableError}`,
        );
      }

      const data = (await response.json()) as any;

      if (data.errorCode || data.errorDesc) {
        const desc =
          DGI_ERROR_CODES[String(data.errorCode)] ||
          data.errorDesc ||
          `Code d'erreur DGI ${data.errorCode}`;
        throw new BadRequestException(`Rejet e-MECeF (DGI Bénin) : ${desc}`);
      }

      // Finalisation obligatoire (PUT /api/invoice/{uid}/confirm - spec DGI p.14-15)
      let securityData = data;
      if (data.uid && !data.codeMECeFDGI && !data.codeMECeF && !data.codeMecef) {
        const confirmUrl = `${baseApiUrl}/invoice/${data.uid}/confirm`;
        let confirmResponse = await fetch(confirmUrl, {
          method: 'PUT',
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${cleanToken}`,
          },
          signal: controller.signal,
        });

        if (!confirmResponse.ok && confirmResponse.status === 405) {
          // Repli POST si PUT n'est pas autorisé par un proxy intermédiaire
          confirmResponse = await fetch(confirmUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
              Authorization: `Bearer ${cleanToken}`,
            },
            body: JSON.stringify({ action: 'confirm' }),
            signal: controller.signal,
          });
        }

        if (!confirmResponse.ok) {
          const confirmErrorText = await confirmResponse.text();
          const readableError = this.extractDgiErrorMessage(
            confirmResponse.status,
            confirmErrorText,
          );
          throw new BadRequestException(
            `Erreur de confirmation fiscale DGI (${confirmResponse.status}) : ${readableError}`,
          );
        }

        securityData = (await confirmResponse.json()) as any;

        if (securityData.errorCode || securityData.errorDesc) {
          const desc =
            DGI_ERROR_CODES[String(securityData.errorCode)] ||
            securityData.errorDesc ||
            `Code d'erreur DGI ${securityData.errorCode}`;
          throw new BadRequestException(
            `Échec de confirmation e-MECeF (DGI Bénin) : ${desc}`,
          );
        }
      }

      clearTimeout(timeoutId);

      const codeMECeF =
        securityData.codeMECeFDGI ||
        securityData.codeMECeF ||
        securityData.codeMecef ||
        data.codeMECeFDGI ||
        data.codeMECeF ||
        data.codeMecef;

      if (!codeMECeF) {
        throw new Error(
          `L'API DGI n'a renvoyé aucun code de sécurité MECeF valide. Réponse reçue: ${JSON.stringify(securityData)}`,
        );
      }

      const nim = securityData.nim || data.nim || payload.nim;
      const counters = securityData.counters || data.counters || '1/1 FV';
      const qrCodeData =
        securityData.qrCode ||
        securityData.qrCodeUrl ||
        data.qrCode ||
        data.qrCodeUrl ||
        `https://mecef.impots.bj/verify/${nim}/${codeMECeF}`;

      return {
        nim,
        counters,
        codeMECeF,
        qrCodeData,
        normalizedAt: this.parseDgiDateTime(
          securityData.dateTime || data.dateTime,
        ),
      };
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        throw new Error(
          `Délai d'attente dépassé (30s) avec le serveur DGI e-MECeF (${invoiceUrl}). Le serveur DGI est peut-être temporairement inaccessible ou surchargé.`,
        );
      }
      const cause = err.cause?.message || err.cause?.code || '';
      const detail = cause ? ` (${cause})` : '';
      if (
        err.message &&
        (err.message.includes('fetch failed') ||
          err.message.includes('ECONNREFUSED') ||
          err.message.includes('ENOTFOUND'))
      ) {
        throw new Error(
          `Impossible de joindre le serveur DGI e-MECeF (${invoiceUrl})${detail}. Vérifiez l'URL de l'API dans Paramètres → Facturation e-MECeF et l'accès réseau de votre serveur Nexera.`,
        );
      }
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

  private sanitizeToken(raw: string): string {
    let token = raw.trim();
    token = token.replace(/^["']|["']$/g, '');
    token = token.replace(/^bearer\s+/i, '').trim();
    return token;
  }

  private parseJwtPayload(token: string): any | null {
    try {
      const parts = token.trim().split('.');
      if (parts.length >= 2) {
        const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        const padded = base64.padEnd(
          base64.length + ((4 - (base64.length % 4)) % 4),
          '=',
        );
        const decoded = Buffer.from(padded, 'base64').toString('utf8');
        return JSON.parse(decoded);
      }
    } catch {
      // ignore
    }
    return null;
  }

  /**
   * Analyse la date renvoyée par l'API e-MECeF au format "DD/MM/YYYY HH:mm:ss" ou ISO 8601.
   */
  private parseDgiDateTime(rawDate?: string): Date {
    if (!rawDate) return new Date();
    const str = String(rawDate).trim();
    const match = str.match(
      /^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}):(\d{2}))?/,
    );
    if (match) {
      const [, d, m, y, h = '0', min = '0', s = '0'] = match;
      const date = new Date(Date.UTC(+y, +m - 1, +d, +h - 1, +min, +s));
      if (!isNaN(date.getTime())) return date;
    }
    const fallback = new Date(str);
    return isNaN(fallback.getTime()) ? new Date() : fallback;
  }

  /**
   * Mappe le mode de paiement interne vers l'énumération officielle PaymentTypeEnum de la DGI.
   */
  private mapPaymentType(method?: string): string {
    if (!method) return 'ESPECES';
    const m = method.toUpperCase().replace(/\s+/g, '');
    if (m.includes('VIREMENT') || m.includes('BANK') || m.includes('TRANSFER')) {
      return 'VIREMENT';
    }
    if (
      m.includes('CARTE') ||
      m.includes('CARD') ||
      m.includes('VISA') ||
      m.includes('MASTERCARD')
    ) {
      return 'CARTEBANCAIRE';
    }
    if (
      m.includes('MOBILE') ||
      m.includes('MOMO') ||
      m.includes('MTN') ||
      m.includes('MOOV') ||
      m.includes('CELTIS')
    ) {
      return 'MOBILEMONEY';
    }
    if (m.includes('CHEQUE')) {
      return 'CHEQUES';
    }
    if (m.includes('CREDIT')) {
      return 'CREDIT';
    }
    if (m.includes('ESPECE') || m.includes('CASH')) {
      return 'ESPECES';
    }
    return 'AUTRE';
  }

  /**
   * Teste la connectivité et la validité des accès DGI e-MECeF pour une organisation.
   */
  async testConnection(tenantId: string) {
    const settings = await this.prisma.tenantSettings.findUnique({
      where: { tenantId },
    });

    if (!settings?.mecefApiKey) {
      throw new BadRequestException(
        "Aucune clé secrète d'API e-MECeF n'est enregistrée. Veuillez la configurer dans Paramètres → Facturation e-MECeF.",
      );
    }

    const { baseApiUrl } = this.resolveMecefEndpoint(
      settings.mecefApiUrl || 'https://sygmef.impots.bj/emcf/api',
    );
    const cleanToken = this.sanitizeToken(settings.mecefApiKey);

    try {
      const response = await fetch(`${baseApiUrl}/info/status`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${cleanToken}`,
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        const readable = this.extractDgiErrorMessage(response.status, errorText);
        throw new BadRequestException(`Test de connexion DGI refusé : ${readable}`);
      }

      const data = (await response.json()) as any;
      return {
        success: true,
        status: data.status,
        version: data.version,
        ifu: data.ifu,
        nim: data.nim,
        tokenValid: data.tokenValid,
        serverDateTime: data.serverDateTime,
        emcfList: data.emcfList || [],
      };
    } catch (err: any) {
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException(
        `Impossible de contacter le serveur DGI : ${err.message}`,
      );
    }
  }

  /**
   * Analyse et traduit les erreurs retournées par l'API e-MECeF / SyGMEF en un message clair.
   */
  private extractDgiErrorMessage(status: number, rawText: string): string {
    if (!rawText || !rawText.trim()) {
      switch (status) {
        case 401:
          return 'Authentification DGI refusée (401 Non autorisé). Clé API ou NIM non reconnue.';
        case 403:
          return 'Accès refusé par la DGI (403 Accès interdit). Privilèges fiscaux insuffisants.';
        case 404:
          return 'Point de terminaison DGI introuvable (404). Vérifiez l’URL de l’API e-MECeF.';
        case 500:
        case 502:
        case 503:
        case 504:
          return 'Le serveur DGI e-MECeF est momentanément indisponible ou en maintenance.';
        default:
          return `Le serveur DGI a retourné le code HTTP ${status}.`;
      }
    }

    try {
      const parsed = JSON.parse(rawText);
      if (typeof parsed === 'string') return parsed;

      // Codes d'erreurs officiels DGI (Annexe spec e-MCF p.24)
      if (parsed.errorCode && DGI_ERROR_CODES[String(parsed.errorCode)]) {
        return DGI_ERROR_CODES[String(parsed.errorCode)];
      }

      if (parsed.errorDesc && typeof parsed.errorDesc === 'string') {
        return parsed.errorDesc;
      }

      // RFC 7807 / ASP.NET ProblemDetails
      if (parsed.errors && typeof parsed.errors === 'object') {
        const lines: string[] = [];
        for (const [field, errs] of Object.entries(parsed.errors)) {
          const list = Array.isArray(errs) ? errs.join(', ') : String(errs);
          lines.push(`${field}: ${list}`);
        }
        if (lines.length > 0) return lines.join(' ; ');
      }

      if (parsed.detail && typeof parsed.detail === 'string') {
        return parsed.detail;
      }

      if (parsed.message && typeof parsed.message === 'string') {
        return parsed.message;
      }

      if (parsed.title && typeof parsed.title === 'string') {
        if (parsed.title === 'Unauthorized' || status === 401) {
          return 'Authentification DGI refusée (401 Non autorisé). Clé API ou NIM non autorisée sur SyGMEF.';
        }
        if (parsed.title === 'Forbidden' || status === 403) {
          return 'Accès refusé par la DGI (403 Interdit). Droits fiscaux insuffisants.';
        }
        return parsed.title;
      }
    } catch {
      // Ignorer l'échec de parsing JSON
    }

    const clean = rawText.replace(/\r?\n/g, ' ').trim();
    return clean.length > 250 ? `${clean.slice(0, 250)}...` : clean;
  }
}

/**
 * Codes et libellés d'erreurs officiels issus de la spécification API e-MCF (DGI Bénin - Version 1.0, Annexe p.24)
 */
export const DGI_ERROR_CODES: Record<string, string> = {
  '1': 'Le nombre maximum de factures en attente est dépassé (limite de 10 factures atteintes sans finalisation).',
  '3': "Le type de facture n'est pas valide (attendu: FV, EV, FA, EA).",
  '4': "La référence de la facture originale est manquante (obligatoire pour facture d'avoir FA / EA).",
  '5': "La référence de la facture originale ne comporte pas 24 caractères.",
  '6': "La valeur de l'AIB n'est pas valide (attendu: A pour 1% ou B pour 5%).",
  '7': "Le type de paiement n'est pas valide.",
  '8': 'La facture doit contenir au moins un article.',
  '9': "Le groupe de taxation au niveau des articles n'est pas valide (A, B, C, D, E, F).",
  '10': "La référence de la facture originale ne peut pas être validée, veuillez réessayer plus tard.",
  '11': "La référence de la facture originale n'est pas valide (facture originale introuvable à la DGI).",
  '12': "La référence de la facture originale n'est pas valide (le montant de la facture d'avoir dépasse le montant de la facture originale).",
  '20': "La facture n'existe pas ou elle est déjà finalisée / annulée.",
  '99': 'Erreur lors du traitement de la demande par le serveur DGI.',
};
