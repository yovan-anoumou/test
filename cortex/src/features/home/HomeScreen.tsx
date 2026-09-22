import { useEffect, useState } from "preact/hooks";
import { navigate } from "../../router";
import { getDueReviewCards, countCards } from "../../db/repositories/cardsRepo";
import { getAllReviews } from "../../db/repositories/reviewsRepo";
import {
  computeStreak,
  identifyWeakPoints,
  computeAllSubtestStats,
  getStrugglingQuestionIds,
} from "../../domain/scoring";
import { allSubtestIds, SUBTESTS } from "../../domain/modules";
import { SKILL_AREAS } from "../../domain/skills";
import type { PlanBlock, TrainingPlanRecord } from "../../db/schema";
import type { PlanProgress } from "../../domain/plan";
import { loadPlanContext, maybeAdaptPlan } from "../../services/planService";
import { isToday } from "../../utils/date";
import { MasteryBar } from "../../components/MasteryBar";

interface HomeStats {
  dueCount: number;
  totalCards: number;
  streak: { current: number; best: number };
  reviewsToday: number;
  weakPoints: { subtest: string; accuracy: number }[];
  strugglingCount: number;
}

interface PlanState {
  plan: TrainingPlanRecord | null;
  progress: PlanProgress | null;
  todayBlocks: PlanBlock[];
  isRestDay: boolean;
}

export function HomeScreen() {
  const [stats, setStats] = useState<HomeStats | null>(null);
  const [planState, setPlanState] = useState<PlanState | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [due, total, reviews] = await Promise.all([
        getDueReviewCards(),
        countCards(),
        getAllReviews(),
      ]);
      if (cancelled) return;
      const streak = computeStreak(reviews);
      const reviewsToday = reviews.filter((r) => isToday(r.timestamp)).length;
      const allStats = computeAllSubtestStats(reviews, allSubtestIds());
      const weakPoints = identifyWeakPoints(allStats, 3).map((s) => ({
        subtest: SUBTESTS[s.subtest].label,
        accuracy: s.accuracy,
      }));
      const strugglingCount = getStrugglingQuestionIds(reviews).length;
      setStats({
        dueCount: due.length,
        totalCards: total,
        streak,
        reviewsToday,
        weakPoints,
        strugglingCount,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      // Le plan se réajuste tout seul quand assez de nouvelles réponses sont
      // arrivées depuis la dernière révision.
      await maybeAdaptPlan();
      const context = await loadPlanContext();
      if (!cancelled) setPlanState(context);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div class="screen stack">
      <header>
        <h1>CORTEX</h1>
        <p class="text-muted">Entraînement ciblé — TAGE 2, anglais, culture générale, raisonnement.</p>
      </header>

      {stats && (
        <div class="card row" style={{ justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{stats.streak.current} 🔥</div>
            <div class="text-muted" style={{ fontSize: 12 }}>
              jours de suite
            </div>
          </div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{stats.dueCount}</div>
            <div class="text-muted" style={{ fontSize: 12 }}>
              cartes dues
            </div>
          </div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{stats.reviewsToday}</div>
            <div class="text-muted" style={{ fontSize: 12 }}>
              révisées aujourd'hui
            </div>
          </div>
        </div>
      )}

      {planState && <TodayPlanCard state={planState} />}

      <div class="stack">
        <button
          class="btn btn-secondary btn-block"
          onClick={() => navigate({ name: "session", spec: { kind: "daily" } })}
        >
          Session du jour — 25 min
        </button>
        <button
          class="btn btn-secondary btn-block"
          onClick={() => navigate({ name: "session", spec: { kind: "short" } })}
        >
          Session courte — 10 min
        </button>
        <button
          class="btn btn-secondary btn-block"
          onClick={() => navigate({ name: "session", spec: { kind: "learning", area: null } })}
        >
          Mode apprentissage — sans chrono
        </button>
        <button class="btn btn-secondary btn-block" onClick={() => navigate({ name: "mock-exam" })}>
          Test blanc complet TAGE 2 — 1h55
        </button>
      </div>

      {stats && stats.strugglingCount > 0 && (
        <button
          class="btn btn-secondary btn-block"
          onClick={() => navigate({ name: "session", spec: { kind: "weak-review" } })}
        >
          Réviser mes points faibles — {stats.strugglingCount} question
          {stats.strugglingCount > 1 ? "s" : ""}
        </button>
      )}

      {stats && stats.weakPoints.length > 0 && (
        <div class="card stack">
          <h3>Points à travailler</h3>
          {stats.weakPoints.map((w) => (
            <div class="row" key={w.subtest} style={{ justifyContent: "space-between" }}>
              <span>{w.subtest}</span>
              <span class="badge badge-danger">{Math.round(w.accuracy * 100)} %</span>
            </div>
          ))}
          <button class="btn btn-secondary btn-block" onClick={() => navigate({ name: "dashboard" })}>
            Voir le tableau de bord
          </button>
        </div>
      )}

      {stats && stats.totalCards === 0 && (
        <div class="card">
          <p class="text-muted">Chargement de la banque de questions…</p>
        </div>
      )}
    </div>
  );
}

function TodayPlanCard({ state }: { state: PlanState }) {
  const { plan, progress, todayBlocks, isRestDay } = state;

  if (!plan) {
    return (
      <div class="card stack">
        <h3 style={{ margin: 0 }}>Ton plan d'entraînement</h3>
        <p style={{ margin: 0, fontSize: 14 }}>
          Fais le test de niveau (≈ 20 min) : Cortex mesure ton niveau dans chaque domaine, repère
          tes points faibles précis et construit ton programme quotidien.
        </p>
        <button class="btn btn-primary btn-block" onClick={() => navigate({ name: "diagnostic" })}>
          Faire mon test de niveau
        </button>
      </div>
    );
  }

  const done = progress?.doneBlockIds ?? [];
  const remaining = todayBlocks.filter((b) => !done.includes(b.id));
  const totalMinutes = todayBlocks.reduce((sum, b) => sum + b.minutes, 0);

  if (isRestDay || todayBlocks.length === 0) {
    return (
      <div class="card stack">
        <div class="row" style={{ justifyContent: "space-between" }}>
          <h3 style={{ margin: 0 }}>Aujourd'hui</h3>
          <span class="badge badge-muted">Repos</span>
        </div>
        <p style={{ margin: 0, fontSize: 14 }}>
          Jour de repos prévu par ton plan. Tu peux quand même réviser librement si tu le sens.
        </p>
        <button class="btn btn-secondary btn-block" onClick={() => navigate({ name: "plan" })}>
          Voir mon plan
        </button>
      </div>
    );
  }

  return (
    <div class="card stack">
      <div class="row" style={{ justifyContent: "space-between" }}>
        <h3 style={{ margin: 0 }}>Ton plan du jour</h3>
        <span class="text-muted" style={{ fontSize: 13 }}>
          {totalMinutes} min
        </span>
      </div>

      <div class="stack" style={{ gap: 8 }}>
        {todayBlocks.map((block) => {
          const isDone = done.includes(block.id);
          const area = block.area ? SKILL_AREAS[block.area] : null;
          return (
            <div class="row" key={block.id} style={{ justifyContent: "space-between", gap: 10 }}>
              <span class="row" style={{ gap: 8 }}>
                <span aria-hidden="true">{isDone ? "✅" : area?.emoji ?? "🔁"}</span>
                <span style={{ textDecoration: isDone ? "line-through" : undefined }}>
                  {block.minutes} min — {block.label}
                </span>
              </span>
              {!isDone && (
                <button
                  class="btn btn-secondary"
                  style={{ padding: "6px 12px", fontSize: 13 }}
                  onClick={() =>
                    navigate({ name: "session", spec: { kind: "plan", blockId: block.id } })
                  }
                >
                  Démarrer
                </button>
              )}
            </div>
          );
        })}
      </div>

      {remaining.length > 0 ? (
        <button
          class="btn btn-primary btn-block"
          onClick={() =>
            navigate({ name: "session", spec: { kind: "plan", blockId: remaining[0].id } })
          }
        >
          Commencer — {remaining[0].minutes} min de {remaining[0].label.toLowerCase()}
        </button>
      ) : (
        <div class="fiche-callout fiche-callout-mnemonic" style={{ padding: 12 }}>
          <span class="fiche-callout-icon" aria-hidden="true">
            ✅
          </span>
          <p style={{ margin: 0, fontSize: 14 }}>
            Programme du jour terminé. Tu peux continuer librement si tu veux pousser plus loin.
          </p>
        </div>
      )}

      {progress && progress.expectedBlocks > 0 && (
        <div class="stack" style={{ gap: 4 }}>
          <div class="row" style={{ justifyContent: "space-between", fontSize: 12.5 }}>
            <span class="text-muted">Progression du plan</span>
            <span class="text-muted">{Math.round(progress.ratio * 100)} %</span>
          </div>
          <MasteryBar value={progress.ratio * 100} height={6} />
        </div>
      )}
    </div>
  );
}
