import { formatDateFr, formatMoney } from './document-pdf.utils';

export interface DocumentPreviewSummary {
  documentType: 'quotation' | 'invoice';
  documentLabel: string;
  number: string;
  status: string;
  statusLabel: string;
  issueDate: Date;
  issueDateLabel: string;
  dueDate?: Date | null;
  dueDateLabel?: string | null;
  currency: string;
  totalTtc: number;
  totalTtcLabel: string;
  clientName: string;
  lineCount: number;
}

export interface DocumentPreviewResponse {
  previewReady: true;
  pdfUrl: string;
  summary: DocumentPreviewSummary;
}

const QUOTATION_STATUS_LABELS: Record<string, string> = {
  draft: 'Brouillon',
  sent: 'Envoyé',
  viewed: 'Consulté',
  accepted: 'Accepté',
  declined: 'Refusé',
  expired: 'Expiré',
  converted: 'Converti',
};

const INVOICE_STATUS_LABELS: Record<string, string> = {
  draft: 'Brouillon',
  issued: 'Émise',
  sent: 'Envoyée',
  partially_paid: 'Partiellement payée',
  paid: 'Payée',
  overdue: 'En retard',
  cancelled: 'Annulée',
};

function resolveStatusLabel(
  documentType: 'quotation' | 'invoice',
  status: string,
): string {
  const map =
    documentType === 'quotation'
      ? QUOTATION_STATUS_LABELS
      : INVOICE_STATUS_LABELS;
  return map[status] ?? status;
}

export function buildDocumentPreviewResponse(
  summary: Omit<
    DocumentPreviewSummary,
    'statusLabel' | 'issueDateLabel' | 'dueDateLabel' | 'totalTtcLabel'
  >,
  pdfUrl: string,
): DocumentPreviewResponse {
  return {
    previewReady: true,
    pdfUrl,
    summary: {
      ...summary,
      statusLabel: resolveStatusLabel(summary.documentType, summary.status),
      issueDateLabel: formatDateFr(summary.issueDate),
      dueDateLabel: summary.dueDate ? formatDateFr(summary.dueDate) : null,
      totalTtcLabel: formatMoney(summary.totalTtc, summary.currency),
    },
  };
}
