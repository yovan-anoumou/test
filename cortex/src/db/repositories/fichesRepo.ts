import { getDB } from "../db";
import type { FicheProgressRecord } from "../schema";

function empty(ficheId: string): FicheProgressRecord {
  return {
    ficheId,
    readCount: 0,
    lastReadAt: null,
    favorite: false,
    quizAttempts: 0,
    quizCorrect: 0,
  };
}

export async function getAllFicheProgress(): Promise<Map<string, FicheProgressRecord>> {
  const db = await getDB();
  const all = await db.getAll("ficheProgress");
  return new Map(all.map((p) => [p.ficheId, p]));
}

export async function getFicheProgress(ficheId: string): Promise<FicheProgressRecord> {
  const db = await getDB();
  return (await db.get("ficheProgress", ficheId)) ?? empty(ficheId);
}

async function update(
  ficheId: string,
  patch: (current: FicheProgressRecord) => FicheProgressRecord,
): Promise<FicheProgressRecord> {
  const db = await getDB();
  const current = (await db.get("ficheProgress", ficheId)) ?? empty(ficheId);
  const next = patch(current);
  await db.put("ficheProgress", next);
  return next;
}

/** Une lecture de la fiche. Appelé une fois par ouverture de l'écran de détail. */
export async function markFicheRead(ficheId: string): Promise<FicheProgressRecord> {
  return update(ficheId, (c) => ({
    ...c,
    readCount: c.readCount + 1,
    lastReadAt: new Date().toISOString(),
  }));
}

export async function toggleFicheFavorite(ficheId: string): Promise<FicheProgressRecord> {
  return update(ficheId, (c) => ({ ...c, favorite: !c.favorite }));
}

/** Auto-évaluation sur une mini-question de la fiche. */
export async function recordFicheQuiz(ficheId: string, correct: boolean): Promise<FicheProgressRecord> {
  return update(ficheId, (c) => ({
    ...c,
    quizAttempts: c.quizAttempts + 1,
    quizCorrect: c.quizCorrect + (correct ? 1 : 0),
  }));
}

export async function putFicheProgress(record: FicheProgressRecord): Promise<void> {
  const db = await getDB();
  await db.put("ficheProgress", record);
}
