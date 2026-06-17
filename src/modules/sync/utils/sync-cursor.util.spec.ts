import {
  buildNextCursor,
  decodeSyncCursor,
  encodeSyncCursor,
} from './sync-cursor.util';

describe('sync-cursor.util', () => {
  it('encodes and decodes a cursor', () => {
    const raw = encodeSyncCursor({
      v: 1,
      at: '2026-06-15T10:00:00.000Z',
      id: 'abc',
    });

    expect(decodeSyncCursor(raw)).toEqual({
      v: 1,
      at: '2026-06-15T10:00:00.000Z',
      id: 'abc',
    });
  });

  it('returns null for invalid cursor', () => {
    expect(decodeSyncCursor('not-valid')).toBeNull();
    expect(decodeSyncCursor('')).toBeNull();
  });

  it('builds next cursor from last item', () => {
    const next = buildNextCursor(
      [{ updatedAt: new Date('2026-06-15T12:00:00.000Z'), id: 'z' }],
      { v: 1, at: '2026-06-15T10:00:00.000Z' },
    );

    expect(decodeSyncCursor(next)?.at).toBe('2026-06-15T12:00:00.000Z');
    expect(decodeSyncCursor(next)?.id).toBe('z');
  });
});
