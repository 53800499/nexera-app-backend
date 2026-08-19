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
    .addTag(
      'auth',
      'Authentification — inscription, connexion, refresh, mot de passe oublié (`POST /forgot-password`), réinitialisation (`POST /reset-password`)',
    )
    .addTag(
      'profile',
      'Profil utilisateur — consulter et modifier son compte (JWT requis)',
    )
    .addTag('users', 'Gestion des utilisateurs — création, listing, modification, statut actif/inactif, attribution des rôles et consultation des permissions')
    .addTag('roles', 'Gestion des rôles et habilitations — création, attribution des permissions, listing pour administration et attribution RH')
    .addTag('permissions', 'Gestion des permissions système — catalogue des droits d\'accès applicatifs')
    .addTag('tenants', 'Multi-tenancy — gestion des organisations et entreprises clientes')
    .addTag('clients', 'UC-01 — Créer et gérer un client')
    .addTag('catalogue', 'UC-02 — Créer et gérer le catalogue')
    .addTag('quotations', 'UC-03 — Créer et gérer un devis')
    .addTag('orders', 'UC-04 — Créer et gérer un bon de commande')
    .addTag('invoices', 'UC-05 — Créer et gérer les factures')
    .addTag('payments', 'UC-06 — Enregistrer un encaissement')
    .addTag('reminders', 'UC-07 — Relances clients')
    .addTag('dashboard', 'UC-08 — Tableau de bord commercial')
    .addTag('stock-warehouses', 'Module Stock — Entrepôts et gestion des emplacements de stockage (UC-S02)')
    .addTag('stock-items', 'Module Stock — Articles et configurations de stock (UC-S01)')
    .addTag('stock-movements', 'Module Stock — Mouvements d\'entrées et sorties de stock (UC-S03, UC-S04)')
    .addTag('stock-transfers', 'Module Stock — Transferts d\'articles inter-entrepôts (UC-S05)')
    .addTag('stock-inventory', 'Module Stock — Sessions de comptage et inventaires physiques (UC-S06)')
    .addTag('stock-valuation', 'Module Stock — Valorisation financière du stock CUMP / FIFO (UC-S07)')
    .addTag('stock-alerts', 'Module Stock — Alertes de réapprovisionnement et stocks critiques (UC-S08)')
    .addTag('settings', 'Paramétrage — taxes, conditions, numérotation, modèles')
    .addTag('public', 'Documents publics — liens sécurisés, suivi email')
    .addTag('health', 'Sondes de disponibilité')
    .addTag('metrics', 'Métriques de performance API')
    .addTag('audit', 'Journal d\'audit immuable')
    .addTag(
      'sync',
      'Offline v2 — bootstrap/pull gzip, push mutations (clients, catalogue, devis, BC, factures, paiements), manifest PWA, Background Sync',
    )
    .addTag(
      'cabinet',
      'Espace Cabinet ↔ Entreprise — liaison multi-dossiers : autorisation (`POST /cabinet/access`), révocation (`DELETE /cabinet/access`), liste cabinets (`GET /cabinet/access`), dossiers cabinet (`GET /cabinet/companies`), factures par dossier (`GET /cabinet/companies/:companyTenantId/invoices`). Voir descriptions détaillées sur chaque endpoint.',
    )
    .addTag('rh-dashboard', 'Module RH — Métriques clés, masse salariale, alertes contrats et congés')
    .addTag('rh-referentiel', 'Module RH — Données légales et fiscales (CGI Bénin 2026, barèmes ITS Art. 125/126, cotisations CNSS, VPS, jours fériés)')
    .addTag('rh-organisation', 'Module RH — Établissements, Départements, Postes et Grilles de classification')
    .addTag('rh-employes', 'Module RH — Salariés, Dossier 360°, cycle de vie (embauche, suspension, sortie), Comptes ERP et Self-Service')
    .addTag('rh-contrats', 'Module RH — Contrats de travail (CDI, CDD, Stage), Avenants, Périodes d’essai, Ruptures et Simulateur CCGT')
    .addTag('rh-temps-absences', 'Module RH — Relevés d’heures, Heures supplémentaires, Demandes d’absences et Soldes de congés')
    .addTag('rh-paie', 'Module RH — Cycles de paie, Moteur de calcul 1-clic, Éléments variables, Bulletins OHADA et Solde de tout compte')
    .addTag('rh-interfaces', 'Module RH — Écritures comptables OD SYSCOHADA et Déclarations fiscales & sociales (M7, DGI, CNSS)')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });
}
