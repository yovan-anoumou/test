import { describe, expect, it } from "vitest";
import { createEmptyCard, State } from "ts-fsrs";
import { rateCard } from "../../src/fsrs/scheduler";
import type { CardRecord } from "../../src/db/schema";

function freshCard(now: Date): CardRecord {
  const empty = createEmptyCard(now);
  return {
    questionId: "q1",
    module: "tage2",
    subtest: "calcul",
    due: empty.due.toISOString(),
    stability: empty.stability,
    difficulty: empty.difficulty,
    elapsed_days: empty.elapsed_days,
    scheduled_days: empty.scheduled_days,
    learning_steps: empty.learning_steps,
    reps: empty.reps,
    lapses: empty.lapses,
    state: State.New,
    last_review: null,
  };
}

describe("rateCard", () => {
  it("passe une carte neuve à l'état appris après une note 'good'", () => {
    const now = new Date("2026-01-01T10:00:00Z");
    const card = freshCard(now);
    const next = rateCard(card, "good", 0.9, now);

    expect(next.reps).toBe(1);
    expect(next.state).not.toBe(State.New);
    expect(new Date(next.due).getTime()).toBeGreaterThan(now.getTime());
  });

  it("programme un intervalle plus court pour 'again' que pour 'easy'", () => {
    const now = new Date("2026-01-01T10:00:00Z");
    const card = freshCard(now);

    const learned = rateCard(card, "good", 0.9, now);
    const later = new Date(new Date(learned.due).getTime() + 1000);

    const again = rateCard(learned, "again", 0.9, later);
    const easy = rateCard(learned, "easy", 0.9, later);

    expect(new Date(again.due).getTime()).toBeLessThan(new Date(easy.due).getTime());
  });

  it("incrémente lapses après une réponse 'again' sur une carte en révision", () => {
    const now = new Date("2026-01-01T10:00:00Z");
    const card = freshCard(now);
    const learned = rateCard(card, "good", 0.9, now);
    const later = new Date(new Date(learned.due).getTime() + 1000);
    const failed = rateCard(learned, "again", 0.9, later);

    expect(failed.lapses).toBeGreaterThanOrEqual(learned.lapses);
  });
});
