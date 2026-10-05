// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { growingCard } from "@lib/ui/growing-card.data";

type Box = { top: number; left: number; width: number; height: number };

function withRect(el: HTMLElement, box: Box) {
  el.getBoundingClientRect = () =>
    ({
      ...box,
      right: box.left + box.width,
      bottom: box.top + box.height,
    }) as DOMRect;
  return el;
}

function setup() {
  const card = withRect(document.createElement("div"), {
    top: 200,
    left: 16,
    width: 300,
    height: 80,
  });
  const slot = withRect(document.createElement("div"), {
    top: 120,
    left: 16,
    width: 300,
    height: 80,
  });
  const ctx = Object.assign(growingCard(), { $refs: { card, slot } });
  return { ctx, card, slot };
}

function transitionEnd(propertyName: string) {
  return { propertyName } as TransitionEvent;
}

describe("growingCard", () => {
  let card: HTMLElement;
  let slot: HTMLElement;
  let ctx: ReturnType<typeof setup>["ctx"];

  beforeEach(() => {
    ({ ctx, card, slot } = setup());
  });

  it("starts closed", () => {
    expect(ctx.open).toBe(false);
  });

  it("pins the card at its current box before growing", () => {
    let pinned: Partial<CSSStyleDeclaration> = {};
    Object.defineProperty(card, "offsetWidth", {
      get: () => {
        const { position, top, left, width, height } = card.style;
        pinned = { position, top, left, width, height };
        return 300;
      },
    });

    ctx.toggle();

    expect(pinned).toEqual({
      position: "fixed",
      top: "200px",
      left: "16px",
      width: "300px",
      height: "80px",
    });
  });

  it("grows the card to the viewport inset by 1rem and opens", () => {
    ctx.toggle();

    expect(ctx.open).toBe(true);
    expect(card.style.position).toBe("fixed");
    expect(card.style.zIndex).toBe("50");
    expect(card.style.top).toBe("1rem");
    expect(card.style.left).toBe("1rem");
    expect(card.style.width).toBe("calc(100vw - 2rem)");
    expect(card.style.height).toBe("calc(100dvh - 2rem)");
  });

  it("locks the slot height so the page does not shift", () => {
    ctx.toggle();

    expect(slot.style.height).toBe("80px");
  });

  it("shrinks the card back to the slot box and closes", () => {
    ctx.toggle();
    ctx.toggle();

    expect(ctx.open).toBe(false);
    expect(card.style.top).toBe("120px");
    expect(card.style.left).toBe("16px");
    expect(card.style.width).toBe("300px");
    expect(card.style.height).toBe("80px");
  });

  it("returns the card to the flow once the close transition ends", () => {
    ctx.toggle();
    ctx.toggle();
    ctx.settle(transitionEnd("height"));

    expect(card.getAttribute("style")).toBeNull();
    expect(slot.style.height).toBe("");
  });

  it("keeps the card pinned when a transition ends while open", () => {
    ctx.toggle();
    ctx.settle(transitionEnd("height"));

    expect(card.style.position).toBe("fixed");
    expect(slot.style.height).toBe("80px");
  });

  it("waits for the height transition before settling", () => {
    ctx.toggle();
    ctx.toggle();
    ctx.settle(transitionEnd("top"));

    expect(card.style.position).toBe("fixed");
    expect(slot.style.height).toBe("80px");
  });
});
