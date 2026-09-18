interface HeatmapProps {
  /** Map "YYYY-MM-DD" -> nombre de réponses ce jour-là. */
  countsByDay: Map<string, number>;
  weeks?: number;
}

function levelFor(count: number): 0 | 1 | 2 | 3 | 4 {
  if (count === 0) return 0;
  if (count < 5) return 1;
  if (count < 15) return 2;
  if (count < 30) return 3;
  return 4;
}

/** Heatmap d'activité type GitHub, dernières N semaines, en colonnes (une colonne = une semaine). */
export function Heatmap({ countsByDay, weeks = 12 }: HeatmapProps) {
  const today = new Date();
  const days: { date: string; count: number }[] = [];
  for (let i = weeks * 7 - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    days.push({ date: key, count: countsByDay.get(key) ?? 0 });
  }

  const columns: { date: string; count: number }[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    columns.push(days.slice(i, i + 7));
  }

  return (
    <div class="heatmap" role="img" aria-label={`Activité des ${weeks} dernières semaines`}>
      {columns.map((col, ci) => (
        <div class="heatmap-col" key={ci}>
          {col.map((day) => (
            <div
              key={day.date}
              class={`heatmap-cell level-${levelFor(day.count)}`}
              title={`${day.date} : ${day.count} réponse${day.count > 1 ? "s" : ""}`}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
