interface MasteryBarProps {
  /** 0-100. */
  value: number;
  color?: string;
  height?: number;
}

/** Barre de maîtrise : verte au-dessus de 85 %, orange dès 60 %, rouge en dessous. */
export function masteryColor(value: number): string {
  if (value >= 85) return "var(--color-success)";
  if (value >= 60) return "var(--color-warning)";
  return "var(--color-danger)";
}

export function MasteryBar({ value, color, height = 8 }: MasteryBarProps) {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div class="stat-bar-track" style={{ height }} role="img" aria-label={`${Math.round(clamped)} %`}>
      <div
        class="stat-bar-fill"
        style={{ width: `${clamped}%`, background: color ?? masteryColor(clamped) }}
      />
    </div>
  );
}
