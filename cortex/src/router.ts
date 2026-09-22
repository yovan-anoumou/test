import { signal } from "@preact/signals";
import type { SessionKind } from "./domain/session-builder";
import type { FicheDomainId } from "./domain/fiches/types";

export type Route =
  | { name: "home" }
  | { name: "session"; mode: SessionKind }
  | { name: "mock-exam" }
  | { name: "dashboard" }
  | { name: "history" }
  | { name: "settings" }
  | { name: "onboarding" }
  | { name: "fiches" }
  | { name: "fiches-domain"; domain: FicheDomainId }
  | { name: "fiche"; id: string };

function parseSessionMode(param: string | undefined): SessionKind {
  if (param === "short" || param === "weak-review") return param;
  return "daily";
}

const FICHE_DOMAIN_IDS: FicheDomainId[] = [
  "calcul",
  "logique",
  "anglais",
  "vocabulaire",
  "culture-generale",
];

function parseHash(hash: string): Route {
  const path = hash.replace(/^#\/?/, "");
  const [name, param] = path.split("/");
  switch (name) {
    case "session":
      return { name: "session", mode: parseSessionMode(param) };
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
    case "fiche":
      return param ? { name: "fiche", id: param } : { name: "fiches" };
    case "fiches": {
      const domain = FICHE_DOMAIN_IDS.find((d) => d === param);
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
      path = `session/${route.mode}`;
      break;
    case "fiches-domain":
      path = `fiches/${route.domain}`;
      break;
    case "fiche":
      path = `fiche/${route.id}`;
      break;
    case "home":
      path = "";
      break;
    default:
      path = route.name;
  }
  window.location.hash = `#/${path}`;
}
