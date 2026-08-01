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

import { fetchActiveSessions } from "@client/api/sessions";
import {
  registerEngineFactory,
  resetEngineRegistry,
} from "@modules/game/engine.registry";
import { fiveOhOneEngineFactory } from "@modules/game/five-oh-one.engine.module";
import { fiveOhOnePlay } from "@lib/game/five-oh-one-play.data";
import type { FiveOhOnePlayContext } from "@lib/types";
import type { EngineFacts, StageFact, TurnFact } from "@modules/types";
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

function makePlay(gameOverrides: Partial<GameStub> = {}) {
  return {
    ...fiveOhOnePlay(),
    $store: { game: gameStub(gameOverrides) },
  } as FiveOhOnePlayContext;
}

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

  it("confirmDouble records a checkout and wins the leg", async () => {
    const priorTurns = turnsReaching(40);
    const play = makePlay({ turns: priorTurns }); // remaining 40
    await play.init.call(play);
    play.scoreInput.setValue("40");
    await play.submitVisit.call(play);

    await play.confirmDouble.call(play);

    expect(play.showDoubleConfirm).toBe(false);
    expect(play.pendingCheckoutScore).toBeNull();
    expect(play.$store.game.turns).toHaveLength(priorTurns.length + 1);
    expect(play.$store.game.turns[priorTurns.length].totalScore).toBe(40);
    expect(play.finished).toBe(true); // Quick Play: legsToWin 1, this checkout wins the match
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
    expect(play.$store.game.stages).toHaveLength(2); // leg 2 opened
    expect(play.remainingScore.call(play)).toBe(501); // fresh leg
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
