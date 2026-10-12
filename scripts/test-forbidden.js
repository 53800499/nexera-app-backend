const jwt = require('jsonwebtoken');
require('dotenv').config();

const payloadNoAdmin = {
  sub: 'some-user-id',
  tenantId: 'some-tenant-id',
  roles: ['COMPTABLE'],
  permissions: ['some.other.perm']
};

const token = jwt.sign(payloadNoAdmin, process.env.JWT_SECRET, { expiresIn: '1h' });

async function test() {
  const res = await fetch('http://localhost:3008/api/fiscalite/referentiel/sources?paysCode=BJ', {
    headers: { Authorization: `Bearer ${token}` }
  });
  console.log('Status without fiscalite.read:', res.status);
  const body = await res.json();
  console.log('Body:', body);
}

test();
