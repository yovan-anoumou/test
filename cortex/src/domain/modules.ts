// Registre statique des modules et sous-tests d'entraînement.
// C'est la source de vérité pour l'UI, le session-builder et le dashboard.

export type ModuleId =
  | "tage2"
  | "anglais"
  | "culture-generale"
  | "raisonnement"
  | "calcul-mental";

export type SubtestId =
  | "lexiphrase"
  | "calcul"
  | "logique-verbale-numerique"
  | "paratexte"
  | "logique-spatiale"
  | "vocabulaire"
  | "grammaire"
  | "comprehension"
  | "culture-generale"
  | "raisonnement"
  | "calcul-mental";

export interface SubtestDef {
  id: SubtestId;
  module: ModuleId;
  label: string;
  /** Nombre de questions et durée en conditions d'examen réel (test blanc). */
  mockExam: { questionCount: number; durationMinutes: number };
  /** Fichier JSON source dans public/questions/ (sans extension). */
  questionFile: string;
}

export interface ModuleDef {
  id: ModuleId;
  label: string;
  description: string;
  subtests: SubtestId[];
}

export const MODULES: Record<ModuleId, ModuleDef> = {
  tage2: {
    id: "tage2",
    label: "TAGE 2 / TAGE MAGE",
    description: "Les 6 sous-tests du test d'aptitude au management.",
    subtests: [
      "lexiphrase",
      "calcul",
      "logique-verbale-numerique",
      "paratexte",
      "logique-spatiale",
    ],
  },
  anglais: {
    id: "anglais",
    label: "Anglais",
    description: "Vocabulaire, grammaire et compréhension, format TOEIC.",
    subtests: ["vocabulaire", "grammaire", "comprehension"],
  },
  "culture-generale": {
    id: "culture-generale",
    label: "Culture générale",
    description: "Économie, géopolitique, histoire, entreprises, institutions.",
    subtests: ["culture-generale"],
  },
  raisonnement: {
    id: "raisonnement",
    label: "Raisonnement & résolution de problèmes",
    description: "Syllogismes, biais cognitifs, cas de business.",
    subtests: ["raisonnement"],
  },
  "calcul-mental": {
    id: "calcul-mental",
    label: "Calcul mental & ordres de grandeur",
    description: "Rapidité de calcul utile en entretien et en test.",
    subtests: ["calcul-mental"],
  },
};

// Le sous-test "calcul" est utilisé pour les 2 sections chronométrées
// "Calcul" et "Calcul 2" du test blanc TAGE 2 (tirage sans repli dans le même pool).
export const SUBTESTS: Record<SubtestId, SubtestDef> = {
  lexiphrase: {
    id: "lexiphrase",
    module: "tage2",
    label: "Lexiphrase",
    mockExam: { questionCount: 15, durationMinutes: 15 },
    questionFile: "tage-lexiphrase",
  },
  calcul: {
    id: "calcul",
    module: "tage2",
    label: "Calcul",
    mockExam: { questionCount: 10, durationMinutes: 30 },
    questionFile: "tage-calcul",
  },
  "logique-verbale-numerique": {
    id: "logique-verbale-numerique",
    module: "tage2",
    label: "Logique verbale et numérique",
    mockExam: { questionCount: 10, durationMinutes: 15 },
    questionFile: "tage-logique-verbale-numerique",
  },
  paratexte: {
    id: "paratexte",
    module: "tage2",
    label: "Paratexte",
    mockExam: { questionCount: 15, durationMinutes: 15 },
    questionFile: "tage-paratexte",
  },
  "logique-spatiale": {
    id: "logique-spatiale",
    module: "tage2",
    label: "Logique spatiale",
    mockExam: { questionCount: 10, durationMinutes: 10 },
    questionFile: "tage-logique-spatiale",
  },
  vocabulaire: {
    id: "vocabulaire",
    module: "anglais",
    label: "Vocabulaire",
    mockExam: { questionCount: 10, durationMinutes: 10 },
    questionFile: "anglais-vocabulaire",
  },
  grammaire: {
    id: "grammaire",
    module: "anglais",
    label: "Grammaire",
    mockExam: { questionCount: 10, durationMinutes: 10 },
    questionFile: "anglais-grammaire",
  },
  comprehension: {
    id: "comprehension",
    module: "anglais",
    label: "Compréhension écrite",
    mockExam: { questionCount: 10, durationMinutes: 15 },
    questionFile: "anglais-comprehension",
  },
  "culture-generale": {
    id: "culture-generale",
    module: "culture-generale",
    label: "Culture générale",
    mockExam: { questionCount: 15, durationMinutes: 15 },
    questionFile: "culture-generale",
  },
  raisonnement: {
    id: "raisonnement",
    module: "raisonnement",
    label: "Raisonnement",
    mockExam: { questionCount: 10, durationMinutes: 15 },
    questionFile: "raisonnement",
  },
  "calcul-mental": {
    id: "calcul-mental",
    module: "calcul-mental",
    label: "Calcul mental",
    mockExam: { questionCount: 15, durationMinutes: 10 },
    questionFile: "calcul-mental",
  },
};

/** Ordre officiel des 6 sections du test blanc TAGE 2 (Calcul apparaît 2 fois, tiré du même pool). */
export const TAGE2_MOCK_EXAM_SECTIONS: { subtest: SubtestId; label: string }[] = [
  { subtest: "lexiphrase", label: "Lexiphrase" },
  { subtest: "calcul", label: "Calcul" },
  { subtest: "logique-verbale-numerique", label: "Logique verbale et numérique" },
  { subtest: "paratexte", label: "Paratexte" },
  { subtest: "calcul", label: "Calcul 2" },
  { subtest: "logique-spatiale", label: "Logique spatiale" },
];

export function allSubtestIds(): SubtestId[] {
  return Object.keys(SUBTESTS) as SubtestId[];
}
