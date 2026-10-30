import { describe, it, expect, vi, beforeEach } from "vitest";
import { followTheLeaderSetup } from "@lib/game/follow-the-leader-setup.data";
import { variantsPlayAgain } from "@lib/game/play-lifecycle";
import type { FollowTheLeaderSetupContext } from "@lib/types";
import * as sessionsApi from "@client/api/sessions";

vi.mock("@client/api/sessions");
vi.mock("@client/api/configuration-templates");

const PRESET = {
  configurationTemplateId: "tmpl-ftl",
  gameTypeKey: "FOLLOW_THE_LEADER",
  name: "Follow the Leader",
  description: null,
  configuration: { lives: 3 },
  isSystemTemplate: true,
} as any;

describe("followTheLeaderSetup", () => {
  let store: FollowTheLeaderSetupContext["$store"];

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
    overrides: Partial<FollowTheLeaderSetupContext> = {},
  ): FollowTheLeaderSetupContext {
    return {
      ...followTheLeaderSetup(),
      $store: store,
      presets: [PRESET],
      ...overrides,
    } as FollowTheLeaderSetupContext;
  }

  function withGuest(setup: FollowTheLeaderSetupContext) {
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

  it("starts with lives 3 and two seats, player first", async () => {
    mockCreated(false);
    const setup = createSetup({ starterIndex: 0 });
    withGuest(setup);

    await setup.start();

    const call = vi.mocked(sessionsApi.createSession).mock.calls[0][0] as any;
    expect(call.rulesetVersionKey).toBe("FOLLOW_THE_LEADER_V1");
    expect(call.config.overrides).toBeUndefined();
    expect(call.participants.map((p: any) => p.participantTypeKey)).toEqual([
      "PLAYER",
      "GUEST",
    ]);
    expect(call.participants.map((p: any) => p.sideKey)).toEqual(["A", "B"]);
    const snapshot = vi.mocked(store.game.startSession).mock.calls[0][0] as any;
    expect(snapshot.configSnapshot.lives).toBe(3);
    expect(snapshot.configSnapshot.seats).toHaveLength(2);
    expect(globalThis.location.href).toBe("/games/follow-the-leader/play");
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

  it("play again resends lives only, whichever seat starts", () => {
    const replay = variantsPlayAgain("FOLLOW_THE_LEADER_V1");
    const out = replay({ lives: 3, seats: [] } as any) as any;
    expect(out.snapshot).toEqual({ lives: 3 });
    expect(out.wire).toEqual({ lives: 3 });
  });
});
