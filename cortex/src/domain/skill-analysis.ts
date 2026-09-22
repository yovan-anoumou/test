// Moteur d'analyse des compétences : transforme des réponses (diagnostic ou
// historique de sessions) en évaluation par domaine — précision, vitesse,
// maîtrise, niveau, points faibles fins (tags) et types d'erreurs.
//
// Tout est pur et testable : aucune dépendance à IndexedDB ici.

import type { AreaAssessment, DiagnosticAnswer, ReviewRecord, WeakTag } from "../db/schema";
import type { Question } from "./question";
import { SKILL_AREA_IDS, areaOfSubtest, type SkillAreaId } from "./skills";

/** Poids d'une question dans la précision : une question difficile compte un peu plus. */
function difficultyWeight(difficulty: number): number {
  return 0.6 + 0.1 * Math.min(5, Math.max(1, difficulty));
}

/**
 * Temps de réponse plafonné : au-delà de 4× le temps cible, on considère que
 * l'utilisateur a été interrompu plutôt que « très lent », pour ne pas fausser
 * la moyenne avec un outlier.
 */
function cappedResponseMs(responseTimeMs: number, targetTimeSeconds: number): number {
  return Math.min(responseTimeMs, targetTimeSeconds * 1000 * 4);
}

/** 1 quand on répond au moins aussi vite que la cible, 0 à partir du double du temps cible. */
export function speedScoreFromPace(paceRatio: number): number {
  return Math.min(1, Math.max(0, 2 - paceRatio));
}

export function levelFromMastery(mastery: number): 1 | 2 | 3 | 4 | 5 {
  if (mastery < 35) return 1;
  if (mastery < 55) return 2;
  if (mastery < 70) return 3;
  if (mastery < 85) return 4;
  return 5;
}

export const LEVEL_LABELS: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: "Débutant",
  2: "À renforcer",
  3: "Correct",
  4: "Solide",
  5: "Excellent",
};

function confidenceFromSample(n: number): AreaAssessment["confidence"] {
  if (n < 6) return "faible";
  if (n < 15) return "moyenne";
  return "bonne";
}

/** Forme commune à une réponse de diagnostic et à une réponse de session. */
export interface ScorableAnswer {
  questionId: string;
  area: SkillAreaId;
  difficulty: number;
  correct: boolean;
  selectedIndex: number | null;
  responseTimeMs: number;
  targetTimeSeconds: number;
  /** Les réponses en mode apprentissage sont exclues du calcul de vitesse. */
  countsForSpeed: boolean;
}

export function answersFromDiagnostic(answers: DiagnosticAnswer[]): ScorableAnswer[] {
  return answers.map((a) => ({
    questionId: a.questionId,
    area: a.area,
    difficulty: a.difficulty,
    correct: a.correct,
    selectedIndex: a.selectedIndex,
    responseTimeMs: a.responseTimeMs,
    targetTimeSeconds: a.targetTimeSeconds,
    countsForSpeed: true,
  }));
}

export function answersFromReviews(reviews: ReviewRecord[]): ScorableAnswer[] {
  return reviews.map((r) => ({
    questionId: r.questionId,
    area: areaOfSubtest(r.subtest),
    difficulty: r.difficulty,
    correct: r.correct,
    selectedIndex: r.selectedIndex ?? null,
    responseTimeMs: r.responseTimeMs,
    targetTimeSeconds: r.targetTimeSeconds,
    countsForSpeed: r.mode !== "learning",
  }));
}

/**
 * Évalue un domaine à partir des réponses qui le concernent.
 * `bank` sert à retrouver les tags et l'explication du distracteur choisi ;
 * une question absente de la banque est simplement ignorée pour ces détails.
 */
export function assessArea(
  area: SkillAreaId,
  answers: ScorableAnswer[],
  bank: Map<string, Question>,
): AreaAssessment {
  const relevant = answers.filter((a) => a.area === area);
  const questions = relevant.length;
  const correct = relevant.filter((a) => a.correct).length;

  if (questions === 0) {
    return {
      area,
      questions: 0,
      correct: 0,
      accuracy: 0,
      paceRatio: 1,
      avgResponseTimeMs: 0,
      masteryScore: 0,
      level: 1,
      reachedDifficulty: 0,
      confidence: "faible",
      weakTags: [],
      errorTypes: [],
    };
  }

  const accuracy = correct / questions;

  const totalWeight = relevant.reduce((sum, a) => sum + difficultyWeight(a.difficulty), 0);
  const weightedCorrect = relevant.reduce(
    (sum, a) => sum + (a.correct ? difficultyWeight(a.difficulty) : 0),
    0,
  );
  const weightedAccuracy = totalWeight > 0 ? weightedCorrect / totalWeight : 0;

  const timed = relevant.filter((a) => a.countsForSpeed && a.targetTimeSeconds > 0);
  const avgResponseTimeMs = averagePace(timed).responseMs;

  // La vitesse se mesure sur les réponses JUSTES : aller vite en se trompant
  // n'est pas une qualité, c'est de la précipitation.
  const correctTimed = timed.filter((a) => a.correct);
  const pace = averagePace(correctTimed.length > 0 ? correctTimed : timed);
  const paceRatio = pace.targetMs > 0 ? pace.responseMs / pace.targetMs : 1;

  // Sans mesure de vitesse exploitable (que de l'apprentissage), la maîtrise ne
  // repose que sur la précision plutôt que sur une vitesse inventée.
  const masteryScore =
    timed.length === 0
      ? Math.round(100 * weightedAccuracy)
      : Math.round(
          100 *
            (0.7 * weightedAccuracy +
              0.3 * (correctTimed.length > 0 ? speedScoreFromPace(paceRatio) : 0)),
        );

  const reachedDifficulty = relevant
    .filter((a) => a.correct)
    .reduce((max, a) => Math.max(max, a.difficulty), 0);

  return {
    area,
    questions,
    correct,
    accuracy,
    paceRatio,
    avgResponseTimeMs,
    masteryScore,
    level: levelFromMastery(masteryScore),
    reachedDifficulty,
    confidence: confidenceFromSample(questions),
    weakTags: computeWeakTags(relevant, bank),
    errorTypes: computeErrorTypes(relevant, bank),
  };
}

function averagePace(answers: ScorableAnswer[]): { responseMs: number; targetMs: number } {
  if (answers.length === 0) return { responseMs: 0, targetMs: 0 };
  const responseMs =
    answers.reduce((sum, a) => sum + cappedResponseMs(a.responseTimeMs, a.targetTimeSeconds), 0) /
    answers.length;
  const targetMs =
    answers.reduce((sum, a) => sum + a.targetTimeSeconds * 1000, 0) / answers.length;
  return { responseMs, targetMs };
}

export function assessAllAreas(
  answers: ScorableAnswer[],
  bank: Map<string, Question>,
): AreaAssessment[] {
  return SKILL_AREA_IDS.map((area) => assessArea(area, answers, bank));
}

/** Tags les plus problématiques du domaine (au moins une erreur), les pires d'abord. */
export function computeWeakTags(
  answers: ScorableAnswer[],
  bank: Map<string, Question>,
  limit = 3,
): WeakTag[] {
  const perTag = new Map<string, WeakTag>();
  for (const answer of answers) {
    const question = bank.get(answer.questionId);
    if (!question) continue;
    for (const tag of question.tags) {
      const entry = perTag.get(tag) ?? { tag, attempts: 0, errors: 0 };
      entry.attempts++;
      if (!answer.correct) entry.errors++;
      perTag.set(tag, entry);
    }
  }
  return Array.from(perTag.values())
    .filter((t) => t.errors > 0)
    .sort((a, b) => b.errors / b.attempts - a.errors / a.attempts || b.errors - a.errors)
    .slice(0, limit);
}

/**
 * Types d'erreurs commises : on réutilise l'explication déjà rédigée pour le
 * distracteur choisi ("pourquoi cette réponse est fausse"), ce qui donne une
 * description précise de l'erreur plutôt qu'un simple « mauvaise réponse ».
 */
export function computeErrorTypes(
  answers: ScorableAnswer[],
  bank: Map<string, Question>,
  limit = 3,
): string[] {
  const reasons: string[] = [];
  for (const answer of answers) {
    if (answer.correct || answer.selectedIndex === null) continue;
    const question = bank.get(answer.questionId);
    if (!question) continue;
    const reason = question.explanation.why_others_wrong[answer.selectedIndex];
    if (reason && !reasons.includes(reason)) reasons.push(reason);
    if (reasons.length >= limit) break;
  }
  return reasons;
}

export interface PriorityWeakness {
  area: SkillAreaId;
  assessment: AreaAssessment;
  /** Pourquoi ce domaine est prioritaire, en une phrase. */
  reason: string;
  /** "precision" quand les réponses sont fausses, "vitesse" quand elles sont justes mais lentes. */
  driver: "precision" | "vitesse" | "mixte";
}

/** Au-dessus de ce score, un domaine est considéré comme acquis : rien à signaler. */
const PRIORITY_MASTERY_CEILING = 80;

/**
 * Classe les domaines à travailler en priorité. Un domaine juste mais trop lent
 * est signalé comme tel : c'est un problème différent d'un domaine mal maîtrisé.
 * Les domaines déjà solides sont exclus — annoncer une priorité à quelqu'un qui
 * réussit à 95 % n'aurait aucun sens.
 */
export function identifyPriorityWeaknesses(
  assessments: AreaAssessment[],
  limit = 3,
): PriorityWeakness[] {
  return assessments
    .filter((a) => a.questions > 0 && a.masteryScore < PRIORITY_MASTERY_CEILING)
    .sort((a, b) => a.masteryScore - b.masteryScore)
    .slice(0, limit)
    .map((assessment) => {
      const slow = assessment.paceRatio > 1.25;
      const inaccurate = assessment.accuracy < 0.75;
      const driver: PriorityWeakness["driver"] =
        inaccurate && slow ? "mixte" : slow && !inaccurate ? "vitesse" : "precision";

      let reason: string;
      if (driver === "vitesse") {
        reason = `Tes réponses sont justes (${Math.round(assessment.accuracy * 100)} %) mais tu mets ${assessment.paceRatio.toFixed(1)}× le temps cible : c'est la vitesse qu'il faut travailler.`;
      } else if (driver === "mixte") {
        reason = `${Math.round(assessment.accuracy * 100)} % de réussite et ${assessment.paceRatio.toFixed(1)}× le temps cible : revois la méthode avant de chercher à aller plus vite.`;
      } else if (assessment.accuracy >= 0.75) {
        reason = `${Math.round(assessment.accuracy * 100)} % de réussite : la base est là, il reste à fiabiliser sur les questions difficiles.`;
      } else {
        reason = `${Math.round(assessment.accuracy * 100)} % de réussite : la méthode n'est pas encore acquise.`;
      }
      return { area: assessment.area, assessment, reason, driver };
    });
}

// ---------------------------------------------------------------------------
// Indicateurs globaux pour le tableau de progression
// ---------------------------------------------------------------------------

/**
 * Rétention : taux de réussite sur les questions déjà rencontrées au moins une
 * fois auparavant. C'est la mesure qui dit si ce qui a été appris tient dans le
 * temps, contrairement à la précision globale qui inclut les découvertes.
 */
export function computeRetention(reviews: ReviewRecord[]): { rate: number; sample: number } {
  const sorted = [...reviews].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const seen = new Set<string>();
  let repeats = 0;
  let correct = 0;
  for (const review of sorted) {
    if (seen.has(review.questionId)) {
      repeats++;
      if (review.correct) correct++;
    }
    seen.add(review.questionId);
  }
  return { rate: repeats > 0 ? correct / repeats : 0, sample: repeats };
}

/** Questions ratées au moins une fois, puis réussies à la tentative la plus récente. */
export function computeErrorsCorrected(reviews: ReviewRecord[]): {
  corrected: number;
  stillWrong: number;
} {
  const sorted = [...reviews].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const everWrong = new Set<string>();
  const latestCorrect = new Map<string, boolean>();
  for (const review of sorted) {
    if (!review.correct) everWrong.add(review.questionId);
    latestCorrect.set(review.questionId, review.correct);
  }
  let corrected = 0;
  let stillWrong = 0;
  for (const questionId of everWrong) {
    if (latestCorrect.get(questionId)) corrected++;
    else stillWrong++;
  }
  return { corrected, stillWrong };
}

export function totalTrainingTimeMs(reviews: ReviewRecord[]): number {
  return reviews.reduce(
    (sum, r) => sum + cappedResponseMs(r.responseTimeMs, r.targetTimeSeconds || 60),
    0,
  );
}

export interface TrendBucket {
  label: string;
  /** Bornes de la période, en jours avant maintenant (from > to). */
  fromDays: number;
  toDays: number;
  masteryScore: number | null;
  accuracy: number | null;
  questions: number;
}

const DEFAULT_TREND_BUCKETS: { label: string; fromDays: number; toDays: number }[] = [
  { label: "il y a 1-3 mois", fromDays: 90, toDays: 30 },
  { label: "3 dern. semaines", fromDays: 30, toDays: 7 },
  { label: "7 derniers jours", fromDays: 7, toDays: 0 },
];

/**
 * Évolution de la maîtrise d'un domaine sur des périodes qui ne se recouvrent
 * pas : c'est une vraie tendance dans le temps, pas trois fenêtres emboîtées.
 * Une période sans assez de réponses renvoie `null` plutôt qu'un score trompeur.
 */
export function areaTrend(
  reviews: ReviewRecord[],
  bank: Map<string, Question>,
  area: SkillAreaId,
  minSample = 4,
  now: Date = new Date(),
  buckets = DEFAULT_TREND_BUCKETS,
): TrendBucket[] {
  return buckets.map(({ label, fromDays, toDays }) => {
    const from = new Date(now.getTime() - fromDays * 86_400_000).toISOString();
    const to = new Date(now.getTime() - toDays * 86_400_000).toISOString();
    const scoped = reviews.filter((r) => r.timestamp >= from && r.timestamp < to);
    const answers = answersFromReviews(scoped).filter((a) => a.area === area);
    if (answers.length < minSample) {
      return { label, fromDays, toDays, masteryScore: null, accuracy: null, questions: answers.length };
    }
    const assessment = assessArea(area, answers, bank);
    return {
      label,
      fromDays,
      toDays,
      masteryScore: assessment.masteryScore,
      accuracy: assessment.accuracy,
      questions: assessment.questions,
    };
  });
}
