import { currentRoute, navigate, type Route } from "../router";

const ITEMS: { route: Route["name"]; label: string; icon: string }[] = [
  { route: "home", label: "Accueil", icon: "⌂" },
  { route: "dashboard", label: "Progrès", icon: "◔" },
  { route: "history", label: "Historique", icon: "≡" },
  { route: "settings", label: "Réglages", icon: "⚙" },
];

export function BottomNav() {
  const active = currentRoute.value.name;

  return (
    <nav class="bottom-nav">
      {ITEMS.map((item) => (
        <button
          key={item.route}
          class={`bottom-nav-item${active === item.route ? " active" : ""}`}
          onClick={() => navigate({ name: item.route } as Route)}
          aria-current={active === item.route ? "page" : undefined}
        >
          <span class="bottom-nav-icon" aria-hidden="true">
            {item.icon}
          </span>
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  );
}
