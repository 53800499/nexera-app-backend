import { UserEntity } from '../entities/user.entity';

export class UserStatusChangedEvent {
  constructor(
    public readonly user: UserEntity,
    public readonly isActive: boolean,
  ) {}
}
