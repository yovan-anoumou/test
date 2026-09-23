import { getDB } from "../db/db";
import type { CortexDBSchema } from "../db/schema";

export interface CortexBackup {
  /**
   * 1 = avant les plans/diagnostics, 2 = avant la progression des fiches,
   * 3 = format actuel. Les anciens formats restent importables.
   */
  version: 1 | 2 | 3;
  exportedAt: string;
  cards: CortexDBSchema["cards"]["value"][];
  reviews: CortexDBSchema["reviews"]["value"][];
  sessions: CortexDBSchema["sessions"]["value"][];
  settings: CortexDBSchema["settings"]["value"][];
  diagnostics?: CortexDBSchema["diagnostics"]["value"][];
  plans?: CortexDBSchema["plans"]["value"][];
  ficheProgress?: CortexDBSchema["ficheProgress"]["value"][];
}

export async function exportBackup(): Promise<CortexBackup> {
  const db = await getDB();
  const [cards, reviews, sessions, settings, diagnostics, plans, ficheProgress] =
    await Promise.all([
      db.getAll("cards"),
      db.getAll("reviews"),
      db.getAll("sessions"),
      db.getAll("settings"),
      db.getAll("diagnostics"),
      db.getAll("plans"),
      db.getAll("ficheProgress"),
    ]);
  return {
    version: 3,
    exportedAt: new Date().toISOString(),
    cards,
    reviews,
    sessions,
    settings,
    diagnostics,
    plans,
    ficheProgress,
  };
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

/**
 * Restaure une sauvegarde. Remplace intégralement les données existantes (après
 * confirmation côté UI). Les sauvegardes au format v1 restent acceptées : les
 * diagnostics et plans y sont simplement absents.
 */
export async function importBackup(backup: CortexBackup): Promise<void> {
  if (![1, 2, 3].includes(backup.version)) {
    throw new Error("Version de sauvegarde non reconnue");
  }
  const db = await getDB();
  const tx = db.transaction(
    ["cards", "reviews", "sessions", "settings", "diagnostics", "plans", "ficheProgress"],
    "readwrite",
  );
  await Promise.all([
    tx.objectStore("cards").clear(),
    tx.objectStore("reviews").clear(),
    tx.objectStore("sessions").clear(),
    tx.objectStore("settings").clear(),
    tx.objectStore("diagnostics").clear(),
    tx.objectStore("plans").clear(),
    tx.objectStore("ficheProgress").clear(),
  ]);
  await Promise.all([
    ...backup.cards.map((c) => tx.objectStore("cards").put(c)),
    ...backup.reviews.map((r) => tx.objectStore("reviews").put(r)),
    ...backup.sessions.map((s) => tx.objectStore("sessions").put(s)),
    ...backup.settings.map((s) => tx.objectStore("settings").put(s)),
    ...(backup.diagnostics ?? []).map((d) => tx.objectStore("diagnostics").put(d)),
    ...(backup.plans ?? []).map((p) => tx.objectStore("plans").put(p)),
    ...(backup.ficheProgress ?? []).map((f) => tx.objectStore("ficheProgress").put(f)),
  ]);
  await tx.done;
}

export function parseBackupFile(text: string): CortexBackup {
  const data = JSON.parse(text) as Partial<CortexBackup>;
  if (
    !(typeof data.version === "number" && [1, 2, 3].includes(data.version)) ||
    !Array.isArray(data.cards) ||
    !Array.isArray(data.reviews)
  ) {
    throw new Error("Fichier de sauvegarde invalide");
  }
  return data as CortexBackup;
}
