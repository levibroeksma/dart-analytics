import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@client/api/sessions", () => ({
  appendBatch: vi.fn(),
  completeSession: vi.fn(),
  fetchActiveSessions: vi.fn(),
  createSession: vi.fn(),
}));

const segmentTimerInstances: Array<{
  options: Record<string, unknown>;
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
}> = [];

vi.mock("@modules/ui/segment-timer.module", () => ({
  SegmentTimer: vi.fn().mockImplementation(function (
    options: Record<string, unknown>,
  ) {
    const instance = { options, start: vi.fn(), stop: vi.fn() };
    segmentTimerInstances.push(instance);
    return instance;
  }),
}));

import {
  appendBatch,
  completeSession,
  createSession,
  fetchActiveSessions,
} from "@client/api/sessions";
import { SegmentTimer } from "@modules/ui/segment-timer.module";
import {
  registerEngineFactory,
  resetEngineRegistry,
} from "@modules/game/engine.registry";
import { tuodEngineFactory } from "@modules/game/tuod.engine.module";
import type { GameEngine, GameEngineFactory } from "@modules/interfaces";
import { tuodPlay } from "@lib/game/tuod-play.data";
import type { TuodPlayContext, TuodSnapshot, Seated } from "@lib/types";
import type {
  EngineFacts,
  StageFact,
  TuodAttemptInput,
  TurnFact,
} from "@modules/types";

/** A checkout the ladder's opening target (41) can actually be finished in. */
const CHECKOUT: TuodAttemptInput = {
  checkedOut: true,
  finishedOnDouble: true,
  dartsUsed: 2,
  dartsAtDouble: 1,
};

const MISS: TuodAttemptInput = { checkedOut: false };

const BLOCK: StageFact = {
  clientKey: "block-1",
  stageTypeKey: "EXERCISE_BLOCK",
  parentClientKey: null,
  sequence: 1,
};

function turnFact(
  clientKey: string,
  sequence: number,
  totalScore: number,
): TurnFact {
  return {
    clientKey,
    stageClientKey: BLOCK.clientKey,
    participantRef: "participant-1",
    sequence,
    completedAt: "2026-08-20T10:00:00.000Z",
    totalScore,
    darts: [],
  };
}

function rounds(durationValue: number): Seated<TuodSnapshot> {
  return {
    startingTarget: 41,
    finishBonus: 10,
    missPenalty: 1,
    durationType: "ROUNDS",
    durationValue,
    maxDartsPerTurn: 3,
    seats: SEATS,
  };
}

function minutes(durationValue: number): Seated<TuodSnapshot> {
  return {
    startingTarget: 41,
    finishBonus: 10,
    missPenalty: 1,
    durationType: "MINUTES",
    durationValue,
    maxDartsPerTurn: 3,
    seats: SEATS,
  };
}

type GameStub = TuodPlayContext["$store"]["game"];
type SettingsStub = TuodPlayContext["$store"]["settings"];

function settingsStub(overrides: Partial<SettingsStub> = {}): SettingsStub {
  return {
    captureModeKey: "RECREATIONAL",
    inputModeKey: "QUICK_SCORE",
    ...overrides,
  };
}

function gameStub(overrides: Partial<GameStub> = {}): GameStub {
  return {
    get seats() {
      return this.configSnapshot?.seats ?? [];
    },
    rulesetVersionKey: "TUOD_V1",
    sessionId: "s1",
    templateRef: "tpl-1",
    configSnapshot: rounds(3),
    captureModeKey: "RECREATIONAL",
    inputModeKey: "QUICK_SCORE",
    stages: [BLOCK],
    turns: [],
    timerRemainingMs: null,
    timerStartedAt: null,
    timerExpired: false,
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

const ACTIVE_SESSION = {
  sessionId: "s1",
  gameTypeKey: "TUOD",
  gameTypeName: "Ten Up One Down",
  captureModeKey: "RECREATIONAL",
  inputModeKey: "QUICK_SCORE",
  rulesetVersionKey: "TUOD_V1",
  startedAt: "now",
} as const;

describe("tuodPlay", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    segmentTimerInstances.length = 0;
    vi.mocked(fetchActiveSessions).mockResolvedValue([{ ...ACTIVE_SESSION }]);
  });

  it("records a checked-out attempt: the turn total is the target it was thrown at", async () => {
    const store = gameStub();
    const component = {
      ...tuodPlay(),
      $store: { game: store, settings: settingsStub() },
    };
    await component.init.call(component);
    await component.recordAttempt.call(component, CHECKOUT);

    expect(store.turns).toHaveLength(1);
    expect(store.turns[0].totalScore).toBe(41);
  });

  it("records a missed attempt as a zero-scoring turn", async () => {
    const store = gameStub();
    const component = {
      ...tuodPlay(),
      $store: { game: store, settings: settingsStub() },
    };
    await component.init.call(component);
    await component.recordAttempt.call(component, MISS);

    expect(store.turns).toHaveLength(1);
    expect(store.turns[0].totalScore).toBe(0);
  });

  it("climbs the ladder +10 on success and reads it back from currentTargetLabel", async () => {
    const store = gameStub({ configSnapshot: rounds(5) });
    const component = {
      ...tuodPlay(),
      $store: { game: store, settings: settingsStub() },
    };
    await component.init.call(component);
    expect(component.currentTargetLabel.call(component)).toBe("41");

    await component.recordAttempt.call(component, CHECKOUT);

    expect(component.currentTargetLabel.call(component)).toBe("51");
  });

  it("uploads the batch and completes the session on the final attempt", async () => {
    const store = gameStub({ configSnapshot: rounds(2) });
    vi.mocked(appendBatch).mockResolvedValue({
      created: { stages: 1, turns: 2, darts: 0 },
    });
    vi.mocked(completeSession).mockResolvedValue({
      sessionId: "s1",
      statusKey: "COMPLETED",
      completedAt: "now",
    });
    const component = {
      ...tuodPlay(),
      $store: { game: store, settings: settingsStub() },
    };
    await component.init.call(component);
    await component.recordAttempt.call(component, CHECKOUT); // attempt 1
    await component.recordAttempt.call(component, MISS); // would complete

    expect(component.showFinishConfirm).toBe(true);
    expect(appendBatch).not.toHaveBeenCalled();

    await component.confirmFinish.call(component);

    expect(appendBatch).toHaveBeenCalledTimes(1);
    expect(completeSession).toHaveBeenCalledWith("s1", "COMPLETED");
    expect(component.finished).toBe(true);
    expect(component.completionStatus).toBe("succeeded");
    expect(store.turns).toHaveLength(2);
  });

  describe("finish confirm gate", () => {
    it("stashes the pending attempt and does not commit or upload", async () => {
      const store = gameStub({ configSnapshot: rounds(1) });
      const component = {
        ...tuodPlay(),
        $store: { game: store, settings: settingsStub() },
      };
      await component.init.call(component);

      await component.recordAttempt.call(component, CHECKOUT);

      expect(store.turns).toHaveLength(0);
      expect(component.showFinishConfirm).toBe(true);
      expect(component.pendingAttempt).toEqual(CHECKOUT);
      expect(component.finished).toBe(false);
      expect(appendBatch).not.toHaveBeenCalled();
    });

    it("cancelFinish discards the pending attempt without committing", async () => {
      const store = gameStub({ configSnapshot: rounds(1) });
      const component = {
        ...tuodPlay(),
        $store: { game: store, settings: settingsStub() },
      };
      await component.init.call(component);
      await component.recordAttempt.call(component, CHECKOUT);

      component.cancelFinish();

      expect(component.showFinishConfirm).toBe(false);
      expect(component.pendingAttempt).toBeNull();
      expect(store.turns).toHaveLength(0);
      expect(component.finished).toBe(false);
    });

    it("confirmFinish commits the pending attempt, sets finished, and uploads", async () => {
      const store = gameStub({ configSnapshot: rounds(1) });
      vi.mocked(appendBatch).mockResolvedValue({
        created: { stages: 1, turns: 1, darts: 0 },
      });
      vi.mocked(completeSession).mockResolvedValue({
        sessionId: "s1",
        statusKey: "COMPLETED",
        completedAt: "now",
      });
      const component = {
        ...tuodPlay(),
        $store: { game: store, settings: settingsStub() },
      };
      await component.init.call(component);
      await component.recordAttempt.call(component, CHECKOUT);

      await component.confirmFinish.call(component);

      expect(store.turns).toHaveLength(1);
      expect(store.turns[0].totalScore).toBe(41);
      expect(component.showFinishConfirm).toBe(false);
      expect(component.pendingAttempt).toBeNull();
      expect(component.finished).toBe(true);
      expect(appendBatch).toHaveBeenCalledTimes(1);
    });
  });

  describe("reconciliation on init", () => {
    it('resumes silently on "match" — no modal, hasActiveSession = true', async () => {
      const store = gameStub({
        sessionId: "match-id",
        configSnapshot: rounds(20),
      });
      vi.mocked(fetchActiveSessions).mockResolvedValue([
        { ...ACTIVE_SESSION, sessionId: "match-id" },
      ]);
      const component = {
        ...tuodPlay(),
        $store: { game: store, settings: settingsStub() },
      };
      await component.init.call(component);

      expect(component.hasActiveSession).toBe(true);
      expect(store.reset).not.toHaveBeenCalled();
    });

    it('shows no-active-session view on "no_active" (mismatch auto-abandoned)', async () => {
      const store = gameStub({ sessionId: "different-id" });
      vi.mocked(fetchActiveSessions).mockResolvedValue([
        { ...ACTIVE_SESSION, sessionId: "server-id" },
      ]);
      vi.mocked(completeSession).mockResolvedValue({
        sessionId: "server-id",
        statusKey: "ABANDONED",
        completedAt: "now",
      });
      const component = {
        ...tuodPlay(),
        $store: { game: store, settings: settingsStub() },
      };
      await component.init.call(component);

      expect(completeSession).toHaveBeenCalledWith("server-id", "ABANDONED");
      expect(store.reset).toHaveBeenCalled();
      expect(component.hasActiveSession).toBe(false);
    });

    it("preserves turns array on resume (no clear)", async () => {
      const store = gameStub({
        sessionId: "match-id",
        configSnapshot: rounds(20),
        turns: [turnFact("t1", 1, 41)],
      });
      vi.mocked(fetchActiveSessions).mockResolvedValue([
        { ...ACTIVE_SESSION, sessionId: "match-id" },
      ]);
      const component = {
        ...tuodPlay(),
        $store: { game: store, settings: settingsStub() },
      };
      await component.init.call(component);

      expect(store.turns).toHaveLength(1);
      expect(store.turns[0].clientKey).toBe("t1");
    });

    it("leaves the session unplayable when no engine is registered for the persisted ruleset", async () => {
      const store = gameStub({ rulesetVersionKey: "BOBS27_V1" });
      const component = {
        ...tuodPlay(),
        $store: { game: store, settings: settingsStub() },
      };
      await component.init.call(component);

      expect(component.engine).toBeNull();
      expect(component.hasActiveSession).toBe(false);
    });
  });

  describe("cross-game engine guard", () => {
    afterEach(() => {
      resetEngineRegistry();
      registerEngineFactory(tuodEngineFactory);
    });

    it("refuses to build an engine for a ruleset this page does not own", async () => {
      const foreignEngine: GameEngine<unknown, unknown> = {
        rulesetVersionKey: "BOBS27_V1",
        stageOwnership: "PER_SEAT",
        record: () => ({}),
        undo: () => false,
        wouldComplete: () => false,
        isComplete: () => false,
        state: () => ({}),
        facts: () => ({ stages: [], turns: [] }),
      };
      const foreignCreate = vi.fn(() => foreignEngine);
      const foreignFactory: GameEngineFactory<unknown, unknown, unknown> = {
        rulesetVersionKey: "BOBS27_V1",
        stageOwnership: "PER_SEAT",
        create: foreignCreate,
      };
      registerEngineFactory(foreignFactory);

      const store = gameStub({ rulesetVersionKey: "BOBS27_V1" });
      const component = {
        ...tuodPlay(),
        $store: { game: store, settings: settingsStub() },
      };
      await component.init.call(component);

      expect(foreignCreate).not.toHaveBeenCalled();
      expect(component.engine).toBeNull();
    });
  });

  describe("MINUTES duration mode timer wiring", () => {
    it("instantiates and starts a SegmentTimer whose onComplete sets store.timerExpired and expires the engine", async () => {
      const store = gameStub({ configSnapshot: minutes(15) });
      const component = {
        ...tuodPlay(),
        $store: { game: store, settings: settingsStub() },
      };
      await component.init.call(component);

      expect(SegmentTimer).toHaveBeenCalledTimes(1);
      const instance = segmentTimerInstances[0];
      expect(instance.options.totalMinutes).toBe(15);
      expect(instance.start).toHaveBeenCalledTimes(1);

      expect(store.timerExpired).toBe(false);
      (instance.options.onComplete as () => void)();
      expect(store.timerExpired).toBe(true);
    });

    it("lets the current attempt finish after the timer expires, then completes on the next", async () => {
      const store = gameStub({ configSnapshot: minutes(15) });
      vi.mocked(appendBatch).mockResolvedValue({
        created: { stages: 1, turns: 2, darts: 0 },
      });
      vi.mocked(completeSession).mockResolvedValue({
        sessionId: "s1",
        statusKey: "COMPLETED",
        completedAt: "now",
      });
      const component = {
        ...tuodPlay(),
        $store: { game: store, settings: settingsStub() },
      };
      await component.init.call(component);

      (segmentTimerInstances[0].options.onComplete as () => void)();

      await component.recordAttempt.call(component, CHECKOUT);

      expect(component.showFinishConfirm).toBe(true);

      await component.confirmFinish.call(component);

      expect(store.turns).toHaveLength(1);
      expect(component.finished).toBe(true);
    });

    it("does not instantiate a SegmentTimer in ROUNDS mode", async () => {
      const store = gameStub();
      const component = {
        ...tuodPlay(),
        $store: { game: store, settings: settingsStub() },
      };
      await component.init.call(component);
      expect(SegmentTimer).not.toHaveBeenCalled();
    });

    it("destroy() stops the timer", async () => {
      const store = gameStub({ configSnapshot: minutes(15) });
      const component = {
        ...tuodPlay(),
        $store: { game: store, settings: settingsStub() },
      };
      await component.init.call(component);
      const instance = segmentTimerInstances[0];
      component.destroy.call(component);
      expect(instance.stop).toHaveBeenCalledTimes(1);
    });

    it("destroy() does not throw when no timer was ever started (ROUNDS mode)", async () => {
      const store = gameStub();
      const component = {
        ...tuodPlay(),
        $store: { game: store, settings: settingsStub() },
      };
      await component.init.call(component);
      expect(() => component.destroy.call(component)).not.toThrow();
    });
  });

  describe("undoAttempt", () => {
    it("pops the engine log and mirrors it into the store", async () => {
      const store = gameStub({ configSnapshot: rounds(20) });
      const component = {
        ...tuodPlay(),
        $store: { game: store, settings: settingsStub() },
      };
      await component.init.call(component);
      await component.recordAttempt.call(component, CHECKOUT);
      expect(store.turns).toHaveLength(1);

      component.undoAttempt();

      expect(store.turns).toHaveLength(0);
      expect(component.error).toBe("");
    });

    it("is a no-op when there are no turns", async () => {
      const store = gameStub({ configSnapshot: rounds(20) });
      const component = {
        ...tuodPlay(),
        $store: { game: store, settings: settingsStub() },
      };
      await component.init.call(component);
      const recordCallsAfterInit = vi.mocked(store.recordFacts).mock.calls
        .length;

      component.undoAttempt();

      expect(vi.mocked(store.recordFacts).mock.calls.length).toBe(
        recordCallsAfterInit,
      );
    });

    it("is a no-op while finish confirm is open", async () => {
      const store = gameStub({ configSnapshot: rounds(1) });
      const component = {
        ...tuodPlay(),
        $store: { game: store, settings: settingsStub() },
      };
      await component.init.call(component);
      await component.recordAttempt.call(component, CHECKOUT);
      expect(component.showFinishConfirm).toBe(true);

      component.undoAttempt();

      expect(store.turns).toHaveLength(0);
    });
  });

  describe("Completion sequence", () => {
    function makePlay(gameOverrides: Partial<GameStub> = {}): TuodPlayContext {
      return {
        ...tuodPlay(),
        $store: {
          game: gameStub({
            sessionId: "session-1",
            configSnapshot: rounds(20),
            turns: [turnFact("t1", 1, 41)],
            ...gameOverrides,
          }),
          settings: settingsStub(),
        },
      };
    }

    it("copies target/attempts/successes/failures into resultsSnapshot on success", async () => {
      const play = makePlay();

      vi.mocked(appendBatch).mockResolvedValue({
        created: { stages: 1, turns: 1, darts: 0 },
      });
      vi.mocked(completeSession).mockResolvedValue({
        sessionId: "session-1",
        statusKey: "COMPLETED",
        completedAt: "now",
      });

      await play.uploadAndCompleteSession();

      expect(play.resultsSnapshot).toEqual({
        target: 51,
        attempts: 1,
        successes: 1,
        failures: 0,
        winningSideKey: null,
        status: "COMPLETE",
      });
    });

    it("folds a mixed attempt log into the correct final target", async () => {
      const play = makePlay({
        turns: [
          turnFact("t1", 1, 41), // success: 41 -> 51
          turnFact("t2", 2, 0), // failure: 51 -> 50
          turnFact("t3", 3, 50), // success: 50 -> 60
        ],
      });
      vi.mocked(appendBatch).mockResolvedValue({
        created: { stages: 1, turns: 3, darts: 0 },
      });
      vi.mocked(completeSession).mockResolvedValue({
        sessionId: "session-1",
        statusKey: "COMPLETED",
        completedAt: "now",
      });

      await play.uploadAndCompleteSession();

      expect(play.resultsSnapshot).toEqual({
        target: 60,
        attempts: 3,
        successes: 2,
        failures: 1,
        winningSideKey: null,
        status: "COMPLETE",
      });
    });

    it('sets completionStatus = "failed" and keeps buttons disabled on error', async () => {
      const play = makePlay();
      vi.mocked(appendBatch).mockRejectedValue(new Error("Network error"));

      await play.uploadAndCompleteSession();

      expect(play.completionError).toContain("connection");
      expect(play.completionStatus).toBe("failed");
    });

    it("treats SESSION_ALREADY_COMPLETED as success on the completion path", async () => {
      const play = makePlay();
      const error = new Error("SESSION_ALREADY_COMPLETED");
      (error as { code?: string }).code = "SESSION_ALREADY_COMPLETED";
      vi.mocked(completeSession).mockRejectedValue(error);
      vi.mocked(appendBatch).mockResolvedValue({
        created: { stages: 1, turns: 1, darts: 0 },
      });

      await play.uploadAndCompleteSession();

      expect(play.completionError).toBe("");
      expect(play.completionStatus).toBe("succeeded");
    });

    it("mints idempotencyKey once and reuses on retry", async () => {
      const play = makePlay();
      vi.mocked(appendBatch).mockResolvedValue({
        created: { stages: 1, turns: 1, darts: 0 },
      });
      vi.mocked(completeSession).mockResolvedValue({
        sessionId: "session-1",
        statusKey: "COMPLETED",
        completedAt: "now",
      });

      await play.uploadAndCompleteSession();
      const firstKey = play.$store.game.idempotencyKey;
      expect(firstKey).toBeTruthy();

      vi.mocked(appendBatch).mockClear();
      await play.uploadAndCompleteSession();
      expect(play.$store.game.idempotencyKey).toBe(firstKey);
    });

    it("ST4: playAgain reuses the original template, no overrides", async () => {
      const play = makePlay({
        idempotencyKey: "old-key",
        timerRemainingMs: 1000,
        timerExpired: true,
      });
      play.completionStatus = "succeeded";
      play.finished = true;
      play.resultsSnapshot = {
        target: 51,
        attempts: 1,
        successes: 1,
        failures: 0,
        winningSideKey: null,
        status: "COMPLETE",
      };
      const { seats: _priorSeats, ...priorRulesetConfig } =
        play.$store.game.configSnapshot!;

      vi.mocked(createSession).mockResolvedValue({
        sessionId: "new-session",
        participants: [
          {
            ref: "new-participant",
            displayName: "Player",
            participantTypeKey: "PLAYER",
          },
        ],
      } as Awaited<ReturnType<typeof createSession>>);

      await play.playAgain();

      expect(createSession).toHaveBeenCalledWith({
        gameTypeKey: "TUOD",
        rulesetVersionKey: "TUOD_V1",
        captureModeKey: "RECREATIONAL",
        inputModeKey: "QUICK_SCORE",
        config: {
          source: "template",
          templateRef: "tpl-1",
        },
      });
      expect(play.$store.game.sessionId).toBe("new-session");
      expect(play.$store.game.turns).toEqual([]);
      expect(play.$store.game.idempotencyKey).toBeNull();
      expect(play.$store.game.timerExpired).toBe(false);
      const { seats: _nextSeats, ...nextRulesetConfig } =
        play.$store.game.configSnapshot!;
      expect(nextRulesetConfig).toEqual(priorRulesetConfig);
      expect(play.finished).toBe(false);
      expect(play.completionStatus).toBe("pending");
      expect(play.resultsSnapshot).toBeNull();
      expect(play.hasActiveSession).toBe(true);
    });

    it("playAgain failure sets playAgainError only, leaves completionStatus untouched", async () => {
      const play = makePlay();
      play.completionStatus = "succeeded";
      vi.mocked(createSession).mockRejectedValue(new Error("Network error"));

      await play.playAgain();

      expect(play.playAgainError).toBeTruthy();
      expect(play.completionStatus).toBe("succeeded");
      expect(play.$store.game.turns.length).toBe(1);
    });

    it("playAgain double-fire while in flight only creates one session", async () => {
      const play = makePlay();
      play.completionStatus = "succeeded";
      play.finished = true;

      let resolveCreate!: (
        value: Awaited<ReturnType<typeof createSession>>,
      ) => void;
      vi.mocked(createSession).mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveCreate = resolve;
          }),
      );

      const first = play.playAgain();
      const second = play.playAgain();
      expect(play.playAgainLoading).toBe(true);
      expect(createSession).toHaveBeenCalledTimes(1);

      resolveCreate({
        sessionId: "new-session",
        participants: [
          {
            ref: "new-participant",
            displayName: "Player",
            participantTypeKey: "PLAYER",
          },
        ],
      } as Awaited<ReturnType<typeof createSession>>);
      await Promise.all([first, second]);

      expect(createSession).toHaveBeenCalledTimes(1);
      expect(play.playAgainLoading).toBe(false);
    });
  });

  describe("abandonAndExit", () => {
    function makeAbandonPlay(gameOverrides: Partial<GameStub> = {}) {
      return {
        ...tuodPlay(),
        $store: { game: gameStub(gameOverrides), settings: settingsStub() },
      };
    }

    it("with turns: appendBatch then completeSession ABANDONED, reset, navigate /games", async () => {
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
      const play = makeAbandonPlay({ turns: [turnFact("t1", 1, 41)] });

      await play.abandonAndExit.call(play);

      expect(appendBatch).toHaveBeenCalledTimes(1);
      expect(completeSession).toHaveBeenCalledWith("s1", "ABANDONED");
      expect(play.$store.game.reset).toHaveBeenCalled();
      expect(locationSpy.href).toBe("/games");
    });

    it("with zero turns: skips batch, PATCHes ABANDONED, reset, navigate", async () => {
      const locationSpy = { href: "" };
      vi.stubGlobal("location", locationSpy);
      vi.mocked(completeSession).mockResolvedValue({
        sessionId: "s1",
        statusKey: "ABANDONED",
        completedAt: "now",
      });
      const play = makeAbandonPlay({ turns: [] });

      await play.abandonAndExit.call(play);

      expect(appendBatch).not.toHaveBeenCalled();
      expect(completeSession).toHaveBeenCalledWith("s1", "ABANDONED");
      expect(locationSpy.href).toBe("/games");
    });

    it("with no sessionId: reset and navigate without API calls", async () => {
      const locationSpy = { href: "" };
      vi.stubGlobal("location", locationSpy);
      const play = makeAbandonPlay({ sessionId: null });

      await play.abandonAndExit.call(play);

      expect(appendBatch).not.toHaveBeenCalled();
      expect(completeSession).not.toHaveBeenCalled();
      expect(play.$store.game.reset).toHaveBeenCalled();
      expect(locationSpy.href).toBe("/games");
    });
  });

  describe("quick score entry", () => {
    async function playing(config = rounds(5)) {
      const store = gameStub({ configSnapshot: config });
      const component = {
        ...tuodPlay(),
        $store: { game: store, settings: settingsStub() },
      };
      await component.init.call(component);
      return { store, component };
    }

    it("opens the checkout confirm when the typed total matches the target", async () => {
      const { store, component } = await playing();
      component.scoreInput.setValue("41");

      await component.submitVisit.call(component);

      expect(component.showDoubleConfirm).toBe(true);
      expect(component.pendingCheckoutScore).toBe(41);
      expect(component.scoreInput.value).toBe("");
      expect(store.turns).toHaveLength(0);
    });

    it("preselects the shortest route's dart counts", async () => {
      const { component } = await playing();
      component.scoreInput.setValue("41");

      await component.submitVisit.call(component);

      expect(component.checkoutDartOptions.call(component)).toEqual({
        toFinish: [2, 3],
        atDouble: [1, 2],
      });
      expect(component.dartsToFinish).toBe(2);
      expect(component.dartsAtDouble).toBe(1);
    });

    it("records any other total as a failed attempt without asking", async () => {
      const { store, component } = await playing();
      component.scoreInput.setValue("26");

      await component.submitVisit.call(component);

      expect(component.showDoubleConfirm).toBe(false);
      expect(store.turns).toHaveLength(1);
      expect(store.turns[0].totalScore).toBe(0);
      expect(component.scoreInput.value).toBe("");
    });

    it("confirmDouble records the checkout with the chosen dart counts", async () => {
      const { store, component } = await playing();
      component.scoreInput.setValue("41");
      await component.submitVisit.call(component);
      component.dartsToFinish = 3;
      component.dartsAtDouble = 2;

      await component.confirmDouble.call(component);

      expect(store.turns).toHaveLength(1);
      expect(store.turns[0].totalScore).toBe(41);
      expect(component.showDoubleConfirm).toBe(false);
      expect(component.dartsToFinish).toBeNull();
      expect(component.dartsAtDouble).toBeNull();
    });

    it("cancelCheckout records nothing and returns the total to the keypad", async () => {
      const { store, component } = await playing();
      component.scoreInput.setValue("41");
      await component.submitVisit.call(component);

      component.cancelCheckout.call(component);

      expect(store.turns).toHaveLength(0);
      expect(component.showDoubleConfirm).toBe(false);
      expect(component.scoreInput.value).toBe("41");
      expect(component.dartsToFinish).toBeNull();
    });

    it("surfaces the engine's rejection when the dart counts cannot be true", async () => {
      const { store, component } = await playing();
      component.scoreInput.setValue("41");
      await component.submitVisit.call(component);
      component.dartsToFinish = 1;

      await component.confirmDouble.call(component);

      expect(store.turns).toHaveLength(0);
      expect(component.error).toMatch(/at least 2 darts/);
    });

    it("undo clears a half-typed total along with the last attempt", async () => {
      const { store, component } = await playing();
      await component.recordAttempt.call(component, MISS);
      component.scoreInput.setValue("12");

      component.undoAttempt.call(component);

      expect(store.turns).toHaveLength(0);
      expect(component.scoreInput.value).toBe("");
    });
  });
});

import type { DartObservation } from "@modules/types";

const SEATS = [
  {
    participantRef: "participant-1",
    displayName: "Levi",
    sideKey: "A",
    participantTypeKey: "PLAYER" as const,
  },
];

/** D20 — the same board coordinate used across every other engine/play test for D20. */
const DOUBLE_20: DartObservation = {
  hitTargetNumber: 20,
  hitZoneKey: "DOUBLE",
  locationX: 0,
  locationY: -166,
};

/** T20 — an overshoot against a target of 40. */
const TREBLE_20: DartObservation = {
  hitTargetNumber: 20,
  hitZoneKey: "TREBLE",
  locationX: 0,
  locationY: -102,
};

describe("recordDart (board input)", () => {
  it("records a checkout dart and mirrors it into the store", async () => {
    const store = gameStub({
      configSnapshot: { ...rounds(10), startingTarget: 40 },
    });
    const component = {
      ...tuodPlay(),
      $store: { game: store, settings: settingsStub() },
    };
    await component.init.call(component);

    await component.recordDart.call(component, DOUBLE_20);

    expect(store.turns).toHaveLength(1);
    expect(store.turns[0].totalScore).toBe(40);
    expect(store.turns[0].darts[0].hitZoneKey).toBe("DOUBLE");
    expect(component.error).toBe("");
  });

  it("records a busted dart the same way, scoring the turn 0", async () => {
    const store = gameStub({
      configSnapshot: { ...rounds(10), startingTarget: 40 },
    });
    const component = {
      ...tuodPlay(),
      $store: { game: store, settings: settingsStub() },
    };
    await component.init.call(component);

    await component.recordDart.call(component, TREBLE_20);

    expect(store.turns[0].totalScore).toBe(0);
    expect(store.turns[0].darts[0].score).toBe(60);
  });

  it("defers a dart that would end the session to the finish confirm", async () => {
    const store = gameStub({
      configSnapshot: { ...rounds(1), startingTarget: 40 },
    });
    const component = {
      ...tuodPlay(),
      $store: { game: store, settings: settingsStub() },
    };
    await component.init.call(component);

    await component.recordDart.call(component, DOUBLE_20);

    expect(component.showFinishConfirm).toBe(true);
    expect(component.pendingDartObservation).toEqual(DOUBLE_20);
    expect(store.turns).toHaveLength(0);
  });

  it("confirmFinish commits a pending dart and completes the session", async () => {
    const store = gameStub({
      configSnapshot: { ...rounds(1), startingTarget: 40 },
    });
    vi.mocked(appendBatch).mockResolvedValue({
      created: { stages: 1, turns: 1, darts: 1 },
    });
    vi.mocked(completeSession).mockResolvedValue({
      sessionId: "s1",
      statusKey: "COMPLETED",
      completedAt: "now",
    });
    const component = {
      ...tuodPlay(),
      $store: { game: store, settings: settingsStub() },
    };
    await component.init.call(component);

    await component.recordDart.call(component, DOUBLE_20);
    await component.confirmFinish.call(component);

    expect(component.pendingDartObservation).toBeNull();
    expect(component.showFinishConfirm).toBe(false);
    expect(component.finished).toBe(true);
  });

  it("cancelFinish discards a pending dart without recording it", async () => {
    const store = gameStub({
      configSnapshot: { ...rounds(1), startingTarget: 40 },
    });
    const component = {
      ...tuodPlay(),
      $store: { game: store, settings: settingsStub() },
    };
    await component.init.call(component);
    await component.recordDart.call(component, DOUBLE_20);
    expect(component.showFinishConfirm).toBe(true);

    component.cancelFinish.call(component);

    expect(component.pendingDartObservation).toBeNull();
    expect(component.showFinishConfirm).toBe(false);
    expect(store.turns).toHaveLength(0);
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

  function twoSeatRounds(durationValue: number): Seated<TuodSnapshot> {
    return {
      startingTarget: 41,
      finishBonus: 10,
      missPenalty: 1,
      durationType: "ROUNDS",
      durationValue,
      maxDartsPerTurn: 3,
      seats: TWO_SEATS,
    };
  }

  it("marks status TIE, with winningSideKey null, when both seats land on the same target", async () => {
    vi.mocked(appendBatch).mockResolvedValue({
      created: { stages: 1, turns: 2, darts: 0 },
    });
    vi.mocked(completeSession).mockResolvedValue({
      sessionId: "s1",
      statusKey: "COMPLETED",
      completedAt: "now",
    });
    const store = gameStub({ configSnapshot: twoSeatRounds(1) });
    const component = {
      ...tuodPlay(),
      $store: { game: store, settings: settingsStub() },
    };
    await component.init.call(component);

    // Both seats miss their only round, landing on the same target (40) —
    // a genuine tie, not a solo session, even though winningSideKey is null
    // in both cases.
    await component.recordAttempt.call(component, MISS);
    await component.recordAttempt.call(component, MISS);
    expect(component.showFinishConfirm).toBe(true);
    await component.confirmFinish.call(component);

    expect(component.finished).toBe(true);
    expect(component.completionStatus).toBe("succeeded");
    expect(component.resultsSnapshot?.status).toBe("TIE");
    expect(component.resultsSnapshot?.winningSideKey).toBeNull();
  });

  it("marks status COMPLETE, with the owning seat's sideKey, when one seat reaches the higher target", async () => {
    vi.mocked(appendBatch).mockResolvedValue({
      created: { stages: 1, turns: 2, darts: 0 },
    });
    vi.mocked(completeSession).mockResolvedValue({
      sessionId: "s1",
      statusKey: "COMPLETED",
      completedAt: "now",
    });
    const store = gameStub({ configSnapshot: twoSeatRounds(1) });
    const component = {
      ...tuodPlay(),
      $store: { game: store, settings: settingsStub() },
    };
    await component.init.call(component);

    // participant-1 (side A) checks out, climbing to 51; participant-2
    // (side B) misses, falling to 40 — side A wins outright.
    await component.recordAttempt.call(component, CHECKOUT);
    await component.recordAttempt.call(component, MISS);
    expect(component.showFinishConfirm).toBe(true);
    await component.confirmFinish.call(component);

    expect(component.finished).toBe(true);
    expect(component.completionStatus).toBe("succeeded");
    expect(component.resultsSnapshot?.status).toBe("COMPLETE");
    expect(component.resultsSnapshot?.winningSideKey).toBe("A");
  });
});

describe("tuodPlay — per-seat accessors", () => {
  it("currentTargetLabelFor reads the named seat, not the active one", () => {
    const ctx = tuodPlay() as unknown as {
      engine: {
        state: () => {
          activeParticipantRef: string;
          seats: { participantRef: string; currentTarget: number }[];
        };
      };
      currentTargetLabelFor: (seatRef: string) => string;
    };
    ctx.engine = {
      state: () => ({
        activeParticipantRef: "p1",
        seats: [
          { participantRef: "p1", currentTarget: 41 },
          { participantRef: "p2", currentTarget: 51 },
        ],
      }),
    };
    expect(ctx.currentTargetLabelFor("p2")).toBe("51");
  });
});
