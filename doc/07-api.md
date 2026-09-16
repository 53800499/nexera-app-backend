# Référentiel des APIs REST — Backend Nexera ERP

---

## 1. Conventions Générales de l'API

L'API de **Nexera ERP** est une API RESTful respectant les standards HTTP/1.1 et HTTP/2.

- **Préfixe Global** : `/api` (paramétrable via la variable d'environnement `API_PREFIX`).
- **Format d'Échange** : `application/json` (UTF-8) pour les données, `application/pdf` pour les téléchargements de documents, `text/plain` pour le FEC.
- **Documentation Interactive (Swagger / OpenAPI 3.0)** : Accessible en environnement de développement et staging sur `http://localhost:3008/api/docs`.

### En-têtes HTTP Requis (Headers)
| Header | Présence | Description |
| :--- | :--- | :--- |
| `Authorization` | Requis (hors routes `@Public()`) | Jeton Bearer JWT : `Bearer <ACCESS_TOKEN>`. |
| `Content-Type` | Requis pour POST / PUT / PATCH | `application/json`. |
| `X-Tenant-Id` | Optionnel (automatique via JWT) | Permet de forcer un contexte tenant pour les utilisateurs multi-organisations. |

### Codes de Statut HTTP Standards
- `200 OK` : Succès d'une requête de lecture (`GET`) ou de mise à jour (`PATCH`, `PUT`).
- `201 Created` : Création réussie d'une ressource (`POST`).
- `204 No Content` : Suppression réussie d'une ressource (`DELETE`).
- `400 Bad Request` : Données invalides (échec de validation DTO `class-validator`).
- `401 Unauthorized` : Jeton JWT manquant, expiré ou signature invalide.
- `403 Forbidden` : L'utilisateur authentifié ne dispose pas de la permission requise.
- `404 Not Found` : Ressource introuvable ou n'appartenant pas au tenant connecté.
- `500 Internal Server Error` : Erreur interne non capturée du serveur.

---

## 2. Authentification & Gestion des Profils (`/api/auth`)

| Méthode | Endpoint | Permission | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register` | `@Public()` | Inscription d'un nouvel administrateur et de son tenant. |
| `POST` | `/api/auth/login` | `@Public()` | Connexion par email/mot de passe -> renvoie `accessToken` + `refreshToken`. |
| `POST` | `/api/auth/refresh` | `@Public()` | Renouvellement du jeton d'accès via le refresh token. |
| `POST` | `/api/auth/logout` | Connecté | Révocation du refresh token actif et fermeture de session. |
| `POST` | `/api/auth/forgot-password` | `@Public()` | Demande de réinitialisation de mot de passe par email. |
| `POST` | `/api/auth/reset-password` | `@Public()` | Validation du nouveau mot de passe avec le token reçu. |
| `GET` | `/api/profile` | Connecté | Récupération du profil de l'utilisateur connecté et de ses droits. |
| `PATCH` | `/api/profile` | Connecté | Mise à jour des coordonnées personnelles de l'utilisateur. |

---

## 3. Facturation & Certification e-MECeF (`/api/invoices`)

| Méthode | Endpoint | Permission | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/invoices` | `invoices.read` | Liste paginée des factures avec filtres (statut, date, client). |
| `GET` | `/api/invoices/:id` | `invoices.read` | Détail complet d'une facture (lignes, TVA, e-MECeF, paiements). |
| `POST` | `/api/invoices` | `invoices.create` | Création d'une nouvelle facture (statut initial `draft`). |
| `PATCH` | `/api/invoices/:id` | `invoices.update` | Modification d'une facture (possible uniquement si statut `draft`). |
| `DELETE`| `/api/invoices/:id` | `invoices.delete` | Suppression d'une facture brouillon. |
| `POST` | `/api/invoices/:id/issue` | `invoices.issue` | Émission officielle : attribution du numéro définitif inaltérable. |
| `POST` | `/api/invoices/:id/normalize` | `invoices.normalize`| **Déclenche la certification fiscale e-MECeF (DGI Bénin)**. |
| `GET` | `/api/invoices/:id/pdf` | `invoices.read` | Téléchargement du PDF vectoriel avec QR Code certifié. |
| `GET` | `/api/invoices/mecef/config` | `manage:invoices`| Récupération des paramètres e-MECeF de l'entreprise (NIM, URL). |
| `PATCH`| `/api/invoices/mecef/config` | `manage:invoices`| Mise à jour de la configuration e-MECeF (NIM, clé API, environnement).|

---

## 4. Cycle Commercial : Devis & Commandes (`/api/quotations`, `/api/orders`)

| Méthode | Endpoint | Permission | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/quotations` | `quotations.read` | Liste des devis avec suivi des statuts. |
| `POST` | `/api/quotations` | `quotations.create` | Création d'un devis avec calcul instantané des totaux. |
| `POST` | `/api/quotations/:id/send` | `quotations.send` | Envoi du devis par email avec PDF joint au client. |
| `POST` | `/api/quotations/:id/convert` | `quotations.convert`| Conversion du devis en commande ou directement en facture. |
| `GET` | `/api/orders` | `orders.read` | Liste des bons de commande clients. |
| `POST` | `/api/orders/:id/deliver` | `orders.update` | Validation de livraison et décrémentation des stocks. |

---

## 5. Règlements & Trésorerie (`/api/payments`)

| Méthode | Endpoint | Permission | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/payments` | `payments.read` | Historique de tous les encaissements enregistrés. |
| `POST` | `/api/payments` | `payments.create` | Enregistrement d'un paiement avec imputation sur factures. |
| `GET` | `/api/payments/:id/receipt` | `payments.read` | Téléchargement du reçu de paiement client en PDF. |
| `DELETE`| `/api/payments/:id` | `payments.delete` | Annulation d'un encaissement et réouverture du solde facture. |

---

## 6. Ressources Humaines & Moteur de Paie (`/api/rh`)

| Méthode | Endpoint | Permission | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/rh/employes` | `rh.read` | Annuaire des collaborateurs et contrats de travail. |
| `POST` | `/api/rh/employes` | `rh.write` | Création d'un collaborateur (fiche état civil, matricule, CNSS). |
| `GET` | `/api/rh/paie/periodes` | `paie.read` | Liste des périodes de paie mensuelles. |
| `POST` | `/api/rh/paie/calculer` | `paie.calculate` | **Exécution du calcul de paie mensuel OHADA / CNSS / IPTS**. |
| `GET` | `/api/rh/paie/bulletins/:id/pdf`| `paie.read` | Téléchargement du bulletin de salaire vectoriel certifié. |
| `POST` | `/api/rh/paie/cloturer` | `paie.close` | Clôture irréversible de la période de paie et figeage des salaires. |

---

## 7. Fiscalité & Fichier des Écritures Comptables (`/api/fiscalite`)

| Méthode | Endpoint | Permission | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/fiscalite/tva/declarations` | `tax.read` | État récapitulatif mensuel de la TVA collectée et déductible. |
| `GET` | `/api/fiscalite/aib` | `tax.read` | Registre des acomptes AIB (1% et 5%) du mois. |
| `POST` | `/api/fiscalite/fec/export` | `fec.export` | **Génération et téléchargement du fichier FEC (Arrêté 1085-C)**. |
| `GET` | `/api/fiscalite/fec/controle` | `fec.export` | Rapport d'audit de conformité comptable préalable au FEC. |

---

## 8. Espace Cabinet Comptable (`/api/cabinet`)

| Méthode | Endpoint | Permission | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/cabinet/portefeuille` | `cabinet.read` | Vue d'ensemble des entreprises clientes du cabinet. |
| `GET` | `/api/cabinet/supervision/:tenantId`| `cabinet.supervise`| Accès aux indicateurs d'un dossier client spécifique. |
| `POST` | `/api/cabinet/revision/lettrage` | `cabinet.write` | Lettrage automatique ou manuel des comptes du dossier. |
| `POST` | `/api/cabinet/cloture-fiscale` | `cabinet.close` | Validation de la liasse fiscale annuelle du client. |

---

## 9. Observabilité & Santé Système (`/health`, `/metrics`)

| Méthode | Endpoint | Accès | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/health` | `@Public()` | Bilan global de santé (connexion PostgreSQL, espace disque). |
| `GET` | `/health/liveness` | `@Public()` | Sonde de liveness Kubernetes / Render (200 si le process tourne). |
| `GET` | `/health/readiness`| `@Public()` | Sonde de readiness (200 si la base de données est opérationnelle). |
| `GET` | `/metrics` | Restreint | Exposition des métriques temps réel au format standard Prometheus. |
