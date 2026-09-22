import { useEffect, useRef, useState } from "preact/hooks";
import {
  DEFAULT_QUESTIONS_PER_AREA,
  finalizeDiagnostic,
  initDiagnostic,
  nextDiagnosticQuestion,
  recordDiagnosticAnswer,
  totalQuestions,
  type DiagnosticState,
} from "../../domain/diagnostic";
import { loadQuestionBank } from "../../domain/questionBank";
import type { Question } from "../../domain/question";
import type { DiagnosticRecord, TrainingPlanRecord } from "../../db/schema";
import { OBJECTIVES, SKILL_AREAS, type ObjectiveId, type SkillAreaId } from "../../domain/skills";
import { identifyPriorityWeaknesses } from "../../domain/skill-analysis";
import {
  DAY_SHORT,
  DURATION_OPTIONS,
  MINUTES_OPTIONS,
  defaultRestDays,
  generatePlan,
  weeksBetween,
} from "../../domain/plan";
import { saveDiagnostic } from "../../db/repositories/diagnosticsRepo";
import { activatePlan } from "../../db/repositories/plansRepo";
import { getCard, putCard } from "../../db/repositories/cardsRepo";
import { addReview } from "../../db/repositories/reviewsRepo";
import { createSession, updateSession } from "../../db/repositories/sessionsRepo";
import { rateCard } from "../../fsrs/scheduler";
import { settings, patchSettings } from "../../store";
import { navigate } from "../../router";
import { newId } from "../../utils/id";
import { AreaResultCard } from "./AreaResultCard";
import { MasteryBar } from "../../components/MasteryBar";

type Step = "intro" | "objective" | "deadline" | "time" | "test" | "analysis";

const STEP_ORDER: Step[] = ["intro", "objective", "deadline", "time", "test", "analysis"];

export function DiagnosticScreen() {
  const [step, setStep] = useState<Step>("intro");
  const [objective, setObjective] = useState<ObjectiveId>("tage2");
  const [durationWeeks, setDurationWeeks] = useState(26);
  const [targetDate, setTargetDate] = useState<string | null>(null);
  const [minutesPerDay, setMinutesPerDay] = useState(25);
  const [daysPerWeek, setDaysPerWeek] = useState(6);

  const [bank, setBank] = useState<Question[] | null>(null);
  const [state, setState] = useState<DiagnosticState | null>(null);
  const [current, setCurrent] = useState<{ question: Question; area: SkillAreaId } | null>(null);
  const [result, setResult] = useState<DiagnosticRecord | null>(null);
  const [plan, setPlan] = useState<TrainingPlanRecord | null>(null);
  const [busy, setBusy] = useState(false);

  const questionStartRef = useRef<number>(performance.now());
  const sessionIdRef = useRef<string>(newId());

  useEffect(() => {
    void loadQuestionBank().then(setBank);
  }, []);

  function goTo(next: Step) {
    setStep(next);
  }

  async function startTest() {
    if (!bank) return;
    const fresh = initDiagnostic(objective, DEFAULT_QUESTIONS_PER_AREA);
    const first = nextDiagnosticQuestion(fresh, bank);
    if (!first) return;
    await createSession({
      id: sessionIdRef.current,
      kind: "diagnostic",
      startedAt: new Date().toISOString(),
      finishedAt: null,
      questionIds: [],
      mockExamResult: null,
      mode: "diagnostic",
      areaId: null,
      planId: null,
      planBlockId: null,
    });
    setState(fresh);
    setCurrent(first);
    questionStartRef.current = performance.now();
    goTo("test");
  }

  /** Une réponse du diagnostic compte comme une vraie réponse : elle alimente
   *  l'historique et la répétition espacée, pas seulement le score du test. */
  async function persistAnswer(question: Question, selectedIndex: number, responseTimeMs: number) {
    const correct = selectedIndex === question.correctIndex;
    await addReview({
      id: newId(),
      questionId: question.id,
      module: question.module,
      subtest: question.subtest,
      timestamp: new Date().toISOString(),
      rating: correct ? 3 : 1,
      correct,
      responseTimeMs,
      targetTimeSeconds: question.targetTimeSeconds,
      difficulty: question.difficulty,
      sessionId: sessionIdRef.current,
      sessionKind: "diagnostic",
      mode: "diagnostic",
      selectedIndex,
      planBlockId: null,
    });
    const card = await getCard(question.id);
    if (card) {
      await putCard(rateCard(card, correct ? "good" : "again", settings.value.retentionTarget));
    }
  }

  async function answer(selectedIndex: number) {
    if (!state || !current || !bank || busy) return;
    setBusy(true);
    const responseTimeMs = performance.now() - questionStartRef.current;

    await persistAnswer(current.question, selectedIndex, responseTimeMs);

    const nextState = recordDiagnosticAnswer(
      state,
      current.question,
      current.area,
      selectedIndex,
      responseTimeMs,
    );
    setState(nextState);

    const next = nextDiagnosticQuestion(nextState, bank);
    if (next) {
      setCurrent(next);
      questionStartRef.current = performance.now();
      setBusy(false);
      return;
    }

    await finishTest(nextState);
    setBusy(false);
  }

  async function finishTest(finalState: DiagnosticState) {
    if (!bank) return;
    const record = finalizeDiagnostic(finalState, bank);
    await saveDiagnostic(record);
    await updateSession({
      id: sessionIdRef.current,
      kind: "diagnostic",
      startedAt: record.startedAt,
      finishedAt: record.finishedAt,
      questionIds: record.answers.map((a) => a.questionId),
      mockExamResult: null,
      mode: "diagnostic",
      areaId: null,
      planId: null,
      planBlockId: null,
    });

    const generated = generatePlan(
      {
        objective,
        durationWeeks,
        targetDate,
        minutesPerDay,
        daysPerWeek,
        restDays: defaultRestDays(daysPerWeek),
        diagnosticId: record.id,
      },
      record.areas,
    );
    await activatePlan(generated);
    await patchSettings({ lastDiagnosticId: record.id, activePlanId: generated.id });

    setResult(record);
    setPlan(generated);
    setCurrent(null);
    goTo("analysis");
  }

  const stepIndex = STEP_ORDER.indexOf(step);

  return (
    <div class="screen stack">
      {step !== "analysis" && (
        <>
          <div class="row" style={{ justifyContent: "space-between" }}>
            <button
              class="text-muted"
              style={{ background: "none", border: "none", padding: 0, fontSize: 15, cursor: "pointer" }}
              onClick={() => navigate({ name: "home" })}
            >
              ‹ Accueil
            </button>
            <span class="text-muted" style={{ fontSize: 13 }}>
              Étape {Math.min(stepIndex + 1, 5)} / 5
            </span>
          </div>
          <div class="progress-bar">
            <div class="progress-bar-fill" style={{ width: `${((stepIndex + 1) / 5) * 100}%` }} />
          </div>
        </>
      )}

      {step === "intro" && (
        <IntroStep
          questionCount={DEFAULT_QUESTIONS_PER_AREA * Object.keys(SKILL_AREAS).length}
          ready={bank !== null}
          onNext={() => goTo("objective")}
        />
      )}

      {step === "objective" && (
        <ObjectiveStep value={objective} onChange={setObjective} onNext={() => goTo("deadline")} />
      )}

      {step === "deadline" && (
        <DeadlineStep
          durationWeeks={durationWeeks}
          targetDate={targetDate}
          onChange={(weeks, date) => {
            setDurationWeeks(weeks);
            setTargetDate(date);
          }}
          onNext={() => goTo("time")}
        />
      )}

      {step === "time" && (
        <TimeStep
          minutesPerDay={minutesPerDay}
          daysPerWeek={daysPerWeek}
          onChangeMinutes={setMinutesPerDay}
          onChangeDays={setDaysPerWeek}
          onNext={() => void startTest()}
        />
      )}

      {step === "test" && state && current && (
        <TestStep
          state={state}
          question={current.question}
          area={current.area}
          busy={busy}
          onAnswer={(i) => void answer(i)}
        />
      )}

      {step === "analysis" && result && (
        <AnalysisStep result={result} plan={plan} />
      )}
    </div>
  );
}

function IntroStep({
  questionCount,
  ready,
  onNext,
}: {
  questionCount: number;
  ready: boolean;
  onNext: () => void;
}) {
  return (
    <div class="stack">
      <h1>Test de niveau</h1>
      <p class="text-muted">
        {questionCount} questions, environ 20 minutes. La difficulté s'adapte à tes réponses : plus
        tu réussis, plus les questions montent en niveau.
      </p>
      <div class="card stack" style={{ gap: 8 }}>
        <h3 style={{ margin: 0 }}>Ce qu'on mesure</h3>
        <p style={{ margin: 0, fontSize: 14 }}>
          <strong>Ta précision</strong> — est-ce que tu trouves la bonne réponse ?
        </p>
        <p style={{ margin: 0, fontSize: 14 }}>
          <strong>Ta vitesse</strong> — en combien de temps ? Les deux sont notés séparément, parce
          que 80 % en prenant tout son temps ne vaut pas 80 % au rythme du concours.
        </p>
      </div>
      <div class="card stack" style={{ gap: 6 }}>
        <h3 style={{ margin: 0 }}>Ensuite</h3>
        <p style={{ margin: 0, fontSize: 14 }}>
          Tu obtiens ton niveau par domaine, tes points faibles précis, et un plan d'entraînement
          construit sur mesure à partir de tes résultats et du temps dont tu disposes.
        </p>
      </div>
      <button class="btn btn-primary btn-block" disabled={!ready} onClick={onNext}>
        {ready ? "Commencer" : "Chargement…"}
      </button>
    </div>
  );
}

function ObjectiveStep({
  value,
  onChange,
  onNext,
}: {
  value: ObjectiveId;
  onChange: (v: ObjectiveId) => void;
  onNext: () => void;
}) {
  return (
    <div class="stack">
      <h1>Quel est ton objectif ?</h1>
      <div class="list">
        {OBJECTIVES.map((o) => (
          <button key={o.id} class="list-row" onClick={() => onChange(o.id)}>
            <span class="stack" style={{ gap: 1 }}>
              <span style={{ fontWeight: 600 }}>{o.label}</span>
              <span class="text-muted" style={{ fontSize: 12.5 }}>
                {o.detail}
              </span>
            </span>
            <span style={{ color: value === o.id ? "var(--color-accent)" : "transparent" }}>✓</span>
          </button>
        ))}
      </div>
      <button class="btn btn-primary btn-block" onClick={onNext}>
        Continuer
      </button>
    </div>
  );
}

function DeadlineStep({
  durationWeeks,
  targetDate,
  onChange,
  onNext,
}: {
  durationWeeks: number;
  targetDate: string | null;
  onChange: (weeks: number, date: string | null) => void;
  onNext: () => void;
}) {
  return (
    <div class="stack">
      <h1>Quand veux-tu être prêt ?</h1>
      <div class="list">
        {DURATION_OPTIONS.map((option) => (
          <button
            key={option.weeks}
            class="list-row"
            onClick={() => {
              const date = new Date(Date.now() + option.weeks * 7 * 86_400_000);
              onChange(option.weeks, date.toISOString().slice(0, 10));
            }}
          >
            <span>{option.label}</span>
            <span
              style={{
                color:
                  durationWeeks === option.weeks && targetDate ? "var(--color-accent)" : "transparent",
              }}
            >
              ✓
            </span>
          </button>
        ))}
      </div>
      <div class="card stack" style={{ gap: 8 }}>
        <span style={{ fontWeight: 600 }}>Ou une date précise</span>
        <input
          type="date"
          value={targetDate ?? ""}
          style={{
            padding: 12,
            borderRadius: "var(--radius-sm)",
            border: "0.5px solid var(--color-border)",
            background: "var(--color-surface-2)",
            color: "var(--color-text)",
            fontSize: 16,
            fontFamily: "inherit",
          }}
          onInput={(e) => {
            const value = (e.target as HTMLInputElement).value;
            if (!value) return;
            onChange(weeksBetween(new Date(), new Date(value)), value);
          }}
        />
        {targetDate && (
          <span class="text-muted" style={{ fontSize: 13 }}>
            Soit environ {durationWeeks} semaine{durationWeeks > 1 ? "s" : ""} de préparation.
          </span>
        )}
      </div>
      <button class="btn btn-primary btn-block" onClick={onNext}>
        Continuer
      </button>
    </div>
  );
}

function TimeStep({
  minutesPerDay,
  daysPerWeek,
  onChangeMinutes,
  onChangeDays,
  onNext,
}: {
  minutesPerDay: number;
  daysPerWeek: number;
  onChangeMinutes: (v: number) => void;
  onChangeDays: (v: number) => void;
  onNext: () => void;
}) {
  const restDays = defaultRestDays(daysPerWeek);
  return (
    <div class="stack">
      <h1>Combien de temps par jour ?</h1>
      <div class="card stack">
        <span style={{ fontWeight: 600 }}>Temps quotidien</span>
        <div class="row" style={{ flexWrap: "wrap", gap: 8 }}>
          {MINUTES_OPTIONS.map((m) => (
            <button
              key={m}
              class={`btn ${minutesPerDay === m ? "btn-primary" : "btn-secondary"}`}
              style={{ padding: "10px 16px", fontSize: 15 }}
              onClick={() => onChangeMinutes(m)}
            >
              {m} min
            </button>
          ))}
        </div>
        <label class="stack" style={{ gap: 4 }}>
          <span class="text-muted" style={{ fontSize: 13 }}>
            Ou personnalisé : {minutesPerDay} min
          </span>
          <input
            type="range"
            min={5}
            max={120}
            step={5}
            value={minutesPerDay}
            onInput={(e) => onChangeMinutes(Number((e.target as HTMLInputElement).value))}
          />
        </label>
      </div>

      <div class="card stack">
        <span style={{ fontWeight: 600 }}>Jours par semaine</span>
        <div class="row" style={{ flexWrap: "wrap", gap: 8 }}>
          {[3, 4, 5, 6, 7].map((d) => (
            <button
              key={d}
              class={`btn ${daysPerWeek === d ? "btn-primary" : "btn-secondary"}`}
              style={{ padding: "10px 16px", fontSize: 15 }}
              onClick={() => onChangeDays(d)}
            >
              {d}
            </button>
          ))}
        </div>
        <span class="text-muted" style={{ fontSize: 13 }}>
          {restDays.length > 0
            ? `Repos : ${restDays.map((d) => DAY_SHORT[d]).join(", ")}`
            : "Aucun jour de repos"}{" "}
          · {minutesPerDay * daysPerWeek} min / semaine
        </span>
      </div>

      <p class="text-muted" style={{ fontSize: 13 }}>
        25 min par jour tous les jours valent mieux que 3 h le dimanche : le programme sera calibré
        sur ce rythme.
      </p>

      <button class="btn btn-primary btn-block" onClick={onNext}>
        Lancer le test de niveau
      </button>
    </div>
  );
}

function TestStep({
  state,
  question,
  area,
  busy,
  onAnswer,
}: {
  state: DiagnosticState;
  question: Question;
  area: SkillAreaId;
  busy: boolean;
  onAnswer: (index: number) => void;
}) {
  const total = totalQuestions(state);
  const done = state.answers.length;
  return (
    <div class="stack">
      <div class="row" style={{ justifyContent: "space-between" }}>
        <span class="badge badge-muted">
          {SKILL_AREAS[area].emoji} {SKILL_AREAS[area].label}
        </span>
        <span class="text-muted" style={{ fontSize: 13 }}>
          {done + 1} / {total}
        </span>
      </div>

      <div class="card stack">
        {question.passage && (
          <div class="card" style={{ background: "var(--color-surface-2)", whiteSpace: "pre-wrap" }}>
            {question.passage}
          </div>
        )}
        <p style={{ whiteSpace: "pre-wrap", fontSize: 16, fontWeight: 600 }}>{question.statement}</p>
        <div class="list">
          {question.choices.map((choice, i) => (
            <button
              key={i}
              class="list-row choice-btn"
              disabled={busy}
              onClick={() => onAnswer(i)}
            >
              <span style={{ whiteSpace: "pre-wrap" }}>{choice}</span>
            </button>
          ))}
        </div>
      </div>

      <p class="text-muted" style={{ fontSize: 13 }}>
        Réponds au mieux et sans t'attarder : le temps compte aussi dans l'évaluation. La correction
        arrive à la fin.
      </p>
    </div>
  );
}

function AnalysisStep({
  result,
  plan,
}: {
  result: DiagnosticRecord;
  plan: TrainingPlanRecord | null;
}) {
  const weaknesses = identifyPriorityWeaknesses(result.areas);
  const minutes = Math.round(result.totalTimeMs / 60000);

  return (
    <div class="stack">
      <h1>Ton niveau</h1>
      <div class="card stack">
        <div class="row" style={{ justifyContent: "space-between" }}>
          <span>Score global</span>
          <strong style={{ fontSize: 22 }}>{result.overallScore} %</strong>
        </div>
        <MasteryBar value={result.overallScore} />
        <span class="text-muted" style={{ fontSize: 13 }}>
          {result.answers.length} questions · {minutes} min ·{" "}
          {result.answers.filter((a) => a.correct).length} bonnes réponses
        </span>
      </div>

      <h2 style={{ marginTop: 8 }}>Par domaine</h2>
      {result.areas
        .slice()
        .sort((a, b) => a.masteryScore - b.masteryScore)
        .map((assessment) => (
          <AreaResultCard key={assessment.area} assessment={assessment} />
        ))}

      {weaknesses.length > 0 && (
        <>
          <h2 style={{ marginTop: 8 }}>À travailler en priorité</h2>
          <div class="card stack">
            {weaknesses.map((weakness, i) => (
              <div key={weakness.area} class="stack" style={{ gap: 2 }}>
                <strong>
                  {i + 1}. {SKILL_AREAS[weakness.area].label} — {weakness.assessment.masteryScore} %
                </strong>
                <p class="text-muted" style={{ margin: 0, fontSize: 13 }}>
                  {weakness.reason}
                </p>
              </div>
            ))}
          </div>
        </>
      )}

      {plan && (
        <div class="card stack">
          <h3 style={{ margin: 0 }}>Ton plan est prêt</h3>
          <p style={{ margin: 0, fontSize: 14 }}>
            {plan.minutesPerDay} min par jour, {plan.daysPerWeek} jours par semaine, calibré sur tes
            résultats : les domaines les plus fragiles occupent le plus de temps.
          </p>
        </div>
      )}

      <button class="btn btn-primary btn-block" onClick={() => navigate({ name: "plan" })}>
        Voir mon plan
      </button>
      <button class="btn btn-secondary btn-block" onClick={() => navigate({ name: "home" })}>
        Retour à l'accueil
      </button>
    </div>
  );
}
