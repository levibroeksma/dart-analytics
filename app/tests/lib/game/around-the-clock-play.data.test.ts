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
import { aroundTheClockEngineFactory } from "@modules/game/around-the-clock.engine.module";
import { aroundTheClockPlay } from "@lib/game/around-the-clock-play.data";
import type {
  AroundTheClockSnapshot,
  AroundTheClockPlayContext,
  Seated,
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
  gameTypeKey: "AROUND_THE_CLOCK",
  gameTypeName: "Around the Clock",
  captureModeKey: "RECREATIONAL",
  inputModeKey: "DETAILED_DARTS",
  rulesetVersionKey: "AROUND_THE_CLOCK_V1",
  startedAt: "now",
} as const;

const STAGE: StageFact = {
  clientKey: "block-1",
  stageTypeKey: "EXERCISE_BLOCK",
  parentClientKey: null,
  sequence: 1,
};

function defaultConfig(): Seated<AroundTheClockSnapshot> {
  return { seats: SEATS };
}

/** `n` prior turns, each hitting exactly one number with a SINGLE and closing
 * with 2 misses, so a fresh engine rehydrated from it sits at target index
 * `n` (number `n + 1`), in progress. */
function priorTurnsThroughNumber(n: number): TurnFact[] {
  const turns: TurnFact[] = [];
  for (let number = 1; number <= n; number += 1) {
    const darts: DartFact[] = [
      {
        sequence: 1,
        intendedTargetNumber: null,
        intendedZoneKey: null,
        hitTargetNumber: number,
        hitZoneKey: "SINGLE",
        score: number,
        locationX: null,
        locationY: null,
      },
      {
        sequence: 2,
        intendedTargetNumber: null,
        intendedZoneKey: null,
        hitTargetNumber: null,
        hitZoneKey: "MISS",
        score: 0,
        locationX: null,
        locationY: null,
      },
      {
        sequence: 3,
        intendedTargetNumber: null,
        intendedZoneKey: null,
        hitTargetNumber: null,
        hitZoneKey: "MISS",
        score: 0,
        locationX: null,
        locationY: null,
      },
    ];
    turns.push({
      clientKey: `prior-${number}`,
      stageClientKey: "block-1",
      participantRef: "participant-1",
      sequence: number,
      completedAt: "2026-08-15T10:00:00.000Z",
      totalScore: number,
      darts,
    });
  }
  return turns;
}

type GameStub = AroundTheClockPlayContext["$store"]["game"];

function gameStub(overrides: Partial<GameStub> = {}): GameStub {
  return {
    get seats() {
      return this.configSnapshot?.seats ?? [];
    },
    rulesetVersionKey: "AROUND_THE_CLOCK_V1",
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
    ...aroundTheClockPlay(),
    $store: {
      game: gameStub(gameOverrides),
      settings: settingsStub(settingsOverrides),
    },
  } as AroundTheClockPlayContext;
}

beforeEach(() => {
  vi.clearAllMocks();
  resetEngineRegistry();
  registerEngineFactory(aroundTheClockEngineFactory);
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
});

describe("currentTargetLabel / turnsSoFar / isBullVisit", () => {
  it("starts at number 1 with zero turns, and isBullVisit is false", async () => {
    const play = makePlay();
    await play.init.call(play);
    expect(play.currentTargetLabel.call(play)).toBe("1");
    expect(play.turnsSoFar.call(play)).toBe("0");
    expect(play.isBullVisit.call(play)).toBe(false);
  });

  it("shows BULL after all 20 numbers are cleared", async () => {
    const play = makePlay({ turns: priorTurnsThroughNumber(20) });
    await play.init.call(play);
    expect(play.currentTargetLabel.call(play)).toBe("BULL");
    expect(play.isBullVisit.call(play)).toBe(true);
    expect(play.turnsSoFar.call(play)).toBe("20");
  });
});

describe("recordTap", () => {
  it("SINGLE advances the target and records a SINGLE dart", async () => {
    const play = makePlay();
    await play.init.call(play);

    await play.recordTap.call(play, "SINGLE");

    expect(play.currentTargetLabel.call(play)).toBe("2");
    const dart = play.$store.game.turns[0].darts[0];
    expect(dart.hitTargetNumber).toBe(1);
    expect(dart.hitZoneKey).toBe("SINGLE");
    expect(dart.intendedTargetNumber).toBeNull();
    expect(dart.intendedZoneKey).toBeNull();
  });

  it("a hit-then-hit visit clears two numbers in one visit (mid-visit advance)", async () => {
    const play = makePlay();
    await play.init.call(play);

    await play.recordTap.call(play, "SINGLE");
    await play.recordTap.call(play, "DOUBLE");
    await play.recordTap.call(play, "MISS");

    expect(play.currentTargetLabel.call(play)).toBe("3");
    expect(play.$store.game.turns).toHaveLength(1);
    expect(play.$store.game.turns[0].darts).toHaveLength(3);
    expect(play.finished).toBe(false);
  });

  it("MISS adds no advance and still counts toward the 3-dart visit", async () => {
    const play = makePlay();
    await play.init.call(play);

    await play.recordTap.call(play, "MISS");

    expect(play.currentTargetLabel.call(play)).toBe("1");
    expect(play.$store.game.turns[0].darts[0].hitZoneKey).toBe("MISS");
    expect(play.$store.game.turns[0].darts[0].hitTargetNumber).toBeNull();
  });

  it("on the BULL visit, SINGLE taps OUTER_BULL and DOUBLE taps INNER_BULL, and TREBLE is a no-op", async () => {
    vi.mocked(appendBatch).mockResolvedValue({
      created: { stages: 1, turns: 1, darts: 1 },
    });
    vi.mocked(completeSession).mockResolvedValue({
      sessionId: "s1",
      statusKey: "COMPLETED",
      completedAt: "now",
    });
    const play = makePlay({ turns: priorTurnsThroughNumber(20) });
    await play.init.call(play);

    await play.recordTap.call(play, "TREBLE");
    expect(play.$store.game.turns).toHaveLength(20);

    await play.recordTap.call(play, "SINGLE");
    expect(play.finished).toBe(true);
    const lastTurn = play.$store.game.turns.at(-1)!;
    expect(lastTurn.darts).toHaveLength(1);
    expect(lastTurn.darts[0].hitZoneKey).toBe("OUTER_BULL");
    expect(lastTurn.darts[0].hitTargetNumber).toBe(25);
  });
});

describe("session completion on BULL", () => {
  it("ends the session immediately on a BULL hit, even mid-visit", async () => {
    vi.mocked(appendBatch).mockResolvedValue({
      created: { stages: 1, turns: 1, darts: 1 },
    });
    vi.mocked(completeSession).mockResolvedValue({
      sessionId: "s1",
      statusKey: "COMPLETED",
      completedAt: "now",
    });
    const play = makePlay({ turns: priorTurnsThroughNumber(20) });
    await play.init.call(play);

    await play.recordTap.call(play, "DOUBLE");

    expect(play.finished).toBe(true);
    expect(play.resultsSnapshot).toEqual({
      turns: 21,
      accuracy: "34.43%",
      totalDarts: 61,
      winningSideKey: null,
      status: "COMPLETE",
    });
    expect(play.completionStatus).toBe("succeeded");
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

  function twoSeatConfig(): Seated<AroundTheClockSnapshot> {
    return { seats: TWO_SEATS };
  }

  it("marks status TIE, with winningSideKey null, when both seats finish in the same number of darts", async () => {
    vi.mocked(appendBatch).mockResolvedValue({
      created: { stages: 14, turns: 14, darts: 42 },
    });
    vi.mocked(completeSession).mockResolvedValue({
      sessionId: "s1",
      statusKey: "COMPLETED",
      completedAt: "now",
    });
    const play = makePlay({ configSnapshot: twoSeatConfig() });
    await play.init.call(play);

    // Both seats hit every target with no misses, so each clears its own
    // circuit in exactly 21 darts (20 numbers + BULL) — a genuine tie, not
    // a solo session, even though winningSideKey is null in both cases.
    for (let i = 0; i < 42; i += 1) {
      await play.recordTap.call(play, "SINGLE");
    }

    expect(play.finished).toBe(true);
    expect(play.completionStatus).toBe("succeeded");
    expect(play.resultsSnapshot?.status).toBe("TIE");
    expect(play.resultsSnapshot?.winningSideKey).toBeNull();
  });
});

describe("undoVisit", () => {
  it("reverts the last dart, restoring the prior target", async () => {
    const play = makePlay();
    await play.init.call(play);
    await play.recordTap.call(play, "SINGLE");

    play.undoVisit.call(play);

    expect(play.currentTargetLabel.call(play)).toBe("1");
    expect(play.$store.game.turns).toHaveLength(0);
  });
});

describe("aroundTheClockPlay — per-seat accessors", () => {
  it("currentTargetLabelFor and turnsSoFarFor read the named seat", () => {
    const ctx = aroundTheClockPlay() as unknown as {
      engine: {
        state: () => {
          activeParticipantRef: string;
          seats: { participantRef: string; targetIndex: number }[];
        };
      };
      $store: { game: { turns: { participantRef: string }[] } };
      currentTargetLabelFor: (seatRef: string) => string;
      turnsSoFarFor: (seatRef: string) => string;
    };
    ctx.engine = {
      state: () => ({
        activeParticipantRef: "p1",
        seats: [
          { participantRef: "p1", targetIndex: 0 },
          { participantRef: "p2", targetIndex: 5 },
        ],
      }),
    };
    ctx.$store = {
      game: {
        turns: [
          { participantRef: "p1" },
          { participantRef: "p2" },
          { participantRef: "p1" },
        ],
      },
    };
    expect(ctx.currentTargetLabelFor("p1")).toBe("1");
    expect(ctx.currentTargetLabelFor("p2")).toBe("6");
    expect(ctx.turnsSoFarFor("p1")).toBe("2");
    expect(ctx.turnsSoFarFor("p2")).toBe("1");
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

  it("marks a non-miss tap as a hit and a MISS tap as a miss, in order", async () => {
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

  it("a VISUAL_BOARD dart on the wrong number is a miss even though it hit the board (#130, #132)", async () => {
    vi.mocked(fetchActiveSessions).mockResolvedValue([
      { ...ACTIVE_SESSION, inputModeKey: "VISUAL_BOARD" },
    ]);
    const play = makePlay();
    await play.init.call(play);

    // Target starts at number 1. Landing on 9 hits the board but not the
    // active target, so the target must not advance and the preview must
    // read "miss", not "hit".
    await play.recordDart.call(play, {
      hitTargetNumber: 9,
      hitZoneKey: "SINGLE",
      locationX: 1,
      locationY: 1,
    });

    expect(play.currentTargetLabel.call(play)).toBe("1");
    expect(play.previewSegments.call(play)).toEqual([
      { status: "miss" },
      { status: "empty" },
      { status: "empty" },
    ]);
  });

  it("tracks hit/miss per dart as the target advances mid-visit (#132)", async () => {
    vi.mocked(fetchActiveSessions).mockResolvedValue([
      { ...ACTIVE_SESSION, inputModeKey: "VISUAL_BOARD" },
    ]);
    const play = makePlay();
    await play.init.call(play);

    // Dart 1: wrong number (miss, target stays at 1).
    await play.recordDart.call(play, {
      hitTargetNumber: 9,
      hitZoneKey: "SINGLE",
      locationX: 1,
      locationY: 1,
    });
    // Dart 2: correct number (hit, target advances to 2).
    await play.recordDart.call(play, {
      hitTargetNumber: 1,
      hitZoneKey: "SINGLE",
      locationX: 1,
      locationY: 1,
    });
    // Dart 3: now aimed at 2, but lands on 15 (miss).
    await play.recordDart.call(play, {
      hitTargetNumber: 15,
      hitZoneKey: "SINGLE",
      locationX: 1,
      locationY: 1,
    });

    expect(play.currentTargetLabel.call(play)).toBe("2");
    expect(play.previewSegments.call(play)).toEqual([
      { status: "miss" },
      { status: "hit" },
      { status: "miss" },
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

describe("accuracy", () => {
  it("is 0% before any dart is thrown", async () => {
    const play = makePlay();
    await play.init.call(play);
    expect(play.accuracy.call(play)).toBe("0.00%");
  });

  it("reflects genuine target hits over darts thrown, not just darts that hit the board", async () => {
    vi.mocked(fetchActiveSessions).mockResolvedValue([
      { ...ACTIVE_SESSION, inputModeKey: "VISUAL_BOARD" },
    ]);
    const play = makePlay();
    await play.init.call(play);

    await play.recordDart.call(play, {
      hitTargetNumber: 9,
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

    expect(play.accuracy.call(play)).toBe("50.00%");
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

describe("playAgain", () => {
  it("starts a fresh session under the player's current mode pair with no overrides", async () => {
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

    expect(createSession).toHaveBeenCalledWith({
      gameTypeKey: "AROUND_THE_CLOCK",
      rulesetVersionKey: "AROUND_THE_CLOCK_V1",
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

  it("a BULL hit ends the session immediately, even mid-visit", async () => {
    const play = makePlay({ inputModeKey: "VISUAL_BOARD" });
    await play.init.call(play);

    for (let number = 1; number <= 20; number += 1) {
      await play.recordDart.call(play, {
        hitTargetNumber: number,
        hitZoneKey: "SINGLE",
        locationX: 1,
        locationY: 1,
      });
    }
    expect(play.isBullVisit.call(play)).toBe(true);

    await play.recordDart.call(play, {
      hitTargetNumber: 25,
      hitZoneKey: "OUTER_BULL",
      locationX: 0,
      locationY: -12,
    });

    expect(play.finished).toBe(true);
  });
});
