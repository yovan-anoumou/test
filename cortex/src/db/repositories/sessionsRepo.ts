import { getDB } from "../db";
import type { SessionRecord } from "../schema";

export async function createSession(session: SessionRecord): Promise<void> {
  const db = await getDB();
  await db.put("sessions", session);
}

export async function updateSession(session: SessionRecord): Promise<void> {
  const db = await getDB();
  await db.put("sessions", session);
}

export async function getSession(id: string): Promise<SessionRecord | undefined> {
  const db = await getDB();
  return db.get("sessions", id);
}

export async function getAllSessions(): Promise<SessionRecord[]> {
  const db = await getDB();
  return db.getAll("sessions");
}

export async function getMockExamSessions(): Promise<SessionRecord[]> {
  const all = await getAllSessions();
  return all
    .filter((s) => s.kind === "mock-exam" && s.finishedAt)
    .sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1));
}
