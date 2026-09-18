interface LineChartProps {
  points: { label: string; value: number }[];
  /** Valeur max de l'axe Y, défaut 1 (proportions 0-1). */
  maxValue?: number;
  height?: number;
}

/** Mini graphique en aire, sans dépendance, pour la courbe d'évolution du dashboard. */
export function LineChart({ points, maxValue = 1, height = 120 }: LineChartProps) {
  if (points.length === 0) return null;
  const width = 320;
  const stepX = width / Math.max(1, points.length - 1);

  const coords = points.map((p, i) => ({
    x: i * stepX,
    y: height - (Math.min(p.value, maxValue) / maxValue) * height,
  }));

  const linePath = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L${coords[coords.length - 1].x.toFixed(1)},${height} L0,${height} Z`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height={height}
      preserveAspectRatio="none"
      role="img"
      aria-label="Évolution du taux de réussite"
    >
      <path d={areaPath} fill="var(--color-accent)" opacity="0.12" />
      <path d={linePath} fill="none" stroke="var(--color-accent)" stroke-width="2" />
    </svg>
  );
}
