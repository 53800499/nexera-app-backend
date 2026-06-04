import { ClientEntity } from '../entities/client.entity';

export class ClientUpdatedEvent {
  constructor(public readonly client: ClientEntity) {}
}
