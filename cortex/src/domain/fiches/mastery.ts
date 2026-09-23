// Maîtrise d'une fiche : où en es-tu réellement sur cette notion ?
//
// La maîtrise n'est pas déclarative (« j'ai lu ») : elle est calculée à partir
// des réponses aux questions liées à la fiche (mêmes tags) — précision ET
// vitesse — plus les mini-questions de la fiche. On distingue explicitement
// « maîtrisé » (je sais faire) de « automatique » (je sais faire vite, sans
// réfléchir à la méthode), parce que c'est cette dernière marche qui fait la
// différence sur un concours chronométré.

import type { FicheProgressRecord, ReviewRecord } from "../../db/schema";
import type { SubtestId } from "../modules";
import type { Fiche } from "./types";

export type FicheMasteryState =
  | "non-etudie"
  | "decouverte"
  | "en-cours"
  | "maitrise"
  | "automatique";

export const FICHE_MASTERY_STATES: FicheMasteryState[] = [
  "non-etudie",
  "decouverte",
  "en-cours",
  "maitrise",
  "automatique",
];

export const FICHE_MASTERY_LABELS: Record<FicheMasteryState, string> = {
  "non-etudie": "Non étudiée",
  decouverte: "Découverte",
  "en-cours": "En cours",
  maitrise: "Maîtrisée",
  automatique: "Automatique",
};

export const FICHE_MASTERY_HINTS: Record<FicheMasteryState, string> = {
  "non-etudie": "Jamais ouverte, jamais testée.",
  decouverte: "Lue, mais pas encore assez testée pour savoir si ça tient.",
  "en-cours": "Tu connais la notion mais tu te trompes encore trop souvent.",
  maitrise: "Tu sais faire — mais pas encore au rythme du concours.",
  automatique: "Juste et rapide : tu n'as plus besoin d'y réfléchir.",
};

/** Emoji / couleur associés, pour les badges. */
export const FICHE_MASTERY_COLORS: Record<FicheMasteryState, string> = {
  "non-etudie": "var(--color-text-tertiary, #8a8a8e)",
  decouverte: "var(--color-indigo, #5856d6)",
  "en-cours": "var(--color-warning, #ff9500)",
  maitrise: "var(--color-accent, #007aff)",
  automatique: "var(--color-success, #34c759)",
};

// Seuils. Volontairement exigeants : une fiche « automatique » doit vraiment
// l'être, sinon l'indicateur ne sert plus à rien.
export const MIN_ATTEMPTS_TO_JUDGE = 4;
export const MIN_ATTEMPTS_FOR_AUTOMATIC = 6;
export const MASTERY_ACCURACY = 0.8;
export const AUTOMATIC_ACCURACY = 0.9;
/** Temps de réponse / temps cible sur les bonnes réponses. ≤ 0,85 = plus vite que la cible. */
export const AUTOMATIC_PACE_RATIO = 0.85;
export const WEAK_ACCURACY = 0.6;

export interface FicheStats {
  ficheId: string;
  state: FicheMasteryState;
  /** Lue au moins une fois. */
  read: boolean;
  readCount: number;
  favorite: boolean;
  quizAttempts: number;
  quizCorrect: number;
  /** Réponses aux QCM liés à la fiche (tags en commun). */
  attempts: number;
  correct: number;
  accuracy: number;
  /** Rythme sur les bonnes réponses uniquement. null si aucune bonne réponse. */
  paceRatio: number | null;
  /** Maîtrisée mais trop lente : le cas à traiter avant le concours. */
  slowButCorrect: boolean;
  /** Erreurs parmi les 5 dernières réponses liées. */
  recentErrors: number;
  lastAnsweredAt: string | null;
  lastReadAt: string | null;
  /** Prochaine relecture conseillée (répétition espacée de lecture). */
  nextReviewAt: string | null;
  dueForReview: boolean;
}

/** Ce dont on a besoin d'une question pour savoir si elle relève d'une fiche. */
export interface QuestionLink {
  tags: string[];
  subtest: SubtestId;
}

export type QuestionLinkLookup = (questionId: string) => QuestionLink | undefined;

/** Intervalles de relecture, en jours, selon l'état de maîtrise. */
const REREAD_DAYS: Record<FicheMasteryState, number> = {
  "non-etudie": 0,
  decouverte: 2,
  "en-cours": 4,
  maitrise: 10,
  automatique: 30,
};

const EMPTY_PROGRESS: Omit<FicheProgressRecord, "ficheId"> = {
  readCount: 0,
  lastReadAt: null,
  favorite: false,
  quizAttempts: 0,
  quizCorrect: 0,
};

/**
 * Une réponse « compte » pour une fiche si la question partage au moins un tag
 * avec elle. Le sous-test seul ne suffit pas : « pourcentages » et « probabilités »
 * sont tous les deux du calcul, mais ce ne sont pas les mêmes notions.
 */
function reviewMatchesFiche(fiche: Fiche, link: QuestionLink | undefined): boolean {
  if (!link) return false;
  const ficheTags = new Set(fiche.tags);
  return link.tags.some((t) => ficheTags.has(t));
}

export function computeFicheStats(
  fiche: Fiche,
  reviews: ReviewRecord[],
  linkOf: QuestionLinkLookup,
  progress: FicheProgressRecord | undefined,
  now: Date = new Date(),
): FicheStats {
  const p = progress ?? { ficheId: fiche.id, ...EMPTY_PROGRESS };

  const linked = reviews
    .filter((r) => reviewMatchesFiche(fiche, linkOf(r.questionId)))
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  const attempts = linked.length;
  const correctReviews = linked.filter((r) => r.correct);
  const correct = correctReviews.length;
  const accuracy = attempts > 0 ? correct / attempts : 0;

  // Vitesse mesurée seulement sur les bonnes réponses, et hors mode
  // apprentissage (où l'on prend volontairement son temps).
  const paced = correctReviews.filter(
    (r) => r.mode !== "learning" && r.targetTimeSeconds > 0 && r.responseTimeMs > 0,
  );
  const paceRatio =
    paced.length > 0
      ? paced.reduce((sum, r) => sum + r.responseTimeMs / 1000 / r.targetTimeSeconds, 0) /
        paced.length
      : null;

  const recent = linked.slice(-5);
  const recentErrors = recent.filter((r) => !r.correct).length;
  const lastAnsweredAt = linked.length > 0 ? linked[linked.length - 1].timestamp : null;

  const quizAccuracy = p.quizAttempts > 0 ? p.quizCorrect / p.quizAttempts : null;
  const read = p.readCount > 0;

  const state = deriveState({
    read,
    attempts,
    accuracy,
    paceRatio,
    quizAttempts: p.quizAttempts,
    quizAccuracy,
  });

  const rereadDays = REREAD_DAYS[state];
  let nextReviewAt: string | null = null;
  if (p.lastReadAt && rereadDays > 0) {
    nextReviewAt = new Date(
      new Date(p.lastReadAt).getTime() + rereadDays * 24 * 60 * 60 * 1000,
    ).toISOString();
  }

  return {
    ficheId: fiche.id,
    state,
    read,
    readCount: p.readCount,
    favorite: p.favorite,
    quizAttempts: p.quizAttempts,
    quizCorrect: p.quizCorrect,
    attempts,
    correct,
    accuracy,
    paceRatio,
    slowButCorrect: state === "maitrise" && paceRatio !== null && paceRatio > 1,
    recentErrors,
    lastAnsweredAt,
    lastReadAt: p.lastReadAt,
    nextReviewAt,
    dueForReview: nextReviewAt !== null && new Date(nextReviewAt) <= now,
  };
}

function deriveState(input: {
  read: boolean;
  attempts: number;
  accuracy: number;
  paceRatio: number | null;
  quizAttempts: number;
  quizAccuracy: number | null;
}): FicheMasteryState {
  const { read, attempts, accuracy, paceRatio, quizAttempts, quizAccuracy } = input;

  if (!read && attempts === 0 && quizAttempts === 0) return "non-etudie";
  if (attempts < MIN_ATTEMPTS_TO_JUDGE) return "decouverte";
  if (accuracy < MASTERY_ACCURACY) return "en-cours";

  const quizOk = quizAccuracy === null || quizAccuracy >= MASTERY_ACCURACY;
  const fastEnough = paceRatio !== null && paceRatio <= AUTOMATIC_PACE_RATIO;
  if (
    attempts >= MIN_ATTEMPTS_FOR_AUTOMATIC &&
    accuracy >= AUTOMATIC_ACCURACY &&
    fastEnough &&
    quizOk
  ) {
    return "automatique";
  }
  return "maitrise";
}

// ---------------------------------------------------------------------------
// Filtres de la liste des fiches
// ---------------------------------------------------------------------------

export type FicheFilterId =
  | "toutes"
  | "favoris"
  | "non-etudiees"
  | "a-revoir"
  | "faibles"
  | "en-cours"
  | "maitrisees"
  | "automatiques";

export const FICHE_FILTERS: { id: FicheFilterId; label: string; hint: string }[] = [
  { id: "toutes", label: "Toutes", hint: "Toutes les fiches du domaine." },
  { id: "favoris", label: "Mes fiches", hint: "Celles que tu as marquées comme importantes." },
  { id: "non-etudiees", label: "Non étudiées", hint: "Jamais ouvertes, jamais testées." },
  { id: "a-revoir", label: "À revoir", hint: "Relecture due, ou erreurs récentes sur ces notions." },
  { id: "faibles", label: "Points faibles", hint: "Moins de 60 % de réussite sur les questions liées." },
  { id: "en-cours", label: "En cours", hint: "Notions comprises mais pas encore fiables." },
  { id: "maitrisees", label: "Maîtrisées", hint: "Justes, mais pas encore au rythme du concours." },
  { id: "automatiques", label: "Automatiques", hint: "Justes et rapides." },
];

export function matchesFicheFilter(stats: FicheStats, filter: FicheFilterId): boolean {
  switch (filter) {
    case "toutes":
      return true;
    case "favoris":
      return stats.favorite;
    case "non-etudiees":
      return stats.state === "non-etudie";
    case "a-revoir":
      return stats.dueForReview || stats.recentErrors > 0;
    case "faibles":
      return stats.attempts >= 3 && stats.accuracy < WEAK_ACCURACY;
    case "en-cours":
      return stats.state === "en-cours" || stats.state === "decouverte";
    case "maitrisees":
      return stats.state === "maitrise";
    case "automatiques":
      return stats.state === "automatique";
  }
}

/** Répartition des états, pour la barre de progression d'un domaine. */
export function masteryBreakdown(
  statsList: FicheStats[],
): Record<FicheMasteryState, number> {
  const out: Record<FicheMasteryState, number> = {
    "non-etudie": 0,
    decouverte: 0,
    "en-cours": 0,
    maitrise: 0,
    automatique: 0,
  };
  for (const s of statsList) out[s.state]++;
  return out;
}

/**
 * Fiches à travailler en priorité : celles dont la notion fait perdre des
 * points maintenant (erreurs récentes, faible précision), avant celles
 * simplement jamais lues.
 */
export function prioritizeFiches(statsList: FicheStats[]): FicheStats[] {
  const rank = (s: FicheStats): number => {
    if (s.attempts >= 3 && s.accuracy < WEAK_ACCURACY) return 0;
    if (s.recentErrors > 0) return 1;
    if (s.state === "en-cours") return 2;
    if (s.dueForReview) return 3;
    if (s.slowButCorrect) return 4;
    if (s.state === "non-etudie") return 5;
    if (s.state === "decouverte") return 6;
    return 7;
  };
  return [...statsList].sort(
    (a, b) => rank(a) - rank(b) || a.accuracy - b.accuracy || b.recentErrors - a.recentErrors,
  );
}
