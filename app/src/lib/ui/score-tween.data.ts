/** How long a falling score counts down (Animations.dc.html §03). */
export const SCORE_TWEEN_MS = 700;

type ScoreTweenContext = {
  display: unknown;
  frame: number | null;
  $watch(
    getter: () => unknown,
    callback: (next: unknown, previous: unknown) => void,
  ): void;
  count(from: number, to: number): void;
};

function asNumber(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return typeof value !== "boolean" && value !== "" && Number.isFinite(parsed)
    ? parsed
    : null;
}

function reducedMotion(): boolean {
  return globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Alpine factory for a score that counts down: `display` follows `read()`,
 * and when a number falls it eases there over `SCORE_TWEEN_MS` (ease-out
 * cubic, one frame per `requestAnimationFrame`). A rise, a non-number or
 * reduced motion shows the new value at once.
 */
export function scoreTween(read: () => unknown) {
  return {
    display: read() as unknown,
    frame: null as number | null,

    init(this: ScoreTweenContext) {
      this.$watch(read, (next, previous) => {
        if (this.frame !== null) cancelAnimationFrame(this.frame);
        this.frame = null;
        const to = asNumber(next);
        const from = asNumber(previous);
        if (to === null || from === null || to >= from || reducedMotion()) {
          this.display = next;
          return;
        }
        this.count(from, to);
      });
    },

    count(this: ScoreTweenContext, from: number, to: number) {
      const start = performance.now();
      const step = (now: number) => {
        const progress = Math.min(1, (now - start) / SCORE_TWEEN_MS);
        const eased = 1 - Math.pow(1 - progress, 3);
        this.display = Math.round(from - (from - to) * eased);
        this.frame = progress < 1 ? requestAnimationFrame(step) : null;
      };
      this.frame = requestAnimationFrame(step);
    },
  };
}
