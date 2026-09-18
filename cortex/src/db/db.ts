import { openDB, type IDBPDatabase } from "idb";
import { DB_NAME, DB_VERSION, type CortexDBSchema, type SettingsRecord } from "./schema";

let dbPromise: Promise<IDBPDatabase<CortexDBSchema>> | null = null;

const DEFAULT_SETTINGS: SettingsRecord = {
  key: "app",
  theme: "system",
  retentionTarget: 0.9,
  dailySessionMinutes: 25,
  timedModeDefault: true,
  onboardingDone: false,
  lastActiveDate: null,
  currentStreak: 0,
  bestStreak: 0,
};

export function getDB(): Promise<IDBPDatabase<CortexDBSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<CortexDBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const cards = db.createObjectStore("cards", { keyPath: "questionId" });
        cards.createIndex("by-due", "due");
        cards.createIndex("by-subtest", "subtest");

        const reviews = db.createObjectStore("reviews", { keyPath: "id" });
        reviews.createIndex("by-timestamp", "timestamp");
        reviews.createIndex("by-subtest", "subtest");
        reviews.createIndex("by-session", "sessionId");

        const sessions = db.createObjectStore("sessions", { keyPath: "id" });
        sessions.createIndex("by-startedAt", "startedAt");

        db.createObjectStore("settings", { keyPath: "key" });
      },
    });
    dbPromise.then(async (db) => {
      const existing = await db.get("settings", "app");
      if (!existing) {
        await db.put("settings", DEFAULT_SETTINGS);
      }
    });
  }
  return dbPromise;
}

export { DEFAULT_SETTINGS };
