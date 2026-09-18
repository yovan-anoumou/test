import type { ReviewRecord } from "../db/schema";
import { TAGE2_MOCK_EXAM_SECTIONS } from "./modules";
import { computeSubtestStats } from "./scoring";

export interface ProjectedScore {
  /** Score total estimé sur 600 (6 sections x 0-100), comme la grille officielle TAGE MAGE. */
  total: number;
  perSection: { label: string; score: number; accuracy: number; attempts: number }[];
  /** true si l'estimation repose sur trop peu de données pour être fiable. */
  lowConfidence: boolean;
}

const RECENT_WINDOW_DAYS = 30;
const MIN_ATTEMPTS_FOR_CONFIDENCE = 8;
// Pénalité de rythme : au-delà de 1.3x le temps cible, on retire jusqu'à 15 points.
const MAX_PACE_PENALTY = 15;

/**
 * Estimation heuristique du score TAGE 2/TAGE MAGE projeté (0-600), à partir
 * des performances récentes (30 derniers jours) sur chacune des 6 sections
 * de l'épreuve. Ce n'est PAS un score officiel : c'est un indicateur de
 * tendance basé sur la justesse et le respect du temps cible.
 */
export function estimateProjectedScore(reviews: ReviewRecord[]): ProjectedScore {
  const cutoff = new Date(Date.now() - RECENT_WINDOW_DAYS * 86_400_000).toISOString();
  const recent = reviews.filter((r) => r.timestamp >= cutoff);

  let lowConfidence = false;
  const perSection = TAGE2_MOCK_EXAM_SECTIONS.map((section) => {
    const stats = computeSubtestStats(recent, section.subtest);
    if (stats.attempts < MIN_ATTEMPTS_FOR_CONFIDENCE) lowConfidence = true;

    const pacePenalty =
      stats.paceRatio > 1.3 ? Math.min(MAX_PACE_PENALTY, (stats.paceRatio - 1.3) * 50) : 0;
    const score = Math.max(0, Math.round(stats.accuracy * 100 - pacePenalty));

    return { label: section.label, score, accuracy: stats.accuracy, attempts: stats.attempts };
  });

  const total = perSection.reduce((sum, s) => sum + s.score, 0);
  return { total, perSection, lowConfidence };
}
