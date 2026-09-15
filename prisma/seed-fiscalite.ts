import { PrismaClient } from '@prisma/client';

export async function seedFiscaliteData(prisma: PrismaClient, tenantId?: string) {
  console.log('--- SEEDING MODULE 7 FISCALITE (BENIN CGI 2026) ---');

  // 1. PAYS (Bénin)
  const paysBenin = await prisma.taxPays.upsert({
    where: { codeIso2: 'BJ' },
    update: {
      libelle: 'République du Bénin',
      deviseCode: 'XOF',
      administrationFiscaleLibelle: 'Direction Générale des Impôts',
      administrationFiscaleSigle: 'DGI',
      actif: true,
    },
    create: {
      codeIso2: 'BJ',
      libelle: 'République du Bénin',
      deviseCode: 'XOF',
      administrationFiscaleLibelle: 'Direction Générale des Impôts',
      administrationFiscaleSigle: 'DGI',
      actif: true,
    },
  });

  // 2. SOURCES RÉGLEMENTAIRES
  const sourceCgi2026 = await prisma.taxSourceReglementaire.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      paysCode: paysBenin.codeIso2,
      typeSource: 'CODE_GENERAL_IMPOTS',
      reference: 'CGI Bénin 2026',
      titre: 'Code Général des Impôts de la République du Bénin — Édition 2026',
      datePublication: new Date('2025-12-31'),
      dateEntreeVigueur: new Date('2026-01-01'),
      resume: 'Dispositions fiscales applicables au titre de la gestion 2026 : IS, TVA, AIB, TPS, Patente, Sanctions.',
      statutVeille: 'APPLIQUEE',
    },
  });

  const sourceArreteFec = await prisma.taxSourceReglementaire.upsert({
    where: { id: '00000000-0000-0000-0000-000000000002' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000002',
      paysCode: paysBenin.codeIso2,
      typeSource: 'ARRETE',
      reference: 'Arrêté n° 1085-C/MEF/CAB/SGM/DGI/DLC/159SGG20',
      titre: 'Modalités et normes de présentation du Fichier des Écritures Comptables (FEC)',
      datePublication: new Date('2020-04-23'),
      dateEntreeVigueur: new Date('2020-04-23'),
      resume: 'Normes de présentation du FEC à remettre à l’Administration fiscale au début d’une vérification de comptabilité (18 champs obligatoires, format CSV/TXT, tabulation ou point-virgule).',
      statutVeille: 'APPLIQUEE',
    },
  });

  const sourceCirculaireTva = await prisma.taxSourceReglementaire.upsert({
    where: { id: '00000000-0000-0000-0000-000000000003' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000003',
      paysCode: paysBenin.codeIso2,
      typeSource: 'CIRCULAIRE',
      reference: 'Circulaire DGI n° 004/2026',
      titre: 'Modalités de déclaration de TVA et suivi des déductions sur factures normalisées',
      datePublication: new Date('2026-01-15'),
      dateEntreeVigueur: new Date('2026-02-01'),
      resume: 'Obligation de justification de la TVA déductible par des factures normalisées certifiées et régularisation des crédits de TVA.',
      statutVeille: 'APPLIQUEE',
    },
  });

  // 3. TYPES D'IMPÔTS (tax_type)
  const typesData = [
    {
      code: 'IS',
      libelle: 'Impôt sur les Sociétés',
      categorie: 'IMPOT_RESULTAT' as const,
      periodiciteDeclarative: 'ANNUELLE' as const,
      modeCalcul: 'TAUX_UNIQUE' as const,
      texteReferenceDefaut: 'CGI 2026 Art. 46 à 51',
    },
    {
      code: 'TVA',
      libelle: 'Taxe sur la Valeur Ajoutée',
      categorie: 'TAXE_CHIFFRE_AFFAIRES' as const,
      periodiciteDeclarative: 'MENSUELLE' as const,
      modeCalcul: 'TAUX_UNIQUE' as const,
      texteReferenceDefaut: 'CGI 2026 Art. 241 à 259',
    },
    {
      code: 'AIB',
      libelle: 'Acompte sur Impôt assis sur les Bénéfices',
      categorie: 'RETENUE_SOURCE' as const,
      periodiciteDeclarative: 'MENSUELLE' as const,
      modeCalcul: 'TAUX_UNIQUE' as const,
      texteReferenceDefaut: 'CGI 2026 Art. 130 à 133',
    },
    {
      code: 'TPS',
      libelle: 'Taxe Professionnelle Synthétique',
      categorie: 'IMPOT_RESULTAT' as const,
      periodiciteDeclarative: 'TRIMESTRIELLE' as const,
      modeCalcul: 'FORMULE_SPECIFIQUE' as const,
      applicableRegimeSynthetique: true,
      texteReferenceDefaut: 'CGI 2026 Art. 178 à 190',
    },
    {
      code: 'PATENTE',
      libelle: 'Contribution des Patentes',
      categorie: 'TAXE_LOCALE' as const,
      periodiciteDeclarative: 'ANNUELLE' as const,
      modeCalcul: 'BAREME_PAR_TRANCHE_CA' as const,
      texteReferenceDefaut: 'CGI 2026 Art. 202 à 220',
    },
    {
      code: 'TFU',
      libelle: 'Taxe Foncière Unique',
      categorie: 'TAXE_PATRIMOINE' as const,
      periodiciteDeclarative: 'ANNUELLE' as const,
      modeCalcul: 'BAREME_PROGRESSIF' as const,
      texteReferenceDefaut: 'CGI 2026 Art. 270 à 285',
    },
    {
      code: 'DROIT_ENREGISTREMENT',
      libelle: 'Droits d’Enregistrement et de Timbre',
      categorie: 'DROIT_ENREGISTREMENT_TIMBRE' as const,
      periodiciteDeclarative: 'PONCTUELLE_EVENEMENT' as const,
      modeCalcul: 'TAUX_UNIQUE' as const,
      texteReferenceDefaut: 'CGI 2026 Livre 1 Titre 4',
    },
  ];

  const typesMap: Record<string, string> = {};

  for (const t of typesData) {
    const created = await prisma.taxType.upsert({
      where: {
        paysCode_code: {
          paysCode: paysBenin.codeIso2,
          code: t.code,
        },
      },
      update: {
        libelle: t.libelle,
        categorie: t.categorie,
        periodiciteDeclarative: t.periodiciteDeclarative,
        modeCalcul: t.modeCalcul,
        applicableRegimeSynthetique: t.applicableRegimeSynthetique ?? false,
        texteReferenceDefaut: t.texteReferenceDefaut,
      },
      create: {
        paysCode: paysBenin.codeIso2,
        code: t.code,
        libelle: t.libelle,
        categorie: t.categorie,
        periodiciteDeclarative: t.periodiciteDeclarative,
        modeCalcul: t.modeCalcul,
        applicableRegimeSynthetique: t.applicableRegimeSynthetique ?? false,
        texteReferenceDefaut: t.texteReferenceDefaut,
      },
    });
    typesMap[t.code] = created.id;
  }

  // 4. RÉGIMES D'IMPOSITION
  const regimesData = [
    {
      code: 'REEL_NORMAL',
      libelle: 'Régime du Réel Normal',
      seuilChiffreAffairesMax: null,
      obligationComptable: 'COMPTABILITE_COMPLETE' as const,
    },
    {
      code: 'REEL_SIMPLIFIE',
      libelle: 'Régime du Réel Simplifié',
      seuilChiffreAffairesMax: 50000000,
      obligationComptable: 'COMPTABILITE_ALLEGEE' as const,
    },
    {
      code: 'SYNTHETIQUE',
      libelle: 'Régime de la Taxe Professionnelle Synthétique (TPS)',
      seuilChiffreAffairesMax: 20000000,
      obligationComptable: 'AUCUNE' as const,
    },
  ];

  for (const r of regimesData) {
    await prisma.taxRegimeImposition.upsert({
      where: {
        paysCode_code: {
          paysCode: paysBenin.codeIso2,
          code: r.code,
        },
      },
      update: {
        libelle: r.libelle,
        seuilChiffreAffairesMax: r.seuilChiffreAffairesMax,
        obligationComptable: r.obligationComptable,
        dateDebutValidite: new Date('2026-01-01'),
      },
      create: {
        paysCode: paysBenin.codeIso2,
        code: r.code,
        libelle: r.libelle,
        seuilChiffreAffairesMax: r.seuilChiffreAffairesMax,
        obligationComptable: r.obligationComptable,
        dateDebutValidite: new Date('2026-01-01'),
      },
    });
  }

  // 5. BARÈMES FISCAUX
  // 5.1 Barème IS (Industriel / Écoles 25%)
  if (typesMap['IS']) {
    const isBaremeIndus = await prisma.taxBareme.create({
      data: {
        taxTypeId: typesMap['IS'],
        sourceReglementaireId: sourceCgi2026.id,
        libelle: 'Barème IS Bénin 2026 — Activités industrielles & Écoles privées',
        secteurActivite: 'industriel',
        tauxDefaut: 25.0,
        dateDebutValidite: new Date('2026-01-01'),
        statut: 'ACTIF',
      },
    });

    // 5.2 Barème IS (Autres personnes morales 30%)
    await prisma.taxBareme.create({
      data: {
        taxTypeId: typesMap['IS'],
        sourceReglementaireId: sourceCgi2026.id,
        libelle: 'Barème IS Bénin 2026 — Autres personnes morales (taux standard)',
        secteurActivite: 'autres',
        tauxDefaut: 30.0,
        dateDebutValidite: new Date('2026-01-01'),
        statut: 'ACTIF',
      },
    });
  }

  // 5.3 Barème TVA (18%)
  if (typesMap['TVA']) {
    await prisma.taxBareme.create({
      data: {
        taxTypeId: typesMap['TVA'],
        sourceReglementaireId: sourceCgi2026.id,
        libelle: 'Taux normal TVA Bénin 2026',
        tauxDefaut: 18.0,
        dateDebutValidite: new Date('2026-01-01'),
        statut: 'ACTIF',
      },
    });
  }

  // 5.4 Barèmes AIB (1%, 3%, 5%)
  if (typesMap['AIB']) {
    await prisma.taxBareme.create({
      data: {
        taxTypeId: typesMap['AIB'],
        sourceReglementaireId: sourceCgi2026.id,
        libelle: 'AIB 1% — Importations & Achats commerciaux / travaux par assujetti IFU',
        tauxDefaut: 1.0,
        dateDebutValidite: new Date('2026-01-01'),
        statut: 'ACTIF',
      },
    });

    await prisma.taxBareme.create({
      data: {
        taxTypeId: typesMap['AIB'],
        sourceReglementaireId: sourceCgi2026.id,
        libelle: 'AIB 3% — Prestations de services par personne immatriculée IFU',
        tauxDefaut: 3.0,
        dateDebutValidite: new Date('2026-01-01'),
        statut: 'ACTIF',
      },
    });

    await prisma.taxBareme.create({
      data: {
        taxTypeId: typesMap['AIB'],
        sourceReglementaireId: sourceCgi2026.id,
        libelle: 'AIB 5% — Opérations réalisées par personnes non immatriculées à l’IFU',
        tauxDefaut: 5.0,
        dateDebutValidite: new Date('2026-01-01'),
        statut: 'ACTIF',
      },
    });
  }

  // 5.5 Barème Patente par Tranche (1ère et 2ème zones)
  if (typesMap['PATENTE']) {
    const baremePatenteZone1 = await prisma.taxBareme.create({
      data: {
        taxTypeId: typesMap['PATENTE'],
        sourceReglementaireId: sourceCgi2026.id,
        libelle: 'Patente Bénin 2026 — 1ère zone administrative (Cotonou, Porto-Novo, etc.)',
        dateDebutValidite: new Date('2026-01-01'),
        statut: 'ACTIF',
      },
    });

    await prisma.taxBaremeTranche.createMany({
      data: [
        {
          taxBaremeId: baremePatenteZone1.id,
          ordre: 1,
          critereSecondaire: '1ère zone',
          borneMin: 0,
          borneMax: 1000000000,
          montantFixe: 70000,
        },
        {
          taxBaremeId: baremePatenteZone1.id,
          ordre: 2,
          critereSecondaire: '1ère zone',
          borneMin: 1000000001,
          borneMax: null,
          montantFixe: 10000, // +10 000 FCFA par milliard ou fraction supplémentaire
        },
      ],
    });

    const baremePatenteZone2 = await prisma.taxBareme.create({
      data: {
        taxTypeId: typesMap['PATENTE'],
        sourceReglementaireId: sourceCgi2026.id,
        libelle: 'Patente Bénin 2026 — 2ème zone administrative (Autres communes)',
        dateDebutValidite: new Date('2026-01-01'),
        statut: 'ACTIF',
      },
    });

    await prisma.taxBaremeTranche.createMany({
      data: [
        {
          taxBaremeId: baremePatenteZone2.id,
          ordre: 1,
          critereSecondaire: '2ème zone',
          borneMin: 0,
          borneMax: 1000000000,
          montantFixe: 60000,
        },
        {
          taxBaremeId: baremePatenteZone2.id,
          ordre: 2,
          critereSecondaire: '2ème zone',
          borneMin: 1000000001,
          borneMax: null,
          montantFixe: 10000,
        },
      ],
    });
  }

  // 6. PARAMÈTRES PAYS (tax_parametre_pays)
  const parametresData = [
    {
      code: 'IS_MINIMUM_PERCEPTION_STANDARD',
      libelle: 'Taux standard du minimum de perception d’IS (Art. 47 CGI)',
      typeValeur: 'NUMERIQUE' as const,
      valeur: '1',
      unite: '%',
    },
    {
      code: 'IS_MINIMUM_PERCEPTION_BTP',
      libelle: 'Taux minimum de perception d’IS secteur BTP (Art. 47 CGI)',
      typeValeur: 'NUMERIQUE' as const,
      valeur: '3',
      unite: '%',
    },
    {
      code: 'IS_MINIMUM_PERCEPTION_IMMOBILIER',
      libelle: 'Taux minimum de perception d’IS sociétés immobilières (Art. 47 CGI)',
      typeValeur: 'NUMERIQUE' as const,
      valeur: '10',
      unite: '%',
    },
    {
      code: 'IS_MINIMUM_PERCEPTION_PLANCHER',
      libelle: 'Plancher absolu du minimum de perception d’IS (Art. 47-3 CGI)',
      typeValeur: 'NUMERIQUE' as const,
      valeur: '250000',
      unite: 'FCFA',
    },
    {
      code: 'PENALITE_RETARD_DECLARATION_TAUX1',
      libelle: 'Pénalité pour défaut de déclaration dans les délais (Art. 485 CGI)',
      typeValeur: 'NUMERIQUE' as const,
      valeur: '20',
      unite: '%',
    },
    {
      code: 'PENALITE_RETARD_DECLARATION_TAUX2',
      libelle: 'Pénalité si non déposé sous 30j après mise en demeure (Art. 485 CGI)',
      typeValeur: 'NUMERIQUE' as const,
      valeur: '40',
      unite: '%',
    },
    {
      code: 'PENALITE_INSUFFISANCE_TAUX1',
      libelle: 'Pénalité pour inexactitude ou omission standard (Art. 486 CGI)',
      typeValeur: 'NUMERIQUE' as const,
      valeur: '20',
      unite: '%',
    },
    {
      code: 'PENALITE_INSUFFISANCE_TAUX2',
      libelle: 'Pénalité pour mauvaise foi ou inexactitude bénéfice réel (Art. 486 CGI)',
      typeValeur: 'NUMERIQUE' as const,
      valeur: '40',
      unite: '%',
    },
    {
      code: 'PENALITE_INSUFFISANCE_TAUX3',
      libelle: 'Pénalité pour manœuvres frauduleuses / taxation d’office (Art. 486 CGI)',
      typeValeur: 'NUMERIQUE' as const,
      valeur: '80',
      unite: '%',
    },
    {
      code: 'PENALITE_RETARD_PAIEMENT_TAUX',
      libelle: 'Pénalité pour retard de paiement d’impôt ou d’acompte (Art. 487 CGI)',
      typeValeur: 'NUMERIQUE' as const,
      valeur: '10',
      unite: '%',
    },
    {
      code: 'INTERET_RETARD_MENSUEL',
      libelle: 'Intérêt de retard mensuel légal (Art. 488 CGI)',
      typeValeur: 'NUMERIQUE' as const,
      valeur: '0.25',
      unite: '%',
    },
    {
      code: 'DELAI_PRESCRIPTION_FISCALE_ANNEES',
      libelle: 'Délai de reprise et de prescription de l’Administration fiscale',
      typeValeur: 'NUMERIQUE' as const,
      valeur: '3',
      unite: 'ans',
    },
  ];

  for (const p of parametresData) {
    await prisma.taxParametrePays.upsert({
      where: {
        paysCode_codeParametre_dateDebutValidite: {
          paysCode: paysBenin.codeIso2,
          codeParametre: p.code,
          dateDebutValidite: new Date('2026-01-01'),
        },
      },
      update: {
        libelle: p.libelle,
        typeValeur: p.typeValeur,
        valeur: p.valeur,
        unite: p.unite,
        sourceReglementaireId: sourceCgi2026.id,
      },
      create: {
        paysCode: paysBenin.codeIso2,
        codeParametre: p.code,
        libelle: p.libelle,
        typeValeur: p.typeValeur,
        valeur: p.valeur,
        unite: p.unite,
        sourceReglementaireId: sourceCgi2026.id,
        dateDebutValidite: new Date('2026-01-01'),
      },
    });
  }

  // 7. CALENDRIER ÉCHÉANCES TYPES
  if (typesMap['TVA']) {
    await prisma.taxCalendrierEcheanceType.create({
      data: {
        taxTypeId: typesMap['TVA'],
        libelle: 'Déclaration et paiement mensuel TVA (au plus tard le 10)',
        regleRecurrence: {
          frequence: 'mensuelle',
          jour_limite: 10,
          decalage_mois: 1,
        },
        dateDebutValidite: new Date('2026-01-01'),
      },
    });
  }

  if (typesMap['AIB']) {
    await prisma.taxCalendrierEcheanceType.create({
      data: {
        taxTypeId: typesMap['AIB'],
        libelle: 'Bordereau mensuel des retenues AIB (au plus tard le 10)',
        regleRecurrence: {
          frequence: 'mensuelle',
          jour_limite: 10,
          decalage_mois: 1,
        },
        dateDebutValidite: new Date('2026-01-01'),
      },
    });
  }

  if (typesMap['IS']) {
    await prisma.taxCalendrierEcheanceType.create({
      data: {
        taxTypeId: typesMap['IS'],
        libelle: 'Acomptes trimestriels d’IS (10 mars, 10 juin, 10 septembre, 10 décembre)',
        regleRecurrence: {
          frequence: 'trimestrielle',
          dates_fixes: ['03-10', '06-10', '09-10', '12-10'],
        },
        dateDebutValidite: new Date('2026-01-01'),
      },
    });

    await prisma.taxCalendrierEcheanceType.create({
      data: {
        taxTypeId: typesMap['IS'],
        libelle: 'Déclaration annuelle de résultat & Solde IS (au plus tard le 30 avril)',
        regleRecurrence: {
          frequence: 'annuelle',
          date_fixe: '04-30',
        },
        dateDebutValidite: new Date('2026-01-01'),
      },
    });
  }

  if (typesMap['PATENTE']) {
    await prisma.taxCalendrierEcheanceType.create({
      data: {
        taxTypeId: typesMap['PATENTE'],
        libelle: 'Déclaration et paiement de la Contribution des Patentes (30 avril)',
        regleRecurrence: {
          frequence: 'annuelle',
          date_fixe: '04-30',
        },
        dateDebutValidite: new Date('2026-01-01'),
      },
    });
  }

  console.log('--- SEED FISCALITE COMPLETED SUCCESSFULLY ---');
}
