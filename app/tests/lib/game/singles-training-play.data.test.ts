import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

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
import { singlesTrainingEngineFactory } from "@modules/game/singles-training.engine.module";
import { singlesTrainingPlay } from "@lib/game/singles-training-play.data";
import type {
  SinglesSnapshot,
  Seated,
  SinglesTrainingPlayContext,
} from "@lib/types";
import type { DartFact, StageFact, TurnFact } from "@modules/types";

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
  gameTypeKey: "SINGLES_TRAINING",
  gameTypeName: "Singles Training",
  captureModeKey: "RECREATIONAL",
  inputModeKey: "DETAILED_DARTS",
  rulesetVersionKey: "SINGLES_V1",
  startedAt: "now",
} as const;

const STAGE: StageFact = {
  clientKey: "block-1",
  stageTypeKey: "EXERCISE_BLOCK",
  parentClientKey: null,
  sequence: 1,
};

function defaultConfig(): Seated<SinglesSnapshot> {
  return {
    orderMode: "LOW_TO_HIGH",
    targetOrder: [
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 25,
    ],
    difficulty: "EASY",
    pointsSingle: 1,
    pointsDouble: 2,
    pointsTreble: 3,
    seats: SEATS,
  };
}

/** `n` prior turns (targets 1..n), each 3 SINGLE hits, so a fresh engine
 * rehydrated from it starts exactly at target `n + 1` (or BULL when n = 20),
 * in progress. */
function priorTurnsThroughNumber(n: number): TurnFact[] {
  const turns: TurnFact[] = [];
  for (let number = 1; number <= n; number += 1) {
    const darts: DartFact[] = [1, 2, 3].map((seq) => ({
      sequence: seq,
      intendedTargetNumber: null,
      intendedZoneKey: null,
      hitTargetNumber: number,
      hitZoneKey: "SINGLE",
      score: number,
      locationX: null,
      locationY: null,
    }));
    turns.push({
      clientKey: `prior-${number}`,
      stageClientKey: "block-1",
      participantRef: "participant-1",
      sequence: number,
      completedAt: "2026-08-01T10:00:00.000Z",
      totalScore: darts.reduce((sum, d) => sum + d.score, 0),
      darts,
    });
  }
  return turns;
}

type GameStub = SinglesTrainingPlayContext["$store"]["game"];

function gameStub(overrides: Partial<GameStub> = {}): GameStub {
  return {
    get seats() {
      return this.configSnapshot?.seats ?? [];
    },
    rulesetVersionKey: "SINGLES_V1",
    sessionId: "s1",
    templateRef: "tpl-1",
    configSnapshot: defaultConfig(),
    captureModeKey: "RECREATIONAL",
    inputModeKey: "DETAILED_DARTS",
    stages: [STAGE],
    turns: [],
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

type SettingsStub = { captureModeKey: string; inputModeKey: string };

function settingsStub(overrides: Partial<SettingsStub> = {}): SettingsStub {
  return {
    captureModeKey: "RECREATIONAL",
    inputModeKey: "DETAILED_DARTS",
    ...overrides,
  };
}

function makePlay(
  gameOverrides: Partial<GameStub> = {},
  settingsOverrides: Partial<SettingsStub> = {},
) {
  return {
    ...singlesTrainingPlay(),
    $store: {
      game: gameStub(gameOverrides),
      settings: settingsStub(settingsOverrides),
    },
  } as SinglesTrainingPlayContext;
}

beforeEach(() => {
  vi.clearAllMocks();
  resetEngineRegistry();
  registerEngineFactory(singlesTrainingEngineFactory);
  vi.mocked(fetchActiveSessions).mockResolvedValue([{ ...ACTIVE_SESSION }]);
});

describe("init", () => {
  it("resumes the engine and mirrors its facts into the store on a match", async () => {
    const play = makePlay();
    await play.init.call(play);
    expect(play.hasActiveSession).toBe(true);
    expect(play.engine).not.toBeNull();
  });

  it("leaves hasActiveSession false when there is no server session for this game", async () => {
    vi.mocked(fetchActiveSessions).mockResolvedValue([]);
    const play = makePlay();
    await play.init.call(play);
    expect(play.hasActiveSession).toBe(false);
    expect(play.engine).toBeNull();
  });

  it("blocks with reconciliationFailed when auto-abandoning a mismatched session fails", async () => {
    vi.mocked(fetchActiveSessions).mockResolvedValue([
      { ...ACTIVE_SESSION, sessionId: "other" },
    ]);
    vi.mocked(completeSession).mockRejectedValue(new Error("boom"));
    const play = makePlay({ sessionId: "s1" });
    await play.init.call(play);
    expect(play.reconciliationFailed).toBe(true);
    expect(play.hasActiveSession).toBe(false);
  });

  it("resuming an already-terminal engine finishes the session instead of leaving it silently playable", async () => {
    vi.mocked(appendBatch).mockResolvedValue({
      created: { stages: 1, turns: 1, darts: 3 },
    });
    vi.mocked(completeSession).mockResolvedValue({
      sessionId: "s1",
      statusKey: "COMPLETED",
      completedAt: "now",
    });
    const bullDarts: DartFact[] = [1, 2, 3].map((seq) => ({
      sequence: seq,
      intendedTargetNumber: null,
      intendedZoneKey: null,
      hitTargetNumber: 25,
      hitZoneKey: "OUTER_BULL",
      score: 25,
      locationX: null,
      locationY: null,
    }));
    const turns = [
      ...priorTurnsThroughNumber(20),
      {
        clientKey: "prior-bull",
        stageClientKey: "block-1",
        participantRef: "participant-1",
        sequence: 21,
        completedAt: "2026-08-01T10:00:00.000Z",
        totalScore: 75,
        darts: bullDarts,
      },
    ];
    const play = makePlay({ turns });

    await play.init.call(play);

    expect(play.finished).toBe(true);
    expect(play.completionStatus).toBe("succeeded");
    expect(completeSession).toHaveBeenCalledWith("s1", "COMPLETED");
  });
});

describe("singlesTrainingPlay — per-seat accessors", () => {
  it("currentPointsFor reads the named seat", () => {
    const ctx = singlesTrainingPlay() as unknown as {
      engine: {
        state: () => {
          activeParticipantRef: string;
          seats: { participantRef: string; totalPoints: number }[];
        };
      };
      currentPointsFor: (seatRef: string) => string;
    };
    ctx.engine = {
      state: () => ({
        activeParticipantRef: "p1",
        seats: [
          { participantRef: "p1", totalPoints: 5 },
          { participantRef: "p2", totalPoints: 30 },
        ],
      }),
    };
    expect(ctx.currentPointsFor("p2")).toBe("30");
  });
});

describe("currentTargetLabel / currentPoints / isBullVisit", () => {
  it("starts at target 1 with zero points, not the bull visit", async () => {
    const play = makePlay();
    await play.init.call(play);
    expect(play.currentTargetLabel.call(play)).toBe("1");
    expect(play.currentPoints.call(play)).toBe("0");
    expect(play.isBullVisit.call(play)).toBe(false);
  });

  it("shows target 20 after 19 cleared targets", async () => {
    const play = makePlay({ turns: priorTurnsThroughNumber(19) });
    await play.init.call(play);
    expect(play.currentTargetLabel.call(play)).toBe("20");
    expect(play.isBullVisit.call(play)).toBe(false);
  });

  it("shows BULL and isBullVisit true after 20 cleared targets", async () => {
    const play = makePlay({ turns: priorTurnsThroughNumber(20) });
    await play.init.call(play);
    expect(play.currentTargetLabel.call(play)).toBe("BULL");
    expect(play.isBullVisit.call(play)).toBe(true);
  });

  it("shows BULL first under a HIGH_TO_LOW order, not target 1", async () => {
    const play = makePlay({
      configSnapshot: {
        ...defaultConfig(),
        orderMode: "HIGH_TO_LOW",
        targetOrder: [
          25, 20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3,
          2, 1,
        ],
      },
    });
    await play.init.call(play);
    expect(play.currentTargetLabel.call(play)).toBe("BULL");
    expect(play.isBullVisit.call(play)).toBe(true);
  });
});

describe("recordTap on a number target", () => {
  it("SINGLE adds 1 point and records a SINGLE dart on the current target", async () => {
    const play = makePlay();
    await play.init.call(play);

    await play.recordTap.call(play, "SINGLE");

    expect(play.currentPoints.call(play)).toBe("1");
    const dart = play.$store.game.turns[0].darts[0];
    expect(dart.hitTargetNumber).toBe(1);
    expect(dart.hitZoneKey).toBe("SINGLE");
    expect(dart.intendedTargetNumber).toBeNull();
    expect(dart.intendedZoneKey).toBeNull();
  });

  it("DOUBLE adds 2 points, TREBLE adds 3, MISS adds 0", async () => {
    const play = makePlay();
    await play.init.call(play);

    await play.recordTap.call(play, "DOUBLE");
    expect(play.currentPoints.call(play)).toBe("2");

    await play.recordTap.call(play, "TREBLE");
    expect(play.currentPoints.call(play)).toBe("5");

    await play.recordTap.call(play, "MISS");
    expect(play.currentPoints.call(play)).toBe("5");
    expect(play.$store.game.turns[0].darts[2].hitZoneKey).toBe("MISS");
    expect(play.$store.game.turns[0].darts[2].hitTargetNumber).toBeNull();
  });

  it("a resolved 3-dart visit advances to the next target", async () => {
    const play = makePlay();
    await play.init.call(play);

    await play.recordTap.call(play, "SINGLE");
    await play.recordTap.call(play, "SINGLE");
    await play.recordTap.call(play, "SINGLE");

    expect(play.currentTargetLabel.call(play)).toBe("2");
    expect(play.currentPoints.call(play)).toBe("3");
  });
});

describe("recordTap on the BULL visit", () => {
  it("SINGLE records OUTER_BULL for pointsSingle, DOUBLE records INNER_BULL for pointsDouble", async () => {
    const play = makePlay({ turns: priorTurnsThroughNumber(20) });
    await play.init.call(play);

    await play.recordTap.call(play, "SINGLE");
    expect(play.currentPoints.call(play)).toBe("61"); // 60 prior + 1
    let dart = play.$store.game.turns[20].darts[0];
    expect(dart.hitTargetNumber).toBe(25);
    expect(dart.hitZoneKey).toBe("OUTER_BULL");

    await play.recordTap.call(play, "DOUBLE");
    expect(play.currentPoints.call(play)).toBe("63"); // + 2
    dart = play.$store.game.turns[20].darts[1];
    expect(dart.hitTargetNumber).toBe(25);
    expect(dart.hitZoneKey).toBe("INNER_BULL");
  });

  it("MISS on the BULL visit records a bare MISS, not a bull ring", async () => {
    const play = makePlay({ turns: priorTurnsThroughNumber(20) });
    await play.init.call(play);

    await play.recordTap.call(play, "MISS");

    const dart = play.$store.game.turns[20].darts[0];
    expect(dart.hitTargetNumber).toBeNull();
    expect(dart.hitZoneKey).toBe("MISS");
    expect(dart.locationX).toBeNull();
    expect(dart.locationY).toBeNull();
  });

  it("TREBLE is rejected as a no-op instead of silently recording INNER_BULL", async () => {
    const play = makePlay({ turns: priorTurnsThroughNumber(20) });
    await play.init.call(play);

    await play.recordTap.call(play, "TREBLE");

    expect(play.currentPoints.call(play)).toBe("60"); // unchanged
    expect(play.$store.game.turns).toHaveLength(20); // no new turn opened
  });

  it("the BULL visit's 3rd dart completes the session and captures the final points total", async () => {
    vi.mocked(appendBatch).mockResolvedValue({
      created: { stages: 1, turns: 1, darts: 3 },
    });
    vi.mocked(completeSession).mockResolvedValue({
      sessionId: "s1",
      statusKey: "COMPLETED",
      completedAt: "now",
    });
    const play = makePlay({ turns: priorTurnsThroughNumber(20) });
    await play.init.call(play);

    await play.recordTap.call(play, "SINGLE");
    await play.recordTap.call(play, "DOUBLE");
    await play.recordTap.call(play, "MISS");

    expect(play.finished).toBe(true);
    expect(completeSession).toHaveBeenCalledWith("s1", "COMPLETED");
    expect(play.resultsSnapshot).toEqual({
      points: 63, // 60 + 1 + 2 + 0
      misses: 1,
      singles: 61, // 60 prior number-target singles + 1 OUTER_BULL
      doubles: 1, // 1 INNER_BULL
      trebles: 0,
      hitPercentage: "98.41%", // (62/63 * 100).toFixed(2)
      winningSideKey: null,
      status: "COMPLETE",
    });
    expect(play.completionStatus).toBe("succeeded");
  });
});

describe("undoVisit", () => {
  it("reverts the last dart, restoring the prior points total", async () => {
    const play = makePlay();
    await play.init.call(play);
    await play.recordTap.call(play, "TREBLE");

    play.undoVisit.call(play);

    expect(play.currentPoints.call(play)).toBe("0");
    expect(play.$store.game.turns).toHaveLength(0);
  });

  it("clears hiddenTurnKey set by a resolved visit", async () => {
    vi.useFakeTimers();
    const play = makePlay();
    await play.init.call(play);
    await play.recordTap.call(play, "SINGLE");
    await play.recordTap.call(play, "SINGLE");
    await play.recordTap.call(play, "SINGLE");
    vi.advanceTimersByTime(1500);
    expect(play.hiddenTurnKey).not.toBeNull();

    play.undoVisit.call(play);

    expect(play.hiddenTurnKey).toBeNull();
    vi.useRealTimers();
  });
});

describe("previewSegments", () => {
  it("returns empty placeholders when the engine is null, instead of throwing", async () => {
    // Stale/foreign fact log: more turns than the numbers path has targets
    // for, so previewSegmentsFor's targetAt(numbersPath(), turns.length - 1)
    // would throw "No target at index N" for N > 20 if not guarded.
    const play = makePlay({ turns: priorTurnsThroughNumber(25) });
    expect(play.engine).toBeNull();
    expect(() => play.previewSegments.call(play)).not.toThrow();
    expect(play.previewSegments.call(play)).toEqual([
      { status: "empty" },
      { status: "empty" },
      { status: "empty" },
    ]);
  });

  it("returns empty placeholders before any dart is thrown this visit", async () => {
    const play = makePlay();
    await play.init.call(play);
    expect(play.previewSegments.call(play)).toEqual([
      { status: "empty" },
      { status: "empty" },
      { status: "empty" },
    ]);
  });

  it("reflects hit/miss by training points for darts thrown so far, placeholders for the rest", async () => {
    const play = makePlay();
    await play.init.call(play);
    await play.recordTap.call(play, "SINGLE");
    await play.recordTap.call(play, "MISS");

    expect(play.previewSegments.call(play)).toEqual([
      { status: "hit" },
      { status: "miss" },
      { status: "empty" },
    ]);
  });

  it("marks a dart that scores board points on a different number as a miss, not a hit", async () => {
    const play = makePlay();
    await play.init.call(play);

    await play.commitDart.call(play, {
      hitTargetNumber: 5,
      hitZoneKey: "SINGLE",
      locationX: null,
      locationY: null,
    });

    expect(play.previewSegments.call(play)).toEqual([
      { status: "miss" },
      { status: "empty" },
      { status: "empty" },
    ]);
  });
});

describe("previewSegments — reveal-then-clear timer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps all 3 darts visible for 1.5s after the visit resolves, then clears", async () => {
    const play = makePlay();
    await play.init.call(play);

    await play.recordTap.call(play, "SINGLE");
    await play.recordTap.call(play, "MISS");
    await play.recordTap.call(play, "MISS");

    expect(play.previewSegments.call(play)).toEqual([
      { status: "hit" },
      { status: "miss" },
      { status: "miss" },
    ]);

    vi.advanceTimersByTime(1500);

    expect(play.previewSegments.call(play)).toEqual([
      { status: "empty" },
      { status: "empty" },
      { status: "empty" },
    ]);
  });
});

describe("missCount / singleCount / doubleCount / trebleCount", () => {
  it("counts zero for every category before any dart is thrown", async () => {
    const play = makePlay();
    await play.init.call(play);

    expect(play.missCount.call(play)).toBe("0");
    expect(play.singleCount.call(play)).toBe("0");
    expect(play.doubleCount.call(play)).toBe("0");
    expect(play.trebleCount.call(play)).toBe("0");
  });

  it("classifies number-target hits by zone and misses separately", async () => {
    const play = makePlay();
    await play.init.call(play);

    await play.recordTap.call(play, "SINGLE");
    await play.recordTap.call(play, "DOUBLE");
    await play.recordTap.call(play, "TREBLE");

    expect(play.singleCount.call(play)).toBe("1");
    expect(play.doubleCount.call(play)).toBe("1");
    expect(play.trebleCount.call(play)).toBe("1");
    expect(play.missCount.call(play)).toBe("0");
  });

  it("counts bull Bull/Bullseye hits toward singles/doubles, alongside 60 prior number-target singles", async () => {
    vi.mocked(appendBatch).mockResolvedValue({
      created: { stages: 1, turns: 1, darts: 3 },
    });
    vi.mocked(completeSession).mockResolvedValue({
      sessionId: "s1",
      statusKey: "COMPLETED",
      completedAt: "now",
    });
    const play = makePlay({ turns: priorTurnsThroughNumber(20) });
    await play.init.call(play);

    await play.recordTap.call(play, "SINGLE");
    await play.recordTap.call(play, "DOUBLE");
    await play.recordTap.call(play, "MISS");

    expect(play.singleCount.call(play)).toBe("61");
    expect(play.doubleCount.call(play)).toBe("1");
    expect(play.missCount.call(play)).toBe("1");
    expect(play.trebleCount.call(play)).toBe("0");
  });

  it("sums the four counters to the total darts thrown so far", async () => {
    const play = makePlay();
    await play.init.call(play);

    await play.recordTap.call(play, "SINGLE");
    await play.recordTap.call(play, "MISS");

    const total =
      Number(play.missCount.call(play)) +
      Number(play.singleCount.call(play)) +
      Number(play.doubleCount.call(play)) +
      Number(play.trebleCount.call(play));
    expect(total).toBe(2);
  });
});

describe("completion", () => {
  it("marks completionStatus failed on a real upload error", async () => {
    vi.mocked(appendBatch).mockRejectedValue(new Error("network down"));
    const play = makePlay();
    await play.init.call(play);

    await play.uploadAndCompleteSession.call(play);

    expect(play.completionStatus).toBe("failed");
    expect(play.completionError).toBe(
      "Could not save your game. Check your connection and retry.",
    );
  });

  it("treats SESSION_ALREADY_COMPLETED as success", async () => {
    vi.mocked(appendBatch).mockResolvedValue({
      created: { stages: 1, turns: 0, darts: 0 },
    });
    vi.mocked(completeSession).mockRejectedValue({
      code: "SESSION_ALREADY_COMPLETED",
    });
    const play = makePlay();
    await play.init.call(play);

    await play.uploadAndCompleteSession.call(play);

    expect(play.completionStatus).toBe("succeeded");
  });

  it("captures a zero-darts session as a 0% hit percentage, not NaN or division by zero", async () => {
    vi.mocked(appendBatch).mockResolvedValue({
      created: { stages: 0, turns: 0, darts: 0 },
    });
    vi.mocked(completeSession).mockResolvedValue({
      sessionId: "s1",
      statusKey: "COMPLETED",
      completedAt: "now",
    });
    const play = makePlay();
    await play.init.call(play);

    await play.uploadAndCompleteSession.call(play);

    expect(play.resultsSnapshot).toEqual({
      points: 0,
      misses: 0,
      singles: 0,
      doubles: 0,
      trebles: 0,
      hitPercentage: "0.00%",
      winningSideKey: null,
      status: "COMPLETE",
    });
  });
});

describe("completion — 1v1", () => {
  const TWO_SEATS = [
    {
      participantRef: "participant-1",
      displayName: "Levi",
      sideKey: "A",
      participantTypeKey: "PLAYER" as const,
    },
    {
      participantRef: "participant-2",
      displayName: "Opponent",
      sideKey: "B",
      participantTypeKey: "GUEST" as const,
    },
  ];

  function twoSeatConfig(): Seated<SinglesSnapshot> {
    return { ...defaultConfig(), seats: TWO_SEATS };
  }

  it("marks status TIE, with winningSideKey null, when both seats total the same points", async () => {
    vi.mocked(appendBatch).mockResolvedValue({
      created: { stages: 21, turns: 42, darts: 126 },
    });
    vi.mocked(completeSession).mockResolvedValue({
      sessionId: "s1",
      statusKey: "COMPLETED",
      completedAt: "now",
    });
    const play = makePlay({ configSnapshot: twoSeatConfig() });
    await play.init.call(play);

    // Both seats hit SINGLE on every dart of every one of the 21 targets, so
    // each totals the same training-point score — a genuine tie, not a solo
    // session, even though winningSideKey is null in both cases.
    for (let i = 0; i < 21 * 3 * 2; i += 1) {
      await play.recordTap.call(play, "SINGLE");
    }

    expect(play.finished).toBe(true);
    expect(play.completionStatus).toBe("succeeded");
    expect(play.resultsSnapshot?.status).toBe("TIE");
    expect(play.resultsSnapshot?.winningSideKey).toBeNull();
  });

  it("names the higher-scoring seat as winner and scopes stats to the owner (PLAYER) seat", async () => {
    vi.mocked(appendBatch).mockResolvedValue({
      created: { stages: 21, turns: 42, darts: 126 },
    });
    vi.mocked(completeSession).mockResolvedValue({
      sessionId: "s1",
      statusKey: "COMPLETED",
      completedAt: "now",
    });
    const play = makePlay({ configSnapshot: twoSeatConfig() });
    await play.init.call(play);

    // The rota alternates by whole visit: participant-1 (seat A, PLAYER)
    // throws first each round and hits DOUBLE every dart, participant-2
    // (seat B, GUEST) throws next and misses every dart — a decisive,
    // non-tied win for seat A across all 21 targets.
    for (let round = 0; round < 21; round += 1) {
      await play.recordTap.call(play, "DOUBLE");
      await play.recordTap.call(play, "DOUBLE");
      await play.recordTap.call(play, "DOUBLE");
      await play.recordTap.call(play, "MISS");
      await play.recordTap.call(play, "MISS");
      await play.recordTap.call(play, "MISS");
    }

    expect(play.finished).toBe(true);
    expect(play.completionStatus).toBe("succeeded");
    expect(play.resultsSnapshot?.status).toBe("COMPLETE");
    expect(play.resultsSnapshot?.winningSideKey).toBe("A");
    expect(play.resultsSnapshot?.points).toBeGreaterThan(0);
    expect(play.resultsSnapshot?.misses).toBe(0);
  });
});

describe("completion — HARD/EXTREME elimination", () => {
  it("solo: failing a visit under HARD finishes the session with status LOST", async () => {
    vi.mocked(appendBatch).mockResolvedValue({
      created: { stages: 1, turns: 1, darts: 3 },
    });
    vi.mocked(completeSession).mockResolvedValue({
      sessionId: "s1",
      statusKey: "COMPLETED",
      completedAt: "now",
    });
    const play = makePlay({
      configSnapshot: { ...defaultConfig(), difficulty: "HARD" },
    });
    await play.init.call(play);

    await play.recordTap.call(play, "MISS");
    await play.recordTap.call(play, "MISS");
    await play.recordTap.call(play, "MISS");

    expect(play.finished).toBe(true);
    expect(play.resultsSnapshot?.status).toBe("LOST");
    expect(play.resultsSnapshot?.winningSideKey).toBeNull();
  });

  it("1v1: the surviving seat's owner sees status WON when the opponent fails under HARD", async () => {
    vi.mocked(appendBatch).mockResolvedValue({
      created: { stages: 1, turns: 2, darts: 6 },
    });
    vi.mocked(completeSession).mockResolvedValue({
      sessionId: "s1",
      statusKey: "COMPLETED",
      completedAt: "now",
    });
    const play = makePlay({
      configSnapshot: {
        ...defaultConfig(),
        difficulty: "HARD",
        seats: [
          {
            participantRef: "participant-1",
            displayName: "Levi",
            sideKey: "A",
            participantTypeKey: "PLAYER" as const,
          },
          {
            participantRef: "participant-2",
            displayName: "Opponent",
            sideKey: "B",
            participantTypeKey: "GUEST" as const,
          },
        ],
      },
    });
    await play.init.call(play);

    await play.recordTap.call(play, "SINGLE"); // owner (A) hits, survives
    await play.recordTap.call(play, "SINGLE");
    await play.recordTap.call(play, "SINGLE");
    await play.recordTap.call(play, "MISS"); // opponent (B) fails
    await play.recordTap.call(play, "MISS");
    await play.recordTap.call(play, "MISS");

    expect(play.finished).toBe(true);
    expect(play.resultsSnapshot?.status).toBe("WON");
    expect(play.resultsSnapshot?.winningSideKey).toBe("A");
  });

  it("1v1: the failing seat's own owner sees status LOST", async () => {
    vi.mocked(appendBatch).mockResolvedValue({
      created: { stages: 1, turns: 1, darts: 3 },
    });
    vi.mocked(completeSession).mockResolvedValue({
      sessionId: "s1",
      statusKey: "COMPLETED",
      completedAt: "now",
    });
    const play = makePlay({
      configSnapshot: {
        ...defaultConfig(),
        difficulty: "HARD",
        seats: [
          {
            participantRef: "participant-1",
            displayName: "Levi",
            sideKey: "A",
            participantTypeKey: "PLAYER" as const,
          },
          {
            participantRef: "participant-2",
            displayName: "Opponent",
            sideKey: "B",
            participantTypeKey: "GUEST" as const,
          },
        ],
      },
    });
    await play.init.call(play);

    await play.recordTap.call(play, "MISS"); // owner (A) fails first
    await play.recordTap.call(play, "MISS");
    await play.recordTap.call(play, "MISS");

    expect(play.finished).toBe(true);
    expect(play.resultsSnapshot?.status).toBe("LOST");
  });
});

describe("back", () => {
  it("resets the store and navigates to /games", async () => {
    const locationSpy = { href: "" };
    vi.stubGlobal("location", locationSpy);
    const play = makePlay();

    await play.back.call(play);

    expect(play.$store.game.reset).toHaveBeenCalled();
    expect(locationSpy.href).toBe("/games");
  });
});

describe("abandonAndExit", () => {
  it("with turns: appendBatch then completeSession ABANDONED, reset, navigate", async () => {
    const locationSpy = { href: "" };
    vi.stubGlobal("location", locationSpy);
    vi.mocked(appendBatch).mockResolvedValue({
      created: { stages: 1, turns: 1, darts: 1 },
    });
    vi.mocked(completeSession).mockResolvedValue({
      sessionId: "s1",
      statusKey: "ABANDONED",
      completedAt: "now",
    });
    const play = makePlay({ turns: priorTurnsThroughNumber(20) });

    await play.abandonAndExit.call(play);

    expect(appendBatch).toHaveBeenCalledTimes(1);
    expect(completeSession).toHaveBeenCalledWith("s1", "ABANDONED");
    expect(play.$store.game.reset).toHaveBeenCalled();
    expect(locationSpy.href).toBe("/games");
  });

  it("with zero turns: skips the batch call entirely", async () => {
    const locationSpy = { href: "" };
    vi.stubGlobal("location", locationSpy);
    vi.mocked(completeSession).mockResolvedValue({
      sessionId: "s1",
      statusKey: "ABANDONED",
      completedAt: "now",
    });
    const play = makePlay({ turns: [] });

    await play.abandonAndExit.call(play);

    expect(appendBatch).not.toHaveBeenCalled();
    expect(completeSession).toHaveBeenCalledWith("s1", "ABANDONED");
  });
});

describe("playAgain", () => {
  it("starts a fresh session with the same order mode's resolved target order", async () => {
    const play = makePlay({ turns: priorTurnsThroughNumber(20) });
    play.completionStatus = "succeeded";
    play.finished = true;

    vi.mocked(createSession).mockResolvedValue({
      sessionId: "new-session",
      participants: [
        {
          ref: "new-participant",
          displayName: "Player",
          participantTypeKey: "PLAYER",
        },
      ],
    } as any);

    await play.playAgain.call(play);

    const ascending = [
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 25,
    ];
    expect(createSession).toHaveBeenCalledWith({
      gameTypeKey: "SINGLES_TRAINING",
      rulesetVersionKey: "SINGLES_V1",
      captureModeKey: "RECREATIONAL",
      inputModeKey: "DETAILED_DARTS",
      config: {
        source: "template",
        templateRef: "tpl-1",
        overrides: {
          order_mode: "LOW_TO_HIGH",
          target_order: ascending,
          difficulty: "EASY",
        },
      },
    });
    expect(play.$store.game.sessionId).toBe("new-session");
    expect(play.$store.game.turns).toEqual([]);
    expect(play.finished).toBe(false);
    expect(play.completionStatus).toBe("pending");
    expect(play.resultsSnapshot).toBeNull();
    expect(play.hasActiveSession).toBe(true);
  });

  it("mints a fresh shuffle for a RANDOM order mode, not the just-finished session's order", async () => {
    const play = makePlay({
      turns: priorTurnsThroughNumber(20),
      configSnapshot: {
        ...defaultConfig(),
        orderMode: "RANDOM",
        targetOrder: [
          25, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19,
          20,
        ],
      },
    });
    play.completionStatus = "succeeded";
    play.finished = true;
    vi.mocked(createSession).mockResolvedValue({
      sessionId: "new-session",
      participants: [
        {
          ref: "new-participant",
          displayName: "Player",
          participantTypeKey: "PLAYER",
        },
      ],
    } as any);

    await play.playAgain.call(play);

    const call = vi.mocked(createSession).mock.calls[0][0] as {
      config: { overrides: Record<string, unknown> };
    };
    expect(call.config.overrides.order_mode).toBe("RANDOM");
    const sentOrder = call.config.overrides.target_order as number[];
    expect(new Set(sentOrder)).toEqual(
      new Set([
        1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
        25,
      ]),
    );
  });

  it("surfaces an error and leaves the modal open when session creation fails", async () => {
    const play = makePlay();
    play.completionStatus = "succeeded";
    play.finished = true;
    vi.mocked(createSession).mockRejectedValue(new Error("boom"));

    await play.playAgain.call(play);

    expect(play.playAgainError).toBe(
      "Could not start a new session. Try again.",
    );
    expect(play.finished).toBe(true);
  });
});

describe("recordDart (board input)", () => {
  it("records a dart via the board path and mirrors it into the store", async () => {
    const play = makePlay({ inputModeKey: "VISUAL_BOARD" });
    await play.init.call(play);

    await play.recordDart.call(play, {
      hitTargetNumber: 1,
      hitZoneKey: "TREBLE",
      locationX: 5,
      locationY: -10,
    });

    const dart = play.$store.game.turns[0].darts[0];
    expect(dart.locationX).toBe(5);
    expect(dart.locationY).toBe(-10);
    expect(play.currentPoints.call(play)).toBe("3");
  });

  it("does nothing once finished", async () => {
    const play = makePlay({ turns: priorTurnsThroughNumber(20) });
    await play.init.call(play);
    await play.recordTap.call(play, "SINGLE");
    await play.recordTap.call(play, "SINGLE");
    await play.recordTap.call(play, "SINGLE");
    expect(play.finished).toBe(true);

    await play.recordDart.call(play, {
      hitTargetNumber: 25,
      hitZoneKey: "OUTER_BULL",
      locationX: 1,
      locationY: 1,
    });

    expect(play.$store.game.turns).toHaveLength(21);
  });
});

describe("reveal-then-clear under VISUAL_BOARD", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("hides the resolved visit's markers 1.5s after the 3rd dart", async () => {
    vi.mocked(fetchActiveSessions).mockResolvedValue([
      { ...ACTIVE_SESSION, inputModeKey: "VISUAL_BOARD" },
    ]);
    const play = makePlay({ inputModeKey: "VISUAL_BOARD" });
    await play.init.call(play);

    await play.recordDart.call(play, {
      hitTargetNumber: 1,
      hitZoneKey: "SINGLE",
      locationX: 1,
      locationY: 1,
    });
    await play.recordDart.call(play, {
      hitTargetNumber: 1,
      hitZoneKey: "SINGLE",
      locationX: 1,
      locationY: 1,
    });
    await play.recordDart.call(play, {
      hitTargetNumber: 1,
      hitZoneKey: "SINGLE",
      locationX: 1,
      locationY: 1,
    });

    const clientKey = play.$store.game.turns[0].clientKey;
    expect(play.hiddenTurnKey).toBeNull();
    expect(play.visitMarkers.call(play)).not.toEqual([]);

    vi.advanceTimersByTime(1500);

    expect(play.hiddenTurnKey).toBe(clientKey);
    expect(play.visitMarkers.call(play)).toEqual([]);
  });

  it("schedules the resolved visit's preview to hide 1.5s later under DETAILED_DARTS too", async () => {
    const play = makePlay({ inputModeKey: "DETAILED_DARTS" });
    await play.init.call(play);

    await play.recordTap.call(play, "SINGLE");
    await play.recordTap.call(play, "SINGLE");
    await play.recordTap.call(play, "SINGLE");

    const clientKey = play.$store.game.turns[0].clientKey;
    expect(play.hiddenTurnKey).toBeNull();
    expect(play.hiddenTimer).not.toBeNull();

    vi.advanceTimersByTime(1500);

    expect(play.hiddenTurnKey).toBe(clientKey);
  });

  it("undoVisit cancels a pending hide timer so a reopened visit stays visible", async () => {
    vi.mocked(fetchActiveSessions).mockResolvedValue([
      { ...ACTIVE_SESSION, inputModeKey: "VISUAL_BOARD" },
    ]);
    const play = makePlay({ inputModeKey: "VISUAL_BOARD" });
    await play.init.call(play);
    await play.recordDart.call(play, {
      hitTargetNumber: 1,
      hitZoneKey: "SINGLE",
      locationX: 1,
      locationY: 1,
    });
    await play.recordDart.call(play, {
      hitTargetNumber: 1,
      hitZoneKey: "SINGLE",
      locationX: 1,
      locationY: 1,
    });
    await play.recordDart.call(play, {
      hitTargetNumber: 1,
      hitZoneKey: "SINGLE",
      locationX: 1,
      locationY: 1,
    });

    vi.advanceTimersByTime(1000);
    play.undoVisit.call(play);
    vi.advanceTimersByTime(1000);

    expect(play.hiddenTurnKey).toBeNull();
  });
});
