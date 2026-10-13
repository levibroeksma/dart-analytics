import type { ReadyGateView } from "./types";

function clock(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  return `${minutes}:${String(totalSeconds % 60).padStart(2, "0")}`;
}

/**
 * The routine ready gate's copy: `n STEPS · m MIN` (minutes rounded up)
 * and one row per step — two-digit number, title, `m:ss`.
 */
export function readyGate(
  steps: readonly { title: string; durationSeconds: number }[],
): ReadyGateView {
  const totalSeconds = steps.reduce(
    (sum, step) => sum + step.durationSeconds,
    0,
  );
  const noun = steps.length === 1 ? "STEP" : "STEPS";
  return {
    eyebrow: `${steps.length} ${noun} · ${Math.ceil(totalSeconds / 60)} MIN`,
    rows: steps.map((step, index) => ({
      number: String(index + 1).padStart(2, "0"),
      title: step.title,
      duration: clock(step.durationSeconds),
    })),
  };
}
