import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
import {
  applyCricketDart,
  CricketEngine,
  cricketEngineFactory,
  cricketV2EngineFactory,
  initialCricketState,
} from "@modules/game/cricket.engine.module";
import {
  cricketMarksView,
  cricketPlay,
  cricketSeatResult,
  cricketTapObservation,
} from "@lib/game/cricket-play.data";
import { BOT_PACING } from "@lib/game/play-bot-seat";
import type { CricketPlayContext, CricketSnapshot, Seated } from "@lib/types";
import type {
  CricketState,
  DartObservation,
  DartZoneKey,
  StageFact,
  TurnFact,
} from "@modules/types";

const SEATS = [
  {
    participantRef: "participant-1",
    displayName: "Levi",
    sideKey: "A",
    participantTypeKey: "PLAYER" as const,
  },
];

const ACTIVE_SESSION = {
  sessionId: "s1",
  gameTypeKey: "CRICKET",
  gameTypeName: "Cricket",
  captureModeKey: "RECREATIONAL",
  inputModeKey: "DETAILED_DARTS",
  rulesetVersionKey: "CRICKET_V1",
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

type GameStub = CricketPlayContext["$store"]["game"];

function gameStub(overrides: Partial<GameStub> = {}): GameStub {
  return {
    get seats() {
      return this.configSnapshot?.seats ?? [];
    },
    rulesetVersionKey: "CRICKET_V1",
    sessionId: "s1",
    templateRef: "tpl-1",
    configSnapshot: { seats: SEATS } as Seated<CricketSnapshot>,
    captureModeKey: "RECREATIONAL",
    inputModeKey: "DETAILED_DARTS",
    stages: [STAGE],
    turns: [] as TurnFact[],
    idempotencyKey: null,
    loading: false,
    setSessionModes: vi.fn(function (
      this: GameStub,
      modes: { captureModeKey: string; inputModeKey: string },
    ) {
      this.captureModeKey = modes.captureModeKey;
      this.inputModeKey = modes.inputModeKey;
    }),
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
    ...cricketPlay(),
    $store: {
      game: gameStub(gameOverrides),
      settings: {
        captureModeKey: "RECREATIONAL",
        inputModeKey: "DETAILED_DARTS",
      },
    },
  } as CricketPlayContext;
}

async function started(gameOverrides: Partial<GameStub> = {}) {
  const ctx = makeContext(gameOverrides);
  await ctx.init.call(ctx);
  return ctx;
}

beforeEach(() => {
  vi.clearAllMocks();
  resetEngineRegistry();
  registerEngineFactory(cricketEngineFactory);
  registerEngineFactory(cricketV2EngineFactory);
  vi.mocked(fetchActiveSessions).mockResolvedValue([{ ...ACTIVE_SESSION }]);
});

describe("cricketTapObservation", () => {
  it.each([
    [20, "SINGLE", { hitTargetNumber: 20, hitZoneKey: "SINGLE" }],
    [15, "TREBLE", { hitTargetNumber: 15, hitZoneKey: "TREBLE" }],
    [25, "SINGLE", { hitTargetNumber: 25, hitZoneKey: "OUTER_BULL" }],
    [25, "DOUBLE", { hitTargetNumber: 25, hitZoneKey: "INNER_BULL" }],
  ] as const)("maps %i + %s", (objective, ring, expected) => {
    expect(cricketTapObservation(objective, ring)).toEqual({
      ...expected,
      locationX: null,
      locationY: null,
    });
  });

  it("refuses a treble bull", () => {
    expect(() => cricketTapObservation(25, "TREBLE")).toThrow();
  });
});

describe("cricketPlay", () => {
  it("resets the ring to SINGLE after each objective tap", async () => {
    const ctx = await started();
    ctx.setRing("TREBLE");
    await ctx.recordObjective(20);
    expect(ctx.ring).toBe("SINGLE");
    expect(ctx.objectiveRowsFor("participant-1")[0]).toMatchObject({
      label: "20",
      marks: 3,
      closed: true,
    });
  });

  it("records a single bull when Treble is selected and Bull tapped", async () => {
    const ctx = await started();
    ctx.setRing("TREBLE");
    await ctx.recordObjective(25);
    expect(ctx.objectiveRowsFor("participant-1")[6]).toMatchObject({
      label: "Bull",
      marks: 1,
    });
  });

  it("setRing toggles a selected ring back to SINGLE", async () => {
    const ctx = await started();
    ctx.setRing("DOUBLE");
    expect(ctx.ring).toBe("DOUBLE");
    ctx.setRing("DOUBLE");
    expect(ctx.ring).toBe("SINGLE");
  });

  it("counts a miss as a dart", async () => {
    const ctx = await started();
    await ctx.recordMiss();
    expect(ctx.dartsThrown()).toBe("1");
  });

  it("restores marks from the store's facts on resume", async () => {
    const first = await started();
    await first.recordObjective(19);
    const resumed = await started({ turns: first.$store.game.turns });
    expect(resumed.objectiveRowsFor("participant-1")[1].marks).toBe(1);
  });

  it("restores marks from the store's facts under CRICKET_V2", async () => {
    const first = await started({ rulesetVersionKey: "CRICKET_V2" });
    await first.recordObjective(19);
    const resumed = await started({
      rulesetVersionKey: "CRICKET_V2",
      turns: first.$store.game.turns,
    });
    expect(resumed.objectiveRowsFor("participant-1")[1].marks).toBe(1);
  });

  it("builds results with darts, MPR to 2 dp and darts to close", () => {
    const config = { seats: SEATS };
    const obs = (hitTargetNumber: number, hitZoneKey: DartZoneKey) => ({
      hitTargetNumber,
      hitZoneKey,
      locationX: null,
      locationY: null,
    });
    const seat = [
      obs(15, "TREBLE"),
      obs(20, "TREBLE"),
      obs(19, "TREBLE"),
      obs(18, "TREBLE"),
      obs(17, "TREBLE"),
      obs(16, "TREBLE"),
      obs(25, "INNER_BULL"),
      obs(25, "OUTER_BULL"),
    ].reduce(applyCricketDart, initialCricketState(config).seats[0]);
    expect(cricketSeatResult(seat)).toEqual({
      participantRef: "participant-1",
      sideKey: "A",
      darts: 8,
      marksPerRound: "7.88",
      trebles: 6,
      points: 0,
      dartsToClose: [2, 3, 4, 5, 6, 1, 8],
    });
  });

  it("counts trebles on closed numbers and leaves unclosed targets null", () => {
    const obs = (hitTargetNumber: number, hitZoneKey: DartZoneKey) => ({
      hitTargetNumber,
      hitZoneKey,
      locationX: null,
      locationY: null,
    });
    const seat = [
      obs(20, "TREBLE"),
      obs(20, "TREBLE"),
      obs(5, "TREBLE"),
    ].reduce(applyCricketDart, initialCricketState({ seats: SEATS }).seats[0]);
    const result = cricketSeatResult(seat);
    expect(result.trebles).toBe(2);
    expect(result.dartsToClose).toEqual([
      1,
      null,
      null,
      null,
      null,
      null,
      null,
    ]);
  });
});

describe("subtitle", () => {
  it("is blank before config loads", () => {
    const ctx = makeContext({ configSnapshot: null });
    expect(ctx.subtitle.call(ctx)).toBe("");
  });

  it("names solo play and the seven objectives", () => {
    const ctx = makeContext();
    expect(ctx.subtitle.call(ctx)).toBe("SOLO · 7 OBJECTIVES");
  });
});

describe("Cricket V2 play data", () => {
  const duelSeats: Seated<CricketSnapshot> = {
    seats: [
      ...SEATS,
      {
        participantRef: "participant-2",
        displayName: "Guest",
        sideKey: "B",
        participantTypeKey: "GUEST" as const,
      },
    ],
  };
  const trebles = (...numbers: number[]) =>
    numbers.map((n) => cricketTapObservation(n, "TREBLE"));
  const single = (n: number) => cricketTapObservation(n, "SINGLE");
  const MISS: DartObservation = {
    hitTargetNumber: null,
    hitZoneKey: "MISS",
    locationX: null,
    locationY: null,
  };

  function playDuel(...visits: DartObservation[][]) {
    const engine = new CricketEngine(duelSeats, undefined, "CRICKET_V2");
    for (const darts of visits) {
      for (const dart of darts) {
        if (engine.isComplete()) return engine;
        engine.record(dart);
      }
      for (let i = darts.length; i < 3 && !engine.isComplete(); i += 1) {
        engine.record(MISS);
      }
    }
    return engine;
  }

  const behind = () =>
    playDuel(
      [],
      [...trebles(20), single(20)],
      trebles(20, 19, 18),
      [],
      trebles(17, 16, 15),
      [],
      [
        cricketTapObservation(25, "DOUBLE"),
        cricketTapObservation(25, "SINGLE"),
        single(19),
      ],
    );

  const won = () =>
    playDuel(
      trebles(20, 19, 18),
      [],
      trebles(17, 16, 15),
      [],
      [
        ...trebles(20),
        cricketTapObservation(25, "DOUBLE"),
        cricketTapObservation(25, "SINGLE"),
      ],
    );

  function duelCtx(engine: CricketEngine) {
    return started({
      rulesetVersionKey: "CRICKET_V2",
      configSnapshot: duelSeats,
      turns: engine.facts().turns,
    });
  }

  it("shows the opponent's marks, scoring and dead numbers per seat", async () => {
    const ctx = await duelCtx(behind());
    const rows = ctx.objectiveRowsFor("participant-1");
    expect(rows).toHaveLength(7);
    expect(rows[0]).toMatchObject({
      opponentMarks: 3,
      scoring: false,
      dead: true,
    });
    expect(rows[1]).toMatchObject({
      opponentMarks: 0,
      scoring: true,
      dead: false,
    });
  });

  it("reports null opponent marks for a solo store", async () => {
    const ctx = await started();
    expect(ctx.objectiveRowsFor("participant-1")[0].opponentMarks).toBeNull();
  });

  it("reads points, closed count and darts for each seat", async () => {
    const ctx = await duelCtx(behind());
    expect(ctx.pointsFor("participant-1")).toBe("19");
    expect(ctx.closedCountFor("participant-1")).toBe("7");
    expect(ctx.dartsThrownFor("participant-1")).toBe(
      String(ctx.state()?.seats[0].dartsThrown),
    );
    expect(ctx.pointsFor("participant-2")).toBe("20");
    expect(ctx.pointsFor("nobody")).toBe("0");
  });

  it("names the subtitle 1V1 for two seats", async () => {
    const ctx = await duelCtx(behind());
    expect(ctx.subtitle.call(ctx)).toBe("1V1 · 7 OBJECTIVES");
  });

  it("titles the results solo, by winner and without one", async () => {
    const solo = makeContext();
    expect(solo.resultsTitle.call(solo)).toBe("Closed out!");
    const duel = await duelCtx(behind());
    duel.resultsSnapshot = {
      status: "COMPLETE",
      winningSideKey: "B",
      seats: [],
    };
    expect(duel.resultsTitle.call(duel)).toBe("Guest wins!");
    duel.resultsSnapshot = {
      status: "COMPLETE",
      winningSideKey: null,
      seats: [],
    };
    expect(duel.resultsTitle.call(duel)).toBe("Game over");
  });

  it("carries the winner and points into the results snapshot", async () => {
    vi.mocked(appendBatch).mockResolvedValue({
      created: { stages: 1, turns: 0, darts: 0 },
    });
    vi.mocked(completeSession).mockResolvedValue({} as never);
    const ctx = await duelCtx(won());
    await ctx.uploadAndCompleteSession.call(ctx);
    expect(ctx.resultsSnapshot?.winningSideKey).toBe("A");
    expect(ctx.resultsSnapshot?.seats.map((seat) => seat.points)).toEqual([
      60, 0,
    ]);
  });

  it("resumes under the session's own ruleset key", async () => {
    const ctx = await duelCtx(behind());
    expect(ctx.engine?.rulesetVersionKey).toBe("CRICKET_V2");
  });

  it("resolves playAgain without a session key and does not create a session", async () => {
    const ctx = await started({ rulesetVersionKey: null });
    await expect(ctx.playAgain.call(ctx)).resolves.toBeUndefined();
    expect(createSession).not.toHaveBeenCalled();
  });

  it("resumes mid-visit with the second seat to throw and records to that seat", async () => {
    const midway = playDuel(trebles(20, 19, 18));
    midway.record(single(19));
    const ctx = await duelCtx(midway);
    expect(ctx.engine?.state().activeParticipantRef).toBe("participant-2");
    expect(ctx.engine?.state().seats[1].dartsThisVisit).toBe(1);
    await ctx.recordObjective(19);
    expect(ctx.engine?.state().seats[1].dartsThisVisit).toBe(2);
    expect(ctx.engine?.state().seats[0].dartsThisVisit).toBe(0);
    expect(ctx.engine?.state().activeParticipantRef).toBe("participant-2");
  });
});

const BOT_SEATS = [
  ...SEATS,
  {
    participantRef: "bot-1",
    displayName: "DartBot",
    sideKey: "B",
    participantTypeKey: "DARTBOT" as const,
    dartbot: { level: 8, seed: 424242, levelSource: "MANUAL" as const },
  },
];

function botGame(overrides: Partial<GameStub> = {}): Partial<GameStub> {
  return {
    rulesetVersionKey: "CRICKET_V2",
    configSnapshot: { seats: BOT_SEATS } as Seated<CricketSnapshot>,
    ...overrides,
  };
}

function miss(): DartObservation {
  return {
    hitTargetNumber: null,
    hitZoneKey: "MISS",
    locationX: null,
    locationY: null,
  };
}

function botClosedSixTurns(): TurnFact[] {
  const engine = cricketV2EngineFactory.create({
    seats: BOT_SEATS,
  } as Seated<CricketSnapshot>) as CricketEngine;
  const treble = (n: number): DartObservation => ({
    hitTargetNumber: n,
    hitZoneKey: "TREBLE",
    locationX: null,
    locationY: null,
  });
  for (const n of [20, 19, 18, 17, 16, 15]) {
    engine.record(treble(n));
    engine.record(miss());
    engine.record(miss());
    engine.record(treble(n));
    engine.record(miss());
    engine.record(miss());
  }
  engine.record(miss());
  engine.record(miss());
  engine.record(miss());
  return [...engine.facts().turns];
}

describe("cricketMarksView", () => {
  function stateWith(own: number[], opponent: number[]): CricketState {
    const base = initialCricketState({ seats: BOT_SEATS } as never);
    return {
      ...base,
      seats: [
        { ...base.seats[0], marks: opponent },
        { ...base.seats[1], marks: own },
      ],
    };
  }

  it("lists objectives 20…15 then the bull as 25, bot marks as own", () => {
    const view = cricketMarksView(
      stateWith([3, 0, 0, 0, 0, 0, 1], [0, 2, 0, 0, 0, 0, 0]),
      "bot-1",
    );
    expect(view.objectives.map((o) => o.targetNumber)).toEqual([
      20, 19, 18, 17, 16, 15, 25,
    ]);
    expect(view.objectives[0]).toEqual({
      targetNumber: 20,
      own: 3,
      opponent: 0,
    });
    expect(view.objectives[1]).toEqual({
      targetNumber: 19,
      own: 0,
      opponent: 2,
    });
    expect(view.objectives[6]).toEqual({
      targetNumber: 25,
      own: 1,
      opponent: 0,
    });
  });

  it("reads the same view when the bot sits in seat 0", () => {
    const base = initialCricketState({ seats: BOT_SEATS } as never);
    const state: CricketState = {
      ...base,
      seats: [
        { ...base.seats[0], marks: [3, 0, 0, 0, 0, 0, 0] },
        { ...base.seats[1], marks: [0, 0, 0, 0, 0, 0, 0] },
      ],
    };
    expect(cricketMarksView(state, "participant-1").objectives[0]).toEqual({
      targetNumber: 20,
      own: 3,
      opponent: 0,
    });
  });

  it("throws when the bot has no opponent seat", () => {
    const base = initialCricketState({ seats: SEATS } as never);
    expect(() => cricketMarksView(base, "participant-1")).toThrow(/opponent/);
  });
});

describe("cricketPlay — DartBot opponent", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function run<T>(pending: Promise<T>): Promise<T> {
    await vi.runAllTimersAsync();
    return pending;
  }

  it("throws on its own once the human's visit ends, with no UI action", async () => {
    const play = await run(started(botGame()));
    await run(play.recordMiss());
    await run(play.recordMiss());
    await run(play.recordMiss());
    const botTurns = play
      .engine!.facts()
      .turns.filter((turn) => turn.participantRef === "bot-1");
    expect(botTurns.length).toBeGreaterThan(0);
    expect(play.botThrowing).toBe(false);
    expect(play.engine!.state().activeParticipantRef).toBe("participant-1");
  });

  it("does not throw while it is the human's turn", async () => {
    const play = await run(started(botGame()));
    await run(play.recordMiss());
    expect(
      play.engine!.facts().turns.some((t) => t.participantRef === "bot-1"),
    ).toBe(false);
  });

  it("paces its darts with the shared BOT_PACING", async () => {
    const spy = vi.spyOn(globalThis, "setTimeout");
    const play = await run(started(botGame()));
    await run(play.recordMiss());
    await run(play.recordMiss());
    const handOver = play.recordMiss();
    await vi.runAllTimersAsync();
    await handOver;
    expect(spy).toHaveBeenCalledWith(
      expect.any(Function),
      BOT_PACING.postThrowMs,
    );
    spy.mockRestore();
  });

  it("undoVisit returns control to the human across the bot's visit", async () => {
    const play = await run(started(botGame()));
    await run(play.recordMiss());
    await run(play.recordMiss());
    await run(play.recordMiss());
    await run(play.undoVisit());
    expect(play.engine!.state().activeParticipantRef).toBe("participant-1");
    expect(
      play.engine!.facts().turns.some((t) => t.participantRef === "bot-1"),
    ).toBe(false);
  });

  it("re-throws identically after an undo (determinism)", async () => {
    const play = await run(started(botGame()));
    await run(play.recordMiss());
    await run(play.recordMiss());
    await run(play.recordMiss());
    const before = play
      .engine!.facts()
      .turns.filter((t) => t.participantRef === "bot-1")
      .flatMap((t) => t.darts);
    await run(play.undoVisit());
    await run(play.recordMiss());
    await run(play.recordMiss());
    await run(play.recordMiss());
    const after = play
      .engine!.facts()
      .turns.filter((t) => t.participantRef === "bot-1")
      .flatMap((t) => t.darts);
    expect(after).toEqual(before);
  });

  it("resumes with the bot to throw and plays its visit on init", async () => {
    const first = await run(started(botGame()));
    await run(first.recordMiss());
    await run(first.recordMiss());
    const humanTurns = first.$store.game.turns;
    const resumed = await run(started(botGame({ turns: humanTurns })));
    await run(resumed.recordMiss());
    expect(
      resumed.engine!.facts().turns.some((t) => t.participantRef === "bot-1"),
    ).toBe(true);
  });

  it("resumes mid-visit with the bot to throw and re-throws identically on init", async () => {
    const first = await run(started(botGame()));
    for (let i = 0; i < 3; i += 1) await run(first.recordMiss());
    const botDarts = (play: typeof first) =>
      play
        .engine!.facts()
        .turns.filter((t) => t.participantRef === "bot-1")
        .flatMap((t) => t.darts);
    const original = botDarts(first);
    expect(original.length).toBe(3);
    const humanOnly = first.$store.game.turns.filter(
      (t) => t.participantRef !== "bot-1",
    );
    const resumed = await run(started(botGame({ turns: humanOnly })));
    expect(resumed.error).toBe("");
    expect(botDarts(resumed)).toEqual(original);
  });

  it("ends the game on the bot's winning dart with no further bot dart", async () => {
    const play = await run(started(botGame({ turns: botClosedSixTurns() })));
    for (let guard = 0; !play.finished && guard < 30; guard += 1) {
      if (play.engine!.state().activeParticipantRef === "participant-1") {
        for (let i = 0; i < 3 && !play.finished; i += 1) {
          await run(play.recordMiss());
        }
      } else {
        await run(play.maybeRunBotVisit());
      }
    }
    expect(play.finished).toBe(true);
    expect(play.error).toBe("");
    const turns = play.engine!.facts().turns;
    expect(turns[turns.length - 1].participantRef).toBe("bot-1");
    const dartCount = turns.flatMap((t) => t.darts).length;
    await run(play.maybeRunBotVisit());
    expect(play.engine!.facts().turns.flatMap((t) => t.darts).length).toBe(
      dartCount,
    );
    expect(play.engine!.state().winnerParticipantRef).toBe("bot-1");
  });
});
