import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function setupSwagger(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle('Nexera API')
    .setDescription(
      'API de gestion commerciale Nexera — clients (UC-01), catalogue (UC-02), devis (UC-03).',
    )
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT access token',
      },
      'access-token',
    )
    .addTag('clients', 'UC-01 — Créer et gérer un client')
    .addTag('catalogue', 'UC-02 — Créer et gérer le catalogue')
    .addTag('quotations', 'UC-03 — Créer et gérer un devis')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });
}
