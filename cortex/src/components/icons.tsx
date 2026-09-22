// Icônes ligne simples, dans l'esprit SF Symbols (trait 1.8, coins arrondis).
// Pas de dépendance à une librairie d'icônes : quelques SVG inline suffisent ici.
// La couleur suit `currentColor` (gérée par le CSS de l'élément parent).

const common = {
  width: 24,
  height: 24,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  "stroke-width": 1.8,
  "stroke-linecap": "round" as const,
  "stroke-linejoin": "round" as const,
};

export function HomeIcon() {
  return (
    <svg {...common}>
      <path d="M4 11.5 12 4l8 7.5" />
      <path d="M6 10v9a1 1 0 0 0 1 1h3v-5h4v5h3a1 1 0 0 0 1-1v-9" />
    </svg>
  );
}

export function ChartIcon() {
  return (
    <svg {...common}>
      <rect x="4" y="13" width="4" height="7" rx="1" />
      <rect x="10" y="9" width="4" height="11" rx="1" />
      <rect x="16" y="5" width="4" height="15" rx="1" />
    </svg>
  );
}

export function ClockIcon() {
  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="8.2" />
      <path d="M12 8v4.3l3 1.9" />
    </svg>
  );
}

export function GearIcon() {
  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3.5c.6 0 1.2.05 1.8.15l.6 2.1c.6.2 1.1.45 1.6.75l2-1 1.6 1.6-1 2c.3.5.55 1 .75 1.6l2.1.6c.1.6.15 1.2.15 1.8s-.05 1.2-.15 1.8l-2.1.6c-.2.6-.45 1.1-.75 1.6l1 2-1.6 1.6-2-1c-.5.3-1 .55-1.6.75l-.6 2.1c-.6.1-1.2.15-1.8.15s-1.2-.05-1.8-.15l-.6-2.1c-.6-.2-1.1-.45-1.6-.75l-2 1-1.6-1.6 1-2c-.3-.5-.55-1-.75-1.6l-2.1-.6C3.55 13.2 3.5 12.6 3.5 12s.05-1.2.15-1.8l2.1-.6c.2-.6.45-1.1.75-1.6l-1-2 1.6-1.6 2 1c.5-.3 1-.55 1.6-.75l.6-2.1c.6-.1 1.2-.15 1.8-.15Z" />
    </svg>
  );
}
