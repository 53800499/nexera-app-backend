import { randomBytes } from 'crypto';

/** Sans caractères ambigus (0/O, 1/I/L). */
const CHARSET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export const CABINET_INVITE_CODE_PATTERN = /^NEXR-[A-Z2-9]{4}-[A-Z2-9]{4}$/;

export function normalizeCabinetInviteCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, '');
}

export function generateCabinetInviteCode(): string {
  const segment = () => {
    let value = '';
    const bytes = randomBytes(4);
    for (let i = 0; i < 4; i += 1) {
      value += CHARSET[bytes[i] % CHARSET.length];
    }
    return value;
  };

  return `NEXR-${segment()}-${segment()}`;
}
