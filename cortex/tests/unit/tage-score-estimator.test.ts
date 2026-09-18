import { describe, expect, it } from "vitest";
import { estimateProjectedScore } from "../../src/domain/tage-score-estimator";
import { TAGE2_MOCK_EXAM_SECTIONS } from "../../src/domain/modules";
import type { ReviewRecord } from "../../src/db/schema";

let counter = 0;
function makeReview(subtest: ReviewRecord["subtest"], correct: boolean, targetTimeSeconds = 60): ReviewRecord {
  counter++;
  return {
    id: `r${counter}`,
    questionId: `q${counter}`,
    module: "tage2",
    subtest,
    timestamp: new Date().toISOString(),
    rating: correct ? 3 : 1,
    correct,
    responseTimeMs: targetTimeSeconds * 1000,
    targetTimeSeconds,
    difficulty: 3,
    sessionId: null,
    sessionKind: "daily",
  };
}

describe("estimateProjectedScore", () => {
  it("retourne un score de 0 et une confiance basse sans données", () => {
    const result = estimateProjectedScore([]);
    expect(result.total).toBe(0);
    expect(result.lowConfidence).toBe(true);
  });

  it("retourne un score proche de 600 avec des réponses toutes correctes et dans les temps", () => {
    const reviews: ReviewRecord[] = [];
    for (const section of TAGE2_MOCK_EXAM_SECTIONS) {
      for (let i = 0; i < 10; i++) reviews.push(makeReview(section.subtest, true));
    }
    const result = estimateProjectedScore(reviews);
    expect(result.total).toBeGreaterThanOrEqual(590);
    expect(result.lowConfidence).toBe(false);
  });

  it("retourne un score bas avec des réponses majoritairement fausses", () => {
    const reviews: ReviewRecord[] = [];
    for (const section of TAGE2_MOCK_EXAM_SECTIONS) {
      for (let i = 0; i < 10; i++) reviews.push(makeReview(section.subtest, false));
    }
    const result = estimateProjectedScore(reviews);
    expect(result.total).toBeLessThanOrEqual(60);
  });
});
