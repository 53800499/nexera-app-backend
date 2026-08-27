import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

export async function seedNdfData(prisma: PrismaClient) {
  console.log('--- Seeding Notes de Frais (M5) Reference Data ---');

  // 1. Catégories de Dépenses Standard
  const categories = [
    {
      code: 'TRANSPORT',
      libelle: 'Frais de transport & déplacements',
      compteSyscohadaDefaut: '6251',
      tvaRecuperableParDefaut: true,
      tauxTvaParDefaut: 18,
      justificatifObligatoire: true,
    },
    {
      code: 'HEBERGEMENT',
      libelle: 'Hébergement & hôtel',
      compteSyscohadaDefaut: '6251',
      tvaRecuperableParDefaut: true,
      tauxTvaParDefaut: 18,
      justificatifObligatoire: true,
    },
    {
      code: 'RESTAURATION',
      libelle: "Restauration & repas d'affaires",
      compteSyscohadaDefaut: '6257',
      tvaRecuperableParDefaut: true,
      tauxTvaParDefaut: 18,
      justificatifObligatoire: true,
    },
    {
      code: 'CARBURANT',
      libelle: 'Carburant & lubrifiants',
      compteSyscohadaDefaut: '6251',
      tvaRecuperableParDefaut: true,
      tauxTvaParDefaut: 18,
      justificatifObligatoire: true,
    },
    {
      code: 'PEAGE',
      libelle: 'Péage & stationnement',
      compteSyscohadaDefaut: '6251',
      tvaRecuperableParDefaut: true,
      tauxTvaParDefaut: 18,
      justificatifObligatoire: true,
    },
    {
      code: 'FOURNITURES',
      libelle: 'Petites fournitures de bureau & consommables',
      compteSyscohadaDefaut: '6051',
      tvaRecuperableParDefaut: true,
      tauxTvaParDefaut: 18,
      justificatifObligatoire: true,
    },
    {
      code: 'REPRESENTATION',
      libelle: 'Frais de réception & représentation',
      compteSyscohadaDefaut: '6257',
      tvaRecuperableParDefaut: true,
      tauxTvaParDefaut: 18,
      justificatifObligatoire: true,
    },
    {
      code: 'TELECOMMUNICATION',
      libelle: 'Téléphonie, Internet & communication',
      compteSyscohadaDefaut: '6281',
      tvaRecuperableParDefaut: true,
      tauxTvaParDefaut: 18,
      justificatifObligatoire: true,
    },
    {
      code: 'AUTRE',
      libelle: 'Autres frais professionnels justifiés',
      compteSyscohadaDefaut: '6258',
      tvaRecuperableParDefaut: true,
      tauxTvaParDefaut: 18,
      justificatifObligatoire: true,
    },
  ];

  for (const cat of categories) {
    const existing = await prisma.ndfCategorieDepense.findFirst({
      where: { paysCode: null, code: cat.code },
    });
    if (existing) {
      await prisma.ndfCategorieDepense.update({
        where: { id: existing.id },
        data: cat,
      });
    } else {
      await prisma.ndfCategorieDepense.create({
        data: {
          paysCode: null,
          ...cat,
        },
      });
    }
  }

  // 2. Paramètres Pays Bénin 2026
  const parametresPays = [
    {
      paysCode: 'BJ',
      codeParametre: 'SEUIL_PAIEMENT_ESPECES',
      libelle: 'Seuil légal de paiement en espèces (CGI Art. 21)',
      valeur: '100000',
      unite: 'XOF',
      texteReference: 'CGI Bénin 2026, Art. 21 & Art. 503',
      dateDebutValidite: new Date('2026-01-01T00:00:00Z'),
    },
    {
      paysCode: 'BJ',
      codeParametre: 'DELAI_MAX_SOUMISSION_JOURS',
      libelle: "Délai maximal de soumission d'une note de frais après la dépense",
      valeur: '30',
      unite: 'JOURS',
      texteReference: 'Règlement intérieur standard UEMOA',
      dateDebutValidite: new Date('2026-01-01T00:00:00Z'),
    },
  ];

  for (const param of parametresPays) {
    await prisma.ndfParametrePays.upsert({
      where: {
        paysCode_codeParametre_dateDebutValidite: {
          paysCode: param.paysCode,
          codeParametre: param.codeParametre,
          dateDebutValidite: param.dateDebutValidite,
        },
      },
      create: param,
      update: {
        libelle: param.libelle,
        valeur: param.valeur,
        unite: param.unite,
        texteReference: param.texteReference,
      },
    });
  }

  // 3. Barème Kilométrique Bénin 2026
  const baremesKm = [
    {
      paysCode: 'BJ',
      puissanceFiscaleMin: 1,
      puissanceFiscaleMax: 6,
      typeVehicule: 'VOITURE' as const,
      tauxParKm: 250,
      deviseCode: 'XOF',
      texteReference: 'Barème fiscal kilométrique Bénin 2026 (<= 6 CV)',
      dateDebutValidite: new Date('2026-01-01T00:00:00Z'),
    },
    {
      paysCode: 'BJ',
      puissanceFiscaleMin: 7,
      puissanceFiscaleMax: 10,
      typeVehicule: 'VOITURE' as const,
      tauxParKm: 350,
      deviseCode: 'XOF',
      texteReference: 'Barème fiscal kilométrique Bénin 2026 (7 à 10 CV)',
      dateDebutValidite: new Date('2026-01-01T00:00:00Z'),
    },
    {
      paysCode: 'BJ',
      puissanceFiscaleMin: 11,
      puissanceFiscaleMax: null,
      typeVehicule: 'VOITURE' as const,
      tauxParKm: 450,
      deviseCode: 'XOF',
      texteReference: 'Barème fiscal kilométrique Bénin 2026 (> 10 CV)',
      dateDebutValidite: new Date('2026-01-01T00:00:00Z'),
    },
    {
      paysCode: 'BJ',
      puissanceFiscaleMin: 1,
      puissanceFiscaleMax: null,
      typeVehicule: 'MOTO' as const,
      tauxParKm: 125,
      deviseCode: 'XOF',
      texteReference: 'Barème kilométrique motos Bénin 2026',
      dateDebutValidite: new Date('2026-01-01T00:00:00Z'),
    },
  ];

  for (const b of baremesKm) {
    const existing = await prisma.ndfBaremeKilometrique.findFirst({
      where: {
        paysCode: b.paysCode,
        typeVehicule: b.typeVehicule,
        puissanceFiscaleMin: b.puissanceFiscaleMin,
        dateDebutValidite: b.dateDebutValidite,
      },
    });
    if (existing) {
      await prisma.ndfBaremeKilometrique.update({
        where: { id: existing.id },
        data: b,
      });
    } else {
      await prisma.ndfBaremeKilometrique.create({
        data: b,
      });
    }
  }

  // 4. Barème Per Diem Bénin 2026
  const baremesPerDiem = [
    {
      paysCode: 'BJ',
      zoneGeographique: 'Cotonou & Grand Nokoué',
      categorieProfessionnelleLibelle: 'TOUTES',
      montantJour: 35000,
      deviseCode: 'XOF',
      couvreHebergement: false,
      couvreRestauration: true,
      dateDebutValidite: new Date('2026-01-01T00:00:00Z'),
    },
    {
      paysCode: 'BJ',
      zoneGeographique: 'Intérieur du Bénin (hors Littoral)',
      categorieProfessionnelleLibelle: 'TOUTES',
      montantJour: 25000,
      deviseCode: 'XOF',
      couvreHebergement: false,
      couvreRestauration: true,
      dateDebutValidite: new Date('2026-01-01T00:00:00Z'),
    },
    {
      paysCode: 'BJ',
      zoneGeographique: 'Sous-région UEMOA / CEDEAO',
      categorieProfessionnelleLibelle: 'TOUTES',
      montantJour: 75000,
      deviseCode: 'XOF',
      couvreHebergement: false,
      couvreRestauration: true,
      dateDebutValidite: new Date('2026-01-01T00:00:00Z'),
    },
    {
      paysCode: 'BJ',
      zoneGeographique: 'International (Hors Afrique de l’Ouest)',
      categorieProfessionnelleLibelle: 'TOUTES',
      montantJour: 150000,
      deviseCode: 'XOF',
      couvreHebergement: false,
      couvreRestauration: true,
      dateDebutValidite: new Date('2026-01-01T00:00:00Z'),
    },
  ];

  for (const p of baremesPerDiem) {
    const existing = await prisma.ndfBaremePerDiem.findFirst({
      where: {
        paysCode: p.paysCode,
        zoneGeographique: p.zoneGeographique,
        dateDebutValidite: p.dateDebutValidite,
      },
    });
    if (existing) {
      await prisma.ndfBaremePerDiem.update({
        where: { id: existing.id },
        data: p,
      });
    } else {
      await prisma.ndfBaremePerDiem.create({
        data: p,
      });
    }
  }

  // 5. Règles de Détection d'Anomalies Globales
  const reglesAnomalies = [
    {
      tenantId: null,
      typeRegle: 'DOUBLON_POTENTIEL' as const,
      seuilDeclenchement: { similarity_threshold_percent: 90, window_days: 2 },
      niveauSeverite: 'A_VERIFIER' as const,
      actif: true,
    },
    {
      tenantId: null,
      typeRegle: 'DEPASSEMENT_POLITIQUE' as const,
      seuilDeclenchement: { tolerance_percent: 0 },
      niveauSeverite: 'A_VERIFIER' as const,
      actif: true,
    },
    {
      tenantId: null,
      typeRegle: 'INCOHERENCE_DATE_MISSION' as const,
      seuilDeclenchement: { tolerance_days_before: 1, tolerance_days_after: 1 },
      niveauSeverite: 'BLOQUANT' as const,
      actif: true,
    },
    {
      tenantId: null,
      typeRegle: 'INCOHERENCE_GEOGRAPHIQUE' as const,
      seuilDeclenchement: { strict_city_match: false },
      niveauSeverite: 'A_VERIFIER' as const,
      actif: true,
    },
    {
      tenantId: null,
      typeRegle: 'MONTANT_INHABITUEL' as const,
      seuilDeclenchement: { deviation_factor: 2.5 },
      niveauSeverite: 'INFORMATIF' as const,
      actif: true,
    },
    {
      tenantId: null,
      typeRegle: 'FOURNISSEUR_A_RISQUE' as const,
      seuilDeclenchement: {},
      niveauSeverite: 'A_VERIFIER' as const,
      actif: true,
    },
    {
      tenantId: null,
      typeRegle: 'FRACTIONNEMENT_SUSPECT' as const,
      seuilDeclenchement: { window_days: 3, min_occurrences: 2 },
      niveauSeverite: 'A_VERIFIER' as const,
      actif: true,
    },
  ];

  for (const r of reglesAnomalies) {
    const existing = await prisma.ndfRegleDetectionAnomalie.findFirst({
      where: {
        tenantId: null,
        typeRegle: r.typeRegle,
      },
    });
    if (existing) {
      await prisma.ndfRegleDetectionAnomalie.update({
        where: { id: existing.id },
        data: r,
      });
    } else {
      await prisma.ndfRegleDetectionAnomalie.create({
        data: r,
      });
    }
  }

  // 6. Versions des Modèles IA de Référence
  const modelesIa = [
    {
      fonction: 'EXTRACTION_OCR' as const,
      nomModele: 'NEXERA_NDF_OCR',
      version: 'v1.0',
      dateMiseEnService: new Date('2026-01-01T00:00:00Z'),
    },
    {
      fonction: 'DETECTION_DOUBLON' as const,
      nomModele: 'NEXERA_NDF_DUPLICATE_DETECTOR',
      version: 'v1.0',
      dateMiseEnService: new Date('2026-01-01T00:00:00Z'),
    },
    {
      fonction: 'DETECTION_ANOMALIE' as const,
      nomModele: 'NEXERA_NDF_ANOMALY_ENGINE',
      version: 'v1.0',
      dateMiseEnService: new Date('2026-01-01T00:00:00Z'),
    },
    {
      fonction: 'CATEGORISATION' as const,
      nomModele: 'NEXERA_NDF_CATEGORIZER',
      version: 'v1.0',
      dateMiseEnService: new Date('2026-01-01T00:00:00Z'),
    },
  ];

  for (const m of modelesIa) {
    await prisma.ndfModeleIaVersion.upsert({
      where: {
        nomModele_version: {
          nomModele: m.nomModele,
          version: m.version,
        },
      },
      create: m,
      update: {
        dateMiseEnService: m.dateMiseEnService,
      },
    });
  }

  // 7. Connecteurs d'Échange Standard
  const connecteurs = [
    {
      code: 'EXP_CSV_SYSCOHADA',
      libelle: 'Export Écritures Notes de Frais CSV (SYSCOHADA)',
      sens: 'EXPORT' as const,
      format: 'CSV' as const,
      systemeTiersLibelle: 'ERP / Logiciel Comptable Tiers',
      actif: true,
    },
    {
      code: 'IMP_CSV_HISTORIQUE',
      libelle: 'Import Historique Notes de Frais CSV',
      sens: 'IMPORT' as const,
      format: 'CSV' as const,
      systemeTiersLibelle: 'Reprise de données historiques',
      actif: true,
    },
  ];

  for (const c of connecteurs) {
    await prisma.ndfConnecteurEchange.upsert({
      where: { code: c.code },
      create: c,
      update: {
        libelle: c.libelle,
        sens: c.sens,
        format: c.format,
        systemeTiersLibelle: c.systemeTiersLibelle,
        actif: c.actif,
      },
    });
  }

  console.log('✅ Notes de Frais (M5) Reference Data Seeded Successfully!');
}
