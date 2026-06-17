import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function setupSwagger(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle('Nexera API')
    .setDescription(
      'API Nexera — clients (UC-01), catalogue (UC-02), devis (UC-03), commandes (UC-04), factures (UC-05), encaissements (UC-06), relances (UC-07), tableau de bord (UC-08), paramétrage.',
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
    .addTag('auth', 'Authentification — login, register, mot de passe oublié')
    .addTag('clients', 'UC-01 — Créer et gérer un client')
    .addTag('catalogue', 'UC-02 — Créer et gérer le catalogue')
    .addTag('quotations', 'UC-03 — Créer et gérer un devis')
    .addTag('orders', 'UC-04 — Créer et gérer un bon de commande')
    .addTag('invoices', 'UC-05 — Créer et gérer les factures')
    .addTag('payments', 'UC-06 — Enregistrer un encaissement')
    .addTag('reminders', 'UC-07 — Relances clients')
    .addTag('dashboard', 'UC-08 — Tableau de bord commercial')
    .addTag('settings', 'Paramétrage — taxes, conditions, numérotation, modèles')
    .addTag('public', 'Documents publics — liens sécurisés, suivi email')
    .addTag('health', 'Sondes de disponibilité')
    .addTag('metrics', 'Métriques de performance API')
    .addTag('audit', 'Journal d\'audit immuable')
    .addTag(
      'sync',
      'Offline v2 — bootstrap/pull gzip, push mutations (clients, catalogue, devis, BC, factures, paiements), manifest PWA, Background Sync',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });
}
