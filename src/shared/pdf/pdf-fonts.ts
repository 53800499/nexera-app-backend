/** Polices supportées par pdfkit (§5.2). */
export const ALLOWED_PDF_FONTS = [
  'Helvetica',
  'Helvetica-Bold',
  'Times-Roman',
  'Times-Bold',
  'Courier',
  'Courier-Bold',
] as const;

export type PdfFontFamily = (typeof ALLOWED_PDF_FONTS)[number];

export function resolvePdfFont(requested?: string | null): PdfFontFamily {
  if (!requested) return 'Helvetica';
  const match = ALLOWED_PDF_FONTS.find(
    (f) => f.toLowerCase() === requested.toLowerCase(),
  );
  return match ?? 'Helvetica';
}
