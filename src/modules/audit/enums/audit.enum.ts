export enum AuditEntityType {
  INVOICE = 'invoice',
  QUOTATION = 'quotation',
  PAYMENT = 'payment',
  ORDER = 'order',
}

export enum AuditAction {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  ISSUE = 'issue',
  SEND = 'send',
  CANCEL = 'cancel',
  RECORD_PAYMENT = 'record_payment',
  CANCEL_PAYMENT = 'cancel_payment',
  CONVERT = 'convert',
}
