import {
  shouldCompressSyncPayload,
  gzipJsonPayload,
} from './sync-response.util';

describe('sync-response.util', () => {
  it('detects gzip from query flag', () => {
    expect(shouldCompressSyncPayload(true, undefined)).toBe(true);
    expect(shouldCompressSyncPayload('true', undefined)).toBe(true);
  });

  it('detects gzip from Accept-Encoding', () => {
    expect(shouldCompressSyncPayload(false, 'gzip, deflate')).toBe(true);
  });

  it('compresses json payload', () => {
    const buf = gzipJsonPayload({ ok: true, items: [1, 2, 3] });
    expect(buf.length).toBeGreaterThan(0);
  });
});
