import { describe, expect, it } from "vitest";
import { getStrugglingQuestionIds } from "../../src/domain/scoring";
import type { ReviewRecord } from "../../src/db/schema";

function makeReview(
  questionId: string,
  rating: 1 | 2 | 3 | 4,
  timestamp: string,
): ReviewRecord {
  return {
    id: `${questionId}-${timestamp}`,
    questionId,
    module: "tage2",
    subtest: "calcul",
    timestamp,
    rating,
    correct: rating >= 3,
    responseTimeMs: 1000,
    targetTimeSeconds: 60,
    difficulty: 3,
    sessionId: null,
    sessionKind: "daily",
  };
}

describe("getStrugglingQuestionIds", () => {
  it("retient les questions dont la dernière note est Again ou Hard", () => {
    const reviews = [
      makeReview("q1", 1, "2026-01-01T10:00:00.000Z"), // again
      makeReview("q2", 2, "2026-01-01T10:00:00.000Z"), // hard
      makeReview("q3", 3, "2026-01-01T10:00:00.000Z"), // good
      makeReview("q4", 4, "2026-01-01T10:00:00.000Z"), // easy
    ];
    const struggling = getStrugglingQuestionIds(reviews);
    expect(struggling.sort()).toEqual(["q1", "q2"]);
  });

  it("ne juge que sur la réponse la plus récente d'une question", () => {
    const reviews = [
      makeReview("q1", 1, "2026-01-01T10:00:00.000Z"), // again (ancien)
      makeReview("q1", 4, "2026-01-02T10:00:00.000Z"), // easy (plus récent) -> ne doit plus être "struggling"
      makeReview("q2", 4, "2026-01-01T10:00:00.000Z"), // easy (ancien)
      makeReview("q2", 2, "2026-01-02T10:00:00.000Z"), // hard (plus récent) -> struggling
    ];
    const struggling = getStrugglingQuestionIds(reviews);
    expect(struggling).toEqual(["q2"]);
  });

  it("retourne un tableau vide sans historique", () => {
    expect(getStrugglingQuestionIds([])).toEqual([]);
  });
});
