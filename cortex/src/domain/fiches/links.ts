// Relie une question à la fiche mémo la plus pertinente, et inversement : en
// mode apprentissage on doit pouvoir passer de l'erreur à la règle, et depuis
// une fiche lancer un entraînement sur exactement ses notions.
//
// Le lien principal passe par les *tags* : les tags des fiches sont écrits pour
// correspondre à ceux de la banque de questions (voir public/fiches/SCHEMA.md).

import type { SubtestId } from "../modules";
import { SKILL_AREAS, type SkillAreaId } from "../skills";
import type { Fiche, FicheDomainId } from "./types";

const SUBTEST_TO_FICHE_DOMAIN: Record<SubtestId, FicheDomainId> = {
  calcul: "calcul",
  "calcul-mental": "vitesse",
  "logique-verbale-numerique": "logique",
  "logique-spatiale": "logique",
  raisonnement: "logique",
  grammaire: "anglais",
  vocabulaire: "anglais",
  comprehension: "anglais",
  lexiphrase: "vocabulaire",
  paratexte: "comprehension",
  "culture-generale": "culture-generale",
};

export function ficheDomainForSubtest(subtest: SubtestId): FicheDomainId {
  return SUBTEST_TO_FICHE_DOMAIN[subtest];
}

/** Domaine de compétences correspondant à un domaine de fiches (pour un entraînement ciblé). */
export function areaForFicheDomain(domain: FicheDomainId): SkillAreaId {
  switch (domain) {
    case "vitesse":
      return "calcul";
    case "methode":
      return "culture-generale";
    default:
      return domain;
  }
}

/** Sous-tests à interroger pour s'entraîner sur une fiche donnée. */
export function subtestsForFiche(fiche: Fiche): SubtestId[] {
  if (fiche.subtests && fiche.subtests.length > 0) return fiche.subtests;
  return SKILL_AREAS[areaForFicheDomain(fiche.domain)].subtests;
}

/**
 * Fiches candidates pour une question, les plus pertinentes d'abord.
 * Score : tags en commun (fort), puis même sous-test déclaré, puis même domaine.
 */
export function fichesForQuestion(all: Fiche[], subtest: SubtestId, tags: string[]): Fiche[] {
  const domain = ficheDomainForSubtest(subtest);
  const questionTags = new Set(tags);

  const scored = all
    .map((fiche) => {
      const sharedTags = fiche.tags.filter((t) => questionTags.has(t)).length;
      const sameSubtest = fiche.subtests?.includes(subtest) ? 1 : 0;
      const sameDomain = fiche.domain === domain ? 1 : 0;
      return { fiche, score: sharedTags * 10 + sameSubtest * 3 + sameDomain };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.map((s) => s.fiche);
}

/** Fiche la plus proche d'une question — celle à proposer après une erreur. */
export function findFicheForQuestion(
  all: Fiche[],
  subtest: SubtestId,
  tags: string[],
): Fiche | undefined {
  return fichesForQuestion(all, subtest, tags)[0];
}
