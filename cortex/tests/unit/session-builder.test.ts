import { describe, expect, it } from "vitest";
import { State } from "ts-fsrs";
import { buildDailySession } from "../../src/domain/session-builder";
import type { CardRecord } from "../../src/db/schema";
import type { SubtestId } from "../../src/domain/modules";

function makeCard(id: string, subtest: SubtestId, state: State, dueOffsetMs = 0): CardRecord {
  return {
    questionId: id,
    module: "tage2",
    subtest,
    due: new Date(Date.now() + dueOffsetMs).toISOString(),
    stability: 1,
    difficulty: 5,
    elapsed_days: 0,
    scheduled_days: 0,
    learning_steps: 0,
    reps: state === State.New ? 0 : 1,
    lapses: 0,
    state,
    last_review: state === State.New ? null : new Date().toISOString(),
  };
}

const targetTime = () => 30; // 30s/question fixe pour des budgets prévisibles

describe("buildDailySession", () => {
  it("ne dépasse pas significativement le budget total de la session", () => {
    const due = Array.from({ length: 40 }, (_, i) => makeCard(`due-${i}`, "calcul", State.Review, -1000));
    const fresh = Array.from({ length: 40 }, (_, i) => makeCard(`new-${i}`, "lexiphrase", State.New));

    const plan = buildDailySession(due, fresh, targetTime, "daily");
    const totalSeconds = plan.items.length * 30 * 1.15;

    expect(totalSeconds).toBeLessThanOrEqual(plan.totalBudgetSeconds + 30 * 1.15);
  });

  it("mélange les sous-tests (interleaving) plutôt que de faire des blocs", () => {
    const due = [
      ...Array.from({ length: 5 }, (_, i) => makeCard(`calc-${i}`, "calcul", State.Review, -1000)),
      ...Array.from({ length: 5 }, (_, i) => makeCard(`lex-${i}`, "lexiphrase", State.Review, -1000)),
    ];
    const plan = buildDailySession(due, [], targetTime, "daily");

    const dueMixItems = plan.items.filter((i) => i.phase === "due-mix");
    let maxRun = 0;
    let run = 1;
    for (let i = 1; i < dueMixItems.length; i++) {
      if (dueMixItems[i].card.subtest === dueMixItems[i - 1].card.subtest) run++;
      else run = 1;
      maxRun = Math.max(maxRun, run);
    }
    // Avec deux sous-tests en quantité égale, l'interleaving round-robin ne
    // doit jamais produire plus de 2 questions consécutives de la même matière.
    expect(maxRun).toBeLessThanOrEqual(2);
  });

  it("complète avec des cartes neuves quand aucune carte n'est due (premier lancement)", () => {
    const fresh = Array.from({ length: 20 }, (_, i) => makeCard(`new-${i}`, "calcul-mental", State.New));
    const plan = buildDailySession([], fresh, targetTime, "short");

    expect(plan.items.length).toBeGreaterThan(0);
  });

  it("retourne un plan vide quand il n'y a aucune carte disponible", () => {
    const plan = buildDailySession([], [], targetTime, "daily");
    expect(plan.items.length).toBe(0);
  });
});
