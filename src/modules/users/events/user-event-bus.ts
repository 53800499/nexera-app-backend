import { UserCreatedEvent } from './user-created.event';
import { UserUpdatedEvent } from './user-updated.event';
import { UserStatusChangedEvent } from './user-status-changed.event';
import { UserRolesAssignedEvent } from './user-roles-assigned.event';
import { UserDomainEventHandler } from '../handlers/user-domain-event.handler';

export class UserEventBus {
  private readonly handlers: UserDomainEventHandler[] = [];

  register(handler: UserDomainEventHandler) {
    this.handlers.push(handler);
  }

  publish(event: unknown) {
    for (const handler of this.handlers) {
      if (event instanceof UserCreatedEvent) {
        handler.onUserCreated(event);
      }

      if (event instanceof UserUpdatedEvent) {
        handler.onUserUpdated(event);
      }

      if (event instanceof UserStatusChangedEvent) {
        handler.onUserStatusChanged(event);
      }

      if (event instanceof UserRolesAssignedEvent) {
        handler.onUserRolesAssigned(event);
      }
    }
  }
}
