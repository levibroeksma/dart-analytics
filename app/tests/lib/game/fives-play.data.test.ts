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
import { fivesEngineFactory } from "@modules/game/fives.engine.module";
import { fivesPlay } from "@lib/game/fives-play.data";
import { fivesSeatResult } from "@lib/game/fives-seats";
import type { FivesPlayContext, FivesSnapshot, Seated } from "@lib/types";
import type {
  DartObservation,
  DartZoneKey,
  StageFact,
  TurnFact,
} from "@modules/types";
import { shapeOf } from "../../support/factory-shape";

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

const SNAPSHOT = { seats: SEATS } as Seated<FivesSnapshot>;

const ACTIVE_SESSION = {
  sessionId: "s1",
  gameTypeKey: "FIVES",
  gameTypeName: "Fives",
  captureModeKey: "RECREATIONAL",
  inputModeKey: "DETAILED_DARTS",
  rulesetVersionKey: "FIVES_V1",
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

type GameStub = FivesPlayContext["$store"]["game"];

function gameStub(overrides: Partial<GameStub> = {}): GameStub {
  return {
    get seats() {
      return this.configSnapshot?.seats ?? [];
    },
    rulesetVersionKey: "FIVES_V1",
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
    ...fivesPlay(),
    $store: {
      game: gameStub(gameOverrides),
      settings: {
        captureModeKey: "RECREATIONAL",
        inputModeKey: "DETAILED_DARTS",
      },
    },
  } as FivesPlayContext;
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

const t = (n: number) => dart(n, "TREBLE");
const s = (n: number) => dart(n, "OUTER_SINGLE");
const miss = dart(null, "MISS");

async function throwAll(ctx: FivesPlayContext, darts: DartObservation[]) {
  for (const observation of darts) await ctx.recordDart(observation);
}

const P1_AT_36 = [t(20), t(20), t(20), miss, miss, miss];

beforeEach(() => {
  vi.clearAllMocks();
  resetEngineRegistry();
  registerEngineFactory(fivesEngineFactory);
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

describe("fivesPlay", () => {
  it("subtitles the target; blank before config loads", () => {
    expect(makeContext().subtitle()).toBe("First to exactly 51");
    expect(makeContext({ configSnapshot: null }).subtitle()).toBe("");
  });

  it("records a number with the armed ring and resets the ring", async () => {
    const ctx = await started();
    ctx.setRing("TREBLE");
    expect(ctx.ring).toBe("TREBLE");
    await ctx.recordNumber(20);
    expect(ctx.ring).toBe("SINGLE");
    const [written] = ctx.$store.game.turns[0].darts;
    expect(written.hitTargetNumber).toBe(20);
    expect(written.hitZoneKey).toBe("TREBLE");
    expect(written.score).toBe(60);
  });

  it("records the bull and downgrades a treble-ring bull", async () => {
    const ctx = await started();
    await ctx.recordBull();
    ctx.setRing("TREBLE");
    await ctx.recordBull();
    const [first, second] = ctx.$store.game.turns[0].darts;
    expect(first.hitZoneKey).toBe("OUTER_BULL");
    expect(second.hitZoneKey).toBe("OUTER_BULL");
  });

  it("MISS records a MISS dart with score 0", async () => {
    const ctx = await started();
    await ctx.recordMiss();
    const [missed] = ctx.$store.game.turns[0].darts;
    expect(missed.hitZoneKey).toBe("MISS");
    expect(missed.hitTargetNumber).toBeNull();
    expect(missed.score).toBe(0);
  });

  it("shows the open visit's running sum for the active seat", async () => {
    const ctx = await started();
    expect(ctx.visitLabel()).toBe("—");
    await throwAll(ctx, [s(20), s(20)]);
    expect(ctx.visitLabel()).toBe("40");
    expect(ctx.visitLabelFor("p2")).toBe("—");
    expect(ctx.totalLabel()).toBe("0");
  });

  it("labels the last visit: score, zero, void, bust", async () => {
    const ctx = await started();
    expect(ctx.lastLabelFor("p1")).toBe("—");
    await throwAll(ctx, [s(20), s(20), s(5)]);
    expect(ctx.lastLabelFor("p1")).toBe("+9");
    expect(ctx.totalLabelFor("p1")).toBe("9");
    await throwAll(ctx, [s(1), s(1), s(1)]);
    expect(ctx.lastLabelFor("p2")).toBe("0");
    await throwAll(ctx, [s(20), s(20), miss]);
    expect(ctx.lastLabelFor("p1")).toBe("Void");
    expect(ctx.totalLabelFor("p1")).toBe("9");
  });

  it("labels a visit past 51 as a bust", async () => {
    const ctx = await started();
    const quiet = [miss, miss, miss];
    await throwAll(ctx, [
      ...P1_AT_36,
      t(20),
      s(5),
      s(5),
      ...quiet,
      t(20),
      t(20),
      t(20),
    ]);
    expect(ctx.totalLabelFor("p1")).toBe("50");
    expect(ctx.lastLabelFor("p1")).toBe("Bust");
  });

  it("marks on-board darts as hits and a miss as a miss in the preview", async () => {
    const ctx = await started();
    await throwAll(ctx, [s(20), miss]);
    expect(ctx.previewSegments().map((segment) => segment.status)).toEqual([
      "hit",
      "miss",
      "empty",
    ]);
  });

  it("never offers the bull visit", async () => {
    expect((await started()).isBullVisit()).toBe(false);
  });

  it("resumes mid-visit from the store's facts", async () => {
    const first = await started();
    await throwAll(first, [s(20), s(20), s(5), s(1)]);
    const resumed = await started({ turns: first.$store.game.turns });
    expect(resumed.state()?.activeParticipantRef).toBe("p2");
    expect(resumed.totalLabelFor("p1")).toBe("9");
    expect(resumed.visitLabelFor("p2")).toBe("1");
    expect(resumed.finished).toBe(false);
  });

  it("ends the leg at exactly 51 and stores the results", async () => {
    const ctx = await started();
    await throwAll(ctx, [...P1_AT_36, t(15), s(20), s(10)]);
    expect(ctx.finished).toBe(true);
    expect(completeSession).toHaveBeenCalledWith("s1", "COMPLETED");
    const finalState = ctx.state()!;
    expect(ctx.resultsSnapshot).toEqual({
      status: "COMPLETE",
      winningSideKey: "A",
      seats: finalState.seats.map(fivesSeatResult),
    });
    expect(ctx.resultsSnapshot?.seats[0]).toMatchObject({
      total: 51,
      visits: 2,
      scoringVisits: 2,
      voids: 0,
      busts: 0,
    });
    expect(ctx.resultsTitle()).toBe("You wins!");
  });

  it("titles an unfinished session generically", () => {
    expect(makeContext().resultsTitle()).toBe("Session complete");
  });

  it("undoing a dart takes it back off the open visit", async () => {
    const ctx = await started();
    await throwAll(ctx, [s(20), s(20)]);
    await ctx.undoVisit();
    expect(ctx.visitLabel()).toBe("20");
  });
});

describe("fivesPlay play again", () => {
  it("seats the guest first when the guest starts", async () => {
    const player = { ...SEATS[0], sideKey: "A" };
    const guest = { ...SEATS[1], sideKey: "B" };
    vi.mocked(createSession).mockResolvedValue({
      sessionId: "s2",
      participants: [guest, player],
    } as never);
    const ctx = await started();
    ctx.playAgainStarter = 1;
    await ctx.playAgain();
    const call = vi.mocked(createSession).mock.calls[0][0] as never as {
      rulesetVersionKey: string;
      participants: { participantTypeKey: string }[];
    };
    expect(call.rulesetVersionKey).toBe("FIVES_V1");
    expect(call.participants.map((p) => p.participantTypeKey)).toEqual([
      "GUEST",
      "PLAYER",
    ]);
  });
});

describe("fives active-seat accessors", () => {
  const pairs = [
    ["totalLabel", "totalLabelFor"],
    ["visitLabel", "visitLabelFor"],
    ["lastLabel", "lastLabelFor"],
  ] as const;

  it.each(pairs)("%s() is blank before state exists", (name, forName) => {
    const play = makeContext();
    vi.spyOn(play, "state").mockReturnValue(null);
    const read = vi.spyOn(play, forName);
    expect(play[name]()).toBe("");
    expect(read).not.toHaveBeenCalled();
  });

  it.each(pairs)("%s() reads %s for the active seat", (name, forName) => {
    const play = makeContext();
    vi.spyOn(play, "state").mockReturnValue({
      activeParticipantRef: "seat-active",
    } as never);
    const read = vi.spyOn(play, forName).mockReturnValue("from-seat");
    expect(play[name]()).toBe("from-seat");
    expect(read).toHaveBeenCalledWith("seat-active");
  });

  it.each(["totalLabelFor", "visitLabelFor", "lastLabelFor"] as const)(
    "%s is blank for an unknown seat",
    async (name) => {
      const play = await started();
      expect(play[name]("nobody")).toBe("");
    },
  );
});

describe("fives resume", () => {
  it("init builds the engine for its own key and none for another game's", async () => {
    const own = await started();
    expect(own.engine).not.toBeNull();
    const foreign = makeContext({ rulesetVersionKey: "TUOD_V1" });
    await foreign.init.call(foreign);
    expect(foreign.engine).toBeNull();
  });
});

describe("fivesPlay shape", () => {
  it("keeps its keys, in order", () => {
    expect(shapeOf(fivesPlay())).toMatchInlineSnapshot(`
      [
        "loading",
        "error",
        "finished",
        "hasActiveSession",
        "loadingReconciliation",
        "reconciliationFailed",
        "completionStatus",
        "completionError",
        "playAgainError",
        "playAgainLoading",
        "resultsSnapshot",
        "hiddenTurnKey",
        "hiddenTimer",
        "engine",
        "starterOpen",
        "playAgainStarter",
        "requestPlayAgain()",
        "playAgainStarterOptions()",
        "input",
        "board",
        "pointerX",
        "pointerY",
        "syncBoard()",
        "magnifierAnchor()",
        "magnifierBox()",
        "magnifierBoard()",
        "magnifierRead()",
        "onPointerDown()",
        "onPointerMove()",
        "onPointerUp()",
        "onPointerCancel()",
        "recordUnseen()",
        "visitMarkers()",
        "init()",
        "recordDart()",
        "commitDart()",
        "undoVisit()",
        "back()",
        "retryReconciliation()",
        "abandonAndExit()",
        "ring",
        "state()",
        "subtitle()",
        "totalLabelFor()",
        "totalLabel()",
        "visitLabelFor()",
        "visitLabel()",
        "lastLabelFor()",
        "lastLabel()",
        "isBullVisit()",
        "previewSegments()",
        "setRing()",
        "recordNumber()",
        "recordBull()",
        "recordMiss()",
        "uploadAndCompleteSession()",
        "resultsTitle()",
        "playAgain()",
      ]
    `);
  });
});
