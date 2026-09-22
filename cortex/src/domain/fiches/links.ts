// Relie une question à la fiche mémo la plus pertinente : en mode
// apprentissage, on doit pouvoir passer de l'erreur à la règle correspondante.

import type { SubtestId } from "../modules";
import { ALL_FICHES } from "./index";
import type { Fiche, FicheDomainId } from "./types";

const SUBTEST_TO_FICHE_DOMAIN: Record<SubtestId, FicheDomainId> = {
  calcul: "calcul",
  "calcul-mental": "calcul",
  "logique-verbale-numerique": "logique",
  "logique-spatiale": "logique",
  raisonnement: "logique",
  grammaire: "anglais",
  vocabulaire: "anglais",
  comprehension: "anglais",
  lexiphrase: "vocabulaire",
  paratexte: "vocabulaire",
  "culture-generale": "culture-generale",
};

export function ficheDomainForSubtest(subtest: SubtestId): FicheDomainId {
  return SUBTEST_TO_FICHE_DOMAIN[subtest];
}

function normalize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 3);
}

/**
 * Fiche la plus proche d'une question : même domaine, puis meilleur
 * recouvrement de mots entre les tags de la question et le titre/résumé de la
 * fiche. À défaut, la première fiche du domaine (toujours pertinente).
 */
export function findFicheForQuestion(subtest: SubtestId, tags: string[]): Fiche | undefined {
  const domain = ficheDomainForSubtest(subtest);
  const candidates = ALL_FICHES.filter((f) => f.domain === domain);
  if (candidates.length === 0) return undefined;

  const tagWords = new Set(tags.flatMap(normalize));
  if (tagWords.size === 0) return candidates[0];

  let best = candidates[0];
  let bestScore = 0;
  for (const fiche of candidates) {
    const ficheWords = new Set([
      ...normalize(fiche.id),
      ...normalize(fiche.title),
      ...normalize(fiche.tagline),
    ]);
    let score = 0;
    for (const word of tagWords) if (ficheWords.has(word)) score++;
    if (score > bestScore) {
      best = fiche;
      bestScore = score;
    }
  }
  return best;
}
