import { Injectable } from '@nestjs/common';
import { ClientCreatedEvent } from '../events/client-created.event';
import { ClientUpdatedEvent } from '../events/client-updated.event';
import { ClientDeletedEvent } from '../events/client-deleted.event';
import { ClientContactAddedEvent } from '../events/client-contact-added.event';

@Injectable()
export class ClientDomainEventHandler {
  onClientCreated(event: ClientCreatedEvent) {
    console.log('[clients] created', event.client.toResponse());
  }

  onClientUpdated(event: ClientUpdatedEvent) {
    console.log('[clients] updated', event.client.toResponse());
  }

  onClientDeleted(event: ClientDeletedEvent) {
    console.log('[clients] deleted', event.client.toResponse());
  }

  onClientContactAdded(event: ClientContactAddedEvent) {
    console.log('[clients] contact added', event.client.id, event.contactId);
  }
}
