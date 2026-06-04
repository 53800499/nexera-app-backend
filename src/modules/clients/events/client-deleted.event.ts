import { ClientEntity } from '../entities/client.entity';

export class ClientDeletedEvent {
  constructor(public readonly client: ClientEntity) {}
}
