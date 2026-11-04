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
import { prisonerEngineFactory } from "@modules/game/prisoner.engine.module";
import { prisonerPlay } from "@lib/game/prisoner-play.data";
import { zoneCentroid } from "@lib/game/board/board-geometry.module";
import type { PrisonerPlayContext, PrisonerSnapshot, Seated } from "@lib/types";
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

const SNAPSHOT = { darts: 3, seats: SEATS } as Seated<PrisonerSnapshot>;

const ACTIVE_SESSION = {
  sessionId: "s1",
  gameTypeKey: "PRISONER",
  gameTypeName: "Prisoner",
  captureModeKey: "ANALYTICS",
  inputModeKey: "VISUAL_BOARD",
  rulesetVersionKey: "PRISONER_V1",
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

type GameStub = PrisonerPlayContext["$store"]["game"];

function fakeBoard(): SVGSVGElement {
  const matrix = { inverse: () => matrix, a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
  const point = {
    x: 0,
    y: 0,
    matrixTransform: () => ({ x: point.x, y: point.y }),
  };
  return {
    createSVGPoint: () => point,
    getScreenCTM: () => matrix,
  } as unknown as SVGSVGElement;
}

function gameStub(overrides: Partial<GameStub> = {}): GameStub {
  return {
    get seats() {
      return this.configSnapshot?.seats ?? [];
    },
    rulesetVersionKey: "PRISONER_V1",
    sessionId: "s1",
    templateRef: "tpl-1",
    configSnapshot: SNAPSHOT,
    captureModeKey: "ANALYTICS",
    inputModeKey: "VISUAL_BOARD",
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
    ...prisonerPlay(),
    $refs: { board: fakeBoard() },
    $store: {
      game: gameStub(gameOverrides),
      settings: {
        captureModeKey: "ANALYTICS",
        inputModeKey: "VISUAL_BOARD",
      },
      boardInput: { handedness: "RIGHT" },
    },
  } as unknown as PrisonerPlayContext;
}

async function started(gameOverrides: Partial<GameStub> = {}) {
  const ctx = makeContext(gameOverrides);
  await ctx.init.call(ctx);
  return ctx;
}

function at(n: number, zone: DartZoneKey): DartObservation {
  const point = zoneCentroid(n, zone);
  if (!point) throw new Error(`no centroid for ${zone} ${n}`);
  return {
    hitTargetNumber: n,
    hitZoneKey: zone,
    locationX: point.x,
    locationY: point.y,
  };
}

const outer = (n: number) => at(n, "OUTER_SINGLE");
const inner = (n: number) => at(n, "INNER_SINGLE");
const miss: DartObservation = {
  hitTargetNumber: null,
  hitZoneKey: "MISS",
  locationX: null,
  locationY: null,
};

async function throwAll(ctx: PrisonerPlayContext, darts: DartObservation[]) {
  for (const observation of darts) await ctx.recordDart(observation);
}

const P1_PRISONS_ONE = [inner(1), miss, miss];

beforeEach(() => {
  vi.clearAllMocks();
  resetEngineRegistry();
  registerEngineFactory(prisonerEngineFactory);
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

describe("prisonerPlay banner and per-seat labels", () => {
  it("reads the active seat's target as an outer bed", async () => {
    const ctx = await started();
    expect(ctx.targetLabel()).toBe("Outer 1");
    expect(ctx.subtitle()).toBe("TARGET: Outer 1");
  });

  it("is blank before config loads", () => {
    const ctx = makeContext({ configSnapshot: null });
    expect(ctx.targetLabel()).toBe("");
    expect(ctx.subtitle()).toBe("");
    expect(ctx.lodgedList()).toEqual([]);
    expect(ctx.dartsLeftLabel()).toBe("");
  });

  it("follows the seat that advanced", async () => {
    const ctx = await started();
    await ctx.recordDart(outer(1));
    expect(ctx.targetLabel()).toBe("Outer 2");
    expect(ctx.targetLabelFor("p1")).toBe("Outer 2");
    expect(ctx.targetLabelFor("p2")).toBe("Outer 1");
  });

  it("exposes held, darts left and sitting per seat", async () => {
    const ctx = await started();
    expect(ctx.heldLabel()).toBe("3");
    expect(ctx.dartsLeftLabel()).toBe("3");
    expect(ctx.sittingLabelFor("p1")).toBe("0");
    await ctx.recordDart(miss);
    expect(ctx.dartsLeftLabel()).toBe("2");
    await throwAll(ctx, [miss, miss]);
    expect(ctx.state()?.activeParticipantRef).toBe("p2");
    expect(ctx.sittingLabelFor("p1")).toBe("3");
    expect(ctx.heldLabelFor("p1")).toBe("3");
    expect(ctx.dartsLeftLabel()).toBe("3");
  });

  it("shows the waiting seat's next-visit budget as its darts left", async () => {
    const ctx = await started();
    await ctx.recordDart(miss);
    expect(ctx.dartsLeftLabelFor("p1")).toBe("2");
    expect(ctx.dartsLeftLabelFor("p2")).toBe("3");
    expect(ctx.dartsLeftLabelFor("nobody")).toBe("");
  });

  it("counts captured and imprisoned per seat", async () => {
    const ctx = await started();
    await throwAll(ctx, P1_PRISONS_ONE);
    expect(ctx.imprisonedLabelFor("p1")).toBe("1");
    expect(ctx.heldLabelFor("p1")).toBe("2");
    await ctx.recordDart(outer(1));
    expect(ctx.capturedLabelFor("p2")).toBe("1");
    expect(ctx.heldLabelFor("p2")).toBe("4");
    expect(ctx.capturedLabelFor("p1")).toBe("0");
  });

  it("is blank for an unknown seat", async () => {
    const ctx = await started();
    expect(ctx.heldLabelFor("nobody")).toBe("");
    expect(ctx.targetLabelFor("nobody")).toBe("");
  });

  it("reads a seat that completed 20 as done", async () => {
    const ctx = await started();
    const seat = ctx.state()!.seats[0];
    vi.spyOn(ctx, "state").mockReturnValue({
      ...ctx.state()!,
      seats: [{ ...seat, target: 21 }, ctx.state()!.seats[1]],
    });
    expect(ctx.targetLabelFor("p1")).toBe("Done");
  });
});

describe("prisonerPlay lodged prisoners", () => {
  it("lists the numbers holding prisoners, ascending", async () => {
    const ctx = await started();
    expect(ctx.lodgedList()).toEqual([]);
    await throwAll(ctx, P1_PRISONS_ONE);
    await throwAll(ctx, [inner(1)]);
    expect(ctx.lodgedList()).toEqual([{ number: 1, count: 2 }]);
  });

  it("drops a number once its prisoners are all captured", async () => {
    const ctx = await started();
    await throwAll(ctx, P1_PRISONS_ONE);
    await ctx.recordDart(outer(1));
    expect(ctx.lodgedList()).toEqual([]);
  });

  it("orders several numbers ascending", async () => {
    const ctx = await started();
    await throwAll(ctx, [inner(1), outer(1), inner(2)]);
    await throwAll(ctx, [inner(1), miss, miss]);
    expect(ctx.lodgedList()).toEqual([
      { number: 1, count: 1 },
      { number: 2, count: 1 },
    ]);
  });
});

describe("prisonerPlay entry", () => {
  it("records a dart through the engine", async () => {
    const ctx = await started();
    await ctx.recordDart(outer(1));
    const [written] = ctx.$store.game.turns[0].darts;
    expect(written.hitTargetNumber).toBe(1);
    expect(written.hitZoneKey).toBe("OUTER_SINGLE");
    expect(ctx.engine?.facts().turns).toEqual(ctx.$store.game.turns);
  });

  it("records nothing without an engine or once finished", async () => {
    const ctx = makeContext();
    await ctx.recordDart(outer(1));
    expect(ctx.$store.game.turns).toHaveLength(0);
    const live = await started();
    live.finished = true;
    await live.recordDart(outer(1));
    expect(live.$store.game.turns).toHaveLength(0);
  });

  it("writes an unlocated MISS dart for the board's Bounce out key", async () => {
    const ctx = await started();
    ctx.recordUnseen();
    await vi.waitFor(() => expect(ctx.$store.game.turns).toHaveLength(1));
    const [written] = ctx.$store.game.turns[0].darts;
    expect(written.hitZoneKey).toBe("MISS");
    expect(written.hitTargetNumber).toBeNull();
    expect(written.locationX).toBeNull();
    expect(written.locationY).toBeNull();
    expect(ctx.dartsLeftLabel()).toBe("2");
  });

  it("shows the board in an active unpaused board session", async () => {
    const ctx = await started();
    expect(ctx.showBoard()).toBe(true);
    ctx.$store.game.timerPaused = true;
    expect(ctx.showBoard()).toBe(false);
  });
});

describe("prisonerPlay resume", () => {
  it("gives the same active seat and darts left after a reload mid-visit", async () => {
    const first = await started();
    await throwAll(first, P1_PRISONS_ONE);
    await first.recordDart(miss);
    const resumed = await started({ turns: first.$store.game.turns });
    expect(resumed.state()?.activeParticipantRef).toBe("p2");
    expect(resumed.dartsLeftLabel()).toBe(first.dartsLeftLabel());
    expect(resumed.dartsLeftLabel()).toBe("2");
    expect(resumed.lodgedList()).toEqual(first.lodgedList());
  });

  it("keeps the seat and count when reloaded inside the first visit", async () => {
    const first = await started();
    await throwAll(first, [miss, miss]);
    const resumed = await started({ turns: first.$store.game.turns });
    expect(resumed.state()?.activeParticipantRef).toBe("p1");
    expect(resumed.dartsLeftLabel()).toBe("1");
  });
});

describe("prisonerPlay undo", () => {
  it("restores lodged when a capture is undone", async () => {
    const ctx = await started();
    await throwAll(ctx, P1_PRISONS_ONE);
    await ctx.recordDart(outer(1));
    expect(ctx.lodgedList()).toEqual([]);
    await ctx.undoVisit();
    expect(ctx.lodgedList()).toEqual([{ number: 1, count: 1 }]);
    expect(ctx.capturedLabelFor("p2")).toBe("0");
  });

  it("reopens the closing seat's visit when its last dart is undone", async () => {
    const ctx = await started();
    await throwAll(ctx, P1_PRISONS_ONE);
    await ctx.undoVisit();
    expect(ctx.state()?.activeParticipantRef).toBe("p1");
    expect(ctx.dartsLeftLabel()).toBe("1");
    expect(ctx.lodgedList()).toEqual([{ number: 1, count: 1 }]);
  });

  it("refuses to undo a finished game", async () => {
    const ctx = await started();
    await ctx.recordDart(outer(1));
    ctx.finished = true;
    const turns = ctx.$store.game.turns;
    await ctx.undoVisit();
    expect(ctx.$store.game.turns).toBe(turns);
  });
});

describe("prisonerPlay ending", () => {
  async function p1RunsTheTable() {
    const ctx = await started();
    for (let n = 1; n <= 20; n += 1) {
      await ctx.recordDart(outer(n));
      if (ctx.finished) break;
      if (ctx.state()?.activeParticipantRef === "p2") {
        await throwAll(ctx, [miss, miss, miss]);
      }
    }
    return ctx;
  }

  it("ends on completing 20 and stores the results", async () => {
    const ctx = await p1RunsTheTable();
    expect(ctx.finished).toBe(true);
    expect(completeSession).toHaveBeenCalledWith("s1", "COMPLETED");
    expect(ctx.resultsSnapshot?.winningSideKey).toBe("A");
    expect(ctx.resultsSnapshot?.wonBy).toBe("COMPLETED_20");
    expect(ctx.resultsSnapshot?.seats).toHaveLength(2);
  });

  it("titles an unfinished session generically", () => {
    const ctx = makeContext();
    expect(ctx.resultsTitle()).toBe("Session complete");
    expect(ctx.outOrderLabel()).toBe("");
  });

  it("names the winner once results exist", async () => {
    const ctx = await p1RunsTheTable();
    expect(ctx.resultsTitle()).toBe("You wins!");
  });
});

describe("prisonerPlay abandon and play again", () => {
  it("exposes abandon and the starter-step controls", async () => {
    const ctx = await started();
    expect(typeof ctx.abandonAndExit).toBe("function");
    expect(typeof ctx.back).toBe("function");
    expect(ctx.starterOpen).toBe(false);
    ctx.requestPlayAgain();
    expect(ctx.starterOpen).toBe(true);
    expect(ctx.playAgainStarterOptions().sides()).toEqual(["You", "Guest"]);
  });
});
