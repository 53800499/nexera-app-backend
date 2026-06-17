import { BadRequestException, ValidationError } from '@nestjs/common';

function extractMessages(errors: ValidationError[]): string[] {
  const messages: string[] = [];

  for (const error of errors) {
    if (error.constraints) {
      messages.push(...Object.values(error.constraints));
    }
    if (error.children?.length) {
      messages.push(...extractMessages(error.children));
    }
  }

  return messages;
}

export function validationExceptionFactory(errors: ValidationError[]) {
  const messages = extractMessages(errors);
  const message = messages[0] ?? 'Les données envoyées sont invalides.';

  if (message.includes('should not exist')) {
    return new BadRequestException(
      'Certains champs envoyés ne sont pas autorisés.',
    );
  }

  return new BadRequestException(message);
}
