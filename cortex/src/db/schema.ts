import type { DBSchema } from "idb";
import type { ModuleId, SubtestId } from "../domain/modules";

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
  sessionKind: "daily" | "short" | "mock-exam" | "weak-review" | "custom";
}

export interface SessionRecord {
  id: string; // uuid
  kind: "daily" | "short" | "mock-exam" | "weak-review" | "custom";
  startedAt: string; // ISO date
  finishedAt: string | null;
  questionIds: string[];
  /** Pour un test blanc : score par sous-test. */
  mockExamResult: {
    subtestScores: Partial<Record<SubtestId, { correct: number; total: number; timeMs: number }>>;
    projectedScore: number | null;
  } | null;
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
}

export const DB_NAME = "cortex-db";
export const DB_VERSION = 1;
