#!/usr/bin/env node
// Valide toutes les banques de fiches (public/fiches/*.json).
//
// Au-delà du schéma, le script vérifie deux choses qui cassent silencieusement
// l'app si elles sont fausses :
//   1. les `related` pointent vers des fiches qui existent réellement ;
//   2. les `tags` d'une fiche recoupent ceux de la banque de questions, sinon
//      le bouton « Me tester » de cette fiche ne proposerait aucune question.

import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const fichesDir = join(root, "public/fiches");
const questionsDir = join(root, "public/questions");

const DOMAINS = [
  "calcul",
  "logique",
  "vitesse",
  "anglais",
  "vocabulaire",
  "comprehension",
  "culture-generale",
  "methode",
];
const LEVELS = ["fondamental", "intermediaire", "avance"];
const BLOCK_TYPES = [
  "rule",
  "keyfacts",
  "example",
  "mnemonic",
  "warning",
  "table",
  "diagram",
  "quote",
  "quiz",
];
const DIAGRAM_KINDS = ["series-method", "reasoning-types", "percent-chain"];
const SUBTESTS = [
  "lexiphrase",
  "calcul",
  "logique-verbale-numerique",
  "paratexte",
  "logique-spatiale",
  "vocabulaire",
  "grammaire",
  "comprehension",
  "culture-generale",
  "raisonnement",
  "calcul-mental",
];

const errors = [];
const warnings = [];

function err(where, message) {
  errors.push(`${where}: ${message}`);
}
function warn(where, message) {
  warnings.push(`${where}: ${message}`);
}

// --- tags réellement présents dans la banque de questions -------------------
const questionTags = new Set();
for (const file of readdirSync(questionsDir).filter((f) => f.endsWith(".json"))) {
  const data = JSON.parse(readFileSync(join(questionsDir, file), "utf8"));
  for (const q of data) for (const t of q.tags ?? []) questionTags.add(t);
}

// --- chargement des fiches --------------------------------------------------
const files = readdirSync(fichesDir)
  .filter((f) => f.endsWith(".json"))
  .sort();
const all = [];
const seen = new Map();

function validateBlock(where, block, i) {
  const at = `${where} bloc #${i + 1}`;
  if (typeof block !== "object" || block === null) return err(at, "n'est pas un objet");
  if (!BLOCK_TYPES.includes(block.type)) return err(at, `type inconnu « ${block.type} »`);
  const str = (k) => typeof block[k] === "string" && block[k].trim().length > 0;
  const arrOfStr = (k) => Array.isArray(block[k]) && block[k].every((v) => typeof v === "string");

  switch (block.type) {
    case "rule":
    case "mnemonic":
      if (!str("title")) err(at, "`title` manquant");
      if (!str("body")) err(at, "`body` manquant");
      break;
    case "keyfacts":
      if (!str("title")) err(at, "`title` manquant");
      if (!arrOfStr("items") || block.items.length === 0) err(at, "`items` doit être une liste de textes");
      break;
    case "example":
      if (!str("prompt")) err(at, "`prompt` manquant");
      if (!str("reveal")) err(at, "`reveal` manquant");
      break;
    case "warning":
    case "quote":
      if (!str("body")) err(at, "`body` manquant");
      break;
    case "table":
      if (!arrOfStr("headers") || block.headers.length === 0) err(at, "`headers` invalide");
      else if (!Array.isArray(block.rows) || block.rows.length === 0) err(at, "`rows` invalide");
      else
        for (const [j, row] of block.rows.entries()) {
          if (!Array.isArray(row) || !row.every((c) => typeof c === "string")) {
            err(at, `ligne #${j + 1} : cellules non textuelles`);
          } else if (row.length !== block.headers.length) {
            err(at, `ligne #${j + 1} : ${row.length} cellules pour ${block.headers.length} colonnes`);
          }
        }
      break;
    case "diagram":
      if (!DIAGRAM_KINDS.includes(block.kind)) err(at, `kind inconnu « ${block.kind} »`);
      break;
    case "quiz":
      if (!str("question")) err(at, "`question` manquante");
      if (!str("answer")) err(at, "`answer` manquante");
      if (block.hint !== undefined && typeof block.hint !== "string") err(at, "`hint` doit être un texte");
      break;
  }
}

for (const file of files) {
  const data = JSON.parse(readFileSync(join(fichesDir, file), "utf8"));
  if (!Array.isArray(data)) {
    err(file, "le fichier doit contenir un tableau de fiches");
    continue;
  }
  for (const [i, f] of data.entries()) {
    const where = `${file}[${i}]${f?.id ? ` (${f.id})` : ""}`;
    if (typeof f !== "object" || f === null) {
      err(where, "n'est pas un objet");
      continue;
    }
    if (typeof f.id !== "string" || !/^[a-z0-9-]+$/.test(f.id)) {
      err(where, "`id` doit être en minuscules, chiffres et tirets");
    } else if (seen.has(f.id)) {
      err(where, `id en doublon (déjà dans ${seen.get(f.id)})`);
    } else {
      seen.set(f.id, file);
    }

    if (!DOMAINS.includes(f.domain)) err(where, `domaine inconnu « ${f.domain} »`);
    if (typeof f.category !== "string" || !f.category.trim()) err(where, "`category` manquante");
    if (typeof f.title !== "string" || !f.title.trim()) err(where, "`title` manquant");
    if (typeof f.tagline !== "string" || !f.tagline.trim()) err(where, "`tagline` (à retenir) manquante");
    else if (f.tagline.length > 200) warn(where, "`tagline` très longue (> 200 caractères)");
    if (!LEVELS.includes(f.level)) err(where, `niveau inconnu « ${f.level} »`);
    if (typeof f.readMinutes !== "number" || f.readMinutes < 1 || f.readMinutes > 20) {
      err(where, "`readMinutes` doit être un nombre entre 1 et 20");
    }
    if (!Array.isArray(f.tags) || f.tags.length === 0 || !f.tags.every((t) => typeof t === "string")) {
      err(where, "`tags` doit contenir au moins un tag");
    }
    if (!Array.isArray(f.related) || !f.related.every((t) => typeof t === "string")) {
      err(where, "`related` doit être une liste d'ids");
    }
    if (f.subtests !== undefined) {
      if (!Array.isArray(f.subtests)) err(where, "`subtests` doit être une liste");
      else for (const st of f.subtests) if (!SUBTESTS.includes(st)) err(where, `sous-test inconnu « ${st} »`);
    }
    if (f.updatedAt !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(f.updatedAt)) {
      err(where, "`updatedAt` doit être au format AAAA-MM-JJ");
    }
    if (!Array.isArray(f.blocks) || f.blocks.length === 0) {
      err(where, "`blocks` ne peut pas être vide");
    } else {
      f.blocks.forEach((b, j) => validateBlock(where, b, j));
      const types = f.blocks.map((b) => b.type);
      if (!types.includes("quiz")) warn(where, "aucune mini-question (bloc `quiz`)");
      if (!types.includes("example") && !types.includes("table") && !types.includes("keyfacts")) {
        warn(where, "aucun exemple concret (ni `example`, ni `table`, ni `keyfacts`)");
      }
    }
    all.push({ ...f, __file: file });
  }
}

// --- vérifications croisées -------------------------------------------------
const ids = new Set(all.map((f) => f.id));
let unlinked = 0;
for (const f of all) {
  for (const rel of f.related ?? []) {
    if (rel === f.id) err(`${f.__file} (${f.id})`, "se référence elle-même dans `related`");
    else if (!ids.has(rel)) err(`${f.__file} (${f.id})`, `\`related\` pointe vers une fiche inexistante « ${rel} »`);
  }
  if ((f.related ?? []).length === 0) warn(`${f.__file} (${f.id})`, "aucune fiche liée (`related` vide)");

  const linked = (f.tags ?? []).filter((t) => questionTags.has(t));
  if (linked.length === 0) {
    unlinked++;
    warn(`${f.__file} (${f.id})`, "aucun tag en commun avec la banque de questions — « Me tester » sera vide");
  }
}

// --- rapport ----------------------------------------------------------------
const byDomain = {};
for (const f of all) byDomain[f.domain] = (byDomain[f.domain] ?? 0) + 1;

console.log(`${all.length} fiches dans ${files.length} fichiers`);
for (const d of DOMAINS) console.log(`  ${d.padEnd(18)} ${byDomain[d] ?? 0}`);
console.log(`Fiches sans question liée : ${unlinked}`);

if (warnings.length > 0) {
  console.log(`\n⚠️  ${warnings.length} avertissement(s) :`);
  for (const w of warnings.slice(0, 40)) console.log(`  - ${w}`);
  if (warnings.length > 40) console.log(`  … et ${warnings.length - 40} autre(s)`);
}

if (errors.length > 0) {
  console.error(`\n❌ ${errors.length} erreur(s) :`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log("\n✅ Toutes les fiches sont valides.");
