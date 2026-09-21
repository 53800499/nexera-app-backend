import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

export async function seedRhData(prisma: PrismaClient) {
  console.log('--- Seeding RH & Paie Reference Data ---');

  // 1. Zone Réglementaire UEMOA
  const uemoaZone = await prisma.rhZoneReglementaire.upsert({
    where: { code: 'UEMOA' },
    create: {
      code: 'UEMOA',
      libelle: 'Union Économique et Monétaire Ouest-Africaine (OHADA/UEMOA)',
    },
    update: {
      libelle: 'Union Économique et Monétaire Ouest-Africaine (OHADA/UEMOA)',
    },
  });

  // 2. Pays : Bénin (BJ)
  const benin = await prisma.rhPays.upsert({
    where: { codeIso2: 'BJ' },
    create: {
      codeIso2: 'BJ',
      codeIso3: 'BEN',
      libelle: 'République du Bénin',
      zoneReglementaireId: uemoaZone.id,
      deviseCode: 'XOF',
      langueDefaut: 'fr-BJ',
      organismeSecuSocialeLibelle: 'Caisse Nationale de Sécurité Sociale (CNSS)',
      actif: true,
    },
    update: {
      libelle: 'République du Bénin',
      deviseCode: 'XOF',
      langueDefaut: 'fr-BJ',
      organismeSecuSocialeLibelle: 'Caisse Nationale de Sécurité Sociale (CNSS)',
      actif: true,
    },
  });

  // 3. Barème ITS Bénin 2026 (CGI 2026 Art. 125)
  const baremeIts = await prisma.rhBaremeIts.findFirst({
    where: { paysCode: 'BJ', codeImpot: 'ITS' },
  });

  let baremeItsId = baremeIts?.id;
  if (!baremeIts) {
    const createdBareme = await prisma.rhBaremeIts.create({
      data: {
        paysCode: 'BJ',
        codeImpot: 'ITS',
        libelle: 'Barème Progressif ITS Bénin 2026 (CGI Art. 125)',
        modeCalcul: 'PROGRESSIF_PAR_TRANCHE',
        periodiciteAssiette: 'MENSUELLE',
        dateDebutValidite: new Date('2026-01-01T00:00:00Z'),
      },
    });
    baremeItsId = createdBareme.id;
  }

  // Tranches ITS 2026
  const tranches = [
    { numero: 1, inf: 0, sup: 50000, taux: 0, deduction: 0 },
    { numero: 2, inf: 50001, sup: 130000, taux: 10, deduction: 5000 },
    { numero: 3, inf: 130001, sup: 280000, taux: 15, deduction: 11500 },
    { numero: 4, inf: 280001, sup: 530000, taux: 20, deduction: 25500 },
    { numero: 5, inf: 530001, sup: null, taux: 30, deduction: 78500 },
  ];

  if (baremeItsId) {
    for (const t of tranches) {
      const existingTranche = await prisma.rhBaremeItsTranche.findFirst({
        where: { baremeItsId, numeroTranche: t.numero },
      });
      if (!existingTranche) {
        await prisma.rhBaremeItsTranche.create({
          data: {
            baremeItsId,
            numeroTranche: t.numero,
            limiteInferieure: t.inf,
            limiteSuperieure: t.sup,
            taux: t.taux,
            montantDeductionFixe: t.deduction,
          },
        });
      }
    }
  }

  // 4. Cotisations Sociales & Patronales (CNSS & VPS 2026)
  const chargesSociales = [
    {
      code: 'CNSS_SALARIALE_RETRAITE',
      libelle: 'CNSS - Retraite (Part Salariale)',
      typeAssiette: 'SALAIRE_BRUT' as const,
      partSalariale: 'SALARIALE' as const,
      tauxSalarial: 3.6,
      tauxPatronal: 0,
      organisme: 'CNSS Bénin',
    },
    {
      code: 'CNSS_PATRONALE_FAMILLE',
      libelle: 'CNSS - Prestations Familiales (Part Patronale)',
      typeAssiette: 'SALAIRE_BRUT' as const,
      partSalariale: 'PATRONALE' as const,
      tauxSalarial: 0,
      tauxPatronal: 9.0,
      organisme: 'CNSS Bénin',
    },
    {
      code: 'CNSS_PATRONALE_RISQUES',
      libelle: 'CNSS - Accidents du Travail & Risques Pro (Part Patronale)',
      typeAssiette: 'SALAIRE_BRUT' as const,
      partSalariale: 'PATRONALE' as const,
      tauxSalarial: 0,
      tauxPatronal: 2.0,
      organisme: 'CNSS Bénin',
    },
    {
      code: 'CNSS_PATRONALE_RETRAITE',
      libelle: 'CNSS - Retraite (Part Patronale)',
      typeAssiette: 'SALAIRE_BRUT' as const,
      partSalariale: 'PATRONALE' as const,
      tauxSalarial: 0,
      tauxPatronal: 6.4,
      organisme: 'CNSS Bénin',
    },
    {
      code: 'VPS_PATRONAL_BENIN',
      libelle: 'Versement Patronal sur Salaires (VPS 4 % CGI 2026)',
      typeAssiette: 'SALAIRE_BRUT' as const,
      partSalariale: 'PATRONALE' as const,
      tauxSalarial: 0,
      tauxPatronal: 4.0,
      organisme: 'DGI Bénin',
    },
  ];

  for (const c of chargesSociales) {
    const existing = await prisma.rhTauxChargeSociale.findFirst({
      where: { paysCode: 'BJ', code: c.code },
    });
    if (!existing) {
      await prisma.rhTauxChargeSociale.create({
        data: {
          paysCode: 'BJ',
          code: c.code,
          libelle: c.libelle,
          typeAssiette: c.typeAssiette,
          partSalariale: c.partSalariale,
          tauxSalarial: c.tauxSalarial,
          tauxPatronal: c.tauxPatronal,
          organismeCollecteur: c.organisme,
          dateDebutValidite: new Date('2026-01-01T00:00:00Z'),
          actif: true,
        },
      });
    }
  }

  // 5. Paramètres Pays Bénin
  const parametresPays = [
    {
      code: 'SMIG_MENSUEL',
      libelle: 'Salaire Minimum Interprofessionnel Garanti (SMIG)',
      typeValeur: 'NOMBRE' as const,
      valeurNum: 52000,
    },
    {
      code: 'DUREE_HEBDO_LEGALE',
      libelle: 'Durée légale hebdomadaire de travail (heures)',
      typeValeur: 'NOMBRE' as const,
      valeurNum: 40,
    },
    {
      code: 'TAUX_HS_TRANCHE_1',
      libelle: 'Taux de majoration heures supplémentaires 41e-48e h (%)',
      typeValeur: 'NOMBRE' as const,
      valeurNum: 15,
    },
    {
      code: 'TAUX_HS_TRANCHE_2',
      libelle: 'Taux de majoration heures supplémentaires > 48h (%)',
      typeValeur: 'NOMBRE' as const,
      valeurNum: 50,
    },
    {
      code: 'TAUX_HS_NUIT',
      libelle: 'Taux de majoration heures de nuit 21h-5h (%)',
      typeValeur: 'NOMBRE' as const,
      valeurNum: 50,
    },
    {
      code: 'TAUX_HS_DIMANCHE_FERIE',
      libelle: 'Taux de majoration dimanches et fériés de jour (%)',
      typeValeur: 'NOMBRE' as const,
      valeurNum: 50,
    },
    {
      code: 'ACQUISITION_CONGES_MOIS',
      libelle: 'Droits à congés payés par mois de service (jours ouvrables)',
      typeValeur: 'NOMBRE' as const,
      valeurNum: 2,
    },
  ];

  for (const p of parametresPays) {
    const existing = await prisma.rhParametrePays.findFirst({
      where: { paysCode: 'BJ', codeParametre: p.code },
    });
    if (!existing) {
      await prisma.rhParametrePays.create({
        data: {
          paysCode: 'BJ',
          codeParametre: p.code,
          libelle: p.libelle,
          typeValeur: p.typeValeur,
          valeurNumerique: p.valeurNum,
          dateDebutValidite: new Date('2026-01-01T00:00:00Z'),
        },
      });
    }
  }

  // 6. Jours Fériés 2026 (Bénin)
  const joursFeries2026 = [
    { date: '2026-01-01', libelle: "Jour de l'An" },
    { date: '2026-01-10', libelle: 'Fête du Vodoun' },
    { date: '2026-04-06', libelle: 'Lundi de Pâques' },
    { date: '2026-05-01', libelle: 'Fête du Travail' },
    { date: '2026-05-14', libelle: 'Ascension' },
    { date: '2026-05-25', libelle: 'Lundi de Pentecôte' },
    { date: '2026-08-01', libelle: 'Fête Nationale de l’Indépendance' },
    { date: '2026-08-15', libelle: 'Assomption' },
    { date: '2026-11-01', libelle: 'Toussaint' },
    { date: '2026-12-25', libelle: 'Noël' },
  ];

  for (const jf of joursFeries2026) {
    const dateObj = new Date(`${jf.date}T00:00:00Z`);
    const existing = await prisma.rhJourFerie.findFirst({
      where: { paysCode: 'BJ', dateJour: dateObj },
    });
    if (!existing) {
      await prisma.rhJourFerie.create({
        data: {
          paysCode: 'BJ',
          dateJour: dateObj,
          libelle: jf.libelle,
          estChomePaye: true,
          annee: 2026,
        },
      });
    }
  }

  // 7. Convention Collective Générale du Travail
  const convCollective = await prisma.rhConventionCollective.upsert({
    where: { paysCode_code: { paysCode: 'BJ', code: 'CCGT_BENIN' } },
    create: {
      paysCode: 'BJ',
      code: 'CCGT_BENIN',
      libelle: 'Convention Collective Générale du Travail (CCGT Bénin)',
      secteurActivite: 'Interprofessionnel',
      actif: true,
    },
    update: {
      libelle: 'Convention Collective Générale du Travail (CCGT Bénin)',
    },
  });

  // Catégories professionnelles
  const categories = [
    {
      code: 'CAT_1_OUVRIER',
      libelle: 'Ouvrier / Employé - 1er Échelon (Exécution)',
      niveau: 'Catégorie 1',
      essaiMois: 1,
      preavisMois: 1,
      salaireMin: 52000,
    },
    {
      code: 'CAT_2_EMPLOYE_QUALIFIE',
      libelle: 'Employé Qualifié / Spécialisé',
      niveau: 'Catégorie 2',
      essaiMois: 1,
      preavisMois: 1,
      salaireMin: 65000,
    },
    {
      code: 'CAT_3_AGENT_MAITRISE',
      libelle: 'Agent de Maîtrise / Technicien',
      niveau: 'Catégorie 3',
      essaiMois: 2,
      preavisMois: 2,
      salaireMin: 110000,
    },
    {
      code: 'CAT_4_CADRE_MOYEN',
      libelle: 'Cadre Moyen / Ingénieur',
      niveau: 'Catégorie 4',
      essaiMois: 3,
      preavisMois: 3,
      salaireMin: 180000,
    },
    {
      code: 'CAT_5_CADRE_SUPERIEUR',
      libelle: 'Cadre Supérieur / Directeur de Département',
      niveau: 'Catégorie 5',
      essaiMois: 3,
      preavisMois: 3,
      salaireMin: 350000,
    },
  ];

  for (const cat of categories) {
    const catModel = await prisma.rhCategorieProfessionnelle.upsert({
      where: {
        conventionCollectiveId_code: {
          conventionCollectiveId: convCollective.id,
          code: cat.code,
        },
      },
      create: {
        conventionCollectiveId: convCollective.id,
        code: cat.code,
        libelle: cat.libelle,
        niveauEchelon: cat.niveau,
        dureeHebdoLegale: 40,
        dureeEssaiMaxMois: cat.essaiMois,
        preavisDemissionMois: cat.preavisMois,
        preavisLicenciementMois: cat.preavisMois,
        actif: true,
      },
      update: {
        libelle: cat.libelle,
        dureeEssaiMaxMois: cat.essaiMois,
        preavisDemissionMois: cat.preavisMois,
        preavisLicenciementMois: cat.preavisMois,
      },
    });

    const existingGrille = await prisma.rhGrilleSalariale.findFirst({
      where: { categorieId: catModel.id },
    });
    if (!existingGrille) {
      await prisma.rhGrilleSalariale.create({
        data: {
          categorieId: catModel.id,
          salaireMinimumMensuel: cat.salaireMin,
          dateDebutValidite: new Date('2026-01-01T00:00:00Z'),
        },
      });
    }
  }

  // 8. Types d'absence
  const typesAbsence = [
    {
      code: 'CONGE_PAYE',
      libelle: 'Congé Payé Annuel',
      cat: 'CONGE_PAYE' as const,
      deduit: true,
      remunere: true,
      taux: 100,
      justif: false,
    },
    {
      code: 'MALADIE',
      libelle: 'Maladie Ordinaire (Arrêt de travail)',
      cat: 'MALADIE' as const,
      deduit: false,
      remunere: true,
      taux: 100,
      justif: true,
      delai: 2,
    },
    {
      code: 'MATERNITE',
      libelle: 'Congé de Maternité (14 semaines)',
      cat: 'MATERNITE' as const,
      deduit: false,
      remunere: true,
      taux: 100,
      justif: true,
      dureeMax: 98,
    },
    {
      code: 'PATERNITE',
      libelle: 'Congé de Paternité',
      cat: 'PATERNITE' as const,
      deduit: false,
      remunere: true,
      taux: 100,
      justif: true,
      dureeMax: 3,
    },
    {
      code: 'MARIAGE_SALARIE',
      libelle: 'Événement Familial : Mariage du salarié (3 jours)',
      cat: 'EVENEMENT_FAMILIAL' as const,
      deduit: false,
      remunere: true,
      taux: 100,
      justif: true,
      dureeMax: 3,
    },
    {
      code: 'DECES_CONJOINT_ENFANT',
      libelle: 'Événement Familial : Décès conjoint / enfant (3 jours)',
      cat: 'EVENEMENT_FAMILIAL' as const,
      deduit: false,
      remunere: true,
      taux: 100,
      justif: true,
      dureeMax: 3,
    },
    {
      code: 'CONGE_SANS_SOLDE',
      libelle: 'Congé Sans Solde',
      cat: 'CONGE_SANS_SOLDE' as const,
      deduit: false,
      remunere: false,
      taux: 0,
      justif: false,
    },
    {
      code: 'ABSENCE_INJUSTIFIEE',
      libelle: 'Absence Injustifiée',
      cat: 'AUTRE' as const,
      deduit: false,
      remunere: false,
      taux: 0,
      justif: false,
    },
  ];

  for (const ta of typesAbsence) {
    await prisma.rhTypeAbsence.upsert({
      where: { paysCode_code: { paysCode: 'BJ', code: ta.code } },
      create: {
        paysCode: 'BJ',
        code: ta.code,
        libelle: ta.libelle,
        categorieAbsence: ta.cat,
        deduitSoldeConge: ta.deduit,
        estRemunere: ta.remunere,
        tauxMaintienSalaire: ta.taux,
        justificatifObligatoire: ta.justif,
        delaiFournitureJustificatifJours: ta.delai || null,
        dureeMaximaleJours: ta.dureeMax || null,
        actif: true,
      },
      update: {
        libelle: ta.libelle,
        categorieAbsence: ta.cat,
        deduitSoldeConge: ta.deduit,
        estRemunere: ta.remunere,
        tauxMaintienSalaire: ta.taux,
      },
    });
  }

  // 9. Catalogue des Rubriques de Paie (SYSCOHADA)
  const rubriques = [
    {
      code: 'R100',
      libelle: 'Salaire de Base',
      type: 'GAIN_BRUT' as const,
      sens: 'GAIN' as const,
      its: true,
      cnss: true,
      vps: true,
      ordre: 10,
      cptCharge: '661100',
    },
    {
      code: 'R110',
      libelle: 'Heures Supplémentaires (15 %)',
      type: 'GAIN_BRUT' as const,
      sens: 'GAIN' as const,
      its: true,
      cnss: true,
      vps: true,
      ordre: 20,
      cptCharge: '661100',
    },
    {
      code: 'R120',
      libelle: 'Heures Supplémentaires (50 %)',
      type: 'GAIN_BRUT' as const,
      sens: 'GAIN' as const,
      its: true,
      cnss: true,
      vps: true,
      ordre: 25,
      cptCharge: '661100',
    },
    {
      code: 'R130',
      libelle: 'Indemnité Compensatrice de Congés Payés',
      type: 'GAIN_BRUT' as const,
      sens: 'GAIN' as const,
      its: true,
      cnss: true,
      vps: true,
      ordre: 27,
      cptCharge: '661500',
    },
    {
      code: 'R135',
      libelle: 'Indemnité Compensatrice de Préavis',
      type: 'GAIN_BRUT' as const,
      sens: 'GAIN' as const,
      its: true,
      cnss: true,
      vps: true,
      ordre: 28,
      cptCharge: '663100',
    },
    {
      code: 'R140',
      libelle: 'Indemnité de Licenciement / Rupture',
      type: 'INDEMNITE_NON_IMPOSABLE' as const,
      sens: 'GAIN' as const,
      its: false,
      cnss: false,
      vps: false,
      ordre: 29,
      cptCharge: '663200',
    },
    {
      code: 'R150',
      libelle: 'Prime d’Ancienneté',
      type: 'GAIN_BRUT' as const,
      sens: 'GAIN' as const,
      its: true,
      cnss: true,
      vps: true,
      ordre: 30,
      cptCharge: '661200',
    },
    {
      code: 'R160',
      libelle: 'Prime de Responsabilité',
      type: 'GAIN_BRUT' as const,
      sens: 'GAIN' as const,
      its: true,
      cnss: true,
      vps: true,
      ordre: 35,
      cptCharge: '661200',
    },
    {
      code: 'R170',
      libelle: 'Prime de Rendement / Performance',
      type: 'GAIN_BRUT' as const,
      sens: 'GAIN' as const,
      its: true,
      cnss: true,
      vps: true,
      ordre: 40,
      cptCharge: '661200',
    },
    {
      code: 'R180',
      libelle: 'Gratification / 13ème Mois (Quotient)',
      type: 'GAIN_BRUT' as const,
      sens: 'GAIN' as const,
      its: true,
      cnss: true,
      vps: true,
      ordre: 45,
      cptCharge: '661200',
    },
    {
      code: 'R200',
      libelle: 'Indemnité Forfaitaire de Transport',
      type: 'INDEMNITE_NON_IMPOSABLE' as const,
      sens: 'GAIN' as const,
      its: false,
      cnss: false,
      vps: false,
      ordre: 50,
      cptCharge: '661800',
    },
    {
      code: 'R210',
      libelle: 'Indemnité de Logement Exonérée / Forfaitaire',
      type: 'INDEMNITE_NON_IMPOSABLE' as const,
      sens: 'GAIN' as const,
      its: false,
      cnss: false,
      vps: false,
      ordre: 55,
      cptCharge: '661800',
    },
    {
      code: 'R300',
      libelle: 'Avantage en Nature Logement (CGI Art. 123)',
      type: 'AVANTAGE_EN_NATURE' as const,
      sens: 'GAIN' as const,
      its: true,
      cnss: true,
      vps: true,
      ordre: 60,
      cptCharge: '661800',
    },
    {
      code: 'R310',
      libelle: 'Avantage en Nature Véhicule (CGI Art. 123)',
      type: 'AVANTAGE_EN_NATURE' as const,
      sens: 'GAIN' as const,
      its: true,
      cnss: true,
      vps: true,
      ordre: 65,
      cptCharge: '661800',
    },
    {
      code: 'R500',
      libelle: 'Cotisation CNSS Retraite Salariale (3.6 %)',
      type: 'RETENUE_SALARIALE_CNSS' as const,
      sens: 'RETENUE' as const,
      its: false,
      cnss: false,
      vps: false,
      ordre: 100,
      cptTiers: '431100',
    },
    {
      code: 'R550',
      libelle: 'Impôt sur Traitements et Salaires (ITS Bénin 2026)',
      type: 'RETENUE_FISCALE_ITS' as const,
      sens: 'RETENUE' as const,
      its: false,
      cnss: false,
      vps: false,
      ordre: 110,
      cptTiers: '447100',
    },
    {
      code: 'R600',
      libelle: 'CNSS Patronale Prestations Familiales (9 %)',
      type: 'CHARGE_PATRONALE_CNSS' as const,
      sens: 'INFORMATION' as const,
      its: false,
      cnss: false,
      vps: false,
      ordre: 200,
      cptCharge: '664100',
      cptTiers: '431100',
    },
    {
      code: 'R610',
      libelle: 'CNSS Patronale Risques Professionnels (2 %)',
      type: 'CHARGE_PATRONALE_CNSS' as const,
      sens: 'INFORMATION' as const,
      its: false,
      cnss: false,
      vps: false,
      ordre: 210,
      cptCharge: '664100',
      cptTiers: '431100',
    },
    {
      code: 'R620',
      libelle: 'CNSS Patronale Retraite (6.4 %)',
      type: 'CHARGE_PATRONALE_CNSS' as const,
      sens: 'INFORMATION' as const,
      its: false,
      cnss: false,
      vps: false,
      ordre: 220,
      cptCharge: '664100',
      cptTiers: '431100',
    },
    {
      code: 'R650',
      libelle: 'Versement Patronal sur Salaires (VPS 4 %)',
      type: 'CHARGE_PATRONALE_VPS' as const,
      sens: 'INFORMATION' as const,
      its: false,
      cnss: false,
      vps: false,
      ordre: 230,
      cptCharge: '664200',
      cptTiers: '447200',
    },
    {
      code: 'R700',
      libelle: 'Avance / Acompte sur Salaire',
      type: 'RETENUE_NETTE_AUTRE' as const,
      sens: 'RETENUE' as const,
      its: false,
      cnss: false,
      vps: false,
      ordre: 300,
      cptTiers: '421000',
    },
    {
      code: 'R710',
      libelle: 'Remboursement Prêt Entreprise',
      type: 'RETENUE_NETTE_AUTRE' as const,
      sens: 'RETENUE' as const,
      its: false,
      cnss: false,
      vps: false,
      ordre: 310,
      cptTiers: '421000',
    },
    {
      code: 'R900',
      libelle: 'Net à Payer Salarié',
      type: 'GAIN_NET_NON_IMPOSABLE' as const,
      sens: 'INFORMATION' as const,
      its: false,
      cnss: false,
      vps: false,
      ordre: 999,
      cptTiers: '422000',
    },
  ];

  for (const r of rubriques) {
    await prisma.rhRubriquePaie.upsert({
      where: { paysCode_code: { paysCode: 'BJ', code: r.code } },
      create: {
        paysCode: 'BJ',
        code: r.code,
        libelle: r.libelle,
        typeRubrique: r.type,
        sensDefaut: r.sens,
        assujettiIts: r.its,
        assujettiCnss: r.cnss,
        assujettiVps: r.vps,
        ordreAffichage: r.ordre,
        compteComptableCharge: r.cptCharge || null,
        compteComptableTiers: r.cptTiers || null,
        actif: true,
      },
      update: {
        libelle: r.libelle,
        typeRubrique: r.type,
        sensDefaut: r.sens,
        assujettiIts: r.its,
        assujettiCnss: r.cnss,
        assujettiVps: r.vps,
        ordreAffichage: r.ordre,
        compteComptableCharge: r.cptCharge || null,
        compteComptableTiers: r.cptTiers || null,
      },
    });
  }

  console.log('✅ RH & Paie Reference Data Seeded Successfully!');
}
