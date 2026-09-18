import { getDB } from "../db/db";
import type { CortexDBSchema } from "../db/schema";

export interface CortexBackup {
  version: 1;
  exportedAt: string;
  cards: CortexDBSchema["cards"]["value"][];
  reviews: CortexDBSchema["reviews"]["value"][];
  sessions: CortexDBSchema["sessions"]["value"][];
  settings: CortexDBSchema["settings"]["value"][];
}

export async function exportBackup(): Promise<CortexBackup> {
  const db = await getDB();
  const [cards, reviews, sessions, settings] = await Promise.all([
    db.getAll("cards"),
    db.getAll("reviews"),
    db.getAll("sessions"),
    db.getAll("settings"),
  ]);
  return { version: 1, exportedAt: new Date().toISOString(), cards, reviews, sessions, settings };
}

export function downloadBackup(backup: CortexBackup): void {
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `cortex-backup-${backup.exportedAt.slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Restaure une sauvegarde. Remplace intégralement les données existantes (après confirmation côté UI). */
export async function importBackup(backup: CortexBackup): Promise<void> {
  if (backup.version !== 1) throw new Error("Version de sauvegarde non reconnue");
  const db = await getDB();
  const tx = db.transaction(["cards", "reviews", "sessions", "settings"], "readwrite");
  await Promise.all([
    tx.objectStore("cards").clear(),
    tx.objectStore("reviews").clear(),
    tx.objectStore("sessions").clear(),
    tx.objectStore("settings").clear(),
  ]);
  await Promise.all([
    ...backup.cards.map((c) => tx.objectStore("cards").put(c)),
    ...backup.reviews.map((r) => tx.objectStore("reviews").put(r)),
    ...backup.sessions.map((s) => tx.objectStore("sessions").put(s)),
    ...backup.settings.map((s) => tx.objectStore("settings").put(s)),
  ]);
  await tx.done;
}

export function parseBackupFile(text: string): CortexBackup {
  const data = JSON.parse(text) as Partial<CortexBackup>;
  if (data.version !== 1 || !Array.isArray(data.cards) || !Array.isArray(data.reviews)) {
    throw new Error("Fichier de sauvegarde invalide");
  }
  return data as CortexBackup;
}
