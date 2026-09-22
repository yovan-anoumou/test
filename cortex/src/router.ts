import { signal } from "@preact/signals";
import type { SessionKind } from "./domain/session-builder";

export type Route =
  | { name: "home" }
  | { name: "session"; mode: SessionKind }
  | { name: "mock-exam" }
  | { name: "dashboard" }
  | { name: "history" }
  | { name: "settings" }
  | { name: "onboarding" };

function parseSessionMode(param: string | undefined): SessionKind {
  if (param === "short" || param === "weak-review") return param;
  return "daily";
}

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
    default:
      return { name: "home" };
  }
}

export const currentRoute = signal<Route>(parseHash(window.location.hash));

window.addEventListener("hashchange", () => {
  currentRoute.value = parseHash(window.location.hash);
});

export function navigate(route: Route): void {
  const path =
    route.name === "session"
      ? `session/${route.mode}`
      : route.name === "home"
        ? ""
        : route.name;
  window.location.hash = `#/${path}`;
}
