# ADR-002 : Stratégie Multi-Tenancy par PostgreSQL Row Level Security (RLS)

## Statut
**Accepté**

## Contexte
Nexera ERP est une plateforme SaaS mutualisée accueillant de multiples entreprises clientes. Deux stratégies classiques de multi-tenancy s'offraient à nous :
1. **Base de données par tenant** : Complexité opérationnelle ingérable (centaines de bases de données, coût de maintenance et de migration prohibitif).
2. **Schéma par tenant** : Nombre de schémas élevé, saturation des pools de connexion et lenteur de synchronisation des migrations.
3. **Base partagée, schéma partagé avec colonne `tenant_id`** :
   - *Option A (Filtrage applicatif seul)* : Risque critique d'erreur humaine (oubli d'une clause `WHERE tenant_id = ...`).
   - *Option B (Filtrage assisté par PostgreSQL Row Level Security)* : Isolation étanche garantie au niveau du noyau de la base de données.

## Décision
Nous avons adopté l'approche **Base Partagée, Schéma Partagé avec Row Level Security (RLS)** native de PostgreSQL.

Le pipeline technique fonctionne comme suit :
1. Chaque table contenant des données d'entreprise possède une colonne `tenant_id`.
2. Une politique PostgreSQL RLS est activée sur chaque table :
   ```sql
   CREATE POLICY tenant_isolation ON <table_name>
   FOR ALL USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::text);
   ```
3. L'intercepteur NestJS `TenantRlsInterceptor` injecte la variable de session `app.current_tenant_id` à chaque début de transaction HTTP.

## Conséquences
### Positives :
- **Sécurité Mathématique** : Même si une requête omettait la condition de tenant, la base de données ne retourne strictement que les lignes autorisées.
- **Coûts d'Infrastructure Maîtrisés** : Une seule instance PostgreSQL managée supporte l'ensemble des tenants.
- **Simplicité des Migrations** : Une seule commande `prisma migrate deploy` met à jour instantanément tous les tenants.
### Négatives & Atténuations :
- Nécessite d'exécuter `SET LOCAL app.current_tenant_id` à chaque requête -> géré de manière transparente par `TenantRlsInterceptor`.
