import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@client/api/sessions", () => ({
  appendBatch: vi.fn(),
  completeSession: vi.fn(),
  fetchActiveSessions: vi.fn(),
  createSession: vi.fn(),
}));

import { fetchActiveSessions } from "@client/api/sessions";
import {
  registerEngineFactory,
  resetEngineRegistry,
} from "@modules/game/engine.registry";
import {
  applyCricketDart,
  cricketEngineFactory,
  initialCricketState,
} from "@modules/game/cricket.engine.module";
import {
  cricketPlay,
  cricketSeatResult,
  cricketTapObservation,
} from "@lib/game/cricket-play.data";
import type { CricketPlayContext, CricketSnapshot, Seated } from "@lib/types";
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
    expect(ctx.objectiveRows()[0]).toMatchObject({
      label: "20",
      marks: 3,
      closed: true,
    });
  });

  it("records a single bull when Treble is selected and Bull tapped", async () => {
    const ctx = await started();
    ctx.setRing("TREBLE");
    await ctx.recordObjective(25);
    expect(ctx.objectiveRows()[6]).toMatchObject({ label: "Bull", marks: 1 });
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
    expect(resumed.objectiveRows()[1].marks).toBe(1);
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
