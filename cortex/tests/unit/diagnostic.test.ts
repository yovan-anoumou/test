import { describe, expect, it } from "vitest";
import {
  finalizeDiagnostic,
  initDiagnostic,
  nextDiagnosticQuestion,
  recordDiagnosticAnswer,
  totalQuestions,
  type DiagnosticState,
} from "../../src/domain/diagnostic";
import { SKILL_AREAS, SKILL_AREA_IDS } from "../../src/domain/skills";
import type { Question } from "../../src/domain/question";
import type { SubtestId } from "../../src/domain/modules";

/** Banque synthétique : chaque sous-test a une question de chaque difficulté. */
function buildBank(): Question[] {
  const questions: Question[] = [];
  for (const area of SKILL_AREA_IDS) {
    for (const subtest of SKILL_AREAS[area].subtests) {
      for (const difficulty of [1, 2, 3, 4, 5] as const) {
        for (let copy = 0; copy < 3; copy++) {
          questions.push(makeQuestion(`${subtest}-${difficulty}-${copy}`, subtest, difficulty));
        }
      }
    }
  }
  return questions;
}

function makeQuestion(id: string, subtest: SubtestId, difficulty: 1 | 2 | 3 | 4 | 5): Question {
  return {
    id,
    module: "tage2",
    subtest,
    difficulty,
    type: "mcq",
    passage: null,
    statement: `Question ${id}`,
    choices: ["A", "B", "C", "D"],
    correctIndex: 0,
    explanation: {
      why_correct: "Parce que.",
      why_others_wrong: ["", "Faux 1", "Faux 2", "Faux 3"],
      method: "Méthode.",
    },
    targetTimeSeconds: 60,
    tags: [`tag-${subtest}`],
  };
}

/** Joue un test complet en répondant selon `answerCorrectly`. */
function runDiagnostic(
  bank: Question[],
  answerCorrectly: (question: Question) => boolean,
): DiagnosticState {
  let state = initDiagnostic("tage2");
  for (let i = 0; i < totalQuestions(state) + 5; i++) {
    const next = nextDiagnosticQuestion(state, bank);
    if (!next) break;
    const correct = answerCorrectly(next.question);
    state = recordDiagnosticAnswer(
      state,
      next.question,
      next.area,
      correct ? next.question.correctIndex : (next.question.correctIndex + 1) % 4,
      45_000,
    );
  }
  return state;
}

describe("diagnostic adaptatif", () => {
  const bank = buildBank();

  it("monte en difficulté après une bonne réponse, redescend après une erreur", () => {
    const state = initDiagnostic("tage2");
    const first = nextDiagnosticQuestion(state, bank)!;
    expect(first.question.difficulty).toBe(3); // on démarre au milieu

    const afterSuccess = recordDiagnosticAnswer(
      state,
      first.question,
      first.area,
      first.question.correctIndex,
      30_000,
    );
    expect(afterSuccess.targetByArea[first.area]).toBe(4);

    const afterFailure = recordDiagnosticAnswer(
      state,
      first.question,
      first.area,
      (first.question.correctIndex + 1) % 4,
      30_000,
    );
    expect(afterFailure.targetByArea[first.area]).toBe(2);
  });

  it("alterne les domaines au lieu d'enchaîner la même matière", () => {
    const state = initDiagnostic("tage2");
    const first = nextDiagnosticQuestion(state, bank)!;
    const second = nextDiagnosticQuestion(
      recordDiagnosticAnswer(state, first.question, first.area, 0, 30_000),
      bank,
    )!;
    expect(second.area).not.toBe(first.area);
  });

  it("couvre tous les domaines et s'arrête au quota", () => {
    const state = runDiagnostic(bank, () => true);
    expect(state.answers.length).toBe(totalQuestions(state));
    const areasCovered = new Set(state.answers.map((a) => a.area));
    expect(areasCovered.size).toBe(SKILL_AREA_IDS.length);
  });

  it("ne repose jamais deux fois la même question", () => {
    const state = runDiagnostic(bank, () => true);
    const ids = state.answers.map((a) => a.questionId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("produit un score élevé quand tout est juste, bas quand tout est faux", () => {
    const allCorrect = finalizeDiagnostic(runDiagnostic(bank, () => true), bank);
    const allWrong = finalizeDiagnostic(runDiagnostic(bank, () => false), bank);

    expect(allCorrect.overallScore).toBeGreaterThan(80);
    expect(allWrong.overallScore).toBe(0);
    expect(allCorrect.areas.length).toBe(SKILL_AREA_IDS.length);
    expect(allCorrect.finishedAt).not.toBeNull();
  });

  it("estime un niveau intermédiaire quand une matière sur deux est ratée", () => {
    const mixed = finalizeDiagnostic(
      runDiagnostic(bank, (question) => question.subtest !== "grammaire"),
      bank,
    );
    const anglais = mixed.areas.find((a) => a.area === "anglais")!;
    const calcul = mixed.areas.find((a) => a.area === "calcul")!;

    expect(anglais.masteryScore).toBeLessThan(calcul.masteryScore);
    expect(anglais.weakTags.some((t) => t.tag === "tag-grammaire")).toBe(true);
  });
});
