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
import {
  aceEngineFactory,
  aceTargetFor,
} from "@modules/game/ace.engine.module";
import { acePlay } from "@lib/game/ace-play.data";
import type { AcePlayContext, AceSnapshot, Seated } from "@lib/types";
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

const SNAPSHOT = {
  rounds: 3,
  drawSeed: 1,
  seats: SEATS,
} as Seated<AceSnapshot>;

const ACTIVE_SESSION = {
  sessionId: "s1",
  gameTypeKey: "ACE",
  gameTypeName: "Ace",
  captureModeKey: "RECREATIONAL",
  inputModeKey: "DETAILED_DARTS",
  rulesetVersionKey: "ACE_V1",
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

type GameStub = AcePlayContext["$store"]["game"];

function gameStub(overrides: Partial<GameStub> = {}): GameStub {
  return {
    get seats() {
      return this.configSnapshot?.seats ?? [];
    },
    rulesetVersionKey: "ACE_V1",
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
    ...acePlay(),
    $store: {
      game: gameStub(gameOverrides),
      settings: {
        captureModeKey: "RECREATIONAL",
        inputModeKey: "DETAILED_DARTS",
      },
    },
  } as AcePlayContext;
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

const miss = dart(null, "MISS");

function onTarget(round: number, ring: "SINGLE" | "DOUBLE" | "TREBLE") {
  const target = aceTargetFor(SNAPSHOT.drawSeed, round);
  return target === 25
    ? dart(25, ring === "SINGLE" ? "OUTER_BULL" : "INNER_BULL")
    : dart(target, ring);
}

function offTarget(round: number) {
  const target = aceTargetFor(SNAPSHOT.drawSeed, round);
  return dart(target === 1 ? 2 : 1, "OUTER_SINGLE");
}

async function throwAll(ctx: AcePlayContext, darts: DartObservation[]) {
  for (const observation of darts) await ctx.recordDart(observation);
}

const POINTS = { SINGLE: 1, DOUBLE: 2, TREBLE: 3 } as const;

function bullAware(round: number, ring: keyof typeof POINTS) {
  const target = aceTargetFor(SNAPSHOT.drawSeed, round);
  return target === 25 ? (ring === "SINGLE" ? 4 : 6) : POINTS[ring];
}

beforeEach(() => {
  vi.clearAllMocks();
  resetEngineRegistry();
  registerEngineFactory(aceEngineFactory);
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

describe("acePlay", () => {
  it("subtitles the active seat's round; blank before config loads", async () => {
    expect((await started()).subtitle()).toBe("Round 1 of 3");
    expect(makeContext({ configSnapshot: null }).subtitle()).toBe("");
  });

  it("shows the round's target on every seat and moves on per seat", async () => {
    const ctx = await started();
    const first = String(aceTargetFor(1, 0)).replace("25", "Bull");
    expect(ctx.targetLabel()).toBe(first);
    expect(ctx.targetLabelFor("p2")).toBe(first);
    await throwAll(ctx, [miss, miss, miss]);
    expect(ctx.targetLabelFor("p1")).toBe(
      String(aceTargetFor(1, 1)).replace("25", "Bull"),
    );
    expect(ctx.targetLabelFor("p2")).toBe(first);
    expect(ctx.targetLabelFor("nobody")).toBe("");
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
    expect(missed.score).toBe(0);
  });

  it("shows the open visit's Ace points for the active seat", async () => {
    const ctx = await started();
    expect(ctx.visitLabel()).toBe("—");
    await throwAll(ctx, [onTarget(0, "DOUBLE"), offTarget(0)]);
    expect(ctx.visitLabel()).toBe(String(bullAware(0, "DOUBLE")));
    expect(ctx.visitLabelFor("p2")).toBe("—");
    expect(ctx.totalLabel()).toBe("0");
    expect(ctx.visitLabelFor("nobody")).toBe("");
  });

  it("labels the last round and the total", async () => {
    const ctx = await started();
    expect(ctx.lastLabelFor("p1")).toBe("—");
    await throwAll(ctx, [onTarget(0, "TREBLE"), offTarget(0), miss]);
    const earned = bullAware(0, "TREBLE");
    expect(ctx.lastLabelFor("p1")).toBe(`+${earned}`);
    expect(ctx.totalLabelFor("p1")).toBe(String(earned));
    await throwAll(ctx, [miss, miss, miss]);
    expect(ctx.lastLabelFor("p2")).toBe("0");
    expect(ctx.lastLabel()).toBe(`+${earned}`);
    expect(ctx.lastLabelFor("nobody")).toBe("");
  });

  it("marks darts on the round's target as hits in the preview", async () => {
    const ctx = await started();
    await throwAll(ctx, [onTarget(0, "SINGLE"), offTarget(0)]);
    expect(ctx.previewSegments().map((segment) => segment.status)).toEqual([
      "hit",
      "miss",
      "empty",
    ]);
  });

  it("judges a later round's preview against that round's target", async () => {
    const ctx = await started();
    await throwAll(ctx, [miss, miss, miss, miss, miss, miss]);
    await throwAll(ctx, [onTarget(1, "SINGLE")]);
    expect(ctx.previewSegments()[0].status).toBe("hit");
  });

  it("never offers the bull visit", async () => {
    expect((await started()).isBullVisit()).toBe(false);
  });

  it("resumes mid-visit from the store's facts", async () => {
    const first = await started();
    await throwAll(first, [
      onTarget(0, "DOUBLE"),
      miss,
      miss,
      onTarget(0, "SINGLE"),
    ]);
    const resumed = await started({ turns: first.$store.game.turns });
    expect(resumed.state()?.activeParticipantRef).toBe("p2");
    expect(resumed.totalLabelFor("p1")).toBe(String(bullAware(0, "DOUBLE")));
    expect(resumed.visitLabelFor("p2")).toBe(String(bullAware(0, "SINGLE")));
    expect(resumed.finished).toBe(false);
  });

  it("ends after the last round, stores the results and names the winner", async () => {
    const ctx = await started();
    for (let round = 0; round < 3; round += 1) {
      await throwAll(ctx, [onTarget(round, "TREBLE"), miss, miss]);
      await throwAll(ctx, [miss, miss, miss]);
    }
    expect(ctx.finished).toBe(true);
    expect(completeSession).toHaveBeenCalledWith("s1", "COMPLETED");
    const snapshot = ctx.resultsSnapshot!;
    const expected = [0, 1, 2].reduce(
      (sum, round) => sum + bullAware(round, "TREBLE"),
      0,
    );
    expect(snapshot.status).toBe("COMPLETE");
    expect(snapshot.winningSideKey).toBe("A");
    expect(snapshot.seats[0]).toMatchObject({
      total: expected,
      scoringVisits: 3,
    });
    expect(snapshot.seats[1]).toMatchObject({ total: 0, bestRound: 0 });
    expect(snapshot.rounds).toHaveLength(3);
    expect(snapshot.rounds[0].target).toBe(aceTargetFor(1, 0));
    expect(ctx.resultsTitle()).toBe("You wins!");
    expect(ctx.roundRows()[0].label).toMatch(/^R1 · /);
    expect(ctx.roundRows()[0].points).toBe(`${bullAware(0, "TREBLE")} – 0`);
  });

  it("calls equal totals a shared win", async () => {
    const ctx = await started();
    for (let round = 0; round < 3; round += 1) {
      await throwAll(ctx, [miss, miss, miss, miss, miss, miss]);
    }
    expect(ctx.resultsSnapshot?.winningSideKey).toBeNull();
    expect(ctx.resultsTitle()).toBe("Shared win");
  });

  it("titles an unfinished session generically and has no rows", () => {
    const ctx = makeContext();
    expect(ctx.resultsTitle()).toBe("Session complete");
    expect(ctx.roundRows()).toEqual([]);
  });

  it("undoing a dart takes it back off the open visit", async () => {
    const ctx = await started();
    await throwAll(ctx, [onTarget(0, "SINGLE"), onTarget(0, "SINGLE")]);
    await ctx.undoVisit();
    expect(ctx.visitLabel()).toBe(String(bullAware(0, "SINGLE")));
  });
});

describe("acePlay play again", () => {
  it("seats the guest first and sends the rounds with a fresh draw seed", async () => {
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
      config: { overrides: { rounds: number; drawSeed: number } };
      participants: { participantTypeKey: string }[];
    };
    expect(call.rulesetVersionKey).toBe("ACE_V1");
    expect(call.config.overrides.rounds).toBe(3);
    expect(Number.isInteger(call.config.overrides.drawSeed)).toBe(true);
    expect(call.participants.map((p) => p.participantTypeKey)).toEqual([
      "GUEST",
      "PLAYER",
    ]);
    const next = ctx.$store.game.configSnapshot as unknown as {
      drawSeed: number;
    };
    expect(next.drawSeed).toBe(call.config.overrides.drawSeed);
  });
});

describe("ace active-seat accessors", () => {
  const pairs = [
    ["targetLabel", "targetLabelFor"],
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
});

describe("ace resume", () => {
  it("init builds the engine for its own key and none for another game's", async () => {
    const own = await started();
    expect(own.engine).not.toBeNull();
    const foreign = makeContext({ rulesetVersionKey: "TUOD_V1" });
    await foreign.init.call(foreign);
    expect(foreign.engine).toBeNull();
  });
});

describe("acePlay shape", () => {
  it("keeps its keys, in order", () => {
    expect(shapeOf(acePlay())).toMatchInlineSnapshot(`
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
        "targetLabelFor()",
        "targetLabel()",
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
        "roundRows()",
        "playAgain()",
      ]
    `);
  });
});
