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
import { shanghaiEngineFactory } from "@modules/game/shanghai.engine.module";
import { shanghaiPlay } from "@lib/game/shanghai-play.data";
import type { ShanghaiSnapshot, Seated, ShanghaiPlayContext } from "@lib/types";
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
  gameTypeKey: "SHANGHAI",
  gameTypeName: "Shanghai",
  captureModeKey: "RECREATIONAL",
  inputModeKey: "DETAILED_DARTS",
  rulesetVersionKey: "SHANGHAI_V1",
  startedAt: "now",
} as const;

const STAGE: StageFact = {
  clientKey: "block-1",
  stageTypeKey: "EXERCISE_BLOCK",
  parentClientKey: null,
  sequence: 1,
};

function defaultConfig(): Seated<ShanghaiSnapshot> {
  return { seats: SEATS };
}

/** `n` prior rounds (numbers 1..n), each 3 SINGLE hits, so a fresh engine
 * rehydrated from it starts exactly at round `n + 1`, in progress, with a
 * score of `3 * sum(1..n)` (three SINGLE hits per round, worth face value). */
function priorRoundsThroughNumber(n: number): TurnFact[] {
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
      completedAt: "2026-08-14T10:00:00.000Z",
      totalScore: darts.reduce((sum, d) => sum + d.score, 0),
      darts,
    });
  }
  return turns;
}

type GameStub = ShanghaiPlayContext["$store"]["game"];

function gameStub(overrides: Partial<GameStub> = {}): GameStub {
  return {
    get seats() {
      return this.configSnapshot?.seats ?? [];
    },
    rulesetVersionKey: "SHANGHAI_V1",
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
    ...shanghaiPlay(),
    $store: {
      game: gameStub(gameOverrides),
      settings: settingsStub(settingsOverrides),
    },
  } as ShanghaiPlayContext;
}

beforeEach(() => {
  vi.clearAllMocks();
  resetEngineRegistry();
  registerEngineFactory(shanghaiEngineFactory);
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
    const missDarts: DartFact[] = [1, 2, 3].map((seq) => ({
      sequence: seq,
      intendedTargetNumber: null,
      intendedZoneKey: null,
      hitTargetNumber: null,
      hitZoneKey: "MISS",
      score: 0,
      locationX: null,
      locationY: null,
    }));
    const turns = [
      ...priorRoundsThroughNumber(19),
      {
        clientKey: "prior-20",
        stageClientKey: "block-1",
        participantRef: "participant-1",
        sequence: 20,
        completedAt: "2026-08-14T10:00:00.000Z",
        totalScore: 0,
        darts: missDarts,
      },
    ];
    const play = makePlay({ turns });

    await play.init.call(play);

    expect(play.finished).toBe(true);
    expect(play.completionStatus).toBe("succeeded");
    expect(completeSession).toHaveBeenCalledWith("s1", "COMPLETED");
  });
});

describe("currentTargetLabel / roundLabel / currentScore / isBullVisit", () => {
  it("starts at round 1 with zero score, and isBullVisit is always false", async () => {
    const play = makePlay();
    await play.init.call(play);
    expect(play.currentTargetLabel.call(play)).toBe("1");
    expect(play.roundLabel.call(play)).toBe("1/20");
    expect(play.currentScore.call(play)).toBe("0");
    expect(play.isBullVisit.call(play)).toBe(false);
  });

  it("shows round 20 after 19 rounds cleared", async () => {
    const play = makePlay({ turns: priorRoundsThroughNumber(19) });
    await play.init.call(play);
    expect(play.currentTargetLabel.call(play)).toBe("20");
    expect(play.roundLabel.call(play)).toBe("20/20");
    expect(play.isBullVisit.call(play)).toBe(false);
  });
});

describe("recordTap", () => {
  it("SINGLE adds 1 point and records a SINGLE dart on the current round's number", async () => {
    const play = makePlay();
    await play.init.call(play);

    await play.recordTap.call(play, "SINGLE");

    expect(play.currentScore.call(play)).toBe("1");
    const dart = play.$store.game.turns[0].darts[0];
    expect(dart.hitTargetNumber).toBe(1);
    expect(dart.hitZoneKey).toBe("SINGLE");
    expect(dart.intendedTargetNumber).toBeNull();
    expect(dart.intendedZoneKey).toBeNull();
  });

  it("a 3-SINGLE visit advances to round 2 without a Shanghai", async () => {
    const play = makePlay();
    await play.init.call(play);

    await play.recordTap.call(play, "SINGLE");
    await play.recordTap.call(play, "SINGLE");
    await play.recordTap.call(play, "SINGLE");

    expect(play.currentTargetLabel.call(play)).toBe("2");
    expect(play.currentScore.call(play)).toBe("3");
    expect(play.finished).toBe(false);
  });

  it("SINGLE, DOUBLE, TREBLE in one visit wins instantly with a Shanghai", async () => {
    vi.mocked(appendBatch).mockResolvedValue({
      created: { stages: 1, turns: 1, darts: 3 },
    });
    vi.mocked(completeSession).mockResolvedValue({
      sessionId: "s1",
      statusKey: "COMPLETED",
      completedAt: "now",
    });
    const play = makePlay();
    await play.init.call(play);

    await play.recordTap.call(play, "SINGLE");
    await play.recordTap.call(play, "DOUBLE");
    await play.recordTap.call(play, "TREBLE");

    expect(play.finished).toBe(true);
    expect(play.resultsSnapshot).toEqual({
      status: "SHANGHAI",
      winningSideKey: "A",
      seats: [
        {
          participantRef: "participant-1",
          sideKey: "A",
          score: 6,
          round: 1,
          accuracy: "100%",
          trebles: 1,
          doubles: 1,
          singles: 1,
        },
      ],
    });
    expect(play.completionStatus).toBe("succeeded");
  });

  it("MISS adds 0 and still counts toward the 3-dart visit", async () => {
    const play = makePlay();
    await play.init.call(play);

    await play.recordTap.call(play, "MISS");

    expect(play.currentScore.call(play)).toBe("0");
    expect(play.$store.game.turns[0].darts[0].hitZoneKey).toBe("MISS");
    expect(play.$store.game.turns[0].darts[0].hitTargetNumber).toBeNull();
  });
});

describe("completion at round 20", () => {
  it("completes without a Shanghai after round 20's 3rd dart", async () => {
    vi.mocked(appendBatch).mockResolvedValue({
      created: { stages: 1, turns: 1, darts: 3 },
    });
    vi.mocked(completeSession).mockResolvedValue({
      sessionId: "s1",
      statusKey: "COMPLETED",
      completedAt: "now",
    });
    const play = makePlay({ turns: priorRoundsThroughNumber(19) });
    await play.init.call(play);

    await play.recordTap.call(play, "MISS");
    await play.recordTap.call(play, "MISS");
    await play.recordTap.call(play, "MISS");

    expect(play.finished).toBe(true);
    expect(play.resultsSnapshot).toEqual({
      status: "COMPLETE",
      winningSideKey: null,
      seats: [
        {
          participantRef: "participant-1",
          sideKey: "A",
          score: 3 * ((19 * 20) / 2),
          round: 20,
          accuracy: "95%",
          trebles: 0,
          doubles: 0,
          singles: 57,
        },
      ],
    });
  });

  it("reports SHANGHAI, not COMPLETE, when round 20 itself is a Shanghai", async () => {
    vi.mocked(appendBatch).mockResolvedValue({
      created: { stages: 1, turns: 1, darts: 3 },
    });
    vi.mocked(completeSession).mockResolvedValue({
      sessionId: "s1",
      statusKey: "COMPLETED",
      completedAt: "now",
    });
    const play = makePlay({ turns: priorRoundsThroughNumber(19) });
    await play.init.call(play);

    await play.recordTap.call(play, "SINGLE");
    await play.recordTap.call(play, "DOUBLE");
    await play.recordTap.call(play, "TREBLE");

    expect(play.resultsSnapshot).toEqual({
      status: "SHANGHAI",
      winningSideKey: "A",
      seats: [
        {
          participantRef: "participant-1",
          sideKey: "A",
          score: 3 * ((19 * 20) / 2) + 20 + 40 + 60,
          round: 20,
          accuracy: "100%",
          trebles: 1,
          doubles: 1,
          singles: 58,
        },
      ],
    });
  });
});

describe("shanghaiPlay — per-seat accessors", () => {
  it("currentScoreFor and roundLabelFor read the named seat", () => {
    const ctx = shanghaiPlay() as unknown as {
      engine: {
        state: () => {
          activeParticipantRef: string;
          seats: {
            participantRef: string;
            targetIndex: number;
            totalScore: number;
          }[];
        };
      };
      currentScoreFor: (seatRef: string) => string;
      roundLabelFor: (seatRef: string) => string;
    };
    ctx.engine = {
      state: () => ({
        activeParticipantRef: "p1",
        seats: [
          { participantRef: "p1", targetIndex: 0, totalScore: 10 },
          { participantRef: "p2", targetIndex: 4, totalScore: 40 },
        ],
      }),
    };
    expect(ctx.currentScoreFor("p2")).toBe("40");
    expect(ctx.roundLabelFor("p2")).toBe("5/20");
  });
});

describe("session completion — 1v1", () => {
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

  function twoSeatConfig(): Seated<ShanghaiSnapshot> {
    return { seats: TWO_SEATS };
  }

  it("ends the whole match instantly on either seat's Shanghai, naming that seat the winner", async () => {
    vi.mocked(appendBatch).mockResolvedValue({
      created: { stages: 1, turns: 1, darts: 3 },
    });
    vi.mocked(completeSession).mockResolvedValue({
      sessionId: "s1",
      statusKey: "COMPLETED",
      completedAt: "now",
    });
    const play = makePlay({ configSnapshot: twoSeatConfig() });
    await play.init.call(play);

    // Seat A throws first and hits a Shanghai on its own first visit, mid
    // round for seat B — the match ends immediately regardless.
    await play.recordTap.call(play, "SINGLE");
    await play.recordTap.call(play, "DOUBLE");
    await play.recordTap.call(play, "TREBLE");

    expect(play.finished).toBe(true);
    expect(play.completionStatus).toBe("succeeded");
    expect(play.resultsSnapshot).toEqual({
      status: "SHANGHAI",
      winningSideKey: "A",
      seats: [
        {
          participantRef: "participant-1",
          sideKey: "A",
          score: 6,
          round: 1,
          accuracy: "100%",
          trebles: 1,
          doubles: 1,
          singles: 1,
        },
        {
          participantRef: "participant-2",
          sideKey: "B",
          score: 0,
          round: 1,
          accuracy: "0%",
          trebles: 0,
          doubles: 0,
          singles: 0,
        },
      ],
    });
  });

  it("marks status TIE, with winningSideKey null, when both seats finish with the same score and no Shanghai", async () => {
    vi.mocked(appendBatch).mockResolvedValue({
      created: { stages: 40, turns: 40, darts: 120 },
    });
    vi.mocked(completeSession).mockResolvedValue({
      sessionId: "s1",
      statusKey: "COMPLETED",
      completedAt: "now",
    });
    const play = makePlay({ configSnapshot: twoSeatConfig() });
    await play.init.call(play);

    // Both seats miss every dart of all 20 rounds — a genuine 0-0 tie, not
    // a solo session, even though winningSideKey is null in both cases.
    for (let i = 0; i < 120; i += 1) {
      await play.recordTap.call(play, "MISS");
    }

    expect(play.finished).toBe(true);
    expect(play.completionStatus).toBe("succeeded");
    expect(play.resultsSnapshot?.status).toBe("TIE");
    expect(play.resultsSnapshot?.winningSideKey).toBeNull();
    expect(play.resultsSnapshot?.seats).toEqual([
      {
        participantRef: "participant-1",
        sideKey: "A",
        score: 0,
        round: 20,
        accuracy: "0%",
        trebles: 0,
        doubles: 0,
        singles: 0,
      },
      {
        participantRef: "participant-2",
        sideKey: "B",
        score: 0,
        round: 20,
        accuracy: "0%",
        trebles: 0,
        doubles: 0,
        singles: 0,
      },
    ]);
  });

  it("names the higher-scoring seat the winner once both complete all 20 rounds without a Shanghai", async () => {
    vi.mocked(appendBatch).mockResolvedValue({
      created: { stages: 40, turns: 40, darts: 120 },
    });
    vi.mocked(completeSession).mockResolvedValue({
      sessionId: "s1",
      statusKey: "COMPLETED",
      completedAt: "now",
    });
    const play = makePlay({ configSnapshot: twoSeatConfig() });
    await play.init.call(play);

    // Seat A scores a SINGLE on every dart of every round (never a Shanghai
    // — SINGLE alone never trips the single/double/treble check); seat B
    // misses every dart, so A's total strictly exceeds B's by the end.
    for (let round = 0; round < 20; round += 1) {
      await play.recordTap.call(play, "SINGLE");
      await play.recordTap.call(play, "SINGLE");
      await play.recordTap.call(play, "SINGLE");
      await play.recordTap.call(play, "MISS");
      await play.recordTap.call(play, "MISS");
      await play.recordTap.call(play, "MISS");
    }

    expect(play.finished).toBe(true);
    expect(play.completionStatus).toBe("succeeded");
    expect(play.resultsSnapshot?.status).toBe("COMPLETE");
    expect(play.resultsSnapshot?.winningSideKey).toBe("A");
    expect(play.resultsSnapshot?.seats).toEqual([
      {
        participantRef: "participant-1",
        sideKey: "A",
        score: 3 * ((20 * 21) / 2),
        round: 20,
        accuracy: "100%",
        trebles: 0,
        doubles: 0,
        singles: 60,
      },
      {
        participantRef: "participant-2",
        sideKey: "B",
        score: 0,
        round: 20,
        accuracy: "0%",
        trebles: 0,
        doubles: 0,
        singles: 0,
      },
    ]);
  });
});

describe("undoVisit", () => {
  it("reverts the last dart, restoring the prior score", async () => {
    const play = makePlay();
    await play.init.call(play);
    await play.recordTap.call(play, "TREBLE");

    play.undoVisit.call(play);

    expect(play.currentScore.call(play)).toBe("0");
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
  it("returns empty placeholders before any dart is thrown this visit", async () => {
    const play = makePlay();
    await play.init.call(play);
    expect(play.previewSegments.call(play)).toEqual([
      { status: "empty" },
      { status: "empty" },
      { status: "empty" },
    ]);
  });

  it("reflects hit/miss for darts thrown so far, placeholders for the rest", async () => {
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

  it("marks a dart that hits a different number as a miss, not a hit", async () => {
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

describe("previewSegments — 1v1 seat scoping", () => {
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

  function twoSeatConfig(): Seated<ShanghaiSnapshot> {
    return { seats: TWO_SEATS };
  }

  /** `n` closed rounds (numbers 1..n) for one named seat, each 3 SINGLE
   * hits — mirrors the file's own `priorRoundsThroughNumber`, parameterized
   * by seat so two seats' prior rounds can be interleaved in one `turns`
   * array. `sequence` is offset by `seqOffset` so two seats' turns never
   * collide on the same sequence number. */
  function priorRoundsFor(
    participantRef: string,
    n: number,
    seqOffset: number,
  ): TurnFact[] {
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
        clientKey: `${participantRef}-round-${number}`,
        stageClientKey: "block-1",
        participantRef,
        sequence: seqOffset + number,
        completedAt: "2026-08-14T10:00:00.000Z",
        totalScore: darts.reduce((sum, d) => sum + d.score, 0),
        darts,
      });
    }
    return turns;
  }

  /** Both seats' first `n` rounds, interleaved A, B, A, B, ... — the shape
   * a real 1v1 session's turn log actually has (alternating throwers), not
   * every seat's rounds grouped together. */
  function interleavedPriorRounds(n: number): TurnFact[] {
    const a = priorRoundsFor("participant-1", n, 0);
    const b = priorRoundsFor("participant-2", n, n);
    const merged: TurnFact[] = [];
    for (let i = 0; i < n; i += 1) {
      merged.push(a[i], b[i]);
    }
    return merged;
  }

  it("classifies a dart against the throwing seat's own round, not the combined turn count", async () => {
    const play = makePlay({ configSnapshot: twoSeatConfig() });
    await play.init.call(play);

    // Seat A clears round 1 (1 closed turn total so far).
    await play.recordTap.call(play, "SINGLE");
    await play.recordTap.call(play, "SINGLE");
    await play.recordTap.call(play, "SINGLE");
    // Seat B clears round 1 too (2 closed turns total, 1 each).
    await play.recordTap.call(play, "SINGLE");
    await play.recordTap.call(play, "SINGLE");
    await play.recordTap.call(play, "SINGLE");
    // Seat A's round 2, 1st dart: `recordTap` itself always builds the dart
    // against A's own `targetIndex` from `state()` (target number 2) —
    // independent of the bug under test. Only `previewSegments`'s own
    // separate classification is being verified here. With the pre-fix
    // `turns.length - 1` logic, `turns.length` is 3 at this point (2 closed
    // + 1 open) so it would check dart.hitTargetNumber(2) against
    // targetNumberAt(2) = 3 and wrongly report "miss".
    await play.recordTap.call(play, "SINGLE");

    expect(play.previewSegments.call(play)).toEqual([
      { status: "hit" },
      { status: "empty" },
      { status: "empty" },
    ]);
  });

  it("keeps classifying correctly once both seats pass round 10 — reported: preview stops working past target 11", async () => {
    const play = makePlay({
      configSnapshot: twoSeatConfig(),
      turns: interleavedPriorRounds(10),
    });
    await play.init.call(play);

    // It's seat A's turn for round 11 (0-indexed targetIndex 10, target
    // number 11). Pre-fix, `turns.length - 1` would be 20 at this point (20
    // prior closed turns + this 1 open one, minus 1) — `targetNumberAt(20)`
    // throws, since Shanghai's numbers path only covers indices 0..19
    // before the terminal BULL entry. This reproduces the issue's own
    // "preview stops working past target 11" report as a literal throw.
    await play.recordTap.call(play, "SINGLE");

    expect(() => play.previewSegments.call(play)).not.toThrow();
    expect(play.previewSegments.call(play)).toEqual([
      { status: "hit" },
      { status: "empty" },
      { status: "empty" },
    ]);
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
    const play = makePlay({ turns: priorRoundsThroughNumber(19) });

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
  it("starts a fresh session under the player's current mode pair with no overrides", async () => {
    const play = makePlay({ turns: priorRoundsThroughNumber(19) });
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

    expect(createSession).toHaveBeenCalledWith({
      gameTypeKey: "SHANGHAI",
      rulesetVersionKey: "SHANGHAI_V1",
      captureModeKey: "RECREATIONAL",
      inputModeKey: "DETAILED_DARTS",
      config: { source: "template", templateRef: "tpl-1" },
    });
    expect(play.$store.game.sessionId).toBe("new-session");
    expect(play.$store.game.turns).toEqual([]);
    expect(play.finished).toBe(false);
    expect(play.completionStatus).toBe("pending");
    expect(play.resultsSnapshot).toBeNull();
    expect(play.hasActiveSession).toBe(true);
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
      hitZoneKey: "SINGLE",
      locationX: 5,
      locationY: -10,
    });

    const dart = play.$store.game.turns[0].darts[0];
    expect(dart.locationX).toBe(5);
    expect(dart.locationY).toBe(-10);
    expect(play.currentScore.call(play)).toBe("1");
  });

  it("does nothing once finished", async () => {
    const play = makePlay({ inputModeKey: "VISUAL_BOARD" });
    await play.init.call(play);
    play.finished = true;

    await play.recordDart.call(play, {
      hitTargetNumber: 1,
      hitZoneKey: "SINGLE",
      locationX: 5,
      locationY: -10,
    });

    expect(play.$store.game.turns).toHaveLength(0);
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
});
