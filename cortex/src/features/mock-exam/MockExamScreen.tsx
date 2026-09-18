import { useEffect, useRef, useState } from "preact/hooks";
import {
  buildMockExamPlan,
  computeMockExamTotalScore,
  type MockExamSection,
  type MockExamAnswer,
  type MockExamSectionResult,
} from "../../domain/mock-exam";
import { loadQuestionBank } from "../../domain/questionBank";
import type { Question } from "../../domain/question";
import { TAGE2_MOCK_EXAM_SECTIONS, SUBTESTS } from "../../domain/modules";
import { createSession } from "../../db/repositories/sessionsRepo";
import { addReview } from "../../db/repositories/reviewsRepo";
import { getCard, putCard } from "../../db/repositories/cardsRepo";
import { rateCard } from "../../fsrs/scheduler";
import { settings } from "../../store";
import { navigate } from "../../router";
import { newId } from "../../utils/id";
import { formatDurationShort } from "../../utils/date";

type Phase = "intro" | "loading" | "running" | "finished";

export function MockExamScreen() {
  const [phase, setPhase] = useState<Phase>("intro");
  const [sections, setSections] = useState<MockExamSection[] | null>(null);
  const [sectionIndex, setSectionIndex] = useState(0);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [remainingMs, setRemainingMs] = useState(0);
  const [results, setResults] = useState<MockExamSectionResult[]>([]);
  const [expandedSection, setExpandedSection] = useState<number | null>(null);

  const sectionAnswersRef = useRef<MockExamAnswer[]>([]);
  const sectionEndAtRef = useRef<number>(0);
  const questionStartRef = useRef<number>(performance.now());
  const sessionIdRef = useRef<string>(newId());
  const sessionStartedAtRef = useRef<string>("");
  const sectionFinishingRef = useRef(false);

  useEffect(() => {
    if (phase !== "running") return;
    const id = window.setInterval(() => {
      setRemainingMs(Math.max(0, sectionEndAtRef.current - Date.now()));
    }, 250);
    return () => window.clearInterval(id);
  }, [phase, sectionIndex]);

  useEffect(() => {
    if (phase === "running" && remainingMs === 0 && sections) {
      finishSection(sections);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remainingMs, phase]);

  async function start() {
    setPhase("loading");
    const bank = await loadQuestionBank();
    const plan = buildMockExamPlan(bank);
    sessionStartedAtRef.current = new Date().toISOString();
    await createSession({
      id: sessionIdRef.current,
      kind: "mock-exam",
      startedAt: sessionStartedAtRef.current,
      finishedAt: null,
      questionIds: plan.flatMap((s) => s.questions.map((q) => q.id)),
      mockExamResult: null,
    });
    setSections(plan);
    sectionAnswersRef.current = [];
    setSectionIndex(0);
    setQuestionIndex(0);
    beginSection(plan[0]);
    setPhase("running");
  }

  function beginSection(section: MockExamSection) {
    sectionAnswersRef.current = [];
    sectionFinishingRef.current = false;
    sectionEndAtRef.current = Date.now() + section.durationSeconds * 1000;
    setRemainingMs(section.durationSeconds * 1000);
    questionStartRef.current = performance.now();
  }

  function recordAnswer(question: Question, selectedIndex: number | null) {
    const responseTimeMs = performance.now() - questionStartRef.current;
    sectionAnswersRef.current = [
      ...sectionAnswersRef.current,
      { questionId: question.id, selectedIndex, responseTimeMs },
    ];

    void persistAnswerSignal(question, selectedIndex, responseTimeMs);
  }

  async function persistAnswerSignal(
    question: Question,
    selectedIndex: number | null,
    responseTimeMs: number,
  ) {
    if (selectedIndex === null) return; // pas de réponse = pas de signal FSRS
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
      sessionKind: "mock-exam",
    });
    const card = await getCard(question.id);
    if (card) {
      const next = rateCard(card, correct ? "good" : "again", settings.value.retentionTarget);
      await putCard(next);
    }
  }

  function handleAnswer(section: MockExamSection, question: Question, selectedIndex: number) {
    recordAnswer(question, selectedIndex);
    goToNextQuestion(section);
  }

  function goToNextQuestion(section: MockExamSection) {
    if (questionIndex + 1 < section.questions.length) {
      setQuestionIndex((i) => i + 1);
      questionStartRef.current = performance.now();
    } else if (sections) {
      finishSection(sections);
    }
  }

  function finishSection(plan: MockExamSection[]) {
    if (sectionFinishingRef.current) return;
    sectionFinishingRef.current = true;
    const section = plan[sectionIndex];
    // Questions jamais atteintes dans cette section (temps écoulé avant de les voir).
    const answeredIds = new Set(sectionAnswersRef.current.map((a) => a.questionId));
    const unanswered: MockExamAnswer[] = section.questions
      .filter((q) => !answeredIds.has(q.id))
      .map((q) => ({ questionId: q.id, selectedIndex: null, responseTimeMs: 0 }));
    const allAnswers = [...sectionAnswersRef.current, ...unanswered];

    const correct = allAnswers.filter((a) => {
      const q = section.questions.find((qq) => qq.id === a.questionId)!;
      return a.selectedIndex !== null && a.selectedIndex === q.correctIndex;
    }).length;

    const sectionResult: MockExamSectionResult = {
      subtest: section.subtest,
      label: section.label,
      correct,
      total: section.questions.length,
      timeMs: section.durationSeconds * 1000 - Math.max(0, remainingMs),
      answers: allAnswers,
    };

    const isLastSection = sectionIndex + 1 >= plan.length;
    if (isLastSection) {
      // Empêche tout re-rendu de la dernière question pendant la sauvegarde finale.
      setPhase("loading");
    }

    setResults((r) => {
      const next = [...r, sectionResult];
      if (isLastSection) {
        void finishExam(next);
      }
      return next;
    });

    if (!isLastSection) {
      const nextIndex = sectionIndex + 1;
      setSectionIndex(nextIndex);
      setQuestionIndex(0);
      beginSection(plan[nextIndex]);
    }
  }

  async function finishExam(finalResults: MockExamSectionResult[]) {
    const total = computeMockExamTotalScore(finalResults);
    const subtestScores: Record<string, { correct: number; total: number; timeMs: number }> = {};
    for (const r of finalResults) {
      subtestScores[r.subtest] = { correct: r.correct, total: r.total, timeMs: r.timeMs };
    }
    await createSession({
      id: sessionIdRef.current,
      kind: "mock-exam",
      startedAt: sessionStartedAtRef.current,
      finishedAt: new Date().toISOString(),
      questionIds: finalResults.flatMap((r) => r.answers.map((a) => a.questionId)),
      mockExamResult: { subtestScores, projectedScore: total },
    });
    setPhase("finished");
  }

  if (phase === "intro") {
    const totalMinutes = TAGE2_MOCK_EXAM_SECTIONS.reduce(
      (sum, s) => sum + SUBTESTS[s.subtest].mockExam.durationMinutes,
      0,
    );
    return (
      <div class="screen stack">
        <h1>Test blanc complet — TAGE 2</h1>
        <div class="card stack">
          <p>
            <strong>
              Durée totale : {Math.floor(totalMinutes / 60)}h{(totalMinutes % 60).toString().padStart(2, "0")}
            </strong>
            , conditions réelles : un temps imposé par sous-test, sans pause, et impossible de
            revenir en arrière une fois la réponse validée.
          </p>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {TAGE2_MOCK_EXAM_SECTIONS.map((s, i) => {
              const def = SUBTESTS[s.subtest].mockExam;
              return (
                <li key={s.label + i}>
                  {s.label} — {def.questionCount} questions / {def.durationMinutes} min
                </li>
              );
            })}
          </ul>
          <p class="text-muted">
            La correction détaillée de chaque question sera disponible à la fin du test.
          </p>
        </div>
        <button class="btn btn-primary btn-block" onClick={() => void start()}>
          Démarrer le test blanc
        </button>
        <button class="btn btn-secondary btn-block" onClick={() => navigate({ name: "home" })}>
          Annuler
        </button>
      </div>
    );
  }

  if (phase === "loading" || !sections) {
    return (
      <div class="screen">
        <p class="text-muted">Préparation du test…</p>
      </div>
    );
  }

  if (phase === "finished") {
    const total = computeMockExamTotalScore(results);
    return (
      <div class="screen stack">
        <h2>Test blanc terminé</h2>
        <div class="card">
          <div class="row" style={{ justifyContent: "space-between" }}>
            <span>Score total</span>
            <strong style={{ fontSize: 20 }}>{total} / 600</strong>
          </div>
        </div>

        <div class="stack">
          {results.map((r, idx) => (
            <div class="card stack" key={r.subtest + idx}>
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
                onClick={() => setExpandedSection(expandedSection === idx ? null : idx)}
              >
                <span>{r.label}</span>
                <span class="row">
                  <span class="badge badge-muted">
                    {r.correct}/{r.total}
                  </span>
                  <span class="text-muted" style={{ fontSize: 12 }}>
                    {formatDurationShort(r.timeMs / 1000)}
                  </span>
                </span>
              </button>

              {expandedSection === idx && (
                <div class="stack">
                  {r.answers.map((a) => {
                    const section = sections.find((s) => s.subtest === r.subtest);
                    const question = section?.questions.find((q) => q.id === a.questionId);
                    if (!question) return null;
                    const correct = a.selectedIndex === question.correctIndex;
                    return (
                      <div
                        class="card"
                        key={a.questionId}
                        style={{ background: "var(--color-surface-2)" }}
                      >
                        <p style={{ fontWeight: 600, whiteSpace: "pre-wrap" }}>{question.statement}</p>
                        <p class="text-muted" style={{ fontSize: 13 }}>
                          Ta réponse :{" "}
                          {a.selectedIndex !== null ? question.choices[a.selectedIndex] : "(non répondu)"}
                          {" — "}
                          <span class={correct ? "badge badge-success" : "badge badge-danger"}>
                            {correct ? "Correct" : "Incorrect"}
                          </span>
                        </p>
                        {!correct && (
                          <p class="text-muted" style={{ fontSize: 13 }}>
                            Bonne réponse : {question.choices[question.correctIndex]}
                          </p>
                        )}
                        <p style={{ fontSize: 14 }}>{question.explanation.why_correct}</p>
                        <p class="text-muted" style={{ fontSize: 13 }}>
                          <strong>Méthode : </strong>
                          {question.explanation.method}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
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

  const section = sections[sectionIndex];
  const question = section.questions[questionIndex];

  if (!question) {
    return (
      <div class="screen">
        <p class="text-muted">Section terminée…</p>
      </div>
    );
  }

  const remainingSeconds = Math.ceil(remainingMs / 1000);
  const timeTone = remainingSeconds < 60 ? "danger" : remainingSeconds < 180 ? "warning" : "muted";

  return (
    <div class="screen stack">
      <div class="row" style={{ justifyContent: "space-between" }}>
        <span class="badge badge-muted">
          Section {sectionIndex + 1}/{sections.length} — {section.label}
        </span>
        <span class={`badge badge-${timeTone}`}>
          {Math.floor(remainingSeconds / 60)}:{(remainingSeconds % 60).toString().padStart(2, "0")}
        </span>
      </div>
      <div class="progress-bar">
        <div
          class="progress-bar-fill"
          style={{ width: `${(remainingMs / (section.durationSeconds * 1000)) * 100}%` }}
        />
      </div>
      <p class="text-muted" style={{ fontSize: 13, margin: 0 }}>
        Question {questionIndex + 1} / {section.questions.length}
      </p>

      <div class="card stack">
        {question.passage && (
          <div class="card" style={{ background: "var(--color-surface-2)", whiteSpace: "pre-wrap" }}>
            {question.passage}
          </div>
        )}
        <p style={{ whiteSpace: "pre-wrap", fontSize: 16, fontWeight: 600 }}>{question.statement}</p>
        <div class="stack">
          {question.choices.map((choice, i) => (
            <button
              key={i}
              class="choice-btn"
              onClick={() => handleAnswer(section, question, i)}
            >
              <span style={{ whiteSpace: "pre-wrap" }}>{choice}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
