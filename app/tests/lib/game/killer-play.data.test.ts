import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@client/api/sessions", () => ({
  appendBatch: vi.fn(),
  completeSession: vi.fn(),
  fetchActiveSessions: vi.fn(),
  createSession: vi.fn(),
}));

import {
  appendBatch,
  completeSession,
  createSession,
  fetchActiveSessions,
} from "@client/api/sessions";
import {
  registerEngineFactory,
  resetEngineRegistry,
} from "@modules/game/engine.registry";
import { killerEngineFactory } from "@modules/game/killer.engine.module";
import { killerPlay } from "@lib/game/killer-play.data";
import { killerSeatResult } from "@lib/game/killer-seats";
import type { KillerPlayContext, KillerSnapshot, Seated } from "@lib/types";
import type {
  DartObservation,
  DartZoneKey,
  StageFact,
  TurnFact,
} from "@modules/types";

const SEATS = [
  {
    participantRef: "p1",
    displayName: "You",
    sideKey: "A",
    participantTypeKey: "PLAYER" as const,
  },
  {
    participantRef: "p2",
    displayName: "Guest",
    sideKey: "B",
    participantTypeKey: "GUEST" as const,
  },
];

const SNAPSHOT = {
  lives: 3,
  seatNumbers: [20, 19],
  seats: SEATS,
} as Seated<KillerSnapshot>;

const ACTIVE_SESSION = {
  sessionId: "s1",
  gameTypeKey: "KILLER",
  gameTypeName: "Killer",
  captureModeKey: "RECREATIONAL",
  inputModeKey: "DETAILED_DARTS",
  rulesetVersionKey: "KILLER_V1",
  isRoutineStep: false,
  progress: null,
  startedAt: "now",
} as const;

const STAGE: StageFact = {
  clientKey: "block-1",
  stageTypeKey: "EXERCISE_BLOCK",
  parentClientKey: null,
  sequence: 1,
};

type GameStub = KillerPlayContext["$store"]["game"];

function gameStub(overrides: Partial<GameStub> = {}): GameStub {
  return {
    get seats() {
      return this.configSnapshot?.seats ?? [];
    },
    rulesetVersionKey: "KILLER_V1",
    sessionId: "s1",
    templateRef: "tpl-1",
    configSnapshot: SNAPSHOT,
    captureModeKey: "RECREATIONAL",
    inputModeKey: "DETAILED_DARTS",
    stages: [STAGE],
    turns: [] as TurnFact[],
    idempotencyKey: null,
    loading: false,
    setSessionModes: vi.fn(),
    recordFacts: vi.fn(function (this: GameStub, facts) {
      this.stages = [...facts.stages];
      this.turns = [...facts.turns];
    }),
    reset: vi.fn(function (this: GameStub) {
      this.loading = false;
    }),
    ...overrides,
  };
}

function makeContext(gameOverrides: Partial<GameStub> = {}) {
  return {
    ...killerPlay(),
    $store: {
      game: gameStub(gameOverrides),
      settings: {
        captureModeKey: "RECREATIONAL",
        inputModeKey: "DETAILED_DARTS",
      },
    },
  } as KillerPlayContext;
}

async function started(gameOverrides: Partial<GameStub> = {}) {
  const ctx = makeContext(gameOverrides);
  await ctx.init.call(ctx);
  return ctx;
}

function dart(
  hitTargetNumber: number | null,
  hitZoneKey: DartZoneKey,
): DartObservation {
  return { hitTargetNumber, hitZoneKey, locationX: null, locationY: null };
}

const d = (n: number) => dart(n, "DOUBLE");
const s = (n: number) => dart(n, "OUTER_SINGLE");
const miss = dart(null, "MISS");

async function throwAll(ctx: KillerPlayContext, darts: DartObservation[]) {
  for (const observation of darts) await ctx.recordDart(observation);
}

const P2_AT_ONE_LIFE = [d(20), d(19), d(19), miss, miss, miss];

beforeEach(() => {
  vi.clearAllMocks();
  resetEngineRegistry();
  registerEngineFactory(killerEngineFactory);
  vi.mocked(fetchActiveSessions).mockResolvedValue([{ ...ACTIVE_SESSION }]);
  vi.mocked(appendBatch).mockResolvedValue({
    created: { stages: 1, turns: 1, darts: 1 },
  });
  vi.mocked(completeSession).mockResolvedValue({
    sessionId: "s1",
    statusKey: "COMPLETED",
    completedAt: "now",
  });
});

describe("killerPlay", () => {
  it("reads each seat's number in the subtitle; blank before config loads", () => {
    expect(makeContext().subtitle()).toBe("YOU: 20 · GUEST: 19");
    expect(makeContext({ configSnapshot: null }).subtitle()).toBe("");
  });

  it("records a number with the armed ring and resets the ring", async () => {
    const ctx = await started();
    ctx.setRing("DOUBLE");
    expect(ctx.ring).toBe("DOUBLE");
    await ctx.recordNumber(20);
    expect(ctx.ring).toBe("SINGLE");
    const [written] = ctx.$store.game.turns[0].darts;
    expect(written.hitTargetNumber).toBe(20);
    expect(written.hitZoneKey).toBe("DOUBLE");
    expect(ctx.statusLabelFor("p1")).toBe("KILLER");
    expect(ctx.statusLabelFor("p2")).toBe("—");
  });

  it("records the bull as an outer bull and MISS as a miss", async () => {
    const ctx = await started();
    await ctx.recordBull();
    await ctx.recordMiss();
    const [bull, missed] = ctx.$store.game.turns[0].darts;
    expect(bull.hitTargetNumber).toBe(25);
    expect(bull.hitZoneKey).toBe("OUTER_BULL");
    expect(missed.hitTargetNumber).toBeNull();
    expect(missed.hitZoneKey).toBe("MISS");
  });

  it("downgrades a treble-ring bull to a single outer bull", async () => {
    const ctx = await started();
    ctx.setRing("TREBLE");
    await ctx.recordBull();
    const [bull] = ctx.$store.game.turns[0].darts;
    expect(bull.hitTargetNumber).toBe(25);
    expect(bull.hitZoneKey).toBe("OUTER_BULL");
    expect(ctx.ring).toBe("SINGLE");
  });

  it("exposes lives and number per seat and for the active seat", async () => {
    const ctx = await started();
    expect(ctx.livesLabel()).toBe("3");
    expect(ctx.numberLabel()).toBe("20");
    expect(ctx.numberLabelFor("p2")).toBe("19");
    expect(ctx.livesLabelFor("p2")).toBe("3");
    expect(ctx.statusLabel()).toBe("—");
  });

  it("never offers the bull visit", async () => {
    expect((await started()).isBullVisit()).toBe(false);
  });

  it("marks a double as a hit in the preview", async () => {
    const ctx = await started();
    await throwAll(ctx, [d(20), s(1)]);
    expect(ctx.previewSegments().map((segment) => segment.status)).toEqual([
      "hit",
      "miss",
      "empty",
    ]);
  });

  it("resumes mid-visit from the store's facts", async () => {
    const first = await started();
    await throwAll(first, [d(20), s(1), s(1), d(19)]);
    const resumed = await started({ turns: first.$store.game.turns });
    expect(resumed.state()?.activeParticipantRef).toBe("p2");
    expect(resumed.statusLabelFor("p1")).toBe("KILLER");
    expect(resumed.statusLabelFor("p2")).toBe("KILLER");
    expect(resumed.finished).toBe(false);
    await resumed.recordNumber(19);
    expect(resumed.$store.game.turns[1].darts).toHaveLength(2);
  });

  it("ends the game when the last life goes and stores the results", async () => {
    const ctx = await started();
    await throwAll(ctx, [...P2_AT_ONE_LIFE, d(19)]);
    expect(ctx.finished).toBe(true);
    expect(completeSession).toHaveBeenCalledWith("s1", "COMPLETED");
    const finalState = ctx.state()!;
    expect(ctx.resultsSnapshot).toEqual({
      status: "COMPLETE",
      winningSideKey: "A",
      outOrder: ["p2"],
      seats: finalState.seats.map(killerSeatResult),
    });
    expect(ctx.resultsTitle()).toBe("You wins!");
    expect(ctx.outOrderLabel()).toBe("Guest");
  });

  it("titles an unfinished session generically", () => {
    const ctx = makeContext();
    expect(ctx.resultsTitle()).toBe("Session complete");
    expect(ctx.outOrderLabel()).toBe("");
  });

  it("engine-level undo of the eliminating dart reopens the state, while the UI undo refuses once finished", async () => {
    const ctx = await started();
    await throwAll(ctx, [...P2_AT_ONE_LIFE, d(19)]);
    expect(ctx.finished).toBe(true);
    expect(ctx.livesLabelFor("p2")).toBe("0");

    await ctx.undoVisit();
    expect(ctx.livesLabelFor("p2")).toBe("0");

    ctx.engine!.undo();
    ctx.$store.game.recordFacts(ctx.engine!.facts());
    expect(ctx.state()?.status).toBe("IN_PROGRESS");
    expect(ctx.livesLabelFor("p2")).toBe("1");
    expect(ctx.statusLabelFor("p2")).not.toBe("OUT");
  });

  it("undoing a dart that took a life gives the life back", async () => {
    const ctx = await started();
    await throwAll(ctx, [d(20), d(19)]);
    expect(ctx.livesLabelFor("p2")).toBe("2");
    const dartsBefore = ctx.$store.game.turns[0].darts.length;
    await ctx.undoVisit();
    expect(ctx.finished).toBe(false);
    expect(ctx.livesLabelFor("p2")).toBe("3");
    const turn = ctx.$store.game.turns[0];
    expect(turn ? turn.darts.length : 0).toBeLessThan(dartsBefore);
  });

  it("records the bull as an inner bull under the armed double ring", async () => {
    const ctx = await started();
    ctx.setRing("DOUBLE");
    await ctx.recordBull();
    const [bull] = ctx.$store.game.turns[0].darts;
    expect(bull.hitTargetNumber).toBe(25);
    expect(bull.hitZoneKey).toBe("INNER_BULL");
    expect(ctx.ring).toBe("SINGLE");
  });
});

describe("killerPlay play again", () => {
  function mockCreated(guestFirst: boolean) {
    const player = { ...SEATS[0], sideKey: "A" };
    const guest = { ...SEATS[1], sideKey: "B" };
    vi.mocked(createSession).mockResolvedValue({
      sessionId: "s2",
      participants: guestFirst ? [guest, player] : [player, guest],
    } as never);
  }

  it("seats the guest first and swaps the numbers when the guest starts", async () => {
    mockCreated(true);
    const ctx = await started();
    ctx.playAgainStarter = 1;
    await ctx.playAgain();
    const call = vi.mocked(createSession).mock.calls[0][0] as never as {
      config: { overrides: { seat_numbers: number[] } };
      participants: { participantTypeKey: string }[];
    };
    expect(call.config.overrides.seat_numbers).toEqual([19, 20]);
    expect(call.participants.map((p) => p.participantTypeKey)).toEqual([
      "GUEST",
      "PLAYER",
    ]);
  });

  it("keeps the numbers when the player starts", async () => {
    mockCreated(false);
    const ctx = await started();
    ctx.playAgainStarter = 0;
    await ctx.playAgain();
    const call = vi.mocked(createSession).mock.calls[0][0] as never as {
      config: { overrides: { seat_numbers: number[]; lives: number } };
    };
    expect(call.config.overrides.seat_numbers).toEqual([20, 19]);
    expect(call.config.overrides.lives).toBe(3);
  });
});

describe("killer shared play-screen parts", () => {
  it("recordDart before init ignores the dart", async () => {
    const play = makeContext();
    const commit = vi.spyOn(play, "commitDart").mockResolvedValue(undefined);
    const before = [...play.$store.game.turns];
    await play.recordDart({
      hitTargetNumber: null,
      hitZoneKey: "MISS",
      locationX: null,
      locationY: null,
    });
    expect(commit).not.toHaveBeenCalled();
    expect(play.$store.game.turns).toEqual(before);
    expect(play.engine).toBeNull();
  });

  it("recordDart after finish ignores the dart", async () => {
    const play = makeContext();
    const commit = vi.spyOn(play, "commitDart").mockResolvedValue(undefined);
    play.engine = {} as never;
    play.finished = true;
    await play.recordDart({
      hitTargetNumber: null,
      hitZoneKey: "MISS",
      locationX: null,
      locationY: null,
    });
    expect(commit).not.toHaveBeenCalled();
  });
});

describe("killer active-seat accessors", () => {
  const pairs = [
    ["livesLabel", "livesLabelFor", ""],
    ["numberLabel", "numberLabelFor", ""],
    ["statusLabel", "statusLabelFor", ""],
  ] as const;

  it.each(pairs)(
    "%s() is its fallback before state exists",
    (name, forName, fallback) => {
      const play = makeContext();
      vi.spyOn(play, "state").mockReturnValue(null);
      const read = vi.spyOn(play, forName);
      expect(play[name]()).toBe(fallback);
      expect(read).not.toHaveBeenCalled();
    },
  );

  it.each(pairs)("%s() reads %s for the active seat", (name, forName) => {
    const play = makeContext();
    vi.spyOn(play, "state").mockReturnValue({
      activeParticipantRef: "seat-active",
    } as never);
    const read = vi.spyOn(play, forName).mockReturnValue("from-seat");
    expect(play[name]()).toBe("from-seat");
    expect(read).toHaveBeenCalledWith("seat-active");
  });
});

describe("killer resume", () => {
  it("init builds the engine for its own key and none for another game's", async () => {
    const own = makeContext();
    await own.init.call(own);
    expect(own.engine).not.toBeNull();

    const foreign = makeContext({ rulesetVersionKey: "TUOD_V1" });
    await foreign.init.call(foreign);
    expect(foreign.engine).toBeNull();
  });
});
