import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

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
import type { FiveOhOneSnapshot, Seated } from "@lib/types";

const SEATS = [
  {
    participantRef: "participant-1",
    displayName: "Levi",
    sideKey: "A",
    participantTypeKey: "PLAYER" as const,
  },
];

const TWO_SEATS = [
  ...SEATS,
  {
    participantRef: "participant-2",
    displayName: "Guest",
    sideKey: "B",
    participantTypeKey: "GUEST" as const,
  },
];

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
  participantRef = "participant-1",
): TurnFact {
  return {
    clientKey,
    stageClientKey,
    participantRef,
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

function quickPlayConfig(): Seated<FiveOhOneSnapshot> {
  return {
    startingScore: 501,
    legsToWin: 1,
    checkIn: "STRAIGHT_IN",
    checkOut: "DOUBLE_OUT",
    maxDartsPerTurn: 3,
    maxVisitScore: 180,
    seats: SEATS,
  };
}

function bestOf5Config(): Seated<FiveOhOneSnapshot> {
  return { ...quickPlayConfig(), legsToWin: 3 };
}

type GameStub = FiveOhOnePlayContext["$store"]["game"];

function gameStub(overrides: Partial<GameStub> = {}): GameStub {
  return {
    get seats() {
      return this.configSnapshot?.seats ?? [];
    },
    rulesetVersionKey: "501_V1",
    sessionId: "s1",
    templateRef: "tpl-1",
    configSnapshot: quickPlayConfig(),
    captureModeKey: "RECREATIONAL",
    inputModeKey: "QUICK_SCORE",
    stages: [LEG_1],
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

describe("matchTitle", () => {
  it("falls back to 501 before a session's config has loaded", () => {
    const play = makePlay({ configSnapshot: null });
    expect(play.matchTitle()).toBe("501");
  });

  it("reads the configured leg count once loaded", () => {
    const play = makePlay({ configSnapshot: bestOf5Config() });
    expect(play.matchTitle()).toBe("First to 3 legs");
  });

  it("updates when a different leg count is configured", () => {
    const play = makePlay({
      configSnapshot: { ...bestOf5Config(), legsToWin: 5 },
    });
    expect(play.matchTitle()).toBe("First to 5 legs");
  });
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

describe("progress stats", () => {
  it("computes leg-scoped darts thrown and match-wide average/previous score", async () => {
    const play = makePlay({
      turns: [turnFact("t1", "leg-1", 1, 60), turnFact("t2", "leg-1", 2, 45)],
    });
    await play.init.call(play);

    expect(play.dartsThrownThisLeg.call(play)).toBe(6);
    expect(play.average.call(play)).toBe("52.5");
    expect(play.previousScore.call(play)).toBe("45");
  });

  it('shows "—" for previous score before the match has any turns', async () => {
    const play = makePlay();
    await play.init.call(play);

    expect(play.dartsThrownThisLeg.call(play)).toBe(0);
    expect(play.average.call(play)).toBe("0.0");
    expect(play.previousScore.call(play)).toBe("—");
  });

  it("resets darts thrown to the new leg but keeps average/previous score across the leg boundary", async () => {
    const play = makePlay({
      configSnapshot: bestOf5Config(),
      turns: turnsReaching(40), // remaining 40
    });
    await play.init.call(play);
    play.scoreInput.setValue("40");
    await play.submitVisit.call(play);
    await play.confirmDouble.call(play);

    // Leg 1 won: a new leg's stage opens with no turns of its own yet.
    expect(play.dartsThrownThisLeg.call(play)).toBe(0);

    // The match's own average and previous score are not leg-scoped, so the
    // just-finished leg's turns (including its checkout) must still count.
    expect(play.previousScore.call(play)).toBe("40");
    expect(play.average.call(play)).not.toBe("0.0");
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

describe("seat-parameterized getters — two-seat isolation", () => {
  const SEAT_B = "participant-2";

  function twoSeatConfig() {
    return {
      ...quickPlayConfig(),
      seats: [
        ...SEATS,
        {
          participantRef: SEAT_B,
          displayName: "Sam",
          sideKey: "B",
          participantTypeKey: "GUEST" as const,
        },
      ],
    };
  }

  it("remainingScoreFor reads only the named seat's own remaining score", async () => {
    const seatATurns = turnsReaching(40); // participant-1 down to 40
    const seatBTurn = turnFact("tB1", "leg-1", 2, 60, SEAT_B); // participant-2 scored 60
    const play = makePlay({
      configSnapshot: twoSeatConfig(),
      turns: [...seatATurns, seatBTurn],
    });
    await play.init.call(play);

    expect(play.remainingScoreFor.call(play, "participant-1")).toBe(40);
    expect(play.remainingScoreFor.call(play, SEAT_B)).toBe(501 - 60);
  });

  it("remainingScore() delegates to the active seat", async () => {
    const play = makePlay({ configSnapshot: twoSeatConfig() });
    await play.init.call(play);

    expect(play.remainingScore.call(play)).toBe(
      play.remainingScoreFor.call(
        play,
        play.state.call(play)!.activeParticipantRef,
      ),
    );
  });

  it("averageFor and previousScoreFor do not leak one seat's visits into the other's", async () => {
    const play = makePlay({
      configSnapshot: twoSeatConfig(),
      turns: [
        turnFact("t1", "leg-1", 1, 100, "participant-1"),
        turnFact("t2", "leg-1", 2, 45, SEAT_B),
      ],
    });
    await play.init.call(play);

    expect(play.previousScoreFor.call(play, "participant-1")).toBe("100");
    expect(play.previousScoreFor.call(play, SEAT_B)).toBe("45");
    expect(play.averageFor.call(play, "participant-1")).not.toBe(
      play.averageFor.call(play, SEAT_B),
    );
  });

  it("dartsThrownThisLegFor counts only the named seat's own visits in the open leg", async () => {
    const play = makePlay({
      configSnapshot: twoSeatConfig(),
      turns: [
        turnFact("t1", "leg-1", 1, 60, "participant-1"),
        turnFact("t2", "leg-1", 2, 45, SEAT_B),
        turnFact("t3", "leg-1", 3, 60, "participant-1"),
      ],
    });
    await play.init.call(play);

    expect(play.dartsThrownThisLegFor.call(play, "participant-1")).toBe(6);
    expect(play.dartsThrownThisLegFor.call(play, SEAT_B)).toBe(3);
  });

  it("checkoutHintFor reads the named seat's own remaining score", async () => {
    const play = makePlay({
      configSnapshot: twoSeatConfig(),
      turns: turnsReaching(40), // only participant-1 has thrown
    });
    await play.init.call(play);

    expect(play.checkoutHintFor.call(play, "participant-1")).toBe("D20");
    expect(play.checkoutHintFor.call(play, SEAT_B)).toBe(""); // untouched, still 501 — not checkoutable
  });

  it("legsWonFor reads each seat's own side (0 legs won at the start of a fresh match)", async () => {
    const play = makePlay({ configSnapshot: twoSeatConfig() });
    await play.init.call(play);

    expect(play.legsWonFor.call(play, "participant-1")).toBe(0);
    expect(play.legsWonFor.call(play, SEAT_B)).toBe(0);
  });
});

describe("uploadAndCompleteSession", () => {
  it("computes each seat's own stats from only its own visits, not the other seat's", async () => {
    vi.mocked(appendBatch).mockResolvedValue({
      created: { stages: 1, turns: 3, darts: 0 },
    });
    vi.mocked(completeSession).mockResolvedValue({
      sessionId: "s1",
      statusKey: "COMPLETED",
      completedAt: "now",
    });
    const play = makePlay({
      configSnapshot: {
        ...quickPlayConfig(),
        seats: [
          {
            participantRef: "seat-a",
            displayName: "Levi",
            sideKey: "A",
            participantTypeKey: "PLAYER",
          },
          {
            participantRef: "seat-b",
            displayName: "Dad",
            sideKey: "B",
            participantTypeKey: "GUEST",
          },
        ],
      },
      turns: [
        turnFact("t1", "leg-1", 1, 100, "seat-a"),
        turnFact("t2", "leg-1", 2, 40, "seat-b"),
        turnFact("t3", "leg-1", 3, 60, "seat-a"),
      ],
    });

    await play.uploadAndCompleteSession.call(play);

    expect(play.resultsSnapshot).toEqual({
      winningSideKey: null,
      seats: [
        {
          participantRef: "seat-a",
          sideKey: "A",
          legsWon: 0,
          threeDartAverage: "80.0",
          checkoutPercentage: null,
          sixtyPlus: 1,
          hundredPlus: 1,
          oneTwentyPlus: 0,
          oneFortyPlus: 0,
          oneEighties: 0,
        },
        {
          participantRef: "seat-b",
          sideKey: "B",
          legsWon: 0,
          threeDartAverage: "40.0",
          checkoutPercentage: null,
          sixtyPlus: 0,
          hundredPlus: 0,
          oneTwentyPlus: 0,
          oneFortyPlus: 0,
          oneEighties: 0,
        },
      ],
    });
  });

  it("uploads the batch, completes the session, and snapshots per-seat results", async () => {
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
      winningSideKey: null,
      seats: [
        {
          participantRef: "participant-1",
          sideKey: "A",
          legsWon: 1,
          threeDartAverage: "250.5",
          checkoutPercentage: null,
          sixtyPlus: 0,
          hundredPlus: 0,
          oneTwentyPlus: 0,
          oneFortyPlus: 1,
          oneEighties: 0,
        },
      ],
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

    expect(play.resultsSnapshot?.seats[0]?.legsWon).toBe(3);
    // Solo session: no side to compare against, so no winner is declared.
    expect(play.resultsSnapshot?.winningSideKey).toBeNull();
  });

  it("computes independent per-seat stats for a 1v1 QUICK_SCORE match", async () => {
    vi.mocked(appendBatch).mockResolvedValue(undefined as never);
    vi.mocked(completeSession).mockResolvedValue(undefined as never);

    const play = makePlay({
      configSnapshot: { ...quickPlayConfig(), legsToWin: 1, seats: TWO_SEATS },
      inputModeKey: "QUICK_SCORE",
    });
    await play.init.call(play);

    // Turn 0 (participant-1, remaining 501 -> 380)
    play.scoreInput.setValue("121");
    await play.submitVisit.call(play);
    // Turn 1 (participant-2, remaining 501 -> 401)
    play.scoreInput.setValue("100");
    await play.submitVisit.call(play);
    // Turn 2 (participant-1, remaining 380 -> 200)
    play.scoreInput.setValue("180");
    await play.submitVisit.call(play);
    // Turn 3 (participant-2, remaining 401 -> 301)
    play.scoreInput.setValue("100");
    await play.submitVisit.call(play);
    // Turn 4 (participant-1, remaining 200 -> 20)
    play.scoreInput.setValue("180");
    await play.submitVisit.call(play);
    // Turn 5 (participant-2, remaining 301 -> 201)
    play.scoreInput.setValue("100");
    await play.submitVisit.call(play);
    // Turn 6 (participant-1, remaining 20 -> 0 on D10): opens the
    // double-out confirm, then the match-finish confirm (this is the only
    // leg, legsToWin: 1, so checking it out wins the whole match).
    play.scoreInput.setValue("20");
    await play.submitVisit.call(play);
    expect(play.showDoubleConfirm).toBe(true);
    await play.confirmDouble.call(play);
    expect(play.showMatchFinishConfirm).toBe(true);
    await play.confirmMatchFinish.call(play);

    expect(play.resultsSnapshot?.winningSideKey).toBe("A");
    expect(play.resultsSnapshot?.seats).toHaveLength(2);
    const [seatA, seatB] = play.resultsSnapshot!.seats;
    expect(seatA.participantRef).toBe("participant-1");
    expect(seatA.legsWon).toBe(1);
    expect(seatB.participantRef).toBe("participant-2");
    expect(seatB.legsWon).toBe(0);
    expect(seatA.checkoutPercentage).toBeNull();
    expect(seatB.checkoutPercentage).toBeNull();
    expect(play.resultsTitle.call(play)).toBe("Levi wins the match!");
  });

  it("computes a VISUAL_BOARD checkout percentage from a busted attempt and two won legs", async () => {
    vi.mocked(fetchActiveSessions).mockResolvedValue([
      { ...ACTIVE_SESSION, inputModeKey: "VISUAL_BOARD" },
    ]);
    vi.mocked(appendBatch).mockResolvedValue(undefined as never);
    vi.mocked(completeSession).mockResolvedValue(undefined as never);

    const play = makePlay({
      configSnapshot: {
        ...quickPlayConfig(),
        startingScore: 40,
        legsToWin: 2,
      },
      inputModeKey: "VISUAL_BOARD",
    });
    await play.init.call(play);

    // Leg 1, visit 1: a single TREBLE_20 (60) overshoots 40 by 20 -> busts
    // immediately (remainingAfter -20). This is the one failed checkout
    // attempt: darts summed to 60 (> 0) but totalScore records 0.
    await play.recordDart.call(play, TREBLE_20);
    // Leg 1, visit 2: a single DOUBLE_20 (40) zeroes the remaining 40
    // exactly on a double -> checks out, wins leg 1. Does not complete the
    // whole match (legsToWin: 2), so this commits immediately with no
    // confirm dialog.
    await play.recordDart.call(play, DOUBLE_20);
    // Leg 2 opens fresh at remaining 40 (same startingScore every leg).
    // A DOUBLE_20 here would win the whole match, so recordDart defers to
    // the match-finish confirm instead of committing immediately.
    await play.recordDart.call(play, DOUBLE_20);
    expect(play.showMatchFinishConfirm).toBe(true);
    await play.confirmMatchFinish.call(play);

    const [seatA] = play.resultsSnapshot!.seats;
    expect(seatA.legsWon).toBe(2);
    // made = legsWon = 2, attempted = 2 + checkoutAttemptCount (1 bust) = 3
    expect(seatA.checkoutPercentage).toBe("66.67%");
  });

  it("returns the single-seat shape for a solo session", async () => {
    vi.mocked(appendBatch).mockResolvedValue(undefined as never);
    vi.mocked(completeSession).mockResolvedValue(undefined as never);

    const play = makePlay({
      configSnapshot: { ...quickPlayConfig(), startingScore: 20, legsToWin: 1 },
    });
    await play.init.call(play);

    // remaining 20 -> 0 on D10 in one visit, wins the only leg and the match.
    play.scoreInput.setValue("20");
    await play.submitVisit.call(play);
    await play.confirmDouble.call(play);
    await play.confirmMatchFinish.call(play);

    expect(play.resultsSnapshot?.winningSideKey).toBeNull();
    expect(play.resultsSnapshot?.seats).toHaveLength(1);
    expect(play.resultsSnapshot?.seats[0].legsWon).toBe(1);
    expect(play.resultsTitle.call(play)).toBe("Match Summary");
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

  it("replays a 1v1 match with both seats, engine-seated on the NEW session's refs", async () => {
    const play = makePlay({
      configSnapshot: { ...quickPlayConfig(), seats: TWO_SEATS },
    });
    play.completionStatus = "succeeded";
    play.finished = true;

    vi.mocked(createSession).mockResolvedValue({
      sessionId: "new-session",
      participants: [
        {
          ref: "new-participant-1",
          displayName: "Levi",
          participantTypeKey: "PLAYER",
        },
        {
          ref: "new-participant-2",
          displayName: "Guest",
          participantTypeKey: "GUEST",
        },
      ],
    } as any);

    await play.playAgain.call(play);

    expect(vi.mocked(createSession).mock.calls[0][0].participants).toEqual([
      { participantTypeKey: "PLAYER", sideKey: "A" },
      { participantTypeKey: "GUEST", displayName: "Guest", sideKey: "B" },
    ]);
    expect(
      play.engine?.state().seats.map((seat) => seat.participantRef),
    ).toEqual(["new-participant-1", "new-participant-2"]);
  });

  it("a solo replay still seats one participant and sends no participants field", async () => {
    const play = makePlay();
    play.completionStatus = "succeeded";
    play.finished = true;

    vi.mocked(createSession).mockResolvedValue({
      sessionId: "new-session",
      participants: [
        {
          ref: "new-participant",
          displayName: "Levi",
          participantTypeKey: "PLAYER",
        },
      ],
    } as any);

    await play.playAgain.call(play);

    expect(
      vi.mocked(createSession).mock.calls[0][0].participants,
    ).toBeUndefined();
    expect(
      play.engine?.state().seats.map((seat) => seat.participantRef),
    ).toEqual(["new-participant"]);
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

describe("recordDart — reveal-then-clear board markers", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps the closed visit's markers visible, then clears them after 1500ms", async () => {
    const play = makePlay({}, { inputModeKey: "VISUAL_BOARD" });
    await play.init.call(play);

    await play.recordDart.call(play, SINGLE_20);
    await play.recordDart.call(play, SINGLE_20);
    await play.recordDart.call(play, SINGLE_20);

    const clientKey = play.$store.game.turns[0].clientKey;
    expect(play.hiddenTurnKey).toBeNull();
    expect(play.visitMarkers.call(play)).not.toEqual([]);

    vi.advanceTimersByTime(1500);

    expect(play.hiddenTurnKey).toBe(clientKey);
    expect(play.visitMarkers.call(play)).toEqual([]);
  });

  it("undoVisit cancels a pending hide timer so a reopened visit stays visible", async () => {
    const play = makePlay({}, { inputModeKey: "VISUAL_BOARD" });
    await play.init.call(play);
    await play.recordDart.call(play, SINGLE_20);
    await play.recordDart.call(play, SINGLE_20);
    await play.recordDart.call(play, SINGLE_20);

    vi.advanceTimersByTime(1000);
    play.undoVisit.call(play);
    vi.advanceTimersByTime(1000);

    expect(play.hiddenTurnKey).toBeNull();
  });

  it("playAgain resets hiddenTurnKey so the new session's board starts clear", async () => {
    vi.mocked(createSession).mockResolvedValue({
      sessionId: "s2",
      participants: [
        {
          ref: "participant-1",
          displayName: "Player",
          participantTypeKey: "PLAYER",
        },
      ],
    } as any);
    const play = makePlay(
      { turns: turnsReaching(40), configSnapshot: bestOf5Config() },
      { inputModeKey: "VISUAL_BOARD" },
    );
    await play.init.call(play);
    await play.recordDart.call(play, DOUBLE_20);
    vi.advanceTimersByTime(1500);
    expect(play.hiddenTurnKey).not.toBeNull();

    await play.playAgain.call(play);

    expect(play.hiddenTurnKey).toBeNull();
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

describe("checkout dart counts", () => {
  it("offers the counts the finished score's route allows, preselecting the shortest", async () => {
    const play = makePlay({ turns: turnsReaching(41) });
    await play.init.call(play);
    play.scoreInput.setValue("41");

    await play.submitVisit.call(play);

    expect(play.checkoutDartOptions.call(play)).toEqual({
      toFinish: [2, 3],
      atDouble: [1, 2],
    });
    expect(play.dartsToFinish).toBe(2);
    expect(play.dartsAtDouble).toBe(1);
  });

  it("clears the counts once the checkout is recorded", async () => {
    const play = makePlay({
      configSnapshot: bestOf5Config(),
      turns: turnsReaching(40),
    });
    await play.init.call(play);
    play.scoreInput.setValue("40");
    await play.submitVisit.call(play);

    await play.confirmDouble.call(play);

    expect(play.dartsToFinish).toBeNull();
    expect(play.dartsAtDouble).toBeNull();
  });

  it("surfaces the engine's rejection when the counts cannot be true", async () => {
    const priorTurns = turnsReaching(41);
    const play = makePlay({ turns: priorTurns });
    await play.init.call(play);
    play.scoreInput.setValue("41");
    await play.submitVisit.call(play);
    play.dartsToFinish = 1;

    await play.confirmDouble.call(play);

    expect(play.$store.game.turns).toHaveLength(priorTurns.length);
    expect(play.error).toMatch(/at least 2 darts/);
  });

  it("cancelCheckout clears the counts along with the pending score", async () => {
    const play = makePlay({ turns: turnsReaching(40) });
    await play.init.call(play);
    play.scoreInput.setValue("40");
    await play.submitVisit.call(play);

    play.cancelCheckout.call(play);

    expect(play.dartsToFinish).toBeNull();
    expect(play.dartsAtDouble).toBeNull();
    expect(play.scoreInput.value).toBe("40");
  });
});
