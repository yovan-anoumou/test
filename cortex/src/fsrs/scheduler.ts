import { fsrs, generatorParameters, Rating, State, type Card as FsrsCard, type Grade } from "ts-fsrs";
import type { CardRecord } from "../db/schema";

export type UserRating = "again" | "hard" | "good" | "easy";

const RATING_MAP: Record<UserRating, Grade> = {
  again: Rating.Again,
  hard: Rating.Hard,
  good: Rating.Good,
  easy: Rating.Easy,
};

export const RATING_LABELS: Record<UserRating, string> = {
  again: "À revoir",
  hard: "Difficile",
  good: "Correct",
  easy: "Facile",
};

function toFsrsCard(record: CardRecord): FsrsCard {
  return {
    due: new Date(record.due),
    stability: record.stability,
    difficulty: record.difficulty,
    elapsed_days: record.elapsed_days,
    scheduled_days: record.scheduled_days,
    learning_steps: record.learning_steps,
    reps: record.reps,
    lapses: record.lapses,
    state: record.state,
    last_review: record.last_review ? new Date(record.last_review) : undefined,
  };
}

function toCardRecord(
  card: FsrsCard,
  questionId: string,
  module: CardRecord["module"],
  subtest: CardRecord["subtest"],
): CardRecord {
  return {
    questionId,
    module,
    subtest,
    due: card.due.toISOString(),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsed_days,
    scheduled_days: card.scheduled_days,
    learning_steps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    last_review: card.last_review ? card.last_review.toISOString() : null,
  };
}

function makeScheduler(retentionTarget: number) {
  return fsrs(generatorParameters({ request_retention: retentionTarget }));
}

/**
 * Applique une note utilisateur à une carte et retourne la carte mise à jour.
 * `retentionTarget` (0-1) vient des réglages utilisateur (défaut 0.9).
 */
export function rateCard(
  record: CardRecord,
  rating: UserRating,
  retentionTarget: number,
  now: Date = new Date(),
): CardRecord {
  const scheduler = makeScheduler(retentionTarget);
  const current = toFsrsCard(record);
  const { card: next } = scheduler.next(current, now, RATING_MAP[rating]);
  return toCardRecord(next, record.questionId, record.module, record.subtest);
}

/** Aperçu de l'intervalle pour chaque note possible, utile pour afficher "revoir dans X jours". */
export function previewIntervals(
  record: CardRecord,
  retentionTarget: number,
  now: Date = new Date(),
): Record<UserRating, Date> {
  const scheduler = makeScheduler(retentionTarget);
  const current = toFsrsCard(record);
  const preview = scheduler.repeat(current, now);
  return {
    again: preview[Rating.Again].card.due,
    hard: preview[Rating.Hard].card.due,
    good: preview[Rating.Good].card.due,
    easy: preview[Rating.Easy].card.due,
  };
}

export function isNewCard(record: CardRecord): boolean {
  return record.state === State.New;
}

export { State as FsrsState };
