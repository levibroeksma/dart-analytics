import { describe, it, expect, vi, beforeEach } from "vitest";
import { shanghaiSetup } from "@lib/game/shanghai-setup.data";
import type { ShanghaiSetupContext } from "@lib/types";
import * as sessionsApi from "@client/api/sessions";
import * as presetsApi from "@client/api/configuration-templates";

vi.mock("@client/api/sessions");
vi.mock("@client/api/configuration-templates");

const STANDARD_PRESET = {
  configurationTemplateId: "tmpl-shanghai-standard",
  gameTypeKey: "SHANGHAI",
  name: "Shanghai — Standard",
  description: null,
  configuration: {},
  isSystemTemplate: true,
} as any;

const FULL_BOARD_NORMAL = {
  difficulty: "NORMAL",
  range_start: 1,
  range_end: 20,
  instant_win: true,
};

describe("shanghaiSetup", () => {
  let store: ShanghaiSetupContext["$store"];

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
        inputModeKey: "DETAILED_DARTS",
      },
    };
  });

  function createSetup(
    overrides: Partial<ShanghaiSetupContext> = {},
  ): ShanghaiSetupContext {
    return {
      ...shanghaiSetup(),
      $store: store,
      ...overrides,
    } as ShanghaiSetupContext;
  }

  describe("init", () => {
    it("loads the single seeded preset and starts on NORMAL difficulty", () => {
      const setup = createSetup();
      expect(setup.difficulty).toBe("NORMAL");
    });

    it("loads the single seeded preset", async () => {
      const setup = createSetup();
      vi.mocked(presetsApi.fetchConfigurationPresets).mockResolvedValue([
        STANDARD_PRESET,
      ]);
      vi.mocked(sessionsApi.fetchActiveSessions).mockResolvedValue([]);

      await setup.init();

      expect(presetsApi.fetchConfigurationPresets).toHaveBeenCalledWith(
        "SHANGHAI",
      );
      expect(setup.presets).toEqual([STANDARD_PRESET]);
      expect(setup.loadingReconciliation).toBe(false);
    });

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

  describe("reconciliation", () => {
    it('shows the active-session modal on "match"', async () => {
      const setup = createSetup();
      vi.mocked(presetsApi.fetchConfigurationPresets).mockResolvedValue([
        STANDARD_PRESET,
      ]);
      vi.mocked(sessionsApi.fetchActiveSessions).mockResolvedValue([
        { sessionId: "match-id", gameTypeKey: "SHANGHAI" } as any,
      ]);
      store.game.sessionId = "match-id";

      await setup.init();

      expect(setup.showActiveSessionModal).toBe(true);
      expect(setup.activeSession).toEqual({
        sessionId: "match-id",
        gameTypeKey: "SHANGHAI",
      });
    });

    it("shows the modal for a session held elsewhere, never abandoning it", async () => {
      const setup = createSetup();
      vi.mocked(presetsApi.fetchConfigurationPresets).mockResolvedValue([
        STANDARD_PRESET,
      ]);
      vi.mocked(sessionsApi.fetchActiveSessions).mockResolvedValue([
        { sessionId: "server-id", gameTypeKey: "SHANGHAI" } as any,
      ]);
      store.game.sessionId = "different-local-id";

      await setup.init();

      expect(sessionsApi.completeSession).not.toHaveBeenCalled();
      expect(setup.showActiveSessionModal).toBe(true);
      expect(setup.activeSessionLocal).toBe(false);
      expect(store.game.reset).not.toHaveBeenCalled();
    });
  });

  describe("continueSession / abandonSession", () => {
    it("continueSession navigates to the play page", () => {
      const setup = createSetup({
        activeSession: {
          sessionId: "match-id",
          gameTypeKey: "SHANGHAI",
        } as any,
      });
      const locationSpy = { href: "/games/shanghai/setup" };
      vi.stubGlobal("location", locationSpy);

      setup.continueSession();

      expect(locationSpy.href).toBe("/games/shanghai/play");
    });

    it("abandons session when user clicks Abandon", async () => {
      const setup = createSetup({
        activeSessionLocal: true,
        activeSession: {
          sessionId: "match-id",
          gameTypeKey: "SHANGHAI",
        } as any,
      });
      vi.mocked(sessionsApi.completeSession).mockResolvedValue({
        sessionId: "match-id",
        statusKey: "ABANDONED",
        completedAt: "2026-08-14T10:00:00Z",
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
  });

  describe("start", () => {
    it("creates a SHANGHAI_V3 session on the full board with instant win by default and redirects", async () => {
      const setup = createSetup({ presets: [STANDARD_PRESET] });
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
        gameTypeKey: "SHANGHAI",
        rulesetVersionKey: "SHANGHAI_V3",
        captureModeKey: "RECREATIONAL",
        inputModeKey: "DETAILED_DARTS",
        config: {
          source: "template",
          templateRef: "tmpl-shanghai-standard",
          overrides: FULL_BOARD_NORMAL,
        },
      });
      expect(store.game.startSession).toHaveBeenCalledWith(
        expect.objectContaining({
          templateRef: "tmpl-shanghai-standard",
          configSnapshot: {
            difficulty: "NORMAL",
            rangeStart: 1,
            rangeEnd: 20,
            instantWin: true,
            seats: [
              {
                participantRef: "participant-1",
                displayName: "Player",
                sideKey: "A",
                participantTypeKey: "PLAYER",
              },
            ],
          },
        }),
      );
      expect(locationSpy.href).toBe("/games/shanghai/play");
    });

    it("applies HARD difficulty when chosen", async () => {
      const setup = createSetup({
        presets: [STANDARD_PRESET],
        difficulty: "HARD",
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
          config: expect.objectContaining({
            overrides: { ...FULL_BOARD_NORMAL, difficulty: "HARD" },
          }),
        }),
      );
      expect(store.game.startSession).toHaveBeenCalledWith(
        expect.objectContaining({
          configSnapshot: expect.objectContaining({ difficulty: "HARD" }),
        }),
      );
    });

    it.each([
      ["1-7", 1, 7],
      ["1-10", 1, 10],
      ["1-20", 1, 20],
      ["11-20", 11, 20],
      ["13-20", 13, 20],
    ] as const)("range %s maps to rounds %i..%i", async (range, start, end) => {
      const setup = createSetup({ presets: [STANDARD_PRESET], range });
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
          config: expect.objectContaining({
            overrides: expect.objectContaining({
              range_start: start,
              range_end: end,
            }),
          }),
        }),
      );
      expect(store.game.startSession).toHaveBeenCalledWith(
        expect.objectContaining({
          configSnapshot: expect.objectContaining({
            rangeStart: start,
            rangeEnd: end,
          }),
        }),
      );
    });

    it("Score-only sends instant_win false and keeps Hard", async () => {
      const setup = createSetup({
        presets: [STANDARD_PRESET],
        winRule: "SCORE_ONLY",
        difficulty: "HARD",
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
          config: expect.objectContaining({
            overrides: expect.objectContaining({
              instant_win: false,
              difficulty: "HARD",
            }),
          }),
        }),
      );
    });

    it("starts on the full board with instant win", () => {
      const setup = createSetup();
      expect(setup.range).toBe("1-20");
      expect(setup.winRule).toBe("INSTANT");
    });

    it("falls back to Shanghai's declared pair when settings holds a pair it does not declare", async () => {
      store.settings = {
        captureModeKey: "RECREATIONAL",
        inputModeKey: "QUICK_SCORE",
      };
      const setup = createSetup({ presets: [STANDARD_PRESET] });
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
          captureModeKey: "RECREATIONAL",
          inputModeKey: "DETAILED_DARTS",
        }),
      );
    });

    it("errors when no preset is available", async () => {
      const setup = createSetup({ presets: [] });
      await setup.start();
      expect(sessionsApi.createSession).not.toHaveBeenCalled();
      expect(setup.error).toBe("Could not find a preset for Shanghai.");
    });

    it("keeps HARD difficulty and creates SHANGHAI_V3 once a guest is added", async () => {
      const setup = createSetup({
        presets: [STANDARD_PRESET],
        difficulty: "HARD",
      });
      setup.newGuestName = "Friend";
      setup.addGuest();
      expect(setup.difficulty).toBe("HARD");

      vi.mocked(sessionsApi.createSession).mockResolvedValue({
        sessionId: "new-session-id",
        participants: [
          {
            ref: "participant-1",
            displayName: "Player",
            participantTypeKey: "PLAYER",
          },
          {
            ref: "participant-2",
            displayName: "Friend",
            participantTypeKey: "GUEST",
          },
        ],
      } as any);
      vi.stubGlobal("location", { href: "" });

      await setup.start();

      expect(sessionsApi.createSession).toHaveBeenCalledWith(
        expect.objectContaining({
          rulesetVersionKey: "SHANGHAI_V3",
          config: expect.objectContaining({
            overrides: { ...FULL_BOARD_NORMAL, difficulty: "HARD" },
          }),
        }),
      );
      expect(store.game.startSession).toHaveBeenCalledWith(
        expect.objectContaining({
          rulesetVersionKey: "SHANGHAI_V3",
          configSnapshot: expect.objectContaining({ difficulty: "HARD" }),
        }),
      );
    });

    it("keeps HARD difficulty and creates SHANGHAI_V3 once a DartBot is seated", async () => {
      const setup = createSetup({
        presets: [STANDARD_PRESET],
        difficulty: "HARD",
      });
      setup.addBot();
      expect(setup.bot).toEqual({ level: 8 });
      expect(setup.difficulty).toBe("HARD");

      vi.mocked(sessionsApi.createSession).mockResolvedValue({
        sessionId: "new-session-id",
        participants: [
          {
            ref: "participant-1",
            displayName: "Player",
            participantTypeKey: "PLAYER",
          },
          {
            ref: "bot-1",
            displayName: "DartBot",
            participantTypeKey: "DARTBOT",
            dartbot: { level: 8, seed: 1, levelSource: "MANUAL" },
          },
        ],
      } as any);
      vi.stubGlobal("location", { href: "" });

      await setup.start();

      expect(sessionsApi.createSession).toHaveBeenCalledWith(
        expect.objectContaining({
          rulesetVersionKey: "SHANGHAI_V3",
          config: expect.objectContaining({
            overrides: { ...FULL_BOARD_NORMAL, difficulty: "HARD" },
          }),
        }),
      );
      expect(store.game.startSession).toHaveBeenCalledWith(
        expect.objectContaining({
          rulesetVersionKey: "SHANGHAI_V3",
          configSnapshot: expect.objectContaining({ difficulty: "HARD" }),
        }),
      );
    });

    it("re-reconciles into the active-session modal when create reports SESSION_ALREADY_ACTIVE", async () => {
      const setup = createSetup({ presets: [STANDARD_PRESET] });
      vi.mocked(sessionsApi.createSession).mockRejectedValue(
        Object.assign(new Error("already active"), {
          code: "SESSION_ALREADY_ACTIVE",
        }),
      );
      vi.mocked(sessionsApi.fetchActiveSessions).mockResolvedValue([
        { sessionId: "active-1", gameTypeKey: "SHANGHAI" } as any,
      ]);
      store.game.sessionId = "active-1";

      await setup.start();

      expect(setup.showActiveSessionModal).toBe(true);
      expect(setup.activeSession).toMatchObject({ sessionId: "active-1" });
      expect(setup.loading).toBe(false);
    });
  });
});
