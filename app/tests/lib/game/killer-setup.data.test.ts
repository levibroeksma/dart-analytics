import { describe, it, expect, vi, beforeEach } from "vitest";
import { killerSetup } from "@lib/game/killer-setup.data";
import type { KillerSetupContext } from "@lib/types";
import * as sessionsApi from "@client/api/sessions";

vi.mock("@client/api/sessions");
vi.mock("@client/api/configuration-templates");

const PRESET = {
  configurationTemplateId: "tmpl-killer",
  gameTypeKey: "KILLER",
  name: "Killer",
  description: null,
  configuration: { lives: 3 },
  isSystemTemplate: true,
} as any;

describe("killerSetup", () => {
  let store: KillerSetupContext["$store"];

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
    overrides: Partial<KillerSetupContext> = {},
  ): KillerSetupContext {
    return {
      ...killerSetup(),
      $store: store,
      presets: [PRESET],
      ...overrides,
    } as KillerSetupContext;
  }

  function withGuest(setup: KillerSetupContext) {
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

  it("defaults seatNumbers to [20, 19]", () => {
    expect(createSetup().seatNumbers).toEqual([20, 19]);
  });

  it("blocks start without a guest", () => {
    const setup = createSetup();
    expect(setup.canStart()).toBe(false);
    expect(setup.startBlockedReason()).toBe("Add a guest to play Killer.");
  });

  it("does not ask for a guest when more than one is added", () => {
    const setup = createSetup();
    setup.guests = [{ displayName: "A" }, { displayName: "B" }];
    expect(setup.canStart()).toBe(false);
    expect(setup.startBlockedReason()).not.toBe("Add a guest to play Killer.");
  });

  it("blocks start when both seats share a number", () => {
    const setup = createSetup({ seatNumbers: [7, 7] });
    withGuest(setup);
    expect(setup.canStart()).toBe(false);
    expect(setup.startBlockedReason()).toBe("Pick different numbers.");
  });

  it("allows start with a guest and distinct numbers", () => {
    const setup = createSetup();
    withGuest(setup);
    expect(setup.canStart()).toBe(true);
    expect(setup.startBlockedReason()).toBe("");
  });

  it("sends seat_numbers in seat order when player 1 starts", async () => {
    mockCreated(false);
    const setup = createSetup({ starterIndex: 0 });
    withGuest(setup);

    await setup.start();

    const call = vi.mocked(sessionsApi.createSession).mock.calls[0][0] as any;
    expect(call.config.overrides.seat_numbers).toEqual([20, 19]);
    expect(call.participants.map((p: any) => p.participantTypeKey)).toEqual([
      "PLAYER",
      "GUEST",
    ]);
    expect(call.participants.map((p: any) => p.sideKey)).toEqual(["A", "B"]);
    const snapshot = vi.mocked(store.game.startSession).mock.calls[0][0] as any;
    expect(snapshot.configSnapshot.seatNumbers).toEqual([20, 19]);
  });

  it("swaps seat_numbers when the guest starts", async () => {
    mockCreated(true);
    const setup = createSetup({ starterIndex: 1 });
    withGuest(setup);

    await setup.start();

    const call = vi.mocked(sessionsApi.createSession).mock.calls[0][0] as any;
    expect(call.config.overrides.seat_numbers).toEqual([19, 20]);
    expect(call.participants.map((p: any) => p.participantTypeKey)).toEqual([
      "GUEST",
      "PLAYER",
    ]);
    const snapshot = vi.mocked(store.game.startSession).mock.calls[0][0] as any;
    expect(snapshot.configSnapshot.seatNumbers).toEqual([19, 20]);
  });

  it("does not create a session when start is blocked", async () => {
    const setup = createSetup();
    await setup.start();
    expect(sessionsApi.createSession).not.toHaveBeenCalled();
  });
});
