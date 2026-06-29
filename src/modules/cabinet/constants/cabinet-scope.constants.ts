export const CABINET_SCOPE_PERMISSIONS = {
  INVOICES_READ: 'cabinet.scope.invoices.read',
  PAYMENTS_READ: 'cabinet.scope.payments.read',
  CLIENTS_READ: 'cabinet.scope.clients.read',
} as const;

export type CabinetScopePermissionCode =
  (typeof CABINET_SCOPE_PERMISSIONS)[keyof typeof CABINET_SCOPE_PERMISSIONS];

export const ALL_CABINET_SCOPE_PERMISSION_CODES: CabinetScopePermissionCode[] =
  Object.values(CABINET_SCOPE_PERMISSIONS);

export const DEFAULT_CABINET_LINK_PERMISSIONS: CabinetScopePermissionCode[] = [
  CABINET_SCOPE_PERMISSIONS.INVOICES_READ,
];

export function normalizeCabinetLinkPermissions(
  input?: string[] | null,
): CabinetScopePermissionCode[] {
  if (!input?.length) {
    return [...DEFAULT_CABINET_LINK_PERMISSIONS];
  }

  const allowed = new Set<string>(ALL_CABINET_SCOPE_PERMISSION_CODES);
  const normalized = input.filter((code) => allowed.has(code));

  return normalized.length > 0
    ? (normalized as CabinetScopePermissionCode[])
    : [...DEFAULT_CABINET_LINK_PERMISSIONS];
}
