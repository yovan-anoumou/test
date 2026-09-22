import { signal } from "@preact/signals";
import type { FicheDomainId } from "./domain/fiches/types";
import { SKILL_AREA_IDS, type SkillAreaId } from "./domain/skills";

/** Ce qu'une session doit contenir — décidé par l'URL, exécuté par SessionScreen. */
export type SessionSpec =
  | { kind: "daily" }
  | { kind: "short" }
  | { kind: "weak-review" }
  | { kind: "learning"; area: SkillAreaId | null }
  | { kind: "focus"; area: SkillAreaId; minutes: number }
  | { kind: "plan"; blockId: string };

export type Route =
  | { name: "home" }
  | { name: "session"; spec: SessionSpec }
  | { name: "mock-exam" }
  | { name: "dashboard" }
  | { name: "history" }
  | { name: "settings" }
  | { name: "onboarding" }
  | { name: "fiches" }
  | { name: "fiches-domain"; domain: FicheDomainId }
  | { name: "fiche"; id: string }
  | { name: "diagnostic" }
  | { name: "diagnostic-result"; id: string }
  | { name: "plan" };

const FICHE_DOMAIN_IDS: FicheDomainId[] = [
  "calcul",
  "logique",
  "anglais",
  "vocabulaire",
  "culture-generale",
];

function parseArea(value: string | undefined): SkillAreaId | null {
  return SKILL_AREA_IDS.find((a) => a === value) ?? null;
}

function parseSessionSpec(p1: string | undefined, p2: string | undefined, p3: string | undefined): SessionSpec {
  switch (p1) {
    case "short":
      return { kind: "short" };
    case "weak-review":
      return { kind: "weak-review" };
    case "learning":
      return { kind: "learning", area: parseArea(p2) };
    case "focus": {
      const area = parseArea(p2);
      const minutes = Number(p3);
      if (area && Number.isFinite(minutes) && minutes > 0) {
        return { kind: "focus", area, minutes };
      }
      return { kind: "daily" };
    }
    case "plan":
      return p2 ? { kind: "plan", blockId: p2 } : { kind: "daily" };
    default:
      return { kind: "daily" };
  }
}

function sessionPath(spec: SessionSpec): string {
  switch (spec.kind) {
    case "learning":
      return spec.area ? `session/learning/${spec.area}` : "session/learning";
    case "focus":
      return `session/focus/${spec.area}/${spec.minutes}`;
    case "plan":
      return `session/plan/${spec.blockId}`;
    default:
      return `session/${spec.kind}`;
  }
}

function parseHash(hash: string): Route {
  const path = hash.replace(/^#\/?/, "");
  const [name, p1, p2, p3] = path.split("/");
  switch (name) {
    case "session":
      return { name: "session", spec: parseSessionSpec(p1, p2, p3) };
    case "mock-exam":
      return { name: "mock-exam" };
    case "dashboard":
      return { name: "dashboard" };
    case "history":
      return { name: "history" };
    case "settings":
      return { name: "settings" };
    case "onboarding":
      return { name: "onboarding" };
    case "diagnostic":
      return p1 ? { name: "diagnostic-result", id: p1 } : { name: "diagnostic" };
    case "plan":
      return { name: "plan" };
    case "fiche":
      return p1 ? { name: "fiche", id: p1 } : { name: "fiches" };
    case "fiches": {
      const domain = FICHE_DOMAIN_IDS.find((d) => d === p1);
      return domain ? { name: "fiches-domain", domain } : { name: "fiches" };
    }
    default:
      return { name: "home" };
  }
}

export const currentRoute = signal<Route>(parseHash(window.location.hash));

window.addEventListener("hashchange", () => {
  currentRoute.value = parseHash(window.location.hash);
});

export function navigate(route: Route): void {
  let path: string;
  switch (route.name) {
    case "session":
      path = sessionPath(route.spec);
      break;
    case "fiches-domain":
      path = `fiches/${route.domain}`;
      break;
    case "fiche":
      path = `fiche/${route.id}`;
      break;
    case "diagnostic-result":
      path = `diagnostic/${route.id}`;
      break;
    case "home":
      path = "";
      break;
    default:
      path = route.name;
  }
  window.location.hash = `#/${path}`;
}
