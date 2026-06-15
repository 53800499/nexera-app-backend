import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { InvoiceStatus } from '../../invoices/enums/invoice-status.enum';

@Injectable()
export class PaymentBehaviorAnalysisService {
  constructor(private readonly prisma: PrismaService) {}

  async analyze(clientId: string, tenantId: string) {
    const paidInvoices = await this.prisma.invoice.findMany({
      where: {
        tenantId,
        clientId,
        status: InvoiceStatus.PAID,
        paidAt: { not: null },
        dueDate: { not: null },
      },
      select: {
        dueDate: true,
        paidAt: true,
      },
      orderBy: { paidAt: 'desc' },
      take: 50,
    });

    if (!paidInvoices.length) {
      return {
        avgDaysToPay: 0,
        onTimePaymentRate: 0,
        paidInvoicesAnalyzed: 0,
        suggestions: [
          'Historique de paiement insuffisant pour une analyse fiable.',
        ],
      };
    }

    const delays = paidInvoices.map((inv) => {
      const due = inv.dueDate!.getTime();
      const paid = inv.paidAt!.getTime();
      return Math.floor((paid - due) / (1000 * 60 * 60 * 24));
    });

    const avgDaysToPay =
      Math.round((delays.reduce((s, d) => s + d, 0) / delays.length) * 10) /
      10;
    const onTimeCount = delays.filter((d) => d <= 0).length;
    const onTimePaymentRate =
      Math.round((onTimeCount / delays.length) * 100) / 100;

    const suggestions: string[] = [];

    if (avgDaysToPay > 10) {
      suggestions.push(
        `Délai moyen de paiement élevé (+${avgDaysToPay} j) — envisager niveau 1 à J+7 au lieu de J+3`,
      );
    } else if (avgDaysToPay < -2) {
      suggestions.push(
        'Client ponctuel — les délais de relance actuels peuvent rester courts',
      );
    }

    if (onTimePaymentRate < 0.5) {
      suggestions.push(
        'Taux de paiement à l\'échéance faible — renforcer la relance niveau 2',
      );
    }

    if (!suggestions.length) {
      suggestions.push('Comportement de paiement dans la norme — délais actuels adaptés');
    }

    const suggestedDelays = {
      level1DaysAfterDue: avgDaysToPay > 10 ? 7 : 3,
      level2DaysAfterDue: avgDaysToPay > 15 ? 20 : 15,
      level3DaysAfterDue: avgDaysToPay > 20 ? 40 : 30,
    };

    return {
      avgDaysToPay,
      onTimePaymentRate,
      paidInvoicesAnalyzed: paidInvoices.length,
      suggestions,
      suggestedDelays,
    };
  }
}
