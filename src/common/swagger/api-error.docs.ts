import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

export const API_ERROR_SCHEMA = {
  type: 'object',
  properties: {
    statusCode: { type: 'number', example: 400 },
    message: {
      type: 'string',
      example: 'Message d\'erreur clair en français.',
    },
    error: { type: 'string', example: 'Bad Request' },
  },
};

export function ApiStandardErrors(
  options: {
    badRequest?: string;
    notFound?: string;
    includeNotFound?: boolean;
    conflict?: string;
    unauthorized?: string;
  } = {},
) {
  const decorators = [
    ApiBadRequestResponse({
      description: options.badRequest ?? 'Données invalides ou règle métier non respectée',
      schema: API_ERROR_SCHEMA,
    }),
  ];

  if (options.includeNotFound !== false) {
    decorators.push(
      ApiNotFoundResponse({
        description: options.notFound ?? 'Ressource introuvable',
        schema: API_ERROR_SCHEMA,
      }),
    );
  }

  if (options.conflict) {
    decorators.push(
      ApiConflictResponse({
        description: options.conflict,
        schema: {
          ...API_ERROR_SCHEMA,
          properties: {
            ...API_ERROR_SCHEMA.properties,
            message: {
              oneOf: [
                { type: 'string' },
                {
                  type: 'object',
                  properties: {
                    code: { type: 'string' },
                    message: { type: 'string' },
                  },
                },
              ],
            },
          },
        },
      }),
    );
  }

  if (options.unauthorized) {
    decorators.push(
      ApiUnauthorizedResponse({
        description: options.unauthorized,
        schema: API_ERROR_SCHEMA,
      }),
    );
  }

  return applyDecorators(...decorators);
}
