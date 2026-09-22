import type { Fiche } from "./types";

export const ANGLAIS_FICHES: Fiche[] = [
  {
    id: "anglais-grammaire-prioritaire",
    domain: "anglais",
    title: "Grammaire TOEIC — les points prioritaires",
    tagline: "Ce qui revient le plus souvent dans les « Incomplete Sentences ».",
    readMinutes: 3,
    blocks: [
      {
        type: "keyfacts",
        title: "10 points à maîtriser en priorité",
        items: [
          "Voix passive vs active — qui SUBIT l'action détermine la voix à utiliser.",
          "Verbes modaux (must, should, might, can…) — chacun porte un degré d'obligation ou de certitude différent.",
          "Prépositions figées après un nom, un verbe ou un adjectif précis (ex : responsible FOR, interested IN) — ça s'apprend par cœur, pas par logique.",
          "Comparatifs et superlatifs — attention aux formes irrégulières (good → better → best).",
          "Gérondif vs infinitif (verbe + -ing vs verbe + to) — certains verbes n'acceptent que l'un des deux.",
          "Temps du présent, du passé et le futur — repère toujours le marqueur temporel dans la phrase (yesterday, next month, since…).",
          "Verbes à particules (phrasal verbs) — le sens change complètement selon la particule (look FOR ≠ look AFTER).",
          "Pronoms et adjectifs possessifs.",
          "Mots de liaison (however, therefore, although…) — ils indiquent la logique de la phrase (opposition, conséquence…).",
          "Question tags.",
        ],
      },
      {
        type: "mnemonic",
        title: "Le réflexe Part 5",
        body: "Avant de lire les 4 choix, repère d'abord la fonction du mot qui manque (verbe ? préposition ? connecteur ?) — ça élimine déjà la moitié des pièges sans même comparer les options entre elles.",
      },
    ],
  },
  {
    id: "anglais-vocabulaire-business",
    domain: "anglais",
    title: "Vocabulaire business — les 12 thèmes à couvrir",
    tagline: "Le TOEIC teste la vie professionnelle courante, pas la littérature.",
    readMinutes: 2,
    blocks: [
      {
        type: "keyfacts",
        title: "Les thèmes à réviser",
        items: [
          "Appels téléphoniques",
          "Achats et ventes",
          "Droit et fiscalité",
          "Entreprise et produit",
          "Vie d'entreprise",
          "Commercialisation et publicité",
          "Ressources humaines",
          "Banque et finances",
          "Immobilier",
          "Paiement",
          "Voyages d'affaires",
          "Transports",
        ],
      },
      {
        type: "mnemonic",
        title: "Comment réviser efficacement",
        body: "Priorise les emails, réunions, contrats et chiffres d'affaires — c'est exactement ce que teste le TOEIC. Le vocabulaire littéraire ou familier n'apparaît quasiment jamais.",
      },
    ],
  },
  {
    id: "anglais-pieges-francophones",
    domain: "anglais",
    title: "Les pièges classiques pour francophones",
    tagline: "Faux amis, homonymes, paronymes : les erreurs qui reviennent le plus.",
    readMinutes: 2,
    blocks: [
      {
        type: "warning",
        body: "Un mot anglais qui ressemble à un mot français n'a pas forcément le même sens. Ces faux amis sont l'un des pièges les plus fréquents du TOEIC pour un francophone.",
      },
      {
        type: "table",
        title: "Faux amis fréquents au TOEIC",
        headers: ["Mot anglais", "Piège", "Sens réel"],
        rows: [
          ["actually", "≠ actuellement", "en fait / en réalité"],
          ["eventually", "≠ éventuellement", "finalement / à terme"],
          ["assist", "≠ assister (à une réunion)", "aider"],
          ["attend", "≠ attendre", "assister à / participer à"],
          ["sensible", "≠ sensible", "raisonnable / sensé"],
          ["library", "≠ librairie", "bibliothèque"],
        ],
      },
      {
        type: "mnemonic",
        title: "Le réflexe à avoir",
        body: "Si un mot anglais « te semble trop familier », méfie-toi : c'est souvent le signe d'un faux ami. Vérifie le sens dans le contexte de la phrase plutôt que de te fier à la ressemblance avec le français.",
      },
    ],
  },
];
