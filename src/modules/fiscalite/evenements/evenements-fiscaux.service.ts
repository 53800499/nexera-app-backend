import { Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { IntegrationEventBus } from '../../../shared/events/integration-event.bus';

@Injectable()
export class EvenementsFiscauxService implements OnModuleInit {
  private readonly logger = new Logger(EvenementsFiscauxService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly integrationBus?: IntegrationEventBus,
  ) {}

  onModuleInit() {
    if (this.integrationBus) {
      // Flux 1 : Ventes & Facturation (M2 Gestion Commerciale)
      this.integrationBus.subscribe('invoice.issued', async (event: any) => {
        try {
          await this.onInvoiceIssued(event);
        } catch (err: any) {
          this.logger.error(`Erreur traitement fiscal facture M2 : ${err.message}`);
        }
      });

      // Flux 2 : Clôture de Paie & Obligations Sociales/Fiscales (M4 RH & Paie)
      this.integrationBus.subscribe('payroll.cycle.validated', async (event: any) => {
        try {
          await this.onPayrollCycleValidated(event);
        } catch (err: any) {
          this.logger.error(`Erreur consolidation paie M4 dans calendrier fiscal : ${err.message}`);
        }
      });

      // Flux 3 : Notes de Frais Approuvées & TVA Récupérable (M5 Notes de Frais)
      this.integrationBus.subscribe('expense_report.approved', async (event: any) => {
        try {
          await this.onExpenseReportApproved(event);
        } catch (err: any) {
          this.logger.error(`Erreur traitement fiscal note de frais M5 : ${err.message}`);
        }
      });

      this.logger.log('EvenementsFiscauxService connecté au bus (invoice.issued, payroll.cycle.validated, expense_report.approved).');
    }
  }

  /**
   * 1. Traitement Vente / Facture M2 : enregistrement événement + injection dans déclaration TVA
   */
  private async onInvoiceIssued(event: any) {
    const { tenantId, payload } = event;
    const invoiceId = payload?.invoiceId;
    if (!invoiceId) return;

    const invoice = await (this.prisma as any).invoice.findUnique({
      where: { id: invoiceId },
    });
    if (!invoice) return;

    let contribuable = await (this.prisma as any).taxContribuable.findFirst({
      where: { tenantId },
    });
    if (!contribuable) {
      contribuable = await (this.prisma as any).taxContribuable.findFirst();
    }
    if (!contribuable) return;

    const dateEvt = invoice.issueDate ? new Date(invoice.issueDate) : new Date();

    const evt = await this.capturerEvenement({
      moduleSource: 'M2_GESTION_COMMERCIALE',
      typeEvenement: 'VENTE_VALIDEE',
      referenceObjetSource: invoiceId,
      taxContribuableId: contribuable.id,
      dateEvenement: dateEvt,
      montantHt: invoice.totalHt || 0,
      montantTaxe: invoice.totalTax || 0,
      natureFiscale: (invoice.totalTax || 0) > 0 ? 'VENTE_TAXABLE' : 'VENTE_EXONEREE',
    });

    // Injection automatique dans la déclaration de TVA de la période
    await this.integrerFactureDansTva(contribuable.id, invoice, evt.id);

    this.logger.log(
      `[Fiscalité M7] Facture ${invoice.number} intégrée dans la TVA du contribuable (HT: ${invoice.totalHt} FCFA, Taxe: ${invoice.totalTax} FCFA)`,
    );
  }

  /**
   * 2. Traitement Clôture Paie M4 : consolidation obligations ITS/VPS/CNSS dans TaxObligationPaieRecue et TaxEcheance
   */
  private async onPayrollCycleValidated(event: any) {
    const { tenantId, payload } = event;
    const { cyclePaieId, annee, mois, totalIts, totalVps, totalCnss } = payload || {};

    let contribuable = await (this.prisma as any).taxContribuable.findFirst({
      where: { tenantId },
    });
    if (!contribuable) {
      contribuable = await (this.prisma as any).taxContribuable.findFirst();
    }
    if (!contribuable) return;

    const periode = `${annee}-${String(mois).padStart(2, '0')}`;
    const totalFiscalPaie = (totalIts || 0) + (totalVps || 0);

    // Enregistrer l'événement source M4
    await this.capturerEvenement({
      moduleSource: 'M4_RH_PAIE',
      typeEvenement: 'PAIE_CYCLE_VALIDE',
      referenceObjetSource: cyclePaieId || `CYCLE-${periode}`,
      taxContribuableId: contribuable.id,
      dateEvenement: new Date(),
      montantHt: totalFiscalPaie,
      montantTaxe: totalIts || 0,
      natureFiscale: 'ITS_VPS_BENIN',
    });

    // Date limite légale : au Bénin (CGI Art. 128), au plus tard le 10 du mois M+1
    const nextMonth = Number(mois) === 12 ? 1 : Number(mois) + 1;
    const nextYear = Number(mois) === 12 ? Number(annee) + 1 : Number(annee);
    const dateLimiteLegale = new Date(
      `${nextYear}-${String(nextMonth).padStart(2, '0')}-10T00:00:00.000Z`,
    );

    // Enregistrer dans TaxObligationPaieRecue (EF-040)
    const obligation = await (this.prisma as any).taxObligationPaieRecue.create({
      data: {
        taxContribuableId: contribuable.id,
        referenceObjetM4: cyclePaieId || `CYCLE-${periode}`,
        typeObligation: 'ITS_VPS_CNSS_BENIN',
        periode,
        montant: totalFiscalPaie,
        dateLimiteLegale,
        statut: 'CONSOLIDEE_CALENDRIER',
      },
    });

    // Trouver le type d'impôt correspondant pour lier au calendrier
    let taxType = await (this.prisma as any).taxType.findFirst({
      where: {
        paysCode: contribuable.paysCode || 'BJ',
        code: { in: ['ITS', 'VPS', 'SALAIRES', 'ITS_VPS'] },
      },
    });

    if (!taxType) {
      taxType = await (this.prisma as any).taxType.findFirst({
        where: { paysCode: contribuable.paysCode || 'BJ' },
      });
    }

    if (taxType) {
      const existingEcheance = await (this.prisma as any).taxEcheance.findFirst({
        where: {
          taxContribuableId: contribuable.id,
          taxTypeId: taxType.id,
          dateLimite: dateLimiteLegale,
        },
      });

      if (!existingEcheance) {
        await (this.prisma as any).taxEcheance.create({
          data: {
            taxContribuableId: contribuable.id,
            taxTypeId: taxType.id,
            objetLieType: 'tax_obligation_paie_recue',
            objetLieId: obligation.id,
            dateLimite: dateLimiteLegale,
            montantEstime: totalFiscalPaie,
            statut: 'A_VENIR',
          },
        });
      }
    }

    this.logger.log(
      `[Fiscalité M7] Obligations salariales consolidées pour la période ${periode} : ITS (${totalIts} FCFA) + VPS (${totalVps} FCFA). Échéance créée au 10/${String(nextMonth).padStart(2, '0')}/${nextYear}.`,
    );
  }

  /**
   * 3. Traitement Notes de Frais M5 : extraction TVA déductible et alimentation déclaration TVA
   */
  private async onExpenseReportApproved(event: any) {
    const { tenantId, payload } = event;
    const { rapportFraisId, numeroRapport, depenses } = payload || {};
    if (!depenses || !Array.isArray(depenses)) return;

    let contribuable = await (this.prisma as any).taxContribuable.findFirst({
      where: { tenantId },
    });
    if (!contribuable) {
      contribuable = await (this.prisma as any).taxContribuable.findFirst();
    }
    if (!contribuable) return;

    for (const dep of depenses) {
      if (dep.montantTva && dep.montantTva > 0) {
        const dateDepense = dep.dateDepense ? new Date(dep.dateDepense) : new Date();
        const year = dateDepense.getFullYear();
        const month = String(dateDepense.getMonth() + 1).padStart(2, '0');
        const periode = `${year}-${month}`;

        const evt = await this.capturerEvenement({
          moduleSource: 'M5_NOTES_FRAIS',
          typeEvenement: 'NOTE_FRAIS_APPROUVEE',
          referenceObjetSource: dep.id || rapportFraisId,
          taxContribuableId: contribuable.id,
          dateEvenement: dateDepense,
          montantHt: dep.montantHt || 0,
          montantTaxe: dep.montantTva || 0,
          natureFiscale: 'NOTE_FRAIS_DEDUCTIBLE',
        });

        // Déclaration TVA du mois
        const nextMonth = dateDepense.getMonth() + 1 === 12 ? 1 : dateDepense.getMonth() + 2;
        const nextYear = dateDepense.getMonth() + 1 === 12 ? year + 1 : year;
        const dateLimiteLegale = new Date(
          `${nextYear}-${String(nextMonth).padStart(2, '0')}-20T00:00:00.000Z`,
        );

        let declaration = await (this.prisma as any).taxDeclarationTva.findUnique({
          where: {
            taxContribuableId_periode: {
              taxContribuableId: contribuable.id,
              periode,
            },
          },
        });

        if (!declaration) {
          declaration = await (this.prisma as any).taxDeclarationTva.create({
            data: {
              taxContribuableId: contribuable.id,
              periode,
              dateLimiteLegale,
              creditTvaAnterieur: 0,
              tvaCollectee: 0,
              tvaDeductible: 0,
              tvaNetteDue: 0,
              statut: 'BROUILLON',
            },
          });
        }

        await (this.prisma as any).taxDeclarationTvaLigne.create({
          data: {
            taxDeclarationTvaId: declaration.id,
            nature: 'NOTE_FRAIS_DEDUCTIBLE',
            tauxApplique: dep.montantHt ? Math.round((dep.montantTva / dep.montantHt) * 100) : 18,
            baseHorsTaxe: dep.montantHt || 0,
            montantTva: dep.montantTva || 0,
            evenementSourceId: evt.id,
          },
        });

        await this.recalculerDeclarationTva(declaration.id);

        await (this.prisma as any).taxEvenementSource.update({
          where: { id: evt.id },
          data: { statutTraitement: 'INTEGRE_DECLARATION' },
        });

        this.logger.log(
          `[Fiscalité M7] TVA déductible sur note de frais ${numeroRapport} intégrée : ${dep.montantTva} FCFA`,
        );
      }
    }
  }

  /**
   * Intégration unitaire d'une facture de vente M2 dans la déclaration de TVA
   */
  private async integrerFactureDansTva(
    taxContribuableId: string,
    invoice: any,
    evenementSourceId: string,
  ) {
    const issueDate = invoice.issueDate ? new Date(invoice.issueDate) : new Date();
    const year = issueDate.getFullYear();
    const month = String(issueDate.getMonth() + 1).padStart(2, '0');
    const periode = `${year}-${month}`;

    const nextMonth = issueDate.getMonth() + 1 === 12 ? 1 : issueDate.getMonth() + 2;
    const nextYear = issueDate.getMonth() + 1 === 12 ? year + 1 : year;
    const dateLimiteLegale = new Date(
      `${nextYear}-${String(nextMonth).padStart(2, '0')}-20T00:00:00.000Z`,
    );

    let declaration = await (this.prisma as any).taxDeclarationTva.findUnique({
      where: {
        taxContribuableId_periode: {
          taxContribuableId,
          periode,
        },
      },
    });

    if (!declaration) {
      declaration = await (this.prisma as any).taxDeclarationTva.create({
        data: {
          taxContribuableId,
          periode,
          dateLimiteLegale,
          creditTvaAnterieur: 0,
          tvaCollectee: 0,
          tvaDeductible: 0,
          tvaNetteDue: 0,
          statut: 'BROUILLON',
        },
      });
    }

    const existingLine = await (this.prisma as any).taxDeclarationTvaLigne.findFirst({
      where: {
        taxDeclarationTvaId: declaration.id,
        evenementSourceId,
      },
    });

    if (!existingLine) {
      await (this.prisma as any).taxDeclarationTvaLigne.create({
        data: {
          taxDeclarationTvaId: declaration.id,
          nature: (invoice.totalTax || 0) > 0 ? 'VENTE_TAXABLE' : 'VENTE_EXONEREE',
          tauxApplique: invoice.totalHt && invoice.totalTax ? Math.round((invoice.totalTax / invoice.totalHt) * 100) : 18,
          baseHorsTaxe: invoice.totalHt || 0,
          montantTva: invoice.totalTax || 0,
          evenementSourceId,
        },
      });

      await this.recalculerDeclarationTva(declaration.id);

      await (this.prisma as any).taxEvenementSource.update({
        where: { id: evenementSourceId },
        data: { statutTraitement: 'INTEGRE_DECLARATION' },
      });
    }
  }

  /**
   * Recalcul automatique des totaux de la déclaration de TVA
   */
  private async recalculerDeclarationTva(declarationId: string) {
    const dec = await (this.prisma as any).taxDeclarationTva.findUnique({
      where: { id: declarationId },
      include: { lignes: true },
    });
    if (!dec) return;

    let tvaCollectee = 0;
    let tvaDeductible = 0;

    for (const ligne of dec.lignes || []) {
      if (ligne.nature === 'VENTE_TAXABLE') {
        tvaCollectee += ligne.montantTva;
      } else if (
        ligne.nature === 'ACHAT_DEDUCTIBLE' ||
        ligne.nature === 'NOTE_FRAIS_DEDUCTIBLE' ||
        ligne.nature === 'IMPORTATION'
      ) {
        tvaDeductible += ligne.montantTva;
      }
    }

    const tvaNetteDue = tvaCollectee - tvaDeductible - (dec.creditTvaAnterieur || 0);

    await (this.prisma as any).taxDeclarationTva.update({
      where: { id: declarationId },
      data: {
        tvaCollectee,
        tvaDeductible,
        tvaNetteDue,
      },
    });
  }

  /**
   * Capture d'un événement opérationnel porteur d'impact fiscal (M2, M4 ou M5)
   */
  async capturerEvenement(data: {
    moduleSource: 'M2_GESTION_COMMERCIALE' | 'M4_RH_PAIE' | 'M5_NOTES_FRAIS';
    typeEvenement: string;
    referenceObjetSource: string;
    taxContribuableId: string;
    dateEvenement: Date;
    montantHt?: number;
    montantTaxe?: number;
    natureFiscale?: string;
  }) {
    return (this.prisma as any).taxEvenementSource.create({
      data: {
        moduleSource: data.moduleSource,
        typeEvenement: data.typeEvenement,
        referenceObjetSource: data.referenceObjetSource,
        taxContribuableId: data.taxContribuableId,
        dateEvenement: data.dateEvenement,
        montantHt: data.montantHt,
        montantTaxe: data.montantTaxe,
        natureFiscale: data.natureFiscale,
        statutTraitement: 'RECU',
      },
    });
  }

  async getEvenementsRecents(taxContribuableId: string, limit = 50) {
    return (this.prisma as any).taxEvenementSource.findMany({
      where: { taxContribuableId },
      orderBy: { dateEvenement: 'desc' },
      take: limit,
    });
  }
}
