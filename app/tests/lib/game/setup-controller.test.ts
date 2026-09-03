import { describe, it, expect, vi, beforeEach } from "vitest";
import { createPresetSetupController } from "@lib/game/setup-controller";
import type { PresetSetupContext } from "@lib/types";
import * as sessionsApi from "@client/api/sessions";
import * as presetsApi from "@client/api/configuration-templates";

vi.mock("@client/api/sessions");
vi.mock("@client/api/configuration-templates");

/**
 * Shanghai's config schema is a genuinely empty `.strict()` object, so an
 * empty configuration is the only valid one — `toSnapshot` parses for real
 * here, it is not mocked.
 */
const PRESET = {
  configurationTemplateId: "tmpl-1",
  gameTypeKey: "SHANGHAI",
  name: "Shanghai — Standard",
  description: null,
  configuration: {},
  isSystemTemplate: true,
} as any;

/** A complete, schema-valid Singles Training config, for the overrides seam. */
const SINGLES_PRESET = {
  configurationTemplateId: "tmpl-1",
  gameTypeKey: "SINGLES_TRAINING",
  name: "Singles Training — Standard",
  description: null,
  configuration: {
    order_mode: "LOW_TO_HIGH",
    target_order: [...Array.from({ length: 20 }, (_, i) => i + 1), 25],
    difficulty: "EASY",
  },
  isSystemTemplate: true,
} as any;

const SESSION = {
  sessionId: "sess-1",
  participants: [{ ref: "p1" }],
} as any;

type OrderCtx = PresetSetupContext & { orderMode: string };

describe("createPresetSetupController", () => {
  let store: PresetSetupContext["$store"];

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
    Object.defineProperty(globalThis, "location", {
      value: { href: "" },
      writable: true,
      configurable: true,
    });
  });

  function plain(): PresetSetupContext {
    return {
      ...createPresetSetupController<PresetSetupContext>({
        gameTypeKey: "SHANGHAI",
        rulesetVersionKey: "SHANGHAI_V1",
        playHref: "/games/shanghai/play",
        label: "Shanghai",
      }),
      $store: store,
    } as PresetSetupContext;
  }

  function withOverrides(): OrderCtx {
    return {
      ...createPresetSetupController<OrderCtx>({
        gameTypeKey: "SINGLES_TRAINING",
        rulesetVersionKey: "SINGLES_V1",
        playHref: "/games/singles-training/play",
        label: "Singles Training",
        configOverrides: (ctx) => ({ order_mode: ctx.orderMode }),
      }),
      orderMode: "HIGH_TO_LOW",
      $store: store,
    } as OrderCtx;
  }

  it("loads presets for its own game type", async () => {
    const setup = plain();
    vi.mocked(presetsApi.fetchConfigurationPresets).mockResolvedValue([PRESET]);
    vi.mocked(sessionsApi.fetchActiveSessions).mockResolvedValue([]);

    await setup.init();

    expect(presetsApi.fetchConfigurationPresets).toHaveBeenCalledWith(
      "SHANGHAI",
    );
    expect(setup.presets).toEqual([PRESET]);
    expect(setup.loadingReconciliation).toBe(false);
  });

  it("names the game in the missing-preset error, using label verbatim", async () => {
    const setup = plain();
    setup.presets = [];

    await setup.start();

    expect(setup.error).toBe("Could not find a preset for Shanghai.");
    expect(sessionsApi.createSession).not.toHaveBeenCalled();
  });

  it("navigates to its own play route on a successful start", async () => {
    const setup = plain();
    setup.presets = [PRESET];
    vi.mocked(sessionsApi.createSession).mockResolvedValue(SESSION);

    await setup.start();

    expect(globalThis.location.href).toBe("/games/shanghai/play");
    expect(store.game.startSession).toHaveBeenCalledTimes(1);
  });

  it("omits the overrides key entirely when no configOverrides hook is given", async () => {
    const setup = plain();
    setup.presets = [PRESET];
    vi.mocked(sessionsApi.createSession).mockResolvedValue(SESSION);

    await setup.start();

    const body = vi.mocked(sessionsApi.createSession).mock.calls[0][0];
    expect(body.config).toEqual({
      source: "template",
      templateRef: "tmpl-1",
    });
    expect("overrides" in (body.config as object)).toBe(false);
  });

  it("sends the hook's fields as createSession overrides when one is given", async () => {
    const setup = withOverrides();
    setup.presets = [SINGLES_PRESET];
    vi.mocked(sessionsApi.createSession).mockResolvedValue(SESSION);

    await setup.start();

    const body = vi.mocked(sessionsApi.createSession).mock.calls[0][0];
    expect(body.config).toEqual({
      source: "template",
      templateRef: "tmpl-1",
      overrides: { order_mode: "HIGH_TO_LOW" },
    });
  });

  it("retries reconciliation instead of erroring on SESSION_ALREADY_ACTIVE", async () => {
    const setup = plain();
    setup.presets = [PRESET];
    vi.mocked(sessionsApi.createSession).mockRejectedValue(
      Object.assign(new Error("active"), { code: "SESSION_ALREADY_ACTIVE" }),
    );
    vi.mocked(sessionsApi.fetchActiveSessions).mockResolvedValue([]);

    await setup.start();

    expect(sessionsApi.fetchActiveSessions).toHaveBeenCalled();
    expect(setup.error).toBe("");
  });

  it("clears the modal and abandons an active session", async () => {
    const setup = plain();
    setup.activeSession = { sessionId: "sess-old" } as any;
    setup.showActiveSessionModal = true;
    vi.mocked(sessionsApi.completeSession).mockResolvedValue(undefined as any);

    await setup.abandonSession();

    expect(sessionsApi.completeSession).toHaveBeenCalledWith(
      "sess-old",
      "ABANDONED",
    );
    expect(store.game.reset).toHaveBeenCalled();
    expect(setup.showActiveSessionModal).toBe(false);
    expect(setup.activeSession).toBeNull();
  });

  describe("guest wiring", () => {
    /** Bob's 27's config schema defaults every field, so `{}` is valid. */
    const BOBS27_PRESET = {
      configurationTemplateId: "tmpl-1",
      gameTypeKey: "BOBS27",
      name: "Bob's 27 — Standard",
      description: null,
      configuration: {},
      isSystemTemplate: true,
    } as any;

    function bobs27(): PresetSetupContext {
      return {
        ...createPresetSetupController<PresetSetupContext>({
          gameTypeKey: "BOBS27",
          rulesetVersionKey: "BOBS27_V1",
          playHref: "/games/bobs27/play",
          label: "Bob's 27",
        }),
        $store: store,
      } as PresetSetupContext;
    }

    it("addGuest caps at one guest and start() sends a 2-seat participants array", async () => {
      const setup = bobs27();
      setup.presets = [BOBS27_PRESET];
      vi.mocked(sessionsApi.createSession).mockResolvedValue(SESSION);

      setup.newGuestName = "Guest 1";
      setup.addGuest();
      setup.newGuestName = "Guest 2";
      setup.addGuest();
      expect(setup.guests).toHaveLength(1);
      expect(setup.guests[0].displayName).toBe("Guest 1");

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

    it("start() omits participants entirely when no guest was added", async () => {
      const setup = bobs27();
      setup.presets = [BOBS27_PRESET];
      vi.mocked(sessionsApi.createSession).mockResolvedValue(SESSION);

      await setup.start();

      const body = vi.mocked(sessionsApi.createSession).mock.calls[0][0];
      expect(body.participants).toBeUndefined();
    });

    it("never sends a displayName for the owning PLAYER seat", async () => {
      const setup = bobs27();
      setup.presets = [BOBS27_PRESET];
      vi.mocked(sessionsApi.createSession).mockResolvedValue(SESSION);

      setup.newGuestName = "Guest 1";
      setup.addGuest();
      await setup.start();

      const body = vi.mocked(sessionsApi.createSession).mock.calls[0][0];
      expect(body.participants?.[0]).toEqual({
        participantTypeKey: "PLAYER",
        sideKey: "A",
      });
    });

    it("removeGuest drops the guest by index", () => {
      const setup = bobs27();
      setup.newGuestName = "Guest 1";
      setup.addGuest();

      setup.removeGuest(0);

      expect(setup.guests).toHaveLength(0);
    });
  });

  describe("bot wiring", () => {
    const BOBS27_PRESET = {
      configurationTemplateId: "tmpl-1",
      gameTypeKey: "BOBS27",
      name: "Bob's 27 — Standard",
      description: null,
      configuration: {},
      isSystemTemplate: true,
    } as any;

    function bobs27(): PresetSetupContext {
      return {
        ...createPresetSetupController<PresetSetupContext>({
          gameTypeKey: "BOBS27",
          rulesetVersionKey: "BOBS27_V1",
          playHref: "/games/bobs27/play",
          label: "Bob's 27",
        }),
        $store: store,
      } as PresetSetupContext;
    }

    it("addBot seats a level-8 DartBot and start() sends a 2-seat DARTBOT participants array", async () => {
      const setup = bobs27();
      setup.presets = [BOBS27_PRESET];
      vi.mocked(sessionsApi.createSession).mockResolvedValue(SESSION);

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

    it("addBot refuses when a guest is already seated", () => {
      const setup = bobs27();
      setup.newGuestName = "Guest 1";
      setup.addGuest();

      setup.addBot();

      expect(setup.bot).toBeNull();
    });

    it("addGuest refuses when a bot is already seated", () => {
      const setup = bobs27();
      setup.addBot();

      setup.newGuestName = "Guest 1";
      setup.addGuest();

      expect(setup.guests).toEqual([]);
    });

    it("removeBot clears the seated bot", () => {
      const setup = bobs27();
      setup.addBot();

      setup.removeBot();

      expect(setup.bot).toBeNull();
    });

    it("initializes the level picker to DEFAULT_BOT_LEVEL and no picker shown", () => {
      const setup = bobs27();

      expect(setup.pendingBotLevel).toBe(8);
      expect(setup.showBotLevelPicker).toBe(false);
    });
  });

  describe("dynamic rulesetVersionKey", () => {
    function dynamicRuleset(): OrderCtx {
      return {
        ...createPresetSetupController<OrderCtx>({
          gameTypeKey: "SINGLES_TRAINING",
          rulesetVersionKey: (ctx) =>
            ctx.guests.length > 0 ? "SINGLES_V1" : "SINGLES_V2",
          playHref: "/games/singles-training/play",
          label: "Singles Training",
        }),
        orderMode: "LOW_TO_HIGH",
        $store: store,
      } as OrderCtx;
    }

    it("resolves the ruleset key from a function of the current context, evaluated fresh on every start() call", async () => {
      const setup = dynamicRuleset();
      setup.presets = [SINGLES_PRESET];
      vi.mocked(sessionsApi.createSession).mockResolvedValue(SESSION);

      await setup.start();
      expect(sessionsApi.createSession).toHaveBeenCalledWith(
        expect.objectContaining({ rulesetVersionKey: "SINGLES_V2" }),
      );

      setup.guests = [{ displayName: "Guest 1" }];
      await setup.start();
      expect(sessionsApi.createSession).toHaveBeenLastCalledWith(
        expect.objectContaining({ rulesetVersionKey: "SINGLES_V1" }),
      );
    });
  });
});
