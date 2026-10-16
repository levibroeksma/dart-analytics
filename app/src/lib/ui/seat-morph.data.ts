/** Turn-switch duration and easing (Animations.dc.html §02). */
export const TURN_MS = 500;
export const TURN_EASE = "cubic-bezier(0.65, 0, 0.35, 1)";

const TWINS = ["name", "score"] as const;

type Box = Pick<DOMRect, "left" | "top" | "width" | "height">;

type MorphElement = {
  offsetHeight: number;
  animate(keyframes: Keyframe[], options: KeyframeAnimationOptions): unknown;
  getBoundingClientRect(): Box;
  querySelector(selector: string): MorphElement | null;
};

type CardCapture = {
  height: number;
  twins: Partial<Record<(typeof TWINS)[number], Box>>;
};

type SeatMorphContext = {
  captured: CardCapture[];
  $root: {
    querySelectorAll(selector: string): ArrayLike<MorphElement>;
    style: Pick<CSSStyleDeclaration, "setProperty">;
  };
  $watch(getter: () => unknown, callback: () => void): void;
  $nextTick(callback: () => void): void;
  cards(): MorphElement[];
  capture(): void;
  morph(): void;
};

/**
 * The FLIP start frame that draws an element laid out at `last` where it sat
 * at `first`: a translate plus a uniform scale by height, from the top-left.
 */
export function flipFrame(first: Box, last: Box): Keyframe {
  const scale = last.height === 0 ? 1 : first.height / last.height;
  return {
    transform: `translate(${first.left - last.left}px, ${first.top - last.top}px) scale(${scale})`,
    transformOrigin: "0 0",
  };
}

function relativeBox(el: MorphElement, card: MorphElement): Box {
  const own = el.getBoundingClientRect();
  const origin = card.getBoundingClientRect();
  return {
    left: own.left - origin.left,
    top: own.top - origin.top,
    width: own.width,
    height: own.height,
  };
}

function visibleTwin(card: MorphElement, twin: string): MorphElement | null {
  return card.querySelector(
    `[data-seat-visible="true"] [data-seat-twin="${twin}"]`,
  );
}

function reducedMotion(): boolean {
  return globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Alpine factory for `SplitScoreboard`'s turn switch. Each seat card
 * (`[data-seat-card]`) lays out both its panel and its bar layer at once and
 * marks the shown one `data-seat-visible="true"`; their name and score are
 * twins (`data-seat-twin`). When `activeKey` changes, every card's height
 * animates from the captured height to its new one and each visible twin
 * glides from where its counterpart sat. Each capture publishes the tallest
 * card's height as `--seat-full`, so the panel layer keeps its final layout
 * while its card is still growing. Reduced motion only re-captures.
 */
export function seatMorph(activeKey: () => unknown) {
  return {
    captured: [] as CardCapture[],

    init(this: SeatMorphContext) {
      this.$nextTick(() => this.capture());
      this.$watch(activeKey, () => this.$nextTick(() => this.morph()));
    },

    cards(this: SeatMorphContext): MorphElement[] {
      return Array.from(this.$root.querySelectorAll("[data-seat-card]"));
    },

    capture(this: SeatMorphContext) {
      this.captured = this.cards().map((card) => {
        const twins: CardCapture["twins"] = {};
        for (const twin of TWINS) {
          const el = visibleTwin(card, twin);
          if (el) twins[twin] = relativeBox(el, card);
        }
        return { height: card.offsetHeight, twins };
      });
      const full = Math.max(0, ...this.captured.map((card) => card.height));
      this.$root.style.setProperty("--seat-full", `${full}px`);
    },

    morph(this: SeatMorphContext) {
      if (reducedMotion()) {
        this.capture();
        return;
      }
      const timing = { duration: TURN_MS, easing: TURN_EASE };
      const moves = this.cards().map((card, index) => {
        const before = this.captured[index];
        const glides = TWINS.flatMap((twin) => {
          const el = visibleTwin(card, twin);
          const first = before?.twins[twin];
          return el && first
            ? [{ el, first, last: relativeBox(el, card) }]
            : [];
        });
        return { card, before, height: card.offsetHeight, glides };
      });
      for (const { card, before, height, glides } of moves) {
        if (before && before.height !== height) {
          card.animate(
            [{ height: `${before.height}px` }, { height: `${height}px` }],
            timing,
          );
        }
        for (const { el, first, last } of glides) {
          el.animate(
            [
              flipFrame(first, last),
              { transform: "none", transformOrigin: "0 0" },
            ],
            timing,
          );
        }
      }
      this.capture();
    },
  };
}
