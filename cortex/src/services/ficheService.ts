// Orchestration des fiches : charge la banque, la progression de lecture et
// l'historique de réponses, puis calcule la maîtrise de chaque fiche.
//
// Tenu dans un signal partagé : les trois écrans de fiches (index, domaine,
// détail) lisent le même état, et un « favori » ou une lecture s'y reflète
// immédiatement sans recharger quoi que ce soit.

import { signal } from "@preact/signals";
import { loadFiches, type Fiche } from "../domain/fiches";
import {
  computeFicheStats,
  prioritizeFiches,
  type FicheStats,
  type QuestionLink,
} from "../domain/fiches/mastery";
import { loadQuestionBank } from "../domain/questionBank";
import {
  getAllFicheProgress,
  markFicheRead,
  recordFicheQuiz,
  toggleFicheFavorite,
} from "../db/repositories/fichesRepo";
import { getAllReviews } from "../db/repositories/reviewsRepo";

export interface FicheBankState {
  status: "idle" | "loading" | "ready" | "error";
  fiches: Fiche[];
  stats: Map<string, FicheStats>;
  error: string | null;
}

export const ficheBank = signal<FicheBankState>({
  status: "idle",
  fiches: [],
  stats: new Map(),
  error: null,
});

let inFlight: Promise<void> | null = null;

/** Charge (ou recharge) la banque de fiches et recalcule toutes les maîtrises. */
export async function loadFicheBank(force = false): Promise<void> {
  if (!force && ficheBank.value.status === "ready") return;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    // Un rafraîchissement (favori, lecture, mini-question) ne doit PAS repasser
    // l'état à « loading » : les écrans afficheraient un écran de chargement, se
    // démonteraient, et l'utilisateur perdrait ce qu'il venait de dérouler.
    ficheBank.value = {
      ...ficheBank.value,
      status: ficheBank.value.fiches.length > 0 ? "ready" : "loading",
      error: null,
    };
    try {
      const [fiches, questions, reviews, progress] = await Promise.all([
        loadFiches(),
        loadQuestionBank(),
        getAllReviews(),
        getAllFicheProgress(),
      ]);

      const links = new Map<string, QuestionLink>(
        questions.map((q) => [q.id, { tags: q.tags, subtest: q.subtest }]),
      );
      const linkOf = (questionId: string) => links.get(questionId);

      const now = new Date();
      const stats = new Map<string, FicheStats>();
      for (const fiche of fiches) {
        stats.set(fiche.id, computeFicheStats(fiche, reviews, linkOf, progress.get(fiche.id), now));
      }

      ficheBank.value = { status: "ready", fiches, stats, error: null };
    } catch (err) {
      console.error("[ficheService] échec du chargement", err);
      ficheBank.value = {
        ...ficheBank.value,
        status: "error",
        error: err instanceof Error ? err.message : "Erreur inconnue",
      };
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}

export function statsFor(ficheId: string): FicheStats | undefined {
  return ficheBank.value.stats.get(ficheId);
}

/** Marque la fiche comme lue puis rafraîchit son état de maîtrise. */
export async function readFiche(ficheId: string): Promise<void> {
  await markFicheRead(ficheId);
  await loadFicheBank(true);
}

export async function toggleFavorite(ficheId: string): Promise<void> {
  await toggleFicheFavorite(ficheId);
  await loadFicheBank(true);
}

export async function answerFicheQuiz(ficheId: string, correct: boolean): Promise<void> {
  await recordFicheQuiz(ficheId, correct);
  await loadFicheBank(true);
}

/**
 * Les fiches à travailler en priorité, tous domaines confondus — sert à l'accueil
 * et au mode « J'ai N minutes ».
 */
export function priorityFiches(limit = 5): { fiche: Fiche; stats: FicheStats }[] {
  const { fiches, stats } = ficheBank.value;
  const byId = new Map(fiches.map((f) => [f.id, f]));
  return prioritizeFiches(Array.from(stats.values()))
    .slice(0, limit)
    .flatMap((s) => {
      const fiche = byId.get(s.ficheId);
      return fiche ? [{ fiche, stats: s }] : [];
    });
}
