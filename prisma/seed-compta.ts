import { PrismaClient } from '@prisma/client';

export async function seedComptaData(prisma: PrismaClient, tenantId?: string) {
  console.log('--- SEEDING MODULE 3 COMPTABILITE (SYSCOHADA 2026) ---');

  // 1. PAYS RÉFÉRENTIEL (Bénin)
  const paysBenin = await (prisma as any).comptaPays.upsert({
    where: { codeIso: 'BJ' },
    update: {
      nomPays: 'République du Bénin',
      devisePrincipale: 'XOF',
      referentielComptable: 'SYSCOHADA',
      longueurMaxCompte: 13,
      dureeConservationAnnees: 10,
    },
    create: {
      codeIso: 'BJ',
      nomPays: 'République du Bénin',
      devisePrincipale: 'XOF',
      referentielComptable: 'SYSCOHADA',
      longueurMaxCompte: 13,
      dureeConservationAnnees: 10,
    },
  });

  // 2. SEUIL SYSTÈME COMPTABLE (SMT vs SN)
  const seuilExistant = await (prisma as any).comptaSeuilSystemeComptable.findFirst({
    where: { paysId: paysBenin.id },
  });

  if (!seuilExistant) {
    await (prisma as any).comptaSeuilSystemeComptable.create({
      data: {
        paysId: paysBenin.id,
        seuilCaSmt: 50000000, // 50 millions FCFA selon AUDCIF / CGI Bénin
        devise: 'XOF',
        dateDebutValidite: new Date('2024-01-01'),
      },
    });
  }

  // 3. PLAN COMPTABLE MODÈLE SYSCOHADA DE RÉFÉRENCE (Classes 1 à 9)
  const comptesModeles = [
    // --- CLASSE 1 : COMPTES DE RESSOURCES DURABLES ---
    { numero: '101', libelle: 'Capital social', classe: 1, nature: 'CREDIT', tiers: false },
    { numero: '102', libelle: 'Capital par dotation', classe: 1, nature: 'CREDIT', tiers: false },
    { numero: '103', libelle: 'Capital personnel', classe: 1, nature: 'CREDIT', tiers: false },
    { numero: '104', libelle: 'Compte de l’exploitant', classe: 1, nature: 'CREDIT', tiers: false },
    { numero: '105', libelle: 'Primes liées aux capitaux propres', classe: 1, nature: 'CREDIT', tiers: false },
    { numero: '106', libelle: 'Écarts de réévaluation', classe: 1, nature: 'CREDIT', tiers: false },
    { numero: '111', libelle: 'Réserve légale', classe: 1, nature: 'CREDIT', tiers: false },
    { numero: '112', libelle: 'Réserves statutaires ou contractuelles', classe: 1, nature: 'CREDIT', tiers: false },
    { numero: '113', libelle: 'Réserves réglementées', classe: 1, nature: 'CREDIT', tiers: false },
    { numero: '118', libelle: 'Autres réserves', classe: 1, nature: 'CREDIT', tiers: false },
    { numero: '121', libelle: 'Report à nouveau créditeur', classe: 1, nature: 'CREDIT', tiers: false },
    { numero: '129', libelle: 'Report à nouveau débiteur', classe: 1, nature: 'DEBIT', tiers: false },
    { numero: '1301', libelle: 'Résultat en instance d’affectation (Bénéfice)', classe: 1, nature: 'CREDIT', tiers: false },
    { numero: '1309', libelle: 'Résultat en instance d’affectation (Perte)', classe: 1, nature: 'DEBIT', tiers: false },
    { numero: '131', libelle: 'Résultat net : Bénéfice', classe: 1, nature: 'CREDIT', tiers: false },
    { numero: '139', libelle: 'Résultat net : Perte', classe: 1, nature: 'DEBIT', tiers: false },
    { numero: '141', libelle: 'Subventions d’équipement', classe: 1, nature: 'CREDIT', tiers: false },
    { numero: '151', libelle: 'Amortissements dérogatoires', classe: 1, nature: 'CREDIT', tiers: false },
    { numero: '161', libelle: 'Emprunts obligataires', classe: 1, nature: 'CREDIT', tiers: false },
    { numero: '162', libelle: 'Emprunts et dettes auprès des établissements de crédit', classe: 1, nature: 'CREDIT', tiers: false },
    { numero: '164', libelle: 'Avances reçues de l’État', classe: 1, nature: 'CREDIT', tiers: false },
    { numero: '166', libelle: 'Dettes de crédit-bail et contrats assimilés', classe: 1, nature: 'CREDIT', tiers: false },
    { numero: '171', libelle: 'Dettes rattachées à des participations', classe: 1, nature: 'CREDIT', tiers: false },
    { numero: '181', libelle: 'Dettes liées à des partenariats', classe: 1, nature: 'CREDIT', tiers: false },
    { numero: '191', libelle: 'Provisions pour litiges', classe: 1, nature: 'CREDIT', tiers: false },
    { numero: '195', libelle: 'Provisions pour charges à répartir sur plusieurs exercices', classe: 1, nature: 'CREDIT', tiers: false },

    // --- CLASSE 2 : COMPTES D’ACTIF IMMOBILISÉ ---
    { numero: '211', libelle: 'Frais de développement', classe: 2, nature: 'DEBIT', tiers: false },
    { numero: '212', libelle: 'Brevets, licences, concessions et droits similaires', classe: 2, nature: 'DEBIT', tiers: false },
    { numero: '213', libelle: 'Logiciels et sites internet', classe: 2, nature: 'DEBIT', tiers: false },
    { numero: '214', libelle: 'Marques, procédés, droits et valeurs similaires', classe: 2, nature: 'DEBIT', tiers: false },
    { numero: '215', libelle: 'Fonds commercial', classe: 2, nature: 'DEBIT', tiers: false },
    { numero: '218', libelle: 'Autres immobilisations incorporelles', classe: 2, nature: 'DEBIT', tiers: false },
    { numero: '221', libelle: 'Terrains agricoles et forestiers', classe: 2, nature: 'DEBIT', tiers: false },
    { numero: '222', libelle: 'Terrains nus', classe: 2, nature: 'DEBIT', tiers: false },
    { numero: '223', libelle: 'Terrains bâtis', classe: 2, nature: 'DEBIT', tiers: false },
    { numero: '231', libelle: 'Bâtiments industriels, agricoles, administratifs et commerciaux', classe: 2, nature: 'DEBIT', tiers: false },
    { numero: '232', libelle: 'Bâtiments d’habitation', classe: 2, nature: 'DEBIT', tiers: false },
    { numero: '241', libelle: 'Matériel et outillage industriel et commercial', classe: 2, nature: 'DEBIT', tiers: false },
    { numero: '242', libelle: 'Installations générales, agencements et aménagements', classe: 2, nature: 'DEBIT', tiers: false },
    { numero: '243', libelle: 'Matériel de transport', classe: 2, nature: 'DEBIT', tiers: false },
    { numero: '244', libelle: 'Matériel de bureau et matériel informatique', classe: 2, nature: 'DEBIT', tiers: false },
    { numero: '245', libelle: 'Mobilier de bureau', classe: 2, nature: 'DEBIT', tiers: false },
    { numero: '261', libelle: 'Titres de participation', classe: 2, nature: 'DEBIT', tiers: false },
    { numero: '271', libelle: 'Prêts et créances non commerciales', classe: 2, nature: 'DEBIT', tiers: false },
    { numero: '272', libelle: 'Prêts au personnel', classe: 2, nature: 'DEBIT', tiers: false },
    { numero: '275', libelle: 'Dépôts et cautionnements versés', classe: 2, nature: 'DEBIT', tiers: false },
    { numero: '281', libelle: 'Amortissements des immobilisations incorporelles', classe: 2, nature: 'CREDIT', tiers: false },
    { numero: '282', libelle: 'Amortissements des terrains', classe: 2, nature: 'CREDIT', tiers: false },
    { numero: '283', libelle: 'Amortissements des bâtiments', classe: 2, nature: 'CREDIT', tiers: false },
    { numero: '284', libelle: 'Amortissements du matériel', classe: 2, nature: 'CREDIT', tiers: false },
    { numero: '291', libelle: 'Dépréciations des immobilisations incorporelles', classe: 2, nature: 'CREDIT', tiers: false },
    { numero: '294', libelle: 'Dépréciations du matériel', classe: 2, nature: 'CREDIT', tiers: false },

    // --- CLASSE 3 : COMPTES DE STOCKS ---
    { numero: '311', libelle: 'Marchandises A', classe: 3, nature: 'DEBIT', tiers: false },
    { numero: '312', libelle: 'Marchandises B', classe: 3, nature: 'DEBIT', tiers: false },
    { numero: '321', libelle: 'Matières premières', classe: 3, nature: 'DEBIT', tiers: false },
    { numero: '322', libelle: 'Fournitures consommables', classe: 3, nature: 'DEBIT', tiers: false },
    { numero: '331', libelle: 'Produits en cours', classe: 3, nature: 'DEBIT', tiers: false },
    { numero: '361', libelle: 'Produits finis', classe: 3, nature: 'DEBIT', tiers: false },
    { numero: '371', libelle: 'Produits intermédiaires', classe: 3, nature: 'DEBIT', tiers: false },
    { numero: '381', libelle: 'Marchandises en cours de route', classe: 3, nature: 'DEBIT', tiers: false },
    { numero: '391', libelle: 'Dépréciations des stocks de marchandises', classe: 3, nature: 'CREDIT', tiers: false },
    { numero: '392', libelle: 'Dépréciations des matières premières', classe: 3, nature: 'CREDIT', tiers: false },

    // --- CLASSE 4 : COMPTES DE TIERS (avec auxiliaires alphanumériques autorisés) ---
    { numero: '401', libelle: 'Fournisseurs, dettes en compte', classe: 4, nature: 'CREDIT', tiers: true },
    { numero: '402', libelle: 'Fournisseurs, effets à payer', classe: 4, nature: 'CREDIT', tiers: true },
    { numero: '404', libelle: 'Fournisseurs d’immobilisations', classe: 4, nature: 'CREDIT', tiers: true },
    { numero: '408', libelle: 'Fournisseurs, factures non parvenues', classe: 4, nature: 'CREDIT', tiers: true },
    { numero: '409', libelle: 'Fournisseurs débiteurs : avances et acomptes', classe: 4, nature: 'DEBIT', tiers: true },
    { numero: '411', libelle: 'Clients', classe: 4, nature: 'DEBIT', tiers: true },
    { numero: '412', libelle: 'Clients, effets à recevoir', classe: 4, nature: 'DEBIT', tiers: true },
    { numero: '414', libelle: 'Créances sur cessions d’immobilisations', classe: 4, nature: 'DEBIT', tiers: true },
    { numero: '416', libelle: 'Créances douteuses ou litigieuses', classe: 4, nature: 'DEBIT', tiers: true },
    { numero: '418', libelle: 'Clients, factures à établir', classe: 4, nature: 'DEBIT', tiers: true },
    { numero: '419', libelle: 'Clients créditeurs : avances et acomptes reçus', classe: 4, nature: 'CREDIT', tiers: true },
    { numero: '421', libelle: 'Personnel, rémunérations dues', classe: 4, nature: 'CREDIT', tiers: true },
    { numero: '422', libelle: 'Personnel, œuvres sociales', classe: 4, nature: 'CREDIT', tiers: true },
    { numero: '423', libelle: 'Personnel, oppositions et saisies-arrêts', classe: 4, nature: 'CREDIT', tiers: true },
    { numero: '425', libelle: 'Personnel, avances et acomptes', classe: 4, nature: 'DEBIT', tiers: true },
    { numero: '428', libelle: 'Personnel, charges à payer et congés payés', classe: 4, nature: 'CREDIT', tiers: true },
    { numero: '431', libelle: 'Sécurité sociale (CNSS)', classe: 4, nature: 'CREDIT', tiers: true },
    { numero: '432', libelle: 'Caisses de retraite complémentaire', classe: 4, nature: 'CREDIT', tiers: true },
    { numero: '438', libelle: 'Organismes sociaux, charges à payer', classe: 4, nature: 'CREDIT', tiers: true },
    { numero: '441', libelle: 'État, subventions à recevoir', classe: 4, nature: 'DEBIT', tiers: true },
    { numero: '442', libelle: 'État, autres impôts et taxes recouvrables', classe: 4, nature: 'DEBIT', tiers: true },
    { numero: '443', libelle: 'État, TVA facturée sur ventes', classe: 4, nature: 'CREDIT', tiers: true },
    { numero: '444', libelle: 'État, impôts sur les bénéfices (IS)', classe: 4, nature: 'CREDIT', tiers: true },
    { numero: '445', libelle: 'État, TVA déductible', classe: 4, nature: 'DEBIT', tiers: true },
    { numero: '447', libelle: 'État, impôts retenus à la source (AIB / ITS)', classe: 4, nature: 'CREDIT', tiers: true },
    { numero: '448', libelle: 'État, charges à payer et versements restant à effectuer', classe: 4, nature: 'CREDIT', tiers: true },
    { numero: '449', libelle: 'État, créances et crédits d’impôt', classe: 4, nature: 'DEBIT', tiers: true },
    { numero: '451', libelle: 'Associés, comptes courants', classe: 4, nature: 'CREDIT', tiers: true },
    { numero: '461', libelle: 'Apporteurs, opérations sur le capital', classe: 4, nature: 'DEBIT', tiers: true },
    { numero: '471', libelle: 'Comptes d’attente débiteurs ou créditeurs', classe: 4, nature: 'DEBIT', tiers: false },
    { numero: '481', libelle: 'Charges constatées d’avance', classe: 4, nature: 'DEBIT', tiers: false },
    { numero: '482', libelle: 'Produits constatés d’avance', classe: 4, nature: 'CREDIT', tiers: false },
    { numero: '491', libelle: 'Dépréciations des comptes clients', classe: 4, nature: 'CREDIT', tiers: true },

    // --- CLASSE 5 : COMPTES DE TRÉSORERIE ---
    { numero: '501', libelle: 'Titres de placement', classe: 5, nature: 'DEBIT', tiers: false },
    { numero: '511', libelle: 'Valeurs à l’encaissement (chèques et effets)', classe: 5, nature: 'DEBIT', tiers: false },
    { numero: '521', libelle: 'Banques locales', classe: 5, nature: 'DEBIT', tiers: false },
    { numero: '531', libelle: 'Caisse principale', classe: 5, nature: 'DEBIT', tiers: false },
    { numero: '541', libelle: 'Régies d’avances et accréditifs', classe: 5, nature: 'DEBIT', tiers: false },
    { numero: '561', libelle: 'Crédits de trésorerie (Découvert bancaire)', classe: 5, nature: 'CREDIT', tiers: false },
    { numero: '571', libelle: 'Virements internes de fonds', classe: 5, nature: 'DEBIT', tiers: false },
    { numero: '581', libelle: 'Fonds en cours de transfert', classe: 5, nature: 'DEBIT', tiers: false },
    { numero: '591', libelle: 'Dépréciations des titres de placement', classe: 5, nature: 'CREDIT', tiers: false },

    // --- CLASSE 6 : COMPTES DE CHARGES DES ACTIVITÉS ORDINAIRES ---
    { numero: '601', libelle: 'Achats de marchandises', classe: 6, nature: 'DEBIT', tiers: false },
    { numero: '602', libelle: 'Achats de matières premières et fournitures liées', classe: 6, nature: 'DEBIT', tiers: false },
    { numero: '603', libelle: 'Variations des stocks de biens achetés', classe: 6, nature: 'DEBIT', tiers: false },
    { numero: '604', libelle: 'Achats d’études, prestations de services et travaux', classe: 6, nature: 'DEBIT', tiers: false },
    { numero: '605', libelle: 'Autres achats de fournitures consommables', classe: 6, nature: 'DEBIT', tiers: false },
    { numero: '608', libelle: 'Rabais, remises et ristournes obtenus sur achats', classe: 6, nature: 'CREDIT', tiers: false },
    { numero: '611', libelle: 'Transports sur achats', classe: 6, nature: 'DEBIT', tiers: false },
    { numero: '612', libelle: 'Transports sur ventes', classe: 6, nature: 'DEBIT', tiers: false },
    { numero: '613', libelle: 'Transports pour le compte de tiers', classe: 6, nature: 'DEBIT', tiers: false },
    { numero: '614', libelle: 'Transports du personnel', classe: 6, nature: 'DEBIT', tiers: false },
    { numero: '616', libelle: 'Voyages, missions et déplacements', classe: 6, nature: 'DEBIT', tiers: false },
    { numero: '621', libelle: 'Sous-traitance générale', classe: 6, nature: 'DEBIT', tiers: false },
    { numero: '622', libelle: 'Locations et charges locatives', classe: 6, nature: 'DEBIT', tiers: false },
    { numero: '624', libelle: 'Entretiens, réparations et maintenance', classe: 6, nature: 'DEBIT', tiers: false },
    { numero: '625', libelle: 'Primes d’assurance', classe: 6, nature: 'DEBIT', tiers: false },
    { numero: '626', libelle: 'Études, recherches et documentation', classe: 6, nature: 'DEBIT', tiers: false },
    { numero: '627', libelle: 'Publicité, publications et relations publiques', classe: 6, nature: 'DEBIT', tiers: false },
    { numero: '628', libelle: 'Télécommunications, internet et frais postaux', classe: 6, nature: 'DEBIT', tiers: false },
    { numero: '631', libelle: 'Services bancaires et d’assimilation', classe: 6, nature: 'DEBIT', tiers: false },
    { numero: '632', libelle: 'Rémunérations d’intermédiaires et honoraires', classe: 6, nature: 'DEBIT', tiers: false },
    { numero: '633', libelle: 'Frais de formation du personnel', classe: 6, nature: 'DEBIT', tiers: false },
    { numero: '638', libelle: 'Autres charges externes', classe: 6, nature: 'DEBIT', tiers: false },
    { numero: '641', libelle: 'Impôts et taxes directs (Patente, TPS, etc.)', classe: 6, nature: 'DEBIT', tiers: false },
    { numero: '642', libelle: 'Impôts et taxes indirects', classe: 6, nature: 'DEBIT', tiers: false },
    { numero: '645', libelle: 'Taxes sur les véhicules de société', classe: 6, nature: 'DEBIT', tiers: false },
    { numero: '646', libelle: 'Droits d’enregistrement et de timbre', classe: 6, nature: 'DEBIT', tiers: false },
    { numero: '651', libelle: 'Pertes sur créances clients irrécouvrables', classe: 6, nature: 'DEBIT', tiers: false },
    { numero: '658', libelle: 'Autres charges de gestion courante', classe: 6, nature: 'DEBIT', tiers: false },
    { numero: '661', libelle: 'Rémunérations directes versées au personnel national', classe: 6, nature: 'DEBIT', tiers: false },
    { numero: '662', libelle: 'Rémunérations versées aux dirigeants et administrateurs', classe: 6, nature: 'DEBIT', tiers: false },
    { numero: '663', libelle: 'Indemnités forfaitaires et avantages en nature', classe: 6, nature: 'DEBIT', tiers: false },
    { numero: '664', libelle: 'Charges sociales patronales (CNSS)', classe: 6, nature: 'DEBIT', tiers: false },
    { numero: '667', libelle: 'Rémunération du personnel intérimaire ou prêté', classe: 6, nature: 'DEBIT', tiers: false },
    { numero: '671', libelle: 'Intérêts des emprunts et dettes financières', classe: 6, nature: 'DEBIT', tiers: false },
    { numero: '676', libelle: 'Pertes de change sur opérations financières', classe: 6, nature: 'DEBIT', tiers: false },
    { numero: '681', libelle: 'Dotations aux amortissements d’exploitation', classe: 6, nature: 'DEBIT', tiers: false },
    { numero: '691', libelle: 'Dotations aux dépréciations d’exploitation', classe: 6, nature: 'DEBIT', tiers: false },

    // --- CLASSE 7 : COMPTES DE PRODUITS DES ACTIVITÉS ORDINAIRES ---
    { numero: '701', libelle: 'Ventes de marchandises', classe: 7, nature: 'CREDIT', tiers: false },
    { numero: '702', libelle: 'Ventes de produits finis', classe: 7, nature: 'CREDIT', tiers: false },
    { numero: '703', libelle: 'Ventes de produits intermédiaires', classe: 7, nature: 'CREDIT', tiers: false },
    { numero: '704', libelle: 'Ventes de travaux et chantiers', classe: 7, nature: 'CREDIT', tiers: false },
    { numero: '705', libelle: 'Ventes d’études', classe: 7, nature: 'CREDIT', tiers: false },
    { numero: '706', libelle: 'Prestations de services vendues', classe: 7, nature: 'CREDIT', tiers: false },
    { numero: '707', libelle: 'Produits accessoires (ports, emballages, etc.)', classe: 7, nature: 'CREDIT', tiers: false },
    { numero: '708', libelle: 'Rabais, remises et ristournes accordés sur ventes', classe: 7, nature: 'DEBIT', tiers: false },
    { numero: '711', libelle: 'Subventions d’exploitation reçues', classe: 7, nature: 'CREDIT', tiers: false },
    { numero: '721', libelle: 'Production immobilisée incorporelle', classe: 7, nature: 'CREDIT', tiers: false },
    { numero: '722', libelle: 'Production immobilisée corporelle', classe: 7, nature: 'CREDIT', tiers: false },
    { numero: '731', libelle: 'Variation des stocks de biens produits', classe: 7, nature: 'CREDIT', tiers: false },
    { numero: '751', libelle: 'Profits sur opérations de gestion', classe: 7, nature: 'CREDIT', tiers: false },
    { numero: '752', libelle: 'Quotes-parts de résultat sur opérations faites en commun', classe: 7, nature: 'CREDIT', tiers: false },
    { numero: '771', libelle: 'Intérêts de prêts et créances diverses', classe: 7, nature: 'CREDIT', tiers: false },
    { numero: '776', libelle: 'Gains de change sur créances et dettes commerciales', classe: 7, nature: 'CREDIT', tiers: false },
    { numero: '781', libelle: 'Reprises d’amortissements et de dépréciations', classe: 7, nature: 'CREDIT', tiers: false },

    // --- CLASSE 8 : COMPTES DES CHARGES & PRODUITS HORS ACTIVITÉS ORDINAIRES (HAO) ---
    { numero: '811', libelle: 'Valeurs comptables des cessions d’immobilisations incorporelles', classe: 8, nature: 'DEBIT', tiers: false },
    { numero: '812', libelle: 'Valeurs comptables des cessions d’immobilisations corporelles', classe: 8, nature: 'DEBIT', tiers: false },
    { numero: '821', libelle: 'Produits des cessions d’immobilisations incorporelles', classe: 8, nature: 'CREDIT', tiers: false },
    { numero: '822', libelle: 'Produits des cessions d’immobilisations corporelles', classe: 8, nature: 'CREDIT', tiers: false },
    { numero: '831', libelle: 'Charges HAO constatées (pénalités, amendes)', classe: 8, nature: 'DEBIT', tiers: false },
    { numero: '841', libelle: 'Produits HAO constatés (dons, libéralités reçus)', classe: 8, nature: 'CREDIT', tiers: false },
    { numero: '851', libelle: 'Dotations HAO aux amortissements et provisions', classe: 8, nature: 'DEBIT', tiers: false },
    { numero: '871', libelle: 'Participation des travailleurs aux bénéfices', classe: 8, nature: 'DEBIT', tiers: false },
    { numero: '891', libelle: 'Impôts sur les sociétés (IS de l’exercice)', classe: 8, nature: 'DEBIT', tiers: false },

    // --- CLASSE 9 : COMPTES DES ENGAGEMENTS & ANALYTIQUE ---
    { numero: '901', libelle: 'Engagements donnés (Avals, cautions, garanties)', classe: 9, nature: 'DEBIT', tiers: false },
    { numero: '902', libelle: 'Engagements reçus (Garanties reçues)', classe: 9, nature: 'CREDIT', tiers: false },
  ];

  console.log(`Seeding ${comptesModeles.length} comptes de référence SYSCOHADA...`);
  for (const c of comptesModeles) {
    const existing = await (prisma as any).comptaPlanComptableModele.findFirst({
      where: { paysId: paysBenin.id, numeroCompte: c.numero },
    });

    if (!existing) {
      await (prisma as any).comptaPlanComptableModele.create({
        data: {
          paysId: paysBenin.id,
          numeroCompte: c.numero,
          libelle: c.libelle,
          classe: c.classe,
          nature: c.nature as any,
          compteCollectifTiers: c.tiers,
          dateDebutValidite: new Date('2024-01-01'),
        },
      });
    }
  }

  // 4. SI UN TENANT EST FOURNI (OU TOUS LES TENANTS COMPAGNIE), INITIALISER LE PLAN PAR DÉFAUT & LES JOURNAUX
  const tenants = tenantId
    ? await prisma.tenant.findMany({ where: { id: tenantId } })
    : await prisma.tenant.findMany({ where: { type: 'company' } });

  console.log(`Initialisation de l'environnement comptable pour ${tenants.length} tenant(s)...`);

  for (const tenant of tenants) {
    // A. Journaux standards obligatoires
    const defaultJournals = [
      { code: 'VE', libelle: 'Journal des Ventes', type: 'VENTES', system: false, modSource: 'M1' },
      { code: 'AC', libelle: 'Journal des Achats', type: 'ACHATS', system: false, modSource: 'M1' },
      { code: 'BQ', libelle: 'Journal de Banque', type: 'BANQUE', system: false, modSource: 'M1' },
      { code: 'CAI', libelle: 'Journal de Caisse', type: 'CAISSE', system: false, modSource: 'M1' },
      { code: 'OD', libelle: 'Journal des Opérations Diverses', type: 'OD', system: true, modSource: 'M3' },
      { code: 'AN', libelle: 'Journal des À-Nouveaux', type: 'A_NOUVEAUX', system: true, modSource: 'M3' },
      { code: 'PAIE', libelle: 'Journal des Salaires & Charges Sociales', type: 'PAIE', system: false, modSource: 'M4' },
    ];

    for (const j of defaultJournals) {
      await (prisma as any).comptaJournal.upsert({
        where: {
          tenantId_codeJournal: {
            tenantId: tenant.id,
            codeJournal: j.code,
          },
        },
        update: {
          libelle: j.libelle,
          typeJournal: j.type as any,
          journalSysteme: j.system,
          moduleSourceDefaut: j.modSource,
        },
        create: {
          tenantId: tenant.id,
          codeJournal: j.code,
          libelle: j.libelle,
          typeJournal: j.type as any,
          journalSysteme: j.system,
          moduleSourceDefaut: j.modSource,
        },
      });
    }

    // B. Activer les comptes clés du modèle pour le tenant
    const modeles = await (prisma as any).comptaPlanComptableModele.findMany({
      where: { paysId: paysBenin.id },
    });

    for (const m of modeles) {
      await (prisma as any).comptaCompte.upsert({
        where: {
          tenantId_numeroCompte: {
            tenantId: tenant.id,
            numeroCompte: m.numeroCompte,
          },
        },
        update: {
          libelle: m.libelle,
          classe: m.classe,
          modeleId: m.id,
        },
        create: {
          tenantId: tenant.id,
          modeleId: m.id,
          numeroCompte: m.numeroCompte,
          libelle: m.libelle,
          classe: m.classe,
          statut: 'ACTIF',
          mouvemente: false,
        },
      });
    }

    // C. Rattacher le compte 521 au journal BQ et 531 au journal CAI
    const compte521 = await (prisma as any).comptaCompte.findUnique({
      where: { tenantId_numeroCompte: { tenantId: tenant.id, numeroCompte: '521' } },
    });
    if (compte521) {
      await (prisma as any).comptaJournal.updateMany({
        where: { tenantId: tenant.id, codeJournal: 'BQ' },
        data: { compteTresorerieId: compte521.id },
      });
    }

    const compte531 = await (prisma as any).comptaCompte.findUnique({
      where: { tenantId_numeroCompte: { tenantId: tenant.id, numeroCompte: '531' } },
    });
    if (compte531) {
      await (prisma as any).comptaJournal.updateMany({
        where: { tenantId: tenant.id, codeJournal: 'CAI' },
        data: { compteTresorerieId: compte531.id },
      });
    }

    // D. Exercice en cours 2026 et périodes 2026-01 à 2026-12
    const annee = 2026;
    let exercice = await (prisma as any).comptaExercice.findFirst({
      where: {
        tenantId: tenant.id,
        dateDebut: new Date(`${annee}-01-01`),
      },
    });

    if (!exercice) {
      exercice = await (prisma as any).comptaExercice.create({
        data: {
          tenantId: tenant.id,
          dateDebut: new Date(`${annee}-01-01`),
          dateFin: new Date(`${annee}-12-31`),
          statut: 'OUVERT',
          systemeComptable: 'SN',
        },
      });

      // Création des 12 périodes mensuelles
      for (let m = 1; m <= 12; m++) {
        const moisStr = m < 10 ? `0${m}` : `${m}`;
        await (prisma as any).comptaPeriode.create({
          data: {
            exerciceId: exercice.id,
            anneeMois: `${annee}-${moisStr}`,
            statut: 'OUVERTE',
          },
        });
      }
    }

    // E. Règles de comptabilisation par défaut pour les événements amont
    const journalVentes = await (prisma as any).comptaJournal.findUnique({
      where: { tenantId_codeJournal: { tenantId: tenant.id, codeJournal: 'VE' } },
    });
    const journalAchats = await (prisma as any).comptaJournal.findUnique({
      where: { tenantId_codeJournal: { tenantId: tenant.id, codeJournal: 'AC' } },
    });
    const journalBanque = await (prisma as any).comptaJournal.findUnique({
      where: { tenantId_codeJournal: { tenantId: tenant.id, codeJournal: 'BQ' } },
    });
    const journalPaie = await (prisma as any).comptaJournal.findUnique({
      where: { tenantId_codeJournal: { tenantId: tenant.id, codeJournal: 'PAIE' } },
    });
    const journalOd = await (prisma as any).comptaJournal.findUnique({
      where: { tenantId_codeJournal: { tenantId: tenant.id, codeJournal: 'OD' } },
    });

    const compte411 = await (prisma as any).comptaCompte.findUnique({
      where: { tenantId_numeroCompte: { tenantId: tenant.id, numeroCompte: '411' } },
    });
    const compte701 = await (prisma as any).comptaCompte.findUnique({
      where: { tenantId_numeroCompte: { tenantId: tenant.id, numeroCompte: '701' } },
    });
    const compte401 = await (prisma as any).comptaCompte.findUnique({
      where: { tenantId_numeroCompte: { tenantId: tenant.id, numeroCompte: '401' } },
    });
    const compte601 = await (prisma as any).comptaCompte.findUnique({
      where: { tenantId_numeroCompte: { tenantId: tenant.id, numeroCompte: '601' } },
    });
    const compte661 = await (prisma as any).comptaCompte.findUnique({
      where: { tenantId_numeroCompte: { tenantId: tenant.id, numeroCompte: '661' } },
    });
    const compte421 = await (prisma as any).comptaCompte.findUnique({
      where: { tenantId_numeroCompte: { tenantId: tenant.id, numeroCompte: '421' } },
    });

    // Règle Facturation Vente
    if (journalVentes && compte411 && compte701) {
      const regleExiste = await (prisma as any).comptaRegleComptabilisation.findFirst({
        where: { tenantId: tenant.id, typeEvenement: 'invoice.issued' },
      });
      if (!regleExiste) {
        await (prisma as any).comptaRegleComptabilisation.create({
          data: {
            tenantId: tenant.id,
            paysId: paysBenin.id,
            typeEvenement: 'invoice.issued',
            journalCibleId: journalVentes.id,
            compteDebitId: compte411.id,
            compteCreditId: compte701.id,
            niveauSpecificite: 1,
            actif: true,
          },
        });
      }
    }

    // Règle Encaissement Vente
    if (journalBanque && compte521 && compte411) {
      const regleExiste = await (prisma as any).comptaRegleComptabilisation.findFirst({
        where: { tenantId: tenant.id, typeEvenement: 'payment.received' },
      });
      if (!regleExiste) {
        await (prisma as any).comptaRegleComptabilisation.create({
          data: {
            tenantId: tenant.id,
            paysId: paysBenin.id,
            typeEvenement: 'payment.received',
            journalCibleId: journalBanque.id,
            compteDebitId: compte521.id,
            compteCreditId: compte411.id,
            niveauSpecificite: 1,
            actif: true,
          },
        });
      }
    }

    // Règle Paie validée
    if (journalPaie && compte661 && compte421) {
      const regleExiste = await (prisma as any).comptaRegleComptabilisation.findFirst({
        where: { tenantId: tenant.id, typeEvenement: 'rh.payroll.cycle_validated' },
      });
      if (!regleExiste) {
        await (prisma as any).comptaRegleComptabilisation.create({
          data: {
            tenantId: tenant.id,
            paysId: paysBenin.id,
            typeEvenement: 'rh.payroll.cycle_validated',
            journalCibleId: journalPaie.id,
            compteDebitId: compte661.id,
            compteCreditId: compte421.id,
            niveauSpecificite: 1,
            actif: true,
          },
        });
      }
    }
  }

  console.log('✅ Module 3 Comptabilité seedé avec succès.');
}
