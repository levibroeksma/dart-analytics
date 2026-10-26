// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { aroundTheClockSetup } from "@lib/game/around-the-clock-setup.data";
import { AROUND_THE_CLOCK_DEFAULT_MINUTES } from "@lib/game/around-the-clock-duration";
import type { AroundTheClockSetupContext } from "@lib/types";
import * as sessionsApi from "@client/api/sessions";
import * as presetsApi from "@client/api/configuration-templates";

vi.mock("@client/api/sessions");
vi.mock("@client/api/configuration-templates");

const STANDARD_PRESET = {
  configurationTemplateId: "tmpl-around-the-clock-standard",
  gameTypeKey: "AROUND_THE_CLOCK",
  name: "Around the Clock — Standard",
  description: null,
  configuration: {},
  isSystemTemplate: true,
} as any;

const V2_WIRE_DEFAULTS = {
  path_direction: "LOW_TO_HIGH",
  odds_first: false,
  segment_rule: "ANY",
  difficulty: "EASY",
  duration_type: "UNTIMED",
  duration_value: null,
};

describe("aroundTheClockSetup", () => {
  let store: AroundTheClockSetupContext["$store"];

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
    overrides: Partial<AroundTheClockSetupContext> = {},
  ): AroundTheClockSetupContext {
    return {
      ...aroundTheClockSetup(),
      $store: store,
      ...overrides,
    } as AroundTheClockSetupContext;
  }

  describe("init", () => {
    it("loads the single seeded preset", async () => {
      const setup = createSetup();
      vi.mocked(presetsApi.fetchConfigurationPresets).mockResolvedValue([
        STANDARD_PRESET,
      ]);
      vi.mocked(sessionsApi.fetchActiveSessions).mockResolvedValue([]);

      await setup.init();

      expect(presetsApi.fetchConfigurationPresets).toHaveBeenCalledWith(
        "AROUND_THE_CLOCK",
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
        { sessionId: "match-id", gameTypeKey: "AROUND_THE_CLOCK" } as any,
      ]);
      store.game.sessionId = "match-id";

      await setup.init();

      expect(setup.showActiveSessionModal).toBe(true);
      expect(setup.activeSession).toEqual({
        sessionId: "match-id",
        gameTypeKey: "AROUND_THE_CLOCK",
      });
    });

    it("shows the modal for a session held elsewhere, never abandoning it", async () => {
      const setup = createSetup();
      vi.mocked(presetsApi.fetchConfigurationPresets).mockResolvedValue([
        STANDARD_PRESET,
      ]);
      vi.mocked(sessionsApi.fetchActiveSessions).mockResolvedValue([
        { sessionId: "server-id", gameTypeKey: "AROUND_THE_CLOCK" } as any,
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
          gameTypeKey: "AROUND_THE_CLOCK",
        } as any,
      });
      const locationSpy = { href: "/games/around-the-clock/setup" };
      vi.stubGlobal("location", locationSpy);

      setup.continueSession();

      expect(locationSpy.href).toBe("/games/around-the-clock/play");
    });

    it("abandons session when user clicks Abandon", async () => {
      const setup = createSetup({
        activeSessionLocal: true,
        activeSession: {
          sessionId: "match-id",
          gameTypeKey: "AROUND_THE_CLOCK",
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
    it("creates a solo V2 session from the seeded preset with every V2 key and redirects", async () => {
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
        gameTypeKey: "AROUND_THE_CLOCK",
        rulesetVersionKey: "AROUND_THE_CLOCK_V2",
        captureModeKey: "RECREATIONAL",
        inputModeKey: "DETAILED_DARTS",
        config: {
          source: "template",
          templateRef: "tmpl-around-the-clock-standard",
          overrides: V2_WIRE_DEFAULTS,
        },
      });
      expect(store.game.startSession).toHaveBeenCalledWith(
        expect.objectContaining({
          templateRef: "tmpl-around-the-clock-standard",
          configSnapshot: {
            pathDirection: "LOW_TO_HIGH",
            oddsFirst: false,
            segmentRule: "ANY",
            difficulty: "EASY",
            durationType: "UNTIMED",
            durationValue: null,
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
      expect(locationSpy.href).toBe("/games/around-the-clock/play");
    });

    it("falls back to Around the Clock's declared pair when settings holds a pair it does not declare", async () => {
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
      expect(setup.error).toBe("Could not find a preset for Around the Clock.");
    });

    it("re-reconciles into the active-session modal when create reports SESSION_ALREADY_ACTIVE", async () => {
      const setup = createSetup({ presets: [STANDARD_PRESET] });
      vi.mocked(sessionsApi.createSession).mockRejectedValue(
        Object.assign(new Error("already active"), {
          code: "SESSION_ALREADY_ACTIVE",
        }),
      );
      vi.mocked(sessionsApi.fetchActiveSessions).mockResolvedValue([
        { sessionId: "active-1", gameTypeKey: "AROUND_THE_CLOCK" } as any,
      ]);
      store.game.sessionId = "active-1";

      await setup.start();

      expect(setup.showActiveSessionModal).toBe(true);
      expect(setup.activeSession).toMatchObject({ sessionId: "active-1" });
      expect(setup.loading).toBe(false);
    });
  });

  describe("V2 variants", () => {
    function mockCreate() {
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
    }

    function sentConfig() {
      return vi.mocked(sessionsApi.createSession).mock.calls[0][0];
    }

    it("sends a timed run's minutes", async () => {
      mockCreate();
      const setup = createSetup({ presets: [STANDARD_PRESET] });
      setup.durationType = "MINUTES";
      setup.durationValue = 12;
      await setup.start();
      expect(sentConfig().config).toMatchObject({
        overrides: { duration_type: "MINUTES", duration_value: 12 },
      });
    });

    it("defaults an empty timed run to AROUND_THE_CLOCK_DEFAULT_MINUTES", async () => {
      mockCreate();
      const setup = createSetup({ presets: [STANDARD_PRESET] });
      setup.durationType = "MINUTES";
      await setup.start();
      expect(sentConfig().config).toMatchObject({
        overrides: {
          duration_type: "MINUTES",
          duration_value: AROUND_THE_CLOCK_DEFAULT_MINUTES,
        },
      });
    });

    it("clamps a timed run past 30 minutes", async () => {
      mockCreate();
      const setup = createSetup({ presets: [STANDARD_PRESET] });
      setup.durationType = "MINUTES";
      setup.durationValue = 45;
      await setup.start();
      expect(sentConfig().config).toMatchObject({
        overrides: { duration_value: 30 },
      });
      expect(setup.durationValue).toBe(30);
    });

    it("sends outer single only under ANALYTICS", async () => {
      mockCreate();
      store.settings = {
        captureModeKey: "ANALYTICS",
        inputModeKey: "VISUAL_BOARD",
      };
      const setup = createSetup({ presets: [STANDARD_PRESET] });
      setup.segmentRule = "OUTER_SINGLE";
      await setup.start();
      expect(sentConfig().config).toMatchObject({
        overrides: { segment_rule: "OUTER_SINGLE" },
      });
    });

    it("sends any segment when capture is not ANALYTICS (the row is hidden)", async () => {
      mockCreate();
      const setup = createSetup({ presets: [STANDARD_PRESET] });
      setup.segmentRule = "OUTER_SINGLE";
      await setup.start();
      expect(sentConfig().config).toMatchObject({
        overrides: { segment_rule: "ANY" },
      });
    });

    it("falls back to V1 with no overrides when a bot is seated", async () => {
      mockCreate();
      const setup = createSetup({
        presets: [STANDARD_PRESET],
        bot: { level: 5 },
      });
      await setup.start();
      expect(sentConfig().rulesetVersionKey).toBe("AROUND_THE_CLOCK_V1");
      expect(sentConfig().config).not.toHaveProperty("overrides");
    });

    it("forces a guest game untimed", async () => {
      mockCreate();
      const setup = createSetup({ presets: [STANDARD_PRESET] });
      setup.durationType = "MINUTES";
      setup.durationValue = 10;
      setup.newGuestName = "Sam";
      setup.addGuest();
      expect(setup.guests).toHaveLength(1);
      expect(setup.durationType).toBe("UNTIMED");
      expect(setup.durationValue).toBeNull();
      await setup.start();
      expect(sentConfig().rulesetVersionKey).toBe("AROUND_THE_CLOCK_V2");
      expect(sentConfig().config).toMatchObject({
        overrides: { duration_type: "UNTIMED", duration_value: null },
      });
    });

    it("resets every toggle when a bot is seated", () => {
      const setup = createSetup({ presets: [STANDARD_PRESET] });
      setup.pathDirection = "HIGH_TO_LOW";
      setup.oddsFirst = true;
      setup.segmentRule = "OUTER_SINGLE";
      setup.difficulty = "PRO";
      setup.durationType = "MINUTES";
      setup.durationValue = 20;
      setup.addBot();
      expect(setup.bot).not.toBeNull();
      expect({
        pathDirection: setup.pathDirection,
        oddsFirst: setup.oddsFirst,
        segmentRule: setup.segmentRule,
        difficulty: setup.difficulty,
        durationType: setup.durationType,
        durationValue: setup.durationValue,
      }).toEqual({
        pathDirection: "LOW_TO_HIGH",
        oddsFirst: false,
        segmentRule: "ANY",
        difficulty: "EASY",
        durationType: "UNTIMED",
        durationValue: null,
      });
    });
  });
});

describe("aroundTheClockSetup Nine Lives", () => {
  let store: AroundTheClockSetupContext["$store"];

  beforeEach(() => {
    vi.clearAllMocks();
    store = {
      game: { sessionId: null, reset: vi.fn(), startSession: vi.fn() },
      settings: {
        captureModeKey: "RECREATIONAL",
        inputModeKey: "DETAILED_DARTS",
      },
    };
    vi.mocked(sessionsApi.createSession).mockResolvedValue({
      sessionId: "s",
      participants: [
        { ref: "p1", displayName: "Player", participantTypeKey: "PLAYER" },
      ],
    } as any);
  });

  afterEach(() => vi.unstubAllGlobals());

  const stubRedirect = () => vi.stubGlobal("location", { href: "" });

  function createSetup(
    overrides: Partial<AroundTheClockSetupContext> = {},
  ): AroundTheClockSetupContext {
    return {
      ...aroundTheClockSetup(),
      $store: store,
      presets: [STANDARD_PRESET],
      ...overrides,
    } as AroundTheClockSetupContext;
  }

  const sent = () => vi.mocked(sessionsApi.createSession).mock.calls[0]![0];

  it("lives on selects V3 with lives 3 and Easy untimed overrides", async () => {
    stubRedirect();
    const setup = createSetup();
    setup.lives = true;
    await setup.start();
    expect(sent().rulesetVersionKey).toBe("AROUND_THE_CLOCK_V3");
    expect(sent().config).toMatchObject({
      overrides: {
        ...V2_WIRE_DEFAULTS,
        difficulty: "EASY",
        duration_type: "UNTIMED",
        duration_value: null,
        lives: 3,
      },
    });
  });

  it("lives off selects V2 and sends no lives key", async () => {
    stubRedirect();
    const setup = createSetup();
    await setup.start();
    expect(sent().rulesetVersionKey).toBe("AROUND_THE_CLOCK_V2");
    expect(sent().config).toMatchObject({ overrides: V2_WIRE_DEFAULTS });
  });

  it("lives on ignores a typed duration and difficulty", async () => {
    stubRedirect();
    const setup = createSetup();
    setup.lives = true;
    setup.difficulty = "PRO";
    setup.durationType = "MINUTES";
    setup.durationValue = 20;
    await setup.start();
    expect(sent().config).toMatchObject({
      overrides: {
        difficulty: "EASY",
        duration_type: "UNTIMED",
        duration_value: null,
        lives: 3,
      },
    });
  });

  it("keeps Nine Lives on and untimed when a guest is added", () => {
    const setup = createSetup();
    setup.lives = true;
    setup.newGuestName = "Friend";
    setup.addGuest();
    expect(setup.guests).toHaveLength(1);
    expect(setup.lives).toBe(true);
    expect(setup.durationType).toBe("UNTIMED");
  });

  it("starts AROUND_THE_CLOCK_V3 with a guest seated", async () => {
    stubRedirect();
    const setup = createSetup();
    setup.lives = true;
    setup.newGuestName = "Friend";
    setup.addGuest();
    await setup.start();
    expect(sent().rulesetVersionKey).toBe("AROUND_THE_CLOCK_V3");
    expect(sent().participants).toHaveLength(2);
  });

  it("adding a bot turns lives off", () => {
    const setup = createSetup();
    setup.lives = true;
    setup.addBot();
    expect(setup.lives).toBe(false);
  });

  it.each([
    ["?lives=3", true],
    ["?lives=2", false],
    ["", false],
  ])("init reads %s", async (query, expected) => {
    history.replaceState(null, "", `/games/around-the-clock/setup${query}`);
    vi.mocked(presetsApi.fetchConfigurationPresets).mockResolvedValue([
      STANDARD_PRESET,
    ]);
    vi.mocked(sessionsApi.fetchActiveSessions).mockResolvedValue([]);
    const setup = createSetup();
    await setup.init();
    expect(setup.lives).toBe(expected);
  });
});
