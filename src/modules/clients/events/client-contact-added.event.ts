import { ClientEntity } from '../entities/client.entity';

export class ClientContactAddedEvent {
  constructor(
    public readonly client: ClientEntity,
    public readonly contactId: string,
  ) {}
}
