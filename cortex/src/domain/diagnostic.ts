// Test de niveau adaptatif : quelques questions par domaine, dont la difficulté
// s'ajuste après chaque réponse (réussite → plus dur, échec → plus simple).
// Objectif : estimer un niveau en ~25 questions plutôt qu'en épuisant la banque.

import type { DiagnosticAnswer, DiagnosticRecord } from "../db/schema";
import type { Question } from "./question";
import type { SubtestId } from "./modules";
import { SKILL_AREAS, SKILL_AREA_IDS, type ObjectiveId, type SkillAreaId } from "./skills";
import { answersFromDiagnostic, assessAllAreas } from "./skill-analysis";
import { shuffle } from "../utils/shuffle";
import { newId } from "../utils/id";

export const DEFAULT_QUESTIONS_PER_AREA = 4;
const START_DIFFICULTY = 3;

export interface DiagnosticState {
  id: string;
  objective: ObjectiveId;
  startedAt: string;
  questionsPerArea: number;
  /** Difficulté visée pour la prochaine question de chaque domaine. */
  targetByArea: Record<SkillAreaId, number>;
  askedByArea: Record<SkillAreaId, number>;
  subtestUsage: Record<string, number>;
  usedQuestionIds: string[];
  answers: DiagnosticAnswer[];
}

function emptyRecord<T>(value: T): Record<SkillAreaId, T> {
  return SKILL_AREA_IDS.reduce(
    (acc, area) => {
      acc[area] = value;
      return acc;
    },
    {} as Record<SkillAreaId, T>,
  );
}

export function initDiagnostic(
  objective: ObjectiveId,
  questionsPerArea: number = DEFAULT_QUESTIONS_PER_AREA,
): DiagnosticState {
  return {
    id: newId(),
    objective,
    startedAt: new Date().toISOString(),
    questionsPerArea,
    targetByArea: emptyRecord(START_DIFFICULTY),
    askedByArea: emptyRecord(0),
    subtestUsage: {},
    usedQuestionIds: [],
    answers: [],
  };
}

export function totalQuestions(state: DiagnosticState): number {
  return SKILL_AREA_IDS.length * state.questionsPerArea;
}

export function answeredCount(state: DiagnosticState): number {
  return state.answers.length;
}

/**
 * Domaine de la prochaine question : tour de rôle entre les domaines
 * (interleaving), en sautant ceux qui ont déjà leur quota.
 */
function nextArea(state: DiagnosticState): SkillAreaId | null {
  const round = Math.floor(state.answers.length / SKILL_AREA_IDS.length);
  const offset = state.answers.length % SKILL_AREA_IDS.length;
  for (let i = 0; i < SKILL_AREA_IDS.length; i++) {
    const area = SKILL_AREA_IDS[(offset + i) % SKILL_AREA_IDS.length];
    if (state.askedByArea[area] <= round && state.askedByArea[area] < state.questionsPerArea) {
      return area;
    }
  }
  return SKILL_AREA_IDS.find((area) => state.askedByArea[area] < state.questionsPerArea) ?? null;
}

/**
 * Choisit la prochaine question : dans le domaine dû, la difficulté la plus
 * proche de la cible, en privilégiant les sous-tests encore peu sollicités pour
 * couvrir l'ensemble du domaine.
 */
export function nextDiagnosticQuestion(
  state: DiagnosticState,
  bank: Question[],
): { question: Question; area: SkillAreaId } | null {
  const area = nextArea(state);
  if (!area) return null;

  const subtests: SubtestId[] = SKILL_AREAS[area].subtests;
  const used = new Set(state.usedQuestionIds);
  const target = state.targetByArea[area];

  const candidates = shuffle(
    bank.filter((q) => subtests.includes(q.subtest) && !used.has(q.id)),
  );
  if (candidates.length === 0) {
    // Domaine épuisé : on le marque comme terminé (sur une copie, sans toucher
    // à l'état du test en cours) pour passer au domaine suivant.
    const fallbackState: DiagnosticState = {
      ...state,
      askedByArea: { ...state.askedByArea, [area]: state.questionsPerArea },
    };
    return nextDiagnosticQuestion(fallbackState, bank);
  }

  candidates.sort((a, b) => {
    const difficultyGap = Math.abs(a.difficulty - target) - Math.abs(b.difficulty - target);
    if (difficultyGap !== 0) return difficultyGap;
    return (state.subtestUsage[a.subtest] ?? 0) - (state.subtestUsage[b.subtest] ?? 0);
  });

  return { question: candidates[0], area };
}

/** Enregistre une réponse et ajuste la difficulté visée du domaine concerné. */
export function recordDiagnosticAnswer(
  state: DiagnosticState,
  question: Question,
  area: SkillAreaId,
  selectedIndex: number | null,
  responseTimeMs: number,
): DiagnosticState {
  const correct = selectedIndex === question.correctIndex;
  const answer: DiagnosticAnswer = {
    questionId: question.id,
    subtest: question.subtest,
    area,
    difficulty: question.difficulty,
    correct,
    selectedIndex,
    responseTimeMs,
    targetTimeSeconds: question.targetTimeSeconds,
  };

  const nextTarget = Math.min(
    5,
    Math.max(1, state.targetByArea[area] + (correct ? 1 : -1)),
  );

  return {
    ...state,
    targetByArea: { ...state.targetByArea, [area]: nextTarget },
    askedByArea: { ...state.askedByArea, [area]: state.askedByArea[area] + 1 },
    subtestUsage: {
      ...state.subtestUsage,
      [question.subtest]: (state.subtestUsage[question.subtest] ?? 0) + 1,
    },
    usedQuestionIds: [...state.usedQuestionIds, question.id],
    answers: [...state.answers, answer],
  };
}

/** Transforme les réponses en évaluation par domaine + score global. */
export function finalizeDiagnostic(
  state: DiagnosticState,
  bank: Question[],
): DiagnosticRecord {
  const bankMap = new Map(bank.map((q) => [q.id, q]));
  const areas = assessAllAreas(answersFromDiagnostic(state.answers), bankMap).filter(
    (a) => a.questions > 0,
  );

  const overallScore =
    areas.length > 0
      ? Math.round(areas.reduce((sum, a) => sum + a.masteryScore, 0) / areas.length)
      : 0;

  return {
    id: state.id,
    startedAt: state.startedAt,
    finishedAt: new Date().toISOString(),
    objective: state.objective,
    answers: state.answers,
    areas,
    overallScore,
    totalTimeMs: state.answers.reduce((sum, a) => sum + a.responseTimeMs, 0),
  };
}
