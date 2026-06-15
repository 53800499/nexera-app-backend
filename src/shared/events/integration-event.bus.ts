import { Injectable, Logger } from '@nestjs/common';

export interface IntegrationEvent<T = unknown> {
  eventName: string;
  tenantId: string;
  occurredAt: Date;
  payload: T;
}

export type IntegrationEventHandler<T = unknown> = (
  event: IntegrationEvent<T>,
) => void | Promise<void>;

/**
 * Bus d'intégration inter-modules (§6.1) — événements nommés (invoice.issued, etc.).
 */
@Injectable()
export class IntegrationEventBus {
  private readonly logger = new Logger(IntegrationEventBus.name);
  private readonly handlers = new Map<string, IntegrationEventHandler[]>();

  subscribe<T>(eventName: string, handler: IntegrationEventHandler<T>) {
    const list = this.handlers.get(eventName) ?? [];
    list.push(handler as IntegrationEventHandler);
    this.handlers.set(eventName, list);
  }

  async publish<T>(event: IntegrationEvent<T>) {
    this.logger.debug(`[${event.eventName}] tenant=${event.tenantId}`);
    const handlers = this.handlers.get(event.eventName) ?? [];
    for (const handler of handlers) {
      await handler(event);
    }
  }
}
