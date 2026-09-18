import { signal } from "@preact/signals";

export type Route =
  | { name: "home" }
  | { name: "session"; length: "short" | "daily" }
  | { name: "mock-exam" }
  | { name: "dashboard" }
  | { name: "history" }
  | { name: "settings" }
  | { name: "onboarding" };

function parseHash(hash: string): Route {
  const path = hash.replace(/^#\/?/, "");
  const [name, param] = path.split("/");
  switch (name) {
    case "session":
      return { name: "session", length: param === "short" ? "short" : "daily" };
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
      ? `session/${route.length}`
      : route.name === "home"
        ? ""
        : route.name;
  window.location.hash = `#/${path}`;
}
