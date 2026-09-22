import type { Fiche } from "./types";

export const CULTURE_GENERALE_FICHES: Fiche[] = [
  {
    id: "culture-economie-indicateurs",
    domain: "culture-generale",
    title: "Économie — les indicateurs clés",
    tagline: "Trois notions qui reviennent dans presque toutes les questions d'économie.",
    readMinutes: 2,
    blocks: [
      {
        type: "keyfacts",
        title: "À connaître",
        items: [
          "Inflation : hausse générale et durable des prix, mesurée en France par l'indice des prix à la consommation (IPC).",
          "Taux directeurs : taux d'intérêt fixés par une banque centrale, qui influencent le coût du crédit dans toute l'économie — les remonter freine l'inflation, mais aussi la croissance.",
          "PIB (produit intérieur brut) : valeur totale des richesses produites par un pays sur une année — l'indicateur macroéconomique le plus cité pour mesurer l'activité économique.",
        ],
      },
      {
        type: "mnemonic",
        title: "Le lien entre les trois",
        body: "Quand l'inflation monte, la banque centrale relève souvent ses taux directeurs pour la freiner — mais des taux plus élevés ralentissent l'investissement des entreprises et donc, in fine, la croissance du PIB. Retiens cet enchaînement plutôt que chaque notion isolément.",
      },
    ],
  },
  {
    id: "culture-institutions",
    domain: "culture-generale",
    title: "Institutions à connaître",
    tagline: "BCE, CAC 40, AMF : trois acronymes, trois rôles bien distincts.",
    readMinutes: 2,
    blocks: [
      {
        type: "table",
        title: "Qui fait quoi",
        headers: ["Institution", "Rôle"],
        rows: [
          ["BCE", "Banque centrale européenne — fixe la politique monétaire de la zone euro, dont les taux directeurs."],
          ["CAC 40", "Indice boursier regroupant les 40 plus grandes capitalisations cotées à la Bourse de Paris — c'est un indicateur, pas une institution qui régule."],
          ["AMF", "Autorité des marchés financiers — régulateur français qui surveille les marchés financiers et protège les épargnants."],
        ],
      },
      {
        type: "warning",
        body: "Piège classique : confondre le CAC 40 (un indice, un thermomètre du marché) avec une autorité de régulation. C'est l'AMF qui régule en France, pas le CAC 40.",
      },
    ],
  },
  {
    id: "culture-entreprise-enjeux",
    domain: "culture-generale",
    title: "Actualité entreprise & grands enjeux",
    tagline: "Les thèmes qui reviennent en entretien de motivation IAE / SKEMA.",
    readMinutes: 2,
    blocks: [
      {
        type: "keyfacts",
        title: "Thèmes à suivre",
        items: [
          "Fusions-acquisitions récentes et résultats des grands groupes français (LVMH, TotalEnergies, Airbus…).",
          "Levées de fonds notables dans les secteurs en croissance.",
          "Transition écologique et son impact sur les modèles économiques des entreprises.",
          "Intelligence artificielle et transformation des métiers.",
          "Géopolitique et chaînes d'approvisionnement (relocalisation, dépendances stratégiques).",
        ],
      },
      {
        type: "mnemonic",
        title: "Comment en parler en entretien",
        body: "N'essaie pas de réciter des chiffres précis (ils datent vite) : montre plutôt que tu comprends le mécanisme (pourquoi cette entreprise a relocalisé, pourquoi ce secteur attire les investisseurs) — c'est ce qui impressionne un jury, pas la mémorisation de statistiques.",
      },
    ],
  },
  {
    id: "culture-methode-veille",
    domain: "culture-generale",
    title: "Méthode — comment réviser un domaine qui bouge vite",
    tagline: "Suivre un flux d'actu plutôt qu'apprendre une liste figée.",
    readMinutes: 1,
    blocks: [
      {
        type: "rule",
        title: "Le bon réflexe",
        body: "La culture générale business est un domaine qui évolue vite : une liste de faits appris par cœur aujourd'hui sera partiellement obsolète dans six mois. Mieux vaut suivre régulièrement un flux d'actualité économique (Les Échos, Le Figaro Économie…) que d'essayer de tout mémoriser d'un coup.",
      },
      {
        type: "mnemonic",
        title: "10 minutes par jour suffisent",
        body: "Quelques minutes de lecture d'actu chaque jour, avec un vrai effort pour reformuler ce que tu as compris (à voix haute ou par écrit), retiennent bien mieux qu'une session de révision intensive une fois par mois.",
      },
    ],
  },
];
