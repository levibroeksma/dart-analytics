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
import { doublesTrainingEngineFactory } from "@modules/game/doubles-training.engine.module";
import { doublesTrainingPlay } from "@lib/game/doubles-training-play.data";
import type {
  DoublesTrainingPlayContext,
  DoublesTrainingSnapshot,
} from "@lib/types";
import type { DartFact, StageFact, TurnFact } from "@modules/types";

const ACTIVE_SESSION = {
  sessionId: "s1",
  gameTypeKey: "DOUBLES_TRAINING",
  gameTypeName: "Doubles Training",
  captureModeKey: "RECREATIONAL",
  inputModeKey: "DETAILED_DARTS",
  rulesetVersionKey: "DOUBLES_TRAINING_V1",
  startedAt: "now",
} as const;

const STAGE: StageFact = {
  clientKey: "block-1",
  stageTypeKey: "EXERCISE_BLOCK",
  parentClientKey: null,
  sequence: 1,
};

function defaultConfig(): DoublesTrainingSnapshot {
  return {
    mode: "EASY",
    orderMode: "LOW_TO_HIGH",
    targetOrder: [
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 25,
    ],
  };
}

/** `n` prior turns (doubles D1..Dn), each a single hit dart, so a fresh
 * engine rehydrated from it starts exactly at target index `n` (0-based;
 * BULL once n = 20), in progress. */
function priorHitTurnsThroughDouble(n: number): TurnFact[] {
  const turns: TurnFact[] = [];
  for (let number = 1; number <= n; number += 1) {
    const dart: DartFact = {
      sequence: 1,
      intendedTargetNumber: number,
      intendedZoneKey: "DOUBLE",
      hitTargetNumber: number,
      hitZoneKey: "DOUBLE",
      score: number * 2,
      locationX: null,
      locationY: null,
    };
    turns.push({
      clientKey: `prior-${number}`,
      stageClientKey: "block-1",
      sequence: number,
      completedAt: "2026-08-01T10:00:00.000Z",
      totalScore: dart.score,
      darts: [dart],
    });
  }
  return turns;
}

type GameStub = DoublesTrainingPlayContext["$store"]["game"];

function gameStub(overrides: Partial<GameStub> = {}): GameStub {
  return {
    rulesetVersionKey: "DOUBLES_TRAINING_V1",
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
    ...doublesTrainingPlay(),
    $store: {
      game: gameStub(gameOverrides),
      settings: settingsStub(settingsOverrides),
    },
  } as DoublesTrainingPlayContext;
}

beforeEach(() => {
  vi.clearAllMocks();
  resetEngineRegistry();
  registerEngineFactory(doublesTrainingEngineFactory);
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

describe("currentTargetLabel", () => {
  it("starts at D1", async () => {
    const play = makePlay();
    await play.init.call(play);
    expect(play.currentTargetLabel.call(play)).toBe("D1");
  });

  it("shows D20 after 19 cleared doubles", async () => {
    const play = makePlay({ turns: priorHitTurnsThroughDouble(19) });
    await play.init.call(play);
    expect(play.currentTargetLabel.call(play)).toBe("D20");
  });

  it("shows BULL after 20 cleared doubles", async () => {
    const play = makePlay({ turns: priorHitTurnsThroughDouble(20) });
    await play.init.call(play);
    expect(play.currentTargetLabel.call(play)).toBe("BULL");
  });

  it("shows BULL first under a HIGH_TO_LOW order, not D1", async () => {
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
  });
});

describe("recordTap on a double target", () => {
  it("hit records a DOUBLE dart at the current target and advances immediately", async () => {
    const play = makePlay();
    await play.init.call(play);

    await play.recordTap.call(play, true);

    const dart = play.$store.game.turns[0].darts[0];
    expect(dart.hitTargetNumber).toBe(1);
    expect(dart.hitZoneKey).toBe("DOUBLE");
    expect(play.$store.game.turns[0].darts).toHaveLength(1);
    expect(play.currentTargetLabel.call(play)).toBe("D2");
  });

  it("a miss does not end the visit until the 3rd dart", async () => {
    const play = makePlay();
    await play.init.call(play);

    await play.recordTap.call(play, false);
    expect(play.currentTargetLabel.call(play)).toBe("D1");
    expect(play.$store.game.turns[0].darts).toHaveLength(1);

    await play.recordTap.call(play, false);
    expect(play.currentTargetLabel.call(play)).toBe("D1");

    await play.recordTap.call(play, false);
    expect(play.currentTargetLabel.call(play)).toBe("D2");
    expect(play.$store.game.turns[0].darts).toHaveLength(3);
  });

  it("a hit on the 2nd or 3rd dart still ends the visit early", async () => {
    const play = makePlay();
    await play.init.call(play);

    await play.recordTap.call(play, false);
    await play.recordTap.call(play, true);

    expect(play.$store.game.turns[0].darts).toHaveLength(2);
    expect(play.currentTargetLabel.call(play)).toBe("D2");
  });
});

describe("recordTap on the BULL visit", () => {
  it("hit records INNER_BULL at target number 25 and completes the session", async () => {
    vi.mocked(appendBatch).mockResolvedValue({
      created: { stages: 1, turns: 1, darts: 1 },
    });
    vi.mocked(completeSession).mockResolvedValue({
      sessionId: "s1",
      statusKey: "COMPLETED",
      completedAt: "now",
    });
    const play = makePlay({ turns: priorHitTurnsThroughDouble(20) });
    await play.init.call(play);

    await play.recordTap.call(play, true);

    const dart = play.$store.game.turns[20].darts[0];
    expect(dart.hitTargetNumber).toBe(25);
    expect(dart.hitZoneKey).toBe("INNER_BULL");
    expect(play.finished).toBe(true);
    expect(completeSession).toHaveBeenCalledWith("s1", "COMPLETED");
  });
});

describe("undoVisit", () => {
  it("reverts the last dart", async () => {
    const play = makePlay();
    await play.init.call(play);
    await play.recordTap.call(play, false);

    play.undoVisit.call(play);

    expect(play.$store.game.turns).toHaveLength(0);
  });

  it("reopens a visit that a hit ended early, so the next tap resumes it rather than starting a new one", async () => {
    const play = makePlay();
    await play.init.call(play);
    await play.recordTap.call(play, true);
    expect(play.$store.game.turns).toHaveLength(1);
    expect(play.currentTargetLabel.call(play)).toBe("D2");

    play.undoVisit.call(play);

    expect(play.currentTargetLabel.call(play)).toBe("D1");
    expect(play.hiddenTurnKey).toBeNull();

    await play.recordTap.call(play, false);

    expect(play.$store.game.turns).toHaveLength(1);
    expect(play.$store.game.turns[0].darts).toHaveLength(1);
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
    await play.recordTap.call(play, false);
    await play.recordTap.call(play, false);

    expect(play.previewSegments.call(play)).toEqual([
      { status: "miss" },
      { status: "miss" },
      { status: "empty" },
    ]);
  });

  it("hides the resolved visit's preview immediately, with no timer", async () => {
    const play = makePlay();
    await play.init.call(play);

    await play.recordTap.call(play, true);

    const clientKey = play.$store.game.turns[0].clientKey;
    expect(play.hiddenTurnKey).toBe(clientKey);
    expect(play.previewSegments.call(play)).toEqual([
      { status: "empty" },
      { status: "empty" },
      { status: "empty" },
    ]);
  });
});

describe("hitCount / missCount", () => {
  it("counts zero for both before any visit resolves", async () => {
    const play = makePlay();
    await play.init.call(play);

    expect(play.hitCount.call(play)).toBe("0");
    expect(play.missCount.call(play)).toBe("0");
  });

  it("counts a full-miss visit as exactly one miss, not three", async () => {
    const play = makePlay();
    await play.init.call(play);

    await play.recordTap.call(play, false);
    await play.recordTap.call(play, false);
    await play.recordTap.call(play, false);

    expect(play.missCount.call(play)).toBe("1");
    expect(play.hitCount.call(play)).toBe("0");
  });

  it("counts a 2nd-dart hit visit as one hit", async () => {
    const play = makePlay();
    await play.init.call(play);

    await play.recordTap.call(play, false);
    await play.recordTap.call(play, true);

    expect(play.hitCount.call(play)).toBe("1");
    expect(play.missCount.call(play)).toBe("0");
  });

  it("accumulates across resolved visits, ignoring an in-progress one", async () => {
    const play = makePlay({ turns: priorHitTurnsThroughDouble(3) });
    await play.init.call(play);

    await play.recordTap.call(play, false);
    await play.recordTap.call(play, false);

    expect(play.hitCount.call(play)).toBe("3");
    expect(play.missCount.call(play)).toBe("0");
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

  it("captures the final hits/misses split in resultsSnapshot", async () => {
    vi.mocked(appendBatch).mockResolvedValue({
      created: { stages: 1, turns: 1, darts: 1 },
    });
    vi.mocked(completeSession).mockResolvedValue({
      sessionId: "s1",
      statusKey: "COMPLETED",
      completedAt: "now",
    });
    const play = makePlay({ turns: priorHitTurnsThroughDouble(20) });
    await play.init.call(play);

    await play.recordTap.call(play, true);

    expect(play.resultsSnapshot).toEqual({ hits: 21, misses: 0 });
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
    const play = makePlay({ turns: priorHitTurnsThroughDouble(20) });

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
    const play = makePlay({ turns: priorHitTurnsThroughDouble(20) });
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
      gameTypeKey: "DOUBLES_TRAINING",
      rulesetVersionKey: "DOUBLES_TRAINING_V1",
      captureModeKey: "RECREATIONAL",
      inputModeKey: "DETAILED_DARTS",
      config: {
        source: "template",
        templateRef: "tpl-1",
        overrides: { order_mode: "LOW_TO_HIGH", target_order: ascending },
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
      turns: priorHitTurnsThroughDouble(20),
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
