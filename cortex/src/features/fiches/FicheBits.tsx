// Petits composants partagés par les trois écrans de fiches.

import type { JSX } from "preact";
import {
  FICHE_LEVEL_LABELS,
  FICHE_MASTERY_COLORS,
  FICHE_MASTERY_LABELS,
  FICHE_MASTERY_STATES,
  type Fiche,
  type FicheLevel,
  type FicheMasteryState,
  type FicheStats,
} from "../../domain/fiches";
import type { FicheDomain } from "../../domain/fiches/types";

const LEVEL_COLOR: Record<FicheLevel, string> = {
  fondamental: "green",
  intermediaire: "accent",
  avance: "pink",
};

export function LevelBadge({ level }: { level: FicheLevel }) {
  const color = LEVEL_COLOR[level];
  return (
    <span
      class="level-badge"
      style={{ background: `var(--color-${color}-bg)`, color: `var(--color-${color})` }}
    >
      {FICHE_LEVEL_LABELS[level]}
    </span>
  );
}

export function MasteryDot({ state }: { state: FicheMasteryState }) {
  return (
    <span
      class={`mastery-dot${state === "non-etudie" ? " hollow" : ""}`}
      style={{ background: FICHE_MASTERY_COLORS[state] }}
      title={FICHE_MASTERY_LABELS[state]}
      aria-label={FICHE_MASTERY_LABELS[state]}
    />
  );
}

export function MasteryBadge({ stats }: { stats: FicheStats }) {
  return (
    <span
      class="level-badge"
      style={{
        background: "var(--color-surface-2)",
        color: FICHE_MASTERY_COLORS[stats.state],
      }}
    >
      {FICHE_MASTERY_LABELS[stats.state]}
    </span>
  );
}

/** Répartition des états de maîtrise sur un ensemble de fiches. */
export function MasteryStack({ statsList }: { statsList: FicheStats[] }) {
  const total = statsList.length;
  if (total === 0) return null;
  const counts = FICHE_MASTERY_STATES.map((state) => ({
    state,
    n: statsList.filter((s) => s.state === state).length,
  }));
  return (
    <div class="mastery-stack" aria-hidden="true">
      {counts
        .filter((c) => c.n > 0 && c.state !== "non-etudie")
        .map((c) => (
          <span
            key={c.state}
            class="mastery-stack-seg"
            style={{ width: `${(c.n / total) * 100}%`, background: FICHE_MASTERY_COLORS[c.state] }}
          />
        ))}
    </div>
  );
}

export function SearchField({
  value,
  onInput,
  placeholder,
}: {
  value: string;
  onInput: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div class="search-field">
      <span class="search-field-icon" aria-hidden="true">
        🔍
      </span>
      <input
        type="search"
        value={value}
        placeholder={placeholder}
        aria-label={placeholder}
        onInput={(e) => onInput((e.currentTarget as HTMLInputElement).value)}
      />
      {value.length > 0 && (
        <button class="search-field-clear" aria-label="Effacer la recherche" onClick={() => onInput("")}>
          ✕
        </button>
      )}
    </div>
  );
}

export function ChipRow<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { id: T; label: string; count?: number; hint?: string }[];
  value: T;
  onChange: (id: T) => void;
}) {
  return (
    <div class="chip-row" role="tablist">
      {options.map((o) => (
        <button
          key={o.id}
          role="tab"
          aria-selected={o.id === value}
          title={o.hint}
          class={`chip${o.id === value ? " active" : ""}`}
          onClick={() => onChange(o.id)}
        >
          {o.label}
          {o.count !== undefined && <span class="chip-count"> {o.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function DomainChip({
  domain,
  size = 40,
}: {
  domain: FicheDomain;
  size?: number;
}) {
  return (
    <span
      class="domain-chip"
      style={{
        background: `var(--color-${domain.color}-bg, rgba(0,122,255,0.12))`,
        width: size,
        height: size,
        fontSize: Math.round(size * 0.5),
      }}
      aria-hidden="true"
    >
      {domain.emoji}
    </span>
  );
}

export function BackLink({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      class="text-muted"
      style={{
        background: "none",
        border: "none",
        padding: 0,
        fontSize: 15,
        cursor: "pointer",
        textAlign: "left",
      }}
      onClick={onClick}
    >
      ‹ {label}
    </button>
  );
}

/** Une fiche dans une liste : titre, « à retenir », niveau, pastille de maîtrise. */
export function FicheRow({
  fiche,
  stats,
  onClick,
  showDomain,
}: {
  fiche: Fiche;
  stats: FicheStats | undefined;
  onClick: () => void;
  showDomain?: FicheDomain;
}): JSX.Element {
  return (
    <button class="list-row" onClick={onClick}>
      <span class="row" style={{ gap: 10, minWidth: 0, alignItems: "flex-start" }}>
        {stats && (
          <span style={{ paddingTop: 6 }}>
            <MasteryDot state={stats.state} />
          </span>
        )}
        <span class="stack" style={{ gap: 3, minWidth: 0 }}>
          <span class="row" style={{ gap: 6, flexWrap: "wrap" }}>
            <span style={{ fontWeight: 600 }}>{fiche.title}</span>
            {stats?.favorite && <span aria-label="Fiche importante">★</span>}
          </span>
          <span class="text-muted" style={{ fontSize: 12.5, lineHeight: 1.35 }}>
            {fiche.tagline}
          </span>
          <span class="row" style={{ gap: 6, flexWrap: "wrap", marginTop: 2 }}>
            <LevelBadge level={fiche.level} />
            {showDomain && (
              <span class="level-badge" style={{ background: "var(--color-surface-2)", color: "var(--color-text-muted)" }}>
                {showDomain.label}
              </span>
            )}
            <span class="text-muted" style={{ fontSize: 11.5 }}>
              {fiche.readMinutes} min
            </span>
          </span>
        </span>
      </span>
      <span class="text-muted" aria-hidden="true">
        ›
      </span>
    </button>
  );
}
