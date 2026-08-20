import { describe, it, expect, vi, beforeEach } from "vitest";
import { tuodSetup } from "@lib/game/tuod-setup.data";
import type { TuodSetupContext } from "@lib/types";
import * as sessionsApi from "@client/api/sessions";
import * as presetsApi from "@client/api/configuration-templates";

vi.mock("@client/api/sessions");
vi.mock("@client/api/configuration-templates");

const ROUND_PRESET = {
  configurationTemplateId: "tmpl-rounds",
  name: "TUOD — 10 Rounds",
  configuration: {
    starting_target: 41,
    finish_bonus: 10,
    miss_penalty: 1,
    duration_type: "ROUNDS",
    duration_value: 10,
    max_darts_per_turn: 3,
  },
} as any;

const MINUTES_PRESET = {
  configurationTemplateId: "tmpl-minutes",
  name: "TUOD — 10 Minutes",
  configuration: {
    starting_target: 41,
    finish_bonus: 10,
    miss_penalty: 1,
    duration_type: "MINUTES",
    duration_value: 10,
    max_darts_per_turn: 3,
  },
} as any;

describe("tuodSetup", () => {
  let store: TuodSetupContext["$store"];

  beforeEach(() => {
    vi.clearAllMocks();
    store = {
      game: {
        sessionId: null,
        reset: vi.fn(),
        startSession: vi.fn(),
      },
      settings: {
        captureModeKey: "RECREATIONAL",
        inputModeKey: "QUICK_SCORE",
      },
    };
  });

  function createSetup(
    overrides: Partial<TuodSetupContext> = {},
  ): TuodSetupContext {
    return {
      ...tuodSetup(),
      $store: store,
      ...overrides,
    } as TuodSetupContext;
  }

  describe("init", () => {
    it("loads both presets and defaults to ROUNDS", async () => {
      const setup = createSetup();
      vi.mocked(presetsApi.fetchConfigurationPresets).mockResolvedValue([
        ROUND_PRESET,
        MINUTES_PRESET,
      ]);
      vi.mocked(sessionsApi.fetchActiveSessions).mockResolvedValue([]);

      await setup.init();

      expect(setup.presets).toEqual([ROUND_PRESET, MINUTES_PRESET]);
      expect(setup.durationType).toBe("ROUNDS");
      expect(presetsApi.fetchConfigurationPresets).toHaveBeenCalledWith("TUOD");
    });

    it("sets a visible error and clears loading when the fetch throws", async () => {
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

  describe("reconciliation on init", () => {
    it('shows modal on "match"', async () => {
      const setup = createSetup();
      vi.mocked(presetsApi.fetchConfigurationPresets).mockResolvedValue([]);
      vi.mocked(sessionsApi.fetchActiveSessions).mockResolvedValue([
        { sessionId: "match-id", gameTypeKey: "TUOD" } as any,
      ]);
      store.game.sessionId = "match-id";

      await setup.init();

      expect(setup.showActiveSessionModal).toBe(true);
      expect(setup.activeSession).toEqual({
        sessionId: "match-id",
        gameTypeKey: "TUOD",
      });
    });

    it('shows preset picker on "no_active" (mismatch auto-abandoned)', async () => {
      const setup = createSetup();
      vi.mocked(presetsApi.fetchConfigurationPresets).mockResolvedValue([]);
      vi.mocked(sessionsApi.fetchActiveSessions).mockResolvedValue([
        { sessionId: "server-id", gameTypeKey: "TUOD" } as any,
      ]);
      vi.mocked(sessionsApi.completeSession).mockResolvedValue({
        sessionId: "server-id",
        statusKey: "ABANDONED",
        completedAt: "2026-08-20T10:00:00Z",
      });
      store.game.sessionId = "different-local-id";

      await setup.init();

      expect(setup.showActiveSessionModal).toBe(false);
      expect(setup.reconciliationFailed).toBe(false);
    });

    it('blocks the picker and sets reconciliationFailed on "abandon_failed"', async () => {
      const setup = createSetup();
      vi.mocked(presetsApi.fetchConfigurationPresets).mockResolvedValue([]);
      vi.mocked(sessionsApi.fetchActiveSessions).mockResolvedValue([
        { sessionId: "server-id", gameTypeKey: "TUOD" } as any,
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
    it("continues to the play route", () => {
      const setup = createSetup({
        activeSession: { sessionId: "match-id", gameTypeKey: "TUOD" } as any,
      });
      const locationSpy = { href: "/games/tuod/setup" };
      vi.stubGlobal("location", locationSpy);

      setup.continueSession();

      expect(locationSpy.href).toBe("/games/tuod/play");
    });

    it("abandons the active session", async () => {
      const setup = createSetup({
        activeSession: { sessionId: "match-id", gameTypeKey: "TUOD" } as any,
      });
      vi.mocked(sessionsApi.completeSession).mockResolvedValue({
        sessionId: "match-id",
        statusKey: "ABANDONED",
        completedAt: "2026-08-20T10:00:00Z",
      });

      await setup.abandonSession();

      expect(sessionsApi.completeSession).toHaveBeenCalledWith(
        "match-id",
        "ABANDONED",
      );
      expect(store.game.reset).toHaveBeenCalled();
      expect(setup.showActiveSessionModal).toBe(false);
    });
  });

  describe("presetForMode", () => {
    it("finds the preset matching the requested duration type", () => {
      const setup = createSetup({ presets: [ROUND_PRESET, MINUTES_PRESET] });
      expect(setup.presetForMode("ROUNDS")).toBe(ROUND_PRESET);
      expect(setup.presetForMode("MINUTES")).toBe(MINUTES_PRESET);
    });
  });

  describe("start", () => {
    it("creates a session from the selected preset's template, unmodified", async () => {
      const setup = createSetup({
        presets: [ROUND_PRESET, MINUTES_PRESET],
        durationType: "MINUTES",
      });
      vi.mocked(sessionsApi.createSession).mockResolvedValue({
        sessionId: "new-session-id",
        participants: [
          {
            ref: "participant-1",
            displayName: "Player",
            participantTypeKey: "PLAYER",
          },
        ],
      } as any);
      const locationSpy = { href: "" };
      vi.stubGlobal("location", locationSpy);

      await setup.start();

      expect(sessionsApi.createSession).toHaveBeenCalledWith({
        gameTypeKey: "TUOD",
        rulesetVersionKey: "TUOD_V1",
        captureModeKey: "RECREATIONAL",
        inputModeKey: "QUICK_SCORE",
        config: {
          source: "template",
          templateRef: "tmpl-minutes",
        },
      });
      expect(store.game.startSession).toHaveBeenCalledWith(
        expect.objectContaining({
          templateRef: "tmpl-minutes",
          configSnapshot: expect.objectContaining({
            startingTarget: 41,
            finishBonus: 10,
            missPenalty: 1,
            durationType: "MINUTES",
            durationValue: 10,
            maxDartsPerTurn: 3,
          }),
        }),
      );
      expect(locationSpy.href).toBe("/games/tuod/play");
    });

    it("errors when no preset matches the selected mode", async () => {
      const setup = createSetup({
        presets: [ROUND_PRESET],
        durationType: "MINUTES",
      });

      await setup.start();

      expect(sessionsApi.createSession).not.toHaveBeenCalled();
      expect(setup.error).toBe("Could not find a preset for this mode.");
    });

    it("ignores a second start call while the first is in flight", async () => {
      const setup = createSetup({
        presets: [ROUND_PRESET, MINUTES_PRESET],
        durationType: "ROUNDS",
        loading: true,
      });

      await setup.start();

      expect(sessionsApi.createSession).not.toHaveBeenCalled();
      expect(store.game.startSession).not.toHaveBeenCalled();
    });

    it("re-reconciles into the active-session modal when create reports SESSION_ALREADY_ACTIVE", async () => {
      const setup = createSetup({
        presets: [ROUND_PRESET, MINUTES_PRESET],
        durationType: "ROUNDS",
      });
      vi.mocked(sessionsApi.createSession).mockRejectedValue(
        Object.assign(new Error("already active"), {
          code: "SESSION_ALREADY_ACTIVE",
        }),
      );
      vi.mocked(sessionsApi.fetchActiveSessions).mockResolvedValue([
        { sessionId: "active-1", gameTypeKey: "TUOD" } as any,
      ]);
      store.game.sessionId = "active-1";

      await setup.start();

      expect(setup.showActiveSessionModal).toBe(true);
      expect(setup.activeSession).toMatchObject({ sessionId: "active-1" });
      expect(setup.loading).toBe(false);
    });

    it("sends the player's chosen supported pair from settings", async () => {
      store.settings = {
        captureModeKey: "ANALYTICS",
        inputModeKey: "VISUAL_BOARD",
      };
      const setup = createSetup({
        presets: [ROUND_PRESET, MINUTES_PRESET],
        durationType: "ROUNDS",
      });
      vi.mocked(sessionsApi.createSession).mockResolvedValue({
        sessionId: "new-session-id",
        participants: [
          {
            ref: "participant-1",
            displayName: "Player",
            participantTypeKey: "PLAYER",
          },
        ],
      } as any);
      vi.stubGlobal("location", { href: "" });

      await setup.start();

      expect(sessionsApi.createSession).toHaveBeenCalledWith(
        expect.objectContaining({
          captureModeKey: "ANALYTICS",
          inputModeKey: "VISUAL_BOARD",
        }),
      );
    });
  });
});
