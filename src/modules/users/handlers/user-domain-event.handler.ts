import { Injectable } from '@nestjs/common';
import { UserCreatedEvent } from '../events/user-created.event';
import { UserUpdatedEvent } from '../events/user-updated.event';
import { UserStatusChangedEvent } from '../events/user-status-changed.event';
import { UserRolesAssignedEvent } from '../events/user-roles-assigned.event';

@Injectable()
export class UserDomainEventHandler {
  onUserCreated(event: UserCreatedEvent) {
    console.log('[users] created', event.user.toResponse());
  }

  onUserUpdated(event: UserUpdatedEvent) {
    console.log('[users] updated', event.user.toResponse());
  }

  onUserStatusChanged(event: UserStatusChangedEvent) {
    console.log(
      '[users] status changed',
      event.user.id,
      '=>',
      event.isActive,
    );
  }

  onUserRolesAssigned(event: UserRolesAssignedEvent) {
    console.log('[users] roles assigned', event.user.id, event.roleIds);
  }
}
