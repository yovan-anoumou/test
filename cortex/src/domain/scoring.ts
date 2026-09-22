import type { ReviewRecord } from "../db/schema";
import type { SubtestId } from "./modules";

export interface SubtestStats {
  subtest: SubtestId;
  attempts: number;
  correct: number;
  accuracy: number;
  avgResponseTimeMs: number;
  avgTargetTimeMs: number;
  /** >1 = plus lent que la cible, <1 = plus rapide. */
  paceRatio: number;
}

export function computeSubtestStats(reviews: ReviewRecord[], subtest: SubtestId): SubtestStats {
  const relevant = reviews.filter((r) => r.subtest === subtest);
  const attempts = relevant.length;
  const correct = relevant.filter((r) => r.correct).length;
  const avgResponseTimeMs = average(relevant.map((r) => r.responseTimeMs));
  const avgTargetTimeMs = average(relevant.map((r) => r.targetTimeSeconds * 1000));
  return {
    subtest,
    attempts,
    correct,
    accuracy: attempts > 0 ? correct / attempts : 0,
    avgResponseTimeMs,
    avgTargetTimeMs,
    paceRatio: avgTargetTimeMs > 0 ? avgResponseTimeMs / avgTargetTimeMs : 1,
  };
}

export function computeAllSubtestStats(
  reviews: ReviewRecord[],
  subtests: SubtestId[],
): SubtestStats[] {
  return subtests.map((s) => computeSubtestStats(reviews, s));
}

/** Identifie les N points faibles les plus nets (accuracy basse, échantillon suffisant). */
export function identifyWeakPoints(stats: SubtestStats[], count = 3): SubtestStats[] {
  return stats
    .filter((s) => s.attempts >= 5)
    .sort((a, b) => a.accuracy - b.accuracy)
    .slice(0, count);
}

/** Points/jour sur une fenêtre glissante (pour la courbe d'évolution 30/90 jours). */
export function accuracyByDay(
  reviews: ReviewRecord[],
  days: number,
): { date: string; accuracy: number; attempts: number }[] {
  const now = new Date();
  const buckets = new Map<string, ReviewRecord[]>();
  for (let i = 0; i < days; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    buckets.set(d.toISOString().slice(0, 10), []);
  }
  for (const r of reviews) {
    const key = r.timestamp.slice(0, 10);
    if (buckets.has(key)) buckets.get(key)!.push(r);
  }
  return Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, rs]) => ({
      date,
      accuracy: rs.length > 0 ? rs.filter((r) => r.correct).length / rs.length : 0,
      attempts: rs.length,
    }));
}

/** Nombre de jours consécutifs (jusqu'à aujourd'hui inclus ou hier si rien fait aujourd'hui) avec au moins une réponse. */
export function computeStreak(reviews: ReviewRecord[]): { current: number; best: number } {
  if (reviews.length === 0) return { current: 0, best: 0 };
  const days = new Set(reviews.map((r) => r.timestamp.slice(0, 10)));
  const sorted = Array.from(days).sort();

  let best = 1;
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1]);
    const cur = new Date(sorted[i]);
    const diffDays = Math.round((cur.getTime() - prev.getTime()) / 86_400_000);
    run = diffDays === 1 ? run + 1 : 1;
    best = Math.max(best, run);
  }

  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  let current = 0;
  if (days.has(today) || days.has(yesterday)) {
    let cursor = days.has(today) ? today : yesterday;
    while (days.has(cursor)) {
      current++;
      cursor = new Date(new Date(cursor).getTime() - 86_400_000).toISOString().slice(0, 10);
    }
  }

  return { current, best };
}

/**
 * Questions dont la dernière réponse a été notée "À revoir" (Again) ou
 * "Difficile" (Hard) — la liste que "Réviser mes points faibles" reprend,
 * toutes matières confondues. Un questionId ne peut apparaître qu'une fois,
 * jugé sur sa réponse la plus récente (pas la moyenne historique).
 */
export function getStrugglingQuestionIds(reviews: ReviewRecord[]): string[] {
  const latestByQuestion = new Map<string, ReviewRecord>();
  for (const r of reviews) {
    const current = latestByQuestion.get(r.questionId);
    if (!current || r.timestamp > current.timestamp) {
      latestByQuestion.set(r.questionId, r);
    }
  }
  return Array.from(latestByQuestion.values())
    .filter((r) => r.rating === 1 || r.rating === 2)
    .sort((a, b) => a.rating - b.rating || b.timestamp.localeCompare(a.timestamp))
    .map((r) => r.questionId);
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}
