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
  applyTacticsDart,
  tacticsEngineFactory,
  initialTacticsState,
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
    expect(ctx.objectiveRows()[0]).toMatchObject({
      label: "20",
      marks: 3,
      closed: true,
    });
  });

  it("records a single bull when Treble is selected and Bull tapped", async () => {
    const ctx = await started();
    ctx.setRing("TREBLE");
    await ctx.recordTarget(25);
    expect(ctx.objectiveRows()[6]).toMatchObject({ label: "Bull", marks: 1 });
  });

  it("lists the nine objectives in display order", async () => {
    const ctx = await started();
    expect(ctx.objectiveRows().map((row) => row.label)).toEqual([
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
    expect(ctx.objectiveRows()[7]).toMatchObject({
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
      obs(7, "DOUBLE"),
      obs(7, "DOUBLE"),
      obs(7, "DOUBLE"),
      obs(7, "TREBLE"),
      obs(7, "TREBLE"),
      obs(7, "TREBLE"),
    ].reduce(applyTacticsDart, initialTacticsState(config).seats[0]);
    expect(tacticsSeatResult(seat)).toMatchObject({
      darts: 14,
      marksPerRound: "5.79",
      dartsToClose:
        "20: 2 · 19: 3 · 18: 4 · 17: 5 · 16: 6 · 15: 1 · Bull: 8 · Doubles: 11 · Triples: 14",
    });
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
