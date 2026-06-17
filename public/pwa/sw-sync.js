/**
 * Nexera — Service Worker offline (Background Sync + cache bootstrap).
 * Enregistrement côté app : navigator.serviceWorker.register('/pwa/sw-sync.js')
 */
const CACHE = 'nexera-sync-v2';
const SYNC_TAG = 'nexera-sync-push';

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

/** File d'attente locale (IndexedDB) — clé par convention côté app */
async function readPendingPushBatch() {
  // L'app front doit implémenter openDB() et stocker sous 'pendingPush'
  if (typeof self.nexeraReadPendingPush === 'function') {
    return self.nexeraReadPendingPush();
  }
  return null;
}

async function clearPendingPush(batchId) {
  if (typeof self.nexeraClearPendingPush === 'function') {
    await self.nexeraClearPendingPush(batchId);
  }
}

self.addEventListener('sync', (event) => {
  if (event.tag !== SYNC_TAG) return;

  event.waitUntil(
    (async () => {
      const batch = await readPendingPushBatch();
      if (!batch?.body || !batch?.accessToken) return;

      const res = await fetch('/sync/push/background', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${batch.accessToken}`,
          'X-Sync-Background': '1',
        },
        body: JSON.stringify(batch.body),
      });

      if (!res.ok) {
        throw new Error(`Background push failed: ${res.status}`);
      }

      await clearPendingPush(batch.body.batchId);
    })(),
  );
});

/** Prefetch bootstrap gzip quand l'app signale une sync planifiée */
self.addEventListener('message', (event) => {
  if (event.data?.type === 'NEXERA_SCHEDULE_PULL') {
    const { accessToken, cursor, compress = true } = event.data;
    event.waitUntil(
      fetch(
        `/sync/pull?cursor=${encodeURIComponent(cursor ?? '')}&compress=${compress ? 'true' : 'false'}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Accept-Encoding': 'gzip',
          },
        },
      ).then(async (res) => {
        if (!res.ok) throw new Error('pull failed');
        const cache = await caches.open(CACHE);
        await cache.put('nexera:lastPull', res.clone());
      }),
    );
  }

  if (event.data?.type === 'NEXERA_REGISTER_SYNC') {
    event.waitUntil(self.registration.sync.register(SYNC_TAG));
  }
});
