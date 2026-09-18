import { useEffect, useRef, useState } from "preact/hooks";

export function useElapsedMs(active: boolean, resetKey: unknown): number {
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(performance.now());

  useEffect(() => {
    startRef.current = performance.now();
    setElapsed(0);
  }, [resetKey]);

  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => {
      setElapsed(performance.now() - startRef.current);
    }, 100);
    return () => window.clearInterval(id);
  }, [active]);

  return elapsed;
}

export function formatMs(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

interface TimerBadgeProps {
  elapsedMs: number;
  targetSeconds: number;
}

export function TimerBadge({ elapsedMs, targetSeconds }: TimerBadgeProps) {
  const ratio = elapsedMs / 1000 / targetSeconds;
  const tone = ratio < 0.85 ? "success" : ratio < 1.15 ? "warning" : "danger";
  return (
    <span class={`badge badge-${tone}`} title={`Temps cible : ${targetSeconds}s`}>
      {formatMs(elapsedMs)} / {formatMs(targetSeconds * 1000)}
    </span>
  );
}
