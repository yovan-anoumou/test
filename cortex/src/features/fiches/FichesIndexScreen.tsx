import { navigate } from "../../router";
import { FICHE_DOMAINS, getFichesByDomain } from "../../domain/fiches";
import type { FicheDomain } from "../../domain/fiches/types";

export function FichesIndexScreen() {
  const domains = Object.values(FICHE_DOMAINS);

  return (
    <div class="screen stack">
      <h1>Fiches mémo</h1>
      <p class="text-muted">
        Les bases à connaître, pour compléter l'entraînement par QCM — pas pour le remplacer.
      </p>

      <div class="card stack" style={{ gap: 6 }}>
        <h3 style={{ margin: 0 }}>Comment bien les utiliser</h3>
        <p style={{ margin: 0, fontSize: 14 }}>
          Lis une fiche, essaie de répondre aux exemples avant de regarder la solution (l'effort de
          rappel actif retient bien mieux qu'une lecture passive), puis va t'entraîner en session pour
          ancrer la notion dans ta mémoire à long terme.
        </p>
      </div>

      <div class="list">
        {domains.map((d) => (
          <DomainRow key={d.id} domain={d} />
        ))}
      </div>
    </div>
  );
}

function DomainRow({ domain }: { domain: FicheDomain }) {
  const count = getFichesByDomain(domain.id).length;
  return (
    <button
      class="list-row"
      onClick={() => navigate({ name: "fiches-domain", domain: domain.id })}
    >
      <span class="row" style={{ gap: 12 }}>
        <span
          class="domain-chip"
          style={{ background: `var(--color-${domain.color}-bg, rgba(0,122,255,0.12))` }}
          aria-hidden="true"
        >
          {domain.emoji}
        </span>
        <span class="stack" style={{ gap: 1 }}>
          <span style={{ fontWeight: 600 }}>{domain.label}</span>
          <span class="text-muted" style={{ fontSize: 12.5 }}>
            {count} fiche{count > 1 ? "s" : ""}
          </span>
        </span>
      </span>
      <span class="text-muted" aria-hidden="true">
        ›
      </span>
    </button>
  );
}
