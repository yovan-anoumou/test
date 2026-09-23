import { useEffect, useMemo, useRef } from "preact/hooks";
import { navigate } from "../../router";
import {
  FICHE_DOMAINS,
  FICHE_MASTERY_HINTS,
  FICHE_MASTERY_LABELS,
  ficheById,
  fichesByDomain,
  relatedFiches,
  type FicheStats,
} from "../../domain/fiches";
import {
  answerFicheQuiz,
  ficheBank,
  loadFicheBank,
  readFiche,
  toggleFavorite,
} from "../../services/ficheService";
import { BackLink, FicheRow, LevelBadge, MasteryBadge } from "./FicheBits";
import { FicheBlockView } from "./FicheBlockView";

export function FicheDetailScreen({ id }: { id: string }) {
  useEffect(() => {
    void loadFicheBank();
  }, []);

  const bank = ficheBank.value;
  const fiche = useMemo(() => ficheById(bank.fiches, id), [bank.fiches, id]);

  // Une lecture comptée par ouverture de fiche : c'est ce qui fait passer une
  // fiche de « non étudiée » à « découverte » et amorce la relecture espacée.
  // Le garde-fou évite de recompter si l'effet est rejoué sans changement de
  // fiche (rafraîchissement de la banque après un favori, par exemple).
  const countedRef = useRef<string | null>(null);
  useEffect(() => {
    if (fiche && countedRef.current !== fiche.id) {
      countedRef.current = fiche.id;
      void readFiche(fiche.id);
    }
  }, [fiche?.id]);

  if (bank.status === "loading" || bank.status === "idle") {
    return (
      <div class="screen stack">
        <p class="text-muted">Chargement de la fiche…</p>
      </div>
    );
  }

  if (!fiche) {
    return (
      <div class="screen stack">
        <h2>Fiche introuvable</h2>
        <p class="text-muted">
          Cette fiche a peut-être été renommée dans une mise à jour de l'app.
        </p>
        <button class="btn btn-primary btn-block" onClick={() => navigate({ name: "fiches" })}>
          Retour aux fiches
        </button>
      </div>
    );
  }

  const def = FICHE_DOMAINS[fiche.domain];
  const stats = bank.stats.get(fiche.id);
  const related = relatedFiches(bank.fiches, fiche);
  const siblings = fichesByDomain(bank.fiches, fiche.domain);
  const next = siblings[siblings.findIndex((f) => f.id === fiche.id) + 1];

  return (
    <div class="screen stack">
      <BackLink
        label={def.label}
        onClick={() => navigate({ name: "fiches-domain", domain: fiche.domain })}
      />

      <div class="row" style={{ alignItems: "flex-start", gap: 12 }}>
        <div class="stack" style={{ gap: 8, minWidth: 0 }}>
          <div class="row" style={{ gap: 6, flexWrap: "wrap" }}>
            <span
              class="badge"
              style={{
                background: `var(--color-${def.color}-bg, rgba(0,122,255,0.12))`,
                color: `var(--color-${def.color}, var(--color-accent))`,
              }}
            >
              {def.emoji} {fiche.category}
            </span>
            <LevelBadge level={fiche.level} />
            {stats && <MasteryBadge stats={stats} />}
          </div>
          <h1 style={{ margin: 0 }}>{fiche.title}</h1>
        </div>
        <button
          class="favorite-btn"
          aria-pressed={stats?.favorite ?? false}
          aria-label={stats?.favorite ? "Retirer de mes fiches" : "Ajouter à mes fiches"}
          onClick={() => void toggleFavorite(fiche.id)}
        >
          {stats?.favorite ? "★" : "☆"}
        </button>
      </div>

      <div class="card stack" style={{ gap: 4 }}>
        <span
          style={{
            fontSize: 11.5,
            fontWeight: 700,
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            color: "var(--color-accent)",
          }}
        >
          À retenir
        </span>
        <p style={{ margin: 0, fontWeight: 600 }}>{fiche.tagline}</p>
        <p class="text-muted" style={{ margin: "4px 0 0", fontSize: 12.5 }}>
          {fiche.readMinutes} min de lecture
          {fiche.updatedAt && ` · contenu vérifié le ${formatDate(fiche.updatedAt)}`}
        </p>
      </div>

      {stats && <MasteryCard stats={stats} />}

      <div class="card stack" style={{ gap: 20 }}>
        {fiche.blocks.map((block, i) => (
          <FicheBlockView
            key={i}
            block={block}
            onSelfCheck={(correct) => void answerFicheQuiz(fiche.id, correct)}
          />
        ))}
      </div>

      <div class="stack" style={{ gap: 8 }}>
        <h2 style={{ margin: 0, fontSize: 17 }}>Transformer ça en points</h2>
        <div class="action-grid">
          <button
            class="btn btn-primary"
            onClick={() =>
              navigate({ name: "session", spec: { kind: "fiche", ficheId: fiche.id, variant: "test" } })
            }
          >
            🎯 Me tester
          </button>
          <button
            class="btn btn-secondary"
            onClick={() =>
              navigate({ name: "session", spec: { kind: "fiche", ficheId: fiche.id, variant: "quick" } })
            }
          >
            ⚡️ Question rapide
          </button>
          <button
            class="btn btn-secondary"
            onClick={() =>
              navigate({ name: "session", spec: { kind: "fiche", ficheId: fiche.id, variant: "hard" } })
            }
          >
            🔥 Question difficile
          </button>
          <button
            class="btn btn-secondary"
            disabled={related.length === 0}
            onClick={() => {
              const target = related[Math.floor(Math.random() * related.length)];
              if (target) navigate({ name: "fiche", id: target.id });
            }}
          >
            🔗 Une fiche liée
          </button>
        </div>
      </div>

      {related.length > 0 && (
        <div class="stack" style={{ gap: 8 }}>
          <h2 style={{ margin: 0, fontSize: 17 }}>À relier avec</h2>
          <p class="text-muted" style={{ margin: 0, fontSize: 13 }}>
            Une notion isolée s'oublie ; reliée à d'autres, elle tient.
          </p>
          <div class="list">
            {related.map((f) => (
              <FicheRow
                key={f.id}
                fiche={f}
                stats={bank.stats.get(f.id)}
                showDomain={f.domain !== fiche.domain ? FICHE_DOMAINS[f.domain] : undefined}
                onClick={() => navigate({ name: "fiche", id: f.id })}
              />
            ))}
          </div>
        </div>
      )}

      {next && (
        <button class="btn btn-secondary btn-block" onClick={() => navigate({ name: "fiche", id: next.id })}>
          Fiche suivante : {next.title} ›
        </button>
      )}
    </div>
  );
}

function MasteryCard({ stats }: { stats: FicheStats }) {
  if (stats.state === "non-etudie" && stats.attempts === 0) return null;

  const percent = stats.attempts > 0 ? Math.round(stats.accuracy * 100) : null;
  const pace =
    stats.paceRatio !== null
      ? stats.paceRatio <= 0.85
        ? "plus vite que le temps cible"
        : stats.paceRatio <= 1
          ? "dans le temps cible"
          : `${Math.round((stats.paceRatio - 1) * 100)} % plus lent que la cible`
      : null;

  return (
    <div class="card stack" style={{ gap: 6 }}>
      <div class="row">
        <strong style={{ fontSize: 15 }}>{FICHE_MASTERY_LABELS[stats.state]}</strong>
        {percent !== null && (
          <span class="text-muted" style={{ fontSize: 13.5 }}>
            {percent} % sur {stats.attempts} question{stats.attempts > 1 ? "s" : ""}
          </span>
        )}
      </div>
      <p class="text-muted" style={{ margin: 0, fontSize: 13.5 }}>
        {FICHE_MASTERY_HINTS[stats.state]}
        {pace && ` Rythme : ${pace}.`}
      </p>
      {stats.slowButCorrect && (
        <div class="fiche-callout fiche-callout-warning" style={{ marginTop: 4 }}>
          <span class="fiche-callout-icon" aria-hidden="true">
            ⏱️
          </span>
          <p style={{ margin: 0 }}>
            Tu réponds juste, mais trop lentement pour le concours. C'est un problème
            d'automatisation, pas de compréhension : enchaîne des séries courtes et chronométrées
            plutôt que de relire la fiche.
          </p>
        </div>
      )}
    </div>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}
