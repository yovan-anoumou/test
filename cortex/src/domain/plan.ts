// Générateur de plan d'entraînement : transforme un diagnostic (ou les
// performances récentes) + le temps disponible en un programme hebdomadaire
// concret, puis le réajuste au fil des progrès.

import type {
  AreaAssessment,
  PlanBlock,
  PlanDay,
  SessionRecord,
  TrainingPlanRecord,
} from "../db/schema";
import {
  AREA_IMPORTANCE,
  SKILL_AREAS,
  SKILL_AREA_IDS,
  type ObjectiveId,
  type SkillAreaId,
} from "./skills";
import { newId } from "../utils/id";

export const DURATION_OPTIONS = [
  { label: "1 mois", weeks: 4 },
  { label: "3 mois", weeks: 13 },
  { label: "6 mois", weeks: 26 },
  { label: "1 an", weeks: 52 },
  { label: "2 ans", weeks: 104 },
];

export const MINUTES_OPTIONS = [10, 15, 20, 30, 45, 60];

export const DAY_LABELS = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
export const DAY_SHORT = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

/** Un domaine maîtrisé garde un minimum de présence : on entretient, on n'abandonne pas. */
const MIN_DEFICIT = 0.15;
/** Sans mesure pour un domaine, on lui donne une priorité moyenne plutôt que zéro. */
const UNKNOWN_DEFICIT = 0.6;
const MIN_BLOCK_MINUTES = 5;
/** En dessous, une journée n'a pas la place pour deux blocs distincts. */
const TWO_BLOCKS_THRESHOLD = 24;

export interface PlanParams {
  objective: ObjectiveId;
  durationWeeks: number;
  targetDate: string | null;
  minutesPerDay: number;
  daysPerWeek: number;
  restDays?: number[];
  diagnosticId: string | null;
}

/** Jours de repos par défaut : on part du dimanche, puis du samedi, puis du mercredi. */
export function defaultRestDays(daysPerWeek: number): number[] {
  const priority = [0, 6, 3, 2, 4, 1, 5];
  const restCount = Math.max(0, 7 - daysPerWeek);
  return priority.slice(0, restCount).sort((a, b) => a - b);
}

/**
 * Part du temps hebdomadaire attribuée à chaque domaine :
 * déficit de maîtrise × importance du domaine pour l'objectif visé.
 */
export function computeAreaWeights(
  assessments: AreaAssessment[],
  objective: ObjectiveId,
): Record<SkillAreaId, number> {
  const importance = AREA_IMPORTANCE[objective] ?? AREA_IMPORTANCE.general;
  const byArea = new Map(assessments.map((a) => [a.area, a]));

  const raw = SKILL_AREA_IDS.map((area) => {
    const assessment = byArea.get(area);
    const deficit =
      assessment && assessment.questions > 0
        ? Math.max(MIN_DEFICIT, 1 - assessment.masteryScore / 100)
        : UNKNOWN_DEFICIT;
    return { area, value: deficit * importance[area] };
  });

  const total = raw.reduce((sum, r) => sum + r.value, 0) || 1;
  return raw.reduce(
    (acc, r) => {
      acc[r.area] = r.value / total;
      return acc;
    },
    {} as Record<SkillAreaId, number>,
  );
}

/** Répartit `totalSlots` créneaux entre les domaines, au prorata des poids. */
function allocateSlots(
  weights: Record<SkillAreaId, number>,
  totalSlots: number,
): Record<SkillAreaId, number> {
  const exact = SKILL_AREA_IDS.map((area) => ({ area, value: weights[area] * totalSlots }));
  const allocation = exact.reduce(
    (acc, e) => {
      acc[e.area] = Math.floor(e.value);
      return acc;
    },
    {} as Record<SkillAreaId, number>,
  );

  let assigned = SKILL_AREA_IDS.reduce((sum, area) => sum + allocation[area], 0);
  const remainders = exact
    .map((e) => ({ area: e.area, rest: e.value - Math.floor(e.value) }))
    .sort((a, b) => b.rest - a.rest);
  let i = 0;
  while (assigned < totalSlots && remainders.length > 0) {
    allocation[remainders[i % remainders.length].area]++;
    assigned++;
    i++;
  }

  // Aucun domaine totalement absent tant qu'il y a assez de créneaux.
  if (totalSlots >= SKILL_AREA_IDS.length) {
    for (const area of SKILL_AREA_IDS) {
      if (allocation[area] > 0) continue;
      const donor = SKILL_AREA_IDS.slice().sort((a, b) => allocation[b] - allocation[a])[0];
      if (allocation[donor] > 1) {
        allocation[donor]--;
        allocation[area]++;
      }
    }
  }

  return allocation;
}

/**
 * Identifiant déterministe d'un bloc : jour + position + contenu.
 * Il doit rester stable quand le plan est réajusté, sinon les séances déjà
 * faites (référencées par `planBlockId`) seraient orphelines et le suivi
 * repartirait de zéro à chaque ajustement.
 */
function blockId(dayOfWeek: number, slot: number, kind: PlanBlock["kind"], area: SkillAreaId | null): string {
  return `d${dayOfWeek}-s${slot}-${kind}-${area ?? "errors"}`;
}

function buildBlock(
  dayOfWeek: number,
  slot: number,
  area: SkillAreaId | null,
  minutes: number,
  kind: PlanBlock["kind"],
): PlanBlock {
  return {
    id: blockId(dayOfWeek, slot, kind, area),
    kind,
    area,
    minutes,
    label: kind === "error-review" ? "Révision de tes erreurs" : SKILL_AREAS[area!].label,
  };
}

/**
 * Construit la semaine type : chaque jour travaillé reçoit un ou deux blocs de
 * domaine, plus un temps de révision des erreurs (la répétition espacée reste
 * le socle du programme).
 */
export function buildWeek(
  weights: Record<SkillAreaId, number>,
  minutesPerDay: number,
  restDays: number[],
): PlanDay[] {
  const trainingDays = [0, 1, 2, 3, 4, 5, 6].filter((d) => !restDays.includes(d));

  if (trainingDays.length === 0) {
    return [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({ dayOfWeek, rest: true, blocks: [] }));
  }

  // Temps de révision des erreurs : un quart du temps sur les journées longues,
  // un court passage un jour sur deux sur les journées très courtes.
  const longDay = minutesPerDay >= 20;
  const reviewMinutes = longDay
    ? Math.min(10, Math.max(MIN_BLOCK_MINUTES, Math.round(minutesPerDay * 0.25)))
    : MIN_BLOCK_MINUTES;

  const dayPlans = trainingDays.map((dayOfWeek, i) => {
    const hasReview = longDay || i % 2 === 1;
    const availableForAreas = minutesPerDay - (hasReview ? reviewMinutes : 0);
    const areaBlocks = availableForAreas >= TWO_BLOCKS_THRESHOLD ? 2 : 1;
    return { dayOfWeek, hasReview, availableForAreas, areaBlocks };
  });

  const totalSlots = dayPlans.reduce((sum, d) => sum + d.areaBlocks, 0);
  const allocation = allocateSlots(weights, totalSlots);

  // File de domaines à placer : les plus prioritaires d'abord, pour qu'ils
  // tombent en début de semaine et ne sautent jamais faute de place.
  const queue: SkillAreaId[] = [];
  const ordered = SKILL_AREA_IDS.slice().sort((a, b) => weights[b] - weights[a]);
  const remaining = { ...allocation };
  while (queue.length < totalSlots) {
    let placedOne = false;
    for (const area of ordered) {
      if (remaining[area] > 0) {
        queue.push(area);
        remaining[area]--;
        placedOne = true;
      }
      if (queue.length >= totalSlots) break;
    }
    if (!placedOne) break;
  }

  const days: PlanDay[] = [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
    dayOfWeek,
    rest: true,
    blocks: [],
  }));

  for (const dayPlan of dayPlans) {
    const blocks: PlanBlock[] = [];
    const chosen: SkillAreaId[] = [];

    for (let slot = 0; slot < dayPlan.areaBlocks && queue.length > 0; slot++) {
      // On prend en tête de file, en sautant un domaine déjà programmé le même
      // jour (interleaving) ; à défaut on reprend la tête.
      let pickIndex = 0;
      while (pickIndex < queue.length && chosen.includes(queue[pickIndex])) pickIndex++;
      if (pickIndex >= queue.length) pickIndex = 0;
      chosen.push(queue[pickIndex]);
      queue.splice(pickIndex, 1);
    }

    const perBlock = Math.max(
      MIN_BLOCK_MINUTES,
      Math.floor(dayPlan.availableForAreas / Math.max(1, chosen.length)),
    );
    chosen.forEach((area, i) => {
      // Le dernier bloc absorbe le reste pour que le total tombe juste.
      const minutes =
        i === chosen.length - 1
          ? Math.max(MIN_BLOCK_MINUTES, dayPlan.availableForAreas - perBlock * (chosen.length - 1))
          : perBlock;
      blocks.push(buildBlock(dayPlan.dayOfWeek, i, area, minutes, "area"));
    });

    if (dayPlan.hasReview) {
      blocks.push(
        buildBlock(dayPlan.dayOfWeek, chosen.length, null, reviewMinutes, "error-review"),
      );
    }

    days[dayPlan.dayOfWeek] = { dayOfWeek: dayPlan.dayOfWeek, rest: false, blocks };
  }

  return days;
}

export function generatePlan(
  params: PlanParams,
  assessments: AreaAssessment[],
): TrainingPlanRecord {
  const restDays = params.restDays ?? defaultRestDays(params.daysPerWeek);
  const weights = computeAreaWeights(assessments, params.objective);
  const now = new Date().toISOString();

  return {
    id: newId(),
    createdAt: now,
    updatedAt: now,
    objective: params.objective,
    targetDate: params.targetDate,
    durationWeeks: params.durationWeeks,
    minutesPerDay: params.minutesPerDay,
    daysPerWeek: 7 - restDays.length,
    restDays,
    areaWeights: weights,
    week: buildWeek(weights, params.minutesPerDay, restDays),
    diagnosticId: params.diagnosticId,
    revision: 1,
    history: [{ at: now, reason: "Plan créé à partir de ton test de niveau.", weights }],
    archivedAt: null,
  };
}

/**
 * Réajuste le plan sur les performances récentes : un domaine qui progresse
 * perd de la place au profit de celui qui bloque encore.
 * Renvoie `null` si rien ne justifie un changement.
 */
export function adaptPlan(
  plan: TrainingPlanRecord,
  recentAssessments: AreaAssessment[],
  reason: string,
  minShift = 0.04,
): TrainingPlanRecord | null {
  const measured = recentAssessments.filter((a) => a.questions >= 4);
  if (measured.length === 0) return null;

  // On garde la référence du diagnostic pour les domaines non remesurés
  // récemment, et on remplace celle des domaines mesurés.
  const blended: AreaAssessment[] = SKILL_AREA_IDS.map((area) => {
    const fresh = measured.find((a) => a.area === area);
    if (fresh) return fresh;
    const previousWeight = plan.areaWeights[area] ?? 0;
    return {
      area,
      questions: 0,
      correct: 0,
      accuracy: 0,
      paceRatio: 1,
      avgResponseTimeMs: 0,
      // Reconstruit une maîtrise implicite à partir du poids actuel : un
      // domaine qui pesait lourd était faible, on le garde faible.
      masteryScore: Math.round(100 * Math.max(0, 1 - previousWeight * SKILL_AREA_IDS.length * 0.5)),
      level: 3,
      reachedDifficulty: 0,
      confidence: "faible",
      weakTags: [],
      errorTypes: [],
    };
  });

  const weights = computeAreaWeights(blended, plan.objective);
  const biggestShift = SKILL_AREA_IDS.reduce(
    (max, area) => Math.max(max, Math.abs(weights[area] - (plan.areaWeights[area] ?? 0))),
    0,
  );
  if (biggestShift < minShift) return null;

  const now = new Date().toISOString();
  return {
    ...plan,
    updatedAt: now,
    areaWeights: weights,
    week: buildWeek(weights, plan.minutesPerDay, plan.restDays),
    revision: plan.revision + 1,
    history: [...plan.history, { at: now, reason, weights }],
  };
}

/**
 * Change le rythme (temps par jour, jours travaillés) sans repartir de zéro :
 * les pondérations issues du diagnostic et des ajustements successifs sont
 * conservées, seule la répartition dans la semaine est refaite.
 */
export function reschedulePlan(
  plan: TrainingPlanRecord,
  rhythm: { minutesPerDay: number; daysPerWeek: number; restDays?: number[] },
): TrainingPlanRecord {
  const restDays = rhythm.restDays ?? defaultRestDays(rhythm.daysPerWeek);
  const now = new Date().toISOString();
  return {
    ...plan,
    updatedAt: now,
    minutesPerDay: rhythm.minutesPerDay,
    daysPerWeek: 7 - restDays.length,
    restDays,
    week: buildWeek(plan.areaWeights, rhythm.minutesPerDay, restDays),
    revision: plan.revision + 1,
    history: [
      ...plan.history,
      {
        at: now,
        reason: `Rythme modifié : ${rhythm.minutesPerDay} min/jour sur ${7 - restDays.length} jours.`,
        weights: plan.areaWeights,
      },
    ],
  };
}

export function blocksForDate(plan: TrainingPlanRecord, date: Date = new Date()): PlanBlock[] {
  return plan.week[date.getDay()]?.blocks ?? [];
}

export function isRestDay(plan: TrainingPlanRecord, date: Date = new Date()): boolean {
  return plan.week[date.getDay()]?.rest ?? false;
}

export function weeklyMinutes(plan: TrainingPlanRecord): number {
  return plan.week.reduce(
    (sum, day) => sum + day.blocks.reduce((daySum, block) => daySum + block.minutes, 0),
    0,
  );
}

export interface PlanProgress {
  /** Blocs du plan réellement effectués depuis sa création. */
  completedBlocks: number;
  /** Blocs attendus sur la même période. */
  expectedBlocks: number;
  ratio: number;
  todayTotal: number;
  todayDone: number;
  /** Identifiants des blocs du jour déjà terminés. */
  doneBlockIds: string[];
  daysRemaining: number | null;
}

/**
 * Clé de journée dans le fuseau de l'utilisateur. On ne peut pas découper sur
 * la chaîne ISO (qui est en UTC) : une séance faite le soir en UTC-5 serait
 * comptée sur le mauvais jour, alors que le plan raisonne en jours locaux.
 */
function dayKey(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Avancement réel du plan, calculé à partir des sessions effectivement terminées. */
export function computePlanProgress(
  plan: TrainingPlanRecord,
  sessions: SessionRecord[],
  now: Date = new Date(),
): PlanProgress {
  const planSessions = sessions.filter(
    (s) => s.planId === plan.id && s.planBlockId && s.finishedAt,
  );

  const completedKeys = new Set(
    planSessions.map((s) => `${dayKey(new Date(s.startedAt))}::${s.planBlockId}`),
  );

  const start = new Date(plan.createdAt);
  let expectedBlocks = 0;
  const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  while (cursor <= today) {
    expectedBlocks += plan.week[cursor.getDay()]?.blocks.length ?? 0;
    cursor.setDate(cursor.getDate() + 1);
  }

  const todayBlocks = blocksForDate(plan, now);
  const todayKey = dayKey(now);
  const doneBlockIds = todayBlocks
    .filter((b) => completedKeys.has(`${todayKey}::${b.id}`))
    .map((b) => b.id);

  const daysRemaining = plan.targetDate
    ? Math.max(
        0,
        Math.ceil((new Date(plan.targetDate).getTime() - now.getTime()) / 86_400_000),
      )
    : null;

  return {
    completedBlocks: completedKeys.size,
    expectedBlocks,
    ratio: expectedBlocks > 0 ? Math.min(1, completedKeys.size / expectedBlocks) : 0,
    todayTotal: todayBlocks.length,
    todayDone: doneBlockIds.length,
    doneBlockIds,
    daysRemaining,
  };
}

export function weeksBetween(from: Date, to: Date): number {
  return Math.max(1, Math.ceil((to.getTime() - from.getTime()) / (7 * 86_400_000)));
}
