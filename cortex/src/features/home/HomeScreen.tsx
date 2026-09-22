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
import { isToday } from "../../utils/date";

interface HomeStats {
  dueCount: number;
  totalCards: number;
  streak: { current: number; best: number };
  reviewsToday: number;
  weakPoints: { subtest: string; accuracy: number }[];
  strugglingCount: number;
}

export function HomeScreen() {
  const [stats, setStats] = useState<HomeStats | null>(null);

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
      setStats({ dueCount: due.length, totalCards: total, streak, reviewsToday, weakPoints, strugglingCount });
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

      <div class="stack">
        <button class="btn btn-primary btn-block" onClick={() => navigate({ name: "session", mode: "daily" })}>
          Session du jour — 25 min
        </button>
        <button class="btn btn-secondary btn-block" onClick={() => navigate({ name: "session", mode: "short" })}>
          Session courte — 10 min
        </button>
        <button class="btn btn-secondary btn-block" onClick={() => navigate({ name: "mock-exam" })}>
          Test blanc complet TAGE 2 — 1h55
        </button>
      </div>

      {stats && stats.strugglingCount > 0 && (
        <button
          class="btn btn-secondary btn-block"
          onClick={() => navigate({ name: "session", mode: "weak-review" })}
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
              <span class="badge badge-danger">{Math.round(w.accuracy * 100)}%</span>
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
