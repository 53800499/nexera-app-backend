export interface SyncCursorPayload {
  v: 1;
  /** ISO-8601 watermark (updatedAt) */
  at: string;
  /** Tie-breaker when plusieurs entités partagent le même updatedAt */
  id?: string;
}

const CURSOR_VERSION = 1 as const;

export function encodeSyncCursor(payload: SyncCursorPayload): string {
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

export function decodeSyncCursor(raw?: string | null): SyncCursorPayload | null {
  if (!raw?.trim()) return null;

  try {
    const parsed = JSON.parse(
      Buffer.from(raw, 'base64url').toString('utf-8'),
    ) as SyncCursorPayload;

    if (parsed.v !== CURSOR_VERSION || !parsed.at) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function buildNextCursor(
  items: Array<{ updatedAt: Date | string; id: string }>,
  previous?: SyncCursorPayload | null,
): string {
  if (items.length === 0) {
    return encodeSyncCursor(
      previous ?? { v: CURSOR_VERSION, at: new Date(0).toISOString() },
    );
  }

  const last = items[items.length - 1];
  return encodeSyncCursor({
    v: CURSOR_VERSION,
    at: new Date(last.updatedAt).toISOString(),
    id: last.id,
  });
}

/** Filtre Prisma pour pagination cursor-based sur (updatedAt, id). */
export function buildUpdatedAtCursorWhere(
  cursor: SyncCursorPayload | null,
): { OR: Array<Record<string, unknown>> } | undefined {
  if (!cursor) return undefined;

  const at = new Date(cursor.at);
  const clauses: Array<Record<string, unknown>> = [{ updatedAt: { gt: at } }];

  if (cursor.id) {
    clauses.push({ updatedAt: at, id: { gt: cursor.id } });
  }

  return { OR: clauses };
}
