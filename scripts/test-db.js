const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function check() {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        isSuperAdmin: true,
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
    console.log(`Found ${users.length} users.`);
    for (const u of users) {
      const perms = u.roles.flatMap(ur => ur.role.permissions.map(rp => rp.permission.code));
      console.log(`User ${u.email}: has fiscalite.read?`, perms.includes('fiscalite.read'), `(Roles: ${u.roles.map(r => r.role.code).join(', ')}, Total perms: ${perms.length})`);
    }

    const allRoles = await prisma.role.findMany({
      include: {
        permissions: {
          include: { permission: true }
        }
      }
    });
    console.log(`\nFound ${allRoles.length} roles:`);
    for (const r of allRoles) {
      const hasFisc = r.permissions.some(rp => rp.permission.code === 'fiscalite.read');
      console.log(`Role ${r.code} (id: ${r.id}, tenant: ${r.tenantId}): has fiscalite.read? ${hasFisc} (Total perms: ${r.permissions.length})`);
    }
  } catch (err) {
    console.error('Query error:', err);
  }
}

check()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
