import type { Fiche, FicheDomainId } from "./types";
import { CALCUL_FICHES } from "./calcul";
import { LOGIQUE_FICHES } from "./logique";
import { ANGLAIS_FICHES } from "./anglais";
import { VOCABULAIRE_FICHES } from "./vocabulaire";
import { CULTURE_GENERALE_FICHES } from "./culture-generale";

export * from "./types";

export const ALL_FICHES: Fiche[] = [
  ...CALCUL_FICHES,
  ...LOGIQUE_FICHES,
  ...ANGLAIS_FICHES,
  ...VOCABULAIRE_FICHES,
  ...CULTURE_GENERALE_FICHES,
];

export function getFichesByDomain(domain: FicheDomainId): Fiche[] {
  return ALL_FICHES.filter((f) => f.domain === domain);
}

export function getFicheById(id: string): Fiche | undefined {
  return ALL_FICHES.find((f) => f.id === id);
}
