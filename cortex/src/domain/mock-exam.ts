import type { Question } from "./question";
import { TAGE2_MOCK_EXAM_SECTIONS, SUBTESTS, type SubtestId } from "./modules";
import { shuffle } from "../utils/shuffle";

export interface MockExamSection {
  subtest: SubtestId;
  label: string;
  durationSeconds: number;
  questions: Question[];
}

export interface MockExamAnswer {
  questionId: string;
  selectedIndex: number | null; // null = non répondu (temps écoulé)
  responseTimeMs: number;
}

export interface MockExamSectionResult {
  subtest: SubtestId;
  label: string;
  correct: number;
  total: number;
  timeMs: number;
  answers: MockExamAnswer[];
}

/**
 * Tire les questions du test blanc TAGE 2 complet, section par section, dans
 * l'ordre officiel des 6 épreuves. La banque "Calcul" est tirée deux fois
 * (sections "Calcul" et "Calcul 2") sans repli : les questions utilisées dans
 * la première section sont exclues de la seconde.
 */
export function buildMockExamPlan(bank: Question[]): MockExamSection[] {
  const usedBySubtest = new Map<SubtestId, Set<string>>();

  return TAGE2_MOCK_EXAM_SECTIONS.map((section) => {
    const def = SUBTESTS[section.subtest];
    const used = usedBySubtest.get(section.subtest) ?? new Set<string>();
    const pool = shuffle(
      bank.filter((q) => q.subtest === section.subtest && !used.has(q.id)),
    );
    const picked = pool.slice(0, def.mockExam.questionCount);
    picked.forEach((q) => used.add(q.id));
    usedBySubtest.set(section.subtest, used);

    return {
      subtest: section.subtest,
      label: section.label,
      durationSeconds: def.mockExam.durationMinutes * 60,
      questions: picked,
    };
  });
}

export function totalExamDurationSeconds(sections: MockExamSection[]): number {
  return sections.reduce((sum, s) => sum + s.durationSeconds, 0);
}

/** Score global sur 600 (6 sections x 0-100), comme la grille officielle TAGE MAGE. */
export function computeMockExamTotalScore(results: MockExamSectionResult[]): number {
  return results.reduce((sum, r) => sum + (r.total > 0 ? Math.round((r.correct / r.total) * 100) : 0), 0);
}
