// Modèle de données des « fiches mémo » — contenu de référence à lire, en
// complément des QCM (retrieval practice).
//
// Les fiches sont stockées en JSON dans `public/fiches/*.json` et chargées à la
// demande (voir `bank.ts`) : la banque dépasse largement ce qu'il serait
// raisonnable d'embarquer dans le bundle JS.

import type { SubtestId } from "../modules";

export type FicheDomainId =
  | "calcul"
  | "logique"
  | "vitesse"
  | "anglais"
  | "vocabulaire"
  | "comprehension"
  | "culture-generale"
  | "methode";

export interface FicheDomain {
  id: FicheDomainId;
  label: string;
  tagline: string;
  emoji: string;
  /** Nom du token de couleur d'accent (sans le préfixe --color-). */
  color: "accent" | "purple" | "teal" | "pink" | "indigo" | "warning" | "green" | "orange";
  /** Fichiers JSON qui composent ce domaine (sans l'extension). */
  files: string[];
}

/** Niveau d'une fiche — sert de filtre et de repère de progression. */
export type FicheLevel = "fondamental" | "intermediaire" | "avance";

export const FICHE_LEVELS: FicheLevel[] = ["fondamental", "intermediaire", "avance"];

export const FICHE_LEVEL_LABELS: Record<FicheLevel, string> = {
  fondamental: "Fondamental",
  intermediaire: "Intermédiaire",
  avance: "Avancé",
};

export type FicheBlock =
  | { type: "rule"; title: string; body: string }
  | { type: "keyfacts"; title: string; items: string[] }
  | { type: "example"; title?: string; prompt: string; reveal: string }
  | { type: "mnemonic"; title: string; body: string }
  | { type: "warning"; body: string }
  | { type: "table"; title?: string; headers: string[]; rows: string[][] }
  | { type: "diagram"; kind: "series-method" | "reasoning-types" | "percent-chain" }
  | { type: "quote"; body: string }
  /** Mini-question de fin de fiche : rappel actif immédiat, réponse masquée. */
  | { type: "quiz"; question: string; answer: string; hint?: string };

export interface Fiche {
  id: string;
  domain: FicheDomainId;
  /** Sous-catégorie affichée comme regroupement dans la liste du domaine. */
  category: string;
  title: string;
  /** « À retenir » en une phrase : ce qu'on doit pouvoir redire de mémoire. */
  tagline: string;
  level: FicheLevel;
  /** Temps de lecture estimé, en minutes. */
  readMinutes: number;
  /** Tags alignés sur ceux de la banque de questions → lien fiche ↔ QCM. */
  tags: string[];
  /** Ids d'autres fiches à relier (2 à 6 en général). */
  related: string[];
  /** Sous-tests concernés, pour cibler un entraînement depuis la fiche. */
  subtests?: SubtestId[];
  /**
   * Date de vérification du contenu (ISO `AAAA-MM-JJ`), obligatoire dès que la
   * fiche contient une donnée susceptible de vieillir (chiffre, dirigeant,
   * composition d'une institution…).
   */
  updatedAt?: string;
  blocks: FicheBlock[];
}

export const FICHE_DOMAINS: Record<FicheDomainId, FicheDomain> = {
  calcul: {
    id: "calcul",
    label: "Calcul",
    tagline: "Le plus gros volume de points par minute d'entraînement.",
    emoji: "🧮",
    color: "accent",
    files: ["calcul"],
  },
  logique: {
    id: "logique",
    label: "Logique",
    tagline: "Des scores élevés, vite, avec la bonne méthode.",
    emoji: "🧩",
    color: "purple",
    files: ["logique"],
  },
  vitesse: {
    id: "vitesse",
    label: "Vitesse de raisonnement",
    tagline: "Les automatismes qui font gagner 10 secondes par question.",
    emoji: "⚡️",
    color: "orange",
    files: ["vitesse"],
  },
  anglais: {
    id: "anglais",
    label: "Anglais",
    tagline: "Grammaire et vocabulaire business, format TOEIC.",
    emoji: "💬",
    color: "teal",
    files: ["anglais-grammaire", "anglais-vocabulaire"],
  },
  vocabulaire: {
    id: "vocabulaire",
    label: "Vocabulaire & expression",
    tagline: "Synonymes, paronymes, locutions, pièges du français.",
    emoji: "✍️",
    color: "pink",
    files: ["vocabulaire"],
  },
  comprehension: {
    id: "comprehension",
    label: "Compréhension de texte",
    tagline: "Trouver l'idée, l'implicite et la structure sans tout relire.",
    emoji: "📖",
    color: "green",
    files: ["comprehension"],
  },
  "culture-generale": {
    id: "culture-generale",
    label: "Culture générale",
    tagline: "Économie, marchés, institutions, enjeux contemporains.",
    emoji: "🌍",
    color: "indigo",
    files: ["culture-economie", "culture-monde"],
  },
  methode: {
    id: "methode",
    label: "Méthode & stratégie",
    tagline: "Comment réviser, gérer le temps, éviter les pièges de l'épreuve.",
    emoji: "🎯",
    color: "warning",
    files: ["methode"],
  },
};

export const FICHE_DOMAIN_IDS = Object.keys(FICHE_DOMAINS) as FicheDomainId[];

/** Tous les fichiers JSON de la banque de fiches, sans doublon. */
export const FICHE_FILES: string[] = Array.from(
  new Set(FICHE_DOMAIN_IDS.flatMap((id) => FICHE_DOMAINS[id].files)),
);
