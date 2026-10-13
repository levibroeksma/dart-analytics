import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchActiveSessions = vi.fn();

vi.mock("@client/api/sessions", () => ({
  fetchActiveSessions: () => fetchActiveSessions(),
}));

const { activeSessionsStore } = await import("@stores/active-sessions.store");

const session = { sessionId: "s1", rulesetVersionKey: "501_V2" };

beforeEach(() => {
  fetchActiveSessions.mockReset();
});

describe("activeSessionsStore", () => {
  it("starts empty and unloaded, without fetching", () => {
    const store = activeSessionsStore();

    expect(store.sessions).toEqual([]);
    expect(store.loaded).toBe(false);
    expect(store.failed).toBe(false);
    expect(fetchActiveSessions).not.toHaveBeenCalled();
  });

  it("loads the player's active sessions", async () => {
    fetchActiveSessions.mockResolvedValue([session]);
    const store = activeSessionsStore();

    await store.load();

    expect(store.sessions).toEqual([session]);
    expect(store.loaded).toBe(true);
    expect(store.failed).toBe(false);
  });

  it("fetches once for every caller, concurrent or later", async () => {
    fetchActiveSessions.mockResolvedValue([session]);
    const store = activeSessionsStore();

    await Promise.all([store.load(), store.load()]);
    await store.load();

    expect(fetchActiveSessions).toHaveBeenCalledTimes(1);
  });

  it("marks a failed fetch failed and loaded, with no sessions", async () => {
    fetchActiveSessions.mockRejectedValue(new Error("offline"));
    const store = activeSessionsStore();

    await store.load();

    expect(store.sessions).toEqual([]);
    expect(store.loaded).toBe(true);
    expect(store.failed).toBe(true);
  });
});
