import { describe, it, expect, vi, beforeEach } from "vitest";
import { scoreTrainingSetup } from "@lib/game/score-training-setup.data";
import type { ScoreTrainingSetupContext } from "@lib/types";
import * as sessionsApi from "@client/api/sessions";
import * as presetsApi from "@client/api/configuration-templates";

vi.mock("@client/api/sessions");
vi.mock("@client/api/configuration-templates");

const ROUND_PRESET = {
  configurationTemplateId: "tmpl-rounds",
  name: "Score Training — 10 Rounds",
  configuration: {
    duration_type: "ROUNDS",
    duration_value: 10,
    max_darts_per_turn: 3,
  },
} as any;

const MINUTES_PRESET = {
  configurationTemplateId: "tmpl-minutes",
  name: "Score Training — 5 Minutes",
  configuration: {
    duration_type: "MINUTES",
    duration_value: 5,
    max_darts_per_turn: 3,
  },
} as any;

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
      settings: {
        captureModeKey: "RECREATIONAL",
        inputModeKey: "QUICK_SCORE",
      },
    };
  });

  let watchers: Array<{
    key: string;
    callback: (value: never) => void;
  }>;

  function createSetup(
    overrides: Partial<ScoreTrainingSetupContext> = {},
  ): ScoreTrainingSetupContext {
    watchers = [];
    return {
      ...scoreTrainingSetup(),
      $store: store,
      $watch: (key: string, callback: (value: never) => void) => {
        watchers.push({ key, callback });
      },
      ...overrides,
    } as ScoreTrainingSetupContext;
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

  describe("init duration defaults", () => {
    it("defaults to ROUNDS and the rounds preset duration_value", async () => {
      const setup = createSetup();
      vi.mocked(presetsApi.fetchConfigurationPresets).mockResolvedValue([
        ROUND_PRESET,
        MINUTES_PRESET,
      ]);
      vi.mocked(sessionsApi.fetchActiveSessions).mockResolvedValue([]);
      await setup.init();
      expect(setup.durationType).toBe("ROUNDS");
      expect(setup.durationValue).toBe(10);
      expect(setup.clampNotice).toBe("");
    });
  });

  describe("selectMode", () => {
    it("resets durationValue to the mode preset default and clears clampNotice", () => {
      const setup = createSetup({
        presets: [ROUND_PRESET, MINUTES_PRESET],
        durationType: "ROUNDS",
        durationValue: 20,
        clampNotice: "Allowed range: 1–100 rounds",
      });
      setup.selectMode("MINUTES");
      expect(setup.durationType).toBe("MINUTES");
      expect(setup.durationValue).toBe(5);
      expect(setup.clampNotice).toBe("");
    });

    it("init registers a durationType watcher that runs selectMode", async () => {
      const setup = createSetup();

      vi.mocked(presetsApi.fetchConfigurationPresets).mockResolvedValue([
        ROUND_PRESET,
        MINUTES_PRESET,
      ]);
      vi.mocked(sessionsApi.fetchActiveSessions).mockResolvedValue([]);

      await setup.init();

      const watcher = watchers.find((w) => w.key === "durationType");
      expect(watcher).toBeDefined();

      setup.durationType = "MINUTES";
      setup.clampNotice = "Allowed range: 1–100 rounds";
      watcher!.callback("MINUTES" as never);

      expect(setup.durationValue).toBe(5);
      expect(setup.clampNotice).toBe("");
    });
  });

  describe("session creation", () => {
    it("creates with template + duration_value override after clamp", async () => {
      const setup = createSetup({
        presets: [ROUND_PRESET, MINUTES_PRESET],
        durationType: "ROUNDS",
        durationValue: 20,
        clampNotice: "",
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
        gameTypeKey: "SCORE_TRAINING",
        rulesetVersionKey: "SCORE_TRAINING_V1",
        captureModeKey: "RECREATIONAL",
        inputModeKey: "QUICK_SCORE",
        config: {
          source: "template",
          templateRef: "tmpl-rounds",
          overrides: { duration_value: 20 },
        },
      });
      expect(store.game.startSession).toHaveBeenCalledWith(
        expect.objectContaining({
          templateRef: "tmpl-rounds",
          configSnapshot: expect.objectContaining({
            durationType: "ROUNDS",
            durationValue: 20,
            maxDartsPerTurn: 3,
          }),
        }),
      );
      expect(locationSpy.href).toBe("/games/score-training/play");
    });

    it("sends the player's chosen supported pair from settings instead of a hardcoded one", async () => {
      store.settings = {
        captureModeKey: "ANALYTICS",
        inputModeKey: "VISUAL_BOARD",
      };
      const setup = createSetup({
        presets: [ROUND_PRESET, MINUTES_PRESET],
        durationType: "ROUNDS",
        durationValue: 20,
        clampNotice: "",
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

    it("falls back to quick score when settings holds a pair score training does not declare", async () => {
      store.settings = {
        captureModeKey: "RECREATIONAL",
        inputModeKey: "DETAILED_DARTS",
      };
      const setup = createSetup({
        presets: [ROUND_PRESET, MINUTES_PRESET],
        durationType: "ROUNDS",
        durationValue: 20,
        clampNotice: "",
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
          captureModeKey: "RECREATIONAL",
          inputModeKey: "QUICK_SCORE",
        }),
      );
    });

    it("defaults to quick score when settings has not loaded", async () => {
      store.settings = {} as any;
      const setup = createSetup({
        presets: [ROUND_PRESET, MINUTES_PRESET],
        durationType: "ROUNDS",
        durationValue: 20,
        clampNotice: "",
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
          captureModeKey: "RECREATIONAL",
          inputModeKey: "QUICK_SCORE",
        }),
      );
    });

    it("clamps out-of-range values, sets clampNotice, and still creates", async () => {
      const setup = createSetup({
        presets: [ROUND_PRESET, MINUTES_PRESET],
        durationType: "ROUNDS",
        durationValue: 250,
        clampNotice: "",
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

      expect(setup.durationValue).toBe(100);
      expect(setup.clampNotice).toBe("Allowed range: 1–100 rounds");
      expect(sessionsApi.createSession).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.objectContaining({
            overrides: { duration_value: 100 },
          }),
        }),
      );
    });

    it("clamps a blank field to the mode minimum", async () => {
      const setup = createSetup({
        presets: [ROUND_PRESET, MINUTES_PRESET],
        durationType: "MINUTES",
        durationValue: null,
        clampNotice: "",
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

      expect(setup.durationValue).toBe(3);
      expect(setup.clampNotice).toBe("Allowed range: 3–30 minutes");
      expect(sessionsApi.createSession).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.objectContaining({
            overrides: { duration_value: 3 },
          }),
        }),
      );
    });

    it("errors when no preset matches the mode", async () => {
      const setup = createSetup({
        presets: [ROUND_PRESET],
        durationType: "MINUTES",
        durationValue: 5,
      });
      await setup.start();
      expect(sessionsApi.createSession).not.toHaveBeenCalled();
      expect(setup.error).toBe("Could not find a preset for this mode.");
    });

    it("rejects a preset whose configuration is missing required fields, before creating a session", async () => {
      const setup = createSetup({
        presets: [
          {
            configurationTemplateId: "template-1",
            name: "Broken",
            configuration: { duration_type: "ROUNDS" },
          } as any,
        ],
        durationType: "ROUNDS",
        durationValue: 20,
      });

      await setup.start();

      expect(sessionsApi.createSession).not.toHaveBeenCalled();
      expect(store.game.startSession).not.toHaveBeenCalled();
      expect(setup.error).toMatch(/Could not start the session/);
      expect(setup.loading).toBe(false);
    });

    it("ignores a second start call while the first is in flight", async () => {
      const setup = createSetup({
        presets: [ROUND_PRESET, MINUTES_PRESET],
        durationType: "ROUNDS",
        durationValue: 20,
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
        durationValue: 20,
      });

      vi.mocked(sessionsApi.createSession).mockRejectedValue(
        Object.assign(new Error("already active"), {
          code: "SESSION_ALREADY_ACTIVE",
        }),
      );
      vi.mocked(sessionsApi.fetchActiveSessions).mockResolvedValue([
        { sessionId: "active-1", gameTypeKey: "SCORE_TRAINING" } as any,
      ]);
      store.game.sessionId = "active-1";

      await setup.start();

      expect(setup.showActiveSessionModal).toBe(true);
      expect(setup.activeSession).toMatchObject({ sessionId: "active-1" });
      expect(setup.loading).toBe(false);
    });

    it("threads a PLAYER seat A and the guest as seat B once a guest is added", async () => {
      const setup = createSetup({
        presets: [ROUND_PRESET, MINUTES_PRESET],
        durationType: "ROUNDS",
        durationValue: 20,
        clampNotice: "",
      });
      setup.newGuestName = "Guest 1";
      setup.addGuest();
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
            displayName: "Guest 1",
            participantTypeKey: "GUEST",
          },
        ],
      } as any);
      vi.stubGlobal("location", { href: "" });

      await setup.start();

      expect(sessionsApi.createSession).toHaveBeenCalledWith(
        expect.objectContaining({
          participants: [
            { participantTypeKey: "PLAYER", sideKey: "A" },
            {
              participantTypeKey: "GUEST",
              displayName: "Guest 1",
              sideKey: "B",
            },
          ],
        }),
      );
    });
  });
});

describe("scoreTrainingSetup — opponent-slot shape", () => {
  it('carries `bot` and `showOpponentChooser` so GuestSection.astro\'s Alpine expressions (`!bot`, `x-if="bot"`, `x-if="showOpponentChooser"`) never reference an undefined identifier', () => {
    const setup = scoreTrainingSetup();

    expect(setup).toHaveProperty("bot", null);
    expect(setup).toHaveProperty("showOpponentChooser", false);
  });
});

describe("scoreTrainingSetup — guests", () => {
  function makeSetup() {
    return {
      ...scoreTrainingSetup(),
      $store: {
        game: { sessionId: null, reset: vi.fn(), startSession: vi.fn() },
        settings: {
          captureModeKey: "RECREATIONAL",
          inputModeKey: "QUICK_SCORE",
        },
      },
      $watch: () => {},
    } as unknown as ScoreTrainingSetupContext;
  }

  it("caps 1v1 at a single guest", () => {
    const setup = makeSetup();
    setup.newGuestName = "Guest 1";
    setup.addGuest();
    setup.newGuestName = "Guest 2";
    setup.addGuest();

    expect(setup.guests).toHaveLength(1);
    expect(setup.guests[0].displayName).toBe("Guest 1");
  });

  it("ignores a blank guest name", () => {
    const setup = makeSetup();
    setup.newGuestName = "   ";
    setup.addGuest();

    expect(setup.guests).toHaveLength(0);
  });

  it("removeGuest drops the guest by index", () => {
    const setup = makeSetup();
    setup.newGuestName = "Guest 1";
    setup.addGuest();

    setup.removeGuest(0);

    expect(setup.guests).toHaveLength(0);
  });

  it("trims the typed name, clears the field and closes the modal", () => {
    const setup = makeSetup();
    setup.showAddGuestModal = true;
    setup.newGuestName = "  Guest 1  ";
    setup.addGuest();

    expect(setup.guests[0].displayName).toBe("Guest 1");
    expect(setup.newGuestName).toBe("");
    expect(setup.showAddGuestModal).toBe(false);
  });

  it("leaves the modal open and the typed name intact when it refuses", () => {
    const setup = makeSetup();
    setup.newGuestName = "Guest 1";
    setup.addGuest();
    setup.showAddGuestModal = true;
    setup.newGuestName = "Guest 2";
    setup.addGuest();

    expect(setup.newGuestName).toBe("Guest 2");
    expect(setup.showAddGuestModal).toBe(true);
  });
});

describe("scoreTrainingSetup — 1v1 forces ROUNDS", () => {
  it("forceRoundsIfGuested resets MINUTES back to ROUNDS once a guest is added", () => {
    const ctx = scoreTrainingSetup() as unknown as {
      durationType: string;
      guests: { displayName: string }[];
      newGuestName: string;
      addGuest: () => void;
    };
    ctx.durationType = "MINUTES";
    ctx.newGuestName = "Guest 1";
    ctx.addGuest();
    expect(ctx.durationType).toBe("ROUNDS");
  });
});

describe("scoreTrainingSetup — bot wiring", () => {
  it("initializes the level picker to DEFAULT_BOT_LEVEL and no picker shown", () => {
    const setup = scoreTrainingSetup() as unknown as {
      pendingBotLevel: number;
      showBotLevelPicker: boolean;
    };
    expect(setup.pendingBotLevel).toBe(8);
    expect(setup.showBotLevelPicker).toBe(false);
  });

  it("addBot seats a level-8 DartBot and locks duration to ROUNDS, like a guest does", () => {
    const ctx = scoreTrainingSetup() as unknown as {
      durationType: string;
      bot: { level: number } | null;
      addBot: () => void;
    };
    ctx.durationType = "MINUTES";

    ctx.addBot();

    expect(ctx.bot).toEqual({ level: 8 });
    expect(ctx.durationType).toBe("ROUNDS");
  });

  it("addBot refuses when a guest is already seated, and vice versa", () => {
    const ctx = scoreTrainingSetup() as unknown as {
      guests: { displayName: string }[];
      newGuestName: string;
      bot: { level: number } | null;
      addGuest: () => void;
      addBot: () => void;
      removeGuest: (index: number) => void;
    };

    ctx.newGuestName = "Guest 1";
    ctx.addGuest();
    ctx.addBot();
    expect(ctx.bot).toBeNull();

    ctx.removeGuest(0);
    ctx.addBot();
    ctx.newGuestName = "Guest 2";
    ctx.addGuest();
    expect(ctx.guests).toEqual([]);
  });

  it("removeBot clears the seated bot", () => {
    const ctx = scoreTrainingSetup() as unknown as {
      bot: { level: number } | null;
      addBot: () => void;
      removeBot: () => void;
    };
    ctx.addBot();

    ctx.removeBot();

    expect(ctx.bot).toBeNull();
  });

  it("a seated bot starts a SCORE_TRAINING_V1 session with a 2-seat DARTBOT participants array", async () => {
    const setup = {
      ...scoreTrainingSetup(),
      $store: {
        game: { sessionId: null, reset: vi.fn(), startSession: vi.fn() },
        settings: {
          captureModeKey: "RECREATIONAL",
          inputModeKey: "QUICK_SCORE",
        },
      },
      $watch: () => {},
      presets: [ROUND_PRESET, MINUTES_PRESET],
      durationType: "ROUNDS",
      durationValue: 20,
      clampNotice: "",
    } as unknown as ScoreTrainingSetupContext;
    (setup as unknown as { bot: { level: number } | null }).bot = {
      level: 8,
    };
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
        rulesetVersionKey: "SCORE_TRAINING_V1",
        participants: [
          { participantTypeKey: "PLAYER", sideKey: "A" },
          { participantTypeKey: "DARTBOT", level: 8, sideKey: "B" },
        ],
      }),
    );
  });
});
