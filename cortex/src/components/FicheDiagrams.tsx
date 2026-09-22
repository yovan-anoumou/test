// Mini "cartes mentales" en SVG inline pour les fiches mémo — légères, sans
// dépendance, lisibles en clair comme en sombre (couleurs via CSS variables).

const TEXT_COLOR = "var(--color-text)";
const MUTED_COLOR = "var(--color-text-muted)";
const LINE_COLOR = "var(--color-border)";

interface StepDiagramStep {
  title: string;
  detail: string;
}

const SERIES_STEPS: StepDiagramStep[] = [
  { title: "1. Écarts", detail: "Différence entre termes consécutifs" },
  { title: "2. Ratios", detail: "Multiplication / division constante" },
  { title: "3. Écarts des écarts", detail: "Les écarts forment-ils une suite ?" },
  { title: "4. Suites imbriquées", detail: "1 terme sur 2 (pairs / impairs)" },
];

export function SeriesMethodDiagram() {
  const stepHeight = 84;
  const startY = 36;
  const height = startY + (SERIES_STEPS.length - 1) * stepHeight + 40;

  return (
    <svg
      viewBox={`0 0 320 ${height}`}
      width="100%"
      height={height}
      role="img"
      aria-label="Méthode en 4 étapes pour débloquer une série numérique : écarts, ratios, écarts des écarts, suites imbriquées"
    >
      <line
        x1="28"
        y1={startY}
        x2="28"
        y2={startY + (SERIES_STEPS.length - 1) * stepHeight}
        stroke="var(--color-purple)"
        stroke-width="2.5"
        stroke-dasharray="1 8"
        stroke-linecap="round"
      />
      {SERIES_STEPS.map((step, i) => {
        const y = startY + i * stepHeight;
        return (
          <g key={step.title}>
            <circle cx="28" cy={y} r="15" fill="var(--color-purple-bg)" stroke="var(--color-purple)" stroke-width="2" />
            <text x="28" y={y + 5} text-anchor="middle" font-size="14" font-weight="700" fill="var(--color-purple)">
              {i + 1}
            </text>
            <text x="56" y={y - 3} font-size="14" font-weight="700" fill={TEXT_COLOR}>
              {step.title.replace(/^\d+\.\s*/, "")}
            </text>
            <text x="56" y={y + 16} font-size="12" fill={MUTED_COLOR}>
              {step.detail}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

interface ReasoningNode {
  label: string;
  detail: string;
  x: number;
  y: number;
  detailDy: number;
}

const CENTER_X = 170;
const CENTER_Y = 160;

const REASONING_NODES: ReasoningNode[] = [
  { label: "Déductif", detail: "Règle → cas (certain)", x: CENTER_X, y: 52, detailDy: -22 },
  { label: "Inductif", detail: "Cas → règle (probable)", x: 285, y: CENTER_Y, detailDy: 44 },
  { label: "Analogie", detail: "Par ressemblance", x: CENTER_X, y: 268, detailDy: 44 },
  { label: "Absurde", detail: "Par contradiction", x: 55, y: CENTER_Y, detailDy: 44 },
];

export function ReasoningTypesDiagram() {
  return (
    <svg
      viewBox="0 0 340 320"
      width="100%"
      height={280}
      role="img"
      aria-label="Quatre types de raisonnement : déductif, inductif, par analogie, par l'absurde"
    >
      {REASONING_NODES.map((n) => (
        <line
          key={`line-${n.label}`}
          x1={CENTER_X}
          y1={CENTER_Y}
          x2={n.x}
          y2={n.y}
          stroke={LINE_COLOR}
          stroke-width="1.5"
        />
      ))}
      <circle cx={CENTER_X} cy={CENTER_Y} r="38" fill="var(--color-purple)" />
      <text x={CENTER_X} y={CENTER_Y - 2} text-anchor="middle" font-size="11" font-weight="700" fill="#fff">
        <tspan x={CENTER_X} dy="0">Raison-</tspan>
        <tspan x={CENTER_X} dy="13">nement</tspan>
      </text>
      {REASONING_NODES.map((n) => (
        <g key={n.label}>
          <circle cx={n.x} cy={n.y} r="28" fill="var(--color-purple-bg)" stroke="var(--color-purple)" stroke-width="2" />
          <text x={n.x} y={n.y + 4} text-anchor="middle" font-size="12" font-weight="700" fill="var(--color-purple)">
            {n.label}
          </text>
          <text x={n.x} y={n.y + n.detailDy} text-anchor="middle" font-size="10.5" fill={MUTED_COLOR}>
            {n.detail}
          </text>
        </g>
      ))}
    </svg>
  );
}

export function PercentChainDiagram() {
  const boxes = [
    { label: "80 €" },
    { label: "92 €" },
    { label: "82,80 €" },
  ];
  const ops = ["× 1,15", "× 0,9"];
  const boxWidth = 92;
  const boxHeight = 48;
  const gap = 38;
  const y = 20;

  return (
    <svg
      viewBox="0 0 360 90"
      width="100%"
      height={90}
      role="img"
      aria-label="80 euros, multiplié par 1,15 puis par 0,9, donne 82,80 euros — les pourcentages successifs s'enchaînent en multipliant, pas en additionnant"
    >
      {boxes.map((box, i) => {
        const x = i * (boxWidth + gap);
        return (
          <g key={box.label}>
            <rect
              x={x}
              y={y}
              width={boxWidth}
              height={boxHeight}
              rx="10"
              fill="var(--color-success-bg)"
              stroke="var(--color-success)"
              stroke-width="2"
            />
            <text
              x={x + boxWidth / 2}
              y={y + boxHeight / 2 + 5}
              text-anchor="middle"
              font-size="15"
              font-weight="700"
              fill="var(--color-success)"
            >
              {box.label}
            </text>
          </g>
        );
      })}
      {ops.map((op, i) => {
        const x1 = i * (boxWidth + gap) + boxWidth;
        const x2 = x1 + gap;
        const midY = y + boxHeight / 2;
        return (
          <g key={op}>
            <line x1={x1 + 4} y1={midY} x2={x2 - 6} y2={midY} stroke={MUTED_COLOR} stroke-width="1.5" />
            <polygon points={`${x2 - 6},${midY - 4} ${x2 - 6},${midY + 4} ${x2},${midY}`} fill={MUTED_COLOR} />
            <text x={(x1 + x2) / 2} y={midY - 10} text-anchor="middle" font-size="12" font-weight="700" fill={TEXT_COLOR}>
              {op}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
