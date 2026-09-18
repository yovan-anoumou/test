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
