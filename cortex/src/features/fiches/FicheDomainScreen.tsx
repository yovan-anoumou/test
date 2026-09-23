import { useEffect, useMemo, useState } from "preact/hooks";
import { navigate } from "../../router";
import {
  FICHE_DOMAINS,
  FICHE_FILTERS,
  FICHE_LEVELS,
  FICHE_LEVEL_LABELS,
  fichesByDomain,
  groupByCategory,
  matchesFicheFilter,
  searchFiches,
  type Fiche,
  type FicheDomainId,
  type FicheFilterId,
  type FicheLevel,
} from "../../domain/fiches";
import { ficheBank, loadFicheBank } from "../../services/ficheService";
import { BackLink, ChipRow, DomainChip, FicheRow, MasteryStack, SearchField } from "./FicheBits";

export function FicheDomainScreen({ domain }: { domain: FicheDomainId }) {
  const def = FICHE_DOMAINS[domain];
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FicheFilterId>("toutes");
  const [level, setLevel] = useState<FicheLevel | "tous">("tous");

  useEffect(() => {
    void loadFicheBank();
  }, []);

  // Repartir de zéro en changeant de domaine : les filtres d'un domaine
  // n'ont pas de sens dans un autre.
  useEffect(() => {
    setQuery("");
    setFilter("toutes");
    setLevel("tous");
  }, [domain]);

  const bank = ficheBank.value;
  const all = useMemo(() => fichesByDomain(bank.fiches, domain), [bank.fiches, domain]);
  const statsList = all.flatMap((f) => {
    const s = bank.stats.get(f.id);
    return s ? [s] : [];
  });

  const filtered = useMemo(() => {
    let list: Fiche[] = query.trim() ? searchFiches(all, query) : all;
    if (filter !== "toutes") {
      list = list.filter((f) => {
        const s = bank.stats.get(f.id);
        return s ? matchesFicheFilter(s, filter) : false;
      });
    }
    if (level !== "tous") list = list.filter((f) => f.level === level);
    return list;
  }, [all, bank.stats, query, filter, level]);

  const filterOptions = useMemo(
    () =>
      FICHE_FILTERS.map((f) => ({
        id: f.id,
        label: f.label,
        hint: f.hint,
        count:
          f.id === "toutes"
            ? all.length
            : statsList.filter((s) => matchesFicheFilter(s, f.id)).length,
      })),
    [all, bank.stats],
  );

  const grouped = groupByCategory(filtered);
  const showGroups = query.trim() === "" && grouped.length > 1;

  return (
    <div class="screen stack">
      <BackLink label="Fiches mémo" onClick={() => navigate({ name: "fiches" })} />

      <div class="row" style={{ gap: 12 }}>
        <DomainChip domain={def} size={52} />
        <div>
          <h1 style={{ margin: 0 }}>{def.label}</h1>
          <p class="text-muted" style={{ margin: "2px 0 0", fontSize: 14 }}>
            {def.tagline}
          </p>
        </div>
      </div>

      {statsList.length > 0 && (
        <div class="card stack" style={{ gap: 8 }}>
          <div class="row">
            <span style={{ fontWeight: 600, fontSize: 14.5 }}>
              {statsList.filter((s) => s.state === "maitrise" || s.state === "automatique").length} /{" "}
              {all.length} maîtrisées
            </span>
            <span class="text-muted" style={{ fontSize: 13 }}>
              {statsList.filter((s) => s.state === "automatique").length} automatiques
            </span>
          </div>
          <MasteryStack statsList={statsList} />
        </div>
      )}

      <SearchField value={query} onInput={setQuery} placeholder={`Rechercher dans ${def.label}`} />
      <ChipRow options={filterOptions} value={filter} onChange={setFilter} />
      <ChipRow
        options={[
          { id: "tous" as const, label: "Tous niveaux" },
          ...FICHE_LEVELS.map((l) => ({ id: l, label: FICHE_LEVEL_LABELS[l] })),
        ]}
        value={level}
        onChange={(v) => setLevel(v as FicheLevel | "tous")}
      />

      {bank.status === "loading" && <p class="text-muted">Chargement…</p>}

      {filtered.length === 0 ? (
        <div class="card">
          <p class="empty-state" style={{ margin: 0 }}>
            Aucune fiche ne correspond. Essaie un autre mot ou enlève un filtre.
          </p>
        </div>
      ) : showGroups ? (
        grouped.map((group) => (
          <div key={group.category} class="stack" style={{ gap: 6 }}>
            <h2 style={{ margin: 0, fontSize: 15, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--color-text-muted)" }}>
              {group.category}
            </h2>
            <div class="list">
              {group.fiches.map((f) => (
                <FicheRow
                  key={f.id}
                  fiche={f}
                  stats={bank.stats.get(f.id)}
                  onClick={() => navigate({ name: "fiche", id: f.id })}
                />
              ))}
            </div>
          </div>
        ))
      ) : (
        <div class="list">
          {filtered.map((f) => (
            <FicheRow
              key={f.id}
              fiche={f}
              stats={bank.stats.get(f.id)}
              onClick={() => navigate({ name: "fiche", id: f.id })}
            />
          ))}
        </div>
      )}
    </div>
  );
}
