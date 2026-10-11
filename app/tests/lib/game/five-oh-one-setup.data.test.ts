import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  buildFiveOhOneV2Wire,
  fiveOhOneSetup,
  isV2Preset,
} from "@lib/game/five-oh-one-setup.data";
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

const V2_PRESET = {
  configurationTemplateId: "tmpl-v2",
  name: "501 — Match",
  configuration: {
    starting_score: 501,
    check_in: "STRAIGHT_IN",
    check_out: "DOUBLE_OUT",
    max_darts_per_turn: 3,
    max_visit_score: 180,
    legs: { mode: "FIRST_TO", count: 1 },
    sets: null,
    win_by_two: null,
  },
} as any;

const V2_BASE = {
  startingScore: 501,
  matchMode: "FIRST_TO",
  count: 3,
  matchUnit: "LEGS",
  legsPerSetMode: "BEST_OF",
  legsPerSet: 5,
  winByTwo: false,
  marginScope: "EVERY_SET",
  cap: 5 as number | null,
} as const;

describe("isV2Preset", () => {
  it("picks the preset whose legs is an object", () => {
    expect(
      isV2Preset({
        configuration: { legs: { mode: "FIRST_TO", count: 1 } },
      } as never),
    ).toBe(true);
    expect(isV2Preset({ configuration: { legs_to_win: 1 } } as never)).toBe(
      false,
    );
    expect(isV2Preset(undefined)).toBe(false);
    expect(isV2Preset({ configuration: { legs: null } } as never)).toBe(false);
  });
});

describe("buildFiveOhOneV2Wire", () => {
  it("legs only", () => {
    expect(buildFiveOhOneV2Wire(V2_BASE)).toEqual({
      starting_score: 501,
      legs: { mode: "FIRST_TO", count: 3 },
      sets: null,
      win_by_two: null,
    });
  });
  it("sets: the count becomes the set race, legs per set the leg race", () => {
    expect(
      buildFiveOhOneV2Wire({
        ...V2_BASE,
        matchUnit: "SETS",
        winByTwo: true,
        marginScope: "DECIDING_SET",
        cap: 5,
      }),
    ).toEqual({
      starting_score: 501,
      legs: { mode: "BEST_OF", count: 5 },
      sets: { mode: "FIRST_TO", count: 3 },
      win_by_two: { cap: 5, scope: "DECIDING_SET" },
    });
  });
  it("legs only forces EVERY_SET scope", () => {
    expect(
      buildFiveOhOneV2Wire({
        ...V2_BASE,
        winByTwo: true,
        marginScope: "DECIDING_SET",
        cap: 5,
      }).win_by_two,
    ).toEqual({ cap: 5, scope: "EVERY_SET" });
  });
  it("best of with an even count rounds up to odd", () => {
    expect(
      buildFiveOhOneV2Wire({ ...V2_BASE, matchMode: "BEST_OF", count: 4 }).legs,
    ).toEqual({ mode: "BEST_OF", count: 5 });
  });
  it("an untouched cap defaults to the leg target plus 2", () => {
    expect(
      buildFiveOhOneV2Wire({
        ...V2_BASE,
        count: 7,
        winByTwo: true,
        cap: null,
      }).win_by_two,
    ).toEqual({ cap: 9, scope: "EVERY_SET" });
    expect(
      buildFiveOhOneV2Wire({
        ...V2_BASE,
        count: 1,
        winByTwo: true,
        cap: null,
      }).win_by_two,
    ).toEqual({ cap: 3, scope: "EVERY_SET" });
    expect(
      buildFiveOhOneV2Wire({
        ...V2_BASE,
        matchMode: "BEST_OF",
        count: 7,
        winByTwo: true,
        cap: null,
      }).win_by_two,
    ).toEqual({ cap: 6, scope: "EVERY_SET" });
  });
  it("cap below the leg target is raised to the target", () => {
    expect(
      buildFiveOhOneV2Wire({ ...V2_BASE, count: 3, winByTwo: true, cap: 1 })
        .win_by_two,
    ).toEqual({ cap: 3, scope: "EVERY_SET" });
  });
  it("best of 20 stays at the 19 ceiling, in legs and legs per set", () => {
    expect(
      buildFiveOhOneV2Wire({ ...V2_BASE, matchMode: "BEST_OF", count: 20 })
        .legs,
    ).toEqual({ mode: "BEST_OF", count: 19 });
    expect(
      buildFiveOhOneV2Wire({
        ...V2_BASE,
        matchUnit: "SETS",
        legsPerSetMode: "BEST_OF",
        legsPerSet: 20,
      }).legs,
    ).toEqual({ mode: "BEST_OF", count: 19 });
  });
  it("sets with an even legs-per-set best of rounds that up to odd", () => {
    expect(
      buildFiveOhOneV2Wire({
        ...V2_BASE,
        matchUnit: "SETS",
        legsPerSetMode: "BEST_OF",
        legsPerSet: 4,
      }).legs,
    ).toEqual({ mode: "BEST_OF", count: 5 });
  });
});

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

  it("initializes the level picker to DEFAULT_BOT_LEVEL and no picker shown", () => {
    const setup = createSetup();

    expect(setup.pendingBotLevel).toBe(8);
    expect(setup.showBotLevelPicker).toBe(false);
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

  it("basePreset picks the V2-shaped template, never a V1 one", () => {
    const setup = createSetup({
      presets: [QUICK_PLAY_PRESET, BEST_OF_5_PRESET, V2_PRESET],
    });
    expect(setup.basePreset()).toBe(V2_PRESET);
  });

  it("basePreset is undefined when only V1-shaped presets exist", () => {
    const setup = createSetup({
      presets: [QUICK_PLAY_PRESET, BEST_OF_5_PRESET],
    });
    expect(setup.basePreset()).toBeUndefined();
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

  it("never sends a displayName for the owning PLAYER seat", async () => {
    const setup = createSetup({
      presets: [V2_PRESET],
      guests: [{ displayName: "Alex" }],
    });

    await setup.start();

    const body = vi.mocked(sessionsApi.createSession).mock.calls[0][0];
    expect(body.participants?.[0]).toEqual({
      participantTypeKey: "PLAYER",
      sideKey: "A",
    });
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

  it("addGuest refuses a second guest once one already exists", () => {
    const setup = createSetup({
      showAddGuestModal: true,
      newGuestName: "Sam",
      guests: [{ displayName: "Alex" }],
    });

    setup.addGuest();

    expect(setup.guests).toEqual([{ displayName: "Alex" }]);
    expect(setup.newGuestName).toBe("Sam");
    expect(setup.showAddGuestModal).toBe(true);
  });

  it("creates a session overriding the V2 match format and starting_score with the chosen values and redirects", async () => {
    const setup = createSetup({
      presets: [QUICK_PLAY_PRESET, BEST_OF_5_PRESET, V2_PRESET],
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
      rulesetVersionKey: "501_V2",
      captureModeKey: "RECREATIONAL",
      inputModeKey: "QUICK_SCORE",
      config: {
        source: "template",
        templateRef: "tmpl-v2",
        overrides: buildFiveOhOneV2Wire({
          ...V2_BASE,
          startingScore: 301,
          count: 5,
        }),
      },
      participants: undefined,
    });
    expect(store.game.startSession).toHaveBeenCalledWith(
      expect.objectContaining({
        gameTypeKey: "501",
        rulesetVersionKey: "501_V2",
        templateRef: "tmpl-v2",
        configSnapshot: expect.objectContaining({
          startingScore: 301,
          legs: { mode: "FIRST_TO", count: 5 },
          checkIn: "STRAIGHT_IN",
          checkOut: "DOUBLE_OUT",
        }),
      }),
    );
    expect(locationSpy.href).toBe("/games/501/play");
  });

  it("sends the PLAYER seat plus every guest as participants, sides B/C/D in push order", async () => {
    const setup = createSetup({
      presets: [QUICK_PLAY_PRESET, BEST_OF_5_PRESET, V2_PRESET],
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
      presets: [QUICK_PLAY_PRESET, BEST_OF_5_PRESET, V2_PRESET],
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
          overrides: buildFiveOhOneV2Wire({
            ...V2_BASE,
            startingScore: 350,
            count: 1,
          }),
        }),
      }),
    );
    expect(setup.scoreClampNotice).toBe("");
  });

  it("clamps an out-of-range custom starting score, sets the notice, and still creates", async () => {
    const setup = createSetup({
      presets: [QUICK_PLAY_PRESET, BEST_OF_5_PRESET, V2_PRESET],
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
          overrides: buildFiveOhOneV2Wire({
            ...V2_BASE,
            startingScore: 999,
            count: 1,
          }),
        }),
      }),
    );
  });

  it("clamps a blank custom starting score to the default of 101", async () => {
    const setup = createSetup({
      presets: [QUICK_PLAY_PRESET, BEST_OF_5_PRESET, V2_PRESET],
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
          overrides: buildFiveOhOneV2Wire({
            ...V2_BASE,
            startingScore: 101,
            count: 1,
          }),
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
      presets: [QUICK_PLAY_PRESET, BEST_OF_5_PRESET, V2_PRESET],
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
      presets: [QUICK_PLAY_PRESET, BEST_OF_5_PRESET, V2_PRESET],
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
      presets: [QUICK_PLAY_PRESET, BEST_OF_5_PRESET, V2_PRESET],
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
      presets: [QUICK_PLAY_PRESET, BEST_OF_5_PRESET, V2_PRESET],
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
          overrides: buildFiveOhOneV2Wire({
            ...V2_BASE,
            startingScore: 501,
            count: 20,
          }),
        }),
      }),
    );
  });

  it("clamps a blank field to a single leg", async () => {
    const setup = createSetup({
      presets: [QUICK_PLAY_PRESET, BEST_OF_5_PRESET, V2_PRESET],
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
          overrides: buildFiveOhOneV2Wire({
            ...V2_BASE,
            startingScore: 501,
            count: 1,
          }),
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
          configuration: {
            starting_score: 501,
            legs: { mode: "FIRST_TO", count: 1 },
          },
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
      presets: [QUICK_PLAY_PRESET, BEST_OF_5_PRESET, V2_PRESET],
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

  it("sends the chosen match format as V2 overrides", async () => {
    const setup = createSetup({
      presets: [QUICK_PLAY_PRESET, V2_PRESET],
      matchMode: "BEST_OF",
      legsToWin: 3,
      matchUnit: "SETS",
      legsPerSetMode: "FIRST_TO",
      legsPerSet: 3,
      winByTwo: true,
      marginScope: "DECIDING_SET",
      cap: 5,
    });
    vi.mocked(sessionsApi.createSession).mockResolvedValue({
      sessionId: "s",
      participants: [],
    } as any);
    vi.stubGlobal("location", { href: "" });

    await setup.start();

    expect(sessionsApi.createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        rulesetVersionKey: "501_V2",
        config: {
          source: "template",
          templateRef: "tmpl-v2",
          overrides: {
            starting_score: 501,
            legs: { mode: "FIRST_TO", count: 3 },
            sets: { mode: "BEST_OF", count: 3 },
            win_by_two: { cap: 5, scope: "DECIDING_SET" },
          },
        },
      }),
    );
  });

  it("syncCap tracks the target while the cap is untouched", () => {
    const setup = createSetup({ winByTwo: true, legsToWin: 7 });
    setup.syncCap();
    expect(setup.cap).toBe(9);
    setup.legsToWin = 1;
    setup.syncCap();
    expect(setup.cap).toBe(3);
  });

  it("syncCap keeps an edited cap when the target changes", () => {
    const setup = createSetup({ winByTwo: true, legsToWin: 3 });
    setup.syncCap();
    setup.cap = 8;
    setup.legsToWin = 5;
    setup.syncCap();
    expect(setup.cap).toBe(8);
  });

  it("syncCap reads the legs-per-set target when sets are on", () => {
    const setup = createSetup({
      matchUnit: "SETS",
      legsToWin: 3,
      legsPerSetMode: "FIRST_TO",
      legsPerSet: 4,
    });
    setup.syncCap();
    expect(setup.cap).toBe(6);
    expect(setup.capMin()).toBe(4);
  });

  it("sends target plus 2 when the cap was never edited", async () => {
    const setup = createSetup({
      presets: [V2_PRESET],
      legsToWin: 7,
      winByTwo: true,
    });
    vi.mocked(sessionsApi.createSession).mockResolvedValue({
      sessionId: "s",
      participants: [],
    } as any);
    vi.stubGlobal("location", { href: "" });

    await setup.start();

    expect(sessionsApi.createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        config: expect.objectContaining({
          overrides: expect.objectContaining({
            win_by_two: { cap: 9, scope: "EVERY_SET" },
          }),
        }),
      }),
    );
  });

  it("clamps blank legs-per-set and cap steppers to the minimum", async () => {
    const setup = createSetup({
      presets: [V2_PRESET],
      matchUnit: "SETS",
      legsPerSet: "abc",
      winByTwo: true,
      cap: "abc",
    });
    vi.mocked(sessionsApi.createSession).mockResolvedValue({
      sessionId: "s",
      participants: [],
    } as any);
    vi.stubGlobal("location", { href: "" });

    await setup.start();

    expect(sessionsApi.createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        config: expect.objectContaining({
          overrides: expect.objectContaining({
            legs: { mode: "BEST_OF", count: 1 },
            win_by_two: { cap: 1, scope: "EVERY_SET" },
          }),
        }),
      }),
    );
  });

  describe("bot wiring", () => {
    it("addBot seats a level-8 DartBot and start() sends a 2-seat DARTBOT participants array", async () => {
      const setup = createSetup();
      setup.presets = [V2_PRESET];
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

      setup.addBot();
      expect(setup.bot).toEqual({ level: 8 });

      await setup.start();

      expect(sessionsApi.createSession).toHaveBeenCalledWith(
        expect.objectContaining({
          participants: [
            { participantTypeKey: "PLAYER", sideKey: "A" },
            { participantTypeKey: "DARTBOT", level: 8, sideKey: "B" },
          ],
        }),
      );
    });

    it("addBot refuses when a guest is already seated, and vice versa", () => {
      const setup = createSetup();

      setup.newGuestName = "Guest 1";
      setup.addGuest();
      setup.addBot();
      expect(setup.bot).toBeNull();

      setup.removeGuest(0);
      setup.addBot();
      setup.newGuestName = "Guest 2";
      setup.addGuest();
      expect(setup.guests).toEqual([]);
    });

    it("removeBot clears the seated bot", () => {
      const setup = createSetup();
      setup.addBot();

      setup.removeBot();

      expect(setup.bot).toBeNull();
    });
  });
});
