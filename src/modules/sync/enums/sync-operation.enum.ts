export enum SyncOperation {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  /** BC : draft → confirmed */
  CONFIRM = 'confirm',
  /** Facture : draft → issued */
  ISSUE = 'issue',
  /** Encaissement sur facture émise (raccourci UC-06) */
  RECORD_PAYMENT = 'record_payment',
}
