import { describe, expect, it } from "vitest";
import {
  adaptPlan,
  buildWeek,
  computeAreaWeights,
  computePlanProgress,
  defaultRestDays,
  generatePlan,
  reschedulePlan,
  weeklyMinutes,
} from "../../src/domain/plan";
import { SKILL_AREA_IDS, type SkillAreaId } from "../../src/domain/skills";
import type { AreaAssessment, SessionRecord } from "../../src/db/schema";

function assessment(area: SkillAreaId, masteryScore: number, questions = 10): AreaAssessment {
  return {
    area,
    questions,
    correct: Math.round((masteryScore / 100) * questions),
    accuracy: masteryScore / 100,
    paceRatio: 1,
    avgResponseTimeMs: 45_000,
    masteryScore,
    level: 3,
    reachedDifficulty: 3,
    confidence: "bonne",
    weakTags: [],
    errorTypes: [],
  };
}

const BALANCED = SKILL_AREA_IDS.map((area) => assessment(area, 60));

describe("computeAreaWeights", () => {
  it("donne plus de temps au domaine le plus faible", () => {
    const assessments = [
      assessment("calcul", 90),
      assessment("anglais", 30),
      ...SKILL_AREA_IDS.filter((a) => a !== "calcul" && a !== "anglais").map((a) =>
        assessment(a, 60),
      ),
    ];
    const weights = computeAreaWeights(assessments, "general");
    expect(weights.anglais).toBeGreaterThan(weights.calcul);
  });

  it("n'abandonne jamais totalement un domaine maîtrisé", () => {
    const assessments = SKILL_AREA_IDS.map((area) =>
      assessment(area, area === "calcul" ? 100 : 20),
    );
    const weights = computeAreaWeights(assessments, "general");
    expect(weights.calcul).toBeGreaterThan(0);
  });

  it("tient compte de l'importance du domaine pour l'objectif", () => {
    const assessments = SKILL_AREA_IDS.map((area) => assessment(area, 50));
    const tage = computeAreaWeights(assessments, "tage2");
    const toeic = computeAreaWeights(assessments, "toeic");

    expect(toeic.anglais).toBeGreaterThan(tage.anglais);
    expect(tage.calcul).toBeGreaterThan(toeic.calcul);
  });

  it("répartit sur 100 % au total", () => {
    const weights = computeAreaWeights(BALANCED, "tage2");
    const total = SKILL_AREA_IDS.reduce((sum, area) => sum + weights[area], 0);
    expect(total).toBeCloseTo(1, 5);
  });
});

describe("buildWeek", () => {
  const weights = computeAreaWeights(BALANCED, "tage2");

  it("respecte les jours de repos", () => {
    const week = buildWeek(weights, 25, [0, 6]);
    expect(week[0].rest).toBe(true);
    expect(week[6].rest).toBe(true);
    expect(week[1].rest).toBe(false);
  });

  it("tient le budget de temps quotidien", () => {
    const week = buildWeek(weights, 25, [0]);
    for (const day of week.filter((d) => !d.rest)) {
      const total = day.blocks.reduce((sum, b) => sum + b.minutes, 0);
      expect(total).toBe(25);
    }
  });

  it("réserve du temps pour la révision des erreurs", () => {
    const week = buildWeek(weights, 30, [0]);
    const reviewBlocks = week.flatMap((d) => d.blocks).filter((b) => b.kind === "error-review");
    expect(reviewBlocks.length).toBeGreaterThan(0);
  });

  it("ne programme pas deux fois le même domaine dans la journée", () => {
    const week = buildWeek(weights, 60, [0]);
    for (const day of week.filter((d) => !d.rest)) {
      const areas = day.blocks.filter((b) => b.area).map((b) => b.area);
      expect(new Set(areas).size).toBe(areas.length);
    }
  });

  it("fonctionne même sur une journée très courte", () => {
    const week = buildWeek(weights, 10, [0, 6]);
    const trainingDays = week.filter((d) => !d.rest);
    expect(trainingDays.length).toBe(5);
    for (const day of trainingDays) {
      expect(day.blocks.length).toBeGreaterThan(0);
    }
  });
});

describe("generatePlan", () => {
  it("construit un plan cohérent avec les paramètres", () => {
    const plan = generatePlan(
      {
        objective: "tage2",
        durationWeeks: 26,
        targetDate: "2026-09-01",
        minutesPerDay: 25,
        daysPerWeek: 6,
        restDays: defaultRestDays(6),
        diagnosticId: "diag-1",
      },
      BALANCED,
    );

    expect(plan.daysPerWeek).toBe(6);
    expect(plan.week.filter((d) => !d.rest).length).toBe(6);
    expect(weeklyMinutes(plan)).toBe(25 * 6);
    expect(plan.revision).toBe(1);
    expect(plan.history).toHaveLength(1);
  });
});

describe("adaptPlan", () => {
  it("rééquilibre quand un domaine faible a progressé", () => {
    const initial = generatePlan(
      {
        objective: "general",
        durationWeeks: 12,
        targetDate: null,
        minutesPerDay: 30,
        daysPerWeek: 6,
        diagnosticId: null,
      },
      SKILL_AREA_IDS.map((area) => assessment(area, area === "anglais" ? 25 : 70)),
    );

    const before = initial.areaWeights.anglais;
    const adapted = adaptPlan(
      initial,
      SKILL_AREA_IDS.map((area) => assessment(area, area === "anglais" ? 85 : 70)),
      "Anglais a bien progressé.",
    );

    expect(adapted).not.toBeNull();
    expect(adapted!.areaWeights.anglais).toBeLessThan(before);
    expect(adapted!.revision).toBe(2);
    expect(adapted!.history).toHaveLength(2);
  });

  it("ne touche à rien sans données suffisantes", () => {
    const initial = generatePlan(
      {
        objective: "general",
        durationWeeks: 12,
        targetDate: null,
        minutesPerDay: 30,
        daysPerWeek: 6,
        diagnosticId: null,
      },
      BALANCED,
    );
    expect(adaptPlan(initial, [assessment("calcul", 80, 1)], "trop peu de données")).toBeNull();
  });
});

describe("computePlanProgress", () => {
  it("compte les blocs réellement terminés", () => {
    const plan = generatePlan(
      {
        objective: "general",
        durationWeeks: 4,
        targetDate: null,
        minutesPerDay: 25,
        daysPerWeek: 7,
        restDays: [],
        diagnosticId: null,
      },
      BALANCED,
    );
    const now = new Date(plan.createdAt);
    const todayBlocks = plan.week[now.getDay()].blocks;

    const sessions: SessionRecord[] = [
      {
        id: "s1",
        kind: "plan",
        startedAt: now.toISOString(),
        finishedAt: now.toISOString(),
        questionIds: [],
        mockExamResult: null,
        planId: plan.id,
        planBlockId: todayBlocks[0].id,
      },
      // Session non terminée : ne doit pas compter.
      {
        id: "s2",
        kind: "plan",
        startedAt: now.toISOString(),
        finishedAt: null,
        questionIds: [],
        mockExamResult: null,
        planId: plan.id,
        planBlockId: todayBlocks[1]?.id ?? todayBlocks[0].id,
      },
    ];

    const progress = computePlanProgress(plan, sessions, now);
    expect(progress.completedBlocks).toBe(1);
    expect(progress.todayDone).toBe(1);
    expect(progress.todayTotal).toBe(todayBlocks.length);
    expect(progress.doneBlockIds).toEqual([todayBlocks[0].id]);
  });
});

describe("stabilité des blocs entre deux versions du plan", () => {
  const params = {
    objective: "general" as const,
    durationWeeks: 12,
    targetDate: null,
    minutesPerDay: 30,
    daysPerWeek: 6,
    diagnosticId: null,
  };

  it("génère des identifiants déterministes (pas d'aléatoire)", () => {
    const first = generatePlan(params, BALANCED);
    const second = generatePlan(params, BALANCED);

    const ids = (plan: typeof first) => plan.week.flatMap((d) => d.blocks.map((b) => b.id));
    expect(ids(first)).toEqual(ids(second));
  });

  it("conserve les séances déjà faites après un ajustement du plan", () => {
    const plan = generatePlan(params, BALANCED);
    const now = new Date(plan.createdAt);
    const todayBlock = plan.week[now.getDay()].blocks[0];

    const sessions: SessionRecord[] = [
      {
        id: "s1",
        kind: "plan",
        startedAt: now.toISOString(),
        finishedAt: now.toISOString(),
        questionIds: [],
        mockExamResult: null,
        planId: plan.id,
        planBlockId: todayBlock.id,
      },
    ];
    expect(computePlanProgress(plan, sessions, now).todayDone).toBe(1);

    const adapted = adaptPlan(
      plan,
      SKILL_AREA_IDS.map((area) => assessment(area, area === "calcul" ? 95 : 40)),
      "Calcul est acquis.",
    )!;
    const stillThere = adapted.week[now.getDay()].blocks.some((b) => b.id === todayBlock.id);
    if (stillThere) {
      expect(computePlanProgress(adapted, sessions, now).doneBlockIds).toContain(todayBlock.id);
    }
  });

  it("changer de rythme garde les pondérations, l'historique et le plan", () => {
    const plan = generatePlan(params, BALANCED);
    const rescheduled = reschedulePlan(plan, { minutesPerDay: 15, daysPerWeek: 5 });

    expect(rescheduled.id).toBe(plan.id);
    expect(rescheduled.areaWeights).toEqual(plan.areaWeights);
    expect(rescheduled.minutesPerDay).toBe(15);
    expect(rescheduled.daysPerWeek).toBe(5);
    expect(rescheduled.revision).toBe(plan.revision + 1);
    expect(rescheduled.history.length).toBe(plan.history.length + 1);
    for (const day of rescheduled.week.filter((d) => !d.rest)) {
      expect(day.blocks.reduce((sum, b) => sum + b.minutes, 0)).toBe(15);
    }
  });
});
