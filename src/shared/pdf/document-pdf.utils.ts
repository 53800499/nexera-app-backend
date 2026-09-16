export const PDF_PAGE = {
  margin: 44,
  width: 595.28,
  height: 841.89,
} as const;

export const PDF_COLORS = {
  text: '#1e293b',
  textMuted: '#64748b',
  border: '#e2e8f0',
  surface: '#f8fafc',
  surfaceAlt: '#f1f5f9',
  white: '#ffffff',
} as const;

export function formatDateFr(d: Date): string {
  return d.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

export function formatDateTimeFr(d: Date): string {
  const dateStr = d.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const timeStr = d.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  return `${dateStr} ${timeStr}`;
}

export function formatMoney(amount: number, currency: string): string {
  const code = currency?.trim().length === 3 ? currency.toUpperCase() : 'EUR';
  try {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: code,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

export function formatQuantity(qty: number): string {
  return Number.isInteger(qty) ? String(qty) : qty.toFixed(2);
}

export function normalizeHex(color: string, fallback = '#2563eb'): string {
  if (!color?.startsWith('#') || color.length < 4) return fallback;
  return color.length === 4
    ? `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`
    : color.slice(0, 7);
}

export function lightenHex(hex: string, mix = 0.92): string {
  const c = normalizeHex(hex);
  const r = parseInt(c.slice(1, 3), 16);
  const g = parseInt(c.slice(3, 5), 16);
  const b = parseInt(c.slice(5, 7), 16);
  const blend = (channel: number) =>
    Math.round(channel + (255 - channel) * mix)
      .toString(16)
      .padStart(2, '0');
  return `#${blend(r)}${blend(g)}${blend(b)}`;
}

export function resolveBoldFont(font: string): string {
  if (font.includes('Bold')) return font;
  if (font.startsWith('Helvetica')) return 'Helvetica-Bold';
  if (font.startsWith('Times')) return 'Times-Bold';
  if (font.startsWith('Courier')) return 'Courier-Bold';
  return 'Helvetica-Bold';
}
