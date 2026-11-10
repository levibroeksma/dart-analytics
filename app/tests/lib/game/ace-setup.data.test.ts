import { describe, it, expect, vi, beforeEach } from "vitest";
import { aceSetup } from "@lib/game/ace-setup.data";
import type { AceSetupContext } from "@lib/types";
import * as sessionsApi from "@client/api/sessions";
import * as templatesApi from "@client/api/configuration-templates";

vi.mock("@client/api/sessions");
vi.mock("@client/api/configuration-templates");

const PRESET = {
  configurationTemplateId: "tmpl-ace",
  gameTypeKey: "ACE",
  name: "Ace",
  description: null,
  configuration: { rounds: 6 },
  isSystemTemplate: true,
} as any;

describe("aceSetup", () => {
  let store: AceSetupContext["$store"];

  beforeEach(() => {
    vi.clearAllMocks();
    store = {
      game: { sessionId: null, reset: vi.fn(), startSession: vi.fn() },
      settings: {
        captureModeKey: "RECREATIONAL",
        inputModeKey: "DETAILED_DARTS",
      },
    };
    vi.stubGlobal("location", { href: "" });
  });

  function createSetup(
    overrides: Partial<AceSetupContext> = {},
  ): AceSetupContext {
    return {
      ...aceSetup(),
      $store: store,
      presets: [PRESET],
      ...overrides,
    } as AceSetupContext;
  }

  function withGuest(setup: AceSetupContext) {
    setup.newGuestName = "Friend";
    setup.addGuest();
  }

  function mockCreated() {
    vi.mocked(sessionsApi.createSession).mockResolvedValue({
      sessionId: "sid",
      participants: [
        { ref: "p1", displayName: "Player", participantTypeKey: "PLAYER" },
        { ref: "p2", displayName: "Friend", participantTypeKey: "GUEST" },
      ],
    } as any);
  }

  it("blocks start until a guest is seated", async () => {
    const setup = createSetup();
    expect(setup.canStart()).toBe(false);
    await setup.start();
    expect(sessionsApi.createSession).not.toHaveBeenCalled();
    withGuest(setup);
    expect(setup.canStart()).toBe(true);
  });

  it("starts with the chosen rounds and a minted draw seed as overrides", async () => {
    mockCreated();
    const setup = createSetup({ rounds: 10 });
    withGuest(setup);

    await setup.start();

    const call = vi.mocked(sessionsApi.createSession).mock.calls[0][0] as any;
    expect(call.rulesetVersionKey).toBe("ACE_V1");
    expect(call.config.overrides.rounds).toBe(10);
    expect(Number.isInteger(call.config.overrides.drawSeed)).toBe(true);
    const started = vi.mocked(store.game.startSession).mock.calls[0][0] as any;
    expect(started.configSnapshot.rounds).toBe(10);
    expect(started.configSnapshot.drawSeed).toBe(
      call.config.overrides.drawSeed,
    );
    expect(globalThis.location.href).toBe("/games/ace/play");
  });

  it("clamps the rounds into 3-12 and falls back on a non-number", async () => {
    mockCreated();
    const low = createSetup({ rounds: 1 });
    withGuest(low);
    await low.start();
    const high = createSetup({ rounds: 99 });
    withGuest(high);
    await high.start();
    const odd = createSetup({ rounds: Number.NaN });
    withGuest(odd);
    await odd.start();
    const sent = vi
      .mocked(sessionsApi.createSession)
      .mock.calls.map((c) => (c[0] as any).config.overrides.rounds);
    expect(sent).toEqual([3, 12, 8]);
  });

  it("takes the preset's rounds on init", async () => {
    vi.mocked(templatesApi.fetchConfigurationPresets).mockResolvedValue([
      PRESET,
    ]);
    vi.mocked(sessionsApi.fetchActiveSessions).mockResolvedValue([]);
    const setup = createSetup({ presets: [] });
    await setup.init.call(setup);
    expect(setup.rounds).toBe(6);
  });

  it("keeps the default rounds when the preset has none", async () => {
    vi.mocked(templatesApi.fetchConfigurationPresets).mockResolvedValue([]);
    vi.mocked(sessionsApi.fetchActiveSessions).mockResolvedValue([]);
    const setup = createSetup({ presets: [] });
    await setup.init.call(setup);
    expect(setup.rounds).toBe(8);
  });
});
