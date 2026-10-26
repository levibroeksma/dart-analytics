import { describe, it, expect, vi, beforeEach } from "vitest";
import { baseballSetup } from "@lib/game/baseball-setup.data";
import type { BaseballSetupContext } from "@lib/types";
import * as sessionsApi from "@client/api/sessions";
import * as presetsApi from "@client/api/configuration-templates";

vi.mock("@client/api/sessions");
vi.mock("@client/api/configuration-templates");

const PRESET = {
  configurationTemplateId: "tmpl-baseball",
  gameTypeKey: "BASEBALL",
  name: "Baseball Darts — Nine Innings",
  description: null,
  configuration: {},
  isSystemTemplate: true,
} as any;

describe("baseballSetup", () => {
  let store: BaseballSetupContext["$store"];

  beforeEach(() => {
    vi.clearAllMocks();
    store = {
      game: { sessionId: null, reset: vi.fn(), startSession: vi.fn() },
      settings: {
        captureModeKey: "RECREATIONAL",
        inputModeKey: "DETAILED_DARTS",
      },
    };
  });

  function createSetup(
    overrides: Partial<BaseballSetupContext> = {},
  ): BaseballSetupContext {
    return {
      ...baseballSetup(),
      $store: store,
      ...overrides,
    } as BaseballSetupContext;
  }

  it("loads the BASEBALL presets", async () => {
    vi.mocked(presetsApi.fetchConfigurationPresets).mockResolvedValue([PRESET]);
    vi.mocked(sessionsApi.fetchActiveSessions).mockResolvedValue([]);
    const setup = createSetup();
    await setup.init();
    expect(presetsApi.fetchConfigurationPresets).toHaveBeenCalledWith(
      "BASEBALL",
    );
    expect(setup.presets).toEqual([PRESET]);
  });

  it("starts BASEBALL_V1 from the seeded preset and opens the play page", async () => {
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
    const setup = createSetup({ presets: [PRESET] });

    await setup.start();

    expect(sessionsApi.createSession).toHaveBeenCalledWith({
      gameTypeKey: "BASEBALL",
      rulesetVersionKey: "BASEBALL_V1",
      captureModeKey: "RECREATIONAL",
      inputModeKey: "DETAILED_DARTS",
      config: { source: "template", templateRef: "tmpl-baseball" },
    });
    expect(locationSpy.href).toBe("/games/baseball/play");
  });

  it("adds a guest and still creates BASEBALL_V1", async () => {
    const setup = createSetup({ presets: [PRESET] });
    setup.newGuestName = "Friend";
    setup.addGuest();
    expect(setup.guests).toHaveLength(1);
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
      expect.objectContaining({ rulesetVersionKey: "BASEBALL_V1" }),
    );
  });
});
