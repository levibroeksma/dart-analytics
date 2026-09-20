// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@client/api/training-sessions", () => ({
  abandonTraining: vi.fn(),
}));
vi.mock("@client/api/sessions", () => ({
  appendBatch: vi.fn(),
  completeSession: vi.fn(),
}));

import { abandonTraining } from "@client/api/training-sessions";
import { completeSession } from "@client/api/sessions";
import {
  gameAdapter,
  summariseTuodStep,
  summariseScoreTrainingStep,
  summariseOneTwentyOneStep,
} from "@lib/training/routines/adapters/game.adapter";
import type { RoutinePlayContext } from "@lib/types";
import type { StartTrainingStepResponseData } from "@client/api/types";

const TUOD_CONFIGURATION = {
  starting_target: 41,
  finish_bonus: 10,
  miss_penalty: 1,
  duration_type: "MINUTES",
  duration_value: 10,
  max_darts_per_turn: 3,
};

function playFactoryStub() {
  return {
    completionStatus: "pending" as string,
    timer: null,
    resultsSnapshot: null as { seats: unknown[] } | null,
    uploadAndCompleteSession: vi.fn(async function (this: {
      completionStatus: string;
    }) {
      this.completionStatus = "succeeded";
    }),
    abandonAndExit: vi.fn(async () => {}),
    // Alpine injects `$store` identically into every mounted component, so
    // the game store's own `abandonAndExit` (via `gameStep`'s real
    // `playAbandonAndExit` override) reads the same global `$store.game`
    // the routine page's own context does — mirrored here, not shared with
    // `makeContext()`'s `$store`, since this object stands in for whatever
    // Alpine would bind onto the game's own `x-data`.
    $store: {
      game: {
        loading: false,
        sessionId: "gs1",
        stages: [],
        turns: [],
        reset: vi.fn(),
      },
    },
  };
}

function makeContext(): RoutinePlayContext {
  return {
    activityId: "act-1",
    game: null,
    startSessionClock: vi.fn(),
    completeCurrentStep: vi.fn().mockResolvedValue(undefined),
    $store: {
      game: {
        loading: false,
        sessionId: null,
        reset: vi.fn(),
        startSession: vi.fn(),
      },
    },
  } as unknown as RoutinePlayContext;
}

function resultStub(): StartTrainingStepResponseData {
  return {
    sessionId: "s1",
    exerciseTypeKey: "GAME",
    configuration: TUOD_CONFIGURATION,
    participant: { ref: "pt1", displayName: "Levi" },
    gameTypeKey: "TUOD",
    rulesetVersionKey: "TUOD_V1",
    captureModeKey: "ANALYTICS",
    inputModeKey: "VISUAL_BOARD",
  } as StartTrainingStepResponseData;
}

describe("gameAdapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(globalThis, "location", {
      value: { href: "" },
      writable: true,
      configurable: true,
    });
  });

  const adapter = gameAdapter({
    rulesetVersionKey: "TUOD_V1",
    headerLabel: "finishing",
    panel: "tuod",
    playFactory: playFactoryStub,
    summarise: () => null,
  });

  it("declares its key, header label, panel and that it completes its own session", () => {
    expect(adapter.key).toBe("GAME:TUOD_V1");
    expect(adapter.headerLabel).toBe("finishing");
    expect(adapter.panel).toBe("tuod");
    expect(adapter.completesOwnSession).toBe(true);
  });

  it("facts() is always null — the game store uploads itself", () => {
    expect(adapter.facts(makeContext())).toBeNull();
  });

  it("open() seats the start-step response into $store.game and starts the session clock", () => {
    const ctx = makeContext();

    adapter.open(ctx, resultStub(), 600);

    expect(ctx.$store.game.reset).toHaveBeenCalledOnce();
    expect(ctx.$store.game.startSession).toHaveBeenCalledWith(
      expect.objectContaining({
        gameTypeKey: "TUOD",
        rulesetVersionKey: "TUOD_V1",
        sessionId: "s1",
        configSnapshot: expect.objectContaining({
          startingTarget: 41,
          seats: [
            {
              participantRef: "pt1",
              displayName: "Levi",
              sideKey: "A",
              participantTypeKey: "PLAYER",
            },
          ],
        }),
      }),
    );
    expect(ctx.startSessionClock).toHaveBeenCalledOnce();
    expect(ctx.game).not.toBeNull();
  });

  it("open() wraps playFactory so the game's own completion advances the routine", async () => {
    const ctx = makeContext();
    adapter.open(ctx, resultStub(), 600);

    await ctx.game!.uploadAndCompleteSession();

    expect(ctx.completeCurrentStep).toHaveBeenCalledOnce();
  });

  it("open() wraps abandonAndExit so leaving mid-step also abandons the routine", async () => {
    vi.mocked(completeSession).mockResolvedValue({
      sessionId: "gs1",
      statusKey: "ABANDONED",
      completedAt: "now",
    });
    const ctx = makeContext();
    adapter.open(ctx, resultStub(), 600);

    await ctx.game!.abandonAndExit();

    expect(completeSession).toHaveBeenCalledWith("gs1", "ABANDONED");
    expect(abandonTraining).toHaveBeenCalledWith("act-1");
  });

  it("close() nulls the game slot", () => {
    const ctx = makeContext();
    adapter.open(ctx, resultStub(), 600);

    adapter.close(ctx);

    expect(ctx.game).toBeNull();
  });
});

describe("summarise*Step wrappers", () => {
  function ctxWithSeat(seat: unknown): RoutinePlayContext {
    return {
      game: { resultsSnapshot: { seats: [seat] } },
    } as unknown as RoutinePlayContext;
  }

  it("summariseTuodStep reads the game's own results snapshot", () => {
    const summary = summariseTuodStep(
      ctxWithSeat({
        participantRef: "pt1",
        sideKey: "A",
        target: 47,
        checkoutPercentage: "31.25%",
      }),
    );
    expect(summary).toEqual({
      stepKey: "GAME:TUOD_V1",
      label: "Finishing",
      rows: [
        { label: "Target reached", value: "47" },
        { label: "Checkout %", value: "31.25%" },
      ],
    });
  });

  it("summariseScoreTrainingStep reads the game's own results snapshot", () => {
    const summary = summariseScoreTrainingStep(
      ctxWithSeat({
        participantRef: "pt1",
        sideKey: "A",
        total: 180,
        threeDartAverage: "60.00",
      }),
    );
    expect(summary).toEqual({
      stepKey: "GAME:SCORE_TRAINING_V1",
      label: "Scoring",
      rows: [
        { label: "Points", value: "180" },
        { label: "Average", value: "60.00" },
      ],
    });
  });

  it("summariseOneTwentyOneStep reads the game's own results snapshot", () => {
    const summary = summariseOneTwentyOneStep(
      ctxWithSeat({
        participantRef: "pt1",
        sideKey: "A",
        target: 105,
        checkoutPercentage: null,
      }),
    );
    expect(summary).toEqual({
      stepKey: "GAME:121_V2",
      label: "121",
      rows: [
        { label: "Target reached", value: "105" },
        { label: "Checkout %", value: "—" },
      ],
    });
  });

  it("every wrapper returns null when the game recorded no finished seat", () => {
    const ctx = { game: null } as unknown as RoutinePlayContext;
    expect(summariseTuodStep(ctx)).toBeNull();
    expect(summariseScoreTrainingStep(ctx)).toBeNull();
    expect(summariseOneTwentyOneStep(ctx)).toBeNull();
  });
});
