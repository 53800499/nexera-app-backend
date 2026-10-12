const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function testWithGeneratedToken() {
  const user = await prisma.user.findFirst({
    where: { email: 'bassirousikirou59@gmail.com' },
    include: {
      tenant: true,
      roles: {
        include: {
          role: {
            include: {
              permissions: {
                include: { permission: true }
              }
            }
          }
        }
      }
    }
  });

  if (!user) {
    console.error('User not found');
    return;
  }

  const roles = user.roles?.map((ur) => ur.role.code) || [];
  const permissions = [
    ...new Set(
      user.roles?.flatMap((ur) =>
        ur.role.permissions.map((rp) => rp.permission.code)
      ) || []
    )
  ];

  console.log('User roles:', roles);
  console.log('Permissions count:', permissions.length);
  console.log('Has fiscalite.read in DB perms?', permissions.includes('fiscalite.read'));

  const payload = {
    sub: user.id,
    tenantId: user.tenantId,
    tenantType: user.tenant?.type,
    email: user.email,
    roles,
    permissions
  };

  const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });

  // Test the 5 endpoints
  const endpoints = [
    '/api/fiscalite/referentiel/sources?paysCode=BJ',
    '/api/fiscalite/referentiel/baremes?paysCode=BJ',
    '/api/fiscalite/referentiel/parametres?paysCode=BJ',
    '/api/fiscalite/referentiel/regimes?paysCode=BJ',
    '/api/fiscalite/referentiel/types?paysCode=BJ',
  ];

  for (const ep of endpoints) {
    const res = await fetch(`http://localhost:3008${ep}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log(`Endpoint ${ep} -> Status: ${res.status}`);
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      console.log('  Error body:', JSON.stringify(body));
    } else {
      console.log(`  Success! Count: ${Array.isArray(body) ? body.length : typeof body}`);
    }
  }
}

testWithGeneratedToken()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
