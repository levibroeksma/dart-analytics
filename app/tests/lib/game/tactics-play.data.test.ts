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
  applyTacticsDart,
  tacticsEngineFactory,
  tacticsV2EngineFactory,
  initialTacticsState,
  TacticsEngine,
} from "@modules/game/tactics.engine.module";
import {
  tacticsPlay,
  tacticsSeatResult,
  tacticsTapObservation,
} from "@lib/game/tactics-play.data";
import type { TacticsPlayContext, TacticsSnapshot, Seated } from "@lib/types";
import type { DartZoneKey, StageFact, TurnFact } from "@modules/types";

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
  gameTypeKey: "TACTICS",
  gameTypeName: "Tactics",
  captureModeKey: "RECREATIONAL",
  inputModeKey: "DETAILED_DARTS",
  rulesetVersionKey: "TACTICS_V1",
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

type GameStub = TacticsPlayContext["$store"]["game"];

function gameStub(overrides: Partial<GameStub> = {}): GameStub {
  return {
    get seats() {
      return this.configSnapshot?.seats ?? [];
    },
    rulesetVersionKey: "TACTICS_V1",
    sessionId: "s1",
    templateRef: "tpl-1",
    configSnapshot: { seats: SEATS } as Seated<TacticsSnapshot>,
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
    ...tacticsPlay(),
    $store: {
      game: gameStub(gameOverrides),
      settings: {
        captureModeKey: "RECREATIONAL",
        inputModeKey: "DETAILED_DARTS",
      },
    },
  } as TacticsPlayContext;
}

async function started(gameOverrides: Partial<GameStub> = {}) {
  const ctx = makeContext(gameOverrides);
  await ctx.init.call(ctx);
  return ctx;
}

beforeEach(() => {
  vi.clearAllMocks();
  resetEngineRegistry();
  registerEngineFactory(tacticsEngineFactory);
  registerEngineFactory(tacticsV2EngineFactory);
  vi.mocked(fetchActiveSessions).mockResolvedValue([{ ...ACTIVE_SESSION }]);
});

describe("tacticsTapObservation", () => {
  it.each([
    [20, "SINGLE", { hitTargetNumber: 20, hitZoneKey: "SINGLE" }],
    [15, "TREBLE", { hitTargetNumber: 15, hitZoneKey: "TREBLE" }],
    [7, "DOUBLE", { hitTargetNumber: 7, hitZoneKey: "DOUBLE" }],
    [1, "TREBLE", { hitTargetNumber: 1, hitZoneKey: "TREBLE" }],
    [25, "SINGLE", { hitTargetNumber: 25, hitZoneKey: "OUTER_BULL" }],
    [25, "DOUBLE", { hitTargetNumber: 25, hitZoneKey: "INNER_BULL" }],
  ] as const)("maps %i + %s", (number, ring, expected) => {
    expect(tacticsTapObservation(number, ring)).toEqual({
      ...expected,
      locationX: null,
      locationY: null,
    });
  });

  it("refuses a treble bull", () => {
    expect(() => tacticsTapObservation(25, "TREBLE")).toThrow();
  });
});

describe("tacticsPlay", () => {
  it("resets the ring to SINGLE after each objective tap", async () => {
    const ctx = await started();
    ctx.setRing("TREBLE");
    await ctx.recordTarget(20);
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
    await ctx.recordTarget(25);
    expect(ctx.objectiveRowsFor("participant-1")[6]).toMatchObject({
      label: "Bull",
      marks: 1,
    });
  });

  it("lists the nine objectives in display order", async () => {
    const ctx = await started();
    expect(
      ctx.objectiveRowsFor("participant-1").map((row) => row.label),
    ).toEqual([
      "20",
      "19",
      "18",
      "17",
      "16",
      "15",
      "Bull",
      "Doubles",
      "Triples",
    ]);
  });

  it("offers 20–15 and Bull on a single, 14…1 too under D or T", async () => {
    const ctx = await started();
    expect(ctx.tapTargets().map((target) => target.label)).toEqual([
      "20",
      "19",
      "18",
      "17",
      "16",
      "15",
      "Bull",
    ]);
    ctx.setRing("DOUBLE");
    const doubles = ctx.tapTargets();
    expect(doubles).toHaveLength(21);
    expect(doubles.slice(7).map((target) => target.number)).toEqual([
      14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1,
    ]);
    ctx.setRing("TREBLE");
    expect(ctx.tapTargets()).toHaveLength(21);
  });

  it("stores a tapped D7 as a true hit and feeds Doubles", async () => {
    const ctx = await started();
    ctx.setRing("DOUBLE");
    await ctx.recordTarget(7);
    const [written] = ctx.$store.game.turns[0].darts;
    expect(written.hitTargetNumber).toBe(7);
    expect(written.hitZoneKey).toBe("DOUBLE");
    expect(ctx.objectiveRowsFor("participant-1")[7]).toMatchObject({
      label: "Doubles",
      marks: 1,
    });
    expect(ctx.ring).toBe("SINGLE");
  });

  it("shows D7 as a hit and S7 as a miss in the visit preview", async () => {
    const ctx = await started();
    ctx.setRing("DOUBLE");
    await ctx.recordTarget(7);
    await ctx.recordTarget(7);
    expect(ctx.previewSegments().map((segment) => segment.status)).toEqual([
      "hit",
      "miss",
      "empty",
    ]);
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
    await first.recordTarget(19);
    const resumed = await started({ turns: first.$store.game.turns });
    expect(resumed.objectiveRowsFor("participant-1")[1].marks).toBe(1);
  });

  it("resumes a TACTICS_V2 store into a V2 engine", async () => {
    const seats = [
      ...SEATS,
      {
        participantRef: "participant-2",
        displayName: "Guest",
        sideKey: "B",
        participantTypeKey: "GUEST" as const,
      },
    ];
    const ctx = await started({
      rulesetVersionKey: "TACTICS_V2",
      configSnapshot: { seats } as Seated<TacticsSnapshot>,
    });
    expect(ctx.engine).toBeInstanceOf(TacticsEngine);
    expect(ctx.engine?.rulesetVersionKey).toBe("TACTICS_V2");
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
      obs(7, "DOUBLE"),
      obs(7, "DOUBLE"),
      obs(7, "DOUBLE"),
      obs(7, "TREBLE"),
      obs(7, "TREBLE"),
      obs(7, "TREBLE"),
    ].reduce(applyTacticsDart, initialTacticsState(config).seats[0]);
    expect(tacticsSeatResult(seat)).toEqual({
      participantRef: "participant-1",
      sideKey: "A",
      darts: 14,
      marksPerRound: "5.79",
      bulls: 2,
      points: 0,
      dartsToClose: [2, 3, 4, 5, 6, 1, 8, 11, 14],
    });
  });

  it("counts bull darts after the bull closed", () => {
    const obs = (hitTargetNumber: number, hitZoneKey: DartZoneKey) => ({
      hitTargetNumber,
      hitZoneKey,
      locationX: null,
      locationY: null,
    });
    const seat = [
      obs(25, "INNER_BULL"),
      obs(25, "OUTER_BULL"),
      obs(25, "OUTER_BULL"),
    ].reduce(applyTacticsDart, initialTacticsState({ seats: SEATS }).seats[0]);
    expect(tacticsSeatResult(seat).bulls).toBe(3);
  });
});

describe("subtitle", () => {
  it("is blank before config loads", () => {
    const ctx = makeContext({ configSnapshot: null });
    expect(ctx.subtitle.call(ctx)).toBe("");
  });

  it("names solo play and the nine objectives, Doubles and Triples included", () => {
    const ctx = makeContext();
    expect(ctx.subtitle.call(ctx)).toBe("SOLO · 9 OBJECTIVES");
  });
});

describe("Tactics V2 play data", () => {
  const DUEL_SEATS = [
    ...SEATS,
    {
      participantRef: "participant-2",
      displayName: "Guest",
      sideKey: "B",
      participantTypeKey: "GUEST" as const,
    },
  ];
  const duelConfig = { seats: DUEL_SEATS } as Seated<TacticsSnapshot>;
  const obs = (hitTargetNumber: number | null, hitZoneKey: DartZoneKey) => ({
    hitTargetNumber,
    hitZoneKey,
    locationX: null,
    locationY: null,
  });
  const MISS = obs(null, "MISS");
  const CLOSERS = [
    [obs(20, "TREBLE"), obs(19, "TREBLE"), obs(18, "TREBLE")],
    [obs(17, "TREBLE"), obs(16, "TREBLE"), obs(15, "TREBLE")],
    [obs(25, "INNER_BULL"), obs(25, "OUTER_BULL"), obs(1, "TREBLE")],
    [obs(2, "TREBLE"), obs(3, "TREBLE"), obs(1, "DOUBLE")],
  ];

  function duelEngine(extra: ReturnType<typeof obs>[] = []) {
    const engine = new TacticsEngine(duelConfig, undefined, "TACTICS_V2");
    const threeMisses = [MISS, MISS, MISS];
    const darts = [
      ...threeMisses,
      obs(20, "TREBLE"),
      obs(20, "SINGLE"),
      MISS,
      ...CLOSERS[0],
      ...threeMisses,
      ...CLOSERS[1],
      ...threeMisses,
      ...CLOSERS[2],
      ...threeMisses,
      ...CLOSERS[3],
      ...threeMisses,
      obs(2, "DOUBLE"),
      obs(3, "DOUBLE"),
      obs(19, "SINGLE"),
      ...threeMisses,
      ...extra,
    ];
    for (const dart of darts) engine.record(dart);
    return engine;
  }

  function duelEngineWithOwnDoubles() {
    const engine = new TacticsEngine(duelConfig, undefined, "TACTICS_V2");
    for (const dart of [obs(1, "DOUBLE"), obs(2, "DOUBLE"), obs(3, "DOUBLE")]) {
      engine.record(dart);
    }
    return engine;
  }

  async function duelCtx(engine = duelEngine()) {
    return started({
      rulesetVersionKey: "TACTICS_V2",
      configSnapshot: duelConfig,
      turns: engine.facts().turns,
    });
  }

  it("shows the opponent's marks, scoring and dead numbers per seat", async () => {
    const ctx = await duelCtx();
    const rows = ctx.objectiveRowsFor("participant-1");
    expect(rows).toHaveLength(9);
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

  it("never marks Doubles or Triples as scoring or dead", async () => {
    const engine = new TacticsEngine(duelConfig, undefined, "TACTICS_V2");
    const darts = [
      obs(1, "DOUBLE"),
      obs(2, "DOUBLE"),
      obs(3, "DOUBLE"),
      obs(4, "DOUBLE"),
      obs(5, "DOUBLE"),
      obs(6, "DOUBLE"),
    ];
    for (const dart of darts) engine.record(dart);
    const ctx = await duelCtx(engine);
    const doubles = ctx.objectiveRowsFor("participant-1")[7];
    expect(doubles).toMatchObject({
      closed: true,
      opponentMarks: 3,
      scoring: false,
      dead: false,
    });
    const own = await duelCtx(duelEngineWithOwnDoubles());
    expect(own.objectiveRowsFor("participant-1")[7]).toMatchObject({
      closed: true,
      opponentMarks: 0,
      scoring: false,
    });
  });

  it("flags an unclosed number as neither scoring nor dead", async () => {
    const ctx = await duelCtx();
    expect(ctx.objectiveRowsFor("participant-1")[2]).toMatchObject({
      closed: true,
      opponentMarks: 0,
      scoring: true,
      dead: false,
    });
    expect(ctx.objectiveRowsFor("participant-2")[1]).toMatchObject({
      closed: false,
      scoring: false,
      dead: false,
    });
  });

  it("reports null opponent marks for a solo store", async () => {
    const ctx = await started();
    expect(ctx.objectiveRowsFor("participant-1")[0].opponentMarks).toBeNull();
  });

  it("reads points, closed count and darts for each seat", async () => {
    const ctx = await duelCtx();
    expect(ctx.pointsFor("participant-1")).toBe("19");
    expect(ctx.closedCountFor("participant-1")).toBe("9");
    expect(ctx.dartsThrownFor("participant-1")).toBe(
      String(ctx.state()?.seats[0].dartsThrown),
    );
    expect(ctx.pointsFor("participant-2")).toBe("20");
  });

  it("reads zero for an unknown seat ref", async () => {
    const ctx = await duelCtx();
    expect(ctx.pointsFor("nobody")).toBe("0");
    expect(ctx.closedCountFor("nobody")).toBe("0");
    expect(ctx.dartsThrownFor("nobody")).toBe("0");
    expect(ctx.objectiveRowsFor("nobody")[0].marks).toBe(0);
  });

  it("counts the solo darts from the first seat through the shared accessors", async () => {
    const ctx = await started();
    await ctx.recordMiss();
    expect(ctx.dartsThrown()).toBe("1");
    expect(ctx.dartsThrownFor("participant-1")).toBe("1");
  });

  it("names the subtitle 1V1 for two seats", async () => {
    const ctx = await duelCtx();
    expect(ctx.subtitle.call(ctx)).toBe("1V1 · 9 OBJECTIVES");
  });

  it("titles the results solo, by winner and without one", async () => {
    const solo = makeContext();
    expect(solo.resultsTitle.call(solo)).toBe("Closed out!");
    const duel = await duelCtx();
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
    const ctx = await duelCtx(duelEngine([obs(19, "SINGLE")]));
    await ctx.uploadAndCompleteSession.call(ctx);
    expect(ctx.resultsSnapshot?.winningSideKey).toBe("A");
    expect(ctx.resultsSnapshot?.seats.map((seat) => seat.points)).toEqual([
      38, 20,
    ]);
  });

  it("replays the session's own ruleset key", async () => {
    const ctx = await duelCtx();
    expect(ctx.engine?.rulesetVersionKey).toBe("TACTICS_V2");
  });
});

describe("tacticsPlay play again starter", () => {
  function withSeats(count: number) {
    const play = tacticsPlay();
    const playAgain = vi.fn();
    const ctx = {
      ...play,
      playAgain,
      $store: { game: { seats: Array.from({ length: count }, () => ({})) } },
    } as never as {
      starterOpen: boolean;
      playAgain: typeof playAgain;
      requestPlayAgain(): unknown;
    };
    return ctx;
  }

  it("opens the who-throws-first step with two seats", () => {
    const ctx = withSeats(2);
    ctx.requestPlayAgain();
    expect(ctx.starterOpen).toBe(true);
    expect(ctx.playAgain).not.toHaveBeenCalled();
  });

  it("replays straight away with one seat", () => {
    const ctx = withSeats(1);
    ctx.requestPlayAgain();
    expect(ctx.starterOpen).toBe(false);
    expect(ctx.playAgain).toHaveBeenCalledOnce();
  });
});
