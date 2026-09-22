import { useEffect, useState } from "preact/hooks";
import { getAllReviews } from "../../db/repositories/reviewsRepo";
import { getMockExamSessions } from "../../db/repositories/sessionsRepo";
import { getLatestDiagnostic } from "../../db/repositories/diagnosticsRepo";
import type { AreaAssessment, DiagnosticRecord, ReviewRecord, SessionRecord } from "../../db/schema";
import {
  computeAllSubtestStats,
  identifyWeakPoints,
  accuracyByDay,
  computeStreak,
} from "../../domain/scoring";
import {
  answersFromReviews,
  assessAllAreas,
  areaTrend,
  computeErrorsCorrected,
  computeRetention,
  identifyPriorityWeaknesses,
  totalTrainingTimeMs,
  LEVEL_LABELS,
  type TrendBucket,
} from "../../domain/skill-analysis";
import { estimateProjectedScore, type ProjectedScore } from "../../domain/tage-score-estimator";
import { loadQuestionBank } from "../../domain/questionBank";
import type { Question } from "../../domain/question";
import { allSubtestIds, SUBTESTS } from "../../domain/modules";
import { SKILL_AREAS } from "../../domain/skills";
import { Heatmap } from "../../components/Heatmap";
import { LineChart } from "../../components/LineChart";
import { MasteryBar, masteryColor } from "../../components/MasteryBar";
import { navigate } from "../../router";
import { formatDateFr } from "../../utils/date";

type Range = 30 | 90;

interface DashboardData {
  reviews: ReviewRecord[];
  bank: Map<string, Question>;
  mockExams: SessionRecord[];
  diagnostic: DiagnosticRecord | undefined;
}

export function DashboardScreen() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [range, setRange] = useState<Range>(30);

  useEffect(() => {
    void (async () => {
      const [reviews, mockExams, bank, diagnostic] = await Promise.all([
        getAllReviews(),
        getMockExamSessions(),
        loadQuestionBank(),
        getLatestDiagnostic(),
      ]);
      setData({
        reviews,
        bank: new Map(bank.map((q) => [q.id, q])),
        mockExams,
        diagnostic,
      });
    })();
  }, []);

  if (!data) {
    return (
      <div class="screen">
        <p class="text-muted">Chargement du tableau de bord…</p>
      </div>
    );
  }

  const { reviews, bank, mockExams, diagnostic } = data;

  const assessments = assessAllAreas(answersFromReviews(reviews), bank).filter(
    (a) => a.questions > 0,
  );
  const globalMastery =
    assessments.length > 0
      ? Math.round(assessments.reduce((sum, a) => sum + a.masteryScore, 0) / assessments.length)
      : 0;
  const retention = computeRetention(reviews);
  const errors = computeErrorsCorrected(reviews);
  const trainingMinutes = Math.round(totalTrainingTimeMs(reviews) / 60000);
  const streak = computeStreak(reviews);
  const projected = estimateProjectedScore(reviews);
  const priorities = identifyPriorityWeaknesses(assessments);

  const subtestStats = computeAllSubtestStats(reviews, allSubtestIds());
  const weakPoints = identifyWeakPoints(subtestStats, 3);
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

      <div class="card stack">
        <div class="row" style={{ justifyContent: "space-between" }}>
          <span>Maîtrise globale</span>
          <strong style={{ fontSize: 22 }}>{globalMastery} %</strong>
        </div>
        <MasteryBar value={globalMastery} />
        <div class="row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <Metric value={`${streak.current}`} label="jours de suite" />
          <Metric value={`${reviews.length}`} label="questions traitées" />
          <Metric value={`${trainingMinutes} min`} label="temps d'entraînement" />
        </div>
      </div>

      <div class="card stack">
        <div class="row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <Metric
            value={retention.sample > 0 ? `${Math.round(retention.rate * 100)} %` : "—"}
            label="rétention"
            hint={retention.sample > 0 ? `${retention.sample} questions revues` : "à partir des reprises"}
          />
          <Metric value={`${errors.corrected}`} label="erreurs corrigées" hint={`${errors.stillWrong} encore à revoir`} />
          <Metric value={`${streak.best}`} label="meilleure série" />
        </div>
        <p class="text-muted" style={{ margin: 0, fontSize: 12.5 }}>
          La rétention mesure ta réussite sur les questions déjà rencontrées : c'est ce qui dit si ce
          que tu apprends tient dans la durée.
        </p>
      </div>

      <ProjectedScoreCard projected={projected} />

      {assessments.length > 0 && (
        <>
          <h2 style={{ marginTop: 8 }}>Par domaine</h2>
          {assessments
            .slice()
            .sort((a, b) => a.masteryScore - b.masteryScore)
            .map((assessment) => (
              <AreaProgressCard
                key={assessment.area}
                assessment={assessment}
                trend={areaTrend(reviews, bank, assessment.area)}
              />
            ))}
        </>
      )}

      {priorities.length > 0 && (
        <div class="card stack">
          <h3 style={{ margin: 0 }}>À travailler en priorité</h3>
          {priorities.map((priority, i) => (
            <div key={priority.area} class="stack" style={{ gap: 2 }}>
              <div class="row" style={{ justifyContent: "space-between" }}>
                <strong>
                  {i + 1}. {SKILL_AREAS[priority.area].label}
                </strong>
                <span class="badge badge-muted">
                  {priority.driver === "vitesse" ? "vitesse" : priority.driver === "mixte" ? "méthode + vitesse" : "méthode"}
                </span>
              </div>
              <p class="text-muted" style={{ margin: 0, fontSize: 13 }}>
                {priority.reason}
              </p>
              <button
                class="btn btn-secondary"
                style={{ padding: "8px 14px", fontSize: 14, alignSelf: "flex-start" }}
                onClick={() =>
                  navigate({ name: "session", spec: { kind: "focus", area: priority.area, minutes: 10 } })
                }
              >
                S'entraîner 10 min
              </button>
            </div>
          ))}
        </div>
      )}

      <div class="card stack">
        <div class="row" style={{ justifyContent: "space-between" }}>
          <h3 style={{ margin: 0 }}>Taux de réussite</h3>
          <div class="segmented-control" style={{ width: 120 }}>
            <button
              class={`segmented-control-option${range === 30 ? " active" : ""}`}
              onClick={() => setRange(30)}
            >
              30j
            </button>
            <button
              class={`segmented-control-option${range === 90 ? " active" : ""}`}
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

      <div class="card stack">
        <h3>Par sous-test</h3>
        {subtestStats
          .filter((s) => s.attempts > 0)
          .sort((a, b) => a.accuracy - b.accuracy)
          .map((s) => (
            <div class="stack" key={s.subtest} style={{ gap: 4 }}>
              <div class="row" style={{ justifyContent: "space-between", fontSize: 13 }}>
                <span>{SUBTESTS[s.subtest].label}</span>
                <span class="text-muted">
                  {Math.round(s.accuracy * 100)} % · {s.attempts} ·{" "}
                  {(s.avgResponseTimeMs / 1000).toFixed(0)} s{s.paceRatio > 1.15 ? " (lent)" : ""}
                </span>
              </div>
              <MasteryBar value={s.accuracy * 100} height={8} />
            </div>
          ))}
        {subtestStats.every((s) => s.attempts === 0) && (
          <p class="text-muted">Pas encore de données — commence une session.</p>
        )}
        {weakPoints.length > 0 && (
          <p class="text-muted" style={{ margin: 0, fontSize: 12.5 }}>
            Sous-test le plus fragile : {SUBTESTS[weakPoints[0].subtest].label}.
          </p>
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

      <div class="list">
        {diagnostic && (
          <button
            class="list-row"
            onClick={() => navigate({ name: "diagnostic-result", id: diagnostic.id })}
          >
            <span class="stack" style={{ gap: 1 }}>
              <span>Mon dernier test de niveau</span>
              <span class="text-muted" style={{ fontSize: 12.5 }}>
                {formatDateFr(diagnostic.startedAt)} · {diagnostic.overallScore} %
              </span>
            </span>
            <span class="text-muted" aria-hidden="true">
              ›
            </span>
          </button>
        )}
        <button class="list-row" onClick={() => navigate({ name: "history" })}>
          <span>Historique des sessions</span>
          <span class="text-muted" aria-hidden="true">
            ›
          </span>
        </button>
      </div>
    </div>
  );
}

function Metric({ value, label, hint }: { value: string; label: string; hint?: string }) {
  return (
    <div class="stack" style={{ gap: 0 }}>
      <div style={{ fontSize: 20, fontWeight: 700 }}>{value}</div>
      <div class="text-muted" style={{ fontSize: 12 }}>
        {label}
      </div>
      {hint && (
        <div class="text-muted" style={{ fontSize: 11 }}>
          {hint}
        </div>
      )}
    </div>
  );
}

function AreaProgressCard({
  assessment,
  trend,
}: {
  assessment: AreaAssessment;
  trend: TrendBucket[];
}) {
  const area = SKILL_AREAS[assessment.area];
  const measured = trend.filter((t) => t.masteryScore !== null);

  return (
    <div class="card stack" style={{ gap: 10 }}>
      <div class="row" style={{ justifyContent: "space-between" }}>
        <span class="row" style={{ gap: 8 }}>
          <span aria-hidden="true">{area.emoji}</span>
          <span class="stack" style={{ gap: 0 }}>
            <strong>{area.label}</strong>
            <span class="text-muted" style={{ fontSize: 12.5 }}>
              {LEVEL_LABELS[assessment.level]} · {Math.round(assessment.accuracy * 100)} % de
              réussite
            </span>
          </span>
        </span>
        <strong style={{ fontSize: 18 }}>{assessment.masteryScore} %</strong>
      </div>

      <MasteryBar value={assessment.masteryScore} />

      {measured.length >= 2 ? (
        <div class="row" style={{ gap: 6, flexWrap: "wrap", fontSize: 13 }}>
          {measured.map((bucket, i) => (
            <span key={bucket.label} class="row" style={{ gap: 6 }}>
              <span style={{ color: masteryColor(bucket.masteryScore ?? 0), fontWeight: 600 }}>
                {bucket.masteryScore} %
              </span>
              {i < measured.length - 1 && <span class="text-muted">→</span>}
            </span>
          ))}
          <span class="text-muted" style={{ fontSize: 12 }}>
            ({measured[0].label} → {measured[measured.length - 1].label})
          </span>
        </div>
      ) : (
        <span class="text-muted" style={{ fontSize: 12.5 }}>
          Pas encore assez d'historique pour afficher une tendance.
        </span>
      )}

      <div class="row" style={{ gap: 8 }}>
        <button
          class="btn btn-secondary"
          style={{ padding: "8px 14px", fontSize: 14 }}
          onClick={() =>
            navigate({ name: "session", spec: { kind: "focus", area: assessment.area, minutes: 10 } })
          }
        >
          Entraînement 10 min
        </button>
        <button
          class="btn btn-secondary"
          style={{ padding: "8px 14px", fontSize: 14 }}
          onClick={() =>
            navigate({ name: "session", spec: { kind: "learning", area: assessment.area } })
          }
        >
          Apprendre
        </button>
      </div>
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
          Estimation peu fiable pour l'instant (données encore limitées sur les 30 derniers jours) —
          indicatif seulement, pas un score officiel.
        </p>
      )}
    </div>
  );
}
