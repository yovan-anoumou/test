import { useEffect, useRef, useState } from "preact/hooks";
import {
  buildDailySession,
  buildFicheSession,
  buildFocusedSession,
  buildTimeBoxedSession,
  buildWeakReviewSession,
  type CardMeta,
  type SessionPlan,
} from "../../domain/session-builder";
import {
  getDueReviewCards,
  getNewCards,
  getCardsByIds,
  getCard,
  putCard,
} from "../../db/repositories/cardsRepo";
import { addReview, getAllReviews } from "../../db/repositories/reviewsRepo";
import { createSession, updateSession } from "../../db/repositories/sessionsRepo";
import { getActivePlan } from "../../db/repositories/plansRepo";
import { loadQuestionBank, findSimilarQuestion } from "../../domain/questionBank";
import { getStrugglingQuestionIds } from "../../domain/scoring";
import { difficultyTargets } from "../../domain/adaptive-difficulty";
import { findFicheForQuestion } from "../../domain/fiches/links";
import { loadFiches, ficheById } from "../../domain/fiches/bank";
import type { Fiche } from "../../domain/fiches/types";
import { SKILL_AREAS, difficultyLabel, type SkillAreaId } from "../../domain/skills";
import type { Question } from "../../domain/question";
import type {
  CardRecord,
  PlanBlock,
  PracticeMode,
  ReviewRecord,
  SessionKindRecord,
  SessionRecord,
} from "../../db/schema";
import { rateCard, type UserRating, RATING_LABELS } from "../../fsrs/scheduler";
import { settings } from "../../store";
import { navigate, type SessionSpec } from "../../router";
import { newId } from "../../utils/id";
import { useElapsedMs, TimerBadge, formatMs } from "../../components/Timer";
import { SUBTESTS } from "../../domain/modules";

interface Props {
  spec: SessionSpec;
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
  focus: "Entraînement ciblé",
};

const LEARNING_BUDGET_SECONDS = 15 * 60;

function sessionKindFor(spec: SessionSpec): SessionKindRecord {
  switch (spec.kind) {
    case "daily":
      return "daily";
    case "short":
      return "short";
    case "weak-review":
      return "weak-review";
    case "learning":
      return "learning";
    case "focus":
      return "focus";
    case "plan":
      return "plan";
    case "fiche":
      return "focus";
    case "time":
      return "custom";
  }
}

function practiceModeFor(spec: SessionSpec): PracticeMode {
  return spec.kind === "learning" ? "learning" : "training";
}

function emptyMessageFor(spec: SessionSpec): string {
  if (spec.kind === "weak-review") {
    return "Aucune question marquée « Difficile » ou « À revoir » pour l'instant — continue comme ça !";
  }
  if (spec.kind === "fiche") {
    return "Aucune question de la banque ne porte encore exactement sur les notions de cette fiche. Entraîne-toi sur le domaine complet, ou ajoute tes propres questions dans les réglages.";
  }
  if (spec.kind === "learning" || spec.kind === "focus") {
    return "Plus de questions disponibles sur ce domaine pour le moment. Reviens après avoir révisé d'autres matières, ou ajoute tes propres questions dans les réglages.";
  }
  return "La banque de questions est encore en cours de chargement, ou tu as déjà tout traité pour aujourd'hui.";
}

export function SessionScreen({ spec }: Props) {
  const isLearning = spec.kind === "learning";

  const [phase, setPhase] = useState<Phase>("loading");
  const [plan, setPlan] = useState<SessionPlan | null>(null);
  const [questions, setQuestions] = useState<Map<string, Question> | null>(null);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [results, setResults] = useState<ResultRow[]>([]);
  const [hintShown, setHintShown] = useState(false);
  const [chainSimilar, setChainSimilar] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [headerLabel, setHeaderLabel] = useState<string>("Session");

  const sessionIdRef = useRef<string>(newId());
  const sessionStartedAtRef = useRef<string>(new Date().toISOString());
  const startRef = useRef<number>(performance.now());
  const planBlockRef = useRef<{ planId: string; block: PlanBlock } | null>(null);
  const bankRef = useRef<Question[]>([]);
  const fichesRef = useRef<Fiche[]>([]);
  const queuedIdsRef = useRef<Set<string>>(new Set());

  const specKey = JSON.stringify(spec);

  useEffect(() => {
    let cancelled = false;

    // Le composant n'est pas démonté quand on passe d'une session à une autre
    // (retour navigateur entre deux #/session/...) : on repart d'un état propre,
    // sinon l'index resterait sur l'ancienne file et la session réécrirait
    // l'enregistrement précédent.
    setPhase("loading");
    setPlan(null);
    setQuestions(null);
    setIndex(0);
    setSelected(null);
    setResults([]);
    setHintShown(false);
    setChainSimilar(false);
    setNotice(null);
    planBlockRef.current = null;
    queuedIdsRef.current = new Set();
    sessionIdRef.current = newId();
    sessionStartedAtRef.current = new Date().toISOString();

    void (async () => {
      // Les fiches servent au renvoi « revoir la règle » après une erreur : leur
      // échec de chargement ne doit jamais empêcher la session de démarrer.
      const [bank, fiches] = await Promise.all([
        loadQuestionBank(),
        loadFiches().catch(() => [] as Fiche[]),
      ]);
      if (cancelled) return;
      bankRef.current = bank;
      fichesRef.current = fiches;
      const qMap = new Map(bank.map((q) => [q.id, q]));
      const meta = (card: CardRecord): CardMeta => {
        const question = qMap.get(card.questionId);
        return {
          targetTimeSeconds: question?.targetTimeSeconds ?? 60,
          difficulty: question?.difficulty ?? 3,
        };
      };

      const [due, fresh, reviews] = await Promise.all([
        getDueReviewCards(),
        getNewCards(),
        getAllReviews(),
      ]);
      if (cancelled) return;

      const targets = difficultyTargets(
        reviews,
        Array.from(new Set([...due, ...fresh].map((c) => c.subtest))),
      );

      let rawPlan: SessionPlan;
      let label = "Session";

      if (spec.kind === "weak-review") {
        const cards = await getCardsByIds(getStrugglingQuestionIds(reviews));
        rawPlan = buildWeakReviewSession(cards, meta);
        label = "Points faibles";
      } else if (spec.kind === "plan") {
        const activePlan = await getActivePlan();
        const block = activePlan?.week
          .flatMap((day) => day.blocks)
          .find((b) => b.id === spec.blockId);
        if (!activePlan || !block) {
          if (!cancelled) setPhase("empty");
          return;
        }
        planBlockRef.current = { planId: activePlan.id, block };
        label = block.label;
        const budget = block.minutes * 60;
        if (block.kind === "error-review") {
          const cards = await getCardsByIds(getStrugglingQuestionIds(reviews));
          rawPlan =
            cards.length > 0
              ? buildWeakReviewSession(cards, meta, budget)
              : buildDailySession(due, fresh, meta, "short", targets);
        } else if (block.kind === "area" && block.area) {
          rawPlan = buildFocusedSession(
            due,
            fresh,
            SKILL_AREAS[block.area].subtests,
            budget,
            meta,
            targets,
          );
        } else {
          rawPlan = buildDailySession(due, fresh, meta, budget > 15 * 60 ? "daily" : "short", targets);
        }
      } else if (spec.kind === "focus") {
        rawPlan = buildFocusedSession(
          due,
          fresh,
          SKILL_AREAS[spec.area].subtests,
          spec.minutes * 60,
          meta,
          targets,
        );
        label = SKILL_AREAS[spec.area].label;
      } else if (spec.kind === "learning") {
        const subtests = spec.area
          ? SKILL_AREAS[spec.area].subtests
          : Object.keys(SUBTESTS).map((s) => s as CardRecord["subtest"]);
        rawPlan = buildFocusedSession(
          due,
          fresh,
          subtests,
          LEARNING_BUDGET_SECONDS,
          meta,
          targets,
          "learning",
        );
        label = spec.area ? `Apprentissage — ${SKILL_AREAS[spec.area].label}` : "Apprentissage";
      } else if (spec.kind === "fiche") {
        const fiche = ficheById(fiches, spec.ficheId);
        if (!fiche) {
          if (!cancelled) setPhase("empty");
          return;
        }
        const ficheTags = new Set(fiche.tags);
        const allowed = new Set(
          bank.filter((q) => q.tags.some((t) => ficheTags.has(t))).map((q) => q.id),
        );
        const options =
          spec.variant === "quick"
            ? { budgetSeconds: 2 * 60, maxItems: 1, difficultyOrder: "asc" as const }
            : spec.variant === "hard"
              ? { budgetSeconds: 6 * 60, maxItems: 3, difficultyOrder: "desc" as const }
              : { budgetSeconds: 8 * 60, maxItems: 8 };
        rawPlan = buildFicheSession(due, fresh, allowed, meta, options);
        label =
          spec.variant === "quick"
            ? `Question rapide — ${fiche.title}`
            : spec.variant === "hard"
              ? `Niveau concours — ${fiche.title}`
              : `Test — ${fiche.title}`;
      } else if (spec.kind === "time") {
        rawPlan = buildTimeBoxedSession(
          due,
          fresh,
          new Set(getStrugglingQuestionIds(reviews)),
          spec.minutes * 60,
          meta,
          targets,
        );
        label = `${spec.minutes} minutes`;
      } else {
        rawPlan = buildDailySession(due, fresh, meta, spec.kind, targets);
        label = spec.kind === "short" ? "Session courte" : "Session du jour";
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

      queuedIdsRef.current = new Set(builtPlan.items.map((i) => i.card.questionId));

      await createSession({
        id: sessionIdRef.current,
        kind: sessionKindFor(spec),
        startedAt: sessionStartedAtRef.current,
        finishedAt: null,
        questionIds: builtPlan.items.map((i) => i.card.questionId),
        mockExamResult: null,
        mode: practiceModeFor(spec),
        areaId: areaOfSpec(spec, planBlockRef.current?.block ?? null),
        planId: planBlockRef.current?.planId ?? null,
        planBlockId: planBlockRef.current?.block.id ?? null,
      } satisfies SessionRecord);

      setQuestions(qMap);
      setPlan(builtPlan);
      setHeaderLabel(label);
      startRef.current = performance.now();
      setPhase("answering");
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [specKey]);

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
        <p class="text-muted">{emptyMessageFor(spec)}</p>
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
            <span>{isLearning ? "Questions travaillées" : "Score"}</span>
            <strong>
              {correct} / {total} ({total > 0 ? Math.round((correct / total) * 100) : 0} %)
            </strong>
          </div>
          {isLearning && (
            <p class="text-muted" style={{ margin: 0, fontSize: 13 }}>
              En mode apprentissage, le temps passé n'entre pas dans tes statistiques de vitesse.
            </p>
          )}
        </div>
        <button class="btn btn-primary btn-block" onClick={() => navigate({ name: "home" })}>
          Retour à l'accueil
        </button>
        <button class="btn btn-secondary btn-block" onClick={() => navigate({ name: "dashboard" })}>
          Voir ma progression
        </button>
      </div>
    );
  }

  if (!plan || !questions) return null;

  const item = plan.items[index];
  const question = questions.get(item.card.questionId)!;
  const answeredWrong = phase === "revealed" && selected !== question.correctIndex;
  // La fiche correspondante est proposée en apprentissage (toujours) et dans les
  // autres modes uniquement après une erreur : c'est là qu'elle sert.
  const fiche =
    isLearning || answeredWrong
      ? findFicheForQuestion(fichesRef.current, question.subtest, question.tags)
      : undefined;

  function handleSelect(choiceIndex: number) {
    if (phase !== "answering") return;
    setSelected(choiceIndex);
    setPhase("revealed");
  }

  async function handleRate(rating: UserRating) {
    if (!plan || !questions || selected === null) return;
    const responseTimeMs = performance.now() - startRef.current;
    const correct = selected === question.correctIndex;

    const review: ReviewRecord = {
      id: newId(),
      questionId: item.card.questionId,
      module: item.card.module,
      subtest: item.card.subtest,
      timestamp: new Date().toISOString(),
      rating: ratingToNumber(rating),
      correct,
      responseTimeMs,
      targetTimeSeconds: question.targetTimeSeconds,
      difficulty: question.difficulty,
      sessionId: sessionIdRef.current,
      sessionKind: sessionKindFor(spec),
      mode: practiceModeFor(spec),
      selectedIndex: selected,
      planBlockId: planBlockRef.current?.block.id ?? null,
    };
    await addReview(review);

    const nextCard = rateCard(item.card, rating, settings.value.retentionTarget);
    await putCard(nextCard);

    setResults((r) => [...r, { correct, rating, subtest: SUBTESTS[item.card.subtest].label }]);

    // Boucle d'apprentissage : erreur → explication → question similaire → nouvel essai.
    const wantsSimilar = isLearning && (!correct || chainSimilar);
    const inserted = wantsSimilar ? await queueSimilarQuestion() : false;
    setNotice(
      inserted
        ? correct
          ? "Question similaire ajoutée à la suite."
          : "Tu viens de te tromper : une question du même type arrive juste après pour réessayer."
        : null,
    );

    advanceOrFinish(plan.items.length + (inserted ? 1 : 0));
  }

  /** Insère une question du même type juste après la question courante. */
  async function queueSimilarQuestion(): Promise<boolean> {
    const similar = findSimilarQuestion(bankRef.current, question, queuedIdsRef.current);
    if (!similar) return false;
    const card = await getCard(similar.id);
    if (!card) return false;

    queuedIdsRef.current.add(similar.id);
    setPlan((current) => {
      if (!current) return current;
      const items = [...current.items];
      items.splice(index + 1, 0, { card, phase: item.phase });
      return { ...current, items };
    });
    return true;
  }

  /**
   * `totalItems` est passé explicitement car la file peut venir de grandir
   * (question similaire insérée) et l'état React n'est pas encore à jour.
   */
  function advanceOrFinish(totalItems: number) {
    if (index + 1 >= totalItems) {
      void updateSession({
        id: sessionIdRef.current,
        kind: sessionKindFor(spec),
        startedAt: sessionStartedAtRef.current,
        finishedAt: new Date().toISOString(),
        questionIds: Array.from(queuedIdsRef.current),
        mockExamResult: null,
        mode: practiceModeFor(spec),
        areaId: areaOfSpec(spec, planBlockRef.current?.block ?? null),
        planId: planBlockRef.current?.planId ?? null,
        planBlockId: planBlockRef.current?.block.id ?? null,
      });
      setPhase("finished");
      return;
    }
    setIndex((i) => i + 1);
    setSelected(null);
    setHintShown(false);
    setChainSimilar(false);
    startRef.current = performance.now();
    setPhase("answering");
  }

  const suggestedRating: UserRating = selected === question.correctIndex ? "good" : "again";

  return (
    <div class="screen stack">
      <div class="row" style={{ justifyContent: "space-between" }}>
        <span class="badge badge-muted">
          {spec.kind === "learning" || spec.kind === "fiche" || spec.kind === "time"
            ? headerLabel
            : PHASE_LABELS[item.phase]}
        </span>
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

      {notice && (
        <div class="fiche-callout fiche-callout-mnemonic" style={{ padding: 12 }}>
          <span class="fiche-callout-icon" aria-hidden="true">
            🔁
          </span>
          <p style={{ margin: 0, fontSize: 14 }}>{notice}</p>
        </div>
      )}

      <div class="card stack">
        <div class="row" style={{ justifyContent: "space-between" }}>
          <span class="row" style={{ gap: 6 }}>
            <span class="badge badge-muted">{SUBTESTS[question.subtest].label}</span>
            <span class="badge badge-muted">{difficultyLabel(question.difficulty)}</span>
          </span>
          {isLearning ? (
            <span class="text-muted" style={{ fontSize: 13 }}>
              Sans chrono · {formatMs(elapsedMs)}
            </span>
          ) : (
            <TimerBadge elapsedMs={elapsedMs} targetSeconds={question.targetTimeSeconds} />
          )}
        </div>

        {question.passage && (
          <div class="card" style={{ background: "var(--color-surface-2)", whiteSpace: "pre-wrap" }}>
            {question.passage}
          </div>
        )}

        <p style={{ whiteSpace: "pre-wrap", fontSize: 16, fontWeight: 600 }}>{question.statement}</p>

        {isLearning && phase === "answering" && (
          <div>
            {hintShown ? (
              <div class="fiche-callout fiche-callout-mnemonic">
                <span class="fiche-callout-icon" aria-hidden="true">
                  💡
                </span>
                <div>
                  <strong>Indice — la méthode</strong>
                  <p style={{ margin: "4px 0 0" }}>{question.explanation.method}</p>
                </div>
              </div>
            ) : (
              <button
                class="btn btn-secondary"
                style={{ padding: "8px 14px", fontSize: 14 }}
                onClick={() => setHintShown(true)}
              >
                Voir un indice
              </button>
            )}
          </div>
        )}

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
            {fiche && (
              <button
                class="btn btn-secondary btn-block"
                onClick={() => navigate({ name: "fiche", id: fiche.id })}
              >
                📖 {answeredWrong && !isLearning ? "Revoir la règle" : "Revoir la fiche"} : {fiche.title}
              </button>
            )}
            {isLearning && selected === question.correctIndex && (
              <button
                class={`btn ${chainSimilar ? "btn-primary" : "btn-secondary"} btn-block`}
                onClick={() => setChainSimilar((v) => !v)}
              >
                {chainSimilar ? "✓ Question similaire à la suite" : "Enchaîner sur une question similaire"}
              </button>
            )}
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

function areaOfSpec(spec: SessionSpec, block: PlanBlock | null): SkillAreaId | null {
  if (spec.kind === "focus") return spec.area;
  if (spec.kind === "learning") return spec.area;
  if (spec.kind === "plan") return block?.area ?? null;
  return null;
}

function ratingToNumber(r: UserRating): 1 | 2 | 3 | 4 {
  return { again: 1, hard: 2, good: 3, easy: 4 }[r] as 1 | 2 | 3 | 4;
}
