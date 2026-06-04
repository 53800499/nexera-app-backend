import { UserEntity } from '../entities/user.entity';

export class UserUpdatedEvent {
  constructor(public readonly user: UserEntity) {}
}
