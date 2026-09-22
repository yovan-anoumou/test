import { isValidQuestion, type Question } from "./question";
import { SUBTESTS, type SubtestId } from "./modules";

let cache: Question[] | null = null;
let loadPromise: Promise<Question[]> | null = null;

/**
 * Charge toutes les banques de questions (public/questions/*.json) et les
 * fusionne avec les questions ajoutées par l'utilisateur en localStorage
 * (voir `addUserQuestions`). Résultat mis en cache en mémoire pour la session.
 */
export async function loadQuestionBank(): Promise<Question[]> {
  if (cache) return cache;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    const files = Array.from(new Set(Object.values(SUBTESTS).map((s) => s.questionFile)));
    const results = await Promise.all(
      files.map(async (file) => {
        try {
          const res = await fetch(`${import.meta.env.BASE_URL}questions/${file}.json`);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = (await res.json()) as unknown;
          if (!Array.isArray(data)) throw new Error("format invalide (attendu: tableau)");
          const valid: Question[] = [];
          for (const item of data) {
            if (isValidQuestion(item)) {
              valid.push(item);
            } else {
              console.warn(`[questionBank] question invalide ignorée dans ${file}.json`, item);
            }
          }
          return valid;
        } catch (err) {
          console.error(`[questionBank] échec du chargement de ${file}.json`, err);
          return [];
        }
      }),
    );
    const builtin = results.flat();
    const userAdded = loadUserQuestions();
    const byId = new Map<string, Question>();
    for (const q of [...builtin, ...userAdded]) byId.set(q.id, q);
    cache = Array.from(byId.values());
    return cache;
  })();

  return loadPromise;
}

export function getQuestionsBySubtest(all: Question[], subtest: SubtestId): Question[] {
  return all.filter((q) => q.subtest === subtest);
}

export function getQuestionById(all: Question[], id: string): Question | undefined {
  return all.find((q) => q.id === id);
}

/**
 * Question « du même type » qu'une autre : même sous-test, tags en commun en
 * priorité, difficulté la plus proche. Sert en mode apprentissage à réessayer
 * immédiatement sur une variante après avoir compris son erreur.
 */
export function findSimilarQuestion(
  all: Question[],
  reference: Question,
  excludeIds: Iterable<string> = [],
): Question | undefined {
  const excluded = new Set([reference.id, ...excludeIds]);
  const referenceTags = new Set(reference.tags);

  const candidates = all
    .filter((q) => q.subtest === reference.subtest && !excluded.has(q.id))
    .map((q) => ({
      question: q,
      sharedTags: q.tags.filter((t) => referenceTags.has(t)).length,
      difficultyGap: Math.abs(q.difficulty - reference.difficulty),
    }))
    .sort(
      (a, b) => b.sharedTags - a.sharedTags || a.difficultyGap - b.difficultyGap,
    );

  return candidates[0]?.question;
}

const USER_QUESTIONS_KEY = "cortex:user-questions";

/** Questions ajoutées manuellement par l'utilisateur (stockées à part, ne touche jamais aux fichiers livrés). */
export function loadUserQuestions(): Question[] {
  try {
    const raw = localStorage.getItem(USER_QUESTIONS_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw) as unknown;
    if (!Array.isArray(data)) return [];
    return data.filter(isValidQuestion);
  } catch {
    return [];
  }
}

export function addUserQuestions(newQuestions: unknown[]): void {
  const existing = loadUserQuestions();
  const byId = new Map(existing.map((q) => [q.id, q]));
  for (const [i, q] of newQuestions.entries()) {
    if (!isValidQuestion(q)) {
      const id = typeof q === "object" && q !== null && "id" in q ? String((q as { id: unknown }).id) : `#${i}`;
      throw new Error(`Question invalide: ${id}`);
    }
    byId.set(q.id, q);
  }
  localStorage.setItem(USER_QUESTIONS_KEY, JSON.stringify(Array.from(byId.values())));
  cache = null; // force un rechargement au prochain accès
  loadPromise = null;
}
