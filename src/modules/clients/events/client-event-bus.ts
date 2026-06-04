import { ClientCreatedEvent } from './client-created.event';
import { ClientUpdatedEvent } from './client-updated.event';
import { ClientDeletedEvent } from './client-deleted.event';
import { ClientContactAddedEvent } from './client-contact-added.event';
import { ClientDomainEventHandler } from '../handlers/client-domain-event.handler';

export class ClientEventBus {
  private readonly handlers: ClientDomainEventHandler[] = [];

  register(handler: ClientDomainEventHandler) {
    this.handlers.push(handler);
  }

  publish(event: unknown) {
    for (const handler of this.handlers) {
      if (event instanceof ClientCreatedEvent) handler.onClientCreated(event);
      if (event instanceof ClientUpdatedEvent) handler.onClientUpdated(event);
      if (event instanceof ClientDeletedEvent) handler.onClientDeleted(event);
      if (event instanceof ClientContactAddedEvent) {
        handler.onClientContactAdded(event);
      }
    }
  }
}
