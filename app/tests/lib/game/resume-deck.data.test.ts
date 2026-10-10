import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { resumeDeck, toResumeCards } from "@lib/game/resume-deck.data";
import { summarizeProgress } from "@modules/game/session-progress.module";
import type { LocalGame, ResumeDeckContext } from "@lib/types";
import * as sessionsApi from "@client/api/sessions";

vi.mock("@client/api/sessions");
vi.mock("@modules/game/session-progress.module", () => ({
  summarizeProgress: vi.fn(),
}));

const NOW = new Date("2026-10-10T12:00:00.000Z");

const session = (overrides: Record<string, unknown> = {}) =>
  ({
    sessionId: "s-501",
    gameTypeKey: "X01",
    gameTypeName: "X01",
    captureModeKey: "RECREATIONAL",
    inputModeKey: "QUICK_SCORE",
    rulesetVersionKey: "501_V1",
    isRoutineStep: false,
    progress: {
      detail: "vs Dartbot · Leg 3",
      big: { value: "170", label: "TO GO" },
    },
    startedAt: "2026-10-10T11:42:00.000Z",
    ...overrides,
  }) as any;

const localGame = (overrides: Partial<LocalGame> = {}): LocalGame => ({
  sessionId: "s-501",
  rulesetVersionKey: "501_V1",
  configSnapshot: { seats: [] },
  stages: [],
  turns: [],
  ...overrides,
});

const cardsOf = (count: number) =>
  Array.from({ length: count }, (_, i) => ({
    sessionId: `s-${i}`,
    title: `Game ${i}`,
    href: `/games/${i}/setup`,
    started: "STARTED JUST NOW",
    detail: "",
    big: null,
  }));

describe("toResumeCards", () => {
  beforeEach(() => {
    vi.mocked(summarizeProgress).mockReset();
  });

  it("drops routine steps", () => {
    const cards = toResumeCards([session({ isRoutineStep: true })], null, NOW);
    expect(cards).toEqual([]);
  });

  it("drops sessions whose ruleset has no game card", () => {
    const cards = toResumeCards(
      [
        session({ rulesetVersionKey: null }),
        session({ rulesetVersionKey: "NOPE_V9" }),
      ],
      null,
      NOW,
    );
    expect(cards).toEqual([]);
  });

  it("sorts newest-started first", () => {
    const cards = toResumeCards(
      [
        session({ sessionId: "old", startedAt: "2026-10-10T09:00:00.000Z" }),
        session({
          sessionId: "new",
          rulesetVersionKey: "CRICKET_V1",
          startedAt: "2026-10-10T11:00:00.000Z",
        }),
      ],
      null,
      NOW,
    );
    expect(cards.map((card) => card.sessionId)).toEqual(["new", "old"]);
  });

  it("sorts by instant, not by timestamp text, across UTC offsets", () => {
    const cards = toResumeCards(
      [
        session({
          sessionId: "earlier",
          startedAt: "2026-10-10T12:30:00.000+02:00",
        }),
        session({
          sessionId: "later",
          rulesetVersionKey: "CRICKET_V1",
          startedAt: "2026-10-10T11:45:00.000+00:00",
        }),
      ],
      null,
      NOW,
    );
    expect(cards.map((card) => card.sessionId)).toEqual(["later", "earlier"]);
  });

  it("maps title, href, started label and server progress", () => {
    const [card] = toResumeCards([session()], null, NOW);
    expect(card).toEqual({
      sessionId: "s-501",
      title: "501",
      href: "/games/501/setup",
      started: "STARTED 18 MIN AGO",
      detail: "vs Dartbot · Leg 3",
      big: { value: "170", label: "TO GO" },
    });
  });

  it("falls back to empty detail and no big when the server sent no progress", () => {
    const [card] = toResumeCards([session({ progress: null })], null, NOW);
    expect(card.detail).toBe("");
    expect(card.big).toBeNull();
  });

  it("overlays local progress when the store holds the same session", () => {
    vi.mocked(summarizeProgress).mockReturnValue({
      detail: "local detail",
      big: { value: "100", label: "TO GO" },
    });
    const local = localGame({ stages: [{} as any], turns: [{} as any] });
    const [card] = toResumeCards([session()], local, NOW);
    expect(summarizeProgress).toHaveBeenCalledWith(
      "501_V1",
      local.configSnapshot,
      { stages: local.stages, turns: local.turns },
    );
    expect(card.detail).toBe("local detail");
    expect(card.big).toEqual({ value: "100", label: "TO GO" });
  });

  it("ignores a stale store left over from a different session", () => {
    const [card] = toResumeCards(
      [session()],
      localGame({ sessionId: "other-session" }),
      NOW,
    );
    expect(summarizeProgress).not.toHaveBeenCalled();
    expect(card.detail).toBe("vs Dartbot · Leg 3");
  });

  it("ignores a store whose ruleset differs from the session's", () => {
    toResumeCards([session()], localGame({ rulesetVersionKey: "121_V1" }), NOW);
    expect(summarizeProgress).not.toHaveBeenCalled();
  });

  it("keeps server progress when the local summary is null", () => {
    vi.mocked(summarizeProgress).mockReturnValue(null);
    const [card] = toResumeCards([session()], localGame(), NOW);
    expect(card.detail).toBe("vs Dartbot · Leg 3");
    expect(card.big).toEqual({ value: "170", label: "TO GO" });
  });
});

describe("resumeDeck", () => {
  function createDeck(
    overrides: Partial<ResumeDeckContext> = {},
  ): ResumeDeckContext {
    return Object.assign(resumeDeck(), {
      $store: { game: localGame({ sessionId: null, rulesetVersionKey: null }) },
      navigate: vi.fn(),
      ...overrides,
    }) as ResumeDeckContext;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  describe("init", () => {
    it("loads cards from active sessions and clears loading", async () => {
      vi.mocked(sessionsApi.fetchActiveSessions).mockResolvedValue([session()]);
      const deck = createDeck();
      const pending = deck.init();
      expect(deck.loading).toBe(true);
      await pending;
      expect(deck.loading).toBe(false);
      expect(deck.failed).toBe(false);
      expect(deck.cards.map((card) => card.sessionId)).toEqual(["s-501"]);
    });

    it("marks failed and hides the deck when the fetch rejects", async () => {
      vi.mocked(sessionsApi.fetchActiveSessions).mockRejectedValue(
        new Error("offline"),
      );
      const deck = createDeck();
      await deck.init();
      expect(deck.failed).toBe(true);
      expect(deck.loading).toBe(false);
      expect(deck.visible()).toBe(false);
    });
  });

  describe("derived state", () => {
    it("top is the card at index, or null when empty", () => {
      const deck = createDeck({ cards: cardsOf(2), index: 1 });
      expect(deck.top()?.sessionId).toBe("s-1");
      expect(createDeck().top()).toBeNull();
    });

    it("position reads index / count, one-based", () => {
      expect(createDeck({ cards: cardsOf(3), index: 1 }).position()).toBe(
        "2 / 3",
      );
    });

    it.each([
      [0, 0],
      [1, 0],
      [2, 1],
      [3, 2],
      [5, 2],
    ])("layers() for %i cards is %i", (count, layers) => {
      expect(createDeck({ cards: cardsOf(count) }).layers()).toBe(layers);
    });

    it("is visible while loading, even with no cards", () => {
      expect(createDeck({ loading: true }).visible()).toBe(true);
    });

    it("is hidden once loaded with no cards", () => {
      expect(createDeck({ loading: false }).visible()).toBe(false);
    });

    it("is visible with cards", () => {
      expect(createDeck({ loading: false, cards: cardsOf(1) }).visible()).toBe(
        true,
      );
    });

    it("is hidden after a failure even while loading", () => {
      expect(createDeck({ loading: true, failed: true }).visible()).toBe(false);
    });
  });

  describe("navigation", () => {
    it("next moves out, then settle advances and rises, then settle idles", () => {
      const deck = createDeck({ cards: cardsOf(3) });
      deck.next();
      expect(deck.phase).toBe("out");
      expect(deck.index).toBe(0);
      deck.settle();
      expect(deck.index).toBe(1);
      expect(deck.phase).toBe("rise");
      deck.settle();
      expect(deck.phase).toBe("idle");
    });

    it("settles itself through the fallback timer when animationend never fires", () => {
      const deck = createDeck({ cards: cardsOf(3) });
      deck.next();
      expect(deck.phase).toBe("out");
      vi.advanceTimersByTime(600);
      expect(deck.phase).toBe("rise");
      expect(deck.index).toBe(1);
      vi.advanceTimersByTime(600);
      expect(deck.phase).toBe("idle");
      expect(deck.index).toBe(1);
    });

    it("settles prev through the fallback timer", () => {
      const deck = createDeck({ cards: cardsOf(3) });
      deck.prev();
      vi.advanceTimersByTime(600);
      expect(deck.phase).toBe("idle");
      expect(deck.index).toBe(2);
    });

    it("a real settle before the timer prevents a double advance", () => {
      const deck = createDeck({ cards: cardsOf(3) });
      deck.next();
      deck.settle();
      expect(deck.index).toBe(1);
      vi.advanceTimersByTime(600);
      expect(deck.index).toBe(1);
      expect(deck.phase).toBe("idle");
      vi.advanceTimersByTime(1200);
      expect(deck.index).toBe(1);
      expect(deck.phase).toBe("idle");
    });

    it("a stale fallback timer cannot cut a later in-phase short", () => {
      const deck = createDeck({ cards: cardsOf(3) });
      deck.prev();
      vi.advanceTimersByTime(400);
      deck.settle();
      expect(deck.phase).toBe("idle");
      deck.prev();
      expect(deck.phase).toBe("in");
      vi.advanceTimersByTime(300);
      expect(deck.phase).toBe("in");
      vi.advanceTimersByTime(300);
      expect(deck.phase).toBe("idle");
    });

    it("leaves no timer pending once idle", () => {
      const deck = createDeck({ cards: cardsOf(3) });
      deck.next();
      deck.settle();
      deck.settle();
      expect(deck.phase).toBe("idle");
      expect(deck.settleTimer).toBeNull();
      expect(vi.getTimerCount()).toBe(0);
    });

    it("wraps from the last card to the first", () => {
      const deck = createDeck({ cards: cardsOf(3), index: 2 });
      deck.next();
      deck.settle();
      expect(deck.index).toBe(0);
    });

    it("prev wraps from the first card to the last and animates in", () => {
      const deck = createDeck({ cards: cardsOf(3) });
      deck.prev();
      expect(deck.index).toBe(2);
      expect(deck.phase).toBe("in");
      deck.settle();
      expect(deck.phase).toBe("idle");
    });

    it("is locked while animating", () => {
      const deck = createDeck({ cards: cardsOf(3) });
      deck.next();
      deck.next();
      deck.settle();
      deck.settle();
      expect(deck.index).toBe(1);
      expect(deck.phase).toBe("idle");
    });

    it("prev is ignored while animating", () => {
      const deck = createDeck({ cards: cardsOf(3) });
      deck.next();
      deck.prev();
      expect(deck.index).toBe(0);
      expect(deck.phase).toBe("out");
    });

    it("ignores next and prev with a single card", () => {
      const deck = createDeck({ cards: cardsOf(1) });
      deck.next();
      expect(deck.phase).toBe("idle");
      deck.prev();
      expect(deck.phase).toBe("idle");
      expect(deck.index).toBe(0);
    });
  });

  describe("swipe", () => {
    const point = (clientX: number, clientY: number) =>
      ({ clientX, clientY }) as PointerEvent;

    it("a left swipe of at least 40px moves to the next card", () => {
      const deck = createDeck({ cards: cardsOf(3) });
      deck.swipeStart(point(200, 100));
      deck.swipeEnd(point(150, 105));
      expect(deck.phase).toBe("out");
      expect(deck.swipeX).toBeNull();
      expect(deck.swipeY).toBeNull();
    });

    it("a right swipe of at least 40px moves to the previous card", () => {
      const deck = createDeck({ cards: cardsOf(3) });
      deck.swipeStart(point(100, 100));
      deck.swipeEnd(point(160, 100));
      expect(deck.phase).toBe("in");
      expect(deck.index).toBe(2);
    });

    it("a 30px swipe does nothing", () => {
      const deck = createDeck({ cards: cardsOf(3) });
      deck.swipeStart(point(200, 100));
      deck.swipeEnd(point(170, 100));
      expect(deck.phase).toBe("idle");
    });

    it("a vertical-dominant swipe does nothing", () => {
      const deck = createDeck({ cards: cardsOf(3) });
      deck.swipeStart(point(200, 100));
      deck.swipeEnd(point(140, 220));
      expect(deck.phase).toBe("idle");
    });

    it("a swipe end with no start does nothing", () => {
      const deck = createDeck({ cards: cardsOf(3) });
      deck.swipeEnd(point(0, 0));
      expect(deck.phase).toBe("idle");
    });
  });

  describe("resume", () => {
    it("navigates to the top card's setup route", () => {
      const navigate = vi.fn();
      const deck = createDeck({ cards: cardsOf(2), index: 1, navigate });
      deck.resume();
      expect(navigate).toHaveBeenCalledWith("/games/1/setup");
    });

    it("does nothing with no cards", () => {
      const navigate = vi.fn();
      createDeck({ navigate }).resume();
      expect(navigate).not.toHaveBeenCalled();
    });

    it("navigate assigns location.href", () => {
      const location = { href: "/" };
      vi.stubGlobal("location", location);
      resumeDeck().navigate("/games/501/setup");
      expect(location.href).toBe("/games/501/setup");
    });
  });
});
