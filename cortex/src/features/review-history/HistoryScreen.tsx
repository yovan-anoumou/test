import { useEffect, useState } from "preact/hooks";
import { getAllSessions } from "../../db/repositories/sessionsRepo";
import { getReviewsForSession } from "../../db/repositories/reviewsRepo";
import { loadQuestionBank } from "../../domain/questionBank";
import type { Question } from "../../domain/question";
import type { ReviewRecord, SessionRecord } from "../../db/schema";
import { formatDateFr, formatDurationShort } from "../../utils/date";

const KIND_LABELS: Record<SessionRecord["kind"], string> = {
  daily: "Session du jour",
  short: "Session courte",
  "mock-exam": "Test blanc complet",
  "weak-review": "Points faibles",
  custom: "Session",
};

export function HistoryScreen() {
  const [sessions, setSessions] = useState<SessionRecord[] | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [reviewsBySession, setReviewsBySession] = useState<Map<string, ReviewRecord[]>>(new Map());
  const [bank, setBank] = useState<Map<string, Question> | null>(null);

  useEffect(() => {
    void (async () => {
      const [all, questions] = await Promise.all([getAllSessions(), loadQuestionBank()]);
      const finished = all
        .filter((s) => s.finishedAt)
        .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
      setSessions(finished);
      setBank(new Map(questions.map((q) => [q.id, q])));
    })();
  }, []);

  async function toggle(sessionId: string) {
    if (expanded === sessionId) {
      setExpanded(null);
      return;
    }
    setExpanded(sessionId);
    if (!reviewsBySession.has(sessionId)) {
      const rs = await getReviewsForSession(sessionId);
      setReviewsBySession((m) => new Map(m).set(sessionId, rs));
    }
  }

  if (!sessions || !bank) {
    return (
      <div class="screen">
        <p class="text-muted">Chargement de l'historique…</p>
      </div>
    );
  }

  return (
    <div class="screen stack">
      <h1>Historique</h1>

      {sessions.length === 0 && <p class="text-muted">Aucune session terminée pour l'instant.</p>}

      <div class="stack">
        {sessions.map((s) => {
          const durationMs =
            s.finishedAt && s.startedAt
              ? new Date(s.finishedAt).getTime() - new Date(s.startedAt).getTime()
              : 0;
          const reviews = reviewsBySession.get(s.id);
          const correct = reviews?.filter((r) => r.correct).length ?? null;

          return (
            <div class="card stack" key={s.id}>
              <button
                class="row"
                style={{
                  justifyContent: "space-between",
                  background: "none",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                  color: "inherit",
                  font: "inherit",
                }}
                onClick={() => void toggle(s.id)}
              >
                <div>
                  <div>{KIND_LABELS[s.kind]}</div>
                  <div class="text-muted" style={{ fontSize: 12 }}>
                    {formatDateFr(s.startedAt)} · {formatDurationShort(durationMs / 1000)}
                  </div>
                </div>
                <div class="row">
                  {s.mockExamResult && <strong>{s.mockExamResult.projectedScore} / 600</strong>}
                  {!s.mockExamResult && correct !== null && (
                    <span class="badge badge-muted">
                      {correct}/{s.questionIds.length}
                    </span>
                  )}
                  <span
                    class="text-muted"
                    style={{
                      fontSize: 13,
                      transform: expanded === s.id ? "rotate(90deg)" : "none",
                      transition: "transform 0.15s ease",
                    }}
                    aria-hidden="true"
                  >
                    ›
                  </span>
                </div>
              </button>

              {expanded === s.id && reviews && (
                <div class="stack">
                  {reviews.map((r) => {
                    const q = bank.get(r.questionId);
                    return (
                      <div
                        class="row"
                        key={r.id}
                        style={{ justifyContent: "space-between", fontSize: 13 }}
                      >
                        <span style={{ flex: 1, whiteSpace: "pre-wrap" }}>
                          {q ? truncate(q.statement, 70) : r.questionId}
                        </span>
                        <span class={r.correct ? "badge badge-success" : "badge badge-danger"}>
                          {r.correct ? "✓" : "✗"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}
