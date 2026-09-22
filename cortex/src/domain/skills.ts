// Taxonomie des compétences : regroupe les 11 sous-tests existants en 6 grands
// domaines, utilisés par le diagnostic, le plan d'entraînement et le tableau de
// progression. Les sous-tests restent la granularité de la banque de questions ;
// les tags des questions donnent le niveau le plus fin (ex. "pourcentages").

import { SUBTESTS, type SubtestId } from "./modules";

export type SkillAreaId =
  | "calcul"
  | "logique"
  | "anglais"
  | "vocabulaire"
  | "comprehension"
  | "culture-generale";

export interface SkillArea {
  id: SkillAreaId;
  label: string;
  /** Description courte de ce que le domaine couvre. */
  scope: string;
  subtests: SubtestId[];
  emoji: string;
  /** Token de couleur (sans le préfixe --color-). */
  color: "accent" | "purple" | "teal" | "pink" | "indigo" | "warning";
}

export const SKILL_AREAS: Record<SkillAreaId, SkillArea> = {
  calcul: {
    id: "calcul",
    label: "Calcul",
    scope: "Pourcentages, proportions, équations, vitesses, calcul mental, ordres de grandeur.",
    subtests: ["calcul", "calcul-mental"],
    emoji: "🧮",
    color: "accent",
  },
  logique: {
    id: "logique",
    label: "Logique & raisonnement",
    scope: "Séries numériques et de lettres, logique spatiale, syllogismes, argumentation.",
    subtests: ["logique-verbale-numerique", "logique-spatiale", "raisonnement"],
    emoji: "🧩",
    color: "purple",
  },
  anglais: {
    id: "anglais",
    label: "Anglais",
    scope: "Grammaire, vocabulaire business et compréhension écrite, format TOEIC.",
    subtests: ["grammaire", "vocabulaire", "comprehension"],
    emoji: "💬",
    color: "teal",
  },
  vocabulaire: {
    id: "vocabulaire",
    label: "Vocabulaire & expression",
    scope: "Synonymes, paronymes, locutions, cohérence et précision du français.",
    subtests: ["lexiphrase"],
    emoji: "✍️",
    color: "pink",
  },
  comprehension: {
    id: "comprehension",
    label: "Compréhension écrite",
    scope: "Idée principale, information implicite, structure argumentative d'un texte.",
    subtests: ["paratexte"],
    emoji: "📖",
    color: "warning",
  },
  "culture-generale": {
    id: "culture-generale",
    label: "Culture générale & économie",
    scope: "Économie, institutions, entreprises, marchés, enjeux contemporains.",
    subtests: ["culture-generale"],
    emoji: "🌍",
    color: "indigo",
  },
};

export const SKILL_AREA_IDS = Object.keys(SKILL_AREAS) as SkillAreaId[];

const SUBTEST_TO_AREA = (() => {
  const map = new Map<SubtestId, SkillAreaId>();
  for (const area of Object.values(SKILL_AREAS)) {
    for (const subtest of area.subtests) map.set(subtest, area.id);
  }
  return map;
})();

export function areaOfSubtest(subtest: SubtestId): SkillAreaId {
  const area = SUBTEST_TO_AREA.get(subtest);
  if (!area) throw new Error(`Sous-test sans domaine associé : ${subtest}`);
  return area;
}

export function subtestLabel(subtest: SubtestId): string {
  return SUBTESTS[subtest].label;
}

/** Niveaux de difficulté des questions (la banque utilise déjà 1 à 5). */
export const DIFFICULTY_LABELS: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: "Facile",
  2: "Intermédiaire",
  3: "Difficile",
  4: "Très difficile",
  5: "Niveau concours",
};

export function difficultyLabel(difficulty: number): string {
  const clamped = Math.min(5, Math.max(1, Math.round(difficulty))) as 1 | 2 | 3 | 4 | 5;
  return DIFFICULTY_LABELS[clamped];
}

/**
 * Importance relative de chaque domaine selon l'objectif visé. Sert à pondérer
 * le temps d'entraînement : un domaine faible mais peu important pèse moins
 * qu'un domaine faible et central pour l'épreuve.
 */
export const AREA_IMPORTANCE: Record<string, Record<SkillAreaId, number>> = {
  tage2: {
    calcul: 1.25,
    logique: 1.25,
    vocabulaire: 1.1,
    comprehension: 1.1,
    anglais: 0.85,
    "culture-generale": 0.6,
  },
  toeic: {
    anglais: 2,
    comprehension: 0.8,
    vocabulaire: 0.6,
    logique: 0.5,
    calcul: 0.4,
    "culture-generale": 0.4,
  },
  general: {
    calcul: 1,
    logique: 1,
    anglais: 1,
    vocabulaire: 1,
    comprehension: 1,
    "culture-generale": 1,
  },
};

export type ObjectiveId = "tage2" | "toeic" | "general";

export const OBJECTIVES: { id: ObjectiveId; label: string; detail: string }[] = [
  { id: "tage2", label: "TAGE 2 / TAGE MAGE", detail: "Admission en école de commerce (IAE, SKEMA…)." },
  { id: "toeic", label: "TOEIC", detail: "Priorité à l'anglais business." },
  { id: "general", label: "Progresser partout", detail: "Répartition équilibrée sur tous les domaines." },
];
