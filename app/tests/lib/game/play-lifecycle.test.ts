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
import {
  playAbandonAndExit,
  playBack,
  playCommitDart,
  playInit,
  playRetryReconciliation,
  playUndoVisit,
  playUploadAndCompleteSession,
  runPlayAgain,
} from "@lib/game/play-lifecycle";
import type { DartObservation, EngineFacts, TurnFact } from "@modules/types";
import type { GameEngine, GameEngineFactory } from "@modules/interfaces";
import type { PlayLifecycleContext, RulesetVersionKey } from "@lib/types";

type FakeState = { tally: number };
type FakeConfig = { label: string };

/** Minimal, deliberately ruleset-agnostic `GameEngine` used only to prove
 * `play-lifecycle.ts`'s own plumbing — not any one ruleset's rules. Records
 * one turn per `record()` call; a `hitTargetNumber === 99` observation both
 * completes the session and increments `tally`. */
class FakeEngine implements GameEngine<DartObservation, FakeState> {
  readonly rulesetVersionKey: RulesetVersionKey = "SINGLES_V1";
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

const fakeEngineFactory: GameEngineFactory<
  FakeConfig,
  DartObservation,
  FakeState
> = {
  rulesetVersionKey: RULESET_VERSION_KEY,
  create(_config, prior) {
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
        participantRef: "p1",
        templateRef: "tpl-1",
        configSnapshot: { label: "fake" },
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
  it("records the observation, mirrors facts, and sets hiddenTurnKey once the visit resolves", async () => {
    const context = makeContext();
    await playInit(context, GAME_TYPE_KEY, resumeEngine);

    await playCommitDart(context, {
      hitTargetNumber: 1,
      hitZoneKey: "DOUBLE",
      locationX: null,
      locationY: null,
    });

    expect(context.$store.game.turns).toHaveLength(1);
    expect(context.hiddenTurnKey).toBe("t1");
    expect(context.error).toBe("");
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
});
