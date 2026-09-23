import type { DBSchema } from "idb";
import type { ModuleId, SubtestId } from "../domain/modules";
import type { ObjectiveId, SkillAreaId } from "../domain/skills";

/** État FSRS persistant d'une carte (une par question). Miroir du type `Card` de ts-fsrs. */
export interface CardRecord {
  questionId: string;
  module: ModuleId;
  subtest: SubtestId;
  due: string; // ISO date
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  learning_steps: number;
  reps: number;
  lapses: number;
  state: number; // ts-fsrs State enum
  last_review: string | null; // ISO date
}

/**
 * Contexte dans lequel une réponse a été donnée. Les réponses en mode
 * apprentissage ne comptent pas dans les statistiques de vitesse : l'utilisateur
 * y prend volontairement son temps.
 */
export type PracticeMode = "learning" | "training" | "exam" | "diagnostic";

export type SessionKindRecord =
  | "daily"
  | "short"
  | "mock-exam"
  | "weak-review"
  | "learning"
  | "plan"
  | "focus"
  | "diagnostic"
  | "custom";

/** Historique d'une réponse, utilisé pour le dashboard et l'estimation de score. */
export interface ReviewRecord {
  id: string; // uuid
  questionId: string;
  module: ModuleId;
  subtest: SubtestId;
  timestamp: string; // ISO date
  rating: 1 | 2 | 3 | 4; // Again/Hard/Good/Easy
  correct: boolean;
  responseTimeMs: number;
  targetTimeSeconds: number;
  difficulty: number;
  sessionId: string | null;
  sessionKind: SessionKindRecord;
  /** Champs ajoutés en v2 — absents des réponses enregistrées avant. */
  mode?: PracticeMode;
  /** Index du choix sélectionné : permet d'analyser le type d'erreur commise. */
  selectedIndex?: number | null;
  /** Bloc du plan d'entraînement à l'origine de la session, le cas échéant. */
  planBlockId?: string | null;
}

export interface SessionRecord {
  id: string; // uuid
  kind: SessionKindRecord;
  startedAt: string; // ISO date
  finishedAt: string | null;
  questionIds: string[];
  /** Pour un test blanc : score par sous-test. */
  mockExamResult: {
    subtestScores: Partial<Record<SubtestId, { correct: number; total: number; timeMs: number }>>;
    projectedScore: number | null;
  } | null;
  /** Champs ajoutés en v2. */
  mode?: PracticeMode;
  areaId?: SkillAreaId | null;
  planId?: string | null;
  planBlockId?: string | null;
}

export interface SettingsRecord {
  key: "app";
  theme: "light" | "dark" | "system";
  retentionTarget: number; // 0-1, défaut 0.9
  dailySessionMinutes: 10 | 25;
  timedModeDefault: boolean;
  onboardingDone: boolean;
  lastActiveDate: string | null; // pour la série de jours
  currentStreak: number;
  bestStreak: number;
  /** Réglages ajoutés en v2 (fusionnés avec les valeurs par défaut au chargement). */
  activePlanId: string | null;
  lastDiagnosticId: string | null;
}

// ---------------------------------------------------------------------------
// Diagnostic (test de niveau)
// ---------------------------------------------------------------------------

export interface DiagnosticAnswer {
  questionId: string;
  subtest: SubtestId;
  area: SkillAreaId;
  difficulty: number;
  correct: boolean;
  selectedIndex: number | null;
  responseTimeMs: number;
  targetTimeSeconds: number;
}

export interface WeakTag {
  tag: string;
  attempts: number;
  errors: number;
}

export interface AreaAssessment {
  area: SkillAreaId;
  questions: number;
  correct: number;
  accuracy: number;
  /** Temps de réponse moyen ÷ temps cible. >1 = plus lent que la cible. */
  paceRatio: number;
  avgResponseTimeMs: number;
  /** Score de maîtrise 0-100 : précision pondérée par la difficulté + vitesse. */
  masteryScore: number;
  /** Niveau estimé 1 (débutant) à 5 (excellent). */
  level: 1 | 2 | 3 | 4 | 5;
  /** Difficulté la plus élevée réussie. */
  reachedDifficulty: number;
  confidence: "faible" | "moyenne" | "bonne";
  weakTags: WeakTag[];
  /** Descriptions des erreurs commises (issues des distracteurs choisis). */
  errorTypes: string[];
}

export interface DiagnosticRecord {
  id: string;
  startedAt: string;
  finishedAt: string | null;
  objective: ObjectiveId;
  answers: DiagnosticAnswer[];
  areas: AreaAssessment[];
  overallScore: number;
  totalTimeMs: number;
}

// ---------------------------------------------------------------------------
// Plan d'entraînement
// ---------------------------------------------------------------------------

export type PlanBlockKind = "area" | "error-review" | "mixed";

export interface PlanBlock {
  id: string;
  kind: PlanBlockKind;
  area: SkillAreaId | null;
  minutes: number;
  label: string;
}

export interface PlanDay {
  /** 0 = dimanche, 1 = lundi … 6 = samedi (comme Date#getDay). */
  dayOfWeek: number;
  rest: boolean;
  blocks: PlanBlock[];
}

export interface PlanRevision {
  at: string;
  reason: string;
  weights: Record<SkillAreaId, number>;
}

export interface TrainingPlanRecord {
  id: string;
  createdAt: string;
  updatedAt: string;
  objective: ObjectiveId;
  targetDate: string | null; // ISO date
  durationWeeks: number;
  minutesPerDay: number;
  daysPerWeek: number;
  /** Jours de repos (0 = dimanche). */
  restDays: number[];
  /** Part du temps hebdomadaire attribuée à chaque domaine (somme = 1). */
  areaWeights: Record<SkillAreaId, number>;
  week: PlanDay[];
  diagnosticId: string | null;
  revision: number;
  history: PlanRevision[];
  archivedAt: string | null;
}

// ---------------------------------------------------------------------------
// Fiches mémo (progression de lecture)
// ---------------------------------------------------------------------------

/**
 * Ce que l'app sait d'une fiche pour *cet* utilisateur. Le contenu de la fiche
 * lui-même reste statique (public/fiches/*.json) ; ici on ne stocke que la
 * trace d'usage. La maîtrise, elle, est recalculée à partir des réponses aux
 * questions liées (voir `domain/fiches/mastery.ts`) — on ne la stocke pas pour
 * qu'elle reste toujours cohérente avec l'historique réel.
 * Ajouté en v3.
 */
export interface FicheProgressRecord {
  ficheId: string;
  readCount: number;
  lastReadAt: string | null;
  /** Marquée comme importante par l'utilisateur (« Mes fiches »). */
  favorite: boolean;
  /** Mini-questions de la fiche : tentatives et auto-évaluations réussies. */
  quizAttempts: number;
  quizCorrect: number;
}

export interface CortexDBSchema extends DBSchema {
  cards: {
    key: string; // questionId
    value: CardRecord;
    indexes: { "by-due": string; "by-subtest": SubtestId };
  };
  reviews: {
    key: string; // review id
    value: ReviewRecord;
    indexes: { "by-timestamp": string; "by-subtest": SubtestId; "by-session": string };
  };
  sessions: {
    key: string; // session id
    value: SessionRecord;
    indexes: { "by-startedAt": string };
  };
  settings: {
    key: string; // "app"
    value: SettingsRecord;
  };
  diagnostics: {
    key: string;
    value: DiagnosticRecord;
    indexes: { "by-startedAt": string };
  };
  plans: {
    key: string;
    value: TrainingPlanRecord;
    indexes: { "by-createdAt": string };
  };
  ficheProgress: {
    key: string; // ficheId
    value: FicheProgressRecord;
    indexes: { "by-lastReadAt": string };
  };
}

export const DB_NAME = "cortex-db";
export const DB_VERSION = 3;
