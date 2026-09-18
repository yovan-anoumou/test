import { useEffect, useState } from "preact/hooks";
import { getAllReviews } from "../../db/repositories/reviewsRepo";
import { getMockExamSessions } from "../../db/repositories/sessionsRepo";
import type { ReviewRecord, SessionRecord } from "../../db/schema";
import {
  computeAllSubtestStats,
  identifyWeakPoints,
  accuracyByDay,
  computeStreak,
  type SubtestStats,
} from "../../domain/scoring";
import { estimateProjectedScore, type ProjectedScore } from "../../domain/tage-score-estimator";
import { allSubtestIds, SUBTESTS } from "../../domain/modules";
import { Heatmap } from "../../components/Heatmap";
import { LineChart } from "../../components/LineChart";
import { formatDateFr } from "../../utils/date";

type Range = 30 | 90;

export function DashboardScreen() {
  const [reviews, setReviews] = useState<ReviewRecord[] | null>(null);
  const [mockExams, setMockExams] = useState<SessionRecord[]>([]);
  const [range, setRange] = useState<Range>(30);

  useEffect(() => {
    void (async () => {
      const [r, m] = await Promise.all([getAllReviews(), getMockExamSessions()]);
      setReviews(r);
      setMockExams(m);
    })();
  }, []);

  if (!reviews) {
    return (
      <div class="screen">
        <p class="text-muted">Chargement du tableau de bord…</p>
      </div>
    );
  }

  const stats = computeAllSubtestStats(reviews, allSubtestIds());
  const weakPoints = identifyWeakPoints(stats, 3);
  const streak = computeStreak(reviews);
  const projected = estimateProjectedScore(reviews);
  const curve = accuracyByDay(reviews, range);
  const curvePoints = curve.map((c) => ({ label: c.date, value: c.accuracy }));

  const countsByDay = new Map<string, number>();
  for (const r of reviews) {
    const key = r.timestamp.slice(0, 10);
    countsByDay.set(key, (countsByDay.get(key) ?? 0) + 1);
  }

  return (
    <div class="screen stack">
      <h1>Progrès</h1>

      <div class="card row" style={{ justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{streak.current} 🔥</div>
          <div class="text-muted" style={{ fontSize: 12 }}>
            série actuelle
          </div>
        </div>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{streak.best}</div>
          <div class="text-muted" style={{ fontSize: 12 }}>
            meilleure série
          </div>
        </div>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{reviews.length}</div>
          <div class="text-muted" style={{ fontSize: 12 }}>
            réponses au total
          </div>
        </div>
      </div>

      <ProjectedScoreCard projected={projected} />

      <div class="card stack">
        <div class="row" style={{ justifyContent: "space-between" }}>
          <h3 style={{ margin: 0 }}>Taux de réussite</h3>
          <div class="row" style={{ gap: 4 }}>
            <button
              class={`btn btn-secondary`}
              style={{ padding: "6px 10px", fontSize: 12, opacity: range === 30 ? 1 : 0.5 }}
              onClick={() => setRange(30)}
            >
              30j
            </button>
            <button
              class={`btn btn-secondary`}
              style={{ padding: "6px 10px", fontSize: 12, opacity: range === 90 ? 1 : 0.5 }}
              onClick={() => setRange(90)}
            >
              90j
            </button>
          </div>
        </div>
        <LineChart points={curvePoints} maxValue={1} />
      </div>

      <div class="card stack">
        <h3>Activité</h3>
        <Heatmap countsByDay={countsByDay} weeks={12} />
      </div>

      {weakPoints.length > 0 && (
        <div class="card stack">
          <h3>Points faibles du moment</h3>
          {weakPoints.map((w) => (
            <div class="stack" key={w.subtest} style={{ gap: 4 }}>
              <div class="row" style={{ justifyContent: "space-between" }}>
                <span>{SUBTESTS[w.subtest].label}</span>
                <span class="badge badge-danger">{Math.round(w.accuracy * 100)}%</span>
              </div>
              <p class="text-muted" style={{ fontSize: 13, margin: 0 }}>
                {recommendationFor(w)}
              </p>
            </div>
          ))}
        </div>
      )}

      <div class="card stack">
        <h3>Par sous-test</h3>
        {stats
          .filter((s) => s.attempts > 0)
          .sort((a, b) => a.accuracy - b.accuracy)
          .map((s) => (
            <div class="stack" key={s.subtest} style={{ gap: 4 }}>
              <div class="row" style={{ justifyContent: "space-between", fontSize: 13 }}>
                <span>{SUBTESTS[s.subtest].label}</span>
                <span class="text-muted">
                  {Math.round(s.accuracy * 100)}% · {s.attempts} · {(s.avgResponseTimeMs / 1000).toFixed(0)}s
                  {s.paceRatio > 1.15 ? " (lent)" : ""}
                </span>
              </div>
              <div class="stat-bar-track">
                <div
                  class="stat-bar-fill"
                  style={{
                    width: `${Math.round(s.accuracy * 100)}%`,
                    background:
                      s.accuracy >= 0.85
                        ? "var(--color-success)"
                        : s.accuracy >= 0.6
                          ? "var(--color-warning)"
                          : "var(--color-danger)",
                  }}
                />
              </div>
            </div>
          ))}
        {stats.every((s) => s.attempts === 0) && (
          <p class="text-muted">Pas encore de données — commence une session.</p>
        )}
      </div>

      {mockExams.length > 0 && (
        <div class="card stack">
          <h3>Tests blancs</h3>
          {mockExams.map((exam, idx) => {
            const prev = mockExams[idx + 1];
            const score = exam.mockExamResult?.projectedScore ?? 0;
            const prevScore = prev?.mockExamResult?.projectedScore ?? null;
            const delta = prevScore !== null ? score - prevScore : null;
            return (
              <div class="row" key={exam.id} style={{ justifyContent: "space-between" }}>
                <span class="text-muted" style={{ fontSize: 13 }}>
                  {formatDateFr(exam.startedAt)}
                </span>
                <span class="row">
                  <strong>{score} / 600</strong>
                  {delta !== null && (
                    <span class={`badge ${delta >= 0 ? "badge-success" : "badge-danger"}`}>
                      {delta >= 0 ? "+" : ""}
                      {delta}
                    </span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ProjectedScoreCard({ projected }: { projected: ProjectedScore }) {
  return (
    <div class="card stack">
      <div class="row" style={{ justifyContent: "space-between" }}>
        <h3 style={{ margin: 0 }}>Score TAGE 2 projeté</h3>
        <strong style={{ fontSize: 20 }}>{projected.total} / 600</strong>
      </div>
      {projected.lowConfidence && (
        <p class="text-muted" style={{ fontSize: 12, margin: 0 }}>
          Estimation peu fiable pour l'instant (données encore limitées sur les 30 derniers
          jours) — indicatif seulement, pas un score officiel.
        </p>
      )}
    </div>
  );
}

function recommendationFor(stats: SubtestStats): string {
  if (stats.paceRatio > 1.3) {
    return "Tu es souvent trop lent sur ce sous-test : revois la méthode rapide avant de continuer à accumuler des questions.";
  }
  return "Le taux de réussite est bas : reviens sur la méthode et refais quelques questions faciles avant de monter en difficulté.";
}
