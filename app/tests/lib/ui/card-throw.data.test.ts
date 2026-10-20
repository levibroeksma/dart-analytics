import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cardThrow } from "@lib/ui/card-throw.data";

function setup(reduced = false) {
  const navigate = vi.fn();
  const card = cardThrow({ navigate, reducedMotion: () => reduced });
  const event = { preventDefault: vi.fn() } as unknown as Event;
  return { card, navigate, event };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("cardThrow", () => {
  it("starts at rest", () => {
    expect(setup().card.phase).toBe("rest");
  });

  it("activate winds, throws at 170ms and navigates once at 550ms", () => {
    const { card, navigate, event } = setup();
    card.activate(event, "/games/x");
    expect(event.preventDefault).toHaveBeenCalled();
    expect(card.phase).toBe("wind");
    vi.advanceTimersByTime(169);
    expect(card.phase).toBe("wind");
    vi.advanceTimersByTime(1);
    expect(card.phase).toBe("throw");
    vi.advanceTimersByTime(379);
    expect(navigate).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith("/games/x");
    expect(card.phase).toBe("reset");
  });

  it("ignores a second tap while winding or throwing", () => {
    const { card, navigate, event } = setup();
    card.activate(event, "/games/x");
    card.activate(event, "/games/x");
    vi.advanceTimersByTime(170);
    card.activate(event, "/games/x");
    vi.advanceTimersByTime(1000);
    expect(navigate).toHaveBeenCalledTimes(1);
  });

  it("navigates immediately under reduced motion", () => {
    const { card, navigate, event } = setup(true);
    card.activate(event, "/games/x");
    expect(event.preventDefault).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith("/games/x");
    expect(card.phase).toBe("rest");
  });

  it("enter and leave toggle hover only from rest", () => {
    const { card, event } = setup();
    card.enter();
    expect(card.phase).toBe("hover");
    card.leave();
    expect(card.phase).toBe("rest");
    card.activate(event, "/games/x");
    card.enter();
    expect(card.phase).toBe("wind");
    card.leave();
    expect(card.phase).toBe("wind");
  });

  it.each([
    { metaKey: true },
    { ctrlKey: true },
    { shiftKey: true },
    { altKey: true },
    { button: 1 },
  ])("leaves a modified click %o to the browser", (mods) => {
    const { card, navigate } = setup();
    const event = {
      preventDefault: vi.fn(),
      button: 0,
      ...mods,
    } as unknown as Event;
    card.activate(event, "/games/x");
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(card.phase).toBe("rest");
    vi.advanceTimersByTime(1000);
    expect(navigate).not.toHaveBeenCalled();
  });

  it("raises the dart again from reset", () => {
    const { card, event } = setup();
    card.activate(event, "/games/x");
    vi.advanceTimersByTime(550);
    expect(card.phase).toBe("reset");
    card.enter();
    expect(card.phase).toBe("hover");
  });

  it("maps each phase to its dart class", () => {
    const { card } = setup();
    const expected = {
      rest: "",
      hover: "card-dart-hover",
      wind: "card-dart-wind",
      throw: "card-dart-throw",
      reset: "card-dart-reset",
    } as const;
    for (const [phase, cls] of Object.entries(expected)) {
      card.phase = phase as keyof typeof expected;
      expect(card.dartClass()).toBe(cls);
    }
  });
});
