# ADR-001 : Choix du Framework NestJS et de Prisma ORM

## Statut
**Accepté** (Décision fondatrice)

## Contexte
Pour construire un progiciel de gestion intégré (ERP) robuste dans l'espace OHADA, le backend devait satisfaire aux impératifs suivants :
- Typage statique fort pour éliminer les erreurs de calcul monétaire à l'exécution.
- Architecture d'entreprise structurée avec injection de dépendances facilitant la modularité.
- Couche d'accès aux données déclarative avec génération automatique de migrations et typage de schéma fiable.
- Écosystème riche pour la documentation d'API (OpenAPI / Swagger) et la sécurité (Passport, JWT).

## Décision
Nous avons sélectionné le tandem **NestJS (v11)** et **Prisma ORM (v7)** avec **PostgreSQL** :
1. **NestJS** fournit une structure d'entreprise standardisée (modules, contrôleurs, services, guards, intercepteurs), inspirée d'Angular et Spring Boot, tout en profitant de l'écosystème Node.js.
2. **Prisma ORM** offre une définition de schéma claire (`schema.prisma`), des requêtes typées à la compilation et une gestion fluide des migrations relationnelles avec PostgreSQL.

## Conséquences
### Positives :
- Productivité de développement accélérée avec autocomplétion intégrale et détection immédiate des régressions de schéma.
- Cohérence structurelle exemplaire entre les 23 modules de l'application.
- Documentation Swagger générée automatiquement via les décorateurs NestJS.
### Négatives & Atténuations :
- Temps de génération du client Prisma (`prisma generate`) lors du build -> automatisé dans le script `postinstall`.
- Nécessite l'adaptateur `@prisma/adapter-pg` pour les connexions optimisées.
