import { getDB } from "../db";
import type { TrainingPlanRecord } from "../schema";
import { getSettings, updateSettings } from "./settingsRepo";

export async function savePlan(plan: TrainingPlanRecord): Promise<void> {
  const db = await getDB();
  await db.put("plans", plan);
}

export async function getPlan(id: string): Promise<TrainingPlanRecord | undefined> {
  const db = await getDB();
  return db.get("plans", id);
}

export async function getAllPlans(): Promise<TrainingPlanRecord[]> {
  const db = await getDB();
  const all = await db.getAll("plans");
  return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Plan actif de l'utilisateur (référencé dans les réglages). */
export async function getActivePlan(): Promise<TrainingPlanRecord | undefined> {
  const settings = await getSettings();
  if (!settings.activePlanId) return undefined;
  const plan = await getPlan(settings.activePlanId);
  return plan && !plan.archivedAt ? plan : undefined;
}

/** Enregistre le plan et en fait le plan actif, en archivant le précédent. */
export async function activatePlan(plan: TrainingPlanRecord): Promise<void> {
  const previous = await getActivePlan();
  if (previous && previous.id !== plan.id) {
    await savePlan({ ...previous, archivedAt: new Date().toISOString() });
  }
  await savePlan(plan);
  await updateSettings({ activePlanId: plan.id });
}
