/**
 * Smoke test offline sync v2: manifest, gzip pull, push étendu.
 */
import 'dotenv/config';
import { randomUUID } from 'crypto';
import { gunzipSync } from 'zlib';

const BASE = `http://localhost:${process.env.PORT ?? 3000}`;
const runId = Date.now();

async function api(method, path, { token, body, gzip } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(gzip ? { 'Accept-Encoding': 'gzip' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const buf = Buffer.from(await res.arrayBuffer());
  let data;
  if (res.headers.get('content-encoding') === 'gzip') {
    data = JSON.parse(gunzipSync(buf).toString('utf-8'));
  } else {
    data = JSON.parse(buf.toString('utf-8') || '{}');
  }

  if (!res.ok) {
    throw new Error(`${method} ${path} → ${res.status}: ${JSON.stringify(data)}`);
  }
  return { data, headers: res.headers };
}

async function main() {
  const email = `sync+${runId}@nexera.test`;
  const { data: auth } = await api('POST', '/auth/register', {
    body: {
      email,
      password: 'SyncTest1!',
      firstName: 'Sync',
      lastName: 'Test',
      tenantName: `Sync Tenant ${runId}`,
    },
  });
  const token = auth.access_token;

  console.log('[1] Manifest');
  const { data: manifest } = await api('GET', '/sync/manifest', { token });
  console.log(`  version=${manifest.version} entities=${manifest.pushEntities.length}`);

  console.log('[2] Bootstrap gzip');
  const { data: bootstrap, headers } = await api(
    'GET',
    '/sync/bootstrap?compress=true',
    { token, gzip: true },
  );
  console.log(
    `  encoding=${headers.get('content-encoding')} taxRates=${bootstrap.reference.taxRates.length}`,
  );

  const taxRateId = bootstrap.reference.taxRates[0]?.id;
  if (!taxRateId) throw new Error('No tax rate in bootstrap');

  const deviceId = `device-${runId}`;

  console.log('[3] Push client + catalogue');
  const { data: push } = await api('POST', '/sync/push', {
    token,
    body: {
      deviceId,
      deviceName: 'Smoke Device',
      batchId: randomUUID(),
      mutations: [
        {
          mutationId: randomUUID(),
          entityType: 'client',
          operation: 'create',
          localId: `local-client-${runId}`,
          payload: {
            clientType: 'company',
            companyName: `Offline Client ${runId}`,
            billingAddress: JSON.stringify({
              street: '2 rue Offline',
              city: 'Lyon',
              zip: '69001',
              country: 'FR',
            }),
            primaryContact: {
              firstName: 'Marie',
              lastName: 'Curie',
              email: `offline+${runId}@example.com`,
              isPrimary: true,
            },
          },
        },
        {
          mutationId: randomUUID(),
          entityType: 'catalog_category',
          operation: 'create',
          payload: {
            name: `Cat offline ${runId}`,
            code: `OFF-${runId}`,
          },
        },
      ],
    },
  });
  const clientResult = push.results.find((r) => r.entityType === 'client');
  const catResult = push.results.find((r) => r.entityType === 'catalog_category');
  console.log(`  client=${clientResult?.status} category=${catResult?.status}`);

  console.log('[4] Push quotation + order flow');
  const { data: flow } = await api('POST', '/sync/push', {
    token,
    body: {
      deviceId,
      batchId: randomUUID(),
      mutations: [
        {
          mutationId: randomUUID(),
          entityType: 'quotation',
          operation: 'create',
          payload: {
            clientId: clientResult.entityId,
            issueDate: new Date().toISOString().slice(0, 10),
            lines: [
              {
                description: 'Devis offline',
                quantity: 1,
                unitPriceHt: 500,
                taxRateId,
              },
            ],
          },
        },
      ],
    },
  });
  console.log(`  quotation=${flow.results[0]?.status}`);

  console.log('[5] Pull delta');
  const { data: pull } = await api(
    'GET',
    `/sync/pull?cursor=${encodeURIComponent(bootstrap.cursor)}&deviceId=${deviceId}&compress=true`,
    { token, gzip: true },
  );
  console.log(
    `  clients=${pull.changes.clients.length} categories=${pull.changes.catalogCategories.length}`,
  );

  console.log('\n✅ Offline sync v2 smoke OK');
}

main().catch((err) => {
  console.error('\n❌', err.message);
  process.exit(1);
});
