import { useState } from "preact/hooks";
import type { FicheBlock } from "../../domain/fiches/types";
import { SeriesMethodDiagram, ReasoningTypesDiagram, PercentChainDiagram } from "../../components/FicheDiagrams";

export function FicheBlockView({
  block,
  onSelfCheck,
}: {
  block: FicheBlock;
  /** Auto-évaluation sur une mini-question, quand la fiche est ouverte en détail. */
  onSelfCheck?: (correct: boolean) => void;
}) {
  switch (block.type) {
    case "rule":
      return (
        <div class="stack" style={{ gap: 4 }}>
          <h3 style={{ margin: 0, fontSize: 16 }}>{block.title}</h3>
          <p style={{ margin: 0 }}>{block.body}</p>
        </div>
      );

    case "keyfacts":
      return (
        <div class="stack" style={{ gap: 6 }}>
          <h3 style={{ margin: 0, fontSize: 16 }}>{block.title}</h3>
          <ul style={{ margin: 0, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 6 }}>
            {block.items.map((item, i) => (
              <li key={i} style={{ lineHeight: 1.45 }}>
                {item}
              </li>
            ))}
          </ul>
        </div>
      );

    case "example":
      return <ExampleBlock block={block} />;

    case "mnemonic":
      return (
        <div class="fiche-callout fiche-callout-mnemonic">
          <span class="fiche-callout-icon" aria-hidden="true">
            💡
          </span>
          <div>
            <strong>{block.title}</strong>
            <p style={{ margin: "4px 0 0" }}>{block.body}</p>
          </div>
        </div>
      );

    case "warning":
      return (
        <div class="fiche-callout fiche-callout-warning">
          <span class="fiche-callout-icon" aria-hidden="true">
            ⚠️
          </span>
          <p style={{ margin: 0 }}>{block.body}</p>
        </div>
      );

    case "quote":
      return <blockquote class="fiche-quote">{block.body}</blockquote>;

    case "table":
      return (
        <div class="stack" style={{ gap: 6 }}>
          {block.title && (
            <h3 style={{ margin: 0, fontSize: 16 }}>{block.title}</h3>
          )}
          <div class="fiche-table-wrap">
            <table class="fiche-table">
              <thead>
                <tr>
                  {block.headers.map((h, i) => (
                    <th key={i}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((row, i) => (
                  <tr key={i}>
                    {row.map((cell, j) => (
                      <td key={j}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );

    case "quiz":
      return <QuizBlock block={block} onSelfCheck={onSelfCheck} />;

    case "diagram":
      return <DiagramBlock kind={block.kind} />;

    default:
      return null;
  }
}

function ExampleBlock({ block }: { block: Extract<FicheBlock, { type: "example" }> }) {
  const [revealed, setRevealed] = useState(false);

  return (
    <div class="fiche-example">
      {block.title && <div class="fiche-example-title">{block.title}</div>}
      <p style={{ margin: "0 0 10px", fontWeight: 600 }}>{block.prompt}</p>
      {revealed ? (
        <p class="text-muted" style={{ margin: 0 }}>
          {block.reveal}
        </p>
      ) : (
        <button class="btn btn-secondary" style={{ padding: "8px 14px", fontSize: 14 }} onClick={() => setRevealed(true)}>
          Voir la solution
        </button>
      )}
    </div>
  );
}

/**
 * Mini-question de fin de fiche : on répond de tête, puis on déroule. Le rappel
 * actif est ce qui fait tenir la notion — d'où la réponse masquée par défaut.
 */
function QuizBlock({
  block,
  onSelfCheck,
}: {
  block: Extract<FicheBlock, { type: "quiz" }>;
  onSelfCheck?: (correct: boolean) => void;
}) {
  const [revealed, setRevealed] = useState(false);
  const [hintShown, setHintShown] = useState(false);
  const [answered, setAnswered] = useState<boolean | null>(null);

  return (
    <div class="fiche-quiz">
      <div class="fiche-quiz-label">Mini-question</div>
      <p style={{ margin: "0 0 10px", fontWeight: 600 }}>{block.question}</p>

      {block.hint && !revealed && (
        hintShown ? (
          <p class="text-muted" style={{ margin: "0 0 10px", fontSize: 14 }}>
            Indice : {block.hint}
          </p>
        ) : (
          <button
            class="btn btn-secondary"
            style={{ padding: "6px 12px", fontSize: 13.5, marginBottom: 10 }}
            onClick={() => setHintShown(true)}
          >
            Un indice
          </button>
        )
      )}

      {revealed ? (
        <>
          <p style={{ margin: 0 }}>{block.answer}</p>
          {onSelfCheck &&
            (answered === null ? (
              <div class="fiche-selfcheck">
                <button
                  class="btn btn-secondary"
                  onClick={() => {
                    setAnswered(true);
                    onSelfCheck(true);
                  }}
                >
                  J'avais juste
                </button>
                <button
                  class="btn btn-secondary"
                  onClick={() => {
                    setAnswered(false);
                    onSelfCheck(false);
                  }}
                >
                  J'avais faux
                </button>
              </div>
            ) : (
              <p class="text-muted" style={{ margin: "10px 0 0", fontSize: 13.5 }}>
                {answered
                  ? "Noté. Enchaîne sur « Me tester » pour vérifier que ça tient en conditions réelles."
                  : "Noté — cette fiche reviendra plus tôt dans « À revoir »."}
              </p>
            ))}
        </>
      ) : (
        <button
          class="btn btn-secondary"
          style={{ padding: "8px 14px", fontSize: 14 }}
          onClick={() => setRevealed(true)}
        >
          Voir la réponse
        </button>
      )}
    </div>
  );
}

function DiagramBlock({ kind }: { kind: Extract<FicheBlock, { type: "diagram" }>["kind"] }) {
  return (
    <div class="fiche-diagram">
      {kind === "series-method" && <SeriesMethodDiagram />}
      {kind === "reasoning-types" && <ReasoningTypesDiagram />}
      {kind === "percent-chain" && <PercentChainDiagram />}
    </div>
  );
}
