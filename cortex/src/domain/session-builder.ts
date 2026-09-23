import type { CardRecord } from "../db/schema";
import { interleaveBySubtest } from "../fsrs/queue";
import type { SubtestId } from "./modules";

export type SessionKind = "short" | "daily" | "weak-review" | "focus" | "learning" | "fiche" | "time";

export type SessionPhase = "warmup" | "due-mix" | "new-content" | "weak-review" | "focus";

export interface SessionPlan {
  kind: SessionKind;
  totalBudgetSeconds: number;
  /** Cartes dans l'ordre à présenter, avec la "phase" pédagogique dont elles viennent. */
  items: { card: CardRecord; phase: SessionPhase }[];
}

/** Métadonnées d'une carte issues de la banque de questions. */
export interface CardMeta {
  targetTimeSeconds: number;
  difficulty: number;
}

export type CardMetaLookup = (card: CardRecord) => CardMeta;

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
  meta: CardMetaLookup,
): CardRecord[] {
  const picked: CardRecord[] = [];
  let used = 0;
  for (const card of candidates) {
    const cost = meta(card).targetTimeSeconds * TIME_OVERHEAD_FACTOR;
    if (used + cost > budgetSeconds && picked.length > 0) break;
    picked.push(card);
    used += cost;
    if (used >= budgetSeconds) break;
  }
  return picked;
}

/**
 * Trie des cartes neuves par proximité avec la difficulté visée pour leur
 * sous-test : c'est ce qui fait réellement évoluer le niveau des questions
 * proposées au fil des sessions.
 */
export function sortByDifficultyTarget(
  cards: CardRecord[],
  meta: CardMetaLookup,
  targets: Map<SubtestId, number>,
): CardRecord[] {
  return [...cards].sort((a, b) => {
    const targetA = targets.get(a.subtest) ?? 3;
    const targetB = targets.get(b.subtest) ?? 3;
    const distanceA = Math.abs(meta(a).difficulty - targetA);
    const distanceB = Math.abs(meta(b).difficulty - targetB);
    return distanceA - distanceB;
  });
}

/**
 * Compose une session interleavée : échauffement calcul mental, mix de cartes
 * dues toutes matières mêlées, puis nouveau contenu.
 *
 * `dueCards` = cartes déjà étudiées et dues (Learning/Review/Relearning).
 * `newCards` = cartes jamais étudiées.
 * Tant que peu de cartes sont "dues" (débuts d'utilisation), les phases se
 * complètent avec des cartes neuves pour que la session ne soit jamais vide.
 * `difficultyTargets` oriente le choix des cartes neuves vers le bon niveau.
 */
export function buildDailySession(
  dueCards: CardRecord[],
  newCards: CardRecord[],
  meta: CardMetaLookup,
  kind: "short" | "daily" = "daily",
  difficultyTargets: Map<SubtestId, number> = new Map(),
): SessionPlan {
  const totalBudgetSeconds = BUDGETS[kind];
  const used = new Set<string>();
  const remainingNew = () =>
    sortByDifficultyTarget(
      newCards.filter((c) => !used.has(c.questionId)),
      meta,
      difficultyTargets,
    );

  // Échauffement : calcul mental, dû en priorité puis neuf si besoin.
  const warmupBudget = totalBudgetSeconds * PHASE_RATIOS.warmup;
  const warmupPool = interleaveBySubtest([
    ...dueCards.filter((c) => c.subtest === "calcul-mental"),
    ...remainingNew().filter((c) => c.subtest === "calcul-mental"),
  ]);
  const warmup = fillByBudget(warmupPool, warmupBudget, meta);
  warmup.forEach((c) => used.add(c.questionId));

  // Mix de cartes dues, toutes matières : complété par du neuf si le pool dû est insuffisant.
  const dueMixBudget = totalBudgetSeconds * PHASE_RATIOS.dueMix;
  const dueMixPool = interleaveBySubtest([
    ...dueCards.filter((c) => !used.has(c.questionId)),
    ...remainingNew(),
  ]);
  const dueMix = fillByBudget(dueMixPool, dueMixBudget, meta);
  dueMix.forEach((c) => used.add(c.questionId));

  // Nouveau contenu.
  const newBudget = totalBudgetSeconds * PHASE_RATIOS.newContent;
  const newPool = interleaveBySubtest(remainingNew());
  const newContent = fillByBudget(newPool, newBudget, meta);

  const items: SessionPlan["items"] = [
    ...warmup.map((card) => ({ card, phase: "warmup" as const })),
    ...dueMix.map((card) => ({ card, phase: "due-mix" as const })),
    ...newContent.map((card) => ({ card, phase: "new-content" as const })),
  ];

  return { kind, totalBudgetSeconds, items };
}

/**
 * Reprend toutes les questions dont la dernière réponse a été notée
 * "À revoir" ou "Difficile" — pas de plafond de temps par défaut (la demande
 * explicite de l'utilisateur prime), juste un interleaving par sous-test.
 * `budgetSeconds` permet de borner la reprise quand elle vient d'un bloc de plan.
 */
export function buildWeakReviewSession(
  cards: CardRecord[],
  meta: CardMetaLookup,
  budgetSeconds?: number,
): SessionPlan {
  const ordered = interleaveBySubtest(cards);
  const selected =
    budgetSeconds !== undefined ? fillByBudget(ordered, budgetSeconds, meta) : ordered;
  const totalBudgetSeconds = selected.reduce(
    (sum, c) => sum + meta(c).targetTimeSeconds * TIME_OVERHEAD_FACTOR,
    0,
  );
  return {
    kind: "weak-review",
    totalBudgetSeconds,
    items: selected.map((card) => ({ card, phase: "weak-review" as const })),
  };
}

/**
 * Session ciblée sur un ensemble de sous-tests (un domaine du plan, ou un
 * entraînement choisi à la main), bornée par un budget de temps.
 * Les cartes dues passent avant les neuves : on consolide avant d'élargir.
 */
export function buildFocusedSession(
  dueCards: CardRecord[],
  newCards: CardRecord[],
  subtests: SubtestId[],
  budgetSeconds: number,
  meta: CardMetaLookup,
  difficultyTargets: Map<SubtestId, number> = new Map(),
  kind: SessionKind = "focus",
): SessionPlan {
  const inScope = (card: CardRecord) => subtests.includes(card.subtest);
  const due = interleaveBySubtest(dueCards.filter(inScope));
  const fresh = sortByDifficultyTarget(newCards.filter(inScope), meta, difficultyTargets);

  const selected = fillByBudget([...due, ...fresh], budgetSeconds, meta);

  return {
    kind,
    totalBudgetSeconds: budgetSeconds,
    items: selected.map((card) => ({ card, phase: "focus" as const })),
  };
}

/**
 * Session ciblée sur les notions d'une fiche mémo : on ne tire que dans les
 * questions dont les tags recoupent ceux de la fiche. C'est ce qui rend le
 * bouton « Me tester » honnête — sinon on interrogerait tout le domaine.
 *
 * `difficultyOrder` sert aux variantes : « question rapide » prend le plus
 * accessible, « question difficile » le plus exigeant.
 */
export function buildFicheSession(
  dueCards: CardRecord[],
  newCards: CardRecord[],
  allowedQuestionIds: Set<string>,
  meta: CardMetaLookup,
  options: { budgetSeconds: number; maxItems?: number; difficultyOrder?: "asc" | "desc" },
): SessionPlan {
  const inScope = (card: CardRecord) => allowedQuestionIds.has(card.questionId);
  const due = dueCards.filter(inScope);
  const fresh = newCards.filter(inScope);

  let ordered: CardRecord[];
  if (options.difficultyOrder) {
    const sign = options.difficultyOrder === "asc" ? 1 : -1;
    ordered = [...due, ...fresh].sort(
      (a, b) => sign * (meta(a).difficulty - meta(b).difficulty),
    );
  } else {
    // Les cartes dues d'abord : consolider avant d'élargir.
    ordered = [...interleaveBySubtest(due), ...interleaveBySubtest(fresh)];
  }

  let selected = fillByBudget(ordered, options.budgetSeconds, meta);
  if (options.maxItems !== undefined) selected = selected.slice(0, options.maxItems);
  // Une variante « une seule question » ne doit jamais rendre une session vide
  // quand des cartes existent : fillByBudget peut tout écarter sur un budget ras.
  if (selected.length === 0 && ordered.length > 0) selected = ordered.slice(0, options.maxItems ?? 1);

  return {
    kind: "fiche",
    totalBudgetSeconds: selected.reduce(
      (sum, c) => sum + meta(c).targetTimeSeconds * TIME_OVERHEAD_FACTOR,
      0,
    ),
    items: selected.map((card) => ({ card, phase: "focus" as const })),
  };
}

/**
 * « J'ai N minutes » : ce qui rapporte le plus dans le temps disponible.
 * Priorité aux questions déjà ratées, puis aux cartes dues (la répétition
 * espacée a une raison de les proposer maintenant), puis au nouveau contenu.
 */
export function buildTimeBoxedSession(
  dueCards: CardRecord[],
  newCards: CardRecord[],
  strugglingQuestionIds: Set<string>,
  budgetSeconds: number,
  meta: CardMetaLookup,
  difficultyTargets: Map<SubtestId, number> = new Map(),
): SessionPlan {
  const struggling = dueCards.filter((c) => strugglingQuestionIds.has(c.questionId));
  const strugglingIds = new Set(struggling.map((c) => c.questionId));
  const otherDue = dueCards.filter((c) => !strugglingIds.has(c.questionId));

  const ordered = [
    ...interleaveBySubtest(struggling),
    ...interleaveBySubtest(otherDue),
    ...sortByDifficultyTarget(newCards, meta, difficultyTargets),
  ];

  const selected = fillByBudget(ordered, budgetSeconds, meta);
  return {
    kind: "time",
    totalBudgetSeconds: budgetSeconds,
    items: selected.map((card) => ({ card, phase: "focus" as const })),
  };
}
