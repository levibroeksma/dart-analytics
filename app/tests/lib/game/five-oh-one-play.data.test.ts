import { describe, it, expect, vi, beforeEach } from "vitest";

// `init()` calls `fetchActiveSessions()` directly, and `reconcileActiveSession`
// (real, unmocked) calls `completeSession` internally on a mismatch — both
// must be mocked from the start, even though this task's tests only exercise
// the "match" path. `appendBatch`/`createSession` are mocked here too so
// Task 7 can extend this same file without re-declaring the mock.
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
import { fiveOhOneEngineFactory } from "@modules/game/five-oh-one.engine.module";
import { fiveOhOnePlay } from "@lib/game/five-oh-one-play.data";
import type { FiveOhOnePlayContext } from "@lib/types";
import type {
  DartObservation,
  EngineFacts,
  StageFact,
  TurnFact,
} from "@modules/types";
import type { FiveOhOneSnapshot } from "@lib/types";

const ACTIVE_SESSION = {
  sessionId: "s1",
  gameTypeKey: "501",
  gameTypeName: "501",
  captureModeKey: "RECREATIONAL",
  inputModeKey: "QUICK_SCORE",
  rulesetVersionKey: "501_V1",
  startedAt: "now",
} as const;

const LEG_1: StageFact = {
  clientKey: "leg-1",
  stageTypeKey: "LEG",
  parentClientKey: null,
  sequence: 1,
};

function turnFact(
  clientKey: string,
  stageClientKey: string,
  sequence: number,
  totalScore: number,
): TurnFact {
  return {
    clientKey,
    stageClientKey,
    sequence,
    completedAt: "2026-08-01T10:00:00.000Z",
    totalScore,
    darts: [],
  };
}

/**
 * Legal visits bringing a fresh leg to `remaining`. Each turn stays within
 * maxVisitScore (180), so the engine can replay them — a single synthetic
 * turn worth more than 180 is not a reachable game state and the engine
 * rejects it on rehydrate.
 */
function turnsReaching(
  remaining: number,
  stageClientKey = "leg-1",
): TurnFact[] {
  const turns: TurnFact[] = [];
  let left = 501 - remaining;
  let sequence = 1;
  while (left > 0) {
    const score = Math.min(180, left);
    turns.push(turnFact(`t${sequence}`, stageClientKey, sequence, score));
    left -= score;
    sequence += 1;
  }
  return turns;
}

function quickPlayConfig(): FiveOhOneSnapshot {
  return {
    startingScore: 501,
    legsToWin: 1,
    checkIn: "STRAIGHT_IN",
    checkOut: "DOUBLE_OUT",
    maxDartsPerTurn: 3,
    maxVisitScore: 180,
  };
}

function bestOf5Config(): FiveOhOneSnapshot {
  return { ...quickPlayConfig(), legsToWin: 3 };
}

type GameStub = FiveOhOnePlayContext["$store"]["game"];

function gameStub(overrides: Partial<GameStub> = {}): GameStub {
  return {
    rulesetVersionKey: "501_V1",
    sessionId: "s1",
    participantRef: "p1",
    templateRef: "tpl-1",
    configSnapshot: quickPlayConfig(),
    stages: [LEG_1],
    turns: [],
    idempotencyKey: null,
    loading: false,
    recordFacts: vi.fn(function (this: GameStub, facts: EngineFacts) {
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
    inputModeKey: "QUICK_SCORE",
    ...overrides,
  };
}

function makePlay(
  gameOverrides: Partial<GameStub> = {},
  settingsOverrides: Partial<SettingsStub> = {},
) {
  return {
    ...fiveOhOnePlay(),
    $store: {
      game: gameStub(gameOverrides),
      settings: settingsStub(settingsOverrides),
    },
  } as FiveOhOnePlayContext;
}

/**
 * Board coordinates reused from `board-input.data.test.ts`: `(0, -102)` sits
 * mid-treble on sector 20, `(0, -50)` mid inner-single on sector 20, `(0,
 * -166)` mid-double on sector 20 — the same landmarks the input-controller
 * tests already pin, so a location here means the same thing there.
 */
const TREBLE_20: DartObservation = {
  hitTargetNumber: 20,
  hitZoneKey: "TREBLE",
  locationX: 0,
  locationY: -102,
};

const SINGLE_20: DartObservation = {
  hitTargetNumber: 20,
  hitZoneKey: "INNER_SINGLE",
  locationX: 0,
  locationY: -50,
};

const DOUBLE_20: DartObservation = {
  hitTargetNumber: 20,
  hitZoneKey: "DOUBLE",
  locationX: 0,
  locationY: -166,
};

beforeEach(() => {
  vi.clearAllMocks();
  resetEngineRegistry();
  registerEngineFactory(fiveOhOneEngineFactory);
  vi.mocked(fetchActiveSessions).mockResolvedValue([{ ...ACTIVE_SESSION }]);
});

describe("init", () => {
  it("resumes the engine and mirrors its facts into the store", async () => {
    const play = makePlay();
    await play.init.call(play);
    expect(play.hasActiveSession).toBe(true);
    expect(play.engine).not.toBeNull();
  });
});

describe("submitVisit — plain reduction", () => {
  it("records a visit that does not reach zero without opening the double confirm", async () => {
    const play = makePlay();
    await play.init.call(play);
    play.scoreInput.setValue("100");

    await play.submitVisit.call(play);

    expect(play.$store.game.turns).toHaveLength(1);
    expect(play.$store.game.turns[0].totalScore).toBe(100);
    expect(play.showDoubleConfirm).toBe(false);
  });

  it("surfaces the engine's range error and leaves scoreInput untouched", async () => {
    const play = makePlay();
    await play.init.call(play);
    play.scoreInput.setValue("999");

    await play.submitVisit.call(play);

    expect(play.error).toBe("Enter a score between 0 and 180.");
    expect(play.scoreInput.value).toBe("999");
    expect(play.$store.game.turns).toHaveLength(0);
  });
});

describe("submitVisit — exact-zero opens the double confirm", () => {
  it("opens showDoubleConfirm instead of recording immediately", async () => {
    const priorTurns = turnsReaching(40);
    const play = makePlay({ turns: priorTurns }); // remaining 40
    await play.init.call(play);
    play.scoreInput.setValue("40");

    await play.submitVisit.call(play);

    expect(play.showDoubleConfirm).toBe(true);
    expect(play.pendingCheckoutScore).toBe(40);
    expect(play.$store.game.turns).toHaveLength(priorTurns.length); // nothing recorded yet
    expect(play.scoreInput.value).toBe("");
  });

  it("does not open the double confirm when the entered score exceeds maxVisitScore even if it would zero out a large remainder", async () => {
    const play = makePlay(); // remaining 501, config maxVisitScore 180
    await play.init.call(play);
    play.scoreInput.setValue("501");

    await play.submitVisit.call(play);

    expect(play.showDoubleConfirm).toBe(false);
    expect(play.error).toBe("Enter a score between 0 and 180.");
  });

  it("denyDouble records a bust — score 0, remaining unchanged", async () => {
    const priorTurns = turnsReaching(40);
    const play = makePlay({ turns: priorTurns }); // remaining 40
    await play.init.call(play);
    play.scoreInput.setValue("40");
    await play.submitVisit.call(play);

    await play.denyDouble.call(play);

    expect(play.showDoubleConfirm).toBe(false);
    expect(play.$store.game.turns).toHaveLength(priorTurns.length + 1);
    expect(play.$store.game.turns[priorTurns.length].totalScore).toBe(0);
    expect(play.remainingScore.call(play)).toBe(40); // unchanged by the bust
    expect(play.finished).toBe(false);
  });

  it("a leg win that does not complete the match leaves finished false and opens the next leg", async () => {
    const play = makePlay({
      configSnapshot: bestOf5Config(),
      turns: turnsReaching(40), // remaining 40
    });
    await play.init.call(play);
    play.scoreInput.setValue("40");
    await play.submitVisit.call(play);

    await play.confirmDouble.call(play);

    expect(play.finished).toBe(false);
    expect(play.showMatchFinishConfirm).toBe(false); // leg win only, no second confirm
    expect(play.$store.game.stages).toHaveLength(2); // leg 2 opened
    expect(play.remainingScore.call(play)).toBe(501); // fresh leg
  });
});

describe("submitVisit — unfinishable remainder skips the double confirm", () => {
  it("records a bust directly on a bogey number, no dialog opens", async () => {
    const priorTurns = turnsReaching(169); // bogey number — no double-out route exists
    const play = makePlay({ turns: priorTurns });
    await play.init.call(play);
    play.scoreInput.setValue("169");

    await play.submitVisit.call(play);

    expect(play.showDoubleConfirm).toBe(false);
    expect(play.$store.game.turns).toHaveLength(priorTurns.length + 1);
    expect(play.$store.game.turns[priorTurns.length].totalScore).toBe(0);
    expect(play.remainingScore.call(play)).toBe(169); // unchanged by the bust
  });
});

describe("confirmDouble — leg win vs match win", () => {
  it("opens the match-finish confirm and records nothing when the checkout ends the match", async () => {
    const priorTurns = turnsReaching(40);
    const play = makePlay({ turns: priorTurns }); // Quick Play: legsToWin 1
    await play.init.call(play);
    play.scoreInput.setValue("40");
    await play.submitVisit.call(play);

    await play.confirmDouble.call(play);

    expect(play.showDoubleConfirm).toBe(false);
    expect(play.showMatchFinishConfirm).toBe(true);
    expect(play.pendingCheckoutScore).toBe(40);
    expect(play.$store.game.turns).toHaveLength(priorTurns.length); // nothing recorded yet
    expect(play.finished).toBe(false);
  });
});

describe("confirmMatchFinish", () => {
  it("records the deferred checkout, finishes, and uploads", async () => {
    vi.mocked(appendBatch).mockResolvedValue({
      created: { stages: 1, turns: 2, darts: 0 },
    });
    vi.mocked(completeSession).mockResolvedValue({
      sessionId: "s1",
      statusKey: "COMPLETED",
      completedAt: "now",
    });
    const priorTurns = turnsReaching(40);
    const play = makePlay({ turns: priorTurns });
    await play.init.call(play);
    play.scoreInput.setValue("40");
    await play.submitVisit.call(play);
    await play.confirmDouble.call(play);
    expect(play.showMatchFinishConfirm).toBe(true);

    await play.confirmMatchFinish.call(play);

    expect(play.showMatchFinishConfirm).toBe(false);
    expect(play.pendingCheckoutScore).toBeNull();
    expect(play.$store.game.turns).toHaveLength(priorTurns.length + 1);
    expect(play.$store.game.turns[priorTurns.length].totalScore).toBe(40);
    expect(play.finished).toBe(true);
    expect(play.completionStatus).toBe("succeeded");
    expect(appendBatch).toHaveBeenCalledTimes(1);
    expect(completeSession).toHaveBeenCalledWith("s1", "COMPLETED");
  });
});

describe("cancelMatchFinish", () => {
  it("records nothing and restores the pending score to the input", async () => {
    const priorTurns = turnsReaching(40);
    const play = makePlay({ turns: priorTurns });
    await play.init.call(play);
    play.scoreInput.setValue("40");
    await play.submitVisit.call(play);
    await play.confirmDouble.call(play);
    expect(play.showMatchFinishConfirm).toBe(true);

    play.cancelMatchFinish.call(play);

    expect(play.showMatchFinishConfirm).toBe(false);
    expect(play.pendingCheckoutScore).toBeNull();
    expect(play.scoreInput.value).toBe("40");
    expect(play.$store.game.turns).toHaveLength(priorTurns.length);
    expect(play.finished).toBe(false);
  });
});

describe("cancelCheckout", () => {
  it("records nothing, restores the pending score to the input, and closes the dialog", async () => {
    const priorTurns = turnsReaching(40);
    const play = makePlay({ turns: priorTurns });
    await play.init.call(play);
    play.scoreInput.setValue("40");
    await play.submitVisit.call(play);
    expect(play.showDoubleConfirm).toBe(true);

    play.cancelCheckout.call(play);

    expect(play.showDoubleConfirm).toBe(false);
    expect(play.pendingCheckoutScore).toBeNull();
    expect(play.scoreInput.value).toBe("40");
    expect(play.$store.game.turns).toHaveLength(priorTurns.length);
  });
});

describe("undoVisit", () => {
  it("pops the last visit and mirrors the engine log back into the store", async () => {
    const play = makePlay();
    await play.init.call(play);
    play.scoreInput.setValue("100");
    await play.submitVisit.call(play);
    expect(play.$store.game.turns).toHaveLength(1);

    play.undoVisit.call(play);

    expect(play.$store.game.turns).toHaveLength(0);
    expect(play.error).toBe("");
  });

  it("is a no-op while the double confirm is open", async () => {
    const priorTurns = turnsReaching(40);
    const play = makePlay({ turns: priorTurns });
    await play.init.call(play);
    play.scoreInput.setValue("40");
    await play.submitVisit.call(play);
    expect(play.showDoubleConfirm).toBe(true);

    play.undoVisit.call(play);

    expect(play.$store.game.turns).toHaveLength(priorTurns.length);
  });
});

describe("leg-scoped progress stats", () => {
  it("computes darts thrown, average, and previous score for the current leg only", async () => {
    const play = makePlay({
      turns: [turnFact("t1", "leg-1", 1, 60), turnFact("t2", "leg-1", 2, 45)],
    });
    await play.init.call(play);

    expect(play.dartsThrownThisLeg.call(play)).toBe(6);
    expect(play.averageThisLeg.call(play)).toBe("52.5");
    expect(play.previousScoreThisLeg.call(play)).toBe("45");
  });

  it('shows "—" for previous score when the current leg has no turns yet', async () => {
    const play = makePlay();
    await play.init.call(play);

    expect(play.dartsThrownThisLeg.call(play)).toBe(0);
    expect(play.averageThisLeg.call(play)).toBe("0.0");
    expect(play.previousScoreThisLeg.call(play)).toBe("—");
  });

  it("resets to the new leg's turns only after a leg win", async () => {
    const play = makePlay({
      configSnapshot: bestOf5Config(),
      turns: turnsReaching(40), // remaining 40
    });
    await play.init.call(play);
    play.scoreInput.setValue("40");
    await play.submitVisit.call(play);
    await play.confirmDouble.call(play);

    expect(play.previousScoreThisLeg.call(play)).toBe("—");
    expect(play.dartsThrownThisLeg.call(play)).toBe(0);
  });
});

describe("checkoutHint", () => {
  it("shows the finish route once the remaining score is checkoutable", async () => {
    const play = makePlay({
      turns: turnsReaching(40), // remaining 40
    });
    await play.init.call(play);

    expect(play.checkoutHint.call(play)).toBe("D20");
  });

  it("is empty above 170 or on a bogey number", async () => {
    const play = makePlay(); // remaining 501
    await play.init.call(play);
    expect(play.checkoutHint.call(play)).toBe("");
  });
});

describe("uploadAndCompleteSession", () => {
  it("uploads the batch, completes the session, and snapshots match-wide results", async () => {
    vi.mocked(appendBatch).mockResolvedValue({
      created: { stages: 1, turns: 2, darts: 0 },
    });
    vi.mocked(completeSession).mockResolvedValue({
      sessionId: "s1",
      statusKey: "COMPLETED",
      completedAt: "now",
    });
    const play = makePlay({
      turns: [turnFact("t1", "leg-1", 1, 461), turnFact("t2", "leg-1", 2, 40)],
    });

    await play.uploadAndCompleteSession.call(play);

    expect(appendBatch).toHaveBeenCalledTimes(1);
    expect(completeSession).toHaveBeenCalledWith("s1", "COMPLETED");
    expect(play.completionStatus).toBe("succeeded");
    expect(play.resultsSnapshot).toEqual({
      total: 501,
      legs: 1,
      average: 250.5,
    });
  });

  it("reports legs WON, not legs played, when a Best-of-5 is won 3-1", async () => {
    vi.mocked(appendBatch).mockResolvedValue({
      created: { stages: 4, turns: 4, darts: 0 },
    });
    vi.mocked(completeSession).mockResolvedValue({
      sessionId: "s1",
      statusKey: "COMPLETED",
      completedAt: "now",
    });
    // Four legs played (three won, one lost) — stages.length is 4, legsToWin is 3.
    const play = makePlay({
      configSnapshot: bestOf5Config(),
      stages: [
        LEG_1,
        { ...LEG_1, clientKey: "leg-2", sequence: 2 },
        { ...LEG_1, clientKey: "leg-3", sequence: 3 },
        { ...LEG_1, clientKey: "leg-4", sequence: 4 },
      ],
      turns: [
        turnFact("t1", "leg-1", 1, 501),
        turnFact("t2", "leg-2", 1, 501),
        turnFact("t3", "leg-3", 1, 200),
        turnFact("t4", "leg-4", 1, 501),
      ],
    });

    await play.uploadAndCompleteSession.call(play);

    expect(play.resultsSnapshot?.legs).toBe(3);
  });

  it("treats SESSION_ALREADY_COMPLETED as success", async () => {
    const error = new Error("SESSION_ALREADY_COMPLETED");
    (error as { code?: string }).code = "SESSION_ALREADY_COMPLETED";
    vi.mocked(completeSession).mockRejectedValue(error);
    vi.mocked(appendBatch).mockResolvedValue({
      created: { stages: 1, turns: 1, darts: 0 },
    });
    const play = makePlay({ turns: [turnFact("t1", "leg-1", 1, 501)] });

    await play.uploadAndCompleteSession.call(play);

    expect(play.completionError).toBe("");
    expect(play.completionStatus).toBe("succeeded");
  });

  it('sets completionStatus "failed" on upload error', async () => {
    vi.mocked(appendBatch).mockRejectedValue(new Error("Network error"));
    const play = makePlay({ turns: [turnFact("t1", "leg-1", 1, 501)] });

    await play.uploadAndCompleteSession.call(play);

    expect(play.completionError).toContain("connection");
    expect(play.completionStatus).toBe("failed");
  });

  it("retries uploadAndCompleteSession without recording a new turn, keeping the same idempotency key", async () => {
    const priorTurns = turnsReaching(40);
    const checkoutTurn = turnFact(
      "t-checkout",
      "leg-1",
      priorTurns.length + 1,
      40,
    );
    const play = makePlay({ turns: [...priorTurns, checkoutTurn] });

    vi.mocked(appendBatch).mockRejectedValueOnce(new Error("network blip"));
    await play.uploadAndCompleteSession.call(play);

    expect(play.completionStatus).toBe("failed");
    const keyAfterFailure = play.$store.game.idempotencyKey;
    expect(keyAfterFailure).toBeTruthy();
    const turnCountBeforeRetry = play.$store.game.turns.length;

    vi.mocked(appendBatch).mockResolvedValueOnce({
      created: { stages: 1, turns: priorTurns.length + 1, darts: 0 },
    });
    vi.mocked(completeSession).mockResolvedValue({
      sessionId: "s1",
      statusKey: "COMPLETED",
      completedAt: "now",
    });

    await play.uploadAndCompleteSession.call(play);

    // The regression this test guards against: minting a fresh key on retry
    // would let the server persist the same batch twice under two different
    // idempotency keys.
    expect(play.$store.game.idempotencyKey).toBe(keyAfterFailure);
    expect(play.completionStatus).toBe("succeeded");
    expect(play.$store.game.turns).toHaveLength(turnCountBeforeRetry);
  });
});

describe("full checkout flow drives completion", () => {
  it("confirmDouble defers to the match-finish confirm, and confirmMatchFinish uploads and completes the session", async () => {
    vi.mocked(appendBatch).mockResolvedValue({
      created: { stages: 1, turns: 2, darts: 0 },
    });
    vi.mocked(completeSession).mockResolvedValue({
      sessionId: "s1",
      statusKey: "COMPLETED",
      completedAt: "now",
    });
    const play = makePlay({
      turns: turnsReaching(40), // remaining 40
    });
    await play.init.call(play);
    play.scoreInput.setValue("40");
    await play.submitVisit.call(play);

    await play.confirmDouble.call(play);
    expect(play.finished).toBe(false);
    expect(play.showMatchFinishConfirm).toBe(true);
    expect(appendBatch).not.toHaveBeenCalled();

    await play.confirmMatchFinish.call(play);

    expect(play.finished).toBe(true);
    expect(play.completionStatus).toBe("succeeded");
    expect(appendBatch).toHaveBeenCalledTimes(1);
    expect(completeSession).toHaveBeenCalledWith("s1", "COMPLETED");
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
      created: { stages: 1, turns: 1, darts: 0 },
    });
    vi.mocked(completeSession).mockResolvedValue({
      sessionId: "s1",
      statusKey: "ABANDONED",
      completedAt: "now",
    });
    const play = makePlay({ turns: [turnFact("t1", "leg-1", 1, 60)] });

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
  it("routes createSession through the player's current mode pair, not a hardcoded quick score — a finished visual session stays visual on replay", async () => {
    const play = makePlay(
      {
        turns: [
          turnFact("t1", "leg-1", 1, 461),
          turnFact("t2", "leg-1", 2, 40),
        ],
      },
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
      gameTypeKey: "501",
      rulesetVersionKey: "501_V1",
      captureModeKey: "ANALYTICS",
      inputModeKey: "VISUAL_BOARD",
      config: {
        source: "template",
        templateRef: "tpl-1",
        overrides: { legs_to_win: 1 },
      },
    });
    expect(play.$store.game.sessionId).toBe("new-session");
    expect(play.$store.game.turns).toEqual([]);
    expect(play.finished).toBe(false);
    expect(play.completionStatus).toBe("pending");
    expect(play.resultsSnapshot).toBeNull();
    expect(play.hasActiveSession).toBe(true);

    play.scoreInput.setValue("100");
    await play.submitVisit.call(play);
    expect(play.$store.game.turns).toHaveLength(1);
    expect(play.$store.game.turns[0].sequence).toBe(1);
  });

  it("falls back to quick score when no mode settings are available", async () => {
    const play = makePlay({
      turns: [turnFact("t1", "leg-1", 1, 461), turnFact("t2", "leg-1", 2, 40)],
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

    expect(createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        captureModeKey: "RECREATIONAL",
        inputModeKey: "QUICK_SCORE",
      }),
    );
  });

  it("sets playAgainError and leaves completionStatus untouched on failure", async () => {
    const play = makePlay();
    play.completionStatus = "succeeded";
    vi.mocked(createSession).mockRejectedValue(new Error("Network error"));

    await play.playAgain.call(play);

    expect(play.playAgainError).toBeTruthy();
    expect(play.completionStatus).toBe("succeeded");
  });

  it("threads the original legsToWin into the new session's config override, not the always-single-leg template's stored default", async () => {
    const play = makePlay({ configSnapshot: bestOf5Config() });
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
      gameTypeKey: "501",
      rulesetVersionKey: "501_V1",
      captureModeKey: "RECREATIONAL",
      inputModeKey: "QUICK_SCORE",
      config: {
        source: "template",
        templateRef: "tpl-1",
        overrides: { legs_to_win: 3 },
      },
    });
  });
});

describe("init — engine input mode", () => {
  it("constructs a VISUAL_BOARD engine when the settings store says so", async () => {
    const play = makePlay({}, { inputModeKey: "VISUAL_BOARD" });
    await play.init.call(play);

    await play.recordDart.call(play, SINGLE_20);

    expect(play.$store.game.turns).toHaveLength(1);
    expect(play.$store.game.turns[0].darts).toHaveLength(1);
    expect(play.$store.game.turns[0].darts[0].score).toBe(20);
  });
});

describe("recordDart — plain darts", () => {
  it("opens a visit and records one dart without closing it", async () => {
    const play = makePlay({}, { inputModeKey: "VISUAL_BOARD" });
    await play.init.call(play);

    await play.recordDart.call(play, SINGLE_20);

    expect(play.$store.game.turns).toHaveLength(1);
    expect(play.$store.game.turns[0].completedAt).toBeNull();
    expect(play.$store.game.turns[0].darts).toHaveLength(1);
    // remainingScore folds the still-open visit's running total, so the
    // score drops after this one dart even though the visit has not closed —
    // this is the "live read while dragging/after release" behaviour.
    expect(play.remainingScore.call(play)).toBe(501 - 20);
  });

  it("closes the visit on the third dart and drops the remaining score", async () => {
    const play = makePlay({}, { inputModeKey: "VISUAL_BOARD" });
    await play.init.call(play);

    await play.recordDart.call(play, SINGLE_20);
    await play.recordDart.call(play, SINGLE_20);
    await play.recordDart.call(play, SINGLE_20);

    expect(play.$store.game.turns).toHaveLength(1);
    expect(play.$store.game.turns[0].completedAt).not.toBeNull();
    expect(play.$store.game.turns[0].darts).toHaveLength(3);
    expect(play.remainingScore.call(play)).toBe(501 - 60);
  });

  it("undo removes one dart at a time, not the whole visit", async () => {
    const play = makePlay({}, { inputModeKey: "VISUAL_BOARD" });
    await play.init.call(play);
    await play.recordDart.call(play, SINGLE_20);
    await play.recordDart.call(play, SINGLE_20);

    play.undoVisit.call(play);

    expect(play.$store.game.turns).toHaveLength(1);
    expect(play.$store.game.turns[0].darts).toHaveLength(1);
  });
});

describe("recordDart — checkout on a double vs. the same score on a treble", () => {
  it("a double that reaches zero checks out the leg", async () => {
    const play = makePlay(
      { turns: turnsReaching(40), configSnapshot: bestOf5Config() },
      { inputModeKey: "VISUAL_BOARD" },
    );
    await play.init.call(play);

    await play.recordDart.call(play, DOUBLE_20);

    expect(play.$store.game.stages).toHaveLength(2);
    expect(play.remainingScore.call(play)).toBe(501);
    const closedVisit = play.$store.game.turns.at(-1)!;
    expect(closedVisit.totalScore).toBe(40);
  });

  it("the same score reached on a treble busts instead of checking out", async () => {
    const play = makePlay(
      { turns: turnsReaching(60), configSnapshot: bestOf5Config() },
      { inputModeKey: "VISUAL_BOARD" },
    );
    await play.init.call(play);

    await play.recordDart.call(play, TREBLE_20);

    expect(play.$store.game.stages).toHaveLength(1);
    expect(play.remainingScore.call(play)).toBe(60);
    const bustedVisit = play.$store.game.turns.at(-1)!;
    expect(bustedVisit.totalScore).toBe(0);
    expect(bustedVisit.darts[0]!.score).toBe(60);
  });
});

describe("recordDart — match-ending checkout defers to the confirm dialog", () => {
  it("opens showMatchFinishConfirm instead of recording immediately", async () => {
    const play = makePlay(
      { turns: turnsReaching(40) }, // Quick Play: legsToWin 1
      { inputModeKey: "VISUAL_BOARD" },
    );
    await play.init.call(play);
    const turnCountBefore = play.$store.game.turns.length;

    await play.recordDart.call(play, DOUBLE_20);

    expect(play.showMatchFinishConfirm).toBe(true);
    expect(play.pendingDartObservation).toEqual(DOUBLE_20);
    expect(play.$store.game.turns).toHaveLength(turnCountBefore);
    expect(play.finished).toBe(false);
  });

  it("confirmMatchFinish records the deferred dart, finishes, and uploads", async () => {
    vi.mocked(appendBatch).mockResolvedValue({
      created: { stages: 1, turns: 2, darts: 1 },
    });
    vi.mocked(completeSession).mockResolvedValue({
      sessionId: "s1",
      statusKey: "COMPLETED",
      completedAt: "now",
    });
    const play = makePlay(
      { turns: turnsReaching(40) },
      { inputModeKey: "VISUAL_BOARD" },
    );
    await play.init.call(play);
    await play.recordDart.call(play, DOUBLE_20);
    expect(play.showMatchFinishConfirm).toBe(true);

    await play.confirmMatchFinish.call(play);

    expect(play.showMatchFinishConfirm).toBe(false);
    expect(play.pendingDartObservation).toBeNull();
    expect(play.finished).toBe(true);
    expect(play.completionStatus).toBe("succeeded");
    expect(appendBatch).toHaveBeenCalledTimes(1);
    expect(completeSession).toHaveBeenCalledWith("s1", "COMPLETED");
  });

  it("cancelMatchFinish records nothing and leaves the match open", async () => {
    const play = makePlay(
      { turns: turnsReaching(40) },
      { inputModeKey: "VISUAL_BOARD" },
    );
    await play.init.call(play);
    const turnCountBefore = play.$store.game.turns.length;
    await play.recordDart.call(play, DOUBLE_20);
    expect(play.showMatchFinishConfirm).toBe(true);

    play.cancelMatchFinish.call(play);

    expect(play.showMatchFinishConfirm).toBe(false);
    expect(play.pendingDartObservation).toBeNull();
    expect(play.$store.game.turns).toHaveLength(turnCountBefore);
    expect(play.finished).toBe(false);
    expect(appendBatch).not.toHaveBeenCalled();
  });
});

describe("recordDart — an unseen dart", () => {
  it("records a zero-score MISS dart with no coordinates", async () => {
    const play = makePlay({}, { inputModeKey: "VISUAL_BOARD" });
    await play.init.call(play);

    await play.recordDart.call(play, {
      hitTargetNumber: null,
      hitZoneKey: "MISS",
      locationX: null,
      locationY: null,
    });

    expect(play.$store.game.turns).toHaveLength(1);
    expect(play.$store.game.turns[0].darts[0]).toMatchObject({
      score: 0,
      hitZoneKey: "MISS",
      locationX: null,
      locationY: null,
    });
    expect(play.remainingScore.call(play)).toBe(501);
  });
});
