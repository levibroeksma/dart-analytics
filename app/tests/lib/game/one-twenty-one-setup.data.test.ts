import { describe, it, expect, vi, beforeEach } from "vitest";
import { oneTwentyOneSetup } from "@lib/game/one-twenty-one-setup.data";
import type { OneTwentyOneSetupContext } from "@lib/types";
import * as sessionsApi from "@client/api/sessions";
import * as presetsApi from "@client/api/configuration-templates";

vi.mock("@client/api/sessions");
vi.mock("@client/api/configuration-templates");

const TARGET_PRESET = {
  configurationTemplateId: "tmpl-target",
  name: "121 — 170",
  configuration: { duration_type: "TARGET" },
} as any;

const ROUNDS_PRESET = {
  configurationTemplateId: "tmpl-rounds",
  name: "121 — 10 Rounds",
  configuration: { duration_type: "ROUNDS", duration_value: 10 },
} as any;

const MINUTES_PRESET = {
  configurationTemplateId: "tmpl-minutes",
  name: "121 — 5 Minutes",
  configuration: { duration_type: "MINUTES", duration_value: 5 },
} as any;

describe("oneTwentyOneSetup", () => {
  let store: OneTwentyOneSetupContext["$store"];

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
    overrides: Partial<OneTwentyOneSetupContext> = {},
  ): OneTwentyOneSetupContext {
    watchers = [];
    return {
      ...oneTwentyOneSetup(),
      $store: store,
      $watch: (key: string, callback: (value: never) => void) => {
        watchers.push({ key, callback });
      },
      ...overrides,
    } as OneTwentyOneSetupContext;
  }

  describe("reconciliation on init", () => {
    it('shows modal on "match"', async () => {
      const setup = createSetup();

      vi.mocked(presetsApi.fetchConfigurationPresets).mockResolvedValue([]);
      vi.mocked(sessionsApi.fetchActiveSessions).mockResolvedValue([
        { sessionId: "match-id", gameTypeKey: "ONE_TWENTY_ONE" } as any,
      ]);
      store.game.sessionId = "match-id";

      await setup.init();

      expect(setup.showActiveSessionModal).toBe(true);
      expect(setup.activeSession).toEqual({
        sessionId: "match-id",
        gameTypeKey: "ONE_TWENTY_ONE",
      });
    });

    it('shows preset picker on "no_active" (mismatch auto-abandoned)', async () => {
      const setup = createSetup();

      vi.mocked(presetsApi.fetchConfigurationPresets).mockResolvedValue([]);
      vi.mocked(sessionsApi.fetchActiveSessions).mockResolvedValue([
        { sessionId: "server-id", gameTypeKey: "ONE_TWENTY_ONE" } as any,
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
        { sessionId: "server-id", gameTypeKey: "ONE_TWENTY_ONE" } as any,
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
          gameTypeKey: "ONE_TWENTY_ONE",
        } as any,
      });

      const locationSpy = { href: "/games/121/setup" };
      vi.stubGlobal("location", locationSpy);

      setup.continueSession();

      expect(locationSpy.href).toBe("/games/121/play");
    });

    it("abandons session when user clicks Abandon", async () => {
      const setup = createSetup({
        activeSession: {
          sessionId: "match-id",
          gameTypeKey: "ONE_TWENTY_ONE",
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
    it("defaults to TARGET with no duration_value", async () => {
      const setup = createSetup();
      vi.mocked(presetsApi.fetchConfigurationPresets).mockResolvedValue([
        TARGET_PRESET,
        ROUNDS_PRESET,
        MINUTES_PRESET,
      ]);
      vi.mocked(sessionsApi.fetchActiveSessions).mockResolvedValue([]);
      await setup.init();
      expect(setup.durationType).toBe("TARGET");
      expect(setup.durationValue).toBeNull();
      expect(setup.clampNotice).toBe("");
    });
  });

  describe("selectMode", () => {
    it("clears durationValue when switching to TARGET", () => {
      const setup = createSetup({
        presets: [TARGET_PRESET, ROUNDS_PRESET, MINUTES_PRESET],
        durationType: "ROUNDS",
        durationValue: 20,
      });
      setup.selectMode("TARGET");
      expect(setup.durationType).toBe("TARGET");
      expect(setup.durationValue).toBeNull();
      expect(setup.clampNotice).toBe("");
    });

    it("resets durationValue to the mode preset default when switching to ROUNDS", () => {
      const setup = createSetup({
        presets: [TARGET_PRESET, ROUNDS_PRESET, MINUTES_PRESET],
        durationType: "TARGET",
        durationValue: null,
      });
      setup.selectMode("ROUNDS");
      expect(setup.durationType).toBe("ROUNDS");
      expect(setup.durationValue).toBe(10);
      expect(setup.clampNotice).toBe("");
    });

    it("init registers a durationType watcher that runs selectMode", async () => {
      const setup = createSetup();

      vi.mocked(presetsApi.fetchConfigurationPresets).mockResolvedValue([
        TARGET_PRESET,
        ROUNDS_PRESET,
        MINUTES_PRESET,
      ]);
      vi.mocked(sessionsApi.fetchActiveSessions).mockResolvedValue([]);

      await setup.init();

      const watcher = watchers.find((w) => w.key === "durationType");
      expect(watcher).toBeDefined();

      watcher!.callback("MINUTES" as never);

      expect(setup.durationType).toBe("MINUTES");
      expect(setup.durationValue).toBe(5);
    });
  });

  describe("forceTargetIfGuested", () => {
    it("locks ROUNDS back to TARGET once a guest is added", () => {
      const ctx = oneTwentyOneSetup() as unknown as {
        durationType: string;
        guests: { displayName: string }[];
        newGuestName: string;
        addGuest: () => void;
      };
      ctx.durationType = "ROUNDS";
      ctx.newGuestName = "Guest 1";
      ctx.addGuest();
      expect(ctx.durationType).toBe("TARGET");
    });
  });

  describe("session creation", () => {
    it("creates a TARGET session with no duration_value override", async () => {
      const setup = createSetup({
        presets: [TARGET_PRESET, ROUNDS_PRESET, MINUTES_PRESET],
        durationType: "TARGET",
        durationValue: null,
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
          gameTypeKey: "ONE_TWENTY_ONE",
          rulesetVersionKey: "121_V2",
          config: {
            source: "template",
            templateRef: "tmpl-target",
            overrides: { duration_type: "TARGET" },
          },
        }),
      );
      expect(store.game.startSession).toHaveBeenCalledWith(
        expect.objectContaining({
          configSnapshot: expect.objectContaining({ durationType: "TARGET" }),
        }),
      );
      expect(location.href).toBe("/games/121/play");
    });

    it("creates a ROUNDS session with a clamped duration_value override", async () => {
      const setup = createSetup({
        presets: [TARGET_PRESET, ROUNDS_PRESET, MINUTES_PRESET],
        durationType: "ROUNDS",
        durationValue: 999,
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

      expect(setup.durationValue).toBe(50);
      expect(setup.clampNotice).toBe("Allowed range: 1–50 rounds");
      expect(sessionsApi.createSession).toHaveBeenCalledWith(
        expect.objectContaining({
          config: {
            source: "template",
            templateRef: "tmpl-rounds",
            overrides: { duration_type: "ROUNDS", duration_value: 50 },
          },
        }),
      );
    });

    it("clamps a blank field to the mode minimum", async () => {
      const setup = createSetup({
        presets: [TARGET_PRESET, ROUNDS_PRESET, MINUTES_PRESET],
        durationType: "MINUTES",
        durationValue: null,
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
            overrides: { duration_type: "MINUTES", duration_value: 3 },
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
        presets: [TARGET_PRESET, ROUNDS_PRESET, MINUTES_PRESET],
        durationType: "TARGET",
        durationValue: null,
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

    it("errors when no preset matches the mode", async () => {
      const setup = createSetup({
        presets: [TARGET_PRESET],
        durationType: "MINUTES",
        durationValue: 5,
      });
      await setup.start();
      expect(sessionsApi.createSession).not.toHaveBeenCalled();
      expect(setup.error).toBe("Could not find a preset for this mode.");
    });

    it("rejects a preset carrying a key the schema does not model, before creating a session", async () => {
      const setup = createSetup({
        presets: [
          {
            configurationTemplateId: "template-1",
            name: "Broken",
            configuration: { duration_type: "ROUNDS", extra_field: 123 },
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
        presets: [TARGET_PRESET, ROUNDS_PRESET, MINUTES_PRESET],
        durationType: "TARGET",
        durationValue: null,
        loading: true,
      });

      await setup.start();

      expect(sessionsApi.createSession).not.toHaveBeenCalled();
      expect(store.game.startSession).not.toHaveBeenCalled();
    });

    it("re-reconciles into the active-session modal when create reports SESSION_ALREADY_ACTIVE", async () => {
      const setup = createSetup({
        presets: [TARGET_PRESET, ROUNDS_PRESET, MINUTES_PRESET],
        durationType: "TARGET",
        durationValue: null,
      });

      vi.mocked(sessionsApi.createSession).mockRejectedValue(
        Object.assign(new Error("already active"), {
          code: "SESSION_ALREADY_ACTIVE",
        }),
      );
      vi.mocked(sessionsApi.fetchActiveSessions).mockResolvedValue([
        { sessionId: "active-1", gameTypeKey: "ONE_TWENTY_ONE" } as any,
      ]);
      store.game.sessionId = "active-1";

      await setup.start();

      expect(setup.showActiveSessionModal).toBe(true);
      expect(setup.activeSession).toMatchObject({ sessionId: "active-1" });
      expect(setup.loading).toBe(false);
    });

    it("threads a PLAYER seat A and the guest as seat B once a guest is added", async () => {
      const setup = createSetup({
        presets: [
          {
            configurationTemplateId: "tmpl-v1-standard",
            name: "121 — Standard",
            configuration: {},
          } as any,
          TARGET_PRESET,
          ROUNDS_PRESET,
          MINUTES_PRESET,
        ],
        durationType: "TARGET",
        durationValue: null,
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

  describe("guested 1v1 resolves 121_V1", () => {
    const V1_PRESET = {
      configurationTemplateId: "tmpl-v1-standard",
      name: "121 — Standard",
      configuration: {},
    } as any;

    it("resolves the 121_V1 ruleset key and its duration-type-less preset once a guest is added, with no duration overrides", async () => {
      const setup = createSetup({
        presets: [V1_PRESET, TARGET_PRESET, ROUNDS_PRESET, MINUTES_PRESET],
        durationType: "ROUNDS",
        durationValue: 20,
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
          rulesetVersionKey: "121_V1",
          config: {
            source: "template",
            templateRef: "tmpl-v1-standard",
          },
        }),
      );
      expect(store.game.startSession).toHaveBeenCalledWith(
        expect.objectContaining({
          configSnapshot: expect.objectContaining({}),
        }),
      );
      expect(location.href).toBe("/games/121/play");
    });
  });
});

describe("oneTwentyOneSetup — guests", () => {
  function makeSetup() {
    return {
      ...oneTwentyOneSetup(),
      $store: {
        game: { sessionId: null, reset: vi.fn(), startSession: vi.fn() },
        settings: {
          captureModeKey: "RECREATIONAL",
          inputModeKey: "QUICK_SCORE",
        },
      },
      $watch: () => {},
    } as unknown as OneTwentyOneSetupContext;
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
