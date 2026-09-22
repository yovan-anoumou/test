// Modèle de données des "fiches mémo" — contenu de référence à lire, en
// complément des QCM (retrieval practice). Contenu statique, pas de FSRS ici.

export type FicheDomainId = "calcul" | "logique" | "anglais" | "vocabulaire" | "culture-generale";

export interface FicheDomain {
  id: FicheDomainId;
  label: string;
  tagline: string;
  emoji: string;
  /** Nom du token de couleur d'accent (sans le préfixe --color-). */
  color: "accent" | "purple" | "teal" | "pink" | "indigo";
}

export type FicheBlock =
  | { type: "rule"; title: string; body: string }
  | { type: "keyfacts"; title: string; items: string[] }
  | { type: "example"; title?: string; prompt: string; reveal: string }
  | { type: "mnemonic"; title: string; body: string }
  | { type: "warning"; body: string }
  | { type: "table"; title?: string; headers: string[]; rows: string[][] }
  | { type: "diagram"; kind: "series-method" | "reasoning-types" | "percent-chain" }
  | { type: "quote"; body: string };

export interface Fiche {
  id: string;
  domain: FicheDomainId;
  title: string;
  tagline: string;
  /** Temps de lecture estimé, en minutes. */
  readMinutes: number;
  blocks: FicheBlock[];
}

export const FICHE_DOMAINS: Record<FicheDomainId, FicheDomain> = {
  calcul: {
    id: "calcul",
    label: "Calcul",
    tagline: "Le plus gros volume de points par minute d'entraînement.",
    emoji: "🧮",
    color: "accent",
  },
  logique: {
    id: "logique",
    label: "Logique",
    tagline: "Des scores élevés, vite, avec la bonne méthode.",
    emoji: "🧩",
    color: "purple",
  },
  anglais: {
    id: "anglais",
    label: "Anglais",
    tagline: "Grammaire et vocabulaire business, format TOEIC.",
    emoji: "💬",
    color: "teal",
  },
  vocabulaire: {
    id: "vocabulaire",
    label: "Vocabulaire & expression",
    tagline: "Synonymes, locutions latines, pièges classiques du français.",
    emoji: "✍️",
    color: "pink",
  },
  "culture-generale": {
    id: "culture-generale",
    label: "Culture générale",
    tagline: "Économie, entreprises, institutions, enjeux actuels.",
    emoji: "🌍",
    color: "indigo",
  },
};
