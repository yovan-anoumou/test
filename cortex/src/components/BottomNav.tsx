import type { ComponentType } from "preact";
import { currentRoute, navigate, type Route } from "../router";
import { HomeIcon, ChartIcon, ClockIcon, GearIcon } from "./icons";

const ITEMS: { route: Route["name"]; label: string; Icon: ComponentType }[] = [
  { route: "home", label: "Accueil", Icon: HomeIcon },
  { route: "dashboard", label: "Progrès", Icon: ChartIcon },
  { route: "history", label: "Historique", Icon: ClockIcon },
  { route: "settings", label: "Réglages", Icon: GearIcon },
];

export function BottomNav() {
  const active = currentRoute.value.name;

  return (
    <nav class="bottom-nav">
      {ITEMS.map(({ route, label, Icon }) => (
        <button
          key={route}
          class={`bottom-nav-item${active === route ? " active" : ""}`}
          onClick={() => navigate({ name: route } as Route)}
          aria-current={active === route ? "page" : undefined}
        >
          <span class="bottom-nav-icon" aria-hidden="true">
            <Icon />
          </span>
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}
