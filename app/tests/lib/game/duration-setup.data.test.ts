import { describe, it, expect, vi, beforeEach } from "vitest";
import { durationSetupData } from "@lib/game/duration-setup.data";
import { createSetupSession } from "@lib/game/setup-session";
import type { DurationSetupContext } from "@lib/types";
import * as sessionsApi from "@client/api/sessions";
import * as presetsApi from "@client/api/configuration-templates";

vi.mock("@client/api/sessions");
vi.mock("@client/api/configuration-templates");

type Mode = "ROUNDS" | "MINUTES";

const ROUND_PRESET = {
  configurationTemplateId: "tmpl-rounds",
  name: "10 Rounds",
  configuration: { duration_type: "ROUNDS", duration_value: 12 },
} as any;

const MINUTES_PRESET = {
  configurationTemplateId: "tmpl-minutes",
  name: "5 Minutes",
  configuration: { duration_type: "MINUTES", duration_value: 7 },
} as any;

const FALLBACK: Record<Mode, number> = { ROUNDS: 10, MINUTES: 5 };

describe("durationSetupData", () => {
  let watchers: Array<{ key: string; callback: (value: never) => void }>;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function createSetup(): DurationSetupContext<Mode> {
    watchers = [];
    return {
      ...createSetupSession({ gameTypeKey: "TEST_GAME", playHref: "/play" }),
      ...durationSetupData<Mode>({
        gameTypeKey: "TEST_GAME",
        fallback: FALLBACK,
      }),
      start: vi.fn(),
      $store: {
        game: { sessionId: null, reset: vi.fn(), startSession: vi.fn() },
        settings: {
          captureModeKey: "RECREATIONAL",
          inputModeKey: "QUICK_SCORE",
        },
      },
      $watch: (key: string, callback: (value: never) => void) => {
        watchers.push({ key, callback });
      },
    } as DurationSetupContext<Mode>;
  }

  it("starts on ROUNDS at the ROUNDS fallback, with no presets", () => {
    const setup = createSetup();
    expect(setup.durationType).toBe("ROUNDS");
    expect(setup.durationValue).toBe(10);
    expect(setup.presets).toEqual([]);
  });

  it("returns fresh preset state per call", () => {
    const a = createSetup();
    const b = createSetup();
    a.presets.push(ROUND_PRESET);
    expect(b.presets).toEqual([]);
  });

  describe("init", () => {
    it("loads presets for the game type and takes the ROUNDS preset's duration_value", async () => {
      vi.mocked(presetsApi.fetchConfigurationPresets).mockResolvedValue([
        ROUND_PRESET,
        MINUTES_PRESET,
      ]);
      vi.mocked(sessionsApi.fetchActiveSessions).mockResolvedValue([]);
      const setup = createSetup();
      setup.durationType = "MINUTES";

      await setup.init();

      expect(presetsApi.fetchConfigurationPresets).toHaveBeenCalledWith(
        "TEST_GAME",
      );
      expect(setup.presets).toEqual([ROUND_PRESET, MINUTES_PRESET]);
      expect(setup.durationType).toBe("ROUNDS");
      expect(setup.durationValue).toBe(12);
      expect(setup.loadingReconciliation).toBe(false);
      expect(setup.error).toBe("");
    });

    it("falls back when the ROUNDS preset carries no numeric duration_value", async () => {
      vi.mocked(presetsApi.fetchConfigurationPresets).mockResolvedValue([
        { configuration: { duration_type: "ROUNDS" } } as any,
      ]);
      vi.mocked(sessionsApi.fetchActiveSessions).mockResolvedValue([]);
      const setup = createSetup();
      setup.durationValue = 99;

      await setup.init();

      expect(setup.durationValue).toBe(10);
    });

    it("reconciles the active sessions it fetched", async () => {
      vi.mocked(presetsApi.fetchConfigurationPresets).mockResolvedValue([]);
      vi.mocked(sessionsApi.fetchActiveSessions).mockResolvedValue([
        { sessionId: "s-1", gameTypeKey: "TEST_GAME" } as any,
      ]);
      const setup = createSetup();

      await setup.init();

      expect(setup.showActiveSessionModal).toBe(true);
      expect(setup.activeSession).toEqual({
        sessionId: "s-1",
        gameTypeKey: "TEST_GAME",
      });
    });

    it("sets the connection error and hides the modal when a fetch fails", async () => {
      vi.mocked(presetsApi.fetchConfigurationPresets).mockRejectedValue(
        new Error("network"),
      );
      vi.mocked(sessionsApi.fetchActiveSessions).mockResolvedValue([]);
      const setup = createSetup();
      setup.showActiveSessionModal = true;

      await setup.init();

      expect(setup.showActiveSessionModal).toBe(false);
      expect(setup.error).toBe(
        "Could not load setup. Check your connection and try again.",
      );
      expect(setup.loadingReconciliation).toBe(false);
    });

    it("registers a durationType watcher that runs selectMode", async () => {
      vi.mocked(presetsApi.fetchConfigurationPresets).mockResolvedValue([
        ROUND_PRESET,
        MINUTES_PRESET,
      ]);
      vi.mocked(sessionsApi.fetchActiveSessions).mockResolvedValue([]);
      const setup = createSetup();

      await setup.init();
      const watcher = watchers.find((w) => w.key === "durationType");
      (watcher!.callback as (value: Mode) => void)("MINUTES");

      expect(setup.durationType).toBe("MINUTES");
      expect(setup.durationValue).toBe(7);
    });
  });

  describe("presetForMode / selectMode", () => {
    it("finds the preset whose configuration names the mode", () => {
      const setup = createSetup();
      setup.presets = [ROUND_PRESET, MINUTES_PRESET];
      expect(setup.presetForMode("MINUTES")).toBe(MINUTES_PRESET);
      expect(setup.presetForMode("ROUNDS")).toBe(ROUND_PRESET);
    });

    it("swaps the value to the mode preset's duration_value", () => {
      const setup = createSetup();
      setup.presets = [ROUND_PRESET, MINUTES_PRESET];
      setup.selectMode("MINUTES");
      expect(setup.durationType).toBe("MINUTES");
      expect(setup.durationValue).toBe(7);
    });

    it("swaps the value to the mode fallback when no preset matches", () => {
      const setup = createSetup();
      setup.selectMode("MINUTES");
      expect(setup.durationValue).toBe(5);
    });
  });

  describe("addGuest / addBot", () => {
    it("forces ROUNDS once a guest is seated", () => {
      const setup = createSetup();
      setup.durationType = "MINUTES";
      setup.newGuestName = "Sam";
      setup.addGuest();
      expect(setup.guests).toEqual([{ displayName: "Sam" }]);
      expect(setup.durationType).toBe("ROUNDS");
    });

    it("leaves the mode when no guest is seated", () => {
      const setup = createSetup();
      setup.durationType = "MINUTES";
      setup.newGuestName = "   ";
      setup.addGuest();
      expect(setup.guests).toEqual([]);
      expect(setup.durationType).toBe("MINUTES");
    });

    it("forces ROUNDS once a bot is seated", () => {
      const setup = createSetup();
      setup.durationType = "MINUTES";
      setup.addBot();
      expect(setup.bot).not.toBeNull();
      expect(setup.durationType).toBe("ROUNDS");
    });

    it("leaves the mode when the bot is refused", () => {
      const setup = createSetup();
      setup.guests = [{ displayName: "Sam" }];
      setup.durationType = "MINUTES";
      setup.addBot();
      expect(setup.bot).toBeNull();
      expect(setup.durationType).toBe("MINUTES");
    });

    it("forceRoundsIfGuested is a no-op with nobody seated", () => {
      const setup = createSetup();
      setup.durationType = "MINUTES";
      setup.forceRoundsIfGuested();
      expect(setup.durationType).toBe("MINUTES");
    });
  });
});
