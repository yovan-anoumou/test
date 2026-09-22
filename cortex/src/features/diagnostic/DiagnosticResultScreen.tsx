import { useEffect, useState } from "preact/hooks";
import { getDiagnostic } from "../../db/repositories/diagnosticsRepo";
import type { DiagnosticRecord } from "../../db/schema";
import { identifyPriorityWeaknesses } from "../../domain/skill-analysis";
import { SKILL_AREAS } from "../../domain/skills";
import { navigate } from "../../router";
import { formatDateFr } from "../../utils/date";
import { AreaResultCard } from "./AreaResultCard";
import { MasteryBar } from "../../components/MasteryBar";

export function DiagnosticResultScreen({ id }: { id: string }) {
  const [record, setRecord] = useState<DiagnosticRecord | null | undefined>(undefined);

  useEffect(() => {
    void getDiagnostic(id).then((r) => setRecord(r ?? null));
  }, [id]);

  if (record === undefined) {
    return (
      <div class="screen">
        <p class="text-muted">Chargement…</p>
      </div>
    );
  }

  if (record === null) {
    return (
      <div class="screen stack">
        <h2>Test de niveau introuvable</h2>
        <button class="btn btn-primary btn-block" onClick={() => navigate({ name: "home" })}>
          Retour à l'accueil
        </button>
      </div>
    );
  }

  const weaknesses = identifyPriorityWeaknesses(record.areas);

  return (
    <div class="screen stack">
      <button
        class="text-muted"
        style={{ background: "none", border: "none", padding: 0, fontSize: 15, cursor: "pointer", textAlign: "left" }}
        onClick={() => navigate({ name: "dashboard" })}
      >
        ‹ Progrès
      </button>

      <h1>Test de niveau</h1>
      <p class="text-muted" style={{ marginTop: -4 }}>
        {formatDateFr(record.startedAt)}
      </p>

      <div class="card stack">
        <div class="row" style={{ justifyContent: "space-between" }}>
          <span>Score global</span>
          <strong style={{ fontSize: 22 }}>{record.overallScore} %</strong>
        </div>
        <MasteryBar value={record.overallScore} />
      </div>

      {record.areas
        .slice()
        .sort((a, b) => a.masteryScore - b.masteryScore)
        .map((assessment) => (
          <AreaResultCard key={assessment.area} assessment={assessment} />
        ))}

      {weaknesses.length > 0 && (
        <div class="card stack">
          <h3 style={{ margin: 0 }}>Priorités identifiées</h3>
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
      )}
    </div>
  );
}
