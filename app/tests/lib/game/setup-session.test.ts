import { describe, it, expect, vi, beforeEach } from "vitest";
import { createSetupSession } from "@lib/game/setup-session";
import type { SetupSessionContext } from "@lib/types";
import * as sessionsApi from "@client/api/sessions";
import * as recovery from "@lib/game/session-recovery";

vi.mock("@client/api/sessions");
vi.mock("@lib/game/session-recovery");

describe("createSetupSession", () => {
  let store: SetupSessionContext["$store"];

  beforeEach(() => {
    vi.clearAllMocks();
    store = {
      game: { sessionId: "local-id", reset: vi.fn(), startSession: vi.fn() },
      settings: { captureModeKey: "RECREATIONAL", inputModeKey: "QUICK_SCORE" },
    };
  });

  function create(): SetupSessionContext {
    return {
      ...createSetupSession({
        gameTypeKey: "TEST",
        playHref: "/games/test/play",
      }),
      $store: store,
    } as SetupSessionContext;
  }

  it("returns fresh state per call", () => {
    const a = create();
    const b = create();
    a.guests.push({ displayName: "Sam" });
    a.bot = { level: 3 };
    expect(b.guests).toEqual([]);
    expect(b.bot).toBeNull();
  });

  it("starts idle", () => {
    const s = create();
    expect(s.loading).toBe(false);
    expect(s.error).toBe("");
    expect(s.activeSession).toBeNull();
    expect(s.showActiveSessionModal).toBe(false);
    expect(s.loadingReconciliation).toBe(false);
    expect(s.reconciliationFailed).toBe(false);
  });

  describe("reconcile", () => {
    it("passes the game key, local session id and store to recovery", async () => {
      vi.mocked(recovery.reconcileActiveSession).mockResolvedValue({
        action: "no_active",
      } as any);
      const s = create();
      const active = [{ sessionId: "x" } as any];
      await s.reconcile(active);
      expect(recovery.reconcileActiveSession).toHaveBeenCalledWith(
        "TEST",
        "local-id",
        active,
        store.game,
      );
    });

    it("shows the modal on match", async () => {
      const active = { sessionId: "x" } as any;
      vi.mocked(recovery.reconcileActiveSession).mockResolvedValue({
        action: "match",
        activeSession: active,
      } as any);
      const s = create();
      s.reconciliationFailed = true;
      await s.reconcile([active]);
      expect(s.activeSession).toBe(active);
      expect(s.showActiveSessionModal).toBe(true);
      expect(s.reconciliationFailed).toBe(false);
    });

    it("flags failure and hides the modal on abandon_failed", async () => {
      vi.mocked(recovery.reconcileActiveSession).mockResolvedValue({
        action: "abandon_failed",
      } as any);
      const s = create();
      s.showActiveSessionModal = true;
      await s.reconcile([]);
      expect(s.showActiveSessionModal).toBe(false);
      expect(s.reconciliationFailed).toBe(true);
    });

    it("clears both flags on no_active", async () => {
      vi.mocked(recovery.reconcileActiveSession).mockResolvedValue({
        action: "no_active",
      } as any);
      const s = create();
      s.showActiveSessionModal = true;
      s.reconciliationFailed = true;
      await s.reconcile([]);
      expect(s.showActiveSessionModal).toBe(false);
      expect(s.reconciliationFailed).toBe(false);
    });
  });

  describe("retryReconciliation", () => {
    it("refetches, reconciles and clears loading", async () => {
      vi.mocked(sessionsApi.fetchActiveSessions).mockResolvedValue([]);
      vi.mocked(recovery.reconcileActiveSession).mockResolvedValue({
        action: "no_active",
      } as any);
      const s = create();
      const pending = s.retryReconciliation();
      expect(s.loadingReconciliation).toBe(true);
      await pending;
      expect(s.loadingReconciliation).toBe(false);
      expect(sessionsApi.fetchActiveSessions).toHaveBeenCalledTimes(1);
    });

    it("clears loading when the fetch throws", async () => {
      vi.mocked(sessionsApi.fetchActiveSessions).mockRejectedValue(
        new Error("offline"),
      );
      const s = create();
      await expect(s.retryReconciliation()).rejects.toThrow("offline");
      expect(s.loadingReconciliation).toBe(false);
    });
  });

  describe("continueSession", () => {
    it("hides the modal and navigates to playHref", () => {
      const loc = { href: "/games/test/setup" };
      vi.stubGlobal("location", loc);
      const s = create();
      s.showActiveSessionModal = true;
      s.continueSession();
      expect(s.showActiveSessionModal).toBe(false);
      expect(loc.href).toBe("/games/test/play");
    });
  });

  describe("abandonSession", () => {
    it("completes as ABANDONED, resets the store and clears the session", async () => {
      vi.mocked(sessionsApi.completeSession).mockResolvedValue({} as any);
      const s = create();
      s.activeSession = { sessionId: "srv-id" } as any;
      s.showActiveSessionModal = true;
      await s.abandonSession();
      expect(sessionsApi.completeSession).toHaveBeenCalledWith(
        "srv-id",
        "ABANDONED",
      );
      expect(store.game.reset).toHaveBeenCalled();
      expect(s.showActiveSessionModal).toBe(false);
      expect(s.activeSession).toBeNull();
      expect(s.loading).toBe(false);
    });

    it("sets an error and keeps the session when completion fails", async () => {
      vi.mocked(sessionsApi.completeSession).mockRejectedValue(new Error("x"));
      const s = create();
      s.activeSession = { sessionId: "srv-id" } as any;
      s.showActiveSessionModal = true;
      await s.abandonSession();
      expect(s.error).toBe("Could not abandon session. Try again.");
      expect(s.activeSession).not.toBeNull();
      expect(s.showActiveSessionModal).toBe(true);
      expect(s.loading).toBe(false);
    });

    it("is a no-op without an active session", async () => {
      const s = create();
      await s.abandonSession();
      expect(sessionsApi.completeSession).not.toHaveBeenCalled();
    });

    it("is a no-op while loading", async () => {
      const s = create();
      s.activeSession = { sessionId: "srv-id" } as any;
      s.loading = true;
      await s.abandonSession();
      expect(sessionsApi.completeSession).not.toHaveBeenCalled();
    });
  });

  it("removeGuest drops the guest at the index", () => {
    const s = create();
    s.guests.push({ displayName: "A" }, { displayName: "B" });
    s.removeGuest(0);
    expect(s.guests).toEqual([{ displayName: "B" }]);
  });

  it("removeBot clears the bot", () => {
    const s = create();
    s.bot = { level: 2 };
    s.removeBot();
    expect(s.bot).toBeNull();
  });
});
