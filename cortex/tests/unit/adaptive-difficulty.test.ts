import { describe, expect, it } from "vitest";
import { computeSubtestPerformance } from "../../src/domain/adaptive-difficulty";
import type { ReviewRecord } from "../../src/db/schema";

function makeReview(correct: boolean, i: number): ReviewRecord {
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
    difficulty: 3,
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
