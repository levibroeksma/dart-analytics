import { describe, it, expect, vi, beforeEach } from "vitest";
import { reconcileActiveSession } from "@lib/game/session-recovery";
import type { SessionActiveData } from "@client/api/sessions";
import * as api from "@client/api/sessions";

vi.mock("@client/api/sessions");

function activeSession(
  sessionId: string,
  gameTypeKey = "SCORE_TRAINING",
): SessionActiveData {
  return {
    sessionId,
    gameTypeKey,
    gameTypeName: "Score Training",
    captureModeKey: "RECREATIONAL",
    inputModeKey: "QUICK_SCORE",
    rulesetVersionKey: "SCORE_TRAINING_V1",
    startedAt: "2026-07-17T10:00:00Z",
  };
}

/**
 * Declared as the concrete call signature, not an intersection with vitest's
 * Mock: under vitest 4 that intersection widens to
 * `Mock<Procedure | Constructable>`, which `astro check` rejects as an
 * argument for `StoreLike`. `vi.mocked()` recovers `.mock.calls` where needed.
 */
type StoreStub = { reset: () => void };

describe("reconcileActiveSession", () => {
  let store: StoreStub;

  beforeEach(() => {
    vi.clearAllMocks();
    store = { reset: vi.fn() };
  });

  it('returns "match" and does not touch the store when local sessionId matches server ACTIVE', async () => {
    const server = [activeSession("match-id")];

    const result = await reconcileActiveSession(
      "SCORE_TRAINING",
      "match-id",
      server,
      store,
    );

    expect(result).toEqual({ action: "match", activeSession: server[0] });
    expect(store.reset).not.toHaveBeenCalled();
  });

  it('auto-abandons the orphan and returns "no_active" on mismatch', async () => {
    const server = [activeSession("server-id")];
    vi.mocked(api.completeSession).mockResolvedValue({
      sessionId: "server-id",
      statusKey: "ABANDONED",
      completedAt: "2026-07-17T10:00:00Z",
    });

    const result = await reconcileActiveSession(
      "SCORE_TRAINING",
      "different-local-id",
      server,
      store,
    );

    expect(api.completeSession).toHaveBeenCalledWith("server-id", "ABANDONED");
    expect(store.reset).toHaveBeenCalled();
    expect(result).toEqual({ action: "no_active", activeSession: null });
  });

  it('returns "abandon_failed" and does NOT reset the store when the auto-abandon PATCH fails', async () => {
    const server = [activeSession("server-id")];
    vi.mocked(api.completeSession).mockRejectedValue(
      new Error("Network error"),
    );

    const result = await reconcileActiveSession(
      "SCORE_TRAINING",
      "different-local-id",
      server,
      store,
    );

    expect(store.reset).not.toHaveBeenCalled();
    expect(result).toEqual({ action: "abandon_failed", activeSession: null });
  });

  it('resets and returns "no_active" when local is present but no server ACTIVE exists', async () => {
    const result = await reconcileActiveSession(
      "SCORE_TRAINING",
      "stale-id",
      [],
      store,
    );

    expect(store.reset).toHaveBeenCalled();
    expect(result).toEqual({ action: "no_active", activeSession: null });
  });

  it('returns "no_active" with no store change when both are empty', async () => {
    const result = await reconcileActiveSession(
      "SCORE_TRAINING",
      null,
      [],
      store,
    );

    expect(store.reset).not.toHaveBeenCalled();
    expect(result).toEqual({ action: "no_active", activeSession: null });
  });

  it("filters on the caller's game type rather than a hardcoded one", async () => {
    const server = [activeSession("bobs-id", "BOBS27")];

    const result = await reconcileActiveSession(
      "BOBS27",
      "bobs-id",
      server,
      store,
    );

    expect(result).toEqual({ action: "match", activeSession: server[0] });
    expect(store.reset).not.toHaveBeenCalled();
  });

  it("ignores an ACTIVE session belonging to another game entirely", async () => {
    const server = [activeSession("other-game-id", "BOBS27")];

    const result = await reconcileActiveSession(
      "SCORE_TRAINING",
      null,
      server,
      store,
    );

    expect(api.completeSession).not.toHaveBeenCalled();
    expect(store.reset).not.toHaveBeenCalled();
    expect(result).toEqual({ action: "no_active", activeSession: null });
  });

  it("picks this game's ACTIVE session out of a list holding several games", async () => {
    const server = [
      activeSession("bobs-id", "BOBS27"),
      activeSession("score-id"),
    ];

    const result = await reconcileActiveSession(
      "SCORE_TRAINING",
      "score-id",
      server,
      store,
    );

    expect(result).toEqual({ action: "match", activeSession: server[1] });
  });
});
