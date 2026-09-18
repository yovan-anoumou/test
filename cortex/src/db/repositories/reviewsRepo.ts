import { getDB } from "../db";
import type { ReviewRecord } from "../schema";

export async function addReview(review: ReviewRecord): Promise<void> {
  const db = await getDB();
  await db.put("reviews", review);
}

export async function getAllReviews(): Promise<ReviewRecord[]> {
  const db = await getDB();
  return db.getAll("reviews");
}

export async function getReviewsSince(sinceIso: string): Promise<ReviewRecord[]> {
  const db = await getDB();
  const range = IDBKeyRange.lowerBound(sinceIso);
  return db.getAllFromIndex("reviews", "by-timestamp", range);
}

export async function getReviewsForSession(sessionId: string): Promise<ReviewRecord[]> {
  const db = await getDB();
  return db.getAllFromIndex("reviews", "by-session", sessionId);
}
