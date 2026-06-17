import { SyncEntityType } from './enums/sync-entity-type.enum';
import { SyncOperation } from './enums/sync-operation.enum';

export const SYNC_MANIFEST = {
  version: 2,
  endpoints: {
    bootstrap: '/sync/bootstrap',
    pull: '/sync/pull',
    push: '/sync/push',
    backgroundPush: '/sync/push/background',
    manifest: '/sync/manifest',
  },
  pwa: {
    serviceWorker: '/pwa/sw-sync.js',
    backgroundSyncTag: 'nexera-sync-push',
  },
  compression: {
    supported: ['gzip'],
    queryParam: 'compress',
    header: 'Content-Encoding',
  },
  pullEntities: [
    SyncEntityType.CLIENT,
    SyncEntityType.CONTACT,
    SyncEntityType.QUOTATION,
    SyncEntityType.ORDER,
    SyncEntityType.INVOICE,
    SyncEntityType.PAYMENT,
    SyncEntityType.CATALOG_CATEGORY,
    SyncEntityType.CATALOG_ITEM,
  ],
  pushEntities: [
    SyncEntityType.CLIENT,
    SyncEntityType.CONTACT,
    SyncEntityType.QUOTATION,
    SyncEntityType.ORDER,
    SyncEntityType.INVOICE,
    SyncEntityType.PAYMENT,
    SyncEntityType.CATALOG_CATEGORY,
    SyncEntityType.CATALOG_ITEM,
  ],
  operations: Object.values(SyncOperation),
} as const;
