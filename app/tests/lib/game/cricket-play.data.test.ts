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
  cricketPlay,
  cricketSeatResult,
  cricketTapObservation,
} from "@lib/game/cricket-play.data";
import type { CricketPlayContext, CricketSnapshot, Seated } from "@lib/types";
import type {
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
  });
});
