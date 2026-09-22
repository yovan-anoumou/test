import { getDB } from "../db";
import type { DiagnosticRecord } from "../schema";

export async function saveDiagnostic(record: DiagnosticRecord): Promise<void> {
  const db = await getDB();
  await db.put("diagnostics", record);
}

export async function getDiagnostic(id: string): Promise<DiagnosticRecord | undefined> {
  const db = await getDB();
  return db.get("diagnostics", id);
}

export async function getAllDiagnostics(): Promise<DiagnosticRecord[]> {
  const db = await getDB();
  const all = await db.getAll("diagnostics");
  return all.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

/** Dernier diagnostic terminé, celui qui sert de référence au plan. */
export async function getLatestDiagnostic(): Promise<DiagnosticRecord | undefined> {
  const all = await getAllDiagnostics();
  return all.find((d) => d.finishedAt !== null);
}
