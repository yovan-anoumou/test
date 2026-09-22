import { useEffect, useRef, useState } from "preact/hooks";
import {
  buildDailySession,
  buildWeakReviewSession,
  type SessionKind,
  type SessionPlan,
} from "../../domain/session-builder";
import { getDueReviewCards, getNewCards, getCardsByIds, putCard } from "../../db/repositories/cardsRepo";
import { addReview, getAllReviews } from "../../db/repositories/reviewsRepo";
import { createSession, updateSession } from "../../db/repositories/sessionsRepo";
import { loadQuestionBank } from "../../domain/questionBank";
import { getStrugglingQuestionIds } from "../../domain/scoring";
import type { Question } from "../../domain/question";
import type { CardRecord, ReviewRecord, SessionRecord } from "../../db/schema";
import { rateCard, type UserRating, RATING_LABELS } from "../../fsrs/scheduler";
import { settings } from "../../store";
import { navigate } from "../../router";
import { newId } from "../../utils/id";
import { useElapsedMs, TimerBadge } from "../../components/Timer";
import { SUBTESTS } from "../../domain/modules";

interface Props {
  mode: SessionKind;
}

type Phase = "loading" | "answering" | "revealed" | "finished" | "empty";

interface ResultRow {
  correct: boolean;
  rating: UserRating;
  subtest: string;
}

const PHASE_LABELS: Record<SessionPlan["items"][number]["phase"], string> = {
  warmup: "Échauffement — calcul mental",
  "due-mix": "Révision",
  "new-content": "Nouveau contenu",
  "weak-review": "Points faibles",
};

const EMPTY_MESSAGES: Record<SessionKind, string> = {
  daily: "La banque de questions est encore en cours de chargement, ou tu as déjà tout traité pour aujourd'hui.",
  short: "La banque de questions est encore en cours de chargement, ou tu as déjà tout traité pour aujourd'hui.",
  "weak-review":
    "Aucune question marquée « Difficile » ou « À revoir » pour l'instant — continue comme ça !",
};

export function SessionScreen({ mode }: Props) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [plan, setPlan] = useState<SessionPlan | null>(null);
  const [questions, setQuestions] = useState<Map<string, Question> | null>(null);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [results, setResults] = useState<ResultRow[]>([]);
  const sessionIdRef = useRef<string>(newId());
  const sessionStartedAtRef = useRef<string>(new Date().toISOString());
  const startRef = useRef<number>(performance.now());

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const bank = await loadQuestionBank();
      if (cancelled) return;
      const qMap = new Map(bank.map((q) => [q.id, q]));
      const targetTime = (card: CardRecord) => qMap.get(card.questionId)?.targetTimeSeconds ?? 60;

      let rawPlan: SessionPlan;
      if (mode === "weak-review") {
        const reviews = await getAllReviews();
        const strugglingIds = getStrugglingQuestionIds(reviews);
        const cards = await getCardsByIds(strugglingIds);
        rawPlan = buildWeakReviewSession(cards, targetTime);
      } else {
        const [due, fresh] = await Promise.all([getDueReviewCards(), getNewCards()]);
        rawPlan = buildDailySession(due, fresh, targetTime, mode);
      }
      if (cancelled) return;

      // Sécurité : ignore les cartes dont la question n'existe plus dans la banque actuelle.
      const builtPlan: SessionPlan = {
        ...rawPlan,
        items: rawPlan.items.filter((i) => qMap.has(i.card.questionId)),
      };

      if (builtPlan.items.length === 0) {
        setPhase("empty");
        return;
      }

      await createSession({
        id: sessionIdRef.current,
        kind: mode,
        startedAt: sessionStartedAtRef.current,
        finishedAt: null,
        questionIds: builtPlan.items.map((i) => i.card.questionId),
        mockExamResult: null,
      } satisfies SessionRecord);

      setQuestions(qMap);
      setPlan(builtPlan);
      startRef.current = performance.now();
      setPhase("answering");
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const elapsedMs = useElapsedMs(phase === "answering", index);

  if (phase === "loading") {
    return (
      <div class="screen">
        <p class="text-muted">Préparation de la session…</p>
      </div>
    );
  }

  if (phase === "empty") {
    return (
      <div class="screen stack">
        <h2>Rien à réviser pour l'instant</h2>
        <p class="text-muted">{EMPTY_MESSAGES[mode]}</p>
        <button class="btn btn-primary btn-block" onClick={() => navigate({ name: "home" })}>
          Retour à l'accueil
        </button>
      </div>
    );
  }

  if (phase === "finished") {
    const total = results.length;
    const correct = results.filter((r) => r.correct).length;
    return (
      <div class="screen stack">
        <h2>Session terminée</h2>
        <div class="card stack">
          <div class="row" style={{ justifyContent: "space-between" }}>
            <span>Score</span>
            <strong>
              {correct} / {total} ({total > 0 ? Math.round((correct / total) * 100) : 0}%)
            </strong>
          </div>
        </div>
        <button class="btn btn-primary btn-block" onClick={() => navigate({ name: "dashboard" })}>
          Voir le tableau de bord
        </button>
        <button class="btn btn-secondary btn-block" onClick={() => navigate({ name: "home" })}>
          Retour à l'accueil
        </button>
      </div>
    );
  }

  if (!plan || !questions) return null;

  const item = plan.items[index];
  const question = questions.get(item.card.questionId)!;

  function handleSelect(choiceIndex: number) {
    if (phase !== "answering") return;
    setSelected(choiceIndex);
    setPhase("revealed");
  }

  async function handleRate(rating: UserRating) {
    if (!plan || !questions || selected === null) return;
    const responseTimeMs = performance.now() - startRef.current;
    const correct = selected === question!.correctIndex;

    const review: ReviewRecord = {
      id: newId(),
      questionId: item.card.questionId,
      module: item.card.module,
      subtest: item.card.subtest,
      timestamp: new Date().toISOString(),
      rating: ratingToNumber(rating),
      correct,
      responseTimeMs,
      targetTimeSeconds: question!.targetTimeSeconds,
      difficulty: question!.difficulty,
      sessionId: sessionIdRef.current,
      sessionKind: mode,
    };
    await addReview(review);

    const nextCard = rateCard(item.card, rating, settings.value.retentionTarget);
    await putCard(nextCard);

    setResults((r) => [...r, { correct, rating, subtest: SUBTESTS[item.card.subtest].label }]);
    advanceOrFinish();
  }

  function advanceOrFinish() {
    if (!plan) return;
    if (index + 1 >= plan.items.length) {
      void updateSession({
        id: sessionIdRef.current,
        kind: mode,
        startedAt: sessionStartedAtRef.current,
        finishedAt: new Date().toISOString(),
        questionIds: plan.items.map((i) => i.card.questionId),
        mockExamResult: null,
      });
      setPhase("finished");
      return;
    }
    setIndex((i) => i + 1);
    setSelected(null);
    startRef.current = performance.now();
    setPhase("answering");
  }

  const suggestedRating: UserRating =
    selected === question.correctIndex ? "good" : "again";

  return (
    <div class="screen stack">
      <div class="row" style={{ justifyContent: "space-between" }}>
        <span class="badge badge-muted">{PHASE_LABELS[item.phase]}</span>
        <span class="text-muted" style={{ fontSize: 13 }}>
          {index + 1} / {plan.items.length}
        </span>
      </div>
      <div class="progress-bar">
        <div
          class="progress-bar-fill"
          style={{ width: `${((index + 1) / plan.items.length) * 100}%` }}
        />
      </div>

      <div class="card stack">
        <div class="row" style={{ justifyContent: "space-between" }}>
          <span class="badge badge-muted">{SUBTESTS[question.subtest].label}</span>
          <TimerBadge elapsedMs={elapsedMs} targetSeconds={question.targetTimeSeconds} />
        </div>

        {question.passage && (
          <div class="card" style={{ background: "var(--color-surface-2)", whiteSpace: "pre-wrap" }}>
            {question.passage}
          </div>
        )}

        <p style={{ whiteSpace: "pre-wrap", fontSize: 16, fontWeight: 600 }}>{question.statement}</p>

        <div class="list">
          {question.choices.map((choice, i) => {
            const isCorrect = i === question.correctIndex;
            const isSelected = i === selected;
            let variant = "";
            if (phase === "revealed") {
              if (isCorrect) variant = "choice-correct";
              else if (isSelected) variant = "choice-incorrect";
            }
            return (
              <button
                key={i}
                class={`list-row choice-btn ${variant}`}
                disabled={phase === "revealed"}
                onClick={() => handleSelect(i)}
              >
                <span style={{ whiteSpace: "pre-wrap" }}>{choice}</span>
                {phase === "revealed" && question.explanation.why_others_wrong[i] && (
                  <span class="choice-explanation">{question.explanation.why_others_wrong[i]}</span>
                )}
              </button>
            );
          })}
        </div>

        {phase === "revealed" && (
          <div class="stack">
            <div class="card" style={{ background: "var(--color-success-bg)" }}>
              <strong>Pourquoi c'est la bonne réponse</strong>
              <p style={{ margin: "4px 0 0" }}>{question.explanation.why_correct}</p>
            </div>
            <div class="card" style={{ background: "var(--color-surface-2)" }}>
              <strong>Méthode</strong>
              <p style={{ margin: "4px 0 0" }}>{question.explanation.method}</p>
            </div>
          </div>
        )}
      </div>

      {phase === "revealed" && (
        <div class="stack">
          <p class="text-muted" style={{ fontSize: 13, margin: 0 }}>
            Comment as-tu trouvé cette question ?
          </p>
          <div class="rating-row">
            {(["again", "hard", "good", "easy"] as UserRating[]).map((r) => (
              <button
                key={r}
                class={`btn rating-btn rating-${r}${r === suggestedRating ? " suggested" : ""}`}
                onClick={() => void handleRate(r)}
              >
                {RATING_LABELS[r]}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ratingToNumber(r: UserRating): 1 | 2 | 3 | 4 {
  return { again: 1, hard: 2, good: 3, easy: 4 }[r] as 1 | 2 | 3 | 4;
}
