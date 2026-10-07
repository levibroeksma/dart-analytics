import { describe, it, expect, vi, beforeEach } from "vitest";
import { gamesIndex, resumeTarget } from "@lib/game/games-index.data";
import type { GamesIndexContext } from "@lib/types";
import * as sessionsApi from "@client/api/sessions";

vi.mock("@client/api/sessions");

/** A training exercise step session: no game, so no ruleset version key. */
const trainingStepSession = () =>
  ({
    sessionId: "session-training-step",
    gameTypeKey: null,
    gameTypeName: null,
    captureModeKey: null,
    inputModeKey: null,
    rulesetVersionKey: null,
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
    startedAt: "2026-08-08T10:00:00.000Z",
  }) as any;

describe("gamesIndex", () => {
  let store: GamesIndexContext["$store"];

  beforeEach(() => {
    vi.clearAllMocks();
    store = {
      settings: { captureModeKey: "RECREATIONAL", inputModeKey: "QUICK_SCORE" },
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
    expect(page.isVisible("501_V1")).toBe(true);
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
    expect(page.isVisible("501_V1")).toBe(false);
    expect(page.isVisible("BOBS27_V1")).toBe(false);
    expect(page.noneVisible()).toBe(true);
  });

  it("keeps a card whose session is active under an unsupported capture mode", async () => {
    vi.mocked(sessionsApi.fetchActiveSessions).mockResolvedValue([
      activeSession("501_V1"),
    ]);
    store.settings.captureModeKey = "UNKNOWN_CAPTURE_MODE";
    const page = createPage();
    await page.init();

    expect(page.isVisible("501_V1")).toBe(true);
    expect(page.isVisible("SCORE_TRAINING_V1")).toBe(false);
    expect(page.noneVisible()).toBe(false);
  });

  it("keeps every active game's card, not only the first", async () => {
    vi.mocked(sessionsApi.fetchActiveSessions).mockResolvedValue([
      activeSession("501_V1"),
      activeSession("SCORE_TRAINING_V1"),
    ]);
    store.settings.captureModeKey = "UNKNOWN_CAPTURE_MODE";
    const page = createPage();
    await page.init();

    expect(page.isVisible("501_V1")).toBe(true);
    expect(page.isVisible("SCORE_TRAINING_V1")).toBe(true);
  });

  it("drops a training step session, which has no ruleset version to gate a card", async () => {
    vi.mocked(sessionsApi.fetchActiveSessions).mockResolvedValue([
      trainingStepSession(),
      activeSession("501_V1"),
    ]);
    store.settings.captureModeKey = "UNKNOWN_CAPTURE_MODE";
    const page = createPage();
    await page.init();

    expect(page.activeRulesetKeys).toEqual(["501_V1"]);
    expect(page.isVisible("501_V1")).toBe(true);
    expect(page.isVisible("SCORE_TRAINING_V1")).toBe(false);
  });

  it("hides a group only when every one of its games is hidden", () => {
    const page = createPage({
      isVisible: (key: string) => key !== "501_V1",
    });

    expect(page.groupVisible("MATCH_PLAY")).toBe(true);

    const none = createPage({ isVisible: () => false });
    expect(none.groupVisible("CLASSICS")).toBe(false);
  });

  it("drops the divider on a group's first visible row, skipping hidden rows", () => {
    const page = createPage({
      isVisible: (key: string) => key !== "501_V1",
    });

    expect(page.isFirstVisible("MATCH_PLAY", "121_V1")).toBe(true);
    expect(page.isFirstVisible("MATCH_PLAY", "501_V1")).toBe(false);
    expect(page.isFirstVisible("MATCH_PLAY", "CRICKET_V1")).toBe(false);
  });

  it("sets the resume target from the fetched sessions", async () => {
    vi.mocked(sessionsApi.fetchActiveSessions).mockResolvedValue([
      activeSession("501_V1"),
    ]);
    const page = createPage();
    await page.init();

    expect(page.activeSession).toEqual({
      title: "501",
      href: "/games/501/setup",
    });
  });

  it("clears the resume target when the fetch fails", async () => {
    vi.mocked(sessionsApi.fetchActiveSessions).mockRejectedValue(
      new Error("offline"),
    );
    const page = createPage();
    await page.init();

    expect(page.activeSession).toBeNull();
  });

  it("falls back to no active session when the fetch fails", async () => {
    vi.mocked(sessionsApi.fetchActiveSessions).mockRejectedValue(
      new Error("offline"),
    );
    const page = createPage();
    await page.init();

    expect(page.activeRulesetKeys).toEqual([]);
    expect(page.isVisible("501_V1")).toBe(true);
  });
});

describe("resumeTarget", () => {
  it("picks the most recently started session that has a card", () => {
    const older = {
      ...activeSession("501_V1"),
      startedAt: "2026-08-08T10:00:00.000Z",
    };
    const newer = {
      ...activeSession("CRICKET_V1"),
      startedAt: "2026-08-09T10:00:00.000Z",
    };

    expect(resumeTarget([older, newer])).toEqual({
      title: "Cricket",
      href: "/games/cricket/setup",
    });
  });

  it("skips a newer training step session for an older game", () => {
    const step = {
      ...trainingStepSession(),
      startedAt: "2026-09-20T10:00:00.000Z",
    };

    expect(resumeTarget([step, activeSession("501_V1")])?.title).toBe("501");
  });

  it("is null without a game session", () => {
    expect(resumeTarget([trainingStepSession()])).toBeNull();
    expect(resumeTarget([])).toBeNull();
  });
});
