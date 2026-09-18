import { createEmptyCard, State } from "ts-fsrs";
import { getDB } from "./db";
import type { CardRecord } from "./schema";
import { loadQuestionBank } from "../domain/questionBank";
import type { Question } from "../domain/question";

function toCardRecord(question: Question, now: Date): CardRecord {
  const empty = createEmptyCard(now);
  return {
    questionId: question.id,
    module: question.module,
    subtest: question.subtest,
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

/**
 * Crée une carte FSRS "New" pour chaque question de la banque qui n'a pas
 * encore de carte en base. Appelé au démarrage de l'app, et à chaque import
 * de nouvelles questions utilisateur. Idempotent.
 */
export async function syncCardsWithQuestionBank(): Promise<{ added: number }> {
  const [db, questions] = await Promise.all([getDB(), loadQuestionBank()]);
  const existingIds = new Set((await db.getAllKeys("cards")) as string[]);
  const now = new Date();
  const missing = questions.filter((q) => !existingIds.has(q.id));
  if (missing.length === 0) return { added: 0 };

  const tx = db.transaction("cards", "readwrite");
  await Promise.all(missing.map((q) => tx.store.put(toCardRecord(q, now))));
  await tx.done;
  return { added: missing.length };
}
