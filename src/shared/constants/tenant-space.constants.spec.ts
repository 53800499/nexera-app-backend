import { TenantType } from '@prisma/client';
import {
  getPermissionCodesForRole,
  getPermissionsForTenantType,
  getRolesForTenantType,
} from './tenant-space.constants';

describe('tenant-space.constants', () => {
  it('exposes CRM permissions for company tenants only', () => {
    const company = getPermissionsForTenantType(TenantType.company).map(
      (p) => p.code,
    );
    const cabinet = getPermissionsForTenantType(TenantType.cabinet).map(
      (p) => p.code,
    );

    expect(company).toContain('clients.read');
    expect(company).toContain('invoices.read');
    expect(cabinet).not.toContain('clients.read');
    expect(cabinet).toContain('cabinet.read');
  });

  it('defines distinct default roles per space', () => {
    expect(getRolesForTenantType(TenantType.company).map((r) => r.code)).toEqual(
      ['ADMIN', 'CEO'],
    );
    expect(getRolesForTenantType(TenantType.cabinet).map((r) => r.code)).toEqual(
      ['CABINET_ADMIN', 'COLLABORATOR'],
    );
  });

  it('limits collaborator permissions to read-only cabinet access', () => {
    const codes = getPermissionCodesForRole(
      'COLLABORATOR',
      TenantType.cabinet,
    );
    expect(codes).toEqual(['cabinet.read', 'sync.read', 'settings.read']);
  });
});
