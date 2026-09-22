import { describe, expect, it } from "vitest";
import {
  areaTrend,
  assessArea,
  computeErrorsCorrected,
  computeRetention,
  identifyPriorityWeaknesses,
  type ScorableAnswer,
} from "../../src/domain/skill-analysis";
import type { Question } from "../../src/domain/question";
import type { ReviewRecord } from "../../src/db/schema";

function makeQuestion(id: string, tags: string[], choices = 4): Question {
  return {
    id,
    module: "tage2",
    subtest: "calcul",
    difficulty: 3,
    type: "mcq",
    passage: null,
    statement: `Question ${id}`,
    choices: Array.from({ length: choices }, (_, i) => `Choix ${i}`),
    correctIndex: 0,
    explanation: {
      why_correct: "Parce que.",
      why_others_wrong: ["", "Erreur de proportion.", "Oubli du coefficient.", "Confusion d'unité."],
      method: "Méthode.",
    },
    targetTimeSeconds: 60,
    tags,
  };
}

function answer(overrides: Partial<ScorableAnswer> = {}): ScorableAnswer {
  return {
    questionId: "q1",
    area: "calcul",
    difficulty: 3,
    correct: true,
    selectedIndex: 0,
    responseTimeMs: 60_000,
    targetTimeSeconds: 60,
    countsForSpeed: true,
    ...overrides,
  };
}

describe("assessArea", () => {
  const bank = new Map<string, Question>([["q1", makeQuestion("q1", ["pourcentages"])]]);

  it("sépare précision et vitesse : même réussite, mais plus lent = maîtrise plus basse", () => {
    const fast = Array.from({ length: 10 }, (_, i) =>
      answer({ correct: i < 8, responseTimeMs: 30_000 }),
    );
    const slow = Array.from({ length: 10 }, (_, i) =>
      answer({ correct: i < 8, responseTimeMs: 110_000 }),
    );

    const fastAssessment = assessArea("calcul", fast, bank);
    const slowAssessment = assessArea("calcul", slow, bank);

    expect(fastAssessment.accuracy).toBeCloseTo(slowAssessment.accuracy);
    expect(fastAssessment.masteryScore).toBeGreaterThan(slowAssessment.masteryScore);
  });

  it("ignore le temps passé en mode apprentissage dans la vitesse", () => {
    const answers = Array.from({ length: 6 }, () =>
      answer({ responseTimeMs: 600_000, countsForSpeed: false }),
    );
    const assessment = assessArea("calcul", answers, bank);

    expect(assessment.paceRatio).toBe(1);
    expect(assessment.masteryScore).toBeGreaterThan(90);
  });

  it("remonte les tags fautifs et le type d'erreur du distracteur choisi", () => {
    const answers = [
      answer({ correct: false, selectedIndex: 1 }),
      answer({ correct: false, selectedIndex: 1 }),
      answer({ correct: true }),
    ];
    const assessment = assessArea("calcul", answers, bank);

    expect(assessment.weakTags[0]).toMatchObject({ tag: "pourcentages", errors: 2, attempts: 3 });
    expect(assessment.errorTypes).toContain("Erreur de proportion.");
  });

  it("ne crédite pas la vitesse quand toutes les réponses sont fausses", () => {
    const answers = Array.from({ length: 6 }, () =>
      answer({ correct: false, selectedIndex: 1, responseTimeMs: 10_000 }),
    );
    expect(assessArea("calcul", answers, bank).masteryScore).toBe(0);
  });

  it("retourne une évaluation neutre quand le domaine n'a aucune réponse", () => {
    const assessment = assessArea("anglais", [], bank);
    expect(assessment.questions).toBe(0);
    expect(assessment.masteryScore).toBe(0);
    expect(assessment.confidence).toBe("faible");
  });
});

describe("identifyPriorityWeaknesses", () => {
  const bank = new Map<string, Question>([["q1", makeQuestion("q1", ["pourcentages"])]]);

  it("distingue un problème de vitesse d'un problème de méthode", () => {
    const accurateButSlow = assessArea(
      "calcul",
      Array.from({ length: 10 }, () => answer({ correct: true, responseTimeMs: 120_000 })),
      bank,
    );
    const inaccurate = assessArea(
      "anglais",
      Array.from({ length: 10 }, (_, i) =>
        answer({ area: "anglais", correct: i < 4, responseTimeMs: 50_000 }),
      ),
      bank,
    );

    const priorities = identifyPriorityWeaknesses([accurateButSlow, inaccurate]);
    const calcul = priorities.find((p) => p.area === "calcul");
    const anglais = priorities.find((p) => p.area === "anglais");

    expect(calcul?.driver).toBe("vitesse");
    expect(anglais?.driver).toBe("precision");
  });
});

function makeReview(
  questionId: string,
  correct: boolean,
  timestamp: string,
  subtest: ReviewRecord["subtest"] = "calcul",
): ReviewRecord {
  return {
    id: `${questionId}-${timestamp}`,
    questionId,
    module: "tage2",
    subtest,
    timestamp,
    rating: correct ? 3 : 1,
    correct,
    responseTimeMs: 40_000,
    targetTimeSeconds: 60,
    difficulty: 3,
    sessionId: null,
    sessionKind: "daily",
    mode: "training",
    selectedIndex: correct ? 0 : 1,
  };
}

describe("computeRetention", () => {
  it("ne compte que les questions déjà rencontrées auparavant", () => {
    const reviews = [
      makeReview("q1", false, "2026-01-01T10:00:00.000Z"),
      makeReview("q1", true, "2026-01-05T10:00:00.000Z"), // reprise réussie
      makeReview("q2", true, "2026-01-05T11:00:00.000Z"), // première vue, ignorée
      makeReview("q1", true, "2026-01-09T10:00:00.000Z"), // reprise réussie
    ];
    const retention = computeRetention(reviews);
    expect(retention.sample).toBe(2);
    expect(retention.rate).toBe(1);
  });
});

describe("computeErrorsCorrected", () => {
  it("compte les questions ratées puis réussies au dernier passage", () => {
    const reviews = [
      makeReview("q1", false, "2026-01-01T10:00:00.000Z"),
      makeReview("q1", true, "2026-01-05T10:00:00.000Z"),
      makeReview("q2", false, "2026-01-02T10:00:00.000Z"),
      makeReview("q2", false, "2026-01-06T10:00:00.000Z"),
    ];
    const result = computeErrorsCorrected(reviews);
    expect(result.corrected).toBe(1);
    expect(result.stillWrong).toBe(1);
  });
});

describe("areaTrend", () => {
  it("découpe en périodes qui ne se recouvrent pas", () => {
    const now = new Date("2026-03-01T12:00:00.000Z");
    const daysAgo = (n: number) =>
      new Date(now.getTime() - n * 86_400_000).toISOString();

    const reviews = [
      // Période ancienne (90-30 j) : tout faux.
      ...Array.from({ length: 5 }, (_, i) => makeReview(`old-${i}`, false, daysAgo(60))),
      // Période récente (7 derniers jours) : tout juste.
      ...Array.from({ length: 5 }, (_, i) => makeReview(`new-${i}`, true, daysAgo(2))),
    ];
    const bank = new Map<string, Question>(
      reviews.map((r) => [r.questionId, makeQuestion(r.questionId, ["pourcentages"])]),
    );

    const trend = areaTrend(reviews, bank, "calcul", 4, now);
    expect(trend[0].masteryScore).toBe(0); // ancien : tout faux, la vitesse ne rattrape rien
    expect(trend[1].masteryScore).toBeNull(); // période intermédiaire vide
    expect(trend[2].masteryScore).toBeGreaterThan(70); // récent : tout juste
  });
});
