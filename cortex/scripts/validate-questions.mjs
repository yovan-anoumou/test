// Valide toutes les banques de questions dans public/questions/*.json contre
// le schéma attendu par l'app (voir public/questions/SCHEMA.md).
// Usage : npm run validate:questions
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const QUESTIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "questions");

const VALID_MODULES = new Set(["tage2", "anglais", "culture-generale", "raisonnement", "calcul-mental"]);
const VALID_SUBTESTS = new Set([
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
]);

function validateQuestion(q, file, index, seenIds) {
  const errors = [];
  const where = `${file}[${index}]${q && q.id ? ` (${q.id})` : ""}`;

  if (typeof q !== "object" || q === null) return [`${where}: n'est pas un objet`];
  if (typeof q.id !== "string" || !q.id) errors.push(`${where}: id manquant ou invalide`);
  else if (seenIds.has(q.id)) errors.push(`${where}: id dupliqué "${q.id}"`);
  else seenIds.add(q.id);

  if (!VALID_MODULES.has(q.module)) errors.push(`${where}: module invalide "${q.module}"`);
  if (!VALID_SUBTESTS.has(q.subtest)) errors.push(`${where}: subtest invalide "${q.subtest}"`);
  if (!Number.isInteger(q.difficulty) || q.difficulty < 1 || q.difficulty > 5) {
    errors.push(`${where}: difficulty doit être un entier 1-5`);
  }
  if (q.type !== "mcq") errors.push(`${where}: type doit être "mcq"`);
  if (q.passage !== null && typeof q.passage !== "string") {
    errors.push(`${where}: passage doit être null ou une chaîne`);
  }
  if (typeof q.statement !== "string" || !q.statement) errors.push(`${where}: statement manquant`);
  if (!Array.isArray(q.choices) || q.choices.length < 2) {
    errors.push(`${where}: choices doit être un tableau d'au moins 2 éléments`);
  } else {
    if (!q.choices.every((c) => typeof c === "string")) {
      errors.push(`${where}: toutes les choices doivent être des chaînes`);
    }
    if (
      !Number.isInteger(q.correctIndex) ||
      q.correctIndex < 0 ||
      q.correctIndex >= q.choices.length
    ) {
      errors.push(`${where}: correctIndex hors bornes`);
    }
    const exp = q.explanation;
    if (typeof exp !== "object" || exp === null) {
      errors.push(`${where}: explanation manquant`);
    } else {
      if (typeof exp.why_correct !== "string" || !exp.why_correct) {
        errors.push(`${where}: explanation.why_correct manquant`);
      }
      if (!Array.isArray(exp.why_others_wrong) || exp.why_others_wrong.length !== q.choices.length) {
        errors.push(`${where}: explanation.why_others_wrong doit avoir la même longueur que choices`);
      } else if (Number.isInteger(q.correctIndex) && exp.why_others_wrong[q.correctIndex] !== "") {
        errors.push(`${where}: explanation.why_others_wrong[correctIndex] doit être ""`);
      }
      if (typeof exp.method !== "string" || !exp.method) {
        errors.push(`${where}: explanation.method manquant`);
      }
    }
  }
  if (typeof q.targetTimeSeconds !== "number" || q.targetTimeSeconds <= 0) {
    errors.push(`${where}: targetTimeSeconds doit être un nombre positif`);
  }
  if (!Array.isArray(q.tags) || !q.tags.every((t) => typeof t === "string")) {
    errors.push(`${where}: tags doit être un tableau de chaînes`);
  }

  return errors;
}

function main() {
  const files = readdirSync(QUESTIONS_DIR).filter((f) => f.endsWith(".json"));
  if (files.length === 0) {
    console.error(`Aucun fichier .json trouvé dans ${QUESTIONS_DIR}`);
    process.exit(1);
  }

  let totalQuestions = 0;
  let totalErrors = 0;
  const globalIds = new Set();

  for (const file of files) {
    const path = join(QUESTIONS_DIR, file);
    let data;
    try {
      data = JSON.parse(readFileSync(path, "utf-8"));
    } catch (err) {
      console.error(`✗ ${file}: JSON invalide — ${err.message}`);
      totalErrors++;
      continue;
    }
    if (!Array.isArray(data)) {
      console.error(`✗ ${file}: doit contenir un tableau JSON`);
      totalErrors++;
      continue;
    }

    const fileErrors = [];
    data.forEach((q, i) => fileErrors.push(...validateQuestion(q, file, i, globalIds)));

    totalQuestions += data.length;
    if (fileErrors.length > 0) {
      totalErrors += fileErrors.length;
      console.error(`✗ ${file}: ${data.length} questions, ${fileErrors.length} erreur(s)`);
      fileErrors.forEach((e) => console.error(`    - ${e}`));
    } else {
      console.log(`✓ ${file}: ${data.length} questions OK`);
    }
  }

  console.log(`\nTotal : ${totalQuestions} questions dans ${files.length} fichiers.`);
  if (totalErrors > 0) {
    console.error(`${totalErrors} erreur(s) au total.`);
    process.exit(1);
  }
  console.log("Toutes les questions sont valides.");
}

main();
