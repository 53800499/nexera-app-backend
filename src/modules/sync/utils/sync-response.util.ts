import { gzipSync } from 'zlib';
import type { Response } from 'express';

export function shouldCompressSyncPayload(
  compressQuery?: boolean | string,
  acceptEncoding?: string,
): boolean {
  if (compressQuery === true || compressQuery === 'true' || compressQuery === '1') {
    return true;
  }
  return (acceptEncoding ?? '').toLowerCase().includes('gzip');
}

export function gzipJsonPayload(payload: unknown): Buffer {
  return gzipSync(JSON.stringify(payload), { level: 6 });
}

/** Envoie JSON brut ou gzip selon la requête (delta offline). */
export function sendSyncPayload(
  res: Response,
  payload: unknown,
  options?: { compress?: boolean | string; acceptEncoding?: string },
): void {
  const useGzip = shouldCompressSyncPayload(
    options?.compress,
    options?.acceptEncoding,
  );

  if (useGzip) {
    const body = gzipJsonPayload(payload);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Encoding', 'gzip');
    res.setHeader('Vary', 'Accept-Encoding');
    res.setHeader('X-Sync-Compressed', 'gzip');
    res.send(body);
    return;
  }

  res.setHeader('X-Sync-Compressed', 'none');
  res.json(payload);
}
