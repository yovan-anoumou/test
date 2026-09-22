import type { Fiche } from "./types";

export const CALCUL_FICHES: Fiche[] = [
  {
    id: "calcul-pourcentages",
    domain: "calcul",
    title: "Pourcentages",
    tagline: "La source n°1 de points perdus bêtement au TAGE 2.",
    readMinutes: 3,
    blocks: [
      {
        type: "rule",
        title: "Appliquer un pourcentage",
        body: "Hausse de t % : valeur × (1 + t/100). Baisse de t % : valeur × (1 − t/100). Toujours multiplier, jamais additionner ou soustraire le pourcentage brut à la valeur.",
      },
      {
        type: "warning",
        body: "Des pourcentages successifs ne s'additionnent JAMAIS. +10 % puis +10 % ne fait pas +20 %, mais ×1,10 × 1,10 = +21 %.",
      },
      {
        type: "diagram",
        kind: "percent-chain",
      },
      {
        type: "rule",
        title: "Retrouver la valeur de départ",
        body: "Si le prix final est 120 après +20 %, la valeur initiale est 120 ÷ 1,2 = 100 — jamais 120 − 20 %. On divise toujours par (1 + t/100), on ne soustrait jamais t % du résultat final.",
      },
      {
        type: "rule",
        title: "Taux d'évolution",
        body: "(valeur finale − valeur initiale) ÷ valeur initiale × 100. C'est la formule à ressortir dès qu'on te donne deux valeurs et qu'on te demande « de combien a évolué… ».",
      },
      {
        type: "example",
        title: "Pourcentages successifs",
        prompt: "Un article à 80 € subit +15 % puis −10 %. Quel est le prix final ?",
        reveal:
          "80 × 1,15 × 0,9 = 82,80 €. Le piège classique est de faire 80 × 1,05 (en croyant que +15 % − 10 % = +5 %) : c'est faux, il faut enchaîner les deux multiplications, pas les additionner.",
      },
      {
        type: "mnemonic",
        title: "Le réflexe à avoir",
        body: "Dès que tu vois « puis » entre deux pourcentages, pense chaîne de multiplications, pas addition.",
      },
    ],
  },
  {
    id: "calcul-fractions",
    domain: "calcul",
    title: "Fractions & proportionnalité",
    tagline: "Le produit en croix : l'outil le plus utilisé du sous-test calcul.",
    readMinutes: 2,
    blocks: [
      {
        type: "rule",
        title: "Produit en croix",
        body: "a/b = c/d ⇔ a × d = b × c. C'est la technique la plus rentable du sous-test calcul : dès que tu vois deux rapports égaux (ou à comparer), croise-les.",
      },
      {
        type: "rule",
        title: "Additionner des fractions",
        body: "Il faut le même dénominateur (utilise le PPCM quand c'est possible, sinon multiplie simplement les deux dénominateurs entre eux).",
      },
      {
        type: "mnemonic",
        title: "Comparer deux fractions vite",
        body: "Pas besoin de calculer les décimales : fais directement le produit en croix. Si a×d > b×c alors a/b > c/d.",
      },
      {
        type: "example",
        title: "Proportionnalité",
        prompt: "Une recette pour 4 personnes utilise 250 g de farine. Il en faut combien pour 7 personnes ?",
        reveal:
          "250/4 = x/7 → produit en croix : 4x = 250 × 7 = 1750 → x = 437,5 g.",
      },
    ],
  },
  {
    id: "calcul-equations",
    domain: "calcul",
    title: "Équations",
    tagline: "2nd degré et systèmes à 2 inconnues : deux classiques à automatiser.",
    readMinutes: 3,
    blocks: [
      {
        type: "rule",
        title: "Équation du second degré",
        body: "ax² + bx + c = 0 → calcule Δ = b² − 4ac.",
      },
      {
        type: "keyfacts",
        title: "Lire le discriminant",
        items: [
          "Δ > 0 → deux solutions réelles : x = (−b ± √Δ) / 2a",
          "Δ = 0 → une seule solution : x = −b / 2a",
          "Δ < 0 → aucune solution réelle",
        ],
      },
      {
        type: "rule",
        title: "Système à deux inconnues",
        body: "Substitution si un coefficient vaut 1 (isole une variable, remplace dans l'autre ligne). Sinon, combinaison linéaire : multiplie une ou deux lignes pour faire disparaître une inconnue par addition ou soustraction.",
      },
      {
        type: "example",
        title: "Système par combinaison",
        prompt: "2x + y = 14 et x − y = 1. Trouve x et y.",
        reveal:
          "Les deux lignes s'additionnent directement (le y disparaît) : 3x = 15 → x = 5. En remplaçant dans x − y = 1 : y = 4.",
      },
    ],
  },
  {
    id: "calcul-puissances",
    domain: "calcul",
    title: "Puissances — les carrés à savoir par cœur",
    tagline: "Les reconnaître instantanément fait gagner un temps fou.",
    readMinutes: 2,
    blocks: [
      {
        type: "rule",
        title: "Pourquoi les apprendre",
        body: "Le sous-test calcul regorge de racines carrées et de factorisations qui se résolvent en 2 secondes si tu reconnais le carré, et en 30 secondes de calcul posé sinon.",
      },
      {
        type: "table",
        title: "Carrés de 11 à 20",
        headers: ["n", "n²", "n", "n²"],
        rows: [
          ["11", "121", "16", "256"],
          ["12", "144", "17", "289"],
          ["13", "169", "18", "324"],
          ["14", "196", "19", "361"],
          ["15", "225", "20", "400"],
        ],
      },
      {
        type: "mnemonic",
        title: "Deux ancrages faciles",
        body: "12² = 144, comme les 144 œufs d'une palette (12 douzaines). 15² = 225, un chiffre rond facile à retenir en plein milieu de la liste — utilise-le comme point de repère pour retrouver les voisins.",
      },
    ],
  },
  {
    id: "calcul-moyennes-vitesses",
    domain: "calcul",
    title: "Moyennes, taux, vitesses",
    tagline: "Le piège des effectifs différents revient à chaque session.",
    readMinutes: 2,
    blocks: [
      {
        type: "rule",
        title: "Moyenne pondérée",
        body: "Σ(valeur × poids) ÷ Σ(poids). Piège classique : si les effectifs (ou les poids) sont différents entre les groupes, tu ne peux jamais faire une simple moyenne des moyennes.",
      },
      {
        type: "rule",
        title: "Vitesse",
        body: "v = d / t (vitesse = distance ÷ temps). Conversion km/h → m/s : divise par 3,6. Conversion m/s → km/h : multiplie par 3,6.",
      },
      {
        type: "example",
        title: "Conversion de vitesse",
        prompt: "Une voiture roule à 90 km/h pendant 40 secondes. Quelle distance parcourt-elle ?",
        reveal:
          "90 km/h ÷ 3,6 = 25 m/s. Puis 25 × 40 = 1000 m = 1 km.",
      },
    ],
  },
  {
    id: "calcul-mental-astuces",
    domain: "calcul",
    title: "Astuces de calcul mental",
    tagline: "De quoi accélérer chaque question, pas seulement le sous-test calcul mental.",
    readMinutes: 2,
    blocks: [
      {
        type: "keyfacts",
        title: "Trois multiplications à automatiser",
        items: [
          "×5 : multiplie par 10 puis divise par 2.",
          "×11 (nombre à 2 chiffres) : additionne les deux chiffres et insère le résultat au milieu. Ex : 34 × 11 → 3+4=7 → 374.",
          "×9 : multiplie par 10 puis soustrais le nombre de départ. Ex : 27 × 9 = 270 − 27 = 243.",
        ],
      },
      {
        type: "rule",
        title: "La preuve par 9",
        body: "Pour vérifier un produit sans tout recalculer : réduis chaque facteur à un seul chiffre en additionnant ses chiffres (répète si besoin), multiplie ces deux chiffres réduits, réduis encore le résultat — il doit être égal à la réduction du produit final.",
      },
      {
        type: "mnemonic",
        title: "Le bon réflexe en session",
        body: "Sur le sous-test calcul mental, si un calcul te prend plus de 3 secondes de tête, c'est probablement qu'il existe une de ces astuces à appliquer plutôt que de poser l'opération.",
      },
    ],
  },
];
