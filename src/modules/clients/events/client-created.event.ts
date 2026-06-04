import { ClientEntity } from '../entities/client.entity';

export class ClientCreatedEvent {
  constructor(public readonly client: ClientEntity) {}
}
