import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { UserEventBus } from './events/user-event-bus';
import { UserDomainEventHandler } from './handlers/user-domain-event.handler';

@Module({
  imports: [DatabaseModule],
  controllers: [UsersController],
  providers: [
    UsersService,
    UserDomainEventHandler,
    {
      provide: UserEventBus,
      useFactory: (handler: UserDomainEventHandler) => {
        const bus = new UserEventBus();
        bus.register(handler);
        return bus;
      },
      inject: [UserDomainEventHandler],
    },
  ],
  exports: [UsersService],
})
export class UsersModule {}
