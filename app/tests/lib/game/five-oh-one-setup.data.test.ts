import { describe, it, expect, vi, beforeEach } from "vitest";
import { fiveOhOneSetup } from "@lib/game/five-oh-one-setup.data";
import type { FiveOhOneSetupContext } from "@lib/types";
import * as sessionsApi from "@client/api/sessions";
import * as presetsApi from "@client/api/configuration-templates";

vi.mock("@client/api/sessions");
vi.mock("@client/api/configuration-templates");

const QUICK_PLAY_PRESET = {
  configurationTemplateId: "tmpl-quick",
  name: "501 — Quick Play",
  configuration: {
    starting_score: 501,
    legs_to_win: 1,
    check_in: "STRAIGHT_IN",
    check_out: "DOUBLE_OUT",
    max_darts_per_turn: 3,
    max_visit_score: 180,
  },
} as any;

const BEST_OF_5_PRESET = {
  configurationTemplateId: "tmpl-best-of-5",
  name: "501 — Best of 5 Legs",
  configuration: {
    starting_score: 501,
    legs_to_win: 3,
    check_in: "STRAIGHT_IN",
    check_out: "DOUBLE_OUT",
    max_darts_per_turn: 3,
    max_visit_score: 180,
  },
} as any;

describe("fiveOhOneSetup", () => {
  let store: FiveOhOneSetupContext["$store"];

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
    overrides: Partial<FiveOhOneSetupContext> = {},
  ): FiveOhOneSetupContext {
    return { ...fiveOhOneSetup(), $store: store, ...overrides };
  }

  it("defaults legsToWin and startingScoreOption, and loads the presets", async () => {
    const setup = createSetup();
    vi.mocked(presetsApi.fetchConfigurationPresets).mockResolvedValue([
      QUICK_PLAY_PRESET,
      BEST_OF_5_PRESET,
    ]);
    vi.mocked(sessionsApi.fetchActiveSessions).mockResolvedValue([]);

    await setup.init();

    expect(presetsApi.fetchConfigurationPresets).toHaveBeenCalledWith("501");
    expect(setup.legsToWin).toBe(1);
    expect(setup.legsClampNotice).toBe("");
    expect(setup.startingScoreOption).toBe("501");
    expect(setup.startingScoreValue).toBe(101);
    expect(setup.presets).toHaveLength(2);
  });

  it("falls back to 1 leg when no preset declares legs_to_win", async () => {
    const setup = createSetup();
    vi.mocked(presetsApi.fetchConfigurationPresets).mockResolvedValue([
      { configurationTemplateId: "t", name: "odd", configuration: {} } as any,
    ]);
    vi.mocked(sessionsApi.fetchActiveSessions).mockResolvedValue([]);

    await setup.init();

    expect(setup.legsToWin).toBe(1);
  });

  it('shows the active-session modal on "match"', async () => {
    const setup = createSetup();
    vi.mocked(presetsApi.fetchConfigurationPresets).mockResolvedValue([]);
    vi.mocked(sessionsApi.fetchActiveSessions).mockResolvedValue([
      { sessionId: "match-id", gameTypeKey: "501" } as any,
    ]);
    store.game.sessionId = "match-id";

    await setup.init();

    expect(setup.showActiveSessionModal).toBe(true);
    expect(setup.activeSession).toEqual({
      sessionId: "match-id",
      gameTypeKey: "501",
    });
  });

  it('blocks with reconciliationFailed on "abandon_failed"', async () => {
    const setup = createSetup();
    vi.mocked(presetsApi.fetchConfigurationPresets).mockResolvedValue([]);
    vi.mocked(sessionsApi.fetchActiveSessions).mockResolvedValue([
      { sessionId: "server-id", gameTypeKey: "501" } as any,
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

  it("continueSession navigates to the play page", () => {
    const setup = createSetup({
      activeSession: { sessionId: "match-id", gameTypeKey: "501" } as any,
    });
    const locationSpy = { href: "/games/501/setup" };
    vi.stubGlobal("location", locationSpy);

    setup.continueSession();

    expect(locationSpy.href).toBe("/games/501/play");
  });

  it("basePreset picks the single-leg template as the override base", () => {
    const setup = createSetup({
      presets: [BEST_OF_5_PRESET, QUICK_PLAY_PRESET],
    });
    expect(setup.basePreset()).toBe(QUICK_PLAY_PRESET);
  });

  it("falls back to the first preset when none declares legs_to_win = 1", () => {
    const setup = createSetup({ presets: [BEST_OF_5_PRESET] });
    expect(setup.basePreset()).toBe(BEST_OF_5_PRESET);
  });

  it("addGuest trims the name, pushes the guest, clears the field, and closes the modal", () => {
    const setup = createSetup({
      showAddGuestModal: true,
      newGuestName: "  Alex  ",
    });

    setup.addGuest();

    expect(setup.guests).toEqual([{ displayName: "Alex" }]);
    expect(setup.newGuestName).toBe("");
    expect(setup.showAddGuestModal).toBe(false);
  });

  it("addGuest ignores blank or whitespace-only input", () => {
    const setup = createSetup({
      showAddGuestModal: true,
      newGuestName: "   ",
    });

    setup.addGuest();

    expect(setup.guests).toEqual([]);
    expect(setup.showAddGuestModal).toBe(true);
  });

  it("removeGuest splices the correct entry", () => {
    const setup = createSetup({
      guests: [
        { displayName: "Alex" },
        { displayName: "Sam" },
        { displayName: "Jo" },
      ],
    });

    setup.removeGuest(1);

    expect(setup.guests).toEqual([
      { displayName: "Alex" },
      { displayName: "Jo" },
    ]);
  });

  it("creates a session overriding legs_to_win and starting_score with the chosen values and redirects", async () => {
    const setup = createSetup({
      presets: [QUICK_PLAY_PRESET, BEST_OF_5_PRESET],
      legsToWin: 5,
      startingScoreOption: "301",
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
      gameTypeKey: "501",
      rulesetVersionKey: "501_V1",
      captureModeKey: "RECREATIONAL",
      inputModeKey: "QUICK_SCORE",
      config: {
        source: "template",
        templateRef: "tmpl-quick",
        overrides: { legs_to_win: 5, starting_score: 301 },
      },
      participants: undefined,
    });
    expect(store.game.startSession).toHaveBeenCalledWith(
      expect.objectContaining({
        gameTypeKey: "501",
        rulesetVersionKey: "501_V1",
        templateRef: "tmpl-quick",
        configSnapshot: expect.objectContaining({
          startingScore: 301,
          legsToWin: 5,
          checkIn: "STRAIGHT_IN",
          checkOut: "DOUBLE_OUT",
        }),
      }),
    );
    expect(locationSpy.href).toBe("/games/501/play");
  });

  it("sends the PLAYER seat plus every guest as participants, sides B/C/D in push order", async () => {
    const setup = createSetup({
      presets: [QUICK_PLAY_PRESET, BEST_OF_5_PRESET],
      legsToWin: 5,
      startingScoreOption: "301",
      guests: [{ displayName: "Alex" }, { displayName: "Sam" }],
    });
    vi.mocked(sessionsApi.createSession).mockResolvedValue({
      sessionId: "new-session-id",
      participants: [
        { ref: "p1", displayName: "Player", participantTypeKey: "PLAYER" },
        { ref: "p2", displayName: "Alex", participantTypeKey: "GUEST" },
        { ref: "p3", displayName: "Sam", participantTypeKey: "GUEST" },
      ],
    } as any);
    vi.stubGlobal("location", { href: "" });

    await setup.start();

    expect(sessionsApi.createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        participants: [
          { participantTypeKey: "PLAYER", sideKey: "A" },
          { participantTypeKey: "GUEST", displayName: "Alex", sideKey: "B" },
          { participantTypeKey: "GUEST", displayName: "Sam", sideKey: "C" },
        ],
      }),
    );
  });

  it("keeps guests across a rejected start() so the player does not retype them", async () => {
    const setup = createSetup({
      presets: [],
      legsToWin: 3,
      guests: [{ displayName: "Alex" }],
    });

    await setup.start();

    expect(setup.error).toBe("Could not find a preset for 501.");
    expect(setup.guests).toEqual([{ displayName: "Alex" }]);
  });

  it("uses the custom starting score value when the option is CUSTOM", async () => {
    const setup = createSetup({
      presets: [QUICK_PLAY_PRESET, BEST_OF_5_PRESET],
      legsToWin: 1,
      startingScoreOption: "CUSTOM",
      startingScoreValue: 350,
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
          overrides: { legs_to_win: 1, starting_score: 350 },
        }),
      }),
    );
    expect(setup.scoreClampNotice).toBe("");
  });

  it("clamps an out-of-range custom starting score, sets the notice, and still creates", async () => {
    const setup = createSetup({
      presets: [QUICK_PLAY_PRESET, BEST_OF_5_PRESET],
      legsToWin: 1,
      startingScoreOption: "CUSTOM",
      startingScoreValue: 5000,
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

    expect(setup.startingScoreValue).toBe(999);
    expect(setup.scoreClampNotice).toBe("Allowed range: 2–999");
    expect(sessionsApi.createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        config: expect.objectContaining({
          overrides: { legs_to_win: 1, starting_score: 999 },
        }),
      }),
    );
  });

  it("clamps a blank custom starting score to the default of 101", async () => {
    const setup = createSetup({
      presets: [QUICK_PLAY_PRESET, BEST_OF_5_PRESET],
      legsToWin: 1,
      startingScoreOption: "CUSTOM",
      startingScoreValue: null,
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

    expect(setup.startingScoreValue).toBe(101);
    expect(sessionsApi.createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        config: expect.objectContaining({
          overrides: { legs_to_win: 1, starting_score: 101 },
        }),
      }),
    );
  });

  it("sends the player's chosen supported pair from settings instead of a hardcoded one", async () => {
    store.settings = {
      captureModeKey: "ANALYTICS",
      inputModeKey: "VISUAL_BOARD",
    };
    const setup = createSetup({
      presets: [QUICK_PLAY_PRESET, BEST_OF_5_PRESET],
      legsToWin: 5,
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

  it("falls back to quick score when settings holds a pair 501 does not declare", async () => {
    store.settings = {
      captureModeKey: "RECREATIONAL",
      inputModeKey: "DETAILED_DARTS",
    };
    const setup = createSetup({
      presets: [QUICK_PLAY_PRESET, BEST_OF_5_PRESET],
      legsToWin: 5,
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
      presets: [QUICK_PLAY_PRESET, BEST_OF_5_PRESET],
      legsToWin: 5,
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

  it("clamps an out-of-range legs value, sets the notice, and still creates", async () => {
    const setup = createSetup({
      presets: [QUICK_PLAY_PRESET, BEST_OF_5_PRESET],
      legsToWin: 99,
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

    expect(setup.legsToWin).toBe(20);
    expect(setup.legsClampNotice).toBe("Allowed range: 1–20 legs");
    expect(sessionsApi.createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        config: expect.objectContaining({
          overrides: { legs_to_win: 20, starting_score: 501 },
        }),
      }),
    );
  });

  it("clamps a blank field to a single leg", async () => {
    const setup = createSetup({
      presets: [QUICK_PLAY_PRESET, BEST_OF_5_PRESET],
      legsToWin: null,
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

    expect(setup.legsToWin).toBe(1);
    expect(sessionsApi.createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        config: expect.objectContaining({
          overrides: { legs_to_win: 1, starting_score: 501 },
        }),
      }),
    );
  });

  it("errors when no preset is available at all", async () => {
    const setup = createSetup({ presets: [], legsToWin: 3 });
    await setup.start();
    expect(sessionsApi.createSession).not.toHaveBeenCalled();
    expect(setup.error).toBe("Could not find a preset for 501.");
  });

  it("rejects a preset whose configuration fails schema validation, before creating a session", async () => {
    const setup = createSetup({
      presets: [
        {
          configurationTemplateId: "template-1",
          name: "Broken",
          configuration: { starting_score: 501 },
        } as any,
      ],
      legsToWin: 3,
    });

    await setup.start();

    expect(sessionsApi.createSession).not.toHaveBeenCalled();
    expect(store.game.startSession).not.toHaveBeenCalled();
    expect(setup.error).toMatch(/Could not start the session/);
    expect(setup.loading).toBe(false);
  });

  it("re-reconciles into the active-session modal when create reports SESSION_ALREADY_ACTIVE", async () => {
    const setup = createSetup({
      presets: [QUICK_PLAY_PRESET, BEST_OF_5_PRESET],
      legsToWin: 1,
    });
    vi.mocked(sessionsApi.createSession).mockRejectedValue(
      Object.assign(new Error("already active"), {
        code: "SESSION_ALREADY_ACTIVE",
      }),
    );
    vi.mocked(sessionsApi.fetchActiveSessions).mockResolvedValue([
      { sessionId: "active-1", gameTypeKey: "501" } as any,
    ]);
    store.game.sessionId = "active-1";

    await setup.start();

    expect(setup.showActiveSessionModal).toBe(true);
    expect(setup.activeSession).toMatchObject({ sessionId: "active-1" });
    expect(setup.loading).toBe(false);
  });
});
