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
import { baseballEngineFactory } from "@modules/game/baseball.engine.module";
import { baseballPlay, baseballSeatResult } from "@lib/game/baseball-play.data";
import type { BaseballPlayContext, BaseballSnapshot, Seated } from "@lib/types";
import type { StageFact, TurnFact } from "@modules/types";

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
  gameTypeKey: "BASEBALL",
  gameTypeName: "Baseball Darts",
  captureModeKey: "RECREATIONAL",
  inputModeKey: "DETAILED_DARTS",
  rulesetVersionKey: "BASEBALL_V1",
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

type GameStub = BaseballPlayContext["$store"]["game"];

function gameStub(overrides: Partial<GameStub> = {}): GameStub {
  return {
    get seats() {
      return this.configSnapshot?.seats ?? [];
    },
    rulesetVersionKey: "BASEBALL_V1",
    sessionId: "s1",
    templateRef: "tpl-1",
    configSnapshot: { seats: SEATS } as Seated<BaseballSnapshot>,
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
    ...baseballPlay(),
    $store: {
      game: gameStub(gameOverrides),
      settings: {
        captureModeKey: "RECREATIONAL",
        inputModeKey: "DETAILED_DARTS",
      },
    },
  } as BaseballPlayContext;
}

async function started(gameOverrides: Partial<GameStub> = {}) {
  const ctx = makeContext(gameOverrides);
  await ctx.init.call(ctx);
  return ctx;
}

beforeEach(() => {
  vi.clearAllMocks();
  resetEngineRegistry();
  registerEngineFactory(baseballEngineFactory);
  vi.mocked(fetchActiveSessions).mockResolvedValue([{ ...ACTIVE_SESSION }]);
});

describe("baseballPlay", () => {
  it("records S/D/T taps on the inning's number as runs", async () => {
    const ctx = await started();
    await ctx.recordTap("SINGLE");
    await ctx.recordTap("DOUBLE");
    await ctx.recordTap("TREBLE");
    expect(ctx.currentScore()).toBe("6");
    expect(ctx.currentTargetLabel()).toBe("2");
    expect(ctx.inningLabel()).toBe("2/9");
    const [written] = ctx.$store.game.turns[0].darts;
    expect(written.hitTargetNumber).toBe(1);
    expect(written.hitZoneKey).toBe("SINGLE");
  });

  it("counts MISS as a dart with no runs and no number", async () => {
    const ctx = await started();
    await ctx.recordTap("MISS");
    expect(ctx.currentScore()).toBe("0");
    expect(ctx.$store.game.turns[0].darts[0].hitTargetNumber).toBeNull();
  });

  it("marks darts off the inning's number as misses in the preview", async () => {
    const ctx = await started();
    await ctx.recordTap("TREBLE");
    await ctx.recordDart({
      hitTargetNumber: 20,
      hitZoneKey: "TREBLE",
      locationX: null,
      locationY: null,
    });
    expect(ctx.previewSegments().map((segment) => segment.status)).toEqual([
      "hit",
      "miss",
      "empty",
    ]);
  });

  it("never offers the bull keys", async () => {
    const ctx = await started();
    expect(ctx.isBullVisit()).toBe(false);
  });

  it("resumes mid-inning from the store's facts", async () => {
    const first = await started();
    await first.recordTap("TREBLE");
    await first.recordTap("TREBLE");
    await first.recordTap("TREBLE");
    await first.recordTap("DOUBLE");
    const resumed = await started({ turns: first.$store.game.turns });
    expect(resumed.currentScore()).toBe("11");
    expect(resumed.inningLabel()).toBe("2/9");
    expect(resumed.previewSegments().map((segment) => segment.status)).toEqual([
      "hit",
      "empty",
      "empty",
    ]);
  });

  it("reads the inning in the subtitle; blank before config loads", () => {
    expect(makeContext().subtitle()).toBe("INNING 1 OF 9");
    const empty = makeContext({ configSnapshot: null });
    expect(empty.subtitle()).toBe("");
  });

  it("abandonAndExit uploads the played darts, marks ABANDONED and leaves", async () => {
    const locationSpy = { href: "" };
    vi.stubGlobal("location", locationSpy);
    vi.mocked(appendBatch).mockResolvedValue({
      created: { stages: 1, turns: 1, darts: 2 },
    });
    vi.mocked(completeSession).mockResolvedValue({
      sessionId: "s1",
      statusKey: "ABANDONED",
      completedAt: "now",
    });
    const ctx = await started();
    await ctx.recordTap("SINGLE");
    await ctx.recordTap("MISS");

    await ctx.abandonAndExit();

    expect(ctx.error).toBe("");
    expect(appendBatch).toHaveBeenCalledTimes(1);
    expect(completeSession).toHaveBeenCalledWith("s1", "ABANDONED");
    expect(ctx.$store.game.reset).toHaveBeenCalled();
    expect(locationSpy.href).toBe("/games");
  });

  it("abandonAndExit with no darts skips the batch", async () => {
    const locationSpy = { href: "" };
    vi.stubGlobal("location", locationSpy);
    vi.mocked(completeSession).mockResolvedValue({
      sessionId: "s1",
      statusKey: "ABANDONED",
      completedAt: "now",
    });
    const ctx = await started();

    await ctx.abandonAndExit();

    expect(appendBatch).not.toHaveBeenCalled();
    expect(locationSpy.href).toBe("/games");
  });

  it("builds results with runs, accuracy, best inning and runs per inning", () => {
    const turns: TurnFact[] = [
      turnOf("t1", [
        [1, "TREBLE"],
        [1, "SINGLE"],
        [20, "TREBLE"],
      ]),
      turnOf("t2", [
        [2, "DOUBLE"],
        [null, "MISS"],
        [2, "SINGLE"],
      ]),
    ];
    const seat = {
      participantRef: "participant-1",
      sideKey: "A",
      targetIndex: 2,
      runs: 7,
      runsPerInning: [4, 3, 0, 0, 0, 0, 0, 0, 0],
      dartsThisVisit: 0,
      hitsThisVisit: 0,
      status: "IN_PROGRESS" as const,
    };
    expect(baseballSeatResult(seat, turns)).toEqual({
      participantRef: "participant-1",
      sideKey: "A",
      runs: 7,
      accuracy: "66.67%",
      bestInning: 1,
      runsPerInning: [4, 3, 0, 0, 0, 0, 0, 0, 0],
    });
  });
});

function turnOf(
  clientKey: string,
  darts: [number | null, "TREBLE" | "DOUBLE" | "SINGLE" | "MISS"][],
): TurnFact {
  return {
    clientKey,
    stageClientKey: "block-1",
    participantRef: "participant-1",
    sequence: Number(clientKey.slice(1)),
    totalScore: 0,
    completedAt: "now",
    darts: darts.map(([hitTargetNumber, hitZoneKey], i) => ({
      sequence: i + 1,
      intendedTargetNumber: null,
      intendedZoneKey: null,
      hitTargetNumber,
      hitZoneKey,
      score: 0,
      locationX: null,
      locationY: null,
    })),
  } as TurnFact;
}
