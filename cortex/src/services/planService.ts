// Orchestration du plan d'entraînement : lecture du contexte pour l'accueil,
// et réajustement automatique quand les performances ont assez bougé.

import type { AreaAssessment, TrainingPlanRecord } from "../db/schema";
import { getActivePlan, activatePlan, savePlan } from "../db/repositories/plansRepo";
import { getAllSessions } from "../db/repositories/sessionsRepo";
import { getAllReviews } from "../db/repositories/reviewsRepo";
import { getLatestDiagnostic } from "../db/repositories/diagnosticsRepo";
import { loadQuestionBank } from "../domain/questionBank";
import { answersFromReviews, assessAllAreas } from "../domain/skill-analysis";
import { SKILL_AREAS } from "../domain/skills";
import {
  adaptPlan,
  blocksForDate,
  computePlanProgress,
  generatePlan,
  reschedulePlan,
  type PlanParams,
  type PlanProgress,
} from "../domain/plan";
import type { PlanBlock } from "../db/schema";

export interface PlanContext {
  plan: TrainingPlanRecord | null;
  progress: PlanProgress | null;
  todayBlocks: PlanBlock[];
  isRestDay: boolean;
}

export async function loadPlanContext(now: Date = new Date()): Promise<PlanContext> {
  const plan = await getActivePlan();
  if (!plan) return { plan: null, progress: null, todayBlocks: [], isRestDay: false };

  const sessions = await getAllSessions();
  const progress = computePlanProgress(plan, sessions, now);
  const day = plan.week[now.getDay()];

  return {
    plan,
    progress,
    todayBlocks: blocksForDate(plan, now),
    isRestDay: day?.rest ?? false,
  };
}

/** Évaluation des domaines sur les réponses postérieures à une date donnée. */
export async function assessSince(sinceIso: string): Promise<AreaAssessment[]> {
  const [reviews, bank] = await Promise.all([getAllReviews(), loadQuestionBank()]);
  const bankMap = new Map(bank.map((q) => [q.id, q]));
  const recent = reviews.filter((r) => r.timestamp >= sinceIso);
  return assessAllAreas(answersFromReviews(recent), bankMap);
}

const MIN_REVIEWS_FOR_ADAPTATION = 25;
const MIN_DAYS_FOR_ADAPTATION = 7;
const MIN_REVIEWS_AFTER_DELAY = 10;

/**
 * Réajuste le plan si les performances récentes le justifient : assez de
 * réponses depuis la dernière révision, ou une semaine écoulée avec un minimum
 * d'activité. Renvoie le plan mis à jour, ou `null` si rien n'a changé.
 */
export async function maybeAdaptPlan(now: Date = new Date()): Promise<TrainingPlanRecord | null> {
  const plan = await getActivePlan();
  if (!plan) return null;

  const reviews = await getAllReviews();
  const since = plan.updatedAt;
  const newReviews = reviews.filter((r) => r.timestamp > since);
  const daysSince = (now.getTime() - new Date(since).getTime()) / 86_400_000;

  const enoughVolume = newReviews.length >= MIN_REVIEWS_FOR_ADAPTATION;
  const enoughTime = daysSince >= MIN_DAYS_FOR_ADAPTATION && newReviews.length >= MIN_REVIEWS_AFTER_DELAY;
  if (!enoughVolume && !enoughTime) return null;

  const bank = await loadQuestionBank();
  const bankMap = new Map(bank.map((q) => [q.id, q]));
  const assessments = assessAllAreas(answersFromReviews(newReviews), bankMap);

  const reason = describeAdaptation(assessments);
  const adapted = adaptPlan(plan, assessments, reason);
  if (!adapted) return null;

  await savePlan(adapted);
  return adapted;
}

/** Recalcul manuel, déclenché depuis l'écran du plan. */
export async function recomputePlanNow(now: Date = new Date()): Promise<TrainingPlanRecord | null> {
  const plan = await getActivePlan();
  if (!plan) return null;

  // Fenêtre large pour avoir de la matière même si l'entraînement est récent.
  const since = new Date(now.getTime() - 30 * 86_400_000).toISOString();
  const assessments = await assessSince(since);
  const adapted = adaptPlan(plan, assessments, describeAdaptation(assessments), 0);
  if (!adapted) return null;

  await savePlan(adapted);
  return adapted;
}

/**
 * Change le rythme du plan actif en conservant ses pondérations, sa révision et
 * son historique (contrairement à une régénération complète).
 */
export async function updatePlanRhythm(rhythm: {
  minutesPerDay: number;
  daysPerWeek: number;
}): Promise<TrainingPlanRecord | null> {
  const plan = await getActivePlan();
  if (!plan) return null;
  const updated = reschedulePlan(plan, rhythm);
  await savePlan(updated);
  return updated;
}

/** Crée (ou remplace) le plan à partir du dernier diagnostic et de nouveaux paramètres. */
export async function createPlanFromLatestDiagnostic(
  params: Omit<PlanParams, "diagnosticId">,
): Promise<TrainingPlanRecord> {
  const diagnostic = await getLatestDiagnostic();
  const assessments =
    diagnostic?.areas ??
    (await assessSince(new Date(Date.now() - 30 * 86_400_000).toISOString()));

  const plan = generatePlan({ ...params, diagnosticId: diagnostic?.id ?? null }, assessments);
  await activatePlan(plan);
  return plan;
}

/** Phrase expliquant pourquoi le plan change : quel domaine monte, lequel descend. */
function describeAdaptation(assessments: AreaAssessment[]): string {
  const measured = assessments.filter((a) => a.questions >= 4);
  if (measured.length === 0) return "Plan réajusté.";

  const best = measured.slice().sort((a, b) => b.masteryScore - a.masteryScore)[0];
  const worst = measured.slice().sort((a, b) => a.masteryScore - b.masteryScore)[0];

  if (best.area === worst.area) {
    return `${SKILL_AREAS[best.area].label} : ${best.masteryScore} % de maîtrise sur la période, plan réajusté.`;
  }
  return `${SKILL_AREAS[best.area].label} progresse (${best.masteryScore} %) et laisse plus de place à ${SKILL_AREAS[worst.area].label} (${worst.masteryScore} %).`;
}
