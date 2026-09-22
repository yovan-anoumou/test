import type { ComponentType } from "preact";
import { currentRoute, navigate, type Route } from "../router";
import { HomeIcon, BookIcon, ChartIcon, ClockIcon, GearIcon } from "./icons";

const ITEMS: { target: Route; matches: Route["name"][]; label: string; Icon: ComponentType }[] = [
  { target: { name: "home" }, matches: ["home"], label: "Accueil", Icon: HomeIcon },
  {
    target: { name: "fiches" },
    matches: ["fiches", "fiches-domain", "fiche"],
    label: "Fiches",
    Icon: BookIcon,
  },
  { target: { name: "dashboard" }, matches: ["dashboard"], label: "Progrès", Icon: ChartIcon },
  { target: { name: "history" }, matches: ["history"], label: "Historique", Icon: ClockIcon },
  { target: { name: "settings" }, matches: ["settings"], label: "Réglages", Icon: GearIcon },
];

export function BottomNav() {
  const active = currentRoute.value.name;

  return (
    <nav class="bottom-nav">
      {ITEMS.map(({ target, matches, label, Icon }) => {
        const isActive = matches.includes(active);
        return (
          <button
            key={label}
            class={`bottom-nav-item${isActive ? " active" : ""}`}
            onClick={() => navigate(target)}
            aria-current={isActive ? "page" : undefined}
          >
            <span class="bottom-nav-icon" aria-hidden="true">
              <Icon />
            </span>
            <span>{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
