import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@client/api/training-sessions", () => ({
  startTraining: vi.fn(),
  startTrainingStep: vi.fn(),
  completeTraining: vi.fn(),
}));
vi.mock("@client/api/sessions", () => ({
  completeSession: vi.fn(),
  appendBatch: vi.fn(),
}));

import * as trainingApi from "@client/api/training-sessions";
import { balancedTrainingPlay } from "@lib/training/balanced-training-play.data";
import type { BalancedTrainingPlayContext } from "@lib/types";

function makeStore(): BalancedTrainingPlayContext {
  return {
    ...balancedTrainingPlay(),
    $store: {
      game: { reset: vi.fn(), startSession: vi.fn() },
    },
  };
}

const STEPS = [
  {
    sequenceNumber: 1,
    exerciseTypeKey: "WARM_UP",
    exerciseRulesetVersionKey: "WARM_UP_V1",
    gameTypeKey: null,
    durationSeconds: 600,
    configuration: {
      stepDurationSeconds: 600,
      phases: [{ name: "Upper", targets: [5], weight: 1 }],
    },
  },
];

describe("balancedTrainingPlay", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(globalThis, "location", {
      value: { href: "" },
      writable: true,
      configurable: true,
    });
  });

  it("init() starts the routine and builds the training engine from the returned steps", async () => {
    vi.mocked(trainingApi.startTraining).mockResolvedValue({
      activityId: "act-1",
      routineName: "Balanced Training",
      steps: STEPS as never,
    });
    const store = makeStore();
    await store.init();
    expect(store.activityId).toBe("act-1");
    expect(store.currentStep()?.exerciseTypeKey).toBe("WARM_UP");
  });

  it("startCurrentStep() calls startTrainingStep with the current sequenceNumber and builds the Warm-Up engine", async () => {
    vi.mocked(trainingApi.startTraining).mockResolvedValue({
      activityId: "act-1",
      routineName: "Balanced Training",
      steps: STEPS as never,
    });
    vi.mocked(trainingApi.startTrainingStep).mockResolvedValue({
      sessionId: "s1",
      exerciseTypeKey: "WARM_UP",
      configuration: STEPS[0].configuration,
      participant: { ref: "pt1", displayName: "Levi" },
    });
    const store = makeStore();
    await store.init();
    expect(trainingApi.startTrainingStep).toHaveBeenCalledWith("act-1", 1);
    expect(store.warmUpEngine).not.toBeNull();
    expect(store.warmUpEngine!.state().phaseIndex).toBe(0);
  });

  it("buildWarmUpEngine() builds the Warm-Up engine directly from a configuration object", () => {
    const store = makeStore();
    store.buildWarmUpEngine(STEPS[0].configuration);
    expect(store.warmUpEngine).not.toBeNull();
    expect(store.warmUpEngine!.state().phaseIndex).toBe(0);
  });

  it("advanceWarmUp() moves the engine to its next phase", async () => {
    vi.mocked(trainingApi.startTraining).mockResolvedValue({
      activityId: "act-1",
      routineName: "Balanced Training",
      steps: STEPS as never,
    });
    vi.mocked(trainingApi.startTrainingStep).mockResolvedValue({
      sessionId: "s1",
      exerciseTypeKey: "WARM_UP",
      configuration: STEPS[0].configuration,
      participant: { ref: "pt1", displayName: "Levi" },
    });
    const store = makeStore();
    await store.init();
    store.advanceWarmUp();
    expect(store.warmUpEngine!.state().status).toBe(
      STEPS[0].configuration.phases.length > 1 ? "IN_PROGRESS" : "COMPLETE",
    );
  });
});

const SWITCHING_STEP = {
  sequenceNumber: 2,
  exerciseTypeKey: "SWITCHING",
  exerciseRulesetVersionKey: "SWITCHING_V1",
  gameTypeKey: null,
  durationSeconds: 300,
  configuration: {
    targets: [20, 19, 18],
    scoring: { single: 1, double: 2, treble: 3 },
  },
};

describe("balancedTrainingPlay — Switching", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    Object.defineProperty(globalThis, "location", {
      value: { href: "" },
      writable: true,
      configurable: true,
    });
  });
  afterEach(() => vi.useRealTimers());

  it("startCurrentStep() for SWITCHING builds the dart engine and arms a deadline", async () => {
    vi.mocked(trainingApi.startTraining).mockResolvedValue({
      activityId: "act-1",
      routineName: "Balanced Training",
      steps: [SWITCHING_STEP] as never,
    });
    vi.mocked(trainingApi.startTrainingStep).mockResolvedValue({
      sessionId: "s1",
      exerciseTypeKey: "SWITCHING",
      configuration: SWITCHING_STEP.configuration,
      participant: { ref: "pt1", displayName: "Levi" },
    });
    const store = makeStore();
    await store.init();
    expect(store.switchingEngine).not.toBeNull();
    expect(store.switchingEngine!.state().currentTargetNumber).toBe(20);
  });

  it("recordSwitchingDart() folds the dart into the engine", async () => {
    vi.mocked(trainingApi.startTraining).mockResolvedValue({
      activityId: "act-1",
      routineName: "Balanced Training",
      steps: [SWITCHING_STEP] as never,
    });
    vi.mocked(trainingApi.startTrainingStep).mockResolvedValue({
      sessionId: "s1",
      exerciseTypeKey: "SWITCHING",
      configuration: SWITCHING_STEP.configuration,
      participant: { ref: "pt1", displayName: "Levi" },
    });
    const store = makeStore();
    await store.init();
    store.recordSwitchingDart({
      hitTargetNumber: 20,
      hitZoneKey: "SINGLE",
      locationX: 0,
      locationY: 0,
    });
    expect(store.switchingEngine!.state().dartsThrown).toBe(1);
  });

  it("the armed deadline expires the engine and completes the step", async () => {
    const sessionApi = await import("@client/api/sessions");
    vi.mocked(trainingApi.startTraining).mockResolvedValue({
      activityId: "act-1",
      routineName: "Balanced Training",
      steps: [SWITCHING_STEP] as never,
    });
    vi.mocked(trainingApi.startTrainingStep).mockResolvedValue({
      sessionId: "s1",
      exerciseTypeKey: "SWITCHING",
      configuration: SWITCHING_STEP.configuration,
      participant: { ref: "pt1", displayName: "Levi" },
    });
    vi.mocked(trainingApi.completeTraining).mockResolvedValue({
      activityId: "act-1",
      completedAt: "2026-09-12T12:00:00.000Z",
    });
    const store = makeStore();
    await store.init();
    vi.advanceTimersByTime(300_000);
    await vi.runAllTimersAsync();
    expect(sessionApi.appendBatch).toHaveBeenCalled();
  });
});

const DOUBLE_PATTERN_STEP = {
  sequenceNumber: 3,
  exerciseTypeKey: "DOUBLE_PATTERN",
  exerciseRulesetVersionKey: "DOUBLE_PATTERN_V1",
  gameTypeKey: null,
  durationSeconds: 300,
  configuration: { patterns: [[20, 10, 5]] },
};

describe("balancedTrainingPlay — Double Pattern", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    Object.defineProperty(globalThis, "location", {
      value: { href: "" },
      writable: true,
      configurable: true,
    });
  });
  afterEach(() => vi.useRealTimers());

  it("startCurrentStep() for DOUBLE_PATTERN builds the dart engine and arms a deadline", async () => {
    vi.mocked(trainingApi.startTraining).mockResolvedValue({
      activityId: "act-1",
      routineName: "Balanced Training",
      steps: [DOUBLE_PATTERN_STEP] as never,
    });
    vi.mocked(trainingApi.startTrainingStep).mockResolvedValue({
      sessionId: "s1",
      exerciseTypeKey: "DOUBLE_PATTERN",
      configuration: DOUBLE_PATTERN_STEP.configuration,
      participant: { ref: "pt1", displayName: "Levi" },
    });
    const store = makeStore();
    await store.init();
    expect(store.doublePatternEngine).not.toBeNull();
    expect(store.doublePatternEngine).toBeDefined();
    expect(store.doublePatternEngine!.state().currentDoubleNumber).toBe(20);
  });

  it("visitMarkers() reads from doublePatternEngine when that is the active step", async () => {
    vi.mocked(trainingApi.startTraining).mockResolvedValue({
      activityId: "act-1",
      routineName: "Balanced Training",
      steps: [DOUBLE_PATTERN_STEP] as never,
    });
    vi.mocked(trainingApi.startTrainingStep).mockResolvedValue({
      sessionId: "s1",
      exerciseTypeKey: "DOUBLE_PATTERN",
      configuration: DOUBLE_PATTERN_STEP.configuration,
      participant: { ref: "pt1", displayName: "Levi" },
    });
    const store = makeStore();
    await store.init();
    store.recordDoublePatternDart({
      hitTargetNumber: 20,
      hitZoneKey: "DOUBLE",
      locationX: 0,
      locationY: 0,
    });
    expect(store.visitMarkers()).toHaveLength(1);
    expect(store.doublePatternEngine!.state().totalPoints).toBe(1);
  });
});

const GAME_STEP = {
  sequenceNumber: 4,
  exerciseTypeKey: "GAME",
  exerciseRulesetVersionKey: null,
  gameTypeKey: "TUOD",
  durationSeconds: 600,
  configuration: { starting_target: 41 },
};

describe("balancedTrainingPlay — Finishing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(globalThis, "location", {
      value: { href: "" },
      writable: true,
      configurable: true,
    });
  });

  it("startCurrentStep() for GAME populates the global game store and builds finishingStep", async () => {
    vi.mocked(trainingApi.startTraining).mockResolvedValue({
      activityId: "act-1",
      routineName: "Balanced Training",
      steps: [GAME_STEP] as never,
    });
    vi.mocked(trainingApi.startTrainingStep).mockResolvedValue({
      sessionId: "s1",
      exerciseTypeKey: "GAME",
      configuration: GAME_STEP.configuration,
      participant: { ref: "pt1", displayName: "Levi" },
      gameTypeKey: "TUOD",
      rulesetVersionKey: "TUOD_V1",
      captureModeKey: "ANALYTICS",
      inputModeKey: "VISUAL_BOARD",
    });
    const store = makeStore();
    await store.init();
    expect(store.$store.game.reset).toHaveBeenCalledOnce();
    expect(store.$store.game.startSession).toHaveBeenCalledWith(
      expect.objectContaining({
        gameTypeKey: "TUOD",
        rulesetVersionKey: "TUOD_V1",
        sessionId: "s1",
      }),
    );
    expect(store.finishing).not.toBeNull();
  });
});
