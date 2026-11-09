import { describe, it, expect, vi, beforeEach } from "vitest";
import { fivesSetup } from "@lib/game/fives-setup.data";
import type { FivesSetupContext } from "@lib/types";
import * as sessionsApi from "@client/api/sessions";

vi.mock("@client/api/sessions");
vi.mock("@client/api/configuration-templates");

const PRESET = {
  configurationTemplateId: "tmpl-fives",
  gameTypeKey: "FIVES",
  name: "Fives",
  description: null,
  configuration: {},
  isSystemTemplate: true,
} as any;

describe("fivesSetup", () => {
  let store: FivesSetupContext["$store"];

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
    overrides: Partial<FivesSetupContext> = {},
  ): FivesSetupContext {
    return {
      ...fivesSetup(),
      $store: store,
      presets: [PRESET],
      ...overrides,
    } as FivesSetupContext;
  }

  function withGuest(setup: FivesSetupContext) {
    setup.newGuestName = "Friend";
    setup.addGuest();
  }

  function mockCreated(guestFirst: boolean) {
    const player = {
      ref: "p1",
      displayName: "Player",
      participantTypeKey: "PLAYER",
    };
    const guest = {
      ref: "p2",
      displayName: "Friend",
      participantTypeKey: "GUEST",
    };
    vi.mocked(sessionsApi.createSession).mockResolvedValue({
      sessionId: "sid",
      participants: guestFirst ? [guest, player] : [player, guest],
    } as any);
  }

  it("blocks start until a guest is seated", () => {
    const setup = createSetup();
    expect(setup.canStart()).toBe(false);
    withGuest(setup);
    expect(setup.canStart()).toBe(true);
  });

  it("does not create a session while blocked", async () => {
    const setup = createSetup();
    await setup.start();
    expect(sessionsApi.createSession).not.toHaveBeenCalled();
  });

  it("starts with two seats, player first", async () => {
    mockCreated(false);
    const setup = createSetup({ starterIndex: 0 });
    withGuest(setup);

    await setup.start();

    const call = vi.mocked(sessionsApi.createSession).mock.calls[0][0] as any;
    expect(call.rulesetVersionKey).toBe("FIVES_V1");
    expect(call.config.overrides).toBeUndefined();
    expect(call.participants.map((p: any) => p.participantTypeKey)).toEqual([
      "PLAYER",
      "GUEST",
    ]);
    expect(call.participants.map((p: any) => p.sideKey)).toEqual(["A", "B"]);
    const snapshot = vi.mocked(store.game.startSession).mock.calls[0][0] as any;
    expect(snapshot.configSnapshot.seats).toHaveLength(2);
    expect(globalThis.location.href).toBe("/games/fives/play");
  });

  it("reorders seats when the guest starts", async () => {
    mockCreated(true);
    const setup = createSetup({ starterIndex: 1 });
    withGuest(setup);

    await setup.start();

    const call = vi.mocked(sessionsApi.createSession).mock.calls[0][0] as any;
    expect(call.participants.map((p: any) => p.participantTypeKey)).toEqual([
      "GUEST",
      "PLAYER",
    ]);
    expect(call.participants.map((p: any) => p.sideKey)).toEqual(["A", "B"]);
  });
});
