# Architecture Approfondie & Modélisation C4 — Backend Nexera ERP

---

## 1. Modélisation C4 du Système Nexera

### Niveau 1 : Diagramme de Contexte Système (System Context)

```mermaid
graph TD
    UserClient["Utilisateurs Entreprise (Dirigeants, Commerciaux, RH, Comptables)"]
    CabinetComptable["Cabinet d'Expertise Comptable (Collaborateurs, Experts)"]
    DGI["DGI Bénin (Serveur e-MECeF ebf.impots.bj)"]
    SMTPServer["Serveur SMTP Transactionnel"]
    
    Nexera["Plateforme Nexera ERP (Backend NestJS + Base PostgreSQL)"]
    
    UserClient -->|"Accès Web / Mobile HTTPS"| Nexera
    CabinetComptable -->|"Supervision multi-dossiers HTTPS"| Nexera
    Nexera -->|"Normalisation fiscale REST HTTPS"| DGI
    Nexera -->|"Expédition devis, factures, relances SMTP"| SMTPServer
```

---

### Niveau 2 : Diagramme des Conteneurs (Container Diagram)

```mermaid
graph TD
    subgraph Frontend_Layer ["Frontends (Applications Clientes)"]
        SPA["Web App Next.js 15 (Tailwind / Vanilla CSS)"]
    end
    
    subgraph Backend_Layer ["Conteneur Backend (Node.js 20 / NestJS v11)"]
        API["API RESTful NestJS (Port 3008)"]
        EventBus["Bus d'Événements Mémoire"]
        PdfEngine["Moteur Vectoriel PDFKit"]
        CronEngine["Planificateur de Tâches @nestjs/schedule"]
    end
    
    subgraph Data_Layer ["Conteneur Données"]
        DB[("PostgreSQL 15+ avec Row Level Security")]
    end
    
    SPA -->|"HTTPS / JSON avec Bearer JWT"| API
    API --> EventBus
    API --> PdfEngine
    API -->|"Prisma Client (Sessions RLS)"| DB
    CronEngine -->|"Tâches d'arrière-plan"| API
```

---

### Niveau 3 : Diagramme des Composants Backend (Component Diagram)

```mermaid
graph LR
    subgraph Core_Pipeline ["Pipeline d'Interception"]
        MW["TenantUserMiddleware\nMetricsMiddleware"]
        Guards["JwtAuthGuard\nPermissionsGuard"]
        RLS["TenantRlsInterceptor\n(SET LOCAL app.current_tenant_id)"]
        Pipe["ValidationPipe\n(Whitelist & Transform)"]
    end

    subgraph Business_Modules ["Modules Métiers Spécialisés"]
        M_Invoices["InvoicesModule\nMecefClientService"]
        M_Sales["QuotationsModule\nOrdersModule"]
        M_Payroll["RhModule\nCalculPaieService"]
        M_Tax["FiscaliteModule\nFecExportService"]
        M_Cabinet["CabinetModule\nPortefeuilleService"]
    end

    MW --> Guards --> RLS --> Pipe
    Pipe --> M_Invoices
    Pipe --> M_Sales
    Pipe --> M_Payroll
    Pipe --> M_Tax
    Pipe --> M_Cabinet
```

---

## 2. Cycle de Vie d'une Requête Authentifiée

1. **Extraction de la Signature JWT** : Le middleware valide la présence de l'en-tête `Authorization: Bearer <TOKEN>`.
2. **Contrôle d'Authenticité** : `JwtStrategy` vérifie la validité cryptographique du token via `JWT_SECRET`. Le payload décodé est attaché à l'objet `request.user`.
3. **Contrôle des Privilèges RBAC** : `PermissionsGuard` compare les permissions exigées par `@Permissions(...)` sur la route avec celles du profil utilisateur. En cas d'inadéquation, un statut `HTTP 403 Forbidden` est retourné sans exécuter le contrôleur.
4. **Verrouillage de l'Isolation RLS** : `TenantRlsInterceptor` transmet à la connexion PostgreSQL active la commande `SET LOCAL app.current_tenant_id = request.user.tenantId`.
5. **Assainissement des Données** : `ValidationPipe` désérialise et valide le corps de la requête selon les règles définies dans le DTO.
6. **Exécution du Service Métier** : La logique applicative s'exécute dans un contexte totalement hermétique.
