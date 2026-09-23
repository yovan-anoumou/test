// Chargement de la banque de fiches (public/fiches/*.json) et sélecteurs.
//
// Même approche que la banque de questions : fichiers JSON servis statiquement,
// chargés une seule fois et mis en cache en mémoire. Le service worker les met
// en cache pour le mode hors ligne.

import {
  FICHE_DOMAINS,
  FICHE_FILES,
  FICHE_LEVELS,
  type Fiche,
  type FicheBlock,
  type FicheDomainId,
  type FicheLevel,
} from "./types";
import { FICHE_DOMAIN_IDS } from "./types";

let cache: Fiche[] | null = null;
let loadPromise: Promise<Fiche[]> | null = null;

const BLOCK_TYPES = new Set<FicheBlock["type"]>([
  "rule",
  "keyfacts",
  "example",
  "mnemonic",
  "warning",
  "table",
  "diagram",
  "quote",
  "quiz",
]);

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === "string");
}

function isValidBlock(value: unknown): value is FicheBlock {
  if (typeof value !== "object" || value === null) return false;
  const b = value as Record<string, unknown>;
  if (typeof b.type !== "string" || !BLOCK_TYPES.has(b.type as FicheBlock["type"])) return false;
  switch (b.type) {
    case "rule":
    case "mnemonic":
      return typeof b.title === "string" && typeof b.body === "string";
    case "keyfacts":
      return typeof b.title === "string" && isStringArray(b.items) && b.items.length > 0;
    case "example":
      return typeof b.prompt === "string" && typeof b.reveal === "string";
    case "warning":
    case "quote":
      return typeof b.body === "string";
    case "table":
      return (
        isStringArray(b.headers) &&
        Array.isArray(b.rows) &&
        b.rows.every((r) => isStringArray(r) && r.length === (b.headers as string[]).length)
      );
    case "diagram":
      return b.kind === "series-method" || b.kind === "reasoning-types" || b.kind === "percent-chain";
    case "quiz":
      return (
        typeof b.question === "string" &&
        typeof b.answer === "string" &&
        (b.hint === undefined || typeof b.hint === "string")
      );
    default:
      return false;
  }
}

export function isValidFiche(value: unknown): value is Fiche {
  if (typeof value !== "object" || value === null) return false;
  const f = value as Record<string, unknown>;
  return (
    typeof f.id === "string" &&
    f.id.length > 0 &&
    typeof f.domain === "string" &&
    FICHE_DOMAIN_IDS.includes(f.domain as FicheDomainId) &&
    typeof f.category === "string" &&
    typeof f.title === "string" &&
    typeof f.tagline === "string" &&
    typeof f.level === "string" &&
    FICHE_LEVELS.includes(f.level as FicheLevel) &&
    typeof f.readMinutes === "number" &&
    isStringArray(f.tags) &&
    isStringArray(f.related) &&
    (f.subtests === undefined || isStringArray(f.subtests)) &&
    (f.updatedAt === undefined || typeof f.updatedAt === "string") &&
    Array.isArray(f.blocks) &&
    f.blocks.length > 0 &&
    f.blocks.every(isValidBlock)
  );
}

/** Charge toutes les fiches. Résultat mis en cache pour la durée de la session. */
export async function loadFiches(): Promise<Fiche[]> {
  if (cache) return cache;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    const results = await Promise.all(
      FICHE_FILES.map(async (file) => {
        try {
          const res = await fetch(`${import.meta.env.BASE_URL}fiches/${file}.json`);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = (await res.json()) as unknown;
          if (!Array.isArray(data)) throw new Error("format invalide (attendu: tableau)");
          const valid: Fiche[] = [];
          for (const item of data) {
            if (isValidFiche(item)) valid.push(item);
            else console.warn(`[fiches] fiche invalide ignorée dans ${file}.json`, item);
          }
          return valid;
        } catch (err) {
          console.error(`[fiches] échec du chargement de ${file}.json`, err);
          return [];
        }
      }),
    );
    const byId = new Map<string, Fiche>();
    for (const fiche of results.flat()) byId.set(fiche.id, fiche);
    cache = Array.from(byId.values());
    return cache;
  })();

  return loadPromise;
}

/** Fiches déjà chargées, sans déclencher de chargement (null si pas encore prêt). */
export function loadedFiches(): Fiche[] | null {
  return cache;
}

// ---------------------------------------------------------------------------
// Sélecteurs (purs, sur une liste déjà chargée)
// ---------------------------------------------------------------------------

export function fichesByDomain(all: Fiche[], domain: FicheDomainId): Fiche[] {
  return all.filter((f) => f.domain === domain);
}

export function ficheById(all: Fiche[], id: string): Fiche | undefined {
  return all.find((f) => f.id === id);
}

export function relatedFiches(all: Fiche[], fiche: Fiche): Fiche[] {
  const byId = new Map(all.map((f) => [f.id, f]));
  const out: Fiche[] = [];
  for (const id of fiche.related) {
    const found = byId.get(id);
    if (found && found.id !== fiche.id) out.push(found);
  }
  return out;
}

/** Regroupe les fiches d'un domaine par sous-catégorie, en gardant l'ordre du fichier. */
export function groupByCategory(fiches: Fiche[]): { category: string; fiches: Fiche[] }[] {
  const groups = new Map<string, Fiche[]>();
  for (const fiche of fiches) {
    const list = groups.get(fiche.category);
    if (list) list.push(fiche);
    else groups.set(fiche.category, [fiche]);
  }
  return Array.from(groups, ([category, list]) => ({ category, fiches: list }));
}

export function normalizeSearch(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

/**
 * Recherche plein texte : titre et « à retenir » d'abord, puis catégorie, tags
 * et corps des blocs. Tous les mots de la requête doivent être trouvés.
 */
export function searchFiches(all: Fiche[], query: string): Fiche[] {
  const words = normalizeSearch(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return all;

  const scored: { fiche: Fiche; score: number }[] = [];
  for (const fiche of all) {
    const strong = normalizeSearch(`${fiche.title} ${fiche.tagline}`);
    const medium = normalizeSearch(`${fiche.category} ${fiche.tags.join(" ")}`);
    const weak = normalizeSearch(blockText(fiche));

    let score = 0;
    let matchedAll = true;
    for (const word of words) {
      if (strong.includes(word)) score += 6;
      else if (medium.includes(word)) score += 3;
      else if (weak.includes(word)) score += 1;
      else {
        matchedAll = false;
        break;
      }
    }
    if (matchedAll) scored.push({ fiche, score });
  }
  return scored.sort((a, b) => b.score - a.score).map((s) => s.fiche);
}

function blockText(fiche: Fiche): string {
  const parts: string[] = [];
  for (const block of fiche.blocks) {
    switch (block.type) {
      case "rule":
      case "mnemonic":
        parts.push(block.title, block.body);
        break;
      case "keyfacts":
        parts.push(block.title, ...block.items);
        break;
      case "example":
        parts.push(block.prompt, block.reveal);
        break;
      case "warning":
      case "quote":
        parts.push(block.body);
        break;
      case "table":
        parts.push(...block.headers, ...block.rows.flat());
        break;
      case "quiz":
        parts.push(block.question, block.answer);
        break;
      case "diagram":
        break;
    }
  }
  return parts.join(" ");
}

/** Mini-questions d'une fiche (blocs `quiz`). */
export function ficheQuizzes(fiche: Fiche): Extract<FicheBlock, { type: "quiz" }>[] {
  return fiche.blocks.filter((b): b is Extract<FicheBlock, { type: "quiz" }> => b.type === "quiz");
}

export { FICHE_DOMAINS };
