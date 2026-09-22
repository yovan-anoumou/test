import { State } from "ts-fsrs";
import { getDB } from "../db";
import type { CardRecord } from "../schema";
import type { SubtestId } from "../../domain/modules";

export async function getCard(questionId: string): Promise<CardRecord | undefined> {
  const db = await getDB();
  return db.get("cards", questionId);
}

export async function putCard(card: CardRecord): Promise<void> {
  const db = await getDB();
  await db.put("cards", card);
}

export async function putCards(cards: CardRecord[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction("cards", "readwrite");
  await Promise.all(cards.map((c) => tx.store.put(c)));
  await tx.done;
}

export async function getAllCards(): Promise<CardRecord[]> {
  const db = await getDB();
  return db.getAll("cards");
}

export async function getCardsBySubtest(subtest: SubtestId): Promise<CardRecord[]> {
  const db = await getDB();
  return db.getAllFromIndex("cards", "by-subtest", subtest);
}

/** Cartes dues à une date donnée (par défaut maintenant), toutes matières confondues, tous états. */
export async function getDueCards(now: Date = new Date()): Promise<CardRecord[]> {
  const db = await getDB();
  const range = IDBKeyRange.upperBound(now.toISOString());
  return db.getAllFromIndex("cards", "by-due", range);
}

/** Cartes déjà étudiées (Learning/Review/Relearning) et dues maintenant — la file de révision classique. */
export async function getDueReviewCards(now: Date = new Date()): Promise<CardRecord[]> {
  const all = await getDueCards(now);
  return all.filter((c) => c.state !== State.New);
}

/** Cartes jamais étudiées, pour la phase "nouveau contenu". */
export async function getNewCards(): Promise<CardRecord[]> {
  const all = await getAllCards();
  return all.filter((c) => c.state === State.New);
}

export async function countCards(): Promise<number> {
  const db = await getDB();
  return db.count("cards");
}

/** Récupère plusieurs cartes par id, dans l'ordre demandé (ignore les ids sans carte). */
export async function getCardsByIds(questionIds: string[]): Promise<CardRecord[]> {
  const db = await getDB();
  const cards = await Promise.all(questionIds.map((id) => db.get("cards", id)));
  return cards.filter((c): c is CardRecord => c !== undefined);
}
