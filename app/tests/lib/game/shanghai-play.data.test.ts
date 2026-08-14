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
import { shanghaiEngineFactory } from "@modules/game/shanghai.engine.module";
import { shanghaiPlay } from "@lib/game/shanghai-play.data";
import type { ShanghaiSnapshot, ShanghaiPlayContext } from "@lib/types";
import type { DartFact, StageFact, TurnFact } from "@modules/types";

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

function defaultConfig(): ShanghaiSnapshot {
  return {};
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
    rulesetVersionKey: "SHANGHAI_V1",
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
      score: 6,
      status: "SHANGHAI",
      round: 1,
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
      score: 3 * ((19 * 20) / 2),
      status: "COMPLETE",
      round: 20,
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
      score: 3 * ((19 * 20) / 2) + 20 + 40 + 60,
      status: "SHANGHAI",
      round: 20,
    });
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
    const play = makePlay();
    await play.init.call(play);
    await play.recordTap.call(play, "SINGLE");
    await play.recordTap.call(play, "SINGLE");
    await play.recordTap.call(play, "SINGLE");
    expect(play.hiddenTurnKey).not.toBeNull();

    play.undoVisit.call(play);

    expect(play.hiddenTurnKey).toBeNull();
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

  it("hides the resolved visit's preview once the 3rd dart lands", async () => {
    const play = makePlay();
    await play.init.call(play);

    await play.recordTap.call(play, "SINGLE");
    await play.recordTap.call(play, "MISS");
    await play.recordTap.call(play, "MISS");

    const clientKey = play.$store.game.turns[0].clientKey;
    expect(play.hiddenTurnKey).toBe(clientKey);
    expect(play.previewSegments.call(play)).toEqual([
      { status: "empty" },
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
