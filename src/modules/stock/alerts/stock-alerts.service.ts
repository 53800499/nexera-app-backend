import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  ReplenishmentProposalStatus,
  StockAlertLevel,
  StockAlertStatus,
  StockAlertType,
  StockMovementType,
} from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { DocumentNumberingService } from '../../settings/services/document-numbering.service';
import { NumberingDocumentType } from '../../settings/enums/numbering-document-type.enum';
import { CrmMessages } from '../../../shared/constants/crm-messages';
import { IntegrationEventBus } from '../../../shared/events/integration-event.bus';
import {
  STOCK_ALERT_TRIGGERED,
  STOCK_REPLENISHMENT_APPROVED,
} from './events/alerts.events';
import {
  CreateReplenishmentDto,
  RejectReplenishmentDto,
} from './dto/alerts.dto';

/** Jours sans mouvement → article dormant (paramètre v1). */
export const DEFAULT_DORMANT_DAYS = 90;
/** Seuil péremption par défaut (jours) si non configuré sur l’article */
export const DEFAULT_EXPIRY_ALERT_DAYS = 30;
/** Fenêtre conso moyenne (jours) — vitesse consommation 30 j */
const USAGE_WINDOW_DAYS = 30;
/** Horizon de couverture cible pour suggestion IA (jours) */
const COVER_DAYS = 14;

/** §3.3 — vitesse conso = sorties vente (OUT_SALE) uniquement */
const CONSUMPTION_TYPES: StockMovementType[] = [StockMovementType.OUT_SALE];

const alertInclude = {
  stockItem: {
    include: {
      commercialItem: {
        select: { id: true, reference: true, name: true, unit: true },
      },
    },
  },
  warehouse: { select: { id: true, code: true, name: true } },
  lot: { select: { id: true, lotNumber: true, expiryDate: true } },
  replenishment: {
    select: { id: true, number: true, status: true, qtyProposed: true },
  },
} satisfies Prisma.StockAlertInclude;

const proposalInclude = {
  stockItem: {
    include: {
      commercialItem: {
        select: { id: true, reference: true, name: true, unit: true },
      },
    },
  },
  warehouse: { select: { id: true, code: true, name: true } },
  alert: { select: { id: true, alertType: true, title: true } },
} satisfies Prisma.ReplenishmentProposalInclude;

type CandidateAlert = {
  alertType: StockAlertType;
  severity: StockAlertLevel;
  stockItemId: string;
  warehouseId: string | null;
  lotId: string | null;
  qtyOnHand: number;
  thresholdQty: number | null;
  daysMetric: number | null;
  title: string;
  message: string;
  suggestion: string | null;
  suggestedQty: number | null;
  fingerprint: string;
  reference: string;
};

@Injectable()
export class StockAlertsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly numberingService: DocumentNumberingService,
    private readonly integrationBus: IntegrationEventBus,
  ) {}

  async listAlerts(
    tenantId: string,
    opts?: { status?: StockAlertStatus; alertType?: StockAlertType },
  ) {
    return this.prisma.stockAlert.findMany({
      where: {
        tenantId,
        ...(opts?.status ? { status: opts.status } : {}),
        ...(opts?.alertType ? { alertType: opts.alertType } : {}),
      },
      orderBy: [{ severity: 'asc' }, { createdAt: 'desc' }],
      include: alertInclude,
    });
  }

  async getSummary(tenantId: string) {
    const open = await this.prisma.stockAlert.groupBy({
      by: ['alertType', 'severity'],
      where: {
        tenantId,
        status: { in: [StockAlertStatus.open, StockAlertStatus.acknowledged] },
      },
      _count: { _all: true },
    });
    const pendingReplenishments = await this.prisma.replenishmentProposal.count({
      where: { tenantId, status: ReplenishmentProposalStatus.pending },
    });
    return {
      byType: open,
      openCount: open.reduce((s, r) => s + r._count._all, 0),
      pendingReplenishments,
    };
  }

  async findAlert(id: string, tenantId: string) {
    const alert = await this.prisma.stockAlert.findFirst({
      where: { id, tenantId },
      include: alertInclude,
    });
    if (!alert) {
      throw new NotFoundException(CrmMessages.stock.ALERT_NOT_FOUND);
    }
    return alert;
  }

  /**
   * Rescan complet : génère / met à jour les alertes actives,
   * résout celles qui ne s’appliquent plus, crée des propositions réappro (rupture).
   */
  async scan(
    tenantId: string,
    opts?: { dormantDays?: number; autoReplenish?: boolean; userId?: string },
  ) {
    const dormantDays = opts?.dormantDays ?? DEFAULT_DORMANT_DAYS;
    const autoReplenish = opts?.autoReplenish !== false;
    const userId = opts?.userId ?? 'system';

    const candidates = await this.buildCandidates(tenantId, dormantDays);
    const activeFingerprints = new Set(candidates.map((c) => c.fingerprint));
    let created = 0;
    let updated = 0;
    let resolved = 0;
    let proposals = 0;

    for (const c of candidates) {
      const existing = await this.prisma.stockAlert.findUnique({
        where: {
          tenantId_fingerprint: {
            tenantId,
            fingerprint: c.fingerprint,
          },
        },
      });

      if (existing) {
        if (
          existing.status === StockAlertStatus.dismissed ||
          existing.status === StockAlertStatus.resolved
        ) {
          // Réouvrir si le problème revient
          await this.prisma.stockAlert.update({
            where: { id: existing.id },
            data: {
              status: StockAlertStatus.open,
              severity: c.severity,
              qtyOnHand: c.qtyOnHand,
              thresholdQty: c.thresholdQty,
              daysMetric: c.daysMetric,
              title: c.title,
              message: c.message,
              suggestion: c.suggestion,
              suggestedQty: c.suggestedQty,
              resolvedAt: null,
            },
          });
          updated += 1;
        } else {
          await this.prisma.stockAlert.update({
            where: { id: existing.id },
            data: {
              severity: c.severity,
              qtyOnHand: c.qtyOnHand,
              thresholdQty: c.thresholdQty,
              daysMetric: c.daysMetric,
              title: c.title,
              message: c.message,
              suggestion: c.suggestion,
              suggestedQty: c.suggestedQty,
            },
          });
          updated += 1;
        }
      } else {
        const alert = await this.prisma.stockAlert.create({
          data: {
            tenantId,
            alertType: c.alertType,
            status: StockAlertStatus.open,
            severity: c.severity,
            stockItemId: c.stockItemId,
            warehouseId: c.warehouseId,
            lotId: c.lotId,
            qtyOnHand: c.qtyOnHand,
            thresholdQty: c.thresholdQty,
            daysMetric: c.daysMetric,
            title: c.title,
            message: c.message,
            suggestion: c.suggestion,
            suggestedQty: c.suggestedQty,
            fingerprint: c.fingerprint,
          },
        });
        created += 1;
        await this.integrationBus.publish({
          eventName: STOCK_ALERT_TRIGGERED,
          tenantId,
          occurredAt: new Date(),
          payload: {
            itemId: c.stockItemId,
            alertType: c.alertType,
            currentQty: c.qtyOnHand,
            thresholdQty: c.thresholdQty,
            estimatedDaysToStockout: c.daysMetric,
            alertId: alert.id,
            stockItemId: c.stockItemId,
            reference: c.reference,
            severity: c.severity,
            warehouseId: c.warehouseId,
          },
        });

        if (
          autoReplenish &&
          c.alertType === StockAlertType.shortage &&
          c.warehouseId &&
          c.suggestedQty &&
          c.suggestedQty > 0
        ) {
          const made = await this.ensureReplenishmentFromAlert(
            alert.id,
            tenantId,
            userId,
          );
          if (made) proposals += 1;
        }
      }
    }

    // Résoudre les alertes ouvertes dont le fingerprint n’est plus pertinent
    const stale = await this.prisma.stockAlert.findMany({
      where: {
        tenantId,
        status: { in: [StockAlertStatus.open, StockAlertStatus.acknowledged] },
        fingerprint: { notIn: [...activeFingerprints] },
      },
    });
    for (const a of stale) {
      await this.prisma.stockAlert.update({
        where: { id: a.id },
        data: {
          status: StockAlertStatus.resolved,
          resolvedAt: new Date(),
        },
      });
      resolved += 1;
    }

    // Propositions pour alertes rupture déjà existantes sans réappro
    if (autoReplenish) {
      const shortages = await this.prisma.stockAlert.findMany({
        where: {
          tenantId,
          alertType: StockAlertType.shortage,
          status: {
            in: [StockAlertStatus.open, StockAlertStatus.acknowledged],
          },
          replenishment: null,
          warehouseId: { not: null },
        },
      });
      for (const a of shortages) {
        const made = await this.ensureReplenishmentFromAlert(
          a.id,
          tenantId,
          userId,
        );
        if (made) proposals += 1;
      }
    }

    return {
      created,
      updated,
      resolved,
      proposalsCreated: proposals,
      active: candidates.length,
    };
  }

  async acknowledge(id: string, tenantId: string, userId: string) {
    const alert = await this.findAlert(id, tenantId);
    if (
      alert.status !== StockAlertStatus.open &&
      alert.status !== StockAlertStatus.acknowledged
    ) {
      throw new BadRequestException(CrmMessages.stock.ALERT_INVALID_STATUS);
    }
    return this.prisma.stockAlert.update({
      where: { id },
      data: {
        status: StockAlertStatus.acknowledged,
        acknowledgedAt: new Date(),
        acknowledgedBy: userId,
      },
      include: alertInclude,
    });
  }

  async dismiss(id: string, tenantId: string) {
    const alert = await this.findAlert(id, tenantId);
    if (
      alert.status !== StockAlertStatus.open &&
      alert.status !== StockAlertStatus.acknowledged
    ) {
      throw new BadRequestException(CrmMessages.stock.ALERT_INVALID_STATUS);
    }
    return this.prisma.stockAlert.update({
      where: { id },
      data: {
        status: StockAlertStatus.dismissed,
        resolvedAt: new Date(),
      },
      include: alertInclude,
    });
  }

  async listReplenishments(tenantId: string) {
    return this.prisma.replenishmentProposal.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      include: proposalInclude,
    });
  }

  async findReplenishment(id: string, tenantId: string) {
    const proposal = await this.prisma.replenishmentProposal.findFirst({
      where: { id, tenantId },
      include: proposalInclude,
    });
    if (!proposal) {
      throw new NotFoundException(CrmMessages.stock.REPLENISHMENT_NOT_FOUND);
    }
    return proposal;
  }

  async createReplenishment(
    dto: CreateReplenishmentDto,
    tenantId: string,
    userId: string,
  ) {
    if (dto.alertId) {
      const made = await this.ensureReplenishmentFromAlert(
        dto.alertId,
        tenantId,
        userId,
        dto.qtyProposed,
        dto.notes,
      );
      if (!made) {
        throw new BadRequestException(
          CrmMessages.stock.REPLENISHMENT_ALREADY_EXISTS,
        );
      }
      const alert = await this.prisma.stockAlert.findFirstOrThrow({
        where: { id: dto.alertId, tenantId },
        include: { replenishment: true },
      });
      return this.findReplenishment(alert.replenishment!.id, tenantId);
    }

    if (!dto.stockItemId || !dto.warehouseId) {
      throw new BadRequestException(
        'stockItemId et warehouseId sont requis sans alertId.',
      );
    }

    const metrics = await this.computeUsageMetrics(
      tenantId,
      dto.stockItemId,
      dto.warehouseId,
    );
    const stockItem = await this.prisma.stockItem.findFirst({
      where: { id: dto.stockItemId, tenantId },
    });
    if (!stockItem) {
      throw new NotFoundException(CrmMessages.stock.STOCK_ITEM_NOT_FOUND);
    }

    const qtyConfigured = stockItem.reorderQty ?? null;
    const qtyAi = metrics.suggestedQty;
    const qtyProposed = dto.qtyProposed ?? qtyConfigured ?? qtyAi ?? 1;

    const number = await this.numberingService.generateNext(
      tenantId,
      NumberingDocumentType.PURCHASE_REQUEST,
    );

    return this.prisma.replenishmentProposal.create({
      data: {
        tenantId,
        number,
        status: ReplenishmentProposalStatus.pending,
        stockItemId: dto.stockItemId,
        warehouseId: dto.warehouseId,
        qtyProposed,
        qtyConfigured,
        qtyAiSuggested: qtyAi,
        avgDailyUsage: metrics.avgDaily,
        daysToStockout: metrics.daysToStockout,
        reason: 'Demande d’achat interne (v1.0)',
        notes: dto.notes,
        createdBy: userId,
      },
      include: proposalInclude,
    });
  }

  async approveReplenishment(id: string, tenantId: string, userId: string) {
    const proposal = await this.findReplenishment(id, tenantId);
    if (proposal.status !== ReplenishmentProposalStatus.pending) {
      throw new BadRequestException(
        CrmMessages.stock.REPLENISHMENT_INVALID_STATUS,
      );
    }

    const updated = await this.prisma.replenishmentProposal.update({
      where: { id },
      data: {
        status: ReplenishmentProposalStatus.approved,
        decidedBy: userId,
        decidedAt: new Date(),
      },
      include: proposalInclude,
    });

    if (proposal.alertId) {
      await this.prisma.stockAlert.update({
        where: { id: proposal.alertId },
        data: {
          status: StockAlertStatus.acknowledged,
          acknowledgedAt: new Date(),
          acknowledgedBy: userId,
        },
      });
    }

    await this.integrationBus.publish({
      eventName: STOCK_REPLENISHMENT_APPROVED,
      tenantId,
      occurredAt: new Date(),
      payload: {
        proposalId: updated.id,
        number: updated.number,
        stockItemId: updated.stockItemId,
        qtyProposed: updated.qtyProposed,
      },
    });

    return updated;
  }

  async rejectReplenishment(
    id: string,
    dto: RejectReplenishmentDto,
    tenantId: string,
    userId: string,
  ) {
    const proposal = await this.findReplenishment(id, tenantId);
    if (proposal.status !== ReplenishmentProposalStatus.pending) {
      throw new BadRequestException(
        CrmMessages.stock.REPLENISHMENT_INVALID_STATUS,
      );
    }
    return this.prisma.replenishmentProposal.update({
      where: { id },
      data: {
        status: ReplenishmentProposalStatus.rejected,
        decidedBy: userId,
        decidedAt: new Date(),
        reason: dto.reason?.trim() || proposal.reason,
      },
      include: proposalInclude,
    });
  }

  private async ensureReplenishmentFromAlert(
    alertId: string,
    tenantId: string,
    userId: string,
    qtyOverride?: number,
    notes?: string,
  ): Promise<boolean> {
    const alert = await this.prisma.stockAlert.findFirst({
      where: { id: alertId, tenantId },
      include: {
        stockItem: true,
        replenishment: true,
      },
    });
    if (!alert || !alert.warehouseId) return false;
    if (alert.replenishment) return false;

    const metrics = await this.computeUsageMetrics(
      tenantId,
      alert.stockItemId,
      alert.warehouseId,
    );
    const qtyConfigured = alert.stockItem.reorderQty ?? null;
    const qtyAi = alert.suggestedQty ?? metrics.suggestedQty;
    const qtyProposed = qtyOverride ?? qtyConfigured ?? qtyAi ?? 1;

    const number = await this.numberingService.generateNext(
      tenantId,
      NumberingDocumentType.PURCHASE_REQUEST,
    );

    await this.prisma.replenishmentProposal.create({
      data: {
        tenantId,
        number,
        status: ReplenishmentProposalStatus.pending,
        stockItemId: alert.stockItemId,
        warehouseId: alert.warehouseId,
        alertId: alert.id,
        qtyProposed,
        qtyConfigured,
        qtyAiSuggested: qtyAi,
        avgDailyUsage: metrics.avgDaily,
        daysToStockout: metrics.daysToStockout,
        reason: 'Réapprovisionnement auto — stock sous minimum',
        notes,
        createdBy: userId,
      },
    });
    return true;
  }

  private async buildCandidates(
    tenantId: string,
    dormantDays: number,
  ): Promise<CandidateAlert[]> {
    const candidates: CandidateAlert[] = [];
    const now = new Date();

    const levels = await this.prisma.stockLevel.findMany({
      where: { tenantId },
      include: {
        stockItem: {
          include: {
            commercialItem: {
              select: { reference: true, name: true },
            },
          },
        },
        warehouse: { select: { code: true, name: true } },
      },
    });

    // Agrégat par article+entrepôt pour seuils globaux
    const byItemWh = new Map<
      string,
      {
        stockItemId: string;
        warehouseId: string;
        qty: number;
        qtyAvailable: number;
        min: number | null;
        safety: number | null;
        max: number | null;
        reorder: number | null;
        reference: string;
        name: string;
        whCode: string;
      }
    >();

    for (const level of levels) {
      const key = `${level.stockItemId}:${level.warehouseId}`;
      const prev = byItemWh.get(key);
      if (prev) {
        prev.qty += level.qtyOnHand;
        prev.qtyAvailable += level.qtyAvailable;
      } else {
        byItemWh.set(key, {
          stockItemId: level.stockItemId,
          warehouseId: level.warehouseId,
          qty: level.qtyOnHand,
          qtyAvailable: level.qtyAvailable,
          min: level.stockItem.minStockQty,
          safety: level.stockItem.safetyStockQty,
          max: level.stockItem.maxStockQty,
          reorder: level.stockItem.reorderQty,
          reference: level.stockItem.commercialItem.reference,
          name: level.stockItem.commercialItem.name,
          whCode: level.warehouse.code,
        });
      }
    }

    for (const row of byItemWh.values()) {
      const metrics = await this.computeUsageMetrics(
        tenantId,
        row.stockItemId,
        row.warehouseId,
        row.qtyAvailable,
      );

      if (row.min != null && row.qty <= row.min) {
        const suggested =
          row.reorder ??
          metrics.suggestedQty ??
          Math.max(row.min - row.qty, 1);
        candidates.push({
          alertType: StockAlertType.shortage,
          severity: StockAlertLevel.critical,
          stockItemId: row.stockItemId,
          warehouseId: row.warehouseId,
          lotId: null,
          qtyOnHand: row.qty,
          thresholdQty: row.min,
          daysMetric: metrics.daysToStockout,
          title: `Rupture — ${row.reference}`,
          message: `Stock ${row.qty} ≤ minimum ${row.min} (${row.whCode}).`,
          suggestion: `Commander ${suggested} (réappro paramétré / conso moyenne).`,
          suggestedQty: suggested,
          fingerprint: `shortage:${row.stockItemId}:${row.warehouseId}`,
          reference: row.reference,
        });
      } else if (row.safety != null && row.qty <= row.safety) {
        candidates.push({
          alertType: StockAlertType.safety,
          severity: StockAlertLevel.warning,
          stockItemId: row.stockItemId,
          warehouseId: row.warehouseId,
          lotId: null,
          qtyOnHand: row.qty,
          thresholdQty: row.safety,
          daysMetric: metrics.daysToStockout,
          title: `Alerte sécurité — ${row.reference}`,
          message: `Stock ${row.qty} ≤ sécurité ${row.safety} (${row.whCode}).`,
          suggestion:
            metrics.daysToStockout != null
              ? `Rupture estimée dans ~${Math.ceil(metrics.daysToStockout)} jour(s) selon la conso.`
              : 'Surveiller la consommation et anticiper un réappro.',
          suggestedQty: row.reorder ?? metrics.suggestedQty,
          fingerprint: `safety:${row.stockItemId}:${row.warehouseId}`,
          reference: row.reference,
        });
      }

      if (row.max != null && row.qty > row.max) {
        candidates.push({
          alertType: StockAlertType.overstock,
          severity: StockAlertLevel.warning,
          stockItemId: row.stockItemId,
          warehouseId: row.warehouseId,
          lotId: null,
          qtyOnHand: row.qty,
          thresholdQty: row.max,
          daysMetric: null,
          title: `Surstock — ${row.reference}`,
          message: `Stock ${row.qty} > maximum ${row.max} (${row.whCode}).`,
          suggestion:
            'Envisager un transfert inter-entrepôts ou une action commerciale.',
          suggestedQty: null,
          fingerprint: `overstock:${row.stockItemId}:${row.warehouseId}`,
          reference: row.reference,
        });
      }
    }

    // Péremption lots
    const lots = await this.prisma.stockItemLot.findMany({
      where: {
        tenantId,
        expiryDate: { not: null },
        remainingQty: { gt: 0 },
      },
      include: {
        stockItem: {
          include: {
            commercialItem: { select: { reference: true, name: true } },
          },
        },
        levels: {
          where: { qtyOnHand: { gt: 0 } },
          select: { warehouseId: true, qtyOnHand: true },
        },
      },
    });

    for (const lot of lots) {
      if (!lot.expiryDate) continue;
      const daysLeft = Math.ceil(
        (lot.expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      );
      // §3.3 — (date_péremption - CURRENT_DATE) ≤ seuil_alerte_péremption
      const threshold =
        lot.stockItem.expiryAlertDays ?? DEFAULT_EXPIRY_ALERT_DAYS;
      if (daysLeft > threshold) continue;

      const whId = lot.levels[0]?.warehouseId ?? null;
      const qty = lot.levels.reduce((s, l) => s + l.qtyOnHand, 0) || lot.remainingQty;
      candidates.push({
        alertType: StockAlertType.expiry,
        severity:
          daysLeft <= 7 || daysLeft < 0
            ? StockAlertLevel.critical
            : StockAlertLevel.warning,
        stockItemId: lot.stockItemId,
        warehouseId: whId,
        lotId: lot.id,
        qtyOnHand: qty,
        thresholdQty: threshold,
        daysMetric: daysLeft,
        title: `Péremption — ${lot.stockItem.commercialItem.reference}`,
        message: `Lot ${lot.lotNumber} : ${daysLeft < 0 ? 'périmé' : `J-${Math.max(daysLeft, 0)}`} (${lot.expiryDate.toISOString().slice(0, 10)}, seuil ${threshold} j).`,
        suggestion: 'Prioriser la sortie / consommation de ce lot.',
        suggestedQty: null,
        fingerprint: `expiry:${lot.id}:${threshold}`,
        reference: lot.stockItem.commercialItem.reference,
      });
    }

    // Articles dormants
    const stockItems = await this.prisma.stockItem.findMany({
      where: { tenantId },
      include: {
        commercialItem: { select: { reference: true, name: true } },
        levels: true,
      },
    });
    const since = new Date();
    since.setDate(since.getDate() - dormantDays);

    for (const item of stockItems) {
      const totalQty = item.levels.reduce((s, l) => s + l.qtyOnHand, 0);
      if (totalQty <= 0) continue;

      const lastMove = await this.prisma.stockMovementLine.findFirst({
        where: {
          tenantId,
          stockItemId: item.id,
          movement: {
            status: 'validated',
            movementDate: { gte: since },
          },
        },
        select: { id: true },
      });
      if (lastMove) continue;

      const anyHistory = await this.prisma.stockMovementLine.findFirst({
        where: { tenantId, stockItemId: item.id },
        select: { id: true },
      });
      // Pas d'historique récent ; si jamais de mouvement ou ancien → dormant
      void anyHistory;

      const whId = item.defaultWarehouseId ?? item.levels[0]?.warehouseId ?? null;
      candidates.push({
        alertType: StockAlertType.dormant,
        severity: StockAlertLevel.warning,
        stockItemId: item.id,
        warehouseId: whId,
        lotId: null,
        qtyOnHand: totalQty,
        thresholdQty: null,
        daysMetric: dormantDays,
        title: `Dormant — ${item.commercialItem.reference}`,
        message: `Aucun mouvement depuis ${dormantDays} jours (stock ${totalQty}).`,
        suggestion: 'Envisager déstockage, transfert ou archivage.',
        suggestedQty: null,
        fingerprint: `dormant:${item.id}`,
        reference: item.commercialItem.reference,
      });
    }

    return candidates;
  }

  private async computeUsageMetrics(
    tenantId: string,
    stockItemId: string,
    warehouseId: string,
    qtyAvailable?: number,
  ) {
    const since = new Date();
    since.setDate(since.getDate() - USAGE_WINDOW_DAYS);

    const lines = await this.prisma.stockMovementLine.findMany({
      where: {
        tenantId,
        stockItemId,
        movement: {
          warehouseId,
          status: 'validated',
          movementType: { in: CONSUMPTION_TYPES },
          movementDate: { gte: since },
        },
      },
      select: { qtyActual: true },
    });

    const totalOut = lines.reduce((s, l) => s + l.qtyActual, 0);
    const avgDaily = totalOut / USAGE_WINDOW_DAYS;

    let available = qtyAvailable;
    if (available == null) {
      const agg = await this.prisma.stockLevel.aggregate({
        where: { tenantId, stockItemId, warehouseId },
        _sum: { qtyAvailable: true },
      });
      available = agg._sum.qtyAvailable ?? 0;
    }

    // §3.3 — délai = stock_disponible ÷ vitesse ; exposé seulement si > 0
    const rawDays = avgDaily > 0 ? available / avgDaily : null;
    const daysToStockout =
      rawDays != null && rawDays > 0 ? rawDays : null;
    const suggestedQty =
      avgDaily > 0 ? Math.ceil(avgDaily * COVER_DAYS) : null;

    return { avgDaily, daysToStockout, suggestedQty };
  }
}
