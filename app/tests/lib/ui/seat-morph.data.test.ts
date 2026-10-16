import { describe, it, expect, vi, afterEach } from "vitest";
import {
  TURN_EASE,
  TURN_MS,
  flipFrame,
  seatMorph,
} from "@lib/ui/seat-morph.data";

type FakeEl = {
  offsetHeight: number;
  animate: ReturnType<typeof vi.fn>;
  getBoundingClientRect: () => DOMRect;
  querySelector: (selector: string) => FakeEl | null;
};

const rect = (left: number, top: number, width: number, height: number) =>
  ({ left, top, width, height }) as DOMRect;

function fakeTwin(box: DOMRect): FakeEl {
  return {
    offsetHeight: box.height,
    animate: vi.fn(),
    getBoundingClientRect: () => box,
    querySelector: () => null,
  };
}

function fakeCard(height: number, twins: Record<string, FakeEl>): FakeEl {
  const card: FakeEl = {
    offsetHeight: height,
    animate: vi.fn(),
    getBoundingClientRect: () => rect(0, 0, 358, card.offsetHeight),
    querySelector: (selector: string) => {
      const name = selector.match(/data-seat-twin="(\w+)"/)?.[1];
      return name ? (twins[name] ?? null) : null;
    },
  };
  return card;
}

function morphOver(cards: FakeEl[], reduced = false): any {
  vi.stubGlobal("matchMedia", () => ({ matches: reduced }));
  const morph = Object.assign(
    seatMorph(() => "a"),
    {
      $root: {
        querySelectorAll: () => cards,
        style: { setProperty: vi.fn() },
      },
      $watch: vi.fn(),
      $nextTick: (fn: () => void) => fn(),
    },
  );
  return morph;
}

afterEach(() => vi.unstubAllGlobals());

describe("flipFrame", () => {
  it("translates from the first box to the last and scales by height", () => {
    expect(flipFrame(rect(30, 16, 40, 24), rect(60, 80, 120, 64))).toEqual({
      transform: "translate(-30px, -64px) scale(0.375)",
      transformOrigin: "0 0",
    });
  });

  it("is the identity when nothing moved", () => {
    expect(flipFrame(rect(4, 4, 10, 10), rect(4, 4, 10, 10))).toEqual({
      transform: "translate(0px, 0px) scale(1)",
      transformOrigin: "0 0",
    });
  });
});

describe("seatMorph", () => {
  it("uses the turn token timing", () => {
    expect(TURN_MS).toBe(500);
    expect(TURN_EASE).toBe("cubic-bezier(0.65, 0, 0.35, 1)");
  });

  it("animates each card's height from the captured to the new height", () => {
    const score = fakeTwin(rect(250, 20, 40, 24));
    const card = fakeCard(64, { score });
    const morph = morphOver([card]);
    morph.capture();
    card.offsetHeight = 228;
    morph.morph();
    expect(card.animate).toHaveBeenCalledWith(
      [{ height: "64px" }, { height: "228px" }],
      { duration: TURN_MS, easing: TURN_EASE },
    );
  });

  it("glides a shared twin from its old box to its new one", () => {
    const twinBox = { current: rect(250, 20, 40, 24) };
    const score: FakeEl = {
      ...fakeTwin(twinBox.current),
      getBoundingClientRect: () => twinBox.current,
    };
    const card = fakeCard(64, { score });
    const morph = morphOver([card]);
    morph.capture();
    twinBox.current = rect(100, 80, 160, 64);
    morph.morph();
    expect(score.animate).toHaveBeenCalledWith(
      [
        {
          transform: "translate(150px, -60px) scale(0.375)",
          transformOrigin: "0 0",
        },
        { transform: "none", transformOrigin: "0 0" },
      ],
      { duration: TURN_MS, easing: TURN_EASE },
    );
  });

  it("publishes the tallest card's height as --seat-full", () => {
    const morph = morphOver([fakeCard(228, {}), fakeCard(64, {})]);
    morph.capture();
    expect(morph.$root.style.setProperty).toHaveBeenCalledWith(
      "--seat-full",
      "228px",
    );
  });

  it("skips every animation under reduced motion", () => {
    const score = fakeTwin(rect(250, 20, 40, 24));
    const card = fakeCard(64, { score });
    const morph = morphOver([card], true);
    morph.capture();
    card.offsetHeight = 228;
    morph.morph();
    expect(card.animate).not.toHaveBeenCalled();
    expect(score.animate).not.toHaveBeenCalled();
  });
});
