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
import {
  armHiddenTimer,
  clearHiddenTimer,
  playAbandonAndExit,
  playBack,
  playCommitDart,
  playInit,
  playPreviewSegments,
  playRetryReconciliation,
  playUndoVisit,
  playUploadAndCompleteSession,
  playVisitMarkers,
  runPlayAgain,
} from "@lib/game/play-lifecycle";
import type { DartObservation, EngineFacts, TurnFact } from "@modules/types";
import type { GameEngine, GameEngineFactory } from "@modules/interfaces";
import type { PlayLifecycleContext, RulesetVersionKey } from "@lib/types";

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

type FakeState = { tally: number };
type FakeConfig = { label: string };

/** Minimal, deliberately ruleset-agnostic `GameEngine` used only to prove
 * `play-lifecycle.ts`'s own plumbing — not any one ruleset's rules. Records
 * one turn per `record()` call; a `hitTargetNumber === 99` observation both
 * completes the session and increments `tally`. */
class FakeEngine implements GameEngine<DartObservation, FakeState> {
  readonly rulesetVersionKey: RulesetVersionKey = "SINGLES_V1";
  readonly stageOwnership = "PER_SEAT" as const;
  private turns: TurnFact[];
  private done = false;

  constructor(prior?: EngineFacts) {
    this.turns = prior ? [...prior.turns] : [];
    this.done = this.turns.some((t) => t.totalScore === 99);
  }

  record(input: DartObservation): FakeState {
    if (this.done) throw new Error("Session already complete");
    const hit = input.hitTargetNumber === 99;
    this.turns.push({
      clientKey: `t${this.turns.length + 1}`,
      stageClientKey: "block-1",
      participantRef: "participant-1",
      sequence: this.turns.length + 1,
      completedAt: "2026-08-14T00:00:00.000Z",
      totalScore: hit ? 99 : 0,
      darts: [
        {
          sequence: 1,
          intendedTargetNumber: 99,
          intendedZoneKey: "DOUBLE",
          hitTargetNumber: input.hitTargetNumber,
          hitZoneKey: input.hitZoneKey,
          score: hit ? 99 : 0,
          locationX: null,
          locationY: null,
        },
      ],
    });
    if (hit) this.done = true;
    return this.state();
  }

  undo(): boolean {
    if (this.turns.length === 0) return false;
    this.turns.pop();
    this.done = false;
    return true;
  }

  wouldComplete(input: DartObservation): boolean {
    return input.hitTargetNumber === 99;
  }

  isComplete(): boolean {
    return this.done;
  }

  state(): FakeState {
    return { tally: this.turns.filter((t) => t.totalScore === 99).length };
  }

  facts(): EngineFacts {
    return {
      stages: [
        {
          clientKey: "block-1",
          stageTypeKey: "EXERCISE_BLOCK",
          parentClientKey: null,
          sequence: 1,
        },
      ],
      turns: [...this.turns],
    };
  }
}

const RULESET_VERSION_KEY: RulesetVersionKey = "SINGLES_V1";
const GAME_TYPE_KEY = "FAKE_GAME";

let lastCreateConfig: unknown = null;

const fakeEngineFactory: GameEngineFactory<
  FakeConfig,
  DartObservation,
  FakeState
> = {
  rulesetVersionKey: RULESET_VERSION_KEY,
  stageOwnership: "PER_SEAT",
  create(config, prior) {
    lastCreateConfig = config;
    return new FakeEngine(prior);
  },
};

function resumeEngine(game: {
  configSnapshot: FakeConfig | null;
  stages: EngineFacts["stages"];
  turns: EngineFacts["turns"];
}): FakeEngine | null {
  if (!game.configSnapshot) return null;
  return new FakeEngine({ stages: game.stages, turns: game.turns });
}

type Ctx = PlayLifecycleContext<FakeConfig, FakeEngine, { tally: number }>;

function makeContext(overrides: Partial<Ctx> = {}): Ctx {
  const context: Ctx = {
    loading: false,
    error: "",
    finished: false,
    hasActiveSession: false,
    loadingReconciliation: false,
    reconciliationFailed: false,
    completionStatus: "pending",
    completionError: "",
    playAgainError: "",
    playAgainLoading: false,
    resultsSnapshot: null,
    hiddenTurnKey: null,
    engine: null,
    $store: {
      game: {
        rulesetVersionKey: RULESET_VERSION_KEY,
        sessionId: "s1",
        templateRef: "tpl-1",
        configSnapshot: { label: "fake", seats: SEATS },
        get seats() {
          return this.configSnapshot?.seats ?? [];
        },
        captureModeKey: "RECREATIONAL",
        inputModeKey: "DETAILED_DARTS",
        stages: [],
        turns: [],
        idempotencyKey: null,
        loading: false,
        recordFacts: vi.fn(function (this: Ctx["$store"]["game"], facts) {
          this.stages = [...facts.stages];
          this.turns = [...facts.turns];
        }),
        setSessionModes: vi.fn(function (this: Ctx["$store"]["game"], modes) {
          this.captureModeKey = modes.captureModeKey;
          this.inputModeKey = modes.inputModeKey;
        }),
        reset: vi.fn(),
      },
      settings: {
        captureModeKey: "RECREATIONAL",
        inputModeKey: "DETAILED_DARTS",
      },
    },
    init: vi.fn(async function (this: Ctx) {
      await playInit(this, GAME_TYPE_KEY, resumeEngine);
    }),
    uploadAndCompleteSession: vi.fn(async function (this: Ctx) {
      await playUploadAndCompleteSession(this, (state) => ({
        tally: state.tally,
      }));
    }),
    ...overrides,
  };
  return context;
}

const ACTIVE_SESSION = {
  sessionId: "s1",
  gameTypeKey: GAME_TYPE_KEY,
  gameTypeName: "Fake Game",
  captureModeKey: "RECREATIONAL",
  inputModeKey: "DETAILED_DARTS",
  rulesetVersionKey: RULESET_VERSION_KEY,
  startedAt: "now",
} as const;

beforeEach(() => {
  vi.clearAllMocks();
  resetEngineRegistry();
  lastCreateConfig = null;
  registerEngineFactory(
    fakeEngineFactory as GameEngineFactory<unknown, unknown, unknown>,
  );
  vi.mocked(fetchActiveSessions).mockResolvedValue([{ ...ACTIVE_SESSION }]);
});

describe("playInit", () => {
  it("resumes the engine and mirrors its facts on a match", async () => {
    const context = makeContext();
    await playInit(context, GAME_TYPE_KEY, resumeEngine);
    expect(context.hasActiveSession).toBe(true);
    expect(context.engine).not.toBeNull();
    expect(context.$store.game.recordFacts).toHaveBeenCalled();
  });

  it("leaves hasActiveSession false when there is no server session for this game", async () => {
    vi.mocked(fetchActiveSessions).mockResolvedValue([]);
    const context = makeContext();
    await playInit(context, GAME_TYPE_KEY, resumeEngine);
    expect(context.hasActiveSession).toBe(false);
    expect(context.engine).toBeNull();
  });

  it("uploads immediately when the resumed engine is already complete", async () => {
    vi.mocked(appendBatch).mockResolvedValue({
      created: { stages: 1, turns: 1, darts: 1 },
    });
    vi.mocked(completeSession).mockResolvedValue({
      sessionId: "s1",
      statusKey: "COMPLETED",
      completedAt: "now",
    });
    const context = makeContext({
      $store: {
        ...makeContext().$store,
        game: {
          ...makeContext().$store.game,
          turns: [
            {
              clientKey: "t1",
              stageClientKey: "block-1",
              participantRef: "participant-1",
              sequence: 1,
              completedAt: "2026-08-14T00:00:00.000Z",
              totalScore: 99,
              darts: [],
            },
          ],
        },
      },
    });

    await playInit(context, GAME_TYPE_KEY, resumeEngine);

    expect(context.finished).toBe(true);
    expect(context.completionStatus).toBe("succeeded");
    expect(completeSession).toHaveBeenCalledWith("s1", "COMPLETED");
  });
});

describe("playRetryReconciliation", () => {
  it("delegates to context.init()", async () => {
    const context = makeContext();
    await playRetryReconciliation(context);
    expect(context.init).toHaveBeenCalledTimes(1);
  });
});

describe("playCommitDart", () => {
  it("records the observation, mirrors facts, and schedules hiddenTurnKey once the visit resolves", async () => {
    vi.useFakeTimers();
    const context = makeContext();
    await playInit(context, GAME_TYPE_KEY, resumeEngine);

    await playCommitDart(context, {
      hitTargetNumber: 1,
      hitZoneKey: "DOUBLE",
      locationX: null,
      locationY: null,
    });

    expect(context.$store.game.turns).toHaveLength(1);
    expect(context.error).toBe("");

    vi.advanceTimersByTime(1500);

    expect(context.hiddenTurnKey).toBe("t1");
    vi.useRealTimers();
  });

  it("surfaces the engine's rejection as context.error without mutating facts", async () => {
    const context = makeContext();
    await playInit(context, GAME_TYPE_KEY, resumeEngine);
    context.engine!.record({
      hitTargetNumber: 99,
      hitZoneKey: "DOUBLE",
      locationX: null,
      locationY: null,
    });

    await playCommitDart(context, {
      hitTargetNumber: 1,
      hitZoneKey: "DOUBLE",
      locationX: null,
      locationY: null,
    });

    expect(context.error).toBe("Session already complete");
    expect(context.$store.game.turns).toHaveLength(0);
  });

  it("triggers completion when the hit finishes the session", async () => {
    vi.mocked(appendBatch).mockResolvedValue({
      created: { stages: 1, turns: 1, darts: 1 },
    });
    vi.mocked(completeSession).mockResolvedValue({
      sessionId: "s1",
      statusKey: "COMPLETED",
      completedAt: "now",
    });
    const context = makeContext();
    await playInit(context, GAME_TYPE_KEY, resumeEngine);

    await playCommitDart(context, {
      hitTargetNumber: 99,
      hitZoneKey: "DOUBLE",
      locationX: null,
      locationY: null,
    });

    expect(context.finished).toBe(true);
    expect(context.uploadAndCompleteSession).toHaveBeenCalledTimes(1);
  });

  it("does nothing when there is no engine", async () => {
    const context = makeContext();
    await playCommitDart(context, {
      hitTargetNumber: 1,
      hitZoneKey: "DOUBLE",
      locationX: null,
      locationY: null,
    });
    expect(context.$store.game.turns).toHaveLength(0);
  });
});

describe("armHiddenTimer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function resolvedTurn(clientKey: string): TurnFact {
    return {
      clientKey,
      stageClientKey: "block-1",
      participantRef: "participant-1",
      sequence: 1,
      completedAt: "2026-08-26T00:00:00.000Z",
      totalScore: 60,
      darts: [],
    };
  }

  function openTurn(clientKey: string): TurnFact {
    return { ...resolvedTurn(clientKey), completedAt: null };
  }

  it("arms a 1500ms timer once the last turn has resolved", () => {
    const context: {
      hiddenTurnKey: string | null;
      hiddenTimer: ReturnType<typeof setTimeout> | null;
    } = { hiddenTurnKey: null, hiddenTimer: null };

    armHiddenTimer(context, [resolvedTurn("t1")]);

    expect(context.hiddenTurnKey).toBeNull();
    expect(context.hiddenTimer).not.toBeNull();

    vi.advanceTimersByTime(1500);

    expect(context.hiddenTurnKey).toBe("t1");
  });

  it("does nothing while the last turn is still open", () => {
    const context: {
      hiddenTurnKey: string | null;
      hiddenTimer: ReturnType<typeof setTimeout> | null;
    } = { hiddenTurnKey: null, hiddenTimer: null };

    armHiddenTimer(context, [openTurn("t1")]);

    expect(context.hiddenTimer).toBeNull();
  });

  it("does nothing when there are no turns", () => {
    const context: {
      hiddenTurnKey: string | null;
      hiddenTimer: ReturnType<typeof setTimeout> | null;
    } = { hiddenTurnKey: null, hiddenTimer: null };

    armHiddenTimer(context, []);

    expect(context.hiddenTimer).toBeNull();
  });

  it("replaces a still-pending timer rather than stacking two", () => {
    const context: {
      hiddenTurnKey: string | null;
      hiddenTimer: ReturnType<typeof setTimeout> | null;
    } = { hiddenTurnKey: null, hiddenTimer: null };

    armHiddenTimer(context, [resolvedTurn("t1")]);
    const firstTimer = context.hiddenTimer;
    armHiddenTimer(context, [resolvedTurn("t1"), resolvedTurn("t2")]);

    expect(context.hiddenTimer).not.toBe(firstTimer);

    vi.advanceTimersByTime(1500);

    expect(context.hiddenTurnKey).toBe("t2");
  });
});

describe("clearHiddenTimer", () => {
  it("cancels a pending timer and clears the key", () => {
    vi.useFakeTimers();
    const context: {
      hiddenTurnKey: string | null;
      hiddenTimer: ReturnType<typeof setTimeout> | null;
    } = { hiddenTurnKey: null, hiddenTimer: null };
    armHiddenTimer(context, [
      {
        clientKey: "t1",
        stageClientKey: "block-1",
        participantRef: "participant-1",
        sequence: 1,
        completedAt: "2026-08-26T00:00:00.000Z",
        totalScore: 60,
        darts: [],
      },
    ]);

    clearHiddenTimer(context);
    vi.advanceTimersByTime(1500);

    expect(context.hiddenTurnKey).toBeNull();
    expect(context.hiddenTimer).toBeNull();
    vi.useRealTimers();
  });

  it("is a no-op when nothing is pending", () => {
    const context: {
      hiddenTurnKey: string | null;
      hiddenTimer: ReturnType<typeof setTimeout> | null;
    } = { hiddenTurnKey: null, hiddenTimer: null };

    expect(() => clearHiddenTimer(context)).not.toThrow();

    expect(context.hiddenTurnKey).toBeNull();
  });

  it("clears an already-set hiddenTurnKey even with no pending timer", () => {
    const context: {
      hiddenTurnKey: string | null;
      hiddenTimer: ReturnType<typeof setTimeout> | null;
    } = { hiddenTurnKey: "t1", hiddenTimer: null };

    clearHiddenTimer(context);

    expect(context.hiddenTurnKey).toBeNull();
  });
});

describe("playUndoVisit", () => {
  it("reverts the last dart and clears hiddenTurnKey", async () => {
    const context = makeContext();
    await playInit(context, GAME_TYPE_KEY, resumeEngine);
    await playCommitDart(context, {
      hitTargetNumber: 1,
      hitZoneKey: "DOUBLE",
      locationX: null,
      locationY: null,
    });

    playUndoVisit(context);

    expect(context.$store.game.turns).toHaveLength(0);
    expect(context.hiddenTurnKey).toBeNull();
  });

  it("is a no-op once finished", () => {
    const context = makeContext({ finished: true, engine: new FakeEngine() });
    const undoSpy = vi.spyOn(context.engine!, "undo");
    playUndoVisit(context);
    expect(undoSpy).not.toHaveBeenCalled();
  });
});

describe("playUploadAndCompleteSession", () => {
  it("calls buildResultsSnapshot with the engine's final state and stores the result", async () => {
    vi.mocked(appendBatch).mockResolvedValue({
      created: { stages: 1, turns: 1, darts: 1 },
    });
    vi.mocked(completeSession).mockResolvedValue({
      sessionId: "s1",
      statusKey: "COMPLETED",
      completedAt: "now",
    });
    const context = makeContext();
    await playInit(context, GAME_TYPE_KEY, resumeEngine);
    context.engine!.record({
      hitTargetNumber: 99,
      hitZoneKey: "DOUBLE",
      locationX: null,
      locationY: null,
    });

    const buildResultsSnapshot = vi.fn((state: FakeState) => ({
      tally: state.tally * 10,
    }));
    await playUploadAndCompleteSession(context, buildResultsSnapshot);

    expect(buildResultsSnapshot).toHaveBeenCalledWith({ tally: 1 });
    expect(context.resultsSnapshot).toEqual({ tally: 10 });
    expect(context.completionStatus).toBe("succeeded");
  });

  it("marks completionStatus failed on a real upload error", async () => {
    vi.mocked(appendBatch).mockRejectedValue(new Error("network down"));
    const context = makeContext();
    await playInit(context, GAME_TYPE_KEY, resumeEngine);

    await playUploadAndCompleteSession(context, (state) => ({
      tally: state.tally,
    }));

    expect(context.completionStatus).toBe("failed");
    expect(context.completionError).toBe(
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
    const context = makeContext();
    await playInit(context, GAME_TYPE_KEY, resumeEngine);

    await playUploadAndCompleteSession(context, (state) => ({
      tally: state.tally,
    }));

    expect(context.completionStatus).toBe("succeeded");
  });
});

describe("playBack", () => {
  it("resets the store and navigates to /games", async () => {
    const locationSpy = { href: "" };
    vi.stubGlobal("location", locationSpy);
    const context = makeContext();

    await playBack(context);

    expect(context.$store.game.reset).toHaveBeenCalled();
    expect(locationSpy.href).toBe("/games");
  });
});

describe("playAbandonAndExit", () => {
  it("with turns: appends the batch, then completes ABANDONED, resets, navigates", async () => {
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
    const context = makeContext();
    await playInit(context, GAME_TYPE_KEY, resumeEngine);
    await playCommitDart(context, {
      hitTargetNumber: 1,
      hitZoneKey: "DOUBLE",
      locationX: null,
      locationY: null,
    });

    await playAbandonAndExit(context);

    expect(appendBatch).toHaveBeenCalledTimes(1);
    expect(completeSession).toHaveBeenCalledWith("s1", "ABANDONED");
    expect(context.$store.game.reset).toHaveBeenCalled();
    expect(locationSpy.href).toBe("/games");
  });

  it("with zero turns: skips the batch call entirely", async () => {
    vi.stubGlobal("location", { href: "" });
    vi.mocked(completeSession).mockResolvedValue({
      sessionId: "s1",
      statusKey: "ABANDONED",
      completedAt: "now",
    });
    const context = makeContext();

    await playAbandonAndExit(context);

    expect(appendBatch).not.toHaveBeenCalled();
    expect(completeSession).toHaveBeenCalledWith("s1", "ABANDONED");
  });
});

describe("runPlayAgain", () => {
  it("starts a fresh session, narrows the engine via the supplied guard, and resets play state", async () => {
    const context = makeContext({
      finished: true,
      completionStatus: "succeeded",
    });
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

    await runPlayAgain(context, GAME_TYPE_KEY, RULESET_VERSION_KEY, (engine) =>
      engine instanceof FakeEngine ? engine : null,
    );

    expect(createSession).toHaveBeenCalledWith({
      gameTypeKey: GAME_TYPE_KEY,
      rulesetVersionKey: RULESET_VERSION_KEY,
      captureModeKey: "RECREATIONAL",
      inputModeKey: "DETAILED_DARTS",
      config: { source: "template", templateRef: "tpl-1" },
    });
    expect(context.$store.game.sessionId).toBe("new-session");
    expect(context.finished).toBe(false);
    expect(context.completionStatus).toBe("pending");
    expect(context.resultsSnapshot).toBeNull();
    expect(context.engine).toBeInstanceOf(FakeEngine);
  });

  it("surfaces an error and leaves state untouched when session creation fails", async () => {
    const context = makeContext({
      finished: true,
      completionStatus: "succeeded",
    });
    vi.mocked(createSession).mockRejectedValue(new Error("boom"));

    await runPlayAgain(context, GAME_TYPE_KEY, RULESET_VERSION_KEY, (engine) =>
      engine instanceof FakeEngine ? engine : null,
    );

    expect(context.playAgainError).toBe(
      "Could not start a new session. Try again.",
    );
    expect(context.finished).toBe(true);
  });

  it("sends overrides and adopts the new snapshot when buildOverrides is supplied", async () => {
    const context = makeContext({
      finished: true,
      completionStatus: "succeeded",
    });
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

    await runPlayAgain(
      context,
      GAME_TYPE_KEY,
      RULESET_VERSION_KEY,
      (engine) => (engine instanceof FakeEngine ? engine : null),
      () => ({
        snapshot: { label: "fresh" },
        wire: { some_key: "value" },
      }),
    );

    expect(createSession).toHaveBeenCalledWith({
      gameTypeKey: GAME_TYPE_KEY,
      rulesetVersionKey: RULESET_VERSION_KEY,
      captureModeKey: "RECREATIONAL",
      inputModeKey: "DETAILED_DARTS",
      config: {
        source: "template",
        templateRef: "tpl-1",
        overrides: { some_key: "value" },
      },
    });
    expect(context.$store.game.configSnapshot).toEqual({
      label: "fresh",
      seats: [
        {
          participantRef: "new-participant",
          displayName: "Player",
          sideKey: "A",
          participantTypeKey: "PLAYER",
        },
      ],
    });
  });

  it("builds a solo replay's engine from the reseated snapshot and requests no participants", async () => {
    const context = makeContext({
      finished: true,
      completionStatus: "succeeded",
    });
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

    await runPlayAgain(context, GAME_TYPE_KEY, RULESET_VERSION_KEY, (engine) =>
      engine instanceof FakeEngine ? engine : null,
    );

    expect(
      vi.mocked(createSession).mock.calls[0][0].participants,
    ).toBeUndefined();
    expect(lastCreateConfig).toEqual({
      label: "fake",
      seats: [
        {
          participantRef: "new-participant",
          displayName: "Levi",
          sideKey: "A",
          participantTypeKey: "PLAYER",
        },
      ],
    });
  });
});

describe("runPlayAgain — a replayed 1v1 match", () => {
  function twoSeatContext() {
    const context = makeContext({
      finished: true,
      completionStatus: "succeeded",
    });
    context.$store.game.configSnapshot = { label: "fake", seats: TWO_SEATS };
    return context;
  }

  function mockTwoSeatSession() {
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
  }

  it("asks the new session for the same seats the finished match played with", async () => {
    const context = twoSeatContext();
    mockTwoSeatSession();

    await runPlayAgain(context, GAME_TYPE_KEY, RULESET_VERSION_KEY, (engine) =>
      engine instanceof FakeEngine ? engine : null,
    );

    expect(vi.mocked(createSession).mock.calls[0][0].participants).toEqual([
      { participantTypeKey: "PLAYER", sideKey: "A" },
      { participantTypeKey: "GUEST", displayName: "Guest", sideKey: "B" },
    ]);
  });

  it("builds the replay's engine from the NEW session's participant refs, never the finished session's", async () => {
    const context = twoSeatContext();
    mockTwoSeatSession();

    await runPlayAgain(context, GAME_TYPE_KEY, RULESET_VERSION_KEY, (engine) =>
      engine instanceof FakeEngine ? engine : null,
    );

    expect(lastCreateConfig).toEqual({
      label: "fake",
      seats: [
        {
          participantRef: "new-participant-1",
          displayName: "Levi",
          sideKey: "A",
          participantTypeKey: "PLAYER",
        },
        {
          participantRef: "new-participant-2",
          displayName: "Guest",
          sideKey: "B",
          participantTypeKey: "GUEST",
        },
      ],
    });
    expect(context.$store.game.configSnapshot).toEqual(lastCreateConfig);
  });
});

describe("playCommitDart — reveal-then-clear timer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("schedules hiddenTurnKey 1.5s after a resolving dart under VISUAL_BOARD", async () => {
    vi.mocked(fetchActiveSessions).mockResolvedValue([
      { ...ACTIVE_SESSION, inputModeKey: "VISUAL_BOARD" },
    ]);
    const context = makeContext();
    await playInit(context, GAME_TYPE_KEY, resumeEngine);

    await playCommitDart(context, {
      hitTargetNumber: 1,
      hitZoneKey: "DOUBLE",
      locationX: null,
      locationY: null,
    });

    expect(context.hiddenTurnKey).toBeNull();
    expect(context.hiddenTimer).not.toBeNull();

    vi.advanceTimersByTime(1500);

    expect(context.hiddenTurnKey).toBe("t1");
  });

  it("schedules the same 1.5s delay under a non-board input mode (tap/keypad)", async () => {
    const context = makeContext();
    await playInit(context, GAME_TYPE_KEY, resumeEngine);

    await playCommitDart(context, {
      hitTargetNumber: 1,
      hitZoneKey: "DOUBLE",
      locationX: null,
      locationY: null,
    });

    expect(context.hiddenTurnKey).toBeNull();
    expect(context.hiddenTimer).not.toBeNull();

    vi.advanceTimersByTime(1499);
    expect(context.hiddenTurnKey).toBeNull();

    vi.advanceTimersByTime(1);
    expect(context.hiddenTurnKey).toBe("t1");
  });

  it("clears a still-pending hide timer before scheduling a new one", async () => {
    const context = makeContext();
    await playInit(context, GAME_TYPE_KEY, resumeEngine);

    await playCommitDart(context, {
      hitTargetNumber: 1,
      hitZoneKey: "DOUBLE",
      locationX: null,
      locationY: null,
    });
    const firstTimer = context.hiddenTimer;

    vi.advanceTimersByTime(1400);
    await playCommitDart(context, {
      hitTargetNumber: 2,
      hitZoneKey: "DOUBLE",
      locationX: null,
      locationY: null,
    });

    expect(context.hiddenTimer).not.toBe(firstTimer);

    vi.advanceTimersByTime(200);
    expect(context.hiddenTurnKey).toBeNull();

    vi.advanceTimersByTime(1300);
    expect(context.hiddenTurnKey).toBe("t2");
  });
});

describe("playUndoVisit — cancels a pending hide timer", () => {
  it("clears hiddenTimer so a reopened visit stays visible", async () => {
    vi.useFakeTimers();
    vi.mocked(fetchActiveSessions).mockResolvedValue([
      { ...ACTIVE_SESSION, inputModeKey: "VISUAL_BOARD" },
    ]);
    const context = makeContext();
    await playInit(context, GAME_TYPE_KEY, resumeEngine);
    await playCommitDart(context, {
      hitTargetNumber: 1,
      hitZoneKey: "DOUBLE",
      locationX: null,
      locationY: null,
    });

    vi.advanceTimersByTime(1000);
    playUndoVisit(context);
    vi.advanceTimersByTime(1000);

    expect(context.hiddenTurnKey).toBeNull();
    vi.useRealTimers();
  });
});

describe("playVisitMarkers", () => {
  it("returns the last turn's located darts when not hidden", () => {
    const turns: TurnFact[] = [
      {
        clientKey: "t1",
        stageClientKey: "block-1",
        participantRef: "participant-1",
        sequence: 1,
        completedAt: "2026-08-15T00:00:00.000Z",
        totalScore: 60,
        darts: [
          {
            sequence: 1,
            intendedTargetNumber: null,
            intendedZoneKey: null,
            hitTargetNumber: 20,
            hitZoneKey: "TREBLE",
            score: 60,
            locationX: 0,
            locationY: -102,
          },
        ],
      },
    ];
    const context = makeContext({
      hiddenTurnKey: null,
      $store: {
        ...makeContext().$store,
        game: { ...makeContext().$store.game, turns },
      },
    });

    const markers = playVisitMarkers(context);
    expect(markers).toHaveLength(1);
    expect(markers[0].sequence).toBe(1);
  });

  it("returns empty once the last turn's key matches hiddenTurnKey", () => {
    const turns: TurnFact[] = [
      {
        clientKey: "t1",
        stageClientKey: "block-1",
        participantRef: "participant-1",
        sequence: 1,
        completedAt: "2026-08-15T00:00:00.000Z",
        totalScore: 60,
        darts: [
          {
            sequence: 1,
            intendedTargetNumber: null,
            intendedZoneKey: null,
            hitTargetNumber: 20,
            hitZoneKey: "TREBLE",
            score: 60,
            locationX: 0,
            locationY: -102,
          },
        ],
      },
    ];
    const context = makeContext({
      hiddenTurnKey: "t1",
      $store: {
        ...makeContext().$store,
        game: { ...makeContext().$store.game, turns },
      },
    });

    expect(playVisitMarkers(context)).toEqual([]);
  });
});

describe("playPreviewSegments", () => {
  function turnWithDarts(
    clientKey: string,
    darts: TurnFact["darts"],
  ): TurnFact {
    return {
      clientKey,
      stageClientKey: "block-1",
      participantRef: "participant-1",
      sequence: 1,
      completedAt: "2026-08-14T00:00:00.000Z",
      totalScore: 0,
      darts,
    };
  }

  const DART: TurnFact["darts"][number] = {
    sequence: 1,
    intendedTargetNumber: 5,
    intendedZoneKey: "DOUBLE",
    hitTargetNumber: 5,
    hitZoneKey: "DOUBLE",
    score: 10,
    locationX: null,
    locationY: null,
  };

  it("returns 3 empty placeholders when there are no turns", () => {
    expect(playPreviewSegments([], null, () => "hit")).toEqual([
      { status: "empty" },
      { status: "empty" },
      { status: "empty" },
    ]);
  });

  it("returns 3 empty placeholders when the last turn's key matches hiddenTurnKey", () => {
    const turns = [turnWithDarts("t1", [DART])];
    expect(playPreviewSegments(turns, "t1", () => "hit")).toEqual([
      { status: "empty" },
      { status: "empty" },
      { status: "empty" },
    ]);
  });

  it("classifies each thrown dart and pads the remaining slots empty", () => {
    const turns = [turnWithDarts("t1", [DART, DART])];
    const classify = vi.fn((dart: typeof DART) =>
      dart.hitTargetNumber === 5 ? ("hit" as const) : ("miss" as const),
    );
    expect(playPreviewSegments(turns, null, classify)).toEqual([
      { status: "hit" },
      { status: "hit" },
      { status: "empty" },
    ]);
    expect(classify).toHaveBeenCalledTimes(2);
  });

  it("passes each dart's index within the turn to classify", () => {
    const turns = [turnWithDarts("t1", [DART, DART, DART])];
    const seenIndexes: number[] = [];
    playPreviewSegments(turns, null, (_dart, index) => {
      seenIndexes.push(index);
      return "hit";
    });
    expect(seenIndexes).toEqual([0, 1, 2]);
  });
});
