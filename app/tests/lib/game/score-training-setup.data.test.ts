import { describe, it, expect, vi, beforeEach } from "vitest";
import { scoreTrainingSetup } from "@lib/game/score-training-setup.data";
import type { ScoreTrainingSetupContext } from "@lib/game/types";
import * as sessionsApi from "@client/api/sessions";
import * as presetsApi from "@client/api/configuration-templates";

vi.mock("@client/api/sessions");
vi.mock("@client/api/configuration-templates");

describe("scoreTrainingSetup", () => {
  let store: ScoreTrainingSetupContext["$store"];

  beforeEach(() => {
    vi.clearAllMocks();
    store = {
      game: {
        sessionId: null,
        reset: vi.fn(),
        startSession: vi.fn(),
      },
    };
  });

  function createSetup(
    overrides: Partial<ScoreTrainingSetupContext> = {},
  ): ScoreTrainingSetupContext {
    return { ...scoreTrainingSetup(), $store: store, ...overrides };
  }

  describe("reconciliation on init", () => {
    it('shows modal on "match"', async () => {
      const setup = createSetup();

      vi.mocked(presetsApi.fetchConfigurationPresets).mockResolvedValue([]);
      vi.mocked(sessionsApi.fetchActiveSessions).mockResolvedValue([
        { sessionId: "match-id", gameTypeKey: "SCORE_TRAINING" } as any,
      ]);
      store.game.sessionId = "match-id";

      await setup.init();

      expect(setup.showActiveSessionModal).toBe(true);
      expect(setup.activeSession).toEqual({
        sessionId: "match-id",
        gameTypeKey: "SCORE_TRAINING",
      });
    });

    it('shows preset picker on "no_active" (mismatch auto-abandoned)', async () => {
      const setup = createSetup();

      vi.mocked(presetsApi.fetchConfigurationPresets).mockResolvedValue([]);
      vi.mocked(sessionsApi.fetchActiveSessions).mockResolvedValue([
        { sessionId: "server-id", gameTypeKey: "SCORE_TRAINING" } as any,
      ]);
      vi.mocked(sessionsApi.completeSession).mockResolvedValue({
        sessionId: "server-id",
        statusKey: "ABANDONED",
        completedAt: "2026-07-17T10:00:00Z",
      });
      store.game.sessionId = "different-local-id";

      await setup.init();

      expect(setup.showActiveSessionModal).toBe(false);
      expect(setup.reconciliationFailed).toBe(false);
    });

    it('blocks the picker and sets reconciliationFailed on "abandon_failed" — does not show picker as if clear', async () => {
      const setup = createSetup();

      vi.mocked(presetsApi.fetchConfigurationPresets).mockResolvedValue([]);
      vi.mocked(sessionsApi.fetchActiveSessions).mockResolvedValue([
        { sessionId: "server-id", gameTypeKey: "SCORE_TRAINING" } as any,
      ]);
      vi.mocked(sessionsApi.completeSession).mockRejectedValue(
        new Error("Network error"),
      );
      store.game.sessionId = "different-local-id";

      await setup.init();

      expect(setup.reconciliationFailed).toBe(true);
      expect(setup.showActiveSessionModal).toBe(false);
      expect(store.game.reset).not.toHaveBeenCalled();
    });
  });

  describe("continueSession / abandonSession", () => {
    it("continues matched session", async () => {
      const setup = createSetup({
        activeSession: {
          sessionId: "match-id",
          gameTypeKey: "SCORE_TRAINING",
        } as any,
      });

      const locationSpy = { href: "/games/score-training/setup" };
      vi.stubGlobal("location", locationSpy);

      setup.continueSession();

      expect(locationSpy.href).toBe("/games/score-training/play");
    });

    it("abandons session when user clicks Abandon", async () => {
      const setup = createSetup({
        activeSession: {
          sessionId: "match-id",
          gameTypeKey: "SCORE_TRAINING",
        } as any,
      });

      vi.mocked(sessionsApi.completeSession).mockResolvedValue({
        sessionId: "match-id",
        statusKey: "ABANDONED",
        completedAt: "2026-07-17T10:00:00Z",
      });

      await setup.abandonSession();

      expect(sessionsApi.completeSession).toHaveBeenCalledWith(
        "match-id",
        "ABANDONED",
      );
      expect(store.game.reset).toHaveBeenCalled();
      expect(setup.showActiveSessionModal).toBe(false);
      expect(setup.loading).toBe(false);
    });

    it("sets loading while abandonSession PATCH is in flight and clears it afterward", async () => {
      const setup = createSetup({
        activeSession: {
          sessionId: "match-id",
          gameTypeKey: "SCORE_TRAINING",
        } as any,
      });

      let resolveComplete!: (
        value: Awaited<ReturnType<typeof sessionsApi.completeSession>>,
      ) => void;
      vi.mocked(sessionsApi.completeSession).mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveComplete = resolve;
          }),
      );

      const pending = setup.abandonSession();
      expect(setup.loading).toBe(true);

      resolveComplete({
        sessionId: "match-id",
        statusKey: "ABANDONED",
        completedAt: "2026-07-17T10:00:00Z",
      });
      await pending;

      expect(setup.loading).toBe(false);
    });

    it("ignores a second abandonSession call while the first is in flight", async () => {
      const setup = createSetup({
        activeSession: {
          sessionId: "match-id",
          gameTypeKey: "SCORE_TRAINING",
        } as any,
      });

      let resolveComplete!: (
        value: Awaited<ReturnType<typeof sessionsApi.completeSession>>,
      ) => void;
      vi.mocked(sessionsApi.completeSession).mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveComplete = resolve;
          }),
      );

      const first = setup.abandonSession();
      const second = setup.abandonSession();
      expect(sessionsApi.completeSession).toHaveBeenCalledTimes(1);

      resolveComplete({
        sessionId: "match-id",
        statusKey: "ABANDONED",
        completedAt: "2026-07-17T10:00:00Z",
      });
      await Promise.all([first, second]);

      expect(sessionsApi.completeSession).toHaveBeenCalledTimes(1);
    });
  });

  describe("init fetch failure", () => {
    it("sets a visible error and clears loading when preset/active fetch throws", async () => {
      const setup = createSetup();
      vi.mocked(presetsApi.fetchConfigurationPresets).mockRejectedValue(
        new Error("Network error"),
      );
      vi.mocked(sessionsApi.fetchActiveSessions).mockResolvedValue([]);

      await setup.init();

      expect(setup.loadingReconciliation).toBe(false);
      expect(setup.error).toMatch(/connection/i);
      expect(setup.showActiveSessionModal).toBe(false);
    });
  });

  describe("session creation", () => {
    it("creates session with template config before navigating", async () => {
      const setup = createSetup({
        selectedTemplateId: "template-1",
        presets: [
          {
            configurationTemplateId: "template-1",
            name: "Standard",
            configuration: {
              duration_type: "ROUNDS",
              duration_value: 20,
              max_darts_per_turn: 3,
            },
          } as any,
        ],
      });

      const mockSession = {
        sessionId: "new-session-id",
        participants: [
          {
            ref: "participant-1",
            displayName: "Player",
            participantTypeKey: "PLAYER",
          },
        ],
      };

      vi.mocked(sessionsApi.createSession).mockResolvedValue(
        mockSession as any,
      );

      const locationSpy = { href: "" };
      vi.stubGlobal("location", locationSpy);

      await setup.start();

      expect(sessionsApi.createSession).toHaveBeenCalledWith({
        gameTypeKey: "SCORE_TRAINING",
        rulesetVersionKey: "SCORE_TRAINING_V1",
        captureModeKey: "RECREATIONAL",
        inputModeKey: "QUICK_SCORE",
        config: { source: "template", templateRef: "template-1" },
      });
      expect(store.game.startSession).toHaveBeenCalled();
      expect(locationSpy.href).toBe("/games/score-training/play");
    });
  });
});
