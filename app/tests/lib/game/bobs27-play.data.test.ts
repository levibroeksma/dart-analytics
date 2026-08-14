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
import { bobs27EngineFactory } from "@modules/game/bobs27.engine.module";
import { bobs27Play } from "@lib/game/bobs27-play.data";
import type { Bobs27PlayContext, Bobs27Snapshot } from "@lib/types";
import type {
  DartFact,
  DartObservation,
  StageFact,
  TurnFact,
} from "@modules/types";

const ACTIVE_SESSION = {
  sessionId: "s1",
  gameTypeKey: "BOBS27",
  gameTypeName: "Bob's 27",
  captureModeKey: "RECREATIONAL",
  inputModeKey: "DETAILED_DARTS",
  rulesetVersionKey: "BOBS27_V1",
  startedAt: "now",
} as const;

const STAGE: StageFact = {
  clientKey: "block-1",
  stageTypeKey: "EXERCISE_BLOCK",
  parentClientKey: null,
  sequence: 1,
};

function defaultConfig(): Bobs27Snapshot {
  return { startScore: 27, bullHitValue: 50, missPenaltyMultiplier: 1 };
}

function hitAt(number: number): DartObservation {
  return {
    hitTargetNumber: number,
    hitZoneKey: "DOUBLE",
    locationX: 10,
    locationY: 20,
  };
}

function missAt(number: number): DartObservation {
  return {
    hitTargetNumber: number,
    hitZoneKey: "MISS",
    locationX: 10,
    locationY: 20,
  };
}

/** One prior turn holding 60 hit darts (3 per double, D1..D20), so a fresh
 * engine rehydrated from it starts exactly at BULL, in progress. */
function priorTurnsThroughBull(): TurnFact[] {
  const darts: DartFact[] = [];
  let sequence = 1;
  for (let number = 1; number <= 20; number += 1) {
    for (let i = 0; i < 3; i += 1) {
      darts.push({
        sequence,
        intendedTargetNumber: number,
        intendedZoneKey: "DOUBLE",
        hitTargetNumber: number,
        hitZoneKey: "DOUBLE",
        score: number * 2,
        locationX: null,
        locationY: null,
      });
      sequence += 1;
    }
  }
  return [
    {
      clientKey: "prior",
      stageClientKey: "block-1",
      sequence: 1,
      completedAt: "2026-08-01T10:00:00.000Z",
      totalScore: darts.reduce((sum, d) => sum + d.score, 0),
      darts,
    },
  ];
}

type GameStub = Bobs27PlayContext["$store"]["game"];

function gameStub(overrides: Partial<GameStub> = {}): GameStub {
  return {
    rulesetVersionKey: "BOBS27_V1",
    sessionId: "s1",
    participantRef: "p1",
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
    ...bobs27Play(),
    $store: {
      game: gameStub(gameOverrides),
      settings: settingsStub(settingsOverrides),
    },
  } as Bobs27PlayContext;
}

beforeEach(() => {
  vi.clearAllMocks();
  resetEngineRegistry();
  registerEngineFactory(bobs27EngineFactory);
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
    const missDart = (sequence: number): DartFact => ({
      sequence,
      intendedTargetNumber: 1,
      intendedZoneKey: "DOUBLE",
      hitTargetNumber: 1,
      hitZoneKey: "MISS",
      score: 0,
      locationX: null,
      locationY: null,
    });
    const lostTurn: TurnFact = {
      clientKey: "prior-lost",
      stageClientKey: "block-1",
      sequence: 1,
      completedAt: "2026-08-01T10:00:00.000Z",
      totalScore: 0,
      darts: [missDart(1), missDart(2), missDart(3)],
    };
    const play = makePlay({
      turns: [lostTurn],
      configSnapshot: {
        startScore: 27,
        bullHitValue: 50,
        missPenaltyMultiplier: 20,
      },
    });

    await play.init.call(play);

    expect(play.finished).toBe(true);
    expect(play.completionStatus).toBe("succeeded");
    expect(completeSession).toHaveBeenCalledWith("s1", "COMPLETED");
    expect(play.resultsSnapshot).toEqual({
      status: "LOST",
      score: -13,
      darts: 3,
      doubleHitRate: "0%",
      highestNumberReached: "D1",
    });
  });
});

describe("currentTargetLabel", () => {
  it("shows D1 at the start and BULL once the path reaches it", async () => {
    const play = makePlay();
    await play.init.call(play);
    expect(play.currentTargetLabel.call(play)).toBe("D1");

    const bullPlay = makePlay({ turns: priorTurnsThroughBull() });
    await bullPlay.init.call(bullPlay);
    expect(bullPlay.currentTargetLabel.call(bullPlay)).toBe("BULL");
  });
});

describe("currentScore", () => {
  it("reflects the engine's derived running score", async () => {
    const play = makePlay();
    await play.init.call(play);
    expect(play.currentScore.call(play)).toBe("27");

    await play.recordTap.call(play, true);
    expect(play.currentScore.call(play)).toBe("29");
  });
});

describe("recordTap", () => {
  it("hit adds the current double's board value to the score", async () => {
    const play = makePlay();
    await play.init.call(play);

    await play.recordTap.call(play, true);

    expect(play.engine!.state().score).toBe(29); // 27 + D1 board value (2)
    expect(play.$store.game.turns[0].darts[0].hitZoneKey).toBe("DOUBLE");
  });

  it("miss records a MISS dart without changing the score mid-visit", async () => {
    const play = makePlay();
    await play.init.call(play);

    await play.recordTap.call(play, false);

    expect(play.engine!.state().score).toBe(27);
    expect(play.$store.game.turns[0].darts[0].hitZoneKey).toBe("MISS");
  });

  it("a resolved visit with at least one hit advances the target with no penalty", async () => {
    const play = makePlay();
    await play.init.call(play);

    await play.recordTap.call(play, true);
    await play.recordTap.call(play, false);
    await play.recordTap.call(play, false);

    expect(play.engine!.state().score).toBe(29);
    expect(play.currentTargetLabel.call(play)).toBe("D2");
  });

  it("a full-miss visit deducts the target's board value and still advances", async () => {
    const play = makePlay();
    await play.init.call(play);

    await play.recordTap.call(play, false);
    await play.recordTap.call(play, false);
    await play.recordTap.call(play, false);

    expect(play.engine!.state().score).toBe(25); // 27 - D1 board value (2)
    expect(play.currentTargetLabel.call(play)).toBe("D2");
  });
});

describe("completion", () => {
  it("wins and uploads results when BULL is cleared", async () => {
    vi.mocked(appendBatch).mockResolvedValue({
      created: { stages: 1, turns: 1, darts: 3 },
    });
    vi.mocked(completeSession).mockResolvedValue({
      sessionId: "s1",
      statusKey: "COMPLETED",
      completedAt: "now",
    });
    const play = makePlay({ turns: priorTurnsThroughBull() });
    await play.init.call(play);

    await play.recordTap.call(play, true);
    await play.recordTap.call(play, true);
    await play.recordTap.call(play, true);

    expect(play.finished).toBe(true);
    expect(completeSession).toHaveBeenCalledWith("s1", "COMPLETED");
    expect(play.resultsSnapshot).toEqual({
      status: "WON",
      score: 1437,
      darts: 63,
      doubleHitRate: "100%",
      highestNumberReached: "BULL",
    });
    expect(play.completionStatus).toBe("succeeded");
  });

  it("loses when a full-miss visit drops the score to zero or below", async () => {
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
        startScore: 27,
        bullHitValue: 50,
        missPenaltyMultiplier: 20,
      },
    });
    await play.init.call(play);

    await play.recordTap.call(play, false);
    await play.recordTap.call(play, false);
    await play.recordTap.call(play, false);

    expect(play.finished).toBe(true);
    expect(play.resultsSnapshot).toEqual({
      status: "LOST",
      score: -13,
      darts: 3,
      doubleHitRate: "0%",
      highestNumberReached: "D1",
    });
  });

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
    await play.recordTap.call(play, true);
    await play.recordTap.call(play, false);

    expect(play.previewSegments.call(play)).toEqual([
      { status: "hit" },
      { status: "miss" },
      { status: "empty" },
    ]);
  });

  it("marks an off-target on-board dart as a miss even though its zone isn't literally MISS", async () => {
    const play = makePlay({ inputModeKey: "VISUAL_BOARD" });
    await play.init.call(play);

    await play.recordDart.call(play, {
      hitTargetNumber: 20,
      hitZoneKey: "TREBLE",
      locationX: 10,
      locationY: 20,
    });

    expect(play.previewSegments.call(play)).toEqual([
      { status: "miss" },
      { status: "empty" },
      { status: "empty" },
    ]);
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

    await play.recordDart.call(play, hitAt(1));
    await play.recordDart.call(play, missAt(1));
    await play.recordDart.call(play, missAt(1));

    const clientKey = play.$store.game.turns[0].clientKey;
    expect(play.hiddenTurnKey).toBeNull();
    expect(play.visitMarkers.call(play)).not.toEqual([]);

    vi.advanceTimersByTime(1500);

    expect(play.hiddenTurnKey).toBe(clientKey);
    expect(play.visitMarkers.call(play)).toEqual([]);
    expect(play.previewSegments.call(play)).toEqual([
      { status: "empty" },
      { status: "empty" },
      { status: "empty" },
    ]);
  });

  it("hides the resolved visit's preview immediately under RECREATIONAL, with no timer", async () => {
    const play = makePlay({ inputModeKey: "DETAILED_DARTS" });
    await play.init.call(play);

    await play.recordTap.call(play, true);
    await play.recordTap.call(play, false);
    await play.recordTap.call(play, false);

    const clientKey = play.$store.game.turns[0].clientKey;
    expect(play.hiddenTurnKey).toBe(clientKey);
    expect(play.hiddenTimer).toBeNull();
    expect(play.previewSegments.call(play)).toEqual([
      { status: "empty" },
      { status: "empty" },
      { status: "empty" },
    ]);
  });

  it("undoVisit cancels a pending hide timer so a reopened visit stays visible", async () => {
    vi.mocked(fetchActiveSessions).mockResolvedValue([
      { ...ACTIVE_SESSION, inputModeKey: "VISUAL_BOARD" },
    ]);
    const play = makePlay({ inputModeKey: "VISUAL_BOARD" });
    await play.init.call(play);
    await play.recordDart.call(play, hitAt(1));
    await play.recordDart.call(play, missAt(1));
    await play.recordDart.call(play, missAt(1));

    vi.advanceTimersByTime(1000); // before the 1.5s mark
    play.undoVisit.call(play);
    vi.advanceTimersByTime(1000); // past where the original timer would have fired

    expect(play.hiddenTurnKey).toBeNull();
  });

  it("undoVisit clears an already-set hiddenTurnKey", async () => {
    vi.mocked(fetchActiveSessions).mockResolvedValue([
      { ...ACTIVE_SESSION, inputModeKey: "VISUAL_BOARD" },
    ]);
    const play = makePlay({ inputModeKey: "VISUAL_BOARD" });
    await play.init.call(play);
    await play.recordDart.call(play, hitAt(1));
    await play.recordDart.call(play, missAt(1));
    await play.recordDart.call(play, missAt(1));
    vi.advanceTimersByTime(1500);
    expect(play.hiddenTurnKey).not.toBeNull();

    play.undoVisit.call(play);

    expect(play.hiddenTurnKey).toBeNull();
  });

  it("clears a still-pending hide timer before scheduling a new one, so a fast second visit never leaks the first timer", async () => {
    vi.mocked(fetchActiveSessions).mockResolvedValue([
      { ...ACTIVE_SESSION, inputModeKey: "VISUAL_BOARD" },
    ]);
    const play = makePlay({ inputModeKey: "VISUAL_BOARD" });
    await play.init.call(play);

    await play.recordDart.call(play, hitAt(1));
    await play.recordDart.call(play, missAt(1));
    await play.recordDart.call(play, missAt(1));
    const firstTimer = play.hiddenTimer;

    vi.advanceTimersByTime(1400);

    await play.recordDart.call(play, hitAt(2));
    await play.recordDart.call(play, missAt(2));
    await play.recordDart.call(play, missAt(2));

    expect(play.hiddenTimer).not.toBe(firstTimer);

    vi.advanceTimersByTime(200); // past the leaked first timer's 1500ms deadline
    expect(play.hiddenTurnKey).toBeNull();

    vi.advanceTimersByTime(1300); // up to the second timer's own 1500ms deadline

    expect(play.hiddenTurnKey).toBe(play.$store.game.turns[1].clientKey);
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
    const play = makePlay({ turns: priorTurnsThroughBull() });

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
    const play = makePlay(
      { turns: priorTurnsThroughBull() },
      { captureModeKey: "ANALYTICS", inputModeKey: "VISUAL_BOARD" },
    );
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
      gameTypeKey: "BOBS27",
      rulesetVersionKey: "BOBS27_V1",
      captureModeKey: "ANALYTICS",
      inputModeKey: "VISUAL_BOARD",
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
