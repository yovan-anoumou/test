import { navigate } from "../../router";
import { FICHE_DOMAINS, getFichesByDomain } from "../../domain/fiches";
import type { FicheDomainId } from "../../domain/fiches/types";

export function FicheDomainScreen({ domain }: { domain: FicheDomainId }) {
  const def = FICHE_DOMAINS[domain];
  const fiches = getFichesByDomain(domain);

  return (
    <div class="screen stack">
      <button
        class="text-muted"
        style={{ background: "none", border: "none", padding: 0, fontSize: 15, cursor: "pointer", textAlign: "left" }}
        onClick={() => navigate({ name: "fiches" })}
      >
        ‹ Fiches mémo
      </button>

      <div class="row" style={{ gap: 12 }}>
        <span
          class="domain-chip"
          style={{ background: `var(--color-${def.color}-bg, rgba(0,122,255,0.12))`, width: 52, height: 52, fontSize: 26 }}
          aria-hidden="true"
        >
          {def.emoji}
        </span>
        <div>
          <h1 style={{ margin: 0 }}>{def.label}</h1>
          <p class="text-muted" style={{ margin: "2px 0 0", fontSize: 14 }}>
            {def.tagline}
          </p>
        </div>
      </div>

      <div class="list">
        {fiches.map((f) => (
          <button key={f.id} class="list-row" onClick={() => navigate({ name: "fiche", id: f.id })}>
            <span class="stack" style={{ gap: 1 }}>
              <span style={{ fontWeight: 600 }}>{f.title}</span>
              <span class="text-muted" style={{ fontSize: 12.5 }}>
                {f.tagline} · {f.readMinutes} min
              </span>
            </span>
            <span class="text-muted" aria-hidden="true">
              ›
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
