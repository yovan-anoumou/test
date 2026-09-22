import type { ReviewRecord } from "../db/schema";
import type { SubtestId } from "./modules";

export type DifficultyAdjustment = "increase" | "decrease" | "stable";

const INCREASE_THRESHOLD = 0.85;
const DECREASE_THRESHOLD = 0.6;
const MIN_SAMPLE_SIZE = 8;
const WINDOW_SIZE = 20;

export interface SubtestPerformance {
  subtest: SubtestId;
  accuracy: number;
  sampleSize: number;
  adjustment: DifficultyAdjustment;
}

/**
 * À partir des N dernières réponses d'un sous-test, décide s'il faut monter
 * le niveau (>85% de réussite), redescendre et réexpliquer la méthode
 * (<60%), ou rester stable. En dessous de MIN_SAMPLE_SIZE réponses, reste
 * stable par prudence (pas assez de signal).
 */
export function computeSubtestPerformance(
  reviews: ReviewRecord[],
  subtest: SubtestId,
): SubtestPerformance {
  const relevant = reviews
    .filter((r) => r.subtest === subtest)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, WINDOW_SIZE);

  const sampleSize = relevant.length;
  if (sampleSize < MIN_SAMPLE_SIZE) {
    return { subtest, accuracy: sampleSize > 0 ? correctRate(relevant) : 0, sampleSize, adjustment: "stable" };
  }

  const accuracy = correctRate(relevant);
  let adjustment: DifficultyAdjustment = "stable";
  if (accuracy > INCREASE_THRESHOLD) adjustment = "increase";
  else if (accuracy < DECREASE_THRESHOLD) adjustment = "decrease";

  return { subtest, accuracy, sampleSize, adjustment };
}

function correctRate(reviews: ReviewRecord[]): number {
  if (reviews.length === 0) return 0;
  return reviews.filter((r) => r.correct).length / reviews.length;
}

/** Nombre de bonnes réponses consécutives les plus récentes sur un sous-test. */
export function consecutiveCorrect(reviews: ReviewRecord[], subtest: SubtestId): number {
  const relevant = reviews
    .filter((r) => r.subtest === subtest)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  let streak = 0;
  for (const review of relevant) {
    if (!review.correct) break;
    streak++;
  }
  return streak;
}

const STREAK_TO_ESCALATE = 5;

/**
 * Difficulté visée (1-5) pour la prochaine question d'un sous-test, à partir de
 * l'historique réel : on monte quand la réussite dépasse 85 % (ou après 5 bonnes
 * réponses d'affilée), on redescend sous 60 % pour réancrer la méthode.
 */
export function difficultyTargetForSubtest(
  reviews: ReviewRecord[],
  subtest: SubtestId,
): number {
  const relevant = reviews
    .filter((r) => r.subtest === subtest)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, WINDOW_SIZE);

  // Sans historique, on commence volontairement bas : mieux vaut ancrer la
  // méthode sur du facile que décourager sur du niveau concours.
  if (relevant.length === 0) return 2;

  const avgDifficulty =
    relevant.reduce((sum, r) => sum + r.difficulty, 0) / relevant.length;
  const { adjustment } = computeSubtestPerformance(reviews, subtest);

  let target = avgDifficulty;
  if (adjustment === "increase") target += 1;
  else if (adjustment === "decrease") target -= 1;
  else if (consecutiveCorrect(reviews, subtest) >= STREAK_TO_ESCALATE) target += 1;

  return Math.min(5, Math.max(1, Math.round(target)));
}

export function difficultyTargets(
  reviews: ReviewRecord[],
  subtests: SubtestId[],
): Map<SubtestId, number> {
  return new Map(subtests.map((s) => [s, difficultyTargetForSubtest(reviews, s)]));
}

/** Cible de difficulté (1-5) suggérée pour la prochaine sélection de nouvelles cartes. */
export function suggestedDifficultyRange(
  adjustment: DifficultyAdjustment,
  currentAvgDifficulty: number,
): { min: number; max: number } {
  const clamp = (v: number) => Math.min(5, Math.max(1, Math.round(v)));
  if (adjustment === "increase") {
    return { min: clamp(currentAvgDifficulty), max: clamp(currentAvgDifficulty + 2) };
  }
  if (adjustment === "decrease") {
    return { min: clamp(currentAvgDifficulty - 2), max: clamp(currentAvgDifficulty) };
  }
  return { min: 1, max: 5 };
}
