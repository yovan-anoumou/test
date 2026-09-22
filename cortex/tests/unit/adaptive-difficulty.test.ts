import { describe, expect, it } from "vitest";
import {
  computeSubtestPerformance,
  consecutiveCorrect,
  difficultyTargetForSubtest,
} from "../../src/domain/adaptive-difficulty";
import type { ReviewRecord } from "../../src/db/schema";

function makeReview(correct: boolean, i: number, difficulty = 3): ReviewRecord {
  return {
    id: `r${i}`,
    questionId: `q${i}`,
    module: "tage2",
    subtest: "calcul",
    timestamp: new Date(Date.now() - i * 1000).toISOString(),
    rating: correct ? 3 : 1,
    correct,
    responseTimeMs: 1000,
    targetTimeSeconds: 60,
    difficulty,
    sessionId: null,
    sessionKind: "daily",
  };
}

describe("computeSubtestPerformance", () => {
  it("suggère 'increase' au-delà de 85% de réussite avec un échantillon suffisant", () => {
    const reviews = Array.from({ length: 20 }, (_, i) => makeReview(i < 18, i)); // 90%
    const perf = computeSubtestPerformance(reviews, "calcul");
    expect(perf.adjustment).toBe("increase");
  });

  it("suggère 'decrease' en dessous de 60% de réussite", () => {
    const reviews = Array.from({ length: 20 }, (_, i) => makeReview(i < 8, i)); // 40%
    const perf = computeSubtestPerformance(reviews, "calcul");
    expect(perf.adjustment).toBe("decrease");
  });

  it("reste 'stable' quand l'échantillon est trop petit", () => {
    const reviews = Array.from({ length: 3 }, (_, i) => makeReview(true, i));
    const perf = computeSubtestPerformance(reviews, "calcul");
    expect(perf.adjustment).toBe("stable");
  });
});

describe("difficultyTargetForSubtest", () => {
  it("démarre bas quand il n'y a aucun historique", () => {
    expect(difficultyTargetForSubtest([], "calcul")).toBe(2);
  });

  it("monte d'un cran quand la réussite dépasse 85 %", () => {
    // 20 réponses à difficulté 3, dont 18 justes.
    const reviews = Array.from({ length: 20 }, (_, i) => makeReview(i < 18, i, 3));
    expect(difficultyTargetForSubtest(reviews, "calcul")).toBe(4);
  });

  it("redescend d'un cran sous 60 % de réussite", () => {
    const reviews = Array.from({ length: 20 }, (_, i) => makeReview(i < 8, i, 3));
    expect(difficultyTargetForSubtest(reviews, "calcul")).toBe(2);
  });

  it("monte après 5 bonnes réponses consécutives même à réussite moyenne", () => {
    // Les 5 plus récentes sont justes (i = 0..4), la 6e est fausse (elle coupe
    // la série), le reste alterne pour rester autour de 50 % de réussite.
    const recent = Array.from({ length: 5 }, (_, i) => makeReview(true, i, 3));
    const older = Array.from({ length: 10 }, (_, i) => makeReview(i % 2 === 1, i + 5, 3));
    const reviews = [...recent, ...older];

    expect(consecutiveCorrect(reviews, "calcul")).toBe(5);
    expect(difficultyTargetForSubtest(reviews, "calcul")).toBe(4);
  });

  it("reste dans les bornes 1-5", () => {
    const tooEasy = Array.from({ length: 20 }, (_, i) => makeReview(true, i, 5));
    const tooHard = Array.from({ length: 20 }, (_, i) => makeReview(false, i, 1));
    expect(difficultyTargetForSubtest(tooEasy, "calcul")).toBe(5);
    expect(difficultyTargetForSubtest(tooHard, "calcul")).toBe(1);
  });
});
