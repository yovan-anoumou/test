import type { Fiche } from "./types";

export const VOCABULAIRE_FICHES: Fiche[] = [
  {
    id: "vocabulaire-synonymie",
    domain: "vocabulaire",
    title: "Synonymie & cohérence",
    tagline: "Le sens ET la syntaxe doivent coller, pas seulement l'un des deux.",
    readMinutes: 2,
    blocks: [
      {
        type: "rule",
        title: "Synonymie",
        body: "Trouver le mot de même sens dans une liste de 5 propositions. Attention : le bon synonyme doit correspondre au sens précis employé dans la phrase, pas seulement au sens le plus courant du mot.",
      },
      {
        type: "rule",
        title: "Cohérence (phrase à trous)",
        body: "Le mot à choisir doit respecter le sens ET la syntaxe de la phrase. Un mot au sens parfait mais à la mauvaise nature grammaticale (adjectif au lieu d'un adverbe, par exemple) est un piège classique.",
      },
      {
        type: "mnemonic",
        title: "Le réflexe à avoir",
        body: "Relis toujours la phrase complète avec ton choix inséré avant de valider — l'oreille détecte souvent une incohérence syntaxique que l'œil seul avait laissée passer.",
      },
    ],
  },
  {
    id: "vocabulaire-locutions-latines",
    domain: "vocabulaire",
    title: "Locutions latines fréquentes",
    tagline: "7 expressions à connaître, avec une phrase pour chacune — plus facile à retenir qu'une définition sèche.",
    readMinutes: 3,
    blocks: [
      {
        type: "table",
        title: "Les 7 locutions",
        headers: ["Locution", "Sens"],
        rows: [
          ["a priori", "avant toute expérience, au premier abord"],
          ["ad hoc", "adapté spécialement à une situation précise"],
          ["a fortiori", "à plus forte raison"],
          ["de facto", "de fait, dans les faits (sans reconnaissance officielle)"],
          ["ex æquo", "à égalité de mérite ou de classement"],
          ["sine qua non", "condition absolument indispensable"],
          ["statu quo", "état actuel des choses, sans changement"],
        ],
      },
      {
        type: "example",
        title: "Les utiliser dans une phrase",
        prompt: "Comment utiliser « sine qua non » et « de facto » dans une phrase business ?",
        reveal:
          "« Un budget validé est une condition sine qua non au lancement du projet. » — « L'entreprise est devenue, de facto, le leader du marché, sans jamais l'avoir officiellement annoncé. »",
      },
      {
        type: "mnemonic",
        title: "Comment les mémoriser",
        body: "Associe chaque locution à une phrase concrète que tu pourrais vraiment prononcer, plutôt qu'à sa seule définition — c'est ce qui les fait rester en mémoire le plus longtemps.",
      },
    ],
  },
  {
    id: "vocabulaire-pieges",
    domain: "vocabulaire",
    title: "Pièges classiques : accords, homonymes, paronymes",
    tagline: "Des mots qui se ressemblent, mais qui n'ont rien à voir.",
    readMinutes: 2,
    blocks: [
      {
        type: "table",
        title: "Paronymes à ne pas confondre",
        headers: ["Mot", "Sens"],
        rows: [
          ["censé", "supposé (il est censé venir)"],
          ["sensé", "qui a du bon sens"],
          ["éminent", "remarquable, de haut rang"],
          ["imminent", "sur le point de se produire"],
          ["affectif", "relatif aux sentiments"],
          ["effectif", "réel, concret / le nombre de personnes"],
        ],
      },
      {
        type: "warning",
        body: "Les paronymes (mots proches par le son mais différents par le sens) sont le piège n°1 du sous-test vocabulaire. Ne te fie jamais à la sonorité, relis toujours le sens exact.",
      },
    ],
  },
  {
    id: "vocabulaire-comprehension-texte",
    domain: "vocabulaire",
    title: "Méthode — compréhension de texte",
    tagline: "L'ordre de lecture change tout : questions avant le texte.",
    readMinutes: 2,
    blocks: [
      {
        type: "mnemonic",
        title: "Lire les questions avant le texte",
        body: "Tu sais alors exactement quoi chercher pendant la lecture, au lieu de devoir relire le texte une deuxième fois une fois les questions découvertes. Ça fait gagner un temps précieux, la vraie contrainte de ce sous-test.",
      },
      {
        type: "rule",
        title: "Repérer les mots de liaison",
        body: "Ils indiquent la structure argumentative du texte : mais, cependant, en revanche (opposition) — par conséquent, donc (conséquence) — en effet, car (justification). Les questions portent très souvent exactement sur ces articulations logiques.",
      },
    ],
  },
];
