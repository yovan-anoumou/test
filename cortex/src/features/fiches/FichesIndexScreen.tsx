import { useEffect, useMemo, useState } from "preact/hooks";
import { navigate } from "../../router";
import {
  FICHE_DOMAINS,
  FICHE_DOMAIN_IDS,
  FICHE_FILTERS,
  FICHE_LEVELS,
  FICHE_LEVEL_LABELS,
  fichesByDomain,
  matchesFicheFilter,
  searchFiches,
  type Fiche,
  type FicheDomain,
  type FicheFilterId,
  type FicheLevel,
  type FicheStats,
} from "../../domain/fiches";
import { ficheBank, loadFicheBank, priorityFiches } from "../../services/ficheService";
import { BackLink, ChipRow, DomainChip, FicheRow, MasteryStack, SearchField } from "./FicheBits";

/** Durées proposées par « J'ai N minutes ». */
const TIME_OPTIONS = [5, 10, 15, 30, 60];

export function FichesIndexScreen() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FicheFilterId>("toutes");
  const [level, setLevel] = useState<FicheLevel | "tous">("tous");

  useEffect(() => {
    void loadFicheBank();
  }, []);

  const bank = ficheBank.value;
  const stats = bank.stats;

  const filtered = useMemo(() => {
    let list: Fiche[] = query.trim() ? searchFiches(bank.fiches, query) : bank.fiches;
    if (filter !== "toutes") {
      list = list.filter((f) => {
        const s = stats.get(f.id);
        return s ? matchesFicheFilter(s, filter) : false;
      });
    }
    if (level !== "tous") list = list.filter((f) => f.level === level);
    return list;
  }, [bank.fiches, stats, query, filter, level]);

  const filterOptions = useMemo(
    () =>
      FICHE_FILTERS.map((f) => ({
        id: f.id,
        label: f.label,
        hint: f.hint,
        count:
          f.id === "toutes"
            ? bank.fiches.length
            : Array.from(stats.values()).filter((s) => matchesFicheFilter(s, f.id)).length,
      })),
    [bank.fiches, stats],
  );

  const browsing = query.trim() === "" && filter === "toutes" && level === "tous";
  const priority = browsing ? priorityFiches(3) : [];

  return (
    <div class="screen stack">
      <h1>Fiches mémo</h1>
      <p class="text-muted">
        {bank.fiches.length} fiches pour poser les bases, comprendre les pièges et relier les
        notions entre elles — en complément des QCM, pas à leur place.
      </p>

      <SearchField
        value={query}
        onInput={setQuery}
        placeholder="Rechercher une notion, un mot, une règle…"
      />

      <ChipRow options={filterOptions} value={filter} onChange={setFilter} />
      <ChipRow
        options={[
          { id: "tous" as const, label: "Tous niveaux" },
          ...FICHE_LEVELS.map((l) => ({ id: l, label: FICHE_LEVEL_LABELS[l] })),
        ]}
        value={level}
        onChange={(v) => setLevel(v as FicheLevel | "tous")}
      />

      {bank.status === "loading" && <p class="text-muted">Chargement des fiches…</p>}
      {bank.status === "error" && (
        <div class="card stack" style={{ gap: 8 }}>
          <strong>Impossible de charger les fiches</strong>
          <p class="text-muted" style={{ margin: 0, fontSize: 14 }}>
            {bank.error}
          </p>
          <button class="btn btn-secondary" onClick={() => void loadFicheBank(true)}>
            Réessayer
          </button>
        </div>
      )}

      {browsing ? (
        <>
          <TimeBlock />

          {priority.length > 0 && (
            <div class="stack" style={{ gap: 8 }}>
              <h2 style={{ margin: 0, fontSize: 18 }}>À travailler en priorité</h2>
              <p class="text-muted" style={{ margin: 0, fontSize: 13 }}>
                D'après tes réponses aux QCM liés à ces notions.
              </p>
              <div class="list">
                {priority.map(({ fiche, stats: s }) => (
                  <FicheRow
                    key={fiche.id}
                    fiche={fiche}
                    stats={s}
                    showDomain={FICHE_DOMAINS[fiche.domain]}
                    onClick={() => navigate({ name: "fiche", id: fiche.id })}
                  />
                ))}
              </div>
            </div>
          )}

          <div class="stack" style={{ gap: 8 }}>
            <h2 style={{ margin: 0, fontSize: 18 }}>Par domaine</h2>
            <div class="list">
              {FICHE_DOMAIN_IDS.map((id) => (
                <DomainRow key={id} domain={FICHE_DOMAINS[id]} fiches={bank.fiches} stats={stats} />
              ))}
            </div>
          </div>

          <div class="card stack" style={{ gap: 6 }}>
            <h3 style={{ margin: 0 }}>Comment bien les utiliser</h3>
            <p style={{ margin: 0, fontSize: 14 }}>
              Réponds à la mini-question <em>avant</em> de dérouler la réponse : l'effort de rappel
              actif retient bien mieux qu'une relecture. Puis lance « Me tester » pour transformer la
              règle en réflexe — une fiche n'est vraiment acquise que quand tu réponds vite, pas
              seulement juste.
            </p>
          </div>
        </>
      ) : (
        <div class="stack" style={{ gap: 8 }}>
          <div class="row">
            <h2 style={{ margin: 0, fontSize: 18 }}>
              {filtered.length} fiche{filtered.length > 1 ? "s" : ""}
            </h2>
            <BackLink
              label="Tout afficher"
              onClick={() => {
                setQuery("");
                setFilter("toutes");
                setLevel("tous");
              }}
            />
          </div>
          {filtered.length === 0 ? (
            <div class="card">
              <p class="empty-state" style={{ margin: 0 }}>
                Aucune fiche ne correspond. Essaie un autre mot ou enlève un filtre.
              </p>
            </div>
          ) : (
            <div class="list">
              {filtered.map((f) => (
                <FicheRow
                  key={f.id}
                  fiche={f}
                  stats={stats.get(f.id)}
                  showDomain={FICHE_DOMAINS[f.domain]}
                  onClick={() => navigate({ name: "fiche", id: f.id })}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TimeBlock() {
  return (
    <div class="card stack" style={{ gap: 10 }}>
      <div class="stack" style={{ gap: 2 }}>
        <h3 style={{ margin: 0 }}>J'ai quelques minutes</h3>
        <p class="text-muted" style={{ margin: 0, fontSize: 13.5 }}>
          Cortex choisit ce qui te rapporte le plus dans le temps que tu as.
        </p>
      </div>
      <div class="chip-row">
        {TIME_OPTIONS.map((m) => (
          <button
            key={m}
            class="chip"
            onClick={() => navigate({ name: "session", spec: { kind: "time", minutes: m } })}
          >
            {m} min
          </button>
        ))}
      </div>
    </div>
  );
}

function DomainRow({
  domain,
  fiches,
  stats,
}: {
  domain: FicheDomain;
  fiches: Fiche[];
  stats: Map<string, FicheStats>;
}) {
  const inDomain = fichesByDomain(fiches, domain.id);
  const statsList = inDomain.flatMap((f) => {
    const s = stats.get(f.id);
    return s ? [s] : [];
  });
  const studied = statsList.filter((s) => s.state !== "non-etudie").length;

  return (
    <button class="list-row" onClick={() => navigate({ name: "fiches-domain", domain: domain.id })}>
      <span class="row" style={{ gap: 12, minWidth: 0 }}>
        <DomainChip domain={domain} />
        <span class="stack" style={{ gap: 3, minWidth: 0 }}>
          <span style={{ fontWeight: 600 }}>{domain.label}</span>
          <span class="text-muted" style={{ fontSize: 12.5 }}>
            {inDomain.length} fiche{inDomain.length > 1 ? "s" : ""}
            {studied > 0 && ` · ${studied} entamée${studied > 1 ? "s" : ""}`}
          </span>
          {studied > 0 && (
            <span style={{ display: "block", width: 130, marginTop: 3 }}>
              <MasteryStack statsList={statsList} />
            </span>
          )}
        </span>
      </span>
      <span class="text-muted" aria-hidden="true">
        ›
      </span>
    </button>
  );
}
