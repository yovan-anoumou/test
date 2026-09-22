import { useEffect, useState } from "preact/hooks";
import type { PlanBlock, TrainingPlanRecord } from "../../db/schema";
import { DAY_LABELS, MINUTES_OPTIONS, weeklyMinutes, type PlanProgress } from "../../domain/plan";
import { SKILL_AREAS } from "../../domain/skills";
import { OBJECTIVES } from "../../domain/skills";
import { loadPlanContext, recomputePlanNow, updatePlanRhythm } from "../../services/planService";
import { navigate } from "../../router";
import { formatDateFr } from "../../utils/date";
import { MasteryBar } from "../../components/MasteryBar";

export function PlanScreen() {
  const [plan, setPlan] = useState<TrainingPlanRecord | null | undefined>(undefined);
  const [progress, setProgress] = useState<PlanProgress | null>(null);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function refresh() {
    const context = await loadPlanContext();
    setPlan(context.plan);
    setProgress(context.progress);
  }

  useEffect(() => {
    void refresh();
  }, []);

  if (plan === undefined) {
    return (
      <div class="screen">
        <p class="text-muted">Chargement du plan…</p>
      </div>
    );
  }

  if (plan === null) {
    return (
      <div class="screen stack">
        <h1>Ton plan</h1>
        <div class="card stack">
          <h3 style={{ margin: 0 }}>Pas encore de plan</h3>
          <p style={{ margin: 0, fontSize: 14 }}>
            Le test de niveau mesure où tu en es dans chaque domaine, puis construit un programme
            calibré sur ton temps disponible et ton échéance.
          </p>
        </div>
        <button class="btn btn-primary btn-block" onClick={() => navigate({ name: "diagnostic" })}>
          Faire mon test de niveau
        </button>
      </div>
    );
  }

  const objective = OBJECTIVES.find((o) => o.id === plan.objective);
  const sortedAreas = Object.entries(plan.areaWeights)
    .map(([area, weight]) => ({ area: area as keyof typeof SKILL_AREAS, weight }))
    .sort((a, b) => b.weight - a.weight);

  async function handleRecompute() {
    setBusy(true);
    const updated = await recomputePlanNow();
    setBusy(false);
    if (updated) {
      setPlan(updated);
      setMessage("Plan réajusté sur tes performances récentes.");
      await refresh();
    } else {
      setMessage("Pas encore assez de nouvelles données pour réajuster le plan.");
    }
  }

  return (
    <div class="screen stack">
      <h1>Ton plan</h1>

      {message && (
        <div class="card">
          <p style={{ margin: 0, fontSize: 14 }}>{message}</p>
        </div>
      )}

      <div class="card stack">
        <div class="row" style={{ justifyContent: "space-between" }}>
          <span class="stack" style={{ gap: 1 }}>
            <strong>{objective?.label ?? "Objectif"}</strong>
            <span class="text-muted" style={{ fontSize: 12.5 }}>
              {plan.minutesPerDay} min/jour · {plan.daysPerWeek} jours/semaine ·{" "}
              {weeklyMinutes(plan)} min/semaine
            </span>
          </span>
          <span class="badge badge-muted">v{plan.revision}</span>
        </div>

        {plan.targetDate && (
          <span class="text-muted" style={{ fontSize: 13 }}>
            Objectif : {formatDateFr(plan.targetDate)}
            {progress?.daysRemaining !== null && progress?.daysRemaining !== undefined
              ? ` · ${progress.daysRemaining} jours restants`
              : ""}
          </span>
        )}

        {progress && progress.expectedBlocks > 0 && (
          <div class="stack" style={{ gap: 4 }}>
            <div class="row" style={{ justifyContent: "space-between", fontSize: 13 }}>
              <span class="text-muted">Suivi du plan</span>
              <span class="text-muted">
                {progress.completedBlocks} / {progress.expectedBlocks} séances
              </span>
            </div>
            <MasteryBar value={progress.ratio * 100} />
          </div>
        )}
      </div>

      <h2 style={{ marginTop: 8 }}>Ta semaine</h2>
      <div class="stack">
        {[1, 2, 3, 4, 5, 6, 0].map((dayIndex) => {
          const day = plan.week[dayIndex];
          const isToday = new Date().getDay() === dayIndex;
          return (
            <div
              class="card stack"
              key={dayIndex}
              style={{ gap: 8, outline: isToday ? "2px solid var(--color-accent)" : undefined }}
            >
              <div class="row" style={{ justifyContent: "space-between" }}>
                <strong>{DAY_LABELS[dayIndex]}</strong>
                {isToday && <span class="badge badge-muted">Aujourd'hui</span>}
              </div>
              {day.rest || day.blocks.length === 0 ? (
                <span class="text-muted" style={{ fontSize: 14 }}>
                  Repos
                </span>
              ) : (
                day.blocks.map((block) => (
                  <PlanBlockRow
                    key={block.id}
                    block={block}
                    done={progress?.doneBlockIds.includes(block.id) ?? false}
                    actionable={isToday}
                  />
                ))
              )}
            </div>
          );
        })}
      </div>

      <h2 style={{ marginTop: 8 }}>Répartition du temps</h2>
      <div class="card stack" style={{ gap: 10 }}>
        {sortedAreas.map(({ area, weight }) => (
          <div class="stack" key={area} style={{ gap: 4 }}>
            <div class="row" style={{ justifyContent: "space-between", fontSize: 13 }}>
              <span>
                {SKILL_AREAS[area].emoji} {SKILL_AREAS[area].label}
              </span>
              <span class="text-muted">{Math.round(weight * 100)} %</span>
            </div>
            <MasteryBar value={weight * 100 * 2} color={`var(--color-${SKILL_AREAS[area].color}, var(--color-accent))`} height={6} />
          </div>
        ))}
        <p class="text-muted" style={{ margin: 0, fontSize: 12.5 }}>
          Plus un domaine est fragile et important pour ton objectif, plus il occupe de place. Aucun
          domaine ne disparaît complètement : les acquis s'entretiennent.
        </p>
      </div>

      {plan.history.length > 0 && (
        <>
          <h2 style={{ marginTop: 8 }}>Ajustements</h2>
          <div class="card stack" style={{ gap: 10 }}>
            {plan.history
              .slice()
              .reverse()
              .map((revision, i) => (
                <div key={i} class="stack" style={{ gap: 2 }}>
                  <span class="text-muted" style={{ fontSize: 12 }}>
                    {formatDateFr(revision.at)}
                  </span>
                  <span style={{ fontSize: 14 }}>{revision.reason}</span>
                </div>
              ))}
          </div>
        </>
      )}

      <button class="btn btn-secondary btn-block" disabled={busy} onClick={() => void handleRecompute()}>
        {busy ? "Recalcul…" : "Réajuster sur mes performances récentes"}
      </button>
      <button class="btn btn-secondary btn-block" onClick={() => setEditing((v) => !v)}>
        {editing ? "Annuler" : "Modifier mon rythme"}
      </button>

      {editing && (
        <PlanParamsEditor
          plan={plan}
          onSaved={async (updated) => {
            setPlan(updated);
            setEditing(false);
            setMessage("Rythme mis à jour, plan régénéré.");
            await refresh();
          }}
        />
      )}

      <button class="btn btn-secondary btn-block" onClick={() => navigate({ name: "diagnostic" })}>
        Refaire un test de niveau
      </button>
    </div>
  );
}

function PlanBlockRow({
  block,
  done,
  actionable,
}: {
  block: PlanBlock;
  done: boolean;
  actionable: boolean;
}) {
  const area = block.area ? SKILL_AREAS[block.area] : null;
  return (
    <div class="row" style={{ justifyContent: "space-between", gap: 10 }}>
      <span class="row" style={{ gap: 8 }}>
        <span aria-hidden="true">{done ? "✅" : area?.emoji ?? "🔁"}</span>
        <span class="stack" style={{ gap: 0 }}>
          <span style={{ textDecoration: done ? "line-through" : undefined }}>{block.label}</span>
          <span class="text-muted" style={{ fontSize: 12.5 }}>
            {block.minutes} min
          </span>
        </span>
      </span>
      {actionable && !done && (
        <button
          class="btn btn-secondary"
          style={{ padding: "8px 14px", fontSize: 14 }}
          onClick={() => navigate({ name: "session", spec: { kind: "plan", blockId: block.id } })}
        >
          Démarrer
        </button>
      )}
    </div>
  );
}

function PlanParamsEditor({
  plan,
  onSaved,
}: {
  plan: TrainingPlanRecord;
  onSaved: (plan: TrainingPlanRecord) => void | Promise<void>;
}) {
  const [minutes, setMinutes] = useState(plan.minutesPerDay);
  const [days, setDays] = useState(plan.daysPerWeek);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    // On garde le même plan (pondérations, révisions, séances déjà faites) :
    // seul le rythme change.
    const updated = await updatePlanRhythm({ minutesPerDay: minutes, daysPerWeek: days });
    setSaving(false);
    if (updated) await onSaved(updated);
  }

  return (
    <div class="card stack">
      <span style={{ fontWeight: 600 }}>Temps quotidien</span>
      <div class="row" style={{ flexWrap: "wrap", gap: 8 }}>
        {MINUTES_OPTIONS.map((m) => (
          <button
            key={m}
            class={`btn ${minutes === m ? "btn-primary" : "btn-secondary"}`}
            style={{ padding: "10px 16px", fontSize: 15 }}
            onClick={() => setMinutes(m)}
          >
            {m} min
          </button>
        ))}
      </div>
      <span style={{ fontWeight: 600 }}>Jours par semaine</span>
      <div class="row" style={{ flexWrap: "wrap", gap: 8 }}>
        {[3, 4, 5, 6, 7].map((d) => (
          <button
            key={d}
            class={`btn ${days === d ? "btn-primary" : "btn-secondary"}`}
            style={{ padding: "10px 16px", fontSize: 15 }}
            onClick={() => setDays(d)}
          >
            {d}
          </button>
        ))}
      </div>
      <button class="btn btn-primary btn-block" disabled={saving} onClick={() => void save()}>
        {saving ? "Régénération…" : "Régénérer mon plan"}
      </button>
    </div>
  );
}
