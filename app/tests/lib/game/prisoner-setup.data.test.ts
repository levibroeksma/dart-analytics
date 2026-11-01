import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisonerSetup } from "@lib/game/prisoner-setup.data";
import { variantsPlayAgain } from "@lib/game/play-lifecycle";
import type { PrisonerSetupContext } from "@lib/types";
import * as sessionsApi from "@client/api/sessions";

vi.mock("@client/api/sessions");
vi.mock("@client/api/configuration-templates");

const PRESET = {
  configurationTemplateId: "tmpl-prisoner",
  gameTypeKey: "PRISONER",
  name: "Prisoner",
  description: null,
  configuration: { darts: 3 },
  isSystemTemplate: true,
} as any;

describe("prisonerSetup", () => {
  let store: PrisonerSetupContext["$store"];

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
    overrides: Partial<PrisonerSetupContext> = {},
  ): PrisonerSetupContext {
    return {
      ...prisonerSetup(),
      $store: store,
      presets: [PRESET],
      ...overrides,
    } as PrisonerSetupContext;
  }

  function withGuest(setup: PrisonerSetupContext) {
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

  it("starts with darts 3 and two seats, player first", async () => {
    mockCreated(false);
    const setup = createSetup({ starterIndex: 0 });
    withGuest(setup);

    await setup.start();

    const call = vi.mocked(sessionsApi.createSession).mock.calls[0][0] as any;
    expect(call.rulesetVersionKey).toBe("PRISONER_V1");
    expect(call.config.overrides).toBeUndefined();
    expect(call.participants.map((p: any) => p.participantTypeKey)).toEqual([
      "PLAYER",
      "GUEST",
    ]);
    expect(call.participants.map((p: any) => p.sideKey)).toEqual(["A", "B"]);
    const snapshot = vi.mocked(store.game.startSession).mock.calls[0][0] as any;
    expect(snapshot.configSnapshot.darts).toBe(3);
    expect(snapshot.configSnapshot.seats).toHaveLength(2);
    expect(globalThis.location.href).toBe("/games/prisoner/play");
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

  it("records ANALYTICS + VISUAL_BOARD when Recreational is chosen", async () => {
    mockCreated(false);
    const setup = createSetup();
    withGuest(setup);

    await setup.start();

    const call = vi.mocked(sessionsApi.createSession).mock.calls[0][0] as any;
    expect(call.captureModeKey).toBe("ANALYTICS");
    expect(call.inputModeKey).toBe("VISUAL_BOARD");
  });

  it("play again resends darts only, whichever seat starts", () => {
    const replay = variantsPlayAgain("PRISONER_V1");
    const out = replay({ darts: 3, seats: [] } as any) as any;
    expect(out.snapshot).toEqual({ darts: 3 });
    expect(out.wire).toEqual({ darts: 3 });
  });
});
