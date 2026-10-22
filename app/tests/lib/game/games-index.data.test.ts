import { describe, it, expect, vi, beforeEach } from "vitest";
import { gamesIndex } from "@lib/game/games-index.data";
import type { GamesIndexContext } from "@lib/types";
import * as sessionsApi from "@client/api/sessions";
import * as catalogApi from "@client/api/catalog";
import { cardTags } from "@lib/catalog/tags";
import type { CatalogTag, CatalogTagsResponse } from "@lib/types";
import { activeSessionsStore } from "@stores/active-sessions.store";

vi.mock("@client/api/sessions");
vi.mock("@client/api/catalog");

/** A training exercise step session: no game, so no ruleset version key. */
const trainingStepSession = () =>
  ({
    sessionId: "session-training-step",
    gameTypeKey: null,
    gameTypeName: null,
    captureModeKey: null,
    inputModeKey: null,
    rulesetVersionKey: null,
    isRoutineStep: false,
    progress: null,
    startedAt: "2026-09-16T10:00:00.000Z",
  }) as any;

const activeSession = (rulesetVersionKey: string) =>
  ({
    sessionId: `session-${rulesetVersionKey}`,
    gameTypeKey: "X01",
    gameTypeName: "X01",
    captureModeKey: "RECREATIONAL",
    inputModeKey: "QUICK_SCORE",
    rulesetVersionKey,
    isRoutineStep: false,
    progress: null,
    startedAt: "2026-08-08T10:00:00.000Z",
  }) as any;

const tag = (
  key: string,
  axis: CatalogTag["axis"],
  primary = false,
): CatalogTag => ({ key, name: key, axis, primary }) as CatalogTag;

const cricketTags: CatalogTag[] = [
  tag("FAMILY_X", "FAMILY"),
  tag("PRESSURE_X", "PRESSURE"),
  tag("FORMAT_X", "FORMAT"),
  tag("SKILL_P", "SKILL", true),
  tag("SKILL_S", "SKILL"),
];

const catalogTags = (): CatalogTagsResponse =>
  ({
    games: {
      CRICKET: {
        standalone: { tags: cricketTags, difficultyLevel: 3 },
        routineStep: { tags: [], difficultyLevel: null },
      },
    },
    exercises: {},
    cards: {
      AROUND_THE_CLOCK_V3: {
        tags: [tag("SKILL_C", "SKILL", true)],
        difficultyLevel: 1,
      },
    },
  }) as CatalogTagsResponse;

describe("gamesIndex", () => {
  let store: GamesIndexContext["$store"];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(catalogApi.fetchCatalogTags).mockResolvedValue(catalogTags());
    store = {
      settings: { captureModeKey: "RECREATIONAL", inputModeKey: "QUICK_SCORE" },
      activeSessions: activeSessionsStore(),
    };
  });

  function createPage(
    overrides: Partial<GamesIndexContext> = {},
  ): GamesIndexContext {
    return { ...gamesIndex(), $store: store, ...overrides };
  }

  it("shows every card under recreational, including a ruleset with no QUICK_SCORE pair", async () => {
    vi.mocked(sessionsApi.fetchActiveSessions).mockResolvedValue([]);
    const page = createPage();
    await page.init();

    expect(page.isVisible("SCORE_TRAINING_V1")).toBe(true);
    expect(page.isVisible("501_V2")).toBe(true);
    expect(page.isVisible("BOBS27_V1")).toBe(true);
    expect(page.noneVisible()).toBe(false);
    expect(page.analyticsMode()).toBe(false);
  });

  it("reports analytics mode from the settings store", () => {
    store.settings.captureModeKey = "ANALYTICS";
    store.settings.inputModeKey = "VISUAL_BOARD";

    expect(createPage().analyticsMode()).toBe(true);
  });

  it("hides every card under a capture mode no carded game supports", async () => {
    vi.mocked(sessionsApi.fetchActiveSessions).mockResolvedValue([]);
    store.settings.captureModeKey = "UNKNOWN_CAPTURE_MODE";
    const page = createPage();
    await page.init();

    expect(page.isVisible("SCORE_TRAINING_V1")).toBe(false);
    expect(page.isVisible("501_V2")).toBe(false);
    expect(page.isVisible("BOBS27_V1")).toBe(false);
    expect(page.noneVisible()).toBe(true);
  });

  it("keeps a card whose session is active under an unsupported capture mode", async () => {
    vi.mocked(sessionsApi.fetchActiveSessions).mockResolvedValue([
      activeSession("501_V2"),
    ]);
    store.settings.captureModeKey = "UNKNOWN_CAPTURE_MODE";
    const page = createPage();
    await page.init();

    expect(page.isVisible("501_V2")).toBe(true);
    expect(page.isVisible("SCORE_TRAINING_V1")).toBe(false);
    expect(page.noneVisible()).toBe(false);
  });

  it("keeps every active game's card, not only the first", async () => {
    vi.mocked(sessionsApi.fetchActiveSessions).mockResolvedValue([
      activeSession("501_V2"),
      activeSession("SCORE_TRAINING_V1"),
    ]);
    store.settings.captureModeKey = "UNKNOWN_CAPTURE_MODE";
    const page = createPage();
    await page.init();

    expect(page.isVisible("501_V2")).toBe(true);
    expect(page.isVisible("SCORE_TRAINING_V1")).toBe(true);
  });

  it("drops a training step session, which has no ruleset version to gate a card", async () => {
    vi.mocked(sessionsApi.fetchActiveSessions).mockResolvedValue([
      trainingStepSession(),
      activeSession("501_V2"),
    ]);
    store.settings.captureModeKey = "UNKNOWN_CAPTURE_MODE";
    const page = createPage();
    await page.init();

    expect(page.activeRulesetKeys).toEqual(["501_V2"]);
    expect(page.isVisible("501_V2")).toBe(true);
    expect(page.isVisible("SCORE_TRAINING_V1")).toBe(false);
  });

  it("hides a group only when every one of its games is hidden", () => {
    const page = createPage({
      isVisible: (key: string) => key !== "501_V2",
    });

    expect(page.groupVisible("MATCH_PLAY")).toBe(true);

    const none = createPage({ isVisible: () => false });
    expect(none.groupVisible("CLASSICS")).toBe(false);
  });

  it("falls back to no active session when the fetch fails", async () => {
    vi.mocked(sessionsApi.fetchActiveSessions).mockRejectedValue(
      new Error("offline"),
    );
    const page = createPage();
    await page.init();

    expect(page.activeRulesetKeys).toEqual([]);
    expect(page.isVisible("501_V2")).toBe(true);
  });

  it("is loading until the active sessions resolve", async () => {
    vi.mocked(sessionsApi.fetchActiveSessions).mockResolvedValue([]);
    const page = createPage();

    expect(page.loading()).toBe(true);
    await page.init();
    expect(page.loading()).toBe(false);
  });

  it("stops loading when the sessions fetch fails", async () => {
    vi.mocked(sessionsApi.fetchActiveSessions).mockRejectedValue(
      new Error("offline"),
    );
    const page = createPage();
    await page.init();

    expect(page.loading()).toBe(false);
  });

  it("stays loading while the settings store is still loading", async () => {
    vi.mocked(sessionsApi.fetchActiveSessions).mockResolvedValue([]);
    store.settings.loading = true;
    const page = createPage();
    await page.init();

    expect(page.loading()).toBe(true);
  });

  describe("catalog tags", () => {
    it("returns the card tag order and level for a game after init", async () => {
      vi.mocked(sessionsApi.fetchActiveSessions).mockResolvedValue([]);
      const page = createPage();
      await page.init();
      await vi.waitFor(() => expect(page.catalogTags).not.toBeNull());

      expect(page.gameTags("CRICKET")).toEqual(
        cardTags({ tags: cricketTags, difficultyLevel: 3 }, "game"),
      );
      expect(page.gameLevel("CRICKET")).toBe(3);
    });

    it("prefers the card's own tag set and level", async () => {
      vi.mocked(sessionsApi.fetchActiveSessions).mockResolvedValue([]);
      const page = createPage();
      await page.init();
      await vi.waitFor(() => expect(page.catalogTags).not.toBeNull());

      expect(
        page.gameTags("CRICKET", "AROUND_THE_CLOCK_V3").map((t) => t.key),
      ).toEqual(["SKILL_C"]);
      expect(page.gameLevel("CRICKET", "AROUND_THE_CLOCK_V3")).toBe(1);
    });

    it("falls back to the game type when the card has no set", async () => {
      vi.mocked(sessionsApi.fetchActiveSessions).mockResolvedValue([]);
      const page = createPage();
      await page.init();
      await vi.waitFor(() => expect(page.catalogTags).not.toBeNull());

      expect(page.gameTags("CRICKET", "CRICKET_V1")).toEqual(
        page.gameTags("CRICKET"),
      );
      expect(page.gameLevel("CRICKET", "CRICKET_V1")).toBe(3);
    });

    it("returns no tags and no level for an unknown game or before load", async () => {
      vi.mocked(sessionsApi.fetchActiveSessions).mockResolvedValue([]);
      const page = createPage();

      expect(page.catalogTags).toBeNull();
      expect(page.gameTags("CRICKET")).toEqual([]);
      expect(page.gameLevel("CRICKET")).toBeNull();
      await page.init();
      await vi.waitFor(() => expect(page.catalogTags).not.toBeNull());
      expect(page.gameTags("NOPE")).toEqual([]);
      expect(page.gameLevel("NOPE")).toBeNull();
    });

    it("degrades to empty tags and still stops loading when the tags fetch fails", async () => {
      vi.mocked(sessionsApi.fetchActiveSessions).mockResolvedValue([]);
      vi.mocked(catalogApi.fetchCatalogTags).mockRejectedValue(
        new Error("offline"),
      );
      const page = createPage();
      await page.init();

      expect(page.gameTags("CRICKET")).toEqual([]);
      expect(page.gameLevel("CRICKET")).toBeNull();
      expect(page.loading()).toBe(false);
    });

    it("does not hold loading() for a tags fetch that has not settled", async () => {
      vi.mocked(sessionsApi.fetchActiveSessions).mockResolvedValue([]);
      vi.mocked(catalogApi.fetchCatalogTags).mockReturnValue(
        new Promise(() => {}),
      );
      const page = createPage();
      await page.init();

      expect(page.loading()).toBe(false);
      expect(page.gameTags("CRICKET")).toEqual([]);
    });

    it("starts the tags fetch before the sessions fetch settles", async () => {
      let resolveSessions: (v: never[]) => void = () => {};
      vi.mocked(sessionsApi.fetchActiveSessions).mockReturnValue(
        new Promise((resolve) => {
          resolveSessions = resolve;
        }),
      );
      const page = createPage();
      const init = page.init();

      expect(catalogApi.fetchCatalogTags).toHaveBeenCalledTimes(1);
      resolveSessions([]);
      await init;
    });
  });
});
