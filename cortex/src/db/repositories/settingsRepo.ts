import { getDB, DEFAULT_SETTINGS } from "../db";
import type { SettingsRecord } from "../schema";

export async function getSettings(): Promise<SettingsRecord> {
  const db = await getDB();
  const s = await db.get("settings", "app");
  return s ?? DEFAULT_SETTINGS;
}

export async function updateSettings(patch: Partial<SettingsRecord>): Promise<SettingsRecord> {
  const db = await getDB();
  const current = (await db.get("settings", "app")) ?? DEFAULT_SETTINGS;
  const next = { ...current, ...patch, key: "app" as const };
  await db.put("settings", next);
  return next;
}
