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
  foldMickeyMouseState,
  mickeyMouseEngineFactory,
  MickeyMouseEngine,
} from "@modules/game/mickey-mouse.engine.module";
import {
  mickeyMousePlay,
  mickeyMouseSeatResult,
} from "@lib/game/mickey-mouse-play.data";
import type {
  MickeyMousePlayContext,
  MickeyMouseSnapshot,
  Seated,
} from "@lib/types";
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
  gameTypeKey: "MICKEY_MOUSE",
  gameTypeName: "Mickey Mouse",
  captureModeKey: "RECREATIONAL",
  inputModeKey: "DETAILED_DARTS",
  rulesetVersionKey: "MICKEY_MOUSE_V1",
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

type GameStub = MickeyMousePlayContext["$store"]["game"];

function gameStub(overrides: Partial<GameStub> = {}): GameStub {
  return {
    get seats() {
      return this.configSnapshot?.seats ?? [];
    },
    rulesetVersionKey: "MICKEY_MOUSE_V1",
    sessionId: "s1",
    templateRef: "tpl-1",
    configSnapshot: { seats: SEATS } as Seated<MickeyMouseSnapshot>,
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
    ...mickeyMousePlay(),
    $store: {
      game: gameStub(gameOverrides),
      settings: {
        captureModeKey: "RECREATIONAL",
        inputModeKey: "DETAILED_DARTS",
      },
    },
  } as MickeyMousePlayContext;
}

async function started(gameOverrides: Partial<GameStub> = {}) {
  const ctx = makeContext(gameOverrides);
  await ctx.init.call(ctx);
  return ctx;
}

const obs = (hitTargetNumber: number, hitZoneKey: DartZoneKey) => ({
  hitTargetNumber,
  hitZoneKey,
  locationX: null,
  locationY: null,
});

beforeEach(() => {
  vi.clearAllMocks();
  resetEngineRegistry();
  registerEngineFactory(mickeyMouseEngineFactory);
  vi.mocked(fetchActiveSessions).mockResolvedValue([{ ...ACTIVE_SESSION }]);
});

describe("mickeyMousePlay", () => {
  it("lists the twelve objectives in display order", async () => {
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
      "14",
      "13",
      "12",
      "Doubles",
      "Triples",
      "Bull",
    ]);
  });

  it("offers 20…12 and Bull on a single, 11…1 too under D or T", async () => {
    const ctx = await started();
    expect(ctx.tapTargets().map((target) => target.label)).toEqual([
      "20",
      "19",
      "18",
      "17",
      "16",
      "15",
      "14",
      "13",
      "12",
      "Bull",
    ]);
    ctx.setRing("DOUBLE");
    const doubles = ctx.tapTargets();
    expect(doubles).toHaveLength(21);
    expect(doubles.slice(10).map((target) => target.number)).toEqual([
      11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1,
    ]);
    ctx.setRing("TREBLE");
    expect(ctx.tapTargets()).toHaveLength(21);
  });

  it("T20 on an open 20 closes it and marks Triples once", async () => {
    const ctx = await started();
    ctx.setRing("TREBLE");
    await ctx.recordTarget(20);
    const rows = ctx.objectiveRowsFor("participant-1");
    expect(rows[0]).toMatchObject({ label: "20", marks: 3, closed: true });
    expect(rows[10]).toMatchObject({ label: "Triples", marks: 1 });
    expect(ctx.ring).toBe("SINGLE");
  });

  it("D20 on a closed 20 still marks Doubles", async () => {
    const ctx = await started();
    ctx.setRing("TREBLE");
    await ctx.recordTarget(20);
    ctx.setRing("DOUBLE");
    await ctx.recordTarget(20);
    expect(ctx.objectiveRowsFor("participant-1")[9]).toMatchObject({
      label: "Doubles",
      marks: 1,
    });
  });

  it("stores a tapped D7 as a true hit and marks Doubles only", async () => {
    const ctx = await started();
    ctx.setRing("DOUBLE");
    await ctx.recordTarget(7);
    const [written] = ctx.$store.game.turns[0].darts;
    expect(written.hitTargetNumber).toBe(7);
    expect(written.hitZoneKey).toBe("DOUBLE");
    expect(ctx.objectiveRowsFor("participant-1")[9].marks).toBe(1);
  });

  it("records a single bull when Treble is selected and Bull tapped", async () => {
    const ctx = await started();
    ctx.setRing("TREBLE");
    await ctx.recordTarget(25);
    expect(ctx.objectiveRowsFor("participant-1")[11]).toMatchObject({
      label: "Bull",
      marks: 1,
    });
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

  it("counts a miss as a dart", async () => {
    const ctx = await started();
    await ctx.recordMiss();
    expect(ctx.dartsThrown()).toBe("1");
  });

  it("resumes a MICKEY_MOUSE_V1 store into a Mickey Mouse engine", async () => {
    const first = await started();
    await first.recordTarget(19);
    const resumed = await started({ turns: first.$store.game.turns });
    expect(resumed.engine).toBeInstanceOf(MickeyMouseEngine);
    expect(resumed.objectiveRowsFor("participant-1")[1].marks).toBe(1);
  });

  it("builds results with darts thrown and the dart each objective closed on", () => {
    const config = { seats: SEATS };
    const engine = new MickeyMouseEngine(config);
    for (const dart of [
      obs(20, "TREBLE"),
      obs(19, "TREBLE"),
      obs(18, "TREBLE"),
      obs(17, "TREBLE"),
      obs(16, "TREBLE"),
      obs(15, "TREBLE"),
      obs(14, "TREBLE"),
      obs(13, "TREBLE"),
      obs(12, "TREBLE"),
      obs(25, "INNER_BULL"),
      obs(25, "OUTER_BULL"),
      obs(3, "DOUBLE"),
    ]) {
      engine.record(dart);
    }
    const [seat] = foldMickeyMouseState(engine.facts(), config).seats;
    expect(mickeyMouseSeatResult(seat)).toEqual({
      participantRef: "participant-1",
      sideKey: "A",
      darts: 12,
      dartsToClose: [1, 2, 3, 4, 5, 6, 7, 8, 9, null, 3, 11],
    });
  });
});

describe("subtitle", () => {
  it("is blank before config loads", () => {
    const ctx = makeContext({ configSnapshot: null });
    expect(ctx.subtitle.call(ctx)).toBe("");
  });

  it("names solo play and the twelve objectives", () => {
    const ctx = makeContext();
    expect(ctx.subtitle.call(ctx)).toBe("SOLO · 12 OBJECTIVES");
  });
});
