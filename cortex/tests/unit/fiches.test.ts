import { describe, expect, it } from "vitest";
import {
  computeFicheStats,
  matchesFicheFilter,
  prioritizeFiches,
  type QuestionLink,
} from "../../src/domain/fiches/mastery";
import { groupByCategory, isValidFiche, searchFiches } from "../../src/domain/fiches/bank";
import { fichesForQuestion, subtestsForFiche } from "../../src/domain/fiches/links";
import { buildFicheSession, buildTimeBoxedSession } from "../../src/domain/session-builder";
import type { CardRecord, FicheProgressRecord, ReviewRecord } from "../../src/db/schema";
import type { Fiche } from "../../src/domain/fiches/types";

function fiche(partial: Partial<Fiche> = {}): Fiche {
  return {
    id: "calc-pourcentages",
    domain: "calcul",
    category: "Pourcentages",
    title: "Coefficient multiplicateur",
    tagline: "Un pourcentage multiplie, il ne s'ajoute pas.",
    level: "fondamental",
    readMinutes: 3,
    tags: ["pourcentages", "evolution"],
    related: [],
    subtests: ["calcul"],
    blocks: [{ type: "rule", title: "Règle", body: "…" }],
    ...partial,
  };
}

function review(partial: Partial<ReviewRecord> = {}): ReviewRecord {
  return {
    id: Math.random().toString(36).slice(2),
    questionId: "q-pourcentage",
    module: "tage2",
    subtest: "calcul",
    timestamp: "2026-09-01T10:00:00.000Z",
    rating: 3,
    correct: true,
    responseTimeMs: 30_000,
    targetTimeSeconds: 60,
    difficulty: 3,
    sessionId: "s1",
    sessionKind: "daily",
    mode: "training",
    ...partial,
  };
}

function progress(partial: Partial<FicheProgressRecord> = {}): FicheProgressRecord {
  return {
    ficheId: "calc-pourcentages",
    readCount: 1,
    lastReadAt: "2026-09-01T09:00:00.000Z",
    favorite: false,
    quizAttempts: 0,
    quizCorrect: 0,
    ...partial,
  };
}

// Toutes les questions du jeu d'essai portent sur « pourcentages », sauf
// q-autre qui relève d'une autre notion du même sous-test.
const links: Record<string, QuestionLink> = {
  "q-pourcentage": { tags: ["pourcentages"], subtest: "calcul" },
  "q-autre": { tags: ["probabilites"], subtest: "calcul" },
};
const linkOf = (id: string) => links[id];

const NOW = new Date("2026-09-20T12:00:00.000Z");

describe("computeFicheStats — états de maîtrise", () => {
  it("non étudiée quand rien ne s'est passé", () => {
    const stats = computeFicheStats(fiche(), [], linkOf, undefined, NOW);
    expect(stats.state).toBe("non-etudie");
    expect(stats.read).toBe(false);
  });

  it("découverte après une lecture, avant d'avoir été testée", () => {
    const stats = computeFicheStats(fiche(), [], linkOf, progress(), NOW);
    expect(stats.state).toBe("decouverte");
  });

  it("en cours quand la précision est insuffisante", () => {
    const reviews = [
      review({ correct: true }),
      review({ correct: false }),
      review({ correct: false }),
      review({ correct: true }),
      review({ correct: false }),
    ];
    const stats = computeFicheStats(fiche(), reviews, linkOf, progress(), NOW);
    expect(stats.state).toBe("en-cours");
    expect(stats.accuracy).toBeCloseTo(0.4, 5);
  });

  it("maîtrisée mais pas automatique quand c'est juste mais lent", () => {
    // 6 bonnes réponses sur 6, mais en 90 s pour une cible de 60 s.
    const reviews = Array.from({ length: 6 }, () =>
      review({ correct: true, responseTimeMs: 90_000 }),
    );
    const stats = computeFicheStats(fiche(), reviews, linkOf, progress(), NOW);
    expect(stats.state).toBe("maitrise");
    expect(stats.slowButCorrect).toBe(true);
  });

  it("automatique quand c'est juste ET plus rapide que la cible", () => {
    const reviews = Array.from({ length: 6 }, () =>
      review({ correct: true, responseTimeMs: 30_000 }),
    );
    const stats = computeFicheStats(fiche(), reviews, linkOf, progress(), NOW);
    expect(stats.state).toBe("automatique");
    expect(stats.slowButCorrect).toBe(false);
  });

  it("ne compte pas les réponses d'une autre notion du même sous-test", () => {
    const reviews = [
      review({ questionId: "q-autre", correct: false }),
      review({ questionId: "q-autre", correct: false }),
    ];
    const stats = computeFicheStats(fiche(), reviews, linkOf, progress(), NOW);
    expect(stats.attempts).toBe(0);
    expect(stats.state).toBe("decouverte");
  });

  it("ignore le temps passé en mode apprentissage pour le rythme", () => {
    const reviews = Array.from({ length: 6 }, () =>
      review({ correct: true, responseTimeMs: 300_000, mode: "learning" }),
    );
    const stats = computeFicheStats(fiche(), reviews, linkOf, progress(), NOW);
    // Aucune réponse chronométrable : on ne peut pas décerner « automatique ».
    expect(stats.paceRatio).toBeNull();
    expect(stats.state).toBe("maitrise");
  });

  it("programme une relecture espacée après la lecture", () => {
    const stats = computeFicheStats(
      fiche(),
      [],
      linkOf,
      progress({ lastReadAt: "2026-09-01T09:00:00.000Z" }),
      NOW,
    );
    expect(stats.nextReviewAt).not.toBeNull();
    expect(stats.dueForReview).toBe(true);
  });
});

describe("matchesFicheFilter", () => {
  const base = computeFicheStats(fiche(), [], linkOf, progress({ favorite: true }), NOW);

  it("« Mes fiches » ne retient que les favoris", () => {
    expect(matchesFicheFilter(base, "favoris")).toBe(true);
    expect(matchesFicheFilter({ ...base, favorite: false }, "favoris")).toBe(false);
  });

  it("« Points faibles » demande un minimum de tentatives", () => {
    expect(matchesFicheFilter({ ...base, attempts: 2, accuracy: 0.2 }, "faibles")).toBe(false);
    expect(matchesFicheFilter({ ...base, attempts: 5, accuracy: 0.2 }, "faibles")).toBe(true);
  });

  it("« À revoir » attrape aussi les erreurs récentes", () => {
    const stats = { ...base, dueForReview: false, recentErrors: 2 };
    expect(matchesFicheFilter(stats, "a-revoir")).toBe(true);
  });
});

describe("prioritizeFiches", () => {
  it("met les notions ratées avant les fiches jamais lues", () => {
    const weak = { ...computeFicheStats(fiche(), [], linkOf, progress(), NOW), ficheId: "faible", attempts: 6, accuracy: 0.3 };
    const untouched = { ...computeFicheStats(fiche(), [], linkOf, undefined, NOW), ficheId: "jamais-lue" };
    const ordered = prioritizeFiches([untouched, weak]);
    expect(ordered[0].ficheId).toBe("faible");
  });
});

describe("searchFiches", () => {
  const bank = [
    fiche({ id: "a", title: "Pourcentages successifs", tagline: "Ils se multiplient.", tags: ["pourcentages"] }),
    fiche({ id: "b", title: "Médiane et moyenne", tagline: "La moyenne se laisse tirer par les extrêmes.", tags: ["mediane"] }),
    fiche({
      id: "c",
      title: "Probabilités",
      tagline: "Cas favorables sur cas possibles.",
      tags: ["probabilites"],
      blocks: [{ type: "rule", title: "Règle", body: "Le complémentaire évite d'énumérer." }],
    }),
  ];

  it("ignore les accents et la casse", () => {
    expect(searchFiches(bank, "MEDIANE").map((f) => f.id)).toEqual(["b"]);
    expect(searchFiches(bank, "probabilites").map((f) => f.id)).toEqual(["c"]);
  });

  it("classe les correspondances de titre avant celles du corps", () => {
    const results = searchFiches(bank, "moyenne");
    expect(results[0].id).toBe("b");
  });

  it("trouve un mot présent seulement dans le corps d'un bloc", () => {
    expect(searchFiches(bank, "complémentaire").map((f) => f.id)).toEqual(["c"]);
  });

  it("exige que tous les mots de la requête soient trouvés", () => {
    expect(searchFiches(bank, "médiane probabilités")).toHaveLength(0);
  });

  it("rend tout sur une requête vide", () => {
    expect(searchFiches(bank, "   ")).toHaveLength(3);
  });
});

describe("groupByCategory", () => {
  it("regroupe en conservant l'ordre du fichier", () => {
    const groups = groupByCategory([
      fiche({ id: "1", category: "Pourcentages" }),
      fiche({ id: "2", category: "Fractions" }),
      fiche({ id: "3", category: "Pourcentages" }),
    ]);
    expect(groups.map((g) => g.category)).toEqual(["Pourcentages", "Fractions"]);
    expect(groups[0].fiches.map((f) => f.id)).toEqual(["1", "3"]);
  });
});

describe("liens fiche ↔ question", () => {
  const bank = [
    fiche({ id: "pourcentages", tags: ["pourcentages", "evolution"], subtests: ["calcul"] }),
    fiche({ id: "probas", tags: ["probabilites"], subtests: ["calcul"] }),
    fiche({ id: "grammaire", domain: "anglais", tags: ["conditionnel"], subtests: ["grammaire"] }),
  ];

  it("classe d'abord la fiche qui partage un tag", () => {
    const found = fichesForQuestion(bank, "calcul", ["pourcentages"]);
    expect(found[0].id).toBe("pourcentages");
  });

  it("retombe sur le domaine quand aucun tag ne correspond", () => {
    const found = fichesForQuestion(bank, "calcul", ["tag-inexistant"]);
    expect(found.length).toBeGreaterThan(0);
    expect(found.every((f) => f.domain === "calcul")).toBe(true);
  });

  it("ne propose pas une fiche d'un autre domaine sans tag commun", () => {
    const found = fichesForQuestion(bank, "calcul", ["pourcentages"]);
    expect(found.map((f) => f.id)).not.toContain("grammaire");
  });

  it("déduit les sous-tests à interroger depuis le domaine si besoin", () => {
    expect(subtestsForFiche(fiche({ subtests: undefined, domain: "vitesse" }))).toContain(
      "calcul-mental",
    );
  });
});

describe("buildFicheSession", () => {
  function card(id: string, subtest: CardRecord["subtest"] = "calcul"): CardRecord {
    return {
      questionId: id,
      module: "tage2",
      subtest,
      due: "2026-09-01T00:00:00.000Z",
      stability: 1,
      difficulty: 5,
      elapsed_days: 0,
      scheduled_days: 0,
      learning_steps: 0,
      reps: 0,
      lapses: 0,
      state: 0,
      last_review: null,
    };
  }

  const difficulties: Record<string, number> = { facile: 1, moyen: 3, dur: 5 };
  const meta = (c: CardRecord) => ({
    targetTimeSeconds: 60,
    difficulty: difficulties[c.questionId] ?? 3,
  });

  const cards = [card("facile"), card("moyen"), card("dur"), card("hors-sujet")];
  const allowed = new Set(["facile", "moyen", "dur"]);

  it("ne tire que dans les questions de la fiche", () => {
    const plan = buildFicheSession([], cards, allowed, meta, { budgetSeconds: 600 });
    expect(plan.items.map((i) => i.card.questionId)).not.toContain("hors-sujet");
    expect(plan.items).toHaveLength(3);
  });

  it("« question rapide » prend une seule question, la plus accessible", () => {
    const plan = buildFicheSession([], cards, allowed, meta, {
      budgetSeconds: 120,
      maxItems: 1,
      difficultyOrder: "asc",
    });
    expect(plan.items).toHaveLength(1);
    expect(plan.items[0].card.questionId).toBe("facile");
  });

  it("« question difficile » commence par la plus exigeante", () => {
    const plan = buildFicheSession([], cards, allowed, meta, {
      budgetSeconds: 360,
      maxItems: 3,
      difficultyOrder: "desc",
    });
    expect(plan.items[0].card.questionId).toBe("dur");
  });

  it("ne rend jamais une session vide quand des questions existent", () => {
    const plan = buildFicheSession([], cards, allowed, meta, { budgetSeconds: 1, maxItems: 1 });
    expect(plan.items).toHaveLength(1);
  });

  it("rend une session vide si aucune question ne porte sur la fiche", () => {
    const plan = buildFicheSession([], cards, new Set<string>(), meta, { budgetSeconds: 600 });
    expect(plan.items).toHaveLength(0);
  });

  it("passe les cartes dues avant les neuves", () => {
    const plan = buildFicheSession([card("moyen")], [card("facile")], allowed, meta, {
      budgetSeconds: 600,
    });
    expect(plan.items[0].card.questionId).toBe("moyen");
  });

  describe("buildTimeBoxedSession", () => {
    it("tient le budget de temps et commence par les questions déjà ratées", () => {
      const due = [card("moyen"), card("dur")];
      const plan = buildTimeBoxedSession(due, [card("facile")], new Set(["dur"]), 120, meta);
      expect(plan.items[0].card.questionId).toBe("dur");
      expect(plan.items.length).toBeLessThanOrEqual(2);
    });
  });
});

describe("isValidFiche", () => {
  it("accepte une fiche complète", () => {
    expect(isValidFiche(fiche())).toBe(true);
  });

  it("refuse un niveau inconnu", () => {
    expect(isValidFiche({ ...fiche(), level: "expert" })).toBe(false);
  });

  it("refuse un bloc quiz sans réponse", () => {
    expect(
      isValidFiche({ ...fiche(), blocks: [{ type: "quiz", question: "Et alors ?" }] }),
    ).toBe(false);
  });

  it("refuse un tableau dont une ligne n'a pas le bon nombre de cellules", () => {
    expect(
      isValidFiche({
        ...fiche(),
        blocks: [{ type: "table", headers: ["a", "b"], rows: [["1"]] }],
      }),
    ).toBe(false);
  });
});
