import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import {
  GlobalSearchResponse,
  SearchItemResult,
} from './dto/global-search.dto';

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  constructor(private readonly prisma: PrismaService) {}

  async globalSearch(
    tenantId: string,
    query?: string,
  ): Promise<GlobalSearchResponse> {
    const trimmed = (query || '').trim();

    if (!trimmed || trimmed.length < 2) {
      return {
        query: trimmed,
        totalMatches: 0,
        clients: [],
        quotations: [],
        invoices: [],
        orders: [],
        catalogItems: [],
        employes: [],
      };
    }

    const term = trimmed;

    // Exécution parallèle et résiliente des requêtes multi-domaines
    const [
      clientsRes,
      quotationsRes,
      invoicesRes,
      ordersRes,
      catalogRes,
      employesRes,
    ] = await Promise.allSettled([
      // 1. Clients
      this.prisma.client.findMany({
        where: {
          tenantId,
          deletedAt: null,
          OR: [
            { code: { contains: term, mode: 'insensitive' } },
            { companyName: { contains: term, mode: 'insensitive' } },
            { tradeName: { contains: term, mode: 'insensitive' } },
            { taxId: { contains: term, mode: 'insensitive' } },
            { siret: { contains: term, mode: 'insensitive' } },
            {
              contacts: {
                some: {
                  OR: [
                    { firstName: { contains: term, mode: 'insensitive' } },
                    { lastName: { contains: term, mode: 'insensitive' } },
                    { email: { contains: term, mode: 'insensitive' } },
                    { phone: { contains: term, mode: 'insensitive' } },
                  ],
                },
              },
            },
          ],
        },
        take: 6,
        select: {
          id: true,
          code: true,
          companyName: true,
          tradeName: true,
          taxId: true,
          isArchived: true,
          contacts: {
            where: { isPrimary: true },
            select: { firstName: true, lastName: true, email: true, phone: true },
            take: 1,
          },
        },
        orderBy: { createdAt: 'desc' },
      }),

      // 2. Devis
      this.prisma.quotation.findMany({
        where: {
          tenantId,
          OR: [
            { number: { contains: term, mode: 'insensitive' } },
            { notes: { contains: term, mode: 'insensitive' } },
            { client: { companyName: { contains: term, mode: 'insensitive' } } },
          ],
        },
        take: 6,
        select: {
          id: true,
          number: true,
          status: true,
          totalTtc: true,
          currency: true,
          issueDate: true,
          client: { select: { companyName: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),

      // 3. Factures
      this.prisma.invoice.findMany({
        where: {
          tenantId,
          OR: [
            { number: { contains: term, mode: 'insensitive' } },
            { client: { companyName: { contains: term, mode: 'insensitive' } } },
          ],
        },
        take: 6,
        select: {
          id: true,
          number: true,
          invoiceType: true,
          status: true,
          totalTtc: true,
          currency: true,
          issueDate: true,
          client: { select: { companyName: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),

      // 4. Commandes
      this.prisma.order.findMany({
        where: {
          tenantId,
          OR: [
            { number: { contains: term, mode: 'insensitive' } },
            { client: { companyName: { contains: term, mode: 'insensitive' } } },
          ],
        },
        take: 6,
        select: {
          id: true,
          number: true,
          status: true,
          totalTtc: true,
          currency: true,
          issueDate: true,
          client: { select: { companyName: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),

      // 5. Catalogue & Articles
      this.prisma.catalogItem.findMany({
        where: {
          tenantId,
          isArchived: false,
          OR: [
            { name: { contains: term, mode: 'insensitive' } },
            { reference: { contains: term, mode: 'insensitive' } },
            { description: { contains: term, mode: 'insensitive' } },
          ],
        },
        take: 6,
        select: {
          id: true,
          reference: true,
          name: true,
          itemType: true,
          priceHt: true,
          category: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),

      // 6. Salariés RH
      this.prisma.rhEmploye.findMany({
        where: {
          tenantId,
          isDeleted: false,
          OR: [
            { matricule: { contains: term, mode: 'insensitive' } },
            { nom: { contains: term, mode: 'insensitive' } },
            { prenoms: { contains: term, mode: 'insensitive' } },
            { emailProfessionnel: { contains: term, mode: 'insensitive' } },
            {
              affectations: {
                some: {
                  poste: { intitule: { contains: term, mode: 'insensitive' } },
                },
              },
            },
          ],
        },
        take: 6,
        select: {
          id: true,
          matricule: true,
          nom: true,
          prenoms: true,
          emailProfessionnel: true,
          statutEmploi: true,
          affectations: {
            where: { estActuelle: true },
            take: 1,
            select: {
              poste: { select: { intitule: true } },
              departement: { select: { libelle: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    // Formatage des clients
    const clients: SearchItemResult[] =
      clientsRes.status === 'fulfilled'
        ? clientsRes.value.map((c) => {
            const primaryContact = c.contacts?.[0];
            const contactInfo = primaryContact
              ? `${primaryContact.firstName} ${primaryContact.lastName} (${primaryContact.email || primaryContact.phone || ''})`
              : c.taxId ? `IFU: ${c.taxId}` : '';

            return {
              id: c.id,
              type: 'client',
              title: c.companyName || c.tradeName || c.code,
              subtitle: [c.code, contactInfo].filter(Boolean).join(' • '),
              code: c.code,
              badge: c.isArchived ? 'Archivé' : 'Actif',
              badgeVariant: c.isArchived ? 'neutral' : 'success',
              href: `/clients/${c.id}`,
            };
          })
        : [];

    // Formatage des devis
    const quotations: SearchItemResult[] =
      quotationsRes.status === 'fulfilled'
        ? quotationsRes.value.map((q) => {
            const amountFormatted = `${Math.round(q.totalTtc).toLocaleString('fr-FR')} ${q.currency || 'FCFA'}`;
            return {
              id: q.id,
              type: 'quotation',
              title: q.number,
              subtitle: `${q.client?.companyName || 'Client inconnu'} • ${amountFormatted}`,
              code: q.number,
              badge: q.status.toUpperCase(),
              badgeVariant:
                q.status === 'converted'
                  ? 'success'
                  : q.status === 'sent'
                  ? 'info'
                  : q.status === 'expired'
                  ? 'danger'
                  : 'neutral',
              meta: amountFormatted,
              href: `/devis/${q.id}`,
            };
          })
        : [];

    // Formatage des factures
    const invoices: SearchItemResult[] =
      invoicesRes.status === 'fulfilled'
        ? invoicesRes.value.map((inv) => {
            const isAvoir = inv.invoiceType === 'credit_note';
            const amountFormatted = `${Math.round(inv.totalTtc).toLocaleString('fr-FR')} ${inv.currency || 'FCFA'}`;
            return {
              id: inv.id,
              type: 'invoice',
              title: inv.number,
              subtitle: `${inv.client?.companyName || 'Client inconnu'} • ${amountFormatted}${isAvoir ? ' (Avoir)' : ''}`,
              code: inv.number,
              badge: isAvoir ? 'AVOIR' : inv.status.toUpperCase(),
              badgeVariant:
                inv.status === 'paid'
                  ? 'success'
                  : inv.status === 'overdue'
                  ? 'danger'
                  : inv.status === 'sent' || inv.status === 'partial'
                  ? 'warning'
                  : 'neutral',
              meta: amountFormatted,
              href: `/factures/${inv.id}`,
            };
          })
        : [];

    // Formatage des commandes
    const orders: SearchItemResult[] =
      ordersRes.status === 'fulfilled'
        ? ordersRes.value.map((ord) => {
            const amountFormatted = `${Math.round(ord.totalTtc).toLocaleString('fr-FR')} ${ord.currency || 'FCFA'}`;
            return {
              id: ord.id,
              type: 'order',
              title: ord.number,
              subtitle: `${ord.client?.companyName || 'Client inconnu'} • ${amountFormatted}`,
              code: ord.number,
              badge: ord.status.toUpperCase(),
              badgeVariant:
                ord.status === 'paid' || ord.status === 'confirmed'
                  ? 'success'
                  : ord.status === 'cancelled'
                  ? 'danger'
                  : 'neutral',
              meta: amountFormatted,
              href: `/commandes/${ord.id}`,
            };
          })
        : [];

    // Formatage des articles catalogue
    const catalogItems: SearchItemResult[] =
      catalogRes.status === 'fulfilled'
        ? catalogRes.value.map((cat) => {
            const priceFormatted = `${Math.round(cat.priceHt).toLocaleString('fr-FR')} FCFA HT`;
            return {
              id: cat.id,
              type: 'catalog',
              title: cat.name,
              subtitle: `${cat.reference} • ${cat.category?.name || 'Général'} • ${priceFormatted}`,
              code: cat.reference,
              badge: cat.itemType === 'service' ? 'Service' : 'Produit',
              badgeVariant: 'info',
              meta: priceFormatted,
              href: `/catalogue/${cat.id}`,
            };
          })
        : [];

    // Formatage des employés RH
    const employes: SearchItemResult[] =
      employesRes.status === 'fulfilled'
        ? employesRes.value.map((emp) => {
            const fullName = `${emp.prenoms} ${emp.nom}`.trim();
            const affectation = emp.affectations?.[0];
            const jobInfo = [affectation?.poste?.intitule, affectation?.departement?.libelle].filter(Boolean).join(' - ');
            return {
              id: emp.id,
              type: 'employe',
              title: fullName,
              subtitle: `${emp.matricule} • ${jobInfo || emp.emailProfessionnel || 'Salarié'}`,
              code: emp.matricule,
              badge: emp.statutEmploi || 'Actif',
              badgeVariant: 'success',
              href: `/rh/employes`,
            };
          })
        : [];

    const totalMatches =
      clients.length +
      quotations.length +
      invoices.length +
      orders.length +
      catalogItems.length +
      employes.length;

    return {
      query: term,
      totalMatches,
      clients,
      quotations,
      invoices,
      orders,
      catalogItems,
      employes,
    };
  }
}
