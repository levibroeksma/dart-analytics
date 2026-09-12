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
    const store = balancedTrainingPlay();
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
    const store = balancedTrainingPlay();
    await store.init();
    expect(trainingApi.startTrainingStep).toHaveBeenCalledWith("act-1", 1);
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
    const store = balancedTrainingPlay();
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
    const store = balancedTrainingPlay();
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
    const store = balancedTrainingPlay();
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
    const store = balancedTrainingPlay();
    await store.init();
    vi.advanceTimersByTime(300_000);
    await vi.runAllTimersAsync();
    expect(sessionApi.appendBatch).toHaveBeenCalled();
  });
});
