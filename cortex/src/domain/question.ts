import type { ModuleId, SubtestId } from "./modules";

export interface QuestionExplanation {
  why_correct: string;
  /** Même longueur que `choices`; chaîne vide à l'index correct. */
  why_others_wrong: string[];
  method: string;
}

export interface Question {
  id: string;
  module: ModuleId;
  subtest: SubtestId;
  /** 1 = très facile, 5 = très difficile. */
  difficulty: 1 | 2 | 3 | 4 | 5;
  type: "mcq";
  /** Texte de contexte partagé (paratexte, compréhension anglaise). */
  passage: string | null;
  statement: string;
  choices: string[];
  correctIndex: number;
  explanation: QuestionExplanation;
  targetTimeSeconds: number;
  tags: string[];
}

export function isValidQuestion(q: unknown): q is Question {
  if (typeof q !== "object" || q === null) return false;
  const r = q as Record<string, unknown>;
  if (typeof r.id !== "string" || !r.id) return false;
  if (typeof r.module !== "string") return false;
  if (typeof r.subtest !== "string") return false;
  if (typeof r.difficulty !== "number" || r.difficulty < 1 || r.difficulty > 5) return false;
  if (r.type !== "mcq") return false;
  if (r.passage !== null && typeof r.passage !== "string") return false;
  if (typeof r.statement !== "string" || !r.statement) return false;
  if (!Array.isArray(r.choices) || r.choices.length < 2) return false;
  if (!r.choices.every((c) => typeof c === "string")) return false;
  if (
    typeof r.correctIndex !== "number" ||
    r.correctIndex < 0 ||
    r.correctIndex >= r.choices.length
  )
    return false;
  const exp = r.explanation as Record<string, unknown> | undefined;
  if (typeof exp !== "object" || exp === null) return false;
  if (typeof exp.why_correct !== "string" || !exp.why_correct) return false;
  if (!Array.isArray(exp.why_others_wrong)) return false;
  if (exp.why_others_wrong.length !== r.choices.length) return false;
  if (typeof exp.method !== "string" || !exp.method) return false;
  if (typeof r.targetTimeSeconds !== "number" || r.targetTimeSeconds <= 0) return false;
  if (!Array.isArray(r.tags) || !r.tags.every((t) => typeof t === "string")) return false;
  return true;
}
