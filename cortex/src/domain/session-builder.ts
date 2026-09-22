import type { CardRecord } from "../db/schema";
import { interleaveBySubtest } from "../fsrs/queue";

export type SessionKind = "short" | "daily" | "weak-review";

export interface SessionPlan {
  kind: SessionKind;
  totalBudgetSeconds: number;
  /** Cartes dans l'ordre à présenter, avec la "phase" pédagogique dont elles viennent. */
  items: {
    card: CardRecord;
    phase: "warmup" | "due-mix" | "new-content" | "weak-review";
  }[];
}

const BUDGETS: Record<"short" | "daily", number> = {
  short: 10 * 60,
  daily: 25 * 60,
};

// Répartition du temps, cf. principe pédagogique : échauffement / cartes dues / nouveau contenu.
const PHASE_RATIOS = { warmup: 0.2, dueMix: 0.6, newContent: 0.2 };

// Facteur de marge pour tenir compte du temps de lecture/UI en plus du temps de réponse cible.
const TIME_OVERHEAD_FACTOR = 1.15;

function fillByBudget(
  candidates: CardRecord[],
  budgetSeconds: number,
  targetTimeSeconds: (card: CardRecord) => number,
): CardRecord[] {
  const picked: CardRecord[] = [];
  let used = 0;
  for (const card of candidates) {
    const cost = targetTimeSeconds(card) * TIME_OVERHEAD_FACTOR;
    if (used + cost > budgetSeconds && picked.length > 0) break;
    picked.push(card);
    used += cost;
    if (used >= budgetSeconds) break;
  }
  return picked;
}

/**
 * Compose une session interleavée : échauffement calcul mental, mix de cartes
 * dues toutes matières mêlées, puis nouveau contenu.
 *
 * `dueCards` = cartes déjà étudiées et dues (Learning/Review/Relearning).
 * `newCards` = cartes jamais étudiées.
 * Tant que peu de cartes sont "dues" (débuts d'utilisation), les phases se
 * complètent avec des cartes neuves pour que la session ne soit jamais vide.
 */
export function buildDailySession(
  dueCards: CardRecord[],
  newCards: CardRecord[],
  targetTimeSeconds: (card: CardRecord) => number,
  kind: "short" | "daily" = "daily",
): SessionPlan {
  const totalBudgetSeconds = BUDGETS[kind];
  const used = new Set<string>();
  const remainingNew = () => newCards.filter((c) => !used.has(c.questionId));

  // Échauffement : calcul mental, dû en priorité puis neuf si besoin.
  const warmupBudget = totalBudgetSeconds * PHASE_RATIOS.warmup;
  const warmupPool = interleaveBySubtest([
    ...dueCards.filter((c) => c.subtest === "calcul-mental"),
    ...remainingNew().filter((c) => c.subtest === "calcul-mental"),
  ]);
  const warmup = fillByBudget(warmupPool, warmupBudget, targetTimeSeconds);
  warmup.forEach((c) => used.add(c.questionId));

  // Mix de cartes dues, toutes matières : complété par du neuf si le pool dû est insuffisant.
  const dueMixBudget = totalBudgetSeconds * PHASE_RATIOS.dueMix;
  const dueMixPool = interleaveBySubtest([
    ...dueCards.filter((c) => !used.has(c.questionId)),
    ...remainingNew(),
  ]);
  const dueMix = fillByBudget(dueMixPool, dueMixBudget, targetTimeSeconds);
  dueMix.forEach((c) => used.add(c.questionId));

  // Nouveau contenu.
  const newBudget = totalBudgetSeconds * PHASE_RATIOS.newContent;
  const newPool = interleaveBySubtest(remainingNew());
  const newContent = fillByBudget(newPool, newBudget, targetTimeSeconds);

  const items: SessionPlan["items"] = [
    ...warmup.map((card) => ({ card, phase: "warmup" as const })),
    ...dueMix.map((card) => ({ card, phase: "due-mix" as const })),
    ...newContent.map((card) => ({ card, phase: "new-content" as const })),
  ];

  return { kind, totalBudgetSeconds, items };
}

/**
 * Reprend toutes les questions dont la dernière réponse a été notée
 * "À revoir" ou "Difficile" — pas de plafond de temps (la demande explicite
 * de l'utilisateur prime sur le budget habituel), juste un interleaving par
 * sous-test pour ne pas enchaîner les questions d'une même matière.
 */
export function buildWeakReviewSession(
  cards: CardRecord[],
  targetTimeSeconds: (card: CardRecord) => number,
): SessionPlan {
  const ordered = interleaveBySubtest(cards);
  const totalBudgetSeconds = ordered.reduce(
    (sum, c) => sum + targetTimeSeconds(c) * TIME_OVERHEAD_FACTOR,
    0,
  );
  return {
    kind: "weak-review",
    totalBudgetSeconds,
    items: ordered.map((card) => ({ card, phase: "weak-review" as const })),
  };
}
