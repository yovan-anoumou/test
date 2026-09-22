import { getDB, DEFAULT_SETTINGS } from "../db";
import type { SettingsRecord } from "../schema";

/**
 * Les réglages sont toujours fusionnés avec les valeurs par défaut : un réglage
 * ajouté dans une version ultérieure prend sa valeur par défaut plutôt que
 * `undefined` pour les installations existantes.
 */
export async function getSettings(): Promise<SettingsRecord> {
  const db = await getDB();
  const stored = await db.get("settings", "app");
  return { ...DEFAULT_SETTINGS, ...stored, key: "app" };
}

export async function updateSettings(patch: Partial<SettingsRecord>): Promise<SettingsRecord> {
  const db = await getDB();
  const current = await getSettings();
  const next: SettingsRecord = { ...current, ...patch, key: "app" };
  await db.put("settings", next);
  return next;
}
