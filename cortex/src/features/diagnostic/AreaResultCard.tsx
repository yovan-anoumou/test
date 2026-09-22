import type { AreaAssessment } from "../../db/schema";
import { SKILL_AREAS } from "../../domain/skills";
import { LEVEL_LABELS } from "../../domain/skill-analysis";
import { MasteryBar } from "../../components/MasteryBar";

interface Props {
  assessment: AreaAssessment;
  /** Affiche le détail (erreurs, tags faibles, types d'erreurs). */
  detailed?: boolean;
}

export function AreaResultCard({ assessment, detailed = true }: Props) {
  const area = SKILL_AREAS[assessment.area];
  const errors = assessment.questions - assessment.correct;
  const avgSeconds = Math.round(assessment.avgResponseTimeMs / 1000);

  return (
    <div class="card stack" style={{ gap: 10 }}>
      <div class="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
        <span class="row" style={{ gap: 8 }}>
          <span
            class="domain-chip"
            style={{
              background: `var(--color-${area.color}-bg, rgba(0,122,255,0.12))`,
              width: 34,
              height: 34,
              fontSize: 17,
            }}
            aria-hidden="true"
          >
            {area.emoji}
          </span>
          <span class="stack" style={{ gap: 0 }}>
            <strong>{area.label}</strong>
            <span class="text-muted" style={{ fontSize: 12.5 }}>
              {LEVEL_LABELS[assessment.level]}
            </span>
          </span>
        </span>
        <strong style={{ fontSize: 20 }}>{assessment.masteryScore} %</strong>
      </div>

      <MasteryBar value={assessment.masteryScore} />

      <div class="row" style={{ gap: 14, flexWrap: "wrap", fontSize: 13 }}>
        <span class="text-muted">
          Réussite <strong style={{ color: "var(--color-text)" }}>{Math.round(assessment.accuracy * 100)} %</strong>
        </span>
        <span class="text-muted">
          Vitesse{" "}
          <strong style={{ color: "var(--color-text)" }}>
            {avgSeconds > 0 ? `${avgSeconds} s / question` : "—"}
          </strong>
          {assessment.paceRatio > 1.25 && avgSeconds > 0 && (
            <span class="badge badge-warning" style={{ marginLeft: 6 }}>
              {assessment.paceRatio.toFixed(1)}× la cible
            </span>
          )}
        </span>
        <span class="text-muted">
          {assessment.questions} question{assessment.questions > 1 ? "s" : ""} · {errors} erreur
          {errors > 1 ? "s" : ""}
        </span>
      </div>

      {detailed && assessment.weakTags.length > 0 && (
        <div class="stack" style={{ gap: 4 }}>
          <span class="text-muted" style={{ fontSize: 12, textTransform: "uppercase" }}>
            Points à travailler
          </span>
          <div class="row" style={{ gap: 6, flexWrap: "wrap" }}>
            {assessment.weakTags.map((tag) => (
              <span key={tag.tag} class="badge badge-danger">
                {tag.tag} · {tag.errors}/{tag.attempts}
              </span>
            ))}
          </div>
        </div>
      )}

      {detailed && assessment.errorTypes.length > 0 && (
        <div class="stack" style={{ gap: 4 }}>
          <span class="text-muted" style={{ fontSize: 12, textTransform: "uppercase" }}>
            Type d'erreurs commises
          </span>
          {assessment.errorTypes.map((error, i) => (
            <p key={i} class="text-muted" style={{ margin: 0, fontSize: 13 }}>
              • {error}
            </p>
          ))}
        </div>
      )}

      {detailed && assessment.confidence === "faible" && (
        <p class="text-muted" style={{ margin: 0, fontSize: 12 }}>
          Estimation peu fiable ({assessment.questions} question
          {assessment.questions > 1 ? "s" : ""}) — elle s'affinera avec l'entraînement.
        </p>
      )}
    </div>
  );
}
