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
  const rawMessages = extractMessages(errors);
  if (rawMessages.length === 0) {
    return new BadRequestException('Les données envoyées sont invalides.');
  }

  const cleanedMessages = rawMessages.map((msg) => {
    if (msg.includes('should not exist')) {
      return 'Certains champs envoyés ne sont pas autorisés.';
    }
    return msg;
  });

  return new BadRequestException(
    cleanedMessages.length === 1 ? cleanedMessages[0] : cleanedMessages,
  );
}
