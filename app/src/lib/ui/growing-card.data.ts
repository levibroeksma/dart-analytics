type BoxStyle = Pick<CSSStyleDeclaration, "top" | "left" | "width" | "height">;

type GrowingCardContext = {
  open: boolean;
  $refs: { card: HTMLElement; slot: HTMLElement };
  $dispatch(name: string): void;
};

const EXPANDED_BOX: BoxStyle = {
  top: "1rem",
  left: "1rem",
  width: "calc(100vw - 2rem)",
  height: "calc(100dvh - 2rem)",
};

function boxOf(el: HTMLElement): BoxStyle {
  const { top, left, width, height } = el.getBoundingClientRect();
  return {
    top: `${top}px`,
    left: `${left}px`,
    width: `${width}px`,
    height: `${height}px`,
  };
}

function pin(card: HTMLElement, box: BoxStyle) {
  Object.assign(card.style, { position: "fixed", zIndex: "50", ...box });
}

/**
 * Alpine factory for GrowingCard: the card grows from its in-flow box to
 * cover the viewport inset by 1rem, and shrinks back. The slot keeps the
 * card's height while it is pinned, so the page beneath does not shift;
 * inline styles are cleared once the closing `height` transition ends.
 * Expanding dispatches `expand`, so the caller can load what the open card
 * shows.
 */
export function growingCard() {
  return {
    open: false,

    expand(this: GrowingCardContext) {
      if (this.open) return;
      const { card, slot } = this.$refs;
      const origin = boxOf(card);
      slot.style.height = origin.height;
      pin(card, origin);
      void card.offsetWidth;
      pin(card, EXPANDED_BOX);
      this.open = true;
      this.$dispatch("expand");
    },

    collapse(this: GrowingCardContext) {
      const { card, slot } = this.$refs;
      pin(card, boxOf(slot));
      this.open = false;
    },

    settle(this: GrowingCardContext, event: TransitionEvent) {
      if (this.open || event.propertyName !== "height") return;
      this.$refs.card.removeAttribute("style");
      this.$refs.slot.style.height = "";
    },
  };
}
