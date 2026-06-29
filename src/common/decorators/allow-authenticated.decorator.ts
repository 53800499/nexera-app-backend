import { SetMetadata } from '@nestjs/common';

export const ALLOW_AUTHENTICATED_KEY = 'allowAuthenticated';

/** Route accessible à tout utilisateur connecté (JWT), sans permission métier explicite. */
export const AllowAuthenticated = () =>
  SetMetadata(ALLOW_AUTHENTICATED_KEY, true);
