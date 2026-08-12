import { describe, it, expect, vi, beforeEach } from "vitest";
import { gamesIndex } from "@lib/game/games-index.data";
import type { GamesIndexContext } from "@lib/types";
import * as sessionsApi from "@client/api/sessions";

vi.mock("@client/api/sessions");

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

  it("shows both cards under quick score", async () => {
    vi.mocked(sessionsApi.fetchActiveSessions).mockResolvedValue([]);
    const page = createPage();
    await page.init();

    expect(page.isVisible("SCORE_TRAINING_V1")).toBe(true);
    expect(page.isVisible("501_V1")).toBe(true);
    expect(page.noneVisible()).toBe(false);
    expect(page.analyticsMode()).toBe(false);
  });

  it("reports analytics mode from the settings store", () => {
    store.settings.captureModeKey = "ANALYTICS";
    store.settings.inputModeKey = "VISUAL_BOARD";

    expect(createPage().analyticsMode()).toBe(true);
  });

  it("hides every card under a mode no carded game supports", async () => {
    vi.mocked(sessionsApi.fetchActiveSessions).mockResolvedValue([]);
    store.settings.inputModeKey = "UNKNOWN_INPUT_MODE";
    const page = createPage();
    await page.init();

    expect(page.isVisible("SCORE_TRAINING_V1")).toBe(false);
    expect(page.isVisible("501_V1")).toBe(false);
    expect(page.noneVisible()).toBe(true);
  });

  it("keeps a card whose session is active under an unsupported mode", async () => {
    vi.mocked(sessionsApi.fetchActiveSessions).mockResolvedValue([
      activeSession("501_V1"),
    ]);
    store.settings.inputModeKey = "DETAILED_DARTS";
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
    store.settings.inputModeKey = "DETAILED_DARTS";
    const page = createPage();
    await page.init();

    expect(page.isVisible("501_V1")).toBe(true);
    expect(page.isVisible("SCORE_TRAINING_V1")).toBe(true);
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
