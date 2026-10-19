import { prefersReducedMotion } from "@lib/ui/motion";
import type { CardThrowDeps, CardThrowPhase } from "@lib/types";

/** Delay from the tap until the dart is thrown. */
const THROW_AT_MS = 170;

/** Delay from the tap until the card navigates. */
const NAVIGATE_AT_MS = 550;

const PHASE_CLASS: Record<CardThrowPhase, string> = {
  rest: "",
  hover: "card-dart-hover",
  wind: "card-dart-wind",
  throw: "card-dart-throw",
  reset: "card-dart-reset",
};

function assignLocation(href: string): void {
  window.location.assign(href);
}

function opensElsewhere(event: Event): boolean {
  const click = event as Partial<MouseEvent>;
  return Boolean(
    click.metaKey ||
    click.ctrlKey ||
    click.shiftKey ||
    click.altKey ||
    (click.button !== undefined && click.button !== 0),
  );
}

function later(fn: () => void, ms: number): void {
  setTimeout(fn, ms);
}

/**
 * Alpine factory for a game `CatalogCard`'s dart. Hover raises the dart
 * from rest; a tap winds it back, throws it at `THROW_AT_MS` and navigates
 * at `NAVIGATE_AT_MS`. A modified click (new tab) is left to the browser. A tap during wind or throw is ignored, and under
 * reduced motion the tap navigates at once. `dartClass()` is the CSS class
 * for the current phase.
 */
export function cardThrow(deps: CardThrowDeps = {}) {
  const navigate = deps.navigate ?? assignLocation;
  const reducedMotion = deps.reducedMotion ?? prefersReducedMotion;
  const schedule = deps.schedule ?? later;

  return {
    phase: "rest" as CardThrowPhase,

    enter() {
      if (this.phase === "rest" || this.phase === "reset") this.phase = "hover";
    },

    leave() {
      if (this.phase === "hover" || this.phase === "reset") this.phase = "rest";
    },

    activate(event: Event, href: string) {
      if (opensElsewhere(event)) return;
      event.preventDefault();
      if (this.phase === "wind" || this.phase === "throw") return;
      if (reducedMotion()) {
        navigate(href);
        return;
      }
      this.phase = "wind";
      schedule(() => {
        this.phase = "throw";
      }, THROW_AT_MS);
      schedule(() => {
        navigate(href);
        this.phase = "reset";
      }, NAVIGATE_AT_MS);
    },

    dartClass(): string {
      return PHASE_CLASS[this.phase];
    },
  };
}
