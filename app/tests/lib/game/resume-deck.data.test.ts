import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { resumeDeck, toResumeCards } from "@lib/game/resume-deck.data";
import { summarizeProgress } from "@modules/game/session-progress.module";
import type { LocalGame, ResumeDeckContext } from "@lib/types";
import * as sessionsApi from "@client/api/sessions";
import { activeSessionsStore } from "@stores/active-sessions.store";
import { gamesIndex } from "@lib/game/games-index.data";

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
    rulesetVersionKey: "501_V2",
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
  rulesetVersionKey: "501_V2",
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
    local: false,
    detail: "",
    big: null,
  }));

describe("toResumeCards", () => {
  it("gives a 501_V1 session the 501 card", () => {
    const cards = toResumeCards(
      [session({ rulesetVersionKey: "501_V1" })],
      null,
      NOW,
    );
    expect(cards).toHaveLength(1);
    expect(cards[0].title).toBe("501");
  });

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
      local: false,
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
      "501_V2",
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

  it("overlays only the session the store holds when several are listed", () => {
    vi.mocked(summarizeProgress).mockReturnValue({
      detail: "local detail",
      big: null,
    });
    const cards = toResumeCards(
      [
        session({ sessionId: "s-501", startedAt: "2026-10-10T11:00:00.000Z" }),
        session({
          sessionId: "s-121",
          rulesetVersionKey: "121_V1",
          startedAt: "2026-10-10T11:30:00.000Z",
        }),
      ],
      localGame({ sessionId: "s-501" }),
      NOW,
    );
    expect(cards.map((card) => [card.sessionId, card.detail])).toEqual([
      ["s-121", "vs Dartbot · Leg 3"],
      ["s-501", "local detail"],
    ]);
    expect(summarizeProgress).toHaveBeenCalledTimes(1);
  });

  it("flags local only on an exact session and ruleset match", () => {
    const [card] = toResumeCards([session()], localGame(), NOW);
    expect(card.local).toBe(true);
  });

  it("is not local for a stale store, an empty store or a ruleset mismatch", () => {
    const flag = (local: LocalGame | null) =>
      toResumeCards([session()], local, NOW)[0].local;
    expect(flag(localGame({ sessionId: "other-session" }))).toBe(false);
    expect(flag(localGame({ sessionId: null, rulesetVersionKey: null }))).toBe(
      false,
    );
    expect(flag(null)).toBe(false);
    expect(flag(localGame({ rulesetVersionKey: "121_V1" }))).toBe(false);
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
      $store: {
        game: localGame({ sessionId: null, rulesetVersionKey: null }),
        activeSessions: activeSessionsStore(),
      },
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
    it("shares the page's one active-sessions fetch with /games", async () => {
      vi.mocked(sessionsApi.fetchActiveSessions).mockResolvedValue([session()]);
      const deck = createDeck();
      const page = Object.assign(gamesIndex(), {
        $store: {
          settings: {
            captureModeKey: "RECREATIONAL",
            inputModeKey: "QUICK_SCORE",
          },
          activeSessions: deck.$store.activeSessions,
        },
      });
      await Promise.all([deck.init(), page.init()]);
      expect(sessionsApi.fetchActiveSessions).toHaveBeenCalledTimes(1);
      expect(deck.cards.map((card) => card.sessionId)).toEqual(["s-501"]);
      expect(page.activeRulesetKeys).toEqual(["501_V2"]);
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

    it("is hidden while loading, until sessions are known", () => {
      expect(createDeck({ loading: true }).visible()).toBe(false);
      expect(createDeck({ loading: true, cards: cardsOf(1) }).visible()).toBe(
        false,
      );
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
    const view = (deck: ResumeDeckContext) =>
      deck
        .deckSlots()
        .map((slot) => `${slot.card.sessionId}@${slot.depth}:${slot.state}`);

    it("deckSlots shows at most three cards front-first", () => {
      const deck = createDeck({ cards: cardsOf(5) });
      expect(view(deck)).toEqual(["s-0@0:rest", "s-1@1:rest", "s-2@2:rest"]);
    });

    it("deckSlots shows two cards for a pair and one for a single", () => {
      expect(view(createDeck({ cards: cardsOf(2) }))).toEqual([
        "s-0@0:rest",
        "s-1@1:rest",
      ]);
      expect(view(createDeck({ cards: cardsOf(1) }))).toEqual(["s-0@0:rest"]);
    });

    it("next sends the top card leaving and advances the index", () => {
      const deck = createDeck({ cards: cardsOf(3) });
      deck.next();
      expect(deck.phase).toBe("go");
      expect(deck.index).toBe(1);
      expect(view(deck)).toEqual(["s-1@0:rest", "s-2@1:rest", "s-0@0:leaving"]);
    });

    it("next parks then returns the old top into the back slot with three cards", () => {
      const deck = createDeck({ cards: cardsOf(3) });
      deck.next();
      vi.advanceTimersByTime(480);
      expect(deck.phase).toBe("snap");
      expect(view(deck)).toEqual(["s-1@0:rest", "s-2@1:rest", "s-0@2:parked"]);
      vi.advanceTimersByTime(40);
      expect(deck.phase).toBe("back");
      expect(view(deck)).toEqual([
        "s-1@0:rest",
        "s-2@1:rest",
        "s-0@2:entering",
      ]);
      vi.advanceTimersByTime(520);
      expect(deck.phase).toBe("idle");
      expect(view(deck)).toEqual(["s-1@0:rest", "s-2@1:rest", "s-0@2:rest"]);
      expect(vi.getTimerCount()).toBe(0);
    });

    it("next with more than three cards enters the hidden fourth card", () => {
      const deck = createDeck({ cards: cardsOf(5) });
      deck.next();
      expect(view(deck)).toEqual([
        "s-1@0:rest",
        "s-2@1:rest",
        "s-3@2:parked",
        "s-0@0:leaving",
      ]);
      vi.advanceTimersByTime(520);
      expect(view(deck)).toEqual([
        "s-1@0:rest",
        "s-2@1:rest",
        "s-3@2:entering",
      ]);
    });

    it("prev reverses: back card leaves, then enters on top", () => {
      const deck = createDeck({ cards: cardsOf(3) });
      deck.prev();
      expect(deck.index).toBe(2);
      expect(deck.phase).toBe("go");
      expect(view(deck)).toEqual(["s-0@1:rest", "s-1@2:rest", "s-2@2:exiting"]);
      vi.advanceTimersByTime(480);
      expect(view(deck)).toEqual(["s-0@1:rest", "s-1@2:rest", "s-2@0:staged"]);
      vi.advanceTimersByTime(40);
      expect(view(deck)).toEqual([
        "s-0@1:rest",
        "s-1@2:rest",
        "s-2@0:entering",
      ]);
      vi.advanceTimersByTime(520);
      expect(deck.phase).toBe("idle");
      expect(view(deck)).toEqual(["s-2@0:rest", "s-0@1:rest", "s-1@2:rest"]);
    });

    it("prev with more than three cards pushes the back card out of view", () => {
      const deck = createDeck({ cards: cardsOf(5) });
      deck.prev();
      expect(deck.index).toBe(4);
      expect(view(deck)).toEqual([
        "s-0@1:rest",
        "s-1@2:rest",
        "s-2@2:exiting",
        "s-4@0:staged",
      ]);
      vi.advanceTimersByTime(520);
      expect(view(deck)).toEqual([
        "s-0@1:rest",
        "s-1@2:rest",
        "s-4@0:entering",
      ]);
    });

    it("next with two cards returns the old top to the second slot", () => {
      const deck = createDeck({ cards: cardsOf(2) });
      deck.next();
      expect(view(deck)).toEqual(["s-1@0:rest", "s-0@0:leaving"]);
      vi.advanceTimersByTime(520);
      expect(view(deck)).toEqual(["s-1@0:rest", "s-0@1:entering"]);
    });

    it("wraps from the last card to the first", () => {
      const deck = createDeck({ cards: cardsOf(3), index: 2 });
      deck.next();
      expect(deck.index).toBe(0);
    });

    it("ignores next while animating", () => {
      const deck = createDeck({ cards: cardsOf(3) });
      deck.next();
      deck.next();
      deck.prev();
      expect(deck.index).toBe(1);
      vi.advanceTimersByTime(1040);
      expect(deck.index).toBe(1);
      expect(deck.phase).toBe("idle");
    });

    it("single card never animates", () => {
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
      expect(deck.direction).toBe("next");
      expect(deck.swipeX).toBeNull();
      expect(deck.swipeY).toBeNull();
    });

    it("a right swipe of at least 40px moves to the previous card", () => {
      const deck = createDeck({ cards: cardsOf(3) });
      deck.swipeStart(point(100, 100));
      deck.swipeEnd(point(160, 100));
      expect(deck.direction).toBe("prev");
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

    it("a drag starting on a button does not swipe", () => {
      const deck = createDeck({ cards: cardsOf(3) });
      const target = { closest: (selector: string) => selector === "button" };
      deck.swipeStart({ clientX: 200, clientY: 100, target } as never);
      expect(deck.swipeX).toBeNull();
      expect(deck.swipeY).toBeNull();
      deck.swipeEnd(point(100, 100));
      expect(deck.phase).toBe("idle");
    });

    it("a drag starting outside any button is tracked", () => {
      const deck = createDeck({ cards: cardsOf(3) });
      const target = { closest: () => null };
      deck.swipeStart({ clientX: 200, clientY: 100, target } as never);
      expect(deck.swipeX).toBe(200);
      expect(deck.swipeY).toBe(100);
    });

    it("a cancelled pointer clears both coordinates", () => {
      const deck = createDeck({ cards: cardsOf(3) });
      deck.swipeStart(point(200, 100));
      deck.swipeCancel();
      expect(deck.swipeX).toBeNull();
      expect(deck.swipeY).toBeNull();
      deck.swipeEnd(point(100, 100));
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
