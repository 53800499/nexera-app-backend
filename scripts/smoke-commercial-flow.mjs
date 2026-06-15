/**
 * Parcours commercial : devis → BC → facture → paiement (+ health + audit).
 * Usage : node scripts/smoke-commercial-flow.mjs
 * Prérequis : API sur PORT (défaut 3000), DATABASE_URL configurée.
 */
import 'dotenv/config';

const BASE = `http://localhost:${process.env.PORT ?? 3000}`;
const runId = Date.now();

function log(step, detail) {
  console.log(`\n[${step}] ${detail}`);
}

async function api(method, path, { token, body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    const msg =
      typeof data === 'object' && data?.message
        ? Array.isArray(data.message)
          ? data.message.join(', ')
          : data.message
        : text;
    throw new Error(`${method} ${path} → ${res.status}: ${msg}`);
  }

  return data;
}

async function main() {
  log('0', `Health check (${BASE}/health)`);
  const health = await api('GET', '/health');
  console.log(health);

  const email = `smoke+${runId}@nexera.test`;
  const password = 'SmokeTest1!';

  log('1', `Register ${email}`);
  const auth = await api('POST', '/auth/register', {
    body: {
      email,
      password,
      firstName: 'Smoke',
      lastName: 'Test',
      tenantName: `Smoke Tenant ${runId}`,
    },
  });
  const token = auth.access_token;
  if (!token) throw new Error('No access_token in auth response');

  log('2', 'Tax rates');
  const taxRates = await api('GET', '/settings/tax-rates', { token });
  const taxRateId = taxRates[0]?.id;
  if (!taxRateId) throw new Error('No tax rate found — check settings bootstrap');

  log('3', 'Create client');
  const client = await api('POST', '/clients', {
    token,
    body: {
      clientType: 'company',
      companyName: `Smoke Client ${runId}`,
      billingAddress: JSON.stringify({
        street: '1 rue du Test',
        city: 'Paris',
        zip: '75001',
        country: 'FR',
      }),
      primaryContact: {
        firstName: 'Jean',
        lastName: 'Dupont',
        email: `client+${runId}@example.com`,
        phone: '+33600000000',
        isPrimary: true,
      },
    },
  });

  const today = new Date().toISOString().slice(0, 10);

  log('4', 'Create quotation');
  const quotation = await api('POST', '/quotations', {
    token,
    body: {
      clientId: client.id,
      issueDate: today,
      lines: [
        {
          description: 'Prestation smoke test',
          quantity: 1,
          unitPriceHt: 1000,
          taxRateId,
        },
      ],
    },
  });
  console.log(`  → ${quotation.number} (${quotation.status}) TTC=${quotation.totalTtc}`);

  log('5', 'Send quotation');
  await api('POST', `/quotations/${quotation.id}/send`, {
    token,
    body: { recipientEmail: `client+${runId}@example.com` },
  });

  log('6', 'Accept quotation');
  await api('PATCH', `/quotations/${quotation.id}/status`, {
    token,
    body: { status: 'accepted' },
  });

  log('7', 'Convert to order');
  const convertResult = await api('POST', `/quotations/${quotation.id}/convert`, {
    token,
    body: { target: 'order' },
  });
  const orderId = convertResult.targetId ?? convertResult.document?.id;
  if (!orderId) throw new Error('Order id missing from convert response');
  console.log(`  → order ${orderId}`);

  log('8', 'Confirm order');
  const order = await api('POST', `/orders/${orderId}/confirm`, { token });
  console.log(`  → ${order.number} (${order.status})`);

  log('9', 'Create invoice from order');
  const invoice = await api('POST', `/orders/${orderId}/invoices`, { token, body: {} });
  const invoiceId = invoice.invoice?.id ?? invoice.id;
  console.log(`  → invoice ${invoiceId}`);

  log('10', 'Issue invoice');
  const issued = await api('POST', `/invoices/${invoiceId}/issue`, { token });
  console.log(`  → ${issued.number} (${issued.status}) due=${issued.amountDue}`);

  log('11', 'Record payment');
  const payment = await api('POST', '/payments', {
    token,
    body: {
      clientId: client.id,
      amount: issued.amountDue ?? issued.totalTtc,
      paymentMethod: 'wire',
      allocationMode: 'fifo',
      reference: `SMOKE-${runId}`,
    },
  });
  console.log(`  → payment ${payment.id} allocated=${payment.allocatedAmount}`);

  log('12', 'Audit trail');
  const audit = await api('GET', `/audit/invoice/${invoiceId}`, { token });
  console.log(`  → ${audit.total} entrée(s) d'audit`);

  log('13', 'Order billing summary');
  const orderFinal = await api('GET', `/orders/${orderId}`, { token });
  console.log(
    `  → BC status=${orderFinal.status} billing=${JSON.stringify(orderFinal.billing ?? {})}`,
  );

  console.log('\n✅ Parcours commercial terminé avec succès.');
}

main().catch((err) => {
  console.error('\n❌ Échec du smoke test:', err.message);
  process.exit(1);
});
