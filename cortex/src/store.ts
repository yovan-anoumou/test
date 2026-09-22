import { signal } from "@preact/signals";
import type { SettingsRecord } from "./db/schema";
import { DEFAULT_SETTINGS } from "./db/db";
import { updateSettings } from "./db/repositories/settingsRepo";
import { syncCardsWithQuestionBank } from "./db/seed";

export const settings = signal<SettingsRecord>(DEFAULT_SETTINGS);
export const appReady = signal(false);
export const appError = signal<string | null>(null);

export async function initApp(): Promise<void> {
  try {
    // `updateSettings({})` relit les réglages fusionnés avec les valeurs par
    // défaut et les réécrit : après une mise à jour de l'app, les réglages
    // ajoutés depuis sont persistés au lieu de rester implicites.
    const [s] = await Promise.all([updateSettings({}), syncCardsWithQuestionBank()]);
    settings.value = s;
    applyTheme(s.theme);
    appReady.value = true;
  } catch (err) {
    console.error("[store] échec de l'initialisation", err);
    appError.value = err instanceof Error ? err.message : "Erreur inconnue";
  }
}

export async function setTheme(theme: SettingsRecord["theme"]): Promise<void> {
  settings.value = await updateSettings({ theme });
  applyTheme(theme);
}

export async function patchSettings(patch: Partial<SettingsRecord>): Promise<void> {
  settings.value = await updateSettings(patch);
}

function applyTheme(theme: SettingsRecord["theme"]): void {
  const root = document.documentElement;
  if (theme === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", theme);
}
