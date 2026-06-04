import { UserEntity } from '../entities/user.entity';

export class UserRolesAssignedEvent {
  constructor(
    public readonly user: UserEntity,
    public readonly roleIds: string[],
  ) {}
}
