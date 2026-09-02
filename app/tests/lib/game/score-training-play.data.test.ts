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
import { scoreTrainingEngineFactory } from "@modules/game/score-training.engine.module";
import type { GameEngine, GameEngineFactory } from "@modules/interfaces";
import { scoreTrainingPlay } from "@lib/game/score-training-play.data";
import type { ScoreTrainingPlayContext } from "@lib/types";
import type { ScoreTrainingSnapshot, Seated } from "@lib/types";
import type {
  DartObservation,
  EngineFacts,
  StageFact,
  TurnFact,
} from "@modules/types";

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
  participantRef = "participant-1",
): TurnFact {
  return {
    clientKey,
    stageClientKey: BLOCK.clientKey,
    participantRef,
    sequence,
    completedAt: "2026-07-17T10:00:00.000Z",
    totalScore,
    darts: [],
  };
}

function rounds(durationValue: number): Seated<ScoreTrainingSnapshot> {
  return {
    durationType: "ROUNDS",
    durationValue,
    maxDartsPerTurn: 3,
    maxVisitScore: 180,
    seats: SEATS,
  };
}

function minutes(durationValue: number): Seated<ScoreTrainingSnapshot> {
  return {
    durationType: "MINUTES",
    durationValue,
    maxDartsPerTurn: 3,
    maxVisitScore: 180,
    seats: SEATS,
  };
}

type GameStub = ScoreTrainingPlayContext["$store"]["game"];
type SettingsStub = ScoreTrainingPlayContext["$store"]["settings"];

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
    rulesetVersionKey: "SCORE_TRAINING_V1",
    sessionId: "s1",
    templateRef: "tpl-1",
    configSnapshot: rounds(2),
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
  gameTypeKey: "SCORE_TRAINING",
  gameTypeName: "Score Training",
  captureModeKey: "RECREATIONAL",
  inputModeKey: "QUICK_SCORE",
  rulesetVersionKey: "SCORE_TRAINING_V1",
  startedAt: "now",
} as const;

describe("scoreTrainingPlay — per-seat accessors", () => {
  it("totalScoreFor reads the named seat", () => {
    const play = {
      ...scoreTrainingPlay(),
      $store: {
        game: gameStub({
          configSnapshot: { ...rounds(10), seats: TWO_SEATS },
        }),
        settings: settingsStub(),
      },
    } as ScoreTrainingPlayContext;
    play.engine = null;

    play.$store.game.recordFacts({
      stages: [BLOCK],
      turns: [
        turnFact("t1", 1, 40, "participant-1"),
        turnFact("t2", 1, 120, "participant-2"),
      ],
    });

    expect(play.totalScoreFor("participant-2")).toBe(120);
  });
});

describe("scoreTrainingPlay", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    segmentTimerInstances.length = 0;
    vi.mocked(fetchActiveSessions).mockResolvedValue([{ ...ACTIVE_SESSION }]);
  });

  it("records a visit and does not complete before durationValue visits", async () => {
    const store = gameStub();
    const component = {
      ...scoreTrainingPlay(),
      $store: { game: store, settings: settingsStub() },
    };
    component.scoreInput.setValue("45");
    await component.init.call(component);
    await component.submitVisit.call(component);
    expect(store.turns).toHaveLength(1);
    expect(store.turns[0].totalScore).toBe(45);
    expect(appendBatch).not.toHaveBeenCalled();
  });

  it("syncs the store's stage list from the engine on init so uploads have a stage", async () => {
    const store = gameStub({ stages: [] });
    const component = {
      ...scoreTrainingPlay(),
      $store: { game: store, settings: settingsStub() },
    };
    await component.init.call(component);
    expect(store.stages).toEqual([BLOCK]);
  });

  it("uploads the batch and completes the session on the final visit", async () => {
    const store = gameStub();
    vi.mocked(appendBatch).mockResolvedValue({
      created: { stages: 1, turns: 2, darts: 0 },
    });
    vi.mocked(completeSession).mockResolvedValue({
      sessionId: "s1",
      statusKey: "COMPLETED",
      completedAt: "now",
    });
    const component = {
      ...scoreTrainingPlay(),
      $store: { game: store, settings: settingsStub() },
    };
    component.scoreInput.setValue("30");
    await component.init.call(component);
    await component.submitVisit.call(component); // visit 1
    component.scoreInput.setValue("30");
    await component.submitVisit.call(component); // visit 2 — opens confirm
    expect(component.showFinishConfirm).toBe(true);
    expect(appendBatch).not.toHaveBeenCalled();

    await component.confirmFinish.call(component);

    expect(appendBatch).toHaveBeenCalledTimes(1);
    expect(completeSession).toHaveBeenCalledWith("s1", "COMPLETED");
    expect(component.finished).toBe(true);
    expect(component.completionStatus).toBe("succeeded");
    expect(store.reset).not.toHaveBeenCalled();
  });

  it("nests every uploaded turn under the engine's exercise block", async () => {
    const store = gameStub();
    vi.mocked(appendBatch).mockResolvedValue({
      created: { stages: 1, turns: 2, darts: 0 },
    });
    vi.mocked(completeSession).mockResolvedValue({
      sessionId: "s1",
      statusKey: "COMPLETED",
      completedAt: "now",
    });
    const component = {
      ...scoreTrainingPlay(),
      $store: { game: store, settings: settingsStub() },
    };
    component.scoreInput.setValue("30");
    await component.init.call(component);
    await component.submitVisit.call(component);
    component.scoreInput.setValue("55");
    await component.submitVisit.call(component);
    await component.confirmFinish.call(component);

    const batch = vi.mocked(appendBatch).mock.calls[0][2];
    expect(batch.stages).toHaveLength(1);
    expect(batch.stages[0].stageTypeKey).toBe("EXERCISE_BLOCK");
    expect(batch.stages[0].turns.map((t) => t.totalScore)).toEqual([30, 55]);
    expect(batch.stages[0].turns[0].participantRef).toBe(
      SEATS[0].participantRef,
    );
    expect(batch.stages[0].turns[0].darts).toEqual([]);
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
        ...scoreTrainingPlay(),
        $store: { game: store, settings: settingsStub() },
      };
      await component.init.call(component);

      expect(component.hasActiveSession).toBe(true);
      expect(store.reset).not.toHaveBeenCalled();
      expect(component.reconciliationFailed).toBe(false);
    });

    it('shows no-active-session view on "no_active" (mismatch auto-abandoned)', async () => {
      const store = gameStub({ sessionId: "different-id" });
      vi.mocked(fetchActiveSessions).mockResolvedValue([
        { ...ACTIVE_SESSION, sessionId: "server-id" },
      ]);
      vi.mocked(completeSession).mockResolvedValue({
        sessionId: "server-id",
        statusKey: "ABANDONED",
        completedAt: "2026-07-17T10:00:00Z",
      });
      const component = {
        ...scoreTrainingPlay(),
        $store: { game: store, settings: settingsStub() },
      };
      await component.init.call(component);

      expect(completeSession).toHaveBeenCalledWith("server-id", "ABANDONED");
      expect(store.reset).toHaveBeenCalled();
      expect(component.hasActiveSession).toBe(false);
    });

    it('blocks with reconciliationFailed on "abandon_failed" — does not flip to no-active-session as if cleaned', async () => {
      const store = gameStub({ sessionId: "different-id" });
      vi.mocked(fetchActiveSessions).mockResolvedValue([
        { ...ACTIVE_SESSION, sessionId: "server-id" },
      ]);
      vi.mocked(completeSession).mockRejectedValue(new Error("Network error"));
      const component = {
        ...scoreTrainingPlay(),
        $store: { game: store, settings: settingsStub() },
      };
      await component.init.call(component);

      expect(component.reconciliationFailed).toBe(true);
      expect(store.reset).not.toHaveBeenCalled();
      expect(component.hasActiveSession).toBe(false);
    });

    it("preserves turns array on resume (no clear)", async () => {
      const store = gameStub({
        sessionId: "match-id",
        configSnapshot: rounds(20),
        turns: [turnFact("t1", 1, 50)],
      });
      vi.mocked(fetchActiveSessions).mockResolvedValue([
        { ...ACTIVE_SESSION, sessionId: "match-id" },
      ]);
      const component = {
        ...scoreTrainingPlay(),
        $store: { game: store, settings: settingsStub() },
      };
      await component.init.call(component);

      expect(component.hasActiveSession).toBe(true);
      expect(store.turns).toHaveLength(1);
      expect(store.turns[0].clientKey).toBe("t1");
    });

    it("leaves the session unplayable when no engine is registered for the persisted ruleset", async () => {
      const store = gameStub({ rulesetVersionKey: "BOBS27_V1" });
      const component = {
        ...scoreTrainingPlay(),
        $store: { game: store, settings: settingsStub() },
      };
      await component.init.call(component);

      expect(component.engine).toBeNull();
      expect(component.hasActiveSession).toBe(false);
    });

    it("D88: clears local state when the server has no matching active session", async () => {
      vi.mocked(fetchActiveSessions).mockResolvedValue([]);
      const store = gameStub();
      const component = {
        ...scoreTrainingPlay(),
        $store: { game: store, settings: settingsStub() },
      };
      await component.init.call(component);
      expect(store.reset).toHaveBeenCalledTimes(1);
      expect(component.hasActiveSession).toBe(false);
    });

    it("D88: mismatch against first SCORE_TRAINING session auto-abandons and resets", async () => {
      vi.mocked(fetchActiveSessions).mockResolvedValue([
        { ...ACTIVE_SESSION, sessionId: "other-session" },
      ]);
      vi.mocked(completeSession).mockResolvedValue({
        sessionId: "other-session",
        statusKey: "ABANDONED",
        completedAt: "now",
      });
      const store = gameStub({ sessionId: "s1" });
      const component = {
        ...scoreTrainingPlay(),
        $store: { game: store, settings: settingsStub() },
      };
      await component.init.call(component);
      expect(completeSession).toHaveBeenCalledWith(
        "other-session",
        "ABANDONED",
      );
      expect(store.reset).toHaveBeenCalledTimes(1);
      expect(component.hasActiveSession).toBe(false);
    });

    it("D88: abandons an orphaned server session with no local state", async () => {
      const store = gameStub({ sessionId: null, configSnapshot: null });
      vi.mocked(completeSession).mockResolvedValue({
        sessionId: "s1",
        statusKey: "ABANDONED",
        completedAt: "now",
      });
      const component = {
        ...scoreTrainingPlay(),
        $store: { game: store, settings: settingsStub() },
      };
      await component.init.call(component);
      expect(completeSession).toHaveBeenCalledWith("s1", "ABANDONED");
      expect(component.hasActiveSession).toBe(false);
    });

    it("sets hasActiveSession to false and does not crash on submitVisit when no session matches", async () => {
      vi.mocked(fetchActiveSessions).mockResolvedValue([]);
      const store = gameStub({ sessionId: null, configSnapshot: null });
      const component = {
        ...scoreTrainingPlay(),
        $store: { game: store, settings: settingsStub() },
      };
      component.scoreInput.setValue("45");
      await component.init.call(component);
      expect(component.hasActiveSession).toBe(false);

      await expect(
        component.submitVisit.call(component),
      ).resolves.not.toThrow();
      expect(appendBatch).not.toHaveBeenCalled();
      expect(completeSession).not.toHaveBeenCalled();
    });

    it("ST5: submitVisit leaves loading false when it bails out with no engine", async () => {
      vi.mocked(fetchActiveSessions).mockResolvedValue([]);
      const store = gameStub({ sessionId: null, configSnapshot: null });
      const component = {
        ...scoreTrainingPlay(),
        $store: { game: store, settings: settingsStub() },
      };
      component.scoreInput.setValue("45");
      await component.init.call(component);

      await component.submitVisit.call(component);

      expect(component.engine).toBeNull();
      expect(component.loading).toBe(false);
    });

    it("ST5: submitVisit leaves loading false when the finish confirm is open", async () => {
      const store = gameStub();
      const component = {
        ...scoreTrainingPlay(),
        $store: { game: store, settings: settingsStub() },
      };
      component.scoreInput.setValue("30");
      await component.init.call(component);
      await component.submitVisit.call(component);
      component.scoreInput.setValue("55");
      await component.submitVisit.call(component);
      expect(component.showFinishConfirm).toBe(true);

      component.scoreInput.setValue("20");
      await component.submitVisit.call(component);

      expect(component.loading).toBe(false);
    });

    it("clears loading and sets reconciliationFailed when fetchActiveSessions throws", async () => {
      vi.mocked(fetchActiveSessions).mockRejectedValue(
        new Error("Network error"),
      );
      const store = gameStub();
      const component = {
        ...scoreTrainingPlay(),
        $store: { game: store, settings: settingsStub() },
      };
      await component.init.call(component);

      expect(component.loadingReconciliation).toBe(false);
      expect(component.reconciliationFailed).toBe(true);
      expect(component.hasActiveSession).toBe(false);
    });

    it("retryReconciliation recovers after a prior fetch failure", async () => {
      vi.mocked(fetchActiveSessions)
        .mockRejectedValueOnce(new Error("Network error"))
        .mockResolvedValueOnce([{ ...ACTIVE_SESSION }]);
      const store = gameStub();
      const component = {
        ...scoreTrainingPlay(),
        $store: { game: store, settings: settingsStub() },
      };
      await component.init.call(component);
      expect(component.reconciliationFailed).toBe(true);

      await component.retryReconciliation.call(component);

      expect(component.loadingReconciliation).toBe(false);
      expect(component.reconciliationFailed).toBe(false);
      expect(component.hasActiveSession).toBe(true);
    });
  });

  describe("cross-game engine guard", () => {
    afterEach(() => {
      resetEngineRegistry();
      registerEngineFactory(scoreTrainingEngineFactory);
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
        ...scoreTrainingPlay(),
        $store: { game: store, settings: settingsStub() },
      };
      await component.init.call(component);

      expect(foreignCreate).not.toHaveBeenCalled();
      expect(component.engine).toBeNull();
      expect(component.hasActiveSession).toBe(false);
    });
  });

  describe("MINUTES duration mode timer wiring", () => {
    it("instantiates and starts a SegmentTimer whose onComplete sets store.timerExpired", async () => {
      const store = gameStub({ configSnapshot: minutes(15) });
      const component = {
        ...scoreTrainingPlay(),
        $store: { game: store, settings: settingsStub() },
      };
      await component.init.call(component);

      expect(SegmentTimer).toHaveBeenCalledTimes(1);
      const instance = segmentTimerInstances[0];
      expect(instance.options.totalMinutes).toBe(15);
      expect(instance.options.intervalMinutes).toBe(15);
      expect(instance.start).toHaveBeenCalledTimes(1);

      expect(store.timerExpired).toBe(false);
      (instance.options.onComplete as () => void)();
      expect(store.timerExpired).toBe(true);
    });

    it("drives a MINUTES session to completion once the timer expires", async () => {
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
        ...scoreTrainingPlay(),
        $store: { game: store, settings: settingsStub() },
      };
      await component.init.call(component);

      component.scoreInput.setValue("40");
      await component.submitVisit.call(component);
      expect(component.showFinishConfirm).toBe(false);
      expect(store.turns).toHaveLength(1);

      (segmentTimerInstances[0].options.onComplete as () => void)();

      component.scoreInput.setValue("60");
      await component.submitVisit.call(component);

      expect(component.showFinishConfirm).toBe(true);
      expect(component.pendingFinishScore).toBe(60);
      expect(store.turns).toHaveLength(1);

      await component.confirmFinish.call(component);

      expect(store.turns).toHaveLength(2);
      expect(component.finished).toBe(true);
      expect(completeSession).toHaveBeenCalledWith("s1", "COMPLETED");
    });

    it("updates store.timerRemainingMs from onTick (seconds -> ms)", async () => {
      const store = gameStub({ configSnapshot: minutes(15) });
      const component = {
        ...scoreTrainingPlay(),
        $store: { game: store, settings: settingsStub() },
      };
      await component.init.call(component);

      const instance = segmentTimerInstances[0];
      (instance.options.onTick as (s: number) => void)(59);
      expect(store.timerRemainingMs).toBe(59000);
    });

    it("does not instantiate a SegmentTimer in ROUNDS mode", async () => {
      const store = gameStub();
      const component = {
        ...scoreTrainingPlay(),
        $store: { game: store, settings: settingsStub() },
      };
      await component.init.call(component);
      expect(SegmentTimer).not.toHaveBeenCalled();
    });

    it("destroy() stops the timer", async () => {
      const store = gameStub({ configSnapshot: minutes(15) });
      const component = {
        ...scoreTrainingPlay(),
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
        ...scoreTrainingPlay(),
        $store: { game: store, settings: settingsStub() },
      };
      await component.init.call(component);
      expect(() => component.destroy.call(component)).not.toThrow();
    });

    it("sets store.timerRemainingMs to the full duration synchronously on a fresh session, before any onTick fires", async () => {
      const store = gameStub({ configSnapshot: minutes(15) });
      const component = {
        ...scoreTrainingPlay(),
        $store: { game: store, settings: settingsStub() },
      };
      await component.init.call(component);

      // No onTick invocation here — timerRemainingMs must already be correct.
      expect(store.timerRemainingMs).toBe(15 * 60 * 1000);
    });

    it("resumes from the persisted timerRemainingMs instead of the full configured duration when a prior session left one set", async () => {
      const store = gameStub({
        configSnapshot: minutes(15),
        timerRemainingMs: 5 * 60 * 1000, // 5 minutes left from a prior session
        timerExpired: false,
      });
      const component = {
        ...scoreTrainingPlay(),
        $store: { game: store, settings: settingsStub() },
      };
      await component.init.call(component);

      expect(SegmentTimer).toHaveBeenCalledTimes(1);
      const instance = segmentTimerInstances[0];
      expect(instance.options.totalMinutes).toBe(5);
      expect(instance.options.intervalMinutes).toBe(5);
      expect(instance.start).toHaveBeenCalledTimes(1);
      // Still set synchronously, from the resumed value, not the full duration.
      expect(store.timerRemainingMs).toBe(5 * 60 * 1000);
    });

    it("does not restart a new timer when timerExpired is already true on init", async () => {
      const store = gameStub({
        configSnapshot: minutes(15),
        timerRemainingMs: 0,
        timerExpired: true,
      });
      const component = {
        ...scoreTrainingPlay(),
        $store: { game: store, settings: settingsStub() },
      };
      await component.init.call(component);

      expect(SegmentTimer).not.toHaveBeenCalled();
    });
  });

  describe("resume: sequence continuity", () => {
    it("continues the sequence from the persisted fact log so a resumed session does not collide sequences", async () => {
      const store = gameStub({
        configSnapshot: rounds(3),
        turns: [turnFact("t1", 1, 45)],
      });
      const component = {
        ...scoreTrainingPlay(),
        $store: { game: store, settings: settingsStub() },
      };
      component.scoreInput.setValue("30");
      await component.init.call(component);
      await component.submitVisit.call(component);
      const lastTurn = store.turns[store.turns.length - 1];
      expect(lastTurn.sequence).toBe(2);
    });
  });

  describe("session progress stats", () => {
    function makePlay(
      gameOverrides: Partial<GameStub> = {},
    ): ScoreTrainingPlayContext {
      return {
        ...scoreTrainingPlay(),
        $store: {
          game: gameStub({
            configSnapshot: rounds(20),
            ...gameOverrides,
          }),
          settings: settingsStub(),
        },
      };
    }

    it("computes darts thrown, three-dart average, and previous score for the session", async () => {
      const play = makePlay({
        turns: [turnFact("t1", 1, 60), turnFact("t2", 2, 45)],
      });
      await play.init.call(play);

      expect(play.dartsThrownThisLeg.call(play)).toBe(6);
      expect(play.threeDartAverage.call(play)).toBe("52.5");
      expect(play.previousScoreThisLeg.call(play)).toBe("45");
    });

    it('shows "—" for previous score when the session has no turns yet', async () => {
      const play = makePlay({ turns: [] });
      await play.init.call(play);

      expect(play.dartsThrownThisLeg.call(play)).toBe(0);
      expect(play.threeDartAverage.call(play)).toBe("0.0");
      expect(play.previousScoreThisLeg.call(play)).toBe("—");
    });
  });

  describe("Completion sequence", () => {
    function makePlay(
      gameOverrides: Partial<GameStub> = {},
    ): ScoreTrainingPlayContext {
      return {
        ...scoreTrainingPlay(),
        $store: {
          game: gameStub({
            sessionId: "session-1",
            configSnapshot: rounds(20),
            turns: [turnFact("t1", 1, 50)],
            ...gameOverrides,
          }),
          settings: settingsStub(),
        },
      };
    }

    it('sets completionStatus = "pending" synchronously when finished flips true, before the async sequence resolves', async () => {
      const play = makePlay();

      let sawPendingBeforeResolve = false;
      vi.mocked(appendBatch).mockImplementation(async () => {
        sawPendingBeforeResolve =
          play.completionStatus === "saving" ||
          play.completionStatus === "pending";
        return { created: { stages: 1, turns: 1, darts: 3 } };
      });
      vi.mocked(completeSession).mockResolvedValue({
        sessionId: "session-1",
        statusKey: "COMPLETED",
        completedAt: "2026-07-17T10:00:00Z",
      });

      const promise = play.uploadAndCompleteSession();
      expect(
        play.completionStatus === "pending" ||
          play.completionStatus === "saving",
      ).toBe(true);
      await promise;

      expect(sawPendingBeforeResolve).toBe(true);
      expect(play.completionStatus).toBe("succeeded");
    });

    it("mints idempotencyKey once and reuses on retry", async () => {
      const play = makePlay();

      vi.mocked(appendBatch).mockResolvedValue({
        created: { stages: 1, turns: 1, darts: 3 },
      });
      vi.mocked(completeSession).mockResolvedValue({
        sessionId: "session-1",
        statusKey: "COMPLETED",
        completedAt: "2026-07-17T10:00:00Z",
      });

      await play.uploadAndCompleteSession();

      const firstKey = play.$store.game.idempotencyKey;
      expect(firstKey).toBeTruthy();
      expect(play.completionStatus).toBe("succeeded");
      expect(play.completionError).toBe("");

      vi.mocked(appendBatch).mockClear();
      await play.uploadAndCompleteSession();

      expect(play.$store.game.idempotencyKey).toBe(firstKey);
    });

    it("uploads from the persisted fact log when no engine is live", async () => {
      const play = makePlay();

      vi.mocked(appendBatch).mockResolvedValue({
        created: { stages: 1, turns: 1, darts: 0 },
      });
      vi.mocked(completeSession).mockResolvedValue({
        sessionId: "session-1",
        statusKey: "COMPLETED",
        completedAt: "2026-07-17T10:00:00Z",
      });

      await play.uploadAndCompleteSession();

      const batch = vi.mocked(appendBatch).mock.calls[0][2];
      expect(batch.stages[0].clientKey).toBe("block-1");
      expect(batch.stages[0].turns.map((t) => t.clientKey)).toEqual(["t1"]);
    });

    it("copies stats into resultsSnapshot on success and does not depend on turns surviving afterward", async () => {
      const play = makePlay();

      vi.mocked(appendBatch).mockResolvedValue({
        created: { stages: 1, turns: 1, darts: 3 },
      });
      vi.mocked(completeSession).mockResolvedValue({
        sessionId: "session-1",
        statusKey: "COMPLETED",
        completedAt: "2026-07-17T10:00:00Z",
      });

      await play.uploadAndCompleteSession();

      expect(play.resultsSnapshot).toEqual({
        status: "COMPLETE",
        winningSideKey: null,
        seats: [
          {
            participantRef: "participant-1",
            sideKey: "A",
            total: 50,
            threeDartAverage: "50.0",
            firstNineAverage: "50.0",
            highestScore: 50,
            sixtyPlus: 0,
            hundredPlus: 0,
            oneTwentyPlus: 0,
            oneFortyPlus: 0,
            oneEighties: 0,
          },
        ],
      });
      expect(play.resultsTitle()).toBe("Game Summary");
    });

    it("1v1: both seats get their own independently-scoped stats, including the losing seat", async () => {
      const play = makePlay({
        configSnapshot: { ...rounds(20), seats: TWO_SEATS },
        turns: [
          turnFact("t1", 1, 60, "participant-1"),
          turnFact("t2", 2, 45, "participant-1"),
          turnFact("t3", 1, 40, "participant-2"),
        ],
      });

      vi.mocked(appendBatch).mockResolvedValue({
        created: { stages: 1, turns: 3, darts: 9 },
      });
      vi.mocked(completeSession).mockResolvedValue({
        sessionId: "session-1",
        statusKey: "COMPLETED",
        completedAt: "2026-07-17T10:00:00Z",
      });

      await play.uploadAndCompleteSession();

      expect(play.resultsSnapshot?.seats).toEqual([
        {
          participantRef: "participant-1",
          sideKey: "A",
          total: 105,
          threeDartAverage: "52.5",
          firstNineAverage: "52.5",
          highestScore: 60,
          sixtyPlus: 1,
          hundredPlus: 0,
          oneTwentyPlus: 0,
          oneFortyPlus: 0,
          oneEighties: 0,
        },
        {
          participantRef: "participant-2",
          sideKey: "B",
          total: 40,
          threeDartAverage: "40.0",
          firstNineAverage: "40.0",
          highestScore: 40,
          sixtyPlus: 0,
          hundredPlus: 0,
          oneTwentyPlus: 0,
          oneFortyPlus: 0,
          oneEighties: 0,
        },
      ]);
    });

    it("total excludes an open visit's running score, matching the other seven stats", async () => {
      const play = makePlay({
        turns: [
          turnFact("t1", 1, 60),
          { ...turnFact("t2", 2, 45), completedAt: null },
        ],
      });

      vi.mocked(appendBatch).mockResolvedValue({
        created: { stages: 1, turns: 2, darts: 6 },
      });
      vi.mocked(completeSession).mockResolvedValue({
        sessionId: "session-1",
        statusKey: "COMPLETED",
        completedAt: "2026-07-17T10:00:00Z",
      });

      await play.uploadAndCompleteSession();

      expect(play.resultsSnapshot?.seats[0].total).toBe(60);
    });

    it("1v1: winningSideKey matches the higher-scoring seat once the round budget decides the match", async () => {
      const play = makePlay({
        configSnapshot: { ...rounds(1), seats: TWO_SEATS },
        turns: [
          turnFact("t1", 1, 60, "participant-1"),
          turnFact("t2", 1, 40, "participant-2"),
        ],
      });

      vi.mocked(appendBatch).mockResolvedValue({
        created: { stages: 1, turns: 2, darts: 6 },
      });
      vi.mocked(completeSession).mockResolvedValue({
        sessionId: "session-1",
        statusKey: "COMPLETED",
        completedAt: "2026-07-17T10:00:00Z",
      });

      await play.uploadAndCompleteSession();

      expect(play.resultsSnapshot?.status).toBe("COMPLETE");
      expect(play.resultsSnapshot?.winningSideKey).toBe("A");
    });

    it("1v1: a tie at the round budget reports status TIE and winningSideKey null", async () => {
      const play = makePlay({
        configSnapshot: { ...rounds(1), seats: TWO_SEATS },
        turns: [
          turnFact("t1", 1, 50, "participant-1"),
          turnFact("t2", 1, 50, "participant-2"),
        ],
      });

      vi.mocked(appendBatch).mockResolvedValue({
        created: { stages: 1, turns: 2, darts: 6 },
      });
      vi.mocked(completeSession).mockResolvedValue({
        sessionId: "session-1",
        statusKey: "COMPLETED",
        completedAt: "2026-07-17T10:00:00Z",
      });

      await play.uploadAndCompleteSession();

      expect(play.resultsSnapshot?.status).toBe("TIE");
      expect(play.resultsSnapshot?.winningSideKey).toBeNull();
    });

    it("tallies visits across all four score bands exclusively, end to end", async () => {
      const play = makePlay({
        turns: [
          turnFact("t1", 1, 105),
          turnFact("t2", 2, 125),
          turnFact("t3", 3, 145),
          turnFact("t4", 4, 180),
        ],
      });

      vi.mocked(appendBatch).mockResolvedValue({
        created: { stages: 1, turns: 4, darts: 12 },
      });
      vi.mocked(completeSession).mockResolvedValue({
        sessionId: "session-1",
        statusKey: "COMPLETED",
        completedAt: "2026-07-17T10:00:00Z",
      });

      await play.uploadAndCompleteSession();

      const seat = play.resultsSnapshot?.seats[0];
      expect(seat?.highestScore).toBe(180);
      expect(seat?.hundredPlus).toBe(1);
      expect(seat?.oneTwentyPlus).toBe(1);
      expect(seat?.oneFortyPlus).toBe(1);
      expect(seat?.oneEighties).toBe(1);
    });

    it("treats SESSION_ALREADY_COMPLETED as success on the completion path", async () => {
      const play = makePlay();

      const error = new Error("SESSION_ALREADY_COMPLETED");
      (error as { code?: string }).code = "SESSION_ALREADY_COMPLETED";
      vi.mocked(completeSession).mockRejectedValue(error);
      vi.mocked(appendBatch).mockResolvedValue({
        created: { stages: 1, turns: 1, darts: 3 },
      });

      await play.uploadAndCompleteSession();

      expect(play.completionError).toBe("");
      expect(play.completionStatus).toBe("succeeded");
    });

    it('sets completionStatus = "failed" and keeps buttons disabled on error', async () => {
      const play = makePlay();

      vi.mocked(appendBatch).mockRejectedValue(new Error("Network error"));

      await play.uploadAndCompleteSession();

      expect(play.completionError).toContain("connection");
      expect(play.completionStatus).toBe("failed");
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

    it("ST4: playAgain reuses the original template so provenance matches the first play", async () => {
      const play = makePlay({
        idempotencyKey: "old-key",
        timerRemainingMs: 1000,
        timerExpired: true,
      });
      play.completionStatus = "succeeded";
      play.finished = true;
      play.resultsSnapshot = {
        status: "COMPLETE",
        winningSideKey: null,
        seats: [
          {
            participantRef: "participant-1",
            sideKey: "A",
            total: 50,
            threeDartAverage: "50.0",
            firstNineAverage: "50.0",
            highestScore: 50,
            hundredPlus: 0,
            oneTwentyPlus: 0,
            oneFortyPlus: 0,
            oneEighties: 0,
          },
        ],
      };
      play.playAgainError = "stale";
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
        gameTypeKey: "SCORE_TRAINING",
        rulesetVersionKey: "SCORE_TRAINING_V1",
        captureModeKey: "RECREATIONAL",
        inputModeKey: "QUICK_SCORE",
        config: {
          source: "template",
          templateRef: "tpl-1",
          overrides: { duration_value: 20 },
        },
      });
      expect(play.$store.game.sessionId).toBe("new-session");
      expect(play.$store.game.seats[0].participantRef).toBe("new-participant");
      expect(play.$store.game.turns).toEqual([]);
      expect(play.$store.game.stages).toEqual([BLOCK]);
      expect(play.$store.game.idempotencyKey).toBeNull();
      expect(play.$store.game.timerRemainingMs).toBeNull();
      expect(play.$store.game.timerExpired).toBe(false);
      const { seats: _nextSeats, ...nextRulesetConfig } =
        play.$store.game.configSnapshot!;
      expect(nextRulesetConfig).toEqual(priorRulesetConfig);
      expect(play.finished).toBe(false);
      expect(play.completionStatus).toBe("pending");
      expect(play.completionError).toBe("");
      expect(play.playAgainError).toBe("");
      expect(play.resultsSnapshot).toBeNull();
      expect(play.hasActiveSession).toBe(true);
    });

    it("replays with the session's own round count, not the template default", async () => {
      const play = makePlay({ configSnapshot: rounds(25) });

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

      expect(createSession).toHaveBeenCalledWith(
        expect.objectContaining({
          config: {
            source: "template",
            templateRef: "tpl-1",
            overrides: { duration_value: 25 },
          },
        }),
      );
    });

    it("replays with the session's own minute count, not the template default", async () => {
      const play = makePlay({ configSnapshot: minutes(12) });

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

      expect(createSession).toHaveBeenCalledWith(
        expect.objectContaining({
          config: {
            source: "template",
            templateRef: "tpl-1",
            overrides: { duration_value: 12 },
          },
        }),
      );
    });

    it("playAgain starts a fresh engine whose first visit is sequence 1", async () => {
      const play = makePlay();
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
      play.scoreInput.setValue("40");
      await play.submitVisit();

      expect(play.$store.game.turns).toHaveLength(1);
      expect(play.$store.game.turns[0].sequence).toBe(1);
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
      expect(play.$store.game.sessionId).toBe("new-session");
    });

    it("replays a 1v1 match with both seats, engine-seated on the NEW session's refs", async () => {
      const play = makePlay({
        configSnapshot: { ...rounds(20), seats: TWO_SEATS },
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
      } as Awaited<ReturnType<typeof createSession>>);

      await play.playAgain();

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
      } as Awaited<ReturnType<typeof createSession>>);

      await play.playAgain();

      expect(
        vi.mocked(createSession).mock.calls[0][0].participants,
      ).toBeUndefined();
      expect(
        play.engine?.state().seats.map((seat) => seat.participantRef),
      ).toEqual(["new-participant"]);
    });

    it("submitVisit is a no-op when finished is already true", async () => {
      const store = gameStub();
      const component = {
        ...scoreTrainingPlay(),
        $store: { game: store, settings: settingsStub() },
      };
      component.scoreInput.setValue("30");
      vi.mocked(appendBatch).mockResolvedValue({
        created: { stages: 1, turns: 2, darts: 0 },
      });
      vi.mocked(completeSession).mockResolvedValue({
        sessionId: "s1",
        statusKey: "COMPLETED",
        completedAt: "now",
      });
      await component.init.call(component);
      await component.submitVisit.call(component);
      component.scoreInput.setValue("30");
      await component.submitVisit.call(component);
      await component.confirmFinish.call(component);
      expect(component.finished).toBe(true);
      const turnCount = store.turns.length;

      component.scoreInput.setValue("99");
      await component.submitVisit.call(component);

      expect(store.turns).toHaveLength(turnCount);
      expect(appendBatch).toHaveBeenCalledTimes(1);
    });

    it("sets finished and completionStatus pending on final visit before upload settles", async () => {
      const store = gameStub();
      const component = {
        ...scoreTrainingPlay(),
        $store: { game: store, settings: settingsStub() },
      };
      component.scoreInput.setValue("30");
      let statusDuringUpload: string | null = null;
      vi.mocked(appendBatch).mockImplementation(async () => {
        statusDuringUpload = component.completionStatus;
        return { created: { stages: 1, turns: 2, darts: 0 } };
      });
      vi.mocked(completeSession).mockResolvedValue({
        sessionId: "s1",
        statusKey: "COMPLETED",
        completedAt: "now",
      });
      await component.init.call(component);
      await component.submitVisit.call(component);
      component.scoreInput.setValue("30");
      await component.submitVisit.call(component);
      await component.confirmFinish.call(component);

      expect(component.finished).toBe(true);
      expect(
        statusDuringUpload === "pending" || statusDuringUpload === "saving",
      ).toBe(true);
      expect(component.completionStatus).toBe("succeeded");
      expect(component.resultsSnapshot).toEqual({
        status: "COMPLETE",
        winningSideKey: null,
        seats: [
          {
            participantRef: "participant-1",
            sideKey: "A",
            total: 60,
            threeDartAverage: "30.0",
            firstNineAverage: "30.0",
            highestScore: 30,
            sixtyPlus: 0,
            hundredPlus: 0,
            oneTwentyPlus: 0,
            oneFortyPlus: 0,
            oneEighties: 0,
          },
        ],
      });
    });

    it("retries uploadAndCompleteSession without recording a new turn", async () => {
      vi.mocked(appendBatch).mockRejectedValueOnce(new Error("network blip"));
      vi.mocked(appendBatch).mockResolvedValueOnce({
        created: { stages: 1, turns: 2, darts: 0 },
      });
      vi.mocked(completeSession).mockResolvedValue({
        sessionId: "s1",
        statusKey: "COMPLETED",
        completedAt: "now",
      });
      const store = gameStub();
      const component = {
        ...scoreTrainingPlay(),
        $store: { game: store, settings: settingsStub() },
      };
      component.scoreInput.setValue("30");
      await component.init.call(component);
      await component.submitVisit.call(component);
      component.scoreInput.setValue("30");
      await component.submitVisit.call(component);
      await component.confirmFinish.call(component);
      expect(component.completionStatus).toBe("failed");
      expect(component.finished).toBe(true);
      const turnCountBeforeRetry = store.turns.length;
      const keyAfterFailure = store.idempotencyKey;

      await component.uploadAndCompleteSession.call(component);

      expect(store.turns).toHaveLength(turnCountBeforeRetry);
      expect(store.idempotencyKey).toBe(keyAfterFailure);
      expect(component.completionStatus).toBe("succeeded");
      expect(store.reset).not.toHaveBeenCalled();
    });
  });

  describe("finish confirm gate", () => {
    it("completing submitVisit stashes pending score and does not commit or upload", async () => {
      const store = gameStub(); // durationValue: 2
      vi.mocked(appendBatch).mockResolvedValue({
        created: { stages: 1, turns: 2, darts: 0 },
      });
      vi.mocked(completeSession).mockResolvedValue({
        sessionId: "s1",
        statusKey: "COMPLETED",
        completedAt: "now",
      });
      const component = {
        ...scoreTrainingPlay(),
        $store: { game: store, settings: settingsStub() },
      };
      component.scoreInput.setValue("30");
      await component.init.call(component);
      await component.submitVisit.call(component); // visit 1
      component.scoreInput.setValue("55");
      await component.submitVisit.call(component); // would complete

      expect(store.turns).toHaveLength(1);
      expect(component.showFinishConfirm).toBe(true);
      expect(component.pendingFinishScore).toBe(55);
      expect(component.scoreInput.value).toBe("");
      expect(component.finished).toBe(false);
      expect(appendBatch).not.toHaveBeenCalled();
    });

    it("never records the finishing visit before it is confirmed, so no rollback is needed", async () => {
      const store = gameStub(); // durationValue: 2
      const component = {
        ...scoreTrainingPlay(),
        $store: { game: store, settings: settingsStub() },
      };
      component.scoreInput.setValue("30");
      await component.init.call(component);
      await component.submitVisit.call(component); // visit 1
      const factsWrites = vi.mocked(store.recordFacts).mock.calls.length;
      const logBefore = structuredClone(store.turns);

      component.scoreInput.setValue("55");
      await component.submitVisit.call(component); // would complete

      expect(component.showFinishConfirm).toBe(true);
      expect(vi.mocked(store.recordFacts).mock.calls.length).toBe(factsWrites);
      expect(store.turns).toEqual(logBefore);
    });

    it("surfaces the range error instead of opening the finish confirm on an invalid finishing visit", async () => {
      const store = gameStub({ configSnapshot: rounds(1) });
      const component = {
        ...scoreTrainingPlay(),
        $store: { game: store, settings: settingsStub() },
      };
      await component.init.call(component);

      component.scoreInput.setValue("999");
      await component.submitVisit.call(component);

      expect(component.showFinishConfirm).toBe(false);
      expect(component.pendingFinishScore).toBeNull();
      expect(component.error).toBe("Enter a score between 0 and 180.");
      expect(store.turns).toHaveLength(0);
    });

    it("cancelFinish restores scoreInput and clears pending without committing", async () => {
      const store = gameStub();
      const component = {
        ...scoreTrainingPlay(),
        $store: { game: store, settings: settingsStub() },
      };
      component.scoreInput.setValue("30");
      await component.init.call(component);
      await component.submitVisit.call(component);
      component.scoreInput.setValue("55");
      await component.submitVisit.call(component);

      component.cancelFinish();

      expect(component.showFinishConfirm).toBe(false);
      expect(component.pendingFinishScore).toBeNull();
      expect(component.scoreInput.value).toBe("55");
      expect(store.turns).toHaveLength(1);
      expect(component.finished).toBe(false);
    });

    it("a cancelled finish leaves the engine log unchanged so the next visit is not double-counted", async () => {
      const store = gameStub({ configSnapshot: rounds(3) });
      const component = {
        ...scoreTrainingPlay(),
        $store: { game: store, settings: settingsStub() },
      };
      await component.init.call(component);
      component.scoreInput.setValue("30");
      await component.submitVisit.call(component);
      component.scoreInput.setValue("40");
      await component.submitVisit.call(component);
      component.scoreInput.setValue("55");
      await component.submitVisit.call(component);
      expect(component.showFinishConfirm).toBe(true);

      component.cancelFinish();
      await component.submitVisit.call(component);

      expect(store.turns.map((t) => t.totalScore)).toEqual([30, 40]);
      expect(component.showFinishConfirm).toBe(true);
      expect(component.pendingFinishScore).toBe(55);
    });

    it("confirmFinish commits pending, sets finished, and uploads", async () => {
      const store = gameStub();
      vi.mocked(appendBatch).mockResolvedValue({
        created: { stages: 1, turns: 2, darts: 0 },
      });
      vi.mocked(completeSession).mockResolvedValue({
        sessionId: "s1",
        statusKey: "COMPLETED",
        completedAt: "now",
      });
      const component = {
        ...scoreTrainingPlay(),
        $store: { game: store, settings: settingsStub() },
      };
      component.scoreInput.setValue("30");
      await component.init.call(component);
      await component.submitVisit.call(component);
      component.scoreInput.setValue("55");
      await component.submitVisit.call(component);

      await component.confirmFinish.call(component);

      expect(store.turns).toHaveLength(2);
      expect(store.turns[1].totalScore).toBe(55);
      expect(store.turns[1].sequence).toBe(2);
      expect(component.showFinishConfirm).toBe(false);
      expect(component.pendingFinishScore).toBeNull();
      expect(component.finished).toBe(true);
      expect(appendBatch).toHaveBeenCalledTimes(1);
      expect(completeSession).toHaveBeenCalledWith("s1", "COMPLETED");
      expect(component.completionStatus).toBe("succeeded");
    });

    it("undoVisit is a no-op while finish confirm is open", async () => {
      const store = gameStub();
      const component = {
        ...scoreTrainingPlay(),
        $store: { game: store, settings: settingsStub() },
      };
      component.scoreInput.setValue("30");
      await component.init.call(component);
      await component.submitVisit.call(component);
      component.scoreInput.setValue("55");
      await component.submitVisit.call(component);
      const turnsBefore = store.turns.length;

      component.undoVisit();

      expect(store.turns).toHaveLength(turnsBefore);
    });
  });

  describe("abandonAndExit", () => {
    function makeAbandonPlay(gameOverrides: Partial<GameStub> = {}) {
      return {
        ...scoreTrainingPlay(),
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
      const play = makeAbandonPlay({ turns: [turnFact("t1", 1, 60)] });

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
      expect(play.$store.game.reset).toHaveBeenCalled();
      expect(locationSpy.href).toBe("/games");
    });

    it("ignores a second call while $store.game.loading is true", async () => {
      let resolveComplete!: (
        v: Awaited<ReturnType<typeof completeSession>>,
      ) => void;
      vi.mocked(completeSession).mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveComplete = resolve;
          }),
      );
      const play = makeAbandonPlay();

      const first = play.abandonAndExit.call(play);
      const second = play.abandonAndExit.call(play);
      expect(completeSession).toHaveBeenCalledTimes(1);

      resolveComplete({
        sessionId: "s1",
        statusKey: "ABANDONED",
        completedAt: "now",
      });
      await Promise.all([first, second]);
      expect(completeSession).toHaveBeenCalledTimes(1);
    });

    it("sets error on PATCH failure and does not navigate or reset", async () => {
      const locationSpy = { href: "/games/score-training/play" };
      vi.stubGlobal("location", locationSpy);
      vi.mocked(completeSession).mockRejectedValue(new Error("Network error"));
      const play = makeAbandonPlay();

      await play.abandonAndExit.call(play);

      expect(play.error).toBe("Could not abandon session. Try again.");
      expect(play.$store.game.loading).toBe(false);
      expect(play.$store.game.reset).not.toHaveBeenCalled();
      expect(locationSpy.href).toBe("/games/score-training/play");
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

  describe("keypad helpers + visitInput validation", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it("scoreInput appends digits and rejects length > 3", () => {
      const component = {
        ...scoreTrainingPlay(),
        $store: { game: gameStub(), settings: settingsStub() },
      };
      component.scoreInput.appendDigit(1);
      vi.advanceTimersByTime(41);
      component.scoreInput.appendDigit(8);
      vi.advanceTimersByTime(41);
      component.scoreInput.appendDigit(0);
      expect(component.scoreInput.value).toBe("180");
      component.scoreInput.appendDigit(0);
      expect(component.scoreInput.value).toBe("180");
    });

    it('scoreInput replaces a lone "0" instead of prefixing', () => {
      const component = {
        ...scoreTrainingPlay(),
        $store: { game: gameStub(), settings: settingsStub() },
      };
      component.scoreInput.appendDigit(0);
      expect(component.scoreInput.value).toBe("0");
      vi.advanceTimersByTime(41);
      component.scoreInput.appendDigit(5);
      expect(component.scoreInput.value).toBe("5");
    });

    it("scoreInput deleteLast / clear work for play composition", () => {
      const component = {
        ...scoreTrainingPlay(),
        $store: { game: gameStub(), settings: settingsStub() },
      };
      component.scoreInput.setValue("45");
      component.scoreInput.deleteLast({ detail: 1 });
      expect(component.scoreInput.value).toBe("4");
      component.scoreInput.clear();
      expect(component.scoreInput.value).toBe("");
    });

    it("surfaces the engine's range rejection and does not clear scoreInput", async () => {
      vi.useRealTimers();
      const store = gameStub();
      const component = {
        ...scoreTrainingPlay(),
        $store: { game: store, settings: settingsStub() },
      };
      component.scoreInput.setValue("999");
      await component.init.call(component);
      await component.submitVisit.call(component);
      expect(component.error).toBe("Enter a score between 0 and 180.");
      expect(component.scoreInput.value).toBe("999");
      expect(component.loading).toBe(false);
      expect(store.turns).toHaveLength(0);
    });
  });

  describe("undoVisit", () => {
    it("pops the engine log, mirrors it into the store and clears scoreInput", async () => {
      const store = gameStub({ configSnapshot: rounds(20) });
      const component = {
        ...scoreTrainingPlay(),
        $store: { game: store, settings: settingsStub() },
      };
      component.scoreInput.setValue("45");
      await component.init.call(component);
      await component.submitVisit.call(component);
      expect(store.turns).toHaveLength(1);

      component.scoreInput.setValue("99");
      component.undoVisit();

      expect(store.turns).toHaveLength(0);
      expect(component.scoreInput.value).toBe("");
      expect(component.error).toBe("");
    });

    it("is a no-op when there are no turns", async () => {
      const store = gameStub({ configSnapshot: rounds(20) });
      const component = {
        ...scoreTrainingPlay(),
        $store: { game: store, settings: settingsStub() },
      };
      component.scoreInput.setValue("12");
      await component.init.call(component);
      const recordCallsAfterInit = vi.mocked(store.recordFacts).mock.calls
        .length;

      component.undoVisit();

      expect(vi.mocked(store.recordFacts).mock.calls.length).toBe(
        recordCallsAfterInit,
      );
      expect(component.scoreInput.value).toBe("12");
    });

    it("undoes a turn replayed from persisted facts without rebuilding the engine", async () => {
      const store = gameStub({
        configSnapshot: rounds(20),
        turns: [turnFact("t1", 1, 40), turnFact("t2", 2, 50)],
      });
      const component = {
        ...scoreTrainingPlay(),
        $store: { game: store, settings: settingsStub() },
      };
      await component.init.call(component);

      component.undoVisit();
      expect(store.turns).toHaveLength(1);

      component.scoreInput.setValue("60");
      await component.submitVisit.call(component);
      const last = store.turns[store.turns.length - 1];
      expect(last.sequence).toBe(2);
      expect(last.totalScore).toBe(60);
    });
  });
});

/**
 * Board coordinates reused from `board-input.data.test.ts` and
 * `five-oh-one-play.data.test.ts`: `(0, -50)` sits mid inner-single on sector
 * 20, `(0, -102)` mid-treble on sector 20 — the same landmarks the
 * input-controller tests already pin, so a location here means the same thing
 * there.
 */
const SINGLE_20: DartObservation = {
  hitTargetNumber: 20,
  hitZoneKey: "INNER_SINGLE",
  locationX: 0,
  locationY: -50,
};

const TREBLE_20: DartObservation = {
  hitTargetNumber: 20,
  hitZoneKey: "TREBLE",
  locationX: 0,
  locationY: -102,
};

function boardPlay(
  gameOverrides: Partial<GameStub> = {},
  settingsOverrides: Partial<SettingsStub> = {},
): ScoreTrainingPlayContext {
  return {
    ...scoreTrainingPlay(),
    $store: {
      game: gameStub({ configSnapshot: rounds(20), ...gameOverrides }),
      settings: settingsStub({
        captureModeKey: "ANALYTICS",
        inputModeKey: "VISUAL_BOARD",
        ...settingsOverrides,
      }),
    },
  };
}

const VISUAL_ACTIVE_SESSION = {
  ...ACTIVE_SESSION,
  captureModeKey: "ANALYTICS",
  inputModeKey: "VISUAL_BOARD",
} as const;

describe("scoreTrainingPlay — visual board input", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    segmentTimerInstances.length = 0;
    vi.mocked(fetchActiveSessions).mockResolvedValue([
      { ...VISUAL_ACTIVE_SESSION },
    ]);
  });

  it("adopts the active session's mode pair onto the game store, so the board gate reads it", async () => {
    const play = boardPlay({}, { inputModeKey: "QUICK_SCORE" });

    await play.init.call(play);

    expect(play.$store.game.captureModeKey).toBe("ANALYTICS");
    expect(play.$store.game.inputModeKey).toBe("VISUAL_BOARD");
  });

  it("passes the dart observation itself to the engine, not a visit total", async () => {
    const play = boardPlay();
    await play.init.call(play);

    play.recordDart.call(play, SINGLE_20);

    expect(play.$store.game.turns).toHaveLength(1);
    expect(play.$store.game.turns[0].completedAt).toBeNull();
    expect(play.$store.game.turns[0].darts).toHaveLength(1);
    expect(play.$store.game.turns[0].darts[0]).toMatchObject({
      score: 20,
      hitZoneKey: "INNER_SINGLE",
      locationX: 0,
      locationY: -50,
    });
  });

  it("closes the visit on the third dart, with a total equal to the sum of its darts", async () => {
    const play = boardPlay();
    await play.init.call(play);

    play.recordDart.call(play, SINGLE_20);
    play.recordDart.call(play, TREBLE_20);
    expect(play.$store.game.turns[0].completedAt).toBeNull();

    play.recordDart.call(play, SINGLE_20);

    const turn = play.$store.game.turns[0];
    expect(play.$store.game.turns).toHaveLength(1);
    expect(turn.darts).toHaveLength(3);
    expect(turn.completedAt).not.toBeNull();
    expect(turn.totalScore).toBe(20 + 60 + 20);
  });

  it("undo removes one dart at a time, not the whole visit", async () => {
    const play = boardPlay();
    await play.init.call(play);
    play.recordDart.call(play, SINGLE_20);
    play.recordDart.call(play, TREBLE_20);

    play.undoVisit.call(play);

    expect(play.$store.game.turns).toHaveLength(1);
    expect(play.$store.game.turns[0].darts).toHaveLength(1);
    expect(play.$store.game.turns[0].totalScore).toBe(20);
  });

  it("defers a session-completing dart to the finish confirm instead of uploading", async () => {
    const play = boardPlay({ configSnapshot: rounds(1) });
    await play.init.call(play);
    play.recordDart.call(play, SINGLE_20);
    play.recordDart.call(play, SINGLE_20);

    play.recordDart.call(play, SINGLE_20);

    expect(play.showFinishConfirm).toBe(true);
    expect(play.pendingDartObservation).toEqual(SINGLE_20);
    expect(play.$store.game.turns[0].darts).toHaveLength(2);
    expect(play.finished).toBe(false);
    expect(appendBatch).not.toHaveBeenCalled();
  });

  it("confirmFinish records the deferred dart, then uploads and completes", async () => {
    vi.mocked(appendBatch).mockResolvedValue({
      created: { stages: 1, turns: 1, darts: 3 },
    });
    vi.mocked(completeSession).mockResolvedValue({
      sessionId: "s1",
      statusKey: "COMPLETED",
      completedAt: "now",
    });
    const play = boardPlay({ configSnapshot: rounds(1) });
    await play.init.call(play);
    play.recordDart.call(play, SINGLE_20);
    play.recordDart.call(play, SINGLE_20);
    play.recordDart.call(play, SINGLE_20);

    await play.confirmFinish.call(play);

    expect(play.pendingDartObservation).toBeNull();
    expect(play.$store.game.turns[0].darts).toHaveLength(3);
    expect(play.$store.game.turns[0].totalScore).toBe(60);
    expect(play.finished).toBe(true);
    expect(appendBatch).toHaveBeenCalledTimes(1);
    expect(completeSession).toHaveBeenCalledWith("s1", "COMPLETED");
  });

  it("cancelFinish discards the deferred dart and leaves the session open", async () => {
    const play = boardPlay({ configSnapshot: rounds(1) });
    await play.init.call(play);
    play.recordDart.call(play, SINGLE_20);
    play.recordDart.call(play, SINGLE_20);
    play.recordDart.call(play, SINGLE_20);

    play.cancelFinish.call(play);

    expect(play.showFinishConfirm).toBe(false);
    expect(play.pendingDartObservation).toBeNull();
    expect(play.$store.game.turns[0].darts).toHaveLength(2);
    expect(play.finished).toBe(false);
    expect(play.scoreInput.value).toBe("");
    expect(appendBatch).not.toHaveBeenCalled();
  });

  it("surfaces the engine's refusal when a keypad total is entered mid board visit", async () => {
    const play = boardPlay();
    await play.init.call(play);
    play.recordDart.call(play, SINGLE_20);

    play.scoreInput.setValue("60");
    await play.submitVisit.call(play);

    expect(play.error).toContain("Finish the open visit on the board");
    expect(play.$store.game.turns).toHaveLength(1);
    expect(play.$store.game.turns[0].darts).toHaveLength(1);
  });
});

describe("scoreTrainingPlay — reveal-then-clear board markers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    segmentTimerInstances.length = 0;
    vi.mocked(fetchActiveSessions).mockResolvedValue([
      { ...VISUAL_ACTIVE_SESSION },
    ]);
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps the closed visit's markers visible, then clears them after 1500ms", async () => {
    const play = boardPlay();
    await play.init.call(play);

    play.recordDart.call(play, SINGLE_20);
    play.recordDart.call(play, TREBLE_20);
    play.recordDart.call(play, SINGLE_20);

    const clientKey = play.$store.game.turns[0].clientKey;
    expect(play.hiddenTurnKey).toBeNull();
    expect(play.visitMarkers.call(play)).not.toEqual([]);

    vi.advanceTimersByTime(1500);

    expect(play.hiddenTurnKey).toBe(clientKey);
    expect(play.visitMarkers.call(play)).toEqual([]);
  });

  it("undoVisit cancels a pending hide timer so a reopened visit stays visible", async () => {
    const play = boardPlay();
    await play.init.call(play);
    play.recordDart.call(play, SINGLE_20);
    play.recordDart.call(play, TREBLE_20);
    play.recordDart.call(play, SINGLE_20);

    vi.advanceTimersByTime(1000);
    play.undoVisit.call(play);
    vi.advanceTimersByTime(1000);

    expect(play.hiddenTurnKey).toBeNull();
  });

  it("a MINUTES session already complete from timer expiry still arms the timer without re-triggering completion", async () => {
    const play = boardPlay({
      configSnapshot: {
        ...rounds(20),
        durationType: "MINUTES",
        durationValue: 1,
      },
    });
    await play.init.call(play);
    play.recordDart.call(play, SINGLE_20);
    play.recordDart.call(play, TREBLE_20);
    play.recordDart.call(play, SINGLE_20);
    play.engine!.expireTimer();

    play.recordDart.call(play, SINGLE_20);

    expect(appendBatch).not.toHaveBeenCalled();
    expect(play.finished).toBe(false);
  });
});

describe("scoreTrainingPlay — playAgain mode resolution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    segmentTimerInstances.length = 0;
    vi.mocked(fetchActiveSessions).mockResolvedValue([{ ...ACTIVE_SESSION }]);
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
  });

  it("sends the player's resolved mode pair to createSession, not a hardcoded quick-score pair", async () => {
    const play = boardPlay();
    play.completionStatus = "succeeded";
    play.finished = true;

    await play.playAgain.call(play);

    expect(createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        captureModeKey: "ANALYTICS",
        inputModeKey: "VISUAL_BOARD",
      }),
    );
  });
});

describe("state — folds the store's own fact log, not engine.state()", () => {
  it("returns null with no config snapshot", () => {
    const ctx = scoreTrainingPlay() as unknown as {
      $store: { game: { configSnapshot: null } };
      state: () => null;
    };
    ctx.$store = { game: { configSnapshot: null } };
    expect(ctx.state()).toBeNull();
  });

  it("reflects a dart recorded via $store.game.recordFacts, with no live engine", () => {
    const play = {
      ...scoreTrainingPlay(),
      $store: {
        game: gameStub({ configSnapshot: rounds(10) }),
        settings: settingsStub(),
      },
    } as ScoreTrainingPlayContext;
    play.engine = null;

    play.$store.game.recordFacts({
      stages: [BLOCK],
      turns: [turnFact("t1", 1, 45)],
    });

    expect(play.totalScoreFor("participant-1")).toBe(45);
  });
});
