// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { STEP_REPLAY_PRESENTERS } from "@lib/stats/replay-presenters";
import { playSwitching } from "../lib/stats/replay-step-games";

const readReplayPage = vi.fn();
const apiRequest = vi.fn();

vi.mock("@client/stats-cache/cache", () => ({
  readReplayPage: (...args: unknown[]) => readReplayPage(...args),
}));
vi.mock("@client/api/client", () => ({
  apiRequest: (...args: unknown[]) => apiRequest(...args),
}));

const { replayStore } = await import("@stores/replay.store");

beforeEach(() => {
  readReplayPage.mockReset();
  apiRequest.mockReset();
});

/**
 * `replayStore`'s dispatch for a non-game routine step (phase 6b plan
 * decision 11, R9): a new file, not an edit to the frozen
 * `replay.store.test.ts` game cases.
 */
describe("replayStore (non-game routine steps)", () => {
  it("picks the step's own STEP_REPLAY_PRESENTERS entry when gameTypeKey is null", async () => {
    const { header, turns } = playSwitching();
    readReplayPage.mockResolvedValue({ header, turns, nextCursor: null });
    const store = replayStore();

    await store.open(header.sessionId);

    expect(store.presenter).toBe(STEP_REPLAY_PRESENTERS.SWITCHING);
    expect(store.derivedAvailable).toBe(true);
    expect(store.turnView(0).cells.length).toBeGreaterThan(0);
    expect(store.sessionLine?.entries.length).toBeGreaterThan(0);
  });

  it("treats an unrecognized exercise kind like a skipped fold", async () => {
    const { header, turns } = playSwitching();
    readReplayPage.mockResolvedValue({
      header: { ...header, exerciseTypeKey: "SOME_FUTURE_KIND" },
      turns,
      nextCursor: null,
    });
    const store = replayStore();

    await store.open(header.sessionId);

    expect(store.presenter).toBeNull();
    expect(store.derivedAvailable).toBe(false);
    expect(store.turnView(0).cells).toEqual([]);
  });

  it("titles a step replay with its adapter's capitalized header label", async () => {
    const { header, turns } = playSwitching();
    readReplayPage.mockResolvedValue({ header, turns, nextCursor: null });
    const store = replayStore();

    await store.open(header.sessionId);

    expect(store.exerciseTitle).toBe("Switching");
  });

  it("titles an unrecognized exercise kind with its raw key", async () => {
    const { header, turns } = playSwitching();
    readReplayPage.mockResolvedValue({
      header: { ...header, exerciseTypeKey: "SOME_FUTURE_KIND" },
      turns,
      nextCursor: null,
    });
    const store = replayStore();

    await store.open(header.sessionId);

    expect(store.exerciseTitle).toBe("SOME_FUTURE_KIND");
  });
});
