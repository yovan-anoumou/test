import { navigate } from "../../router";
import { FICHE_DOMAINS, getFicheById, getFichesByDomain } from "../../domain/fiches";
import type { FicheDomainId } from "../../domain/fiches/types";
import type { SkillAreaId } from "../../domain/skills";
import { FicheBlockView } from "./FicheBlockView";

/** Domaine de fiches → domaine de compétences, pour enchaîner sur un entraînement ciblé. */
function areaForFicheDomain(domain: FicheDomainId): SkillAreaId {
  return domain === "vocabulaire" ? "vocabulaire" : domain;
}

export function FicheDetailScreen({ id }: { id: string }) {
  const fiche = getFicheById(id);

  if (!fiche) {
    return (
      <div class="screen stack">
        <h2>Fiche introuvable</h2>
        <button class="btn btn-primary btn-block" onClick={() => navigate({ name: "fiches" })}>
          Retour aux fiches
        </button>
      </div>
    );
  }

  const def = FICHE_DOMAINS[fiche.domain];
  const siblings = getFichesByDomain(fiche.domain);
  const index = siblings.findIndex((f) => f.id === fiche.id);
  const next = siblings[index + 1];

  return (
    <div class="screen stack">
      <button
        class="text-muted"
        style={{ background: "none", border: "none", padding: 0, fontSize: 15, cursor: "pointer", textAlign: "left" }}
        onClick={() => navigate({ name: "fiches-domain", domain: fiche.domain })}
      >
        ‹ {def.label}
      </button>

      <div>
        <span class="badge" style={{ background: `var(--color-${def.color}-bg, rgba(0,122,255,0.12))`, color: `var(--color-${def.color}, var(--color-accent))` }}>
          {def.emoji} {def.label}
        </span>
        <h1 style={{ margin: "10px 0 2px" }}>{fiche.title}</h1>
        <p class="text-muted" style={{ margin: 0, fontSize: 14 }}>
          {fiche.tagline} · {fiche.readMinutes} min de lecture
        </p>
      </div>

      <div class="card stack" style={{ gap: 20 }}>
        {fiche.blocks.map((block, i) => (
          <FicheBlockView key={i} block={block} />
        ))}
      </div>

      <button
        class="btn btn-primary btn-block"
        onClick={() =>
          navigate({ name: "session", spec: { kind: "learning", area: areaForFicheDomain(fiche.domain) } })
        }
      >
        🎯 S'entraîner sur ces notions
      </button>

      {next && (
        <button class="btn btn-secondary btn-block" onClick={() => navigate({ name: "fiche", id: next.id })}>
          Fiche suivante : {next.title} ›
        </button>
      )}
    </div>
  );
}
